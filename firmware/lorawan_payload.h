/**
 * ==============================================================================
 * CBM SYSTEM - COMPACT BINARY LORAWAN PAYLOAD ENCODER
 * Supports both:
 *  - Legacy 13-Byte Compact Binary Payload (Time-Domain Only)
 *  - Extended 17-Byte Compact Binary Payload (Time-Domain + Dominant Frequency & Amplitude)
 *
 * 17-Byte Structure:
 *  Byte 0:     Motor ID (uint8, e.g. 0x01)
 *  Byte 1:     Sequence Counter (uint8, 0-255 rolling)
 *  Bytes 2-3:  Overall RMS * 1000 (uint16_be, 0-65.535g)
 *  Bytes 4-5:  Peak * 1000 (uint16_be, 0-65.535g)
 *  Bytes 6-7:  Peak-to-Peak * 1000 (uint16_be, 0-65.535g)
 *  Bytes 8-9:  Crest Factor * 100 (uint16_be, 0-655.35)
 *  Bytes 10-11:Temperature * 10 (int16_be, -3276.8 to +3276.7 °C)
 *  Byte 12:    Sensor Status (uint8, 0x01 = OK, 0x00 = FAULT)
 *  Bytes 13-14:Dominant Frequency * 10 (uint16_be, e.g. 240 = 24.0 Hz)
 *  Bytes 15-16:Dominant Amplitude * 1000 (uint16_be, e.g. 180 = 0.180g)
 * ==============================================================================
 */

#ifndef LORAWAN_PAYLOAD_H
#define LORAWAN_PAYLOAD_H

#include <Arduino.h>
#include "mpu6050_dsp.h"

class LorawanPayloadEncoder {
public:
  /**
   * Encodes the 17-byte extended payload
   */
  static size_t encode17Byte(uint8_t motorId,
                             uint8_t sequence,
                             const VibrationMetrics& metrics,
                             uint8_t* buffer,
                             size_t bufferSize) {
    if (bufferSize < 17) return 0;

    buffer[0] = motorId;
    buffer[1] = sequence;

    // RMS * 1000
    uint16_t rmsRaw = (uint16_t)roundf(metrics.overallRms * 1000.0f);
    buffer[2] = (rmsRaw >> 8) & 0xFF;
    buffer[3] = rmsRaw & 0xFF;

    // Peak * 1000
    uint16_t peakRaw = (uint16_t)roundf(metrics.peak * 1000.0f);
    buffer[4] = (peakRaw >> 8) & 0xFF;
    buffer[5] = peakRaw & 0xFF;

    // Peak-to-Peak * 1000
    uint16_t p2pRaw = (uint16_t)roundf(metrics.peakToPeak * 1000.0f);
    buffer[6] = (p2pRaw >> 8) & 0xFF;
    buffer[7] = p2pRaw & 0xFF;

    // Crest Factor * 100
    uint16_t cfRaw = (uint16_t)roundf(metrics.crestFactor * 100.0f);
    buffer[8] = (cfRaw >> 8) & 0xFF;
    buffer[9] = cfRaw & 0xFF;

    // Temperature * 10 (Signed 16-bit)
    int16_t tempRaw = (int16_t)roundf(metrics.temperatureC * 10.0f);
    buffer[10] = (tempRaw >> 8) & 0xFF;
    buffer[11] = tempRaw & 0xFF;

    // Sensor Status
    buffer[12] = metrics.sensorStatus;

    // Dominant Frequency * 10 (0.1 Hz resolution)
    uint16_t freqRaw = (uint16_t)roundf(metrics.dominantFreq * 10.0f);
    buffer[13] = (freqRaw >> 8) & 0xFF;
    buffer[14] = freqRaw & 0xFF;

    // Dominant Amplitude * 1000 (0.001g resolution)
    uint16_t ampRaw = (uint16_t)roundf(metrics.dominantAmp * 1000.0f);
    buffer[15] = (ampRaw >> 8) & 0xFF;
    buffer[16] = ampRaw & 0xFF;

    return 17;
  }
};

#endif // LORAWAN_PAYLOAD_H
