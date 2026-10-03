// Minimal Chrome DevTools Protocol driver for the Architect's headless checks (no dependencies, Node ≥ 22).
// Usage: import { launch, sleep } from "./cdp.mjs"; const b = await launch({ dark: true }); await b.goto("http://localhost:5173/");
// b.eval(expr), b.wheel(dy), b.key(key, code, keyCode), b.click(x, y), b.size(w, h), b.shot(name, clip?) → tools/browser-check/shots/.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const OUT = new URL("./shots/", import.meta.url).pathname;
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

export async function launch({ width = 1920, height = 1080, port = 9333, dark = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "nrt-chrome-"));
  const chrome = spawn("google-chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "--hide-scrollbars", "--enable-gpu", "--ignore-gpu-blocklist",
    "--no-first-run", "about:blank",
  ], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a.preview?.properties?.map(p=>[p.name,p.value]))).join(" "));
    if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + m.params.exceptionDetails.exception?.description);
  });
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id; pending.set(i, (m) => (m.error ? j(new Error(method + ": " + m.error.message)) : r(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
  const api = {
    send, logs,
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
      return r.result.value;
    },
    async goto(url, wait = 2500) { await send("Page.navigate", { url }); await sleep(wait); },
    async shot(name, clip) {
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
      writeFileSync(OUT + name + ".png", Buffer.from(r.data, "base64")); return OUT + name + ".png";
    },
    async wheel(dy, x = width / 2, y = height / 2, mods = 0) {
      await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy, modifiers: mods });
    },
    async key(key, code = key, keyCode = 0) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
    },
    async click(x, y) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    },
    async size(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async close() { try { await send("Browser.close"); } catch {} chrome.kill(); },
  };
  return api;
}
