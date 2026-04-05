export interface ILeague {
  id: number;
  externalId: number;
  name: string;
  country: string;
  logo?: string | null;
  season: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
