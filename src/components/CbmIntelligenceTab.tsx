import React, { useState, useEffect } from 'react';
import { Motor, Device, Measurement, Baseline, CbmConfig } from '../types';
import {
  getBaselineApi,
  createBaselineApi,
  getCbmConfigApi,
  updateCbmConfigApi,
} from '../services/api';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Info,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface CbmIntelligenceTabProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
  onRefresh: () => void;
}

export const CbmIntelligenceTab: React.FC<CbmIntelligenceTabProps> = ({
  motor,
  device,
  latest,
  onRefresh,
}) => {
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [baselineHistory, setBaselineHistory] = useState<Baseline[]>([]);
  const [config, setConfig] = useState<CbmConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isCreatingBaseline, setIsCreatingBaseline] = useState<boolean>(false);

  // New baseline modal state
  const [showBaselineModal, setShowBaselineModal] = useState<boolean>(false);
  const [operatingConditionInput, setOperatingConditionInput] = useState<string>('1440 RPM Nominal Steady State');
  const [sampleCountInput, setSampleCountInput] = useState<number>(30);
  const [baselineNotesInput, setBaselineNotesInput] = useState<string>('Calibrated during normal operating condition');

  // Config form state
  const [anomalyPct, setAnomalyPct] = useState<number>(25);
  const [anomalyStd, setAnomalyStd] = useState<number>(2.5);
  const [sustainedCount, setSustainedCount] = useState<number>(2);
  const [spikeRatio, setSpikeRatio] = useState<number>(1.8);
  const [warningPersistence, setWarningPersistence] = useState<number>(2);

  const motorId = motor?.motor_id || 'MOTOR_01';

  const loadIntelligenceData = async () => {
    try {
      setIsLoading(true);
      const [baseData, cfgData] = await Promise.all([
        getBaselineApi(motorId).catch(() => ({ active: null, history: [] })),
        getCbmConfigApi(motorId).catch(() => null),
      ]);

      if (baseData) {
        setBaseline(baseData.active);
        setBaselineHistory(baseData.history || []);
      }

      if (cfgData) {
        setConfig(cfgData);
        setAnomalyPct(cfgData.anomaly_pct_threshold);
        setAnomalyStd(cfgData.anomaly_std_threshold);
        setSustainedCount(cfgData.sustained_count);
        setSpikeRatio(cfgData.spike_ratio);
        setWarningPersistence(cfgData.warning_persistence);
      }
    } catch (err) {
      console.error('Failed loading CBM intelligence data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligenceData();
  }, [motorId]);

  const handleCreateBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingBaseline(true);
      const newBase = await createBaselineApi({
        motorId,
        operatingCondition: operatingConditionInput,
        sampleCount: sampleCountInput,
        notes: baselineNotesInput,
      });
      setBaseline(newBase);
      setShowBaselineModal(false);
      await loadIntelligenceData();
      onRefresh();
    } catch (err) {
      console.error('Failed to create baseline:', err);
    } finally {
      setIsCreatingBaseline(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingConfig(true);
      const updated = await updateCbmConfigApi(motorId, {
        anomaly_pct_threshold: Number(anomalyPct),
        anomaly_std_threshold: Number(anomalyStd),
        sustained_count: Number(sustainedCount),
        spike_ratio: Number(spikeRatio),
        warning_persistence: Number(warningPersistence),
      });
      setConfig(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed saving CBM config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Metric derivations
  const currentRms = latest?.overall_rms ?? 0.185;
  const baseMeanRms = baseline?.mean_rms ?? 0.185;
  const rmsDeviationPct = Number((((currentRms - baseMeanRms) / baseMeanRms) * 100).toFixed(1));
  const rmsDeviationG = Number((currentRms - baseMeanRms).toFixed(4));
  const healthScore = latest?.health_score ?? 95.0;

  // Possible Condition formatting
  const possibleCondition = latest?.possible_condition || 'NORMAL';
  const isAnomaly = latest?.anomaly_detected === 1;

  const conditionLabels: Record<string, { label: string; color: string; desc: string }> = {
    NORMAL: {
      label: 'No Indication (Operating within Baseline)',
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60',
      desc: 'Kinematic vibration amplitudes and spectral crest factors are consistent with learned steady-state operating baseline.',
    },
    POSSIBLE_IMBALANCE: {
      label: 'Possible Imbalance (Requires Verification)',
      color: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
      desc: 'Elevated radial horizontal and vertical vibration detected with sinusoidal crest factor (1X turning speed profile).',
    },
    POSSIBLE_MISALIGNMENT: {
      label: 'Possible Misalignment (Requires Verification)',
      color: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
      desc: 'Disproportionately elevated axial (Z-axis) vibration relative to radial vibration (indicative of angular or parallel coupling offset).',
    },
    POSSIBLE_LOOSENESS: {
      label: 'Possible Looseness (Requires Verification)',
      color: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
      desc: 'High peak-to-peak dynamic swing and elevated crest factor with directional non-uniformity (indicative of structural/mounting looseness).',
    },
    POSSIBLE_BEARING_FAULT: {
      label: 'Possible Bearing-Related Vibration (Requires Verification)',
      color: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
      desc: 'High crest factor (>3.5) with sharp repetitive dynamic impact peaks (indicative of early bearing race or ball surface stress).',
    },
  };

  const currentConditionMeta = conditionLabels[possibleCondition] || conditionLabels.NORMAL;

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner Required by Phase 8 */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-200/90 text-xs sm:text-sm flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-300">Phase 8 CBM Prototype Notice & Engineering Disclaimer</div>
          <p className="mt-1 leading-relaxed text-amber-200/80">
            This condition monitoring engine evaluates baseline statistical variations and kinematic ratios.
            It does <strong>NOT</strong> definitively diagnose physical mechanical faults. Indications such as 
            <em> "Possible Imbalance"</em> or <em>"Possible Bearing-Related Vibration"</em> are heuristic flags requiring 
            detailed frequency-domain (FFT) verification, correct sensor mounting, machine operating speed/load context, 
            and confirmation by a certified vibration engineer.
          </p>
        </div>
      </div>

      {/* Top Grid: Health Score, Baseline RMS Deviation, Anomaly Status, Trend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Prototype CBM Health Score */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>HEALTH SCORE</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold tracking-tight font-mono ${
                healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {healthScore}
            </span>
            <span className="text-slate-500 text-sm font-mono">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-300">Prototype CBM Health Score</span>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(5, healthScore)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 2: Baseline vs Current RMS */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>BASELINE DEVIATION</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold font-mono tracking-tight ${
                rmsDeviationPct > 25 ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {rmsDeviationPct > 0 ? `+${rmsDeviationPct}` : rmsDeviationPct}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({rmsDeviationG > 0 ? `+${rmsDeviationG}` : rmsDeviationG}g)
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Base: {baseMeanRms.toFixed(3)}g</span>
            <span>Current: {currentRms.toFixed(3)}g</span>
          </div>
        </div>

        {/* Metric 3: Anomaly Status */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>ANOMALY STATUS</span>
            <AlertTriangle className={`w-4 h-4 ${isAnomaly ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className="my-3">
            {isAnomaly ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Anomaly Detected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Normal Operating State
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {latest?.anomaly_reason || 'Vibration variation within statistical threshold'}
          </div>
        </div>

        {/* Metric 4: Trend Direction */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>VIBRATION TREND</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-3 flex items-center gap-2">
            {latest?.trend_direction === 'INCREASING' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <TrendingUp className="w-4 h-4" /> ↗ INCREASING
              </span>
            ) : latest?.trend_direction === 'DECREASING' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <TrendingDown className="w-4 h-4" /> ↘ DECREASING
              </span>
            ) : latest?.trend_direction === 'SPIKE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <Zap className="w-4 h-4" /> ⚡ TRANSIENT SPIKE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                <Minus className="w-4 h-4" /> → STABLE
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
            Rate: {latest?.trend_slope ? `${latest.trend_slope > 0 ? '+' : ''}${latest.trend_slope} g/hr` : '0.000 g/hr'}
          </div>
        </div>
      </div>

      {/* Section: Possible Fault Indication */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100">Possible Machine Condition Indication</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Kinematic Decomposition Model</span>
        </div>

        <div className="mt-4 p-4 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/40 border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-md text-xs font-bold border ${currentConditionMeta.color}`}>
                {currentConditionMeta.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 pt-1 leading-relaxed max-w-3xl">
              {currentConditionMeta.desc}
            </p>
          </div>
          <div className="text-right shrink-0 font-mono text-xs text-slate-400 bg-slate-900/80 p-3 rounded border border-slate-800">
            <div>Tri-axial Profile:</div>
            <div className="text-slate-200">X: {latest?.x_rms ?? 0}g | Y: {latest?.y_rms ?? 0}g | Z: {latest?.z_rms ?? 0}g</div>
            <div className="text-slate-400 mt-1">Crest Factor: {latest?.crest_factor ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Baseline Learning Center & Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Baseline Card */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-slate-100">Active Learned Operating Baseline</h3>
            </div>
            <button
              onClick={() => setShowBaselineModal(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Relearn / Create Baseline
            </button>
          </div>

          {baseline ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">BASELINE MEAN RMS</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1">{baseline.mean_rms.toFixed(4)}g</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">±{baseline.std_rms.toFixed(4)}g (1σ)</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">MEAN PEAK</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1">{baseline.mean_peak.toFixed(4)}g</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">±{baseline.std_peak.toFixed(4)}g (1σ)</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">PEAK-TO-PEAK</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1">{baseline.mean_peak_to_peak.toFixed(4)}g</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Dynamic envelope</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">CREST FACTOR</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1">{baseline.mean_crest_factor.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Normal sinusoidal: ~1.4–2.0</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Operating Condition:</span>
                  <span className="font-semibold text-slate-200">{baseline.operating_condition}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sample Population:</span>
                  <span className="font-mono text-slate-200">{baseline.sample_count} valid steady-state samples</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Established At:</span>
                  <span className="font-mono text-slate-200">{new Date(baseline.created_at).toLocaleString()}</span>
                </div>
                {baseline.notes && (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <em>Notes: {baseline.notes}</em>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm">
              No active baseline established yet. Click &quot;Relearn / Create Baseline&quot; to compute from normal telemetry.
            </div>
          )}

          {/* Historical Baselines Table */}
          {baselineHistory.length > 1 && (
            <div className="mt-5 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Historical Baselines Log</h4>
              <div className="overflow-x-auto max-h-40">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Established</th>
                      <th className="p-2">Condition</th>
                      <th className="p-2">Mean RMS</th>
                      <th className="p-2">Std Dev</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {baselineHistory.map((b) => (
                      <tr key={b.id}>
                        <td className="p-2 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString()}</td>
                        <td className="p-2 truncate max-w-[140px]">{b.operating_condition}</td>
                        <td className="p-2">{b.mean_rms.toFixed(4)}g</td>
                        <td className="p-2">±{b.std_rms.toFixed(4)}g</td>
                        <td className="p-2">
                          {b.is_active === 1 ? (
                            <span className="text-emerald-400 font-bold">ACTIVE</span>
                          ) : (
                            <span className="text-slate-500">Archived</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Configurable Anomaly & Alarm Rules */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100">Anomaly Configuration</h3>
          </div>

          <form onSubmit={handleSaveConfig} className="mt-4 space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Anomaly Percentage Limit (% above baseline)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="100"
                  value={anomalyPct}
                  onChange={(e) => setAnomalyPct(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Flags anomaly when current RMS exceeds baseline by this %</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Statistical Sigma Threshold (Z-score)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={anomalyStd}
                  onChange={(e) => setAnomalyStd(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-slate-400">σ</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Statistical deviation threshold (default 2.5σ)</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Sustained Anomaly Count
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={sustainedCount}
                onChange={(e) => setSustainedCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Consecutive measurements required before raising anomaly alarm</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Peak Shock Ratio (vs Baseline Peak)
              </label>
              <input
                type="number"
                step="0.1"
                min="1.2"
                max="3.0"
                value={spikeRatio}
                onChange={(e) => setSpikeRatio(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Flags isolated dynamic shock spikes</p>
            </div>

            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-lg transition text-xs border border-slate-700"
            >
              {isSavingConfig ? 'Saving...' : 'Update Anomaly Rules'}
            </button>
          </form>
        </div>
      </div>

      {/* Modal: Create/Relearn Baseline */}
      {showBaselineModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Relearn Operating Baseline</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Verify that the motor is running normally under steady-state operating conditions before proceeding.
              The baseline statistical mean, standard deviation, and peak envelope will be calculated from healthy telemetry.
            </p>

            <form onSubmit={handleCreateBaseline} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Operating Condition</label>
                <input
                  type="text"
                  value={operatingConditionInput}
                  onChange={(e) => setOperatingConditionInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Sample Count to Aggregate</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={sampleCountInput}
                  onChange={(e) => setSampleCountInput(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Engineering Notes</label>
                <textarea
                  value={baselineNotesInput}
                  onChange={(e) => setBaselineNotesInput(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBaselineModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBaseline}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs transition"
                >
                  {isCreatingBaseline ? 'Computing...' : 'Calculate & Save Baseline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
