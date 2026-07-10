export const ROUTES = {
  login:       '/login',
  matches:     '/(tabs)/matches',
  predictions: '/(tabs)/predictions',
  leaderboard: '/(tabs)/leaderboard',
  live:        '/(tabs)/live',
  champion:    '/(tabs)/champion',
  seasons:     '/(tabs)/seasons',
  matchDetail: (id: string) => `/matches/${id}`,
} as const;
