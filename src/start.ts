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
  // In bun-compiled binaries argv[1] is the embedded entrypoint path
  // (e.g. /$bunfs/root/cli.ts) which the binary re-injects automatically
  // when spawned. Passing it through duplicates the slot and pushes the
  // real subcommand off argv[2]. In bun runtime mode we need to keep it.
  const compiled = process.argv[1]?.startsWith("/$bunfs/");
  const userArgs = compiled ? process.argv.slice(2) : process.argv.slice(1);
  const args = [...userArgs, "--foreground"];
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  console.log(`tunr started (pid ${child.pid}). Logs: ${LOG_PATH}`);
  console.log(`Run \`tunr stop\` to stop, \`tunr status\` to check.`);
  process.exit(0);
}
