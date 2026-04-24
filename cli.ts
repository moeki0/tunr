#!/usr/bin/env bun
/**
 * uitocc — Screen context provider for Claude Code
 *
 * Usage:
 *   uitocc daemon   Start the screen observer daemon
 *   uitocc mcp      Start the MCP server (called by Claude Code)
 *   uitocc send     Send current screen to Claude Code
 */

const command = process.argv[2];

switch (command) {
  case "daemon":
    await import("./daemon.ts");
    break;
  case "mcp":
    await import("./mcp-server.ts");
    break;
  case "send": {
    const { join, dirname } = await import("path");
    const sendPath = join(dirname(process.execPath), "uitocc-send");
    const result = Bun.spawnSync([sendPath], { stdout: "inherit", stderr: "inherit" });
    process.exit(result.exitCode);
  }
  default:
    console.log(`uitocc — Screen context provider for Claude Code

Usage:
  uitocc daemon   Start the screen observer daemon
  uitocc mcp      Start the MCP server
  uitocc send     Send current screen to Claude Code`);
    process.exit(command ? 1 : 0);
}
