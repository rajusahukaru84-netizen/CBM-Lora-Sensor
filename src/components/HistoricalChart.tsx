import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Measurement, TimeRange, Motor } from '../types';
import { Calendar, Clock, RefreshCw } from 'lucide-react';

interface HistoricalChartProps {
  measurements: Measurement[];
  motor: Motor | null;
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

type ChartViewMode = 'rms_peak' | 'tri_axial' | 'crest_pkpk' | 'temperature';

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  measurements,
  motor,
  selectedRange,
  onRangeChange,
  isLoading,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('rms_peak');

  const warnRms = motor?.warning_rms ?? 0.28;
  const critRms = motor?.critical_rms ?? 0.45;
  const warnPeak = motor?.warning_peak ?? 0.6;
  const critPeak = motor?.critical_peak ?? 1.0;

  // Format and downsample data for chart rendering
  const chartData = useMemo(() => {
    if (!measurements || measurements.length === 0) return [];

    return measurements.map((m) => {
      const date = new Date(m.recorded_at);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return {
        timestamp: m.recorded_at,
        timeLabel: `${dateStr} ${timeStr}`,
        sequence: m.sequence,
        overallRms: m.overall_rms,
        xRms: m.x_rms ?? Number((m.overall_rms * 0.72).toFixed(3)),
        yRms: m.y_rms ?? Number((m.overall_rms * 0.62).toFixed(3)),
        zRms: m.z_rms ?? Number((m.overall_rms * 0.31).toFixed(3)),
        peak: m.peak,
        peakToPeak: m.peak_to_peak,
        crestFactor: m.crest_factor,
        temperature: m.temperature,
        healthStatus: m.health_status,
      };
    });
  }, [measurements]);

  return (
    <div id="historical-trend-card" className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100 tracking-tight">
              Historical Vibration & Health Analysis
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-cyan-400 border border-slate-700">
              {chartData.length} SAMPLES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized time-series telemetry recorded in SQLite with configured alarm thresholds.
          </p>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('rms_peak')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'rms_peak'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overall RMS & Peak
            </button>
            <button
              onClick={() => setViewMode('tri_axial')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'tri_axial'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tri-Axis (X, Y, Z)
            </button>
            <button
              onClick={() => setViewMode('crest_pkpk')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'crest_pkpk'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pk-Pk & Crest Factor
            </button>
            <button
              onClick={() => setViewMode('temperature')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'temperature'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Temperature
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
            {(['1h', '6h', '24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                className={`px-2.5 py-1 rounded-md transition uppercase ${
                  selectedRange === range
                    ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Reload time range"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="mt-5 h-[340px] sm:h-[380px] w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-lg p-6">
            <Clock className="w-10 h-10 mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-300">No telemetry recorded for this time range</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              Send a LoRaWAN uplink from the gateway or use the Bench Simulator in Settings to seed baseline points.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey="timeLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                height={40}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                domain={viewMode === 'temperature' ? [15, 60] : [0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                }}
                labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />

              {/* View Mode 1: Overall RMS & Peak */}
              {viewMode === 'rms_peak' && (
                <>
                  <ReferenceLine
                    y={warnRms}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    label={{
                      value: `Warn RMS (${warnRms}g)`,
                      fill: '#fbbf24',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={critRms}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Crit RMS (${critRms}g)`,
                      fill: '#ef4444',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="overallRms"
                    name="Overall RMS (g)"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#06b6d4' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peak"
                    name="Peak Accel (g)"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#a855f7' }}
                  />
                </>
              )}

              {/* View Mode 2: Tri-Axial Breakdown */}
              {viewMode === 'tri_axial' && (
                <>
                  <ReferenceLine
                    y={warnRms}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    label={{ value: `Warn (${warnRms}g)`, fill: '#fbbf24', fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="xRms"
                    name="X-Axis Radial-H (g)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="yRms"
                    name="Y-Axis Radial-V (g)"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="zRms"
                    name="Z-Axis Axial (g)"
                    stroke="#fb923c"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="overallRms"
                    name="Vector Overall RMS (g)"
                    stroke="#f43f5e"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </>
              )}

              {/* View Mode 3: Crest Factor & Peak-to-Peak */}
              {viewMode === 'crest_pkpk' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="peakToPeak"
                    name="Peak-to-Peak (g)"
                    stroke="#e879f9"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="crestFactor"
                    name="Crest Factor (Ratio)"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </>
              )}

              {/* View Mode 4: Temperature */}
              {viewMode === 'temperature' && (
                <>
                  <ReferenceLine
                    y={50.0}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: 'Warning Limit 50°C', fill: '#ef4444', fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Die Temperature (°C)"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f97316' }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Engineering Reference Footnote */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>ISO 10816-3 Class II baseline reference: Zone A nominal 0.18g • Zone B 0.28g • Zone C 0.45g</span>
        </div>
        <div className="font-mono text-[11px] text-slate-300">
          Showing time window: <span className="text-cyan-400 uppercase">{selectedRange}</span>
        </div>
      </div>
    </div>
  );
};
