import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true
    },
    html: {
      type: String,
      default: ''
    },
    design: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Template', TemplateSchema);
