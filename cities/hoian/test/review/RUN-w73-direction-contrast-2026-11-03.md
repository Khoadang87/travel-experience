# w73 source-heading contrast — 2026-11-03

Runtime/source lock61d436c2547b75637ab4c4763da12d878b8ce1c7cf4d5b6f7e5990115a75eac3 unchanged. No navigation gate, route bounds, media or default/live changes.

Inspected the actual player coordinate conversion against the pinned main heading table at source commit5d34cec2032a4190be4bf071dbf8c0a04825f68d. Exact raw heading bytes backed (SHA dd41cad4e1e64336981270b51b1f63e866f83fa08db723ae69ce4ca694301d76). Center-ray equation yaw=pi/2-h maps to panorama u=.5+h/(2pi), internally consistent with the source table convention. This alone does not prove travel direction.

Projected actual source pixels at three short spans: recovered main local8.2..8.6, intact bridge sample local0..0.4, exact return local5..5.4. Three forward-heading pictures each, then same positive-time source pairs viewed180 degrees opposite. All six forward screen-flow pairs have positive median right-minus-left horizontal displacement; all six opposed pairs negative. Pictures and contrast support expected forward expansion/back-view recession at these samples, without an obvious180-degree heading reversal. Do not infer full-route heading acceptance, metric translation, owner phone pose or browser rendering. Main global1066.2/1102 time labels remain inherited.

Used existing SciPy/NumPy/Pillow for upper-side Harris corners plus9x9 NCC. Two known synthetic translations yielded100/100 exact integer shifts each. This validates patch bookkeeping only, not actual3D geometry. Rotation, parallax, vegetation, moving people and repeated patterns remain limitations. No essential matrix/camera pose solved.

Full source/point-level diagnostics, hashes, two contact sheets and limitations backed on CPU branch commit696674709e54c0e4bfe9698df840ffd194119e39, test/review/evidence/direction-w73-20261103/. Eleven uploaded blobs verified against local Git hashes. Grok handoff comment6604065067. No new Grok reply at start; no verdict. Current browser/device tests not performed. No gate removal justified, original w42 phone FAIL remains unresolved.

Next feasible work: inspect distinct unchecked captured route intervals or independently assess original phone pose/junction heading; retain ambiguous windows rather than force directions. Keep source/gate stable unless an actual defect is supported. Broad all-direction15-minute scope, real iPhone Safari, strict exact-player advisor, physical joins, quality/performance and full immutable dependencies still incomplete. Delivery false; phone ready false. Laptop untouched; no paid resources, deletions or live promotion.
