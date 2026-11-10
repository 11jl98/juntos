import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
test("service worker ignores API and authenticated assets; offline navigation has only public fallback", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const requested: string[] = [];
  const cached: string[] = [];
  const context = {
    URL,
    self: {
      location: { origin: "https://example.test" },
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({
        addAll: async (urls: string[]) => {
          cached.push(...urls);
        },
      }),
      match: async (path: string) => {
        requested.push(path);
        return "offline fallback";
      },
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => {
      throw new Error("offline");
    },
  };
  vm.runInNewContext(await readFile("public/sw.js", "utf8"), context);
  let install: Promise<unknown> | null = null;
  handlers.install({
    waitUntil: (p: Promise<unknown>) => {
      install = p;
    },
  });
  await install;
  assert.equal(cached.includes("/"), false);
  assert.equal(
    cached.some((x) => x.startsWith("/api")),
    false,
  );
  let interception = false;
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://example.test/api/finance",
      mode: "cors",
    },
    respondWith: () => {
      interception = true;
    },
  });
  assert.equal(interception, false);
  let navigation: Promise<unknown> | null = null;
  handlers.fetch({
    request: { method: "GET", url: "https://example.test/", mode: "navigate" },
    respondWith: (p: Promise<unknown>) => {
      navigation = p;
    },
  });
  assert.equal(await navigation, "offline fallback");
  assert.deepEqual(requested, ["/offline.html"]);
});
