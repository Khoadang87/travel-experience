# travel-experience
Virtual travel experience: continuous 360° walks through real cities

## Cities
- [Hội An walk](cities/hoian/): real 360° footage (11 min, 2560×1280, one continuous HLS stream each way, starts at 960 and steps up), joystick up = walk forward, down = walk back, clear sideways push = turn; view follows the walking direction, drag with a finger to look anywhere, `?gyro=1` for tilt. Stopping freezes the footage. Credits in `cities/hoian/CREDITS.md`.

## Development and video quality

Serve the repository root with `python3 -m http.server 8000` and open
`/cities/hoian/` on that local server. No build step is needed.

The quality button shows the decoded panorama width and cycles **Auto → High →
Data saver** on browsers using hls.js. Auto starts with the small rendition and
refreshes the paused first frame at higher quality when measured bandwidth allows.
Data saver caps adaptive selection at 960×480; High selects the highest rendition
available for the current direction. Native Safari HLS manages quality itself,
so its indicator shows Auto and the control is disabled. `?quality=low` or
`?quality=high` selects the initial mode; the browser's Save-Data preference takes
priority initially. The forward panorama tops out at 2560×1280 and reverse at
1920×960. These dimensions cover the full 360° scene, not just the visible viewport.

Audio loads on interaction, and reverse video loads only when walking back is
requested. First reversal may therefore take longer on a slow connection. A
buffering indicator remains visible in the minimal interface; stream failures
show an error with instructions to reload.

Run browser regressions with `python3 -m unittest discover -s tests -v` after
installing Python `playwright` and Chromium. The tests use `/usr/bin/chromium`
by default; set `CHROMIUM_PATH` to override it. These checks cover Chromium;
Safari/iPhone playback still needs device validation.
