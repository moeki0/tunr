# uitocc

Screen context provider for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Captures your macOS screen via the Accessibility API and delivers what you're looking at — visible text, window titles — directly into your Claude Code session through MCP channels.

## Install

```bash
brew install moeki0/tap/uitocc
```

Grant Accessibility and Screen Recording permissions to your terminal app.

Register the MCP server and enable channels:

```bash
claude mcp add -s user uitocc -- uitocc mcp
```

```json5
// ~/.claude/settings.json
{
  "experimentalFeatures": {
    "channels": true
  }
}
```

## Usage

Run from a keyboard shortcut (e.g. via Raycast or macOS Shortcuts):

```bash
uitocc send
```

This captures:
- The frontmost app and window title
- All visible text in the focused window
- Text at the cursor position

The data is sent as a channel event to Claude Code.

## Architecture

```
┌─────────────┐    ┌─────────────┐
│ send.swift   │───▶│mcp-server.ts│───▶ Claude Code
│ (AX API)    │    │ (MCP/stdio) │
└─────────────┘    └─────────────┘
```

- **uitocc mcp** — MCP server that relays screen context as channel notifications to Claude Code
- **uitocc-send** — Captures current window text and cursor context via macOS Accessibility API
- **uitocc-ax-text** — Extracts visible text from the frontmost app (used by send)

## License

MIT
