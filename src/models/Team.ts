import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeam extends Document {
  externalId: number;
  name: string;
  logo?: string;
  leagueId: Types.ObjectId;
  externalLeagueId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    externalId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    logo: { type: String },
    leagueId: { type: Schema.Types.ObjectId, ref: 'League', required: true },
    externalLeagueId: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Team = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);
