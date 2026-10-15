/**
 * ==============================================================================
 * PROJECT: Industrial Motor CBM Prototype - ESP32 Production Firmware
 * FILE:    cbm_esp32_firmware.ino
 *
 * SYSTEM ARCHITECTURE:
 *  Industrial Motor -> MPU6050 (I2C) -> ESP32-WROOM-32 -> SX1262 LoRa (SPI)
 *  -> IN865 LoRaWAN -> RAK7268V2 Gateway -> Network Server -> CBM Backend -> Dashboard
 *
 * HARDWARE:
 *  - ESP32-WROOM-32 (240 MHz Dual Core)
 *  - MPU6050 6-DOF IMU (I2C Address 0x68)
 *  - Semtech SX1262 LoRa Transceiver (SPI)
 *  - 0.96" I2C OLED SSD1306 (128x64)
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

// Hardware instances
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
SX1262 radio = new Module(LORA_NSS_PIN, LORA_DIO1_PIN, LORA_RST_PIN, LORA_BUSY_PIN);
LoRaWANNode node(&radio, &IN865);
Mpu6050Dsp dsp;

// Global state variables
DeviceState currentState = STATE_BOOT;
uint8_t frameSequence = 0;
unsigned long lastTxTime = 0;
VibrationMetrics currentMetrics;

// Watchdog timeout (15 seconds)
#define WDT_TIMEOUT_SEC 15

void updateOledDisplay(const char* statusMsg);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n=========================================="));
  Serial.println(F("  INDUSTRIAL MOTOR CBM PROTOTYPE v1.0    "));
  Serial.println(F("  Target: ESP32 + SX1262 + MPU6050       "));
  Serial.println(F("  Band: IN865 (India 865 - 867 MHz)      "));
  Serial.println(F("=========================================="));

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH);

  // 1. Initialize Task Watchdog
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);

  // 2. Initialize OLED
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

  // 3. Initialize MPU6050
  currentState = STATE_SENSOR_INIT;
  updateOledDisplay("Sensor Init...");
  if (!dsp.begin()) {
    Serial.println(F("[ERROR] MPU6050 initialization failed! Check I2C bus wiring."));
    currentState = STATE_FAULT;
    updateOledDisplay("SENSOR FAULT");
    while (1) {
      esp_task_wdt_reset();
      delay(1000);
    }
  }
  Serial.println(F("[OK] MPU6050 detected on I2C address 0x68."));

  // 4. Calibrate Zero-g Offsets
  currentState = STATE_CALIBRATING;
  updateOledDisplay("Calibrating...");
  Serial.println(F("[CALIB] Measuring static zero-g offsets (motor at standstill)..."));
  if (dsp.calibrate()) {
    Serial.println(F("[OK] Zero-g offsets acquired and stored."));
  } else {
    Serial.println(F("[WARN] Calibration warning - using factory defaults."));
  }

  // 5. Initialize SX1262 LoRa Radio & Join LoRaWAN (OTAA)
  currentState = STATE_LORAWAN_JOINING;
  updateOledDisplay("LoRaWAN Joining...");
  Serial.println(F("[LORAWAN] Initializing SX1262 for IN865 frequency plan..."));
  
  int16_t state = radio.beginFSK(); // Initial SPI handshake check
  radio.standby();

  // Setup IN865 Channels and RadioLib LoRaWAN Node
  node.beginOTAA(DEVEUI, JOINEUI, APPKEY);
  Serial.println(F("[LORAWAN] Sending OTAA JoinRequest to RAK7268V2 Gateway..."));

  int joinAttempts = 0;
  bool joined = false;
  while (!joined && joinAttempts < LORAWAN_RETRY_MAX) {
    esp_task_wdt_reset();
    joinAttempts++;
    int16_t joinResult = node.activateOTAA();
    if (joinResult == RADIOLIB_ERR_NONE) {
      joined = true;
      Serial.println(F("[OK] LoRaWAN OTAA Join successful! Session established."));
    } else {
      Serial.print(F("[WARN] OTAA Join attempt "));
      Serial.print(joinAttempts);
      Serial.print(F(" failed (code: "));
      Serial.print(joinResult);
      Serial.println(F("). Retrying in 5s..."));
      delay(5000);
    }
  }

  digitalWrite(STATUS_LED_PIN, LOW);
  currentState = STATE_MONITORING;
  Serial.println(F("[SYSTEM] Initialization complete. Entering periodic monitoring loop."));
}

void loop() {
  esp_task_wdt_reset();

  // Periodic Vibration Monitoring & Uplink
  if (millis() - lastTxTime >= (LORAWAN_TX_INTERVAL_SEC * 1000UL) || lastTxTime == 0) {
    lastTxTime = millis();
    digitalWrite(STATUS_LED_PIN, HIGH);

    currentState = STATE_MONITORING;
    updateOledDisplay("Acquiring 500Hz...");
    Serial.println(F("\n[SAMPLE] Starting 512-point acceleration acquisition at 500 Hz..."));

    unsigned long sampleStart = millis();
    bool sampleOk = dsp.sampleTimeDomain(currentMetrics);
    unsigned long sampleDuration = millis() - sampleStart;

    if (!sampleOk) {
      Serial.println(F("[ERROR] Sensor acquisition timeout or I2C read failure!"));
      currentState = STATE_FAULT;
      updateOledDisplay("ACQUISITION FAULT");
    } else {
      Serial.print(F("[OK] Acquired in "));
      Serial.print(sampleDuration);
      Serial.println(F(" ms. Time-Domain Metrics:"));
      Serial.print(F("  - RMS: ")); Serial.print(currentMetrics.overallRms, 4); Serial.println(F(" g"));
      Serial.print(F("  - Peak: ")); Serial.print(currentMetrics.peak, 4); Serial.println(F(" g"));
      Serial.print(F("  - Peak-to-Peak: ")); Serial.print(currentMetrics.peakToPeak, 4); Serial.println(F(" g"));
      Serial.print(F("  - Crest Factor: ")); Serial.print(currentMetrics.crestFactor, 2); Serial.println(F(""));
      Serial.print(F("  - Temperature: ")); Serial.print(currentMetrics.temperatureC, 1); Serial.println(F(" degC"));
      Serial.print(F("  - Dominant Freq: ")); Serial.print(currentMetrics.dominantFreq, 1); Serial.println(F(" Hz"));
      Serial.print(F("  - Dominant Amp: ")); Serial.print(currentMetrics.dominantAmp, 4); Serial.println(F(" g"));

      // Transmit 17-Byte Binary Uplink
      currentState = STATE_TRANSMITTING;
      updateOledDisplay("TX Uplink...");

      uint8_t payloadBuffer[17];
      size_t payloadLen = LorawanPayloadEncoder::encode17Byte(
        0x01, // Motor 01
        frameSequence,
        currentMetrics,
        payloadBuffer,
        sizeof(payloadBuffer)
      );

      Serial.print(F("[TX] Uplink Frame #"));
      Serial.print(frameSequence);
      Serial.print(F(" ("));
      Serial.print(payloadLen);
      Serial.print(F(" bytes): 0x"));
      for (size_t i = 0; i < payloadLen; i++) {
        if (payloadBuffer[i] < 0x10) Serial.print(F("0"));
        Serial.print(payloadBuffer[i], HEX);
      }
      Serial.println();

      // Transmit on LoRaWAN Port 1
      int16_t txRes = node.sendReceive(payloadBuffer, payloadLen, 1);
      if (txRes == RADIOLIB_ERR_NONE) {
        Serial.println(F("[OK] LoRaWAN uplink acknowledged by gateway!"));
      } else {
        Serial.print(F("[WARN] Uplink transmit returned code: "));
        Serial.println(txRes);
      }

      frameSequence = (frameSequence + 1) % 256;
      currentState = STATE_MONITORING;
      updateOledDisplay("Monitoring OK");
    }

    digitalWrite(STATUS_LED_PIN, LOW);
  }

  delay(100);
}

/**
 * Updates 128x64 SSD1306 Local Display
 */
void updateOledDisplay(const char* statusMsg) {
  display.clearDisplay();

  // Header Banner
  display.fillRect(0, 0, 128, 11, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(2, 2);
  display.print(F("MOTOR CBM - IN865"));

  // Body Content
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 14);

  // Status & Sequence
  display.print(F("Status: "));
  display.println(statusMsg);

  display.print(F("Seq: #"));
  display.print(frameSequence);
  display.print(F(" | "));
  display.print(currentMetrics.temperatureC, 0);
  display.println(F("C"));

  // Vibration Metrics
  display.print(F("RMS : "));
  display.print(currentMetrics.overallRms, 3);
  display.println(F(" g"));

  display.print(F("Peak: "));
  display.print(currentMetrics.peak, 3);
  display.println(F(" g"));

  display.print(F("Peak2Peak: "));
  display.print(currentMetrics.peakToPeak, 3);
  display.println(F(" g"));

  // FFT Dominant Peak
  display.print(F("FFT : "));
  display.print(currentMetrics.dominantFreq, 1);
  display.print(F("Hz ("));
  display.print(currentMetrics.dominantAmp, 2);
  display.println(F("g)"));

  display.display();
}
