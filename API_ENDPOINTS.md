# MCP Orchestrator API Endpoints

## Overview
The server provides a full MCP (Model Context Protocol) orchestrator with:
- AI-powered tool selection (via Gemini API)
- Local MCP server discovery & spawning (from `mcp.json`)
- Tool execution (HTTP, shell, MCP servers)
- Run persistence and audit history
- SQLite database for persistence

---

## Quick Start

1. **List available MCP servers** (from `mcp.json`):
   ```bash
   curl http://localhost:4000/servers
   ```

2. **Spawn a server** (e.g., "everything"):
   ```bash
   curl -X POST http://localhost:4000/runtime/spawn-server \
     -d '{"server_name":"everything"}'
   ```

3. **Get available tools**:
   ```bash
   curl http://localhost:4000/tools
   ```

4. **Ask the runtime to make a decision**:
   ```bash
   curl -X POST http://localhost:4000/runtime/next-step \
     -d '{"intent":"...","tools":[...],"history":[]}'
   ```

5. **Execute a tool**:
   ```bash
   curl -X POST http://localhost:4000/runtime/execute-tool \
     -d '{"tool_name":"http_request","input":{...}}'
   ```

---

## Endpoints

### 1. **GET `/servers`**
**List MCP Servers**

Returns all MCP servers defined in `mcp.json` with their status.

**Request:**
```
GET /servers                    # All servers
GET /servers?filter=running     # Only running servers
```

**Response:**
```json
{
  "servers": [
    {
      "name": "postgres",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres", "--host", "localhost"],
      "description": "PostgreSQL database server",
      "transport": "stdio",
      "status": "stopped"
    },
    {
      "name": "everything",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"],
      "description": "Everything server (echo, time)",
      "transport": "stdio",
      "status": "running"
    }
  ]
}
```

**Status Values:**
- `stopped`: Server is not running (can be spawned)
- `running`: Server process is active

---

### 2. **POST `/runtime/spawn-server`**
**Start an MCP Server**

Spawns an MCP server process from `mcp.json` configuration.

**Request:**
```json
{
  "server_name": "everything"
}
```

**Response (on success):**
```json
{
  "status": "started",
  "name": "everything",
  "pid": 27645,
  "command": "npx",
  "args": ["@modelcontextprotocol/server-everything"]
}
```

**Response (already running):**
```json
{
  "status": "already_running",
  "name": "everything",
  "pid": 27645
}
```

**Response (on error):**
```json
{
  "error": "Server 'unknown' not found in mcp.json"
}
```

**Behavior:**
- Loads server config from `mcp.json`
- Spawns the process with specified command, args, and env vars
- Persists spawn event to DB
- Returns process ID and status

---

### 3. **POST `/runtime/kill-server`**
**Stop an MCP Server**

Terminates a running MCP server process.

**Request:**
```json
{
  "server_name": "everything"
}
```

**Response:**
```json
{
  "status": "killed",
  "name": "everything"
}
```

**Response (not running):**
```json
{
  "error": "Server 'everything' is not running"
}
```

---

### 4. **POST `/runtime/next-step`**
**Decision Making Endpoint**

Calls the AI model (or simulated fallback) to decide the next runtime step given an intent and available tools.

**Request:**
```json
{
  "intent": "Find popular Node.js repositories",
  "tools": [
    {
      "name": "http_request",
      "description": "Make HTTP requests",
      "inputSchema": {...}
    }
  ],
  "history": [
    {
      "goal": "...",
      "reasoning": "...",
      "action": {...},
      "confidence": 0.9,
      "result": {...}
    }
  ]
}
```

**Response:**
```json
{
  "goal": "Find popular Node.js repositories",
  "reasoning": "User wants to search for popular Node.js repos, which can be done via HTTP request",
  "action": {
    "type": "tool_call",
    "tool_name": "http_request",
    "input": {
      "url": "https://api.github.com/search/repositories?q=node.js+sort:stars",
      "method": "GET"
    },
    "reason": "Execute HTTP GET to GitHub API"
  },
  "confidence": 0.85
}
```

**Behavior:**
- Uses Gemini API if `GEMINI_API_KEY` is set; falls back to simulated response.
- Validates response schema (goal, reasoning, action, confidence).
- Persists to SQLite DB automatically.

---

### 5. **GET `/tools`**
**Tool Registry Discovery**

Returns all available tools (built-in + from MCP servers).

**Request:**
```
GET /tools
```

**Response:**
```json
{
  "tools": [
    {
      "name": "http_request",
      "description": "Make HTTP requests to external APIs",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE"] },
          "headers": { "type": "object" },
          "body": { "type": "object" }
        },
        "required": ["url", "method"]
      }
    },
    {
      "name": "shell_exec",
      "description": "Execute shell commands",
      "inputSchema": {...}
    }
  ]
}
```

**Supported Tools:**
- **`http_request`**: Make HTTP calls to external APIs
- **`shell_exec`**: Execute local shell commands (with 5s timeout)
- **MCP server tools**: Dynamically discovered from spawned servers

---

### 6. **POST `/runtime/execute-tool`**
**Tool Execution Endpoint**

Executes a tool and returns the result.

**Request:**
```json
{
  "tool_name": "http_request",
  "input": {
    "url": "https://api.github.com/repos/nodejs/node",
    "method": "GET"
  }
}
```

**Response:**
```json
{
  "tool_name": "http_request",
  "result": {
    "status": 200,
    "headers": {...},
    "body": {
      "id": 27193779,
      "name": "node",
      "full_name": "nodejs/node",
      "stargazers_count": 99000
    }
  }
}
```

---

### 7. **GET `/runs`**
**Fetch Persisted Runs (History)**

Retrieve all persisted execution runs with optional filtering.

**Request:**
```
GET /runs                              # All runs
GET /runs?intent=Node.js               # Filter by intent
GET /runs?limit=20&offset=10           # Pagination
GET /runs?intent=test&limit=5          # Combined
```

**Response:**
```json
{
  "runs": [
    {
      "id": 3,
      "timestamp": 1769955600000,
      "source": "simulated",
      "intent": "List all Node.js repos",
      "request": "{...}",
      "response": "{...}"
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```

---

### 8. **GET `/runs/:id`**
**Fetch a Single Run**

Retrieve details of a specific persisted run.

**Request:**
```
GET /runs/3
```

**Response:**
```json
{
  "id": 3,
  "timestamp": 1769955600000,
  "source": "simulated",
  "intent": "List all Node.js repos",
  "request": "{...}",
  "response": "{...}"
}
```

---

## MCP Configuration (mcp.json)
**Decision Making Endpoint**

Calls the AI model (or simulated fallback) to decide the next runtime step given an intent and available tools.

**Request:**
```json
{
  "intent": "Find popular Node.js repositories",
  "tools": [
    {
      "name": "http_request",
      "description": "Make HTTP requests",
      "inputSchema": {...}
    }
  ],
  "history": [
    {
      "goal": "...",
      "reasoning": "...",
      "action": {...},
      "confidence": 0.9,
      "result": {...}
    }
  ]
}
```

**Response:**
```json
{
  "goal": "Find popular Node.js repositories",
  "reasoning": "User wants to search for popular Node.js repos, which can be done via HTTP request",
  "action": {
    "type": "tool_call",
    "tool_name": "http_request",
    "input": {
      "url": "https://api.github.com/search/repositories?q=node.js+sort:stars",
      "method": "GET"
    },
    "reason": "Execute HTTP GET to GitHub API"
  },
  "confidence": 0.85
}
```

**Behavior:**
- Uses Gemini API if `GEMINI_API_KEY` is set; falls back to simulated response.
- Validates response schema (goal, reasoning, action, confidence).
- Persists to SQLite DB automatically.

---

### 2. **GET `/tools`**
**Tool Registry Discovery**

Returns all available tools that can be used in `/runtime/next-step`.

**Request:**
```
GET /tools
```

**Response:**
```json
{
  "tools": [
    {
      "name": "http_request",
      "description": "Make HTTP requests to external APIs",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE"] },
          "headers": { "type": "object" },
          "body": { "type": "object" }
        },
        "required": ["url", "method"]
      }
    },
    {
      "name": "shell_exec",
      "description": "Execute shell commands (local execution only)",
      "inputSchema": {...}
    },
    {
      "name": "search_repositories",
      "description": "Search GitHub repositories",
      "inputSchema": {...}
    }
  ]
}
```

---

### 3. **POST `/runtime/execute-tool`**
**Tool Execution Endpoint**

Executes a tool and returns the result. Called when the runtime decides to call a tool.

**Request:**
```json
{
  "tool_name": "http_request",
  "input": {
    "url": "https://api.github.com/repos/nodejs/node",
    "method": "GET"
  }
}
```

**Response:**
```json
{
  "tool_name": "http_request",
  "result": {
    "status": 200,
    "headers": {...},
    "body": {
      "id": 27193779,
      "name": "node",
      "full_name": "nodejs/node",
      "stargazers_count": 99000,
      ...
    }
  }
}
```

**Supported Tools:**
- **`http_request`**: Make HTTP calls to external APIs (GET, POST, PUT, DELETE)
- **`shell_exec`**: Execute local shell commands (with 5s timeout)
- **`search_repositories`**: Placeholder for GitHub MCP integration (future)

---

### 4. **GET `/runs`**
**Fetch Persisted Runs (History)**

Retrieve all persisted execution runs with optional filtering.

**Request (with filtering):**
```
GET /runs                              # All runs
GET /runs?intent=Node.js               # Filter by intent
GET /runs?limit=20&offset=10           # Pagination
GET /runs?intent=test&limit=5          # Combined
```

**Response:**
```json
{
  "runs": [
    {
      "id": 3,
      "timestamp": 1769955600000,
      "source": "simulated",
      "intent": "List all Node.js repos",
      "request": "{\"intent\":\"...\",\"tools\":[...],\"history\":[]}",
      "response": "{\"goal\":\"...\",\"reasoning\":\"...\",\"action\":{...},\"confidence\":0.9}"
    },
    {
      "id": 2,
      "timestamp": 1769955550000,
      "source": "tool_execution",
      "tool_name": "http_request",
      "input": "{...}",
      "result": "{...}"
    },
    {
      "id": 1,
      "timestamp": 1769955488349,
      "source": "simulated",
      "intent": "Test persistence",
      "request": "{...}",
      "response": "{...}"
    }
  ],
  "count": 3,
  "offset": 0,
  "limit": 50
}
```

**Query Parameters:**
- `intent` (optional): Filter runs by intent substring (case-insensitive)
- `limit` (optional, default 50, max 500): Max results per page
- `offset` (optional, default 0): Pagination offset

---

### 5. **GET `/runs/:id`**
**Fetch a Single Run**

Retrieve details of a specific persisted run for replay or audit.

**Request:**
```
GET /runs/3
```

**Response:**
```json
{
  "id": 3,
  "timestamp": 1769955600000,
  "source": "simulated",
  "intent": "List all Node.js repos",
  "request": "{\"intent\":\"List all Node.js repos\",\"tools\":[{\"name\":\"http_request\"}],\"history\":[]}",
  "response": "{\"goal\":\"List all Node.js repos\",\"reasoning\":\"Simulated server-side runtime decision\",\"action\":{\"type\":\"tool_call\",\"tool_name\":\"http_request\",\"input\":{},\"reason\":\"Simulated: choose first available tool\"},\"confidence\":0.9}"
}
```

---

## User Experience Flow (Complete Example)

1. **Discover available tools:**
   ```bash
   curl http://localhost:4000/tools
   ```

2. **Request a decision from the runtime:**
   ```bash
   curl -X POST http://localhost:4000/runtime/next-step \
     -H 'Content-Type: application/json' \
     -d '{
       "intent": "Find popular Node.js repos",
       "tools": [...],
       "history": []
     }'
   ```
   → Returns: `{ goal, reasoning, action, confidence }`

3. **If action is `tool_call`, execute the tool:**
   ```bash
   curl -X POST http://localhost:4000/runtime/execute-tool \
     -H 'Content-Type: application/json' \
     -d '{
       "tool_name": "http_request",
       "input": { "url": "...", "method": "GET" }
     }'
   ```
   → Returns: `{ tool_name, result }`

4. **Loop: Append result to history and request next step**
   ```bash
   curl -X POST http://localhost:4000/runtime/next-step \
     -H 'Content-Type: application/json' \
     -d '{
       "intent": "...",
       "tools": [...],
       "history": [
         { "goal": "...", "action": {...}, "result": {...} }
       ]
     }'
   ```

5. **When action is `final_output` or `pause`, stop.**

6. **Later: Audit by fetching persisted runs:**
   ```bash
   curl http://localhost:4000/runs?intent=Node.js
   curl http://localhost:4000/runs/3
   ```

---

## Configuration

**Environment Variables:**
- `GEMINI_API_KEY`: Your Gemini API key (from `.env.local`). If set, enables real AI decisions; otherwise uses simulated fallback.
- `PORT`: Server port (default 4000)

**Files:**
- `.env.local`: Contains `GEMINI_API_KEY`
- `server/runs.db`: SQLite database with persisted runs

---

## Error Responses

All errors return a standard JSON response:
```json
{
  "error": "Description of what went wrong"
}
```

**Common Errors:**
- `400 Missing tool_name`: Tool name not provided to `/runtime/execute-tool`
- `404 Not found`: Endpoint doesn't exist or run ID not found
- `500`: Internal server error

---

## Notes

- **Persistence**: All `/runtime/next-step` and `/runtime/execute-tool` calls are automatically persisted to SQLite.
- **Gemini Integration**: Requires `GEMINI_API_KEY` in `.env.local`. Falls back to simulated responses if not available or if API calls fail.
- **Tool Execution**: Supports HTTP requests, shell commands, and MCP server tools.
- **Limits**: `/runs` max limit is 500, default 50.
- **Local Execution**: All MCP servers are spawned on the machine running the API server, with full access to the local terminal.
- **mcp.json**: Define servers once, spawn them on-demand via API.
