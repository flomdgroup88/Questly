import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Wifi, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';
import { MarketUpdate, MarketId } from '../types';

interface MarketCardProps {
  marketId: MarketId;
  data: MarketUpdate | undefined;
  sparklineUp: number[];
  sparklineDown: number[];
  btcConnected: boolean;
  polyConnected: boolean;
}

function msToMmss(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDelta(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n >= 0 ? '+' : '-'}$${abs}`;
}

function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  const width = 80;
  if (data.length < 2) return <div style={{ width, height }} className="opacity-20 bg-bg-border rounded" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.001;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastY = height - ((data[data.length - 1]! - min) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle
        cx={width}
        cy={lastY}
        r="2"
        fill={color}
      />
    </svg>
  );
}

export function MarketCard({ marketId, data, sparklineUp, sparklineDown, btcConnected }: MarketCardProps) {
  const label = marketId === 'BTC_5MIN' ? '5-MIN' : '15-MIN';
  const durationMs = marketId === 'BTC_5MIN' ? 5 * 60 * 1000 : 15 * 60 * 1000;

  const [, forceUpdate] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Local timer tick for smooth countdown
  useEffect(() => {
    intervalRef.current = setInterval(() => forceUpdate(n => n + 1), 100);
    return () => clearInterval(intervalRef.current);
  }, []);

  const [msAgo, setMsAgo] = useState(0);
  const lastUpdateRef = useRef<number>(0);
  const flashRef = useRef(false);
  const prevPriceRef = useRef<number>(0);

  useEffect(() => {
    if (!data) return;
    lastUpdateRef.current = Date.now();
    setMsAgo(0);
    flashRef.current = true;
    setTimeout(() => { flashRef.current = false; }, 300);
  }, [data?.timestampMs]);

  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdateRef.current) setMsAgo(Date.now() - lastUpdateRef.current);
    }, 50);
    return () => clearInterval(t);
  }, []);

  const timeRemaining = data?.timeRemainingMs ?? (durationMs);
  const timeElapsed = data?.timeElapsedMs ?? 0;
  const progress = Math.min(1, timeElapsed / durationMs);

  const btcDelta = data?.btcDeltaUsd ?? 0;
  const deltaPositive = btcDelta >= 0;

  const upPrice = data?.upSharePrice ?? 0;
  const downPrice = data?.downSharePrice ?? 0;

  const noData = !data || data.btcCurrentPrice === 0;

  return (
    <div className={`card p-4 flex flex-col gap-3 ${btcConnected ? '' : 'opacity-60'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold text-neon-blue tracking-widest">BTC {label}</span>
          <div className={`flex items-center gap-1 text-xs ${btcConnected ? 'text-neon-green' : 'text-neon-red'}`}>
            {btcConnected
              ? <><span className="w-1.5 h-1.5 rounded-full bg-neon-green live-dot" /><span className="mono text-xs">LIVE</span></>
              : <><WifiOff size={10} /><span className="mono text-xs">OFFLINE</span></>
            }
          </div>
        </div>
        <span className="mono text-xs text-gray-500">
          {lastUpdateRef.current > 0 ? `${msAgo}ms ago` : '--'}
        </span>
      </div>

      {/* Countdown Timer */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-gray-500 mono uppercase tracking-widest mb-1" style={{ fontSize: '0.6rem' }}>REMAINING</div>
          <div className="mono font-bold text-4xl text-white tabular-nums leading-none glow-blue" style={{ textShadow: '0 0 20px rgba(45,212,255,0.3)' }}>
            {msToMmss(timeRemaining)}
          </div>
        </div>

        {/* BTC Delta */}
        <div className="text-right">
          <div className="text-gray-500 mono uppercase tracking-widest mb-1" style={{ fontSize: '0.6rem' }}>DELTA</div>
          <div className={`mono font-bold text-2xl tabular-nums leading-none ${deltaPositive ? 'text-neon-green glow-green' : 'text-neon-red glow-red'}`}>
            {noData ? '--' : formatDelta(btcDelta)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-gray-600 mono" style={{ fontSize: '0.6rem', marginTop: '-8px' }}>
        <span>0%</span>
        <span>{Math.round(progress * 100)}% elapsed</span>
        <span>100%</span>
      </div>

      {/* BTC prices */}
      <div className="flex gap-3 pt-1">
        <PriceItem label="CURRENT" value={noData ? '--' : `$${formatPrice(data!.btcCurrentPrice)}`} />
        <PriceItem label="OPEN" value={data?.candleOpenPrice ? `$${formatPrice(data.candleOpenPrice)}` : '—'} />
      </div>

      {/* Share prices */}
      <div className="border-t border-bg-border pt-3 grid grid-cols-2 gap-3">
        <SharePrice
          label="UP"
          price={upPrice}
          bid={data?.upBestBid ?? 0}
          ask={data?.upBestAsk ?? 0}
          sparkline={sparklineUp}
          color="#00ff88"
        />
        <SharePrice
          label="DOWN"
          price={downPrice}
          bid={data?.downBestBid ?? 0}
          ask={data?.downBestAsk ?? 0}
          sparkline={sparklineDown}
          color="#ff3b3b"
        />
      </div>
    </div>
  );
}

function PriceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <div className="text-gray-500 mono uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>{label}</div>
      <div className="mono text-sm text-gray-300 font-medium">{value}</div>
    </div>
  );
}

function SharePrice({
  label, price, bid, ask, sparkline, color
}: {
  label: string; price: number; bid: number; ask: number; sparkline: number[]; color: string;
}) {
  const prevRef = useRef(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price !== prevRef.current && prevRef.current !== 0) {
      setFlash(price > prevRef.current ? 'up' : 'down');
      setTimeout(() => setFlash(null), 600);
    }
    prevRef.current = price;
  }, [price]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="mono text-xs font-bold" style={{ color }}>{label}</span>
        <div
          className={`mono font-bold text-lg tabular-nums ${
            flash === 'up' ? 'price-up' : flash === 'down' ? 'price-down' : ''
          }`}
          style={{ color }}
        >
          {price > 0 ? price.toFixed(3) : '-.---'}
        </div>
      </div>

      <Sparkline data={sparkline} color={color} height={24} />

      <div className="flex gap-2 text-gray-500 mono" style={{ fontSize: '0.65rem' }}>
        <span>B: {bid > 0 ? bid.toFixed(3) : '--'}</span>
        <span>A: {ask > 0 ? ask.toFixed(3) : '--'}</span>
      </div>
    </div>
  );
}
