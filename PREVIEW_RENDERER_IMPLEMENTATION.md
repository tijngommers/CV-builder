# Preview Renderer Implementation

## Overview
Added a non-PDF center preview render endpoint with compile diagnostics, cache keying, and queue limits to the CV-builder server.

## New Files
- **server/services/previewRenderer.js** - Queue and cache management service for preview rendering

## Modified Files
- **server/index.js** - Added imports and new `/api/render-preview` endpoint

## Architecture

### Queue Management
- Limits concurrent pdflatex compilations (default: 3, configurable via `PREVIEW_MAX_CONCURRENT` env var)
- Queues compilation requests and processes them sequentially based on concurrency limit
- Prevents server overload from excessive compilation requests

### Cache Keying
- Generates SHA-256 hash of CV data to create unique cache keys
- Stores compiled PDFs with their diagnostics
- Reuses cached PDFs for identical CV data inputs
- Automatically manages file existence checks for cache invalidation

### Compile Diagnostics
- Captures pdflatex exit codes
- Collects stdout output (last 50 lines)
- Collects stderr output (last 20 lines) 
- Includes diagnostics in both success and error responses

## API Endpoints

### POST /api/render-preview
Renders a non-PDF center preview from LaTeX template output.

**Request:**
```json
{
  "personalInfo": { "name": "John Doe", "Birthdate": "1990-01-01" },
  "contact": { "email": "john@example.com", "phonenumber": "+1234567890", "adress": "123 Main St" },
  "Profile": "Software engineer with 5+ years experience",
  "Work_experience": { ... },
  "Education": { ... },
  "skills": { ... },
  "languages": { ... },
  "Hackathons": { ... },
  "Prizes": { ... },
  "Hobbies": [ ... ]
}
```

**Success Response (200):**
- Content-Type: application/pdf
- Content-Disposition: inline; filename="preview.pdf"
- X-Cache-Key: [SHA-256 hash of CV data]
- X-Cache-Hit: "true" | "false"
- X-Compilation-Exit-Code: "[0-n]"
- X-Queue-Stats: {"activeCompilations": n, "queuedCompilations": n, ...}
- Body: PDF bytes

**Error Response (500):**
```json
{
  "error": "error message",
  "cacheKey": "sha256hash",
  "diagnostics": {
    "exitCode": 1,
    "errorLines": ["line1", "line2", ...],
    "outputLines": ["line1", "line2", ...]
  },
  "queueStats": {
    "activeCompilations": 1,
    "queuedCompilations": 2,
    "maxConcurrent": 3,
    "cachedItems": 5
  }
}
```

### GET /api/queue-stats
Returns current queue and cache statistics.

**Response:**
```json
{
  "activeCompilations": 1,
  "queuedCompilations": 2,
  "maxConcurrent": 3,
  "cachedItems": 5
}
```

## Key Features

1. **Non-PDF Center Preview**: Returns PDF as inline content for browser preview rendering
2. **Compile Diagnostics**: Captures pdflatex output for debugging
3. **Cache Keying**: Uses SHA-256 hash of CV data for efficient caching
4. **Queue Management**: Limits concurrent compilations to prevent server overload
5. **Monitoring**: Queue stats endpoint for tracking compilation queue status
6. **Chat Endpoint Unchanged**: Original `/api/sessions/:sessionId/chat` endpoint behavior is preserved

## Configuration

Environment variables:
- `PREVIEW_MAX_CONCURRENT` - Max concurrent compilations (default: 3)
- `PDFLATEX_TIMEOUT_MS` - Timeout for pdflatex execution
- `PDFLATEX_PATH` - Path to pdflatex executable

## Implementation Details

### Cache Strategy
- Cache key: SHA-256(JSON.stringify(cvData))
- Storage: In-memory Map with file system verification
- Invalidation: Automatic on file not found

### Queue Strategy
FIFO queue with semaphore-style concurrency control:
1. Compilation request queued with cache key and function
2. Queue processor checks cache and file existence first
3. If cache miss, compileFn executed in correct order
4. Next queued item processes when slot available

### Diagnostics Collection
- Exit code from pdflatex process
- Last 50 lines of stdout
- Last 20 lines of stderr
- Timestamp on cache entry

## No Breaking Changes
- All existing endpoints unchanged
- Chat endpoint behavior preserved
- PDF rendering endpoint still available
- Backward compatible with current client code
