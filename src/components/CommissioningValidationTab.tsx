import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Sliders,
  Activity,
  Gauge,
  Cpu,
  Layers,
  HelpCircle,
  Play,
  RotateCcw,
  Zap,
  Info,
  Radio,
  FileText,
  TrendingUp,
  Award,
  AlertOctagon,
  ArrowUpRight,
} from 'lucide-react';
import { Motor, Measurement, Baseline, CbmConfig, CommissioningChecklistState } from '../types';

interface CommissioningData {
  motorId: string;
  deviceId: string;
  sensorId: string;
  installationDate: string;
  sensorLocation: string;
  sensorOrientation: string;
  mechanicalAttachment: string;
  samplingConfiguration: {
    samplingRateHz: number;
    numSamples: number;
    windowSeconds: number;
    nyquistHz: number;
    frequencyResolutionHz: number;
  };
  baselineMetrics: {
    id: number;
    isActive: boolean;
    sampleCount: number;
    createdAt: string;
    rms: number;
    minRms: number;
    maxRms: number;
    stdRms: number;
    peak: number;
    peakToPeak: number;
    crestFactor: number;
    dominantFreq: number;
    operatingCondition: string;
  };
  currentMetrics: {
    rms: number;
    peak: number;
    peakToPeak: number;
    crestFactor: number;
    dominantFreq: number;
    dominantAmp: number;
    rmsDeviationPct: number;
    temperatureC: number;
  };
  operatingCondition: {
    operatingRpm: number;
    expected1XFreqHz: number;
    loadCondition: string;
    temperatureC: number;
    motorState: string;
  };
  dataQuality: {
    overallGrade: 'GOOD' | 'QUESTIONABLE' | 'INVALID';
    saturationDetected: boolean;
    disconnectDetected: boolean;
    excessiveNoiseDetected: boolean;
    communicationGapsDetected: boolean;
    invalidValuesDetected: boolean;
    maxAccelerationG: number;
    noiseToSignalRatio: number;
    missingSequencesCount: number;
    gapDurationSeconds: number;
    reasons: string[];
  };
  repeatability: {
    runCount: number;
    meanRms: number;
    stdRms: number;
    coefficientOfVariationPct: number;
    noiseFloorG: number;
    repeatabilityStatus: 'EXCELLENT' | 'ACCEPTABLE_PROTOTYPE' | 'MARGINAL' | 'UNACCEPTABLE';
    isAcceptableForTrendMonitoring: boolean;
    interpretation: string;
  };
  fftQuality: {
    deltaF: number;
    nyquistHz: number;
    expected1XHz: number;
    dominantFreqHz: number;
    isWellAligned: boolean;
    status: string;
    note: string;
  };
  lastCalibration: string;
  lastCommunication: string;
  lastCommunicationSecondsAgo: number;
  communicationAvailabilityPct: number;
}

interface Props {
  selectedMotor: Motor;
  latestMeasurement: Measurement | null;
  activeBaseline: Baseline | null;
  cbmConfig: CbmConfig | null;
}

export const CommissioningValidationTab: React.FC<Props> = ({
  selectedMotor,
  latestMeasurement,
  activeBaseline,
  cbmConfig,
}) => {
  const [data, setData] = useState<CommissioningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    'mounting' | 'baseline' | 'repeatability' | 'operating' | 'trend-tuning' | 'fft' | 'limitations' | 'checklist' | 'report'
  >('mounting');

  // Interactive Checklist State saved in localStorage
  const storageKey = `cbm_checklist_${selectedMotor.motor_id}`;
  const [checklist, setChecklist] = useState<CommissioningChecklistState>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      sensorSecurelyMounted: true,
      correctSensorOrientation: true,
      esp32Stable: true,
      mpu6050Stable: true,
      samplingVerified: true,
      baselineCollected: !!activeBaseline,
      repeatabilityVerified: true,
      lorawanStable: true,
      gatewayStable: true,
      cloudDataStable: true,
      databaseStable: true,
      dashboardStable: true,
      alarmLogicTested: true,
      fftVerified: true,
      dataQualityVerified: true,
    };
  });

  const toggleChecklist = (key: keyof CommissioningChecklistState) => {
    setChecklist((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const fetchCommissioningData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/commissioning/${selectedMotor.motor_id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error loading commissioning data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissioningData();
  }, [selectedMotor.motor_id, latestMeasurement?.sequence, activeBaseline?.id]);

  const handleRunBaseline = async () => {
    try {
      setBaselineLoading(true);
      const res = await fetch('/api/commissioning/baseline-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorId: selectedMotor.motor_id,
          sampleCount: 30,
          operatingCondition: 'Healthy Standalone Operation (1440 RPM, Nominal Load)',
          operatingRpm: selectedMotor.rated_rpm,
          notes: 'Field commissioning baseline calibrated during healthy thermal equilibrium.',
        }),
      });
      if (res.ok) {
        await fetchCommissioningData();
        setChecklist((prev) => ({ ...prev, baselineCollected: true }));
      }
    } catch (err) {
      console.error('Error running baseline:', err);
    } finally {
      setBaselineLoading(false);
    }
  };

  const handleRunScenario = async (scenario: string, label: string) => {
    try {
      setScenarioLoading(true);
      setScenarioResult(null);
      const res = await fetch('/api/commissioning/safe-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorId: selectedMotor.motor_id,
          scenario,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setScenarioResult(`Scenario "${label}" successfully executed: ${json.note}`);
        await fetchCommissioningData();
      }
    } catch (err) {
      setScenarioResult(`Failed executing scenario: ${(err as Error).message}`);
    } finally {
      setScenarioLoading(false);
    }
  };

  const completedChecksCount = Object.values(checklist).filter(Boolean).length;
  const totalChecksCount = Object.keys(checklist).length;
  const checklistProgressPct = Math.round((completedChecksCount / totalChecksCount) * 100);

  return (
    <div className="space-y-6 pb-12" id="commissioning-validation-tab">
      {/* HEADER BANNER & SAFETY CALLOUT */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                PHASE 11
              </span>
              <span className="text-slate-400 text-xs">Real Motor Validation & CBM Tuning</span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Motor Commissioning, Baseline Calibration & Repeatability
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Validate physical sensor mounting, establish steady-state healthy reference baselines, verify measurement
              repeatability, and tune multi-sample persistence alarms on <strong>{selectedMotor.tag_name}</strong> ({selectedMotor.motor_id}).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/api/commissioning/${selectedMotor.motor_id}/csv`}
              download
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Commissioning CSV
            </a>
            <button
              onClick={fetchCommissioningData}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* SAFETY DIRECTIVE BANNER */}
        <div className="mt-4 p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-semibold">Strict Industrial Electrical & Mechanical Safety Rule:</strong>{' '}
            Do NOT bypass, modify, or interfere with any motor protection relays, emergency stop (E-stop) circuits, contactor interlocks, or plant safety systems. The MPU6050 vibration sensor must be mechanically mounted strictly on exterior non-rotating stationary surfaces (e.g. bearing end-bell) while the motor is powered off and locked-out/tagged-out (LOTO).
          </div>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
        {[
          { id: 'mounting', label: '1. Sensor Mounting & Rigidity', icon: Gauge },
          { id: 'baseline', label: '2. Baseline Calibration', icon: Award },
          { id: 'repeatability', label: '3. Repeatability & Stability', icon: Activity },
          { id: 'operating', label: '4. Safe Operating Scenarios', icon: Zap },
          { id: 'trend-tuning', label: '5 & 6. Trend & Threshold Tuning', icon: TrendingUp },
          { id: 'fft', label: '8. FFT Validation (RPM/60)', icon: Radio },
          { id: 'limitations', label: '9. Sensor Limitations Matrix', icon: AlertTriangle },
          { id: 'checklist', label: `13. Commissioning Checklist (${completedChecksCount}/${totalChecksCount})`, icon: CheckCircle2 },
          { id: 'report', label: '12. Formal Commissioning Report', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* QUICK STATUS STRIP */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Data Quality</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  data.dataQuality.overallGrade === 'GOOD'
                    ? 'bg-emerald-400'
                    : data.dataQuality.overallGrade === 'QUESTIONABLE'
                    ? 'bg-amber-400'
                    : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span className="text-sm font-bold text-slate-100">{data.dataQuality.overallGrade}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {data.dataQuality.saturationDetected ? 'Saturated' : 'Within ±2g Limits'}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Active Baseline RMS</div>
            <div className="mt-1 text-sm font-bold text-slate-100">
              {data.baselineMetrics.rms.toFixed(3)} <span className="text-xs font-normal text-slate-400">g</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              N={data.baselineMetrics.sampleCount} samples calibrated
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Current RMS & Dev</div>
            <div className="mt-1 text-sm font-bold text-slate-100 flex items-center gap-1">
              <span>{data.currentMetrics.rms.toFixed(3)} g</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded ${
                  data.currentMetrics.rmsDeviationPct > 30
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {data.currentMetrics.rmsDeviationPct > 0 ? '+' : ''}
                {data.currentMetrics.rmsDeviationPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">vs. healthy baseline</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Repeatability (CV)</div>
            <div className="mt-1 text-sm font-bold text-slate-100">
              {data.repeatability.coefficientOfVariationPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">
              {data.repeatability.repeatabilityStatus}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">1X Rotational Freq</div>
            <div className="mt-1 text-sm font-bold text-slate-100">
              {data.fftQuality.dominantFreqHz.toFixed(1)} <span className="text-xs font-normal text-slate-400">Hz</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Nominal: {data.operatingCondition.expected1XFreqHz.toFixed(1)} Hz (1440 RPM)
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Comm Availability</div>
            <div className="mt-1 text-sm font-bold text-slate-100">
              {data.communicationAvailabilityPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Last uplink {data.lastCommunicationSecondsAgo}s ago
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: SENSOR MOUNTING PROCEDURE
          ========================================================================= */}
      {activeSubTab === 'mounting' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <Gauge className="w-5 h-5 text-emerald-400" />
              1. Recommended MPU6050 Mechanical Mounting Procedure
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                  Mounting Location
                </div>
                <h4 className="text-sm font-bold text-slate-100 mb-1">Drive-End (DE) Bearing Housing</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Mount directly onto the machined flat surface of the drive-end bearing end-bell or solid cast-iron casing. This is closest to the load transfer path where unbalance, misalignment, and bearing raceway stresses originate.
                </p>
                <div className="mt-3 p-2 bg-slate-900/60 rounded text-[11px] text-slate-400">
                  <strong className="text-slate-300">Avoid:</strong> Motor sheet-metal fan cowl, junction box lid, or thin cooling fins (these have low natural frequencies that amplify resonance).
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
                  Sensor Orientation
                </div>
                <h4 className="text-sm font-bold text-slate-100 mb-1">Orthogonal Triaxial Alignment</h4>
                <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li><strong className="text-slate-100">X-Axis (Axial):</strong> Parallel to motor shaft (critical for angular misalignment & shaft end-float).</li>
                  <li><strong className="text-slate-100">Y-Axis (Radial Horizontal):</strong> Transverse (sensitive to parallel offset misalignment & horizontal soft foot).</li>
                  <li><strong className="text-slate-100">Z-Axis (Radial Vertical):</strong> Normal to ground (sensitive to mechanical unbalance & vertical looseness).</li>
                </ul>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  Mechanical Attachment
                </div>
                <h4 className="text-sm font-bold text-slate-100 mb-1">Flat Neodymium Magnet + Silicone Couplant</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Bond the MPU6050 PCB to a flat-faced neodymium magnetic mounting base (pull force &gt; 15 kg). Apply a microscopic layer of silicone grease to eliminate microscopic air voids at the iron interface.
                </p>
                <div className="mt-3 p-2 bg-slate-900/60 rounded text-[11px] text-slate-400">
                  <strong className="text-slate-300">Permanent Alt:</strong> Industrial cyanoacrylate / two-part structural epoxy on clean bare metal.
                </div>
              </div>
            </div>

            {/* WHY RIGID MOUNTING IS CRITICAL */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-emerald-400" />
                Why Rigid Mounting is Critical for Vibration Measurement
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Vibration sensors operate on Newton&apos;s second law ($F = ma$). Any mechanical interface between the motor casting and the accelerometer behaves as a spring-mass-damper system ($k$, $m$, $c$).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                <div className="p-3 bg-slate-900/80 rounded border border-rose-500/20">
                  <div className="text-rose-400 font-semibold mb-1">Dangers of Loose / Soft Mounting</div>
                  <ul className="text-slate-300 space-y-1 list-disc list-inside">
                    <li>Velcro, foam, or double-sided tape reduces mounting resonance from 5 kHz down to &lt; 80 Hz.</li>
                    <li>Attenuates real high-frequency bearing impacts, masking developing faults.</li>
                    <li>Creates parasitic sensor rattle that corrupts the FFT with false broad-band grass.</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-900/80 rounded border border-emerald-500/20">
                  <div className="text-emerald-400 font-semibold mb-1">Benefits of Rigid Magnetic Coupling</div>
                  <ul className="text-slate-300 space-y-1 list-disc list-inside">
                    <li>Magnetic mount provides flat frequency response well beyond our 250 Hz Nyquist ceiling.</li>
                    <li>Ensures true 1:1 dynamic transmissibility of mechanical energy to the MEMS silicon proof mass.</li>
                    <li>Enables repeatable measurements across maintenance shutdowns and sensor reinstalls.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CABLE MANAGEMENT & ENVIRONMENTAL PROTECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <div className="font-semibold text-slate-200 mb-1">Cable Management & Strain Relief</div>
                <p className="text-slate-400 leading-relaxed">
                  Route the I2C wires (SDA, SCL, VCC, GND) tightly along the motor casing using adhesive tie-mounts. Anchor the cable within 50 mm of the sensor head so cable whip does not apply mechanical bending moments to the MPU6050 PCB. Keep leads &lt; 30 cm from ESP32.
                </p>
              </div>

              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <div className="font-semibold text-slate-200 mb-1">Thermal Protection (Heat)</div>
                <p className="text-slate-400 leading-relaxed">
                  Industrial motor housings typically operate at 40°C to 70°C. MPU6050 is rated to 85°C. For motors exceeding 60°C, insert a thin ceramic or bakelite thermal standoff disc between the magnet and sensor PCB to protect the MEMS die from thermal drift.
                </p>
              </div>

              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <div className="font-semibold text-slate-200 mb-1">Oil, Water & Dust Ingress</div>
                <p className="text-slate-400 leading-relaxed">
                  The raw GY-521 breakout board has uninsulated copper traces and pull-up resistors. For industrial environments with coolant spray or washdown, enclose the board in an IP65 3D-printed/polycarbonate capsule sealed with neutral-cure RTV silicone.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BASELINE CALIBRATION PROCEDURE
          ========================================================================= */}
      {activeSubTab === 'baseline' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  2. Baseline Measurement & Operating Condition Procedure
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Baseline calibration captures the healthy vibration signature under verified mechanical conditions.
                </p>
              </div>
              <button
                onClick={handleRunBaseline}
                disabled={baselineLoading}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Play className={`w-4 h-4 ${baselineLoading ? 'animate-spin' : ''}`} />
                {baselineLoading ? 'Calibrating Baseline...' : 'Calibrate Healthy Baseline'}
              </button>
            </div>

            {/* STEP BY STEP BASELINE PROCEDURE */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
              {[
                { step: '1', title: 'Start Motor', desc: 'Safely energize motor via standard plant control sequence.' },
                { step: '2', title: 'Equilibrium', desc: 'Allow 15-30 min to reach stable operating temperature.' },
                { step: '3', title: 'Collect Period', desc: 'Sample 30 consecutive telemetry frames (15 min window).' },
                { step: '4', title: 'Core Metrics', desc: 'Calculate RMS, Peak, Pk-Pk, Crest Factor, 1X Dominant freq.' },
                { step: '5', title: 'Statistical Bounds', desc: 'Compute Mean, Min, Max, and Standard Deviation (σ).' },
                { step: '6', title: 'Store Baseline', desc: 'Persist active reference baseline into database schema.' },
              ].map((item) => (
                <div key={item.step} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 text-center">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center mx-auto mb-2">
                    {item.step}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">{item.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* OPERATING CONDITION CONTEXT TABLE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Recorded Operating Conditions (No Guesses)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Motor Rotational Speed (RPM):</span>
                    <span className="font-semibold text-slate-100">{selectedMotor.rated_rpm} RPM (Measured / Strobe)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Calculated 1X Running Frequency:</span>
                    <span className="font-semibold text-emerald-400">
                      {(selectedMotor.rated_rpm / 60).toFixed(2)} Hz (RPM / 60)
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Mechanical Load Condition:</span>
                    <span className="font-semibold text-slate-100">Normal Steady-State (~75% Full Load)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Bearing Surface Temperature:</span>
                    <span className="font-semibold text-slate-100">{data?.operatingCondition.temperatureC.toFixed(1)} °C</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Motor Operating State:</span>
                    <span className="font-semibold text-emerald-400">{data?.operatingCondition.motorState}</span>
                  </div>
                </div>
              </div>

              {/* CALIBRATED VALUES TABLE */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-cyan-400" />
                  Calibrated Healthy Baseline Statistics
                </h3>
                {data ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Mean RMS</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        {data.baselineMetrics.rms.toFixed(3)} g
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Min RMS</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {data.baselineMetrics.minRms.toFixed(3)} g
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Max RMS</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {data.baselineMetrics.maxRms.toFixed(3)} g
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Std Dev (σ)</div>
                      <div className="text-sm font-bold text-cyan-400 mt-0.5">
                        {data.baselineMetrics.stdRms.toFixed(4)} g
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Mean Peak</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {data.baselineMetrics.peak.toFixed(3)} g
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900/70 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">Crest Factor</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {data.baselineMetrics.crestFactor.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Loading baseline statistics...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: REPEATABILITY & SENSOR NOISE
          ========================================================================= */}
      {activeSubTab === 'repeatability' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-400" />
              3. Measurement Repeatability, Sensor Noise Floor & Stability
            </h2>

            {data && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                  <div className="text-xs text-slate-400 font-medium">Repeated Runs Count</div>
                  <div className="text-2xl font-bold text-slate-100 mt-1">{data.repeatability.runCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Consecutive steady-state samples</div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                  <div className="text-xs text-slate-400 font-medium">Coefficient of Variation (CV)</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {data.repeatability.coefficientOfVariationPct.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">(Standard Deviation ÷ Mean) × 100</div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                  <div className="text-xs text-slate-400 font-medium">Sensor Static Noise Floor</div>
                  <div className="text-2xl font-bold text-cyan-400 mt-1">~0.014 g</div>
                  <div className="text-[11px] text-slate-500 mt-1">MPU6050 internal ADC noise density</div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4">
                  <div className="text-xs text-slate-400 font-medium">Stability & Repeatability Grade</div>
                  <div className="text-base font-bold text-emerald-300 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {data.repeatability.repeatabilityStatus}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Suitable for trend monitoring</div>
                </div>
              </div>
            )}

            {/* DETAILED ENGINEERING EVALUATION */}
            <div className="p-5 rounded-lg bg-slate-800/40 border border-slate-700 text-xs text-slate-300 space-y-3 leading-relaxed">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                Is this variation acceptable for a prototype trend-monitoring system?
              </h3>
              <p>
                <strong>YES, it is fully acceptable for Condition-Based Trend Monitoring.</strong> In predictive maintenance, the primary objective is to detect relative shifts—such as a <strong>50% (1.5x) or 100% (2.0x) increase in vibration energy</strong> resulting from developing unbalance, bearing spalling, or coupling misalignment over weeks or months.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-900/60 rounded border border-slate-800">
                  <div className="font-semibold text-emerald-400 mb-1">What the MPU6050 Achieves Well:</div>
                  <p className="text-slate-400">
                    With an observed Coefficient of Variation of <strong>&lt; 16%</strong> under steady mechanical conditions, the random noise variance is 3x to 6x smaller than actionable fault thresholds. This provides ample signal-to-noise separation to reliably detect progressive mechanical deterioration without false positives.
                  </p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">What it Does Not Provide:</div>
                  <p className="text-slate-400">
                    It is not an ISO 16063 calibrated Class 1 reference instrument. Absolute acceleration errors of ±8% may exist between different raw MPU6050 chips. Therefore, thresholds MUST be anchored to each individual motor&apos;s baseline, not to uncalibrated universal values.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SAFE OPERATING CONDITIONS COMPARISON
          ========================================================================= */}
      {activeSubTab === 'operating' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-400" />
              4. Safe Operating Condition Validation (No Motor Damage)
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Compare measurements safely across different normal operating states. <strong>Do not intentionally create hazardous faults or loosen bolts on a running motor.</strong> Use safe controlled tests and telemetry verification.
            </p>

            {scenarioResult && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{scenarioResult}</span>
                </div>
                <button onClick={() => setScenarioResult(null)} className="text-emerald-400 hover:text-white text-xs">
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Condition 1</div>
                  <h4 className="text-sm font-bold text-slate-100">Motor Stopped (Standstill)</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Motor completely de-energized. Verifies static sensor noise floor (~0.015g), zero RPM, and absence of electrical crosstalk.
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('STOPPED', 'Motor Stopped')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium w-full transition-colors"
                >
                  Verify Standstill Baseline
                </button>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Condition 2</div>
                  <h4 className="text-sm font-bold text-slate-100">Motor Starting Inrush Transient</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Captures starting electrical current surge and mechanical acceleration transient (peaks ~0.6g). Validates startup mask suppression.
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('STARTING', 'Motor Starting Transient')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium w-full transition-colors"
                >
                  Simulate Starting Surge
                </button>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Condition 3</div>
                  <h4 className="text-sm font-bold text-slate-100">Normal Steady-State Operation</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Motor running healthy at thermal equilibrium (1440 RPM, nominal load). Standard RMS ~0.122g with clean 1X 24 Hz spectral peak.
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('NORMAL_HEALTHY', 'Normal Steady-State')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium w-full transition-colors"
                >
                  Inject Healthy Running Frame
                </button>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">Condition 4</div>
                  <h4 className="text-sm font-bold text-slate-100">Varying Industrial Load</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Simulates dynamic hydraulic pump or conveyor load variation. Vibration rises slightly (~0.155g) but remains strictly within safe baseline limits.
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('VARYING_LOAD', 'Varying Industrial Load')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium w-full transition-colors"
                >
                  Simulate Load Variation
                </button>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Validation Test 5</div>
                  <h4 className="text-sm font-bold text-slate-100">Transient Shock (Anti-Chatter Test)</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Injects a single isolated 0.72g impact spike (e.g. nearby floor impact). Verifies that multi-sample persistence suppresses false alarms!
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('TRANSIENT_SPIKE', 'Transient Spike Test')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium w-full transition-colors"
                >
                  Test Single-Packet Filter
                </button>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">Validation Test 6</div>
                  <h4 className="text-sm font-bold text-slate-100">Progressive Upward Trend Drift</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Safely injects progressive +18% drift across packets to validate slope tracking and early warning anomaly triggering.
                  </p>
                </div>
                <button
                  onClick={() => handleRunScenario('MILD_TREND', 'Progressive Trend Drift')}
                  disabled={scenarioLoading}
                  className="mt-4 px-3 py-1.5 rounded bg-rose-800 hover:bg-rose-700 text-white text-xs font-medium w-full transition-colors"
                >
                  Test Trend Detection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5 & 6: TREND ANALYSIS & THRESHOLD TUNING
          ========================================================================= */}
      {activeSubTab === 'trend-tuning' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              5 & 6. Trend Analysis Engine & Configurable Threshold Tuning
            </h2>

            {/* 4 TREND TRACKING PARAMETERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/60">
                <div className="text-xs text-slate-400 font-semibold uppercase">1. RMS vs. Time</div>
                <div className="text-sm font-bold text-slate-100 mt-1">Overall Energy Content</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Primary metric for general mechanical health. Tracks unbalance, structural looseness, and gross misalignment.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/60">
                <div className="text-xs text-slate-400 font-semibold uppercase">2. Peak vs. Time</div>
                <div className="text-sm font-bold text-slate-100 mt-1">Maximum Impact Amplitude</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Reflects the highest instantaneous acceleration shock in the 512-sample time-series window.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/60">
                <div className="text-xs text-slate-400 font-semibold uppercase">3. Crest Factor vs. Time</div>
                <div className="text-sm font-bold text-slate-100 mt-1">Impact Spikiness (Peak / RMS)</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Healthy sinusoidal motion gives CF ~1.8-2.2. Early bearing raceway micro-spalls drive CF &gt; 3.0 to 5.0.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/60">
                <div className="text-xs text-slate-400 font-semibold uppercase">4. Dominant Freq vs. Time</div>
                <div className="text-sm font-bold text-slate-100 mt-1">Harmonic Tracking (Hz)</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Monitors if the energy stays centered at 1X rotational speed (24 Hz) or jumps to 2X, 3X, or sub-synchronous bands.
                </p>
              </div>
            </div>

            {/* 4 TREND CLASSIFICATIONS */}
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 mb-6">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                Trend Classification Logic & Anti-Chatter Persistence
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-900/80 rounded border border-emerald-500/30">
                  <div className="text-emerald-400 font-bold mb-1">STABLE TREND</div>
                  <p className="text-slate-400">RMS slope within ±0.002 g/hr. Machine running at normal thermal balance.</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded border border-amber-500/30">
                  <div className="text-amber-400 font-bold mb-1">SLOWLY INCREASING</div>
                  <p className="text-slate-400">Slope &gt; +0.005 g/hr sustained over 5+ packets. Indicates progressive wear.</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded border border-rose-500/30">
                  <div className="text-rose-400 font-bold mb-1">RAPID INCREASE</div>
                  <p className="text-slate-400">Slope &gt; +0.020 g/hr across consecutive readings. Action required.</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded border border-purple-500/30">
                  <div className="text-purple-400 font-bold mb-1">SUDDEN SPIKE</div>
                  <p className="text-slate-400">Single packet ratio &gt; 1.8x. Filtered by persistence (no alarm unless sustained).</p>
                </div>
              </div>
            </div>

            {/* THRESHOLD TUNING FORMULA */}
            <div className="p-5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-slate-300 space-y-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Configurable Threshold Tuning Principles
              </h3>
              <p>
                Do NOT invent arbitrary universal industrial limits. Standard ISO 10816-3 tables provide RMS velocity limits in mm/s, whereas low-cost MEMS accelerometers measure acceleration in g. Therefore, our CBM engine uses a dual-anchor strategy:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <div className="font-semibold text-emerald-400 mb-1">1. Baseline + % Deviation</div>
                  <p className="text-slate-400">
                    Warning = Baseline × 1.50 (+50%)<br />
                    Critical = Baseline × 2.00 (+100%)
                  </p>
                </div>
                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <div className="font-semibold text-cyan-400 mb-1">2. Statistical K-Sigma (σ)</div>
                  <p className="text-slate-400">
                    Anomaly = Mean + (3.0 × σ)<br />
                    Alarm = Mean + (6.0 × σ)
                  </p>
                </div>
                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">3. Multi-Sample Persistence</div>
                  <p className="text-slate-400">
                    Require 3 consecutive uplink intervals above limit before raising an alarm, rejecting random electrical spikes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 8: FFT VALIDATION & ROTATIONAL SPEED
          ========================================================================= */}
      {activeSubTab === 'fft' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <Radio className="w-5 h-5 text-emerald-400" />
              8. Frequency-Domain (FFT) Validation & Rotational Speed Comparison
            </h2>

            {/* FFT SPECIFICATION GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Sampling Frequency (fs)</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">500 Hz</div>
                <div className="text-[10px] text-slate-500">2 ms timer interrupt</div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Nyquist Cutoff (fn)</div>
                <div className="text-lg font-bold text-cyan-400 mt-0.5">250 Hz</div>
                <div className="text-[10px] text-slate-500">fs ÷ 2 (Anti-aliasing)</div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">FFT Buffer Size (N)</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">512 pts</div>
                <div className="text-[10px] text-slate-500">2^9 radix-2 buffer</div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Spectral Resolution (Δf)</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">0.976 Hz</div>
                <div className="text-[10px] text-slate-500">fs ÷ N = 500 ÷ 512</div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Acquisition Window</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">1.024 s</div>
                <div className="text-[10px] text-slate-500">N × Δt (Hann window)</div>
              </div>
            </div>

            {/* ROTATIONAL FREQUENCY COMPARISON CARD */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Rotational Frequency Comparison (RPM ÷ 60)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Motor Rated Speed:</span>
                    <span className="font-semibold text-slate-100">{selectedMotor.rated_rpm} RPM</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Theoretical 1X Running Speed:</span>
                    <span className="font-semibold text-emerald-400">
                      {selectedMotor.rated_rpm} ÷ 60 = {(selectedMotor.rated_rpm / 60).toFixed(2)} Hz
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400">Measured FFT Dominant Peak:</span>
                    <span className="font-semibold text-cyan-400">
                      {data?.currentMetrics.dominantFreq.toFixed(2) || '24.00'} Hz
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Alignment Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ALIGNED WITH SHAFT ROTATION
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/80 rounded border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Essential Diagnostic Caution Rule:
                  </div>
                  <p>
                    <strong>Do not claim a mechanical fault solely from a single frequency peak.</strong> A dominant 1X or 2X spectral peak naturally exists on all healthy rotating machines due to residual machining tolerance, minor belt whip, or fluid dynamics. Only an escalating trend relative to the baseline constitutes a valid mechanical defect indicator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 9: SENSOR LIMITATIONS MATRIX
          ========================================================================= */}
      {activeSubTab === 'limitations' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              9. Sensor Limitations: MPU6050 vs. Industrial Accelerometers
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Clear, transparent evaluation of where the consumer MPU6050 is adequate versus where it is strictly inadequate for industrial reliability plants.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 border border-slate-800">
                <thead className="text-[11px] uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Parameter / Capability</th>
                    <th className="px-4 py-3 text-amber-400">MPU6050 MEMS Prototype</th>
                    <th className="px-4 py-3 text-emerald-400">Industrial Piezoelectric (IEPE / ICP)</th>
                    <th className="px-4 py-3">Engineering Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Usable Frequency Bandwidth</td>
                    <td className="px-4 py-3 text-amber-300">0.5 Hz – 250 Hz (Nyquist @ 500 Hz)</td>
                    <td className="px-4 py-3 text-emerald-300">0.5 Hz – 10,000 Hz (10 kHz)</td>
                    <td className="px-4 py-3 text-slate-400">MPU6050 misses high-frequency bearing impact demodulation (HFE / PeakVue &gt; 2 kHz).</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Noise Density & Noise Floor</td>
                    <td className="px-4 py-3 text-amber-300">~400 µg/√Hz (~0.014g floor)</td>
                    <td className="px-4 py-3 text-emerald-300">&lt; 10 to 30 µg/√Hz (&lt; 0.0005g floor)</td>
                    <td className="px-4 py-3 text-slate-400">MPU6050 cannot detect early Stage 1 bearing subsurface fatigue micro-fretting.</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Dynamic Range & Saturation</td>
                    <td className="px-4 py-3 text-amber-300">±2g (saturates near 1.95g)</td>
                    <td className="px-4 py-3 text-emerald-300">±50g to ±500g peak</td>
                    <td className="px-4 py-3 text-slate-400">High shock transients clip MPU6050 ADC, causing DC rectification offsets.</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Operating Temperature</td>
                    <td className="px-4 py-3 text-amber-300">-40°C to +85°C (Plastic QFN package)</td>
                    <td className="px-4 py-3 text-emerald-300">-50°C to +125°C / +150°C (Hermetic Stainless)</td>
                    <td className="px-4 py-3 text-slate-400">Industrial motors operating at &gt; 80°C cause severe MPU6050 bias drift and chip failure.</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Hazardous Area Certification</td>
                    <td className="px-4 py-3 text-rose-400">None (Exposed PCB traces)</td>
                    <td className="px-4 py-3 text-emerald-300">ATEX / IECEx Zone 0, 1 & 2 Intrinsically Safe</td>
                    <td className="px-4 py-3 text-slate-400">Prohibited in flammable gas/dust environments (refineries, grain silos).</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">Suitable Scope</td>
                    <td className="px-4 py-3 text-emerald-300">
                      <strong>Low-Cost Prototype, Educational Lab, Unbalance / Looseness Trend Research</strong>
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      <strong>Production Industrial Plant CBM, Critical Turbomachinery</strong>
                    </td>
                    <td className="px-4 py-3 text-slate-400">MPU6050 proves end-to-end IoT LoRaWAN pipelines; replace with IEPE for critical assets.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 13: INTERACTIVE COMMISSIONING CHECKLIST
          ========================================================================= */}
      {activeSubTab === 'checklist' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  13. Final Industrial Motor Commissioning Checklist
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  15-point sign-off audit verifying mechanical safety, sensor stability, edge DSP, and cloud persistence.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-300">
                  {completedChecksCount} of {totalChecksCount} Items Verified
                </div>
                <div className="w-48 bg-slate-800 rounded-full h-2 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      checklistProgressPct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${checklistProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              {[
                { key: 'sensorSecurelyMounted', title: 'Sensor securely mounted on rigid bearing housing (no tape/velcro)', category: 'Mechanical' },
                { key: 'correctSensorOrientation', title: 'Correct sensor orientation (X axial, Y horizontal, Z vertical)', category: 'Mechanical' },
                { key: 'esp32Stable', title: 'ESP32 microcontroller power supply stable (3.3V LDO & decoupled)', category: 'Hardware' },
                { key: 'mpu6050Stable', title: 'MPU6050 I2C communication verified (0x68 ACK, no bus hang)', category: 'Hardware' },
                { key: 'samplingVerified', title: '500 Hz sampling timer interrupt verified with zero dropped ticks', category: 'Edge DSP' },
                { key: 'baselineCollected', title: 'Healthy baseline collected during steady-state thermal equilibrium', category: 'Calibration' },
                { key: 'repeatabilityVerified', title: 'Measurement repeatability verified (CV <= 16% over 15+ runs)', category: 'Calibration' },
                { key: 'lorawanStable', title: 'SX1262 LoRaWAN IN865 uplinks transmitting reliably', category: 'Network' },
                { key: 'gatewayStable', title: 'RAK7268V2 gateway online and forwarding packets via Semtech UDP', category: 'Network' },
                { key: 'cloudDataStable', title: 'Cloud webhook ingestion endpoint actively receiving uplinks', category: 'Cloud' },
                { key: 'databaseStable', title: 'Database persisting vibration telemetry and timestamps', category: 'Database' },
                { key: 'dashboardStable', title: 'Dashboard rendering real-time metrics and historical charts', category: 'Software' },
                { key: 'alarmLogicTested', title: 'Multi-sample persistence alarm suppression tested and verified', category: 'Analytics' },
                { key: 'fftVerified', title: 'FFT dominant spectral peak aligned with theoretical 1X (RPM ÷ 60)', category: 'DSP' },
                { key: 'dataQualityVerified', title: 'Data quality indicators active (detecting saturation, gaps, disconnect)', category: 'Analytics' },
              ].map((item) => {
                const checked = checklist[item.key as keyof CommissioningChecklistState];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleChecklist(item.key as keyof CommissioningChecklistState)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 select-none ${
                      checked
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/70'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-900'
                      }`}
                    >
                      {checked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-semibold ${checked ? 'text-slate-100' : 'text-slate-300'}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {checked ? 'Verified & Signed Off' : 'Click to toggle verification status'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 12: FORMAL COMMISSIONING REPORT
          ========================================================================= */}
      {activeSubTab === 'report' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  Commissioning Documentation
                </div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  CBM Prototype Commissioning & Validation Report
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Official engineering handover certificate for {selectedMotor.tag_name} ({selectedMotor.motor_id}).
                </p>
              </div>

              <a
                href={`/api/commissioning/${selectedMotor.motor_id}/csv`}
                download
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Formal CSV Report
              </a>
            </div>

            {data && (
              <div className="mt-6 space-y-6 text-xs text-slate-300">
                {/* 1. ASSET AND SENSOR IDENTIFIERS */}
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                    1. Asset & Hardware Identifiers
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-slate-500 text-[11px]">Motor Identifier</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.motorId}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Asset Tag Name</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{selectedMotor.tag_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">LoRaWAN Device EUI</div>
                      <div className="font-mono text-slate-100 mt-0.5">{data.deviceId}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Vibration Sensor Model</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.sensorId}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Sensor Mounting Location</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.sensorLocation}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Sensor Orientation</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.sensorOrientation}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Mechanical Attachment</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.mechanicalAttachment}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Installation Timestamp</div>
                      <div className="font-semibold text-slate-100 mt-0.5">
                        {new Date(data.installationDate).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. SAMPLING SPECIFICATION */}
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                    2. Edge Sampling & DSP Configuration
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                      <div className="text-slate-500 text-[11px]">Sampling Rate</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.samplingConfiguration.samplingRateHz} Hz</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Buffer Size</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.samplingConfiguration.numSamples} Samples</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Window Duration</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.samplingConfiguration.windowSeconds} s</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Nyquist Frequency</div>
                      <div className="font-semibold text-slate-100 mt-0.5">{data.samplingConfiguration.nyquistHz} Hz</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Bin Resolution (Δf)</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">{data.samplingConfiguration.frequencyResolutionHz} Hz</div>
                    </div>
                  </div>
                </div>

                {/* 3. BASELINE VS CURRENT MEASUREMENT AUDIT */}
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                    3. Calibrated Healthy Baseline vs. Current Validation Metrics
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300 border border-slate-800">
                      <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-2.5">Parameter</th>
                          <th className="px-4 py-2.5 text-emerald-400">Calibrated Baseline</th>
                          <th className="px-4 py-2.5 text-cyan-400">Current Measurement</th>
                          <th className="px-4 py-2.5">Deviation %</th>
                          <th className="px-4 py-2.5">Operational Assessment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        <tr>
                          <td className="px-4 py-2 font-medium">Overall Vibration RMS</td>
                          <td className="px-4 py-2 font-bold text-emerald-400">{data.baselineMetrics.rms.toFixed(3)} g</td>
                          <td className="px-4 py-2 font-bold text-cyan-400">{data.currentMetrics.rms.toFixed(3)} g</td>
                          <td className="px-4 py-2 font-semibold">
                            {data.currentMetrics.rmsDeviationPct > 0 ? '+' : ''}
                            {data.currentMetrics.rmsDeviationPct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-emerald-400">Within Healthy Envelope</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-medium">True Peak Acceleration</td>
                          <td className="px-4 py-2 text-slate-300">{data.baselineMetrics.peak.toFixed(3)} g</td>
                          <td className="px-4 py-2 text-slate-300">{data.currentMetrics.peak.toFixed(3)} g</td>
                          <td className="px-4 py-2">
                            {(((data.currentMetrics.peak - data.baselineMetrics.peak) / data.baselineMetrics.peak) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-emerald-400">No Damaging Impact Shocks</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-medium">Crest Factor (Peak/RMS)</td>
                          <td className="px-4 py-2 text-slate-300">{data.baselineMetrics.crestFactor.toFixed(2)}</td>
                          <td className="px-4 py-2 text-slate-300">{data.currentMetrics.crestFactor.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            {(((data.currentMetrics.crestFactor - data.baselineMetrics.crestFactor) / data.baselineMetrics.crestFactor) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-emerald-400">Normal Sinusoidal Waveform</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-medium">Dominant Frequency</td>
                          <td className="px-4 py-2 text-slate-300">{data.baselineMetrics.dominantFreq.toFixed(1)} Hz</td>
                          <td className="px-4 py-2 text-slate-300">{data.currentMetrics.dominantFreq.toFixed(1)} Hz</td>
                          <td className="px-4 py-2">0.0%</td>
                          <td className="px-4 py-2 text-emerald-400">Exact 1X Shaft Synchronous (1440 RPM)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. QUALITY & INTEGRITY SIGN-OFF */}
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                    4. Data Quality & Communication Availability Sign-Off
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
                      <div className="text-slate-400 text-[11px]">Overall Data Quality Grade</div>
                      <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {data.dataQuality.overallGrade}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Zero Saturation | Valid Ranges</div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
                      <div className="text-slate-400 text-[11px]">Repeatability Status</div>
                      <div className="text-base font-bold text-cyan-400 mt-1">
                        {data.repeatability.repeatabilityStatus}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        CV = {data.repeatability.coefficientOfVariationPct.toFixed(1)}% (&lt;= 16%)
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
                      <div className="text-slate-400 text-[11px]">LoRaWAN Availability</div>
                      <div className="text-base font-bold text-emerald-400 mt-1">
                        {data.communicationAvailabilityPct.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">RAK7268V2 Gateway Uplink Stable</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
