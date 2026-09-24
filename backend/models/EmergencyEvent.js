import mongoose from 'mongoose';

const emergencyEventSchema = new mongoose.Schema({
  timestamp:    { type: Date, default: Date.now },
  road:         { type: String, required: true, enum: ['north', 'south', 'east', 'west'] },
  type:         { type: String, required: true },
  status:       { type: String, default: 'REPORTED' },
  responseTime: { type: Number, default: null },
});

emergencyEventSchema.index({ timestamp: -1 });

export default mongoose.model('EmergencyEvent', emergencyEventSchema);
