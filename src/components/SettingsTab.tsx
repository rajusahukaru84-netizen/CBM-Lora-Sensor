import React, { useState } from 'react';
import { Motor, Device } from '../types';
import {
  Save,
  Sliders,
  ShieldCheck,
  Zap,
  RotateCcw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { updateMotorSettingsApi, seedHistoryApi, simulateUplinkApi } from '../services/api';

interface SettingsTabProps {
  motor: Motor | null;
  device: Device | null;
  onRefresh: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  motor,
  device,
  onRefresh,
}) => {
  const [tagName, setTagName] = useState(motor?.tag_name || 'Cooling Tower Feed Pump Motor 01');
  const [location, setLocation] = useState(motor?.location || 'Drive-End Bearing Bay #3');
  const [ratedRpm, setRatedRpm] = useState(motor?.rated_rpm?.toString() || '1440');
  const [ratedPowerKw, setRatedPowerKw] = useState(motor?.rated_power_kw?.toString() || '11.0');

  // Configurable thresholds
  const [warningRms, setWarningRms] = useState(motor?.warning_rms?.toString() || '0.280');
  const [criticalRms, setCriticalRms] = useState(motor?.critical_rms?.toString() || '0.450');
  const [warningPeak, setWarningPeak] = useState(motor?.warning_peak?.toString() || '0.600');
  const [criticalPeak, setCriticalPeak] = useState(motor?.critical_peak?.toString() || '1.000');

  // Offline timeout & sampling
  const [offlineTimeout, setOfflineTimeout] = useState('75');
  const [samplingRate] = useState('512 pts @ 500 Hz');
  const [uplinkInterval] = useState('30 seconds');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveSuccess(false);

      await updateMotorSettingsApi({
        motorId: motor?.motor_id || 'MOTOR_01',
        tagName,
        location,
        ratedRpm: parseInt(ratedRpm, 10),
        ratedPowerKw: parseFloat(ratedPowerKw),
        warningRms: parseFloat(warningRms),
        criticalRms: parseFloat(criticalRms),
        warningPeak: parseFloat(warningPeak),
        criticalPeak: parseFloat(criticalPeak),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedHistory = async () => {
    try {
      setIsSeeding(true);
      const count = await seedHistoryApi(48);
      setSimMessage(`Seeded ${count} baseline telemetry records into SQLite.`);
      setTimeout(() => setSimMessage(null), 5000);
      onRefresh();
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSimulate = async (preset: 'normal' | 'warning' | 'critical' | 'sensor_fault') => {
    try {
      let payload: any = {
        motorId: motor?.motor_id || 'MOTOR_01',
        devEui: device?.dev_eui || '0000000000000001',
      };

      if (preset === 'normal') {
        payload = {
          ...payload,
          overallRms: 0.185,
          peak: 0.340,
          crestFactor: 1.84,
          temperature: 28.4,
          sensorStatus: 'OK',
        };
      } else if (preset === 'warning') {
        payload = {
          ...payload,
          overallRms: 0.320,
          peak: 0.720,
          crestFactor: 2.25,
          temperature: 34.2,
          sensorStatus: 'OK',
        };
      } else if (preset === 'critical') {
        payload = {
          ...payload,
          overallRms: 0.520,
          peak: 1.150,
          crestFactor: 2.21,
          temperature: 42.6,
          sensorStatus: 'OK',
        };
      } else if (preset === 'sensor_fault') {
        payload = {
          ...payload,
          overallRms: 0.0,
          peak: 0.0,
          crestFactor: 0.0,
          temperature: 0.0,
          sensorStatus: 'ERROR',
        };
      }

      const res = await simulateUplinkApi(payload);
      setSimMessage(`Uplink simulated (${preset.toUpperCase()})! RMS: ${payload.overallRms}g, Health: ${res.measurement.health_status}`);
      setTimeout(() => setSimMessage(null), 6000);
      onRefresh();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  return (
    <div id="settings-view" className="space-y-6">
      {/* Three-Tiered Threshold Architecture Explanation Card */}
      <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
              Threshold Hierarchy & Engineering Standards
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This condition-monitoring prototype categorizes vibration limits across three distinct tiers so you never rely on arbitrary fixed values:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3.5 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80">
                <span className="text-cyan-400 font-bold block mb-1">1. User-Configured Limits</span>
                <span className="text-slate-300 text-[11px] block">
                  Current: Warn = {warningRms}g, Crit = {criticalRms}g. Fully adjustable below to match specific field observations and site tolerance.
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80">
                <span className="text-emerald-400 font-bold block mb-1">2. Engineering Baseline</span>
                <span className="text-slate-300 text-[11px] block">
                  0.185g RMS. Derived from healthy, freshly lubricated baseline recordings of this 11kW motor at nominal 1440 RPM full-load speed.
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80">
                <span className="text-amber-400 font-bold block mb-1">3. ISO Standards Reference</span>
                <span className="text-slate-300 text-[11px] block">
                  ISO 10816-3 / ISO 20816-3 Class II (Medium industrial machines 15-75kW, rigid mounting): Zone A ≤ 0.16g, Zone B ≤ 0.28g, Zone C ≤ 0.45g.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Asset & Alarm Threshold Configuration</h2>
          </div>
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved in SQLite!
            </div>
          )}
        </div>

        {/* Motor Identity Fields */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Motor Identity & Machine Specifications
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Motor Asset ID</label>
              <input
                type="text"
                disabled
                value={motor?.motor_id || 'MOTOR_01'}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Tag Name / Designation</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Physical Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Rated Power (kW)</label>
              <input
                type="number"
                step="0.1"
                value={ratedPowerKw}
                onChange={(e) => setRatedPowerKw(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Alarm Thresholds */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Vibration Alarm Thresholds (Engineering Units in 'g')
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="block text-amber-300 mb-1 font-semibold">RMS Warning Threshold (g)</label>
              <input
                type="number"
                step="0.01"
                value={warningRms}
                onChange={(e) => setWarningRms(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-200 focus:border-amber-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Baseline: 0.28g (ISO Zone B/C)</span>
            </div>

            <div>
              <label className="block text-red-400 mb-1 font-semibold">RMS Critical Threshold (g)</label>
              <input
                type="number"
                step="0.01"
                value={criticalRms}
                onChange={(e) => setCriticalRms(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-red-500/40 text-red-200 focus:border-red-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Baseline: 0.45g (ISO Zone C/D)</span>
            </div>

            <div>
              <label className="block text-amber-300 mb-1 font-semibold">Peak Warning Limit (g)</label>
              <input
                type="number"
                step="0.05"
                value={warningPeak}
                onChange={(e) => setWarningPeak(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-200 focus:border-amber-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Baseline: 0.60g</span>
            </div>

            <div>
              <label className="block text-red-400 mb-1 font-semibold">Peak Critical Limit (g)</label>
              <input
                type="number"
                step="0.05"
                value={criticalPeak}
                onChange={(e) => setCriticalPeak(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-red-500/40 text-red-200 focus:border-red-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Baseline: 1.00g</span>
            </div>
          </div>
        </div>

        {/* Node & Communication Timing */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Edge Node & Telemetry Parameters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">LoRa DevEUI</label>
              <input
                type="text"
                disabled
                value={device?.dev_eui || '0000000000000001'}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">AppKey / NwkKey hidden for security</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Node Offline Timeout (Seconds)</label>
              <input
                type="number"
                value={offlineTimeout}
                onChange={(e) => setOfflineTimeout(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default: 75s (2.5x uplink rate)</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Sensor Sampling Configuration</label>
              <input
                type="text"
                disabled
                value={`${samplingRate} | ${uplinkInterval}`}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Configured in ESP32 firmware</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving to Database...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Bench Testing & Telemetry Simulation Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">Bench Simulation & Telemetry Generator</h2>
          </div>
          <button
            type="button"
            onClick={handleSeedHistory}
            disabled={isSeeding}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            {isSeeding ? 'Seeding...' : 'Seed 24h Baseline History (48 pts)'}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Inject real 13-byte LoRaWAN telemetry packets directly through the decoding pipeline to test alarm triggering and real-time dashboard updates without needing a physical motor on the desk.
        </p>

        {simMessage && (
          <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-200 text-xs font-mono">
            {simMessage}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleSimulate('normal')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 transition text-center"
          >
            <span className="block font-bold text-xs">NORMAL BENCH</span>
            <span className="text-[10px] text-slate-400 mt-1 block">RMS: 0.185g (Nominal)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulate('warning')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-amber-950/40 border border-amber-500/40 text-amber-300 transition text-center"
          >
            <span className="block font-bold text-xs">WARNING SPIKE</span>
            <span className="text-[10px] text-slate-400 mt-1 block">RMS: 0.320g (&gt; 0.28g)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulate('critical')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-red-950/40 border border-red-500/40 text-red-300 transition text-center"
          >
            <span className="block font-bold text-xs">CRITICAL FAULT</span>
            <span className="text-[10px] text-slate-400 mt-1 block">RMS: 0.520g (&gt; 0.45g)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulate('sensor_fault')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-purple-950/40 border border-purple-500/40 text-purple-300 transition text-center"
          >
            <span className="block font-bold text-xs">SENSOR ERROR</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Status: 0x00 (I2C Fault)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
