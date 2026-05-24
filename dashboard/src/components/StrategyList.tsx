import React from 'react';
import { Plus, Edit2, Copy, Trash2, Check, X, ChevronRight } from 'lucide-react';
import { Strategy, StrategyTriggerState } from '../types';

interface StrategyListProps {
  strategies: Strategy[];
  conditionStates: Record<string, StrategyTriggerState>;
  strategyStats: Record<string, { tradesToday: number; pnlToday: number }>;
  onNew: () => void;
  onEdit: (strategy: Strategy) => void;
  onClone: (strategy: Strategy) => void;
  onDelete: (strategyId: string) => void;
  onToggle: (strategy: Strategy) => void;
}

export function StrategyList({
  strategies, conditionStates, strategyStats, onNew, onEdit, onClone, onDelete, onToggle,
}: StrategyListProps) {
  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold text-neon-blue tracking-widest">STRATEGIES</span>
          <span className="bg-bg-border mono text-xs px-1.5 py-0.5 rounded text-gray-400">
            {strategies.filter(s => s.enabled).length}/{strategies.length}
          </span>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded mono text-xs font-medium bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors"
        >
          <Plus size={11} />
          NEW
        </button>
      </div>

      {/* Strategy rows */}
      <div className="flex-1 overflow-y-auto">
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="mono text-gray-500 text-xs">No strategies configured</span>
            <button onClick={onNew} className="mono text-xs text-neon-blue hover:underline">
              + Create your first strategy
            </button>
          </div>
        ) : (
          strategies.map(strategy => (
            <StrategyRow
              key={strategy.id}
              strategy={strategy}
              conditionState={conditionStates[strategy.id]}
              stats={strategyStats[strategy.id] ?? { tradesToday: 0, pnlToday: 0 }}
              onEdit={() => onEdit(strategy)}
              onClone={() => onClone(strategy)}
              onDelete={() => onDelete(strategy.id)}
              onToggle={() => onToggle(strategy)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StrategyRow({
  strategy, conditionState, stats, onEdit, onClone, onDelete, onToggle,
}: {
  strategy: Strategy;
  conditionState: StrategyTriggerState | undefined;
  stats: { tradesToday: number; pnlToday: number };
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const pnlPositive = stats.pnlToday >= 0;
  const allPass = conditionState?.allPass ?? false;

  return (
    <div className={`border-b border-bg-border transition-colors ${strategy.enabled ? '' : 'opacity-50'}`}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Toggle */}
        <div onClick={e => { e.stopPropagation(); onToggle(); }}>
          <label className="toggle">
            <input type="checkbox" checked={strategy.enabled} onChange={() => {}} />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Name + market */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="mono text-sm font-medium text-white truncate">{strategy.name}</span>
            {strategy.enabled && allPass && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-green/10 border border-neon-green/20 text-neon-green mono" style={{ fontSize: '0.6rem' }}>
                <Check size={8} />READY
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <MarketBadge market={strategy.market} />
            <SideBadge side={strategy.side} />
            <span className="mono text-gray-500" style={{ fontSize: '0.65rem' }}>
              ${strategy.betAmountUsdc}/bet
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-gray-500 mono" style={{ fontSize: '0.6rem' }}>TODAY</div>
            <div className="mono text-xs text-gray-300">{stats.tradesToday} trades</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500 mono" style={{ fontSize: '0.6rem' }}>P&L</div>
            <div className={`mono text-xs font-medium ${pnlPositive ? 'text-neon-green' : 'text-neon-red'}`}>
              {pnlPositive ? '+' : ''}{stats.pnlToday.toFixed(2)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <IconBtn title="Edit" onClick={onEdit}><Edit2 size={12} /></IconBtn>
            <IconBtn title="Clone" onClick={onClone}><Copy size={12} /></IconBtn>
            <IconBtn title="Delete" onClick={onDelete} danger><Trash2 size={12} /></IconBtn>
          </div>

          <ChevronRight
            size={12}
            className={`text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded condition state */}
      {expanded && strategy.enabled && conditionState && (
        <div className="px-4 pb-3 pt-1 grid grid-cols-3 gap-2 border-t border-bg-border/50 bg-bg-primary/30">
          <CondBadge
            label="TIME WINDOW"
            pass={conditionState.conditions.timeWindow.pass}
            detail={conditionState.conditions.timeWindow.value}
            required={conditionState.conditions.timeWindow.required}
          />
          <CondBadge
            label="BTC DELTA"
            pass={conditionState.conditions.btcDelta.pass}
            enabled={conditionState.conditions.btcDelta.enabled}
            detail={`$${conditionState.conditions.btcDelta.value.toFixed(0)}`}
            required={`$${conditionState.conditions.btcDelta.min}–$${conditionState.conditions.btcDelta.max}`}
          />
          <CondBadge
            label="SHARE PRICE"
            pass={conditionState.conditions.sharePrice.pass}
            enabled={conditionState.conditions.sharePrice.enabled}
            detail={conditionState.conditions.sharePrice.value.toFixed(3)}
            required={`${conditionState.conditions.sharePrice.min}–${conditionState.conditions.sharePrice.max}`}
          />
          <CondBadge
            label="NO POSITION"
            pass={conditionState.conditions.noOpenPosition.pass}
          />
          <CondBadge
            label="ROUNDS"
            pass={conditionState.conditions.maxRounds.pass}
            detail={`${conditionState.conditions.maxRounds.current}/${conditionState.conditions.maxRounds.max || '∞'}`}
          />
          <CondBadge
            label="DAILY LOSS"
            pass={conditionState.conditions.dailyLoss.pass}
            detail={conditionState.conditions.dailyLoss.limit > 0 ? `$${Math.abs(conditionState.conditions.dailyLoss.current).toFixed(0)}/$${conditionState.conditions.dailyLoss.limit}` : 'N/A'}
          />
        </div>
      )}
    </div>
  );
}

function CondBadge({
  label, pass, enabled = true, detail, required,
}: {
  label: string; pass: boolean; enabled?: boolean; detail?: string; required?: string;
}) {
  if (!enabled) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className="w-3 h-3 rounded-full bg-bg-border flex items-center justify-center">
          <span className="text-gray-600" style={{ fontSize: '0.5rem' }}>—</span>
        </span>
        <span className="mono text-gray-600" style={{ fontSize: '0.65rem' }}>{label} OFF</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
        pass ? 'bg-neon-green/20' : 'bg-neon-red/20'
      }`}>
        {pass
          ? <Check size={8} className="text-neon-green" strokeWidth={3} />
          : <X size={8} className="text-neon-red" strokeWidth={3} />
        }
      </div>
      <div>
        <div className="mono text-gray-400" style={{ fontSize: '0.6rem' }}>{label}</div>
        {detail && <div className={`mono font-medium ${pass ? 'text-neon-green' : 'text-neon-red'}`} style={{ fontSize: '0.65rem' }}>{detail}</div>}
        {required && <div className="mono text-gray-600" style={{ fontSize: '0.6rem' }}>req: {required}</div>}
      </div>
    </div>
  );
}

function MarketBadge({ market }: { market: string }) {
  return (
    <span className="mono px-1 py-0.5 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20" style={{ fontSize: '0.6rem' }}>
      {market === 'BTC_5MIN' ? '5M' : '15M'}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  const color = side === 'UP' ? 'text-neon-green' : side === 'DOWN' ? 'text-neon-red' : 'text-neon-blue';
  return (
    <span className={`mono font-bold ${color}`} style={{ fontSize: '0.65rem' }}>{side}</span>
  );
}

function IconBtn({
  children, title, onClick, danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1 rounded transition-colors ${
        danger
          ? 'text-gray-600 hover:text-neon-red hover:bg-neon-red/10'
          : 'text-gray-600 hover:text-neon-blue hover:bg-neon-blue/10'
      }`}
    >
      {children}
    </button>
  );
}
