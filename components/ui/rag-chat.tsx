import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Send, Bot, User, ChevronDown, ChevronUp, FileText, Database, Clock, Zap } from 'lucide-react';

const BACKEND_2_URL = process.env.NEXT_PUBLIC_BACKEND_2_URL || 'https://kn29-rag-chat.hf.space';

// Optimized timeout settings
const OPTIMIZED_TIMEOUT = 15000; // 15 seconds instead of 60
const LOAD_TIMEOUT = 30000; // 30 seconds for initial session load

const OptimizedRAGChat = ({ sessionId, chatHistory, setChatHistory, setError }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loadingState, setLoadingState] = useState('');
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load session info when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setSessionInfo(null);
      return;
    }
    
    const loadSessionInfo = async () => {
      try {
        const response = await fetch(`${BACKEND_2_URL}/session/${sessionId}/info`, {
          timeout: 5000
        });
        
        if (response.ok) {
          const info = await response.json();
          setSessionInfo(info);
        }
      } catch (error) {
        // Session might not be loaded yet, which is fine
        console.log('Session not yet loaded in memory');
      }
    };

    loadSessionInfo();
  }, [sessionId]);

  // Load chat history when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    
    const loadChatHistory = async () => {
      try {
        setLoadingState('Loading chat history...');
        const response = await fetch(`${BACKEND_2_URL}/history/${sessionId}`, {
          timeout: 10000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.chat_history) {
            setChatHistory(data.chat_history.map((msg) => ({
              role: msg.role,
              message: msg.message,
              timestamp: msg.created_at || new Date().toISOString(),
              sources: msg.sources || [],
              confidence: msg.confidence,
              query_analysis: msg.query_analysis
            })));
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

    const userMessage = {
      role: 'user',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    setError(null);

    // Determine if this is the first query (session not loaded)
    const isFirstQuery = chatHistory.length === 0;
    setIsInitialLoad(isFirstQuery);
    
    if (isFirstQuery) {
      setLoadingState('Loading document embeddings from database...');
    } else {
      setLoadingState('Processing your question...');
    }

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const timeout = isFirstQuery ? LOAD_TIMEOUT : OPTIMIZED_TIMEOUT;
      const timeoutId = setTimeout(() => {
        abortControllerRef.current.abort();
      }, timeout);

      const response = await fetch(`${BACKEND_2_URL}/chat/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.message
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          message: data.answer || '',
          timestamp: new Date().toISOString(),
          sources: data.sources || [],
          confidence: data.confidence,
          query_analysis: data.query_analysis,
          processing_time: data.processing_time
        };

        setChatHistory(prev => [...prev, assistantMessage]);
        
        // Update session info after successful query
        if (isFirstQuery) {
          setSessionInfo(prev => ({ ...prev, loaded: true }));
        }
      } else {
        throw new Error(data.message || 'Chat failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = 'Sorry, I encountered an error processing your question.';
      
      if (error.name === 'AbortError') {
        if (isFirstQuery) {
          errorMessage = 'Document loading timed out. The document may be large. Please try again.';
        } else {
          errorMessage = 'Query timed out. Please try a simpler question or try again.';
        }
      } else if (error.message.includes('404')) {
        errorMessage = 'Session not found. Please upload a document first.';
      } else if (error.message.includes('Failed to load session')) {
        errorMessage = 'Could not load your document. Please check if it was uploaded correctly.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
      const errorResponseMessage = {
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleSourceExpansion = (messageIndex) => {
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

      {/* Enhanced Session Status */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              sessionId ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span className="font-medium text-gray-900">
              {sessionId ? 'Ready to Chat' : 'Waiting for Session'}
            </span>
            {sessionId && (
              <span className="text-sm text-gray-500">
                Session: {sessionId.slice(-8)}
              </span>
            )}
          </div>
          {sessionId && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <Database className="h-4 w-4" />
                <span>RAG System Active</span>
              </div>
              {sessionInfo && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Zap className="h-4 w-4" />
                  <span>Optimized</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Performance Info */}
        {sessionInfo && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Chunks:</span>
                <div className="font-medium">{sessionInfo.metadata?.chunk_count || 0}</div>
              </div>
              <div>
                <span className="text-gray-500">Load Time:</span>
                <div className="font-medium">{(sessionInfo.metadata?.load_time || 0).toFixed(2)}s</div>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <div className="font-medium text-green-600">Loaded</div>
              </div>
            </div>
          </div>
        )}
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
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Ask questions about your legal document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-4/5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
                            
                            {source.text_preview && (
                              <p className="text-gray-700 text-xs leading-relaxed mb-2">
                                {source.text_preview}
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
                      ? 'Loading your document from database...'
                      : 'Analyzing document...'}
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
                  : isInitialLoad
                    ? "Document loading..."
                    : "Ask a question about your legal document..."
              }
              disabled={!canSendMessage && !message.trim()}
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

export default OptimizedRAGChat;