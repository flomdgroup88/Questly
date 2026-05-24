import { EventEmitter } from 'events';
import {
  Strategy, Position, Trade, MarketUpdate, MarketId, Side,
  StrategyConditionState, OrderRequest,
} from '../types';
import {
  loadStrategies, saveStrategy, deleteStrategy as dbDeleteStrategy,
  insertPosition, loadOpenPositions, deletePosition,
  insertTrade, getDailyPnl, getStrategyStats,
} from './database';
import { mmssToMs } from './candle-engine';
import { OrderExecutor } from './order-executor';
import { MarketDiscovery } from './market-discovery';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export class StrategyEngine extends EventEmitter {
  private strategies: Map<string, Strategy> = new Map();
  private positions: Map<string, Position> = new Map(); // positionId → position
  private strategyPositions: Map<string, string[]> = new Map(); // strategyId → positionIds
  private candleRoundCount: Map<string, number> = new Map(); // `${strategyId}-${candleOpenTime}` → count
  private lastLossTime: Map<string, number> = new Map(); // strategyId → timestamp
  private paused = false;
  private latestMarketUpdates: Map<MarketId, MarketUpdate> = new Map();

  // Cached condition states for dashboard display
  private conditionStates: Map<string, StrategyConditionState> = new Map();

  constructor(
    private orderExecutor: OrderExecutor,
    private marketDiscovery: MarketDiscovery
  ) {
    super();
    this.setMaxListeners(50);
  }

  async initialize(): Promise<void> {
    const strategies = loadStrategies();
    for (const s of strategies) {
      this.strategies.set(s.id, s);
    }

    // Restore open positions from DB
    const openPositions = loadOpenPositions();
    for (const row of openPositions) {
      const pos: Position = {
        id: row.id,
        strategyId: row.strategy_id,
        strategyName: row.strategy_name,
        market: row.market as MarketId,
        side: row.side as Side,
        entryPrice: row.entry_price,
        currentPrice: row.entry_price,
        size: row.size,
        entryTime: row.entry_time,
        tpLevel: row.tp_level,
        slLevel: row.sl_level,
        unrealizedPnl: 0,
        status: 'OPEN',
        entryOrderId: row.entry_order_id,
        candleOpenTime: row.candle_open_time,
      };
      this.positions.set(pos.id, pos);
      this.addStrategyPosition(pos.strategyId, pos.id);
    }

    logger.info('Strategy engine initialized', {
      strategies: this.strategies.size,
      openPositions: this.positions.size,
    });
  }

  // ─── Main Evaluation Loop ─────────────────────────────────────────────────

  async onMarketUpdate(update: MarketUpdate): Promise<void> {
    if (this.paused) return;

    this.latestMarketUpdates.set(update.market, update);

    // Update all open positions with current prices
    await this.updatePositions(update);

    // Evaluate entry conditions for each strategy
    for (const strategy of this.strategies.values()) {
      if (!strategy.enabled) continue;
      if (strategy.market !== update.market) continue;

      await this.evaluateStrategy(strategy, update);
    }
  }

  private async evaluateStrategy(strategy: Strategy, update: MarketUpdate): Promise<void> {
    const state = this.computeConditionState(strategy, update);
    this.conditionStates.set(strategy.id, state);
    this.emit('strategy_trigger', state);

    if (!state.allPass) return;

    const side = state.side;
    if (!side) return;

    // Check daily loss limit
    if (strategy.dailyLossLimitUsdc > 0) {
      const dailyPnl = getDailyPnl(strategy.id);
      if (dailyPnl <= -strategy.dailyLossLimitUsdc) {
        logger.info(`Strategy ${strategy.name}: daily loss limit reached (${dailyPnl.toFixed(2)} USDC)`);
        return;
      }
    }

    // Check cooldown after loss
    if (strategy.cooldownAfterLossSec > 0) {
      const lastLoss = this.lastLossTime.get(strategy.id);
      if (lastLoss && Date.now() - lastLoss < strategy.cooldownAfterLossSec * 1000) {
        return;
      }
    }

    logger.info(`Strategy ${strategy.name}: conditions met — entering ${side}`);
    await this.enterPosition(strategy, update, side);
  }

  private computeConditionState(strategy: Strategy, update: MarketUpdate): StrategyConditionState {
    const { entry } = strategy;
    const timeElapsedMs = update.timeElapsedMs;

    // Time window check
    const minMs = mmssToMs(entry.timeAfterCandleOpenMinSec);
    const maxMs = mmssToMs(entry.timeAfterCandleOpenMaxSec);
    const timePass = timeElapsedMs >= minMs && timeElapsedMs <= maxMs;

    // Determine side and share price
    let side: Side | null = null;
    let sharePrice = 0;

    if (strategy.side === 'AUTO') {
      // AUTO: pick the side based on BTC movement direction
      if (update.btcDeltaUsd >= 0) {
        side = 'UP';
        sharePrice = update.upSharePrice;
      } else {
        side = 'DOWN';
        sharePrice = update.downSharePrice;
      }
    } else {
      side = strategy.side as Side;
      sharePrice = side === 'UP' ? update.upSharePrice : update.downSharePrice;
    }

    // BTC delta check
    const btcDelta = update.btcDeltaUsd;
    const btcDeltaPass = !entry.btcDeltaFilterEnabled || (
      btcDelta >= entry.btcDeltaMinUsd && btcDelta <= entry.btcDeltaMaxUsd
    );

    // Share price check
    const sharePricePass = !entry.sharePriceFilterEnabled || (
      sharePrice >= entry.sharePriceMin && sharePrice <= entry.sharePriceMax
    );

    // Position count check
    const currentPositions = (this.strategyPositions.get(strategy.id) ?? []).length;
    const noOpenPositionPass = currentPositions < strategy.maxConcurrentPositions;

    // Rounds per candle check
    const candleKey = `${strategy.id}-${this.getCandleKey(strategy.market, update)}`;
    const currentRounds = this.candleRoundCount.get(candleKey) ?? 0;
    const maxRoundsPass = strategy.maxRoundsPerCandle === 0 || currentRounds < strategy.maxRoundsPerCandle;

    const allPass = timePass && btcDeltaPass && sharePricePass && noOpenPositionPass && maxRoundsPass;

    return {
      strategyId: strategy.id,
      conditions: {
        timeWindow: {
          pass: timePass,
          value: `${Math.floor(timeElapsedMs / 60000)}:${String(Math.floor((timeElapsedMs % 60000) / 1000)).padStart(2, '0')}`,
          required: `${entry.timeAfterCandleOpenMinSec}–${entry.timeAfterCandleOpenMaxSec}`,
        },
        btcDelta: {
          pass: btcDeltaPass,
          value: btcDelta,
          min: entry.btcDeltaMinUsd,
          max: entry.btcDeltaMaxUsd,
          enabled: entry.btcDeltaFilterEnabled,
        },
        sharePrice: {
          pass: sharePricePass,
          value: sharePrice,
          min: entry.sharePriceMin,
          max: entry.sharePriceMax,
          enabled: entry.sharePriceFilterEnabled,
        },
        noOpenPosition: { pass: noOpenPositionPass },
        maxRounds: { pass: maxRoundsPass, current: currentRounds, max: strategy.maxRoundsPerCandle },
        dailyLoss: {
          pass: true,
          current: getDailyPnl(strategy.id),
          limit: strategy.dailyLossLimitUsdc,
        },
      },
      allPass,
      side: allPass ? side : null,
    };
  }

  private getCandleKey(market: MarketId, update: MarketUpdate): number {
    return update.timestampMs - update.timeElapsedMs;
  }

  private async enterPosition(strategy: Strategy, update: MarketUpdate, side: Side): Promise<void> {
    const market = this.marketDiscovery.getMarket(strategy.market);
    if (!market) {
      logger.warn(`No market info for ${strategy.market}`);
      return;
    }

    const tokenId = side === 'UP' ? market.upTokenId : market.downTokenId;
    const currentSharePrice = side === 'UP' ? update.upSharePrice : update.downSharePrice;
    const bestAsk = side === 'UP' ? update.upBestAsk : update.downBestAsk;

    // Determine order price
    let orderPrice: number;
    if (strategy.useLimitOrder) {
      const bestBid = side === 'UP' ? update.upBestBid : update.downBestBid;
      orderPrice = Math.min(1, bestBid + strategy.limitPriceOffset);
    } else {
      // Market order: use aggressive price (best ask * 1.02, capped at 0.99)
      orderPrice = Math.min(0.99, (bestAsk || currentSharePrice) * 1.02);
    }

    orderPrice = Math.round(orderPrice * 100) / 100;

    const orderReq: OrderRequest = {
      tokenId,
      side: 'BUY',
      price: orderPrice,
      size: strategy.betAmountUsdc,
      orderType: strategy.useLimitOrder ? 'GTC' : 'FOK',
    };

    try {
      const result = await this.orderExecutor.placeOrder(orderReq);

      if (result.status === 'FAILED') {
        logger.error(`Order failed for strategy ${strategy.name}`, { error: result.errorMessage });
        this.emit('order_failed', { strategyId: strategy.id, error: result.errorMessage });
        return;
      }

      const fillPrice = result.fillPrice ?? orderPrice;
      const candleOpenTime = update.timestampMs - update.timeElapsedMs;

      // Compute TP/SL levels
      const tpLevel = this.computeExitLevel(strategy.takeProfit, fillPrice, side);
      const slLevel = this.computeExitLevel(strategy.stopLoss, fillPrice, side);

      const positionId = uuidv4();
      const position: Position = {
        id: positionId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        market: strategy.market,
        side,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        size: strategy.betAmountUsdc,
        entryTime: Date.now(),
        tpLevel,
        slLevel,
        unrealizedPnl: 0,
        status: 'OPEN',
        entryOrderId: result.orderId,
        candleOpenTime,
      };

      this.positions.set(positionId, position);
      this.addStrategyPosition(strategy.id, positionId);

      // Increment round counter
      const candleKey = `${strategy.id}-${candleOpenTime}`;
      this.candleRoundCount.set(candleKey, (this.candleRoundCount.get(candleKey) ?? 0) + 1);

      // Persist to DB
      insertPosition(position);

      // Create open trade record
      const trade: Trade = {
        id: uuidv4(),
        strategyId: strategy.id,
        strategyName: strategy.name,
        market: strategy.market,
        side,
        entryPrice: fillPrice,
        exitPrice: null,
        size: strategy.betAmountUsdc,
        entryTime: Date.now(),
        exitTime: null,
        pnl: null,
        pnlPct: null,
        result: 'OPEN',
        entryOrderId: result.orderId,
        exitOrderId: null,
        exitReason: null,
      };

      // Store trade ID on position for later
      (position as Position & { tradeId: string }).tradeId = trade.id;
      insertTrade(trade);

      logger.info(`Position opened [${strategy.name}]`, {
        side,
        fillPrice,
        size: strategy.betAmountUsdc,
        tp: tpLevel,
        sl: slLevel,
        orderId: result.orderId,
      });

      this.emit('position_opened', position);
      this.emit('trade_opened', trade);

    } catch (e) {
      logger.error(`Failed to enter position for strategy ${strategy.name}`, { error: e });
    }
  }

  private computeExitLevel(
    condition: { enabled: boolean; mode: string; value: number },
    entryPrice: number,
    side: Side
  ): number | null {
    if (!condition.enabled) return null;

    if (condition.mode === 'ABSOLUTE_PRICE') {
      return condition.value;
    } else {
      // PCT_FROM_ENTRY
      const pct = condition.value / 100;
      // For TP: entry * (1 + pct), for SL: entry * (1 - pct)
      // We return the level, caller decides if it's TP or SL based on comparison
      return entryPrice * (1 + pct);
    }
  }

  private async updatePositions(update: MarketUpdate): Promise<void> {
    for (const [posId, pos] of this.positions) {
      if (pos.market !== update.market) continue;
      if (pos.status !== 'OPEN') continue;

      const currentPrice = pos.side === 'UP' ? update.upSharePrice : update.downSharePrice;
      pos.currentPrice = currentPrice;
      pos.unrealizedPnl = this.computePnl(pos, currentPrice);

      this.emit('position_update', { ...pos });

      // Check TP/SL
      const strategy = this.strategies.get(pos.strategyId);
      if (!strategy) continue;

      let exitReason: 'TP' | 'SL' | null = null;

      if (strategy.takeProfit.enabled && pos.tpLevel !== null) {
        if (currentPrice >= pos.tpLevel) exitReason = 'TP';
      }

      if (!exitReason && strategy.stopLoss.enabled && pos.slLevel !== null) {
        if (currentPrice <= pos.slLevel) exitReason = 'SL';
      }

      if (exitReason) {
        logger.info(`${exitReason} triggered for position ${posId}`, {
          strategy: strategy.name,
          side: pos.side,
          entryPrice: pos.entryPrice,
          currentPrice,
        });
        pos.status = 'CLOSING';
        await this.closePosition(pos, currentPrice, exitReason, update);
      }
    }
  }

  private async closePosition(
    pos: Position,
    exitPrice: number,
    exitReason: 'TP' | 'SL' | 'MANUAL' | 'CANDLE_END',
    update: MarketUpdate
  ): Promise<void> {
    const market = this.marketDiscovery.getMarket(pos.market);
    if (!market) return;

    const tokenId = pos.side === 'UP' ? market.upTokenId : market.downTokenId;
    const bestBid = pos.side === 'UP' ? update.upBestBid : update.downBestBid;
    const sellPrice = Math.max(0.01, Math.min(0.99, (bestBid || exitPrice) * 0.98));

    const orderReq: OrderRequest = {
      tokenId,
      side: 'SELL',
      price: Math.round(sellPrice * 100) / 100,
      size: pos.size,
      orderType: 'FOK',
    };

    let sellResult: { orderId: string; fillPrice: number } = { orderId: '', fillPrice: exitPrice };

    try {
      const result = await this.orderExecutor.placeOrder(orderReq);
      if (result.status !== 'FAILED') {
        sellResult = { orderId: result.orderId, fillPrice: result.fillPrice ?? exitPrice };
      }
    } catch (e) {
      logger.error(`Failed to close position ${pos.id}`, { error: e });
    }

    const realExitPrice = sellResult.fillPrice ?? exitPrice;
    const pnl = this.computePnl(pos, realExitPrice);
    const pnlPct = ((realExitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const result = pnl > 0 ? 'WIN' : 'LOSS';

    // Update trade record
    const trade: Trade = {
      id: (pos as unknown as { tradeId?: string }).tradeId ?? uuidv4(),
      strategyId: pos.strategyId,
      strategyName: pos.strategyName,
      market: pos.market,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: realExitPrice,
      size: pos.size,
      entryTime: pos.entryTime,
      exitTime: Date.now(),
      pnl,
      pnlPct,
      result,
      entryOrderId: pos.entryOrderId,
      exitOrderId: sellResult.orderId || null,
      exitReason,
    };

    insertTrade(trade);
    deletePosition(pos.id);

    this.positions.delete(pos.id);
    this.removeStrategyPosition(pos.strategyId, pos.id);

    if (result === 'LOSS') {
      this.lastLossTime.set(pos.strategyId, Date.now());
    }

    logger.info(`Position closed [${pos.strategyName}]`, {
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: realExitPrice,
      pnl: pnl.toFixed(4),
      pnlPct: pnlPct.toFixed(2) + '%',
      exitReason,
    });

    this.emit('position_closed', pos);
    this.emit('trade_closed', trade);
  }

  private computePnl(pos: Position, currentPrice: number): number {
    // Profit = (currentPrice - entryPrice) * shares
    // shares = size / entryPrice
    const shares = pos.size / pos.entryPrice;
    return (currentPrice - pos.entryPrice) * shares;
  }

  // ─── Manual Operations ────────────────────────────────────────────────────

  async closePositionManually(positionId: string): Promise<void> {
    const pos = this.positions.get(positionId);
    if (!pos) {
      logger.warn(`Position ${positionId} not found`);
      return;
    }

    const update = this.latestMarketUpdates.get(pos.market);
    if (!update) {
      logger.warn(`No market data for ${pos.market}`);
      return;
    }

    pos.status = 'CLOSING';
    await this.closePosition(pos, pos.currentPrice, 'MANUAL', update);
  }

  // ─── Strategy CRUD ────────────────────────────────────────────────────────

  upsertStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
    saveStrategy(strategy);
    this.emit('strategy_updated', strategy);
    logger.info(`Strategy ${strategy.enabled ? 'enabled' : 'updated'}: ${strategy.name}`);
  }

  deleteStrategy(strategyId: string): void {
    // Close any open positions for this strategy
    const posIds = this.strategyPositions.get(strategyId) ?? [];
    for (const posId of posIds) {
      const pos = this.positions.get(posId);
      if (pos) {
        const update = this.latestMarketUpdates.get(pos.market);
        if (update) {
          void this.closePosition(pos, pos.currentPrice, 'MANUAL', update);
        }
      }
    }

    this.strategies.delete(strategyId);
    this.strategyPositions.delete(strategyId);
    dbDeleteStrategy(strategyId);
    this.emit('strategy_deleted', strategyId);
  }

  // ─── Pause/Resume ─────────────────────────────────────────────────────────

  pause(): void {
    this.paused = true;
    logger.info('Strategy engine paused');
  }

  resume(): void {
    this.paused = false;
    logger.info('Strategy engine resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getStrategy(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }

  getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
  }

  getConditionState(strategyId: string): StrategyConditionState | undefined {
    return this.conditionStates.get(strategyId);
  }

  getAllConditionStates(): StrategyConditionState[] {
    return Array.from(this.conditionStates.values());
  }

  getStrategyStats(strategyId: string) {
    return getStrategyStats(strategyId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private addStrategyPosition(strategyId: string, positionId: string): void {
    const existing = this.strategyPositions.get(strategyId) ?? [];
    this.strategyPositions.set(strategyId, [...existing, positionId]);
  }

  private removeStrategyPosition(strategyId: string, positionId: string): void {
    const existing = this.strategyPositions.get(strategyId) ?? [];
    this.strategyPositions.set(strategyId, existing.filter(id => id !== positionId));
  }
}
