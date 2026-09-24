import mongoose from 'mongoose';

const sensorHealthEventSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  road: { type: String, required: true, enum: ['north', 'south', 'east', 'west'] },
  status: { type: String, required: true, enum: ['HEALTHY', 'WARNING', 'OFFLINE', 'RECOVERED'] },
  lastValidDataTime: { type: Date, default: Date.now },
  timeoutDuration: { type: Number, default: 0 },
  fallbackMode: { type: String, default: 'FIXED' },
  recoveryTime: { type: Date, default: null },
  reason: { type: String, default: '' },
});

sensorHealthEventSchema.index({ timestamp: -1 });
sensorHealthEventSchema.index({ road: 1, timestamp: -1 });

export default mongoose.model('SensorHealthEvent', sensorHealthEventSchema);
