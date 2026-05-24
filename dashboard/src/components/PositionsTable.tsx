import React from 'react';
import { X, Clock } from 'lucide-react';
import { Position } from '../types';

interface PositionsTableProps {
  positions: Position[];
  onClose: (positionId: string) => void;
}

function msAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function PositionsTable({ positions, onClose }: PositionsTableProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold text-neon-blue tracking-widest">OPEN POSITIONS</span>
          <span className="bg-bg-border mono text-xs px-1.5 py-0.5 rounded text-gray-400">{positions.length}</span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="flex items-center justify-center h-16 text-gray-500 mono text-xs">
          No open positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>STRATEGY</th>
                <th>MARKET</th>
                <th>SIDE</th>
                <th>ENTRY</th>
                <th>CURRENT</th>
                <th>UNRLZD P&L</th>
                <th>TP</th>
                <th>SL</th>
                <th>OPEN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => {
                const pnlPositive = pos.unrealizedPnl >= 0;
                return (
                  <tr
                    key={pos.id}
                    className={pnlPositive ? 'bg-neon-green/[0.02]' : 'bg-neon-red/[0.02]'}
                  >
                    <td className="text-white font-medium">{pos.strategyName}</td>
                    <td>{pos.market === 'BTC_5MIN' ? '5M' : '15M'}</td>
                    <td className={pos.side === 'UP' ? 'text-neon-green font-bold' : 'text-neon-red font-bold'}>
                      {pos.side}
                    </td>
                    <td>{pos.entryPrice.toFixed(3)}</td>
                    <td className={pnlPositive ? 'text-neon-green' : 'text-neon-red'}>
                      {pos.currentPrice.toFixed(3)}
                    </td>
                    <td className={`font-semibold ${pnlPositive ? 'text-neon-green' : 'text-neon-red'}`}>
                      {pnlPositive ? '+' : ''}{pos.unrealizedPnl.toFixed(4)} USDC
                    </td>
                    <td className="text-neon-green/80">
                      {pos.tpLevel !== null ? pos.tpLevel.toFixed(3) : '—'}
                    </td>
                    <td className="text-neon-red/80">
                      {pos.slLevel !== null ? pos.slLevel.toFixed(3) : '—'}
                    </td>
                    <td className="text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {msAgo(pos.entryTime)}
                    </td>
                    <td>
                      <button
                        onClick={() => onClose(pos.id)}
                        className="p-1 rounded text-gray-600 hover:text-neon-red hover:bg-neon-red/10 transition-colors"
                        title="Close position"
                      >
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
