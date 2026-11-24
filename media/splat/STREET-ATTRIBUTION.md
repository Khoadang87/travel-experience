# Street intersection Gaussian splat — attribution

This is a reconstructed suburban intersection from dashcam footage, not a
live Tesla view and not an official Tesla asset. No endorsement by Tesla,
Inc., the photographers, or the model author is implied.

## Sources

- **Drive footage and reconstruction:** “Tesla drive intersection street
  splat” by cfahlgren1,
  https://huggingface.co/datasets/cfahlgren1/tesla-fsd-street-splat
  (file `street-with-model-y.sog`). The scene was trained from five
  synchronized cameras in cfahlgren1’s Tesla FSD drive dataset
  (https://huggingface.co/datasets/cfahlgren1/tesla-fsd-drive-5min).
  License: Creative Commons Attribution 4.0 International (CC BY 4.0),
  https://creativecommons.org/licenses/by/4.0/. The dataset card declares
  `license: cc-by-4.0` and the README credits the footage under that
  licence. The full licence text is in STREET-LICENSE.md.
- **Vehicle exterior in the capture:** 2021 Tesla Model Y by 763468712
  on Sketchfab
  (https://sketchfab.com/3d-models/tesla-model-y-2021-c0a86cac582d4b33aba0fb1b1912d970),
  body and rims recolored black and converted to Gaussians for placement
  on the road, also CC BY 4.0.

## Changes in this preview copy

This repository does not ship the original 21.0 MB SOG (SOG v3,
2,671,814 Gaussians, including higher-order SH). For a phone-friendly
web preview it was converted as follows:

- Decoded with PlayCanvas splat-transform 3.12.0 and written as SOG
  version 2 (Spark 2.4-compatible).
- Discarded spherical-harmonic bands above DC (SH degree 0) to keep the
  file small.
- Scaled from the reconstruction’s local units to metres (factor 40,
  chosen so the intersection is about 70 m across and typical Gaussians
  are a few centimetres) and shifted so the road surface is near y = 0.
- Removed below-ground floaters and Gaussians outside a box around the
  intersection.
- Downsampled to 1,000,000 Gaussians (from 2,671,814).
- Packaged as `street-intersection.sog` (about 4.1 MB).

These changes are for a compact web preview only.
