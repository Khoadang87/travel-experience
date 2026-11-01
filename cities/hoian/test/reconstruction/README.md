# Bridge reconstruction feasibility checkpoint

November 1, 2026. CPU test using pycolmap 4.2.1, OpenCV headless and FFmpeg.

Input: 20 one-second-spaced views from existing R2 forward footage at 1102–1122 s. Reprojected from equirectangular to fixed perspective with FFmpeg v360: h_fov=90, v_fov=90, yaw=-3.6, pitch=0, w=800, h=800. Shared PINHOLE intrinsics fx=fy=cx=cy=400. Run reconstruct.py beside images/frame-001.jpg through frame-020.jpg in a fresh directory (features.db must not contain unrelated input).

Measured result: one sparse model, 12/20 registered frames, 1009 points, mean reprojection error 0.52254 pixels. The registered frames were 001–012; the later bridge-interior views did not join this model. Source timestamps derive from the selected HLS playlist ranges; reconstruction uses relative frame order and arbitrary scene scale.

This is a partial sparse reconstruction, NOT a textured surface, verified physical layout, complete 360 model, collision mesh or working free-exploration area. Moving people, camera stitching and limited baseline may corrupt geometry. Low reprojection error alone does not prove accurate static structure. No GPS or metric scale recovered. Visual/static-structure QA, wider-view reconstruction and surface generation remain open. No dense reconstruction or 15-minute iPhone test performed. Do not claim the user's all-direction navigation requirement is fulfilled.

Original footage reuse permission remains unverified; non-commercial testing only. No live w27 or w42 player modifications were made for this experiment. The saved checkpoint contains the cropped frames, sparse model, PLY, run log and procedure.
