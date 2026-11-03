# w75 bounded media tracing

Only instrumentation/version changes from w74: timing=1 records buffered ranges,seeking,networkState and latest requestVideoFrameCallback metadata. Callback traces limited to24 per input sequence during first900ms. Metadata means media presentation callback, not full projected canvas/compositor visibility or iPhone acceptance. No new warmup/seek/play/route/heading/drag/coverage/policy changes. Same return asset.41sourcechecks+syntax pass.

Exact source hashes and actual browser evidence must be recorded separately. Retained media I-frame timestamps are0,10,20,30 seconds; runtime starts5. Decode preroll is a hypothesis for counter jumps, not a proven stall cause. Do not reencode/change start based on this alone.

Priorw74firstreturnW5005→5.046057FAIL remains valid, later passes do not invalidate it. OriginalphoneFAIL, realSafari/WebGL,physicaljoins,quality,fullimmutableHLSmapping/dependencies,strictcurrentplayerreview andbroadall-direction15minute goal remain incomplete. No preview/final delivery.
