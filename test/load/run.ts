// Load test: starts the real room with an in-memory backend in a child process, joins N bots that
// walk around, and reports what the server paid for it.
//
//   npm run load -- --bots 100 --seconds 60 --size large
//
// Needs no database. The bots and the server are separate processes so the bots' own work does
// not count against the server's CPU.
import { fork } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

// shared
import {
  mapName,
  SPACE_SIZES,
  SPACE_TEMPLATES,
  type SpaceSize,
  type SpaceTemplate,
} from "@void/shared";

import { loadCollisionGrid } from "../../server/src/services/map.service.js";
import { runBot, type BotResult } from "./bot.js";
import { DEFAULTS, type LoadOptions, type ServerMessage, type ServerStats } from "./config.js";

// What a pass means. The event loop is where a single-threaded room runs out first: a patch tick
// that cannot finish within its 50 ms slot shows up as delay here.
const MAX_LOOP_P99_MS = 50;

function parseOptions(): LoadOptions {
  const { values } = parseArgs({
    options: {
      bots: { type: "string" },
      seconds: { type: "string" },
      size: { type: "string" },
      template: { type: "string" },
      ramp: { type: "string" },
      hz: { type: "string" },
    },
  });
  const number = (value: string | undefined, fallback: number) => {
    const n = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`not a positive number: ${value}`);
    return n;
  };
  const size = (values.size ?? DEFAULTS.size) as SpaceSize;
  const template = (values.template ?? DEFAULTS.template) as SpaceTemplate;
  if (!SPACE_SIZES.includes(size)) throw new Error(`size must be one of ${SPACE_SIZES.join(", ")}`);
  if (!SPACE_TEMPLATES.includes(template)) {
    throw new Error(`template must be one of ${SPACE_TEMPLATES.join(", ")}`);
  }
  return {
    bots: Math.floor(number(values.bots, DEFAULTS.bots)),
    seconds: number(values.seconds, DEFAULTS.seconds),
    size,
    template,
    rampPerSecond: number(values.ramp, DEFAULTS.rampPerSecond),
    sendHz: number(values.hz, DEFAULTS.sendHz),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);

async function main() {
  const options = parseOptions();
  const grid = loadCollisionGrid(
    path.resolve(
      import.meta.dirname,
      "../../client/src/assets/maps",
      `${mapName(options.template, options.size)}.tmj`,
    ),
    options.size,
  );

  const server = fork(path.resolve(import.meta.dirname, "server.ts"), [], {
    execArgv: ["--import", "tsx"],
    // tsx reads the tsconfig from the working directory; the room's schema needs the server's decorator setting.
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: path.resolve(import.meta.dirname, "../../server/tsconfig.json"),
      LOAD_SIZE: options.size,
      LOAD_TEMPLATE: options.template,
      PORT: "0",
    },
  });
  const samples: ServerStats[] = [];
  const ready = new Promise<number>((resolve, reject) => {
    server.on("message", (message: ServerMessage) => {
      if (message.type === "ready") resolve(message.port);
      else samples.push(message.stats);
    });
    server.on("exit", (code) => reject(new Error(`the server exited early (${code})`)));
  });
  const port = await ready;
  const url = `ws://localhost:${port}`;
  console.log(
    `${options.bots} bots, ${options.seconds}s, ${options.template}/${options.size} map, ${options.sendHz} moves/s each`,
  );

  const stop = new AbortController();
  const bots: Promise<BotResult>[] = [];
  const started = Date.now();
  for (let i = 0; i < options.bots; i++) {
    bots.push(runBot(url, `bot-${i}`, grid, options.sendHz, stop.signal));
    await sleep(1000 / options.rampPerSecond);
  }
  const rampSeconds = (Date.now() - started) / 1000;
  // The run's length counts from when the last bot joined, so every sample is at full load.
  const fullFrom = samples.length;
  await sleep(options.seconds * 1000);
  const full = samples.slice(fullFrom);
  stop.abort();
  const results = await Promise.all(bots);
  server.kill();

  const connected = results.filter((r) => r.connected).length;
  const dropped = results.filter((r) => r.dropped).length;
  const snaps = results.reduce((sum, r) => sum + r.snaps, 0);
  const errors = [...new Set(results.map((r) => r.error).filter(Boolean))];
  const first = full[0];
  const last = full[full.length - 1];
  const seconds = Math.max(1, full.length - 1);
  const outPerClient =
    first && last ? (last.bytesOut - first.bytesOut) / seconds / options.bots : 0;
  const inPerClient = first && last ? (last.bytesIn - first.bytesIn) / seconds / options.bots : 0;
  const loopP99 = Math.max(...full.map((s) => s.loopP99Ms), 0);

  console.table({
    connected: `${connected}/${options.bots} (ramp ${rampSeconds.toFixed(0)}s)`,
    "dropped mid-run": dropped,
    "server-corrected moves": snaps,
    "server cpu (avg / peak %)": `${mean(full.map((s) => s.cpuPercent)).toFixed(0)} / ${Math.max(...full.map((s) => s.cpuPercent), 0).toFixed(0)}`,
    "event loop p99 (worst second, ms)": loopP99.toFixed(1),
    "event loop max (ms)": Math.max(...full.map((s) => s.loopMaxMs), 0).toFixed(1),
    "server memory (MB)": Math.max(...full.map((s) => s.rssMb), 0).toFixed(0),
    "sent per client (KB/s)": (outPerClient / 1024).toFixed(1),
    "received per client (KB/s)": (inPerClient / 1024).toFixed(1),
    "server out in total (MB/s)": ((outPerClient * options.bots) / 1024 / 1024).toFixed(2),
  });
  if (errors.length > 0) console.log("join errors:", errors.join("; "));

  const problems = [
    connected < options.bots && `${options.bots - connected} bots could not join`,
    dropped > 0 && `${dropped} bots were dropped`,
    loopP99 > MAX_LOOP_P99_MS &&
      `event loop p99 ${loopP99.toFixed(0)} ms is over ${MAX_LOOP_P99_MS} ms`,
  ].filter(Boolean);
  if (problems.length > 0) {
    console.log(`FAIL: ${problems.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("PASS");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
