import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import { buildCvLatex } from './latexTemplate.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const PDFLATEX_TIMEOUT_MS = Number(process.env.PDFLATEX_TIMEOUT_MS || 30000);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cv-pdf-service' });
});

function runPdflatex(workingDirectory, texFileName) {
  return new Promise((resolve, reject) => {
    const args = ['-interaction=nonstopmode', '-halt-on-error', texFileName];
    const process = spawn('pdflatex', args, { cwd: workingDirectory, windowsHide: true });

    let stdErrorOutput = '';
    let stdOutput = '';

    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error('pdflatex timed out while compiling CV.'));
    }, PDFLATEX_TIMEOUT_MS);

    process.stdout.on('data', (chunk) => {
      stdOutput += chunk.toString();
    });

    process.stderr.on('data', (chunk) => {
      stdErrorOutput += chunk.toString();
    });

    process.on('error', (error) => {
      clearTimeout(timeout);
      if (error.code === 'ENOENT') {
        reject(new Error('pdflatex was not found. Install a LaTeX distribution (TeX Live, MiKTeX, MacTeX) and ensure pdflatex is available on PATH.'));
        return;
      }
      reject(error);
    });

    process.on('close', (code) => {
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
    await fs.rm(jobDirectory, { recursive: true, force: true });
  }
});

app.listen(PORT, () => {
  console.log(`CV PDF server running on http://localhost:${PORT}`);
});
