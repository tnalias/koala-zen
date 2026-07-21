#!/usr/bin/env bash
# Build Koala Zen distribution packages from source.
#
#   dist/koala-zen-chrome.zip    Chrome, Edge, Brave (or the Chrome Web Store)
#   dist/koala-zen-firefox.xpi   Firefox and addons.mozilla.org (0 warnings with addons-linter)
#
# The committed manifest.json targets both engines: it keeps background.service_worker
# for Chrome. For Firefox the script strips that key and requires the Firefox versions
# that understand data_collection_permissions, so the AMO validation report stays clean.
#
# Requirements: bash, zip, python3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
FILES=(manifest.json background.js content.js popup.html popup.js quotes.js _locales icons images)

rm -rf "$OUT"
mkdir -p "$OUT"

# --- Chrome: source as-is ---
( cd "$ROOT" && zip -rqX "$OUT/koala-zen-chrome.zip" "${FILES[@]}" -x "*.DS_Store" )

# --- Firefox: engine-specific manifest ---
TMP="$(mktemp -d)"
for f in "${FILES[@]}"; do cp -r "$ROOT/$f" "$TMP/"; done
python3 - "$TMP/manifest.json" <<'PY'
import sys, json, collections
p = sys.argv[1]
m = json.load(open(p, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
m.get("background", {}).pop("service_worker", None)              # Firefox uses background.scripts
g = m["browser_specific_settings"]["gecko"]
g["strict_min_version"] = "140.0"                               # data_collection_permissions (desktop)
m["browser_specific_settings"]["gecko_android"] = {"strict_min_version": "142.0"}
json.dump(m, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
( cd "$TMP" && zip -rqX "$OUT/koala-zen-firefox.xpi" "${FILES[@]}" -x "*.DS_Store" )
rm -rf "$TMP"

echo "Built:"
ls -lh "$OUT"
