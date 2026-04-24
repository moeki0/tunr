#!/usr/bin/env bun
/**
 * uitocc MCP server — Provides screen observations to Claude Code
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import { existsSync, unlinkSync, readFileSync, appendFileSync } from "fs";

// --- Paths ---

const DATA_DIR = join(homedir(), "Library", "Application Support", "uitocc");
const DB_PATH = join(DATA_DIR, "context.db");
const SCREENSHOT_DIR = join(DATA_DIR, "screenshots");
const CHANNEL_EVENT_PATH = join(DATA_DIR, "channel_event.json");

// --- Database ---

function openDB(): Database | null {
  if (!existsSync(DB_PATH)) return null;
  return new Database(DB_PATH);
}

interface ActionRow {
  timestamp: string;
  type: "app_switch" | "navigation" | "content_change";
  app: string;
  window_title: string;
  description?: string;
}

interface ScreenStateRow {
  timestamp: string;
  app: string;
  window_title: string;
  visible_texts: string;
  screenshot_path?: string;
}

interface ChannelEvent {
  timestamp: string;
  app: string;
  windowTitle: string;
  cursorText?: string;
  contextTexts: string[];
}

// --- MCP Server ---

const mcp = new Server(
  { name: "uitocc", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions: [
      "uitocc events arrive as <channel source=\"uitocc\" ...>.",
      "event=user_send: User pressed shortcut to share current screen.",
      "event=auto:app_switch or auto:navigation: Automatic screen observations.",
      "Use auto_observe tool to toggle automatic observation.",
    ].join(" "),
  }
);

let autoObserve = false;
const sentKeys = new Set<string>();

// --- Tools ---

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "auto_observe",
      description: "Toggle automatic screen observation mode",
      inputSchema: {
        type: "object" as const,
        properties: {
          enabled: {
            type: "boolean",
            description: "true to enable, false to disable",
          },
        },
        required: ["enabled"],
      },
    },
    {
      name: "get_current_screen",
      description: "Get current screen state",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const db = openDB();
  if (!db) {
    return {
      content: [
        {
          type: "text" as const,
          text: "uitocc database not found. Start daemon: bun daemon.ts",
        },
      ],
    };
  }

  try {
    switch (req.params.name) {
      case "auto_observe": {
        const enabled = (req.params.arguments as any)?.enabled ?? false;
        autoObserve = enabled;
        if (enabled) {
          const row = db.query<{ id: number }, []>("SELECT MAX(id) as id FROM actions").get();
          if (row?.id) lastAutoObserveActionId = row.id;
          sentKeys.clear();
        }
        return {
          content: [
            {
              type: "text" as const,
              text: enabled ? "Auto-observe ON" : "Auto-observe OFF",
            },
          ],
        };
      }

      case "get_current_screen": {
        const row = db
          .query<ScreenStateRow, []>("SELECT * FROM screen_states ORDER BY timestamp DESC LIMIT 1")
          .get();
        if (!row) {
          return {
            content: [{ type: "text" as const, text: "No screen state recorded" }],
          };
        }
        const texts = JSON.parse(row.visible_texts);
        return {
          content: [
            {
              type: "text" as const,
              text: `**${row.app}** — "${row.window_title}"\n\n${texts.slice(0, 20).map((t: string) => `- ${t}`).join("\n")}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: "Unknown tool" }],
        };
    }
  } finally {
    db.close();
  }
});

// --- Channel Event Polling ---

let lastAutoObserveActionId = 0;

async function pollChannelEvents() {
  const db = openDB();
  if (db) {
    const row = db.query<{ id: number }, []>("SELECT MAX(id) as id FROM actions").get();
    if (row?.id) lastAutoObserveActionId = row.id;
    db.close();
  }

  while (true) {
    await Bun.sleep(1000);

    // Manual send (user_send)
    if (existsSync(CHANNEL_EVENT_PATH)) {
      try {
        const raw = readFileSync(CHANNEL_EVENT_PATH, "utf-8");
        unlinkSync(CHANNEL_EVENT_PATH);
        const event: ChannelEvent = JSON.parse(raw);

        let content = `User is looking at: **${event.app}** — "${event.windowTitle}"`;
        if (event.cursorText) {
          content += `\n\nText at cursor:\n${event.cursorText}`;
        }
        if (event.contextTexts.length > 0) {
          content += `\n\nVisible text:\n${event.contextTexts.map((t) => `- ${t}`).join("\n")}`;
        }

        // Add latest screenshot for this app
        const db = openDB();
        if (db) {
          const screen = db
            .query<{ screenshot_path: string | null }, [string]>(
              "SELECT screenshot_path FROM screen_states WHERE app = ? AND screenshot_path IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
            )
            .get(event.app);
          if (screen?.screenshot_path) {
            content += `\n\nScreenshot: ${join(SCREENSHOT_DIR, screen.screenshot_path)}`;
          }
          db.close();
        }

        await mcp.notification({
          method: "notifications/claude/channel",
          params: {
            content,
            meta: {
              source: "uitocc",
              event: "user_send",
              app: event.app,
              windowTitle: event.windowTitle,
            },
          },
        });
      } catch {
        // Skip on error
      }
    }

    // Auto-observe
    if (!autoObserve) continue;

    const db = openDB();
    if (!db) continue;

    try {
      const newActions = db
        .query<ActionRow & { id: number }, [number]>(
          "SELECT *, id FROM actions WHERE id > ? ORDER BY id ASC"
        )
        .all(lastAutoObserveActionId);

      for (const action of newActions) {
        lastAutoObserveActionId = action.id;

        // Dedup navigation/app_switch only
        if (action.type !== "content_change") {
          const normalizedTitle = action.window_title
            .replace(/^[\s✳·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⠐⠂⠈⣿⡿⣷⣯⣟⡾⢷⣾⣽⣻⢿◐◑◒◓●○◉⦿★☆\-–—*•\u2800-\u28FF]+/, "")
            .trim();
          const key = `${action.app}\0${normalizedTitle}`;
          if (sentKeys.has(key)) continue;
          sentKeys.add(key);
        }

        // Get screen state for this action
        const screen = db
          .query<ScreenStateRow, [string]>(
            "SELECT * FROM screen_states WHERE timestamp <= ? ORDER BY timestamp DESC LIMIT 1"
          )
          .get(action.timestamp);

        let content = "";
        if (action.type === "app_switch") {
          content = `📱 Switched to **${action.app}** — "${action.window_title}"`;
        } else if (action.type === "navigation") {
          content = `📄 Navigated in **${action.app}** — "${action.window_title}"`;
        } else {
          content = `✏️ Content changed in **${action.app}** — "${action.window_title}"`;
        }

        if (screen) {
          const texts: string[] = JSON.parse(screen.visible_texts);
          if (texts.length > 0) {
            content += `\n\nVisible text:\n${texts.slice(0, 30).map((t) => `- ${t}`).join("\n")}`;
          }
          if (screen.screenshot_path) {
            content += `\n\nScreenshot: ${join(SCREENSHOT_DIR, screen.screenshot_path)}`;
          }
        }

        await mcp.notification({
          method: "notifications/claude/channel",
          params: {
            content,
            meta: {
              source: "uitocc",
              event: `auto:${action.type}`,
              app: action.app,
              windowTitle: action.window_title,
            },
          },
        });
      }
    } finally {
      db.close();
    }
  }
}

// --- Main ---

await mcp.connect(new StdioServerTransport());
pollChannelEvents();
