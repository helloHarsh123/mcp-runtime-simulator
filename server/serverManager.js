import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_CONFIG_PATH = path.resolve(__dirname, '../mcp.json');

let serversConfig = {};
let activeServers = {}; // { [name]: { process, client, status } }

class MCPClient {
  constructor(process, serverName) {
    this.process = process;
    this.name = serverName;
    this.requestId = 0;
    this.pendingRequests = new Map();

    const rl = readline.createInterface({ input: process.stdout });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch (e) {
        // console.log(`[${this.name}] Non-JSON Output:`, line);
      }
    });
    
    process.stderr.on('data', (d) => console.error(`[${serverName}] Error: ${d}`));
  }

  handleMessage(msg) {
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const { resolve, reject } = this.pendingRequests.get(msg.id);
      this.pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      this.pendingRequests.set(id, { resolve, reject });
      const req = { jsonrpc: '2.0', id, method, params };
      this.process.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  async initialize() {
    await this.send('initialize', { 
      protocolVersion: '2024-11-05', 
      capabilities: {}, 
      clientInfo: { name: 'mcp-simulator', version: '1.0.0' } 
    });
    this.process.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  async listTools() {
    const res = await this.send('tools/list', {});
    return (res.tools || []).map(t => ({ ...t, server: this.name }));
  }

  async callTool(toolName, args) {
    return await this.send('tools/call', { name: toolName, arguments: args });
  }
}

export function loadMCPConfig() {
  if (!fs.existsSync(MCP_CONFIG_PATH)) return {};
  try {
    const raw = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
    serversConfig = JSON.parse(raw).mcpServers || {};
    return serversConfig;
  } catch (e) { return {}; }
}

export async function spawnServer(serverName) {
  if (!serversConfig[serverName]) return { error: 'Server not found' };
  if (activeServers[serverName]) return { status: 'already_running' };

  const config = serversConfig[serverName];
  const env = Object.assign({}, process.env, config.env || {});

  try {
    const proc = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });

    const client = new MCPClient(proc, serverName);
    
    // Wait for spawn
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    try {
      await client.initialize();
      activeServers[serverName] = { process: proc, client };
      return { status: 'started', pid: proc.pid };
    } catch (e) {
      proc.kill();
      return { error: `Handshake failed: ${e.message}` };
    }
  } catch (e) { return { error: e.message }; }
}

export async function getAllTools() {
  const allTools = [];
  for (const instance of Object.values(activeServers)) {
    try {
      allTools.push(...await instance.client.listTools());
    } catch (e) {}
  }
 // console.log(allTools);
  return allTools;
}

export async function executeMCPTool(serverName, toolName, args) {
  const instance = activeServers[serverName];
  if (!instance) throw new Error(`Server ${serverName} is not running`);
  
  const result = await instance.client.callTool(toolName, args);
  return result.content ? result.content.map(c => c.text).join('\n') : JSON.stringify(result);
}

export function killServer(name) {
  if (activeServers[name]) {
    activeServers[name].process.kill();
    delete activeServers[name];
  }
}

export function getServers() { return Object.keys(serversConfig); }