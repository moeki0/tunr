# uitocc

Screen context provider for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Observes your macOS screen via the Accessibility API and delivers what you're looking at — visible text, window titles, app switches — directly into your Claude Code session through MCP channels.

## Requirements

- macOS (Accessibility API)
- [Bun](https://bun.sh/) v1.0+
- Claude Code with channels enabled
- Screen Recording & Accessibility permissions granted to your terminal

## Setup

```bash
git clone https://github.com/user/uitocc.git
cd uitocc
bun install
```

Build the Swift helpers:

```bash
swiftc ax_text.swift -o ax_text -O
swiftc send.swift -o send -O
```

Register the MCP server with Claude Code:

```bash
claude mcp add -s user uitocc -- bun /path/to/uitocc/mcp-server.ts
```

Enable channels in Claude Code settings (`~/.claude/settings.json`):

```json
{
  "experimentalFeatures": {
    "channels": true
  }
}
```

## Usage

### 1. Start the daemon

The daemon polls the screen every 2 seconds and records observations to a local SQLite database.

```bash
bun daemon.ts
```

### 2. Auto-observe (ambient context)

In a Claude Code session, enable automatic observation:

> "auto_observe を有効にして"

Claude Code will receive channel notifications whenever you switch apps, navigate to new pages, or scroll through content. Events are deduplicated — the same window won't fire twice.

### 3. Send current screen (shortcut)

Run the `send` binary from a keyboard shortcut (e.g. via Raycast or macOS Shortcuts):

```bash
/path/to/uitocc/send
```

This captures:
- The frontmost app and window title
- All visible text in the focused window
- Text at the cursor position

The data is sent as a high-priority channel event to Claude Code.

## Architecture

```
┌─────────────┐    ┌──────────┐    ┌─────────────┐    ┌─────────────┐
│ ax_text.swift│───▶│ daemon.ts│───▶│   SQLite    │◀───│mcp-server.ts│
│ (AX API)    │    │ (2s poll)│    │ (context.db)│    │ (MCP/stdio) │
└─────────────┘    └──────────┘    └─────────────┘    └──────┬──────┘
                                                             │
┌─────────────┐                                              │
│ send.swift  │──── channel_event.json ──────────────────────▶│
│ (shortcut)  │                                     Claude Code
└─────────────┘
```

- **daemon.ts** — Polls the screen state, detects app switches / navigations / content changes, writes to SQLite
- **mcp-server.ts** — MCP server that reads from SQLite and pushes channel notifications to Claude Code
- **ax_text.swift** — Extracts visible text from the frontmost app via macOS Accessibility API
- **send.swift** — One-shot script for keyboard shortcuts; captures current window text and cursor context

## Event types

| Event | Trigger | Dedup |
|-------|---------|-------|
| `auto:app_switch` | Frontmost app changed | By app + window title (session lifetime) |
| `auto:navigation` | Window title changed within same app | By app + window title (session lifetime) |
| `auto:content_change` | Visible text changed >30% | 10s cooldown, no title dedup |
| `user_send` | User pressed shortcut | None (always sent) |

## Data storage

All data is stored locally at `~/Library/Application Support/uitocc/`:

- `context.db` — SQLite database with `actions` and `screen_states` tables
- `screenshots/` — Window screenshots (when available)

## License

MIT
