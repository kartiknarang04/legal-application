"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, Brain, MessageSquare, Loader2, CheckCircle, AlertCircle, Send, Bot, User, ChevronDown, ChevronUp, Copy, Check, Database, Users, Building, Gavel, Sparkles, Eye } from 'lucide-react';
import axios from 'axios';

// Environment configuration
const BACKEND_1_URL = process.env.NEXT_PUBLIC_BACKEND_1_URL || 'http://localhost:7860';
const BACKEND_2_URL = process.env.NEXT_PUBLIC_BACKEND_2_URL || 'http://localhost:7861';

// Type definitions
type NerResults = {
  total_entities: number;
  unique_labels: string[];
  entity_counts: Record<string, { entities: string[]; count: number }>;
};

type SummaryResults = {
  summary: string;
  word_count?: number;
  compression_ratio: number;
  sentence_count?: number;
};

type BackendResults = {
  ner_results: NerResults;
  summary_results: SummaryResults;
};

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
  }>;
  confidence?: number;
  query_analysis?: {
    query_type?: string;
    key_concepts?: string[];
    entities?: string[];
  };
  error?: boolean;
};

// Main App Component
const LegalDocumentAnalyzer = () => {
  const [currentStep, setCurrentStep] = useState('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [nerResults, setNerResults] = useState<NerResults | null>(null);
  const [summaryResults, setSummaryResults] = useState<SummaryResults | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset function for new session
  const resetSession = () => {
    setCurrentStep('upload');
    setSessionId(null);
    setUploadedFile(null);
    setProcessingStatus(null);
    setNerResults(null);
    setSummaryResults(null);
    setChatHistory([]);
    setError(null);
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

      {/* Progress Steps */}
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <StepIndicator 
            title="Upload" 
            icon={Upload} 
            active={currentStep === 'upload'} 
            completed={sessionId !== null}
          />
          <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db', margin: '0 1rem' }} />
          <StepIndicator 
            title="Process" 
            icon={Brain} 
            active={currentStep === 'processing'} 
            completed={processingStatus === 'completed'}
          />
          <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db', margin: '0 1rem' }} />
          <StepIndicator 
            title="Results" 
            icon={Eye} 
            active={currentStep === 'results'} 
            completed={nerResults !== null && summaryResults !== null}
          />
          <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db', margin: '0 1rem' }} />
          <StepIndicator 
            title="Chat" 
            icon={MessageSquare} 
            active={currentStep === 'chat'} 
            completed={false}
          />
        </div>

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
              <AlertCircle style={{ height: '1.25rem', width: '1.25rem' }} />
              <span style={{ fontWeight: 500 }}>Error</span>
            </div>
            <p style={{ color: '#b91c1c', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>{error}</p>
          </div>
        )}

        {/* Main Content */}
        {currentStep === 'upload' && (
          <FileUploader 
            onUpload={(file, session) => {
              setUploadedFile(file);
              setSessionId(session);
              setCurrentStep('processing');
            }}
            setError={(msg) => setError(msg)}
            setIsLoading={(val) => setIsLoading(val)}
            isLoading={isLoading}
          />
        )}

        {currentStep === 'processing' && (
          <ProcessingMonitor 
            sessionId={sessionId}
            onComplete={(results) => {
              setNerResults(results.ner_results);
              setSummaryResults(results.summary_results);
              setProcessingStatus('completed');
              setCurrentStep('results');
            }}
            processingStatus={processingStatus}
            setProcessingStatus={(status) => setProcessingStatus(status)}
            setError={(msg) => setError(msg)}
          />
        )}

        {currentStep === 'results' && (
          <ResultsDisplay 
            nerResults={nerResults}
            summaryResults={summaryResults}
            sessionId={sessionId}
            onStartChat={() => setCurrentStep('chat')}
          />
        )}

        {currentStep === 'chat' && (
          <ChatInterface 
            sessionId={sessionId}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            setError={(msg) => setError(msg)}
          />
        )}
      </div>
    </div>
  );
};

// Step Indicator Component
type StepIndicatorProps = {
  title: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  active: boolean;
  completed: boolean;
};

const StepIndicator = ({ title, icon: Icon, active, completed }: StepIndicatorProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{
      width: '3rem',
      height: '3rem',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid',
      borderColor: completed ? '#10b981' : active ? '#2563eb' : '#d1d5db',
      backgroundColor: completed ? '#d1fae5' : active ? '#dbeafe' : '#f3f4f6',
      color: completed ? '#065f46' : active ? '#1d4ed8' : '#9ca3af',
      transition: 'all 0.2s'
    }}>
      {completed ? <CheckCircle style={{ height: '1.5rem', width: '1.5rem' }} /> : <Icon style={{ height: '1.5rem', width: '1.5rem' }} />}
    </div>
    <span style={{
      marginTop: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: completed ? '#065f46' : active ? '#1d4ed8' : '#6b7280'
    }}>
      {title}
    </span>
  </div>
);

// File Uploader Component
type FileUploaderProps = {
  onUpload: (file: File, sessionId: string) => void;
  setError: (msg: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
};

const FileUploader = ({ onUpload, setError, setIsLoading, isLoading }: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ['.pdf', '.txt', '.docx', '.doc'];
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const fileExt = '.' + (ext ? ext.toLowerCase() : '');
    
    if (!allowedTypes.includes(fileExt)) {
      setError(`Unsupported file type. Please upload: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${BACKEND_1_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        onUpload(file, response.data.session_id);
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || (error as Error).message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '32rem', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          Upload Legal Document
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Upload your legal document to begin AI analysis</p>
      </div>

      <div
        style={{
          position: 'relative',
          border: '2px dashed',
          borderColor: dragActive ? '#2563eb' : '#d1d5db',
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.5 : 1,
          backgroundColor: dragActive ? '#dbeafe' : 'white',
          transition: 'all 0.2s'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        onMouseOver={(e) => {
          if (!isLoading && !dragActive) {
            e.currentTarget.style.borderColor = '#9ca3af';
          }
        }}
        onMouseOut={(e) => {
          if (!dragActive) {
            e.currentTarget.style.borderColor = '#d1d5db';
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.txt,.docx,.doc"
          onChange={handleChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Loader2 style={{ 
              height: '3rem', 
              width: '3rem', 
              color: '#2563eb', 
              animation: 'spin 1s linear infinite' 
            }} />
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 500, color: '#111827', margin: '0 0 0.5rem 0' }}>
                Uploading document...
              </p>
              <p style={{ color: '#6b7280', margin: 0 }}>Please wait while we process your file</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Upload style={{ height: '3rem', width: '3rem', color: '#9ca3af' }} />
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 500, color: '#111827', margin: '0 0 0.5rem 0' }}>
                Drop your document here
              </p>
              <p style={{ color: '#6b7280', margin: 0 }}>or click to browse files</p>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              Supports: PDF, TXT, DOCX, DOC (max 50MB)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Processing Monitor Component  
type ProcessingMonitorProps = {
  sessionId: string | null;
  onComplete: (results: BackendResults) => void;
  processingStatus: string | null;
  setProcessingStatus: (status: string | null) => void;
  setError: (msg: string | null) => void;
};

const ProcessingMonitor = ({ sessionId, onComplete, processingStatus, setProcessingStatus, setError }: ProcessingMonitorProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    const checkStatus = async () => {
      try {
        const response = await axios.get(`${BACKEND_1_URL}/status/${sessionId}`);
        const session = response.data.session;
        
        setProcessingStatus(session.status);

        // Update progress based on status
        switch (session.status) {
          case 'uploaded':
            setProgress(25);
            break;
          case 'processing':
            setProgress(50);
            break;
          case 'completed':
            setProgress(100);
            // Get results
            const resultsResponse = await axios.get(`${BACKEND_1_URL}/results/${sessionId}`);
            if (resultsResponse.data.success) {
              onComplete(resultsResponse.data);
            }
            return; // Stop polling
          case 'failed':
            setError(session.error || 'Processing failed');
            return; // Stop polling
          default:
            setProgress(10);
        }

        // Continue polling if not completed or failed
        setTimeout(checkStatus, 2000);
      } catch (error: unknown) {
        const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || 'Failed to check processing status');
      }
    };

    checkStatus();
  }, [sessionId, onComplete, setError, setProcessingStatus]);

  const getStatusText = () => {
    switch (processingStatus) {
      case 'uploaded':
        return 'Document uploaded successfully';
      case 'processing':
        return 'Analyzing document with AI models...';
      case 'completed':
        return 'Analysis completed successfully!';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Initializing...';
    }
  };

  return (
    <div style={{ maxWidth: '32rem', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          Processing Document
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Running NER, summarization, and embedding models</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {processingStatus === 'completed' ? (
            <CheckCircle style={{ height: '4rem', width: '4rem', color: '#10b981', margin: '0 auto 1rem auto' }} />
          ) : processingStatus === 'failed' ? (
            <AlertCircle style={{ height: '4rem', width: '4rem', color: '#ef4444', margin: '0 auto 1rem auto' }} />
          ) : (
            <Brain style={{ 
              height: '4rem', 
              width: '4rem', 
              color: '#2563eb', 
              margin: '0 auto 1rem auto',
              animation: 'pulse 2s infinite'
            }} />
          )}
          
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
            {getStatusText()}
          </h3>
          <p style={{ color: '#6b7280', margin: 0 }}>Session ID: {sessionId}</p>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '0.5rem' }}>
            <div 
              style={{ 
                backgroundColor: '#2563eb', 
                height: '0.5rem', 
                borderRadius: '9999px', 
                transition: 'width 0.5s ease-out',
                width: `${progress}%`
              }}
            />
          </div>
        </div>

        {/* Processing Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ProcessingStep 
            title="Named Entity Recognition"
            description="Extracting legal entities, cases, and references"
            completed={progress > 25}
            active={progress > 10 && progress <= 50}
          />
          <ProcessingStep 
            title="Document Summarization"
            description="Generating concise summary with key points"
            completed={progress > 50}
            active={progress > 25 && progress <= 75}
          />
          <ProcessingStep 
            title="Embedding Generation"
            description="Creating semantic embeddings for search"
            completed={progress > 75}
            active={progress > 50 && progress <= 100}
          />
        </div>
      </div>
    </div>
  );
};

// Processing Step Component
type ProcessingStepProps = {
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
};

const ProcessingStep = ({ title, description, completed, active }: ProcessingStepProps) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    backgroundColor: completed ? '#d1fae5' : active ? '#dbeafe' : '#f9fafb'
  }}>
    <div style={{
      width: '1.5rem',
      height: '1.5rem',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '0.75rem',
      backgroundColor: completed ? '#10b981' : active ? '#2563eb' : '#d1d5db'
    }}>
      {completed ? (
        <CheckCircle style={{ height: '1rem', width: '1rem', color: 'white' }} />
      ) : active ? (
        <Loader2 style={{ height: '1rem', width: '1rem', color: 'white', animation: 'spin 1s linear infinite' }} />
      ) : (
        <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: 'white', borderRadius: '50%' }} />
      )}
    </div>
    <div>
      <h4 style={{
        fontWeight: 500,
        color: completed ? '#064e3b' : active ? '#1e3a8a' : '#6b7280',
        margin: '0 0 0.25rem 0'
      }}>
        {title}
      </h4>
      <p style={{
        fontSize: '0.875rem',
        color: completed ? '#065f46' : active ? '#2563eb' : '#6b7280',
        margin: 0
      }}>
        {description}
      </p>
    </div>
  </div>
);

// Results Display Component - FULL VERSION
type ResultsDisplayProps = {
  nerResults: NerResults | null;
  summaryResults: SummaryResults | null;
  sessionId: string | null;
  onStartChat: () => void;
};

const ResultsDisplay = ({ nerResults, summaryResults, sessionId, onStartChat }: ResultsDisplayProps) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const entityIcons: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
    PERSON: Users,
    ORG: Building,
    PRECEDENT: Gavel,
    STATUTE: FileText,
    COURT: Building,
    JUDGE: Users,
    LAWYER: Users,
    CASE: FileText,
    DATE: FileText,
    MONEY: FileText,
    GPE: Building,
    LAW: FileText,
  };

  const entityColors: Record<string, { bg: string; text: string; border: string }> = {
    PERSON: { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
    ORG: { bg: '#d1fae5', text: '#065f46', border: '#86efac' },
    PRECEDENT: { bg: '#e9d5ff', text: '#581c87', border: '#c4b5fd' },
    STATUTE: { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
    COURT: { bg: '#fecaca', text: '#991b1b', border: '#f87171' },
    JUDGE: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    LAWYER: { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
    CASE: { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
    DATE: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
    MONEY: { bg: '#d1fae5', text: '#047857', border: '#6ee7b7' },
    GPE: { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
    LAW: { bg: '#ede9fe', text: '#6b21a8', border: '#c4b5fd' },
  };

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: '1rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderBottom: '2px solid',
    borderBottomColor: active ? '#2563eb' : 'transparent',
    color: active ? '#2563eb' : '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          Analysis Results
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Your document has been analyzed successfully</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <button
          onClick={onStartChat}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem',
            fontWeight: 500
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          <MessageSquare style={{ height: '1.25rem', width: '1.25rem' }} />
          Start AI Chat
        </button>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex' }}>
            <button
              onClick={() => setActiveTab('summary')}
              style={buttonStyle(activeTab === 'summary')}
              onMouseOver={(e) => {
                if (activeTab !== 'summary') {
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'summary') {
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              <Sparkles style={{ height: '1rem', width: '1rem' }} />
              Summary
            </button>
            <button
              onClick={() => setActiveTab('entities')}
              style={buttonStyle(activeTab === 'entities')}
              onMouseOver={(e) => {
                if (activeTab !== 'entities') {
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'entities') {
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              <Users style={{ height: '1rem', width: '1rem' }} />
              Named Entities ({nerResults?.total_entities || 0})
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {activeTab === 'summary' && summaryResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Summary Content */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>Document Summary</h3>
                  <button
                    onClick={() => copyToClipboard(summaryResults.summary)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
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
                    {copied ? <Check style={{ height: '1rem', width: '1rem' }} /> : <Copy style={{ height: '1rem', width: '1rem' }} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div>
                  <p style={{ color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {summaryResults.summary}
                  </p>
                </div>
              </div>

              {/* Summary Statistics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.25rem' }}>
                    {summaryResults.word_count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Original Words</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
                    {summaryResults.summary?.split(' ').length || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Summary Words</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.25rem' }}>
                    {Math.round(summaryResults.compression_ratio * 100) || 0}%
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Compression</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.25rem' }}>
                    {summaryResults.sentence_count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sentences</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entities' && nerResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Entity Statistics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.25rem' }}>
                    {nerResults.total_entities}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Entities</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
                    {nerResults.unique_labels?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Entity Types</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.25rem' }}>
                    {Object.values(nerResults.entity_counts || {}).reduce((sum: number, cat: { entities: string[]; count: number }) => sum + (cat.entities?.length || 0), 0)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Unique Entities</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.25rem' }}>
                    {Math.round(
                      (nerResults.total_entities /
                        Math.max(
                          Object.values(nerResults.entity_counts || {}).reduce(
                            (sum: number, cat: { entities: string[]; count: number }) => sum + (cat.entities?.length || 0),
                            0
                          ),
                          1
                        )) * 100
                    )}%
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Repetition</div>
                </div>
              </div>

              {/* Entity Categories */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {Object.entries(nerResults.entity_counts || {}).map(([label, data]: [string, { entities: string[]; count: number }]) => {
                  const Icon = entityIcons[label as keyof typeof entityIcons] || FileText;
                  const colors = entityColors[label as keyof typeof entityColors] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };

                  return (
                    <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Icon style={{ height: '1.25rem', width: '1.25rem' }} />
                        <h4 style={{ fontWeight: 600, color: '#111827', margin: 0 }}>{label}</h4>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: 'auto' }}>
                          {data.count} unique
                        </span>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem', 
                        maxHeight: '8rem', 
                        overflowY: 'auto'
                      }}>
                        {data.entities?.slice(0, 20).map((entity, index) => (
                          <span
                            key={index}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              borderRadius: '9999px',
                              border: `1px solid ${colors.border}`,
                              backgroundColor: colors.bg,
                              color: colors.text
                            }}
                          >
                            {entity}
                          </span>
                        ))}
                        {data.entities?.length > 20 && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.25rem 0.5rem' }}>
                            +{data.entities.length - 20} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Chat Interface Component - FULL VERSION
type ChatInterfaceProps = {
  sessionId: string | null;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: (msg: string | null) => void;
};

const ChatInterface = ({ sessionId, chatHistory, setChatHistory, setError }: ChatInterfaceProps) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ragInitialized, setRagInitialized] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const initializeRAG = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${BACKEND_2_URL}/init/${sessionId}`, {});
      if (response.data.success) {
        setRagInitialized(true);
      } else {
        throw new Error(response.data.message || 'RAG initialization failed');
      }
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(`RAG initialization failed: ${detail || (error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, setError]);

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_2_URL}/history/${sessionId}`);
      if (response.data.success) {
        setChatHistory(response.data.chat_history);
      }
    } catch (error: unknown) {
      console.error('Failed to load chat history:', error);
      // Don't show error for missing history, it's normal for new sessions
    }
  }, [sessionId, setChatHistory]);

  useEffect(() => {
    // Initialize RAG system for this session
    initializeRAG();
    // Load existing chat history
    loadChatHistory();
  }, [initializeRAG, loadChatHistory]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const sendMessage = async () => {
    if (!message.trim() || isLoading || !ragInitialized) return;

    const userMessage: ChatMessage = {
      role: 'user',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${BACKEND_2_URL}/chat/${sessionId}`, {
        message: userMessage.message
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
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(`Chat failed: ${detail || (error as Error).message}`);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        message: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date().toISOString(),
        error: true
      };
      setChatHistory(prev => [...prev, errorMessage]);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          AI Legal Assistant
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Ask questions about your document using natural language</p>
      </div>

      {/* RAG Status */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '0.75rem', 
              height: '0.75rem', 
              borderRadius: '50%', 
              backgroundColor: ragInitialized ? '#10b981' : '#f59e0b' 
            }} />
            <span style={{ fontWeight: 500, color: '#111827' }}>
              {ragInitialized ? 'RAG System Ready' : 'Initializing RAG System...'}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Session: {sessionId}</span>
          </div>
          {ragInitialized && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
              <Database style={{ height: '1rem', width: '1rem' }} />
              <span>Advanced Legal RAG Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', display: 'flex', flexDirection: 'column', height: '24rem' }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {chatHistory.length === 0 ? (
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
                        {msg.confidence && (
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
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Analyzing document...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
          {!ragInitialized && (
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#92400e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle style={{ height: '1rem', width: '1rem' }} />
                RAG system is initializing. Please wait before sending messages.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                ragInitialized
                  ? "Ask a question about your legal document..."
                  : "Initializing AI system..."
              }
              disabled={isLoading || !ragInitialized}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                opacity: (isLoading || !ragInitialized) ? 0.5 : 1,
                cursor: (isLoading || !ragInitialized) ? 'not-allowed' : 'text'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !message.trim() || !ragInitialized}
              style={{
                padding: '0.75rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: (isLoading || !message.trim() || !ragInitialized) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !message.trim() || !ragInitialized) ? 0.5 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => {
                if (!isLoading && message.trim() && ragInitialized) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading && message.trim() && ragInitialized) {
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
          {ragInitialized && chatHistory.length === 0 && (
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
                ))}
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

export default LegalDocumentAnalyzer;