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

## Video walks

- The Grove, the Original Farmers Market, and a café counter on 1st Street,
  Los Angeles: private test footage. Audio is off because bystanders can be heard. Details are in
  `media/videowalk/ATTRIBUTION.md`.

## Creator-trial 360 stand-in

- Wikimedia Commons, 360TR: “Anıtkabir ( Atatürk ) 360 Derece Video Panorama Gezinti”
  https://commons.wikimedia.org/wiki/File:An%C4%B1tkabir_(%20Atat%C3%BCrk%20)_360_Derece_Video_Panorama_Gezinti_-_360_Degree_Video.webm
- License: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
- Local file: a 22-second, 1280×682, muted excerpt in `media/sample-360.mp4` (see `media/LICENSE.txt`).
- This is what the creator-trial preview plays. It is not footage from a map pin
  and not a creator upload. The app labels it as a stand-in.

## Libraries

See “Vendored front-end libraries” above. Spark and three.js remain in the
tree because the splat/360 player code is still present, even though this
preview no longer has splat or 360 map pins.
