export type MarketId = 'BTC_5MIN' | 'BTC_15MIN';
export type Side = 'UP' | 'DOWN';
export type TradeResult = 'WIN' | 'LOSS' | 'OPEN';
export type BotStatus = 'RUNNING' | 'PAUSED' | 'ERROR' | 'CONNECTING';
export type ExitMode = 'ABSOLUTE_PRICE' | 'PCT_FROM_ENTRY';

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

export interface EntryConditions {
  timeAfterCandleOpenMinSec: string;
  timeAfterCandleOpenMaxSec: string;
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

export interface Position {
  id: string;
  strategyId: string;
  strategyName: string;
  market: MarketId;
  side: Side;
  entryPrice: number;
  currentPrice: number;
  size: number;
  entryTime: number;
  tpLevel: number | null;
  slLevel: number | null;
  unrealizedPnl: number;
  status: 'OPEN' | 'CLOSING';
  entryOrderId: string;
  candleOpenTime: number;
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

export interface ConditionState {
  timeWindow: { pass: boolean; value: string; required: string };
  btcDelta: { pass: boolean; value: number; min: number; max: number; enabled: boolean };
  sharePrice: { pass: boolean; value: number; min: number; max: number; enabled: boolean };
  noOpenPosition: { pass: boolean };
  maxRounds: { pass: boolean; current: number; max: number };
  dailyLoss: { pass: boolean; current: number; limit: number };
}

export interface StrategyTriggerState {
  strategyId: string;
  conditions: ConditionState;
  allPass: boolean;
  side: Side | null;
}

export interface WsMessage {
  type: string;
  data: unknown;
}

export interface BotStatusData {
  status: BotStatus;
  message: string;
  dryRun?: boolean;
}

export interface PnlPoint {
  timestamp: number;
  cumulativePnl: number;
  dailyPnl: number;
}

export interface PolymarketMarketInfo {
  conditionId: string;
  question: string;
  upTokenId: string;
  downTokenId: string;
  active: boolean;
  marketType: MarketId;
}

export const DEFAULT_STRATEGY: Omit<Strategy, 'id'> = {
  name: 'New Strategy',
  enabled: false,
  market: 'BTC_5MIN',
  side: 'AUTO',
  entry: {
    timeAfterCandleOpenMinSec: '00:30',
    timeAfterCandleOpenMaxSec: '03:00',
    btcDeltaMinUsd: 0,
    btcDeltaMaxUsd: 9999,
    btcDeltaFilterEnabled: true,
    sharePriceMin: 0.40,
    sharePriceMax: 0.65,
    sharePriceFilterEnabled: true,
  },
  betAmountUsdc: 10,
  useLimitOrder: false,
  limitPriceOffset: 0.01,
  maxRoundsPerCandle: 1,
  takeProfit: { enabled: true, mode: 'ABSOLUTE_PRICE', value: 0.70 },
  stopLoss: { enabled: true, mode: 'ABSOLUTE_PRICE', value: 0.30 },
  maxConcurrentPositions: 1,
  cooldownAfterLossSec: 0,
  dailyLossLimitUsdc: 0,
};
