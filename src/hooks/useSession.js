import { useCallback, useEffect, useState } from 'react';

export function useSession(initialData) {
  const [sessionId, setSessionId] = useState(null);
  const [cvData, setCvData] = useState(initialData);
  const [missingFields, setMissingFields] = useState([]);
  const [requiredFieldsComplete, setRequiredFieldsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize session on component mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvData: initialData })
        });

        if (!response.ok) throw new Error('Failed to create session');

        const data = await response.json();
        setSessionId(data.sessionId);
        setCvData(data.cvData);
        setMissingFields(data.missingRequiredFields);
        setRequiredFieldsComplete(data.requiredFieldsComplete);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session creation failed');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [initialData]);

  const updateCvData = useCallback(async (updates) => {
    if (!sessionId) return;

    try {
      // Optimistically update local state
      const newCvData = { ...cvData, ...updates };
      setCvData(newCvData);

      // Fetch updated missing fields from server
      const response = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', updates })
      });

      if (response.ok) {
        // Parse SSE stream for final state
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalState = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.cv_data) finalState = data;
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }

        if (finalState) {
          setCvData(finalState.cv_data);
          setMissingFields(finalState.missing_fields || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }, [sessionId, cvData]);

  return {
    sessionId,
    cvData,
    missingFields,
    requiredFieldsComplete,
    isLoading,
    error,
    updateCvData
  };
}
