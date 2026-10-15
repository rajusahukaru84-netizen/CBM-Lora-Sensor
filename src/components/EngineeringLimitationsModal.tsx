import React from 'react';
import {
  X,
  AlertTriangle,
  Cpu,
  Layers,
  Radio,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface EngineeringLimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineeringLimitationsModal: React.FC<EngineeringLimitationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Phase 8 CBM Engineering Limitations & Scientific Boundaries
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Technical documentation of sensor physics, communication constraints, and diagnostic limits.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-5 text-xs text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
          {/* Section 1 */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <Cpu className="w-4 h-4 text-cyan-400" />
              1. MPU6050 Consumer MEMS vs Industrial Accelerometer Physics
            </div>
            <p>
              The MPU6050 is a consumer-grade 6-axis MEMS sensor designed primarily for mobile orientation and motion detection,
              not precision industrial machinery diagnostics. Its bandwidth is capped at approximately <strong>1,000 Hz</strong> (DLPF configured),
              its noise density is relatively high (<strong>~400 µg/√Hz</strong>), and it exhibits noticeable thermal drift over operating temperature swings.
              Unlike industrial piezoelectric ICP/IEPE accelerometers (which feature linear response up to 10 kHz–20 kHz and rigid stainless-steel enclosures),
              the MPU6050 cannot detect high-frequency stress waves (ultrasonic impacts) generated during early-stage bearing pitting (Stages 1 and 2).
            </p>
          </div>

          {/* Section 2 */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <Layers className="w-4 h-4 text-cyan-400" />
              2. Sensor Mounting Physics & Mechanical Resonance
            </div>
            <p>
              Vibration transmission is profoundly governed by mechanical coupling:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li><strong>Stud Mounting (Threaded Bolt):</strong> Transmits up to 10–12 kHz without resonance distortion.</li>
              <li><strong>Two-Pole Magnetic Base:</strong> Useful up to ~2–3 kHz; dampens higher frequencies.</li>
              <li><strong>Adhesive Tape / Double-Sided Foam:</strong> Introduces heavy viscoelastic dampening above 400–600 Hz and adds resonant peaking in lower bands.</li>
            </ul>
            <p className="pt-1">
              Any prototype mounted with adhesive or light brackets will measure mounting resonance rather than true motor bearing kinematics if not rigidly coupled.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <Sliders className="w-4 h-4 text-cyan-400" />
              3. Sampling Frequency & The Nyquist-Shannon Theorem
            </div>
            <p>
              Per Nyquist-Shannon, the maximum observable frequency is strictly <strong>Fmax = Fs / 2</strong>.
              At a sample rate of 1000 Hz, the upper limit is 500 Hz. For a motor running at 1440 RPM (24 Hz), this captures up to the 20th shaft harmonic.
              However, anti-aliasing filtering must be strictly enforced: any high-frequency impact pulse above 500 Hz will fold back into the baseband spectrum
              as false low-frequency energy (aliasing) unless eliminated by an analog or hardware low-pass filter prior to ADC sampling.
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <Radio className="w-4 h-4 text-cyan-400" />
              4. LoRaWAN IN865 Bandwidth & Duty Cycle Realities
            </div>
            <p>
              LoRaWAN is fundamentally an Ultra-Low-Power, Low-Throughput Wide Area Network designed for compact telemetry (typically 10–50 bytes per transmission).
              In the Indian IN865 band, local spectrum regulations restrict transmissions to a 1% duty cycle. Continuous streaming of raw 1024-point vibration waveforms
              (4,096 bytes) is prohibited and technically impossible over long distances.
              Hence, <strong>Edge Feature Extraction</strong> (computing RMS, Peak, Crest Factor, and spectral peaks on the ESP32) is an absolute physical necessity.
            </p>
          </div>

          {/* Section 5 */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              5. Prototype Health Score & Condition Heuristics
            </div>
            <p>
              The <strong>&quot;Prototype CBM Health Score (0–100)&quot;</strong> displayed in this system is an algorithmic composite derived from statistical baseline
              deviation, peak shock envelope, and crest factor. It is <strong>NOT</strong> an official ISO 10816-3 or ISO 20816-1 severity metric.
              Indications such as &quot;Possible Misalignment&quot; or &quot;Possible Imbalance&quot; are heuristic flags based on kinematic amplitude ratios.
              Accurate fault diagnosis demands full spectral FFT analysis, envelope demodulation, exact bearing geometry (pitch diameter, number of balls, contact angle),
              instantaneous shaft speed (encoder/tachometer), and confirmation by a certified ISO 18436 Category II/III Vibration Analyst.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-[11px] font-mono text-slate-500">
            System Standard: ISO 10816 Baseline Concept Reference
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
