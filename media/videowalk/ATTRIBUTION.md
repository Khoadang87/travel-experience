# Grove and Farmers Market video walks — attribution

These are private test video walks built from Kane's own iPhone
footage. They are not 360° captures and not live views. No
endorsement by The Grove, the Original Farmers Market, their
stores, or anyone appearing in the footage is implied. The clips
are not published under a Creative Commons or other public licence.

## Footage

- **The Grove:** Kane's iPhone 15 clip (`clip1.mov`), about 35
  seconds, portrait 1080×1920 after rotation, filmed 26 November
  2026 at about 34.0720 N, 118.3576 W.
- **Original Farmers Market:** Kane's iPhone 15 clip (`clip2.mov`),
  about 52 seconds (the whole clip), same device, about 34.0719 N,
  118.3608 W.

## Encoding

Both clips were transcoded with ffmpeg 7.1 / libx264 for the web
and iPhone Safari:

- Rotated to upright portrait and scaled to 640×1136, 8-bit H.264
  High, yuv420p, 30 fps, CRF 28.
- Dense keyframes every 0.5 s (`-force_key_frames` / GOP 15) so
  hold-to-walk seeking stays smooth.
- `+faststart`, no audio track, source GPS/metadata stripped.
- Default ffmpeg color conversion (HLG/DoVi source); no hable
  tonemap.

Sizes: `grove-kane-test.mp4` is 11,111,297 bytes (about 10.6 MB);
`farmers-kane-test.mp4` is 13,639,692 bytes (about 13.0 MB).

## Audio

The source clips have stereo AAC of the real walk, including
bystander voices in a busy public place. That audio was **stripped**
and is not in these MP4s.

The optional Sound toggle plays `ambience-standin.m4a`, an 8-second
looped bed generated with ffmpeg `anoisesrc` (brown noise, filtered).
It is a stand-in, not field recording, and contains no voices. Sound
starts off, matching the Hoi An w27 player.

## Player

Hold-to-walk, Explore, the mini-map, the stale-cache guard, and the
separate sound toggle follow the recovered Hội An w27 player
(`cities/hoian/walk-w27.js` at commit 16996dd, 31 October 2026) in
this repository's git history. Look-around is not a 360° sphere:
these are flat portrait clips, so the player slightly overscales the
frame (1.2×) and pans inside it so black edges are never shown.
