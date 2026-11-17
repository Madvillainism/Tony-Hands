# Tony-Hands — Web player

**[Play it live: tony-hands.pages.dev](https://tony-hands.pages.dev)**

Play Tony Hawk's Pro Skater in the browser with **hand gestures or a keyboard**.
The page runs [EmulatorJS](https://emulatorjs.org) and feeds it the same gesture
state machines the desktop app uses via MediaPipe Hand Landmarker.

- No build step, no dependencies to install.
- Gesture controls and a keyboard toggle, matching the desktop key map.
- A separate gesture test bench at [`demo.html`](demo.html) for quick checks.

> **Public build vs local build:** the live site streams its game files from a
> public asset host and boots straight into the game with keyboard controls.
> The local setup below reads files from `web/games/` and uses a manual boot
> gate. Both use the same player code.

---

## Run it

The camera API needs a **secure context**, so `file://` will not work. Serve the
folder over localhost:

```powershell
# from the repository root
python -m http.server 8000 --directory web
```

Open <http://localhost:8000> to play, or <http://localhost:8000/demo.html> for
the gesture test bench.

Any static server works:

```powershell
npx --yes serve web          # http://localhost:3000
```

## Your files

The player needs two files in `web/games/` (both git-ignored, both yours to
supply). See [`games/README.md`](games/README.md) for exact paths and BIOS
hashes.

```text
web/games/
├── thps.bin        # your PS1 disc image
└── scph5501.bin    # PS1 BIOS (North America)
```

On first boot EmulatorJS downloads its runtime and core from
`cdn.emulatorjs.org` (~10 MB), then reads the ~600 MB disc image from localhost.

---

## Controls

Switch between **Gestures** and **Keyboard** in the Input card at any time.
Switching to gestures starts the camera; switching to keyboard stops it.

### Gestures

| Gesture | Button | Typical use |
|---|---|---|
| ✋ Open palm | Cross | Crouch and hold; make a fist to ollie |
| 👍 Thumbs up | Circle | Grab |
| ✌️ Peace sign | Triangle | Grind |
| 🤘 L shape | Square | Flip trick |
| ☝️ Point (left hand) | R2 tap | 120 ms press, 250 ms cooldown |
| ✊ Fist | Release | Drops whatever is held |

The **left hand** steers using palm position: left/right/up/down zones with a
5% hysteresis band, and both axes can be active at once for diagonals. The
**right hand** performs the face-button gestures. Losing a hand releases all
inputs so nothing sticks.

### Keyboard

Same layout as the desktop app (see `src/bridge/key_mapper.py`):

| Keys | Button |
|---|---|
| Arrow keys | D-Pad |
| `Z` | Cross |
| `X` | Circle |
| `S` | Triangle |
| `A` | Square |
| `Q` | L1 |
| `W` | R1 |
| `E` | R2 |
| `Enter` | Start |
| `Shift` | Select |

EmulatorJS receives real key events in keyboard mode; the chips are a readout.
The in-page **Trick sheet** dialog repeats both tables.

---

## Gesture test bench

Open [`demo.html`](demo.html) to check detection without booting a game. It
uses the same detector, zones, and state machines, draws the full skeleton
overlay, and lights chips for the inputs a game would receive. Press
**Start camera** there; the play page starts the camera automatically when you
choose Gestures mode and the game is running.

| Overlay element | Meaning |
|---|---|
| Yellow vertical line | Left / right hand split |
| Solid grey lines | `left_max`, `right_min`, `up_max`, `down_min` |
| Dotted grey lines | Hysteresis exits |
| Orange skeleton | Hand tracked as **left** |
| Cyan skeleton | Hand tracked as **right** |
| `fps · hands` | Inference rate and tracked hand count |

---

## How it works

```text
web/
├── index.html          # play page (homepage): console, input toggle, trick sheet
├── demo.html           # gesture test bench
├── play.js             # play-page controller: files, boot, mode switch, chips
├── demo.js             # test-bench controller
├── emulator.js         # EmulatorJS bootstrap and file probes
├── gesture-engine.js   # camera, MediaPipe, inference loop, event routing
├── gestures.js         # port of the Python classifiers + state machines
├── overlay.js          # shared canvas drawing
├── bridge.js           # gesture actions → RetroPad indices; releaseAll()
├── config.js           # all tunables and the keyboard map
├── styles.css          # skate-zine design system
└── fonts/              # bundled Anton (OFL)
```

Tuning lives in [`config.js`](config.js): `ZONES` mirrors `[movement]` in
`config.toml`, and `TRACKING.play` sets the in-game camera budget to 320×240 at
20 fps. Change values there, not in the pipeline. `DESKTOP_CONTROLS` mirrors
`src/bridge/key_mapper.py`.

### Differences from the desktop app

- **Emulation runs in the tab.** Gestures become RetroPad inputs via
  `gameManager.simulateInput()`; no keys are injected into other windows.
- **Camera starts on game start**, so the permission prompt never covers the
  boot screen. During play the camera runs small and slow to leave the CPU to
  the emulator.
- **Losing a hand releases everything**, including movement. The desktop bridge
  leaves the last D-Pad direction held.
- **Millisecond cooldowns** match `release_cooldown_ms` and `r2_cooldown_ms`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Game files missing" | Copy your `.bin` and BIOS into `web/games/`; see `games/README.md` |
| "Camera access needs a secure context" | Use `http://localhost:8000`, not `file://` or a LAN IP over HTTP |
| Camera blocked | Allow the camera in the address bar / site settings, then reload |
| "Loading hand model…" never finishes | The CDN is blocked; check DevTools → Network |
| Black game screen | Bring the Chrome window to the front — occluded tabs throttle rAF to ~1 fps |
| Slow first boot | The ~600 MB disc image is read from localhost; later boots are faster |
| Gestures misfire | Face your palm to the camera in even light; exaggerate the shape |
| Nothing detected | Check the green status dot and that the test bench shows `fps` above 0 |

---

## Browser support

Targets **Baseline 2024**: modern evergreen browsers with `getUserMedia`,
Canvas 2D, ES modules, WebAssembly, and `showModal()`. No polyfills are
included; the page degrades to a clear error message when the camera, model, or
emulator is unavailable. Follows Google Chrome's
[Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance).

---

## Developing

The pure modules have a small Node test baseline (no dependencies):

```powershell
node --test web/tests/*.test.mjs
```

---

## Deploying to Cloudflare Pages + R2

The live site serves the player from Cloudflare Pages and the (large) game files
from a public Cloudflare R2 bucket. The bucket is required because Pages caps a
single file at 25 MiB and the disc image is ~600 MB. R2 has no egress fees and
supports CORS; consumer drives and GitHub Releases do not send the headers the
browser needs.

**Before anything is public, note the licensing:** a commercially published
ROM and BIOS are still copyrighted even if you obtained them legitimately.
Publishing them publicly is your call and your risk. The repository never
contains them.

### One-time setup

```powershell
# Authenticate this machine (opens a browser for approval) — no secrets in the repo
npx wrangler login

# Create the bucket and a public asset URL
npx wrangler r2 bucket create tony-hands-games
npx wrangler r2 bucket dev-url enable tony-hands-games
```

Set a CORS policy on the bucket using the included `scripts/cors.json`
(the `rules` wrapper is required by the current Wrangler):

```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["*"],
        "methods": ["GET", "HEAD"]
      }
    }
  ]
}
```

```powershell
npx wrangler r2 bucket cors set tony-hands-games --file scripts/cors.json
```

`HEAD` is required: the page probes the files before booting. Create an R2 S3
API token (Object Read & Write, scoped to the bucket) and put its values plus
your account ID in **user environment variables** — never in git:

```text
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
```

`R2_ACCESS_KEY_ID` must be the **32-character S3 Access Key ID**, not the
`cfat_...` Cloudflare API token. Install **AWS CLI v2** to upload: the 630 MB
disc exceeds Wrangler's 315 MB per-object limit, and AWS CLI v1 rejects R2's
long secret. The upload script checks the bucket is clean before copying.

### One-time Pages setup

```powershell
npx wrangler pages project create tony-hands --production-branch=feat/web --force
```
`--force` targets classic Pages (the new Pages-on-Workers delegation can
misdetect a framework here). Only needed once; don't pass it to `deploy`.

### Each deploy

```powershell
# from the repository root
$env:R2_PUBLIC_BASE = "https://pub-<hash>.r2.dev"   # your bucket's public URL
node scripts/prepare-deploy.mjs                      # builds dist/, no games/
powershell -File scripts/upload-assets.ps1          # uploads ROM + BIOS to R2
npx wrangler pages deploy dist --project-name=tony-hands
```

`scripts/prepare-deploy.mjs` rewrites `dist/deploy-config.js` with the R2 URLs,
`autoStart: true`, and `defaultMode: "keyboard"` so the game boots on arrival
without a camera prompt. Local `web/` is unchanged. To avoid retyping the base
URL, put `R2_PUBLIC_BASE=...` in `scripts/deploy.env` (git-ignored).

Verify the asset headers before going live:

```powershell
curl -I -H "Origin: https://tony-hands.pages.dev" "https://pub-<hash>.r2.dev/thps.bin"
```

Expect `200`, `access-control-allow-origin: *`, and
`content-length: 660815568`. Then load the site in a fresh browser profile and
confirm the game reaches the title screen with no CORS errors in DevTools.

---

## Status

- [x] Camera + MediaPipe WASM + zone overlay + input readout
- [x] Gesture test bench (`demo.html`)
- [x] Playable THPS in the browser with EmulatorJS
- [x] Gesture / keyboard toggle
- [ ] Browser as a wireless controller for desktop RetroArch (idea)
- [x] Live at [tony-hands.pages.dev](https://tony-hands.pages.dev) (Cloudflare Pages + R2 — recipe above)

---

## Credits

Emulation by [EmulatorJS](https://emulatorjs.org) (GPL-3.0); hand tracking by
[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker);
display face by [Anton](https://fonts.google.com/specimen/Anton) (OFL). An
homage to late-90s skate games — not affiliated with Activision or Neversoft,
and no game data is shipped.
