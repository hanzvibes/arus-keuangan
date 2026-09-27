import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../dist/client/", import.meta.url));
const staticRoot = fileURLToPath(new URL("../dist/client/_next/static/", import.meta.url));

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

const assets = (await filesIn(staticRoot))
  .filter(file => /\.(?:js|css)$/.test(file))
  .map(file => "/" + relative(output, file).replaceAll("\\", "/"))
  .sort();
if (!assets.length) throw new Error("No production assets found for offline PWA cache.");

const precache = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", ...assets];
const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const buildId = createHash("sha256").update(source + JSON.stringify(precache)).digest("hex").slice(0, 12);
const worker = source
  .replace('const CACHE = "arus-shell-dev";', `const CACHE = "arus-shell-${buildId}";`)
  .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(precache)};`);
if (worker === source || worker.includes("arus-shell-dev")) throw new Error("PWA cache version was not generated.");
await writeFile(new URL("../dist/client/sw.js", import.meta.url), worker);
