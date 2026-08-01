import type { Href } from 'expo-router';

export const ROUTES = {
  login:       '/login' satisfies Href,
  matches:     '/(tabs)/matches' satisfies Href,
  predictions: '/(tabs)/predictions' satisfies Href,
  leaderboard: '/(tabs)/leaderboard' satisfies Href,
  champion:    '/(tabs)/champion' satisfies Href,
  seasons:     '/(tabs)/seasons' satisfies Href,
  matchDetail: (id: string): Href => `/matches/${id}`,
} as const;
