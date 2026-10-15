import React from 'react';
import { Motor, Device, Measurement } from '../types';
import {
  Activity,
  Cpu,
  Radio,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Thermometer,
  Disc,
} from 'lucide-react';
import { MetricCard } from './MetricCard';

interface MotorDetailsTabProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
}

export const MotorDetailsTab: React.FC<MotorDetailsTabProps> = ({
  motor,
  device,
  latest,
}) => {
  const isOnline = device?.status === 'ONLINE';
  const sensorOk = latest?.sensor_status === 'OK';
  const warnRms = motor?.warning_rms ?? 0.280;
  const critRms = motor?.critical_rms ?? 0.450;
  const warnPeak = motor?.warning_peak ?? 0.600;
  const critPeak = motor?.critical_peak ?? 1.000;

  // Triaxial values
  const xRms = latest?.x_rms ?? (latest ? Number((latest.overall_rms * 0.72).toFixed(3)) : null);
  const yRms = latest?.y_rms ?? (latest ? Number((latest.overall_rms * 0.62).toFixed(3)) : null);
  const zRms = latest?.z_rms ?? (latest ? Number((latest.overall_rms * 0.31).toFixed(3)) : null);

  const lastUpdateStr = latest?.recorded_at
    ? new Date(latest.recorded_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Waiting for first packet';

  return (
    <div id="motor-details-view" className="space-y-6">
      {/* Machinery Physical Specs Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
              ASSET PROFILE & DIAGNOSTICS
            </span>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">
              {motor?.tag_name || 'Cooling Tower Feed Pump Motor 01'}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
              TAG: {motor?.motor_id || 'MOTOR_01'}
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
              CLASS: ISO 10816-3 II
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Motor Location:</span>
            <span className="text-slate-200 font-semibold mt-0.5 block">{motor?.location || 'Drive-End Bay #3'}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Rated Power / Speed:</span>
            <span className="text-slate-200 font-semibold mt-0.5 block">{motor?.rated_power_kw || 11} kW @ {motor?.rated_rpm || 1440} RPM</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">1X Turning Frequency:</span>
            <span className="text-slate-200 font-semibold mt-0.5 block">{((motor?.rated_rpm || 1440) / 60).toFixed(1)} Hz (Rotational)</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Mounting Type:</span>
            <span className="text-slate-200 font-semibold mt-0.5 block">Rigid Structural Bay</span>
          </div>
        </div>
      </div>

      {/* Tri-Axial Decomposition & Vector Physics */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Tri-Axial Dynamic Decomposition (X, Y, Z Axes)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            id="metric-x-axis"
            title="X-Axis (Radial Horizontal)"
            value={xRms}
            unit="g RMS"
            warningLimit={Number((warnRms * 0.72).toFixed(2))}
            criticalLimit={Number((critRms * 0.72).toFixed(2))}
            description="Radial horizontal plane unbalance & base looseness"
            status={latest?.health_status || 'NORMAL'}
            icon={<Disc className="w-4 h-4 text-cyan-400" />}
          />

          <MetricCard
            id="metric-y-axis"
            title="Y-Axis (Radial Vertical)"
            value={yRms}
            unit="g RMS"
            warningLimit={Number((warnRms * 0.62).toFixed(2))}
            criticalLimit={Number((critRms * 0.62).toFixed(2))}
            description="Radial vertical plane dynamic stiffness & footing"
            status={latest?.health_status || 'NORMAL'}
            icon={<Disc className="w-4 h-4 text-emerald-400" />}
          />

          <MetricCard
            id="metric-z-axis"
            title="Z-Axis (Axial Thrust)"
            value={zRms}
            unit="g RMS"
            warningLimit={Number((warnRms * 0.31).toFixed(2))}
            criticalLimit={Number((critRms * 0.31).toFixed(2))}
            description="Axial shaft alignment & bearing thrust preload"
            status={latest?.health_status || 'NORMAL'}
            icon={<Disc className="w-4 h-4 text-amber-400" />}
          />
        </div>
      </div>

      {/* Primary Kinematic Vibration Indicators */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Kinematic Vibration & Bearing Stress Metrics
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            id="metric-details-rms"
            title="Overall Vector RMS"
            value={latest?.overall_rms}
            unit="g"
            warningLimit={warnRms}
            criticalLimit={critRms}
            description="ISO 10816 velocity energy equivalent"
            status={latest?.health_status || 'NORMAL'}
          />

          <MetricCard
            id="metric-details-peak"
            title="Peak Acceleration"
            value={latest?.peak}
            unit="g"
            warningLimit={warnPeak}
            criticalLimit={critPeak}
            description="Impulsive shock from bearing raceway defects"
            status={latest?.health_status || 'NORMAL'}
          />

          <MetricCard
            id="metric-details-pkpk"
            title="Peak-to-Peak Vibration"
            value={latest?.peak_to_peak}
            unit="g"
            description="Total dynamic peak excursion range"
            status={latest?.health_status || 'NORMAL'}
          />

          <MetricCard
            id="metric-details-crest"
            title="Crest Factor"
            value={latest?.crest_factor}
            unit="Ratio"
            description="Peak/RMS ratio (Nominal: 1.5 - 2.5)"
            status={
              latest?.crest_factor && latest.crest_factor > 3.5
                ? 'WARNING'
                : 'NORMAL'
            }
          />
        </div>
      </div>

      {/* Edge Node & Sensor Status Diagnostics */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          Sensor & Edge Communication Telemetry
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">Sensor Status Flag</span>
              <span className={`text-sm font-bold mt-1 inline-flex items-center gap-1 ${sensorOk ? 'text-emerald-400' : 'text-red-400'}`}>
                {sensorOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {sensorOk ? 'OK (0x01)' : 'ERROR (0x00)'}
              </span>
            </div>
            <Cpu className="w-5 h-5 text-slate-600" />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">ESP32 Node Heartbeat</span>
              <span className={`text-sm font-bold mt-1 inline-flex items-center gap-1 ${isOnline ? 'text-emerald-400' : 'text-rose-500'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <Radio className="w-5 h-5 text-slate-600" />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">Bearing Temperature</span>
              <span className="text-sm font-bold text-slate-100 mt-1 inline-flex items-center gap-1">
                <Thermometer className="w-4 h-4 text-orange-400" />
                {latest?.temperature ? `${latest.temperature.toFixed(1)} °C` : '—'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-2">Die Temp</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">Last Received Packet</span>
              <span className="text-xs font-semibold text-slate-200 mt-1 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {lastUpdateStr}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-2">Seq: {latest?.sequence ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
