import React from 'react';
import {
  Activity,
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Clock,
  FileText,
  Sliders,
  Terminal,
  Info,
  Award,
} from 'lucide-react';
import { Motor, Device, Measurement, Alarm, ActiveTab } from '../types';

interface HeaderProps {
  motor: Motor | null;
  device: Device | null;
  latest: Measurement | null;
  alarms: Alarm[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'POLLING';
  onManualRefresh: () => void;
  isRefreshing: boolean;
  onOpenLimitations: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  motor,
  device,
  latest,
  alarms,
  activeTab,
  setActiveTab,
  wsStatus,
  onManualRefresh,
  isRefreshing,
  onOpenLimitations,
}) => {
  const unackAlarms = alarms.filter((a) => !a.acknowledged && !a.cleared).length;

  const healthStatus = latest?.health_status || 'NORMAL';
  const isOnline = device?.status === 'ONLINE';
  const healthScore = latest?.health_score ?? 95;

  const healthBadgeColor =
    healthStatus === 'CRITICAL'
      ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
      : healthStatus === 'WARNING'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';

  return (
    <header id="cbm-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* Top Banner: Asset Identity & Primary Health Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                ASSET {motor?.motor_id || 'MOTOR_01'}
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {motor?.tag_name || 'Cooling Tower Feed Pump Motor 01'}
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>LOC: {motor?.location || 'Drive-End Bearing Bay #3'}</span>
              <span>&bull;</span>
              <span>RATED: {motor?.rated_power_kw || 11} kW @ {motor?.rated_rpm || 1440} RPM</span>
            </p>
          </div>
        </div>

        {/* Global Status Badges */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* CBM Health Score & Status Badge */}
          <div className={`px-3 py-1.5 rounded-md border text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-sm ${healthBadgeColor}`}>
            {healthStatus === 'CRITICAL' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : healthStatus === 'WARNING' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>CBM: {healthStatus} ({healthScore}/100)</span>
          </div>

          {/* ESP32 LoRa Node Heartbeat */}
          <div className="px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-mono flex items-center gap-1.5">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">NODE: {isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* LoRaWAN Link Status */}
          <div className="px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-mono flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">
              LoRaWAN: {isOnline ? 'CONNECTED' : 'STANDBY'}
            </span>
          </div>

          {/* Live Telemetry Stream */}
          <div className="px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-mono flex items-center gap-1.5">
            {wsStatus === 'CONNECTED' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">LIVE WS</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">POLLING</span>
              </>
            )}
          </div>

          {/* Engineering Limitations Button */}
          <button
            onClick={onOpenLimitations}
            title="View Phase 8 CBM Engineering Limitations & Disclaimers"
            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 hover:text-amber-200 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Limitations</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            id="btn-manual-refresh"
            onClick={onManualRefresh}
            title="Force refresh telemetry from SQLite"
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Industrial SCADA Tab Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/70">
        <nav className="flex space-x-1 sm:space-x-1.5 overflow-x-auto py-2 text-xs font-medium tracking-wide scrollbar-none">
          <button
            id="tab-btn-overview"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            id="tab-btn-commissioning"
            onClick={() => setActiveTab('commissioning')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'commissioning'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validation & Commissioning</span>
          </button>

          <button
            id="tab-btn-predictive"
            onClick={() => setActiveTab('predictive-maintenance')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'predictive-maintenance'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Predictive & RUL (Phase 12)</span>
          </button>

          <button
            id="tab-btn-intelligence"
            onClick={() => setActiveTab('intelligence')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'intelligence'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>CBM Intelligence</span>
          </button>

          <button
            id="tab-btn-timeline"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Event Timeline</span>
          </button>

          <button
            id="tab-btn-report"
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Health Report</span>
          </button>

          <button
            id="tab-btn-alarms"
            onClick={() => setActiveTab('alarms')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap relative ${
              activeTab === 'alarms'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alarms</span>
            {unackAlarms > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unackAlarms}
              </span>
            )}
          </button>

          <button
            id="tab-btn-motor-details"
            onClick={() => setActiveTab('motor-details')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'motor-details'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Tri-Axis Kinematics</span>
          </button>

          <button
            id="tab-btn-trends"
            onClick={() => setActiveTab('trends')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'trends'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Trends</span>
          </button>

          <button
            id="tab-btn-frequency-analysis"
            onClick={() => setActiveTab('frequency-analysis')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'frequency-analysis'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>FFT Spectrum</span>
          </button>

          <button
            id="tab-btn-firmware-deploy"
            onClick={() => setActiveTab('firmware-deploy')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'firmware-deploy'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Firmware & Deploy</span>
          </button>

          <button
            id="tab-btn-fft-prep"
            onClick={() => setActiveTab('fft-prep')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fft-prep'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>FFT Math & Design</span>
          </button>

          <button
            id="tab-btn-test-suite"
            onClick={() => setActiveTab('test-suite')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'test-suite'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test Suite</span>
          </button>

          <button
            id="tab-btn-system-flow"
            onClick={() => setActiveTab('system-flow')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'system-flow'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Signal Chain</span>
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
