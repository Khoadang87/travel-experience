# w45 small textured surface test

Standalone page ../free-walk-w45.html; preserves the accepted w44 joystick and horizontal picture-drag behavior. Does not replace w42 video test or live w27.

Two source views (frame-005 and frame-010 of the masked sparse bridge model) are triangulated in image space from reconstructed features with >=4 observations. Reject triangles with nonpositive depth, max 3D edge >1.5 arbitrary scene units, max image edge >160 px, max/min camera-depth ratio >1.25, or tiny image area. Remaining samples: 349 and 383 triangles. JPEG textures derive from those exact source images (512x512, JPEG quality65). The scale and coordinate alignment match navigation-points-w43.json. These are approximate photo-textured fragments, not a validated surface reconstruction.

Visual QA: a CPU projection of the first mesh confirmed visible bridge fragments but LARGE HOLES. This fails the intended realistic street-area quality. A complete ground/wall model and scene collision have not been recovered. Synthetic grid and boundary remain visibly disclosed. This is supplied as a partial experiment at the user's request for a small test, not completion of the free-exploration goal. Low feature reprojection error did not establish usable coverage.

Checks: module syntax passed; CPU textured projection inspected. Browser rendering and real iPhone testing pending. Do not promote to live w27 without explicit approval. Next runtime version w46.
