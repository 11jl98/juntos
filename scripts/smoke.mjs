import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const port = Number(process.env.SMOKE_PORT ?? 3017);
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (d) => (logs += d));
child.stderr.on("data", (d) => (logs += d));
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try {
      const r = await fetch(origin);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(
    ready,
    "Servidor não iniciou. Execute npm run build primeiro. " + logs,
  );
  for (const path of [
    "/",
    "/manifest.webmanifest",
    "/offline.html",
    "/sw.js",
    "/icon-192.png",
    "/icon-512.png",
  ]) {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200, path);
    console.log("OK", path);
  }
  for (const path of ["/api/finance", "/api/household"])
    for (const method of path.endsWith("finance")
      ? ["GET", "POST"]
      : ["POST"]) {
      const r = await fetch(origin + path, {
        method,
        ...(method === "POST"
          ? { body: "{}", headers: { "Content-Type": "application/json" } }
          : {}),
      });
      assert.equal(r.status, 401, path + " " + method);
      assert.match(r.headers.get("cache-control") ?? "", /no-store/);
      assert.ok((await r.json()).error);
      console.log("OK", method, path, "nega acesso sem sessão");
    }
  console.log("Smoke HTTP passou.");
} finally {
  child.kill("SIGTERM");
}
