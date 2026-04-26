import type { ChannelRow } from "./types";
import { db } from "./db";

export function getChannels(): ChannelRow[] {
  return db.prepare(`SELECT id, name, include_audio FROM channels ORDER BY id`).all() as any[];
}

export function getActiveSubscriptions(): string[] {
  // Subscriptions are now managed in-memory per MCP server session, not in DB
  return [];
}
