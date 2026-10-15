export interface Motor {
  motor_id: string;
  tag_name: string;
  location: string;
  rated_rpm: number;
  rated_power_kw: number;
  warning_rms: number;
  critical_rms: number;
  warning_peak: number;
  critical_peak: number;
  created_at?: string;
  latestMeasurement?: Measurement | null;
}

export interface Device {
  dev_eui: string;
  motor_id: string;
  device_name: string;
  frequency_plan: string;
  last_seen_at: string | null;
  last_seq_num: number | null;
  last_rssi: number | null;
  last_snr: number | null;
  status: 'ONLINE' | 'OFFLINE';
}

export interface Measurement {
  id: number;
  recorded_at: string;
  dev_eui: string;
  motor_id: string;
  sequence: number;
  overall_rms: number;
  x_rms: number;
  y_rms: number;
  z_rms: number;
  peak: number;
  peak_to_peak: number;
  crest_factor: number;
  temperature: number;
  sensor_status: string;
  health_status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  health_score: number;
  anomaly_detected: number;
  anomaly_reason?: string | null;
  trend_direction: 'INCREASING' | 'STABLE' | 'DECREASING' | 'SPIKE';
  trend_slope: number;
  possible_condition: 'NORMAL' | 'POSSIBLE_IMBALANCE' | 'POSSIBLE_MISALIGNMENT' | 'POSSIBLE_LOOSENESS' | 'POSSIBLE_BEARING_FAULT';
  dominant_freq?: number;
  dominant_amp?: number;
  spectral_energy?: number;
  band_sub_sync?: number;
  band_1x?: number;
  band_2x?: number;
  band_3x?: number;
  band_high_freq?: number;
  fft_bins_json?: string;
  rssi?: number;
  snr?: number;
  raw_payload_hex?: string;
}

export interface FftBin {
  freq: number;
  amp: number;
  harmonic?: string;
}

export interface Alarm {
  alarm_id: number;
  triggered_at: string;
  motor_id: string;
  severity: 'WARNING' | 'CRITICAL' | 'ANOMALY' | 'SENSOR_ERROR' | 'COMM_ERROR';
  parameter: string;
  measured_value: number;
  threshold_limit: number;
  message: string;
  acknowledged: number;
  acknowledged_at?: string;
  cleared: number;
  cleared_at?: string;
  sequence?: number;
}

export interface Baseline {
  id: number;
  motor_id: string;
  created_at: string;
  sample_count: number;
  operating_condition: string;
  mean_rms: number;
  min_rms: number;
  max_rms: number;
  std_rms: number;
  mean_peak: number;
  std_peak: number;
  mean_peak_to_peak: number;
  mean_crest_factor: number;
  is_active: number;
  notes?: string;
}

export interface CbmConfig {
  motor_id: string;
  anomaly_pct_threshold: number;
  anomaly_std_threshold: number;
  sustained_count: number;
  spike_ratio: number;
  warning_persistence: number;
  critical_persistence: number;
  trend_window_size: number;
  health_weight_rms: number;
  health_weight_peak: number;
  health_weight_crest: number;
  updated_at?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'ANOMALY' | 'WARNING' | 'CRITICAL' | 'SENSOR_ERROR' | 'COMM_ERROR' | 'ACKNOWLEDGED' | 'CLEARED' | 'BASELINE_CREATED';
  title: string;
  details: string;
  value?: number;
  limit?: number;
  sequence?: number;
}

export interface HealthReport {
  motorId: string;
  tagName: string;
  location: string;
  ratedRpm: number;
  ratedPowerKw: number;
  generatedAt: string;
  monitoringPeriodHours: number;
  sampleCount: number;
  baselineRms: number;
  baselineStdRms: number;
  currentRms: number;
  currentPeak: number;
  rmsDeviationPct: number;
  averageRms: number;
  maxRms: number;
  maxPeak: number;
  trendDirection: 'INCREASING' | 'STABLE' | 'DECREASING' | 'SPIKE';
  trendSlope: number;
  cbmHealthScore: number;
  healthStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  possibleCondition: 'NORMAL' | 'POSSIBLE_IMBALANCE' | 'POSSIBLE_MISALIGNMENT' | 'POSSIBLE_LOOSENESS' | 'POSSIBLE_BEARING_FAULT';
  dominantFrequency?: number;
  dominantAmplitude?: number;
  currentCrestFactor?: number;
  temperature?: number;
  totalAlarms: number;
  activeAlarms: number;
  anomalyCount: number;
  communicationAvailabilityPct: number;
  warningLimitRms: number;
  criticalLimitRms: number;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export type ActiveTab =
  | 'overview'
  | 'motor-details'
  | 'trends'
  | 'frequency-analysis'
  | 'commissioning'
  | 'predictive-maintenance'
  | 'alarms'
  | 'intelligence'
  | 'timeline'
  | 'report'
  | 'firmware-deploy'
  | 'fft-prep'
  | 'system-flow'
  | 'test-suite'
  | 'settings';

export interface SystemLinkStatus {
  nodeOnline: boolean;
  lorawanConnected: boolean;
  gatewayOnline: boolean;
  sensorStatus: 'OK' | 'ERROR';
  lastSeenSecondsAgo: number | null;
}

export type DataQualityGrade = 'GOOD' | 'QUESTIONABLE' | 'INVALID';

export interface DataQualityReport {
  overallGrade: DataQualityGrade;
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
}

export interface RepeatabilityMetrics {
  runCount: number;
  meanRms: number;
  stdRms: number;
  coefficientOfVariationPct: number; // (std/mean)*100
  noiseFloorG: number;
  repeatabilityStatus: 'EXCELLENT' | 'ACCEPTABLE_PROTOTYPE' | 'MARGINAL' | 'UNACCEPTABLE';
  isAcceptableForTrendMonitoring: boolean;
  interpretation: string;
}

export interface CommissioningChecklistState {
  sensorSecurelyMounted: boolean;
  correctSensorOrientation: boolean;
  esp32Stable: boolean;
  mpu6050Stable: boolean;
  samplingVerified: boolean;
  baselineCollected: boolean;
  repeatabilityVerified: boolean;
  lorawanStable: boolean;
  gatewayStable: boolean;
  cloudDataStable: boolean;
  databaseStable: boolean;
  dashboardStable: boolean;
  alarmLogicTested: boolean;
  fftVerified: boolean;
  dataQualityVerified: boolean;
}

export interface CommissioningReportData {
  motorId: string;
  deviceId: string;
  sensorId: string;
  installationDate: string;
  sensorLocation: string;
  sensorOrientation: string;
  samplingConfiguration: {
    samplingRateHz: number;
    numSamples: number;
    windowSeconds: number;
    nyquistHz: number;
    frequencyResolutionHz: number;
  };
  baselineMetrics: {
    rms: number;
    peak: number;
    peakToPeak: number;
    crestFactor: number;
    dominantFreq: number;
    stdRms: number;
  };
  currentMetrics: {
    rms: number;
    peak: number;
    crestFactor: number;
    dominantFreq: number;
    rmsDeviationPct: number;
  };
  operatingCondition: {
    operatingRpm: number | null;
    loadCondition: string;
    temperatureC: number;
    motorState: 'STOPPED' | 'STARTING' | 'NORMAL_HEALTHY' | 'VARYING_LOAD';
  };
  dataQuality: DataQualityReport;
  communicationAvailabilityPct: number;
  repeatability: RepeatabilityMetrics;
}

export type BearingDegradationStage =
  | 'STAGE_1_SUBSURFACE'
  | 'STAGE_2_SURFACE_MICRODEFECT'
  | 'STAGE_3_DEFECT_FREQUENCIES'
  | 'STAGE_4_CATASTROPHIC_IMMINENT';

export type DegradationModelType = 'LINEAR' | 'EXPONENTIAL';

export interface RulProjectionPoint {
  hoursAhead: number;
  projectedRms: number;
  lowerBoundRms: number;
  upperBoundRms: number;
  projectedPeak: number;
  healthIndex: number;
}

export interface BearingStageDetails {
  stage: BearingDegradationStage;
  stageNumber: number;
  title: string;
  crestFactorRange: string;
  dominantSpectrumZone: string;
  physicalManifestation: string;
  recommendedPlantAction: string;
  urgency: 'MONITOR' | 'PLAN_MAINTENANCE' | 'HIGH_PRIORITY' | 'IMMEDIATE_ACTION';
}

export interface RulAnalysisResult {
  motorId: string;
  calculatedAt: string;
  activeModel: DegradationModelType;
  currentRms: number;
  baselineRms: number;
  warningThresholdRms: number;
  criticalThresholdRms: number;
  currentCrestFactor: number;
  currentTemperatureC: number;
  degradationSlopeGPerHour: number;
  exponentialGrowthRateBeta: number;
  estimatedRulHours: number;
  estimatedRulDays: number;
  hoursUntilWarning: number;
  hoursUntilCritical: number;
  confidenceScorePct: number;
  bearingStage: BearingStageDetails;
  overallHealthIndex: number; // 0 - 100
  projectionPoints: RulProjectionPoint[];
  historicalTrendSummary: {
    dataPointsEvaluated: number;
    observationSpanHours: number;
    rSquaredFit: number;
  };
}

export interface MaintenanceWorkOrder {
  id: string;
  workOrderNumber: string;
  motorId: string;
  motorTag: string;
  title: string;
  priority: 'ROUTINE' | 'ELEVATED' | 'HIGH' | 'EMERGENCY';
  status: 'DRAFT' | 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  triggerCondition: string;
  detectedFaultSignature: string;
  prescribedActions: string[];
  recommendedParts: {
    partNumber: string;
    description: string;
    quantity: number;
  }[];
  estimatedLaborHours: number;
  targetCompletionHours: number;
  targetDueDate: string;
  createdAt: string;
}

