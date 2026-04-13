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
    latexHistory: [],
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
      messageCount: session.messages.length,
      historyCount: session.latexHistory.length
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
    messageCount: nextState.messages.length,
    historyCount: nextState.latexHistory.length
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

export function revertLatexToVersion(sessionId, historyIndex) {
  const session = sessions.get(sessionId);
  if (!session || !session.latexHistory[historyIndex]) {
    logger.warn('session.revert.invalid_index', {
      sessionId,
      historyIndex,
      historyCount: session?.latexHistory?.length || 0
    });
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

  const reverted = updateSession(sessionId, () => ({
    ...session,
    latexSource: historyEntry.latexSource,
    latexHistory: newHistory
  }));

  logger.info('session.revert.success', {
    sessionId,
    historyIndex,
    historyCount: reverted?.latexHistory?.length || 0
  });

  return reverted;
}
