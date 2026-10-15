/**
 * ==============================================================================
 * CBM SYSTEM - INDUSTRIAL MOTOR VIBRATION MONITORING FIRMWARE
 * Target: ESP32-WROOM-32 + SX1262 LoRa + MPU6050 (I2C) + SSD1306 OLED (I2C)
 * Frequency Plan: IN865 (India 865-867 MHz)
 * Payload Format: 17-byte Compact Binary (Time-Domain + Spectral Dominant Peak)
 * ==============================================================================
 */

#ifndef CBM_CONFIG_H
#define CBM_CONFIG_H

#include <Arduino.h>

// ==========================================
// 1. PIN DEFINITIONS & PERIPHERALS
// ==========================================

// I2C Bus for MPU6050 and SSD1306 OLED
#define I2C_SDA_PIN          21
#define I2C_SCL_PIN          22
#define I2C_FREQ_HZ          400000   // Fast mode 400 kHz

// MPU6050 Configuration
#define MPU6050_I2C_ADDR     0x68
#define MPU6050_ACCEL_FS_G   2        // ±2g sensitivity (16384 LSB/g)

// SX1262 SPI Pinout
#define LORA_NSS_PIN         5
#define LORA_RST_PIN         14
#define LORA_DIO1_PIN        26
#define LORA_BUSY_PIN        27
#define LORA_SCK_PIN         18
#define LORA_MISO_PIN        19
#define LORA_MOSI_PIN        23

// SSD1306 0.96" OLED Display
#define OLED_I2C_ADDR        0x3C
#define OLED_WIDTH           128
#define OLED_HEIGHT          64

// On-board Diagnostic LED
#define STATUS_LED_PIN       2

// ==========================================
// 2. SAMPLING & DSP PARAMETERS
// ==========================================
#define SAMPLING_FREQ_HZ     500      // 500 Hz (Nyquist: 250 Hz)
#define NUM_SAMPLES          512      // 512 points -> Window: 1.024s, Res: 0.976 Hz
#define CALIBRATION_SAMPLES  200      // Static offset baseline samples

// ==========================================
// 3. LORAWAN IN865 CONFIGURATION
// ==========================================
// IN865 Default Channels: 865.0625 MHz, 865.4025 MHz, 865.985 MHz (BW 125 kHz)
#define LORAWAN_TX_INTERVAL_SEC  60    // 60-second periodic reporting
#define LORAWAN_RETRY_MAX        3     // Maximum join / uplink retransmissions

// OTAA Provisioning Keys (Insert registered keys from ChirpStack / The Things Stack)
// Format: MSB (Most Significant Byte First)
static const uint8_t PROGMEM DEVEUI[8]  = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01 };
static const uint8_t PROGMEM JOINEUI[8] = { 0x70, 0xB3, 0xD5, 0x7E, 0xD0, 0x00, 0x00, 0x00 };
static const uint8_t PROGMEM APPKEY[16] = { 0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6, 
                                            0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C };

// ==========================================
// 4. DEVICE STATES
// ==========================================
enum DeviceState {
  STATE_BOOT = 0,
  STATE_SENSOR_INIT,
  STATE_CALIBRATING,
  STATE_LORAWAN_JOINING,
  STATE_MONITORING,
  STATE_TRANSMITTING,
  STATE_FAULT
};

#endif // CBM_CONFIG_H
