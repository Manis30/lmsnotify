import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    fileName: {
      type: String,
      default: ''
    },
    subject: {
      type: String,
      default: ''
    },
    total: {
      type: Number,
      default: 0
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null
    },
    templateName: {
      type: String,
      default: ''
    },
    subjectSnapshot: {
      type: String,
      default: ''
    },
    htmlSnapshot: {
      type: String,
      default: ''
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Campaign', CampaignSchema);
