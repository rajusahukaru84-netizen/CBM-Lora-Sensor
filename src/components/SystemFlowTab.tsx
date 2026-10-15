import React, { useState } from 'react';
import { Motor, Device, Measurement } from '../types';
import {
  Layers,
  Cpu,
  Radio,
  Router,
  Cloud,
  ArrowRight,
  Code2,
  FileCheck,
  CheckCircle2,
  Activity,
  Zap,
} from 'lucide-react';
import { MotorVisualization } from './MotorVisualization';

interface SystemFlowTabProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
}

export const SystemFlowTab: React.FC<SystemFlowTabProps> = ({
  motor,
  device,
  latest,
}) => {
  const [testHex, setTestHex] = useState(latest?.raw_payload_hex || '012A00B90154020000B8011C01');

  // Parse 13 bytes live
  const parseHex = (hex: string) => {
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length < 26) return null;

    try {
      const motorId = parseInt(clean.slice(0, 2), 16);
      const seq = parseInt(clean.slice(2, 4), 16);
      const rms = parseInt(clean.slice(4, 8), 16) / 1000.0;
      const peak = parseInt(clean.slice(8, 12), 16) / 1000.0;
      const pkpk = parseInt(clean.slice(12, 16), 16) / 1000.0;
      const crest = parseInt(clean.slice(16, 20), 16) / 100.0;
      const temp = parseInt(clean.slice(20, 24), 16) / 10.0;
      const status = parseInt(clean.slice(24, 26), 16);

      return { motorId, seq, rms, peak, pkpk, crest, temp, status };
    } catch (e) {
      return null;
    }
  };

  const decoded = parseHex(testHex);

  return (
    <div id="system-flow-view" className="space-y-6">
      {/* End-to-End Pipeline Visualization */}
      <MotorVisualization motor={motor} device={device} latest={latest} />

      {/* Deep-Dive Stage-by-Stage Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Stage 1 & 2: Mechanical to Sensing */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Edge Hardware & Signal Conditioning
            </h3>
          </div>

          <div className="space-y-3 text-xs text-slate-300 font-mono">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-cyan-400 font-bold block mb-1">1. MPU6050 Accelerometer Installation</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Firmly stud-mounted to the drive-end bearing housing. Configured via I2C at 400kHz fast-mode, ±4g measurement range (sensitivity 8192 LSB/g).
                High-frequency noise is attenuated via on-chip Digital Low-Pass Filter (DLPF) set to 260 Hz bandwidth.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-cyan-400 font-bold block mb-1">2. ESP32 Sampling & Discrete DSP</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                FreeRTOS hardware timer gathers 512 acceleration samples per axis at exactly 500 Hz (1.024s epoch window).
                Gravity/DC bias is removed using a moving average subtractor:
                <code className="text-cyan-300 block mt-1">a_dyn[i] = a_raw[i] - mean(a_raw)</code>
                RMS, Peak, Peak-to-Peak, and Crest Factor are computed efficiently with hardware floating-point operations.
              </p>
            </div>
          </div>
        </div>

        {/* Stage 3 & 4: LoRaWAN & Cloud Gateway */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Radio className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              RF Propagation & Gateway Forwarding
            </h3>
          </div>

          <div className="space-y-3 text-xs text-slate-300 font-mono">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold block mb-1">3. SX1262 LoRaWAN IN865 Uplink</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Operates on India IN865 band (865.0625 - 867.0000 MHz) with Spreading Factor SF9 / BW 125kHz.
                Data is encoded into a compact 13-byte binary struct (endianness: big-endian) to minimize RF airtime to &lt; 85ms and maximize battery longevity.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold block mb-1">4. RAK7268V2 Gateway & Cloud SCADA</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                The WisGate industrial gateway demodulates packets and forwards the JSON payload with RSSI/SNR metadata
                to our Express backend webhook at <code className="text-emerald-400">/api/uplink</code>.
                The server validates CRC, checks thresholds, logs to SQLite, and pushes to this dashboard over WebSockets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 13-Byte Binary Payload Decoder */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              13-Byte Packed Binary Struct Decoder
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Exact wire specification</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Raw Payload Hex String (Paste or Edit):
            </label>
            <input
              type="text"
              value={testHex}
              onChange={(e) => setTestHex(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {decoded ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950">
                  <tr>
                    <th className="py-2.5 px-3">Offset</th>
                    <th className="py-2.5 px-3">Field</th>
                    <th className="py-2.5 px-3">Type / Scale</th>
                    <th className="py-2.5 px-3">Raw Hex</th>
                    <th className="py-2.5 px-3">Engineering Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Byte 0</td>
                    <td className="py-2 px-3 font-semibold">Motor / Device ID</td>
                    <td className="py-2 px-3 text-slate-500">uint8</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(0, 2)}</td>
                    <td className="py-2 px-3 text-white font-bold">MOTOR_{decoded.motorId.toString().padStart(2, '0')}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Byte 1</td>
                    <td className="py-2 px-3 font-semibold">Sequence Number</td>
                    <td className="py-2 px-3 text-slate-500">uint8</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(2, 4)}</td>
                    <td className="py-2 px-3 text-white font-bold">{decoded.seq}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Bytes 2-3</td>
                    <td className="py-2 px-3 font-semibold">Overall RMS Acceleration</td>
                    <td className="py-2 px-3 text-slate-500">uint16 (x1000)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(4, 8)}</td>
                    <td className="py-2 px-3 text-cyan-300 font-bold">{decoded.rms.toFixed(3)} g</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Bytes 4-5</td>
                    <td className="py-2 px-3 font-semibold">Peak Acceleration</td>
                    <td className="py-2 px-3 text-slate-500">uint16 (x1000)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(8, 12)}</td>
                    <td className="py-2 px-3 text-purple-300 font-bold">{decoded.peak.toFixed(3)} g</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Bytes 6-7</td>
                    <td className="py-2 px-3 font-semibold">Peak-to-Peak Excursion</td>
                    <td className="py-2 px-3 text-slate-500">uint16 (x1000)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(12, 16)}</td>
                    <td className="py-2 px-3 text-white font-bold">{decoded.pkpk.toFixed(3)} g</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Bytes 8-9</td>
                    <td className="py-2 px-3 font-semibold">Crest Factor</td>
                    <td className="py-2 px-3 text-slate-500">uint16 (x100)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(16, 20)}</td>
                    <td className="py-2 px-3 text-amber-300 font-bold">{decoded.crest.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Bytes 10-11</td>
                    <td className="py-2 px-3 font-semibold">Sensor Die Temp</td>
                    <td className="py-2 px-3 text-slate-500">int16 (x10)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(20, 24)}</td>
                    <td className="py-2 px-3 text-orange-300 font-bold">{decoded.temp.toFixed(1)} °C</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400">Byte 12</td>
                    <td className="py-2 px-3 font-semibold">Sensor Hardware Status</td>
                    <td className="py-2 px-3 text-slate-500">uint8 (0x01=OK)</td>
                    <td className="py-2 px-3 text-slate-400">{testHex.slice(24, 26)}</td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${decoded.status === 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {decoded.status === 1 ? 'OK (0x01)' : 'ERROR (0x00)'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono">
              Invalid hex string. Must be at least 26 hex characters (13 bytes).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
