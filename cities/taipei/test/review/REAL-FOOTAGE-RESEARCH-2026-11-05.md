# Real-footage feasibility and source check — 2026-11-05 UTC host session

Status: research only. No new viewer, approved candidate, device pass, paid generation, or background build.
Latest EAN handoff read: issue #1 comment 6673393623. This supersedes the bot's earlier proposed game-style courtyard as a research lead; a third-party handoff is not authority to delete files or spend money.

## Recommendation
Qualify one real spherical walking source before another substantial viewer build. First inspect a complete, short, contiguous interval for natural forward motion, stable horizon, surrounding coverage, operator visibility, cuts, people and usable angular detail. Only after it passes, propose a 60–90 second source-backed control proof for owner agreement before expanding toward five minutes. This recommendation does not lower the original requirements or assert owner agreement to fixed-path limitations.
Do not rebuild the rejected 3D courtyard or repeat the failed flat-video camera-pan/scrub approach. Existing controls can rotate a view inside a filmed sphere; they cannot expose a spatial viewpoint that was not captured. Reversing playback reverses people's actions. Ordinary paused footage freezes them. Separate filmed directions can support bounded edits, not arbitrary sideways walking.

## Primary research checked
- https://augmentedperception.github.io/deepviewvideo/ — authors demonstrate real dynamic light-field playback in a browser, using 46 synchronized cameras and an 80 cm viewing baseline. This is evidence that some captured viewpoint freedom is possible, but not a cheap five-minute city-scale capture workflow. No demo was run or reused here; Safari performance, content rights, processing costs and production scalability were not verified.
- https://web.stanford.edu/~jingweih/papers/6dof.pdf — author's indexed limitations say plausible offsets approximately below one metre, dependent on reconstruction quality, with static-scene assumptions affecting moving people. Full PDF retrieval failed because of its size; only the primary-source indexed excerpt was available. Not evidence of unrestricted walking or our footage working.
- https://gcd.cs.columbia.edu/ — generative novel views use diffusion priors; authors acknowledge hallucination and divergent moving objects, especially for jumpy views. Inference: unsuitable as an assured real captured-surroundings replacement under the current goal. No model run.
- https://thomas-tanay.github.io/grvs — CVPR Findings 2026 research on recurrent dynamic view synthesis is a newer lead, with results on UCSD, Kubric and DAVIS. The inspected page has no visible code/weights link. No install, reproduction, licence clearance, runtime/cost measurement or iPhone evidence. Do not state that all single-video view synthesis is impossible; also do not equate paper demonstrations with a usable city-walk pipeline.

## Distinct footage candidate actually opened
Title: 360° VR Walk Through Piran & Bernardin – Portorož, Slovenia - Virtual Travel in 4K.
Author: Snicel 69.
Source page: https://commons.wikimedia.org/wiki/File:360%C2%B0_VR_Walk_Through_Piran_%26_Bernardin_%E2%80%93_Portoro%C5%BE%2C_Slovenia_-_Virtual_Travel_in_4K.webm
YouTube reference on page: gl75QoeWtaM. This is distinct from the previously rejected one-hour Piran source.
Commons lists CC BY 4.0, with external licence-review status still pending. This is a recorded listing, not an independent clearance verdict.
Original file listed 1920x1080 AV1/Opus, about 1.48 GB. A 4K title is not evidence that the available download is 4K.

Actual cloud Chrome observations:
1. Embedded Play action did not start decoded playback. Readback showed zero dimensions/time/readyState 0; an exposed source was a QuickTime MPEG-4 preview. Cause not proven.
2. Opened the exact Original file link through normal browser navigation. It decoded: 1920x1080, duration 1121.601 seconds, currentTime 4.256758, readyState 4, playing.
3. Ordinary native playback and Space pause: 17.485028, readyState 4, paused. Saved screenshot source-review-17s.jpg (SHA256 bf066edf59aa962b68775086098e81ae30915ba97cddddae464ad7339ad4e297).
4. Resumed ordinary native playback, paused at 29.705924, readyState 4. Visible displacement down steps supports actual short sampled traversal. The later screenshot was emitted but did not synchronize into the main workspace; it is NOT included as a backed-up image.
5. Pictures show panoramic distortion, outdoor steps, a visible operator and a large baked-in logo. Full spherical calibration, complete route continuity, eye height and natural speed were not established. A native raw-panorama view is not a virtual-walk solution.
Verdict: exclude this available copy from the polished next-player shortlist for now. It has practical quality/visibility concerns, no full-route review and no control/device evidence. No source media was inserted, reencoded or uploaded.

## Preservation check
Current main commit 90af3270642407353b52344f63a0a24fba99f806 has no cities/hoian paths in its complete 195-entry recursive tree. This absence was already present before this work.
Review branch base 046ec40c201082efb9bb215ad7cef2cd60684a19 still contains:
- cities/hoian/index.html c077355d3d3d3fd2e7f587688321f3c37e701928
- cities/hoian/ver.txt 8f1279ff9bab4745d01fcc9ff9fc4a23bfbc5839
- cities/hoian/test/index.html f35d6101814337318ec43af6de5af3cbeeefd2de
- cities/hoian/test/ver.txt 16a75d4b4e4b743c4aa73342b28a75bba6fbec87
- cities/hoian/test/assets/henk-return-w54.mp4 ee4e04c0b3b674cf0888b2e87e336abfcc346b41, 10554227 bytes.
No deletion or main/live mutation was performed in this research task. This checks selected critical files, not every historical file or current public playback.

## Next bounded work
Continue source qualification, not another full generator or model build. Prefer an actually accessible spherical original with enough angular detail and a short meaningful continuous walking interval. Inspect motion before integrating. If no such source qualifies, report that exact missing input rather than build around an unverified title.
Exact-current-player independent review and actual iPhone Safari evidence remain mandatory. No approved updated test link exists.
