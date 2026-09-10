#!/usr/bin/env bash
# FuneralOS — generate the Android release (upload) keystore for one edition.
#
# Run this ONCE per edition, on your own machine. It creates the signing key
# Play uses to prove an update really came from you, plus the gitignored
# keystore.properties that app/build.gradle reads.
#
#   ./native/android-keystore.sh gr     # Greek edition  (net.funeralos.gr)
#   ./native/android-keystore.sh en     # USA edition    (net.funeralos.en)
#
# ─────────────────────────────────────────────────────────────────────────
#  BACK THE KEYSTORE UP SOMEWHERE SAFE AND OFF THIS MACHINE.
#
#  Lose it and you can never publish an update to that listing again — the
#  only remedy is asking Google to reset your upload key, and if you also
#  opted out of Play App Signing, not even that: the listing is dead and you
#  must republish under a new package name, losing every install and review.
#  A password manager or an encrypted backup is the right home for it.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

EDITION="${1:-}"
case "$EDITION" in
  gr) APP_DIR="gr-app"; APP_ID="net.funeralos.gr"; APP_NAME="FuneralOS" ;;
  en) APP_DIR="en-app"; APP_ID="net.funeralos.en"; APP_NAME="FuneralOS USA" ;;
  *)  echo "Usage: $0 gr|en" >&2; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$REPO_ROOT/native/$APP_DIR/android"
KEYSTORE="$ANDROID_DIR/funeralos-$EDITION-upload.jks"
PROPS="$ANDROID_DIR/keystore.properties"
ALIAS="funeralos-$EDITION"

if [ -e "$KEYSTORE" ]; then
  echo "A keystore already exists at:"
  echo "  $KEYSTORE"
  echo ""
  echo "Refusing to overwrite it — replacing a keystore that has already"
  echo "signed a published release permanently breaks updates for that app."
  echo "If you are certain this one was never used, move it aside by hand first."
  exit 1
fi

echo ""
echo "Creating the release keystore for $APP_NAME ($APP_ID)."
echo "Choose a password you can retrieve later — a password manager, not memory."
echo ""

read -r -s -p "Keystore password (min 6 characters): " PW; echo
read -r -s -p "Repeat it: " PW2; echo
[ "$PW" = "$PW2" ] || { echo "Passwords do not match." >&2; exit 1; }
[ "${#PW}" -ge 6 ] || { echo "Password must be at least 6 characters." >&2; exit 1; }

keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PW" -keypass "$PW" \
  -dname "CN=$APP_NAME, OU=FuneralOS, O=FuneralOS, L=Heraklion, S=Crete, C=GR"

# Relative storeFile, so the path stays valid on any machine that has the repo.
cat > "$PROPS" <<EOF
storeFile=$(basename "$KEYSTORE")
storePassword=$PW
keyAlias=$ALIAS
keyPassword=$PW
EOF
chmod 600 "$PROPS" "$KEYSTORE"

echo ""
echo "=================================================="
echo " DONE"
echo ""
echo "  keystore : $KEYSTORE"
echo "  config   : $PROPS"
echo ""
echo " Both are gitignored and will never be committed."
echo ""
echo " BACK UP the keystore file and its password NOW, somewhere that"
echo " survives this laptop. Without them you can never ship an update"
echo " to this app again."
echo ""
echo " Next: build the release bundle for the Play Store with"
echo "   cd $ANDROID_DIR && ./gradlew bundleRelease"
echo " The .aab lands in app/build/outputs/bundle/release/"
echo "=================================================="
echo ""
