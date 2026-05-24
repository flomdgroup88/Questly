import { useState, useCallback, useRef } from 'react';
import {
  MarketUpdate, Strategy, Position, Trade, BotStatusData,
  StrategyTriggerState, PnlPoint, PolymarketMarketInfo, WsMessage,
} from '../types';

const MAX_SPARKLINE = 60;

export interface MarketDataState {
  markets: Record<string, MarketUpdate>;
  sparklines: Record<string, number[]>;
  strategies: Strategy[];
  positions: Position[];
  trades: Trade[];
  botStatus: BotStatusData;
  balance: number;
  conditionStates: Record<string, StrategyTriggerState>;
  pnlHistory: PnlPoint[];
  polymarketMarkets: PolymarketMarketInfo[];
  dryRun: boolean;
  dailyPnl: number;
}

const INITIAL_STATUS: BotStatusData = {
  status: 'CONNECTING',
  message: 'Connecting...',
};

export function useMarketData() {
  const [state, setState] = useState<MarketDataState>({
    markets: {},
    sparklines: {},
    strategies: [],
    positions: [],
    trades: [],
    botStatus: INITIAL_STATUS,
    balance: 0,
    conditionStates: {},
    pnlHistory: [],
    polymarketMarkets: [],
    dryRun: false,
    dailyPnl: 0,
  });

  const sparklineBuffers = useRef<Record<string, number[]>>({});

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'MARKET_UPDATE': {
        const update = msg.data as MarketUpdate;
        const upKey = `${update.market}-UP`;
        const downKey = `${update.market}-DOWN`;

        if (!sparklineBuffers.current[upKey]) sparklineBuffers.current[upKey] = [];
        if (!sparklineBuffers.current[downKey]) sparklineBuffers.current[downKey] = [];

        if (update.upSharePrice > 0) {
          sparklineBuffers.current[upKey] = [
            ...sparklineBuffers.current[upKey]!.slice(-(MAX_SPARKLINE - 1)),
            update.upSharePrice,
          ];
        }
        if (update.downSharePrice > 0) {
          sparklineBuffers.current[downKey] = [
            ...sparklineBuffers.current[downKey]!.slice(-(MAX_SPARKLINE - 1)),
            update.downSharePrice,
          ];
        }

        setState(prev => ({
          ...prev,
          markets: { ...prev.markets, [update.market]: update },
          sparklines: {
            ...prev.sparklines,
            [upKey]: [...(sparklineBuffers.current[upKey] ?? [])],
            [downKey]: [...(sparklineBuffers.current[downKey] ?? [])],
          },
        }));
        break;
      }

      case 'STRATEGIES_LIST':
        setState(prev => ({ ...prev, strategies: msg.data as Strategy[] }));
        break;

      case 'OPEN_POSITIONS':
        setState(prev => ({ ...prev, positions: msg.data as Position[] }));
        break;

      case 'POSITION_UPDATE': {
        const pos = msg.data as Position;
        setState(prev => ({
          ...prev,
          positions: prev.positions.map(p => p.id === pos.id ? pos : p),
        }));
        break;
      }

      case 'TRADES_HISTORY': {
        const trades = msg.data as Trade[];
        setState(prev => ({ ...prev, trades, dailyPnl: computeDailyPnl(trades) }));
        break;
      }

      case 'TRADE_EXECUTED': {
        const trade = msg.data as Trade;
        setState(prev => {
          const trades = [trade, ...prev.trades.filter(t => t.id !== trade.id)].slice(0, 500);
          return { ...prev, trades, dailyPnl: computeDailyPnl(trades) };
        });
        break;
      }

      case 'STRATEGY_TRIGGER': {
        const trigger = msg.data as StrategyTriggerState;
        setState(prev => ({
          ...prev,
          conditionStates: { ...prev.conditionStates, [trigger.strategyId]: trigger },
        }));
        break;
      }

      case 'BALANCE_UPDATE':
        setState(prev => ({ ...prev, balance: (msg.data as { usdc: number }).usdc }));
        break;

      case 'BOT_STATUS':
        setState(prev => ({ ...prev, botStatus: msg.data as BotStatusData }));
        break;

      case 'INIT_STATE': {
        const d = msg.data as { pnlHistory: PnlPoint[]; markets: PolymarketMarketInfo[]; dryRun: boolean };
        setState(prev => ({
          ...prev,
          pnlHistory: d.pnlHistory ?? [],
          polymarketMarkets: d.markets ?? [],
          dryRun: d.dryRun ?? false,
        }));
        break;
      }

      default:
        break;
    }
  }, []);

  return { state, handleMessage };
}

function computeDailyPnl(trades: Trade[]): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const startMs = todayStart.getTime();
  return trades
    .filter(t => t.entryTime >= startMs && t.result !== 'OPEN' && t.pnl !== null)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
}
