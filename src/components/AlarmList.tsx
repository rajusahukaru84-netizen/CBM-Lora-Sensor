import React, { useState } from 'react';
import { Alarm } from '../types';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Check,
  Radio,
  ShieldAlert,
  Info,
  Sparkles,
  Cpu,
  XCircle,
} from 'lucide-react';

interface AlarmListProps {
  alarms: Alarm[];
  onAcknowledge: (alarmId: number) => Promise<void>;
  onClear?: (alarmId: number) => Promise<void>;
  isNodeOnline: boolean;
  isSensorOk: boolean;
}

export const AlarmList: React.FC<AlarmListProps> = ({
  alarms,
  onAcknowledge,
  onClear,
  isNodeOnline,
  isSensorOk,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'unack' | 'cleared'>('all');
  const [actingId, setActingId] = useState<number | null>(null);

  const handleAck = async (id: number) => {
    try {
      setActingId(id);
      await onAcknowledge(id);
    } catch (err) {
      console.error('Failed to acknowledge alarm:', err);
    } finally {
      setActingId(null);
    }
  };

  const handleClear = async (id: number) => {
    if (!onClear) return;
    try {
      setActingId(id);
      await onClear(id);
    } catch (err) {
      console.error('Failed to clear alarm:', err);
    } finally {
      setActingId(null);
    }
  };

  const filteredAlarms = alarms.filter((a) => {
    if (filterMode === 'active') return a.cleared === 0;
    if (filterMode === 'unack') return a.acknowledged === 0 && a.cleared === 0;
    if (filterMode === 'cleared') return a.cleared === 1;
    return true;
  });

  const getSeverityBadge = (severity: Alarm['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'ANOMALY':
        return {
          icon: <Sparkles className="w-3 h-3" />,
          color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        };
      case 'SENSOR_ERROR':
        return {
          icon: <Cpu className="w-3 h-3" />,
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'COMM_ERROR':
        return {
          icon: <Radio className="w-3 h-3" />,
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      default:
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          color: 'bg-slate-700 text-slate-300 border-slate-600',
        };
    }
  };

  return (
    <div id="alarm-section" className="space-y-5">
      {/* Real-time System Fault Detection Banners */}
      {(!isNodeOnline || !isSensorOk) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isNodeOnline && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/60 text-rose-200 flex items-start gap-3 shadow-md">
              <Radio className="w-5 h-5 text-rose-400 mt-0.5 shrink-0 animate-pulse" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  ESP32 LoRaWAN Communication Timeout (Offline)
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Gateway has not received an uplink packet in &gt; 75 seconds. Inspect power supply, antenna connection, or RF interference.
                </p>
              </div>
            </div>
          )}

          {!isSensorOk && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-200 flex items-start gap-3 shadow-md">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  MPU6050 Vibration Sensor Fault
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sensor hardware status flag reported FAULT. Check I2C bus wiring (SDA/SCL) or probe physical attachment.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Alarms Table Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                Condition Monitoring Alarm & Anomaly Console
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated baseline deviation anomalies and threshold alarms with persistence verification and operator audit trail.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-slate-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({alarms.length})
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterMode === 'active'
                  ? 'bg-rose-600/30 text-rose-300 font-bold border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({alarms.filter((a) => a.cleared === 0).length})
            </button>
            <button
              onClick={() => setFilterMode('unack')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterMode === 'unack'
                  ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unack ({alarms.filter((a) => a.acknowledged === 0 && a.cleared === 0).length})
            </button>
            <button
              onClick={() => setFilterMode('cleared')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterMode === 'cleared'
                  ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cleared ({alarms.filter((a) => a.cleared === 1).length})
            </button>
          </div>
        </div>

        {/* Table / List */}
        <div className="mt-4 overflow-x-auto">
          {filteredAlarms.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
              <p className="text-sm font-semibold text-slate-300">No alarms matching filter</p>
              <p className="text-xs text-slate-500 mt-0.5">Motor is operating within baseline parameters.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Parameter</th>
                  <th className="py-3 px-3">Motor ID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Measured</th>
                  <th className="py-3 px-3">Threshold</th>
                  <th className="py-3 px-3">Message</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredAlarms.map((alarm) => {
                  const isCrit = alarm.severity === 'CRITICAL';
                  const badge = getSeverityBadge(alarm.severity);
                  const isCleared = alarm.cleared === 1;

                  const dateStr = new Date(alarm.triggered_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr
                      key={alarm.alarm_id}
                      className={`hover:bg-slate-800/40 transition ${
                        !isCleared
                          ? isCrit
                            ? 'bg-rose-950/20'
                            : 'bg-amber-950/10'
                          : 'opacity-70'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.color}`}
                        >
                          {badge.icon}
                          {alarm.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {alarm.parameter}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{alarm.motor_id}</td>
                      <td className="py-3 px-3 text-slate-400 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {dateStr}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-100">
                        {alarm.measured_value > 0 ? `${alarm.measured_value} g` : 'FAULT'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {alarm.threshold_limit > 0 ? `${alarm.threshold_limit} g` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans max-w-xs truncate" title={alarm.message}>
                        {alarm.message}
                      </td>
                      <td className="py-3 px-3">
                        {isCleared ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-800">
                            CLEARED
                          </span>
                        ) : alarm.acknowledged ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/50 text-purple-400 border border-purple-800">
                            ACK&apos;D
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/50 text-rose-400 border border-rose-800 animate-pulse">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!alarm.acknowledged && !isCleared && (
                            <button
                              onClick={() => handleAck(alarm.alarm_id)}
                              disabled={actingId === alarm.alarm_id}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 hover:text-white text-xs font-mono font-semibold transition disabled:opacity-50"
                            >
                              {actingId === alarm.alarm_id ? 'Saving...' : 'Acknowledge'}
                            </button>
                          )}
                          {!isCleared && onClear && (
                            <button
                              onClick={() => handleClear(alarm.alarm_id)}
                              disabled={actingId === alarm.alarm_id}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 hover:text-white text-xs font-mono font-semibold transition disabled:opacity-50"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* SCADA Notice */}
        <div className="mt-5 p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <p>
            Phase 8 anti-flooding filters require sustained consecutive measurements above thresholds before raising persistent alarms.
            When motor vibration normalizes below limits, alarms are automatically transitioned to Cleared status.
          </p>
        </div>
      </div>
    </div>
  );
};
