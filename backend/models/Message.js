import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      index: true
    },
    rowIndex: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      default: 'N/A'
    },
    email: {
      type: String,
      required: true
    },
    messageId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    status: {
      type: String,
      enum: ['Failed', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Bounced', 'Blocked'],
      default: 'Sent'
    },
    failReason: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: null
    },
    firstOpenedAt: {
      type: Date,
      default: null
    },
    lastOpenedAt: {
      type: Date,
      default: null
    },
    openCount: {
      type: Number,
      default: 0
    },
    proxyOpenCount: {
      type: Number,
      default: 0
    },
    clickCount: {
      type: Number,
      default: 0
    },
    lastClickedLink: {
      type: String,
      default: null
    },
    lastEvent: {
      type: String,
      default: null
    },
    lastEventAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index on jobId and rowIndex
MessageSchema.index({ jobId: 1, rowIndex: 1 });

export default mongoose.model('Message', MessageSchema);
