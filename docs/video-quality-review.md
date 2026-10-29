# Video loading and quality review

Reviewed the current 360° HLS player with Grok 4.3 through four API consultations:
source review, browser-evidence follow-up, patch review, and results assessment.
The API credential remains in the environment's HTTP secret binding; no key is
stored in the project or this report.

## Findings and decisions

- The old description of a flat 540p MP4 was stale. Current forward HLS offers
  960×480 and 2560×1280 panoramas; reverse offers 1920×960.
- Chromium kept the paused first frame at 960 pixels wide while higher-quality
  future segments were already buffered. Walking past the first segment changed
  it to 2560. Grok's initial claim that ABR never upgrades was rejected by this
  browser evidence.
- Auto retains a small first segment, then replaces the paused frame when the
  measured bandwidth estimate supports the higher rendition with a 30% margin.
  A tiny seek refreshes the paused decoder after replacement. This bandwidth
  estimate is a heuristic, not a guarantee of sustained network speed.
- The visible control cycles Auto, High, and Data saver and reports actual decoded
  panorama width. Save-Data initially caps selection to the low rendition.
- Removed timed reverse prefetch and standing-still priming. Reverse HLS starts
  at the mirrored route position only when needed. Audio waits for interaction.
  Forward HLS also starts at the requested position rather than downloading the
  opening segment before seeking.
- Reduced forward buffer targets from 30–60 seconds to 12–24 seconds. This limits
  speculative downloads; playback under poor network conditions needs field
  validation. First reversal can be slower without prefetch.
- Buffering feedback is visible in minimal mode. Fatal HLS/media failures and
  bounded startup/seek waits report errors instead of silently hanging. Failed
  direction changes keep the previous frame and instruct the user to reload.
- Grok's claim that clearInterval(undefined) throws was rejected: it is safe.

## Validation

Five Chromium browser tests pass (`python3 -m unittest discover -s tests -v`):

1. Paused startup reaches 2560px without movement or idle audio/reverse requests,
   including waiting past the former six-second prefetch timer.
2. Save-Data stays at 960px; High and Data saver manually switch decoded widths.
3. Forward/backward movement works; buffering events show/hide feedback; a start
   at 12 seconds does not download the initial segment, including reverse startup.
4. An HTTP 404 for the HLS master reports an error without claiming readiness.
5. A simulated decoder failure after startup reports a visible error.

Local baseline first-frame time was 810 ms; a modified run measured 775 ms. These
single local measurements are not evidence of a meaningful speed improvement.
The verified changes are sharper paused startup, fewer speculative requests,
working quality selection, and explicit failure feedback. JavaScript syntax and
`git diff --check` also pass.

Native Safari/iPhone, real mobile networks, and deployed performance are untested.
The 2560×1280 image covers the full sphere, so a viewport contains less detail
than a flat video of that resolution. No footage was upscaled or re-encoded.
The integrated fix was subsequently pushed to main. GitHub Pages deployment
and real-device Safari playback have not been verified. No cloud environment
configuration was published as part of the fix.

## Integration with newer GitHub version

Before delivery, fetched upstream commit 9d2d975, which replaces the forward
renditions with 1280×640 and 3840×1920. Preserved its wider portrait view, audio
cutoff during switches, and parked reverse-stream behavior while walking. Initial
idle startup still avoids reverse downloads. Browser tests derive the expected
widths from the HLS master and pass against the new media. Earlier 960/2560
measurements above describe the pre-integration baseline, not the final streams.
The integrated player uses cache version w7.

Explicit High/Data saver selection now also routes native Safari to the selected
media playlist, preserving position through a reload. Two Chromium-emulated
routing tests verify the high/low playlist requests; these do not establish real
Safari decoding or iPhone playback. All seven current browser checks pass.
