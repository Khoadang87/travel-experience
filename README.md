# travel-experience
Virtual travel experience: continuous 360° walks through real cities

## Cities
- [Hội An walk](cities/hoian/): real 360° footage (11 min, 3840×1920, one continuous HLS stream each way, starts at 1280 and steps up), joystick up = walk forward, down = walk back, clear sideways push = turn; view follows the walking direction, drag with a finger to look anywhere, `?gyro=1` for tilt. Stopping freezes the footage. Credits in `cities/hoian/CREDITS.md`.

## Development and video quality

Serve the repository root with `python3 -m http.server 8000` and open
`/cities/hoian/` on that local server. No build step is needed.

The quality button shows the decoded panorama width and cycles **Auto → High →
Data saver** on browsers using hls.js. Auto starts with the small rendition and
refreshes the paused first frame at higher quality when measured bandwidth allows.
Data saver caps adaptive selection at 1280×640; High selects the highest rendition
available for the current direction. Native Safari uses its own adaptation in Auto; High and Data saver select a
specific playlist and reload at the current route position. `?quality=low` or
`?quality=high` selects the initial mode; the browser's Save-Data preference selects Data saver unless an explicit
quality parameter overrides it. The forward panorama tops out at 3840×1920 and reverse at
1920×960. These dimensions cover the full 360° scene, not just the visible viewport.

Audio loads on interaction, and reverse video loads only when walking back is
requested. First reversal may therefore take longer on a slow connection. A
buffering indicator remains visible in the minimal interface; stream failures
show an error with instructions to reload.

Run browser regressions with `python3 -m unittest discover -s tests -v` after
installing Python `playwright` and Chromium. The tests use `/usr/bin/chromium`
by default; set `CHROMIUM_PATH` to override it. These checks cover Chromium;
Safari/iPhone playback still needs device validation.

## Exploring and connecting routes

Use **Explore** to pause the walk, choose any point on the available route, and
resume there. Start/end notices explain how to walk back or choose another point.
This is navigation along recorded footage; it is not a geographic street map or
free movement off the filmed path.

`cities/hoian/routes.json` lists the playable routes. Each entry has an `id`,
`name`, `duration`, and relative `manifest` pointing to a walk manifest with
forward/reverse HLS, poster, audio, and optional heading data beside it. Add
connections as `{ "route": "target-id", "at": 120, "entry": 0, "label": "Entrance" }`.
`at` marks the entrance time on the source route; `entry` marks the landing time
in the target. Connections appear in Explore and preserve the quality setting.
Add return connections explicitly. Only add a playable route after its media and
use permissions have been verified. There is currently one street route and no
connected buildings or temples. No geographic coordinates have been recorded.

Connections also appear as **Turn here** / entrance prompts while the walker is
within six seconds of their `at` timestamp. Set an optional `radius` in seconds
(up to 30) to adjust this window. Prompts disappear away from the junction and
while Explore is open. Selecting one lands at the target's `entry` timestamp
and preserves the currently selected quality, including changes made after load.
There are no live turn prompts until real connected footage is added to the catalog.
