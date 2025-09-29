import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Send, Bot, User, ChevronDown, ChevronUp, FileText, Database, Clock, Zap } from 'lucide-react';

// Define detailed types to be reused
type Source = {
  chunk_id?: string;
  title?: string;
  section?: string;
  relevance_score?: number;
  text_preview?: string;
  entities?: string[];
  excerpt?: string;
};

type QueryAnalysis = {
  query_type?: string;
  key_concepts?: string[];
  entities?: string[];
};

// Frontend ChatMessage type using the detailed types
type ChatMessage = {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  sources?: Source[];
  confidence?: number;
  query_analysis?: QueryAnalysis;
  error?: boolean;
  processing_time?: number;
};

// Backend message payload type now using specific, non-`any` types
type BackendChatMessage = {
  role: 'user' | 'assistant';
  message: string;
  created_at?: string;
  sources?: Source[];
  confidence?: number;
  query_analysis?: QueryAnalysis;
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
  const [isInitialQuery, setIsInitialQuery] = useState(true);
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
      setIsLoading(true);
      try {
        const response = await fetch(`${BACKEND_2_URL}/history/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.chat_history && data.chat_history.length > 0) {
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
            setIsInitialQuery(false);
          } else {
            setIsInitialQuery(true);
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
          setIsInitialQuery(false);
        }
      } else {
        throw new Error(data.error_details || data.message || 'Chat processing failed');
      }
    } catch (error: unknown) {
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
          errorMessage = error.message;
        }
      } else {
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
  const sessionStatusColor = !sessionId ? '#9ca3af' : (chatHistory.length > 0 || !isInitialQuery) ? '#10b981' : '#eab308';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
          AI Legal Assistant
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Ask questions about your document using natural language</p>
      </div>

      {/* Session Status */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '0.75rem', 
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
        padding: '1rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '0.75rem', 
              height: '0.75rem', 
              borderRadius: '9999px', 
              backgroundColor: sessionStatusColor 
            }} />
            <span style={{ fontWeight: 500, color: '#111827' }}>{sessionStatusText}</span>
            {sessionId && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                ID: {sessionId.slice(-8)}
              </span>
            )}
          </div>
          {sessionId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <Database style={{ height: '1rem', width: '1rem' }} />
                <span>RAG System Active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb' }}>
                <Zap style={{ height: '1rem', width: '1rem' }} />
                <span>Optimized</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '0.75rem', 
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '32rem' 
      }}>
        {/* Chat Messages */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem' 
        }}>
          {!sessionId ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#6b7280' }}>
              <MessageSquare style={{ height: '3rem', width: '3rem', margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>No session available</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Upload a document to start chatting</p>
            </div>
          ) : chatHistory.length === 0 && !isLoading ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#6b7280' }}>
              <MessageSquare style={{ height: '3rem', width: '3rem', margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>Ready to chat</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Ask any question about your document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
                }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    maxWidth: '80%',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                  }}>
                    <div style={{ 
                      width: '2rem', 
                      height: '2rem', 
                      borderRadius: '9999px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      backgroundColor: msg.role === 'user' 
                        ? '#2563eb' 
                        : msg.error 
                          ? '#fee2e2' 
                          : '#f3f4f6',
                      color: msg.role === 'user' 
                        ? 'white' 
                        : msg.error 
                          ? '#dc2626' 
                          : '#6b7280'
                    }}>
                      {msg.role === 'user' ? <User style={{ height: '1rem', width: '1rem' }} /> : <Bot style={{ height: '1rem', width: '1rem' }} />}
                    </div>
                    <div style={{ 
                      borderRadius: '0.5rem', 
                      padding: '0.75rem',
                      backgroundColor: msg.role === 'user'
                        ? '#2563eb'
                        : msg.error
                          ? '#fef2f2'
                          : '#f3f4f6',
                      color: msg.role === 'user'
                        ? 'white'
                        : msg.error
                          ? '#991b1b'
                          : '#111827',
                      border: msg.error ? '1px solid #fecaca' : 'none'
                    }}>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        lineHeight: 1.6, 
                        whiteSpace: 'pre-wrap',
                        margin: 0
                      }}>
                        {msg.message}
                      </p>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        opacity: 0.7, 
                        marginTop: '0.5rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem' 
                      }}>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        {msg.confidence != null && (
                          <span>• Confidence: {Math.round(msg.confidence * 100)}%</span>
                        )}
                        {msg.processing_time != null && (
                          <>
                            <Clock style={{ height: '0.75rem', width: '0.75rem' }} />
                            <span>{msg.processing_time.toFixed(2)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginLeft: '2.75rem' }}>
                    <button
                      onClick={() => toggleSourceExpansion(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
                    >
                      <FileText style={{ height: '1rem', width: '1rem' }} />
                      <span>Sources ({msg.sources.length})</span>
                      {expandedSources[index] ? <ChevronUp style={{ height: '1rem', width: '1rem' }} /> : <ChevronDown style={{ height: '1rem', width: '1rem' }} />}
                    </button>
                    {expandedSources[index] && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {msg.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} style={{ 
                            padding: '0.75rem', 
                            backgroundColor: '#f9fafb', 
                            borderRadius: '0.5rem', 
                            border: '1px solid #e5e7eb',
                            fontSize: '0.875rem' 
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              marginBottom: '0.5rem' 
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                                <span>{source.title || 'Document'}</span>
                                {source.section && <span style={{ color: '#6b7280' }}>({source.section})</span>}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Score: {(source.relevance_score || 0).toFixed(3)}
                              </span>
                            </div>
                            {(source.text_preview || source.excerpt) && (
                              <p style={{ 
                                color: '#374151', 
                                fontSize: '0.75rem', 
                                lineHeight: 1.6, 
                                borderLeft: '2px solid #d1d5db', 
                                paddingLeft: '0.5rem',
                                margin: 0
                              }}>
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
            <div style={{ margin: 'auto', textAlign: 'center', color: '#2563eb' }}>
              <Loader2 style={{ height: '1.5rem', width: '1.5rem', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>Loading chat history...</p>
            </div>
          )}

          {isLoading && chatHistory.some(m => m.role === 'user') && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start', marginTop: '1rem' }}>
              <div style={{ 
                width: '2rem', 
                height: '2rem', 
                borderRadius: '9999px', 
                backgroundColor: '#f3f4f6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0 
              }}>
                <Bot style={{ height: '1rem', width: '1rem', color: '#6b7280' }} />
              </div>
              <div style={{ backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 style={{ height: '1rem', width: '1rem', color: '#6b7280', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
          <div style={{ position: 'relative' }}>
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
              style={{
                width: '100%',
                padding: '0.75rem',
                paddingRight: '3rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                opacity: (!sessionId || isLoading) ? 0.5 : 1,
                cursor: (!sessionId || isLoading) ? 'not-allowed' : 'text'
              }}
              onFocus={(e) => {
                if (sessionId && !isLoading) {
                  e.currentTarget.style.boxShadow = '0 0 0 2px #2563eb';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSendMessage}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: canSendMessage ? 'pointer' : 'not-allowed',
                opacity: canSendMessage ? 1 : 0.5,
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => {
                if (canSendMessage) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseOut={(e) => {
                if (canSendMessage) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
            >
              {isLoading ? (
                <Loader2 style={{ height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send style={{ height: '1rem', width: '1rem' }} />
              )}
            </button>
          </div>

          {/* Example Questions */}
          {sessionId && isInitialQuery && !isLoading && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>Try asking:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  "What is the main legal issue in this case?",
                  "Who are the key parties involved?",
                  "What was the court's decision?",
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => setMessage(question)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      borderRadius: '9999px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
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
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
          padding: '1rem' 
        }}>
          <h4 style={{ fontWeight: 600, color: '#111827', marginBottom: '0.75rem', margin: '0 0 0.75rem 0' }}>Last Query Analysis</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem', 
            fontSize: '0.875rem' 
          }}>
            <div>
              <span style={{ color: '#6b7280' }}>Query Type:</span>
              <div style={{ fontWeight: 500, marginTop: '0.25rem', textTransform: 'capitalize' }}>
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.query_type || 'general'}
              </div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Key Concepts:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.key_concepts?.map((concept) => (
                  <span key={concept} style={{ 
                    padding: '0.25rem 0.5rem', 
                    backgroundColor: '#dbeafe', 
                    color: '#1e40af', 
                    fontSize: '0.75rem', 
                    borderRadius: '0.25rem' 
                  }}>
                    {concept}
                  </span>
                )) || <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>None found</span>}
              </div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Entities Found:</span>
              <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
                {chatHistory.slice().reverse().find(msg => msg.query_analysis)?.query_analysis?.entities?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RAGChat;