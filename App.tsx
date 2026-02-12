import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ConversationMessage } from './types';
import { 
  createConversation, 
  listConversations, 
  getConversation, 
  sendMessage 
} from './services/runtimeService';

const AVAILABLE_TOOLS = [
  { name: 'shell_exec', description: 'Execute shell commands' },
  { name: 'http_request', description: 'Make HTTP requests' },
  { name: 'search_repositories', description: 'Search GitHub repositories' }
];

const ChatMessage: React.FC<{ message: ConversationMessage; index: number }> = ({ message, index }) => {
  if (!message.type && message.action) {
    // Tool execution step
    return (
      <div className="px-6 py-3 bg-zinc-900/50 border-l-2 border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
        <span>Executing {(message.action as any)?.tool_name || 'tool'}...</span>
      </div>
    );
  }

  if (message.type === 'user_message') {
    return (
      <div className="px-6 py-4 flex gap-4 hover:bg-zinc-900/30 transition-colors">
        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-indigo-400">👤</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-zinc-200 leading-relaxed">{message.message}</p>
          {message.timestamp && (
            <span className="text-[10px] text-zinc-600 mt-1 block">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (message.type === 'ai_response') {
    return (
      <div className="px-6 py-4 bg-zinc-900/20 border-l-4 border-emerald-600/40">
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-emerald-400">🤖</span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{message.message}</p>
            {message.suggestedActions && message.suggestedActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.suggestedActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => window.dispatchEvent(new CustomEvent('suggestedActionClicked', { detail: action }))}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-300 rounded border border-zinc-700 transition-all hover:border-zinc-600"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
            {message.timestamp && (
              <span className="text-[10px] text-zinc-600 mt-2 block">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const ConversationItem: React.FC<{
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}> = ({ conversation, isSelected, onClick }) => {
  const history = conversation.history || [];
  const lastMessage = history[history.length - 1];
  const preview = lastMessage?.message?.substring(0, 40) || 'New conversation';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-l-2 transition-all ${
        isSelected
          ? 'bg-indigo-950/40 border-indigo-600 text-indigo-200'
          : 'border-zinc-800 hover:bg-zinc-900/30 text-zinc-300'
      }`}
    >
      <p className="text-sm font-medium truncate">{conversation.title}</p>
      <p className="text-[11px] text-zinc-500 truncate mt-1">{preview}...</p>
      <span className="text-[9px] text-zinc-600 mt-1 block">
        {history.length} messages
      </span>
    </button>
  );
};

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState('');
  const [showNewConvInput, setShowNewConvInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.history?.length]);

  const loadConversations = async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
      if (convs.length > 0 && !selectedConversation) {
        setSelectedConversation(convs[0]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleNewConversation = async () => {
    if (!newConvTitle.trim()) return;
    
    try {
      setIsLoading(true);
      const conv = await createConversation(newConvTitle);
      setConversations(prev => [conv, ...prev]);
      setSelectedConversation(conv);
      setNewConvTitle('');
      setShowNewConvInput(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedConversation || !message.trim()) return;

    try {
      setIsLoading(true);
      const response = await sendMessage(
        selectedConversation.id,
        message,
        AVAILABLE_TOOLS,
        false
      );

      // Update selected conversation with new history
      const updated = await getConversation(selectedConversation.id);
      setSelectedConversation(updated);
      
      // Reload conversations list
      await loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    try {
      // Fetch full conversation with history
      const fullConv = await getConversation(conv.id);
      setSelectedConversation(fullConv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Fallback to setting the conversation even without history
      setSelectedConversation(conv);
    }
  };

  useEffect(() => {
    const handleSuggestion = (e: Event) => {
      const customEvent = e as CustomEvent;
      handleSuggestedAction(customEvent.detail);
    };
    window.addEventListener('suggestedActionClicked', handleSuggestion);
    return () => window.removeEventListener('suggestedActionClicked', handleSuggestion);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white text-lg">💬</span>
          </div>
          <h1 className="text-sm font-bold uppercase tracking-widest text-white">MCP Conversations</h1>
        </div>
        <div className="text-[10px] text-zinc-500">
          {selectedConversation ? `${(selectedConversation.history || []).length} messages` : 'No conversation'}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden shrink-0">
          {/* New Conversation Button */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
            {showNewConvInput ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newConvTitle}
                  onChange={(e) => setNewConvTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNewConversation();
                    if (e.key === 'Escape') setShowNewConvInput(false);
                  }}
                  placeholder="Conversation name..."
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-xs focus:outline-none focus:border-indigo-600"
                />
                <button
                  onClick={handleNewConversation}
                  disabled={isLoading}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-xs font-bold"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewConvInput(true)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-all"
              >
                + New Conversation
              </button>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-zinc-600 text-xs">
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversation?.id === conv.id}
                  onClick={() => handleSelectConversation(conv)}
                />
              ))
            )}
          </div>

          {/* Tools Info */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 text-[10px] text-zinc-600">
            <p className="font-bold mb-2">Available Tools:</p>
            <ul className="space-y-1">
              {AVAILABLE_TOOLS.map((tool) => (
                <li key={tool.name}>• {tool.name}</li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-zinc-950 divide-y divide-zinc-900">
                {!selectedConversation.history || selectedConversation.history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <span className="text-6xl mb-4">💭</span>
                    <p className="text-xs font-bold uppercase tracking-widest">Start a conversation</p>
                  </div>
                ) : (
                  <>
                    {selectedConversation.history.map((msg, idx) => (
                      <ChatMessage key={idx} message={msg} index={idx} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 shrink-0">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoading) {
                        handleSendMessage(inputMessage);
                        setInputMessage('');
                      }
                    }}
                    placeholder="Type your message... (Enter to send)"
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/30 transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      handleSendMessage(inputMessage);
                      setInputMessage('');
                    }}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold text-sm transition-all"
                  >
                    {isLoading ? '...' : 'Send'}
                  </button>
                </div>
                {isLoading && (
                  <p className="text-[11px] text-zinc-500 mt-2">Processing...</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center opacity-50">
                <span className="text-6xl block mb-4">📭</span>
                <p className="text-sm font-bold uppercase tracking-widest">No conversation selected</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;
