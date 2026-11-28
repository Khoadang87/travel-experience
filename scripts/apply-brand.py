#!/usr/bin/env python3
"""Fill {{SITE_NAME}} and related tokens from src/site-config.js.

The visible brand lives in that one constant. Run this after changing it
so committed HTML and the manifest match (the preview host serves the
repo files, not the built site/ folder).
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cfg = (root / "src" / "site-config.js").read_text()

def const(name, default=""):
    m = re.search(r'export const %s = "((?:\\.|[^"\\])*)"' % name, cfg)
    return m.group(1) if m else default

TOKENS = {
    "SITE_NAME": const("SITE_NAME", "LA Walks Preview"),
    "SITE_TAGLINE": const("SITE_TAGLINE"),
    "SITE_PREVIEW_NOTE": const("SITE_PREVIEW_NOTE"),
    "SITE_NOT_SAVED": const("SITE_NOT_SAVED", "Preview: not saved"),
    "SITE_STORAGE_NOTE": const("DEMO_STORAGE_NOTE"),
}

def fill(text):
    for key, value in TOKENS.items():
        text = text.replace("{{" + key + "}}", value)
    return text

def main(dest=None):
    targets = list(root.glob("*.html")) + [root / "site.webmanifest", root / "README.md"]
    if dest:
        dest = Path(dest)
        targets = [dest] if dest.is_file() else list(dest.glob("*.html")) + [
            dest / "site.webmanifest",
            dest / "README.md",
            dest / "styles.css",
            dest / "official.css",
            dest / "robots.txt",
        ]
    changed = []
    for path in targets:
        if not path or not path.exists():
            continue
        orig = path.read_text()
        next_ = fill(orig)
        if next_ != orig:
            path.write_text(next_)
            changed.append(str(path))
    print("Brand:", TOKENS["SITE_NAME"])
    if changed:
        print("Updated", len(changed), "files")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else None))
