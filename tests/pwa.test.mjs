import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("PWA opens its cached shell offline, keeps API requests online-only, and preserves the shell across sign-in pages", async () => {
  const listeners = new Map();
  const stores = new Map();
  let online = true;
  let shell = '<html><meta name="arus-app-shell" content="1">Arus</html>';
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
    if (path === "/") return new Response(shell, { headers: { "content-type": "text/html" } });
    return new Response("asset", { headers: { "content-type": "text/javascript" } });
  };
  vm.runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    { self, caches, fetch, Request: LocalRequest, Response, URL });

  const installWork = [];
  listeners.get("install")({ waitUntil: promise => installWork.push(promise) });
  await Promise.all(installWork);
  assert.match(await (await caches.match("/")).text(), /arus-app-shell/);
  assert.match(await (await caches.match("/offline.html")).text(), /Arus sedang offline/);

  let intercepted;
  const navigate = async path => {
    intercepted = undefined;
    listeners.get("fetch")({ request: { method: "GET", mode: "navigate", url: "https://arus.test" + path }, respondWith: response => { intercepted = response; } });
    return intercepted;
  };
  shell = "<html>Sign in</html>";
  assert.match(await (await await navigate("/")).text(), /Sign in/);
  online = false;
  assert.match(await (await await navigate("/")).text(), /arus-app-shell/);

  intercepted = undefined;
  listeners.get("fetch")({ request: { method: "GET", mode: "cors", url: "https://arus.test/api/data" }, respondWith: response => { intercepted = response; } });
  assert.equal(intercepted, undefined);
});
