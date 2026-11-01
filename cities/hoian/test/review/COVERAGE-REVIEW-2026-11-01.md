# Internal footage/route review — no final approval

Latest owner policy: keep drafts and rejected candidates internal. Only deliver a final after an actual independent advisor review of that exact candidate and real iPhone Safari acceptance. No approval has been obtained. This source audit is a preliminary check, not that independent review, a browser test, a production release gate or a fix to navigation.

## Work completed

Added a reusable, read-only route/source audit and five tests. The audit records SHA-256 identities for the route configuration and player, identifies configured time ranges and junctions, and refuses to interpret timestamps, valid clip IDs or mock links as physical connectivity. The report always withholds delivery approval; it cannot grant approval by itself.

Inspection of the current w42 source confirms pull-back calls a five-second earlier seek, and side stick changes view yaw. Neither implements the requested continuous backward/sideways translation. The main route description still promises walking forward or back. The live route configuration was only read; no text, player or configuration was changed. The plotted path integrates heading samples; this audit found no verified geographical coordinates or metric scale in that routine.

The configured main clip spans timeline 0–1435.3 and the river clip 1436.2–1583.6. The river links map main time 256.5 to river 1437, then river 1581.5 to main 902.5. Their physical adjacency has not been independently verified. The riverside credit explicitly says another creator and a different recording day; that is not evidence of continuity. Mock links exist separately in configuration and must not be counted as captured side streets.

## Media validation

Four local files previously downloaded for BjyIbuEsrAQ and pjo8Y_k79Sk are 195-byte error responses. ffprobe rejects all four; they are not usable video/audio assets. Their info.json titles and duration fields must not be mistaken for downloaded coverage. This finding concerns these local downloads only. It does not establish the status of all R2 hls14 files, which were not enumerated or inspected in this run.

The existing bridge-source.mp4 is valid 2560×1280 video. Its container reports nonzero starting timestamps, so container duration alone must not be treated as newly captured route coverage. No new opposite-direction path or street area was acquired.

## Reproduce

From a repository checkout:

```
python3 cities/hoian/test/review/coverage_audit.py cities/hoian/routes.json cities/hoian/test/walk-w42.js
python3 -m unittest discover -s cities/hoian/test/review -p 'test_coverage_audit.py' -v
```

The saved JSON is a snapshot; rerun it if either input changes. This tool is intentionally conservative. Its string-based source checks are narrow diagnostics and are not a proof that an unflagged player is correct. Runtime w42 and live w27 are unchanged; no files were deleted. This addition is review tooling only, not a new player version or a user preview.

Next useful work: verify actual R2 hls14 coverage and potential junctions against decoded pictures, identify genuinely overlapping routes, and obtain usable return/sideways capture. Preserve the accepted w44 picture-drag direction when controls change. Do not substitute model geometry, blur jumps, reverse people or unrelated frames for missing spatial coverage. Expanded realistic free exploration remains unresolved.
