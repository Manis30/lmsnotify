import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      index: true
    },
    jobId: {
      type: String,
      index: true,
      default: null
    },
    type: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    link: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      default: null
    },
    raw: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound UNIQUE index on messageId, type, and date to prevent duplicate events
EventSchema.index({ messageId: 1, type: 1, date: 1 }, { unique: true });

export default mongoose.model('Event', EventSchema);
