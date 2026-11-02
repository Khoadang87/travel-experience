# w54 media backup candidate — unapproved

The player logic is the same bounded two-source trial as w53, with new versioned
filenames and a smaller return media asset. Source and exact asset are being
backed up only to the existing review branch. Test index/ver remain w42; live
w27 is untouched. No preview is delivered and no phone-ready claim is made.

The 26,460,459-byte w53 upload was rejected by connector transport before GitHub
accepted it: the MCP JSON request limit is16MiB. The original and w53 copies are
retained. A new encode from the original 35-second50fps source uses H264 CRF32,
slow preset,2160x1080,25fps,yuv420p,faststart,no audio. It is35.08s and10,554,227
bytes. SHA256:e802da59e406706acd71e03a8319b104a67a147698f5da7eb0a1215a5ac47cda.
The create_blob response SHA1 matched the locally computed Git blob identifier:
ee4e04c0b3b674cf0888b2e87e336abfcc346b41. This verifies the backed-up bytes,
not public browser playback. The relative asset path is assets/henk-return-w54.mp4.

The full file decoded, and blackdetect d=.1/pix_th=.10 found no black intervals.
Three crops from nominal local5,15,25sec were visually compared to the original:
real scenery remains, but fine detail is softer. The PSNR numbers in the sample
report are NOT a quality conclusion:50fps/25fps nominal-time samples have not
been frame-accurately aligned. Professional appearance/HD quality is unapproved.
No original or previous test file was deleted. No laptop, credentials, paid
resource, new account or worker was accessed.

The media backup resolves loss-on-workspace-pruning for this exact test encode.
It does NOT establish HTTP availability, byte-range behavior, CORS, a served
player, Safari presentation or movement correctness. No signed provider URL was
committed. The runtime source still uses a relative asset URL, now present in a
review-branch checkout. It has not been promoted to main or GitHub Pages.

Run node --test navigation-w54.test.mjs and node --check walk-w54.js.
The existing twelve meaningful route/session checks pass; no browser visual tool
was available and none was installed. Exact candidate source hashes are bound in
candidate-review-w54.json, which explicitly blocks delivery and phone readiness.

Still required: rendered exact-player inspection of old-view retention, disclosed
junction switch, correct visible travel, all controls and layout; independent
exact-player advisor review; real iPhone Safari evidence. Physical junction
alignment remains unverified and there is no sideways captured path or broad
15-minute free-roaming solution. Continue useful decoded coverage/junction work
where tools permit. Do not send this draft merely because media is backed up.
