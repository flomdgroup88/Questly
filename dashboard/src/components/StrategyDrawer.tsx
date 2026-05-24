import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { Strategy, DEFAULT_STRATEGY, MarketId } from '../types';
function genId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface StrategyDrawerProps {
  strategy: Strategy | null; // null = new
  onSave: (strategy: Strategy) => void;
  onClose: () => void;
}

export function StrategyDrawer({ strategy, onSave, onClose }: StrategyDrawerProps) {
  const [form, setForm] = useState<Strategy>(() =>
    strategy ?? { id: genId(), ...DEFAULT_STRATEGY }
  );

  useEffect(() => {
    setForm(strategy ?? { id: genId(), ...DEFAULT_STRATEGY });
  }, [strategy]);

  const set = <K extends keyof Strategy>(key: K, value: Strategy[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const setEntry = <K extends keyof Strategy['entry']>(key: K, value: Strategy['entry'][K]) => {
    setForm(f => ({ ...f, entry: { ...f.entry, [key]: value } }));
  };

  const setTp = <K extends keyof Strategy['takeProfit']>(key: K, value: Strategy['takeProfit'][K]) => {
    setForm(f => ({ ...f, takeProfit: { ...f.takeProfit, [key]: value } }));
  };

  const setSl = <K extends keyof Strategy['stopLoss']>(key: K, value: Strategy['stopLoss'][K]) => {
    setForm(f => ({ ...f, stopLoss: { ...f.stopLoss, [key]: value } }));
  };

  const handleSave = () => onSave(form);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border sticky top-0 bg-bg-card z-10">
          <div>
            <h2 className="mono font-bold text-sm text-white">
              {strategy ? 'EDIT STRATEGY' : 'NEW STRATEGY'}
            </h2>
            <p className="text-gray-500 text-xs mono mt-0.5">{form.id.substring(0, 16)}...</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded mono text-xs font-medium bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors"
            >
              <Save size={11} />SAVE
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-bg-border text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Basic */}
          <Section title="BASIC">
            <Row label="Name">
              <input className="poly-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </Row>
            <Row label="Market">
              <select className="poly-input" value={form.market} onChange={e => set('market', e.target.value as MarketId)}>
                <option value="BTC_5MIN">BTC 5-Min</option>
                <option value="BTC_15MIN">BTC 15-Min</option>
              </select>
            </Row>
            <Row label="Side">
              <select className="poly-input" value={form.side} onChange={e => set('side', e.target.value as Strategy['side'])}>
                <option value="AUTO">AUTO (follow BTC direction)</option>
                <option value="UP">UP always</option>
                <option value="DOWN">DOWN always</option>
              </select>
            </Row>
            <Row label="Enabled">
              <label className="toggle">
                <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </Row>
          </Section>

          {/* Entry Conditions */}
          <Section title="ENTRY CONDITIONS">
            <Row label="Time window (MM:SS)">
              <div className="flex items-center gap-2">
                <input
                  className="poly-input"
                  placeholder="00:30"
                  value={form.entry.timeAfterCandleOpenMinSec}
                  onChange={e => setEntry('timeAfterCandleOpenMinSec', e.target.value)}
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  className="poly-input"
                  placeholder="03:00"
                  value={form.entry.timeAfterCandleOpenMaxSec}
                  onChange={e => setEntry('timeAfterCandleOpenMaxSec', e.target.value)}
                />
              </div>
            </Row>

            <div className="flex items-center justify-between mb-1">
              <span className="mono text-xs text-gray-400">BTC Delta Filter</span>
              <label className="toggle">
                <input type="checkbox" checked={form.entry.btcDeltaFilterEnabled} onChange={e => setEntry('btcDeltaFilterEnabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <Row label="BTC delta ($)" disabled={!form.entry.btcDeltaFilterEnabled}>
              <div className="flex items-center gap-2">
                <input
                  className="poly-input"
                  type="number"
                  placeholder="-9999"
                  value={form.entry.btcDeltaMinUsd}
                  disabled={!form.entry.btcDeltaFilterEnabled}
                  onChange={e => setEntry('btcDeltaMinUsd', parseFloat(e.target.value) || 0)}
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  className="poly-input"
                  type="number"
                  placeholder="9999"
                  value={form.entry.btcDeltaMaxUsd}
                  disabled={!form.entry.btcDeltaFilterEnabled}
                  onChange={e => setEntry('btcDeltaMaxUsd', parseFloat(e.target.value) || 0)}
                />
              </div>
            </Row>

            <div className="flex items-center justify-between mb-1">
              <span className="mono text-xs text-gray-400">Share Price Filter</span>
              <label className="toggle">
                <input type="checkbox" checked={form.entry.sharePriceFilterEnabled} onChange={e => setEntry('sharePriceFilterEnabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <Row label="Share price range" disabled={!form.entry.sharePriceFilterEnabled}>
              <div className="flex items-center gap-2">
                <input
                  className="poly-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={form.entry.sharePriceMin}
                  disabled={!form.entry.sharePriceFilterEnabled}
                  onChange={e => setEntry('sharePriceMin', parseFloat(e.target.value) || 0)}
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  className="poly-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={form.entry.sharePriceMax}
                  disabled={!form.entry.sharePriceFilterEnabled}
                  onChange={e => setEntry('sharePriceMax', parseFloat(e.target.value) || 0)}
                />
              </div>
            </Row>
          </Section>

          {/* Position Sizing */}
          <Section title="POSITION SIZING">
            <Row label="Bet amount (USDC)">
              <input
                className="poly-input"
                type="number"
                step="1"
                min="1"
                value={form.betAmountUsdc}
                onChange={e => set('betAmountUsdc', parseFloat(e.target.value) || 1)}
              />
            </Row>
            <Row label="Max rounds / candle">
              <input
                className="poly-input"
                type="number"
                step="1"
                min="0"
                value={form.maxRoundsPerCandle}
                onChange={e => set('maxRoundsPerCandle', parseInt(e.target.value) || 0)}
              />
              <span className="text-gray-500 mono text-xs mt-1">0 = unlimited</span>
            </Row>
            <Row label="Max concurrent positions">
              <input
                className="poly-input"
                type="number"
                step="1"
                min="1"
                value={form.maxConcurrentPositions}
                onChange={e => set('maxConcurrentPositions', parseInt(e.target.value) || 1)}
              />
            </Row>
            <Row label="Use limit order">
              <label className="toggle">
                <input type="checkbox" checked={form.useLimitOrder} onChange={e => set('useLimitOrder', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </Row>
            {form.useLimitOrder && (
              <Row label="Limit price offset">
                <input
                  className="poly-input"
                  type="number"
                  step="0.001"
                  value={form.limitPriceOffset}
                  onChange={e => set('limitPriceOffset', parseFloat(e.target.value) || 0)}
                />
              </Row>
            )}
          </Section>

          {/* Take Profit */}
          <Section title="TAKE PROFIT">
            <Row label="Enabled">
              <label className="toggle">
                <input type="checkbox" checked={form.takeProfit.enabled} onChange={e => setTp('enabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </Row>
            {form.takeProfit.enabled && (
              <>
                <Row label="Mode">
                  <select className="poly-input" value={form.takeProfit.mode} onChange={e => setTp('mode', e.target.value as 'ABSOLUTE_PRICE' | 'PCT_FROM_ENTRY')}>
                    <option value="ABSOLUTE_PRICE">Absolute price (e.g. 0.70)</option>
                    <option value="PCT_FROM_ENTRY">% from entry (e.g. 40)</option>
                  </select>
                </Row>
                <Row label={form.takeProfit.mode === 'ABSOLUTE_PRICE' ? 'Target price' : 'Target % gain'}>
                  <input
                    className="poly-input"
                    type="number"
                    step="0.01"
                    value={form.takeProfit.value}
                    onChange={e => setTp('value', parseFloat(e.target.value) || 0)}
                  />
                </Row>
              </>
            )}
          </Section>

          {/* Stop Loss */}
          <Section title="STOP LOSS">
            <Row label="Enabled">
              <label className="toggle">
                <input type="checkbox" checked={form.stopLoss.enabled} onChange={e => setSl('enabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </Row>
            {form.stopLoss.enabled && (
              <>
                <Row label="Mode">
                  <select className="poly-input" value={form.stopLoss.mode} onChange={e => setSl('mode', e.target.value as 'ABSOLUTE_PRICE' | 'PCT_FROM_ENTRY')}>
                    <option value="ABSOLUTE_PRICE">Absolute price (e.g. 0.30)</option>
                    <option value="PCT_FROM_ENTRY">% loss (e.g. 40)</option>
                  </select>
                </Row>
                <Row label={form.stopLoss.mode === 'ABSOLUTE_PRICE' ? 'Stop price' : 'Max % loss'}>
                  <input
                    className="poly-input"
                    type="number"
                    step="0.01"
                    value={form.stopLoss.value}
                    onChange={e => setSl('value', parseFloat(e.target.value) || 0)}
                  />
                </Row>
              </>
            )}
          </Section>

          {/* Safety */}
          <Section title="SAFETY LIMITS">
            <Row label="Daily loss limit (USDC)">
              <input
                className="poly-input"
                type="number"
                step="1"
                min="0"
                value={form.dailyLossLimitUsdc}
                onChange={e => set('dailyLossLimitUsdc', parseFloat(e.target.value) || 0)}
              />
              <span className="text-gray-500 mono text-xs mt-1">0 = no limit</span>
            </Row>
            <Row label="Cooldown after loss (sec)">
              <input
                className="poly-input"
                type="number"
                step="1"
                min="0"
                value={form.cooldownAfterLossSec}
                onChange={e => set('cooldownAfterLossSec', parseInt(e.target.value) || 0)}
              />
            </Row>
          </Section>

          {/* Warning */}
          {form.enabled && (
            <div className="flex items-start gap-2 p-3 rounded bg-neon-yellow/5 border border-neon-yellow/20">
              <AlertTriangle size={14} className="text-neon-yellow mt-0.5 shrink-0" />
              <p className="mono text-xs text-neon-yellow/80">
                Strategy is enabled. It will immediately start trading when conditions are met after saving.
              </p>
            </div>
          )}

          {/* Save button (bottom) */}
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded mono text-sm font-bold bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors"
          >
            SAVE STRATEGY
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="mono text-xs font-bold text-neon-blue tracking-widest">{title}</span>
        <div className="flex-1 h-px bg-bg-border" />
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Row({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-40' : ''}`}>
      <label className="mono text-xs text-gray-400">{label}</label>
      {children}
    </div>
  );
}
