import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.js';
import { createDefaultResumeData } from './resumeSchema.js';

const sessions = new Map();
const logger = createLogger('sessionStore');

function createSessionState(seedLatexSource) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    latexSource: seedLatexSource || '',
    resumeData: createDefaultResumeData(),
    operationLog: []
  };
}

export function createSession(seedLatexSource) {
  const session = createSessionState(seedLatexSource);
  sessions.set(session.id, session);
  logger.info('session.create.success', {
    sessionId: session.id,
    totalSessions: sessions.size,
    hasSeedLatex: Boolean(seedLatexSource)
  });
  return session;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId) || null;
  if (!session) {
    logger.warn('session.get.miss', {
      sessionId,
      totalSessions: sessions.size
    });
  } else {
    logger.debug('session.get.hit', {
      sessionId,
      totalSessions: sessions.size,
      messageCount: session.messages.length
    });
  }
  return session;
}

export function updateSession(sessionId, updater) {
  const current = sessions.get(sessionId);
  if (!current) {
    logger.warn('session.update.miss', { sessionId, totalSessions: sessions.size });
    return null;
  }

  let nextState;
  try {
    nextState = updater(current);
  } catch (error) {
    logger.error('session.update.updater_failed', {
      sessionId,
      error
    });
    throw error;
  }

  nextState.updatedAt = new Date().toISOString();
  sessions.set(sessionId, nextState);
  logger.debug('session.update.success', {
    sessionId,
    messageCount: nextState.messages.length
  });
  return nextState;
}

export function appendSessionMessage(sessionId, message) {
  return updateSession(sessionId, (session) => ({
    ...session,
    messages: [...session.messages, message]
  }));
}

export function updateLatexSource(sessionId, newLatexSource, userRequestSummary = '') {
  void userRequestSummary;
  return updateSession(sessionId, (session) => {
    return {
      ...session,
      latexSource: newLatexSource
    };
  });
}

export function updateResumeData(sessionId, newResumeData, operations = []) {
  return updateSession(sessionId, (session) => ({
    ...session,
    resumeData: newResumeData,
    operationLog: [
      ...session.operationLog,
      ...operations.map((operation) => ({
        operationId: operation.operationId || randomUUID(),
        opType: operation.opType,
        target: operation.target,
        timestamp: operation.timestamp || new Date().toISOString()
      }))
    ]
  }));
}

