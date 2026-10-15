import {
  Motor,
  Device,
  Measurement,
  Alarm,
  TimeRange,
  Baseline,
  CbmConfig,
  TimelineEvent,
  HealthReport,
} from '../types';

export const API_BASE = '/api';

export async function getMotors(): Promise<Motor[]> {
  const res = await fetch(`${API_BASE}/motors`);
  if (!res.ok) throw new Error(`Failed to fetch motors: ${res.statusText}`);
  return res.json();
}

export async function getMotorById(id: string): Promise<Motor> {
  const res = await fetch(`${API_BASE}/motors/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch motor ${id}: ${res.statusText}`);
  return res.json();
}

export async function getLatestMeasurement(id: string): Promise<Measurement | null> {
  const res = await fetch(`${API_BASE}/motors/${encodeURIComponent(id)}/latest`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch latest measurement: ${res.statusText}`);
  return res.json();
}

export async function getMeasurements(id: string, range: TimeRange = '24h'): Promise<Measurement[]> {
  const now = Date.now();
  let fromIso: string | undefined;

  switch (range) {
    case '1h':
      fromIso = new Date(now - 1 * 3600 * 1000).toISOString();
      break;
    case '6h':
      fromIso = new Date(now - 6 * 3600 * 1000).toISOString();
      break;
    case '24h':
      fromIso = new Date(now - 24 * 3600 * 1000).toISOString();
      break;
    case '7d':
      fromIso = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
      break;
    case '30d':
      fromIso = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
      break;
    case 'all':
      fromIso = undefined;
      break;
  }

  const queryParams = new URLSearchParams();
  if (fromIso) queryParams.set('from', fromIso);
  queryParams.set('limit', '300'); // Prevent browser downsampling lag

  const url = `${API_BASE}/motors/${encodeURIComponent(id)}/measurements?${queryParams.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch historical measurements: ${res.statusText}`);
  return res.json();
}

export async function getDevices(): Promise<{ timeoutThresholdSeconds: number; devices: Device[] }> {
  const res = await fetch(`${API_BASE}/devices`);
  if (!res.ok) throw new Error(`Failed to fetch devices: ${res.statusText}`);
  return res.json();
}

export async function getAlarms(statusFilter?: 'active' | 'acknowledged' | 'cleared' | 'all'): Promise<Alarm[]> {
  let url = `${API_BASE}/alarms`;
  if (statusFilter) {
    url += `?status=${statusFilter}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch alarms: ${res.statusText}`);
  return res.json();
}

export async function acknowledgeAlarmApi(alarmId: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/alarms/${alarmId}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to acknowledge alarm: ${res.statusText}`);
  const data = await res.json();
  return data.status === 'acknowledged';
}

export async function clearAlarmApi(alarmId: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/alarms/${alarmId}/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to clear alarm: ${res.statusText}`);
  const data = await res.json();
  return data.status === 'cleared';
}

export async function getBaselineApi(motorId: string = 'MOTOR_01'): Promise<{ active: Baseline | null; history: Baseline[] }> {
  const res = await fetch(`${API_BASE}/baseline/${encodeURIComponent(motorId)}`);
  if (!res.ok) throw new Error(`Failed to fetch baseline: ${res.statusText}`);
  return res.json();
}

export async function createBaselineApi(params: {
  motorId: string;
  operatingCondition?: string;
  sampleCount?: number;
  notes?: string;
}): Promise<Baseline> {
  const res = await fetch(`${API_BASE}/baseline/${encodeURIComponent(params.motorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create baseline: ${res.statusText}`);
  const data = await res.json();
  return data.baseline;
}

export async function getCbmConfigApi(motorId: string = 'MOTOR_01'): Promise<CbmConfig> {
  const res = await fetch(`${API_BASE}/cbm-config/${encodeURIComponent(motorId)}`);
  if (!res.ok) throw new Error(`Failed to fetch CBM config: ${res.statusText}`);
  return res.json();
}

export async function updateCbmConfigApi(motorId: string, config: Partial<CbmConfig>): Promise<CbmConfig> {
  const res = await fetch(`${API_BASE}/cbm-config/${encodeURIComponent(motorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to update CBM config: ${res.statusText}`);
  const data = await res.json();
  return data.config;
}

export async function getTimelineEventsApi(motorId: string = 'MOTOR_01', limit: number = 50): Promise<TimelineEvent[]> {
  const res = await fetch(`${API_BASE}/timeline/${encodeURIComponent(motorId)}?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch event timeline: ${res.statusText}`);
  return res.json();
}

export async function getHealthReportApi(motorId: string = 'MOTOR_01', hours: number = 24): Promise<HealthReport> {
  const res = await fetch(`${API_BASE}/report/${encodeURIComponent(motorId)}?hours=${hours}`);
  if (!res.ok) throw new Error(`Failed to fetch health report: ${res.statusText}`);
  return res.json();
}

export async function executeTestSuiteApi(testId: string, motorId: string = 'MOTOR_01'): Promise<any> {
  const res = await fetch(`${API_BASE}/test-runner/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testId, motorId }),
  });
  if (!res.ok) throw new Error(`Failed to execute test ${testId}: ${res.statusText}`);
  return res.json();
}

export async function updateMotorSettingsApi(data: {
  motorId: string;
  tagName?: string;
  location?: string;
  ratedRpm?: number;
  ratedPowerKw?: number;
  warningRms?: number;
  criticalRms?: number;
  warningPeak?: number;
  criticalPeak?: number;
}): Promise<Motor> {
  const res = await fetch(`${API_BASE}/settings/motor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update motor settings: ${res.statusText}`);
  const resp = await res.json();
  return resp.motor;
}

export async function seedHistoryApi(count: number = 48): Promise<number> {
  const res = await fetch(`${API_BASE}/settings/seed-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motorId: 'MOTOR_01', count }),
  });
  if (!res.ok) throw new Error(`Failed to seed historical data: ${res.statusText}`);
  const data = await res.json();
  return data.count;
}

export async function simulateUplinkApi(data: {
  motorId?: string;
  devEui?: string;
  overallRms?: number;
  peak?: number;
  crestFactor?: number;
  temperature?: number;
  sensorStatus?: 'OK' | 'ERROR';
}): Promise<any> {
  const res = await fetch(`${API_BASE}/simulate-uplink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`);
  return res.json();
}
