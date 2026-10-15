import React from 'react';

interface MetricCardProps {
  id: string;
  title: string;
  value: number | string | null | undefined;
  unit: string;
  warningLimit?: number;
  criticalLimit?: number;
  description?: string;
  status?: 'NORMAL' | 'WARNING' | 'CRITICAL';
  secondaryValue?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  unit,
  warningLimit,
  criticalLimit,
  description,
  status = 'NORMAL',
  secondaryValue,
  icon,
}) => {
  const numericVal = typeof value === 'number' ? value : parseFloat(value as string);
  const isValid = !isNaN(numericVal);

  let statusColor = 'text-emerald-400 border-slate-700/80 bg-slate-800/80';
  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  if (status === 'CRITICAL') {
    statusColor = 'text-red-400 border-red-500/50 bg-red-950/20';
    badgeColor = 'bg-red-500/20 text-red-400 border-red-500/40';
  } else if (status === 'WARNING') {
    statusColor = 'text-amber-400 border-amber-500/50 bg-amber-950/20';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  // Calculate percentage of critical limit for progress bar
  const maxScale = criticalLimit ? criticalLimit * 1.35 : 1.0;
  const progressPct = isValid ? Math.min(100, Math.max(0, (numericVal / maxScale) * 100)) : 0;
  const warnPct = warningLimit && maxScale ? (warningLimit / maxScale) * 100 : 60;
  const critPct = criticalLimit && maxScale ? (criticalLimit / maxScale) * 100 : 85;

  return (
    <div
      id={id}
      className={`relative rounded-xl border p-4.5 transition-all shadow-md backdrop-blur-sm ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <div className="text-slate-400">{icon}</div>}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeColor}`}>
          {status}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-2.5xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
          {isValid ? numericVal.toFixed(3) : '—'}
        </span>
        <span className="text-sm font-mono font-semibold text-slate-400">{unit}</span>
      </div>

      {/* Progress Bar with Threshold Markers */}
      {warningLimit !== undefined && criticalLimit !== undefined && (
        <div className="mt-3.5">
          <div className="relative h-2 w-full bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/60">
            {/* Warning limit marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${warnPct}%` }}
              title={`Warning: ${warningLimit}${unit}`}
            />
            {/* Critical limit marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: `${critPct}%` }}
              title={`Critical: ${criticalLimit}${unit}`}
            />
            {/* Value fill */}
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                status === 'CRITICAL' ? 'bg-red-500' : status === 'WARNING' ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400">
            <span>0.00</span>
            <span className="text-amber-400/90">Warn: {warningLimit.toFixed(2)}</span>
            <span className="text-red-400/90">Crit: {criticalLimit.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Auxiliary Info */}
      <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">{description || 'Baseline: Nominal'}</span>
        {secondaryValue && <span className="font-mono text-slate-300 text-[11px]">{secondaryValue}</span>}
      </div>
    </div>
  );
};
