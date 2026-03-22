import mongoose, { Schema, Document } from 'mongoose';

export interface ILeague extends Document {
  externalId: number;
  name: string;
  country: string;
  logo?: string;
  season: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeagueSchema = new Schema<ILeague>(
  {
    externalId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    logo: { type: String },
    season: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

LeagueSchema.index({ name: 'text', country: 'text' });

export const League = mongoose.models.League || mongoose.model<ILeague>('League', LeagueSchema);
