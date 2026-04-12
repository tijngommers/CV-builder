import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildCvLatex } from './latexTemplate.js';
import { buildAssistantTurn } from './services/chatOrchestrator.js';
import { appendSessionMessage, createSession, getSession, updateSession } from './services/sessionStore.js';
import { getMissingRequiredFields, normalizeCvData } from './schemas/cvSchema.js';
import { initializePreviewRenderer, renderPreview, generateCacheKey, getQueueStats } from './services/previewRenderer.js';

export const app = express();
const PORT = Number(process.env.PORT || 3001);
const DEFAULT_PDFLATEX_TIMEOUT_MS = 180000;
const PDFLATEX_TIMEOUT_MS = Number(process.env.PDFLATEX_TIMEOUT_MS || DEFAULT_PDFLATEX_TIMEOUT_MS);

function resolvePdflatexCommand() {
  return process.env.PDFLATEX_PATH || 'pdflatex';
}

// Initialize preview renderer with configuration
initializePreviewRenderer({
  maxConcurrentCompilations: Number(process.env.PREVIEW_MAX_CONCURRENT || 3),
  pdflatexTimeoutMs: PDFLATEX_TIMEOUT_MS
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cv-pdf-service' });
});

app.post('/api/sessions', (req, res) => {
  const seedData = normalizeCvData(req.body?.cvData || {});
  const missingRequiredFields = getMissingRequiredFields(seedData);
  const session = createSession(seedData);

  const initializedSession = updateSession(session.id, (current) => ({
    ...current,
    missingRequiredFields
  }));

  res.status(201).json({
    sessionId: initializedSession.id,
    cvData: initializedSession.cvData,
    missingRequiredFields: initializedSession.missingRequiredFields,
    requiredFieldsComplete: initializedSession.missingRequiredFields.length === 0
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
    cvData: session.cvData,
    missingRequiredFields: session.missingRequiredFields,
    requiredFieldsComplete: session.missingRequiredFields.length === 0
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
  const updates = req.body?.updates && typeof req.body.updates === 'object' ? req.body.updates : {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const assistantTurn = await buildAssistantTurn({
      session,
      userMessage,
      updates
    });

    appendSessionMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    updateSession(sessionId, (current) => ({
      ...current,
      cvData: assistantTurn.cvData,
      missingRequiredFields: assistantTurn.missingRequiredFields
    }));

    appendSessionMessage(sessionId, {
      role: 'assistant',
      content: assistantTurn.events.find((event) => event.type === 'assistant_message')?.payload?.text || '',
      timestamp: new Date().toISOString()
    });

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
    res.write(`data: ${JSON.stringify({ text: message, timestamp, requiredFieldsComplete: false })}\n\n`);
    res.write('event: done\n');
    res.write('data: {"ok":false}\n\n');
    res.end();
  }
});

app.post('/api/latex-source', (req, res) => {
  const cvData = normalizeCvData(req.body?.cvData || {});
  const missingRequiredFields = getMissingRequiredFields(cvData);

  try {
    const latexSource = buildCvLatex(cvData);
    res.json({
      latexSource,
      missingRequiredFields,
      requiredFieldsComplete: missingRequiredFields.length === 0
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate LaTeX source.';
    res.status(500).json({ error: message });
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
  const cvData = req.body;

  if (!cvData || typeof cvData !== 'object') {
    res.status(400).json({ error: 'Invalid request body. Expected CV JSON object.' });
    return;
  }

  const jobDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-builder-'));
  const baseName = `cv-${randomUUID()}`;
  const texPath = path.join(jobDirectory, `${baseName}.tex`);
  const pdfPath = path.join(jobDirectory, `${baseName}.pdf`);

  try {
    const latexSource = buildCvLatex(cvData);
    await fs.writeFile(texPath, latexSource, 'utf8');

    await runPdflatex(jobDirectory, `${baseName}.tex`);

    const pdfBuffer = await fs.readFile(pdfPath);
    const safeName = (cvData?.personalInfo?.name || 'cv')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'cv'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.';
    res.status(500).json({ error: message });
  } finally {
    try {
      await fs.rm(jobDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures (e.g., transient file locks on Windows).
    }
  }
});

app.post('/api/render-preview', async (req, res) => {
  const cvData = normalizeCvData(req.body || {});

  if (!cvData || typeof cvData !== 'object') {
    res.status(400).json({ error: 'Invalid request body. Expected CV JSON object.' });
    return;
  }

  try {
    // Generate LaTeX source
    const latexSource = buildCvLatex(cvData);
    const cacheKey = generateCacheKey(cvData);

    // Render preview with queue management and caching
    const result = await renderPreview({
      latexSource,
      cvData,
      pdflatexPath: resolvePdflatexCommand(),
      nameHint: cvData?.personalInfo?.name || 'cv'
    });

    // Read compiled PDF buffer
    const pdfBuffer = await fs.readFile(result.pdfPath);

    // Return PDF as inline preview (not attachment)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    
    // Include diagnostic headers
    res.setHeader('X-Cache-Key', result.cacheKey);
    res.setHeader('X-Cache-Hit', result.cached ? 'true' : 'false');
    res.setHeader('X-Compilation-Exit-Code', String(result.diagnostics?.exitCode || 0));
    res.setHeader('X-Queue-Stats', JSON.stringify(getQueueStats()));

    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (error) {
    const err = error instanceof Error ? error : error.error;
    const diagnostics = error.diagnostics || null;
    const message = err instanceof Error ? err.message : 'Failed to generate preview.';
    
    res.status(500).json({
      error: message,
      cacheKey: generateCacheKey(cvData),
      diagnostics: diagnostics ? {
        exitCode: diagnostics.exitCode,
        errorLines: diagnostics.stdError.slice(-10), // Last 10 error lines
        outputLines: diagnostics.stdOutput.slice(-10) // Last 10 output lines
      } : null,
      queueStats: getQueueStats()
    });
  }
});

app.get('/api/queue-stats', (_req, res) => {
  res.json(getQueueStats());
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
