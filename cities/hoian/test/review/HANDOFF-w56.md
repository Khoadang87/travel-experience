# w56 transport and load-failure corrections — unapproved

The return clip now uses an immutable public URL pinned to the existing media
backup commit. No expiring provider URL, paid host, account, credential, laptop
or live-page change is involved. The exact w54 asset is reused without encoding
or uploading another copy. The w55 route bounds and two explicit disclosed edits
remain, including the unresolved positional offsets and limited coverage.

HTTP checks against the commit-pinned raw GitHub media URL returned:

- HEAD200 with10,554,227bytes, the expected file size.
- GET Range0..1023 returned206 and Content-Range0-1023/10554227.
- The1024returned bytes exactly match the original asset prefix and MP4 ftyp box.
- Access-Control-Allow-Origin is `*`; cross-origin resource policy is cross-origin.
- FFmpeg with TLS verification decoded a frame at local5seconds from this URL.

This resolves the missing public media transport path for this candidate; it does
not verify video playback in a browser. GitHub serves application/octet-stream
with nosniff, so actual Safari/video MIME compatibility remains a required check.
The page itself is still only on the review branch, not published to main/Pages.

An attempt to install the official Chromium headless binary in the cloud failed:
the download endpoint returned a195-byte Site Unavailable HTML page instead of a
ZIP. No browser binary was installed, no browser run was performed, no alternate
network route or TLS bypass was attempted, and no visual test is claimed. Existing
Playwright alone is insufficient. Do not repeat the unavailable download unless
environment access changes. The laptop remains untouched.

Source inspection also found that media adapter creation occurred outside the
SourceSession error boundary. Two new tests reproduced uncaught allocation errors
at startup and while switching from an existing panorama. Creation now occurs
inside the guarded block; errors are returned to the player and the old selection
is preserved. The tests failed before the fix and pass after it. All16route/session
tests and player syntax checks pass. These injected-adapter checks are not Safari
resource-allocation or rendered-picture evidence.

The exact current runtime source hashes, HTTP evidence and remote-decoder result
are recorded in candidate-review-w56.json, media-transport-w56.json and
remote-decode-result.json. Delivery and phone-testing readiness remain false.
No exact-player independent review, rendered-browser/control evidence or real
iPhone Safari evidence exists. The original w42 phone failure remains unresolved
as a regression case. All-direction, midstreet return, sideways captured travel
and the broad15minutearea goal remain incomplete.

Next: obtain actual rendered-player evidence when an authorized browser/device
path is available, or continue finer real-footage junction/coverage investigation.
Do not treat successful HTTP/FFmpeg/unit checks as final approval, send this draft,
promote live, or restart the laptop/worker.
