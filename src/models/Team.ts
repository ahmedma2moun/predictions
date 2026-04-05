export interface ITeam {
  id: number;
  externalId: number;
  name: string;
  logo?: string | null;
  leagueId: number;
  externalLeagueId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
