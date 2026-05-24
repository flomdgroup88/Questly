import React from 'react';
import { Activity, Pause, Play, AlertTriangle, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { BotStatusData, Strategy } from '../types';
import { WsStatus } from '../hooks/useWebSocket';

interface HeaderProps {
  botStatus: BotStatusData;
  balance: number;
  dailyPnl: number;
  strategies: Strategy[];
  wsStatus: WsStatus;
  dryRun: boolean;
  onPause: () => void;
  onResume: () => void;
}

export function Header({
  botStatus, balance, dailyPnl, strategies, wsStatus, dryRun, onPause, onResume,
}: HeaderProps) {
  const activeStrategies = strategies.filter(s => s.enabled).length;
  const isRunning = botStatus.status === 'RUNNING';
  const isPaused = botStatus.status === 'PAUSED';
  const isError = botStatus.status === 'ERROR';

  const pnlPositive = dailyPnl >= 0;

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-bg-border bg-bg-secondary sticky top-0 z-30">
      {/* Logo + Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-neon-blue to-neon-green flex items-center justify-center">
            <Zap size={14} className="text-bg-primary" strokeWidth={2.5} />
          </div>
          <span className="mono font-bold text-base text-white tracking-tight">POLYBOT</span>
        </div>

        {/* Bot Status pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs mono font-medium border ${
          isRunning ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' :
          isPaused ? 'bg-neon-yellow/10 border-neon-yellow/30 text-neon-yellow' :
          isError ? 'bg-neon-red/10 border-neon-red/30 text-neon-red' :
          'bg-bg-border/50 border-bg-border text-gray-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isRunning ? 'bg-neon-green live-dot' :
            isPaused ? 'bg-neon-yellow' :
            'bg-neon-red live-dot'
          }`} />
          {botStatus.status}
        </div>

        {dryRun && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs mono bg-neon-purple/10 border border-neon-purple/30 text-purple-400">
            <AlertTriangle size={10} />
            DRY-RUN
          </div>
        )}

        {wsStatus !== 'CONNECTED' && (
          <div className="flex items-center gap-1 text-xs mono text-neon-red/80">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-red live-dot" />
            WS {wsStatus}
          </div>
        )}
      </div>

      {/* Center stats */}
      <div className="flex items-center gap-6">
        <Stat label="BALANCE" value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <div className="w-px h-7 bg-bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs mono uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>TODAY P&L</span>
          <div className={`flex items-center gap-1 mono font-semibold text-sm ${pnlPositive ? 'text-neon-green' : 'text-neon-red'}`}>
            {pnlPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span className={pnlPositive ? 'glow-green' : 'glow-red'}>
              {pnlPositive ? '+' : ''}{dailyPnl.toFixed(2)} USDC
            </span>
          </div>
        </div>
        <div className="w-px h-7 bg-bg-border" />
        <Stat label="STRATEGIES" value={`${activeStrategies} / ${strategies.length}`} valueClass="text-neon-blue" />
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded mono text-xs font-medium bg-neon-yellow/10 border border-neon-yellow/30 text-neon-yellow hover:bg-neon-yellow/20 transition-colors"
          >
            <Pause size={12} />
            PAUSE
          </button>
        ) : (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded mono text-xs font-medium bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors"
          >
            <Play size={12} />
            RESUME
          </button>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-card border border-bg-border">
          <Activity size={12} className={wsStatus === 'CONNECTED' ? 'text-neon-green' : 'text-gray-500'} />
          <span className="mono text-xs text-gray-400">
            {wsStatus === 'CONNECTED' ? 'LIVE' : wsStatus}
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-gray-500 mono uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>{label}</span>
      <span className={`mono font-semibold text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}
