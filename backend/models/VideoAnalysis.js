import mongoose from 'mongoose';

const videoAnalysisSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  road: { type: String, required: true, enum: ['north', 'south', 'east', 'west'] },
  source: { type: String, default: 'video' },
  detectionModel: { type: String, default: null },
  modelFile: { type: String, default: null },
  counts: {
    cycle: { type: Number, default: 0 },
    bike: { type: Number, default: 0 },
    auto: { type: Number, default: 0 },
    car: { type: Number, default: 0 },
    heavy: { type: Number, default: 0 },
  },
  totalVehicles: { type: Number, default: 0 },
  density: { type: Number, default: 0 },
  trafficStatus: { type: String, default: null },
  queueLength: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  framesProcessed: { type: Number, default: 0 },
  processingTime: { type: Number, default: 0 },
  appliedToTraffic: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('VideoAnalysis', videoAnalysisSchema);
