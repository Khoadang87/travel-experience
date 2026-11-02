# w53 internal two-source player

This is implemented player source, not an approved delivery. Main test index/ver
remain w42 and live w27 is untouched. The candidate is backed up on the existing
review branch only. No preview link is being delivered.

## What changed

`route-trial-w53.html` now loads a complete two-source player rather than just a
route selector or a separate assembled video. The bridge route retains its
100-second recorded span (1102..1202). A second source represents the actual
forward-filmed 30-second street-bound traversal (local 5..35, original 700..730).
Both play only forward in time. Side input turns the view; it does not claim
sideways travel. Pull-back no longer performs the old five-second seek.

At main 1102..1106 only, pull-back or pushing while looking behind proposes an
explicitly disclosed source edit. A modal describes the different filming day,
lighting and unsolved camera offset. The user must choose the edit. The target
stays paused and requires a fresh forward push. Selecting another start through
Routes is also explicitly a starting-point change. There is no automatically
executed junction, reverse video, blur, model scene or still-image movement.

The previous video texture remains selected while the target loads. Source
selection commits only after decoded-data/time checks. Failed loads and cancelled
requests retain the prior selection. These behaviors were checked with injected
adapters, not an actual browser. Native Safari media behavior remains unverified.

Accepted horizontal picture drag is retained: dragging right increases yaw.
Paused views do not drift. While walking, the view follows changes in the
estimated source travel bearing without resetting the user's look offset.
This follow behavior and the rewritten input handling need actual visual QA.
The separate ground-colored nadir disc is preserved. Main-source audio follows
walking and the saved mute setting; the extracted return source has no audio,
and the UI says so rather than supplying unrelated sound.

## Return direction measurements

`review/measure-return-heading-w53.py` measured all 34 consecutive one-second
pairs from the full original 695..730 extraction. All met the script's masked
facade-SIFT/essential-matrix/cheirality thresholds. The new local heading table
uses the inferred second-frame horizontal travel bearing with a centered
three-pair median. Low pair counts at two locations (36 inliers) and moving
objects remain sources of uncertainty. This is geometry-based direction
estimation, not geographic alignment, rendered player evidence or acceptance.

## Exact media and current hosting blocker

Original 35-second source extraction SHA256:
`8742afb41f2d2fad7dfebd39e8fe7e89645201b9cc2d589be6b2b2d45302e3e2`.
Public source page: `https://deovr.com/glcyf0`, HenkWalks, same filming as YouTube
`C26CAyJkt4g`. No signed playback URL is stored in the player or this handoff.

The local player asset `assets/henk-return-w53.mp4` is a new H264 yuv420p CRF25
medium-preset transcode at 2160x1080, 25fps, 35.08 seconds, 26,460,459 bytes.
Its SHA256 is
`a537f1373a0b7b82bc72c0a7964efbf25351223fca3d81d78a5b5c0695a592bf`.
Full decode succeeded and blackdetect found no intervals at d=.1/pix_th=.10.
The original file remains. No color grading, rendered quality or seamlessness
claim follows from these checks.

The MP4 is local only, not included in the GitHub text-source backup and not yet
served from a verified durable test URL. Loading the return route from a bare
review-branch checkout without that asset will fail honestly and retain the
old view. Do not mark hosting solved. Existing R2 upload authorization/connection
would be useful, but no laptop, credential lookup, account or paid resource was
accessed in this run. Do not wake the laptop: the owner requested shutdown.

## Checks and remaining acceptance

Run from this directory:

```
node --test navigation-w53.test.mjs
node --check walk-w53.js
python -m py_compile review/measure-return-heading-w53.py
```

Twelve tests pass. They cover the limited edit window, no invented return/strafe,
positive-time play, preserved horizontal drag sign, invalid direction data,
failed or wrong-time replacement, cancellation and late request ordering.
HTML IDs were checked (23 unique, all 21 JS references present). These are not
visual or Safari tests. No cloud browser-control capability was found, and no
browser was installed or browser run claimed.

`review/candidate-review-w53.json` binds current source hashes to explicit
missing browser, real iPhone and independent-advisor evidence. It is a self
review and records `delivery_approved:false`, `phone_testing_ready:false`.
The unresolved w42 phone failure remains a regression requirement, not a pass
for this candidate. A review of the earlier video assembly cannot approve w53.

Next: host the exact asset through an authorized existing resource; examine
both sides of the proposed edit in the rendered player and verify target
approach/heading; correct runtime issues; obtain independent review of those
exact source/media hashes and actual real iPhone Safari evidence. The broad
all-direction, 15-minute area remains incomplete. One short return connection
does not satisfy it.
