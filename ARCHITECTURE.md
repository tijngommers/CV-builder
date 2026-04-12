# Architecture

## Overview

The project is a chat-first LaTeX resume system:

1. User sends prompts in the chat UI.
2. Server orchestrator generates a complete LaTeX resume draft.
3. Session store persists latest LaTeX and history snapshots.
4. Frontend fetches latest session state and requests PDF render.

## Runtime Components

### Frontend

- `src/App.jsx`: Root composition (preview + chat panes)
- `src/hooks/useSession.js`: Session lifecycle, refresh, and revert actions
- `src/components/ChatPane.jsx`: SSE chat client and message rendering
- `src/components/LivePreview.jsx`: PDF preview renderer via `/api/render-pdf`

### Backend

- `server/index.js`: Express routes and SSE stream plumbing
- `server/services/chatOrchestrator.js`: Claude/LangGraph orchestration + LaTeX validation
- `server/services/sessionStore.js`: In-memory session/message/history store
- `server/services/latexValidator.js`: LaTeX syntax validation before acceptance

## Data Model (Session)

```json
{
  "id": "uuid",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "messages": [{ "role": "user|assistant", "content": "string", "timestamp": "ISO" }],
  "latexSource": "string",
  "latexHistory": [
    {
      "timestamp": "ISO",
      "latexSource": "string",
      "userRequestSummary": "string"
    }
  ]
}
```

## API Surface

- `GET /api/health`
- `POST /api/sessions`
- `GET /api/sessions/:sessionId`
- `POST /api/sessions/:sessionId/chat` (SSE)
- `POST /api/render-pdf`
- `DELETE /api/sessions/:sessionId/history/:index`

## SSE Contract

`POST /api/sessions/:sessionId/chat` emits:

1. `user_message`
2. `assistant_message`
3. `done`

`assistant_message` includes:

- `text`: user-facing status/message
- `latexSource`: included on successful LaTeX generation
- `timestamp`
- `isError`

## Key Design Decisions

- Single architecture path: chat -> LaTeX -> PDF
- Server is source of truth for session state
- Frontend remains stateless regarding LaTeX generation logic
- History snapshots are only added when LaTeX content changes

## Known Constraints

- In-memory sessions only
- No distributed/session-shared storage
- Depends on local `pdflatex` availability
