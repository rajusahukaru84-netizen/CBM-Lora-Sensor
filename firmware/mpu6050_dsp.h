/**
 * ==============================================================================
 * CBM SYSTEM - MPU6050 DSP & FREQUENCY-DOMAIN ANALYSIS MODULE
 * Handles:
 *  - I2C sensor initialization & WHO_AM_I check
 *  - Static zero-g offset calibration
 *  - 500 Hz timer-driven synchronous acceleration sampling
 *  - Time-Domain: RMS, Peak, Peak-to-Peak, Crest Factor
 *  - Frequency-Domain: Hann windowing, Radix-2 Real FFT, Dominant Peak Search
 * ==============================================================================
 */

#ifndef MPU6050_DSP_H
#define MPU6050_DSP_H

#include <Wire.h>
#include <math.h>
#include "cbm_config.h"

// Complex number structure for Radix-2 Cooley-Tukey FFT
struct Complex {
  float real;
  float imag;
};

// Extracted Vibration Metrics
struct VibrationMetrics {
  float overallRms;       // Acceleration RMS (g)
  float peak;             // Peak acceleration (g)
  float peakToPeak;       // Peak-to-Peak acceleration (g)
  float crestFactor;      // Crest Factor = Peak / RMS
  float temperatureC;     // Internal sensor temperature (°C)
  float dominantFreq;     // Dominant vibration peak frequency (Hz)
  float dominantAmp;      // Amplitude at dominant peak (g)
  uint8_t sensorStatus;   // 0x01 = OK, 0x00 = Hardware fault
};

class Mpu6050Dsp {
private:
  float axOffset, ayOffset, azOffset;
  float sampleBufferX[NUM_SAMPLES];
  float sampleBufferY[NUM_SAMPLES];
  float sampleBufferZ[NUM_SAMPLES];
  Complex fftBuffer[NUM_SAMPLES];

public:
  Mpu6050Dsp() : axOffset(0.0f), ayOffset(0.0f), azOffset(0.0f) {}

  /**
   * Initializes MPU6050 over I2C
   */
  bool begin() {
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, I2C_FREQ_HZ);
    
    // Check WHO_AM_I register (0x75)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x75);
    if (Wire.endTransmission(false) != 0) return false;

    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)1);
    if (!Wire.available()) return false;
    uint8_t whoAmI = Wire.read();
    if (whoAmI != 0x68) return false;

    // Wake up MPU6050 (clear SLEEP bit in PWR_MGMT_1 register 0x6B)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x6B);
    Wire.write(0x01); // Clock source: PLL with X axis gyroscope reference
    Wire.endTransmission();

    // Set Accelerometer Full Scale Range to ±2g (AFS_SEL=0 in ACCEL_CONFIG register 0x1C)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x1C);
    Wire.write(0x00);
    Wire.endTransmission();

    // Set Digital Low Pass Filter (DLPF_CFG = 1: 188 Hz bandwidth, register 0x1A)
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x1A);
    Wire.write(0x01);
    Wire.endTransmission();

    return true;
  }

  /**
   * Static Zero-g Calibration
   * Motor must be at standstill. Averages CALIBRATION_SAMPLES readings.
   */
  bool calibrate() {
    float sumX = 0.0f, sumY = 0.0f, sumZ = 0.0f;
    for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
      float ax, ay, az;
      if (!readRawAcceleration(ax, ay, az)) return false;
      sumX += ax;
      sumY += ay;
      sumZ += az;
      delay(5);
    }

    axOffset = sumX / CALIBRATION_SAMPLES;
    ayOffset = sumY / CALIBRATION_SAMPLES;
    // Assuming Z is vertical, compensate 1.0g gravity vector
    azOffset = (sumZ / CALIBRATION_SAMPLES) - 1.0f;
    return true;
  }

  /**
   * Acquire 512 discrete acceleration samples at 500 Hz (dt = 2000 microseconds)
   */
  bool sampleTimeDomain(VibrationMetrics& metrics) {
    const unsigned long samplePeriodUs = 1000000UL / SAMPLING_FREQ_HZ; // 2000 us

    for (int i = 0; i < NUM_SAMPLES; i++) {
      unsigned long startUs = micros();
      float ax, ay, az;
      if (!readRawAcceleration(ax, ay, az)) {
        metrics.sensorStatus = 0x00; // Fault
        return false;
      }

      // Remove zero-g calibration bias
      sampleBufferX[i] = ax - axOffset;
      sampleBufferY[i] = ay - ayOffset;
      sampleBufferZ[i] = az - azOffset;

      // Maintain exact 500 Hz sampling interval
      while (micros() - startUs < samplePeriodUs) {
        // Yield or busy wait for high-precision timing
      }
    }

    // Read sensor internal temperature
    metrics.temperatureC = readTemperature();
    metrics.sensorStatus = 0x01; // Healthy

    // Compute metrics
    computeTimeDomainMetrics(metrics);
    computeFftMetrics(metrics);

    return true;
  }

private:
  bool readRawAcceleration(float& ax, float& ay, float& az) {
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x3B); // ACCEL_XOUT_H
    if (Wire.endTransmission(false) != 0) return false;

    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)6);
    if (Wire.available() < 6) return false;

    int16_t rawX = (Wire.read() << 8) | Wire.read();
    int16_t rawY = (Wire.read() << 8) | Wire.read();
    int16_t rawZ = (Wire.read() << 8) | Wire.read();

    // Sensitivity for ±2g scale: 16384.0 LSB/g
    const float lsbPerG = 16384.0f;
    ax = (float)rawX / lsbPerG;
    ay = (float)rawY / lsbPerG;
    az = (float)rawZ / lsbPerG;
    return true;
  }

  float readTemperature() {
    Wire.beginTransmission(MPU6050_I2C_ADDR);
    Wire.write(0x41); // TEMP_OUT_H
    if (Wire.endTransmission(false) != 0) return 25.0f;

    Wire.requestFrom((uint8_t)MPU6050_I2C_ADDR, (uint8_t)2);
    if (Wire.available() < 2) return 25.0f;

    int16_t rawTemp = (Wire.read() << 8) | Wire.read();
    // Formula from MPU6050 Register Map: Temperature in °C = (TEMP_OUT / 340) + 36.53
    return ((float)rawTemp / 340.0f) + 36.53f;
  }

  void computeTimeDomainMetrics(VibrationMetrics& metrics) {
    float sumSq = 0.0f;
    float maxVal = -999.0f;
    float minVal = 999.0f;

    for (int i = 0; i < NUM_SAMPLES; i++) {
      // Tri-axial magnitude: a_mag = sqrt(ax^2 + ay^2 + az^2)
      float mag = sqrtf(sampleBufferX[i] * sampleBufferX[i] +
                        sampleBufferY[i] * sampleBufferY[i] +
                        sampleBufferZ[i] * sampleBufferZ[i]);

      sumSq += mag * mag;
      if (mag > maxVal) maxVal = mag;
      if (mag < minVal) minVal = mag;
    }

    metrics.overallRms = sqrtf(sumSq / NUM_SAMPLES);
    metrics.peak = maxVal;
    metrics.peakToPeak = maxVal - minVal;
    metrics.crestFactor = (metrics.overallRms > 0.001f) ? (metrics.peak / metrics.overallRms) : 1.0f;
  }

  /**
   * Radix-2 Decimation-in-Time FFT
   * Window: Hann windowing applied prior to FFT to reduce spectral leakage
   */
  void computeFftMetrics(VibrationMetrics& metrics) {
    // 1. Apply Hann Window to tri-axial composite signal
    for (int i = 0; i < NUM_SAMPLES; i++) {
      float mag = sqrtf(sampleBufferX[i] * sampleBufferX[i] +
                        sampleBufferY[i] * sampleBufferY[i] +
                        sampleBufferZ[i] * sampleBufferZ[i]);
      // Hann Window: w(n) = 0.5 * (1 - cos(2*pi*n / (N - 1)))
      float hann = 0.5f * (1.0f - cosf((2.0f * M_PI * i) / (NUM_SAMPLES - 1)));
      fftBuffer[i].real = (mag - metrics.overallRms) * hann; // AC-couple before FFT
      fftBuffer[i].imag = 0.0f;
    }

    // 2. Bit-Reversal Permutation
    int j = 0;
    for (int i = 0; i < NUM_SAMPLES - 1; i++) {
      if (i < j) {
        Complex temp = fftBuffer[i];
        fftBuffer[i] = fftBuffer[j];
        fftBuffer[j] = temp;
      }
      int k = NUM_SAMPLES / 2;
      while (k <= j) {
        j -= k;
        k /= 2;
      }
      j += k;
    }

    // 3. Cooley-Tukey Butterflies
    for (int len = 2; len <= NUM_SAMPLES; len <<= 1) {
      float angle = -2.0f * M_PI / len;
      Complex wlen = { cosf(angle), sinf(angle) };
      for (int i = 0; i < NUM_SAMPLES; i += len) {
        Complex w = { 1.0f, 0.0f };
        for (int k = 0; k < len / 2; k++) {
          Complex u = fftBuffer[i + k];
          Complex v = {
            w.real * fftBuffer[i + k + len / 2].real - w.imag * fftBuffer[i + k + len / 2].imag,
            w.real * fftBuffer[i + k + len / 2].imag + w.imag * fftBuffer[i + k + len / 2].real
          };
          fftBuffer[i + k].real = u.real + v.real;
          fftBuffer[i + k].imag = u.imag + v.imag;
          fftBuffer[i + k + len / 2].real = u.real - v.real;
          fftBuffer[i + k + len / 2].imag = u.imag - v.imag;

          Complex nextW = {
            w.real * wlen.real - w.imag * wlen.imag,
            w.real * wlen.imag + w.imag * wlen.real
          };
          w = nextW;
        }
      }
    }

    // 4. Find Dominant Spectral Peak (search between 5 Hz and Nyquist 250 Hz)
    float deltaF = (float)SAMPLING_FREQ_HZ / NUM_SAMPLES; // 500 / 512 = 0.9765 Hz
    float maxAmp = 0.0f;
    float peakFreq = 0.0f;

    // Scan bins corresponding to 5 Hz to 240 Hz
    int minBin = (int)(5.0f / deltaF);
    int maxBin = (int)(240.0f / deltaF);

    for (int i = minBin; i <= maxBin; i++) {
      // Magnitude scaled for single-sided spectrum: |X[k]| * 2 / N
      float amp = sqrtf(fftBuffer[i].real * fftBuffer[i].real +
                        fftBuffer[i].imag * fftBuffer[i].imag) * (2.0f / NUM_SAMPLES);

      if (amp > maxAmp) {
        maxAmp = amp;
        peakFreq = i * deltaF;
      }
    }

    metrics.dominantFreq = peakFreq;
    metrics.dominantAmp = maxAmp;
  }
};

#endif // MPU6050_DSP_H
