import { randomUUID } from 'node:crypto';

const sessions = new Map();

function createSessionState(seedLatexSource) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    latexSource: seedLatexSource || '',
    latexHistory: []
  };
}

export function createSession(seedLatexSource) {
  const session = createSessionState(seedLatexSource);
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function updateSession(sessionId, updater) {
  const current = sessions.get(sessionId);
  if (!current) {
    return null;
  }

  const nextState = updater(current);
  nextState.updatedAt = new Date().toISOString();
  sessions.set(sessionId, nextState);
  return nextState;
}

export function appendSessionMessage(sessionId, message) {
  return updateSession(sessionId, (session) => ({
    ...session,
    messages: [...session.messages, message]
  }));
}

export function updateLatexSource(sessionId, newLatexSource, userRequestSummary = '') {
  return updateSession(sessionId, (session) => {
    const previousLatex = session.latexSource;
    const nextHistory = [...session.latexHistory];

    // Only add to history if LaTeX actually changed
    if (previousLatex !== newLatexSource) {
      nextHistory.push({
        timestamp: new Date().toISOString(),
        latexSource: previousLatex,
        userRequestSummary
      });
    }

    return {
      ...session,
      latexSource: newLatexSource,
      latexHistory: nextHistory
    };
  });
}

export function revertLatexToVersion(sessionId, historyIndex) {
  const session = sessions.get(sessionId);
  if (!session || !session.latexHistory[historyIndex]) {
    return null;
  }

  const historyEntry = session.latexHistory[historyIndex];
  const currentLatex = session.latexSource;
  const newHistory = session.latexHistory.slice(0, historyIndex);

  // Add current version to history before reverting
  newHistory.push({
    timestamp: new Date().toISOString(),
    latexSource: currentLatex,
    userRequestSummary: 'Reverted'
  });

  return updateSession(sessionId, () => ({
    ...session,
    latexSource: historyEntry.latexSource,
    latexHistory: newHistory
  }));
}
