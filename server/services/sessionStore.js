import { randomUUID } from 'node:crypto';

const sessions = new Map();

function createSessionState(seedData) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    cvData: seedData,
    missingRequiredFields: []
  };
}

export function createSession(seedData) {
  const session = createSessionState(seedData);
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
