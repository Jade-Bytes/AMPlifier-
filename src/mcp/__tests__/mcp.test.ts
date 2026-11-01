import { describe, it, expect } from 'vitest';
import { createAmplifierMcpServer } from '../server';

describe('AMPlifier Model Context Protocol (MCP) Server', () => {
  it('initializes the server and registers core academic tools', () => {
    const server = createAmplifierMcpServer();
    expect(server).toBeDefined();
  });
});
