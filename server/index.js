import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildAssistantTurn } from './services/chatOrchestrator.js';
import { appendSessionMessage, createSession, getSession, updateLatexSource, revertLatexToVersion } from './services/sessionStore.js';

export const app = express();
const PORT = Number(process.env.PORT || 3001);
const DEFAULT_PDFLATEX_TIMEOUT_MS = 180000;
const PDFLATEX_TIMEOUT_MS = Number(process.env.PDFLATEX_TIMEOUT_MS || DEFAULT_PDFLATEX_TIMEOUT_MS);

function resolvePdflatexCommand() {
  return process.env.PDFLATEX_PATH || 'pdflatex';
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cv-pdf-service' });
});

app.post('/api/sessions', (req, res) => {
  const session = createSession('');

  res.status(201).json({
    sessionId: session.id,
    createdAt: session.createdAt,
    latexSource: session.latexSource
  });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

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
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const userMessage = typeof req.body?.message === 'string' ? req.body.message : '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const assistantTurn = await buildAssistantTurn({
      session,
      userMessage
    });

    // Append user message to session history
    appendSessionMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    // Update LaTeX source in session
    updateLatexSource(sessionId, assistantTurn.latexSource, userMessage);

    // Append assistant message to session history
    const assistantText = assistantTurn.events
      .find((event) => event.type === 'assistant_message')
      ?.payload?.text || '';

    appendSessionMessage(sessionId, {
      role: 'assistant',
      content: assistantText,
      timestamp: new Date().toISOString()
    });

    // Stream events back to client
    assistantTurn.events.forEach((event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
    });

    res.write('event: done\n');
    res.write('data: {"ok":true}\n\n');
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to orchestrate assistant response.';
    const timestamp = new Date().toISOString();

    res.write('event: user_message\n');
    res.write(`data: ${JSON.stringify({ text: userMessage, timestamp })}\n\n`);
    res.write('event: assistant_message\n');
    res.write(`data: ${JSON.stringify({ text: message, timestamp, isError: true })}\n\n`);
    res.write('event: done\n');
    res.write('data: {"ok":false}\n\n');
    res.end();
  }
});

function runPdflatex(workingDirectory, texFileName) {
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

    let stdErrorOutput = '';
    let stdOutput = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
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
        reject(new Error('pdflatex was not found. Install a LaTeX distribution (TeX Live, MiKTeX, MacTeX), add pdflatex to PATH, or set PDFLATEX_PATH to the full pdflatex executable path.'));
        return;
      }
      reject(error);
    });

    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`pdflatex failed with code ${code}. ${stdErrorOutput || stdOutput}`));
        return;
      }
      resolve();
    });
  });
}

app.post('/api/render-pdf', async (req, res) => {
  const latexSource = typeof req.body?.latexSource === 'string' ? req.body.latexSource : '';

  if (!latexSource) {
    res.status(400).json({ error: 'Invalid request body. Expected { latexSource: string }.' });
    return;
  }

  const jobDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-builder-'));
  const baseName = `resume-${randomUUID()}`;
  const texPath = path.join(jobDirectory, `${baseName}.tex`);
  const pdfPath = path.join(jobDirectory, `${baseName}.pdf`);

  try {
    await fs.writeFile(texPath, latexSource, 'utf8');
    await runPdflatex(jobDirectory, `${baseName}.tex`);

    const pdfBuffer = await fs.readFile(pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.';
    res.status(500).json({ error: message });
  } finally {
    try {
      await fs.rm(jobDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures
    }
  }
});

app.delete('/api/sessions/:sessionId/history/:index', (req, res) => {
  const sessionId = req.params.sessionId;
  const historyIndex = parseInt(req.params.index, 10);

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const reverted = revertLatexToVersion(sessionId, historyIndex);
  if (!reverted) {
    res.status(400).json({ error: 'Invalid history index or no history available.' });
    return;
  }

  res.json({
    sessionId: reverted.id,
    latexSource: reverted.latexSource,
    latexHistory: reverted.latexHistory
  });
});

export function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`CV PDF server running on http://localhost:${port}`);
  });
}

const currentModulePath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === currentModulePath;

if (isDirectExecution) {
  startServer();
}
