import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { DATA_DIR } from "./constants";

export const PID_PATH = join(DATA_DIR, "tunr.pid");
export const LOG_PATH = join(DATA_DIR, "tunr.log");

export function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function readPid(): number | null {
  if (!existsSync(PID_PATH)) return null;
  const pid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}
