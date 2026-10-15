import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'cbm_database.sqlite');

// Configurable offline timeout: e.g. 75 seconds (2.5x the 30s uplink rate)
export const OFFLINE_TIMEOUT_MS = 75000;

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  saveDb();
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('[DB] Error saving database to disk:', err);
  }
}

function initSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS motors (
      motor_id TEXT PRIMARY KEY,
      tag_name TEXT NOT NULL,
      location TEXT NOT NULL,
      rated_rpm INTEGER NOT NULL DEFAULT 1440,
      rated_power_kw REAL DEFAULT 7.50,
      warning_rms REAL DEFAULT 0.280,
      critical_rms REAL DEFAULT 0.450,
      warning_peak REAL DEFAULT 0.600,
      critical_peak REAL DEFAULT 1.000,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      dev_eui TEXT PRIMARY KEY,
      motor_id TEXT REFERENCES motors(motor_id),
      device_name TEXT NOT NULL,
      frequency_plan TEXT DEFAULT 'IN865',
      last_seen_at TEXT,
      last_seq_num INTEGER,
      last_rssi INTEGER,
      last_snr REAL,
      status TEXT DEFAULT 'OFFLINE'
    );

    CREATE TABLE IF NOT EXISTS vibration_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      dev_eui TEXT NOT NULL,
      motor_id TEXT NOT NULL REFERENCES motors(motor_id),
      sequence INTEGER NOT NULL,
      overall_rms REAL NOT NULL,
      x_rms REAL DEFAULT 0.0,
      y_rms REAL DEFAULT 0.0,
      z_rms REAL DEFAULT 0.0,
      peak REAL NOT NULL,
      peak_to_peak REAL NOT NULL,
      crest_factor REAL NOT NULL,
      temperature REAL NOT NULL,
      sensor_status TEXT NOT NULL,
      health_status TEXT NOT NULL,
      health_score REAL DEFAULT 95.0,
      anomaly_detected INTEGER DEFAULT 0,
      anomaly_reason TEXT,
      trend_direction TEXT DEFAULT 'STABLE',
      trend_slope REAL DEFAULT 0.0,
      possible_condition TEXT DEFAULT 'NORMAL',
      rssi INTEGER,
      snr REAL,
      raw_payload_hex TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_meas_motor_time ON vibration_measurements(motor_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_meas_seq ON vibration_measurements(dev_eui, sequence);

    CREATE TABLE IF NOT EXISTS alarm_events (
      alarm_id INTEGER PRIMARY KEY AUTOINCREMENT,
      triggered_at TEXT NOT NULL,
      motor_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      parameter TEXT NOT NULL,
      measured_value REAL NOT NULL,
      threshold_limit REAL NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      acknowledged_at TEXT,
      cleared INTEGER DEFAULT 0,
      cleared_at TEXT,
      sequence INTEGER
    );

    CREATE TABLE IF NOT EXISTS cbm_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      motor_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sample_count INTEGER NOT NULL,
      operating_condition TEXT NOT NULL,
      mean_rms REAL NOT NULL,
      min_rms REAL NOT NULL,
      max_rms REAL NOT NULL,
      std_rms REAL NOT NULL,
      mean_peak REAL NOT NULL,
      std_peak REAL NOT NULL,
      mean_peak_to_peak REAL NOT NULL,
      mean_crest_factor REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS cbm_config (
      motor_id TEXT PRIMARY KEY,
      anomaly_pct_threshold REAL DEFAULT 25.0,
      anomaly_std_threshold REAL DEFAULT 2.5,
      sustained_count INTEGER DEFAULT 2,
      spike_ratio REAL DEFAULT 1.8,
      warning_persistence INTEGER DEFAULT 2,
      critical_persistence INTEGER DEFAULT 1,
      trend_window_size INTEGER DEFAULT 10,
      health_weight_rms REAL DEFAULT 0.50,
      health_weight_peak REAL DEFAULT 0.25,
      health_weight_crest REAL DEFAULT 0.25,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_work_orders (
      id TEXT PRIMARY KEY,
      work_order_number TEXT NOT NULL,
      motor_id TEXT NOT NULL,
      motor_tag TEXT NOT NULL,
      title TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      trigger_condition TEXT NOT NULL,
      detected_fault_signature TEXT NOT NULL,
      prescribed_actions_json TEXT NOT NULL,
      recommended_parts_json TEXT NOT NULL,
      estimated_labor_hours REAL NOT NULL,
      target_completion_hours REAL NOT NULL,
      target_due_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing tables gracefully
  const columnsToAdd = [
    { table: 'vibration_measurements', column: 'x_rms', type: 'REAL DEFAULT 0.0' },
    { table: 'vibration_measurements', column: 'y_rms', type: 'REAL DEFAULT 0.0' },
    { table: 'vibration_measurements', column: 'z_rms', type: 'REAL DEFAULT 0.0' },
    { table: 'vibration_measurements', column: 'health_score', type: 'REAL DEFAULT 95.0' },
    { table: 'vibration_measurements', column: 'anomaly_detected', type: 'INTEGER DEFAULT 0' },
    { table: 'vibration_measurements', column: 'anomaly_reason', type: 'TEXT' },
    { table: 'vibration_measurements', column: 'trend_direction', type: "TEXT DEFAULT 'STABLE'" },
    { table: 'vibration_measurements', column: 'trend_slope', type: 'REAL DEFAULT 0.0' },
    { table: 'vibration_measurements', column: 'possible_condition', type: "TEXT DEFAULT 'NORMAL'" },
    { table: 'vibration_measurements', column: 'dominant_freq', type: 'REAL DEFAULT 24.0' },
    { table: 'vibration_measurements', column: 'dominant_amp', type: 'REAL DEFAULT 0.180' },
    { table: 'vibration_measurements', column: 'spectral_energy', type: 'REAL DEFAULT 0.045' },
    { table: 'vibration_measurements', column: 'band_sub_sync', type: 'REAL DEFAULT 0.015' },
    { table: 'vibration_measurements', column: 'band_1x', type: 'REAL DEFAULT 0.120' },
    { table: 'vibration_measurements', column: 'band_2x', type: 'REAL DEFAULT 0.040' },
    { table: 'vibration_measurements', column: 'band_3x', type: 'REAL DEFAULT 0.015' },
    { table: 'vibration_measurements', column: 'band_high_freq', type: 'REAL DEFAULT 0.020' },
    { table: 'vibration_measurements', column: 'fft_bins_json', type: 'TEXT' },
    { table: 'alarm_events', column: 'cleared', type: 'INTEGER DEFAULT 0' },
    { table: 'alarm_events', column: 'cleared_at', type: 'TEXT' },
    { table: 'alarm_events', column: 'sequence', type: 'INTEGER' },
  ];

  for (const item of columnsToAdd) {
    try {
      database.run(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.type};`);
    } catch (_) {
      // Column exists
    }
  }

  // Seed default motor and device if not existing
  const stmt = database.prepare("SELECT COUNT(*) as cnt FROM motors WHERE motor_id = 'MOTOR_01'");
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();

  if (row.cnt === 0) {
    database.run(`
      INSERT INTO motors (motor_id, tag_name, location, rated_rpm, rated_power_kw, warning_rms, critical_rms, warning_peak, critical_peak)
      VALUES ('MOTOR_01', 'Cooling Tower Feed Pump Motor 01', 'Drive-End Bearing Bay #3', 1440, 11.0, 0.280, 0.450, 0.600, 1.000);

      INSERT INTO devices (dev_eui, motor_id, device_name, frequency_plan, last_seen_at, last_seq_num, status)
      VALUES ('0000000000000001', 'MOTOR_01', 'CBM_NODE_01', 'IN865', datetime('now'), 0, 'ONLINE');
    `);
  }

  // Seed default baseline if not existing
  const baseStmt = database.prepare("SELECT COUNT(*) as cnt FROM cbm_baselines WHERE motor_id = 'MOTOR_01'");
  baseStmt.step();
  const baseRow = baseStmt.getAsObject();
  baseStmt.free();

  if (baseRow.cnt === 0) {
    database.run(`
      INSERT INTO cbm_baselines (
        motor_id, created_at, sample_count, operating_condition,
        mean_rms, min_rms, max_rms, std_rms, mean_peak, std_peak,
        mean_peak_to_peak, mean_crest_factor, is_active, notes
      ) VALUES (
        'MOTOR_01', datetime('now', '-24 hours'), 48, '1440 RPM Nominal Full Load',
        0.1850, 0.1580, 0.2210, 0.0125, 0.3250, 0.0240,
        0.5820, 1.76, 1, 'Initial healthy baseline established during commissioning'
      );
    `);
  }

  // Seed default CBM configuration if not existing
  const cfgStmt = database.prepare("SELECT COUNT(*) as cnt FROM cbm_config WHERE motor_id = 'MOTOR_01'");
  cfgStmt.step();
  const cfgRow = cfgStmt.getAsObject();
  cfgStmt.free();

  if (cfgRow.cnt === 0) {
    database.run(`
      INSERT INTO cbm_config (
        motor_id, anomaly_pct_threshold, anomaly_std_threshold, sustained_count,
        spike_ratio, warning_persistence, critical_persistence, trend_window_size
      ) VALUES (
        'MOTOR_01', 25.0, 2.5, 2, 1.8, 2, 1, 10
      );
    `);
  }

  // Seed default maintenance work orders if not existing
  const woStmt = database.prepare("SELECT COUNT(*) as cnt FROM maintenance_work_orders");
  woStmt.step();
  const woRow = woStmt.getAsObject();
  woStmt.free();

  if (woRow.cnt === 0) {
    database.run(`
      INSERT INTO maintenance_work_orders (
        id, work_order_number, motor_id, motor_tag, title, priority, status,
        trigger_condition, detected_fault_signature, prescribed_actions_json,
        recommended_parts_json, estimated_labor_hours, target_completion_hours,
        target_due_date, created_at
      ) VALUES (
        'WO_INIT_001', 'WO-2026-089', 'MOTOR_01', 'Cooling Tower Feed Pump Motor 01',
        'Preventive Drive-End Bearing Re-Lubrication & Vibration Audit',
        'ROUTINE', 'SCHEDULED',
        'Quarterly CBM Planned Lubrication Interval & Baseline Re-Check',
        'Normal baseline signature with slight high-frequency acoustic rise (Stage 1)',
        '["Clean grease relief ports and purge old synthetic polyurea grease","Inject 15 grams Mobil Polyrex EM grease into DE bearing housing","Run motor at 1440 RPM for 30 minutes while recording baseline RMS","Verify temperature does not exceed 45°C during churn phase"]',
        '[{"partNumber":"MOBIL-EM-POLYREX","description":"Mobil Polyrex EM Synthetic Grease (400g)","quantity":1},{"partNumber":"PURGE-CAP-M10","description":"M10 Grease Relief Plug with Viton O-ring","quantity":1}]',
        2.5, 48.0,
        datetime('now', '+3 days'), datetime('now', '-2 days')
      ),
      (
        'WO_INIT_002', 'WO-2026-092', 'MOTOR_01', 'Cooling Tower Feed Pump Motor 01',
        'Laser Shaft Realignment & Dynamic Unbalance Inspection',
        'ELEVATED', 'OPEN',
        'Predictive RUL extrapolation indicates +42% RMS elevation trajectory',
        'Dominant 1X running frequency with slight 2X radial horizontal energy',
        '["Perform 4-point soft-foot check using precision dial indicators (< 0.05 mm limit)","Execute dual-plane laser alignment on motor-to-pump flexible spacer coupling","Inspect elastomer spider element for torsional hysteresis cracks","Re-torque foundation hold-down bolts to 120 Nm with calibrated torque wrench"]',
        '[{"partNumber":"ROTEX-GR-42","description":"Rotex 42 Urethane Coupling Insert 98 Shore A","quantity":1},{"partNumber":"SHIM-PACK-SS-05","description":"316 Stainless Steel Precision Pre-cut Shim Pack (0.05-1.0mm)","quantity":1}]',
        4.0, 24.0,
        datetime('now', '+1 day'), datetime('now', '-4 hours')
      );
    `);
  }
}

export interface MotorRecord {
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
}

export interface DeviceRecord {
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

export interface MeasurementRecord {
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

export interface AlarmRecord {
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

export interface BaselineRecord {
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

export interface CbmConfigRecord {
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

/**
 * Returns all registered motors.
 */
export async function getMotors(): Promise<MotorRecord[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM motors ORDER BY motor_id ASC');
  const results: MotorRecord[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as MotorRecord);
  }
  stmt.free();
  return results;
}

/**
 * Returns specific motor.
 */
export async function getMotorById(motorId: string): Promise<MotorRecord | null> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM motors WHERE motor_id = :id');
  stmt.bind({ ':id': motorId });
  let result: MotorRecord | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as MotorRecord;
  }
  stmt.free();
  return result;
}

/**
 * Returns all registered devices with dynamic online/offline detection.
 */
export async function getDevices(): Promise<DeviceRecord[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM devices ORDER BY device_name ASC');
  const results: DeviceRecord[] = [];
  const nowMs = Date.now();

  while (stmt.step()) {
    const dev = stmt.getAsObject() as unknown as DeviceRecord;
    let computedStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE';
    if (dev.last_seen_at) {
      const lastSeenMs = new Date(dev.last_seen_at).getTime();
      if (nowMs - lastSeenMs <= OFFLINE_TIMEOUT_MS) {
        computedStatus = 'ONLINE';
      }
    }
    dev.status = computedStatus;
    results.push(dev);
  }
  stmt.free();
  return results;
}

/**
 * Returns active baseline for a motor.
 */
export async function getActiveBaseline(motorId: string): Promise<BaselineRecord | null> {
  const database = await getDb();
  const stmt = database.prepare(`
    SELECT * FROM cbm_baselines 
    WHERE motor_id = :id AND is_active = 1 
    ORDER BY created_at DESC LIMIT 1
  `);
  stmt.bind({ ':id': motorId });
  let result: BaselineRecord | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as BaselineRecord;
  }
  stmt.free();
  return result;
}

/**
 * Returns all baselines for a motor (history).
 */
export async function getBaselineHistory(motorId: string): Promise<BaselineRecord[]> {
  const database = await getDb();
  const stmt = database.prepare(`
    SELECT * FROM cbm_baselines 
    WHERE motor_id = :id 
    ORDER BY created_at DESC
  `);
  stmt.bind({ ':id': motorId });
  const results: BaselineRecord[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as BaselineRecord);
  }
  stmt.free();
  return results;
}

/**
 * Creates/learns a new baseline from normal historical operating measurements.
 */
export async function createBaseline(params: {
  motorId: string;
  operatingCondition?: string;
  sampleCount?: number;
  notes?: string;
}): Promise<BaselineRecord> {
  const database = await getDb();
  const motorId = params.motorId;
  const sampleCount = params.sampleCount || 30;
  const condition = params.operatingCondition || '1440 RPM Normal Steady State';

  // Fetch recent normal measurements
  const stmt = database.prepare(`
    SELECT overall_rms, peak, peak_to_peak, crest_factor 
    FROM vibration_measurements 
    WHERE motor_id = :id AND sensor_status = 'OK'
    ORDER BY recorded_at DESC LIMIT :limit
  `);
  stmt.bind({ ':id': motorId, ':limit': sampleCount });

  const rmsArr: number[] = [];
  const peakArr: number[] = [];
  const pkpkArr: number[] = [];
  const crestArr: number[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    rmsArr.push(Number(row.overall_rms));
    peakArr.push(Number(row.peak));
    pkpkArr.push(Number(row.peak_to_peak));
    crestArr.push(Number(row.crest_factor));
  }
  stmt.free();

  // If insufficient records, use realistic standard defaults
  const N = rmsArr.length;
  let meanRms = 0.185;
  let minRms = 0.160;
  let maxRms = 0.210;
  let stdRms = 0.012;
  let meanPeak = 0.320;
  let stdPeak = 0.020;
  let meanPkpk = 0.580;
  let meanCrest = 1.75;

  if (N > 0) {
    const sum = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0);
    meanRms = Number((sum(rmsArr) / N).toFixed(4));
    minRms = Number(Math.min(...rmsArr).toFixed(4));
    maxRms = Number(Math.max(...rmsArr).toFixed(4));
    meanPeak = Number((sum(peakArr) / N).toFixed(4));
    meanPkpk = Number((sum(pkpkArr) / N).toFixed(4));
    meanCrest = Number((sum(crestArr) / N).toFixed(2));

    const varianceRms = N > 1 ? sum(rmsArr.map((v) => Math.pow(v - meanRms, 2))) / (N - 1) : 0.0001;
    stdRms = Number(Math.sqrt(varianceRms).toFixed(4));

    const variancePeak = N > 1 ? sum(peakArr.map((v) => Math.pow(v - meanPeak, 2))) / (N - 1) : 0.0002;
    stdPeak = Number(Math.sqrt(variancePeak).toFixed(4));
  }

  // Deactivate old active baselines
  database.run('UPDATE cbm_baselines SET is_active = 0 WHERE motor_id = :id', { ':id': motorId });

  // Insert new active baseline
  const now = new Date().toISOString();
  database.run(
    `INSERT INTO cbm_baselines (
      motor_id, created_at, sample_count, operating_condition,
      mean_rms, min_rms, max_rms, std_rms, mean_peak, std_peak,
      mean_peak_to_peak, mean_crest_factor, is_active, notes
    ) VALUES (
      :motor_id, :created_at, :sample_count, :operating_condition,
      :mean_rms, :min_rms, :max_rms, :std_rms, :mean_peak, :std_peak,
      :mean_peak_to_peak, :mean_crest_factor, 1, :notes
    )`,
    {
      ':motor_id': motorId,
      ':created_at': now,
      ':sample_count': Math.max(N, sampleCount),
      ':operating_condition': condition,
      ':mean_rms': meanRms,
      ':min_rms': minRms,
      ':max_rms': maxRms,
      ':std_rms': stdRms,
      ':mean_peak': meanPeak,
      ':std_peak': stdPeak,
      ':mean_peak_to_peak': meanPkpk,
      ':mean_crest_factor': meanCrest,
      ':notes': params.notes || 'Learned baseline under steady-state operating condition',
    }
  );

  saveDb();
  return (await getActiveBaseline(motorId))!;
}

/**
 * Returns CBM configuration parameters.
 */
export async function getCbmConfig(motorId: string): Promise<CbmConfigRecord> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM cbm_config WHERE motor_id = :id');
  stmt.bind({ ':id': motorId });
  let result: CbmConfigRecord | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as CbmConfigRecord;
  }
  stmt.free();

  if (!result) {
    return {
      motor_id: motorId,
      anomaly_pct_threshold: 25.0,
      anomaly_std_threshold: 2.5,
      sustained_count: 2,
      spike_ratio: 1.8,
      warning_persistence: 2,
      critical_persistence: 1,
      trend_window_size: 10,
      health_weight_rms: 0.50,
      health_weight_peak: 0.25,
      health_weight_crest: 0.25,
    };
  }
  return result;
}

/**
 * Updates CBM anomaly & health score configuration.
 */
export async function updateCbmConfig(motorId: string, updates: Partial<CbmConfigRecord>): Promise<CbmConfigRecord> {
  const database = await getDb();
  const current = await getCbmConfig(motorId);

  database.run(
    `INSERT OR REPLACE INTO cbm_config (
      motor_id, anomaly_pct_threshold, anomaly_std_threshold, sustained_count,
      spike_ratio, warning_persistence, critical_persistence, trend_window_size,
      health_weight_rms, health_weight_peak, health_weight_crest, updated_at
    ) VALUES (
      :id, :pct, :std, :sust, :spike, :w_pers, :c_pers, :trend_w, :hw_rms, :hw_pk, :hw_cf, datetime('now')
    )`,
    {
      ':id': motorId,
      ':pct': updates.anomaly_pct_threshold ?? current.anomaly_pct_threshold,
      ':std': updates.anomaly_std_threshold ?? current.anomaly_std_threshold,
      ':sust': updates.sustained_count ?? current.sustained_count,
      ':spike': updates.spike_ratio ?? current.spike_ratio,
      ':w_pers': updates.warning_persistence ?? current.warning_persistence,
      ':c_pers': updates.critical_persistence ?? current.critical_persistence,
      ':trend_w': updates.trend_window_size ?? current.trend_window_size,
      ':hw_rms': updates.health_weight_rms ?? current.health_weight_rms,
      ':hw_pk': updates.health_weight_peak ?? current.health_weight_peak,
      ':hw_cf': updates.health_weight_crest ?? current.health_weight_crest,
    }
  );

  saveDb();
  return getCbmConfig(motorId);
}

/**
 * Returns latest measurement for a motor.
 */
export async function getLatestMeasurement(motorId: string): Promise<MeasurementRecord | null> {
  const database = await getDb();
  const stmt = database.prepare(
    'SELECT * FROM vibration_measurements WHERE motor_id = :id ORDER BY recorded_at DESC, id DESC LIMIT 1'
  );
  stmt.bind({ ':id': motorId });
  let result: MeasurementRecord | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as MeasurementRecord;
  }
  stmt.free();
  return result;
}

/**
 * Queries time-series measurements with filtering.
 */
export async function getMeasurements(
  motorId: string,
  fromIso?: string,
  toIso?: string,
  limit: number = 100
): Promise<MeasurementRecord[]> {
  const database = await getDb();
  let query = 'SELECT * FROM vibration_measurements WHERE motor_id = :id';
  const params: Record<string, any> = { ':id': motorId };

  if (fromIso) {
    query += ' AND recorded_at >= :from';
    params[':from'] = fromIso;
  }
  if (toIso) {
    query += ' AND recorded_at <= :to';
    params[':to'] = toIso;
  }

  query += ' ORDER BY recorded_at DESC LIMIT :limit';
  params[':limit'] = limit;

  const stmt = database.prepare(query);
  stmt.bind(params);
  const results: MeasurementRecord[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as MeasurementRecord);
  }
  stmt.free();
  return results.reverse();
}

/**
 * Checks for duplicate sequence number within the last 5 minutes.
 */
export async function isDuplicatePacket(devEui: string, sequence: number): Promise<boolean> {
  const database = await getDb();
  const stmt = database.prepare(`
    SELECT id FROM vibration_measurements 
    WHERE dev_eui = :dev_eui AND sequence = :seq 
    AND recorded_at >= datetime('now', '-5 minutes')
    LIMIT 1
  `);
  stmt.bind({ ':dev_eui': devEui, ':seq': sequence });
  const isDup = stmt.step();
  stmt.free();
  return isDup;
}

/**
 * Computes linear regression trend over the recent measurement window.
 */
function calculateTrend(measurements: Array<{ recorded_at: string; overall_rms: number }>): {
  direction: 'INCREASING' | 'STABLE' | 'DECREASING' | 'SPIKE';
  slope: number;
} {
  if (measurements.length < 3) {
    return { direction: 'STABLE', slope: 0.0 };
  }

  // Check for sudden spike compared to window mean
  const n = measurements.length;
  const latestRms = measurements[n - 1].overall_rms;
  const prevRmsList = measurements.slice(0, n - 1).map((m) => m.overall_rms);
  const avgPrev = prevRmsList.reduce((a, b) => a + b, 0) / prevRmsList.length;

  if (latestRms - avgPrev > 0.14) {
    return { direction: 'SPIKE', slope: Number((latestRms - avgPrev).toFixed(4)) };
  }

  // Compute Ordinary Least Squares (OLS) slope: RMS vs sample index
  const xVals = Array.from({ length: n }, (_, i) => i);
  const yVals = measurements.map((m) => m.overall_rms);

  const xMean = (n - 1) / 2;
  const yMean = yVals.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xVals[i] - xMean) * (yVals[i] - yMean);
    den += Math.pow(xVals[i] - xMean, 2);
  }

  const slopePerSample = den !== 0 ? num / den : 0;
  // Express in g per hour assuming 30s sampling interval (120 samples/hr)
  const slopePerHour = Number((slopePerSample * 120).toFixed(4));

  if (slopePerHour > 0.015) {
    return { direction: 'INCREASING', slope: slopePerHour };
  } else if (slopePerHour < -0.015) {
    return { direction: 'DECREASING', slope: slopePerHour };
  }
  return { direction: 'STABLE', slope: slopePerHour };
}

/**
 * Calculates the "Prototype CBM Health Score" (0–100) based on distance from baseline,
 * ISO warning/critical thresholds, crest factor impulsiveness, and sensor status.
 */
function calculateHealthScore(
  rms: number,
  peak: number,
  crest: number,
  sensorOk: boolean,
  baseline: BaselineRecord | null,
  warnRms: number,
  critRms: number
): number {
  if (!sensorOk) return 20.0;

  const baseRms = baseline ? baseline.mean_rms : 0.185;

  let score = 100.0;

  if (rms <= baseRms) {
    score = 100.0;
  } else if (rms <= warnRms) {
    // Normal operating degradation: scale 99 down to 80
    const ratio = (rms - baseRms) / Math.max(0.01, warnRms - baseRms);
    score = 99.0 - ratio * 19.0;
  } else if (rms <= critRms) {
    // Warning zone: scale 79 down to 60
    const ratio = (rms - warnRms) / Math.max(0.01, critRms - warnRms);
    score = 79.0 - ratio * 19.0;
  } else {
    // Critical zone: drops below 60 proportionally
    const excess = rms - critRms;
    score = Math.max(10.0, 59.0 - (excess / critRms) * 45.0);
  }

  // Penalize high crest factor (repetitive mechanical impacts / early bearing fault)
  if (crest > 3.5) {
    const cfPenalty = Math.min(15.0, (crest - 3.5) * 6.0);
    score -= cfPenalty;
  }

  // Penalize extreme peak shocks
  if (peak > 0.8) {
    score -= Math.min(10.0, (peak - 0.8) * 10.0);
  }

  return Number(Math.max(0, Math.min(100, score)).toFixed(1));
}

/**
 * Evaluates possible mechanical conditions based on kinematic vibration ratios.
 * NOTE: As required by Phase 8 specifications, these are strictly labeled as
 * "Possible condition — requires verification" since definitive diagnosis requires FFT.
 */
function evaluatePossibleCondition(
  xRms: number,
  yRms: number,
  zRms: number,
  overallRms: number,
  peak: number,
  crest: number,
  peakToPeak: number,
  warnRms: number
): 'NORMAL' | 'POSSIBLE_IMBALANCE' | 'POSSIBLE_MISALIGNMENT' | 'POSSIBLE_LOOSENESS' | 'POSSIBLE_BEARING_FAULT' {
  // 1. High Crest factor with dynamic shocks -> Possible bearing-related vibration
  if ((crest > 3.5 || peak / Math.max(0.01, overallRms) > 2.8) && peak > 0.45) {
    return 'POSSIBLE_BEARING_FAULT';
  }

  // 2. High Axial (Z-axis) vibration -> Possible misalignment
  const maxRadial = Math.max(xRms, yRms);
  if (zRms > 0.55 * maxRadial && zRms > 0.120) {
    return 'POSSIBLE_MISALIGNMENT';
  }

  // 3. High Peak-to-Peak swing with high crest factor -> Possible looseness
  if (peakToPeak > 2.1 * peak && crest > 2.5 && overallRms > warnRms * 0.9) {
    return 'POSSIBLE_LOOSENESS';
  }

  // 4. Elevated radial vibration with sinusoidal / steady crest factor -> Possible imbalance
  if (maxRadial >= warnRms && crest >= 1.3 && crest <= 2.2) {
    return 'POSSIBLE_IMBALANCE';
  }

  return 'NORMAL';
}

/**
 * Inserts a new vibration measurement, evaluates anomaly rules, calculates CBM health score,
 * evaluates trend, manages alarm state persistence, and auto-clears resolved alarms.
 */
export async function insertMeasurement(data: {
  devEui: string;
  motorId: string;
  sequence: number;
  overallRms: number;
  xRms?: number;
  yRms?: number;
  zRms?: number;
  peak: number;
  peakToPeak: number;
  crestFactor: number;
  temperature: number;
  sensorStatus: string;
  dominantFreq?: number;
  dominantAmp?: number;
  spectralEnergy?: number;
  bandSubSync?: number;
  band1x?: number;
  band2x?: number;
  band3x?: number;
  bandHighFreq?: number;
  fftBinsJson?: string;
  rssi?: number;
  snr?: number;
  rawPayloadHex?: string;
  recordedAt?: string;
}): Promise<{ measurement: MeasurementRecord; newAlarms: AlarmRecord[]; isDuplicate: boolean }> {
  const database = await getDb();
  const timestamp = data.recordedAt || new Date().toISOString();

  // 1. Duplicate packet detection
  const duplicate = await isDuplicatePacket(data.devEui, data.sequence);
  if (duplicate) {
    console.warn(`[INGEST] Duplicate packet detected for ${data.devEui} (Seq: ${data.sequence}).`);
  }

  // 2. Fetch motor thresholds, active baseline & CBM config
  const motor = await getMotorById(data.motorId);
  const warnRms = motor?.warning_rms ?? 0.280;
  const critRms = motor?.critical_rms ?? 0.450;
  const warnPeak = motor?.warning_peak ?? 0.600;
  const critPeak = motor?.critical_peak ?? 1.000;

  const baseline = await getActiveBaseline(data.motorId);
  const config = await getCbmConfig(data.motorId);

  const xVal = data.xRms ?? Number((data.overallRms * 0.72).toFixed(4));
  const yVal = data.yRms ?? Number((data.overallRms * 0.62).toFixed(4));
  const zVal = data.zRms ?? Number((data.overallRms * 0.31).toFixed(4));

  // 3. Fetch recent measurement history for trend & persistence checking
  const recentHistory = await getMeasurements(data.motorId, undefined, undefined, config.trend_window_size);
  const trendInput = [...recentHistory, { recorded_at: timestamp, overall_rms: data.overallRms }];
  const trend = calculateTrend(trendInput);

  // 4. Anomaly Detection Logic
  let isAnomaly = 0;
  let anomalyReason: string | null = null;

  if (baseline && data.sensorStatus === 'OK') {
    const pctIncrease = ((data.overallRms - baseline.mean_rms) / baseline.mean_rms) * 100.0;
    const stdDevs = (data.overallRms - baseline.mean_rms) / Math.max(0.001, baseline.std_rms);

    if (pctIncrease >= config.anomaly_pct_threshold || stdDevs >= config.anomaly_std_threshold) {
      isAnomaly = 1;
      anomalyReason = `Vibration ${pctIncrease.toFixed(1)}% above baseline (+${stdDevs.toFixed(1)}σ)`;
    } else if (data.peak >= baseline.mean_peak * config.spike_ratio) {
      isAnomaly = 1;
      anomalyReason = `Peak vibration spike: ${data.peak.toFixed(3)}g (${(data.peak / baseline.mean_peak).toFixed(1)}x baseline peak)`;
    }
  }

  // 5. CBM Health Score Calculation
  const isSensorOk = data.sensorStatus === 'OK';
  const healthScore = calculateHealthScore(
    data.overallRms,
    data.peak,
    data.crestFactor,
    isSensorOk,
    baseline,
    warnRms,
    critRms
  );

  // 6. Primary Health Status Tier
  let health: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
  if (!isSensorOk || data.overallRms >= critRms || data.peak >= critPeak) {
    health = 'CRITICAL';
  } else if (data.overallRms >= warnRms || data.peak >= warnPeak || isAnomaly) {
    health = 'WARNING';
  }

  // 7. Evaluate Possible Mechanical Condition
  const possibleCondition = evaluatePossibleCondition(
    xVal,
    yVal,
    zVal,
    data.overallRms,
    data.peak,
    data.crestFactor,
    data.peakToPeak,
    warnRms
  );

  // 8. Alarm State Machine with Anti-Flooding & Persistence
  const newAlarms: AlarmRecord[] = [];

  // Check recent consecutive readings for persistence
  const last2Rms = recentHistory.slice(-2).map((m) => m.overall_rms);
  const consecutiveWarn = last2Rms.filter((r) => r >= warnRms).length + (data.overallRms >= warnRms ? 1 : 0);
  const consecutiveCrit = last2Rms.filter((r) => r >= critRms).length + (data.overallRms >= critRms ? 1 : 0);

  // Check if active alarm already open (anti-flooding: do not insert duplicate open alarms)
  const openAlarmsStmt = database.prepare(
    "SELECT parameter FROM alarm_events WHERE motor_id = :id AND cleared = 0 AND acknowledged = 0"
  );
  openAlarmsStmt.bind({ ':id': data.motorId });
  const openParameters = new Set<string>();
  while (openAlarmsStmt.step()) {
    openParameters.add(String(openAlarmsStmt.getAsObject().parameter));
  }
  openAlarmsStmt.free();

  // Critical Alarm Trigger
  if (!isSensorOk && !openParameters.has('SENSOR_FAULT')) {
    newAlarms.push({
      alarm_id: 0,
      triggered_at: timestamp,
      motor_id: data.motorId,
      severity: 'SENSOR_ERROR',
      parameter: 'SENSOR_FAULT',
      measured_value: 0,
      threshold_limit: 0,
      message: `MPU6050 sensor hardware fault reported by node ${data.devEui}`,
      acknowledged: 0,
      cleared: 0,
      sequence: data.sequence,
    });
  } else if (consecutiveCrit >= config.critical_persistence && (data.overallRms >= critRms || data.peak >= critPeak)) {
    const isRms = data.overallRms >= critRms;
    const param = isRms ? 'OVERALL_RMS_CRITICAL' : 'PEAK_CRITICAL';
    if (!openParameters.has(param)) {
      newAlarms.push({
        alarm_id: 0,
        triggered_at: timestamp,
        motor_id: data.motorId,
        severity: 'CRITICAL',
        parameter: param,
        measured_value: isRms ? data.overallRms : data.peak,
        threshold_limit: isRms ? critRms : critPeak,
        message: `CRITICAL vibration limit breached: ${isRms ? 'RMS' : 'Peak'} = ${(isRms ? data.overallRms : data.peak).toFixed(3)}g (Limit: ${(isRms ? critRms : critPeak).toFixed(3)}g)`,
        acknowledged: 0,
        cleared: 0,
        sequence: data.sequence,
      });
    }
  } else if (consecutiveWarn >= config.warning_persistence && (data.overallRms >= warnRms || data.peak >= warnPeak)) {
    const isRms = data.overallRms >= warnRms;
    const param = isRms ? 'OVERALL_RMS_WARNING' : 'PEAK_WARNING';
    if (!openParameters.has(param)) {
      newAlarms.push({
        alarm_id: 0,
        triggered_at: timestamp,
        motor_id: data.motorId,
        severity: 'WARNING',
        parameter: param,
        measured_value: isRms ? data.overallRms : data.peak,
        threshold_limit: isRms ? warnRms : warnPeak,
        message: `Sustained WARNING vibration threshold exceeded: ${(isRms ? data.overallRms : data.peak).toFixed(3)}g (Limit: ${(isRms ? warnRms : warnPeak).toFixed(3)}g)`,
        acknowledged: 0,
        cleared: 0,
        sequence: data.sequence,
      });
    }
  } else if (isAnomaly && !openParameters.has('VIBRATION_ANOMALY')) {
    // Check if anomaly is sustained (or configured threshold)
    const lastAnomalies = recentHistory.slice(-config.sustained_count).filter((m) => m.anomaly_detected === 1).length;
    if (lastAnomalies + 1 >= config.sustained_count) {
      newAlarms.push({
        alarm_id: 0,
        triggered_at: timestamp,
        motor_id: data.motorId,
        severity: 'ANOMALY',
        parameter: 'VIBRATION_ANOMALY',
        measured_value: data.overallRms,
        threshold_limit: baseline ? baseline.mean_rms : 0.185,
        message: `Statistically significant anomaly detected: ${anomalyReason}`,
        acknowledged: 0,
        cleared: 0,
        sequence: data.sequence,
      });
    }
  }

  // 9. Auto-Clear Alarms when condition normalizes
  if (isSensorOk && data.overallRms < warnRms && data.peak < warnPeak && !isAnomaly) {
    database.run(
      `UPDATE alarm_events 
       SET cleared = 1, cleared_at = :now 
       WHERE motor_id = :id AND cleared = 0`,
      { ':now': timestamp, ':id': data.motorId }
    );
  }

  // 9b. Synthesize FFT Spectrum & Harmonic Spectral Energy Bands
  const runningFreq1X = motor?.rated_rpm ? Number((motor.rated_rpm / 60).toFixed(1)) : 24.0;
  let dominantFreq = data.dominantFreq ?? runningFreq1X;
  let dominantAmp = data.dominantAmp ?? Number((data.overallRms * 0.92).toFixed(4));

  if (possibleCondition === 'POSSIBLE_MISALIGNMENT') {
    dominantFreq = Number((runningFreq1X * 2).toFixed(1));
    dominantAmp = Number((data.overallRms * 0.86).toFixed(4));
  } else if (possibleCondition === 'POSSIBLE_LOOSENESS') {
    dominantFreq = Number((runningFreq1X * 3).toFixed(1));
    dominantAmp = Number((data.overallRms * 0.72).toFixed(4));
  }

  const band1x = data.band1x ?? Number((data.overallRms * (possibleCondition === 'POSSIBLE_IMBALANCE' ? 0.88 : 0.68)).toFixed(4));
  const band2x = data.band2x ?? Number((data.overallRms * (possibleCondition === 'POSSIBLE_MISALIGNMENT' ? 0.68 : 0.20)).toFixed(4));
  const band3x = data.band3x ?? Number((data.overallRms * (possibleCondition === 'POSSIBLE_LOOSENESS' ? 0.46 : 0.09)).toFixed(4));
  const bandSubSync = data.bandSubSync ?? Number((data.overallRms * 0.06).toFixed(4));
  const bandHighFreq = data.bandHighFreq ?? Number((data.overallRms * (possibleCondition === 'POSSIBLE_BEARING_FAULT' ? 0.48 : 0.11)).toFixed(4));
  const spectralEnergy = Number((Math.pow(data.overallRms, 2)).toFixed(5));

  // Synthesize 128-bin FFT spectrum (0 to 512 Hz, resolution 4 Hz)
  const fftBins: Array<{ freq: number; amp: number; harmonic?: string }> = [];
  const binResolution = 4;
  const totalBins = 128;
  for (let b = 0; b < totalBins; b++) {
    const f = b * binResolution;
    let amp = 0.002 + Math.random() * 0.003;
    let harmonicTag: string | undefined = undefined;

    if (Math.abs(f - runningFreq1X) < binResolution) {
      amp += band1x;
      harmonicTag = '1X';
    } else if (Math.abs(f - runningFreq1X * 2) < binResolution) {
      amp += band2x;
      harmonicTag = '2X';
    } else if (Math.abs(f - runningFreq1X * 3) < binResolution) {
      amp += band3x;
      harmonicTag = '3X';
    } else if (Math.abs(f - runningFreq1X * 4) < binResolution) {
      amp += Number((data.overallRms * 0.08).toFixed(4));
      harmonicTag = '4X';
    } else if (Math.abs(f - 50) < binResolution || Math.abs(f - 100) < binResolution) {
      amp += 0.012;
      harmonicTag = 'Line';
    } else if (f > 160) {
      amp += bandHighFreq * 0.12;
    }

    fftBins.push({
      freq: f,
      amp: Number(amp.toFixed(4)),
      harmonic: harmonicTag,
    });
  }

  const fftBinsJson = data.fftBinsJson || JSON.stringify(fftBins);

  // 10. Insert measurement record
  database.run(
    `INSERT INTO vibration_measurements (
      recorded_at, dev_eui, motor_id, sequence, overall_rms, x_rms, y_rms, z_rms,
      peak, peak_to_peak, crest_factor, temperature, sensor_status, health_status,
      health_score, anomaly_detected, anomaly_reason, trend_direction, trend_slope, possible_condition,
      dominant_freq, dominant_amp, spectral_energy, band_sub_sync, band_1x, band_2x, band_3x, band_high_freq, fft_bins_json,
      rssi, snr, raw_payload_hex
    ) VALUES (
      :recorded_at, :dev_eui, :motor_id, :sequence, :overall_rms, :x_rms, :y_rms, :z_rms,
      :peak, :peak_to_peak, :crest_factor, :temperature, :sensor_status, :health_status,
      :health_score, :anomaly_detected, :anomaly_reason, :trend_direction, :trend_slope, :possible_condition,
      :dominant_freq, :dominant_amp, :spectral_energy, :band_sub_sync, :band_1x, :band_2x, :band_3x, :band_high_freq, :fft_bins_json,
      :rssi, :snr, :raw_payload_hex
    )`,
    {
      ':recorded_at': timestamp,
      ':dev_eui': data.devEui,
      ':motor_id': data.motorId,
      ':sequence': data.sequence,
      ':overall_rms': data.overallRms,
      ':x_rms': xVal,
      ':y_rms': yVal,
      ':z_rms': zVal,
      ':peak': data.peak,
      ':peak_to_peak': data.peakToPeak,
      ':crest_factor': data.crestFactor,
      ':temperature': data.temperature,
      ':sensor_status': data.sensorStatus,
      ':health_status': health,
      ':health_score': healthScore,
      ':anomaly_detected': isAnomaly,
      ':anomaly_reason': anomalyReason,
      ':trend_direction': trend.direction,
      ':trend_slope': trend.slope,
      ':possible_condition': possibleCondition,
      ':dominant_freq': dominantFreq,
      ':dominant_amp': dominantAmp,
      ':spectral_energy': spectralEnergy,
      ':band_sub_sync': bandSubSync,
      ':band_1x': band1x,
      ':band_2x': band2x,
      ':band_3x': band3x,
      ':band_high_freq': bandHighFreq,
      ':fft_bins_json': fftBinsJson,
      ':rssi': data.rssi ?? null,
      ':snr': data.snr ?? null,
      ':raw_payload_hex': data.rawPayloadHex ?? null,
    }
  );

  // 11. Update device last seen
  database.run(
    `UPDATE devices 
     SET last_seen_at = :now, last_seq_num = :seq, last_rssi = :rssi, last_snr = :snr, status = 'ONLINE'
     WHERE dev_eui = :dev_eui`,
    {
      ':now': timestamp,
      ':seq': data.sequence,
      ':rssi': data.rssi ?? null,
      ':snr': data.snr ?? null,
      ':dev_eui': data.devEui,
    }
  );

  // 12. Save new alarms
  for (const alarm of newAlarms) {
    database.run(
      `INSERT INTO alarm_events (
        triggered_at, motor_id, severity, parameter, measured_value,
        threshold_limit, message, acknowledged, cleared, sequence
      ) VALUES (
        :triggered_at, :motor_id, :severity, :parameter, :measured_value,
        :threshold_limit, :message, 0, 0, :sequence
      )`,
      {
        ':triggered_at': alarm.triggered_at,
        ':motor_id': alarm.motor_id,
        ':severity': alarm.severity,
        ':parameter': alarm.parameter,
        ':measured_value': alarm.measured_value,
        ':threshold_limit': alarm.threshold_limit,
        ':message': alarm.message,
        ':sequence': alarm.sequence ?? data.sequence,
      }
    );
  }

  saveDb();

  const latest = (await getLatestMeasurement(data.motorId))!;
  return { measurement: latest, newAlarms, isDuplicate: duplicate };
}

/**
 * Returns alarm events with status filtering.
 */
export async function getAlarms(statusFilter?: 'active' | 'acknowledged' | 'cleared' | 'all'): Promise<AlarmRecord[]> {
  const database = await getDb();
  let query = 'SELECT * FROM alarm_events';

  if (statusFilter === 'active') {
    query += ' WHERE cleared = 0 AND acknowledged = 0';
  } else if (statusFilter === 'acknowledged') {
    query += ' WHERE acknowledged = 1 AND cleared = 0';
  } else if (statusFilter === 'cleared') {
    query += ' WHERE cleared = 1';
  }

  query += ' ORDER BY triggered_at DESC LIMIT 100';

  const stmt = database.prepare(query);
  const results: AlarmRecord[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as AlarmRecord);
  }
  stmt.free();
  return results;
}

/**
 * Acknowledges an alarm.
 */
export async function acknowledgeAlarm(alarmId: number): Promise<boolean> {
  const database = await getDb();
  database.run(
    `UPDATE alarm_events 
     SET acknowledged = 1, acknowledged_at = datetime('now') 
     WHERE alarm_id = :id`,
    { ':id': alarmId }
  );
  saveDb();
  return true;
}

/**
 * Manually clears an alarm.
 */
export async function clearAlarm(alarmId: number): Promise<boolean> {
  const database = await getDb();
  database.run(
    `UPDATE alarm_events 
     SET cleared = 1, cleared_at = datetime('now') 
     WHERE alarm_id = :id`,
    { ':id': alarmId }
  );
  saveDb();
  return true;
}

/**
 * Updates motor thresholds.
 */
export async function updateMotorThresholds(
  motorId: string,
  thresholds: {
    warningRms?: number;
    criticalRms?: number;
    warningPeak?: number;
    criticalPeak?: number;
  }
): Promise<MotorRecord | null> {
  const database = await getDb();
  database.run(
    `UPDATE motors
     SET warning_rms = COALESCE(:warnRms, warning_rms),
         critical_rms = COALESCE(:critRms, critical_rms),
         warning_peak = COALESCE(:warnPeak, warning_peak),
         critical_peak = COALESCE(:critPeak, critical_peak)
     WHERE motor_id = :id`,
    {
      ':id': motorId,
      ':warnRms': thresholds.warningRms ?? null,
      ':critRms': thresholds.criticalRms ?? null,
      ':warnPeak': thresholds.warningPeak ?? null,
      ':critPeak': thresholds.criticalPeak ?? null,
    }
  );
  saveDb();
  return getMotorById(motorId);
}

/**
 * Updates comprehensive motor settings.
 */
export async function updateMotorSettings(
  motorId: string,
  settings: {
    tagName?: string;
    location?: string;
    ratedRpm?: number;
    ratedPowerKw?: number;
    warningRms?: number;
    criticalRms?: number;
    warningPeak?: number;
    criticalPeak?: number;
  }
): Promise<MotorRecord | null> {
  const database = await getDb();
  database.run(
    `UPDATE motors
     SET tag_name = COALESCE(:tagName, tag_name),
         location = COALESCE(:location, location),
         rated_rpm = COALESCE(:ratedRpm, rated_rpm),
         rated_power_kw = COALESCE(:ratedPowerKw, rated_power_kw),
         warning_rms = COALESCE(:warnRms, warning_rms),
         critical_rms = COALESCE(:critRms, critical_rms),
         warning_peak = COALESCE(:warnPeak, warning_peak),
         critical_peak = COALESCE(:critPeak, critical_peak)
     WHERE motor_id = :id`,
    {
      ':id': motorId,
      ':tagName': settings.tagName ?? null,
      ':location': settings.location ?? null,
      ':ratedRpm': settings.ratedRpm ?? null,
      ':ratedPowerKw': settings.ratedPowerKw ?? null,
      ':warnRms': settings.warningRms ?? null,
      ':critRms': settings.criticalRms ?? null,
      ':warnPeak': settings.warningPeak ?? null,
      ':critPeak': settings.criticalPeak ?? null,
    }
  );
  saveDb();
  return getMotorById(motorId);
}

/**
 * Returns a unified event timeline containing anomalies, warning alarms,
 * critical alarms, sensor faults, acknowledgements, and clear events.
 */
export async function getTimelineEvents(motorId: string, limit: number = 50): Promise<TimelineEvent[]> {
  const database = await getDb();
  const events: TimelineEvent[] = [];

  // 1. Alarms from alarm_events table
  const alarmStmt = database.prepare(`
    SELECT * FROM alarm_events 
    WHERE motor_id = :id 
    ORDER BY triggered_at DESC LIMIT :limit
  `);
  alarmStmt.bind({ ':id': motorId, ':limit': limit });

  while (alarmStmt.step()) {
    const row = alarmStmt.getAsObject() as any;
    let eventType: TimelineEvent['type'] = 'WARNING';
    if (row.severity === 'CRITICAL') eventType = 'CRITICAL';
    else if (row.severity === 'SENSOR_ERROR') eventType = 'SENSOR_ERROR';
    else if (row.severity === 'ANOMALY') eventType = 'ANOMALY';

    events.push({
      id: `alarm-${row.alarm_id}`,
      timestamp: row.triggered_at,
      type: eventType,
      title: `${row.severity} Alarm: ${row.parameter}`,
      details: row.message,
      value: row.measured_value,
      limit: row.threshold_limit,
      sequence: row.sequence,
    });

    if (row.acknowledged === 1 && row.acknowledged_at) {
      events.push({
        id: `ack-${row.alarm_id}`,
        timestamp: row.acknowledged_at,
        type: 'ACKNOWLEDGED',
        title: `Alarm Acknowledged by Operator`,
        details: `Acknowledged: ${row.parameter} (${row.message})`,
      });
    }

    if (row.cleared === 1 && row.cleared_at) {
      events.push({
        id: `clear-${row.alarm_id}`,
        timestamp: row.cleared_at,
        type: 'CLEARED',
        title: `Alarm Condition Cleared`,
        details: `Vibration returned to normal operating range for ${row.parameter}`,
      });
    }
  }
  alarmStmt.free();

  // 2. Baselines created
  const baseStmt = database.prepare(`
    SELECT * FROM cbm_baselines 
    WHERE motor_id = :id 
    ORDER BY created_at DESC LIMIT 5
  `);
  baseStmt.bind({ ':id': motorId });
  while (baseStmt.step()) {
    const row = baseStmt.getAsObject() as any;
    events.push({
      id: `base-${row.id}`,
      timestamp: row.created_at,
      type: 'BASELINE_CREATED',
      title: 'Operating Baseline Learned',
      details: `Calculated from ${row.sample_count} samples: Mean RMS ${row.mean_rms.toFixed(3)}g (±${row.std_rms.toFixed(3)}g)`,
      value: row.mean_rms,
    });
  }
  baseStmt.free();

  // Sort chronologically descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}

/**
 * Returns comprehensive Motor Health Report data.
 */
export async function getHealthReport(motorId: string, hours: number = 24) {
  const motor = await getMotorById(motorId);
  const baseline = await getActiveBaseline(motorId);
  const latest = await getLatestMeasurement(motorId);
  const devices = await getDevices();
  const device = devices.find((d) => d.motor_id === motorId) || devices[0];

  const measurements = await getMeasurements(motorId, undefined, undefined, 200);

  const n = measurements.length;
  let avgRms = 0;
  let maxRms = 0;
  let maxPeak = 0;
  let anomalyCount = 0;

  if (n > 0) {
    avgRms = Number((measurements.reduce((acc, m) => acc + m.overall_rms, 0) / n).toFixed(4));
    maxRms = Number(Math.max(...measurements.map((m) => m.overall_rms)).toFixed(4));
    maxPeak = Number(Math.max(...measurements.map((m) => m.peak)).toFixed(4));
    anomalyCount = measurements.filter((m) => m.anomaly_detected === 1).length;
  }

  const alarms = await getAlarms();
  const totalAlarms = alarms.length;
  const activeAlarms = alarms.filter((a) => a.cleared === 0).length;

  const commAvailabilityPct = device && device.status === 'ONLINE' ? 99.4 : 85.0;

  return {
    motorId,
    tagName: motor?.tag_name || 'Cooling Tower Feed Pump Motor 01',
    location: motor?.location || 'Drive-End Bearing Bay #3',
    ratedRpm: motor?.rated_rpm || 1440,
    ratedPowerKw: motor?.rated_power_kw || 11.0,
    generatedAt: new Date().toISOString(),
    monitoringPeriodHours: hours,
    sampleCount: n,
    baselineRms: baseline?.mean_rms ?? 0.185,
    baselineStdRms: baseline?.std_rms ?? 0.0125,
    currentRms: latest?.overall_rms ?? 0.185,
    currentPeak: latest?.peak ?? 0.320,
    rmsDeviationPct: baseline && latest
      ? Number((((latest.overall_rms - baseline.mean_rms) / baseline.mean_rms) * 100).toFixed(1))
      : 0.0,
    averageRms: avgRms,
    maxRms,
    maxPeak,
    trendDirection: latest?.trend_direction || 'STABLE',
    trendSlope: latest?.trend_slope || 0.0,
    cbmHealthScore: latest?.health_score ?? 95.0,
    healthStatus: latest?.health_status || 'NORMAL',
    possibleCondition: latest?.possible_condition || 'NORMAL',
    dominantFrequency: latest?.dominant_freq ?? 24.0,
    dominantAmplitude: latest?.dominant_amp ?? 0.180,
    currentCrestFactor: latest?.crest_factor ?? (latest?.overall_rms && latest.overall_rms > 0 ? Number((latest.peak / latest.overall_rms).toFixed(2)) : 1.73),
    temperature: latest?.temperature ?? 28.5,
    totalAlarms,
    activeAlarms,
    anomalyCount,
    communicationAvailabilityPct: commAvailabilityPct,
    warningLimitRms: motor?.warning_rms ?? 0.280,
    criticalLimitRms: motor?.critical_rms ?? 0.450,
  };
}

/**
 * Seeds realistic historical telemetry points across a specified time span.
 */
export async function seedHistoricalBaseline(motorId: string = 'MOTOR_01', pointCount: number = 48): Promise<number> {
  const database = await getDb();
  const now = Date.now();
  const intervalMs = (24 * 3600 * 1000) / pointCount;
  const motor = await getMotorById(motorId);
  const warnRms = motor?.warning_rms ?? 0.280;
  const critRms = motor?.critical_rms ?? 0.450;
  const baseRms = 0.185;

  for (let i = pointCount; i >= 1; i--) {
    const timestamp = new Date(now - i * intervalMs).toISOString();
    const drift = Math.sin((i / pointCount) * Math.PI * 2) * 0.020;
    const noise = (Math.random() - 0.5) * 0.015;
    const rms = Math.max(0.14, Number((baseRms + drift + noise).toFixed(4)));
    const peak = Number((rms * (1.65 + Math.random() * 0.35)).toFixed(4));
    const pkpk = Number((peak * (1.75 + Math.random() * 0.3)).toFixed(4));
    const crest = Number((peak / rms).toFixed(2));
    const temp = Number((28.0 + Math.sin(i / 6) * 3.0 + (Math.random() - 0.5) * 0.6).toFixed(1));
    const xRms = Number((rms * 0.72).toFixed(4));
    const yRms = Number((rms * 0.62).toFixed(4));
    const zRms = Number((rms * 0.31).toFixed(4));

    const health = rms >= critRms ? 'CRITICAL' : rms >= warnRms ? 'WARNING' : 'NORMAL';
    const score = Number(Math.max(60, 100 - ((rms - baseRms) / (critRms - baseRms)) * 40).toFixed(1));

    database.run(
      `INSERT INTO vibration_measurements (
        recorded_at, dev_eui, motor_id, sequence, overall_rms, x_rms, y_rms, z_rms,
        peak, peak_to_peak, crest_factor, temperature, sensor_status, health_status,
        health_score, anomaly_detected, trend_direction, possible_condition,
        dominant_freq, dominant_amp, spectral_energy, band_sub_sync, band_1x, band_2x, band_3x, band_high_freq,
        rssi, snr, raw_payload_hex
      ) VALUES (
        :recorded_at, '0000000000000001', :motor_id, :sequence, :overall_rms, :x_rms, :y_rms, :z_rms,
        :peak, :peak_to_peak, :crest_factor, :temperature, 'OK', :health_status,
        :health_score, 0, 'STABLE', 'NORMAL',
        24.0, :dominant_amp, :spectral_energy, :band_sub_sync, :band_1x, :band_2x, :band_3x, :band_high_freq,
        -75, 8.5, 'SEEDED_HISTORICAL'
      )`,
      {
        ':recorded_at': timestamp,
        ':motor_id': motorId,
        ':sequence': (pointCount - i) % 256,
        ':overall_rms': rms,
        ':x_rms': xRms,
        ':y_rms': yRms,
        ':z_rms': zRms,
        ':peak': peak,
        ':peak_to_peak': pkpk,
        ':crest_factor': crest,
        ':temperature': temp,
        ':health_status': health,
        ':health_score': score,
        ':dominant_amp': Number((rms * 0.9).toFixed(4)),
        ':spectral_energy': Number((rms * rms).toFixed(5)),
        ':band_sub_sync': Number((rms * 0.05).toFixed(4)),
        ':band_1x': Number((rms * 0.70).toFixed(4)),
        ':band_2x': Number((rms * 0.18).toFixed(4)),
        ':band_3x': Number((rms * 0.08).toFixed(4)),
        ':band_high_freq': Number((rms * 0.10).toFixed(4)),
      }
    );
  }

  saveDb();
  return pointCount;
}

export interface WorkOrderDbRow {
  id: string;
  work_order_number: string;
  motor_id: string;
  motor_tag: string;
  title: string;
  priority: 'ROUTINE' | 'ELEVATED' | 'HIGH' | 'EMERGENCY';
  status: 'DRAFT' | 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  trigger_condition: string;
  detected_fault_signature: string;
  prescribed_actions_json: string;
  recommended_parts_json: string;
  estimated_labor_hours: number;
  target_completion_hours: number;
  target_due_date: string;
  created_at: string;
}

export async function getWorkOrders(motorId?: string): Promise<WorkOrderDbRow[]> {
  const database = await getDb();
  let query = 'SELECT * FROM maintenance_work_orders';
  const params: Record<string, any> = {};

  if (motorId) {
    query += ' WHERE motor_id = :motor_id';
    params[':motor_id'] = motorId;
  }
  query += ' ORDER BY created_at DESC';

  const stmt = database.prepare(query);
  if (motorId) {
    stmt.bind(params);
  }

  const results: WorkOrderDbRow[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as WorkOrderDbRow);
  }
  stmt.free();
  return results;
}

export async function getWorkOrderById(id: string): Promise<WorkOrderDbRow | null> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM maintenance_work_orders WHERE id = :id');
  stmt.bind({ ':id': id });
  let result: WorkOrderDbRow | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as WorkOrderDbRow;
  }
  stmt.free();
  return result;
}

export async function createWorkOrder(order: {
  id: string;
  workOrderNumber: string;
  motorId: string;
  motorTag: string;
  title: string;
  priority: string;
  status?: string;
  triggerCondition: string;
  detectedFaultSignature: string;
  prescribedActions: string[];
  recommendedParts: { partNumber: string; description: string; quantity: number }[];
  estimatedLaborHours: number;
  targetCompletionHours: number;
  targetDueDate: string;
}): Promise<WorkOrderDbRow> {
  const database = await getDb();
  database.run(
    `INSERT INTO maintenance_work_orders (
      id, work_order_number, motor_id, motor_tag, title, priority, status,
      trigger_condition, detected_fault_signature, prescribed_actions_json,
      recommended_parts_json, estimated_labor_hours, target_completion_hours,
      target_due_date, created_at
    ) VALUES (
      :id, :work_order_number, :motor_id, :motor_tag, :title, :priority, :status,
      :trigger_condition, :detected_fault_signature, :prescribed_actions_json,
      :recommended_parts_json, :estimated_labor_hours, :target_completion_hours,
      :target_due_date, datetime('now')
    )`,
    {
      ':id': order.id,
      ':work_order_number': order.workOrderNumber,
      ':motor_id': order.motorId,
      ':motor_tag': order.motorTag,
      ':title': order.title,
      ':priority': order.priority,
      ':status': order.status || 'OPEN',
      ':trigger_condition': order.triggerCondition,
      ':detected_fault_signature': order.detectedFaultSignature,
      ':prescribed_actions_json': JSON.stringify(order.prescribedActions),
      ':recommended_parts_json': JSON.stringify(order.recommendedParts),
      ':estimated_labor_hours': order.estimatedLaborHours,
      ':target_completion_hours': order.targetCompletionHours,
      ':target_due_date': order.targetDueDate,
    }
  );

  saveDb();
  const created = await getWorkOrderById(order.id);
  return created!;
}

export async function updateWorkOrderStatus(id: string, status: string): Promise<boolean> {
  const database = await getDb();
  database.run('UPDATE maintenance_work_orders SET status = :status WHERE id = :id', {
    ':status': status,
    ':id': id,
  });
  saveDb();
  return true;
}

