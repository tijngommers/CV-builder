import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

/**
 * Queue and cache management for preview rendering.
 * Limits concurrent compilations and caches compiled PDFs by data hash.
 */

const defaultConfig = {
  maxConcurrentCompilations: 3,
  cacheDirectory: path.join(os.tmpdir(), 'cv-preview-cache'),
  pdflatexTimeoutMs: 180000
};

let config = { ...defaultConfig };
let compilationQueue = [];
let activeCompilations = 0;
const compilationCache = new Map(); // Maps cache key -> { pdfPath, timestamp, diagnostics }

/**
 * Initialize preview renderer with custom configuration.
 */
export function initializePreviewRenderer(customConfig = {}) {
  config = { ...defaultConfig, ...customConfig };
  return config;
}

/**
 * Generate a cache key from CV data using SHA-256 hash.
 */
export function generateCacheKey(cvData) {
  const dataString = JSON.stringify(cvData);
  return createHash('sha256').update(dataString).digest('hex');
}

/**
 * Get cache entry if it exists and is still valid.
 * Returns null if cache miss or entry expired.
 */
function getCacheEntry(cacheKey) {
  const entry = compilationCache.get(cacheKey);
  if (!entry) return null;

  // Check if file still exists
  if (!entry.pdfPath) return null;

  return entry;
}

/**
 * Set cache entry with PDF path and diagnostics.
 */
function setCacheEntry(cacheKey, pdfPath, diagnostics) {
  compilationCache.set(cacheKey, {
    pdfPath,
    timestamp: Date.now(),
    diagnostics
  });
}

/**
 * Run pdflatex with diagnostics collection.
 */
function runPdflatexWithDiagnostics(workingDirectory, texFileName, pdflatexPath) {
  return new Promise((resolve, reject) => {
    const args = ['-interaction=nonstopmode', '-halt-on-error', texFileName];
    const childProcessEnv = {
      ...process.env,
      MIKTEX_NO_GUI: process.env.MIKTEX_NO_GUI || '1',
      MIKTEX_AUTOINSTALL: process.env.MIKTEX_AUTOINSTALL || '1'
    };

    const childProcess = spawn(pdflatexPath, args, {
      cwd: workingDirectory,
      windowsHide: true,
      env: childProcessEnv
    });

    let stdErrorOutput = '';
    let stdOutput = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('pdflatex timed out while compiling CV preview.'));
    }, config.pdflatexTimeoutMs);

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
      const diagnostics = {
        exitCode: code,
        stdOutput: stdOutput.split('\n').slice(-50), // Last 50 lines
        stdError: stdErrorOutput ? stdErrorOutput.split('\n').slice(-20) : [] // Last 20 lines
      };

      if (code !== 0) {
        reject({
          error: new Error(`pdflatex failed with code ${code}.`),
          diagnostics
        });
        return;
      }

      resolve(diagnostics);
    });
  });
}

/**
 * Process the next compilation in queue.
 */
async function processQueue() {
  if (activeCompilations >= config.maxConcurrentCompilations || compilationQueue.length === 0) {
    return;
  }

  activeCompilations++;
  const { cacheKey, cvDataHash, promise } = compilationQueue.shift();

  try {
    // Check cache first
    const cached = getCacheEntry(cacheKey);
    if (cached && cached.pdfPath) {
      try {
        await fs.access(cached.pdfPath);
        promise.resolve({
          cached: true,
          ...cached
        });
        activeCompilations--;
        processQueue();
        return;
      } catch {
        // Cache file was deleted, continue with compilation
        compilationCache.delete(cacheKey);
      }
    }

    // Execute the compilation
    const result = await promise.compilationFn();
    promise.resolve(result);
  } catch (error) {
    promise.reject(error);
  } finally {
    activeCompilations--;
    processQueue();
  }
}

/**
 * Queue a compilation task with cache and queue management.
 * Returns a promise that resolves with { pdfPath, diagnostics, cached }
 */
export function queueCompilation(cacheKey, compilationFn) {
  return new Promise((resolve, reject) => {
    const promise = {
      resolve,
      reject,
      compilationFn
    };

    compilationQueue.push({
      cacheKey,
      promise
    });

    processQueue();
  });
}

/**
 * Render preview with full workflow: queue management, compilation, caching, diagnostics.
 */
export async function renderPreview({
  latexSource,
  cvData,
  pdflatexPath,
  nameHint = 'cv'
}) {
  const cacheKey = generateCacheKey(cvData);

  // Check cache first
  const cached = getCacheEntry(cacheKey);
  if (cached && cached.pdfPath) {
    try {
      await fs.access(cached.pdfPath);
      return {
        cached: true,
        cacheKey,
        pdfPath: cached.pdfPath,
        diagnostics: cached.diagnostics
      };
    } catch {
      compilationCache.delete(cacheKey);
    }
  }

  // Queue compilation
  const compilationFn = async () => {
    // Create temporary working directory
    const jobId = `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workingDirectory = path.join(os.tmpdir(), jobId);
    const baseName = 'preview';
    const texPath = path.join(workingDirectory, `${baseName}.tex`);
    const pdfPath = path.join(workingDirectory, `${baseName}.pdf`);

    try {
      // Create working directory
      await fs.mkdir(workingDirectory, { recursive: true });

      // Write LaTeX source
      await fs.writeFile(texPath, latexSource, 'utf8');

      // Run pdflatex with diagnostics
      const diagnostics = await runPdflatexWithDiagnostics(workingDirectory, `${baseName}.tex`, pdflatexPath);

      // Verify PDF exists
      await fs.access(pdfPath);

      // Store in cache
      setCacheEntry(cacheKey, pdfPath, diagnostics);

      return {
        cached: false,
        cacheKey,
        pdfPath,
        diagnostics,
        workingDirectory
      };
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(workingDirectory, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures
      }

      throw error;
    }
  };

  return queueCompilation(cacheKey, compilationFn);
}

/**
 * Get current queue statistics.
 */
export function getQueueStats() {
  return {
    activeCompilations,
    queuedCompilations: compilationQueue.length,
    maxConcurrent: config.maxConcurrentCompilations,
    cachedItems: compilationCache.size
  };
}

/**
 * Clear all cache entries.
 */
export function clearCache() {
  compilationCache.clear();
}

/**
 * Get configuration.
 */
export function getConfig() {
  return { ...config };
}
