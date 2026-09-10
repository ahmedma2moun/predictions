import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), standings: vi.fn(), detail: vi.fn(), form: vi.fn(), fixture: vi.fn(), groups: vi.fn(), predictions: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/auth', () => ({ getSessionUser: () => ({ id: 1, role: 'admin' }) }));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: { findMany: mocks.findMany } }));
vi.mock('@/lib/standings', () => ({ getStandingsMap: mocks.standings, standingKey: (team: number, league: number) => `${team}:${league}` }));
vi.mock('@/lib/services/match-service', () => ({ getMatchById: mocks.detail }));
vi.mock('@/lib/team-form', () => ({ getTeamForm: mocks.form }));
vi.mock('@/lib/football/service', () => ({ fetchFixtureById: mocks.fixture, mapFixtureStatus: () => 'live' }));
vi.mock('@/lib/services/group-service', () => ({ getUserGroups: mocks.groups }));
vi.mock('@/lib/services/prediction-service', () => ({ getGroupPredictionsForMatch: mocks.predictions }));
import { GET as list } from '@/app/api/mobile/admin/upcoming/route';
import { GET as detail } from '@/app/api/mobile/admin/upcoming/[matchId]/route';

const match = {
  id: 247, externalId: 99, externalLeagueId: 39, homeTeamExtId: 1, awayTeamExtId: 2,
  homeTeamName: 'Home', awayTeamName: 'Away', kickoffTime: new Date('2026-09-12T18:00:00Z'),
  status: 'scheduled', league: { name: 'Premier League' }, season: null,
};
const request = (id = '247', query = '') => detail(new NextRequest(`https://example.com/api/mobile/admin/upcoming/${id}${query}`), { params: Promise.resolve({ matchId: id }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
  mocks.findMany.mockResolvedValue([match]);
  mocks.standings.mockResolvedValue(new Map([['1:39', { position: 2, points: 10 }]]));
  mocks.detail.mockResolvedValue({ match, homeStanding: null, awayStanding: null, allPredictions: [], odds: null });
  mocks.groups.mockResolvedValue([]);
});
it('requires admin authentication before reading either endpoint', async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await list()).status).toBe(401);
  expect((await request()).status).toBe(401);
  expect(mocks.findMany).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});
it('uses the standalone web filter, chronological ordering and no historical limit', async () => {
  const response = await list();
  expect(mocks.findMany.mock.calls[0][0]).toMatchObject({
    where: { predictionsEnabled: true, status: { in: ['scheduled', 'live'] } }, orderBy: { kickoffTime: 'asc' },
  });
  expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty('take');
  expect(await response.json()).toMatchObject([{ _id: '247', homeTeam: { name: 'Home' }, leagueName: 'Premier League', homeStanding: { position: 2 } }]);
});
it('returns the selected match with admin detail access', async () => {
  expect(await (await request()).json()).toMatchObject({ _id: '247', predictions: [], groups: [] });
  expect(mocks.detail).toHaveBeenCalledWith(247, { userId: 1, isAdmin: true });
});
it('rejects malformed IDs and returns missing-match errors', async () => {
  expect((await request('invalid')).status).toBe(400);
  expect(mocks.detail).not.toHaveBeenCalled();
  mocks.detail.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
});
it('does not fetch football data for custom matches', async () => {
  mocks.detail.mockResolvedValue({ match: { ...match, externalId: null } });
  expect(await (await request('247', '?section=form')).json()).toEqual({ home: null, away: null });
  expect(mocks.form).not.toHaveBeenCalled();
});
it('reports live-provider failure independently of match details', async () => {
  mocks.fixture.mockRejectedValue(new Error('offline'));
  expect((await request('247', '?section=live')).status).toBe(502);
  expect((await request()).status).toBe(200);
});
it('validates group selection and uses the shared group prediction rules', async () => {
  expect((await request('247', '?section=predictions&groupId=bad')).status).toBe(400);
  mocks.predictions.mockResolvedValue({ entries: [] });
  expect(await (await request('247', '?section=predictions&groupId=3')).json()).toEqual([]);
  expect(mocks.predictions).toHaveBeenCalledWith(247, 3, 1, true, null);
});
