import { useEffect, useState } from 'react';
import { CV } from './data/initialData.mts';

function App() {
  const [cvData] = useState(CV);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfFileName, setPdfFileName] = useState('cv.pdf');

  useEffect(() => () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
  }, [pdfPreviewUrl]);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    setDownloadError('');

    try {
      const response = await fetch('/api/render-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cvData),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to generate PDF.');
      }

      const pdfBlob = await response.blob();
      const fileUrl = URL.createObjectURL(pdfBlob);
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName = filenameMatch?.[1] || 'cv.pdf';

      setPdfPreviewUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return fileUrl;
      });
      setPdfFileName(fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unexpected error while generating PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPreview = () => {
    if (!pdfPreviewUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    link.download = pdfFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <>
      <div className="pdf-controls">
        <button className="download-pdf-btn" onClick={handleGeneratePdf} disabled={isGenerating}>
          {isGenerating ? 'Generating PDF...' : 'Generate LaTeX PDF'}
        </button>
        {pdfPreviewUrl ? (
          <button className="download-pdf-btn secondary" onClick={handleDownloadPreview}>
            Download Current PDF
          </button>
        ) : null}
      </div>
      {downloadError ? <p className="download-error">{downloadError}</p> : null}
      {pdfPreviewUrl ? (
        <section className="pdf-preview-wrapper" aria-label="Generated LaTeX PDF preview">
          <h2>Generated PDF Preview</h2>
          <iframe title="LaTeX CV PDF Preview" src={pdfPreviewUrl} className="pdf-preview-frame" />
        </section>
      ) : null}
      <main className="cv-page">
        <header className="cv-header">
          <div className="header-top-row">
            <h1>{cvData.personalInfo.name}</h1>
            <p>{cvData.personalInfo.Birthdate}</p>
          </div>
          <div className="header-bottom-row">
            <p>{cvData.contact.phonenumber}</p>
            <span className="header-separator" aria-hidden="true">|</span>
            <p>{cvData.contact.email}</p>
            <span className="header-separator" aria-hidden="true">|</span>
            <p>{cvData.contact.adress}</p>
          </div>
        </header>

        <section className="cv-section">
          <h2>Profile</h2>
          <p>{cvData.Profile}</p>
        </section>

        <section className="cv-section">
          <h2>Work Experience</h2>
          {Object.entries(cvData.Work_experience).map(([position, work]) => (
            <div key={position} className="cv-entry">
              <p className="entry-meta">{work.period}</p>
              <h3>{position}</h3>
              <p className="entry-subtitle">{work.company}</p>
              <p>{work.description}</p>
            </div>
          ))}
        </section>

        <section className="cv-section">
          <h2>Education</h2>
          {Object.entries(cvData.Education).map(([period, edu]) => (
            <div key={period} className="cv-entry">
              <p className="entry-meta">{period}</p>
              <h3>{edu.institution}</h3>
              <p className="entry-subtitle">{edu.degree}</p>
            </div>
          ))}
        </section>

        <section className="cv-section">
          <h2>Skills</h2>
          <p><strong>Programming Languages:</strong> {cvData.skills.programmingLanguages.join(', ')}</p>
          <p><strong>Frameworks:</strong> {cvData.skills.frameworks.join(', ')}</p>
        </section>

        <section className="cv-section">
          <h2>Languages</h2>
          <ul>
            {Object.entries(cvData.languages).map(([lang, level]) => (
              <li key={lang}>
                <strong>{lang}:</strong> {level}
              </li>
            ))}
          </ul>
        </section>

        <section className="cv-section">
          <h2>Hackathons</h2>
          {Object.entries(cvData.Hackathons).map(([name, hackathon]) => (
            <div key={name} className="cv-entry">
              <p className="entry-meta">{hackathon.date}</p>
              <h3>{name}</h3>
              <p>{hackathon.description}</p>
            </div>
          ))}
        </section>

        <section className="cv-section">
          <h2>Prizes</h2>
          {Object.entries(cvData.Prizes).map(([name, prize]) => (
            <div key={name} className="cv-entry">
              <p className="entry-meta">{prize.date}</p>
              <h3>{name}</h3>
              <p>{prize.description}</p>
            </div>
          ))}
        </section>

        <section className="cv-section">
          <h2>Degrees & Certifications</h2>
          {Object.entries(cvData.Degrees).map(([name, degree]) => (
            <div key={name} className="cv-entry">
              <p className="entry-meta">{degree.date}</p>
              <h3>{name}</h3>
              <p className="entry-subtitle">{degree.organization}</p>
              <p>{degree.degree}</p>
            </div>
          ))}
        </section>

        <section className="cv-section">
          <h2>Hobbies</h2>
          <p>{cvData.Hobbies.join(', ')}</p>
        </section>
      </main>
    </>
  );
}

export default App;