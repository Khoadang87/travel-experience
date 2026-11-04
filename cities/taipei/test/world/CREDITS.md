# world-ls (Longshan courtyard prototype) — credits & licenses

| Asset | File | License | Source |
|---|---|---|---|
| Animated mannequin + clips (Walk, Idle, Talking, Sitting, Interact, Kneeling, Torch idle, Spell idle) | `people.glb` (converted from glTF, mesh simplified to ~35 % with gltf-transform) | CC0 1.0 (commercial use OK, no attribution required) | Quaternius — Universal Animation Library (free tier), https://quaternius.com/packs/universalanimationlibrary.html, via mirror https://github.com/J-Ponzo/gltf-universal-animation-library. License text: `LICENSE-Quaternius-UAL-CC0.txt` |
| three.js r160 (engine, GLTFLoader, SkeletonUtils, RoomEnvironment) | loaded from jsDelivr CDN | MIT | https://github.com/mrdoob/three.js |
| Temple buildings, roofs, columns, dragon coils, incense burner, lanterns, smoke, paving/roof/lattice/beam/brick textures | generated in code (`world-ls.js`) | own work (repo) | — |

No photos of Longshan Temple are used as textures. Layout is a simplified approximation from public knowledge of the site (front hall → courtyard with bronze burner → main hall → rear hall, side corridors).

## Trip flow (trip.html, depart.html, trip/)
| Asset | License | Source |
|---|---|---|
| Boarding pass, passport stamp, airport gate, jet bridge, airplane, clouds, Taipei skyline/Taipei 101 stand-in, cabin window | own work, generated in code (`trip/trip.js`, `trip/depart.js`, `world/world-ls.js`) | — |
| `trip/peek.jpg` teaser | own render of `world-ls.html` | — |
| Temple sound, PA chime, engine sound | synthesised live with Web Audio (no recordings) | — |
| Spoken phrase / announcements | device's built-in speechSynthesis voice (nothing shipped) | — |
| three.js r160 | MIT | jsDelivr CDN |
