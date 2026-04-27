import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tmpDir = mkdtempSync(join(tmpdir(), "tunr-test-"));
process.env.TUNR_DATA_DIR = tmpDir;
process.env.TUNR_DB_PATH = join(tmpDir, "tunr.db");

const { db } = await import("./lib/db");
const { runExport } = await import("./export");
const { runImport } = await import("./import");

const seed = () => {
  db.run(`DELETE FROM screen_states`);
  db.run(`DELETE FROM audio_transcripts`);
  db.run(`DELETE FROM ingested`);
  db.run(`DELETE FROM channels`);
  db.prepare(`INSERT INTO channels (name, include_audio) VALUES (?, ?)`).run("dev", 0);
  db.prepare(
    `INSERT INTO screen_states (timestamp, pid, window_index, app, window_title, texts, channel_names, window_id, diff_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("2026-04-27T10:00:00.000Z", 100, 0, "Chrome", "Page A", JSON.stringify(["hello"]), JSON.stringify(["dev"]), 1, null);
  db.prepare(
    `INSERT INTO screen_states (timestamp, pid, window_index, app, window_title, texts, channel_names, window_id, diff_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("2026-04-28T10:00:00.000Z", 100, 0, "Chrome", "Page B", JSON.stringify(["world"]), JSON.stringify(["dev"]), 2, null);
  db.prepare(
    `INSERT INTO audio_transcripts (timestamp, audio_path, transcript, source) VALUES (?, ?, ?, ?)`
  ).run("2026-04-27T10:05:00.000Z", "/tmp/a.wav", "hi there", "system");
  db.prepare(
    `INSERT INTO ingested (timestamp, source, channel_name, text, meta) VALUES (?, ?, ?, ?, ?)`
  ).run("2026-04-27T10:10:00.000Z", "git", "dev", "commit msg", null);
};

const counts = () => ({
  screen: (db.prepare(`SELECT count(*) as c FROM screen_states`).get() as any).c,
  audio: (db.prepare(`SELECT count(*) as c FROM audio_transcripts`).get() as any).c,
  ingested: (db.prepare(`SELECT count(*) as c FROM ingested`).get() as any).c,
  channels: (db.prepare(`SELECT count(*) as c FROM channels`).get() as any).c,
});

afterAll(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("export → import round-trip", () => {
  test("preserves all rows", async () => {
    seed();
    const before = counts();
    const out = join(tmpDir, "rt.jsonl.gz");
    await runExport(["--out", out]);

    db.run(`DELETE FROM screen_states`);
    db.run(`DELETE FROM audio_transcripts`);
    db.run(`DELETE FROM ingested`);
    db.run(`DELETE FROM channels`);

    await runImport([out]);
    expect(counts()).toEqual(before);
  });

  test("re-importing the same file is idempotent", async () => {
    seed();
    const out = join(tmpDir, "idem.jsonl.gz");
    await runExport(["--out", out]);
    const before = counts();
    await runImport([out]);
    await runImport([out]);
    expect(counts()).toEqual(before);
  });

  test("--date filters to that day only", async () => {
    seed();
    const out = join(tmpDir, "day.jsonl.gz");
    await runExport(["--out", out, "--date", "2026-04-27"]);

    db.run(`DELETE FROM screen_states`);
    db.run(`DELETE FROM audio_transcripts`);
    db.run(`DELETE FROM ingested`);
    db.run(`DELETE FROM channels`);

    await runImport([out]);
    const c = counts();
    expect(c.screen).toBe(1);
    expect(c.audio).toBe(1);
    expect(c.ingested).toBe(1);
  });

  test("UNIQUE constraints reject duplicate inserts", () => {
    seed();
    const before = counts();
    db.prepare(
      `INSERT OR IGNORE INTO screen_states (timestamp, pid, window_index, app, window_title, texts, channel_names, window_id, diff_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("2026-04-27T10:00:00.000Z", 100, 0, "Chrome", "Page A", JSON.stringify(["hello"]), JSON.stringify(["dev"]), 1, null);
    db.prepare(
      `INSERT OR IGNORE INTO audio_transcripts (timestamp, audio_path, transcript, source) VALUES (?, ?, ?, ?)`
    ).run("2026-04-27T10:05:00.000Z", "/tmp/a.wav", "hi there", "system");
    db.prepare(
      `INSERT OR IGNORE INTO ingested (timestamp, source, channel_name, text, meta) VALUES (?, ?, ?, ?, ?)`
    ).run("2026-04-27T10:10:00.000Z", "git", "dev", "commit msg", null);
    expect(counts()).toEqual(before);
  });
});
