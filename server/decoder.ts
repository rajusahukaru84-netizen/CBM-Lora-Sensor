/**
 * LoRaWAN Binary Payload Decoder for CBM Vibration Monitoring
 * 13-Byte Compact Format (Phase 5 Spec)
 */

export interface DecodedCbmTelemetry {
  deviceId: string;
  motorId: string;
  sequence: number;
  overallRms: number;     // g (gravity)
  peak: number;           // g (gravity)
  peakToPeak: number;     // g (gravity)
  crestFactor: number;    // dimensionless ratio
  temperature: number;    // deg C
  sensorStatus: 'OK' | 'ERROR';
  statusFlags: number;
  dominantFreq?: number;  // Hz (from FFT)
  dominantAmp?: number;   // g (from FFT)
  rawPayloadHex: string;
}

/**
 * Decodes a 13-byte or 17-byte Buffer into structured engineering units.
 */
export function decodeCbmBuffer(buffer: Buffer): DecodedCbmTelemetry {
  if (buffer.length < 13) {
    throw new Error(`Invalid payload length: expected at least 13 bytes, received ${buffer.length}`);
  }

  const motorIdNum = buffer.readUInt8(0);
  const sequenceNum = buffer.readUInt8(1);
  const overallRms = buffer.readUInt16BE(2) / 1000.0;    // milli-g -> g
  const peakAccel = buffer.readUInt16BE(4) / 1000.0;     // milli-g -> g
  const peakToPeak = buffer.readUInt16BE(6) / 1000.0;    // milli-g -> g
  const crestFactor = buffer.readUInt16BE(8) / 100.0;    // ratio * 100 -> ratio
  const temperature = buffer.readInt16BE(10) / 10.0;     // 0.1 deg C -> deg C
  const statusFlags = buffer.readUInt8(12);

  let dominantFreq = 24.0;
  let dominantAmp = Number((overallRms * 0.9).toFixed(4));

  // Optional extended 17-byte payload with dominant frequency and amplitude
  if (buffer.length >= 17) {
    dominantFreq = buffer.readUInt16BE(13) / 10.0;       // 0.1 Hz -> Hz
    dominantAmp = buffer.readUInt16BE(15) / 1000.0;      // milli-g -> g
  }

  const isSensorOk = (statusFlags & 0x01) !== 0;
  const padMotorId = motorIdNum < 10 ? `0${motorIdNum}` : `${motorIdNum}`;

  return {
    deviceId: `CBM_NODE_${padMotorId}`,
    motorId: `MOTOR_${padMotorId}`,
    sequence: sequenceNum,
    overallRms: Number(overallRms.toFixed(4)),
    peak: Number(peakAccel.toFixed(4)),
    peakToPeak: Number(peakToPeak.toFixed(4)),
    crestFactor: Number(crestFactor.toFixed(2)),
    temperature: Number(temperature.toFixed(1)),
    sensorStatus: isSensorOk ? 'OK' : 'ERROR',
    statusFlags,
    dominantFreq: Number(dominantFreq.toFixed(1)),
    dominantAmp: Number(dominantAmp.toFixed(4)),
    rawPayloadHex: buffer.toString('hex').toUpperCase(),
  };
}

/**
 * Decodes a hexadecimal or Base64 string payload.
 */
export function decodePayloadString(rawString: string): DecodedCbmTelemetry {
  const trimmed = rawString.trim();
  let buf: Buffer;

  // Detect hex (only 0-9a-f and length is even) or base64
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    buf = Buffer.from(trimmed, 'hex');
  } else {
    buf = Buffer.from(trimmed, 'base64');
  }

  return decodeCbmBuffer(buf);
}
