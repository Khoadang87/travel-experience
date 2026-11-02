# W62 internal performance correction

ChatGPT owns this change; Grok requested to independently critique w61 junction/headings and exact rendered controls through issue1. Await acknowledgement; do not claim active response/advisor approval.

The previous CPU fallback resampled and projected a paused video every100ms. W62 reuses the already projected picture only if sourcevideo/time/quaternion/FOV/aspect/outputsize all match. Source/time/drag/resize/FOV changes redraw; pending seek preserves the prior picture and settledseek redraws. Input/control ticks still run. Source pixels, geometry, footagebounds, dragmapping, two disclosededits and defaultWebGLpath unchanged. Outputresolution/smoothness not improved or accepted by this check.

22 route/session/projection/cache checks pass; after adding pending-seek guard the affected cache test passed again; syntaxpasses. MockCanvas draw-count evidence shows100unchangedpausedrenderrequestsproduceonepresentation while source/view/time/resize/FOV/settledseekchangesredraw. This is algorithm evidence, not a realbrowser FPS/input measurement. No exactw62render/Safari/advisor/qualityapproval. Next: compare exactw62actualpicture andshortjoystick/dragresponse, both sourcechanges, then measurebeforeclaimingfaster. No draftlinkdelivery. Preservew61actualevidence asw61 only.
