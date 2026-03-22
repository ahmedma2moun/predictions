import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMatch extends Document {
  externalId: number;
  leagueId: Types.ObjectId;
  externalLeagueId: number;
  homeTeam: { externalId: number; name: string; logo?: string };
  awayTeam: { externalId: number; name: string; logo?: string };
  kickoffTime: Date;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  result?: { homeScore: number; awayScore: number; winner: 'home' | 'away' | 'draw' };
  scoresProcessed: boolean;
  weekStart: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    externalId: { type: Number, required: true, unique: true },
    leagueId: { type: Schema.Types.ObjectId, ref: 'League', required: true },
    externalLeagueId: { type: Number, required: true },
    homeTeam: {
      externalId: { type: Number, required: true },
      name: { type: String, required: true },
      logo: { type: String },
    },
    awayTeam: {
      externalId: { type: Number, required: true },
      name: { type: String, required: true },
      logo: { type: String },
    },
    kickoffTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'finished', 'postponed', 'cancelled'],
      default: 'scheduled',
    },
    result: {
      homeScore: { type: Number },
      awayScore: { type: Number },
      winner: { type: String, enum: ['home', 'away', 'draw'] },
    },
    scoresProcessed: { type: Boolean, default: false },
    weekStart: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Match = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);
