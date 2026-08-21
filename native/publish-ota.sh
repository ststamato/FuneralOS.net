#!/usr/bin/env bash
# FuneralOS — pushes a fresh www/ build to Capgo as an OTA update, so an
# already-installed native app picks up JS/HTML/CSS changes instantly, with
# no app-store review cycle. See CLAUDE.md's mobile-plan Phase 8 for the
# rules on what an OTA push may and may not contain (web-layer files only —
# never new native permissions/plugins/icon/IAP changes, which always need a
# new binary + Phase 9-13 again).
#
# Requires a Capgo account + CLI login (`npx @capgo/cli login`) — not yet
# set up. This script documents the exact commands to run once it is; it
# will fail cleanly today with "command not found"/auth errors rather than
# doing anything partial.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANNEL="${1:-production}"   # production | beta

echo "Rebuilding www/ from saas/ ..."
"$REPO_ROOT/native/build-www.sh"

for edition in gr en; do
  app_id=$([ "$edition" = "gr" ] && echo "net.funeralos.gr" || echo "net.funeralos.en")
  dir="$REPO_ROOT/native/${edition}-app"
  echo "Publishing $edition ($app_id) to Capgo channel '$CHANNEL' ..."
  (cd "$dir" && npx @capgo/cli bundle upload --channel "$CHANNEL" -a "$app_id")
done

echo "Done. Installed apps on '$CHANNEL' will pick this up on next resume/launch."
