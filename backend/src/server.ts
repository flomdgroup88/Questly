import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { logger } from './modules/logger';
import { initDatabase, loadTrades, loadPnlHistory, seedDefaultStrategy } from './modules/database';
import { CandleEngine } from './modules/candle-engine';
import { BtcFeed } from './modules/btc-feed';
import { PolymarketFeed } from './modules/polymarket-feed';
import { MarketDiscovery } from './modules/market-discovery';
import { StrategyEngine } from './modules/strategy-engine';
import { OrderExecutor } from './modules/order-executor';
import {
  MarketUpdate, MarketId, BotStatus, WsMessage,
  Strategy, OrderbookState,
} from './types';

// ─── Environment ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.API_KEY ?? 'changeme';
const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY ?? 'mock';
const WALLET_ADDRESS = process.env.POLYMARKET_ADDRESS ?? '0x0000000000000000000000000000000000000000';
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);

function validateEnv(): void {
  if (!process.env.API_KEY) {
    logger.warn('API_KEY not set — using default "changeme". Set a secure key in .env!');
  }
  if (!process.env.POLYMARKET_PRIVATE_KEY) {
    logger.warn('POLYMARKET_PRIVATE_KEY not set — running in DRY-RUN mode');
  }
  if (!process.env.POLYMARKET_ADDRESS) {
    logger.warn('POLYMARKET_ADDRESS not set — balance queries will fail');
  }
}

// ─── Module Initialization ───────────────────────────────────────────────────

validateEnv();
initDatabase();
seedDefaultStrategy();

const candleEngine = new CandleEngine();
const btcFeed = new BtcFeed(candleEngine);
const polymarketFeed = new PolymarketFeed();
const marketDiscovery = new MarketDiscovery();
const orderExecutor = new OrderExecutor(PRIVATE_KEY, WALLET_ADDRESS);
const strategyEngine = new StrategyEngine(orderExecutor, marketDiscovery);

// ─── Combined Market State ────────────────────────────────────────────────────

const marketState: Map<MarketId, MarketUpdate> = new Map();

function buildMarketUpdate(market: MarketId): MarketUpdate | null {
  const candle = candleEngine.getState(market);
  if (!candle) return null;

  const books = polymarketFeed.getTokenOrderbooks(market);
  const upOb: OrderbookState | undefined = books.up;
  const downOb: OrderbookState | undefined = books.down;

  return {
    market,
    candleOpenPrice: candle.openPrice,
    btcCurrentPrice: candle.currentPrice,
    btcDeltaUsd: candle.deltaUsd,
    timeElapsedMs: candle.timeElapsedMs,
    timeRemainingMs: candle.timeRemainingMs,
    upSharePrice: upOb?.midPrice ?? 0,
    downSharePrice: downOb?.midPrice ?? 0,
    upBestBid: upOb?.bestBid ?? 0,
    upBestAsk: upOb?.bestAsk ?? 0,
    downBestBid: downOb?.bestBid ?? 0,
    downBestAsk: downOb?.bestAsk ?? 0,
    timestampMs: Date.now(),
  };
}

// ─── Express + HTTP Server ───────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// Auth middleware
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const key = req.headers['x-api-key'] ?? req.query['apiKey'];
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// REST endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    botStatus: strategyEngine.isPaused() ? 'PAUSED' : 'RUNNING',
    dryRun: orderExecutor.isDryRun(),
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.get('/api/trades', requireApiKey, (req, res) => {
  const limit = parseInt(String(req.query.limit ?? '100'));
  const offset = parseInt(String(req.query.offset ?? '0'));
  res.json(loadTrades(limit, offset));
});

app.get('/api/pnl-history', requireApiKey, (_req, res) => {
  res.json(loadPnlHistory());
});

app.get('/api/strategies', requireApiKey, (_req, res) => {
  res.json(strategyEngine.getStrategies());
});

app.get('/api/positions', requireApiKey, (_req, res) => {
  res.json(strategyEngine.getOpenPositions());
});

// Serve React dashboard
// __dirname on Railway = /app/backend/dist, on VPS = /opt/polybot/backend/dist
// Going up 2 levels reaches project root in both cases
const DASHBOARD_DIST = process.env.DASHBOARD_DIST
  ?? path.join(__dirname, '..', '..', 'dashboard', 'dist');
if (fs.existsSync(DASHBOARD_DIST)) {
  app.use(express.static(DASHBOARD_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DASHBOARD_DIST, 'index.html'));
  });
  logger.info(`Serving dashboard from ${DASHBOARD_DIST}`);
}

const httpServer = http.createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const clients: Set<WebSocket> = new Set();

function broadcast(msg: WsMessage): void {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendToClient(client: WebSocket, msg: WsMessage): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws, req) => {
  // Authenticate via query param
  const url = new URL(req.url ?? '/', `http://localhost`);
  const key = url.searchParams.get('apiKey');
  if (key !== API_KEY) {
    ws.close(4001, 'Unauthorized');
    logger.warn('Rejected WS connection — bad API key');
    return;
  }

  clients.add(ws);
  logger.info(`Dashboard client connected (${clients.size} total)`);

  // Send initial state
  void sendInitialState(ws);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type: string; data?: unknown };
      handleClientMessage(ws, msg);
    } catch (e) {
      logger.warn('Invalid WS message from client', { error: e });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    logger.info(`Dashboard client disconnected (${clients.size} remaining)`);
  });

  ws.on('error', (err) => {
    logger.warn('WS client error', { error: err.message });
    clients.delete(ws);
  });
});

async function sendInitialState(ws: WebSocket): Promise<void> {
  // Bot status
  sendToClient(ws, {
    type: 'BOT_STATUS',
    data: {
      status: strategyEngine.isPaused() ? 'PAUSED' : 'RUNNING' as BotStatus,
      message: orderExecutor.isDryRun() ? 'DRY-RUN mode — no real orders' : 'Live trading',
      dryRun: orderExecutor.isDryRun(),
    },
  });

  // Balance
  const balance = await orderExecutor.getBalance();
  sendToClient(ws, { type: 'BALANCE_UPDATE', data: { usdc: balance } });

  // Strategies
  sendToClient(ws, {
    type: 'STRATEGIES_LIST',
    data: strategyEngine.getStrategies(),
  });

  // Open positions
  sendToClient(ws, {
    type: 'OPEN_POSITIONS',
    data: strategyEngine.getOpenPositions(),
  });

  // Recent trades
  sendToClient(ws, {
    type: 'TRADES_HISTORY',
    data: loadTrades(100, 0),
  });

  // PnL history
  sendToClient(ws, {
    type: 'INIT_STATE',
    data: {
      pnlHistory: loadPnlHistory(),
      markets: marketDiscovery.getAllMarkets(),
      dryRun: orderExecutor.isDryRun(),
    },
  });

  // Latest market updates
  for (const update of marketState.values()) {
    sendToClient(ws, { type: 'MARKET_UPDATE', data: update });
  }
}

function handleClientMessage(ws: WebSocket, msg: { type: string; data?: unknown }): void {
  logger.debug('Client message', { type: msg.type });

  switch (msg.type) {
    case 'PAUSE_BOT':
      strategyEngine.pause();
      broadcast({ type: 'BOT_STATUS', data: { status: 'PAUSED', message: 'Bot paused by user' } });
      break;

    case 'RESUME_BOT':
      strategyEngine.resume();
      broadcast({ type: 'BOT_STATUS', data: { status: 'RUNNING', message: 'Bot resumed' } });
      break;

    case 'UPDATE_STRATEGY': {
      const strategy = msg.data as Strategy;
      if (!strategy?.id) break;
      strategyEngine.upsertStrategy(strategy);
      broadcast({ type: 'STRATEGIES_LIST', data: strategyEngine.getStrategies() });
      break;
    }

    case 'DELETE_STRATEGY': {
      const { strategyId } = msg.data as { strategyId: string };
      if (!strategyId) break;
      strategyEngine.deleteStrategy(strategyId);
      broadcast({ type: 'STRATEGIES_LIST', data: strategyEngine.getStrategies() });
      break;
    }

    case 'CLOSE_POSITION': {
      const { position_id } = msg.data as { position_id: string };
      if (!position_id) break;
      void strategyEngine.closePositionManually(position_id);
      break;
    }

    case 'GET_TRADES': {
      const { limit = 100, offset = 0 } = (msg.data as { limit?: number; offset?: number }) ?? {};
      sendToClient(ws, { type: 'TRADES_HISTORY', data: loadTrades(limit, offset) });
      break;
    }

    default:
      logger.warn('Unknown client message type', { type: msg.type });
  }
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

// Candle engine → market update broadcasts
candleEngine.on('update', (candle) => {
  const update = buildMarketUpdate(candle.market as MarketId);
  if (!update) return;
  marketState.set(candle.market as MarketId, update);

  // Feed strategy engine
  void strategyEngine.onMarketUpdate(update);

  // Broadcast to dashboard
  broadcast({ type: 'MARKET_UPDATE', data: update });
});

// Polymarket orderbook updates
polymarketFeed.on('orderbook_update', ({ marketId }: { marketId: MarketId }) => {
  const update = buildMarketUpdate(marketId);
  if (!update) return;
  marketState.set(marketId, update);
  void strategyEngine.onMarketUpdate(update);
  broadcast({ type: 'MARKET_UPDATE', data: update });
});

// Strategy engine events
strategyEngine.on('position_opened', (position) => {
  broadcast({ type: 'POSITION_UPDATE', data: position });
  broadcast({ type: 'OPEN_POSITIONS', data: strategyEngine.getOpenPositions() });
});

strategyEngine.on('position_update', (position) => {
  broadcast({ type: 'POSITION_UPDATE', data: position });
});

strategyEngine.on('position_closed', () => {
  broadcast({ type: 'OPEN_POSITIONS', data: strategyEngine.getOpenPositions() });
  // Refresh trades list
  broadcast({ type: 'TRADES_HISTORY', data: loadTrades(100, 0) });
});

strategyEngine.on('trade_closed', (trade) => {
  broadcast({ type: 'TRADE_EXECUTED', data: trade });
});

strategyEngine.on('strategy_trigger', (state) => {
  broadcast({ type: 'STRATEGY_TRIGGER', data: state });
});

strategyEngine.on('strategy_updated', () => {
  broadcast({ type: 'STRATEGIES_LIST', data: strategyEngine.getStrategies() });
});

// Market discovery
marketDiscovery.on('markets_updated', (markets) => {
  polymarketFeed.setMarkets(markets);
  logger.info('Market discovery updated', { count: markets.length });
});

marketDiscovery.on('market_rollover', ({ marketId }: { marketId: MarketId }) => {
  logger.info(`Market rolled over: ${marketId}`);
  broadcast({
    type: 'BOT_STATUS',
    data: { status: 'RUNNING', message: `Market rolled over: ${marketId}` },
  });
});

// Feed connection status
btcFeed.on('connected', () => {
  broadcast({ type: 'BOT_STATUS', data: { status: 'RUNNING', message: 'Binance connected' } });
});

btcFeed.on('disconnected', () => {
  broadcast({ type: 'BOT_STATUS', data: { status: 'ERROR', message: 'Binance WS disconnected — reconnecting' } });
});

polymarketFeed.on('connected', () => {
  broadcast({ type: 'BOT_STATUS', data: { status: 'RUNNING', message: 'Polymarket connected' } });
});

polymarketFeed.on('disconnected', () => {
  broadcast({ type: 'BOT_STATUS', data: { status: 'ERROR', message: 'Polymarket WS disconnected — reconnecting' } });
});

// ─── Periodic Updates ──────────────────────────────────────────────────────────

// Balance update every 30s
setInterval(async () => {
  const balance = await orderExecutor.getBalance();
  broadcast({ type: 'BALANCE_UPDATE', data: { usdc: balance } });
}, 30000);

// Candle timer tick (for countdown display between BTC ticks)
setInterval(() => {
  candleEngine.tick();
  // Only broadcast timer updates if no recent BTC tick
  if (btcFeed.getMsSinceLastUpdate() > 500) {
    for (const market of ['BTC_5MIN', 'BTC_15MIN'] as MarketId[]) {
      const update = buildMarketUpdate(market);
      if (update) broadcast({ type: 'MARKET_UPDATE', data: update });
    }
  }
}, 100);

// ─── Startup Sequence ─────────────────────────────────────────────────────────

async function startup(): Promise<void> {
  logger.info('═══════════════════════════════════════');
  logger.info('  PolyBot starting up...');
  logger.info(`  Port: ${PORT}`);
  logger.info(`  Mode: ${orderExecutor.isDryRun() ? 'DRY-RUN' : 'LIVE TRADING'}`);
  logger.info('═══════════════════════════════════════');

  // Step 1: Initialize strategy engine
  await strategyEngine.initialize();

  // Step 2: Connect Binance
  btcFeed.connect();

  // Step 3: Discover Polymarket markets
  await marketDiscovery.discoverMarkets();
  marketDiscovery.startAutoRefresh();

  // Step 4: Connect Polymarket WS
  polymarketFeed.connect();

  // Step 5: Start HTTP + WS server
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      resolve();
    });
  });

  // Log initial balance
  const balance = await orderExecutor.getBalance();

  logger.info('═══════════════════════════════════════');
  logger.info('  PolyBot READY');
  logger.info(`  Balance: ${balance.toFixed(2)} USDC`);
  logger.info(`  Dashboard: http://localhost:${PORT}?apiKey=${API_KEY}`);
  logger.info(`  WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`  Strategies: ${strategyEngine.getStrategies().length}`);
  logger.info(`  Dry-run: ${orderExecutor.isDryRun()}`);
  logger.info('═══════════════════════════════════════');
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown(): void {
  logger.info('Shutting down PolyBot...');
  btcFeed.disconnect();
  polymarketFeed.disconnect();
  marketDiscovery.stopAutoRefresh();
  httpServer.close(() => {
    logger.info('PolyBot stopped cleanly');
    process.exit(0);
  });
}

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

// ─── Launch ───────────────────────────────────────────────────────────────────

startup().catch((err) => {
  logger.error('Startup failed', { error: err });
  process.exit(1);
});
