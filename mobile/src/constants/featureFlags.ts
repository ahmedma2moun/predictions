// Mirrors src/lib/feature-flags.ts on the web side. The mobile app talks to
// the same API, which already stops returning odds data while that flag is
// off — this local copy only gates UI that isn't driven by API data, like
// the odds onboarding modal.
export const ODDS_FEATURE_ENABLED = false;
