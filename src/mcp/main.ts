/// <reference types="node" />
/**
 * Stdio entry point: `npx tsx src/mcp/main.ts --backup <path-to-amplifier-backup.json>`.
 * Node-only; nothing in the Vite app imports this folder, so the SDK never reaches the browser bundle.
 * stdout carries the MCP protocol, so diagnostics go to stderr.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseBackupText } from './backup';
import { createAmplifierMcpServer } from './server';

function backupPath(argv: string[]): string | undefined {
  const index = argv.indexOf('--backup');
  return index >= 0 ? argv[index + 1] : process.env.AMPLIFIER_BACKUP;
}

async function main() {
  if (process.argv.includes('--allow-writes')) {
    console.error('AMPlifier MCP: write tools are not available. The server only reads your backup file and never changes it.');
    process.exit(1);
  }
  const path = backupPath(process.argv.slice(2));
  if (!path) {
    console.error('AMPlifier MCP: pass --backup <file> or set AMPLIFIER_BACKUP to your own JSON backup (Settings → Data & backup → JSON backup).');
    process.exit(1);
  }
  const file = resolve(path);
  const load = () => parseBackupText(readFileSync(file, 'utf8'));
  load(); // Fail fast on a missing or invalid file.
  await createAmplifierMcpServer({ loadWorkspace: load }).connect(new StdioServerTransport());
  console.error(`AMPlifier MCP server ready (read-only) — ${file}`);
}

main().catch(error => {
  console.error(`AMPlifier MCP: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
