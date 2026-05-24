import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { OrderbookState, OrderbookLevel, MarketId, PolymarketMarketInfo } from '../types';
import { logger } from './logger';

const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const CLOB_REST = 'https://clob.polymarket.com';
const FALLBACK_POLL_INTERVAL = 500;
const MIDPOINT_POLL_INTERVAL = 2000;

interface ClobWsMessage {
  asset_id?: string;
  event_type?: string;
  market?: string;
  type?: string;
  // Orderbook
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
  hash?: string;
  timestamp?: string;
  // Price level changes
  changes?: Array<{ price: string; size: string; side: string }>;
  // Last trade
  price?: string;
  size?: string;
  side?: string;
  fee_rate_bps?: string;
}

export class PolymarketFeed extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private fallbackTimers: Map<string, NodeJS.Timeout> = new Map();
  private midpointTimer: NodeJS.Timeout | null = null;
  private connected = false;

  // tokenId → orderbook state
  private orderbooks: Map<string, OrderbookState> = new Map();

  // marketId → market info
  private markets: Map<MarketId, PolymarketMarketInfo> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  setMarkets(markets: PolymarketMarketInfo[]): void {
    for (const m of markets) {
      this.markets.set(m.marketType, m);

      // Init empty orderbooks
      for (const tokenId of [m.upTokenId, m.downTokenId]) {
        if (!this.orderbooks.has(tokenId)) {
          this.orderbooks.set(tokenId, {
            tokenId,
            bids: [],
            asks: [],
            bestBid: 0,
            bestAsk: 0,
            midPrice: 0,
            lastTradePrice: 0,
            lastUpdateMs: 0,
          });
        }
      }
    }

    // If connected, subscribe to new markets
    if (this.connected) {
      this.subscribeToMarkets();
    }
    // Always ensure midpoint polling is running
    this.startMidpointPolling();
    // Immediately fetch prices without waiting for first timer tick
    void this.pollMissingPrices();
  }

  connect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.terminate(); } catch {}
    }

    logger.info(`Connecting to Polymarket WS: ${CLOB_WS_URL}`);

    this.ws = new WebSocket(CLOB_WS_URL, {
      handshakeTimeout: 10000,
    });

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      logger.info('Polymarket CLOB WS connected');
      this.emit('connected');
      this.subscribeToMarkets();
      this.startPing();
      this.stopFallbackPolls();
      this.startMidpointPolling();
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const raw = data.toString();
        // CLOB WS sends arrays of events
        const msgs = JSON.parse(raw);
        const events = Array.isArray(msgs) ? msgs : [msgs];
        for (const msg of events) {
          this.handleMessage(msg as ClobWsMessage);
        }
      } catch (e) {
        logger.warn('Failed to parse Polymarket WS message', { error: e });
      }
    });

    this.ws.on('error', (err) => {
      logger.error('Polymarket WS error', { error: err.message });
      // Don't re-emit — prevents uncaught exception if no external listener
      // WS will emit 'close' after error, which triggers fallback polling
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      this.stopPing();
      logger.warn('Polymarket WS closed', { code, reason: reason.toString() });
      this.emit('disconnected');
      this.startFallbackPolls();
      this.startMidpointPolling();
      this.scheduleReconnect();
    });

    this.ws.on('pong', () => {});
  }

  private subscribeToMarkets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const assetIds: string[] = [];
    for (const market of this.markets.values()) {
      assetIds.push(market.upTokenId, market.downTokenId);
    }

    if (assetIds.length === 0) return;

    // Subscribe to market (orderbook) channel
    // For /ws/market endpoint, send assets_ids directly (no type field needed)
    const subMsg = JSON.stringify({
      assets_ids: assetIds,
    });

    this.ws.send(subMsg);
    logger.info('Subscribed to Polymarket orderbook', { tokenCount: assetIds.length });

    // Also fetch initial state from REST
    this.fetchInitialBooks();
  }

  private async fetchInitialBooks(): Promise<void> {
    for (const market of this.markets.values()) {
      await this.fetchBook(market.upTokenId);
      await this.fetchBook(market.downTokenId);
    }
  }

  private async fetchBook(tokenId: string): Promise<void> {
    if (tokenId.startsWith('mock-')) return;

    try {
      const res = await fetch(`${CLOB_REST}/book?token_id=${tokenId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return;

      const data = await res.json() as {
        bids: Array<{ price: string; size: string }>;
        asks: Array<{ price: string; size: string }>;
      };

      this.applyBookSnapshot(tokenId, data.bids ?? [], data.asks ?? []);
      // If book is empty (no bids/asks), fall back to midpoint
      const ob = this.orderbooks.get(tokenId);
      if (ob && ob.midPrice === 0) {
        await this.fetchMidpoint(tokenId);
      }
    } catch (e) {
      logger.warn('Failed to fetch orderbook', { tokenId, error: e });
      // Try midpoint as last resort
      await this.fetchMidpoint(tokenId);
    }
  }

  private handleMessage(msg: ClobWsMessage): void {
    const tokenId = msg.asset_id ?? msg.market ?? '';
    if (!tokenId || !this.orderbooks.has(tokenId)) return;

    const eventType = msg.event_type ?? msg.type ?? '';

    if (eventType === 'book') {
      // Full snapshot
      this.applyBookSnapshot(tokenId, msg.bids ?? [], msg.asks ?? []);

    } else if (eventType === 'price_change') {
      // Delta update
      const changes = msg.changes ?? [];
      const ob = this.orderbooks.get(tokenId)!;

      for (const change of changes) {
        const price = parseFloat(change.price);
        const size = parseFloat(change.size);

        if (change.side === 'BUY' || change.side === 'bid') {
          this.updateLevel(ob.bids, price, size);
        } else {
          this.updateLevel(ob.asks, price, size);
        }
      }

      this.recomputeMid(ob);
      this.emitOrderbookUpdate(tokenId, ob);

    } else if (eventType === 'last_trade_price' || eventType === 'trade') {
      const ob = this.orderbooks.get(tokenId);
      if (ob && msg.price) {
        ob.lastTradePrice = parseFloat(msg.price);
        ob.lastUpdateMs = Date.now();
      }
    }
  }

  private applyBookSnapshot(
    tokenId: string,
    rawBids: Array<{ price: string; size: string }>,
    rawAsks: Array<{ price: string; size: string }>
  ): void {
    const ob = this.orderbooks.get(tokenId);
    if (!ob) return;

    ob.bids = rawBids
      .map(b => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
      .filter(b => b.size > 0)
      .sort((a, b) => b.price - a.price);

    ob.asks = rawAsks
      .map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
      .filter(a => a.size > 0)
      .sort((a, b) => a.price - b.price);

    this.recomputeMid(ob);
    this.emitOrderbookUpdate(tokenId, ob);
  }

  private updateLevel(levels: OrderbookLevel[], price: number, size: number): void {
    const idx = levels.findIndex(l => l.price === price);
    if (size === 0) {
      if (idx >= 0) levels.splice(idx, 1);
    } else {
      if (idx >= 0) {
        levels[idx]!.size = size;
      } else {
        levels.push({ price, size });
      }
    }
  }

  private recomputeMid(ob: OrderbookState): void {
    ob.bestBid = ob.bids.length > 0 ? ob.bids[0]!.price : 0;
    ob.bestAsk = ob.asks.length > 0 ? ob.asks[0]!.price : 0;
    ob.midPrice = (ob.bestBid + ob.bestAsk) / 2 || ob.lastTradePrice || 0;
    ob.lastUpdateMs = Date.now();
  }

  private emitOrderbookUpdate(tokenId: string, ob: OrderbookState): void {
    // Find which market/side this token belongs to
    for (const [marketId, market] of this.markets) {
      if (market.upTokenId === tokenId || market.downTokenId === tokenId) {
        const side = market.upTokenId === tokenId ? 'UP' : 'DOWN';
        this.emit('orderbook_update', { marketId, tokenId, side, ob: { ...ob } });
        return;
      }
    }
  }

  // ─── Fallback REST Polling ──────────────────────────────────────────────────

  private startFallbackPolls(): void {
    for (const market of this.markets.values()) {
      this.startFallbackPoll(market.upTokenId);
      this.startFallbackPoll(market.downTokenId);
    }
  }

  private startFallbackPoll(tokenId: string): void {
    if (this.fallbackTimers.has(tokenId)) return;

    const timer = setInterval(async () => {
      await this.fetchBook(tokenId);
    }, FALLBACK_POLL_INTERVAL);

    this.fallbackTimers.set(tokenId, timer);
  }

  private stopFallbackPolls(): void {
    for (const timer of this.fallbackTimers.values()) {
      clearInterval(timer);
    }
    this.fallbackTimers.clear();
  }

  // ─── Midpoint REST Polling (fallback when WS orderbook is empty) ───────────

  private startMidpointPolling(): void {
    if (this.midpointTimer) return;
    this.midpointTimer = setInterval(() => {
      void this.pollMissingPrices();
    }, MIDPOINT_POLL_INTERVAL);
    logger.debug('Midpoint polling started');
  }

  private stopMidpointPolling(): void {
    if (this.midpointTimer) {
      clearInterval(this.midpointTimer);
      this.midpointTimer = null;
    }
  }

  private async pollMissingPrices(): Promise<void> {
    for (const [tokenId, ob] of this.orderbooks) {
      if (ob.midPrice === 0 || ob.lastUpdateMs === 0) {
        await this.fetchMidpoint(tokenId);
      }
    }
  }

  private async fetchMidpoint(tokenId: string): Promise<void> {
    if (tokenId.startsWith('mock-')) return;
    try {
      const res = await fetch(`${CLOB_REST}/midpoint?token_id=${tokenId}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return;
      const data = await res.json() as { mid?: string };
      const mid = parseFloat(data.mid ?? '0');
      if (mid > 0) {
        const ob = this.orderbooks.get(tokenId);
        if (ob) {
          // Only update midPrice — keep bids/asks intact if we have them
          if (ob.midPrice === 0) {
            ob.midPrice = mid;
          }
          // Also try to seed best bid/ask if completely empty
          if (ob.bestBid === 0 && ob.bestAsk === 0) {
            ob.bestBid = parseFloat((mid - 0.01).toFixed(2));
            ob.bestAsk = parseFloat((mid + 0.01).toFixed(2));
            ob.midPrice = mid;
          }
          ob.lastUpdateMs = Date.now();
          this.emitOrderbookUpdate(tokenId, ob);
          logger.debug('Midpoint fetched via REST', { tokenId: tokenId.slice(0, 8), mid });
        }
      }
    } catch (e) {
      // silent — this is best-effort
    }
  }

  // ─── Reconnect ────────────────────────────────────────────────────────────

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;

    logger.info(`Reconnecting Polymarket WS in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    this.stopFallbackPolls();
    this.stopMidpointPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.terminate(); } catch {}
      this.ws = null;
    }
    this.connected = false;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  getOrderbook(tokenId: string): OrderbookState | undefined {
    return this.orderbooks.get(tokenId);
  }

  getTokenOrderbooks(marketId: MarketId): { up: OrderbookState | undefined; down: OrderbookState | undefined } {
    const market = this.markets.get(marketId);
    if (!market) return { up: undefined, down: undefined };
    return {
      up: this.orderbooks.get(market.upTokenId),
      down: this.orderbooks.get(market.downTokenId),
    };
  }

  isConnected(): boolean {
    return this.connected;
  }
}
