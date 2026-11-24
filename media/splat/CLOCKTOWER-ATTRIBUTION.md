# Clock Tower plaza Gaussian splat — attribution

The Clock Tower in the Old Port of Montreal, photographed by drone. Photos from Heritage3DMtl by Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar, Concordia University.

Source: https://zenodo.org/records/17063337 (file 7-Clock-Tower.zip)

The trained Gaussian scene is from the SplatCast sample-scenes dataset
(https://huggingface.co/datasets/splatcast/sample-scenes, folder ClockTower),
offered under Creative Commons Attribution 4.0 International (CC BY 4.0).
The full licence text is in CLOCKTOWER-LICENSE.md and at
https://creativecommons.org/licenses/by/4.0/.

Upstream attribution (from the dataset's ATTRIBUTION.md):

# Clock Tower sample

The Clock Tower in the Old Port of Montreal, photographed by drone. Photos from Heritage3DMtl by Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar, Concordia University.

Source: https://zenodo.org/records/17063337 (file 7-Clock-Tower.zip)
Retrieved: 14 October 2026.
License: Creative Commons Attribution 4.0 International (CC BY 4.0). https://creativecommons.org/licenses/by/4.0/

Changes: the 219 drone photos were halved to 2016 x 1512, their lens distortion was removed using the camera model published with the dataset, and they were cropped to 1916 x 1436. The camera positions published with the dataset were used as they are. 60,000 far seed points were added so the distant skyline could form. The Gaussian scene was trained for 30,000 steps with SplatCast. 55 of the 219 photos are included here (every fourth by name). The Gaussian scene derived from these photos is also distributed under CC BY 4.0.

These sample assets are separately licensed. SplatCast's proprietary software license, subscription, and export restrictions do not restrict the rights granted for these assets under CC BY 4.0. You may use, adapt, and redistribute them, including commercially, with attribution, a link to the license, and an indication of changes. No endorsement by the photographers or Concordia University is implied.

The license covers copyright and similar rights; it does not warrant that every other right is cleared. The full license text is in LICENSE.md in this folder.


## Changes in this preview copy

This repository does not ship the original `scene.splatcast` (1,150,558 Gaussians,
SCST v1 + LZFSE). For a phone-friendly web preview it was converted as follows:

- Decoded the 24-byte SCST header and LZFSE payload to a 3DGS PLY (float32
  positions, float16 scales / rotations / opacities / DC colour; higher-order
  SH dequantized as int8 × the file's SH scale, then dropped).
- Removed the far seed-point shell and Gaussians outside a box around the plaza
  (about 25 × 16 × 25 m after leveling).
- Dropped very transparent or very large Gaussians.
- Leveled the plaza so the paved floor is approximately horizontal near y = 0
  (an 11° rotation fitted to the dense plaza surface). Higher-order SH were
  not rotated because those bands were then discarded.
- Discarded spherical-harmonic bands above DC (SH degree 0) to keep the file
  small and avoid uncertain higher-band dequantization.
- Downsampled to 550,000 Gaussians (from 1,150,558).
- Packed as SOG version 2 with PlayCanvas splat-transform 3.12.0
  (`clocktower-plaza.sog`, about 6.5 MB).

These changes are for a compact web preview. They are not endorsed by the
photographers, Concordia University, Heritage3DMtl, SplatCast, or the places
shown.
