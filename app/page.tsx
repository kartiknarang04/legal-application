"use client";

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import FileUpload from '@/components/ui/file-upload';
import NER from '@/components/ui/ner';
import Summary from '@/components/ui/summary';
import RAGChat from '@/components/ui/rag-chat';

// Type definitions - Export these so other components can use them
export type NerResults = {
  total_entities: number;
  unique_labels: string[];
  entity_counts: Record<string, { entities: string[]; count: number }>;
};

export type SummaryResults = {
  summary: string;
  word_count?: number;
  compression_ratio: number;
  sentence_count?: number;
};

export type BackendResults = {
  ner_results: NerResults;
  summary_results: SummaryResults;
};

export type ChatMessage = {
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
  }>;
  confidence?: number;
  query_analysis?: {
    query_type?: string;
    key_concepts?: string[];
    entities?: string[];
  };
  error?: boolean;
};

const LegalDocumentAnalyzer = () => {
  const [activePage, setActivePage] = useState('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [nerResults, setNerResults] = useState<NerResults | null>(null);
  const [summaryResults, setSummaryResults] = useState<SummaryResults | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resetSession = () => {
    setActivePage('upload');
    setSessionId(null);
    setUploadedFile(null);
    setNerResults(null);
    setSummaryResults(null);
    setChatHistory([]);
    setError(null);
  };

  const handleFileUpload = (file: File, session: string) => {
    setUploadedFile(file);
    setSessionId(session);
    setActivePage('ner');
  };

  const navigationItems = [
    { id: 'upload', title: 'Upload', enabled: true },
    { id: 'ner', title: 'Named Entities', enabled: !!sessionId },
    { id: 'summary', title: 'Summary', enabled: !!sessionId },
    { id: 'chat', title: 'AI Chat', enabled: !!sessionId }
  ];

  const renderActivePage = () => {
    switch (activePage) {
      case 'upload':
        return <FileUpload onUpload={handleFileUpload} setError={setError} />;
      case 'ner':
        return (
          <NER 
            sessionId={sessionId}
            nerResults={nerResults}
            setNerResults={setNerResults}
            setError={setError}
          />
        );
      case 'summary':
        return (
          <Summary 
            sessionId={sessionId}
            summaryResults={summaryResults}
            setSummaryResults={setSummaryResults}
            setError={setError}
          />
        );
      case 'chat':
        return (
          <RAGChat 
            sessionId={sessionId}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            setError={setError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', 
        borderBottom: '1px solid #e5e7eb' 
      }}>
        <div style={{ 
          maxWidth: '72rem', 
          margin: '0 auto', 
          padding: '1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '2.5rem', 
              height: '2.5rem', 
              backgroundColor: '#2563eb', 
              borderRadius: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <FileText style={{ height: '1.5rem', width: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                Legal Document Analyzer
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                AI-powered legal document processing and analysis
              </p>
              {/* Display uploaded file name if available */}
              {uploadedFile && (
                <p style={{ fontSize: '0.75rem', color: '#059669', margin: '0.25rem 0 0 0' }}>
                  📄 {uploadedFile.name}
                </p>
              )}
            </div>
          </div>
          {sessionId && (
            <button
              onClick={resetSession}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            >
              New Document
            </button>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
      }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', display: 'flex' }}>
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.enabled && setActivePage(item.id)}
              disabled={!item.enabled}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                borderBottom: '2px solid',
                borderBottomColor: activePage === item.id ? '#2563eb' : 'transparent',
                color: !item.enabled 
                  ? '#9ca3af' 
                  : activePage === item.id 
                    ? '#2563eb' 
                    : '#6b7280',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: item.enabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                opacity: item.enabled ? 1 : 0.5
              }}
              onMouseOver={(e) => {
                if (item.enabled && activePage !== item.id) {
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseOut={(e) => {
                if (item.enabled && activePage !== item.id) {
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Error Display */}
        {error && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '0.5rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
              <span style={{ fontWeight: 500 }}>Error</span>
            </div>
            <p style={{ color: '#b91c1c', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>{error}</p>
          </div>
        )}

        {renderActivePage()}
      </div>
    </div>
  );
};

export default LegalDocumentAnalyzer;