export const ROUTES = {
  login:       '/login',
  matches:     '/(tabs)/matches',
  predictions: '/(tabs)/predictions',
  leaderboard: '/(tabs)/leaderboard',
  seasons:     '/(tabs)/seasons',
  matchDetail: (id: string) => `/matches/${id}`,
} as const;
