#!/usr/bin/env bash
# Regenerates FootballPredictions.xcodeproj (not committed) from project.yml.
set -euo pipefail
cd "$(dirname "$0")"
export MARKETING_VERSION="$(tr -d '[:space:]' < ../VERSION)"
export DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-${APPLE_TEAM_ID:-}}"
export PROFILE_NAME="${PROFILE_NAME:-}"
export PROFILE_NAME_WIDGET="${PROFILE_NAME_WIDGET:-}"
xcodegen generate --spec project.yml
