# w43 bounded navigation diagnostic

Standalone page: ../free-walk-w43.html. Does not replace the video test w42 or live w27.

Purpose: test actual camera translation in every ground-plane direction, separate drag-look, pointer capture, stop on interruption, diagonal normalization, visible test perimeter, and a 15-minute visible-tab timer. No HLS, seek jumps, direction gate or automatic camera turn.

Geometry: 911 points from the largest model in a second masked CPU reconstruction. Mask retains vertical image band 8–55%; this is only a sensitivity test, not semantic person removal. That model registered 12/20 frames with mean reprojection error 0.49465 pixels. It does not validate 3D accuracy. Camera trajectory rescaled to six arbitrary units, not metres. Grid floor and boundary are artificial navigation scaffolding. There are no reconstructed textured walls or physical obstacle collisions. Intro labels these limits explicitly.

Checks: JavaScript syntax and movement-vector tests passed for forward, backward, left, right, normalized diagonal and yaw-relative motion. Rendered visual QA, phone input and a real 15-minute Safari run are PENDING. Do not describe this as a completed realistic Hội An free-walk. User requested 1–2 hours; this prototype limits scope honestly rather than promising a finished scan. The surface reconstruction remains open.
