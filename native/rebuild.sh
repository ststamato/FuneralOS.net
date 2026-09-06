#!/usr/bin/env bash
# FuneralOS — one command to get every saas/ change into BOTH native apps.
#
# Exists because doing this by hand is three commands per app in two
# directories, and running them in the wrong directory (or for only one of the
# two editions) fails silently: the build succeeds, it just contains the old
# code, which is indistinguishable from "the fix didn't work". This runs the
# whole thing for both editions and then verifies the result on disk, so the
# output says plainly whether the device is about to run the current code.
#
# Usage:  ./native/rebuild.sh        (from anywhere in the repo)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NATIVE="$REPO_ROOT/native"

echo ""
echo "=================================================="
echo " 1/3  Building www/ bundles from saas/"
echo "=================================================="
"$NATIVE/build-www.sh"

echo ""
echo "=================================================="
echo " 2/3  Syncing into the iOS + Android projects"
echo "=================================================="
for app in gr-app en-app; do
  echo ""
  echo "--- $app ---"
  (cd "$NATIVE/$app" && npx cap sync ios && npx cap sync android)
done

echo ""
echo "=================================================="
echo " 3/3  Verifying what is actually on disk"
echo "=================================================="

fail=0
check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then
    printf '  OK    %-42s %s\n' "$1" "$3"
  else
    printf '  WRONG %-42s got "%s", expected "%s"\n' "$1" "$3" "$2"
    fail=1
  fi
}

for app in gr-app en-app; do
  pub="$NATIVE/$app/ios/App/App/public"
  echo ""
  echo "--- $app (iOS bundle) ---"
  check "boot diagnostics present" "yes" \
    "$([ -f "$pub/native-boot-debug.js" ] && echo yes || echo no)"
  check "boot diagnostics loaded first" "yes" \
    "$(head -5 "$pub/index.html" 2>/dev/null | grep -q 'native-boot-debug.js' && echo yes || echo no)"
  check "supabase bundled locally" "yes" \
    "$([ -f "$pub/supabase.js" ] && echo yes || echo no)"
  check "no CDN dependency left" "0" \
    "$(grep -c 'jsdelivr' "$pub/index.html" 2>/dev/null || true)"
  check "Capgo plugin gone" "0" \
    "$(grep -ci capgo "$NATIVE/$app/ios/App/CapApp-SPM/Package.swift" 2>/dev/null || true)"
done

echo ""
echo "=================================================="
if [ "$fail" -eq 0 ]; then
  echo " ALL CHECKS PASSED"
  echo ""
  echo " Both apps on disk are up to date. Next, in Xcode:"
  echo "   1. Product -> Clean Build Folder   (Shift-Cmd-K)"
  echo "   2. Delete the app from the Simulator (hold icon -> Delete App)"
  echo "   3. Press Run"
  echo ""
  echo " To be certain Xcode has the right project open, close it and run:"
  echo "   cd $NATIVE/gr-app && npx cap open ios     # Greek edition"
  echo "   cd $NATIVE/en-app && npx cap open ios     # USA edition"
else
  echo " SOME CHECKS FAILED — see the WRONG lines above."
  echo " Do not rebuild in Xcode yet; the bundle on disk is not correct."
fi
echo "=================================================="
echo ""
