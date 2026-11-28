#!/usr/bin/env bash
# Copy only the static files the host needs to serve, and fill brand tokens
# from src/site-config.js so the visible name stays in one constant.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/site"
rm -rf "$dest"
mkdir -p "$dest"

python3 - "$root" "$dest" <<'PY'
import re, sys, shutil
from pathlib import Path

root = Path(sys.argv[1])
dest = Path(sys.argv[2])
cfg = (root / "src" / "site-config.js").read_text()

def const(name, default=""):
    m = re.search(r"export const %s = \"((?:\\.|[^\"])*)\"" % name, cfg)
    return m.group(1) if m else default

tokens = {
    "SITE_NAME": const("SITE_NAME", "LA Walks Preview"),
    "SITE_TAGLINE": const("SITE_TAGLINE", "Walk real streets, filmed by real travelers"),
    "SITE_PREVIEW_NOTE": const("SITE_PREVIEW_NOTE"),
    "SITE_NOT_SAVED": const("SITE_NOT_SAVED", "Preview: not saved"),
    "SITE_STORAGE_NOTE": const("DEMO_STORAGE_NOTE"),
}

def fill(text):
    for key, value in tokens.items():
        text = text.replace("{{" + key + "}}", value)
    return text

html_files = list(root.glob("*.html"))
for src in html_files:
    (dest / src.name).write_text(fill(src.read_text()))

for name in ("styles.css", "official.css", "robots.txt", "favicon.ico", "favicon.svg", "site.webmanifest"):
    src = root / name
    if not src.exists():
        continue
    data = src.read_text() if src.suffix in {".css", ".txt", ".webmanifest", ".svg"} or name.endswith(".css") else None
    if name == "site.webmanifest" or src.suffix in {".css", ".txt", ".webmanifest"}:
        (dest / name).write_text(fill(src.read_text()))
    else:
        shutil.copy2(src, dest / name)

for folder in ("src", "vendor", "data", "media"):
    shutil.copytree(root / folder, dest / folder)

for name in ("SOURCES.md", "README.md"):
    src = root / name
    if src.exists():
        (dest / name).write_text(fill(src.read_text()) if "{{SITE_NAME}}" in src.read_text() else src.read_text())

print("Built", dest, "as", tokens["SITE_NAME"])
PY
