import React, { useState, useEffect, useCallback } from 'react';
import { Motor, Device, Measurement, Alarm, ActiveTab, TimeRange } from './types';
import {
  getMotors,
  getDevices,
  getMeasurements,
  getAlarms,
  acknowledgeAlarmApi,
  clearAlarmApi,
} from './services/api';
import { useWebSocket, WebSocketMessage } from './services/useWebSocket';
import { Header } from './components/Header';
import { OverviewDashboard } from './components/OverviewDashboard';
import { MotorDetailsTab } from './components/MotorDetailsTab';
import { HistoricalChart } from './components/HistoricalChart';
import { AlarmList } from './components/AlarmList';
import { SystemFlowTab } from './components/SystemFlowTab';
import { SettingsTab } from './components/SettingsTab';
import { CbmIntelligenceTab } from './components/CbmIntelligenceTab';
import { EventTimelineTab } from './components/EventTimelineTab';
import { HealthReportTab } from './components/HealthReportTab';
import { FftPreparationTab } from './components/FftPreparationTab';
import { FrequencyAnalysisTab } from './components/FrequencyAnalysisTab';
import { FirmwareDeploymentTab } from './components/FirmwareDeploymentTab';
import { TestSuiteTab } from './components/TestSuiteTab';
import { CommissioningValidationTab } from './components/CommissioningValidationTab';
import { PredictiveMaintenanceTab } from './components/PredictiveMaintenanceTab';
import { EngineeringLimitationsModal } from './components/EngineeringLimitationsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [motor, setMotor] = useState<Motor | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<Measurement | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLimitationsOpen, setIsLimitationsOpen] = useState<boolean>(false);

  // Load motor & device metadata and latest measurement
  const loadPrimaryData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [motorsData, devicesData, alarmsData] = await Promise.all([
        getMotors().catch(() => []),
        getDevices().catch(() => ({ devices: [] })),
        getAlarms().catch(() => []),
      ]);

      if (Array.isArray(motorsData) && motorsData.length > 0) {
        const primaryMotor = motorsData[0];
        setMotor(primaryMotor);
        if (primaryMotor.latestMeasurement) {
          setLatestMeasurement(primaryMotor.latestMeasurement);
        }
      }

      if (devicesData && devicesData.devices && devicesData.devices.length > 0) {
        setDevice(devicesData.devices[0]);
      }

      if (Array.isArray(alarmsData)) {
        setAlarms(alarmsData);
      }
    } catch (err) {
      console.error('Failed loading primary data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Load historical time-series for the selected range
  const loadHistoricalData = useCallback(async (range: TimeRange) => {
    try {
      setIsLoadingMeasurements(true);
      const data = await getMeasurements('MOTOR_01', range);
      setMeasurements(data);
    } catch (err) {
      console.error('Failed loading measurements:', err);
    } finally {
      setIsLoadingMeasurements(false);
    }
  }, []);

  // Handle live WebSocket telemetry events
  const handleWebSocketEvent = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.event === 'MEASUREMENT_RECEIVED' && msg.payload?.measurement) {
        const newMeas: Measurement = msg.payload.measurement;
        setLatestMeasurement(newMeas);
        setMeasurements((prev) => [newMeas, ...prev.slice(0, 199)]);

        // Update device last seen & sequence
        setDevice((prev) =>
          prev
            ? {
                ...prev,
                last_seen_at: newMeas.recorded_at,
                last_seq_num: newMeas.sequence,
                status: 'ONLINE',
              }
            : null
        );

        // If alarm was triggered or changed, refresh alarms
        getAlarms().then(setAlarms).catch(console.error);
      } else if (
        msg.event === 'ALARM_ACKNOWLEDGED' ||
        msg.event === 'ALARM_CLEARED' ||
        msg.event === 'ALARM_CREATED'
      ) {
        getAlarms().then(setAlarms).catch(console.error);
      } else if (
        msg.event === 'THRESHOLDS_UPDATED' ||
        msg.event === 'MOTOR_UPDATED' ||
        msg.event === 'BASELINE_UPDATED' ||
        msg.event === 'CBM_CONFIG_UPDATED'
      ) {
        loadPrimaryData();
      } else if (msg.event === 'HISTORY_SEEDED') {
        loadHistoricalData(selectedRange);
      }
    },
    [loadPrimaryData, loadHistoricalData, selectedRange]
  );

  const { status: wsStatus } = useWebSocket(handleWebSocketEvent);

  // Initial load
  useEffect(() => {
    loadPrimaryData();
    loadHistoricalData(selectedRange);

    // Periodic safety polling (every 10s)
    const timer = setInterval(() => {
      loadPrimaryData();
    }, 10000);

    return () => clearInterval(timer);
  }, [loadPrimaryData, loadHistoricalData, selectedRange]);

  const handleRangeChange = (newRange: TimeRange) => {
    setSelectedRange(newRange);
    loadHistoricalData(newRange);
  };

  const handleAcknowledgeAlarm = async (alarmId: number) => {
    await acknowledgeAlarmApi(alarmId);
    const updated = await getAlarms();
    setAlarms(updated);
  };

  const handleClearAlarm = async (alarmId: number) => {
    await clearAlarmApi(alarmId);
    const updated = await getAlarms();
    setAlarms(updated);
  };

  const isNodeOnline = device?.status === 'ONLINE';
  const isSensorOk = latestMeasurement ? latestMeasurement.sensor_status === 'OK' : true;

  return (
    <div id="cbm-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* SCADA Global Header & Tab Navigation */}
      <Header
        motor={motor}
        device={device}
        latest={latestMeasurement}
        alarms={alarms}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wsStatus={wsStatus}
        onManualRefresh={() => {
          loadPrimaryData();
          loadHistoricalData(selectedRange);
        }}
        isRefreshing={isRefreshing}
        onOpenLimitations={() => setIsLimitationsOpen(true)}
      />

      {/* Main SCADA Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab 1: Operations Dashboard (All 14 requested metrics + Phase 8 CBM status) */}
        {activeTab === 'overview' && (
          <OverviewDashboard
            motor={motor}
            device={device}
            latest={latestMeasurement}
            measurements={measurements}
            alarms={alarms}
            onNavigateTab={setActiveTab}
            selectedRange={selectedRange}
            onRangeChange={handleRangeChange}
            isLoadingMeasurements={isLoadingMeasurements}
            onRefreshHistory={() => loadHistoricalData(selectedRange)}
          />
        )}

        {/* Tab: Phase 11 Real Motor Validation, Baseline Calibration & Repeatability */}
        {activeTab === 'commissioning' && motor && (
          <CommissioningValidationTab
            selectedMotor={motor}
            latestMeasurement={latestMeasurement}
            activeBaseline={null}
            cbmConfig={null}
          />
        )}

        {/* Tab: Phase 12 Predictive Maintenance & Remaining Useful Life (RUL) Modeling */}
        {activeTab === 'predictive-maintenance' && motor && (
          <PredictiveMaintenanceTab
            selectedMotor={motor}
            latestMeasurement={latestMeasurement}
            activeBaseline={null}
            cbmConfig={null}
          />
        )}

        {/* Tab 2: Phase 8 CBM Intelligence, Baseline, and Anomaly Detection Rules */}
        {activeTab === 'intelligence' && (
          <CbmIntelligenceTab
            motorId={motor?.motor_id || 'MOTOR_01'}
            latestMeasurement={latestMeasurement}
            onRefresh={() => {
              loadPrimaryData();
              loadHistoricalData(selectedRange);
            }}
          />
        )}

        {/* Tab 3: Phase 8 Event Timeline (Alarms, Anomalies, Baseline resets, Config) */}
        {activeTab === 'timeline' && (
          <EventTimelineTab motorId={motor?.motor_id || 'MOTOR_01'} />
        )}

        {/* Tab 4: Phase 8 Health Report (Formal CBM machinery audit report + JSON/TXT export) */}
        {activeTab === 'report' && (
          <HealthReportTab
            motorId={motor?.motor_id || 'MOTOR_01'}
            latestMeasurement={latestMeasurement}
          />
        )}

        {/* Tab 5: Alarms & Threshold Violation Console with Auto-Clear and Acknowledgment */}
        {activeTab === 'alarms' && (
          <AlarmList
            alarms={alarms}
            onAcknowledge={handleAcknowledgeAlarm}
            onClear={handleClearAlarm}
            isNodeOnline={isNodeOnline}
            isSensorOk={isSensorOk}
          />
        )}

        {/* Tab 6: Motor Details & Tri-Axial Kinematics */}
        {activeTab === 'motor-details' && (
          <MotorDetailsTab
            motor={motor}
            device={device}
            latest={latestMeasurement}
          />
        )}

        {/* Tab 7: Historical Trends & Interactive Zoom Charts */}
        {activeTab === 'trends' && (
          <HistoricalChart
            measurements={measurements}
            motor={motor}
            selectedRange={selectedRange}
            onRangeChange={handleRangeChange}
            isLoading={isLoadingMeasurements}
            onRefresh={() => loadHistoricalData(selectedRange)}
          />
        )}

        {/* Tab 5: Frequency-Domain Analysis & FFT Vibration Spectrum */}
        {activeTab === 'frequency-analysis' && (
          <FrequencyAnalysisTab
            motor={motor}
            latestMeasurement={latestMeasurement}
            onRefresh={loadPrimaryData}
          />
        )}

        {/* Tab 6: Phase 10 Production Firmware & Industrial Deployment */}
        {activeTab === 'firmware-deploy' && (
          <FirmwareDeploymentTab />
        )}

        {/* Tab 8: FFT Mathematical Design & Algorithm Architecture */}
        {activeTab === 'fft-prep' && (
          <FftPreparationTab motor={motor} />
        )}

        {/* Tab 9: Phase 10 Complete 20-Point End-to-End Verification Suite */}
        {activeTab === 'test-suite' && (
          <TestSuiteTab
            motorId={motor?.motor_id || 'MOTOR_01'}
            onRefresh={() => {
              loadPrimaryData();
              loadHistoricalData(selectedRange);
            }}
          />
        )}

        {/* Tab 10: Signal Chain Flow & LoRaWAN Codec Explorer */}
        {activeTab === 'system-flow' && (
          <SystemFlowTab
            motor={motor}
            device={device}
            latest={latestMeasurement}
          />
        )}

        {/* Tab 11: Settings & Baseline Limits */}
        {activeTab === 'settings' && (
          <SettingsTab
            motor={motor}
            device={device}
            onRefresh={() => {
              loadPrimaryData();
              loadHistoricalData(selectedRange);
            }}
          />
        )}
      </main>

      {/* Phase 10 Engineering Limitations Modal */}
      <EngineeringLimitationsModal
        isOpen={isLimitationsOpen}
        onClose={() => setIsLimitationsOpen(false)}
      />

      {/* Industrial Status Bar Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-3 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Industrial CBM SCADA Core v3.0 (Phase 10 Complete System Integration &amp; Deployment)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Asset: {motor?.motor_id || 'MOTOR_01'}</span>
            <span>Gateway: RAK7268V2</span>
            <span>Band: IN865</span>
            <span>Node: ESP32 + SX1262</span>
            <span>Sensor: MPU6050</span>
            <button
              onClick={() => setIsLimitationsOpen(true)}
              className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Engineering Limitations &amp; Disclaimers
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
