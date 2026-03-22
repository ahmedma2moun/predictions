import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScoringBreakdownRule {
  ruleId: Types.ObjectId;
  ruleName: string;
  pointsAwarded: number;
  matched: boolean;
}

export interface IPrediction extends Document {
  userId: Types.ObjectId;
  matchId: Types.ObjectId;
  homeScore: number;
  awayScore: number;
  predictedWinner: 'home' | 'away' | 'draw';
  pointsAwarded: number;
  scoringBreakdown: { rules: IScoringBreakdownRule[] };
  createdAt: Date;
  updatedAt: Date;
}

const ScoringBreakdownRuleSchema = new Schema<IScoringBreakdownRule>({
  ruleId: { type: Schema.Types.ObjectId },
  ruleName: { type: String },
  pointsAwarded: { type: Number },
  matched: { type: Boolean },
}, { _id: false });

const PredictionSchema = new Schema<IPrediction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    homeScore: { type: Number, required: true, min: 0 },
    awayScore: { type: Number, required: true, min: 0 },
    predictedWinner: { type: String, enum: ['home', 'away', 'draw'], required: true },
    pointsAwarded: { type: Number, default: 0 },
    scoringBreakdown: {
      rules: [ScoringBreakdownRuleSchema],
    },
  },
  { timestamps: true }
);

PredictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

export const Prediction = mongoose.models.Prediction || mongoose.model<IPrediction>('Prediction', PredictionSchema);
