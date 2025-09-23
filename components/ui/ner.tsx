// components/ui/ner.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Users, Building, Gavel, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import type { NerResults } from '../../app/page';

const BACKEND_1_URL = process.env.NEXT_PUBLIC_BACKEND_1_URL || 'http://localhost:7860';

type NERProps = {
  sessionId: string | null;
  nerResults: NerResults | null;
  setNerResults: (results: NerResults) => void;
  setError: (msg: string | null) => void;
};

const NER = ({ sessionId, nerResults, setNerResults, setError }: NERProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

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

  useEffect(() => {
    if (!sessionId || nerResults) return;

    const fetchNERResults = async () => {
      setIsLoading(true);
      try {
        const statusResponse = await axios.get(`${BACKEND_1_URL}/status/${sessionId}`);
        const session = statusResponse.data.session;
        
        setProcessingStatus(session.status);

        if (session.status === 'completed') {
          const resultsResponse = await axios.get(`${BACKEND_1_URL}/results/${sessionId}`);
          if (resultsResponse.data.success) {
            setNerResults(resultsResponse.data.ner_results);
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
                  setNerResults(resultsResponse.data.ner_results);
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
        setError(`Failed to fetch NER results: ${detail || (error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNERResults();
  }, [sessionId, nerResults, setNerResults, setError]);

  if (isLoading || (!nerResults && processingStatus !== 'failed')) {
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
            {processingStatus === 'completed' ? 'Analysis Complete!' :
             processingStatus === 'failed' ? 'Processing Failed' :
             'Processing Document...'}
          </h3>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {processingStatus === 'completed' ? 'Named entity recognition completed successfully' :
             processingStatus === 'failed' ? 'There was an error processing your document' :
             'Running named entity recognition on your document'}
          </p>
        </div>
      </div>
    );
  }

  if (!nerResults) {
    return (
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <p>No NER results available</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
          Named Entity Recognition Results
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>Legal entities, people, and organizations extracted from your document</p>
      </div>

      {/* Entity Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.25rem' }}>
            {nerResults.total_entities}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Entities</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
            {nerResults.unique_labels?.length || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Entity Types</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.25rem' }}>
            {Object.values(nerResults.entity_counts || {}).reduce((sum: number, cat: { entities: string[]; count: number }) => sum + (cat.entities?.length || 0), 0)}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Unique Entities</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
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
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '1.5rem' }}>Entity Categories</h3>
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
    </div>
  );
};

export default NER;