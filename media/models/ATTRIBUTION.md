# Street crowd 3D models — attribution

These models are used only in the Tesla street intersection splat preview.
They are not official Tesla assets, and they are not a capture of the map
pin's real surroundings. No endorsement by the authors is implied.

All of the files below are Creative Commons Zero 1.0 (CC0 1.0 Universal):
public domain, free for personal and commercial use, no attribution required.
The official legal text is in `CC0-1.0.txt`. Each model's catalogue entry at
tevy.dev also declares `license: CC0-1.0`. They were downloaded as plain
HTTPS GET requests, with no account and no API key, from pinned versioned
URLs (v1) so the bytes do not change.

Source: [tevy](https://tevy.dev) — “Free, browser-sized assets for three.js
and any glTF engine… Everything is CC0 1.0.” Pinned files already use
meshopt geometry compression and KTX2 (Basis Universal) textures.

## People (rigged, walk animation)

Each character has a 56-bone humanoid rig, origin on the ground between the
feet, facing +Z, and a one-second looping `walk` clip (plus idle,
look_around, and wave). LOD0, about 28,000 triangles each.

| File | Character | Clothing | Bytes | SHA-256 | Pinned source |
| --- | --- | --- | ---: | --- | --- |
| people/casual-walker.glb | Casual Walker | Young man, grey hoodie, jeans, white trainers | 1,789,516 | 60f7fec2c35fc46b848d99da4c67f43213eea6d8464aa05ac683ffacf2a576d7 | https://tevy.dev/models/casual-walker/v1/lod0.glb |
| people/dog-walker.glb | Dog Walker | Older man, waxed-look jacket, trousers, brown leather shoes, cap | 1,574,900 | 404a67373dcd4200035c04fa9a6fd53b7156ef35397acef7ef9bc2db1d0ed1d5 | https://tevy.dev/models/dog-walker/v1/lod0.glb |
| people/hiker.glb | Hiker | Woman, two-tone outdoor jacket, walking trousers, hiking boots, day pack | 1,600,832 | b9501891adfc528f7c5d33271a71b4cdb183371b30353892eb239ceb0e3d33fd | https://tevy.dev/models/hiker/v1/lod0.glb |
| people/cyclist.glb | Cyclist | Woman, cycling jersey, black bib shorts, helmet, trainers (no bicycle) | 1,518,828 | e345ba216132d32217d099b6c4bbbdb2e8370d58a1c5bee38ee107facd80ebc5 | https://tevy.dev/models/cyclist/v1/lod0.glb |
| people/road-worker.glb | Road Worker | Hi-vis vest, cargo work trousers, safety boots, hard hat | 1,637,752 | 5848e10e10f67492467ac8186e99b95f40594e33966de255ed8a83192afd1ae5 | https://tevy.dev/models/road-worker/v1/lod0.glb |

The street scene places seven walkers: the five unique models above, plus a
second Casual Walker and a second Hiker (cloned in memory, not extra files)
so clothing still varies across the sidewalks and crosswalks.

## Cars (PBR materials, separately spinning wheels)

Named moving parts include `wheel_FL`, `wheel_FR`, `wheel_RL`, and
`wheel_RR`. Materials are glTF PBR (car paint uses clearcoat; glass uses
transmission). Units are metres.

| File | Vehicle | Bytes | Triangles | SHA-256 | Pinned source |
| --- | --- | ---: | ---: | --- | --- |
| cars/hatchback.glb | Five-Door Hatchback | 696,792 | 46,170 | cda4c23764d292b6feb2e33e386da1cfdff3e2dee831eebb071d7b5c9f1f4009 | https://tevy.dev/models/hatchback/v1/lod0.glb |
| cars/suv.glb | Mid-Size SUV | 735,264 | 44,605 | f18997c19ba8220f0870456eda66c788b48db29b221113ee75fc57dc56771e41 | https://tevy.dev/models/suv/v1/lod0.glb |
| cars/estate-car.glb | Family Estate Car | 648,916 | 44,776 | 38be587aa4fdebbabefa0cf290c2ac4bae14bbf08b65940dde8baea1b27d1f9e | https://tevy.dev/models/estate-car/v1/lod0.glb |

## Size

The eight unique GLB files total 10,202,800 bytes (9.73 MiB), inside the
phone-friendly budget of about 10 MB extra. No further recompression was
applied; tevy already ships meshopt + KTX2.

The glowing “you” walker in this preview is still the procedural pictogram
in `src/splat-player.js`, not a third-party character file.
