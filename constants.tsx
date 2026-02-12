
import { MCPTool, ToolSideEffect } from './types';

export const MOCK_SERVER_REGISTRY: Record<string, { name: string, tools: MCPTool[] }> = {
  '@modelcontextprotocol/server-postgres': {
    name: 'PostgreSQL Server',
    tools: [
      {
        name: 'query_database',
        description: 'Executes a read-only SQL query against the database.',
        input_schema: { sql: { type: 'string' } },
        side_effects: ToolSideEffect.READ_ONLY,
        failure_modes: ['Syntax error', 'Permission denied']
      },
      {
        name: 'list_tables',
        description: 'Lists all available tables in the current schema.',
        input_schema: {},
        side_effects: ToolSideEffect.READ_ONLY,
        failure_modes: ['Connection failed']
      }
    ]
  },
  '@modelcontextprotocol/server-google-maps': {
    name: 'Google Maps Server',
    tools: [
      {
        name: 'search_places',
        description: 'Searches for places nearby based on keywords.',
        input_schema: { query: { type: 'string' }, location: { type: 'string' } },
        side_effects: ToolSideEffect.READ_ONLY,
        failure_modes: ['API quota exceeded', 'No results']
      }
    ]
  },
  'npx @modelcontextprotocol/server-everything': {
    name: 'Everything Server',
    tools: [
      {
        name: 'get_current_time',
        description: 'Returns the current server time.',
        input_schema: {},
        side_effects: ToolSideEffect.READ_ONLY,
        failure_modes: []
      },
      {
        name: 'echo',
        description: 'Echos back the input provided.',
        input_schema: { message: { type: 'string' } },
        side_effects: ToolSideEffect.READ_ONLY,
        failure_modes: []
      }
    ]
  }
};

export const DEFAULT_TOOLS: MCPTool[] = [
  {
    name: 'fetch_weather',
    description: 'Retrieves current weather data for a specific location.',
    input_schema: {
      location: { type: 'string', description: 'City name or coordinates' }
    },
    side_effects: ToolSideEffect.READ_ONLY,
    failure_modes: ['Location not found', 'Service timeout'],
    server_id: 'internal-core'
  }
];

export const SYSTEM_PROMPT = `You are an MCP-compatible agent runtime. 
Interpret user intent, select tools from the registry, and execute them step-by-step.

Rules:
1. Select tools ONLY from the registry. Do not hallucinate tools.
2. Emit structured JSON for every step.
3. Classify tool results as SUCCESS, TFS (retryable), or WIS (blocking).
4. Pause when WIS is detected, when an irreversible action is required, or when confidence is low.
5. Every response must include:
   - "goal": Current sub-goal.
   - "reasoning": Why you chose this action.
   - "action": One of {type: "tool_call", "tool_name", "input", "reason"} OR {type: "pause", "reason", "explanation", "required_input"} OR {type: "final_output", "summary", "confidence"}.
   - "confidence": 0.0 to 1.0.

Registry provided in context. Assume history is the previous steps and their results.`;
