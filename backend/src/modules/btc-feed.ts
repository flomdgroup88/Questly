import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CandleEngine } from './candle-engine';
import { logger } from './logger';

// ─── Source configuration ─────────────────────────────────────────────────────
// Bybit is used as primary — no cloud IP restrictions
// Binance futures as fallback (different from spot, usually not blocked)

const SOURCES = {
  bybit: {
    url: 'wss://stream.bybit.com/v5/public/spot',
    name: 'Bybit',
  },
  binanceFutures: {
    url: 'wss://fstream.binance.com/ws/btcusdt@aggTrade',
    name: 'Binance Futures',
  },
  binanceSpot: {
    url: 'wss://stream.binance.com:9443/ws/btcusdt@trade/btcusdt@bookTicker',
    name: 'Binance Spot',
  },
} as const;

type SourceKey = keyof typeof SOURCES;

interface BybitTrade {
  topic: string;
  type: string;
  ts: number;
  data: Array<{
    T: number;   // timestamp ms
    s: string;   // symbol
    S: string;   // side
    v: string;   // volume
    p: string;   // price
  }>;
}

interface BinanceTrade {
  e: 'trade' | 'aggTrade';
  T: number;
  p: string;
  q: string;
  s?: string;
}

interface BinanceBookTicker {
  e: 'bookTicker';
  b: string;
  a: string;
}

export class BtcFeed extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private currentSourceIdx = 0;
  private sourceOrder: SourceKey[] = ['bybit', 'binanceFutures', 'binanceSpot'];

  public lastPrice = 0;
  public bestBid = 0;
  public bestAsk = 0;
  public lastUpdateMs = 0;
  public tickCount = 0;
  public sourceName = '';

  constructor(private candleEngine: CandleEngine) {
    super();
    this.setMaxListeners(50);
  }

  connect(): void {
    this.connectSource(this.sourceOrder[this.currentSourceIdx]!);
  }

  private connectSource(sourceKey: SourceKey): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.terminate(); } catch {}
    }

    const source = SOURCES[sourceKey];
    this.sourceName = source.name;
    logger.info(`Connecting to BTC feed [${source.name}]: ${source.url}`);

    this.ws = new WebSocket(source.url, { handshakeTimeout: 10000 });

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      logger.info(`BTC feed connected [${source.name}]`);
      this.emit('connected', source.name);

      // Bybit requires explicit subscription
      if (sourceKey === 'bybit') {
        this.ws!.send(JSON.stringify({
          op: 'subscribe',
          args: ['publicTrade.BTCUSDT'],
        }));
      }

      this.startPing(sourceKey);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (sourceKey === 'bybit') {
          this.handleBybit(msg as BybitTrade);
        } else {
          this.handleBinance(msg as BinanceTrade | BinanceBookTicker);
        }
      } catch {}
    });

    this.ws.on('error', (err) => {
      logger.warn(`BTC feed error [${source.name}]`, { error: err.message });
      // Try next source on error
      this.tryNextSource();
    });

    this.ws.on('close', (code) => {
      this.connected = false;
      this.stopPing();
      logger.warn(`BTC feed closed [${source.name}]`, { code });
      this.emit('disconnected');
      if (code === 451 || code === 403 || code === 1006) {
        // Geo-block or connection refused — try next source immediately
        this.tryNextSource();
      } else {
        this.scheduleReconnect(sourceKey);
      }
    });

    this.ws.on('pong', () => {});
  }

  private handleBybit(msg: BybitTrade): void {
    if (!msg.topic?.startsWith('publicTrade') || !msg.data?.length) return;

    for (const trade of msg.data) {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      const tradeTimeMs = trade.T;

      this.lastPrice = price;
      this.lastUpdateMs = Date.now();
      this.tickCount++;

      this.candleEngine.onTrade(price, qty, tradeTimeMs);
      this.emit('trade', { price, quantity: qty, tradeTimeMs });

      // Approximate bid/ask from last price
      this.bestBid = price * 0.9999;
      this.bestAsk = price * 1.0001;
    }
  }

  private handleBinance(msg: BinanceTrade | BinanceBookTicker): void {
    if (msg.e === 'trade' || msg.e === 'aggTrade') {
      const trade = msg as BinanceTrade;
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.q);

      this.lastPrice = price;
      this.lastUpdateMs = Date.now();
      this.tickCount++;

      this.candleEngine.onTrade(price, qty, trade.T);
      this.emit('trade', { price, quantity: qty, tradeTimeMs: trade.T });

    } else if (msg.e === 'bookTicker') {
      const book = msg as BinanceBookTicker;
      this.bestBid = parseFloat(book.b);
      this.bestAsk = parseFloat(book.a);
      this.emit('bookTicker', { bestBid: this.bestBid, bestAsk: this.bestAsk });
    }
  }

  private tryNextSource(): void {
    if (!this.shouldReconnect) return;
    this.stopPing();
    const next = (this.currentSourceIdx + 1) % this.sourceOrder.length;
    this.currentSourceIdx = next;
    const nextKey = this.sourceOrder[next]!;
    logger.info(`Switching BTC feed source → ${SOURCES[nextKey].name}`);
    setTimeout(() => this.connectSource(nextKey), 1500);
  }

  private startPing(sourceKey: SourceKey): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      if (sourceKey === 'bybit') {
        this.ws.send(JSON.stringify({ op: 'ping' }));
      } else {
        this.ws.ping();
      }
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private scheduleReconnect(sourceKey: SourceKey): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    logger.info(`Reconnecting BTC feed [${SOURCES[sourceKey].name}] in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSource(sourceKey);
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.removeAllListeners(); try { this.ws.terminate(); } catch {} this.ws = null; }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getMsSinceLastUpdate(): number {
    return this.lastUpdateMs ? Date.now() - this.lastUpdateMs : -1;
  }
}
