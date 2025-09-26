// components/ui/rag-chat.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Send, Bot, User, ChevronDown, ChevronUp, FileText, Database } from 'lucide-react';
import axios from 'axios';
import type { ChatMessage } from '../../app/page';

const BACKEND_2_URL = process.env.NEXT_PUBLIC_BACKEND_2_URL || 'https://kn29-rag-chat.hf.space';

type RAGChatProps = {
  sessionId: string | null;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: (msg: string | null) => void;
};

const RAGChat = ({ sessionId, chatHistory, setChatHistory, setError }: RAGChatProps) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    
    const loadChatHistory = async () => {
      try {
        const response = await axios.get(`${BACKEND_2_URL}/history/${sessionId}`);
        if (response.data.chat_history) {
          setChatHistory(response.data.chat_history.map((msg: any) => ({
            role: msg.role,
            message: msg.message,
            timestamp: msg.created_at || new Date().toISOString(),
            sources: msg.sources || [],
            confidence: msg.confidence,
            query_analysis: msg.query_analysis
          })));
        }
      } catch (error: unknown) {
        console.error('Failed to load chat history:', error);
        // Don't show error to user for history loading failure
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
    setMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${BACKEND_2_URL}/chat/${sessionId}`, {
        message: userMessage.message
      }, {
        timeout: 60000, // 60 second timeout for chat requests
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          message: response.data.answer,
          timestamp: new Date().toISOString(),
          sources: response.data.sources || [],
          confidence: response.data.confidence,
          query_analysis: response.data.query_analysis
        };

        setChatHistory(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.data.message || 'Chat failed');
      }
    } catch (error: unknown) {
      console.error('Chat error:', error);
      
      let errorMessage = 'Sorry, I encountered an error processing your question.';
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. The system may be loading your document. Please try again.';
        } else if (error.response?.data?.detail) {
          errorMessage = `Error: ${error.response.data.detail}`;
        }
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
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          AI Legal Assistant
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Ask questions about your document using natural language</p>
      </div>

      {/* Session Status */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '0.75rem', 
              height: '0.75rem', 
              borderRadius: '50%', 
              backgroundColor: sessionId ? '#10b981' : '#f59e0b' 
            }} />
            <span style={{ fontWeight: 500, color: '#111827' }}>
              {sessionId ? 'Ready to Chat' : 'Waiting for Session'}
            </span>
            {sessionId && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Session: {sessionId.slice(-8)}</span>
            )}
          </div>
          {sessionId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
              <Database style={{ height: '1rem', width: '1rem' }} />
              <span>RAG System Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', display: 'flex', flexDirection: 'column', height: '24rem' }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!sessionId ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <MessageSquare style={{ height: '3rem', width: '3rem', margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <p style={{ marginBottom: '0.5rem', margin: 0 }}>No session available</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Upload a document first to start chatting</p>
            </div>
          ) : chatHistory.length === 0 && !isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <MessageSquare style={{ height: '3rem', width: '3rem', margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <p style={{ marginBottom: '0.5rem', margin: 0 }}>No messages yet</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Ask questions about your legal document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    maxWidth: '80%',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                  }}>
                    <div style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: msg.role === 'user' 
                        ? '#2563eb'
                        : msg.error 
                          ? '#fef2f2'
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
                      color: msg.role === 'user' ? 'white' : '#111827',
                      border: msg.error ? '1px solid #fecaca' : 'none'
                    }}>
                      <p style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {msg.message}
                      </p>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.5rem' }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                        {msg.confidence != null && (
                          <span style={{ marginLeft: '0.5rem' }}>• Confidence: {Math.round(msg.confidence)}%</span>
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
                        transition: 'color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
                    >
                      <FileText style={{ height: '1rem', width: '1rem' }} />
                      <span>Sources ({msg.sources.length})</span>
                      {expandedSources[index] ? (
                        <ChevronUp style={{ height: '1rem', width: '1rem' }} />
                      ) : (
                        <ChevronDown style={{ height: '1rem', width: '1rem' }} />
                      )}
                    </button>
                    
                    {expandedSources[index] && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {msg.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'white', borderRadius: '0.25rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                  {source.chunk_id || `Chunk ${sourceIndex + 1}`}
                                </span>
                                <span style={{ fontWeight: 500 }}>{source.title || 'Document'}</span>
                                {source.section && (
                                  <span style={{ color: '#6b7280' }}>({source.section})</span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Score: {(source.relevance_score || 0).toFixed(3)}
                              </span>
                            </div>
                            
                            {source.text_preview && (
  <p style={{ color: '#374151', fontSize: '0.75rem', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
    {source.text_preview}
  </p>
)}
                            
                            {source.entities && source.entities.length > 0 && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Entities:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {source.entities.slice(0, 5).map((entity, entityIndex) => (
                                    <span
                                      key={entityIndex}
                                      style={{ padding: '0.125rem 0.25rem', backgroundColor: '#dbeafe', color: '#1e3a8a', fontSize: '0.75rem', borderRadius: '0.25rem' }}
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
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot style={{ height: '1rem', width: '1rem', color: '#6b7280' }} />
              </div>
              <div style={{ backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 style={{ height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {chatHistory.length === 0 ? 'Loading your document...' : 'Analyzing document...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !sessionId
                  ? "Upload a document first..."
                  : "Ask a question about your legal document..."
              }
              disabled={!canSendMessage && !message.trim()}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                opacity: (!sessionId || isLoading) ? 0.5 : 1,
                cursor: (!sessionId || isLoading) ? 'not-allowed' : 'text'
              }}
              onFocus={(e) => {
                if (sessionId && !isLoading) {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSendMessage}
              style={{
                padding: '0.75rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.5rem',
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
          {sessionId && chatHistory.length === 0 && !isLoading && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>Try asking:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  "What is the main legal issue in this case?",
                  "Who are the key parties involved?",
                  "What was the court's decision?",
                  "What precedents were cited?"
                ].map((question, index) => (
                  <button
                    key={index}
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

      {/* Query Analysis (if available) */}
      {chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.query_analysis && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}>
          <h4 style={{ fontWeight: 600, color: '#111827', marginBottom: '0.75rem', margin: '0 0 0.75rem 0' }}>Query Analysis</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Query Type:</span>
              <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
                {chatHistory[chatHistory.length - 1]?.query_analysis?.query_type || 'general'}
              </div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Key Concepts:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                {chatHistory[chatHistory.length - 1]?.query_analysis?.key_concepts?.map((concept: string, index: number) => (
                  <span key={index} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#dbeafe', color: '#1e3a8a', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    {concept}
                  </span>
                )) || <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>None found</span>}
              </div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Entities Found:</span>
              <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
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