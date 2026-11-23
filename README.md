# Walk of Fame Globe (prototype)

A first working prototype of the travel-experience scope: a WebGL globe that zooms into a 2D street map of the Hollywood Walk of Fame, with clickable pins and a 360 player. There are no real payments, ads, emails, or accounts.

The site is marked `noindex` (`robots.txt` Disallow: / and a robots meta tag on every page). Do not merge unlicensed media to `main` — Render auto-deploys `main`.

## What it does

- Rotatable MapLibre globe using free OpenFreeMap tiles (no API key).
- Zoom, or tap **Go to Walk of Fame**, to a 2D street map fitted to the TCL Chinese Theatre / Dolby Theatre cluster (with padding for the on-screen HUD).
- Pins at TCL Chinese Theatre, Dolby Theatre, star segments along the boulevard, a flat-video demo, and an example business pin. Coordinates come from English Wikipedia (see `data/pins.json`).
- Each pin opens a 360 player with drag-to-look, an on-screen Look stick, and a Move stick: push up/down to walk forward/back, left/right to turn. The clip opens paused and only moves while you walk with the Move stick (or press Play) — when you stop, the scene stops.
- Creator form (mock): a one-week submission window with a countdown, one free 45-second watermarked trial render per creator email in this browser, and placement fees shown as $25 / $39 (figure to review).
- Business sales page: Standard / Featured pins shown as $250 / $500 (figure to review). No real payment is taken.
- Admin panel: free-to-start period of about two months with no ads, then a mock ad banner; creator revenue-share percent is a placeholder labeled to review.

## Sample 360 footage

No clearly licensed Hollywood Boulevard 360 video was found on Wikimedia Commons or Pexels. The player uses a labeled stand-in:

- Source: [Anıtkabir 360 walking video](https://commons.wikimedia.org/wiki/File:An%C4%B1tkabir_(%20Atat%C3%BCrk%20)_360_Derece_Video_Panorama_Gezinti_-_360_Degree_Video.webm) by 360TR
- License: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Local file: a 22-second, 1280×682, muted excerpt in `media/sample-360.mp4` (see `media/LICENSE.txt`)

The app never presents this clip as Walk of Fame footage or as a creator submission.

A separate flat-video demo uses a Pexels License clip of the Walk of Fame (Dimitri Baret) on a curved screen — flat footage, not true 360.

## Run locally

```bash
npm install
npm start
```

`npm start` builds a self-contained `site/` folder (HTML, JS, vendored MapLibre/three.js, and the sample 360 clip) and serves it at http://127.0.0.1:8765/.

Then open http://127.0.0.1:8765/ in a desktop browser. Phone Safari works with the same UI (touch joysticks, `playsinline` video) once the phone can reach the server.

```bash
npm test
```

runs the Playwright checks and writes screenshots to `shots/`.

Do not add paid keys, an ad network, or payments until those are approved separately. Walk of Fame trademark and FilmLA permit questions from the scope still need to be cleared before a public call for real creator footage.
