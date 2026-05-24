import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Trade, PnlPoint } from '../types';

interface ChartsProps {
  trades: Trade[];
  pnlHistory: PnlPoint[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f1420',
  border: '1px solid #1e2a3a',
  borderRadius: '6px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
  color: '#e2e8f0',
};

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Charts({ trades, pnlHistory }: ChartsProps) {
  const [collapsed, setCollapsed] = useState(false);

  // ── Equity curve from pnlHistory (or synthesised from trades) ─────────────
  const equityData = useMemo(() => {
    if (pnlHistory.length > 0) {
      return pnlHistory.map(p => ({
        time: fmtDate(p.timestamp),
        pnl: parseFloat(p.cumulativePnl.toFixed(4)),
      }));
    }
    // Synthesise from closed trades
    let cum = 0;
    return trades
      .filter(t => t.result !== 'OPEN' && t.pnl !== null)
      .sort((a, b) => a.entryTime - b.entryTime)
      .map(t => {
        cum += t.pnl!;
        return { time: fmtDate(t.entryTime), pnl: parseFloat(cum.toFixed(4)) };
      });
  }, [pnlHistory, trades]);

  // ── Win rate by strategy ──────────────────────────────────────────────────
  const stratWinRate = useMemo(() => {
    const map: Record<string, { wins: number; total: number }> = {};
    for (const t of trades) {
      if (t.result === 'OPEN') continue;
      if (!map[t.strategyName]) map[t.strategyName] = { wins: 0, total: 0 };
      map[t.strategyName]!.total++;
      if (t.result === 'WIN') map[t.strategyName]!.wins++;
    }
    return Object.entries(map).map(([name, d]) => ({
      name: name.length > 14 ? name.slice(0, 13) + '…' : name,
      winRate: parseFloat((d.wins / d.total * 100).toFixed(1)),
      total: d.total,
    }));
  }, [trades]);

  // ── PnL by hour of day ────────────────────────────────────────────────────
  const pnlByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    for (const t of trades) {
      if (t.result === 'OPEN' || t.pnl === null) continue;
      const h = new Date(t.entryTime).getHours();
      hours[h] += t.pnl;
    }
    return Object.entries(hours).map(([h, pnl]) => ({
      hour: fmtHour(parseInt(h)),
      pnl: parseFloat(pnl.toFixed(4)),
    }));
  }, [trades]);

  const hasData = trades.some(t => t.result !== 'OPEN');

  return (
    <div className="card">
      {/* Header */}
      <button
        className="flex items-center justify-between w-full px-4 py-3 border-b border-bg-border hover:bg-white/[0.01] transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold text-neon-blue tracking-widest">ANALYTICS</span>
          {!hasData && (
            <span className="mono text-xs text-gray-500">— no closed trades yet</span>
          )}
        </div>
        {collapsed
          ? <ChevronDown size={14} className="text-gray-500" />
          : <ChevronUp size={14} className="text-gray-500" />
        }
      </button>

      {!collapsed && (
        <div className="p-4 grid grid-cols-1 gap-6">

          {/* Equity Curve */}
          <div>
            <div className="mono text-xs text-gray-400 mb-3 tracking-wider">EQUITY CURVE (cumulative PnL)</div>
            {equityData.length < 2 ? (
              <EmptyChart label="No closed trades yet" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: '#64748b' }}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, 'PnL']}
                  />
                  <ReferenceLine y={0} stroke="#1e2a3a" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke="#2dd4ff"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#2dd4ff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom row: Win Rate + PnL by Hour */}
          <div className="grid grid-cols-2 gap-6">
            {/* Win Rate by Strategy */}
            <div>
              <div className="mono text-xs text-gray-400 mb-3 tracking-wider">WIN RATE BY STRATEGY</div>
              {stratWinRate.length === 0 ? (
                <EmptyChart label="No data" />
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={stratWinRate} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, _n, p) => [
                        `${v}% (${p.payload.total} trades)`,
                        'Win Rate',
                      ]}
                    />
                    <ReferenceLine y={50} stroke="#1e2a3a" strokeDasharray="3 3" />
                    <Bar dataKey="winRate" radius={[3, 3, 0, 0]}>
                      {stratWinRate.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.winRate >= 50 ? '#00ff8866' : '#ff3b3b66'}
                          stroke={entry.winRate >= 50 ? '#00ff88' : '#ff3b3b'}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* PnL by Hour of Day */}
            <div>
              <div className="mono text-xs text-gray-400 mb-3 tracking-wider">PNL BY HOUR (UTC)</div>
              {!hasData ? (
                <EmptyChart label="No data" />
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={pnlByHour} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 8, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [`$${v.toFixed(4)}`, 'PnL']}
                    />
                    <ReferenceLine y={0} stroke="#1e2a3a" />
                    <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                      {pnlByHour.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pnl >= 0 ? '#00ff8850' : '#ff3b3b50'}
                          stroke={entry.pnl >= 0 ? '#00ff88' : '#ff3b3b'}
                          strokeWidth={entry.pnl !== 0 ? 1 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[140px] flex items-center justify-center text-gray-600 mono text-xs border border-dashed border-bg-border rounded">
      {label}
    </div>
  );
}
