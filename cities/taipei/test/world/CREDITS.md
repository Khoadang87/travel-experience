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

## Build w2a — realistic people + PBR environment (Nov 2026)

### People — Microsoft Rocketbox Avatar Library (MIT License)
- Source: https://github.com/microsoft/Microsoft-Rocketbox (Copyright (c) 2020 Microsoft). Full license text: `rb/LICENSE-Microsoft-Rocketbox-MIT.md`.
- Avatars used (converted FBX → glTF in Blender, textures downsized to 1024/256 px, meshopt-compressed): Female_Adult_01, 02, 04, 05, 07, 11, 13; Male_Adult_02, 03, 05, 08, 09, 11, 14; Female_Child_01; Male_Child_01 → `rb/*.glb`.
- Motion-capture clips (Rocketbox `Assets/Animations`, same MIT license), baked into `rb/anims.glb`: m/f_walk_neutral_01, m_walk_slow_01, f_walk_stroll_01, m/f_idle_neutral_01, m/f_idle_look_around_01, m/f_gestic_talk_neutral_01, m/f_gestic_listen_neutral_01, m/f_sit_chair_idle_neutral_01, m/f_crouch_idle, m_take_picture, m/f_cell_phone_textmessage.
- Bowing with incense and hands-together prayer are procedural bone offsets layered on the idle mocap (code in world-ls.js) — no free mocap for those exists in the library.

### Textures — Poly Haven (CC0)
- https://polyhaven.com/a/large_grey_tiles (courtyard paving), granite_tile (platforms/steps/plinths), lacquered_cherry_wood (normal/roughness for red lacquer columns, wood), clay_roof_tiles_02 (roofs, wall caps), red_brick (outer walls). 1k diffuse / 512 normal + ARM, in `tex/`.
### Sky / lighting — Poly Haven HDRI (CC0)
- https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky (1k .hdr) → `tex/sky_1k.hdr`, used as background and image-based lighting.

The Quaternius mannequin (`people.glb`, CC0) is no longer loaded from w2a on; it stays in the repo for the older build.

## Build s1a — semi-realistic stylized look (`world-ls2.html`, Nov 2026)
- People: the same Microsoft Rocketbox avatars and mocap (MIT, see `rb2/LICENSE-Microsoft-Rocketbox-MIT.md`), re-encoded as `rb2/*.glb` (textures 512 px WebP). They get a soft painterly ramp and a warm rim light in code (`world-ls2.js`), replacing the plastic PBR skin.
- `ph/chinese_console_table.glb` (carved offering tables): Poly Haven, CC0, https://polyhaven.com/a/chinese_console_table
- `ph/chinese_chandelier.glb` (hanging lanterns under the main-hall porch): Poly Haven, CC0, https://polyhaven.com/a/chinese_chandelier
- Both Poly Haven models use 1k glTF downsized to 512 px and meshopt-compressed.
- Golden-hour lighting, bloom, colour grade, vignette and glowing lanterns are made in code with three.js r160 post-processing (MIT).
- Not used: Quaternius Universal Base Characters (CC0, free Standard zip). The free tier has only Superhero-proportion bodies in underwear and no clothing, which doesn't suit a temple crowd. Sketchfab dragon columns, ridge dragons and burner scans were also not used, because Sketchfab downloads need a signed-in account.
