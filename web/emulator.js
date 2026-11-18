// EmulatorJS bootstrap and file availability checks.
//
// The emulator itself is loaded from the EmulatorJS CDN (stable channel). The
// disc image and BIOS are never part of the repository: they are read from
// `web/games/`, which is git-ignored, so this page only ever plays files the
// person running it already owns.

import { CORES, DEFAULT_CORE, DEPLOY, GAME, KEYBOARD_CONTROLS } from "./config.js";

const DATA_PATH = "https://cdn.emulatorjs.org/stable/data/";
const LOADER_URL = `${DATA_PATH}loader.js`;

export const RETRO_CORE = "psx";

export function resolveCore(id) {
  return (
    CORES.find((entry) => entry.id === id) ??
    CORES.find((entry) => entry.id === DEFAULT_CORE) ??
    CORES[0]
  );
}

async function head(url) {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!response.ok) return { present: false, bytes: 0, status: response.status };
    return {
      present: true,
      bytes: Number(response.headers.get("content-length") ?? 0),
      status: response.status,
    };
  } catch {
    return { present: false, bytes: 0, status: 0, unreachable: true };
  }
}

/** Probe the files the player needs before spending time on the emulator. */
export async function checkGameFiles(game = GAME) {
  const [rom, bios] = await Promise.all([
    head(game.rom),
    head(game.bios ?? GAME.bios),
  ]);
  return { rom, bios, ready: rom.present && bios.present };
}

export function getEmulator() {
  return window.EJS_emulator ?? null;
}

export function getGameManager() {
  return window.EJS_emulator?.gameManager ?? null;
}

let bootPromise = null;

/**
 * Inject EmulatorJS once. Normally the emulator shows its own start screen;
 * in the deployed build (DEPLOY.autoStart) it boots straight into the game.
 *
 * @param {object} options
 * @param {string} options.player Selector for the container element.
 * @param {string} [options.coreId] Kept for API compatibility; pcsx_rearmed is the only core.
 * @param {object} [options.controls] RetroPad table; EJS snapshots it at construction.
 * @param {(emulator: object) => void} [options.onGameStart]
 * @param {() => void} [options.onExit]
 * @returns {Promise<object>} the EJS_emulator instance
 */
export function bootEmulator({ player, game = GAME, controls = KEYBOARD_CONTROLS, onGameStart, onExit }) {
  if (bootPromise) return bootPromise;

  bootPromise = new Promise((resolve, reject) => {
    window.EJS_player = player;
    window.EJS_core = RETRO_CORE;
    window.EJS_gameUrl = game.rom;
    window.EJS_biosUrl = game.bios ?? GAME.bios;
    window.EJS_gameName = game.label ?? GAME.name;
    window.EJS_pathtodata = DATA_PATH;
    window.EJS_startOnLoaded = DEPLOY.autoStart;
    // Threads need COOP/COEP headers, which a plain static server does not
    // send. Staying single-threaded keeps `python -m http.server` working.
    window.EJS_threads = false;
    window.EJS_defaultControls = controls;
    window.EJS_volume = 0.6;
    // Pin the language. EmulatorJS asks for the bare code from the browser
    // ("es"), but the CDN only publishes region variants ("es-ES"), so the
    // 404 aborts startup before EJS_emulator exists.
    window.EJS_language = "en-US";
    // true disables auto language detection (and its localization JSON fetch).
    window.EJS_disableAutoLang = true;
    // Touch devices use our own on-screen pad, never EJS's virtual gamepad or
    // the soft keyboard. EJS focuses a tabindex=-1 div on start; suppress it.
    window.EJS_VirtualGamepadSettings = [];
    window.EJS_noAutoFocus = true;
    window.EJS_alignStartButton = "center";
    window.EJS_color = "#ff5a1f";
    window.EJS_backgroundColor = "#0b0b0d";
    // CacheLimit (not cacheConfig) is the real EJS key. Keep caching on so
    // repeat visits boot fast; a deploy override can set 0 to avoid the
    // ~600 MB IndexedDB copy on memory-constrained devices.
    window.EJS_CacheLimit = DEPLOY.cacheLimit;
    window.EJS_onExit = () => onExit?.();
    window.EJS_onGameStart = () => {
      const emulator = getEmulator();
      // Never let EJS's built-in gamepad appear over our touch controls.
      emulator?.toggleVirtualGamepad?.(false);
      onGameStart?.(emulator);
      resolve(emulator);
    };

    const script = document.createElement("script");
    script.src = LOADER_URL;
    script.async = true;
    script.addEventListener("error", () => {
      bootPromise = null;
      reject(
        new Error(
          "The emulator could not be loaded from cdn.emulatorjs.org. Check your connection, then reload.",
        ),
      );
    });
    document.head.append(script);
  });

  return bootPromise;
}
