import React, { useCallback, useMemo } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useMarketData } from './hooks/useMarketData';
import { Header } from './components/Header';
import { MarketCard } from './components/MarketCard';
import { StrategyList } from './components/StrategyList';
import { StrategyDrawer } from './components/StrategyDrawer';
import { PositionsTable } from './components/PositionsTable';
import { TradeHistory } from './components/TradeHistory';
import { Charts } from './components/Charts';
import { Strategy, WsMessage } from './types';

function getApiKey(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get('apiKey');
  if (fromUrl) {
    localStorage.setItem('polybot_api_key', fromUrl);
    return fromUrl;
  }
  return localStorage.getItem('polybot_api_key') ?? 'changeme';
}

const API_KEY = getApiKey();

export default function App() {
  const { state, handleMessage } = useMarketData();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingStrategy, setEditingStrategy] = React.useState<Strategy | null>(null);

  const onMessage = useCallback((msg: WsMessage) => {
    handleMessage(msg);
  }, [handleMessage]);

  const { status: wsStatus, send } = useWebSocket({
    onMessage,
    apiKey: API_KEY,
    port: 3001,
  });

  const handleNewStrategy = () => { setEditingStrategy(null); setDrawerOpen(true); };
  const handleEditStrategy = (s: Strategy) => { setEditingStrategy(s); setDrawerOpen(true); };
  const handleCloneStrategy = (s: Strategy) => {
    const clone: Strategy = {
      ...s,
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      name: `${s.name} (copy)`,
      enabled: false,
    };
    setEditingStrategy(clone);
    setDrawerOpen(true);
  };
  const handleDeleteStrategy = (strategyId: string) => {
    if (!confirm('Delete this strategy? This cannot be undone.')) return;
    send({ type: 'DELETE_STRATEGY', data: { strategyId } });
  };
  const handleToggleStrategy = (strategy: Strategy) => {
    send({ type: 'UPDATE_STRATEGY', data: { ...strategy, enabled: !strategy.enabled } });
  };
  const handleSaveStrategy = (strategy: Strategy) => {
    send({ type: 'UPDATE_STRATEGY', data: strategy });
    setDrawerOpen(false);
  };
  const handleClosePosition = (positionId: string) => {
    if (!confirm('Close this position at market price?')) return;
    send({ type: 'CLOSE_POSITION', data: { position_id: positionId } });
  };
  const handlePause = () => send({ type: 'PAUSE_BOT', data: {} });
  const handleResume = () => send({ type: 'RESUME_BOT', data: {} });

  const strategyStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startMs = todayStart.getTime();
    const result: Record<string, { tradesToday: number; pnlToday: number }> = {};
    for (const trade of state.trades) {
      if (!result[trade.strategyId]) result[trade.strategyId] = { tradesToday: 0, pnlToday: 0 };
      if (trade.entryTime >= startMs && trade.result !== 'OPEN') {
        result[trade.strategyId]!.tradesToday++;
        result[trade.strategyId]!.pnlToday += trade.pnl ?? 0;
      }
    }
    return result;
  }, [state.trades]);

  return (
    <div className="min-h-screen bg-bg-primary text-gray-100">
      <Header
        botStatus={state.botStatus}
        balance={state.balance}
        dailyPnl={state.dailyPnl}
        strategies={state.strategies}
        wsStatus={wsStatus}
        dryRun={state.dryRun}
        onPause={handlePause}
        onResume={handleResume}
      />

      <main className="p-4 flex flex-col gap-4">
        {/* Main layout: 40/60 split */}
        <div className="grid grid-cols-5 gap-4">
          {/* Market panel — 40% */}
          <div className="col-span-2 flex flex-col gap-4">
            <MarketCard
              marketId="BTC_5MIN"
              data={state.markets['BTC_5MIN']}
              sparklineUp={state.sparklines['BTC_5MIN-UP'] ?? []}
              sparklineDown={state.sparklines['BTC_5MIN-DOWN'] ?? []}
              btcConnected={wsStatus === 'CONNECTED'}
              polyConnected={wsStatus === 'CONNECTED'}
            />
            <MarketCard
              marketId="BTC_15MIN"
              data={state.markets['BTC_15MIN']}
              sparklineUp={state.sparklines['BTC_15MIN-UP'] ?? []}
              sparklineDown={state.sparklines['BTC_15MIN-DOWN'] ?? []}
              btcConnected={wsStatus === 'CONNECTED'}
              polyConnected={wsStatus === 'CONNECTED'}
            />
          </div>

          {/* Strategy panel — 60% */}
          <div className="col-span-3">
            <StrategyList
              strategies={state.strategies}
              conditionStates={state.conditionStates}
              strategyStats={strategyStats}
              onNew={handleNewStrategy}
              onEdit={handleEditStrategy}
              onClone={handleCloneStrategy}
              onDelete={handleDeleteStrategy}
              onToggle={handleToggleStrategy}
            />
          </div>
        </div>

        <PositionsTable positions={state.positions} onClose={handleClosePosition} />
        <Charts trades={state.trades} pnlHistory={state.pnlHistory} />
        <TradeHistory trades={state.trades} />

        <div className="flex items-center justify-between py-2 mono text-xs text-gray-600 border-t border-bg-border mt-2">
          <span>PolyBot v1.0.0 — Polymarket Automated Trading</span>
          {state.dryRun && <span className="text-neon-yellow/60">⚠ DRY-RUN — no real orders</span>}
          <span>WS: {wsStatus}</span>
        </div>
      </main>

      {drawerOpen && (
        <StrategyDrawer
          strategy={editingStrategy}
          onSave={handleSaveStrategy}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
