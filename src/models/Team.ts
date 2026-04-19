export interface ITeam {
  id: number;
  externalId: number;
  name: string;
  logo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamLeague {
  id: number;
  teamId: number;
  leagueId: number;
  externalLeagueId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamWithLeague extends ITeam {
  leagueId: number;
  externalLeagueId: number;
  isActive: boolean;
}
