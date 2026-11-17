# Game files (not in version control)

The web player loads a PlayStation disc image and a PS1 BIOS from this folder.
Both are **yours to supply**: the repository ships neither, and everything in
this directory except `README.md` and `.gitignore` is ignored by git.

```text
web/games/
├── thps.bin        # your disc image
└── scph5501.bin    # PS1 BIOS (North America)
```

## 1. Disc image

A single `.bin`, `.iso`, or `.chd` file works. If your rip is a `.cue` + `.bin`
pair, copy only the `.bin` — the player reads it directly.

```powershell
# from the repository root
Copy-Item "C:\path\to\Tony Hawk's Pro Skater (USA).bin" web\games\thps.bin
```

To avoid duplicating ~600 MB on disk, hardlink it instead (same drive only —
the file then occupies space once):

```powershell
New-Item -ItemType HardLink -Path web\games\thps.bin `
  -Target "C:\path\to\Tony Hawk's Pro Skater (USA).bin"
```

## 2. BIOS

`pcsx_rearmed` needs a real PS1 BIOS. RetroArch's `system` folder is the usual
place to find one.

| File | Region | MD5 |
|---|---|---|
| `scph5501.bin` | North America | `490f666e1afb15b7362b406ed1cea246` |
| `scph5502.bin` | Europe | `32736f17079d0b2b7024407c39bd3050` |
| `scph5500.bin` | Japan | `8dd7d5296a650fac7319bce665a6a53c` |

```powershell
Copy-Item "C:\RetroArch-Win64\system\scph5501.bin" web\games\scph5501.bin
```

## 3. Check the names

The filenames are not magic — they are declared in `web/config.js`:

```js
export const GAME = {
  rom: "games/thps.bin",
  bios: "games/scph5501.bin",
};
```

Edit those lines if you keep your files under different names.

## Do not publish this folder

The `.gitignore` here keeps the files out of git, but it does **not** protect a
deployed site. A static host serves `web/games/` like any other path, so a
public deployment would hand your disc image and BIOS to anyone who asks for
the URL. Host the player locally, or exclude `web/games/` at the host.
