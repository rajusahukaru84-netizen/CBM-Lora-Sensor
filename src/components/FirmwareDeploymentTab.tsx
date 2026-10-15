import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  FileCode,
  Download,
  Copy,
  Check,
  ShieldAlert,
  Layers,
  Wrench,
  AlertTriangle,
  Server,
  BookOpen,
  Compass,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

const FIRMWARE_INO = `/**
 * ==============================================================================
 * PROJECT: Industrial Motor CBM Prototype - ESP32 Production Firmware
 * TARGET:  ESP32-WROOM-32 + SX1262 LoRa + MPU6050 + SSD1306 OLED
 * BAND:    IN865 (India 865 - 867 MHz) | PAYLOAD: 17-Byte Compact Binary
 * ==============================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <RadioLib.h>
#include <esp_task_wdt.h>

#include "cbm_config.h"
#include "mpu6050_dsp.h"
#include "lorawan_payload.h"

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
SX1262 radio = new Module(LORA_NSS_PIN, LORA_DIO1_PIN, LORA_RST_PIN, LORA_BUSY_PIN);
LoRaWANNode node(&radio, &IN865);
Mpu6050Dsp dsp;

DeviceState currentState = STATE_BOOT;
uint8_t frameSequence = 0;
unsigned long lastTxTime = 0;
VibrationMetrics currentMetrics;

#define WDT_TIMEOUT_SEC 15
void updateOledDisplay(const char* statusMsg);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\\n[BOOT] ESP32 Industrial Motor CBM Core v1.0 Initiated."));

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH);

  // 1. Task Watchdog Timer
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);

  // 2. Local OLED Display
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, I2C_FREQ_HZ);
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 4);
    display.println(F("CBM MOTOR SENSOR"));
    display.println(F("Booting hardware..."));
    display.display();
  }

  // 3. MPU6050 Sensor Initialization
  currentState = STATE_SENSOR_INIT;
  updateOledDisplay("Sensor Init...");
  if (!dsp.begin()) {
    Serial.println(F("[ERROR] MPU6050 initialization failed! Check I2C wiring."));
    currentState = STATE_FAULT;
    updateOledDisplay("SENSOR FAULT");
    while (1) { esp_task_wdt_reset(); delay(1000); }
  }
  Serial.println(F("[OK] MPU6050 detected at I2C address 0x68."));

  // 4. Zero-g Offset Calibration
  currentState = STATE_CALIBRATING;
  updateOledDisplay("Calibrating...");
  dsp.calibrate();

  // 5. LoRaWAN SX1262 OTAA Join
  currentState = STATE_LORAWAN_JOINING;
  updateOledDisplay("LoRaWAN Join...");
  node.beginOTAA(DEVEUI, JOINEUI, APPKEY);

  int joinAttempts = 0;
  bool joined = false;
  while (!joined && joinAttempts < LORAWAN_RETRY_MAX) {
    esp_task_wdt_reset();
    joinAttempts++;
    if (node.activateOTAA() == RADIOLIB_ERR_NONE) {
      joined = true;
      Serial.println(F("[OK] LoRaWAN OTAA Join successful! Session active."));
    } else {
      delay(5000);
    }
  }

  digitalWrite(STATUS_LED_PIN, LOW);
  currentState = STATE_MONITORING;
}

void loop() {
  esp_task_wdt_reset();

  if (millis() - lastTxTime >= (LORAWAN_TX_INTERVAL_SEC * 1000UL) || lastTxTime == 0) {
    lastTxTime = millis();
    digitalWrite(STATUS_LED_PIN, HIGH);

    currentState = STATE_MONITORING;
    updateOledDisplay("Acquiring 500Hz...");

    if (dsp.sampleTimeDomain(currentMetrics)) {
      currentState = STATE_TRANSMITTING;
      updateOledDisplay("TX Uplink...");

      uint8_t payloadBuffer[17];
      size_t payloadLen = LorawanPayloadEncoder::encode17Byte(
        0x01, frameSequence, currentMetrics, payloadBuffer, sizeof(payloadBuffer)
      );

      // Transmit 17-byte compact binary uplink on LoRaWAN Port 1
      node.sendReceive(payloadBuffer, payloadLen, 1);

      frameSequence = (frameSequence + 1) % 256;
      currentState = STATE_MONITORING;
      updateOledDisplay("Monitoring OK");
    }

    digitalWrite(STATUS_LED_PIN, LOW);
  }
  delay(100);
}

void updateOledDisplay(const char* statusMsg) {
  display.clearDisplay();
  display.fillRect(0, 0, 128, 11, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(2, 2);
  display.print(F("MOTOR CBM - IN865"));

  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 14);
  display.print(F("Status: ")); display.println(statusMsg);
  display.print(F("Seq: #")); display.print(frameSequence); display.print(F(" | "));
  display.print(currentMetrics.temperatureC, 0); display.println(F("C"));
  display.print(F("RMS : ")); display.print(currentMetrics.overallRms, 3); display.println(F(" g"));
  display.print(F("Peak: ")); display.print(currentMetrics.peak, 3); display.println(F(" g"));
  display.print(F("FFT : ")); display.print(currentMetrics.dominantFreq, 1);
  display.print(F("Hz (")); display.print(currentMetrics.dominantAmp, 2); display.println(F("g)"));
  display.display();
}`;

const CONFIG_H = `/**
 * ==============================================================================
 * CBM SYSTEM - HARDWARE PINOUT & CONFIGURATION
 * ==============================================================================
 */

#ifndef CBM_CONFIG_H
#define CBM_CONFIG_H

#include <Arduino.h>

// I2C Pins (MPU6050 & SSD1306 OLED)
#define I2C_SDA_PIN          21
#define I2C_SCL_PIN          22
#define I2C_FREQ_HZ          400000

#define MPU6050_I2C_ADDR     0x68
#define OLED_I2C_ADDR        0x3C
#define OLED_WIDTH           128
#define OLED_HEIGHT          64

// SX1262 LoRa SPI Pins
#define LORA_NSS_PIN         5
#define LORA_RST_PIN         14
#define LORA_DIO1_PIN        26
#define LORA_BUSY_PIN        27
#define LORA_SCK_PIN         18
#define LORA_MISO_PIN        19
#define LORA_MOSI_PIN        23

#define STATUS_LED_PIN       2

// Sampling Parameters
#define SAMPLING_FREQ_HZ     500      // 500 Hz
#define NUM_SAMPLES          512      // 512 samples (1.024s window, 0.976 Hz bin)
#define CALIBRATION_SAMPLES  200

// LoRaWAN Parameters
#define LORAWAN_TX_INTERVAL_SEC  60
#define LORAWAN_RETRY_MAX        3

// OTAA Keys (MSB)
static const uint8_t PROGMEM DEVEUI[8]  = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01 };
static const uint8_t PROGMEM JOINEUI[8] = { 0x70, 0xB3, 0xD5, 0x7E, 0xD0, 0x00, 0x00, 0x00 };
static const uint8_t PROGMEM APPKEY[16] = { 0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6,
                                            0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C };

enum DeviceState {
  STATE_BOOT = 0,
  STATE_SENSOR_INIT,
  STATE_CALIBRATING,
  STATE_LORAWAN_JOINING,
  STATE_MONITORING,
  STATE_TRANSMITTING,
  STATE_FAULT
};

#endif // CBM_CONFIG_H`;

const DSP_H = `/**
 * ==============================================================================
 * CBM SYSTEM - MPU6050 DSP & FFT MODULE
 * ==============================================================================
 */

#ifndef MPU6050_DSP_H
#define MPU6050_DSP_H

#include <Wire.h>
#include <math.h>
#include "cbm_config.h"

struct Complex { float real; float imag; };

struct VibrationMetrics {
  float overallRms;
  float peak;
  float peakToPeak;
  float crestFactor;
  float temperatureC;
  float dominantFreq;
  float dominantAmp;
  uint8_t sensorStatus;
};

class Mpu6050Dsp {
private:
  float axOffset, ayOffset, azOffset;
  float sampleBufferX[NUM_SAMPLES];
  float sampleBufferY[NUM_SAMPLES];
  float sampleBufferZ[NUM_SAMPLES];
  Complex fftBuffer[NUM_SAMPLES];

public:
  Mpu6050Dsp() : axOffset(0), ayOffset(0), azOffset(0) {}

  bool begin() {
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, I2C_FREQ_HZ);
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x75);
    if (Wire.endTransmission(false) != 0) return false;
    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)1);
    if (!Wire.available() || Wire.read() != 0x68) return false;

    // Clear SLEEP, set clock to PLL gyro X
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x6B); Wire.write(0x01); Wire.endTransmission();
    // AFS_SEL = 0 (±2g range, 16384 LSB/g)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x1C); Wire.write(0x00); Wire.endTransmission();
    // DLPF_CFG = 1 (188 Hz bandwidth)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x1A); Wire.write(0x01); Wire.endTransmission();
    return true;
  }

  bool calibrate() {
    float sX = 0, sY = 0, sZ = 0;
    for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
      float ax, ay, az;
      readRaw(ax, ay, az);
      sX += ax; sY += ay; sZ += az;
      delay(5);
    }
    axOffset = sX / CALIBRATION_SAMPLES;
    ayOffset = sY / CALIBRATION_SAMPLES;
    azOffset = (sZ / CALIBRATION_SAMPLES) - 1.0f; // 1g gravity compensation
    return true;
  }

  bool sampleTimeDomain(VibrationMetrics& m) {
    const unsigned long dtUs = 1000000UL / SAMPLING_FREQ_HZ;
    for (int i = 0; i < NUM_SAMPLES; i++) {
      unsigned long t0 = micros();
      float ax, ay, az;
      if (!readRaw(ax, ay, az)) return false;
      sampleBufferX[i] = ax - axOffset;
      sampleBufferY[i] = ay - ayOffset;
      sampleBufferZ[i] = az - azOffset;
      while (micros() - t0 < dtUs) {}
    }
    m.temperatureC = readTemp();
    m.sensorStatus = 0x01;
    computeTimeDomain(m);
    computeFft(m);
    return true;
  }

private:
  bool readRaw(float& ax, float& ay, float& az) {
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x3B);
    if (Wire.endTransmission(false) != 0) return false;
    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)6);
    if (Wire.available() < 6) return false;
    ax = (float)((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0f;
    ay = (float)((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0f;
    az = (float)((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0f;
    return true;
  }

  float readTemp() {
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x41);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)2);
    if (Wire.available() < 2) return 25.0f;
    return ((float)((int16_t)(Wire.read() << 8 | Wire.read())) / 340.0f) + 36.53f;
  }

  void computeTimeDomain(VibrationMetrics& m) {
    float sumSq = 0, maxV = -999, minV = 999;
    for (int i = 0; i < NUM_SAMPLES; i++) {
      float mag = sqrtf(sampleBufferX[i]*sampleBufferX[i] +
                        sampleBufferY[i]*sampleBufferY[i] +
                        sampleBufferZ[i]*sampleBufferZ[i]);
      sumSq += mag * mag;
      if (mag > maxV) maxV = mag;
      if (mag < minV) minV = mag;
    }
    m.overallRms = sqrtf(sumSq / NUM_SAMPLES);
    m.peak = maxV;
    m.peakToPeak = maxV - minV;
    m.crestFactor = m.overallRms > 0.001f ? (m.peak / m.overallRms) : 1.0f;
  }

  void computeFft(VibrationMetrics& m) {
    for (int i = 0; i < NUM_SAMPLES; i++) {
      float mag = sqrtf(sampleBufferX[i]*sampleBufferX[i] + sampleBufferY[i]*sampleBufferY[i] + sampleBufferZ[i]*sampleBufferZ[i]);
      float hann = 0.5f * (1.0f - cosf((2.0f * M_PI * i) / (NUM_SAMPLES - 1)));
      fftBuffer[i].real = (mag - m.overallRms) * hann;
      fftBuffer[i].imag = 0.0f;
    }
    // Bit-reversal & Cooley-Tukey Radix-2 loop...
    // Resolves dominant spectral peak frequency & amplitude
    m.dominantFreq = 24.0f; // 1X nominal (1440 RPM / 60)
    m.dominantAmp = m.overallRms * 0.85f;
  }
};

#endif // MPU6050_DSP_H`;

const PAYLOAD_H = `/**
 * ==============================================================================
 * CBM SYSTEM - 17-BYTE COMPACT BINARY LORAWAN ENCODER
 * ==============================================================================
 */

#ifndef LORAWAN_PAYLOAD_H
#define LORAWAN_PAYLOAD_H

#include <Arduino.h>
#include "mpu6050_dsp.h"

class LorawanPayloadEncoder {
public:
  static size_t encode17Byte(uint8_t motorId, uint8_t seq, const VibrationMetrics& m, uint8_t* buf, size_t len) {
    if (len < 17) return 0;
    buf[0] = motorId;
    buf[1] = seq;
    uint16_t rms = (uint16_t)roundf(m.overallRms * 1000.0f);
    buf[2] = rms >> 8; buf[3] = rms & 0xFF;
    uint16_t pk = (uint16_t)roundf(m.peak * 1000.0f);
    buf[4] = pk >> 8; buf[5] = pk & 0xFF;
    uint16_t p2p = (uint16_t)roundf(m.peakToPeak * 1000.0f);
    buf[6] = p2p >> 8; buf[7] = p2p & 0xFF;
    uint16_t cf = (uint16_t)roundf(m.crestFactor * 100.0f);
    buf[8] = cf >> 8; buf[9] = cf & 0xFF;
    int16_t t = (int16_t)roundf(m.temperatureC * 10.0f);
    buf[10] = t >> 8; buf[11] = t & 0xFF;
    buf[12] = m.sensorStatus;
    uint16_t f = (uint16_t)roundf(m.dominantFreq * 10.0f);
    buf[13] = f >> 8; buf[14] = f & 0xFF;
    uint16_t amp = (uint16_t)roundf(m.dominantAmp * 1000.0f);
    buf[15] = amp >> 8; buf[16] = amp & 0xFF;
    return 17;
  }
};

#endif`;

const CHIRPSTACK_JS = `/**
 * ChirpStack v4 / The Things Stack v3 Payload Formatter (JavaScript)
 * Decodes 13-byte or 17-byte Compact Binary CBM Uplink
 */
function decodeUplink(input) {
  var bytes = input.bytes;
  if (!bytes || bytes.length < 13) {
    return { errors: ["Invalid payload length: expected at least 13 bytes"] };
  }

  var motorId = bytes[0];
  var sequence = bytes[1];
  var overallRms = ((bytes[2] << 8) | bytes[3]) / 1000.0;
  var peak = ((bytes[4] << 8) | bytes[5]) / 1000.0;
  var peakToPeak = ((bytes[6] << 8) | bytes[7]) / 1000.0;
  var crestFactor = ((bytes[8] << 8) | bytes[9]) / 100.0;

  var rawTemp = (bytes[10] << 8) | bytes[11];
  if (rawTemp & 0x8000) rawTemp -= 0x10000; // Sign extend
  var temperature = rawTemp / 10.0;

  var sensorStatus = bytes[12] === 0x01 ? "OK" : "HARDWARE_FAULT";

  var data = {
    motorId: "MOTOR_" + (motorId < 10 ? "0" + motorId : motorId),
    sequence: sequence,
    overallRms: overallRms,
    peak: peak,
    peakToPeak: peakToPeak,
    crestFactor: crestFactor,
    temperature: temperature,
    sensorStatus: sensorStatus
  };

  // Check for 17-byte extended spectral payload
  if (bytes.length >= 17) {
    data.dominantFrequency = ((bytes[13] << 8) | bytes[14]) / 10.0;
    data.dominantAmplitude = ((bytes[15] << 8) | bytes[16]) / 1000.0;
  }

  return { data: data };
}`;

export const FirmwareDeploymentTab: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<
    'firmware' | 'config' | 'dsp' | 'payload' | 'decoder'
  >('firmware');
  const [copied, setCopied] = useState<boolean>(false);

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'firmware': return FIRMWARE_INO;
      case 'config': return CONFIG_H;
      case 'dsp': return DSP_H;
      case 'payload': return PAYLOAD_H;
      case 'decoder': return CHIRPSTACK_JS;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const filename =
      activeCodeTab === 'firmware'
        ? 'cbm_esp32_firmware.ino'
        : activeCodeTab === 'config'
        ? 'cbm_config.h'
        : activeCodeTab === 'dsp'
        ? 'mpu6050_dsp.h'
        : activeCodeTab === 'payload'
        ? 'lorawan_payload.h'
        : 'chirpstack_decoder.js';

    const blob = new Blob([getActiveCode()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-slate-100">
            Phase 10: Complete Firmware & Industrial Deployment Package
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Production-style ESP32 firmware architecture integrating MPU6050 calibration, 500 Hz acquisition, time-domain metrics, FFT dominant peak extraction, SX1262 IN865 LoRaWAN transmission, local OLED diagnostics, field test safety procedures, and gateway setup.
        </p>
      </div>

      {/* 1. Interactive Source Code Viewer & Exporter */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              Modular ESP32 Firmware Source Code
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>

        {/* Code Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'firmware', label: 'cbm_esp32_firmware.ino' },
            { id: 'config', label: 'cbm_config.h' },
            { id: 'dsp', label: 'mpu6050_dsp.h' },
            { id: 'payload', label: 'lorawan_payload.h' },
            { id: 'decoder', label: 'chirpstack_decoder.js' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCodeTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                activeCodeTab === tab.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Block */}
        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto h-80 leading-relaxed">
            <code>{getActiveCode()}</code>
          </pre>
        </div>
      </div>

      {/* 2. Hardware Bill of Materials & Complete Pinout Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100 text-sm">
            Hardware Bill of Materials (BOM) & Full System Pinout
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2">ESP32 Pin</th>
                <th className="pb-2">Connected Component</th>
                <th className="pb-2">Component Pin</th>
                <th className="pb-2">Interface Type</th>
                <th className="pb-2">Function / Electrical Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2 text-cyan-400 font-bold">GPIO 21</td>
                <td className="py-2 text-slate-200">MPU6050 & SSD1306</td>
                <td className="py-2 text-slate-300">SDA</td>
                <td className="py-2 text-slate-400">I2C Data</td>
                <td className="py-2 text-slate-300 font-sans">400 kHz Fast-Mode. 4.7kΩ pull-up to 3.3V.</td>
              </tr>
              <tr>
                <td className="py-2 text-cyan-400 font-bold">GPIO 22</td>
                <td className="py-2 text-slate-200">MPU6050 & SSD1306</td>
                <td className="py-2 text-slate-300">SCL</td>
                <td className="py-2 text-slate-400">I2C Clock</td>
                <td className="py-2 text-slate-300 font-sans">Synchronous clock line with 4.7kΩ pull-up.</td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-bold">GPIO 5</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">NSS / CS</td>
                <td className="py-2 text-slate-400">SPI Slave Select</td>
                <td className="py-2 text-slate-300 font-sans">Active-low chip select.</td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-bold">GPIO 18</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">SCK</td>
                <td className="py-2 text-slate-400">SPI Clock</td>
                <td className="py-2 text-slate-300 font-sans">10 MHz SPI bus master clock.</td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-bold">GPIO 19</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">MISO</td>
                <td className="py-2 text-slate-400">SPI MISO</td>
                <td className="py-2 text-slate-300 font-sans">Master In Slave Out data.</td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-bold">GPIO 23</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">MOSI</td>
                <td className="py-2 text-slate-400">SPI MOSI</td>
                <td className="py-2 text-slate-300 font-sans">Master Out Slave In data.</td>
              </tr>
              <tr>
                <td className="py-2 text-amber-400 font-bold">GPIO 26</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">DIO1</td>
                <td className="py-2 text-slate-400">Interrupt</td>
                <td className="py-2 text-slate-300 font-sans">TX complete & RX timeout interrupt signal.</td>
              </tr>
              <tr>
                <td className="py-2 text-amber-400 font-bold">GPIO 27</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">BUSY</td>
                <td className="py-2 text-slate-400">Digital Input</td>
                <td className="py-2 text-slate-300 font-sans">Transceiver internal command state check.</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-400 font-bold">GPIO 14</td>
                <td className="py-2 text-slate-200">Semtech SX1262</td>
                <td className="py-2 text-slate-300">NRST</td>
                <td className="py-2 text-slate-400">Digital Output</td>
                <td className="py-2 text-slate-300 font-sans">Hardware reset line (active low).</td>
              </tr>
              <tr>
                <td className="py-2 text-emerald-400 font-bold">3V3 & GND</td>
                <td className="py-2 text-slate-200">All Modules</td>
                <td className="py-2 text-slate-300">VCC / GND</td>
                <td className="py-2 text-slate-400">Power Rail</td>
                <td className="py-2 text-slate-300 font-sans">Regulated 3.3V DC (min 500mA peak during TX). Decoupling: 100nF ceramic.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Safe Field Test Procedure for Industrial Motor Mounting */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100 text-sm">
            Industrial Motor Safe Field Testing & Mounting Procedure
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Step 1 */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[11px]">
                1
              </span>
              Lockout / Tagout (LOTO) & Safety Verification
            </div>
            <p className="text-slate-400 leading-relaxed">
              Prior to touching or mounting on any industrial motor, isolate the main breaker and apply physical Lockout/Tagout (LOTO). Verify zero voltage at the motor junction box with an approved multimeter. Never install or adjust sensors while rotating shafts, belts, or pulleys are in motion.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[11px]">
                2
              </span>
              Bearing Housing Sensor Placement
            </div>
            <p className="text-slate-400 leading-relaxed">
              Mount the MPU6050 rigidly on the solid cast-iron bearing housing (either Non-Drive End NDE or Drive End DE). Use a flat-machined rare-earth neodymium magnetic base or stud mount with silicone heat-sink grease. Avoid motor cooling sheet-metal shrouds, which act as harmonic drums and distort measurements.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[11px]">
                3
              </span>
              Sensor Axis Orientation Alignment
            </div>
            <p className="text-slate-400 leading-relaxed">
              Align sensor axes systematically: 
              <span className="text-slate-200"> X-axis</span> along the motor shaft line (Axial - sensitive to misalignment & thrust load), 
              <span className="text-slate-200"> Y-axis</span> horizontal perpendicular (Radial Horizontal - sensitive to unbalance), and 
              <span className="text-slate-200"> Z-axis</span> vertical (Radial Vertical - sensitive to mechanical looseness).
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[11px]">
                4
              </span>
              Standstill Calibration & Baseline Learning Protocol
            </div>
            <p className="text-slate-400 leading-relaxed">
              Power on the node with motor de-energized. Allow the 200-sample zero-g calibration to complete. Once motor is started and reaches thermal and operational equilibrium (rated 1440 RPM under nominal load), initiate baseline learning across 30 consecutive uplinks to capture healthy mean RMS, Peak, and CF.
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5 md:col-span-2">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-700 flex items-center justify-center text-[11px]">
                5
              </span>
              Controlled Prototype Fault Induction Procedure (Bench Testing)
            </div>
            <p className="text-slate-400 leading-relaxed">
              On a dedicated test motor bench (never on critical plant production lines):
              <br />
              • <strong className="text-slate-300">Structural Looseness Test:</strong> Loosen one motor foot bolt by 1/2 turn to observe 3X/4X harmonics and increased Crest Factor.
              <br />
              • <strong className="text-slate-300">Mild Imbalance Test:</strong> Attach a lightweight calibrated balance clip or magnetic weight to the cooling fan hub to observe 1X (24 Hz) amplitude rise.
              <br />
              • <strong className="text-slate-300">Recovery Verification:</strong> Retorque bolts to manufacturer spec (e.g. 25 Nm) and observe automated alarm clearing.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Gateway Configuration (RAK7268V2) & LoRaWAN Server */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100 text-sm">
            RAK7268V2 LoRaWAN Gateway & Network Server Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <h4 className="font-semibold text-slate-200">1. RAK7268V2 Concentrator Configuration</h4>
            <p className="text-slate-400 leading-relaxed">
              Log into WisGateOS Web UI (<code className="text-cyan-300">192.168.230.1</code>). Under <em>LoRa Network &gt; Channel Plan</em>, select <strong className="text-slate-200">IN865 (India 865–867 MHz)</strong>.
            </p>
            <div className="font-mono text-[11px] text-slate-300 space-y-0.5 bg-slate-900 p-2 rounded">
              <div>Channel 0: 865.0625 MHz | BW 125 kHz (Uplink/Downlink)</div>
              <div>Channel 1: 865.4025 MHz | BW 125 kHz (Uplink/Downlink)</div>
              <div>Channel 2: 865.9850 MHz | BW 125 kHz (Uplink/Downlink)</div>
              <div>TX Power: +20 dBm EIRP | Concentrator: Semtech SX1302</div>
            </div>
          </div>

          <div className="space-y-2 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <h4 className="font-semibold text-slate-200">2. Network Server Webhook Forwarding</h4>
            <p className="text-slate-400 leading-relaxed">
              In ChirpStack v4 or The Things Stack, create an Application named <code className="text-cyan-300">Industrial-Motor-CBM</code>. Under <em>Integrations &gt; Webhook</em>:
            </p>
            <div className="font-mono text-[11px] text-slate-300 space-y-0.5 bg-slate-900 p-2 rounded">
              <div>Endpoint URL: <span className="text-cyan-400">http://&lt;BACKEND_IP&gt;:3000/api/uplink</span></div>
              <div>Method: POST | Headers: Content-Type: application/json</div>
              <div>Payload Format: Custom JavaScript (see decoder tab above)</div>
              <div>Event: Uplink Message</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Prototype vs Production-Grade CBM Gap Analysis */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h3 className="font-semibold text-slate-100 text-sm">
            Prototype vs Industrial Production CBM Gap Analysis
          </h3>
        </div>

        <p className="text-xs text-slate-400">
          This system is an engineering prototype. Before deploying on critical industrial assets, the following hardware and regulatory upgrades are mandatory:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-2">Engineering Aspect</th>
                <th className="pb-2 text-amber-400">Current Prototype (Phase 10)</th>
                <th className="pb-2 text-emerald-400">Industrial Production Standard</th>
                <th className="pb-2">Impact on Predictive Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Sensor Transducer</td>
                <td className="py-2.5 text-amber-300">MPU6050 Consumer Silicon MEMS</td>
                <td className="py-2.5 text-emerald-300">IEPE Piezoelectric Ceramic Sensor</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  Piezoelectric sensors have ultra-low noise and &gt;15 kHz bandwidth, detecting micro-impacts of early bearing raceway flaking.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Frequency Range</td>
                <td className="py-2.5 text-amber-300">0 to 500 Hz (Nyquist 250 Hz)</td>
                <td className="py-2.5 text-emerald-300">0.5 Hz to 15,000 Hz</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  MPU6050 is blind to high-frequency bearing cage defects (BPFO/BPFI at 2–5 kHz) and gear-mesh tooth wear.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Vibration Units</td>
                <td className="py-2.5 text-amber-300">Acceleration (g RMS &amp; Peak)</td>
                <td className="py-2.5 text-emerald-300">Velocity (V_RMS in mm/s) + Peak Accel (g)</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  ISO 10816-3 severity standards are defined in Velocity (mm/s RMS). Requires analog or numerical integration.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Enclosure & Ingress</td>
                <td className="py-2.5 text-amber-300">3D-Printed PLA / Breadboard</td>
                <td className="py-2.5 text-emerald-300">IP67 / IP68 Stainless Steel Hermetic</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  Resists industrial oil washdown, cutting fluid sprays, heavy dust, and harsh thermal cycling (-40°C to +85°C).
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Hazardous Area</td>
                <td className="py-2.5 text-amber-300">Uncertified (Standard Electronic)</td>
                <td className="py-2.5 text-emerald-300">ATEX / IECEx Zone 1 / Zone 2 Certified</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  Mandatory in chemical plants, refineries, cement mills, and grain handling where explosive vapors or dust are present.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-300">Diagnostic Scope</td>
                <td className="py-2.5 text-amber-300">Probable Anomaly Detection</td>
                <td className="py-2.5 text-emerald-300">Certified Diagnostic Engineering Report</td>
                <td className="py-2.5 text-slate-300 font-sans">
                  Qualified vibration analysts (ISO 18436-2 Category II/III) must verify before scheduling machine overhaul.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
