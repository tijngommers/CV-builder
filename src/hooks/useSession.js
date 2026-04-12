import { useCallback, useEffect, useState } from 'react';

export function useSession(initialData) {
  const [sessionId, setSessionId] = useState(null);
  const [cvData, setCvData] = useState(initialData);
  const [missingFields, setMissingFields] = useState([]);
  const [requiredFieldsComplete, setRequiredFieldsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const applyServerCvUpdate = useCallback((nextCvData, nextMissingFields = []) => {
    setCvData(nextCvData);
    setMissingFields(nextMissingFields);
    setRequiredFieldsComplete(nextMissingFields.length === 0);
  }, []);

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
        setMissingFields(data.missingRequiredFields || []);
        setRequiredFieldsComplete(data.requiredFieldsComplete);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session creation failed');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const updateCvData = useCallback(
    async (newCvData) => {
      if (!sessionId) {
        // If no session yet, update local state
        setCvData(newCvData);
        return;
      }

      try {
        // Optimistically update local state
        setCvData(newCvData);

        // Send to server for validation and processing
        const response = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '',
            updates: newCvData,
            replace: true
          })
        });

        if (response.ok) {
          // Parse SSE stream for server response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1];

            // Process complete lines
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.cvData) {
                    setCvData(data.cvData);
                  }
                  if (data.missingRequiredFields) {
                    setMissingFields(data.missingRequiredFields);
                    setRequiredFieldsComplete(data.missingRequiredFields.length === 0);
                  }
                } catch (e) {
                  // Skip parse errors
                }
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [sessionId]
  );

  return {
    sessionId,
    cvData,
    missingFields,
    requiredFieldsComplete,
    isLoading,
    error,
    updateCvData,
    applyServerCvUpdate
  };
}
