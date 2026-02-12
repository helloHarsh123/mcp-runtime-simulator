import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { initDB, getConversation, createConversation, updateConversationHistory, getConversations } from './db.js';
import { loadMCPConfig, spawnServer, getAllTools, executeMCPTool, getServers } from './serverManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. CONFIG LOADER ---
try {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [k, ...rest] = trimmed.split('=');
      const v = rest.join('=').trim();
      if (k) process.env[k.trim()] = v;
    });
  }
} catch (e) { console.warn("Config Error:", e); }

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const LOCAL_TOOLS = [
  {
    name: 'shell_exec',
    description: 'Execute shell commands (Use "psql" for database operations)',
    inputSchema: { type: 'object', properties: { command: { type: 'string' } } }
  }
];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This must be set in your .env
});

// We wrap it to match your existing interface
const aiClient = {
  async generateContent(prompt) {
    console.log(`[AI] Calling Ollama: ${process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b'}`);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
          prompt: prompt,
          stream: false
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Ollama API Error: ${data.error}`);
      }

      const content = data.response;
      
      // Parse JSON safely - strip markdown code blocks
      try {
        // Remove markdown code block wrappers if present
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
          // Extract content between code block markers
          const match = cleanContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            cleanContent = match[1].trim();
          } else {
            // Fallback: just remove the first and last lines
            const lines = cleanContent.split('\n');
            if (lines.length > 2) {
              cleanContent = lines.slice(1, -1).join('\n').trim();
            }
          }
        }
        return JSON.parse(cleanContent);
      } catch (e) {
        console.error("❌ JSON Parse Error. Raw output:", content);
        throw new Error("Invalid JSON from AI");
      }

    } catch (e) {
      console.error("❌ Ollama API Error:", e.message);
      // Return a safe fallback so the server doesn't crash
      return { 
        action: "final_output", 
        summary: `Ollama Error: ${e.message}` 
      };
    }
  }
};

// No init function needed for standard OpenAI, so we remove initAIClientIfNeeded()
async function initAIClientIfNeeded() { return; }

// --- 3. ROBUST LOGIC (JSON MODE) ---
async function getNextStep(intent, history) {
  const mcpTools = await getAllTools();
  const allTools = [...LOCAL_TOOLS, ...mcpTools];



  const historyText = history.map((h, i) => {
    if (h.type === 'user_message') return `USER: ${h.message}`;
    if (h.result) {
      // We append [SUCCESS] or [ERROR] to help the AI understand the state
      const resVal = h.result.result;
      const status = h.result.isError ? "[ERROR]" : "[SUCCESS]";
      const resStr = typeof resVal === 'string' ? resVal : JSON.stringify(resVal);
      return `TOOL_OUTPUT (${h.result.tool_name}): ${status} ${resStr.slice(0, 500)}`; 
    }
    return '';
  }).join('\n');

  const toolList = allTools.map(t => `- ${t.name} (Server: ${t.server || 'local'})`).join(', ');

  const prompt = `GOAL: "${intent}"

AVAILABLE TOOLS:
${toolList}

HISTORY:
${historyText}

INSTRUCTIONS:
You are an orchestrator. Return a JSON object to decide the next step.
1. If the goal is not done, use "tool_call".
2. If the goal is done, use "final_output".

IMPORTANT: 
1. NEVER invent tool names. You can ONLY use the tools listed above (e.g. "shell_exec").

CRITICAL RULES FOR SQL:
- Do NOT run one command at a time. Batch your SQL into a single script.
- Example: "CREATE TABLE IF NOT EXISTS x (...); INSERT INTO x VALUES (...); SELECT * FROM x;"
- If you see "already exists" in the history, assume the table is ready and move to the next step.
- The 'postgres' 'query' tool is READ-ONLY. Use 'shell_exec' with 'psql' for everything else.

REQUIRED JSON STRUCTURE:
{
  "action": "tool_call" | "final_output",
  "server": "server_name" (only for tool_call),
  "tool_name": "tool_name" (only for tool_call),
  "input": { ... } (parameters for the tool - varies by tool),
  "summary": "answer text" (only for final_output)
}

EXAMPLES:
For search_users with query parameter: {"action": "tool_call", "server": "github", "tool_name": "search_users", "input": {"q": "octocat"}, "summary": "..."}
For shell_exec with command: {"action": "tool_call", "server": "local", "tool_name": "shell_exec", "input": {"command": "ls -la"}, "summary": "..."}
For final output: {"action": "final_output", "summary": "Task completed successfully."}`;

  try {
    // We expect a pure JSON object back. No parsing needed.
    const decision = await aiClient.generateContent(prompt);
    
    // Auto-fix for Postgres Query Tool (if AI insists on using it for writes)
    if (decision.tool_name === 'query') {
        const sql = decision.input.sql || decision.input.query;
        if (sql && (sql.toUpperCase().includes('CREATE') || sql.toUpperCase().includes('INSERT'))) {
             console.log("[Auto-Fix] Switching Write Query to Shell Exec");
             decision.server = 'local';
             decision.tool_name = 'shell_exec';
             decision.input = { command: `psql -d mydb -c "${sql}"` };
        }
    }

    // Default server mapping if missing
    if (decision.action === 'tool_call' && !decision.server) {
        const toolDef = allTools.find(t => t.name === decision.tool_name);
        if (toolDef) decision.server = toolDef.server;
    }

    return decision;

  } catch (e) {
    console.error("AI Error:", e);
    return { action: 'final_output', summary: "Error: " + e.message };
  }
}

// --- 4. EXECUTION HANDLER ---
async function executeTool(toolCall) {
  const { tool_name, input, server } = toolCall;

  if (tool_name === 'shell_exec') {
    if (!input.command) return { error: 'Missing command', isError: true };
    try {
      const { execSync } = await import('child_process');
      // Capture stderr too, and mark simple "NOTICE" as success
      const output = execSync(input.command + ' 2>&1', { encoding: 'utf8' }).trim();
      return { 
        result: output || "Command executed successfully.",
        isError: false 
      };
    } catch (e) { 
      return { 
        result: `Shell Error: ${e.message}\nOutput: ${e.stdout?.toString() || ''}`,
        isError: true
      }; 
    }
  }

  if (server) {
    try {
      const res = await executeMCPTool(server, tool_name, input);
      return { result: res, isError: false };
    } catch (e) {
      return { result: `MCP Error: ${e.message}`, isError: true };
    }
  }

  return { result: `Tool ${tool_name} not found`, isError: true };
}

// --- 5. SERVER ---
initDB();
loadMCPConfig();

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url.match(/\/message$/)) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      const { message, auto_continue } = JSON.parse(body);
      const convId = req.url.split('/')[2];
      let conv = getConversation(convId) || createConversation(convId, 'Chat');
      const history = conv.history || [];

      history.push({ type: 'user_message', message, timestamp: Date.now() });

      let step = 0;
      let finalSummary = null;

      while (step++ < 5) { // Reduced steps since we batch commands
        console.log(`[Step ${step}] Thinking...`);
        const decision = await getNextStep(message, history);
        
        console.log(`[Decision]`, JSON.stringify(decision));

        if (decision.action === 'final_output') {
          finalSummary = decision.summary;
          history.push({ type: 'ai_response', message: finalSummary, timestamp: Date.now() });
          break;
        }

        const resultObj = await executeTool(decision);
        history.push({
          type: 'tool_result',
          result: { tool_name: decision.tool_name, ...resultObj },
          action: decision,
          timestamp: Date.now()
        });

        if (!auto_continue) {
            finalSummary = `Paused after running ${decision.tool_name}`;
            break;
        }
      }

      updateConversationHistory(convId, history);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ steps: step, final_response: { summary: finalSummary }, history: history.slice(-3) }));
    });
  }
});

server.listen(PORT, async () => {
  console.log(`🚀 JSON-Mode Server running on ${PORT}`);
  await initAIClientIfNeeded();
  const servers = getServers();
  for (const s of servers) await spawnServer(s);
});