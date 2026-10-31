#!/bin/sh
# Install: ln -sf ../../cities/hoian/tests/pre-push.sh .git/hooks/pre-push
# Blocks any push unless the WebKit iPhone walk regression test passes against the local files.
cd "$(git rev-parse --show-toplevel)/cities/hoian" || exit 1
PY=${PY:-/workspace/pwenv/bin/python}
GST_PLUGIN_PATH=${GST_PLUGIN_PATH:-/workspace/gst} "$PY" tests/webkit_iphone_walk.py "https://khoadang87.github.io/travel-experience/cities/hoian/?debug=1" --local "$PWD" || { echo "pre-push: WebKit iPhone walk test FAILED - push blocked"; exit 1; }
