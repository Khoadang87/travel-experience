# The Grove (Kane's scan, test) — attribution

This is a rough test Gaussian splat reconstructed from Kane's own
iPhone footage of a walk at The Grove, Los Angeles. It is not a
polished scan and not a live view. Bystanders in the reconstruction
appear smeared. This preview is for a private test pin only. It is
not published under a Creative Commons or other public licence, and
no endorsement by The Grove, its stores, or anyone appearing in the
footage is implied.

## Source

- **Footage:** Kane's iPhone 15 clip of a walk through The Grove
  (portrait 1080×1920, about 35 seconds). Filmed by the site owner
  for this test. Not a third-party dataset.
- **Location:** The Grove, Los Angeles, about 34.0720 N, 118.3576 W.
- **Reconstruction (private test, research tools):**
  - Frames extracted at 4 fps (141 JPEGs). COLMAP 4.2.0 CPU
    sequential SfM registered 113 of 141 images (sparse model 1;
    frames 19–141 except 31–40 unregistered).
  - Trained with Brush v0.3.0 (Apache 2.0 3DGS reimplementation)
    for 6000 steps, SH degree 2, max-resolution 800, on CPU
    lavapipe. Export: `grove_6000.ply`, 186,028 Gaussians.

## Changes in this preview copy

Converted with PlayCanvas splat-transform 3.12.0 and written as SOG
version 2 (Spark 2.4-compatible):

- Rotated 180° about X so the scene is Y-up, matching the COLMAP
  camera path after the same transform (the t=25 s orientation check
  confirmed this upright framing).
- Scaled by ≈ 1.966 and translated in Y by ≈ 1.003 so 1 unit ≈ 1 m
  and the sidewalk under the walker is near y = 0.
- Discarded spherical-harmonic bands above DC (SH degree 0) to keep
  the file small.
- Packaged as `grove-kane-test.sog` (186,028 Gaussians, 2,391,891
  bytes, about 2.3 MB). No extra decimation was needed to stay under
  about 15 MB.

These changes are for a compact web preview only. Quality is that of
a short handheld walk: recognizable storefronts near the mid path,
smeared people, and holes off the camera path and at the ends of the
clip.
