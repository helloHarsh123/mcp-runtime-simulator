<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Configure MCP servers in [mcp.json](mcp.json) (optional) with your local or remote MCP server commands
4. Run the app:
   `npm run dev`

## Run the API Server

Start the MCP orchestrator shim:
```bash
npm run server
```

This starts an HTTP API at `http://localhost:4000` that:
- Discovers and spawns MCP servers from `mcp.json`
- Calls Gemini API to decide tool calls (if `GEMINI_API_KEY` is set)
- Executes tools (HTTP requests, shell commands, MCP server tools)
- Persists all runs to SQLite for audit/replay

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for complete API documentation.

## MCP Server Configuration

Edit `mcp.json` to add or remove MCP servers:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres", "--host", "localhost"],
      "env": { "PGUSER": "postgres" },
      "description": "PostgreSQL database",
      "transport": "stdio"
    }
  }
}
```

Then:
1. Spawn a server: `curl -X POST http://localhost:4000/runtime/spawn-server -d '{"server_name":"postgres"}'`
2. List available servers: `curl http://localhost:4000/servers`
3. Kill a server: `curl -X POST http://localhost:4000/runtime/kill-server -d '{"server_name":"postgres"}'`
