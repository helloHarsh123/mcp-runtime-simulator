# Conversation System - Quick Reference

## Core Concept

The conversation system allows you to:
1. **Create** a persistent chat conversation with unique ID
2. **Send** messages that trigger automatic tool selection and execution
3. **Track** all conversation history with execution steps
4. **Continue** conversations across multiple messages

## Quick Start

### 1️⃣ Create a Conversation
```bash
curl -X POST http://localhost:4000/conversations \
  -H 'Content-Type: application/json' \
  -d '{"title": "My First Chat"}'
```

Response:
```json
{
  "id": "conv_1769956555705_o28mi4cha",
  "title": "My First Chat",
  "message": "Conversation created..."
}
```

### 2️⃣ Send a Message
```bash
curl -X POST http://localhost:4000/conversations/conv_1769956555705_o28mi4cha/message \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is the current time?",
    "available_tools": [
      {"name": "shell_exec", "description": "Execute shell commands"},
      {"name": "http_request", "description": "Make HTTP requests"}
    ]
  }'
```

The endpoint will:
- Call AI to decide what to do
- Execute tools automatically (up to 5 times)
- Add results to conversation history
- Return final summary

Response:
```json
{
  "conversation_id": "conv_1769956555705_o28mi4cha",
  "message_count": 1,
  "steps_executed": 1,
  "final_response": {
    "status": "complete",
    "summary": "The current time is: Sun Feb 1 20:08:09 IST 2026"
  },
  "history": [
    {
      "goal": "What is the current time?",
      "action": {
        "type": "tool_call",
        "tool_name": "shell_exec",
        "input": {"command": "date"}
      },
      "result": {
        "tool_name": "shell_exec",
        "result": {"stdout": "Sun Feb 1 20:08:09 IST 2026\n", "stderr": ""}
      }
    }
  ]
}
```

### 3️⃣ View Conversation History
```bash
curl http://localhost:4000/conversations/conv_1769956555705_o28mi4cha
```

Response:
```json
{
  "id": "conv_1769956555705_o28mi4cha",
  "title": "My First Chat",
  "created_at": 1769956555705,
  "updated_at": 1769956555705,
  "history": [
    {
      "goal": "What is the current time?",
      "reasoning": "Simulated server-side runtime decision",
      "action": {...},
      "confidence": 0.9,
      "timestamp": 1769956555708,
      "result": {...}
    },
    ...
  ]
}
```

### 4️⃣ List All Conversations
```bash
curl http://localhost:4000/conversations
```

Response:
```json
{
  "conversations": [
    {
      "id": "conv_1769956555705_o28mi4cha",
      "title": "My First Chat",
      "created_at": 1769956555705,
      "updated_at": 1769956555705
    },
    ...
  ]
}
```

## How Auto-Execution Works

When you send a message to `/conversations/:id/message`:

```
Step 1: User sends message with available tools
        Example: "What is the current time?"
                 Tools: [shell_exec, http_request]

Step 2: AI decides what to do
        Decision: Use shell_exec with 'date' command
                  Confidence: 0.9

Step 3: Tool executes
        Result: "Sun Feb 1 20:08:09 IST 2026"

Step 4: Result added to history
        History now has 1 step

Step 5: Check if done
        AI response: final_output → STOP
        AI response: tool_call → Repeat Step 2

Step 6: Return response with full history
        Max 5 iterations per message
```

## Smart Intent Detection

The system automatically picks the right tool based on your message:

| Intent | Tool Selected | Reasoning |
|--------|---------------|-----------|
| "What is the time?" | `shell_exec` | Keywords: time, current |
| "Check GitHub API" | `http_request` | Keywords: api, http, fetch |
| "Search repositories" | `search_repositories` | Keywords: search, repo, github |
| "Execute ls -la" | `shell_exec` | Shell command format |
| Default | First available tool | Fallback behavior |

## Available Tools

### 1. `shell_exec`
Execute shell commands on the server
```json
{
  "name": "shell_exec",
  "input": {"command": "ls -la"}
}
```

### 2. `http_request`
Make HTTP requests to any API
```json
{
  "name": "http_request",
  "input": {
    "url": "https://api.github.com",
    "method": "GET",
    "headers": {"User-Agent": "MCP-Simulator"},
    "body": {}
  }
}
```

### 3. `search_repositories`
Search GitHub repositories (placeholder)
```json
{
  "name": "search_repositories",
  "input": {"query": "nodejs", "limit": 5}
}
```

## Response Structure

Every message response includes:

| Field | Description |
|-------|-------------|
| `conversation_id` | Unique conversation ID |
| `message_count` | Number of user messages sent |
| `steps_executed` | Number of tool execution steps (max 5) |
| `final_response` | Final status and summary |
| `history` | Array of all execution steps |

Each history step includes:
- `goal` - The user's intent
- `reasoning` - Why that tool was selected
- `action` - The action taken (tool_call, final_output, pause)
- `confidence` - Confidence score (0.0-1.0)
- `timestamp` - When the step executed
- `result` - Tool execution result

## Common Use Cases

### ✅ Get Server Status
```bash
curl -X POST http://localhost:4000/conversations/CONV_ID/message \
  -d '{"message": "Check server health", "available_tools": [...]}'
```

### ✅ Fetch API Data
```bash
curl -X POST http://localhost:4000/conversations/CONV_ID/message \
  -d '{"message": "Get GitHub user data", "available_tools": [...]}'
```

### ✅ Run Commands
```bash
curl -X POST http://localhost:4000/conversations/CONV_ID/message \
  -d '{"message": "Check disk space", "available_tools": [{"name": "shell_exec"}]}'
```

### ✅ Multi-Step Workflows
The system automatically executes up to 5 sequential steps. For example:
1. User asks: "Build and deploy the app"
2. AI might execute: `npm run build` (shell_exec)
3. Then: `npm run start` (shell_exec)
4. Then: Check health endpoint (http_request)
5. Return final status

## Best Practices

1. **Provide relevant tools** - Only include tools the AI might need
2. **Clear intent** - Write specific, unambiguous messages
3. **Wait for completion** - Each message waits for all 5 steps to finish
4. **Check history** - Review past steps to understand decisions
5. **Use appropriate tools** - Match tools to the task

## Error Handling

If something fails:
- Tool execution errors are caught and logged
- Conversation continues or returns status
- Full history preserved for debugging
- Check response `final_response.status` for result

## Persistence

All data is persisted to SQLite:
- Conversations table: Metadata and history JSON
- Runs table: Individual API calls for audit trail
- Database location: `server/runs.db`
- Survives server restarts

## Troubleshooting

**Conversation not found:**
```bash
# List all conversations
curl http://localhost:4000/conversations | jq '.conversations[]'
```

**Tool not executing:**
```bash
# Check available tools
curl http://localhost:4000/tools | jq '.tools'
```

**Tool execution failed:**
```bash
# Get conversation history to see error
curl http://localhost:4000/conversations/CONV_ID | jq '.history[-1].result'
```

**Server not responding:**
```bash
# Check if server is running
ps aux | grep "node server"

# Restart server
npm run server
```

---

**For detailed API documentation:** See [API_ENDPOINTS.md](API_ENDPOINTS.md)

**For system status:** See [SYSTEM_STATUS.md](SYSTEM_STATUS.md)
