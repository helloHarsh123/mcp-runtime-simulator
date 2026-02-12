// --- Tool Definitions ---

export enum ToolSideEffect {
  READ_ONLY = 'read-only',
  WRITE = 'write',
  IRREVERSIBLE = 'irreversible'
}

export interface MCPTool {
  name: string;
  description?: string; // Made optional as some servers might omit it
  inputSchema?: Record<string, any>; // UPDATED: Server returns camelCase 'inputSchema'
  server?: string; // ADDED: To track which server (postgres, github) provides it
  
  // These are often missing in raw MCP lists, so make them optional
  side_effects?: ToolSideEffect; 
  failure_modes?: string[];
  is_live?: boolean; 
}

// --- Server Definitions ---

export interface MCPServer {
  id: string;
  name: string;
  type: 'local' | 'remote';
  command: string;
  status: 'connecting' | 'connected' | 'error';
  env?: Record<string, string>;
}

// --- Runtime Execution Types ---

export type RuntimeAction = 
  | { type: 'tool_call'; tool_name: string; server?: string; input: any; reason?: string } // Added server & reason optional
  | { type: 'pause'; reason: string; explanation?: string; required_input?: string }
  | { type: 'final_output'; summary: string; confidence?: number };

// --- Conversation History Types ---

export interface ToolResult {
  tool_name: string;
  result: any; // The raw output from the tool
  error?: string;
}

export interface ConversationMessage {
  // UPDATED: Added 'tool_result' which the server now generates
  type: 'user_message' | 'ai_response' | 'tool_result'; 
  
  message?: string; // For user/ai messages
  timestamp: number;
  
  // For tool result messages
  result?: ToolResult; 
  action?: RuntimeAction; 
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  history: ConversationMessage[];
}

// --- API Response Types ---

// UPDATED: Matches exactly what server.js returns now
export interface ConversationResponse {
  steps: number; // Server uses 'steps', not 'steps_executed'
  final_response: {
    summary: string | null;
    status?: string;
  };
  history: ConversationMessage[]; // The updated history tail
}