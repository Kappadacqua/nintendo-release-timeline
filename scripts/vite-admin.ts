import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { readFreshness } from "./lib/freshness";
import { validateGameOverride, validateOverridesFile } from "./lib/overrides-schema";

const KEEP_BACKUPS = 30;

/**
 * Local admin panel backend (ITERATION-3 §2). `apply: "serve"`: it exists only
 * in the dev server and never reaches the production build.
 *
 *   GET  /admin                 → admin.html
 *   GET  /__admin/overrides     → data/overrides.json
 *   GET  /__admin/report        → data/fetch-report.json
 *   GET  /__admin/freshness     → when each source was last read, and each game's next check
 *   POST /__admin/games/<id>    → save one game's override (JSON body, or null to remove it),
 *                                 then run data:build and tell open pages to refresh
 */
export function adminPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: "nrt-admin",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/admin" || url === "/admin/") {
          req.url = "/admin.html";
          return next();
        }
        if (!url.startsWith("/__admin/")) return next();
        handle(server, root, req, res, url).catch((err: unknown) => send(res, 500, { error: (err as Error).message }));
      });
    },
  };
}

async function handle(server: ViteDevServer, root: string, req: IncomingMessage, res: ServerResponse, url: string) {
  const overridesPath = join(root, "data/overrides.json");
  if (req.method === "GET" && url === "/__admin/overrides") return send(res, 200, readJsonFile(overridesPath, { games: {} }));
  if (req.method === "GET" && url === "/__admin/report") return send(res, 200, readJsonFile(join(root, "data/fetch-report.json"), null));
  if (req.method === "GET" && url === "/__admin/freshness") return send(res, 200, readFreshness(root));

  const match = /^\/__admin\/games\/([^/]+)$/.exec(url);
  if (req.method === "POST" && match) {
    const id = decodeURIComponent(match[1]);
    const override = JSON.parse((await body(req)) || "null") as Record<string, unknown> | null;

    const file = readJsonFile<{ games: Record<string, unknown> }>(overridesPath, { games: {} });
    const empty = !override || Object.keys(override).filter((k) => k !== "_title").length === 0;
    if (empty) delete file.games[id];
    else {
      const errors = validateGameOverride(id, override);
      if (errors.length) return send(res, 400, { errors });
      file.games[id] = override;
    }
    const errors = validateOverridesFile(file);
    if (errors.length) return send(res, 400, { errors });

    backup(root, overridesPath);
    writeFileSync(overridesPath, `${JSON.stringify(file, null, 2)}\n`);
    const build = await runBuild(root);
    if (!build.ok) return send(res, 500, { error: "data:build failed", output: build.output });
    // Open timeline pages reload (keeping their position); the admin page refreshes its data.
    server.ws.send({ type: "custom", event: "games-updated" });
    return send(res, 200, { ok: true, removed: empty, build: build.output.trim() });
  }
  send(res, 404, { error: "unknown admin endpoint" });
}

function readJsonFile<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

/** data/backups/overrides-<timestamp>.json before every write; only the latest few are kept. */
function backup(root: string, overridesPath: string) {
  if (!existsSync(overridesPath)) return;
  const dir = join(root, "data/backups");
  mkdirSync(dir, { recursive: true });
  copyFileSync(overridesPath, join(dir, `overrides-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  const old = readdirSync(dir)
    .filter((f) => f.startsWith("overrides-"))
    .sort()
    .slice(0, -KEEP_BACKUPS);
  for (const f of old) rmSync(join(dir, f));
}

/** data:build in a child process (same code path as `npm run data:build`, no network). */
function runBuild(root: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "scripts/build-data.ts"], { cwd: root });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ ok: code === 0, output }));
  });
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
