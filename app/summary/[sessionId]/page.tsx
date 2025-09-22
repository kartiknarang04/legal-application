"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SummaryResults } from "@/components/summary-results";
import axios from "axios";

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [results, setResults] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_HF1_URL}/results/${sessionId}`
      );
      
      if (response.data.success) {
        setResults(response.data.summary_results);
      } else {
        setError('Failed to load summary results');
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Document Summary</h1>
        <p className="text-gray-600">Session: {sessionId}</p>
      </div>
      
      {error ? (
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
        </div>
      ) : (
        <SummaryResults results={results} documentText={documentText} />
      )}
    </div>
  );
}