import mongoose from 'mongoose';

const signalEventSchema = new mongoose.Schema({
  timestamp:       { type: Date, default: Date.now },
  phase:           { type: String, required: true },
  state:           { type: String, required: true },
  remaining:       { type: Number, default: 0 },
  requestedGreen:  { type: Number, default: 0 },
  approvedGreen:   { type: Number, default: 0 },
  currentPriority: { type: Number, default: 0 },
  reason:          { type: String, default: '' },
});

signalEventSchema.index({ timestamp: -1 });

export default mongoose.model('SignalEvent', signalEventSchema);
