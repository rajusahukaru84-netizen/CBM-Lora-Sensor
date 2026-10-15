import React from 'react';
import { Motor, Device, Measurement, Alarm, TimeRange } from '../types';
import {
  Activity,
  Radio,
  Cpu,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sliders,
  Disc,
  ShieldCheck,
  Compass,
  ArrowUpRight,
  Terminal,
  Award,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { MotorVisualization } from './MotorVisualization';
import { HistoricalChart } from './HistoricalChart';

interface OverviewDashboardProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
  measurements: Measurement[];
  alarms: Alarm[];
  onNavigateTab: (tab: any) => void;
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoadingMeasurements: boolean;
  onRefreshHistory: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  motor,
  device,
  latest,
  measurements,
  alarms,
  onNavigateTab,
  selectedRange,
  onRangeChange,
  isLoadingMeasurements,
  onRefreshHistory,
}) => {
  const isOnline = device?.status === 'ONLINE';
  const sensorOk = latest?.sensor_status === 'OK';
  const healthStatus = latest?.health_status || 'NORMAL';
  const healthScore = latest?.health_score ?? 95;
  const isAnomaly = latest?.anomaly_detected === 1;

  const warnRms = motor?.warning_rms ?? 0.280;
  const critRms = motor?.critical_rms ?? 0.450;
  const warnPeak = motor?.warning_peak ?? 0.600;
  const critPeak = motor?.critical_peak ?? 1.000;

  // Triaxial values
  const xRms = latest?.x_rms ?? (latest ? Number((latest.overall_rms * 0.72).toFixed(3)) : null);
  const yRms = latest?.y_rms ?? (latest ? Number((latest.overall_rms * 0.62).toFixed(3)) : null);
  const zRms = latest?.z_rms ?? (latest ? Number((latest.overall_rms * 0.31).toFixed(3)) : null);

  const lastCommTime = latest?.recorded_at
    ? new Date(latest.recorded_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'No packets yet';

  const possibleCondition = latest?.possible_condition || 'NORMAL';

  return (
    <div id="overview-dashboard-view" className="space-y-6">
      {/* Phase 8 Intelligence Quick Header Bar */}
      <div className="rounded-xl border border-cyan-800/40 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-950 border border-cyan-700/60 rounded-xl text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                Phase 8 CBM Intelligence
              </span>
              {isAnomaly && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ANOMALY ACTIVE
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5 flex items-center gap-2">
              <span>Prototype CBM Health Score:</span>
              <span className={`font-mono text-xl ${
                healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {healthScore}/100
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Possible condition: <strong className="text-slate-200">{possibleCondition}</strong> &middot; 
              Trend: <strong className="text-slate-200">{latest?.trend_direction || 'STABLE'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigateTab('commissioning')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Motor Commissioning</span>
          </button>
          <button
            onClick={() => onNavigateTab('predictive-maintenance')}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Predictive & RUL (Phase 12)</span>
          </button>
          <button
            onClick={() => onNavigateTab('intelligence')}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <span>Open CBM Intelligence</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigateTab('test-suite')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Run Test Suite</span>
          </button>
        </div>
      </div>

      {/* 1. Machinery Operational Banner & Status Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1 & 2: Motor Name / ID & Operating Status */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            1. MOTOR / STATUS
          </span>
          <div className="mt-1 font-bold text-sm text-slate-100 truncate" title={motor?.tag_name || 'Feed Pump Motor 01'}>
            {motor?.motor_id || 'MOTOR_01'}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>RUNNING (1440 RPM)</span>
          </div>
        </div>

        {/* Metric 3: CBM Health Status */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            3. CBM HEALTH
          </span>
          <div className="mt-1 text-sm font-bold font-mono">
            {healthStatus === 'CRITICAL' ? (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> CRITICAL
              </span>
            ) : healthStatus === 'WARNING' ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> WARNING
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> NORMAL
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            Score: {healthScore}/100
          </span>
        </div>

        {/* Metric 4: Sensor Status */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            4. SENSOR STATUS
          </span>
          <div className="mt-1 text-sm font-bold font-mono">
            <span className={sensorOk ? 'text-emerald-400' : 'text-rose-400'}>
              {sensorOk ? 'OK (MPU6050)' : 'HARDWARE ERROR'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            I2C 400kHz @ &plusmn;4g
          </span>
        </div>

        {/* Metric 5: ESP32 Node Status */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            5. ESP32 NODE
          </span>
          <div className="mt-1 text-sm font-bold font-mono flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isOnline ? 'text-emerald-300' : 'text-rose-400'}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {device?.device_name || 'CBM_NODE_01'}
          </span>
        </div>

        {/* Metric 6 & 7: LoRaWAN & Gateway Status */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            6 & 7. LORA / GATEWAY
          </span>
          <div className="mt-1 text-sm font-bold font-mono text-cyan-300 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>CONNECTED</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            RAK7268V2 (IN865)
          </span>
        </div>

        {/* Metric 8 & 14: Last Received Measurement & Comm Time */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            8 & 14. LAST COMM TIME
          </span>
          <div className="mt-1 text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{lastCommTime}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            Seq #{latest?.sequence ?? '0'} (30s Cycle)
          </span>
        </div>
      </div>

      {/* 2. Core Kinematic Vibration Cards (Metrics 9, 10, 11, 12, 13) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Primary Vibration Measurements (Physical Units)
          </h2>
          <button
            onClick={() => onNavigateTab('settings')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            Edit Limits
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 9: RMS Vibration */}
          <MetricCard
            id="metric-home-rms"
            title="9. Overall RMS"
            value={latest?.overall_rms}
            unit="g"
            warningLimit={warnRms}
            criticalLimit={critRms}
            description="Overall energy severity indicator"
            status={latest?.health_status || 'NORMAL'}
          />

          {/* Metric 10: Peak Vibration */}
          <MetricCard
            id="metric-home-peak"
            title="10. Peak Vibration"
            value={latest?.peak}
            unit="g"
            warningLimit={warnPeak}
            criticalLimit={critPeak}
            description="Maximum dynamic shock excursion"
            status={latest?.health_status || 'NORMAL'}
          />

          {/* Metric 11: Peak-to-Peak */}
          <MetricCard
            id="metric-home-pkpk"
            title="11. Peak-to-Peak"
            value={latest?.peak_to_peak}
            unit="g"
            description="Total dynamic swing range"
            status={latest?.health_status || 'NORMAL'}
          />

          {/* Metric 12: Crest Factor */}
          <MetricCard
            id="metric-home-crest"
            title="12. Crest Factor"
            value={latest?.crest_factor}
            unit="Ratio"
            description="Impulsiveness (Peak / RMS)"
            status={
              latest?.crest_factor && latest.crest_factor > 3.5
                ? 'WARNING'
                : 'NORMAL'
            }
          />
        </div>
      </div>

      {/* Metric 13: X/Y/Z Tri-Axial Vibration Values */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              METRIC 13
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Tri-Axial Vibration Vector Breakdown (X, Y, Z)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Vector Norm: <code className="text-slate-200">&radic;(X&sup2; + Y&sup2; + Z&sup2;) &asymp; RMS</code>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold block">
                X-Axis (Radial-H)
              </span>
              <span className="text-2xl font-mono font-extrabold text-white mt-1 block">
                {xRms !== null ? `${xRms.toFixed(3)} g` : '—'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Warn limit: {(warnRms * 0.72).toFixed(2)}g
              </span>
            </div>
            <Disc className="w-8 h-8 text-cyan-500/40" />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold block">
                Y-Axis (Radial-V)
              </span>
              <span className="text-2xl font-mono font-extrabold text-white mt-1 block">
                {yRms !== null ? `${yRms.toFixed(3)} g` : '—'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Warn limit: {(warnRms * 0.62).toFixed(2)}g
              </span>
            </div>
            <Disc className="w-8 h-8 text-emerald-500/40" />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-amber-400 font-bold block">
                Z-Axis (Axial Thrust)
              </span>
              <span className="text-2xl font-mono font-extrabold text-white mt-1 block">
                {zRms !== null ? `${zRms.toFixed(3)} g` : '—'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Warn limit: {(warnRms * 0.31).toFixed(2)}g
              </span>
            </div>
            <Disc className="w-8 h-8 text-amber-500/40" />
          </div>
        </div>
      </div>

      {/* 3. System Visualization Section */}
      <MotorVisualization motor={motor} device={device} latest={latest} />

      {/* 4. Interactive Historical Trend Chart Preview */}
      <HistoricalChart
        measurements={measurements}
        motor={motor}
        selectedRange={selectedRange}
        onRangeChange={onRangeChange}
        isLoading={isLoadingMeasurements}
        onRefresh={onRefreshHistory}
      />
    </div>
  );
};
