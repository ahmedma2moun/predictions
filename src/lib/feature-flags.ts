// Global feature switches. No server-only imports here (safe for both server
// code and "use client" components) so the same flag can gate API/service
// logic and admin UI in one place.

// Master switch for the prediction-odds multiplier feature. Every call site
// that derives an OddsConfig ANDs this flag against the per-season
// `Season.oddsEnabled` value, so flipping this back to `true` fully restores
// prior behavior — no other code changes needed. Season-level config,
// `src/lib/odds.ts`, and all persisted `MatchOdds`/`Prediction.outcomeOdds`
// data are left untouched while this is off.
export const ODDS_FEATURE_ENABLED = false;
