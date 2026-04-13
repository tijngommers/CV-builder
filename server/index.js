import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createLogger } from './utils/logger.js';

// Load .env file FIRST before importing other modules that use process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
try {
  const envContent = await fs.readFile(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
  console.log('[server-startup] Loaded .env file');
} catch (err) {
  console.warn('[server-startup] .env file not found or could not be read:', err.message);
}

// NOW import modules that depend on process.env
import { buildAssistantTurn } from './services/chatOrchestrator.js';
import { appendSessionMessage, createSession, getSession, updateLatexSource, revertLatexToVersion, updateResumeData } from './services/sessionStore.js';

export const app = express();
const PORT = Number(process.env.PORT || 3001);
const DEFAULT_PDFLATEX_TIMEOUT_MS = 180000;
const PDFLATEX_TIMEOUT_MS = Number(process.env.PDFLATEX_TIMEOUT_MS || DEFAULT_PDFLATEX_TIMEOUT_MS);
const logger = createLogger('server');

function resolvePdflatexCommand() {
  return process.env.PDFLATEX_PATH || 'pdflatex';
}

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim() ? requestIdHeader : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  const requestLogger = logger.child({ requestId, method: req.method, path: req.path });
  req.requestLogger = requestLogger;
  requestLogger.info('request.start');

  res.on('finish', () => {
    requestLogger.info('request.finish', {
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      requestLogger.warn('request.closed_before_end', {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    }
  });

  next();
});

// Log API configuration at startup
const apiKeyStatus = process.env.ANTHROPIC_API_KEY ? '✓ REAL API' : '⚠ FALLBACK MODE (no API key)';
const claudeModel = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805';
logger.info('startup.configuration', {
  apiMode: apiKeyStatus,
  claudeModel,
  port: PORT,
  pdflatexTimeoutMs: PDFLATEX_TIMEOUT_MS
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cv-pdf-service' });
});

app.post('/api/sessions', (req, res) => {
  const requestLogger = req.requestLogger || logger;
  const seedLatexSource = typeof req.body?.latexSource === 'string' ? req.body.latexSource : '';
  requestLogger.info('session.create.request', {
    hasSeedLatex: Boolean(seedLatexSource),
    seedLatexLength: seedLatexSource.length
  });
  const session = createSession(seedLatexSource);

  res.status(201).json({
    sessionId: session.id,
    createdAt: session.createdAt,
    latexSource: session.latexSource
  });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const requestLogger = req.requestLogger || logger;
  const session = getSession(req.params.sessionId);

  if (!session) {
    requestLogger.warn('session.get.not_found', {
      sessionId: req.params.sessionId,
      reasonCode: 'SESSION_NOT_FOUND'
    });
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  requestLogger.info('session.get.success', {
    sessionId: session.id,
    messageCount: session.messages.length,
    historyCount: session.latexHistory.length
  });

  res.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages,
    latexSource: session.latexSource,
    latexHistory: session.latexHistory
  });
});

app.post('/api/sessions/:sessionId/chat', async (req, res) => {
  const requestLogger = req.requestLogger || logger;
  const sessionId = req.params.sessionId;
  requestLogger.info('chat.request.received', {
    sessionId
  });
  const session = getSession(sessionId);

  if (!session) {
    requestLogger.warn('chat.session_not_found', {
      sessionId,
      reasonCode: 'SESSION_NOT_FOUND'
    });
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const userMessage = typeof req.body?.message === 'string' ? req.body.message : '';
  requestLogger.info('chat.input.validated', {
    sessionId,
    userMessageLength: userMessage.length
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    requestLogger.info('chat.orchestration.start', {
      sessionId,
      historyCount: session.messages.length
    });
    const assistantTurn = await buildAssistantTurn({
      session,
      userMessage,
      requestId: req.requestId
    });
    requestLogger.info('chat.orchestration.success', {
      sessionId,
      latexLength: assistantTurn.latexSource.length,
      shouldPersistLatex: assistantTurn.shouldPersistLatex
    });
    
    // Log what feedback is being sent back
    const feedbackEvent = assistantTurn.events.find((e) => e.type === 'assistant_message');
    if (feedbackEvent?.payload?.text) {
      requestLogger.debug('chat.feedback.ready', {
        sessionId,
        feedbackLength: feedbackEvent.payload.text.length
      });
    }

    // Append user message to session history
    appendSessionMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    requestLogger.debug('chat.user_message.persisted', {
      sessionId
    });

    // Update LaTeX source only if orchestration accepted the candidate update.
    if (assistantTurn.shouldPersistLatex) {
      updateLatexSource(sessionId, assistantTurn.latexSource, userMessage);
      if (assistantTurn.resumeData) {
        updateResumeData(sessionId, assistantTurn.resumeData, assistantTurn.operationsApplied || []);
      }
      requestLogger.info('chat.latex.persisted', {
        sessionId,
        latexLength: assistantTurn.latexSource.length
      });
    } else {
      requestLogger.warn('chat.latex.persistence_skipped', {
        sessionId,
        reasonCode: 'PERSISTENCE_REJECTED_BY_VALIDATION'
      });
    }

    // Append assistant message to session history
    const assistantText = assistantTurn.events
      .find((event) => event.type === 'assistant_message')
      ?.payload?.text || '';

    appendSessionMessage(sessionId, {
      role: 'assistant',
      content: assistantText,
      timestamp: new Date().toISOString()
    });
    requestLogger.debug('chat.assistant_message.persisted', {
      sessionId,
      assistantTextLength: assistantText.length
    });

    // Stream events back to client
    assistantTurn.events.forEach((event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
    });
    requestLogger.debug('chat.sse.events_sent', {
      sessionId,
      eventCount: assistantTurn.events.length
    });

    res.write('event: done\n');
    res.write(`data: ${JSON.stringify({ ok: true, requestId: req.requestId })}\n\n`);
    res.end();
    requestLogger.info('chat.sse.completed', {
      sessionId,
      reasonCode: 'STREAM_COMPLETED'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to orchestrate assistant response.';
    const timestamp = new Date().toISOString();
    requestLogger.error('chat.request_failed', {
      sessionId,
      reasonCode: 'CHAT_ROUTE_FAILURE',
      error
    });
    res.write('event: user_message\n');
    res.write(`data: ${JSON.stringify({ text: userMessage, timestamp })}\n\n`);
    res.write('event: assistant_message\n');
    res.write(`data: ${JSON.stringify({ text: message, timestamp, isError: true, requestId: req.requestId })}\n\n`);
    res.write('event: done\n');
    res.write(`data: ${JSON.stringify({ ok: false, requestId: req.requestId })}\n\n`);
    res.end();
  }
});

function runPdflatex(workingDirectory, texFileName, requestLogger = logger) {
  return new Promise((resolve, reject) => {
    const pdflatexCommand = resolvePdflatexCommand();
    const args = ['-interaction=nonstopmode', '-halt-on-error', texFileName];
    const childProcessEnv = {
      ...process.env,
      MIKTEX_NO_GUI: process.env.MIKTEX_NO_GUI || '1',
      MIKTEX_AUTOINSTALL: process.env.MIKTEX_AUTOINSTALL || '1'
    };

    const childProcess = spawn(pdflatexCommand, args, {
      cwd: workingDirectory,
      windowsHide: true,
      env: childProcessEnv
    });
    const startTime = Date.now();
    requestLogger.info('render_pdf.pdflatex.spawned', {
      command: pdflatexCommand,
      args,
      workingDirectory
    });

    let stdErrorOutput = '';
    let stdOutput = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      requestLogger.error('render_pdf.pdflatex.timeout', {
        reasonCode: 'PDFLATEX_TIMEOUT',
        timeoutMs: PDFLATEX_TIMEOUT_MS,
        durationMs: Date.now() - startTime
      });
      reject(new Error('pdflatex timed out while compiling CV.'));
    }, PDFLATEX_TIMEOUT_MS);

    childProcess.stdout.on('data', (chunk) => {
      stdOutput += chunk.toString();
    });

    childProcess.stderr.on('data', (chunk) => {
      stdErrorOutput += chunk.toString();
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      if (error.code === 'ENOENT') {
        requestLogger.error('render_pdf.pdflatex.binary_missing', {
          reasonCode: 'PDFLATEX_BINARY_NOT_FOUND',
          command: pdflatexCommand,
          error
        });
        reject(new Error('pdflatex was not found. Install a LaTeX distribution (TeX Live, MiKTeX, MacTeX), add pdflatex to PATH, or set PDFLATEX_PATH to the full pdflatex executable path.'));
        return;
      }
      requestLogger.error('render_pdf.pdflatex.spawn_error', {
        reasonCode: 'PDFLATEX_SPAWN_ERROR',
        error
      });
      reject(error);
    });

    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        requestLogger.error('render_pdf.pdflatex.failed', {
          reasonCode: 'PDFLATEX_NON_ZERO_EXIT',
          exitCode: code,
          durationMs: Date.now() - startTime,
          stderrLength: stdErrorOutput.length,
          stdoutLength: stdOutput.length,
          stderrSnippet: stdErrorOutput.slice(0, 400),
          stdoutSnippet: stdOutput.slice(0, 200)
        });
        reject(new Error(`pdflatex failed with code ${code}. ${stdErrorOutput || stdOutput}`));
        return;
      }
      requestLogger.info('render_pdf.pdflatex.success', {
        durationMs: Date.now() - startTime,
        stdoutLength: stdOutput.length
      });
      resolve();
    });
  });
}

app.post('/api/render-pdf', async (req, res) => {
  const requestLogger = req.requestLogger || logger;
  const latexSource = typeof req.body?.latexSource === 'string' ? req.body.latexSource : '';
  const startTime = Date.now();
  requestLogger.info('render_pdf.request.received', {
    latexLength: latexSource.length
  });

  if (!latexSource) {
    requestLogger.warn('render_pdf.request.invalid_body', {
      reasonCode: 'MISSING_LATEX_SOURCE'
    });
    res.status(400).json({ error: 'Invalid request body. Expected { latexSource: string }.' });
    return;
  }

  const jobDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-builder-'));
  const baseName = `resume-${randomUUID()}`;
  const texPath = path.join(jobDirectory, `${baseName}.tex`);
  const pdfPath = path.join(jobDirectory, `${baseName}.pdf`);

  try {
    requestLogger.debug('render_pdf.job.created', {
      jobDirectory,
      baseName
    });
    await fs.writeFile(texPath, latexSource, 'utf8');
    requestLogger.debug('render_pdf.tex_written', {
      texPath
    });
    await runPdflatex(jobDirectory, `${baseName}.tex`, requestLogger);

    const pdfBuffer = await fs.readFile(pdfPath);
    requestLogger.info('render_pdf.pdf_ready', {
      sizeBytes: pdfBuffer.length,
      durationMs: Date.now() - startTime
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.';
    requestLogger.error('render_pdf.failed', {
      reasonCode: 'PDF_RENDER_FAILURE',
      error,
      durationMs: Date.now() - startTime
    });
    res.status(500).json({ error: message });
  } finally {
    try {
      await fs.rm(jobDirectory, { recursive: true, force: true });
      requestLogger.debug('render_pdf.cleanup.success', {
        jobDirectory
      });
    } catch {
      requestLogger.warn('render_pdf.cleanup.failed', {
        reasonCode: 'TEMP_DIR_CLEANUP_FAILED',
        jobDirectory
      });
    }
  }
});

app.delete('/api/sessions/:sessionId/history/:index', (req, res) => {
  const requestLogger = req.requestLogger || logger;
  const sessionId = req.params.sessionId;
  const historyIndex = parseInt(req.params.index, 10);

  const session = getSession(sessionId);
  if (!session) {
    requestLogger.warn('session.revert.session_not_found', {
      sessionId,
      reasonCode: 'SESSION_NOT_FOUND'
    });
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const reverted = revertLatexToVersion(sessionId, historyIndex);
  if (!reverted) {
    requestLogger.warn('session.revert.invalid_index', {
      sessionId,
      historyIndex,
      reasonCode: 'INVALID_HISTORY_INDEX'
    });
    res.status(400).json({ error: 'Invalid history index or no history available.' });
    return;
  }

  requestLogger.info('session.revert.success', {
    sessionId,
    historyIndex,
    historyCount: reverted.latexHistory.length
  });

  res.json({
    sessionId: reverted.id,
    latexSource: reverted.latexSource,
    latexHistory: reverted.latexHistory
  });
});

export function startServer(port = PORT) {
  return app.listen(port, () => {
    logger.info('startup.listening', { url: `http://localhost:${port}` });
  });
}

const currentModulePath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === currentModulePath;

if (isDirectExecution) {
  startServer();
}
