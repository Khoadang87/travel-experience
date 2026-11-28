# Grove and Farmers Market video walks — attribution

These are private test video walks built from the site owner's own iPhone
footage. They are not 360° captures and not live views. No
endorsement by The Grove, the Original Farmers Market, their
stores, or anyone appearing in the footage is implied. The clips
are not published under a Creative Commons or other public licence.

## Footage

- **The Grove:** the site owner's own iPhone 15 clip (`clip1.mov`), about 35
  seconds, portrait 1080×1920 after rotation, filmed 26 November
  2026 at about 34.0720 N, 118.3576 W.
- **Original Farmers Market:** the site owner's own iPhone 15 clip (`clip2.mov`),
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

## Café counter, 1st Street (added 27 November 2026)

- **Footage:** the site owner's own iPhone 15 clip, about 23 seconds
  (the whole clip), filmed 26 November 2026 inside a café near 1st
  Street at The Grove / Farmers Market, Los Angeles. Place comes from
  the clip's own GPS tag: about 34.0725 N, 118.3598 W, horizontal
  accuracy about 12 m. The café is not named on the site. No
  endorsement by the business or anyone in the footage is implied.
- **What it is:** a smooth indoor pass along a counter, not a street
  walk. It has no route map, so the mini-map is hidden. Staff and
  customers appear in the frame and have not been asked about public
  display; check consent before any public launch.
- **Encoding:** same recipe as above (640×1136 H.264, CRF 28, 0.5 s
  keyframes, faststart, no audio, GPS/metadata stripped). File:
  `cafe-counter-walk.mp4`, 4,399,730 bytes (about 4.2 MB).

## The Grove, trolley street (added 27 November 2026)

- **Footage:** the site owner's own iPhone 15 clip, about 153 seconds
  (the whole clip), filmed 26 November 2026 along the trolley street at
  The Grove, Los Angeles. Place comes from the clip's own GPS tag: about
  34.0723 N, 118.3595 W, horizontal accuracy about 22 m, at the west end
  of The Grove next to the Original Farmers Market. The trolley tracks,
  holiday house, Apple Store, and Charlotte Tilbury storefront are
  visible in the frames, so the title uses The Grove. No endorsement by
  The Grove, its stores, or anyone in the footage is implied.
- **What it is:** a continuous walk down the trolley street. It has no
  route map, so the mini-map is hidden. People on the street appear in
  the frame and have not been asked about public display; check consent
  before any public launch.
- **Encoding:** same recipe as above (640×1136 H.264, CRF 28, 0.5 s
  keyframes, faststart, no audio, GPS/metadata stripped). File:
  `grove-trolley-walk.mp4`, 52,470,354 bytes (about 50.0 MB).

## Tom Bradley International Terminal, LAX (added 27 November 2026)

- **Footage:** the site owner's own iPhone 15 clip, filmed 26 November
  2026 at Los Angeles International Airport. Place comes from the
  clip's own GPS tag: about 33.9439 N, 118.4081 W, horizontal accuracy
  about 6 m, which falls inside the OpenStreetMap outline of Tom
  Bradley International Terminal on World Way. The opening frames also
  show the "TOM BRADLEY" lettering on the terminal. No endorsement by
  the airport, airlines, or anyone in the footage is implied.
- **Trim:** the source is about 159.5 seconds. The published walk uses
  the first 154 seconds, cutting a brief out-of-focus close pass at the
  end. The rest is one continuous walk from the curbside sign into the
  terminal hall.
- **What it is:** a walk from the curbside crosswalk through the doors
  and along the hall toward checkpoint A. It has no route map, so the
  mini-map is hidden. Travelers and staff appear in the frame and have
  not been asked about public display; check consent before any public
  launch.
- **Encoding:** same recipe as above (640×1136 H.264, CRF 28, 0.5 s
  keyframes, faststart, no audio, GPS/metadata stripped). File:
  `lax-bradley-walk.mp4`, 35,499,459 bytes (about 33.9 MB).

