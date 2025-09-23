// components/ui/file-upload.tsx
"use client";

import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import axios from 'axios';

const BACKEND_1_URL = process.env.NEXT_PUBLIC_BACKEND_1_URL || 'https://kn29-doc-processor.hf.space';

type FileUploadProps = {
  onUpload: (file: File, sessionId: string) => void;
  setError: (msg: string | null) => void;
};

const FileUpload = ({ onUpload, setError }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

export default FileUpload;