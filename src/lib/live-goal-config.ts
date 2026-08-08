// Tunables for the live-goal QStash polling chain. Plain constants (same
// pattern as feature-flags.ts) — edit and redeploy to tune, no admin UI.

// Base cadence while a match is live.
export const LIVE_POLL_INTERVAL_SECONDS = 180;

// Half-time: no goals can happen, so back off further than the base cadence.
export const HALF_TIME_POLL_SECONDS = 480;

// Kickoff hasn't shown up as 'live' yet (delayed start) — slow poll until it does.
export const PRE_KICKOFF_POLL_SECONDS = 300;

// Hard stop for the self-chaining loop if a match never reports 'finished'
// (stuck extra-time/penalties status, provider bug). Prevents an orphaned
// infinite chain from ticking forever.
export const MAX_CHAIN_HOURS = 3.5;
