# Preview Renderer API Usage Guide

## Quick Start

### Start the Server
```bash
npm run dev:server
```

The server will start on `http://localhost:3001` (or custom PORT env var).

## API Usage Examples

### 1. Render Preview (POST /api/render-preview)

#### cURL Example
```bash
curl -X POST http://localhost:3001/api/render-preview \
  -H "Content-Type: application/json" \
  -d '{
    "personalInfo": {
      "name": "Jane Smith",
      "Birthdate": "1992-05-15"
    },
    "contact": {
      "email": "jane@example.com",
      "phonenumber": "+1 (555) 123-4567",
      "adress": "456 Oak Avenue, Boston, MA 02101"
    },
    "Profile": "Full-stack engineer with expertise in React and Node.js",
    "Work_experience": {
      "Senior Engineer": {
        "company": "Tech Startup",
        "period": "2021 - Present",
        "description": "Led architecture redesign, managed team of 5 engineers"
      }
    },
    "Education": {
      "2020": {
        "institution": "MIT",
        "degree": "M.S. Computer Science",
        "period": "2018 - 2020"
      }
    },
    "skills": {
      "programmingLanguages": ["JavaScript", "Python", "Go"],
      "frameworks": ["React", "Node.js", "Express", "Django"]
    },
    "languages": {
      "English": "Native",
      "French": "Intermediate"
    },
    "Hackathons": {},
    "Prizes": {},
    "Hobbies": ["Machine learning", "Running"]
  }' \
  --output preview.pdf
```

#### JavaScript/Node.js Example
```javascript
import fetch from 'node-fetch';

const cvData = {
  personalInfo: { name: 'Jane Smith', Birthdate: '1992-05-15' },
  contact: {
    email: 'jane@example.com',
    phonenumber: '+1 (555) 123-4567',
    adress: '456 Oak Avenue, Boston, MA 02101'
  },
  Profile: 'Full-stack engineer with expertise in React and Node.js',
  Work_experience: {
    'Senior Engineer': {
      company: 'Tech Startup',
      period: '2021 - Present',
      description: 'Led architecture redesign, managed team of 5 engineers'
    }
  },
  Education: {
    '2020': {
      institution: 'MIT',
      degree: 'M.S. Computer Science',
      period: '2018 - 2020'
    }
  },
  skills: {
    programmingLanguages: ['JavaScript', 'Python', 'Go'],
    frameworks: ['React', 'Node.js', 'Express', 'Django']
  },
  languages: { English: 'Native', French: 'Intermediate' },
  Hackathons: {},
  Prizes: {},
  Hobbies: ['Machine learning', 'Running']
};

const response = await fetch('http://localhost:3001/api/render-preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cvData)
});

if (response.ok) {
  const cacheKey = response.headers.get('X-Cache-Key');
  const cacheHit = response.headers.get('X-Cache-Hit');
  const exitCode = response.headers.get('X-Compilation-Exit-Code');

  console.log(`Cache Key: ${cacheKey}`);
  console.log(`Cache Hit: ${cacheHit}`);
  console.log(`Exit Code: ${exitCode}`);

  const pdfBuffer = await response.buffer();
  // Save or process PDF
} else {
  const error = await response.json();
  console.error('Error:', error);
  console.error('Diagnostics:', error.diagnostics);
  console.error('Queue Stats:', error.queueStats);
}
```

#### React Component Example
```javascript
import { useState } from 'react';

export function PreviewRenderer({ cvData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const handleRenderPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cvData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error);
        setDiagnostics(errorData.diagnostics);
        return;
      }

      // Create blob URL for inline PDF viewer
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // Log diagnostics from headers
      console.log({
        cacheKey: response.headers.get('X-Cache-Key'),
        cacheHit: response.headers.get('X-Cache-Hit'),
        exitCode: response.headers.get('X-Compilation-Exit-Code'),
        queueStats: JSON.parse(response.headers.get('X-Queue-Stats'))
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleRenderPreview} disabled={loading}>
        {loading ? 'Rendering...' : 'Render Preview'}
      </button>

      {error && (
        <div className="error">
          <p>Error: {error}</p>
          {diagnostics && (
            <details>
              <summary>Diagnostics</summary>
              <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {previewUrl && (
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '600px', marginTop: '20px' }}
          title="CV Preview"
        />
      )}
    </div>
  );
}
```

### 2. Check Queue Status (GET /api/queue-stats)

#### cURL Example
```bash
curl http://localhost:3001/api/queue-stats
```

Response:
```json
{
  "activeCompilations": 1,
  "queuedCompilations": 2,
  "maxConcurrent": 3,
  "cachedItems": 5
}
```

#### JavaScript Example
```javascript
async function checkQueueStatus() {
  const response = await fetch('http://localhost:3001/api/queue-stats');
  const stats = await response.json();

  console.log(`Active compilations: ${stats.activeCompilations}/${stats.maxConcurrent}`);
  console.log(`Queued: ${stats.queuedCompilations}`);
  console.log(`Cached PDFs: ${stats.cachedItems}`);
}
```

## Response Status Codes

### Success (200)
PDF buffer returned with diagnostic headers:
- `X-Cache-Key`: Unique identifier for this CV data
- `X-Cache-Hit`: Whether result was cached
- `X-Compilation-Exit-Code`: pdflatex exit code
- `X-Queue-Stats`: Current queue statistics

### Bad Request (400)
```json
{
  "error": "Invalid request body. Expected CV JSON object."
}
```

### Server Error (500)
```json
{
  "error": "pdflatex failed with code 1.",
  "cacheKey": "sha256hash...",
  "diagnostics": {
    "exitCode": 1,
    "errorLines": ["line1", "line2", ...],
    "outputLines": ["line1", "line2", ...]
  },
  "queueStats": {
    "activeCompilations": 0,
    "queuedCompilations": 0,
    "maxConcurrent": 3,
    "cachedItems": 5
  }
}
```

## Configuration

### Through Environment Variables
```bash
# Max concurrent LaTeX compilations
export PREVIEW_MAX_CONCURRENT=3

# Timeout for pdflatex execution (milliseconds)
export PDFLATEX_TIMEOUT_MS=180000

# Path to pdflatex executable
export PDFLATEX_PATH="/usr/bin/pdflatex"

npm run dev:server
```

### On Windows with MiKTeX
```powershell
$env:PDFLATEX_PATH="$env:LOCALAPPDATA\Programs\MiKTeX\miktex\bin\x64\pdflatex.exe"
$env:PREVIEW_MAX_CONCURRENT=2
npm run dev:server
```

## Performance Considerations

### Cache Hit Strategy
- Different CV data = different cache key (SHA-256)
- Identical CV data = instant cache hit (no compilation)
- Large projects with many previews benefit from caching

### Queue Management
- Default: 3 concurrent compilations
- Each compilation takes ~2-5 seconds
- Queue helps prevent server overload
- Monitor `/api/queue-stats` to adjust limits

### Memory Usage
- In-memory cache grows with number of unique CVs
- Consider clearing cache periodically for long-running servers
- Cache entries not removed on PDF file deletion (will be recreated)

## Troubleshooting

### pdflatex not found
```
Error: pdflatex was not found. Install a LaTeX distribution...
```
**Solution**: Install TeX Live, MiKTeX, or MacTeX, then set `PDFLATEX_PATH`

### Timeout errors
```
Error: pdflatex timed out while compiling CV preview.
```
**Solution**: Increase `PDFLATEX_TIMEOUT_MS` (default 180000ms = 3 minutes)

### Queue getting long
```
"queuedCompilations": 10
```
**Solution**: Increase `PREVIEW_MAX_CONCURRENT` or optimize CV data
