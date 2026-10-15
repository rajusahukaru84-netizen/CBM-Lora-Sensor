import React, { useState, useEffect } from 'react';
import { TimelineEvent } from '../types';
import { getTimelineEventsApi } from '../services/api';
import {
  Clock,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Radio,
  BookmarkCheck,
  Sparkles,
  Filter,
} from 'lucide-react';

interface EventTimelineTabProps {
  motorId?: string;
  onRefresh?: () => void;
}

export const EventTimelineTab: React.FC<EventTimelineTabProps> = ({
  motorId = 'MOTOR_01',
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const data = await getTimelineEventsApi(motorId, 60);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load event timeline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [motorId]);

  const filteredEvents = events.filter((e) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'ALARMS') return ['WARNING', 'CRITICAL', 'SENSOR_ERROR', 'COMM_ERROR'].includes(e.type);
    if (filterType === 'ANOMALIES') return e.type === 'ANOMALY';
    if (filterType === 'ACTIONS') return ['ACKNOWLEDGED', 'CLEARED', 'BASELINE_CREATED'].includes(e.type);
    return true;
  });

  const getEventBadge = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'CRITICAL':
        return {
          icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
          bg: 'bg-rose-950/60 border-rose-800 text-rose-300',
          dot: 'bg-rose-500',
          label: 'CRITICAL ALARM',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-950/60 border-amber-800 text-amber-300',
          dot: 'bg-amber-500',
          label: 'WARNING ALARM',
        };
      case 'ANOMALY':
        return {
          icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
          bg: 'bg-cyan-950/60 border-cyan-800 text-cyan-300',
          dot: 'bg-cyan-500',
          label: 'VIBRATION ANOMALY',
        };
      case 'SENSOR_ERROR':
        return {
          icon: <Cpu className="w-4 h-4 text-rose-400" />,
          bg: 'bg-rose-950/60 border-rose-800 text-rose-300',
          dot: 'bg-rose-500',
          label: 'SENSOR ERROR',
        };
      case 'COMM_ERROR':
        return {
          icon: <Radio className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-950/60 border-amber-800 text-amber-300',
          dot: 'bg-amber-500',
          label: 'COMM TIMEOUT',
        };
      case 'ACKNOWLEDGED':
        return {
          icon: <BookmarkCheck className="w-4 h-4 text-purple-400" />,
          bg: 'bg-purple-950/60 border-purple-800 text-purple-300',
          dot: 'bg-purple-500',
          label: 'OPERATOR ACK',
        };
      case 'CLEARED':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          bg: 'bg-emerald-950/60 border-emerald-800 text-emerald-300',
          dot: 'bg-emerald-500',
          label: 'ALARM CLEARED',
        };
      case 'BASELINE_CREATED':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
          bg: 'bg-blue-950/60 border-blue-800 text-blue-300',
          dot: 'bg-blue-500',
          label: 'BASELINE CALIBRATED',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-400" />,
          bg: 'bg-slate-900 border-slate-800 text-slate-300',
          dot: 'bg-slate-500',
          label: 'EVENT',
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Filter Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Unified Event Timeline & Audit Trail
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Chronological aggregation of baseline deviations, anomaly triggers, threshold alarms, and operator responses.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded ${filterType === 'ALL' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('ALARMS')}
              className={`px-2.5 py-1 rounded ${filterType === 'ALARMS' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Alarms
            </button>
            <button
              onClick={() => setFilterType('ANOMALIES')}
              className={`px-2.5 py-1 rounded ${filterType === 'ANOMALIES' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Anomalies
            </button>
            <button
              onClick={() => setFilterType('ACTIONS')}
              className={`px-2.5 py-1 rounded ${filterType === 'ACTIONS' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Operator Actions
            </button>
          </div>

          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        {isLoading && events.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            Loading event timeline...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No events found matching the selected filter.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-6">
            {filteredEvents.map((evt) => {
              const badge = getEventBadge(evt.type);
              const eventDate = new Date(evt.timestamp);

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${badge.dot} shadow-sm group-hover:scale-125 transition`}
                  />

                  {/* Event Card */}
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-4 hover:border-slate-700 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border ${badge.bg}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100">{evt.title}</h4>
                      </div>

                      <div className="text-xs font-mono text-slate-400">
                        {eventDate.toLocaleTimeString()} &middot; {eventDate.toLocaleDateString()}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {evt.details}
                    </p>

                    {(evt.value !== undefined || evt.limit !== undefined || evt.sequence !== undefined) && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-4 text-xs font-mono text-slate-400">
                        {evt.value !== undefined && (
                          <span>
                            Measured: <strong className="text-slate-200">{evt.value}g</strong>
                          </span>
                        )}
                        {evt.limit !== undefined && (
                          <span>
                            Threshold: <span className="text-slate-300">{evt.limit}g</span>
                          </span>
                        )}
                        {evt.sequence !== undefined && (
                          <span>
                            Uplink Seq: <span className="text-slate-300">#{evt.sequence}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
