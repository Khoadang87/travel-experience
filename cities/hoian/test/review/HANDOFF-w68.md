# W68 internal control/render isolation

Observed w67 short-input failures are retained. W68 separates paintActiveFrame from controlTick so software playing/timeupdate/seeked callbacks cannot restart movement, reset rates or open navigation. Normal input/animation policy retains direction/coverage/confirmation gates. Playback rate writes occur only when desired rate differs. No new footage, geometry, fake traversal, blur or reversed playback.

Opt-in timing=1 adds document visibility/focus and animation-gap evidence. The input-picture marker now compares sampled PROJECTED output bytes, not whole source bytes; it still is not compositor screen-paint timing or a full-image cryptographic hash. Focused test proves clock-only and off-view source changes do not count.24sourcechecks+syntaxpass, not browser/iPhone/strictapproval. Actual results must be added to candidate-review-w68.json before claiming fixes.

Source/media from w65 remain unchanged. Preserve w42default, livew27, all previousfiles. No laptop/worker/paidservices/deletion/previewdelivery. Next inspect actual short-press/projected-pixel timing and visibility/animation gaps, then pursue a bounded cause-based correction. Do not infer iPhone behavior from this cloud CPU renderer; original w42 phone FAIL and broad uncaptured side/return coverage remain unresolved.


Actual cloud Chrome check (2026-11-03 UTC)

Exact main f594a90abc352f9ca189d792f73721f2499cbe5a, source lock dc7c58f088205a564c064937af9209cb22c7a71f3a5f72f06896e3f18c0e5c53, deployment 41560796733 success. All 24 source checks and syntax pass.

The main route half-second push landed 1066.479588 paused/ready4. First sampled projected-output difference at 343.9 ms occurred before release (505.9 ms). This improves one observation, not overall acceptance. The return route FAILED twice: 5 -> 5.055787 and 5.055787 -> 5.068975 for half-second pushes. Only repeat recorded a projected difference, at 636.4 ms already paused. No claim of responsiveness fixed. Actual right drag moved landmarks right while return time stayed 5.068975 paused/ready4.

Idle animation callbacks were about 1016 ms apart with document visible and focused. This is cloud-session evidence only, not a conclusion about the owner's phone. Source rate writes were one, one, zero for the three presses; unchanged writes were avoided, but cause of return failure remains unproven. Raw logs and paired screenshots are in review/evidence/w68 with hashes in candidate-review-w68.json. Diagnostic fingerprint samples the rendered output buffer, not source panorama, but still does not time compositor paint. Current junction regression, real iPhone Safari and strict independent review remain absent. Delivery and phone readiness remain false.

Next concrete work: isolate source clock/decoded-frame scheduling and hidden-video presentation without browser/security flags; compare event timing to actual output changes. Grok should independently inspect paint-only callback, playback-rate guard and return failure using this exact candidate. Do not treat a review request as acknowledgement or approval. Preserve every prior file, index/ver w42, live w27 and laptop-off rule.
