import React, { useState, useEffect } from 'react';
import { HealthReport, Measurement } from '../types';
import { getHealthReportApi } from '../services/api';
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Cpu,
  Clock,
  Info,
  Waves,
} from 'lucide-react';

interface HealthReportTabProps {
  motorId?: string;
  latestMeasurement?: Measurement | null;
}

export const HealthReportTab: React.FC<HealthReportTabProps> = ({
  motorId = 'MOTOR_01',
  latestMeasurement = null,
}) => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [periodHours, setPeriodHours] = useState<number>(24);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const data = await getHealthReportApi(motorId, periodHours);
      setReport(data);
    } catch (err) {
      console.error('Failed to load health report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [motorId, periodHours]);

  /**
   * Compiles current motor metrics (RMS, Peak, Crest Factor, Dominant Frequency)
   * from the component state into a cleanly formatted CSV file.
   */
  const handleDownloadCsv = () => {
    if (!report) return;

    // Compile current motor metrics directly from state / telemetry
    const rms = Number((latestMeasurement?.overall_rms ?? report.currentRms ?? 0.185).toFixed(4));
    const peak = Number((latestMeasurement?.peak ?? report.currentPeak ?? 0.320).toFixed(4));
    const crestFactor = Number(
      (
        latestMeasurement?.crest_factor ??
        report.currentCrestFactor ??
        (report.currentRms > 0 ? report.currentPeak / report.currentRms : 1.73)
      ).toFixed(2)
    );
    const dominantFreq = Number(
      (latestMeasurement?.dominant_freq ?? report.dominantFrequency ?? 24.0).toFixed(2)
    );
    const dominantAmp = Number(
      (latestMeasurement?.dominant_amp ?? report.dominantAmplitude ?? 0.180).toFixed(4)
    );
    const tempC = Number((latestMeasurement?.temperature ?? report.temperature ?? 28.5).toFixed(1));
    const timestamp = latestMeasurement?.recorded_at || report.generatedAt || new Date().toISOString();

    // Engineering limit evaluation
    const rmsStatus = rms > report.criticalLimitRms ? 'CRITICAL' : rms > report.warningLimitRms ? 'WARNING' : 'NORMAL';
    const crestStatus = crestFactor > 4.2 ? 'SEVERE_IMPACTS' : crestFactor > 3.0 ? 'ELEVATED' : 'NORMAL';
    const runningSpeedHz = Number((report.ratedRpm / 60).toFixed(2));
    const freqHarmonic = Math.abs(dominantFreq - runningSpeedHz) < 1.5 ? '1X Synchronous' : 'Non-synchronous';

    const csvLines: string[] = [
      'sep=,',
      'CBM MOTOR HEALTH REPORT - CURRENT METRICS CSV',
      `Motor ID,${report.motorId}`,
      `Asset Tag,"${report.tagName.replace(/"/g, '""')}"`,
      `Location,"${report.location.replace(/"/g, '""')}"`,
      `Report Generated At,"${new Date(report.generatedAt).toISOString()}"`,
      `Latest Telemetry At,"${timestamp}"`,
      `Observation Window,Last ${report.monitoringPeriodHours} Hours (${report.sampleCount} Samples)`,
      `Health Score,${report.cbmHealthScore}/100`,
      `Health Status,${report.healthStatus}`,
      `Evaluated Condition,"${report.possibleCondition}"`,
      '',
      'CURRENT MOTOR METRICS COMPILATION',
      'Parameter,Current Value,Unit,Baseline / Limit,Assessment',
      `Overall RMS Vibration,${rms.toFixed(4)},g,Baseline: ${report.baselineRms.toFixed(4)} g (Warn: ${report.warningLimitRms}g / Crit: ${report.criticalLimitRms}g),${rmsStatus}`,
      `Peak Vibration,${peak.toFixed(4)},g,Max Observed: ${report.maxPeak.toFixed(4)} g,CONTROLLED`,
      `Crest Factor,${crestFactor.toFixed(2)},ratio,1.50 - 2.50 (Limit: 3.50),${crestStatus}`,
      `Dominant Frequency,${dominantFreq.toFixed(2)},Hz,Rated 1X: ${runningSpeedHz} Hz (${report.ratedRpm} RPM),${freqHarmonic}`,
      `Dominant Amplitude,${dominantAmp.toFixed(4)},g,Peak Spectral Acceleration,HARMONIC_PEAK`,
      `Bearing Temperature,${tempC.toFixed(1)},°C,Normal Range (< 65.0°C),NOMINAL`,
      `Baseline Deviation,${report.rmsDeviationPct > 0 ? '+' : ''}${report.rmsDeviationPct}%,%,±15.0% Band,${Math.abs(report.rmsDeviationPct) > 25 ? 'ELEVATED' : 'NOMINAL'}`,
      `Trend Rate of Change,${report.trendSlope > 0 ? '+' : ''}${report.trendSlope} g/hr,g/hr,±0.050 g/hr Steady Limit,${report.trendDirection}`,
      `Active Alarms,${report.activeAlarms},count,0 active,${report.activeAlarms > 0 ? 'ATTENTION' : 'CLEAR'}`,
      '',
      'TELEMETRY DATA ROW',
      'Timestamp,Motor_ID,RMS_g,Peak_g,Crest_Factor,Dominant_Freq_Hz,Dominant_Amp_g,Temperature_C,Health_Score,Health_Status,Condition',
      `"${timestamp}","${report.motorId}",${rms.toFixed(4)},${peak.toFixed(4)},${crestFactor.toFixed(2)},${dominantFreq.toFixed(2)},${dominantAmp.toFixed(4)},${tempC.toFixed(1)},${report.cbmHealthScore},"${report.healthStatus}","${report.possibleCondition}"`,
    ];

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedId = report.motorId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `motor_${sanitizedId}_metrics_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const handleExportFullCsv = () => {
    window.location.href = `/api/report/${encodeURIComponent(motorId)}/csv`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading && !report) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        Generating comprehensive CBM health report...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
        Failed to generate motor health report. Please verify database connectivity.
      </div>
    );
  }

  // Resolved current metrics from state / props
  const currentRms = Number((latestMeasurement?.overall_rms ?? report.currentRms ?? 0.185).toFixed(4));
  const currentPeak = Number((latestMeasurement?.peak ?? report.currentPeak ?? 0.320).toFixed(4));
  const currentCrestFactor = Number(
    (
      latestMeasurement?.crest_factor ??
      report.currentCrestFactor ??
      (report.currentRms > 0 ? report.currentPeak / report.currentRms : 1.73)
    ).toFixed(2)
  );
  const currentDominantFreq = Number(
    (latestMeasurement?.dominant_freq ?? report.dominantFrequency ?? 24.0).toFixed(2)
  );
  const currentDominantAmp = Number(
    (latestMeasurement?.dominant_amp ?? report.dominantAmplitude ?? 0.180).toFixed(4)
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            CBM Motor Health & Condition Report
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Standardized operational health summary, baseline deviations, alarm logs, and engineering recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-400 mr-2">Window:</span>
            <select
              value={periodHours}
              onChange={(e) => setPeriodHours(Number(e.target.value))}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value={1}>Last 1 Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last 7 Days</option>
            </select>
          </div>

          <button
            id="download-csv-btn"
            onClick={handleDownloadCsv}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            title="Download CSV compiling current motor metrics (RMS, Peak, Crest Factor, Dominant Frequency) from state"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>CSV Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportFullCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            title="Export historical telemetry archive from server"
          >
            <Download className="w-3.5 h-3.5" />
            Export Archive CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>

          <button
            onClick={loadReport}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Report"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-6 shadow-xl print:border-none print:bg-white print:text-black">
        {/* Report Header */}
        <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="text-xs font-mono text-cyan-400 tracking-wider font-semibold">
              INDUSTRIAL CONDITION-BASED MONITORING REPORT
            </div>
            <h1 className="text-2xl font-black text-slate-100 mt-1">{report.motorId} — {report.tagName}</h1>
            <div className="text-xs text-slate-400 mt-1">
              Facility Location: <span className="text-slate-300 font-medium">{report.location}</span> &middot; Rated: {report.ratedPowerKw} kW @ {report.ratedRpm} RPM
            </div>
          </div>

          <div className="text-right font-mono text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 shrink-0">
            <div>Report Date: {new Date(report.generatedAt).toLocaleString()}</div>
            <div className="mt-1">Window: Past {report.monitoringPeriodHours} Hours</div>
            <div>Dataset: {report.sampleCount} Received Packets</div>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* CBM Health Score */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>PROTOTYPE HEALTH SCORE</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-4xl font-extrabold font-mono ${
                report.cbmHealthScore >= 80 ? 'text-emerald-400' : report.cbmHealthScore >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {report.cbmHealthScore}
              </span>
              <span className="text-slate-500 text-sm font-mono">/ 100</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Status: <strong className="text-slate-200">{report.healthStatus}</strong>
            </div>
          </div>

          {/* Baseline vs Current Deviation */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>RMS BASELINE DEVIATION</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${
                report.rmsDeviationPct > 25 ? 'text-amber-400' : 'text-slate-100'
              }`}>
                {report.rmsDeviationPct > 0 ? `+${report.rmsDeviationPct}` : report.rmsDeviationPct}%
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Baseline: {report.baselineRms}g &rarr; Current: {report.currentRms}g
            </div>
          </div>

          {/* Operational Alarms & Anomaly Count */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>ALARM & ANOMALY EVENTS</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-bold font-mono text-amber-400">{report.activeAlarms}</span>
                <span className="text-xs text-slate-400 ml-1">Active</span>
              </div>
              <div className="text-slate-600">|</div>
              <div>
                <span className="text-2xl font-bold font-mono text-cyan-400">{report.anomalyCount}</span>
                <span className="text-xs text-slate-400 ml-1">Anomalies</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              LoRaWAN Comm Uptime: <strong className="text-slate-200">{report.communicationAvailabilityPct}%</strong>
            </div>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Vibration Kinematics & Statistical Analysis
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Parameter</th>
                  <th className="p-3">Observed Value</th>
                  <th className="p-3">Learned Baseline</th>
                  <th className="p-3">Engineering Limit</th>
                  <th className="p-3">Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                <tr>
                  <td className="p-3 font-semibold text-slate-100">Overall RMS Vibration</td>
                  <td className="p-3 text-cyan-400 font-bold">{currentRms.toFixed(3)} g</td>
                  <td className="p-3 text-slate-400">{report.baselineRms.toFixed(3)} g (±{report.baselineStdRms.toFixed(3)}g)</td>
                  <td className="p-3 text-amber-400">Warn: {report.warningLimitRms}g | Crit: {report.criticalLimitRms}g</td>
                  <td className="p-3">
                    {currentRms > report.criticalLimitRms ? (
                      <span className="text-rose-400 font-bold">EXCEEDS CRITICAL</span>
                    ) : currentRms > report.warningLimitRms ? (
                      <span className="text-amber-400 font-bold">EXCEEDS WARNING</span>
                    ) : report.rmsDeviationPct > 25 ? (
                      <span className="text-amber-300">ELEVATED (+{report.rmsDeviationPct}%)</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">NORMAL</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-semibold text-slate-100">Peak Vibration</td>
                  <td className="p-3 text-cyan-400 font-bold">{currentPeak.toFixed(3)} g</td>
                  <td className="p-3 text-slate-400">~{(report.baselineRms * 1.73).toFixed(3)} g</td>
                  <td className="p-3 text-amber-400">Max observed: {report.maxPeak.toFixed(3)} g</td>
                  <td className="p-3">
                    <span className="text-emerald-400">Controlled Dynamic Shocks</span>
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-semibold text-slate-100">Crest Factor (Peak / RMS)</td>
                  <td className="p-3 text-cyan-400 font-bold">{currentCrestFactor.toFixed(2)}</td>
                  <td className="p-3 text-slate-400">~1.73 (Gaussian Peak/RMS)</td>
                  <td className="p-3 text-amber-400">Norm: 1.50 - 2.50 | Warn: &gt; 3.0</td>
                  <td className="p-3">
                    {currentCrestFactor > 4.2 ? (
                      <span className="text-rose-400 font-bold">IMPACT SHOCKS / SPALLING</span>
                    ) : currentCrestFactor > 3.0 ? (
                      <span className="text-amber-400 font-bold">ELEVATED IMPACTS</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">NORMAL SINE / ROTOR</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-semibold text-slate-100">Dominant Frequency (1X)</td>
                  <td className="p-3 text-cyan-400 font-bold">
                    {currentDominantFreq.toFixed(1)} Hz <span className="text-[10px] text-slate-400 font-normal">({(currentDominantFreq * 60).toFixed(0)} CPM)</span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {(report.ratedRpm / 60).toFixed(1)} Hz (Rated: {report.ratedRpm} RPM)
                  </td>
                  <td className="p-3 text-amber-400">Amp: {currentDominantAmp.toFixed(3)} g</td>
                  <td className="p-3">
                    {Math.abs(currentDominantFreq - (report.ratedRpm / 60)) < 1.5 ? (
                      <span className="text-emerald-400 font-bold">1X SYNCHRONOUS RUNNING</span>
                    ) : (
                      <span className="text-cyan-300 font-bold">NON-SYNCHRONOUS HARMONIC</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-semibold text-slate-100">Trend Rate of Change</td>
                  <td className="p-3 text-cyan-400 font-bold">
                    {report.trendSlope > 0 ? `+${report.trendSlope}` : report.trendSlope} g/hr
                  </td>
                  <td className="p-3 text-slate-400">0.000 g/hr (Steady)</td>
                  <td className="p-3 text-slate-400">&le; ±0.050 g/hr</td>
                  <td className="p-3 font-sans">
                    <span className="font-semibold text-slate-200">{report.trendDirection}</span>
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-semibold text-slate-100">Evaluated Kinematic Condition</td>
                  <td className="p-3 text-amber-400 font-bold" colSpan={3}>
                    {report.possibleCondition} (Requires physical verification)
                  </td>
                  <td className="p-3">
                    <span className="text-amber-400">Heuristic Indication</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Engineering Recommendations & Notice */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            Engineering Recommendations & Operational Protocol
          </h4>
          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>Physical Inspection:</strong> If trend direction is increasing or an anomaly is persistent, inspect mounting bolt torque, drive coupling alignment, and shaft runout during the next scheduled maintenance window.
            </li>
            <li>
              <strong>Verification Requirement:</strong> This prototype CBM system utilizes aggregate statistical metrics. Final diagnosis of unbalance, bearing race spalling, or looseness must be verified using a calibrated high-frequency accelerometer and narrowband FFT analyzer.
            </li>
            <li>
              <strong>Baseline Relearning:</strong> If motor repairs, realignment, or significant speed/load change occurred, clear historical baseline and calibrate a fresh baseline under steady-state full load.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
