import mongoose, { Schema, Document } from 'mongoose';

export interface IScoringRule extends Document {
  name: string;
  description: string;
  key: string;
  points: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScoringRuleSchema = new Schema<IScoringRule>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    points: { type: Number, required: true },
    priority: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ScoringRule = mongoose.models.ScoringRule || mongoose.model<IScoringRule>('ScoringRule', ScoringRuleSchema);
