# Farmers Market (Kane's scan, test) — attribution

This is a rough test Gaussian splat reconstructed from Kane's own
iPhone footage of a walk at the Original Farmers Market, Los
Angeles. It is not a polished scan and not a live view. Bystanders
in the reconstruction appear smeared. This preview is for a private
test pin only. It is not published under a Creative Commons or other
public licence, and no endorsement by the Farmers Market, its
stalls, or anyone appearing in the footage is implied.

This pin uses only the first COLMAP component (frames 1–67, about
the first 22 seconds: clock tower, Gilmore, tree, and fence). Later
parts of the walk (a window pan and the walk toward the cantina)
registered as separate models and did not merge, so they are not in
this preview.

## Source

- **Footage:** Kane's iPhone 15 clip of a walk through the Original
  Farmers Market (portrait 1080×1920, about 52 seconds). Filmed by
  the site owner for this test. Not a third-party dataset.
- **Location:** Original Farmers Market, Los Angeles, about
  34.0719 N, 118.3608 W.
- **Reconstruction (private test, research tools):**
  - Frames extracted at 3 fps (156 JPEGs). COLMAP 4.2.0 CPU
    sequential SfM registered all 156 frames in three unmergeable
    components. This preview trains and orients only model 1
    (67 images, frames 1–67).
  - Trained with Brush v0.3.0 (Apache 2.0 3DGS reimplementation)
    for 5000 steps, SH degree 2, max-resolution 800, on CPU
    lavapipe. Export: `farmers_5000.ply`, 103,886 Gaussians.

## Changes in this preview copy

Converted with PlayCanvas splat-transform 3.12.0 and written as SOG
version 2 (Spark 2.4-compatible):

- Rotated 180° about X so the scene is Y-up, matching the COLMAP
  camera path after the same transform.
- Scaled by ≈ 1.791 and translated in Y by ≈ 1.456 so 1 unit ≈ 1 m
  and the pavement under the walker is near y = 0.
- Discarded spherical-harmonic bands above DC (SH degree 0) to keep
  the file small.
- Packaged as `farmers-kane-test.sog` (103,886 Gaussians, 1,375,442
  bytes, about 1.3 MB). No extra decimation was needed to stay under
  about 15 MB.

These changes are for a compact web preview only. Quality is that of
a short handheld walk: recognizable landmarks near the camera path,
smeared people, and holes off the path and in the later unmodeled
parts of the clip.
