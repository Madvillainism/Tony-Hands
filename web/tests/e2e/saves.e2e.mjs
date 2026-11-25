// End-to-end tests for in-game save files.
//
// These drive the real deployed page in a throwaway Chrome profile, so they
// exercise EmulatorJS, IndexedDB and the page's flush logic exactly as a player
// would. No dependencies: Node 22's global fetch + WebSocket speak CDP.
//
//   node web/tests/e2e/saves.e2e.mjs            # fast storage suite
//   E2E_FULL=1 node web/tests/e2e/saves.e2e.mjs # also play THPS2 to a save
//   E2E_HEADED=1 ...                            # watch the browser
//
// Env:
//   E2E_SITE      base URL (default https://tony-hands.pages.dev)
//   E2E_ONLY      run only tests whose name contains this text
//   E2E_SHOTS     write emulator screenshots to this folder
//   CHROME_PATH   browser binary override

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SITE = process.env.E2E_SITE ?? "https://tony-hands.pages.dev";
const FULL = process.env.E2E_FULL === "1";
const HEADED = process.env.E2E_HEADED === "1";

const CARD_MARKER = [0xe2, 0xe2, 0x0f, 0x99];
const MARKER_OFFSET = 0x3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome/Edge found. Set CHROME_PATH.");
  return found;
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const entry = message.id && this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return new Cdp(ws);
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    const detail =
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }
  return result.result.value;
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  return { targetId, sessionId };
}

async function closePage(cdp, page) {
  await cdp.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
}

async function waitForGame(cdp, sessionId, timeoutMs = 180000) {
  await waitFor(
    () =>
      evaluate(
        cdp,
        sessionId,
        `Boolean(window.EJS_emulator?.gameManager) && document.getElementById("status-text")?.textContent === "Game running"`,
      ),
    timeoutMs,
    "the game to start",
  );
  // Let the boot savestate land and the page settle its card baseline.
  await sleep(1200);
  await waitFor(
    async () => (await cardInfo(cdp, sessionId)).exists,
    60000,
    "the memory card to appear",
  );
}

const cardInfoExpression = `(() => {
  const gameManager = window.EJS_emulator.gameManager;
  const cardPath = gameManager.getSaveFilePath();
  if (!cardPath || !gameManager.FS.analyzePath(cardPath).exists) {
    return { path: cardPath ?? null, exists: false };
  }
  const bytes = gameManager.FS.readFile(cardPath);
  const marker = Array.from(bytes.slice(${MARKER_OFFSET}, ${MARKER_OFFSET + 4}));
  let directory = null;
  for (let frame = 1; frame < 16; frame += 1) {
    const offset = 0x80 * frame;
    if (bytes[offset] === 0x53 || bytes[offset] === 0x51) {
      directory = String.fromCharCode(...bytes.slice(offset + 10, offset + 34)).replace(/\\0/g, "");
      break;
    }
  }
  return {
    path: cardPath,
    exists: true,
    length: bytes.length,
    marker,
    directory,
  };
})()`;

async function cardInfo(cdp, sessionId) {
  return evaluate(cdp, sessionId, cardInfoExpression);
}

// Write a recognisable pattern into the card and hand it to the core, so the
// tab behaves like one that just saved in game: its next flush must keep it.
async function writeMarker(cdp, sessionId, marker = CARD_MARKER) {
  return evaluate(
    cdp,
    sessionId,
    `(async () => {
      const gameManager = window.EJS_emulator.gameManager;
      const cardPath = gameManager.getSaveFilePath();
      const bytes = gameManager.FS.readFile(cardPath);
      const copy = new Uint8Array(bytes);
      copy.set([${marker.join(", ")}], ${MARKER_OFFSET});
      gameManager.FS.writeFile(cardPath, copy);
      await new Promise((resolve) => gameManager.FS.syncfs(false, resolve));
      gameManager.loadSaveFiles();
      return Array.from(gameManager.FS.readFile(cardPath).slice(${MARKER_OFFSET}, ${MARKER_OFFSET + 4}));
    })()`,
  );
}

async function flush(cdp, sessionId) {
  await evaluate(cdp, sessionId, "window.__tonyFlushSaves()");
}

async function saveAction(cdp, sessionId) {
  return evaluate(cdp, sessionId, "window.__tonySave?.action ?? null");
}

const SHOTS = process.env.E2E_SHOTS;

// Capture the emulator's own framebuffer, which is the only reliable view of
// the game in headless mode.
async function shot(cdp, sessionId, name) {
  if (!SHOTS) return;
  const base64 = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const gameManager = window.EJS_emulator.gameManager;
      gameManager.functions.screenshot();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const bytes = gameManager.FS.readFile("/screenshot.png");
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      return btoa(binary);
    })()`,
  );
  await mkdir(SHOTS, { recursive: true });
  await writeFile(path.join(SHOTS, `${name}.png`), Buffer.from(base64, "base64"));
}

async function press(cdp, sessionId, button, holdMs = 120) {
  await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const gameManager = window.EJS_emulator.gameManager;
      gameManager.simulateInput(0, ${button}, 1);
      await new Promise((resolve) => setTimeout(resolve, ${holdMs}));
      gameManager.simulateInput(0, ${button}, 0);
      await new Promise((resolve) => setTimeout(resolve, 90));
      return gameManager.getFrameNum();
    })()`,
  );
}

// Wait in emulated frames rather than wall time, so a slow headless GPU does
// not desynchronise the menu sequence.
async function waitFrames(cdp, sessionId, frames, timeoutMs = 120000) {
  const start = await evaluate(
    cdp,
    sessionId,
    "window.EJS_emulator.gameManager.getFrameNum()",
  );
  await waitFor(
    async () =>
      (await evaluate(cdp, sessionId, "window.EJS_emulator.gameManager.getFrameNum()")) >=
      start + frames,
    timeoutMs,
    `${frames} emulated frames`,
  );
}

const ONLY = process.env.E2E_ONLY ?? "";

const results = [];
async function test(name, fn) {
  process.stdout.write(`\n• ${name}\n`);
  if (ONLY && !name.toLowerCase().includes(ONLY.toLowerCase())) {
    console.log("  SKIP (filtered)");
    return;
  }
  const started = Date.now();
  try {
    await fn();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    results.push({ name, ok: true });
    console.log(`  PASS (${seconds}s)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  FAIL: ${error.message}`);
  }
}

const browser = findBrowser();
const profile = await mkdtemp(path.join(tmpdir(), "tony-hands-e2e-"));
const args = [
  HEADED ? "--headless=false" : "--headless=new",
  // Port 0 lets Chrome pick a free port and write it to DevToolsActivePort, so
  // a leftover browser from an earlier run can never be attached to by mistake.
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--window-size=1280,900",
  "about:blank",
];

console.log(`Browser: ${browser}`);
console.log(`Site:    ${SITE}`);
console.log(`Profile: ${profile}`);

const child = spawn(browser, args, { stdio: "ignore" });
let cdp;
let pages = [];

try {
  const portFile = path.join(profile, "DevToolsActivePort");
  await waitFor(() => existsSync(portFile), 30000, "the DevTools endpoint");
  const [port] = (await readFile(portFile, "utf8")).split("\n");
  const version = await (
    await fetch(`http://127.0.0.1:${port.trim()}/json/version`)
  ).json();
  cdp = await connect(version.webSocketDebuggerUrl);

  await test("flush counter increments while the game runs", async () => {
    const page = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(page);
    await waitForGame(cdp, page.sessionId);
    const before = await evaluate(
      cdp,
      page.sessionId,
      `Number(localStorage.getItem("tony-hands:save-flushes") ?? 0)`,
    );
    await sleep(5000);
    const after = await evaluate(
      cdp,
      page.sessionId,
      `Number(localStorage.getItem("tony-hands:save-flushes") ?? 0)`,
    );
    assert.ok(after > before, `counter did not move (${before} -> ${after})`);
    const diagnostics = await evaluate(
      cdp,
      page.sessionId,
      "window.__tonySave?.action ?? null",
    );
    assert.ok(diagnostics, "window.__tonySave was not published");
    await closePage(cdp, page);
  });

  await test("card bytes survive a tab close and reopen", async () => {
    const first = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(first);
    await waitForGame(cdp, first.sessionId);
    const written = await writeMarker(cdp, first.sessionId);
    assert.deepEqual(written, CARD_MARKER, "marker was not written to the card");
    await flush(cdp, first.sessionId);
    await closePage(cdp, first);

    const second = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(second);
    await waitForGame(cdp, second.sessionId);
    await flush(cdp, second.sessionId);
    const info = await cardInfo(cdp, second.sessionId);
    assert.ok(info.exists, "memory card missing after reopen");
    assert.equal(info.length, 131072, "memory card is not 128 KB");
    assert.deepEqual(info.marker, CARD_MARKER, "card marker did not survive the reopen");
    await closePage(cdp, second);
  });

  await test("a second tab cannot clobber the card", async () => {
    const markerB = [0x1d, 0x1d, 0x5a, 0x5a];
    const first = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(first);
    await waitForGame(cdp, first.sessionId);
    await writeMarker(cdp, first.sessionId);
    await flush(cdp, first.sessionId);

    const second = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(second);
    await waitForGame(cdp, second.sessionId);
    await writeMarker(cdp, second.sessionId, markerB);
    await flush(cdp, second.sessionId);

    // Tab A is stale now. Its next flush must adopt B's card, not push its own.
    await flush(cdp, first.sessionId);
    const firstInfo = await cardInfo(cdp, first.sessionId);
    assert.deepEqual(firstInfo.marker, markerB, "the stale tab kept its own card");
    assert.equal(await saveAction(cdp, first.sessionId), "adopted");

    await closePage(cdp, first);
    await closePage(cdp, second);

    // And IndexedDB holds B's card, as a brand-new tab sees it.
    const third = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(third);
    await waitForGame(cdp, third.sessionId);
    await flush(cdp, third.sessionId);
    const info = await cardInfo(cdp, third.sessionId);
    assert.deepEqual(info.marker, markerB, "the persisted card was clobbered");
    await closePage(cdp, third);
  });

  await test("each game gets its own memory card", async () => {
    const page = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
    pages.push(page);
    await waitForGame(cdp, page.sessionId);
    const info = await cardInfo(cdp, page.sessionId);
    assert.match(info.path, /thps2\.srm$/);
    assert.equal(info.length, 131072);
    await closePage(cdp, page);
  });

  if (FULL) {
    await test("THPS2 in-game save survives a close and reopen", async () => {
      const page = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
      pages.push(page);
      await waitForGame(cdp, page.sessionId);

      const step = async (name, button, frames) => {
        await press(cdp, page.sessionId, button);
        await waitFrames(cdp, page.sessionId, frames);
        await shot(cdp, page.sessionId, name);
      };
      const down = async (count) => {
        for (let index = 0; index < count; index += 1) {
          await press(cdp, page.sessionId, 5);
          await waitFrames(cdp, page.sessionId, 30);
        }
      };

      try {
        // Career Mode -> New Career -> Tony Hawk -> Continue -> The Hanger ->
        // start -> pause -> End Run -> stats -> Save Career -> YES -> empty
        // slot -> END (default name "CAREER A") -> wait for the card.
        await step("01-career", 0, 320);
        await step("02-new-career", 0, 480);
        await step("03-skater", 0, 480);
        await step("04-continue", 0, 640);
        await step("05-level", 0, 800);
        await step("06-start", 0, 800);
        await step("07-pause", 3, 260);
        await down(3);
        await shot(cdp, page.sessionId, "08-end-run");
        await step("09-stats", 0, 320);
        await step("10-career-menu", 0, 320);
        await down(5);
        await shot(cdp, page.sessionId, "11-save-career");
        await step("12-save-yes", 0, 320);
        await step("13-slot", 0, 420);
        await step("14-name", 0, 420);

        // "END" accepts the default name. A single synthetic press is
        // occasionally swallowed by the menu, so confirm until the card moves.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await press(cdp, page.sessionId, 0, 180);
          await waitFrames(cdp, page.sessionId, 240);
          await shot(cdp, page.sessionId, `15-saving-${attempt}`);
          if ((await cardInfo(cdp, page.sessionId)).directory) break;
        }
        await shot(cdp, page.sessionId, "16-saved");

        await waitFor(
          async () => Boolean((await cardInfo(cdp, page.sessionId)).directory),
          45000,
          "the game to write its save to the card",
        );
      } catch (error) {
        await shot(cdp, page.sessionId, "failure");
        throw error;
      }
      const saved = await cardInfo(cdp, page.sessionId);
      assert.match(saved.directory, /^BASLUS-01066/, `unexpected save name: ${saved.directory}`);
      await closePage(cdp, page);

      const reopened = await openPage(cdp, `${SITE}/?game=thps2&e2e=${Date.now()}`);
      pages.push(reopened);
      await waitForGame(cdp, reopened.sessionId);
      const info = await cardInfo(cdp, reopened.sessionId);
      assert.match(
        info.directory ?? "",
        /^BASLUS-01066/,
        "the save was gone after reopening the tab",
      );
      await closePage(cdp, reopened);
    });
  } else {
    console.log("\n• THPS2 in-game save survives a close and reopen\n  SKIP (set E2E_FULL=1)");
  }
} finally {
  for (const page of pages) await closePage(cdp, page).catch(() => {});
  if (cdp) await cdp.send("Browser.close").catch(() => {});
  child.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — ${failed.length} failed` : ""}`,
);
if (failed.length) {
  for (const result of failed) console.log(`  FAILED: ${result.name}: ${result.error.message}`);
  process.exitCode = 1;
}
