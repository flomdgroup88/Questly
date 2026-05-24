import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Strategy, Trade, Position, StrategyRow, TradeRow, PositionRow } from '../types';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'polybot.db');

let db: Database.Database;

// ─── Schema ────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  entry_time INTEGER NOT NULL,
  tp_level REAL,
  sl_level REAL,
  entry_order_id TEXT NOT NULL,
  candle_open_time INTEGER NOT NULL,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  size REAL NOT NULL,
  entry_time INTEGER NOT NULL,
  exit_time INTEGER,
  pnl REAL,
  pnl_pct REAL,
  result TEXT NOT NULL DEFAULT 'OPEN',
  entry_order_id TEXT NOT NULL,
  exit_order_id TEXT,
  exit_reason TEXT
);

CREATE TABLE IF NOT EXISTS candle_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  volume REAL NOT NULL,
  trade_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pnl_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  cumulative_pnl REAL NOT NULL,
  daily_pnl REAL NOT NULL,
  balance REAL
);

CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);
CREATE INDEX IF NOT EXISTS idx_positions_strategy ON positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_candles_market_time ON candle_snapshots(market, open_time);
`;

// ─── Init ─────────────────────────────────────────────────────────────────

export function initDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.exec(SCHEMA);

  logger.info(`Database initialized at ${DB_PATH}`);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// ─── Strategies ──────────────────────────────────────────────────────────────

export function loadStrategies(): Strategy[] {
  const rows = db.prepare('SELECT * FROM strategies').all() as StrategyRow[];
  return rows.map(rowToStrategy);
}

export function saveStrategy(strategy: Strategy): void {
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM strategies WHERE id = ?').get(strategy.id);

  if (existing) {
    db.prepare(`
      UPDATE strategies SET name=?, enabled=?, config_json=?, updated_at=? WHERE id=?
    `).run(strategy.name, strategy.enabled ? 1 : 0, JSON.stringify(strategy), now, strategy.id);
  } else {
    db.prepare(`
      INSERT INTO strategies (id, name, enabled, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(strategy.id, strategy.name, strategy.enabled ? 1 : 0, JSON.stringify(strategy), now, now);
  }
}

export function deleteStrategy(id: string): void {
  db.prepare('DELETE FROM strategies WHERE id = ?').run(id);
}

function rowToStrategy(row: StrategyRow): Strategy {
  const config = JSON.parse(row.config_json) as Strategy;
  config.enabled = row.enabled === 1;
  return config;
}

// ─── Positions ───────────────────────────────────────────────────────────────

export function insertPosition(pos: Omit<Position, 'currentPrice' | 'unrealizedPnl' | 'status'>): void {
  db.prepare(`
    INSERT INTO positions
      (id, strategy_id, strategy_name, market, side, entry_price, size, entry_time,
       tp_level, sl_level, entry_order_id, candle_open_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pos.id, pos.strategyId, pos.strategyName, pos.market, pos.side,
    pos.entryPrice, pos.size, pos.entryTime,
    pos.tpLevel ?? null, pos.slLevel ?? null, pos.entryOrderId, pos.candleOpenTime
  );
}

export function loadOpenPositions(): PositionRow[] {
  return db.prepare('SELECT * FROM positions').all() as PositionRow[];
}

export function deletePosition(id: string): void {
  db.prepare('DELETE FROM positions WHERE id = ?').run(id);
}

// ─── Trades ───────────────────────────────────────────────────────────────────

export function insertTrade(trade: Trade): void {
  db.prepare(`
    INSERT OR REPLACE INTO trades
      (id, strategy_id, strategy_name, market, side, entry_price, exit_price, size,
       entry_time, exit_time, pnl, pnl_pct, result, entry_order_id, exit_order_id, exit_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trade.id, trade.strategyId, trade.strategyName, trade.market, trade.side,
    trade.entryPrice, trade.exitPrice ?? null, trade.size,
    trade.entryTime, trade.exitTime ?? null,
    trade.pnl ?? null, trade.pnlPct ?? null,
    trade.result, trade.entryOrderId, trade.exitOrderId ?? null,
    trade.exitReason ?? null
  );
}

export function loadTrades(limit = 500, offset = 0): Trade[] {
  const rows = db.prepare(`
    SELECT * FROM trades ORDER BY entry_time DESC LIMIT ? OFFSET ?
  `).all(limit, offset) as TradeRow[];
  return rows.map(rowToTrade);
}

export function loadTradesForDate(startMs: number, endMs: number): Trade[] {
  const rows = db.prepare(`
    SELECT * FROM trades WHERE entry_time >= ? AND entry_time <= ?
    ORDER BY entry_time DESC
  `).all(startMs, endMs) as TradeRow[];
  return rows.map(rowToTrade);
}

export function getDailyPnl(strategyId?: string): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const startMs = todayStart.getTime();

  let row: { total: number | null };
  if (strategyId) {
    row = db.prepare(`
      SELECT SUM(pnl) as total FROM trades
      WHERE entry_time >= ? AND strategy_id = ? AND result != 'OPEN'
    `).get(startMs, strategyId) as { total: number | null };
  } else {
    row = db.prepare(`
      SELECT SUM(pnl) as total FROM trades
      WHERE entry_time >= ? AND result != 'OPEN'
    `).get(startMs) as { total: number | null };
  }

  return row?.total ?? 0;
}

export function getStrategyStats(strategyId: string): {
  tradesToday: number;
  pnlToday: number;
  totalTrades: number;
  winRate: number;
} {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const startMs = todayStart.getTime();

  const todayRow = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(pnl), 0) as pnl
    FROM trades WHERE strategy_id = ? AND entry_time >= ? AND result != 'OPEN'
  `).get(strategyId, startMs) as { cnt: number; pnl: number };

  const totalRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM trades WHERE strategy_id = ? AND result != 'OPEN'
  `).get(strategyId) as { cnt: number };

  const winRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM trades WHERE strategy_id = ? AND result = 'WIN'
  `).get(strategyId) as { cnt: number };

  return {
    tradesToday: todayRow.cnt,
    pnlToday: todayRow.pnl,
    totalTrades: totalRow.cnt,
    winRate: totalRow.cnt > 0 ? (winRow.cnt / totalRow.cnt) * 100 : 0,
  };
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    market: row.market as Trade['market'],
    side: row.side as Trade['side'],
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    size: row.size,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    pnl: row.pnl,
    pnlPct: row.pnl_pct,
    result: row.result as Trade['result'],
    entryOrderId: row.entry_order_id,
    exitOrderId: row.exit_order_id,
    exitReason: row.exit_reason as Trade['exitReason'],
  };
}

// ─── Candle Snapshots ─────────────────────────────────────────────────────────

export function saveCandle(
  market: string,
  openTime: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  tradeCount: number
): void {
  db.prepare(`
    INSERT OR REPLACE INTO candle_snapshots
      (market, open_time, open_price, high_price, low_price, close_price, volume, trade_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(market, openTime, open, high, low, close, volume, tradeCount, Date.now());
}

// ─── PnL History ──────────────────────────────────────────────────────────────

export function savePnlPoint(cumulativePnl: number, dailyPnl: number, balance?: number): void {
  db.prepare(`
    INSERT INTO pnl_history (timestamp, cumulative_pnl, daily_pnl, balance)
    VALUES (?, ?, ?, ?)
  `).run(Date.now(), cumulativePnl, dailyPnl, balance ?? null);
}

export function loadPnlHistory(limitHours = 24 * 7): Array<{ timestamp: number; cumulativePnl: number; dailyPnl: number }> {
  const since = Date.now() - limitHours * 3600 * 1000;
  return db.prepare(`
    SELECT timestamp, cumulative_pnl as cumulativePnl, daily_pnl as dailyPnl
    FROM pnl_history WHERE timestamp >= ? ORDER BY timestamp ASC
  `).all(since) as Array<{ timestamp: number; cumulativePnl: number; dailyPnl: number }>;
}

// ─── Bot State ────────────────────────────────────────────────────────────────

export function getBotState(key: string): string | null {
  const row = db.prepare('SELECT value FROM bot_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setBotState(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO bot_state (key, value) VALUES (?, ?)').run(key, value);
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

export function seedDefaultStrategy(): void {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM strategies').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const defaultStrategy: Strategy = {
    id: uuidv4(),
    name: 'BTC 5min Momentum',
    enabled: false, // disabled by default — user must enable
    market: 'BTC_5MIN',
    side: 'AUTO',
    entry: {
      timeAfterCandleOpenMinSec: '00:30',
      timeAfterCandleOpenMaxSec: '03:00',
      btcDeltaMinUsd: 50,
      btcDeltaMaxUsd: 500,
      btcDeltaFilterEnabled: true,
      sharePriceMin: 0.45,
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
    dailyLossLimitUsdc: 50,
  };

  saveStrategy(defaultStrategy);
  logger.info('Seeded default strategy');
}
