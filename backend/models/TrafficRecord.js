import mongoose from 'mongoose';

const trafficRecordSchema = new mongoose.Schema({
  timestamp:      { type: Date, default: Date.now },
  road:           { type: String, required: true, enum: ['north', 'south', 'east', 'west'] },
  cycle:          { type: Number, default: 0 },
  bike:           { type: Number, default: 0 },
  auto:           { type: Number, default: 0 },
  car:            { type: Number, default: 0 },
  heavy:          { type: Number, default: 0 },
  totalVehicles:  { type: Number, default: 0 },
  density:        { type: Number, default: 0 },
  queueLength:    { type: Number, default: 0 },
  waitingTime:    { type: Number, default: 0 },
  trafficStatus:  { type: String, default: 'LOW' },
  source:         { type: String, enum: ['simulation', 'manual', 'video'], default: 'simulation' },
});

trafficRecordSchema.index({ timestamp: -1 });
trafficRecordSchema.index({ road: 1, timestamp: -1 });

export default mongoose.model('TrafficRecord', trafficRecordSchema);
