# Hội An w47 — connected corner approximation

Entry: `test/free-walk-w47.html`. Standalone experiment; main test index/ver remain w42, live w27 untouched. Earlier versions retained. Runtime source: `test/corner-scene-w47.js`; self-contained photo crops/provenance: `test/textures-w47.json`.

This is a manually modeled, photo-textured approximate bridge corner, NOT a scan, accurate map, photoreal reconstruction, expanded footage coverage, or 15 minutes of unique streets. Geometry/layout/dimensions are design estimates. Banks and bridge form a connected small navigation area. The visible session timer lasts 15 minutes and pauses on hidden tab/about dialog. User's ultimate expanded realistic free-roam goal remains unfinished.

Implemented: camera-relative forward/backward/strafe; accepted w44 drag signs; normalized diagonals; pointer capture and independent look/move pointers; keyboard WASD/arrows; collision against houses/bridge rails; bank/water navigation restriction; approach ramps and continuous eye height; pointer cancellation/blur/visibility resets; no video seeking/reversing. No autoplay audio. Bounded scene: x ±18, z ±16 in estimated design units.

Asset crops prepared from existing source frames. Textures are low detail, baked-lit photo patches; provenance has exact source crop regions. Roof/plaster do not gain HD detail by upscaling. Five JPEGs embedded in 59 KB JSON. Public credits identify 360 Japan Tours / Henk Walks test imagery; no public-release licensing claim.

Verification: Node imports real Three.js vendor modules and builds scene; 29 approximate material batches plus 5 lantern wire lines, ~15.5K triangles. Static meshes baked by material. Collision assertions verify centerline crossing from +12 to -12, water/house/boundary rejection and ramp heights. JavaScript syntax passed. CPU-projected geometry/texture views inspected from entrance, closer entrance and canal. Forward camera pose visibly enlarges bridge; ground has continuous modeled coverage. These images are offline asset QA, NOT browser screenshots or iPhone acceptance.

Browser QA unavailable in managed cloud runtime; Sites managed preview instruction forbids installing substitute browser automation. No rendered browser, actual GPU performance, real touch or iPhone Safari acceptance claimed. User must evaluate w47; acceptance only after real iPhone Safari report. Main original 360 video test remains accessible via About.

MacBook connection confirmed online (Intel i7-8850H, 16 GB). Read-only hardware query only; no installs/settings/processes left running on laptop. Existing hourly development update automation should report honest progress, not deployment checks. No paid resources added.

Next: user visual/control feedback. If approximate scene is rejected as unrealistic, do not describe it as completed or revert to flat photos as spatial walking. Real expanded realistic coverage requires sufficient multi-view capture/usable reconstruction or accurately authored richer geometry; current sparse original-video reconstruction failed.
