import { useRef, useEffect, useState } from 'react';
import './ChatPane.css';
import { createLogger, createRequestId } from '../utils/logger';

const logger = createLogger('ChatPane');

export function ChatPane({ sessionId, messages = [], isLoading: parentLoading, onMessageSent, onResetSession }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const messagesEndRef = useRef(null);

  console.log('[ChatPane] Received sessionId:', sessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessage]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const requestId = createRequestId();
    const requestLogger = logger.child({ requestId, sessionId: sessionId || 'missing' });
    requestLogger.info('chat.send.attempt', {
      hasInput: input.length > 0,
      isLoading
    });
    if (!input.trim() || !sessionId || isLoading) {
      requestLogger.warn('chat.send.blocked', {
        reasonCode: 'INPUT_OR_SESSION_INVALID',
        inputLength: input.trim().length,
        hasSession: Boolean(sessionId),
        isLoading
      });
      return;
    }

    const userMessageText = input;
    setInput('');
    setIsLoading(true);
    setError(null);
    setPendingMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessageText,
      timestamp: new Date().toISOString()
    });

    try {
      const startedAt = performance.now();
      requestLogger.info('chat.send.request_start', {
        messageLength: userMessageText.length
      });
      const response = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId
        },
        body: JSON.stringify({ message: userMessageText })
      });

      requestLogger.info('chat.send.response', {
        statusCode: response.status,
        durationMs: Math.round(performance.now() - startedAt)
      });
      if (!response.ok) {
        const errText = await response.text();
        requestLogger.error('chat.send.http_error', {
          reasonCode: 'CHAT_HTTP_ERROR',
          statusCode: response.status,
          errorBodyLength: errText.length
        });
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 100)}`);
      }

      let assistantText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) {
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
            continue;
          }

          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (currentEvent === 'assistant_message') {
                // Always use the feedback text from server
                if (typeof data.text === 'string') {
                  assistantText = data.text.trim() || 'Processed (no feedback)';
                }
                requestLogger.debug('chat.stream.assistant_message', {
                  textLength: assistantText.length,
                  isError: Boolean(data.isError)
                });
              }
            } catch (error) {
              requestLogger.warn('chat.stream.parse_error', {
                reasonCode: 'SSE_PARSE_ERROR',
                error
              });
            }
          }
        }
      }

      setPendingMessage(null);

      requestLogger.info('chat.send.completed', {
        feedbackLength: assistantText.length
      });
      // Refresh session data to get the latest messages and latexSource from server
      if (onMessageSent) {
        requestLogger.debug('chat.send.trigger_refresh');
        onMessageSent();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      requestLogger.error('chat.send.failed', {
        reasonCode: 'CHAT_SEND_FAILED',
        error: err
      });
      setError(errorMessage);
      setPendingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <h2>Resume Assistant</h2>
        <button
          type="button"
          className="chat-reset-btn"
          onClick={onResetSession}
          disabled={isLoading || parentLoading}
        >
          Restart Session
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !pendingMessage ? (
          <div className="chat-empty">
            <p>Tell me about your professional background to generate your resume</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            {pendingMessage && (
              <div className={`chat-message ${pendingMessage.role}`}>
                <div className="message-content">{pendingMessage.content}</div>
                <div className="message-time">
                  {new Date(pendingMessage.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
          </>
        )}
        {isLoading && (
          <div className="chat-message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about your experience..."
          disabled={!sessionId || isLoading || parentLoading}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!input.trim() || !sessionId || isLoading || parentLoading}
          className="chat-send-btn"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
