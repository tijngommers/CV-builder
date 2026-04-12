import { useCallback, useEffect, useState } from 'react';

const SESSION_STORAGE_KEY = 'cv-builder-session-id';

function getStoredSessionId() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionId(sessionId) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Ignore storage failures.
  }
}

function clearStoredSessionId() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

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
        const storedSessionId = getStoredSessionId();
        if (storedSessionId) {
          const restoreResponse = await fetch(`/api/sessions/${storedSessionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (restoreResponse.ok) {
            const restored = await restoreResponse.json();
            console.log('[useSession] Restored session:', restored.sessionId);
            setSessionId(restored.sessionId);
            setLatexSource(restored.latexSource || initialLatexSource || '');
            setLatexHistory(restored.latexHistory || []);
            setMessages(restored.messages || []);
            setIsLoading(false);
            return;
          }

          if (restoreResponse.status === 404) {
            clearStoredSessionId();
          }
        }

        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latexSource: initialLatexSource })
        });

        if (!response.ok) throw new Error('Failed to create session');

        const data = await response.json();
        console.log('[useSession] Session created:', data.sessionId);
        setSessionId(data.sessionId);
        setStoredSessionId(data.sessionId);
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

      if (response.status === 404) {
        clearStoredSessionId();
      }

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
