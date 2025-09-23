"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, Brain, MessageSquare, Loader2, CheckCircle, AlertCircle, Send, Bot, User, ChevronDown, ChevronUp, Copy, Check, Database, Users, Building, Gavel, Sparkles, Eye } from 'lucide-react';
import axios from 'axios';


// Environment configuration
const BACKEND_1_URL = process.env.NEXT_PUBLIC_BACKEND_1_URL || 'http://localhost:7860';
const BACKEND_2_URL = process.env.NEXT_PUBLIC_BACKEND_2_URL || 'http://localhost:7861';

// Main App Component
const LegalDocumentAnalyzer = () => {
  const [currentStep, setCurrentStep] = useState('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [, setUploadedFile] = useState<File | null>(null);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Legal Document Analyzer</h1>
                <p className="text-sm text-gray-500">AI-powered legal document processing and analysis</p>
              </div>
            </div>
            {sessionId && (
              <button
                onClick={resetSession}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                New Document
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <StepIndicator 
            title="Upload" 
            icon={Upload} 
            active={currentStep === 'upload'} 
            completed={sessionId !== null}
          />
          <div className="flex-1 h-px bg-gray-200 mx-4" />
          <StepIndicator 
            title="Process" 
            icon={Brain} 
            active={currentStep === 'processing'} 
            completed={processingStatus === 'completed'}
          />
          <div className="flex-1 h-px bg-gray-200 mx-4" />
          <StepIndicator 
            title="Results" 
            icon={Eye} 
            active={currentStep === 'results'} 
            completed={nerResults !== null && summaryResults !== null}
          />
          <div className="flex-1 h-px bg-gray-200 mx-4" />
          <StepIndicator 
            title="Chat" 
            icon={MessageSquare} 
            active={currentStep === 'chat'} 
            completed={false}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
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
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  completed: boolean;
};

const StepIndicator = ({ title, icon: Icon, active, completed }: StepIndicatorProps) => (
  <div className="flex flex-col items-center">
    <div className={`
      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
      ${completed ? 'bg-green-100 border-green-500 text-green-600' :
        active ? 'bg-blue-100 border-blue-500 text-blue-600' :
        'bg-gray-100 border-gray-300 text-gray-400'}
    `}>
      {completed ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
    </div>
    <span className={`mt-2 text-sm font-medium ${
      completed ? 'text-green-600' :
      active ? 'text-blue-600' :
      'text-gray-500'
    }`}>
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
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Legal Document</h2>
        <p className="text-gray-600">Upload your legal document to begin AI analysis</p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.docx,.doc"
          onChange={handleChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
            <div>
              <p className="text-lg font-medium text-gray-900">Uploading document...</p>
              <p className="text-gray-500">Please wait while we process your file</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-900">Drop your document here</p>
              <p className="text-gray-500">or click to browse files</p>
            </div>
            <div className="text-sm text-gray-400">
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
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Document</h2>
        <p className="text-gray-600">Running NER, summarization, and embedding models</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          {processingStatus === 'completed' ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : processingStatus === 'failed' ? (
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          ) : (
            <Brain className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-pulse" />
          )}
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{getStatusText()}</h3>
          <p className="text-gray-500">Session ID: {sessionId}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Processing Steps */}
        <div className="space-y-3">
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
  <div className={`flex items-center p-3 rounded-lg ${
    completed ? 'bg-green-50' : active ? 'bg-blue-50' : 'bg-gray-50'
  }`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
      completed ? 'bg-green-500' : active ? 'bg-blue-500' : 'bg-gray-300'
    }`}>
      {completed ? (
        <CheckCircle className="h-4 w-4 text-white" />
      ) : active ? (
        <Loader2 className="h-4 w-4 text-white animate-spin" />
      ) : (
        <div className="w-2 h-2 bg-white rounded-full" />
      )}
    </div>
    <div>
      <h4 className={`font-medium ${
        completed ? 'text-green-800' : active ? 'text-blue-800' : 'text-gray-600'
      }`}>
        {title}
      </h4>
      <p className={`text-sm ${
        completed ? 'text-green-600' : active ? 'text-blue-600' : 'text-gray-500'
      }`}>
        {description}
      </p>
    </div>
  </div>
);

// Results Display Component
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

  const entityIcons: Record<string, typeof FileText> = {
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

  const entityColors: Record<string, string> = {
    PERSON: "bg-blue-100 text-blue-800 border-blue-200",
    ORG: "bg-green-100 text-green-800 border-green-200",
    PRECEDENT: "bg-purple-100 text-purple-800 border-purple-200",
    STATUTE: "bg-orange-100 text-orange-800 border-orange-200",
    COURT: "bg-red-100 text-red-800 border-red-200",
    JUDGE: "bg-indigo-100 text-indigo-800 border-indigo-200",
    LAWYER: "bg-cyan-100 text-cyan-800 border-cyan-200",
    CASE: "bg-yellow-100 text-yellow-800 border-yellow-200",
    DATE: "bg-gray-100 text-gray-800 border-gray-200",
    MONEY: "bg-emerald-100 text-emerald-800 border-emerald-200",
    GPE: "bg-pink-100 text-pink-800 border-pink-200",
    LAW: "bg-violet-100 text-violet-800 border-violet-200",
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Analysis Results</h2>
        <p className="text-gray-600">Your document has been analyzed successfully</p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onStartChat}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <MessageSquare className="h-5 w-5" />
          Start AI Chat
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'summary'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Summary
              </div>
            </button>
            <button
              onClick={() => setActiveTab('entities')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'entities'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Named Entities ({nerResults?.total_entities || 0})
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'summary' && summaryResults && (
            <div className="space-y-6">
              {/* Summary Content */}
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Document Summary</h3>
                  <button
                    onClick={() => copyToClipboard(summaryResults.summary)}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {summaryResults.summary}
                  </p>
                </div>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{summaryResults.word_count || 0}</div>
                  <div className="text-sm text-gray-500">Original Words</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {summaryResults.summary?.split(' ').length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Summary Words</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(summaryResults.compression_ratio * 100) || 0}%
                  </div>
                  <div className="text-sm text-gray-500">Compression</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {summaryResults.sentence_count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Sentences</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entities' && nerResults && (
            <div className="space-y-6">
              {/* Entity Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{nerResults.total_entities}</div>
                  <div className="text-sm text-gray-500">Total Entities</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{nerResults.unique_labels?.length || 0}</div>
                  <div className="text-sm text-gray-500">Entity Types</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                {Object.values(nerResults.entity_counts || {}).reduce((sum: number, cat: { entities: string[]; count: number }) => sum + (cat.entities?.length || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-500">Unique Entities</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
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
                  <div className="text-sm text-gray-500">Repetition</div>
                </div>
              </div>

              {/* Entity Categories */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(nerResults.entity_counts || {}).map(([label, data]: [string, { entities: string[]; count: number }]) => {
                  const Icon = entityIcons[label as keyof typeof entityIcons] || FileText;
                  const colorClass = entityColors[label as keyof typeof entityColors] || "bg-gray-100 text-gray-800 border-gray-200";

                  return (
                    <div key={label} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-5 w-5" />
                        <h4 className="font-semibold text-gray-900">{label}</h4>
                        <span className="text-sm text-gray-500 ml-auto">
                          {data.count} unique
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {data.entities?.slice(0, 20).map((entity, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full border ${colorClass}`}
                          >
                            {entity}
                          </span>
                        ))}
                        {data.entities?.length > 20 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
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

// Chat Interface Component
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Legal Assistant</h2>
        <p className="text-gray-600">Ask questions about your document using natural language</p>
      </div>

      {/* RAG Status */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${ragInitialized ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="font-medium text-gray-900">
              {ragInitialized ? 'RAG System Ready' : 'Initializing RAG System...'}
            </span>
            <span className="text-sm text-gray-500">Session: {sessionId}</span>
          </div>
          {ragInitialized && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Database className="h-4 w-4" />
              <span>Advanced Legal RAG Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-xl shadow-lg flex flex-col h-96">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Ask questions about your legal document to get started</p>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className="space-y-2">
                <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
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
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-gray-100'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      <div className="text-xs opacity-70 mt-2">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                        {msg.confidence && (
                          <span className="ml-2">• Confidence: {Math.round(msg.confidence)}%</span>
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
                                  <span className="text-gray-500">({source.section})</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                Score: {(source.relevance_score || 0).toFixed(3)}
                              </span>
                            </div>
                            
                            {source.text_preview && (
                              <p className="text-gray-700 text-xs leading-relaxed">
                                {source.text_preview}
                              </p>
                            )}
                            
                            {source.entities && source.entities.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Entities:</div>
                                <div className="flex flex-wrap gap-1">
                                  {source.entities.slice(0, 5).map((entity, entityIndex) => (
                                    <span
                                      key={entityIndex}
                                      className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
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
                  <span className="text-sm text-gray-600">Analyzing document...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-gray-200 p-4">
          {!ragInitialized && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                RAG system is initializing. Please wait before sending messages.
              </div>
            </div>
          )}

          <div className="flex gap-2">
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !message.trim() || !ragInitialized}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Example Questions */}
          {ragInitialized && chatHistory.length === 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-2">Try asking:</div>
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

      {/* Query Analysis (if available) */}
      {chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.query_analysis && (
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Query Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Query Type:</span>
              <div className="font-medium">
                {chatHistory[chatHistory.length - 1]?.query_analysis?.query_type || 'general'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Key Concepts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {chatHistory[chatHistory.length - 1]?.query_analysis?.key_concepts?.map((concept: string, index: number) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Entities Found:</span>
              <div className="font-medium">
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