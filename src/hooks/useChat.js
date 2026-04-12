import { useCallback, useState } from 'react';

export function useChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(
    async (content, onChunkReceived) => {
      if (!sessionId || !content.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        // Add user message optimistically
        const userMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date().toISOString()
        };
        setMessages((prev) => [...prev, userMessage]);

        // Send to server with SSE
        const response = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, updates: {} })
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';
        let parsedEvents = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last incomplete line in the buffer
          buffer = lines[lines.length - 1];

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];

            if (line.startsWith('event:')) {
              const eventType = line.slice(6).trim();
              parsedEvents.push(eventType);
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '') continue;

              try {
                const data = JSON.parse(dataStr);

                if (parsedEvents[parsedEvents.length - 1] === 'assistant_message') {
                  assistantContent += data.text || '';
                }

                // Call callback with individual chunks
                if (onChunkReceived) {
                  onChunkReceived({
                    type: parsedEvents[parsedEvents.length - 1],
                    payload: data
                  });
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        // Add assistant message
        if (assistantContent) {
          const assistantMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Chat error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage
  };
}
