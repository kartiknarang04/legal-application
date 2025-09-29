import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Send, Bot, User, ChevronDown, ChevronUp, FileText, Database, Clock, Zap } from 'lucide-react';

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
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [loadingState, setLoadingState] = useState('');
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setChatHistory([]);
      setSessionLoaded(false);
      return;
    }
    
    const loadChatHistory = async () => {
      try {
        setLoadingState('Loading previous conversations...');
        const response = await fetch(`${BACKEND_2_URL}/history/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.chat_history && data.chat_history.length > 0) {
            const formattedHistory = data.chat_history.map((msg: any) => ({
              role: msg.role,
              message: msg.message,
              timestamp: msg.created_at || new Date().toISOString(),
              sources: msg.sources || [],
              confidence: msg.confidence,
              query_analysis: msg.query_analysis,
              processing_time: msg.processing_time
            }));
            setChatHistory(formattedHistory);
            setSessionLoaded(true);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setLoadingState('');
      }
    };

    loadChatHistory();
  }, [sessionId, setChatHistory]);

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

    const isFirstQuery = !sessionLoaded && chatHistory.length === 0;
    setIsInitialLoad(isFirstQuery);
    
    if (isFirstQuery) {
      setLoadingState('Loading document embeddings from database...');
    } else {
      setLoadingState('Processing your question...');
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const timeout = isFirstQuery ? LOAD_TIMEOUT : OPTIMIZED_TIMEOUT;
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, timeout);

      const response = await fetch(`${BACKEND_2_URL}/chat/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          message: currentMessage
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          const textError = await response.text();
          if (textError) errorMessage = textError;
        }
        throw new Error(errorMessage);
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
        
        if (isFirstQuery) {
          setSessionLoaded(true);
        }
      } else {
        throw new Error(data.error_details || data.message || 'Chat processing failed');
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      
      let errorMessage = 'Sorry, I encountered an error processing your question.';
      
      if (error.name === 'AbortError') {
        if (isFirstQuery) {
          errorMessage = 'Document loading timed out. The document may be large or the server may be busy. Please try again.';
        } else {
          errorMessage = 'Query timed out. Please try a simpler question or try again.';
        }
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = 'Session not found. Please upload a document first or check if the session is still active.';
      } else if (error.message.includes('Failed to load session')) {
        errorMessage = 'Could not load your document. Please check if it was uploaded correctly and try again.';
      } else if (error.message.includes('500') || error.message.includes('Server error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (error.message) {
        errorMessage = error.message;
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
      setIsInitialLoad(false);
      setLoadingState('');
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
            <div className={`w-3 h-3 rounded-full ${
              sessionId && sessionLoaded ? 'bg-green-500' : sessionId ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
            <span className="font-medium text-gray-900">
              {!sessionId ? 'No Session' : sessionLoaded ? 'Ready to Chat' : 'Session Available'}
            </span>
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
      <div className="bg-white rounded-xl shadow-lg flex flex-col h-96">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {loadingState && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">{loadingState}</span>
              </div>
            </div>
          )}
          
          {!sessionId ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No session available</p>
              <p className="text-sm">Upload a document first to start chatting</p>
            </div>
          ) : chatHistory.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Ready to chat</p>
              <p className="text-sm">Ask questions about your legal document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white'
                        : msg.error 
                          ? 'bg-red-50 text-red-600'
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
                          <span>• Confidence: {Math.round(msg.confidence)}%</span>
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
                      {expandedSources[index] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    
                    {expandedSources[index] && (
                      <div className="mt-2 space-y-2">
                        {msg.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} className="p-3 bg-gray-50 rounded-lg border text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-white rounded text-xs font-mono">
                                  {source.chunk_id || `Chunk ${sourceIndex + 1}`}
                                </span>
                                <span className="font-medium">{source.title || 'Document'}</span>
                                {source.section && (
                                  <span className="text-gray-600">({source.section})</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-600">
                                Score: {(source.relevance_score || 0).toFixed(3)}
                              </span>
                            </div>
                            
                            {(source.text_preview || source.excerpt) && (
                              <p className="text-gray-700 text-xs leading-relaxed mb-2">
                                {source.text_preview || source.excerpt}
                              </p>
                            )}
                            
                            {source.entities && source.entities.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-600 mb-1">Entities:</div>
                                <div className="flex flex-wrap gap-1">
                                  {source.entities.slice(0, 5).map((entity, entityIndex) => (
                                    <span
                                      key={entityIndex}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                    >
                                      {entity}
                                    </span>
                                  ))}
                                </div>
                              </div>
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
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600">
                    {isInitialLoad 
                      ? 'Loading document embeddings from database...'
                      : 'Analyzing document and generating response...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !sessionId
                  ? "Upload a document first..."
                  : isLoading
                    ? isInitialLoad ? "Loading document..." : "Processing..."
                    : "Ask a question about your legal document..."
              }
              disabled={!sessionId || isLoading}
              className={`flex-1 p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                (!sessionId || isLoading) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            <button
              onClick={sendMessage}
              disabled={!canSendMessage}
              className={`p-3 bg-blue-600 text-white rounded-lg transition-colors ${
                canSendMessage 
                  ? 'hover:bg-blue-700' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Example Questions */}
          {sessionId && chatHistory.length === 0 && !isLoading && (
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-2">Try asking:</div>
              <div className="flex flex-wrap gap-2">
                {[
                  "What is the main legal issue in this case?",
                  "Who are the key parties involved?",
                  "What was the court's decision?",
                  "What precedents were cited?"
                ].map((question, index) => (
                  <button
                    key={index}
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
      {chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.query_analysis && (
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Query Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Query Type:</span>
              <div className="font-medium mt-1">
                {chatHistory[chatHistory.length - 1]?.query_analysis?.query_type || 'general'}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Key Concepts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {chatHistory[chatHistory.length - 1]?.query_analysis?.key_concepts?.map((concept, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {concept}
                  </span>
                )) || <span className="text-xs text-gray-500">None found</span>}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Entities Found:</span>
              <div className="font-medium mt-1">
                {chatHistory[chatHistory.length - 1]?.query_analysis?.entities?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGChat;