import React, { useState } from 'react';
import { executeTestSuiteApi } from '../services/api';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Cpu,
  Radio,
  BookmarkCheck,
  Activity,
  Terminal,
  Layers,
  Server,
  Database,
  Monitor,
  CheckCheck,
} from 'lucide-react';

interface TestItem {
  id: string;
  name: string;
  category: 'Edge Firmware' | 'LoRaWAN RF' | 'Backend & DB' | 'CBM & Alarms';
  description: string;
  expectedResult: string;
  status: 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
  actionTaken?: string;
  observedBehavior?: string;
}

const PHASE_10_TESTS: TestItem[] = [
  {
    id: 'TEST_1',
    name: 'Test 1: ESP32 Boots',
    category: 'Edge Firmware',
    description: 'Hardware boot cycle: 240 MHz dual-core, RTOS init, memory & watchdog configuration',
    expectedResult: 'ESP32 initializes CPU and peripherals; state set to BOOT with >200 KB free heap',
    status: 'IDLE',
  },
  {
    id: 'TEST_2',
    name: 'Test 2: MPU6050 Detected',
    category: 'Edge Firmware',
    description: 'Query I2C address 0x68 and verify WHO_AM_I register (0x75)',
    expectedResult: 'Device returns 0x68, wakes from sleep, configures DLPF to 188 Hz bandwidth',
    status: 'IDLE',
  },
  {
    id: 'TEST_3',
    name: 'Test 3: Sensor Calibration Works',
    category: 'Edge Firmware',
    description: 'Average 200 standstill acceleration samples to calculate DC zero-g offsets',
    expectedResult: 'Computes Ax, Ay, Az offsets compensating 1.0g gravity vector; stores in RTC',
    status: 'IDLE',
  },
  {
    id: 'TEST_4',
    name: 'Test 4: Motor Vibration Measured',
    category: 'Edge Firmware',
    description: 'Sample 512 discrete acceleration samples across X, Y, Z axes at 500 Hz',
    expectedResult: 'Continuous motion waveform acquired without dropped buffers',
    status: 'IDLE',
  },
  {
    id: 'TEST_5',
    name: 'Test 5: RMS Calculation Verified',
    category: 'Edge Firmware',
    description: 'Compute overall RMS: a_RMS = sqrt( (1/N) * sum(a[i]^2) )',
    expectedResult: 'Measured RMS matches sinusoidal benchmark within 1.5% tolerance',
    status: 'IDLE',
  },
  {
    id: 'TEST_6',
    name: 'Test 6: Peak Calculation Verified',
    category: 'Edge Firmware',
    description: 'Compute true Peak max(|a[i]|) and Crest Factor = Peak / RMS',
    expectedResult: 'Peak & Crest Factor calculated correctly; CF in typical range 1.41–2.20',
    status: 'IDLE',
  },
  {
    id: 'TEST_7',
    name: 'Test 7: FFT Verified',
    category: 'Edge Firmware',
    description: 'Execute 512-point Radix-2 Real FFT with Hann windowing (Fs = 500 Hz)',
    expectedResult: 'Resolves dominant peak at 24.0 Hz matching 1X motor running speed (1440 RPM)',
    status: 'IDLE',
  },
  {
    id: 'TEST_8',
    name: 'Test 8: LoRaWAN OTAA Join Successful',
    category: 'LoRaWAN RF',
    description: 'JoinRequest/JoinAccept exchange on IN865 band (865.0625 MHz, SF10/BW125)',
    expectedResult: 'Derives AppSKey, NwkSKey, and DevAddr: 0x260B4A12; node state CONNECTED',
    status: 'IDLE',
  },
  {
    id: 'TEST_9',
    name: 'Test 9: Gateway Receives Uplink',
    category: 'LoRaWAN RF',
    description: 'Transmit binary packet from SX1262 to RAK7268V2 8-channel gateway',
    expectedResult: 'Gateway concentrator captures packet: RSSI -72 dBm, SNR +9.2 dB, CRC Valid',
    status: 'IDLE',
  },
  {
    id: 'TEST_10',
    name: 'Test 10: Network Server Receives Data',
    category: 'LoRaWAN RF',
    description: 'ChirpStack / TTS v3 verifies MIC and checks frame counter replay protection',
    expectedResult: 'Uplink authenticated; fCntUp incremented; HTTP webhook dispatched to backend',
    status: 'IDLE',
  },
  {
    id: 'TEST_11',
    name: 'Test 11: Backend Receives Data',
    category: 'Backend & DB',
    description: 'Backend endpoint /api/uplink receives and decodes binary payload',
    expectedResult: 'Payload parsed into physical engineering units (RMS, Peak, Temp, Sensor Status)',
    status: 'IDLE',
  },
  {
    id: 'TEST_12',
    name: 'Test 12: Database Stores Data',
    category: 'Backend & DB',
    description: 'SQL INSERT transaction into vibration_measurements and updates devices table',
    expectedResult: 'Record persisted with UTC timestamp; indexing verified',
    status: 'IDLE',
  },
  {
    id: 'TEST_13',
    name: 'Test 13: Dashboard Displays Live Data',
    category: 'Backend & DB',
    description: 'Real-time WebSocket & SSE broadcast to active dashboard clients',
    expectedResult: 'Live telemetry cards, status badges, and gauges update immediately',
    status: 'IDLE',
  },
  {
    id: 'TEST_14',
    name: 'Test 14: Historical Graph Works',
    category: 'Backend & DB',
    description: 'Query historical time-series endpoint with limit=50 records',
    expectedResult: 'Canvas/SVG trend curve renders continuous multi-parameter telemetry',
    status: 'IDLE',
  },
  {
    id: 'TEST_15',
    name: 'Test 15: Anomaly Detection Works',
    category: 'CBM & Alarms',
    description: 'Inject elevated vibration (+35% above baseline) below warning threshold',
    expectedResult: 'Statistical baseline anomaly detected; health score adjusted to 80',
    status: 'IDLE',
  },
  {
    id: 'TEST_16',
    name: 'Test 16: Alarm Generation Works',
    category: 'CBM & Alarms',
    description: 'Inject consecutive elevated readings exceeding Warning threshold (0.280g)',
    expectedResult: 'Anti-flooding filter satisfied (N=2); Warning Alarm generated; audio/visual alert',
    status: 'IDLE',
  },
  {
    id: 'TEST_17',
    name: 'Test 17: Alarm Acknowledgement Works',
    category: 'CBM & Alarms',
    description: 'Operator acknowledges active alarm via dashboard UI action',
    expectedResult: 'Alarm state transitions to ACKNOWLEDGED with ISO operator timestamp',
    status: 'IDLE',
  },
  {
    id: 'TEST_18',
    name: 'Test 18: Alarm Clears After Recovery',
    category: 'CBM & Alarms',
    description: 'Inject healthy vibration telemetry below warning limits',
    expectedResult: 'Alarms auto-cleared; system status restored to NORMAL; health score recovers',
    status: 'IDLE',
  },
  {
    id: 'TEST_19',
    name: 'Test 19: Device Offline Detection Works',
    category: 'LoRaWAN RF',
    description: 'Simulate 120-second uplink silence exceeding 75-second watchdog limit',
    expectedResult: 'Node marked OFFLINE in database; dashboard heartbeat indicator alerted',
    status: 'IDLE',
  },
  {
    id: 'TEST_20',
    name: 'Test 20: System Recovers from Temporary Comm Failure',
    category: 'LoRaWAN RF',
    description: 'Transmit new valid LoRaWAN telemetry packet following communication outage',
    expectedResult: 'Device status immediately recovers to ONLINE; sequence continuity preserved',
    status: 'IDLE',
  },
];

interface TestSuiteTabProps {
  motorId?: string;
  onRefresh?: () => void;
}

export const TestSuiteTab: React.FC<TestSuiteTabProps> = ({
  motorId = 'MOTOR_01',
  onRefresh,
}) => {
  const [tests, setTests] = useState<TestItem[]>(PHASE_10_TESTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [activeConsoleLog, setActiveConsoleLog] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    setActiveConsoleLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 75),
    ]);
  };

  const runSingleTest = async (testIndex: number) => {
    const test = tests[testIndex];
    setTests((prev) =>
      prev.map((t, idx) => (idx === testIndex ? { ...t, status: 'RUNNING' } : t))
    );
    appendLog(`Executing ${test.id}: ${test.name}...`);

    try {
      const response = await executeTestSuiteApi(test.id, motorId);
      setTests((prev) =>
        prev.map((t, idx) =>
          idx === testIndex
            ? {
                ...t,
                status: response.status === 'PASSED' ? 'PASSED' : 'FAILED',
                actionTaken: response.actionTaken,
                observedBehavior: response.observedBehavior,
              }
            : t
        )
      );
      appendLog(`✓ ${test.id} ${response.status}: ${response.observedBehavior}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setTests((prev) =>
        prev.map((t, idx) =>
          idx === testIndex
            ? {
                ...t,
                status: 'FAILED',
                observedBehavior: `Error: ${err.message}`,
              }
            : t
        )
      );
      appendLog(`✗ ${test.id} FAILED: ${err.message}`);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    appendLog('Starting complete Phase 10 20-Point End-to-End Verification Run...');

    for (let i = 0; i < tests.length; i++) {
      await runSingleTest(i);
      // Small pause between tests for visual feedback
      await new Promise((r) => setTimeout(r, 300));
    }

    setIsRunningAll(false);
    appendLog('★ Phase 10 20-Point End-to-End Test Run Completed.');
  };

  const resetAllTests = () => {
    setTests(PHASE_10_TESTS);
    appendLog('Reset all 20 test states to IDLE.');
  };

  const passedCount = tests.filter((t) => t.status === 'PASSED').length;
  const failedCount = tests.filter((t) => t.status === 'FAILED').length;
  const runningCount = tests.filter((t) => t.status === 'RUNNING').length;
  const idleCount = tests.filter((t) => t.status === 'IDLE').length;

  const filteredTests =
    selectedCategory === 'ALL'
      ? tests
      : tests.filter((t) => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Phase 10: Complete 20-Point End-to-End Verification Suite
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Automated compliance verification spanning the full chain: ESP32 hardware & sensor acquisition, MPU6050 calibration, FFT, LoRaWAN OTAA, RAK7268V2 gateway, network server, backend API, SQLite persistence, and CBM alarms.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={resetAllTests}
            disabled={isRunningAll}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={runAllTests}
            disabled={isRunningAll}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunningAll ? 'Running Tests...' : 'Run All 20 Tests'}
          </button>
        </div>
      </div>

      {/* Progress & Category Filters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400">Passed</span>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {passedCount} / 20
          </span>
        </div>
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400">Failed</span>
          <span className="text-lg font-bold font-mono text-rose-400">
            {failedCount}
          </span>
        </div>
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400">In Progress</span>
          <span className="text-lg font-bold font-mono text-cyan-400">
            {runningCount}
          </span>
        </div>
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400">Remaining</span>
          <span className="text-lg font-bold font-mono text-slate-400">
            {idleCount}
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['ALL', 'Edge Firmware', 'LoRaWAN RF', 'Backend & DB', 'CBM & Alarms'].map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCategory === cat
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All 20 Tests' : cat}
            </button>
          )
        )}
      </div>

      {/* Test List Cards */}
      <div className="space-y-3">
        {filteredTests.map((test) => {
          const originalIndex = tests.findIndex((t) => t.id === test.id);
          return (
            <div
              key={test.id}
              className={`p-4 rounded-xl border transition ${
                test.status === 'PASSED'
                  ? 'bg-slate-900/90 border-emerald-800/40'
                  : test.status === 'FAILED'
                  ? 'bg-slate-900/90 border-rose-800/40'
                  : test.status === 'RUNNING'
                  ? 'bg-slate-900/90 border-cyan-700/60'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-800 text-slate-300">
                      {test.category}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {test.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">{test.description}</p>
                  <p className="text-[11px] text-slate-400">
                    <span className="text-slate-400 font-medium">Expected: </span>
                    {test.expectedResult}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Badge */}
                  {test.status === 'PASSED' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PASSED
                    </span>
                  )}
                  {test.status === 'FAILED' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60">
                      <XCircle className="w-3.5 h-3.5" />
                      FAILED
                    </span>
                  )}
                  {test.status === 'RUNNING' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      RUNNING
                    </span>
                  )}
                  {test.status === 'IDLE' && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/60">
                      READY
                    </span>
                  )}

                  {/* Run Button */}
                  <button
                    onClick={() => runSingleTest(originalIndex)}
                    disabled={isRunningAll || test.status === 'RUNNING'}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1 disabled:opacity-40"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Run
                  </button>
                </div>
              </div>

              {/* Observed Result Box (if executed) */}
              {(test.actionTaken || test.observedBehavior) && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-1 bg-slate-950/40 p-2.5 rounded-lg">
                  {test.actionTaken && (
                    <div className="text-slate-400">
                      <span className="text-slate-400 font-medium">Action: </span>
                      <span className="text-slate-300 font-mono">{test.actionTaken}</span>
                    </div>
                  )}
                  {test.observedBehavior && (
                    <div className="text-slate-300">
                      <span className="text-cyan-400 font-medium">Observed: </span>
                      <span className="font-mono">{test.observedBehavior}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Verification Console Log */}
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 font-mono">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Live Test Execution Console Log
          </div>
          <button
            onClick={() => setActiveConsoleLog([])}
            className="text-[11px] text-slate-400 hover:text-slate-300 transition"
          >
            Clear Log
          </button>
        </div>
        <div className="h-36 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300">
          {activeConsoleLog.length === 0 ? (
            <span className="text-slate-400 italic">No tests executed yet. Click "Run All 20 Tests" or run individual checks.</span>
          ) : (
            activeConsoleLog.map((log, i) => (
              <div
                key={i}
                className={
                  log.includes('PASSED') || log.includes('✓')
                    ? 'text-emerald-400'
                    : log.includes('FAILED') || log.includes('✗')
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
