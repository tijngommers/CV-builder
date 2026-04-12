import { useRef, useEffect, useState } from 'react';
import './ChatPane.css';

export function ChatPane({ sessionId, messages = [], isLoading: parentLoading, onMessageSent }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessage]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

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
      const response = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessageText })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
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
                if (typeof data.text === 'string' && data.text.trim()) {
                  assistantText = data.text;
                } else if (typeof data.latexSource === 'string' && data.latexSource.trim()) {
                  assistantText = 'Resume updated. The live preview has been refreshed.';
                }
              }
            } catch {
              // Skip parse errors
            }
          }
        }
      }

      setPendingMessage(null);

      // Refresh session data to get the latest messages and latexSource from server
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Chat error:', err);
      setPendingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <h2>Resume Assistant</h2>
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
