# {{SITE_NAME}}

A preview of an official travel site where people explore real streets filmed by travelers, then share walks they filmed themselves. The visible name is an interim placeholder until the official brand is decided (see `src/site-config.js`).

The current preview has video walks at The Grove and the Original Farmers Market in Los Angeles. Forms are front-end only. There are no real accounts, uploads, payments, ads, or emails. Success screens say “Preview: not saved.” Optional demo state stays in this browser’s localStorage only, and the UI says so.

The site is marked `noindex` (`robots.txt` Disallow: / and a robots meta tag on every page). Do not merge unlicensed media to `main` — Render auto-deploys `main`.

## Pages

- Home (`index.html`): hero globe, featured walks, how it works.
- Explore (`explore.html`): map, filters, and a list / bottom sheet.
- Walk detail (`walk.html`): player, placeholder creator handle, location, length, and explore spots.
- Sign up / Log in: front-end validation only; Google and Apple buttons are disabled and labeled coming soon.
- Share your walk (`upload.html`): multi-step preview flow; the file is never uploaded.
- My walks (`me.html`): empty and demo-session states.
- About, Guidelines, Privacy, and Terms: draft placeholders.
- The older creator submission and business sales pages redirect to Share your walk and About. `admin.html` remains an unlinked internal mock.

## What the walks do

- Rotatable MapLibre globe using free OpenFreeMap tiles (no API key).
- Explore the map to a street view fitted to The Grove and Farmers Market.
- Each walk opens in the player: hold the Move stick up to walk, and drag on the stage to look around. On a phone there is no Full screen button; Close leaves the walk.

## Run locally

```bash
npm install
npm start
```

`npm start` builds a self-contained `site/` folder (HTML, JS, vendored MapLibre/three.js, and media) and serves it at http://127.0.0.1:8765/.

Then open http://127.0.0.1:8765/ in a desktop browser. Phone Safari works with the same UI (touch stick, `playsinline` video) once the phone can reach the server.

```bash
npm test
```

runs the Playwright checks and writes screenshots to `shots/`.

Do not add paid keys, an ad network, or payments until those are approved separately. Walk of Fame trademark and FilmLA permit questions from the scope still need to be cleared before a public call for real creator footage.
