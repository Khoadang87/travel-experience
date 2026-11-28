#!/usr/bin/env bash
# Copy only the static files the host needs to serve, and fill brand tokens
# from src/site-config.js so the visible name stays in one constant.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/site"
rm -rf "$dest"
mkdir -p "$dest"

cp "$root/"*.html "$root/styles.css" "$root/official.css" "$dest/"
cp "$root/robots.txt" "$root/favicon.ico" "$root/favicon.svg" "$root/site.webmanifest" "$dest/"
cp -r "$root/src" "$root/vendor" "$root/data" "$root/media" "$dest/"
cp "$root/SOURCES.md" "$root/README.md" "$dest/"
python3 "$root/scripts/apply-brand.py" "$dest"
echo "Built $dest"
