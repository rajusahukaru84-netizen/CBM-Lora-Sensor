import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Wrench,
  FileText,
  Download,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Package,
  ArrowUpRight,
  Info,
  HelpCircle,
  Plus,
  Play,
  Gauge,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Motor, Measurement, Baseline, CbmConfig, RulAnalysisResult, MaintenanceWorkOrder } from '../types';

interface PredictiveMaintenanceTabProps {
  selectedMotor: Motor;
  latestMeasurement: Measurement | null;
  activeBaseline: Baseline | null;
  cbmConfig: CbmConfig | null;
}

export function PredictiveMaintenanceTab({
  selectedMotor,
  latestMeasurement,
  activeBaseline,
}: PredictiveMaintenanceTabProps) {
  const [rulData, setRulData] = useState<RulAnalysisResult | null>(null);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationNote, setSimulationNote] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<'rul' | 'work-orders' | 'stages' | 'theory'>('rul');

  // Work Order Modal State
  const [showCreateWoModal, setShowCreateWoModal] = useState(false);
  const [newWoTitle, setNewWoTitle] = useState('');
  const [newWoPriority, setNewWoPriority] = useState<'ROUTINE' | 'ELEVATED' | 'HIGH' | 'EMERGENCY'>('HIGH');
  const [newWoHours, setNewWoHours] = useState('3.5');
  const [newWoTrigger, setNewWoTrigger] = useState('');
  const [newWoSop1, setNewWoSop1] = useState('');
  const [newWoSop2, setNewWoSop2] = useState('');
  const [newWoPartNum, setNewWoPartNum] = useState('');
  const [newWoPartDesc, setNewWoPartDesc] = useState('');
  const [isSubmittingWo, setIsSubmittingWo] = useState(false);

  // Fetch RUL and Work Orders
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rulRes, woRes] = await Promise.all([
        fetch(`/api/predictive/rul/${selectedMotor.motor_id}`),
        fetch(`/api/predictive/work-orders?motorId=${selectedMotor.motor_id}`),
      ]);

      if (rulRes.ok) {
        const data = await rulRes.json();
        setRulData(data);
      }

      if (woRes.ok) {
        const data = await woRes.json();
        setWorkOrders(data.workOrders || []);
      }
    } catch (err) {
      console.error('[RUL] Error fetching predictive data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMotor.motor_id, latestMeasurement?.recorded_at]);

  // Handle Simulation
  const handleSimulateMode = async (mode: string) => {
    try {
      setIsSimulating(true);
      setSimulationNote(null);
      const res = await fetch('/api/predictive/simulate-degradation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorId: selectedMotor.motor_id,
          mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationNote(data.explanation);
        await fetchData();
      }
    } catch (err) {
      console.error('[SIM] Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Update Work Order Status
  const handleUpdateWoStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/predictive/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setWorkOrders((prev) =>
          prev.map((wo) => (wo.id === id ? { ...wo, status: newStatus as any } : wo))
        );
      }
    } catch (err) {
      console.error('[WO] Status update failed:', err);
    }
  };

  // Create Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWoTitle.trim()) return;

    try {
      setIsSubmittingWo(true);
      const actions = [newWoSop1.trim(), newWoSop2.trim()].filter(Boolean);
      const parts = newWoPartNum.trim()
        ? [{ partNumber: newWoPartNum.trim(), description: newWoPartDesc.trim() || 'Replacement Spare', quantity: 1 }]
        : [];

      const res = await fetch('/api/predictive/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorId: selectedMotor.motor_id,
          motorTag: selectedMotor.tag_name,
          title: newWoTitle,
          priority: newWoPriority,
          status: 'OPEN',
          triggerCondition: newWoTrigger || `Predictive RUL Warning: ${rulData?.estimatedRulHours || 120}h estimated remaining`,
          detectedFaultSignature: rulData?.bearingStage.title || 'Bearing degradation vibration signature',
          prescribedActions: actions.length > 0 ? actions : ['Inspect bearing clearances with feeler gauges', 'Verify lubrication grease condition and color', 'Re-torque mounting bolts'],
          recommendedParts: parts,
          estimatedLaborHours: parseFloat(newWoHours) || 3.0,
          targetCompletionHours: 24.0,
        }),
      });

      if (res.ok) {
        setShowCreateWoModal(false);
        setNewWoTitle('');
        setNewWoTrigger('');
        setNewWoSop1('');
        setNewWoSop2('');
        setNewWoPartNum('');
        setNewWoPartDesc('');
        await fetchData();
      }
    } catch (err) {
      console.error('[WO] Failed to create work order:', err);
    } finally {
      setIsSubmittingWo(false);
    }
  };

  // Helper colors
  const getRulColor = (hours: number) => {
    if (hours > 1000) return 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50';
    if (hours > 200) return 'text-amber-400 bg-amber-950/40 border-amber-700/50';
    if (hours > 48) return 'text-orange-400 bg-orange-950/40 border-orange-700/50';
    return 'text-rose-400 bg-rose-950/40 border-rose-700/50 animate-pulse';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'bg-rose-500/20 text-rose-300 border-rose-600/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-600/40';
      case 'ELEVATED':
        return 'bg-amber-500/20 text-amber-300 border-amber-600/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40';
      case 'IN_PROGRESS':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-600/40';
      case 'SCHEDULED':
        return 'bg-blue-500/20 text-blue-300 border-blue-600/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  // Chart preparation data
  const chartData = (rulData?.projectionPoints || []).map((p) => ({
    timeLabel: `+${p.hoursAhead}h`,
    hoursAhead: p.hoursAhead,
    projectedRms: p.projectedRms,
    lowerBound: p.lowerBoundRms,
    upperBound: p.upperBoundRms,
    confidenceSpread: [p.lowerBoundRms, p.upperBoundRms],
    projectedPeak: p.projectedPeak,
    healthIndex: p.healthIndex,
    warningLimit: rulData?.warningThresholdRms || 0.28,
    criticalLimit: rulData?.criticalThresholdRms || 0.45,
  }));

  const bearingStages = [
    {
      stage: 1,
      title: 'Stage 1: Sub-surface Micro-fatigue',
      tag: 'STAGE_1_SUBSURFACE',
      freq: '20 kHz - 40 kHz (Acoustic / Ultrasonic)',
      cf: '1.5 - 2.4 (Normal)',
      symptoms: 'Microscopic shear cracks below raceway skin; invisible to naked eye; low-frequency vibration is nominal.',
      action: 'Routine monitoring; enforce ISO cleanliness and standard lubrication schedule.',
      icon: ShieldCheck,
      color: 'emerald',
    },
    {
      stage: 2,
      title: 'Stage 2: Micro-surface Defects & Ringing',
      tag: 'STAGE_2_SURFACE_MICRODEFECT',
      freq: '500 Hz - 2000 Hz (Component Natural Resonances)',
      cf: '2.5 - 4.2 (Rising)',
      symptoms: 'Micro-pits break through race surface; impacts excite bearing natural frequencies; slight RMS elevation.',
      action: 'Perform ultrasonic lubrication check; purge and inject synthetic grease; trend weekly.',
      icon: Activity,
      color: 'amber',
    },
    {
      stage: 3,
      title: 'Stage 3: Defect Frequencies & 1X Sidebands',
      tag: 'STAGE_3_DEFECT_FREQUENCIES',
      freq: 'BPFO, BPFI, BSF, FTF + 1X Sidebands',
      cf: '3.5 - 6.0+ (Peak Elevation)',
      symptoms: 'Visible spalling and flaking on raceways; discrete impact impulses; RMS accelerating into Warning zone.',
      action: 'Procure replacement bearings (e.g. SKF 6308-2Z); schedule replacement during planned plant outage.',
      icon: AlertTriangle,
      color: 'orange',
    },
    {
      stage: 4,
      title: 'Stage 4: Catastrophic Seizure Imminent',
      tag: 'STAGE_4_CATASTROPHIC_IMMINENT',
      freq: 'Broadband Random Noise ("Grass") + 1X/2X harmonics',
      cf: '< 2.5 (Paradoxical Drop)',
      symptoms: 'Raceway destruction, cage rupture; continuous metal-on-metal grinding masks discrete peaks; thermal runaway >65°C.',
      action: 'IMMEDIATE EMERGENCY SHUTDOWN. Stop motor immediately to avoid rotor lockup or fire.',
      icon: AlertOctagon,
      color: 'rose',
    },
  ];

  const currentStageNum = rulData?.bearingStage.stageNumber || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Predictive Maintenance & Degradation Modeling (RUL)
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Phase 12
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extrapolating Remaining Useful Life (RUL) using exponential degradation curves & dispatching CMMS work orders for {selectedMotor.tag_name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
            <button
              onClick={() => setShowCreateWoModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Work Order</span>
            </button>
          </div>
        </div>

        {/* Sub-view Navigation */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubView('rul')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeSubView === 'rul'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>RUL Projection & Degradation Curve</span>
          </button>
          <button
            onClick={() => setActiveSubView('stages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeSubView === 'stages'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4-Stage Bearing Life Cycle</span>
          </button>
          <button
            onClick={() => setActiveSubView('work-orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeSubView === 'work-orders'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>CMMS Work Orders ({workOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('theory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeSubView === 'theory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Formulas & Physics Theory</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Status Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Estimated RUL */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Remaining Useful Life (RUL)</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {rulData ? rulData.estimatedRulHours.toLocaleString() : '---'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">Hours</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getRulColor(
                  rulData?.estimatedRulHours || 9999
                )}`}
              >
                ≈ {rulData?.estimatedRulDays || '---'} Operating Days
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Conf: {rulData?.confidenceScorePct || 85}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Bearing Degradation Stage */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Degradation Stage</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span>Stage {currentStageNum} of 4</span>
            </div>
            <p className="text-[11px] text-amber-300 font-medium line-clamp-1 mt-1">
              {rulData?.bearingStage.title || 'Stage 1: Sub-surface Micro-fatigue'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
              <span>CF: <strong className="text-slate-200 font-mono">{rulData?.currentCrestFactor.toFixed(2) || '1.89'}</strong></span>
              <span>•</span>
              <span>Temp: <strong className="text-slate-200 font-mono">{rulData?.currentTemperatureC || 36.5}°C</strong></span>
            </div>
          </div>
        </div>

        {/* Card 3: Overall Health Index */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Asset Health Index</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {rulData ? rulData.overallHealthIndex : '---'}%
              </span>
              <span className="text-[11px] text-slate-400">
                {rulData && rulData.overallHealthIndex > 80 ? 'Optimal' : rulData && rulData.overallHealthIndex > 50 ? 'Degraded' : 'Critical'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (rulData?.overallHealthIndex || 100) > 75
                    ? 'bg-emerald-500'
                    : (rulData?.overallHealthIndex || 100) > 40
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${rulData?.overallHealthIndex || 95}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Degradation Model & Threshold Margin */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Wear Model</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              <span className="text-cyan-300">
                {rulData?.activeModel === 'EXPONENTIAL' ? 'Exponential (Paris Law)' : 'Linear Steady Wear'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Warning Margin: <strong className="text-slate-200 font-mono">+{rulData?.hoursUntilWarning}h</strong> | Rate: <strong className="text-slate-200 font-mono">{rulData?.degradationSlopeGPerHour.toFixed(5)} g/h</strong>
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
              <span>RMS: <strong className="text-slate-200 font-mono">{rulData?.currentRms} g</strong></span>
              <span>/</span>
              <span>Crit: <strong className="text-slate-200 font-mono">{rulData?.criticalThresholdRms} g</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Alert Banner if Active */}
      {simulationNote && (
        <div className="p-3.5 bg-indigo-950/50 border border-indigo-700/60 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white font-semibold">Simulated Wear Mode Injected: </strong>
            <span>{simulationNote}</span>
          </div>
        </div>
      )}

      {/* Main Content Area Based on Sub-view */}
      {activeSubView === 'rul' && (
        <div className="space-y-6">
          {/* Main Chart Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span>Degradation Trajectory & RUL Horizon Extrapolation</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Projected RMS acceleration, 90% confidence uncertainty spread, and ISO critical threshold limits
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                  <span className="text-slate-300">Projected RMS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                  <span className="text-slate-300">Warning ({rulData?.warningThresholdRms || 0.28}g)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
                  <span className="text-slate-300">Critical ({rulData?.criticalThresholdRms || 0.45}g)</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" domain={[0, (dataMax: number) => Math.max(0.55, dataMax * 1.15)]} tick={{ fontSize: 11 }} unit="g" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  {/* Reference Lines for Warning and Critical */}
                  <ReferenceLine
                    y={rulData?.warningThresholdRms || 0.28}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Warning Limit', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <ReferenceLine
                    y={rulData?.criticalThresholdRms || 0.45}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: 'Critical Limit', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                  />
                  {/* Uncertainty Upper and Lower Band Area */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="none"
                    fill="#6366f1"
                    fillOpacity={0.12}
                    name="Upper Bound (90% Conf)"
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="none"
                    fill="#0f172a"
                    fillOpacity={1}
                  />
                  {/* Primary Projected Curve */}
                  <Line
                    type="monotone"
                    dataKey="projectedRms"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#818cf8' }}
                    name="Projected RMS (g)"
                  />
                  <Line
                    type="monotone"
                    dataKey="projectedPeak"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Projected Peak (g)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Model Fit R²: <strong className="text-slate-200 font-mono">{rulData?.historicalTrendSummary.rSquaredFit || 0.88}</strong></span>
                <span>•</span>
                <span>Observation Window: <strong className="text-slate-200 font-mono">48 Hours</strong></span>
              </div>
              <div className="text-[11px] text-slate-500">
                Extrapolations conform to ISO 13373-1 Condition Monitoring and Paris-Erdogan Fatigue Law
              </div>
            </div>
          </div>

          {/* Interactive Degradation Sandbox Simulator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-400" />
                  <span>Degradation Sandbox & Stress Test Controller</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulate mechanical wear scenarios to observe immediate RUL recalculation and CMMS dispatch triggering
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Motor ID: {selectedMotor.motor_id}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
              <button
                onClick={() => handleSimulateMode('STAGE_1_BASELINE')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-emerald-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">Stage 1</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Healthy Baseline</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">0.122g | RUL &gt; 8000h</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-emerald-300">Restore Baseline →</span>
              </button>

              <button
                onClick={() => handleSimulateMode('STAGE_2_LUBRICATION')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-amber-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Stage 2</span>
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Lubricant Starve</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">CF 3.4 | RUL ~340h</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-amber-300">Inject Starvation →</span>
              </button>

              <button
                onClick={() => handleSimulateMode('STAGE_3_SPALLING')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-orange-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-400">Stage 3</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Raceway Spall</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">0.302g | CF 4.6 | Warning</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-orange-300">Inject Spalling →</span>
              </button>

              <button
                onClick={() => handleSimulateMode('STAGE_4_IMMINENT')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-rose-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400">Stage 4</span>
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Pre-Seizure</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">0.441g | RUL &lt; 24h | Heat</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-rose-300">Emergency Trigger →</span>
              </button>

              <button
                onClick={() => handleSimulateMode('UNBALANCE_1X')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-cyan-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400">Harmonic</span>
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Rotor Unbalance</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">1X 24Hz dominant peak</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-cyan-300">Inject Unbalance →</span>
              </button>

              <button
                onClick={() => handleSimulateMode('MISALIGNMENT_2X')}
                disabled={isSimulating}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-left rounded-lg border border-slate-700 hover:border-purple-500/50 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400">Coupling</span>
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">Shaft Misalign</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">2X 48Hz + High Axial</p>
                </div>
                <span className="text-[9px] text-slate-400 font-medium mt-2 group-hover:text-purple-300">Inject Misalign →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Stage Bearing Life Cycle Sub-view */}
      {activeSubView === 'stages' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>The 4 Classical Stages of Rolling Element Bearing Failure</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Correlation of physical degradation, spectral frequency bands, crest factor progression, and required plant intervention
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-700/50">
                Current Motor Status: Stage {currentStageNum}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {bearingStages.map((stage) => {
                const isCurrent = currentStageNum === stage.stage;
                const IconComponent = stage.icon;

                return (
                  <div
                    key={stage.stage}
                    className={`rounded-xl p-4 border transition-all relative ${
                      isCurrent
                        ? 'bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-slate-900/60 border-slate-800 opacity-90'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white shadow-sm">
                        ACTIVE STATE
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">Stage {stage.stage}</span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200">{stage.title}</h4>

                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="bg-slate-950/50 p-2 rounded border border-slate-800/60">
                        <span className="text-slate-400 block text-[10px] font-semibold">Frequency Signature</span>
                        <span className="text-indigo-300 font-mono">{stage.freq}</span>
                      </div>

                      <div className="bg-slate-950/50 p-2 rounded border border-slate-800/60">
                        <span className="text-slate-400 block text-[10px] font-semibold">Crest Factor Behavior</span>
                        <span className="text-amber-300 font-mono">{stage.cf}</span>
                      </div>

                      <div className="pt-1">
                        <span className="text-slate-400 block text-[10px] font-semibold">Physical Manifestation</span>
                        <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{stage.symptoms}</p>
                      </div>

                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400 block text-[10px] font-semibold">Plant Action</span>
                        <p className="text-emerald-300 text-[11px] font-medium leading-relaxed mt-0.5">
                          {stage.action}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* In-depth Stage Diagnostic Explanation */}
            <div className="mt-6 p-4 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Info className="w-4 h-4 text-indigo-400" />
                <span>Crest Factor Paradox Explained (Why Crest Factor Drops in Stage 4)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                During <strong>Stage 2 and 3</strong>, microscopic defects cause sharp, discrete transient shock pulses against a relatively quiet background noise floor. Because <span className="font-mono text-slate-200">Crest Factor = Peak / RMS</span>, these extreme peaks inflate the Crest Factor up to 4.5 – 6.0+.
              </p>
              <p className="text-slate-400 leading-relaxed">
                However, when the bearing enters <strong>Stage 4 (imminent failure)</strong>, spalling covers the entire raceway and rolling elements deform. The continuous metal-on-metal rubbing generates high broadband random noise across the entire spectrum. This causes overall <strong>RMS vibration to surge dramatically</strong>. Because the baseline floor rises to meet the peaks, the Crest Factor <em>paradoxically falls back down</em> (often &lt; 2.5) even as the motor heads into catastrophic seizure.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CMMS Maintenance Work Orders Sub-view */}
      {activeSubView === 'work-orders' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-400" />
                  <span>Plant CMMS Maintenance Work Orders</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated work orders dispatched from RUL threshold breaches and predictive fault patterns
                </p>
              </div>

              <button
                onClick={() => setShowCreateWoModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Custom Work Order</span>
              </button>
            </div>

            {/* Work Orders List */}
            {workOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p>No open maintenance work orders found for this asset.</p>
                <p className="text-slate-500 mt-1">All predictive metrics are currently within nominal operating boundaries.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 transition hover:border-slate-700"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-sm">{wo.workOrderNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getPriorityBadge(wo.priority)}`}>
                          {wo.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(wo.status)}`}>
                          {wo.status}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">| {wo.motorTag}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={`/api/predictive/work-orders/${wo.id}/export`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium flex items-center gap-1 border border-slate-700 transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export Dispatch Sheet</span>
                        </a>

                        {wo.status !== 'COMPLETED' && (
                          <div className="flex items-center gap-1">
                            {wo.status !== 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleUpdateWoStatus(wo.id, 'IN_PROGRESS')}
                                className="px-2.5 py-1 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 rounded text-xs font-medium border border-cyan-700/50 transition"
                              >
                                Mark In Progress
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateWoStatus(wo.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 rounded text-xs font-medium border border-emerald-700/50 transition"
                            >
                              Complete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-white">{wo.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        <strong className="text-slate-300">Trigger:</strong> {wo.triggerCondition}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <strong className="text-slate-300">Vibration Signature:</strong> {wo.detectedFaultSignature}
                      </p>

                      {/* Prescribed SOP Steps */}
                      {wo.prescribedActions && wo.prescribedActions.length > 0 && (
                        <div className="mt-3 bg-slate-900/80 rounded-lg p-3 border border-slate-800/80">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                            Prescribed Standard Operating Procedures (SOP)
                          </span>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                            {wo.prescribedActions.map((action, idx) => (
                              <li key={idx} className="leading-relaxed">{action}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Recommended Spare Parts */}
                      {wo.recommendedParts && wo.recommendedParts.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Required Parts:</span>
                          {wo.recommendedParts.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono flex items-center gap-1"
                            >
                              <Package className="w-3 h-3 text-indigo-400" />
                              <span>{p.partNumber} ({p.quantity}x) - {p.description}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Timing and Estimates */}
                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span>Estimated Labor: <strong className="text-slate-200">{wo.estimatedLaborHours} hours</strong></span>
                          <span>•</span>
                          <span>Target Due: <strong className="text-slate-200 font-mono">{new Date(wo.targetDueDate).toLocaleDateString()}</strong></span>
                        </div>
                        <span className="text-slate-500">Created {new Date(wo.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Physics Theory & Formulas Sub-view */}
      {activeSubView === 'theory' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span>Predictive Degradation Mathematics & Engineering Standards</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Theoretical foundation of Remaining Useful Life (RUL) modeling and ISO 10816-3 severity criteria
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formula 1: Linear Degradation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-indigo-400 mb-2">
                  1. Linear Degradation Model (Steady Wear)
                </h4>
                <div className="bg-slate-900 p-3 rounded font-mono text-xs text-indigo-200 my-2">
                  RMS(t) = RMS₀ + m · t
                  <br />
                  RUL_crit = (T_crit - RMS_current) / m
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Used for machine assets exhibiting steady, unaccelerated mechanical friction and gradual abrasive wear. Slope <strong className="text-slate-200 font-mono">m</strong> is evaluated via ordinary least squares (OLS) linear regression across historical telemetry frames.
                </p>
              </div>

              {/* Formula 2: Exponential Degradation (Paris Law) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-400 mb-2">
                  2. Exponential Degradation Model (Paris Accelerated Wear Law)
                </h4>
                <div className="bg-slate-900 p-3 rounded font-mono text-xs text-cyan-200 my-2">
                  RMS(t) = RMS₀ · e^(β · t)
                  <br />
                  RUL_crit = ln(T_crit / RMS_current) / β
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Governs rolling element fatigue after a micro-spall breaches the surface. Under Paris-Erdogan crack propagation physics, stress concentrations multiply exponentially with each rotational load cycle until ultimate structural failure occurs.
                </p>
              </div>

              {/* Formula 3: Multi-Parameter Health Index */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400 mb-2">
                  3. Multi-Parameter Health Index Fusion (0 - 100%)
                </h4>
                <div className="bg-slate-900 p-3 rounded font-mono text-xs text-emerald-200 my-2">
                  HI = 100 - w_rms·ΔRMS - w_cf·ΔCF - w_temp·ΔT
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Blends overall RMS kinetic energy (55% weight), Crest Factor impulsive sharpness (25% weight), and bearing cap temperature elevation (20% weight) to produce a unified operational health score.
                </p>
              </div>

              {/* ISO 10816-3 Guideline Notice */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-amber-400 mb-2">
                  4. ISO 10816-3 Machine Classification
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  For <strong>Group 2 Medium Industrial Motors (15 kW – 300 kW)</strong> on rigid foundations:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-slate-300 font-mono">
                  <li>Zone A/B (Healthy / Unrestricted): &lt; 2.3 mm/s (≈ 0.12g – 0.20g)</li>
                  <li>Zone C (Warning / Action Required): 2.3 – 4.5 mm/s (≈ 0.28g)</li>
                  <li>Zone D (Critical / Immediate Trip): &gt; 4.5 mm/s (≈ 0.45g)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Work Order */}
      {showCreateWoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-400" />
                <span>Create Maintenance Work Order</span>
              </h3>
              <button
                onClick={() => setShowCreateWoModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Work Order Title *</label>
                <input
                  type="text"
                  required
                  value={newWoTitle}
                  onChange={(e) => setNewWoTitle(e.target.value)}
                  placeholder="e.g. Drive-End Bearing Replacement & Alignment Audit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority Level</label>
                  <select
                    value={newWoPriority}
                    onChange={(e) => setNewWoPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="ELEVATED">Elevated</option>
                    <option value="HIGH">High Priority</option>
                    <option value="EMERGENCY">Emergency Trip</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Estimated Labor (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newWoHours}
                    onChange={(e) => setNewWoHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Trigger Condition</label>
                <input
                  type="text"
                  value={newWoTrigger}
                  onChange={(e) => setNewWoTrigger(e.target.value)}
                  placeholder={`RUL Projection: ${rulData?.estimatedRulHours || 120}h until critical limit`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-300 font-medium">Prescribed Action Steps (SOP)</label>
                <input
                  type="text"
                  value={newWoSop1}
                  onChange={(e) => setNewWoSop1(e.target.value)}
                  placeholder="Step 1: Check bearing radial play and inspect grease color"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={newWoSop2}
                  onChange={(e) => setNewWoSop2(e.target.value)}
                  placeholder="Step 2: Replace drive-end bearing with SKF 6308-2Z and perform laser alignment"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Spare Part Number</label>
                  <input
                    type="text"
                    value={newWoPartNum}
                    onChange={(e) => setNewWoPartNum(e.target.value)}
                    placeholder="e.g. SKF-6308-2Z"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Part Description</label>
                  <input
                    type="text"
                    value={newWoPartDesc}
                    onChange={(e) => setNewWoPartDesc(e.target.value)}
                    placeholder="Deep groove ball bearing"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateWoModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWo}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingWo ? 'Dispatching...' : 'Dispatch Work Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
