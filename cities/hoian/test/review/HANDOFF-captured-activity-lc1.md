# LC1 captured activity test

New isolated test page and controls; no original runtime changes. Recording playback is started explicitly and stays separate from camera input/release. The explicit Pause scene button pauses recording. Movement is bounded to +/-0.10 reconstruction units; no claim of metric scale or newly captured space. View drag keeps the positive horizontal mapping. No synthetic people or manually modeled scenery.

Exact upstream: Lifecast 3cecce98ab34747afe7695166944724075638dba. Media SHA256 24e71d4a349a99932ee2681cc20ebc711e6eaf6fbad4817c21ae8797215d2239; 827012 bytes, 4.2s, 126 frames. Full native decode passed. Contact frames inspected; actual human activity not yet established. inspect_ldi.py is an offline point inspection only, with visible sampling holes, not a replacement scene or adopted fallback. Upstream MIT notice is retained in imported modules; media permission clarification pending.

Camera math checks passed. Browser/WebGL/picture/controls/Safari/quality/advisor checks absent. No delivery approval. Next: actual rendered test; if WebGL unavailable record that limitation; inspect full-resolution source motion rather than calling clock changes living humans. No preview delivery until standing review gates pass.
