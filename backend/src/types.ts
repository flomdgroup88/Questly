// ─── Market Types ────────────────────────────────────────────────────────────

export type MarketId = 'BTC_5MIN' | 'BTC_15MIN';
export type Side = 'UP' | 'DOWN';
export type TradeResult = 'WIN' | 'LOSS' | 'OPEN';
export type BotStatus = 'RUNNING' | 'PAUSED' | 'ERROR';
export type ExitMode = 'ABSOLUTE_PRICE' | 'PCT_FROM_ENTRY';

// ─── Candle Engine ────────────────────────────────────────────────────────────

export interface CandleState {
  market: MarketId;
  durationMs: number;
  openTime: number;           // Unix ms of candle open
  openPrice: number | null;   // First trade price at/after open
  currentPrice: number;
  high: number;
  low: number;
  volume: number;
  tradeCount: number;
  timeElapsedMs: number;
  timeRemainingMs: number;
  deltaUsd: number;           // currentPrice - openPrice (0 if no open yet)
}

// ─── Polymarket ───────────────────────────────────────────────────────────────

export interface PolymarketMarketInfo {
  conditionId: string;
  question: string;
  upTokenId: string;    // YES/UP outcome token
  downTokenId: string;  // NO/DOWN outcome token
  active: boolean;
  endDate: string;
  marketType: MarketId;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookState {
  tokenId: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  lastTradePrice: number;
  lastUpdateMs: number;
}

// ─── Market Data (combined BTC + Polymarket) ──────────────────────────────────

export interface MarketUpdate {
  market: MarketId;
  candleOpenPrice: number | null;
  btcCurrentPrice: number;
  btcDeltaUsd: number;
  timeElapsedMs: number;
  timeRemainingMs: number;
  upSharePrice: number;
  downSharePrice: number;
  upBestBid: number;
  upBestAsk: number;
  downBestBid: number;
  downBestAsk: number;
  timestampMs: number;
}

// ─── Strategy ────────────────────────────────────────────────────────────────

export interface EntryConditions {
  timeAfterCandleOpenMinSec: string;   // "MM:SS"
  timeAfterCandleOpenMaxSec: string;   // "MM:SS"
  btcDeltaMinUsd: number;
  btcDeltaMaxUsd: number;
  btcDeltaFilterEnabled: boolean;
  sharePriceMin: number;
  sharePriceMax: number;
  sharePriceFilterEnabled: boolean;
}

export interface ExitCondition {
  enabled: boolean;
  mode: ExitMode;
  value: number;
}

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  market: MarketId;
  side: Side | 'AUTO';
  entry: EntryConditions;
  betAmountUsdc: number;
  useLimitOrder: boolean;
  limitPriceOffset: number;
  maxRoundsPerCandle: number;
  takeProfit: ExitCondition;
  stopLoss: ExitCondition;
  maxConcurrentPositions: number;
  cooldownAfterLossSec: number;
  dailyLossLimitUsdc: number;
}

// ─── Positions & Trades ───────────────────────────────────────────────────────

export interface Position {
  id: string;
  strategyId: string;
  strategyName: string;
  market: MarketId;
  side: Side;
  entryPrice: number;
  currentPrice: number;
  size: number;            // USDC notional
  entryTime: number;       // Unix ms
  tpLevel: number | null;
  slLevel: number | null;
  unrealizedPnl: number;
  status: 'OPEN' | 'CLOSING';
  entryOrderId: string;
  candleOpenTime: number;  // which candle this belongs to
}

export interface Trade {
  id: string;
  strategyId: string;
  strategyName: string;
  market: MarketId;
  side: Side;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  entryTime: number;
  exitTime: number | null;
  pnl: number | null;
  pnlPct: number | null;
  result: TradeResult;
  entryOrderId: string;
  exitOrderId: string | null;
  exitReason: 'TP' | 'SL' | 'MANUAL' | 'CANDLE_END' | null;
}

// ─── Order Execution ──────────────────────────────────────────────────────────

export interface OrderRequest {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;           // USDC
  orderType: 'GTC' | 'FOK' | 'GTD';
  expiration?: number;
}

export interface OrderResponse {
  orderId: string;
  status: 'MATCHED' | 'LIVE' | 'FAILED';
  fillPrice?: number;
  fillSize?: number;
  errorMessage?: string;
}

// ─── WebSocket Protocol ───────────────────────────────────────────────────────

export type WsMessageType =
  | 'MARKET_UPDATE'
  | 'POSITION_UPDATE'
  | 'POSITION_CLOSED'
  | 'TRADE_EXECUTED'
  | 'STRATEGY_TRIGGER'
  | 'BALANCE_UPDATE'
  | 'BOT_STATUS'
  | 'STRATEGIES_LIST'
  | 'TRADES_HISTORY'
  | 'OPEN_POSITIONS'
  | 'INIT_STATE'
  | 'ERROR';

export interface WsMessage {
  type: WsMessageType;
  data: unknown;
}

export interface StrategyConditionState {
  strategyId: string;
  conditions: {
    timeWindow: { pass: boolean; value: string; required: string };
    btcDelta: { pass: boolean; value: number; min: number; max: number; enabled: boolean };
    sharePrice: { pass: boolean; value: number; min: number; max: number; enabled: boolean };
    noOpenPosition: { pass: boolean };
    maxRounds: { pass: boolean; current: number; max: number };
    dailyLoss: { pass: boolean; current: number; limit: number };
  };
  allPass: boolean;
  side: Side | null;
}

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface StrategyRow {
  id: string;
  name: string;
  enabled: number;
  config_json: string;
  created_at: number;
  updated_at: number;
}

export interface TradeRow {
  id: string;
  strategy_id: string;
  strategy_name: string;
  market: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  size: number;
  entry_time: number;
  exit_time: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  result: string;
  entry_order_id: string;
  exit_order_id: string | null;
  exit_reason: string | null;
}

export interface PositionRow {
  id: string;
  strategy_id: string;
  strategy_name: string;
  market: string;
  side: string;
  entry_price: number;
  size: number;
  entry_time: number;
  tp_level: number | null;
  sl_level: number | null;
  entry_order_id: string;
  candle_open_time: number;
}
