# Sources used in this prototype

Checked 19–22 November 2026. No accounts were created and no one was contacted.

## Vendored front-end libraries

- MapLibre GL JS — BSD 3-Clause. https://github.com/maplibre/maplibre-gl-js
- three.js r187 (0.187.0) — MIT. https://github.com/mrdoob/three.js
  Confirmed by `REVISION = '187'` in vendor/three.core.js, which matches the
  official three@0.187.0 package byte-for-byte.
- three.js add-on `examples/jsm/postprocessing/Pass.js` from the same 0.187.0
  package — MIT. Vendored at vendor/three/addons/postprocessing/Pass.js because
  Spark imports `three/addons/postprocessing/Pass.js`.
- Spark (@sparkjsdev/spark 2.4.0) — MIT, World Labs Technologies, Inc.
  https://github.com/sparkjsdev/spark
  https://www.npmjs.com/package/@sparkjsdev/spark
  Local file: vendor/spark.module.js. Full licence text: vendor/spark.LICENSE.txt.
  Used by the splat place viewer in src/splat-player.js.

## Map tiles

- OpenFreeMap Liberty style, no API key: https://tiles.openfreemap.org/styles/liberty
- Quick start: https://openfreemap.org/quick_start/
- Map data © OpenStreetMap contributors (ODbL). OSM public tile servers are not used.

## Pin coordinates

English Wikipedia, MediaWiki `prop=coordinates`, 19 November 2026:

- TCL Chinese Theatre, via Grauman's Chinese Theatre: 34.10194444, -118.34097222 — https://en.wikipedia.org/wiki/Grauman%27s_Chinese_Theatre
- Dolby Theatre: 34.10277778, -118.34027778 — https://en.wikipedia.org/wiki/Dolby_Theatre
- Hollywood Roosevelt Hotel: 34.10111111, -118.34166667 — https://en.wikipedia.org/wiki/Hollywood_Roosevelt_Hotel
- El Capitan Theatre: 34.101111, -118.339722 — https://en.wikipedia.org/wiki/El_Capitan_Theatre
- Grauman's Egyptian Theatre: 34.10083333, -118.33638889 — https://en.wikipedia.org/wiki/Grauman%27s_Egyptian_Theatre
- Hollywood and Vine: 34.10166667, -118.32666667 — https://en.wikipedia.org/wiki/Hollywood_and_Vine
- Capitol Records Building: 34.103085, -118.326189 — https://en.wikipedia.org/wiki/Capitol_Records_Building

## 360 player footage (labeled stand-in)

- Wikimedia Commons, 360TR: “Anıtkabir ( Atatürk ) 360 Derece Video Panorama Gezinti”
  https://commons.wikimedia.org/wiki/File:An%C4%B1tkabir_(%20Atat%C3%BCrk%20)_360_Derece_Video_Panorama_Gezinti_-_360_Degree_Video.webm
- License: Creative Commons Attribution 3.0 Unported (CC BY 3.0)
  https://creativecommons.org/licenses/by/3.0/
- Local file: media/sample-360.mp4 (and sample-360-poster.jpg) — about 22 seconds,
  1280×682, H.264, muted excerpt of the equirectangular original, recorded at
  Anıtkabir, Ankara. This is what the 360 player serves for theatre and star
  pins, and for the creator trial preview. A lower-resolution faststart
  encode, media/sample-360-low.mp4, is preloaded and shown first, then the
  player upgrades to this file.
- The app labels this clip as a stand-in. It is not Hollywood Walk of Fame
  footage and is not creator-submitted video.

No freely licensed Hollywood Boulevard / Walk of Fame 360 video had been found
on Wikimedia Commons or Pexels as of 22 November 2026.

A 2D-to-360 demo pin that composited Pexels footage with an unlicensed YouTube
360 surround was removed. It is not served.

Earlier unlicensed YouTube test clips (Florian travels, R1's Travels) were
removed from the current tree and must not be served.

## Flat-video demo (curved screen — not true 360)

- Pexels, Dimitri Baret: “Walk of Fame in Los Angeles”
  https://www.pexels.com/video/walk-of-fame-in-los-angeles-13560787/
- License: Pexels License (free to use) https://www.pexels.com/license/
- Local file: media/walk-of-fame-flat.mp4 (and walk-of-fame-flat-poster.jpg) —
  30-second excerpt, also used by the example business pin. A lower-resolution
  faststart encode (media/walk-of-fame-flat-low.mp4) is used for a faster first frame.

## Libraries

- MapLibre GL JS (BSD), locally installed
- three.js (MIT), locally installed, for the equirectangular 360 player

## 2D → 360 AI fill-in test: wof-ai360.html

- Front (moving): Pexels, Dimitri Baret, “Walk of Fame in Los Angeles”,
  10 s excerpt (3–13 s of the 30 s local excerpt), projected into the front
  of the 360 frame. https://www.pexels.com/video/walk-of-fame-in-los-angeles-13560787/
  — Pexels License https://www.pexels.com/license/
- Surround (still): AI-generated 360 panorama from a text prompt with the free
  DiT360 Hugging Face Space (Insta360-Research/DiT360, FLUX.1-dev based),
  colour-matched and feather-blended around the real clip. Only the front moves.
- Not true 360 footage. Test page only; not linked from the map.

## 2D → 360 AI fill-in test v2, moving surround: wof-ai360-v2.html

- Front (moving): the same Pexels clip, Dimitri Baret, “Walk of Fame in Los Angeles”,
  5 s excerpt (from 3 s of the local excerpt), projected into the front of the 360 frame.
  https://www.pexels.com/video/walk-of-fame-in-los-angeles-13560787/
  — Pexels License https://www.pexels.com/license/
- Surround: the same AI-generated DiT360 panorama as v1. The sidewalk band
  (about 30° above to 50° below the horizon) was cut into 3 overlapping 140° views
  (left, behind, right); each was animated into a 5 s AI video with the free
  Wan 2.2 image-to-video Hugging Face Space (zerogpu-aoti/wan2-2-fp8da-aoti-faster,
  locked-camera prompt), then colour-matched and feather-blended back in.
  People on the sides and behind walk; sky, buildings above the band and the
  ground under your feet stay still. 4.5 s loop with a 0.5 s crossfade.
- Not true 360 footage. Test page only; not linked from the map.

## Placeholder Gaussian splat (test asset — not a real place)

- Source: `kyoto_room` in [SharedTestModels](https://github.com/raymondyfei/SharedTestModels)
  by raymondyfei, checked 23 November 2026.
- License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).
  The upstream repository LICENSE is copied to media/splat/LICENSE.txt.
- Packaged file: media/splat/kyoto-room.sog — the `0_0` SOG LOD level
  (meta.json + webp channels, 500,000 Gaussians, SOG v2 from splat-transform
  v3.0.0) stored as a single ZIP at the archive root. This is a Kyoto room
  capture used only as a technical placeholder. It is not Hollywood Walk of
  Fame, not this pin's real surroundings, and the app labels it
  “Test asset, not the real place.”

## Placeholder avatar (simple figure)

- The splat-room walker is a procedural, low-poly figure built in
  `src/splat-player.js` with three.js r187 (MIT): a 3D take on the classic
  men's restroom pictogram (ISO/AIGA-style) — an egg-shaped head on a
  natural neck, a medium tapered lathe torso, two-segment legs with small
  rounded feet, and hip-length capsule arms, built as rounded volumes.
  White MeshStandardMaterial with a brighter emissive, key/fill lights,
  and a soft screen-space glow (not a per-part outline). The figure is
  composited in a separate MSAA pass after the splat so the silhouette
  stays clean, then a blurred glow is added behind it. There is no third-party character or icon
  file. Walk and idle are a short procedural cycle (limb swing). The
  figure is a simple sign-style stand-in, about 1.7 m tall, not a real
  person at the pin.
