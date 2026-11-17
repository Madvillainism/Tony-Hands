// Load an ES module from a .js file without a package.json by wrapping its
// source in a data URL. Node treats bare .js as CommonJS otherwise.
import { readFile } from "node:fs/promises";

export async function loadModule(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const source = await readFile(url, "utf8");
  return import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
}
