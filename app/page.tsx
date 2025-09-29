"use client";

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import FileUpload from '@/components/ui/file-upload';
import NER from '@/components/ui/ner';
import Summary from '@/components/ui/summary';
import RAGChat from '@/components/ui/rag-chat';

// Type definitions
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Legal Document Analyzer
              </h1>
              <p className="text-sm text-gray-600">
                AI-powered legal document processing and analysis
              </p>
              {uploadedFile && (
                <p className="text-xs text-green-600 mt-1">
                  📄 {uploadedFile.name}
                </p>
              )}
            </div>
          </div>
          {sessionId && (
            <button
              onClick={resetSession}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg border-none cursor-pointer transition-colors hover:bg-gray-200"
            >
              New Document
            </button>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto flex">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.enabled && setActivePage(item.id)}
              disabled={!item.enabled}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                activePage === item.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              } ${
                !item.enabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:text-gray-900'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-900">
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-800 mt-1">{error}</p>
          </div>
        )}

        {renderActivePage()}
      </div>
    </div>
  );
};

export default LegalDocumentAnalyzer;