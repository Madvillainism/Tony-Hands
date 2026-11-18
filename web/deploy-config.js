// Runtime asset configuration.
//
// This is a classic script (not a module) so it runs before the ES modules and
// its values are available when config.js is evaluated. Local development uses
// the relative paths below; scripts/prepare-deploy.mjs overwrites this file in
// dist/ with the public R2 URLs and production flags.

globalThis.TONY_HANDS_ASSETS ??= {
  rom: "games/thps.chd",
  bios: "games/scph5501.bin",
  autoStart: false,
  defaultMode: "gestures",
};
