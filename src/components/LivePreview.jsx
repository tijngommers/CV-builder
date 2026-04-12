import { useEffect, useState } from 'react';
import './LivePreview.css';

export function LivePreview({ latexSource, isLoading }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const generatePreview = async () => {
      if (!latexSource || isLoading) return;

      setIsGenerating(true);
      setPreviewError(null);

      try {
        // Generate PDF from LaTeX source
        const pdfResponse = await fetch('/api/render-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latexSource })
        });

        if (!pdfResponse.ok) {
          const result = await pdfResponse.json().catch(() => ({}));
          throw new Error(result.error || 'Failed to generate PDF');
        }

        const pdfBlob = await pdfResponse.blob();
        const fileUrl = URL.createObjectURL(pdfBlob);

        setPdfUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return fileUrl;
        });
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : 'Failed to generate preview');
        console.error('Preview generation error:', error);
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
          <>
            <iframe
              title="CV PDF Preview"
              src={pdfUrl}
              className="pdf-preview"
            />
            <div className="preview-actions">
              <a href={pdfUrl} download="cv.pdf" className="download-btn">
                ⬇ Download PDF
              </a>
            </div>
          </>
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
