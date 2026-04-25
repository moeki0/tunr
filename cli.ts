#!/usr/bin/env bun
/**
 * uitocc — Screen context provider for Claude Code
 *
 * Usage:
 *   uitocc mcp      Start the MCP server (called by Claude Code)
 *   uitocc send     Send current screen to Claude Code
 *   uitocc watch    Start the watch daemon with TUI
 */

const command = process.argv[2];

switch (command) {
  case "mcp":
    await import("./mcp-server.ts");
    break;
  case "send": {
    const { join, dirname } = await import("path");
    const sendPath = join(dirname(process.execPath), "uitocc-send");
    const result = Bun.spawnSync([sendPath], { stdout: "inherit", stderr: "inherit" });
    process.exit(result.exitCode);
  }
  case "watch":
    await import("./daemon.tsx");
    break;
  default:
    console.log(`uitocc — Screen context provider for Claude Code

Usage:
  uitocc mcp      Start the MCP server
  uitocc send     Send current screen to Claude Code
  uitocc watch    Start the watch daemon with TUI`);
    process.exit(command ? 1 : 0);
}
