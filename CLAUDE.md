# tunr

Screen context provider for Claude Code via MCP channels.

## Dev

```bash
bun install
swiftc ax_text.swift -o tunr-ax-text -O
swiftc send.swift -o tunr-send -O
bun daemon.tsx    # tunr start — TUI daemon
```

## Architecture

- **daemon.tsx**: TUI daemon (Ink/React) — polls all windows, channel-based window grouping, records to SQLite
- **mcp-server.ts**: MCP server with subscribe/unsubscribe/list_channels + search tools, per-channel event polling
- **send.swift**: One-shot shortcut script, writes channel_event.json
- **ax_text.swift**: AX API text extractor (`--all` for all windows as JSON), AppleScript JS for Chrome web content
- **embed.swift**: NLEmbedding (macOS NaturalLanguage) で512次元センテンス埋め込みを生成

## Channels

チャンネル = ウィンドウのグルーピング単位。TUIでチャンネルを作成し、SOURCESパネルでウィンドウを手動でチャンネルに割り当て。チャンネルに割り当て済み = キャプチャ＆ブロードキャスト、未割り当て = 何もしない。Claude Codeは `subscribe(channel)` で購読。

- ウィンドウごとにチャンネルを手動割り当て（Enter で切り替え）
- 1つのウィンドウが複数チャンネルに割り当て可能
- 購読中のチャンネルのみイベント通知が発生

## MCP Tools

- `list_channels()` — available channels + subscription status
- `subscribe(channel)` — subscribe to channel notifications
- `unsubscribe(channel)` — stop receiving from channel
- `search_screen_history(query, channel?, app?, minutes?, limit?)` — search observed screen text (vector similarity via NLEmbedding, LIKE fallback)
- `recent_screens(channel?, app?, minutes?, limit?)` — recent screen states
- `recent_audio(channel?, minutes?, limit?)` — recent audio transcripts
- `search_audio(query, channel?, minutes?, limit?)` — search audio transcripts

## MCP Channel Events

- `user_send` — user pressed shortcut to share current screen
- `screen` — real-time screen content changes (subscribed channels)
- `audio` — real-time audio transcription (subscribed channels with audio enabled)

When the user references something they were looking at or listening to, or screen/audio context would help understand their request, proactively use these tools.

