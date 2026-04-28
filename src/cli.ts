#!/usr/bin/env bun
/**
 * tunr — Screen context provider for Claude Code
 */

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "mcp":
    await import("./mcp-server.ts");
    break;
  case "capture":
  case "send":
    await import("./send.ts");
    break;
  case "start":
    await import("./start.ts");
    break;
  case "stop": {
    const { runStop } = await import("./commands.ts");
    await runStop(args);
    break;
  }
  case "status": {
    const { runStatus } = await import("./commands.ts");
    runStatus(args);
    break;
  }
  case "ingest":
    await import("./ingest.ts");
    break;
  case "sources": {
    const { runSources } = await import("./commands.ts");
    runSources(args);
    break;
  }
  case "channels": {
    const { runChannels } = await import("./commands.ts");
    runChannels(args);
    break;
  }
  case "deny": {
    const { runDeny } = await import("./commands.ts");
    runDeny(args);
    break;
  }
  case "log": {
    const { runLog } = await import("./commands.ts");
    await runLog(args);
    break;
  }
  case "rm": {
    const { runRm } = await import("./commands.ts");
    runRm(args);
    break;
  }
  case "config": {
    const { runConfig } = await import("./commands.ts");
    runConfig(args);
    break;
  }
  case "setup": {
    const { runSetup } = await import("./setup.ts");
    await runSetup(args);
    break;
  }
  case "doctor": {
    const { runDoctor } = await import("./doctor.ts");
    await runDoctor();
    break;
  }
  case "export": {
    const { runExport } = await import("./export.ts");
    await runExport(args);
    break;
  }
  case "import": {
    const { runImport } = await import("./import.ts");
    await runImport(args);
    break;
  }
  case "--version":
  case "-v": {
    const { VERSION } = await import("./lib/constants");
    console.log(VERSION);
    break;
  }
  default:
    console.log(`tunr — Screen context provider for Claude Code

Usage:
  tunr start [--foreground]   Start the capture engine as a daemon (or foreground for debug)
  tunr stop                   Stop the running daemon
  tunr status                 Show daemon status
  tunr log [-f|--follow]      Print recent captures (tail with --follow). Each line starts with id (s<n>=screen, a<n>=audio)
  tunr rm <id> [<id>...]      Delete captures by id (e.g. tunr rm s123 a45)
  tunr sources [list] [--json]            List live windows + assignments (TSV)
  tunr sources assign <key> <channel>     Assign a window to a channel
  tunr sources unassign <key> <channel>   Unassign
  tunr channels [list]        List channels
  tunr channels add <name>    Create channel
  tunr channels rm <name>     Delete channel
  tunr deny [list]            List deny rules
  tunr deny add [--app G] [--title G] [--url G]
  tunr deny rm <index>
  tunr config get [<key>]
  tunr config set <key> <value>   (key uses dot notation)
  tunr config unset <key>

  tunr capture                One-shot focused-window capture
  tunr ingest                 Pipe text from stdin
  tunr mcp                    Start the MCP server
  tunr setup [--audio]        Permissions / MCP registration
  tunr doctor                 Diagnostics
  tunr export / import        Move captures between machines

fzf example:
  tunr sources | fzf --bind 'enter:execute(tunr sources assign {1} Hobby)'`);
    process.exit(command ? 1 : 0);
}
