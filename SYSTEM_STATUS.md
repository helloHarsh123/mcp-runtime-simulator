# MCP Runtime Simulator - System Status

## ✅ Core Features Implemented

### 1. **Conversation Management**
- ✅ Create conversations with unique IDs (format: `conv_<timestamp>_<random>`)
- ✅ Persist conversation history to SQLite
- ✅ List all conversations with pagination
- ✅ Retrieve individual conversation with full history
- ✅ Track creation/update timestamps

**Endpoints:**
- `GET /conversations` - List all conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id` - Get conversation with full history
- `POST /conversations/:id/message` - Send message and auto-execute tools

### 2. **Auto-Execution Loop**
The message endpoint implements a intelligent loop that:
1. Takes user intent
2. Calls Gemini API (or fallback to simulated response)
3. If action is `tool_call`: executes the tool and appends result to history
4. If action is `final_output` or `pause`: breaks and returns response
5. **Max 5 iterations per message** to prevent infinite loops
6. **Persists history** after each message

**Supported Tools:**
- `http_request` - Make HTTP GET/POST/PUT/DELETE with custom headers and body
- `shell_exec` - Execute shell commands (5-second timeout)
- `search_repositories` - Placeholder for GitHub repository search

**Smart Intent Detection:**
- "time" queries → Uses `shell_exec` with `date` command
- "API" or "http" queries → Uses `http_request` with GitHub API
- "search" or "repository" queries → Uses `search_repositories` tool
- Default → Chooses first available tool

### 3. **MCP Server Management**
- ✅ Load MCP servers from `mcp.json`
- ✅ View current configuration: `GET /mcp`
- ✅ Update configuration: `PUT /mcp`
- ✅ Spawn servers: `POST /runtime/spawn-server`
- ✅ Kill servers: `POST /runtime/kill-server`
- ✅ List available servers: `GET /servers`

**Configuration Format (mcp.json):**
```json
{
  "mcpServers": {
    "everything": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"],
      "description": "Echo and time utilities",
      "transport": "stdio"
    }
  }
}
```

### 4. **Tool Execution Framework**
- ✅ Direct tool execution: `POST /runtime/execute-tool`
- ✅ HTTP requests with full response (status, headers, body)
- ✅ Shell command execution with stdout/stderr capture
- ✅ Error handling and graceful fallbacks

### 5. **Persistence Layer**
**SQLite Database (runs.db):**

**runs table:**
- Persists all API calls and tool executions
- Fields: `id`, `timestamp`, `source`, `intent`, `request`, `response`
- Used for audit trail and debugging

**conversations table:**
- Stores conversation metadata and history
- Fields: `id`, `title`, `created_at`, `updated_at`, `history`
- History is stored as JSON array of execution steps

### 6. **AI Integration**
- ✅ Google Gemini API integration (free tier)
- ✅ API key stored in `.env.local`
- ✅ Fallback to smart simulated responses if API unavailable
- ✅ Schema validation for model responses

## 🔧 Server Architecture

**Technology Stack:**
- **Runtime:** Node.js v23.11.0
- **HTTP Server:** Native Node `http` module (no Express/Fastify)
- **Database:** SQLite via `better-sqlite3` with WAL mode
- **AI:** Google Gemini API (`@google/genai`)
- **Port:** 4000

**Key Modules:**
- `server/index.js` (573 lines) - Main HTTP server with all endpoints
- `server/db.js` (105 lines) - SQLite initialization and CRUD operations
- `server/serverManager.js` (85 lines) - MCP server lifecycle management
- `mcp.json` - MCP server configuration
- `.env.local` - Environment variables (API keys)

## 📊 API Endpoints (14 Total)

### Conversation APIs
1. `GET /conversations` - List conversations
2. `POST /conversations` - Create conversation
3. `GET /conversations/:id` - Get conversation with history
4. `POST /conversations/:id/message` - Send message with auto-execution

### MCP Server APIs
5. `GET /mcp` - View MCP configuration
6. `PUT /mcp` - Update MCP configuration
7. `GET /servers` - List MCP servers
8. `POST /runtime/spawn-server` - Spawn MCP server
9. `POST /runtime/kill-server` - Kill MCP server

### Tool & Runtime APIs
10. `GET /tools` - List available tools
11. `POST /runtime/execute-tool` - Execute single tool
12. `POST /runtime/next-step` - Get next action from AI
13. `GET /runs` - List execution runs
14. `GET /runs/:id` - Get single run

## 🧪 Example Usage

### Create & Use Conversation
```bash
# 1. Create conversation
CONV_ID=$(curl -s -X POST http://localhost:4000/conversations \
  -H 'Content-Type: application/json' \
  -d '{"title":"My Chat"}' | jq -r '.id')

# 2. Send message with tools
curl -X POST "http://localhost:4000/conversations/$CONV_ID/message" \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is the current time?",
    "available_tools": [
      {"name": "shell_exec", "description": "Run shell commands"}
    ]
  }'

# 3. Retrieve conversation history
curl "http://localhost:4000/conversations/$CONV_ID"
```

### Execute Tool Directly
```bash
curl -X POST http://localhost:4000/runtime/execute-tool \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "http_request",
    "input": {
      "url": "https://api.github.com",
      "method": "GET",
      "headers": {"User-Agent": "MCP-Simulator"}
    }
  }'
```

### Spawn MCP Server
```bash
curl -X POST http://localhost:4000/runtime/spawn-server \
  -H 'Content-Type: application/json' \
  -d '{"serverName": "everything"}'
```

## 📋 Auto-Execution Loop Example

When a message is sent to `/conversations/:id/message`:

```
User Message: "What is the current time?"
  ↓
Get Gemini Decision (or simulated)
  - Action: tool_call
  - Tool: shell_exec
  - Input: { command: "date" }
  ↓
Execute Tool
  - Result: "Sun Feb 1 20:08:09 IST 2026"
  ↓
Append to History
  ↓
Get Next Decision (up to 5 iterations)
  - Action: final_output
  - Summary: "Current time is..."
  ↓
Return Conversation with Updated History
```

## ⚙️ Configuration

### Environment Variables (.env.local)
```
GEMINI_API_KEY=AIzaSyA-Cv_8-h4FKhES0HFJl0gMX2ngAl5byMs
```

### MCP Configuration (mcp.json)
```json
{
  "mcpServers": {
    "everything": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"],
      "description": "Everything server",
      "transport": "stdio"
    }
  }
}
```

## 🚀 Deployment Status

**Production Ready:** Not yet
- ✅ Core APIs functional
- ✅ SQLite persistence working
- ✅ Tool execution reliable
- ❌ Frontend not integrated
- ❌ Authentication not implemented
- ❌ Dynamic tool discovery from MCP servers
- ❌ Error logging system

## 📝 Next Steps

1. **Wire Frontend:**
   - Update React App to use conversation endpoints
   - Display conversation list and history
   - Format tool results (JSON, text, etc.)

2. **Dynamic Tool Discovery:**
   - Capture stdout from spawned MCP servers
   - Parse MCP protocol messages
   - Dynamically add tools to registry

3. **Production Hardening:**
   - Add API authentication
   - Implement comprehensive logging
   - Add error tracking
   - Set up monitoring

4. **Testing:**
   - Add unit tests for tool execution
   - Integration tests for conversation flow
   - Load testing for persistence layer

## 📞 Support

All endpoints respond with JSON and include proper error messages. Check server logs for debugging.

```bash
# View recent API calls
curl 'http://localhost:4000/runs?limit=10' | jq '.runs[-5:]'

# View conversation details
curl "http://localhost:4000/conversations/conv_1769956555705_o28mi4cha" | jq '.history | length'
```

---

**Last Updated:** February 1, 2026
**System Status:** ✅ Operational
**Conversations Created:** 3
**Total Tool Executions:** 15+
