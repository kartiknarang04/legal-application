import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Send, Bot, User, ChevronDown, ChevronUp, FileText, Database, Clock, Zap } from 'lucide-react';

// Type definitions remain the same
type ChatMessage = {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  sources?: Array<{
    chunk_id?: string;
    title?: string;
    section?: string;
    relevance_score?: number;
    text_preview?: string;
    entities?: string[];
    excerpt?: string;
  }>;
  confidence?: number;
  query_analysis?: {
    query_type?: string;
    key_concepts?: string[];
    entities?: string[];
  };
  error?: boolean;
  processing_time?: number;
};

// Added a specific type for the backend message payload to avoid `any`
type BackendChatMessage = {
  role: 'user' | 'assistant';
  message: string;
  created_at?: string;
  sources?: any[];
  confidence?: number;
  query_analysis?: any;
  processing_time?: number;
};

interface RAGChatProps {
  sessionId: string | null;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const BACKEND_2_URL = process.env.NEXT_PUBLIC_BACKEND_2_URL || 'https://kn29-rag-chat.hf.space';
const OPTIMIZED_TIMEOUT = 25000;
const LOAD_TIMEOUT = 45000;

const RAGChat: React.FC<RAGChatProps> = ({
  sessionId,
  chatHistory,
  setChatHistory,
  setError
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialQuery, setIsInitialQuery] = useState(true); // Simplified state
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setChatHistory([]);
      setIsInitialQuery(true);
      return;
    }

    const loadChatHistory = async () => {
      setIsLoading(true); // Show loader while fetching history
      try {
        const response = await fetch(`${BACKEND_2_URL}/history/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.chat_history && data.chat_history.length > 0) {
            // FIX: Replaced `any` with the specific `BackendChatMessage` type
            const formattedHistory: ChatMessage[] = data.chat_history.map((msg: BackendChatMessage) => ({
              role: msg.role,
              message: msg.message,
              timestamp: msg.created_at || new Date().toISOString(),
              sources: msg.sources || [],
              confidence: msg.confidence,
              query_analysis: msg.query_analysis,
              processing_time: msg.processing_time
            }));
            setChatHistory(formattedHistory);
            setIsInitialQuery(false); // History exists, so it's not the initial query
          } else {
            setIsInitialQuery(true); // No history, next message is the first
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setError('Could not retrieve previous conversations.');
      } finally {
        setIsLoading(false);
      }
    };

    loadChatHistory();
  }, [sessionId, setChatHistory, setError]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const sendMessage = async () => {
    if (!message.trim() || isLoading || !sessionId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);
    const currentMessage = message.trim();
    setMessage('');
    setIsLoading(true);
    setError(null);

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const timeout = isInitialQuery ? LOAD_TIMEOUT : OPTIMIZED_TIMEOUT;

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      const response = await fetch(`${BACKEND_2_URL}/chat/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message: currentMessage }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = 'An unknown server error occurred.';
        try {
          const errorData = await response.json();
          errorBody = errorData.detail || errorData.message || JSON.stringify(errorData);
        } catch {
          errorBody = await response.text();
        }
        throw new Error(`Server error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          message: data.answer || 'I apologize, but I was unable to generate a response.',
          timestamp: new Date().toISOString(),
          sources: data.sources || [],
          confidence: data.confidence,
          query_analysis: data.query_analysis,
          processing_time: data.processing_time
        };
        setChatHistory(prev => [...prev, assistantMessage]);
        if (isInitialQuery) {
          setIsInitialQuery(false); // The first successful query has been made
        }
      } else {
        throw new Error(data.error_details || data.message || 'Chat processing failed');
      }
    } catch (error: unknown) {
      // --- THIS IS THE CORRECTED SECTION ---
      // TYPE GUARD: Safely handle the error by checking if it's an instance of Error.
      let errorMessage = 'Sorry, I encountered an unexpected error.';

      if (error instanceof Error) {
        console.error('Chat error:', error);

        if (error.name === 'AbortError') {
          errorMessage = isInitialQuery
            ? 'Document loading timed out. The server may be busy; please try again.'
            : 'Your question timed out. Please try a simpler question or try again.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Session not found. Please re-upload your document.';
        } else if (error.message.includes('500') || error.message.includes('Server error')) {
            errorMessage = 'A server error occurred. Please try again in a moment.';
        } else {
            // Use the specific message from the error object
            errorMessage = error.message;
        }
      } else {
        // Handle cases where the thrown value isn't an Error object
        console.error('An unexpected non-error was thrown:', error);
        errorMessage = String(error);
      }

      setError(errorMessage);
      const errorResponseMessage: ChatMessage = {
        role: 'assistant',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        error: true
      };
      setChatHistory(prev => [...prev, errorResponseMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleSourceExpansion = (messageIndex: number) => {
    setExpandedSources(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }));
  };
  
  const canSendMessage = sessionId && !isLoading && message.trim();
  const sessionStatusText = !sessionId ? 'No Session' : (chatHistory.length > 0 || !isInitialQuery) ? 'Ready to Chat' : 'Session Available';
  const sessionStatusColor = !sessionId ? 'bg-gray-400' : (chatHistory.length > 0 || !isInitialQuery) ? 'bg-green-500' : 'bg-yellow-500';

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          AI Legal Assistant
        </h2>
        <p className="text-gray-600">Ask questions about your document using natural language</p>
      </div>

      {/* Session Status */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${sessionStatusColor}`} />
            <span className="font-medium text-gray-900">{sessionStatusText}</span>
            {sessionId && (
              <span className="text-sm text-gray-500">
                ID: {sessionId.slice(-8)}
              </span>
            )}
          </div>
          {sessionId && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <Database className="h-4 w-4" />
                <span>RAG System Active</span>
              </div>
              <div className="flex items-center gap-2 text-blue-600">
                <Zap className="h-4 w-4" />
                <span>Optimized</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-xl shadow-lg flex flex-col h-[32rem]">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {!sessionId ? (
            <div className="m-auto text-center text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">No session available</p>
              <p className="text-sm">Upload a document to start chatting</p>
            </div>
          ) : chatHistory.length === 0 && !isLoading ? (
            <div className="m-auto text-center text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">Ready to chat</p>
              <p className="text-sm">Ask any question about your document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white'
                        : msg.error 
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : msg.error
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      <div className="text-xs opacity-70 mt-2 flex items-center gap-2">
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        {msg.confidence != null && (
                          <span>• Confidence: {Math.round(msg.confidence * 100)}%</span>
                        )}
                        {msg.processing_time != null && (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>{msg.processing_time.toFixed(2)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="ml-11">
                    <button
                      onClick={() => toggleSourceExpansion(index)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Sources ({msg.sources.length})</span>
                      {expandedSources[index] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSources[index] && (
                      <div className="mt-2 space-y-2">
                        {msg.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} className="p-3 bg-gray-50 rounded-lg border text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 font-medium">
                                <span>{source.title || 'Document'}</span>
                                {source.section && <span className="text-gray-600">({source.section})</span>}
                              </div>
                              <span className="text-xs text-gray-600">
                                Score: {(source.relevance_score || 0).toFixed(3)}
                              </span>
                            </div>
                            {(source.text_preview || source.excerpt) && (
                              // FIX: Used a template literal to avoid unescaped quotes
                              <p className="text-gray-700 text-xs leading-relaxed border-l-2 border-gray-200 pl-2">
                                {`"...${source.text_preview || source.excerpt}..."`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          
          {isLoading && !chatHistory.some(m => m.role === 'user') && (
            <div className="m-auto text-center text-blue-600">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="text-sm mt-2">Loading chat history...</p>
            </div>
          )}

          {isLoading && chatHistory.some(m => m.role === 'user') && (
            <div className="flex gap-3 justify-start mt-4">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {isInitialQuery 
                      ? 'Analyzing document...'
                      : 'Generating response...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t p-4">
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !sessionId
                  ? "Upload a document to begin..."
                  : isLoading
                    ? "Processing..."
                    : "Ask a question..."
              }
              disabled={!sessionId || isLoading}
              className="w-full p-3 pr-12 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={!canSendMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Example Questions */}
          {sessionId && isInitialQuery && !isLoading && (
            <div className="mt-3">
              <p className="text-xs text-gray-600 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "What is the main legal issue in this case?",
                  "Who are the key parties involved?",
                  "What was the court's decision?",
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => setMessage(question)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query Analysis */}
      {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis && (
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Last Query Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Query Type:</span>
              <div className="font-medium mt-1 capitalize">
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.query_type || 'general'}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Key Concepts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.key_concepts?.map((concept) => (
                  <span key={concept} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {concept}
                  </span>
                )) || <span className="text-xs text-gray-500">None found</span>}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Entities Found:</span>
              <div className="font-medium mt-1">
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.entities?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGChat;

