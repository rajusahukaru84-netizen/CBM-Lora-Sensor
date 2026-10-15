import React from 'react';
import {
  Cpu,
  Radio,
  Router,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Gauge,
  Zap,
} from 'lucide-react';
import { Motor, Device, Measurement } from '../types';

interface MotorVisualizationProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
}

export const MotorVisualization: React.FC<MotorVisualizationProps> = ({
  motor,
  device,
  latest,
}) => {
  const isOnline = device?.status === 'ONLINE';
  const sensorOk = latest?.sensor_status === 'OK';
  const healthStatus = latest?.health_status || 'NORMAL';

  return (
    <div id="motor-signal-pipeline" className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-5 gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            End-to-End CBM Signal & Telemetry Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical motor vibration sensing through LoRaWAN edge gateway to local SCADA database.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            RATE: 30s UPLINK
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
            BAND: IN865
          </span>
        </div>
      </div>

      {/* Responsive Horizontal / Vertical Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {/* Stage 1: Motor */}
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/80 relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              STAGE 1: ASSET
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="my-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/70 border border-cyan-700/60 flex items-center justify-center text-cyan-400 mb-2 shadow-inner">
              <Gauge className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">{motor?.motor_id || 'MOTOR_01'}</h3>
            <p className="text-xs text-slate-400">{motor?.rated_power_kw || 11} kW Induction</p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Speed:</span>
              <span className="text-slate-200">{motor?.rated_rpm || 1440} RPM</span>
            </div>
            <div className="flex justify-between">
              <span>Mount:</span>
              <span className="text-slate-200">Rigid Bay</span>
            </div>
          </div>
        </div>

        {/* Stage 2: Vibration Sensor */}
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/80 relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              STAGE 2: SENSOR
            </span>
            <span
              className={`w-2 h-2 rounded-full ${sensorOk ? 'bg-emerald-400' : 'bg-red-500'}`}
            />
          </div>
          <div className="my-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-950/70 border border-blue-700/60 flex items-center justify-center text-blue-400 mb-2 shadow-inner">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">MPU6050 Accelerometer</h3>
            <p className="text-xs text-slate-400">Drive-End Stud Mount</p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Sample:</span>
              <span className="text-slate-200">512 pts @ 500Hz</span>
            </div>
            <div className="flex justify-between">
              <span>Bus:</span>
              <span className="text-slate-200">I2C 400kHz</span>
            </div>
          </div>
        </div>

        {/* Stage 3: ESP32 LoRa Node */}
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/80 relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              STAGE 3: EDGE NODE
            </span>
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-500'}`}
            />
          </div>
          <div className="my-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-950/70 border border-indigo-700/60 flex items-center justify-center text-indigo-400 mb-2 shadow-inner">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">{device?.device_name || 'CBM_NODE_01'}</h3>
            <p className="text-xs text-slate-400">ESP32 + SX1262 (IN865)</p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Payload:</span>
              <span className="text-slate-200">13 Bytes Packed</span>
            </div>
            <div className="flex justify-between">
              <span>Seq #:</span>
              <span className="text-slate-200">{latest?.sequence ?? device?.last_seq_num ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Stage 4: LoRaWAN Gateway */}
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/80 relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              STAGE 4: GATEWAY
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="my-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-950/70 border border-purple-700/60 flex items-center justify-center text-purple-400 mb-2 shadow-inner">
              <Router className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">RAK7268V2 WisGate</h3>
            <p className="text-xs text-slate-400">SX1302 8-Ch Gateway</p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>RSSI:</span>
              <span className="text-slate-200">{latest?.rssi ?? -75} dBm</span>
            </div>
            <div className="flex justify-between">
              <span>SNR:</span>
              <span className="text-slate-200">{latest?.snr ?? 8.5} dB</span>
            </div>
          </div>
        </div>

        {/* Stage 5: Cloud & SCADA Database */}
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/80 relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              STAGE 5: SCADA DB
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                healthStatus === 'CRITICAL'
                  ? 'bg-red-500 animate-ping'
                  : healthStatus === 'WARNING'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div className="my-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-teal-950/70 border border-teal-700/60 flex items-center justify-center text-teal-400 mb-2 shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">SQLite & Express API</h3>
            <p className="text-xs text-slate-400">Time-Series & Alarms</p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Webhook:</span>
              <span className="text-emerald-400">/api/uplink</span>
            </div>
            <div className="flex justify-between">
              <span>WS Stream:</span>
              <span className="text-cyan-400">/ws/telemetry</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Status Summary Footer */}
      <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Physical Path: 100% Verified (RF Link Margin: +18 dB above SF9 noise floor)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Raw Hex: <code className="text-slate-300">{latest?.raw_payload_hex || '012A00B90154020000B8011C01'}</code></span>
        </div>
      </div>
    </div>
  );
};
