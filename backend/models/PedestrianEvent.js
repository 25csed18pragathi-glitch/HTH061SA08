import mongoose from 'mongoose';

const pedestrianEventSchema = new mongoose.Schema({
  timestamp:       { type: Date, default: Date.now },
  pedestrianCount: { type: Number, default: 0 },
  pendingRequests: { type: Number, default: 0 },
  phase:           { type: String, default: 'DONT_WALK' },
  demand:          { type: String, default: 'NONE' },
  pedestrianRequest: { type: Boolean, default: false },
  countdown:       { type: Number, default: null },
});

pedestrianEventSchema.index({ timestamp: -1 });

export default mongoose.model('PedestrianEvent', pedestrianEventSchema);
