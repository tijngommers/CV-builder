# CV Builder

Chat-first resume builder that generates LaTeX with AI and renders PDF previews in real time.

## What It Does

- Creates in-memory editing sessions
- Uses chat messages to update a full LaTeX resume draft
- Streams assistant events via Server-Sent Events (SSE)
- Compiles LaTeX to PDF with `pdflatex`
- Keeps per-session LaTeX history and supports revert

## Stack

- Frontend: React 18 + Vite 5
- Backend: Express 4 + Node.js
- AI orchestration: Anthropic SDK + LangGraph
- PDF engine: `pdflatex`

## Requirements

- Node.js >= 18
- npm >= 9
- LaTeX distribution installed (`pdflatex` available)

Windows example path used by default dev script:

- `%LOCALAPPDATA%\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe`

## Run Locally

```bash
npm install
npm run dev
```

This starts:

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

Build and preview frontend:

```bash
npm run build
npm run preview
```

Run tests:

```bash
npm test
```

## Environment Variables

Create a `.env` file if needed.

```env
PORT=3001
PDFLATEX_PATH=/absolute/path/to/pdflatex
PDFLATEX_TIMEOUT_MS=180000
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-3-5-haiku-latest
CLAUDE_MAX_TOKENS=800
```

If `ANTHROPIC_API_KEY` is missing, the app still works with deterministic fallback LaTeX.

## Project Structure

```text
src/
  App.jsx
  App.css
  main.jsx
  components/
    ChatPane.jsx
    ChatPane.css
    LivePreview.jsx
    LivePreview.css
  hooks/
    useSession.js

server/
  index.js
  api.test.js
  services/
    chatOrchestrator.js
    latexValidator.js
    sessionStore.js
```

## API

### GET `/api/health`

Returns service health.

```json
{ "ok": true, "service": "cv-pdf-service" }
```

### POST `/api/sessions`

Creates a new editing session.

Response:

```json
{
  "sessionId": "uuid",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "latexSource": ""
}
```

### GET `/api/sessions/:sessionId`

Returns session state.

```json
{
  "sessionId": "uuid",
  "createdAt": "...",
  "updatedAt": "...",
  "messages": [{ "role": "user", "content": "...", "timestamp": "..." }],
  "latexSource": "\\documentclass...",
  "latexHistory": [{ "timestamp": "...", "latexSource": "...", "userRequestSummary": "..." }]
}
```

### POST `/api/sessions/:sessionId/chat`

Sends a chat message and streams SSE events.

Request body:

```json
{ "message": "Create a software engineer resume." }
```

SSE events emitted:

- `user_message`
- `assistant_message`
- `done`

`assistant_message` payload includes:

- `text`: user-facing status/message
- `latexSource`: included on successful LaTeX generation
- `timestamp`
- `isError`

### POST `/api/render-pdf`

Compiles LaTeX to PDF.

Request body:

```json
{ "latexSource": "\\documentclass{article} ..." }
```

Response: PDF binary (`Content-Type: application/pdf`).

### DELETE `/api/sessions/:sessionId/history/:index`

Reverts LaTeX to a previous history entry.

## Notes and Limits

- Session storage is in-memory only (lost on server restart)
- No multi-user persistence/database yet
- PDF compile speed depends on local LaTeX installation

## License

MIT. See [LICENSE](LICENSE).
