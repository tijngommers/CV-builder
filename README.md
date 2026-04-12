# CV Builder (React + LaTeX Resume Engine)

Frontend CV renderer with a backend service that can:

- compile CV data to PDF via `pdflatex`
- return raw LaTeX source for preview/debugging
- run a strict chat session contract that keeps requesting required fields until complete

## Architecture

- `src/`: React frontend
- `server/index.js`: Express API
- `server/latexTemplate.js`: CV JSON -> LaTeX template builder (source of truth)
- `server/schemas/cvSchema.js`: CV normalization, required-field rules, update merging
- `server/services/chatOrchestrator.js`: chat turn logic + SSE event payloads
- `server/services/sessionStore.js`: in-memory chat/session state

## Prerequisites

1. Node.js 18+
1. A LaTeX distribution with `pdflatex` on PATH:
   - Windows: MiKTeX or TeX Live
   - macOS: MacTeX
   - Linux: TeX Live
1. Optional for upcoming LLM integration:
   - `ANTHROPIC_API_KEY` for Claude-backed orchestration

Verify LaTeX installation:

- `pdflatex --version`

## Development Setup

1. Install dependencies:
   - `npm install`
1. Run dev servers:
   - `npm run dev`

This starts:

- React app on Vite dev server
- API server on `http://localhost:3001`

Vite proxies `/api/*` to backend during development.

## Test Setup

1. Run tests:
   - `npm test`
1. Test scope currently covers:
   - strict required-field behavior in schema utilities
   - chat stream contract (`text/event-stream` event sequence)
   - LaTeX source endpoint payload format

## Agent Contract (Chat + Render)

Use this section as the implementation boundary for future agents touching chat/render behavior.

- Run and validate:
  - `npm run dev` to start client + server
  - `npm test` to catch endpoint contract regressions
- Chat orchestration ownership:
  - `server/services/chatOrchestrator.js` owns Claude + LangGraph orchestration
  - `server/schemas/cvSchema.js` remains the single source of truth for normalize/update/required-field rules
- SSE contract for `POST /api/sessions/:sessionId/chat` must stay stable:
  - `user_message`
  - `cv_data_updated`
  - `assistant_message`
  - `done`
- Strictness guarantee:
  - required-field completeness is determined by schema utilities, not model output
  - `assistant_message.requiredFieldsComplete` must reflect schema-calculated status
- Claude and graph configuration:
  - `ANTHROPIC_API_KEY` enables live Claude calls
  - `CLAUDE_MODEL` overrides model (default: `claude-3-5-haiku-latest`)
  - `CLAUDE_MAX_TOKENS` controls response budget
- Failure behavior:
  - SSE event names stay unchanged even on orchestration failure
  - server falls back to deterministic required-field prompting when model call fails or key is missing

## API Contract

### `GET /api/health`

- Response: `{ "ok": true, "service": "cv-pdf-service" }`

### `POST /api/sessions`

Creates a chat session and computes initial missing required fields.

- Request body:

```json
{
  "cvData": {}
}
```

- Response:

```json
{
  "sessionId": "uuid",
  "cvData": {},
  "missingRequiredFields": ["personalInfo.name", "contact.email"],
  "requiredFieldsComplete": false
}
```

### `GET /api/sessions/:sessionId`

Returns session state, message history, and strict completeness status.

### `POST /api/sessions/:sessionId/chat`

Streams one assistant turn as SSE.

- Request body:

```json
{
  "message": "Here is new information",
  "updates": {
    "contact": { "email": "me@example.com" }
  }
}
```

- Response headers:
  - `Content-Type: text/event-stream`

- Event sequence contract (in order):
  - `user_message`
  - `cv_data_updated`
  - `assistant_message`
  - `done`

- `assistant_message` payload always includes:
  - `requiredFieldsComplete: boolean`

### `POST /api/latex-source`

Builds LaTeX source without compiling PDF.

- Request body:

```json
{
  "cvData": {}
}
```

- Response:

```json
{
  "latexSource": "\\documentclass...",
  "missingRequiredFields": [],
  "requiredFieldsComplete": true
}
```

### `POST /api/render-pdf`

Compiles LaTeX to PDF with `pdflatex`.

- Request body: CV JSON (same shape as `src/data/initialData.mts`)
- Response: `application/pdf`
- Errors: `{ "error": "message" }`

## Strict Required-Field Behavior

The assistant should continue asking for information until these required areas are complete:

- `personalInfo.name`
- `personalInfo.Birthdate`
- `contact.phonenumber`
- `contact.email`
- `contact.adress`
- `Profile`
- At least one valid `Work_experience` entry (`company`, `period`, `description`)
- At least one valid `Education` entry (`institution`, `degree`)

This behavior is implemented in `server/schemas/cvSchema.js` and enforced during chat turns.

## Production Build

- `npm run build`
