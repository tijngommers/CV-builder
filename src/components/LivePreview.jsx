import { useEffect, useState } from 'react';
import './LivePreview.css';
import { createLogger, createRequestId } from '../utils/logger';

const logger = createLogger('LivePreview');

export function LivePreview({ latexSource, isLoading }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const generatePreview = async () => {
      if (!latexSource || isLoading) return;

      setIsGenerating(true);
      setPreviewError(null);
      const requestId = createRequestId();
      const requestLogger = logger.child({ requestId });

      try {
        const startedAt = performance.now();
        requestLogger.info('preview.generate.start', {
          latexLength: latexSource.length
        });
        // Generate PDF from LaTeX source
        const pdfResponse = await fetch('/api/render-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId
          },
          body: JSON.stringify({ latexSource })
        });

        requestLogger.info('preview.generate.response', {
          statusCode: pdfResponse.status,
          durationMs: Math.round(performance.now() - startedAt)
        });

        if (!pdfResponse.ok) {
          const result = await pdfResponse.json().catch(() => ({}));
          requestLogger.warn('preview.generate.http_error', {
            reasonCode: 'RENDER_PDF_HTTP_ERROR',
            statusCode: pdfResponse.status
          });
          throw new Error(result.error || 'Failed to generate PDF');
        }

        const pdfBlob = await pdfResponse.blob();
        const fileUrl = URL.createObjectURL(pdfBlob);
        requestLogger.info('preview.generate.success', {
          pdfSizeBytes: pdfBlob.size
        });

        setPdfUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return fileUrl;
        });
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : 'Failed to generate preview');
        requestLogger.error('preview.generate.failed', {
          reasonCode: 'PREVIEW_GENERATION_FAILED',
          error
        });
      } finally {
        setIsGenerating(false);
      }
    };

    // Debounce the preview generation
    const timer = setTimeout(generatePreview, 500);
    return () => clearTimeout(timer);
  }, [latexSource, isLoading]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  return (
    <div className="live-preview">
      <div className="preview-header">
        <h2>Live Preview</h2>
        {isGenerating && <span className="generating-indicator">Updating...</span>}
      </div>

      <div className="preview-content">
        {previewError ? (
          <div className="preview-error">
            <p>Error generating preview:</p>
            <code>{previewError}</code>
          </div>
        ) : pdfUrl ? (
          <iframe
            title="CV PDF Preview"
            src={pdfUrl}
            className="pdf-preview"
          />
        ) : isGenerating ? (
          <div className="preview-loading">
            <div className="spinner"></div>
            <p>Generating preview...</p>
          </div>
        ) : (
          <div className="preview-empty">
            <p>Fill in the form to see your CV preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
