// import { MCPTool, ExecutionStep, RuntimeAction, Conversation, ConversationResponse } from "../types";
// (Ensure your types match the server response below)

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) ? (import.meta as any).env.VITE_API_BASE : 'http://localhost:4000';

// ===== Conversation API =====

export async function createConversation(title: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });

  if (!res.ok) {
    throw new Error(`Failed to create conversation: ${res.statusText}`);
  }

  return res.json();
}

export async function getConversation(conversationId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`);

  if (!res.ok) {
    throw new Error(`Failed to get conversation: ${res.statusText}`);
  }

  return res.json();
}

export async function listConversations(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/conversations`);

  if (!res.ok) {
    throw new Error(`Failed to list conversations: ${res.statusText}`);
  }

  const data = await res.json();
  return data.conversations || [];
}

export async function sendMessage(
  conversationId: string,
  message: string,
  // availableTools is removed because the Server now manages tools (Postgres/GitHub)
  autoContinue: boolean = true 
): Promise<any> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      // We no longer send available_tools; the server loads them from mcp.json
      auto_continue: autoContinue
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to send message: ${res.statusText} - ${txt}`);
  }

  /* Server now returns this shape:
     { 
       steps: number, 
       final_response: { summary: string | null }, 
       history: Array<Step> 
     }
  */
  return res.json();
}