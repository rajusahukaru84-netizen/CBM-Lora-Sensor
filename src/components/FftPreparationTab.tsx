import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Cpu,
  Cloud,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Zap,
} from 'lucide-react';

export const FftPreparationTab: React.FC = () => {
  // Interactive DSP parameters
  const [samplingRate, setSamplingRate] = useState<number>(1024); // Fs in Hz
  const [sampleCount, setSampleCount] = useState<number>(512); // N points
  const [windowType, setWindowType] = useState<string>('Hanning');
  const [motorRpm, setMotorRpm] = useState<number>(1440); // 1440 RPM = 24 Hz

  // Computed DSP values
  const nyquistFreq = samplingRate / 2; // Fmax = Fs / 2
  const freqResolution = (samplingRate / sampleCount).toFixed(3); // delta_f = Fs / N
  const samplingDurationSec = (sampleCount / samplingRate).toFixed(3); // T = N / Fs
  const runningSpeedHz = (motorRpm / 60).toFixed(1); // 1X turning frequency

  // Simulated spectral peaks for 1440 RPM (24 Hz)
  const f1X = Number(runningSpeedHz);
  const f2X = f1X * 2;
  const f3X = f1X * 3;
  const bpfo = Number((f1X * 3.58).toFixed(1)); // Typical ball pass frequency outer ring

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2 pb-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-slate-100">Phase 8 &rarr; Phase 9: FFT Spectral Analysis Architecture</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          While time-domain metrics (RMS, Peak, Crest Factor) identify <em>that</em> an anomaly exists, frequency-domain 
          Fast Fourier Transform (FFT) analysis is required to identify <em>what</em> mechanical component is vibrating. 
          This architecture specification details signal acquisition, digital signal processing (DSP) parameters, 
          and the engineering trade-offs between ESP32 edge processing versus cloud processing over LoRaWAN IN865.
        </p>
      </div>

      {/* DSP Signal Acquisition Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="font-semibold text-xs text-slate-200">Interactive Signal Parameters</h4>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Sampling Frequency (Fs): <strong className="text-cyan-400">{samplingRate} Hz</strong>
            </label>
            <input
              type="range"
              min="512"
              max="2048"
              step="512"
              value={samplingRate}
              onChange={(e) => setSamplingRate(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>512 Hz</span>
              <span>1024 Hz (Standard)</span>
              <span>2048 Hz</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              FFT Buffer Size (N): <strong className="text-cyan-400">{sampleCount} samples</strong>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[256, 512, 1024].map((n) => (
                <button
                  key={n}
                  onClick={() => setSampleCount(n)}
                  className={`py-1 rounded text-xs font-mono transition border ${
                    sampleCount === n
                      ? 'bg-cyan-600 border-cyan-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">Windowing Function</label>
            <select
              value={windowType}
              onChange={(e) => setWindowType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="Hanning">Hanning (Recommended for general industrial machinery)</option>
              <option value="Flat Top">Flat Top (Accurate harmonic amplitudes)</option>
              <option value="Hamming">Hamming (Sharp side-lobe rolloff)</option>
              <option value="Rectangular">Rectangular / Uniform (No windowing - leakage warning)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Motor Speed: <strong className="text-cyan-400">{motorRpm} RPM</strong> ({runningSpeedHz} Hz)
            </label>
            <input
              type="range"
              min="900"
              max="3600"
              step="30"
              value={motorRpm}
              onChange={(e) => setMotorRpm(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Calculated Resolution & Characteristic Bins */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h4 className="font-semibold text-xs text-slate-200">Calculated Spectral Resolutions & Key Machine Frequencies</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Nyquist Criterion Fmax: {nyquistFreq} Hz</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">MAX FREQUENCY (Fmax)</div>
              <div className="text-lg font-bold text-slate-100 mt-1">{nyquistFreq} Hz</div>
              <div className="text-[10px] text-slate-500">Fs / 2</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">BIN RESOLUTION (Δf)</div>
              <div className="text-lg font-bold text-cyan-400 mt-1">{freqResolution} Hz</div>
              <div className="text-[10px] text-slate-500">Fs / N per bin</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">SAMPLE DURATION</div>
              <div className="text-lg font-bold text-slate-100 mt-1">{samplingDurationSec} s</div>
              <div className="text-[10px] text-slate-500">Time to acquire buffer</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">SPECTRAL BINS</div>
              <div className="text-lg font-bold text-slate-100 mt-1">{sampleCount / 2}</div>
              <div className="text-[10px] text-slate-500">Real output bins</div>
            </div>
          </div>

          {/* Interactive Simulated Spectrum Preview */}
          <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span>Simulated Narrowband Spectrum Preview (0 to {nyquistFreq} Hz)</span>
              <span>Hanning Window Applied</span>
            </div>

            {/* Visual Bar Spectrum */}
            <div className="h-32 w-full flex items-end gap-1 pt-4 pb-1 border-b border-slate-800 relative">
              {/* Reference Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-b border-slate-400 w-full" />
                <div className="border-b border-slate-400 w-full" />
                <div className="border-b border-slate-400 w-full" />
              </div>

              {/* 1X Peak Marker */}
              <div
                className="absolute flex flex-col items-center"
                style={{ left: `${Math.min(90, (f1X / nyquistFreq) * 100)}%`, bottom: '0%' }}
              >
                <span className="text-[9px] font-mono text-cyan-400 font-bold mb-1">1X ({f1X}Hz)</span>
                <div className="w-2.5 bg-cyan-400 rounded-t h-24" />
              </div>

              {/* 2X Peak Marker */}
              <div
                className="absolute flex flex-col items-center"
                style={{ left: `${Math.min(90, (f2X / nyquistFreq) * 100)}%`, bottom: '0%' }}
              >
                <span className="text-[9px] font-mono text-amber-400 font-bold mb-1">2X ({f2X}Hz)</span>
                <div className="w-2.5 bg-amber-400 rounded-t h-14" />
              </div>

              {/* 3X Peak Marker */}
              <div
                className="absolute flex flex-col items-center"
                style={{ left: `${Math.min(90, (f3X / nyquistFreq) * 100)}%`, bottom: '0%' }}
              >
                <span className="text-[9px] font-mono text-slate-400 font-bold mb-1">3X ({f3X}Hz)</span>
                <div className="w-2 bg-slate-500 rounded-t h-8" />
              </div>

              {/* Bearing BPFO Marker */}
              <div
                className="absolute flex flex-col items-center"
                style={{ left: `${Math.min(90, (bpfo / nyquistFreq) * 100)}%`, bottom: '0%' }}
              >
                <span className="text-[9px] font-mono text-rose-400 font-bold mb-1">BPFO ({bpfo}Hz)</span>
                <div className="w-2 bg-rose-500 rounded-t h-12" />
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
              <span>0 Hz (DC)</span>
              <span>100 Hz</span>
              <span>200 Hz</span>
              <span>300 Hz</span>
              <span>400 Hz</span>
              <span>{nyquistFreq} Hz (Fmax)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edge vs Cloud Processing Trade-Off Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
          <Radio className="w-4 h-4 text-cyan-400" />
          Architectural Trade-Off: Processing on ESP32 Edge vs Cloud / Backend
        </h3>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-sans">Evaluation Dimension</th>
                <th className="p-3 text-cyan-300 font-sans">Edge Processing (ESP32 On-Device FFT)</th>
                <th className="p-3 text-purple-300 font-sans">Cloud Processing (Stream Raw Samples)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">LoRaWAN Payload Size</td>
                <td className="p-3 text-emerald-400 font-bold">
                  8 to 16 Bytes (Top 4 spectral peak frequencies & amplitudes)
                </td>
                <td className="p-3 text-rose-400 font-bold">
                  2,048 to 4,096 Bytes (512–1024 float points)
                </td>
              </tr>

              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">LoRaWAN Bandwidth & Airtime</td>
                <td className="p-3 text-emerald-400">
                  Complies with IN865 1% duty cycle regulations (&lt;50 ms airtime)
                </td>
                <td className="p-3 text-rose-400">
                  Violates LoRaWAN airtime laws; requires multi-packet fragmentation
                </td>
              </tr>

              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">ESP32 RAM Usage</td>
                <td className="p-3 text-slate-300">
                  ~8 KB RAM for 512-point float buffer (ESP32 has 520 KB SRAM available)
                </td>
                <td className="p-3 text-emerald-400">
                  Minimal edge RAM (stream directly from DMA FIFO)
                </td>
              </tr>

              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">Computation Time</td>
                <td className="p-3 text-slate-300">
                  ~3.2 ms using ESP32 dual-core Xtensa DSP hardware instructions
                </td>
                <td className="p-3 text-emerald-400">
                  Near-instant on cloud server (sub-millisecond Node.js/C++ library)
                </td>
              </tr>

              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">Power Consumption</td>
                <td className="p-3 text-slate-300">
                  ~15 mA for 3.2 ms (negligible impact on battery life)
                </td>
                <td className="p-3 text-rose-400">
                  Massive battery drain keeping SX1262 LoRa transmitter alive for seconds
                </td>
              </tr>

              <tr>
                <td className="p-3 font-sans font-medium text-slate-200">Diagnostic Flexibility</td>
                <td className="p-3 text-amber-400">
                  Pre-determined spectral bins (fixed feature extraction)
                </td>
                <td className="p-3 text-emerald-400">
                  Full raw waveform available in cloud for arbitrary re-analysis
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recommended Architecture Decision */}
        <div className="p-4 rounded-lg bg-cyan-950/30 border border-cyan-800/60 text-xs text-cyan-200/90 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-cyan-300">Recommended Engineering Architecture: Edge-Extracted Feature Hybrid</strong>
            <p className="mt-1">
              Due to strict LoRaWAN IN865 duty-cycle constraints and limited bandwidth (data rates DR0–DR5 yield maximum 
              application payloads of 51 to 222 bytes per frame), streaming raw high-speed vibration buffers over LoRaWAN 
              is physically impractical and legally prohibited in industrial bands.
            </p>
            <p className="mt-1 font-semibold text-slate-200">
              The recommended production solution is:
            </p>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-300">
              <li>ESP32 samples MPU6050 FIFO buffer at 1024 Hz, applies a Hanning window, and runs an in-memory 512-point Radix-2 FFT via ESP-DSP.</li>
              <li>ESP32 extracts the top 4 spectral peaks (1X running speed, 2X harmonic, 3X, and maximum high-frequency spike) and packs them into an 8-byte payload.</li>
              <li>The compact 8-byte feature vector is transmitted via LoRaWAN every 30–60 seconds, perfectly adhering to regulatory airtime limits.</li>
              <li>Full high-density raw buffers can be stored in local ESP32 SPI flash or offloaded via local Bluetooth / Wi-Fi during manual diagnostic inspections.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
