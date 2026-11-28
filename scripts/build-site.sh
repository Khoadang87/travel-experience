#!/usr/bin/env bash
# Copy only the static files the host needs to serve.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/site"
rm -rf "$dest"
mkdir -p "$dest"
cp "$root/index.html" "$root/creator.html" "$root/admin.html" "$root/sales.html" "$root/styles.css" "$dest/"
cp "$root/robots.txt" "$root/favicon.ico" "$root/favicon.svg" "$root/site.webmanifest" "$dest/"
cp -r "$root/src" "$root/vendor" "$root/data" "$root/media" "$dest/"
cp "$root/SOURCES.md" "$root/README.md" "$dest/"
echo "Built $dest"
