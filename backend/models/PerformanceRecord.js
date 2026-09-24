import mongoose from 'mongoose';

const performanceRecordSchema = new mongoose.Schema({
  timestamp:          { type: Date, default: Date.now },
  totalVehicles:      { type: Number, default: 0 },
  averageWaitingTime: { type: Number, default: 0 },
  averageQueueLength: { type: Number, default: 0 },
  simulationTime:     { type: Number, default: 0 },
  throughput:         { type: Number, default: 0 },
});

performanceRecordSchema.index({ timestamp: -1 });

export default mongoose.model('PerformanceRecord', performanceRecordSchema);
