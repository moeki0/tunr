#!/usr/bin/env bun
/**
 * tunr start — spawn the engine as a detached background daemon.
 * tunr start --foreground — run inline (used by the daemon child + manual debug).
 */

import { openSync, writeFileSync, unlinkSync } from "fs";
import { spawn } from "child_process";

import { startEngine } from "./lib/engine";
import { db } from "./lib/db";
import { VERSION } from "./lib/constants";
import { PID_PATH, LOG_PATH, isAlive, readPid } from "./lib/daemon";

const foreground = process.argv.includes("--foreground");

if (foreground) {
  console.log(`tunr ${VERSION} engine starting (pid ${process.pid})`);
  writeFileSync(PID_PATH, String(process.pid));
  const handle = startEngine();
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    handle.stop();
    try { unlinkSync(PID_PATH); } catch {}
    try { db.close(); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
} else {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`tunr already running (pid ${existing})`);
    process.exit(0);
  }
  if (existing) { try { unlinkSync(PID_PATH); } catch {} }

  const out = openSync(LOG_PATH, "a");
  const args = [...process.argv.slice(1), "--foreground"];
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  console.log(`tunr started (pid ${child.pid}). Logs: ${LOG_PATH}`);
  console.log(`Run \`tunr stop\` to stop, \`tunr status\` to check.`);
  process.exit(0);
}
