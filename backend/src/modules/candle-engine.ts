import { EventEmitter } from 'events';
import { CandleState, MarketId } from '../types';
import { logger } from './logger';
import { saveCandle } from './database';

const CANDLE_DURATIONS: Record<MarketId, number> = {
  BTC_5MIN: 5 * 60 * 1000,
  BTC_15MIN: 15 * 60 * 1000,
};

function getCandleOpenTime(market: MarketId, nowMs: number): number {
  const durationMs = CANDLE_DURATIONS[market];
  const durationMin = durationMs / 60000;
  const d = new Date(nowMs);
  const minuteOfHour = d.getUTCMinutes();
  const alignedMinute = Math.floor(minuteOfHour / durationMin) * durationMin;
  d.setUTCMinutes(alignedMinute, 0, 0);
  return d.getTime();
}

export function mmssToMs(mmss: string): number {
  const [mm, ss] = mmss.split(':').map(Number);
  return ((mm ?? 0) * 60 + (ss ?? 0)) * 1000;
}

export function msToMmss(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Candle Engine ────────────────────────────────────────────────────────────

export class CandleEngine extends EventEmitter {
  private states: Map<MarketId, CandleState> = new Map();
  private markets: MarketId[] = ['BTC_5MIN', 'BTC_15MIN'];

  constructor() {
    super();
    this.setMaxListeners(50);
    this.initializeStates();
  }

  private initializeStates(): void {
    const now = Date.now();
    for (const market of this.markets) {
      const openTime = getCandleOpenTime(market, now);
      const durationMs = CANDLE_DURATIONS[market];

      this.states.set(market, {
        market,
        durationMs,
        openTime,
        openPrice: null,
        currentPrice: 0,
        high: 0,
        low: Infinity,
        volume: 0,
        tradeCount: 0,
        timeElapsedMs: now - openTime,
        timeRemainingMs: openTime + durationMs - now,
        deltaUsd: 0,
      });
    }
    logger.info('Candle engine initialized', {
      '5min_open': new Date(getCandleOpenTime('BTC_5MIN', now)).toISOString(),
      '15min_open': new Date(getCandleOpenTime('BTC_15MIN', now)).toISOString(),
    });
  }

  onTrade(price: number, quantity: number, tradeTimeMs: number): void {
    for (const market of this.markets) {
      this.updateCandle(market, price, quantity, tradeTimeMs);
    }
  }

  private updateCandle(market: MarketId, price: number, quantity: number, nowMs: number): void {
    const state = this.states.get(market)!;
    const durationMs = CANDLE_DURATIONS[market];
    const expectedOpenTime = getCandleOpenTime(market, nowMs);

    // Detect candle rollover
    if (expectedOpenTime !== state.openTime) {
      this.closeCandle(market, state);

      const newState: CandleState = {
        market,
        durationMs,
        openTime: expectedOpenTime,
        openPrice: price,  // first trade in new candle
        currentPrice: price,
        high: price,
        low: price,
        volume: quantity,
        tradeCount: 1,
        timeElapsedMs: nowMs - expectedOpenTime,
        timeRemainingMs: expectedOpenTime + durationMs - nowMs,
        deltaUsd: 0,
      };
      this.states.set(market, newState);
      logger.debug(`New candle opened [${market}]`, { openTime: new Date(expectedOpenTime).toISOString(), price });
      this.emit('candle_open', newState);
      this.emit('update', newState);
      return;
    }

    // Update existing candle
    if (state.openPrice === null) {
      state.openPrice = price;
      logger.debug(`Candle open price set [${market}]`, { price });
    }

    state.currentPrice = price;
    state.high = Math.max(state.high, price);
    state.low = Math.min(state.low === Infinity ? price : state.low, price);
    state.volume += quantity;
    state.tradeCount += 1;
    state.timeElapsedMs = nowMs - state.openTime;
    state.timeRemainingMs = Math.max(0, state.openTime + durationMs - nowMs);
    state.deltaUsd = state.openPrice !== null ? price - state.openPrice : 0;

    this.emit('update', { ...state });
  }

  private closeCandle(market: MarketId, state: CandleState): void {
    if (state.currentPrice === 0 || state.openPrice === null) return;

    logger.info(`Candle closed [${market}]`, {
      open: state.openPrice,
      close: state.currentPrice,
      high: state.high,
      low: state.low,
      delta: state.deltaUsd.toFixed(2),
      trades: state.tradeCount,
    });

    try {
      saveCandle(
        market,
        state.openTime,
        state.openPrice,
        state.high,
        state.low,
        state.currentPrice,
        state.volume,
        state.tradeCount
      );
    } catch (e) {
      logger.error('Failed to save candle', { error: e });
    }

    this.emit('candle_close', { ...state });
  }

  getState(market: MarketId): CandleState | undefined {
    return this.states.get(market);
  }

  getAllStates(): CandleState[] {
    return Array.from(this.states.values());
  }

  // Recompute time fields without a price update (for timer display)
  tick(): void {
    const now = Date.now();
    for (const market of this.markets) {
      const state = this.states.get(market);
      if (!state) continue;
      const durationMs = CANDLE_DURATIONS[market];
      state.timeElapsedMs = now - state.openTime;
      state.timeRemainingMs = Math.max(0, state.openTime + durationMs - now);
    }
  }
}
