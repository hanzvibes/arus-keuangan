import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("PWA opens its cached shell offline, keeps API requests online-only, and preserves the shell across sign-in pages", async () => {
  const listeners = new Map();
  const stores = new Map();
  let online = true;
  let shell = '<html><meta name="arus-app-shell" content="1">Arus</html>';
  let nextAsset = "CSS versi awal";
  const key = input => new URL(typeof input === "string" ? input : input.url, "https://arus.test").pathname;
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const items = stores.get(name);
    return { put: async (input, response) => items.set(key(input), response.clone()) };
  };
  const caches = {
    open: async name => cache(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async input => {
      for (const items of stores.values()) if (items.has(key(input))) return items.get(key(input)).clone();
    },
  };
  class LocalRequest extends Request {
    constructor(input, options) { super(new URL(input, "https://arus.test"), options); }
  }
  const self = {
    location: { origin: "https://arus.test" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  const fetch = async input => {
    if (!online) throw new TypeError("offline");
    const path = key(input);
    if (path === "/offline.html") return new Response("Arus sedang offline", { headers: { "content-type": "text/html" } });
    if (path === "/app") return new Response(shell, { headers: { "content-type": "text/html" } });
    if (path === "/") return new Response("<html>Landing page</html>", { headers: { "content-type": "text/html" } });
    if (path.startsWith("/_next/")) return new Response(nextAsset, { headers: { "content-type": "text/css" } });
    return new Response("asset", { headers: { "content-type": "text/javascript" } });
  };
  vm.runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    { self, caches, fetch, Request: LocalRequest, Response, URL });

  const installWork = [];
  listeners.get("install")({ waitUntil: promise => installWork.push(promise) });
  await Promise.all(installWork);
  assert.match(await (await caches.match("/app")).text(), /arus-app-shell/);
  assert.equal(await caches.match("/"), undefined);
  assert.match(await (await caches.match("/offline.html")).text(), /Arus sedang offline/);

  let intercepted;
  const navigate = async path => {
    intercepted = undefined;
    listeners.get("fetch")({ request: { method: "GET", mode: "navigate", url: "https://arus.test" + path }, respondWith: response => { intercepted = response; } });
    return intercepted;
  };
  assert.match(await (await await navigate("/")).text(), /Landing page/);
  assert.equal(await caches.match("/"), undefined);
  shell = "<html>Sign in</html>";
  assert.match(await (await await navigate("/app")).text(), /Sign in/);
  online = false;
  assert.match(await (await await navigate("/app")).text(), /arus-app-shell/);
  assert.match(await (await await navigate("/")).text(), /Arus sedang offline/);
  assert.match(await (await await navigate("/login")).text(), /Arus sedang offline/);

  const nextCss = { method: "GET", mode: "cors", url: "https://arus.test/_next/static/chunks/app.css" };
  const loadNextCss = async () => {
    intercepted = undefined;
    listeners.get("fetch")({ request: nextCss, respondWith: response => { intercepted = response; } });
    return intercepted;
  };
  online = true;
  assert.equal(await (await loadNextCss()).text(), "CSS versi awal");
  nextAsset = "CSS versi baru";
  assert.equal(await (await loadNextCss()).text(), "CSS versi baru");
  online = false;
  assert.equal(await (await loadNextCss()).text(), "CSS versi baru");

  intercepted = undefined;
  listeners.get("fetch")({ request: { method: "GET", mode: "cors", url: "https://arus.test/api/data" }, respondWith: response => { intercepted = response; } });
  assert.equal(intercepted, undefined);
});
