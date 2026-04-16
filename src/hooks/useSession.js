import { useCallback, useEffect, useState } from 'react';
import { createLogger, createRequestId } from '../utils/logger';

const SESSION_STORAGE_KEY = 'cv-builder-session-id';
const logger = createLogger('useSession');

function getStoredSessionId() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch (error) {
    logger.warn('storage.read.failed', {
      reasonCode: 'LOCAL_STORAGE_READ_FAILED',
      error
    });
    return null;
  }
}

function setStoredSessionId(sessionId) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch (error) {
    logger.warn('storage.write.failed', {
      reasonCode: 'LOCAL_STORAGE_WRITE_FAILED',
      error
    });
  }
}

function clearStoredSessionId() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    logger.warn('storage.remove.failed', {
      reasonCode: 'LOCAL_STORAGE_REMOVE_FAILED',
      error
    });
  }
}

export function useSession(initialLatexSource = '') {
  const [sessionId, setSessionId] = useState(null);
  const [latexSource, setLatexSource] = useState(initialLatexSource);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize session on component mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      const requestId = createRequestId();
      const requestLogger = logger.child({ requestId });
      try {
        const storedSessionId = getStoredSessionId();
        requestLogger.info('session.init.start', {
          hasStoredSession: Boolean(storedSessionId)
        });
        if (storedSessionId) {
          const restoreStart = performance.now();
          const restoreResponse = await fetch(`/api/sessions/${storedSessionId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Request-Id': requestId
            }
          });

          requestLogger.info('session.restore.response', {
            statusCode: restoreResponse.status,
            durationMs: Math.round(performance.now() - restoreStart)
          });

          if (restoreResponse.ok) {
            const restored = await restoreResponse.json();
            requestLogger.info('session.restore.success', {
              sessionId: restored.sessionId,
              messageCount: restored.messages?.length || 0
            });
            setSessionId(restored.sessionId);
            setLatexSource(restored.latexSource || initialLatexSource || '');
            setMessages(restored.messages || []);
            setIsLoading(false);
            return;
          }

          if (restoreResponse.status === 404) {
            requestLogger.warn('session.restore.not_found', {
              reasonCode: 'STORED_SESSION_NOT_FOUND',
              storedSessionId
            });
            clearStoredSessionId();
          }
        }

        const createStart = performance.now();
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId
          },
          body: JSON.stringify({ latexSource: initialLatexSource })
        });

        requestLogger.info('session.create.response', {
          statusCode: response.status,
          durationMs: Math.round(performance.now() - createStart)
        });

        if (!response.ok) throw new Error('Failed to create session');

        const data = await response.json();
        requestLogger.info('session.create.success', {
          sessionId: data.sessionId
        });
        setSessionId(data.sessionId);
        setStoredSessionId(data.sessionId);
        // Use initial LaTeX if provided, otherwise use server's default
        setLatexSource(initialLatexSource || data.latexSource || '');
      } catch (err) {
        requestLogger.error('session.init.failed', {
          reasonCode: 'SESSION_INIT_FAILED',
          error: err
        });
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
    logger.debug('session.id.changed', { sessionId });
  }, [sessionId]);

  // Fetch the latest session data (including updated latexSource and messages)
  const refreshSessionData = useCallback(async () => {
    if (!sessionId) return;
    const requestId = createRequestId();
    const requestLogger = logger.child({ requestId, sessionId });

    try {
      const startedAt = performance.now();
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId
        }
      });

      requestLogger.info('session.refresh.response', {
        statusCode: response.status,
        durationMs: Math.round(performance.now() - startedAt)
      });

      if (response.status === 404) {
        requestLogger.warn('session.refresh.not_found', {
          reasonCode: 'SESSION_NOT_FOUND'
        });
        clearStoredSessionId();
      }

      if (!response.ok) throw new Error('Failed to fetch session');

      const data = await response.json();
      setLatexSource(data.latexSource || '');
      setMessages(data.messages || []);
      requestLogger.debug('session.refresh.success', {
        messageCount: data.messages?.length || 0
      });
    } catch (err) {
      requestLogger.error('session.refresh.failed', {
        reasonCode: 'SESSION_REFRESH_FAILED',
        error: err
      });
      setError(err instanceof Error ? err.message : 'Failed to refresh session');
    }
  }, [sessionId]);

  const resetSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    clearStoredSessionId();
    const requestId = createRequestId();
    const requestLogger = logger.child({ requestId, previousSessionId: sessionId });

    try {
      const startedAt = performance.now();
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId
        },
        body: JSON.stringify({ latexSource: initialLatexSource })
      });

      requestLogger.info('session.reset.response', {
        statusCode: response.status,
        durationMs: Math.round(performance.now() - startedAt)
      });

      if (!response.ok) throw new Error('Failed to create a new session');

      const data = await response.json();
      setSessionId(data.sessionId);
      setStoredSessionId(data.sessionId);
      setLatexSource(initialLatexSource || data.latexSource || '');
      setMessages([]);
      requestLogger.info('session.reset.success', {
        newSessionId: data.sessionId
      });
    } catch (err) {
      requestLogger.error('session.reset.failed', {
        reasonCode: 'SESSION_RESET_FAILED',
        error: err
      });
      setError(err instanceof Error ? err.message : 'Failed to reset session');
    } finally {
      setIsLoading(false);
    }
  }, [initialLatexSource, sessionId]);

  return {
    sessionId,
    latexSource,
    messages,
    isLoading,
    error,
    refreshSessionData,
    resetSession
  };
}
