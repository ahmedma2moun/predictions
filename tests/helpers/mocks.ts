import { vi } from 'vitest';

// Notification seams — captured, never actually sent (no real Gmail/FCM in tests).
vi.mock('@/lib/email', () => ({
  sendResultsEmail: vi.fn().mockResolvedValue(undefined),
  sendResultCorrectionEmail: vi.fn().mockResolvedValue(undefined),
  sendNewMatchesEmail: vi.fn().mockResolvedValue(undefined),
  sendPredictionReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendDailyReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendSeasonEndEmail: vi.fn().mockResolvedValue(undefined),
  sendFetchMatchesCronEmail: vi.fn().mockResolvedValue(undefined),
  sendCronRunEmail: vi.fn().mockResolvedValue(undefined),
  sendChampionBonusEnabledEmail: vi.fn().mockResolvedValue(undefined),
  sendChampionBonusLockedEmail: vi.fn().mockResolvedValue(undefined),
  sendChampionBonusWinEmail: vi.fn().mockResolvedValue(undefined),
  sendChampionBonusCancelledEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/fcm', () => ({
  sendPushToUsers: vi.fn().mockResolvedValue([]),
}));
