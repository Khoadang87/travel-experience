# Ludlow Quality Square courtyard Gaussian splat — attribution

This is a cropped preview of a capture of Quality Square in Ludlow,
Shropshire, UK. It is not a live view. No endorsement by the author,
XGRIDS, SuperSplat, or PlayCanvas is implied.

## Sources

- **Published scene:** “Ludlow Quality Square” by ijenko on SuperSplat,
  https://superspl.at/scene/ca36efcc
  License: Creative Commons Attribution 4.0 International (CC BY 4.0),
  https://creativecommons.org/licenses/by/4.0/. The SuperSplat scene
  page lists the licence as CC BY 4.0 (`license: by`) and credits the
  capture to an XGRIDS LixelKity K1. The full licence text is in
  LUDLOW-LICENSE.md.
- **Author download:** the source used for this preview was ijenko’s
  public Google Drive folder
  https://drive.google.com/drive/folders/1RdyYM4iVcCpH6GXebynRcapOWqH8_qPo
  (file “iJenko - LQS Kityk1 - Supersplat Compressed Export.ply”, a
  SuperSplat 2.11.7 compressed PLY of the same scene). The official
  SuperSplat download API requires a SuperSplat account; this copy was
  taken from the author’s public Drive instead. The Drive folder is the
  author’s own distribution of the same capture.

## Changes in this preview copy

This repository does not ship the original compressed PLY (about
302 MB, 5,163,425 Gaussians, SH degree 3) or the published SuperSplat
SOG (about 49 MB, 4,555,055 Gaussians). For a phone-friendly web
preview it was converted as follows:

- Decoded with PlayCanvas splat-transform 3.12.0 and written as SOG
  version 2 (Spark 2.4-compatible).
- Cropped to a box around the courtyard, the passage, and the
  eye-level building facades, discarding more distant rooftops and
  floaters.
- Discarded spherical-harmonic bands above DC (SH degree 0) to keep
  the file small.
- Rotated 180° about Z so the scene is Y-up in the same convention as
  the other preview splats, and shifted so the cobble surface is near
  y = 0.
- Packaged as `ludlow-courtyard.sog` (1,859,892 Gaussians, 22,299,825
  bytes, about 21.3 MB).

These changes are for a compact web preview only.
