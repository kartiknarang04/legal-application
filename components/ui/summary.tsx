// components/ui/summary.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';
import axios from 'axios';
import type { SummaryResults } from '../../app/page';

const BACKEND_1_URL = process.env.NEXT_PUBLIC_BACKEND_1_URL || 'http://localhost:7860';

type SummaryProps = {
  sessionId: string | null;
  summaryResults: SummaryResults | null;
  setSummaryResults: (results: SummaryResults) => void;
  setError: (msg: string | null) => void;
};

const Summary = ({ sessionId, summaryResults, setSummaryResults, setError }: SummaryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
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

  useEffect(() => {
    if (!sessionId || summaryResults) return;

    const fetchSummaryResults = async () => {
      setIsLoading(true);
      try {
        const statusResponse = await axios.get(`${BACKEND_1_URL}/status/${sessionId}`);
        const session = statusResponse.data.session;
        
        setProcessingStatus(session.status);

        if (session.status === 'completed') {
          const resultsResponse = await axios.get(`${BACKEND_1_URL}/results/${sessionId}`);
          if (resultsResponse.data.success) {
            setSummaryResults(resultsResponse.data.summary_results);
          }
        } else if (session.status === 'processing' || session.status === 'uploaded') {
          const pollStatus = async () => {
            try {
              const response = await axios.get(`${BACKEND_1_URL}/status/${sessionId}`);
              const currentSession = response.data.session;
              
              setProcessingStatus(currentSession.status);

              if (currentSession.status === 'completed') {
                const resultsResponse = await axios.get(`${BACKEND_1_URL}/results/${sessionId}`);
                if (resultsResponse.data.success) {
                  setSummaryResults(resultsResponse.data.summary_results);
                }
                return;
              } else if (currentSession.status === 'failed') {
                setError(currentSession.error || 'Processing failed');
                return;
              }

              setTimeout(pollStatus, 2000);
            } catch (error) {
              console.error('Error polling status:', error);
            }
          };
          setTimeout(pollStatus, 2000);
        } else if (session.status === 'failed') {
          setError(session.error || 'Processing failed');
        }
      } catch (error: unknown) {
        const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(`Failed to fetch summary results: ${detail || (error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaryResults();
  }, [sessionId, summaryResults, setSummaryResults, setError]);

  if (isLoading || (!summaryResults && processingStatus !== 'failed')) {
    return (
      <div style={{ maxWidth: '32rem', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '2rem' }}>
          {processingStatus === 'completed' ? (
            <CheckCircle style={{ height: '4rem', width: '4rem', color: '#10b981', margin: '0 auto 1rem auto' }} />
          ) : processingStatus === 'failed' ? (
            <AlertCircle style={{ height: '4rem', width: '4rem', color: '#ef4444', margin: '0 auto 1rem auto' }} />
          ) : (
            <Loader2 style={{ 
              height: '4rem', 
              width: '4rem', 
              color: '#2563eb', 
              margin: '0 auto 1rem auto',
              animation: 'spin 2s linear infinite'
            }} />
          )}
          
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
            {processingStatus === 'completed' ? 'Summarization Complete!' :
             processingStatus === 'failed' ? 'Processing Failed' :
             'Generating Summary...'}
          </h3>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {processingStatus === 'completed' ? 'Document summary generated successfully' :
             processingStatus === 'failed' ? 'There was an error processing your document' :
             'AI is creating a concise summary of your document'}
          </p>
        </div>
      </div>
    );
  }

  if (!summaryResults) {
    return (
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <p>No summary results available</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          Document Summary
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>AI-generated summary of your legal document</p>
      </div>

      {/* Summary Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.25rem' }}>
            {summaryResults.word_count || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Original Words</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
            {summaryResults.summary?.split(' ').length || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Summary Words</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.25rem' }}>
            {Math.round(summaryResults.compression_ratio * 100) || 0}%
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Compression</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.25rem' }}>
            {summaryResults.sentence_count || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sentences</div>
        </div>
      </div>

      {/* Summary Content */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles style={{ height: '1.25rem', width: '1.25rem', color: '#2563eb' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>AI Summary</h3>
          </div>
          <button
            onClick={() => copyToClipboard(summaryResults.summary)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            {copied ? <Check style={{ height: '1rem', width: '1rem' }} /> : <Copy style={{ height: '1rem', width: '1rem' }} />}
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
        </div>
        
        <div style={{ 
          padding: '1.5rem', 
          backgroundColor: '#f8fafc', 
          borderRadius: '0.5rem', 
          border: '1px solid #e2e8f0' 
        }}>
          <p style={{ 
            color: '#374151', 
            lineHeight: 1.7, 
            whiteSpace: 'pre-wrap', 
            margin: 0,
            fontSize: '0.95rem'
          }}>
            {summaryResults.summary}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Summary;