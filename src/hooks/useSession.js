import { useCallback, useEffect, useState } from 'react';

export function useSession(initialLatexSource = '') {
  const [sessionId, setSessionId] = useState(null);
  const [latexSource, setLatexSource] = useState(initialLatexSource);
  const [latexHistory, setLatexHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize session on component mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to create session');

        const data = await response.json();
        console.log('[useSession] Session created:', data.sessionId);
        setSessionId(data.sessionId);
        // Use initial LaTeX if provided, otherwise use server's default
        setLatexSource(initialLatexSource || data.latexSource || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session creation failed');
        // Even if session creation fails, show the initial LaTeX
        setLatexSource(initialLatexSource);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [initialLatexSource]);

  useEffect(() => {
    console.log('[useSession] sessionId changed:', sessionId);
  }, [sessionId]);

  // Fetch the latest session data (including updated latexSource and messages)
  const refreshSessionData = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch session');

      const data = await response.json();
      setLatexSource(data.latexSource || '');
      setLatexHistory(data.latexHistory || []);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh session');
    }
  }, [sessionId]);

  // Revert to a previous LaTeX version
  const revertToVersion = useCallback(
    async (historyIndex) => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/sessions/${sessionId}/history/${historyIndex}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to revert version');

        const data = await response.json();
        setLatexSource(data.latexSource || '');
        setLatexHistory(data.latexHistory || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revert version');
      }
    },
    [sessionId]
  );

  return {
    sessionId,
    latexSource,
    messages,
    latexHistory,
    isLoading,
    error,
    refreshSessionData,
    revertToVersion
  };
}
