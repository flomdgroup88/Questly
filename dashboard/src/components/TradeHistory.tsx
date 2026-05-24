import React, { useState, useMemo } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Trade, MarketId } from '../types';

interface TradeHistoryProps {
  trades: Trade[];
}

const PAGE_SIZE = 50;

function fmt(n: number | null, dec = 3): string {
  if (n === null) return '—';
  return n.toFixed(dec);
}

function fmtDatetime(ms: number): string {
  const d = new Date(ms);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${dy} ${hh}:${mm}:${ss}`;
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  const [page, setPage] = useState(0);
  const [filterResult, setFilterResult] = useState<'ALL' | 'WIN' | 'LOSS' | 'OPEN'>('ALL');
  const [filterMarket, setFilterMarket] = useState<'ALL' | MarketId>('ALL');
  const [filterStrategy, setFilterStrategy] = useState('ALL');

  const strategies = useMemo(() => {
    const names = new Set(trades.map(t => t.strategyName));
    return ['ALL', ...Array.from(names)];
  }, [trades]);

  const filtered = useMemo(() => {
    return trades.filter(t => {
      if (filterResult !== 'ALL' && t.result !== filterResult) return false;
      if (filterMarket !== 'ALL' && t.market !== filterMarket) return false;
      if (filterStrategy !== 'ALL' && t.strategyName !== filterStrategy) return false;
      return true;
    });
  }, [trades, filterResult, filterMarket, filterStrategy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalPnl = filtered
    .filter(t => t.pnl !== null && t.result !== 'OPEN')
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const winCount = filtered.filter(t => t.result === 'WIN').length;
  const closedCount = filtered.filter(t => t.result !== 'OPEN').length;
  const winRate = closedCount > 0 ? (winCount / closedCount * 100).toFixed(1) : '—';

  const handleExportCsv = () => {
    const header = 'datetime,strategy,market,side,entry,exit,pnl,pnl_pct,result,exit_reason\n';
    const rows = filtered.map(t =>
      [
        fmtDatetime(t.entryTime),
        `"${t.strategyName}"`,
        t.market,
        t.side,
        fmt(t.entryPrice),
        fmt(t.exitPrice),
        fmt(t.pnl, 4),
        fmt(t.pnlPct, 2),
        t.result,
        t.exitReason ?? '',
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polybot-trades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset page when filters change
  const handleFilterChange = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="mono text-xs font-bold text-neon-blue tracking-widest">TRADE HISTORY</span>
          <span className="bg-bg-border mono text-xs px-1.5 py-0.5 rounded text-gray-400">
            {filtered.length} trades
          </span>
          {closedCount > 0 && (
            <>
              <span className="mono text-xs text-gray-500">
                Win rate: <span className="text-neon-blue">{winRate}%</span>
              </span>
              <span className={`mono text-xs font-medium ${totalPnl >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDC
              </span>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            value={filterResult}
            onChange={v => handleFilterChange(() => setFilterResult(v as typeof filterResult))}
            options={['ALL', 'WIN', 'LOSS', 'OPEN']}
            label="Result"
          />
          <FilterSelect
            value={filterMarket}
            onChange={v => handleFilterChange(() => setFilterMarket(v as typeof filterMarket))}
            options={['ALL', 'BTC_5MIN', 'BTC_15MIN']}
            label="Market"
          />
          <FilterSelect
            value={filterStrategy}
            onChange={v => handleFilterChange(() => setFilterStrategy(v))}
            options={strategies}
            label="Strategy"
          />
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded mono text-xs text-gray-400 border border-bg-border hover:border-neon-blue/40 hover:text-neon-blue transition-colors"
          >
            <Download size={11} />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="flex items-center justify-center h-16 text-gray-500 mono text-xs">
          No trades match current filters
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>DATETIME</th>
                <th>STRATEGY</th>
                <th>MKT</th>
                <th>SIDE</th>
                <th>ENTRY</th>
                <th>EXIT</th>
                <th>PNL (USDC)</th>
                <th>PNL %</th>
                <th>REASON</th>
                <th>RESULT</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(trade => {
                const pnlPos = (trade.pnl ?? 0) >= 0;
                return (
                  <tr key={trade.id}>
                    <td className="text-gray-400 tabular-nums">{fmtDatetime(trade.entryTime)}</td>
                    <td className="text-white max-w-[120px] truncate">{trade.strategyName}</td>
                    <td className="text-neon-blue">{trade.market === 'BTC_5MIN' ? '5M' : '15M'}</td>
                    <td className={trade.side === 'UP' ? 'text-neon-green font-bold' : 'text-neon-red font-bold'}>
                      {trade.side}
                    </td>
                    <td className="tabular-nums">{fmt(trade.entryPrice)}</td>
                    <td className="tabular-nums text-gray-300">{fmt(trade.exitPrice)}</td>
                    <td className={`tabular-nums font-semibold ${
                      trade.result === 'OPEN' ? 'text-gray-400' :
                      pnlPos ? 'text-neon-green' : 'text-neon-red'
                    }`}>
                      {trade.pnl !== null
                        ? `${pnlPos ? '+' : ''}${fmt(trade.pnl, 4)}`
                        : '—'
                      }
                    </td>
                    <td className={`tabular-nums ${pnlPos ? 'text-neon-green/70' : 'text-neon-red/70'}`}>
                      {trade.pnlPct !== null
                        ? `${pnlPos ? '+' : ''}${fmt(trade.pnlPct, 1)}%`
                        : '—'
                      }
                    </td>
                    <td className="text-gray-500">{trade.exitReason ?? '—'}</td>
                    <td>
                      <ResultBadge result={trade.result} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-bg-border">
          <span className="mono text-xs text-gray-500">
            Page {page + 1} / {totalPages} · {filtered.length} total
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(0)} disabled={page === 0}>«</PagBtn>
            <PagBtn onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              <ChevronLeft size={12} />
            </PagBtn>
            <PagBtn onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight size={12} />
            </PagBtn>
            <PagBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</PagBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, options, label,
}: {
  value: string; onChange: (v: string) => void; options: string[]; label: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="poly-input w-auto text-xs py-1 px-2"
      style={{ minWidth: 80 }}
      aria-label={label}
    >
      {options.map(o => (
        <option key={o} value={o}>{o === 'ALL' ? `All ${label}s` : o}</option>
      ))}
    </select>
  );
}

function ResultBadge({ result }: { result: string }) {
  const classes = {
    WIN: 'bg-neon-green/10 text-neon-green border-neon-green/20',
    LOSS: 'bg-neon-red/10 text-neon-red border-neon-red/20',
    OPEN: 'bg-neon-blue/10 text-neon-blue border-neon-blue/20',
  }[result] ?? 'bg-bg-border text-gray-400';

  return (
    <span className={`mono text-xs px-1.5 py-0.5 rounded border font-medium ${classes}`}>
      {result}
    </span>
  );
}

function PagBtn({
  onClick, disabled, children,
}: {
  onClick: () => void; disabled: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 rounded mono text-xs text-gray-400 border border-bg-border hover:border-neon-blue/40 hover:text-neon-blue disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
