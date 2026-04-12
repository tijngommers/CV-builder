# Architecture Overview

This document describes the architecture, design decisions, and key components of CV Builder.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Browser                              │
│                 (React Vite Frontend)                         │
├─────────────────────────────────────────────────────────────┤
│  - FormEditor (CV form input)                                │
│  - ChatPane (AI assistant conversation)                      │
│  - LivePreview (PDF preview)                                 │
│  - useSession hook (state management)                        │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP/SSE
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Backend (Node.js)                    │
│              (http://localhost:3001)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │ Session Management                               │        │
│  │ - sessionStore.js (in-memory state)             │        │
│  │ - API routes for /api/sessions                  │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │ Chat & Updates                                   │        │
│  │ - chatOrchestrator.js (LangGraph + Claude)      │        │
│  │ - Event streaming (SSE)                         │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │ CV Data Processing                               │        │
│  │ - cvSchema.js (validation & normalization)      │        │
│  │ - latexTemplate.js (CV → LaTeX)                 │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │ Rendering                                        │        │
│  │ - previewRenderer.js (queue & cache)            │        │
│  │ - pdflatex execution                            │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
└────────────┬────────────────────────────────────────────────┘
             │ Spawns
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    pdflatex (LaTeX Engine)                   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend (React)

**Location**: `src/`

#### Components

- **App.jsx**: Root component, orchestrates panes
- **FormEditor.jsx**: Form for editing CV fields
- **ChatPane.jsx**: Chat interface with AI assistant
- **LivePreview.jsx**: PDF preview display

#### Hooks

- **useSession.js**: Session state, API communication
- **useChat.js**: Chat message history and streaming

#### Data Flow

```
User Input → Component State Update → useSession.updateCvData()
                                           ↓
                                    POST /api/sessions/:id/chat
                                           ↓
                                   Server processes and returns
                                      SSE events
                                           ↓
                                    Frontend updates state
                                           ↓
                                      UI re-renders
```

### 2. Backend (Express.js)

**Location**: `server/`

#### Single Source of Truth: cvSchema.js

All CV data validation, normalization, and required-field logic originates here.

```javascript
// Defines CV structure
normalizeCvData(input) → { /* normalized CV */ }

// Tracks what's missing
getMissingRequiredFields(cvData) → ["field1", "field2"]

// Merges updates intelligently
mergeUpdates(currentCv, updates) → { /* merged CV */ }
```

**Philosophy**: Every consumer (frontend, API, chat) uses these functions. Never duplicate logic.

#### API Routes (index.js)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Service health check |
| `/api/sessions` | POST | Create new session |
| `/api/sessions/:id` | GET | Retrieve session state |
| `/api/sessions/:id/chat` | POST | Chat message (SSE stream) |
| `/api/render-pdf` | POST | Download CV as PDF |
| `/api/render-preview` | POST | Inline PDF preview |
| `/api/queue-stats` | GET | Preview queue metrics |
| `/api/latex-source` | POST | Get raw LaTeX source |

#### Session State (sessionStore.js)

In-memory storage for developing/editing sessions:

```javascript
{
  sessionId: "uuid",
  createdAt: "2026-04-12T...",
  updatedAt: "2026-04-12T...",
  cvData: { /* Full CV data */ },
  missingRequiredFields: [ /* Missing fields */ ],
  messages: [
    { role: "user", content: "...", timestamp: "..." },
    { role: "assistant", content: "...", timestamp: "..." }
  ]
}
```

#### Chat Orchestration (chatOrchestrator.js)

Handles AI-powered conversation:

1. Receives user message and CV updates
2. Validates CV data against schema
3. If required fields missing:
   - Uses Claude to generate helpful prompts
   - Or falls back to deterministic prompting
4. Returns SSE events for frontend

**Fallback behavior**: Works without `ANTHROPIC_API_KEY`, user still gets deterministic chat.

#### LaTeX Generation (latexTemplate.js)

Converts CV JSON → Professional LaTeX source:

```
CV Data → escapeLatex() → Template Variables
                        ↓
                   Inject into Template
                        ↓
                    LaTeX Source
```

Features:
- Escapes special LaTeX characters
- Conditional rendering (only show LinkedIn if provided)
- Formatted sections (Experience, Education, Projects, etc.)
- Font Awesome icons for contact info

#### Preview Rendering (previewRenderer.js)

Manages concurrent PDF compilations:

```
User requests preview
         ↓
Check cache (SHA-256 key)  ← Cache hit? Return immediately
         ↓
Add to queue
         ↓
Wait for compilation slot (max 3 concurrent)
         ↓
Run pdflatex
         ↓
Cache result
         ↓
Return with diagnostics
```

## Data Flow Lifecycle

### User Edits CV in Form

```
User types in field
         ↓
FormEditor.handleInputChange()
         ↓
updateCvData() hook
         ↓
POST /api/sessions/:id/chat (with updates)
         ↓
Server receives, normalizes via cvSchema
         ↓
Stores in session
         ↓
Computes missing fields
         ↓
Streams cv_data_updated event
         ↓
Frontend updates state
         ↓
Components re-render
         ↓
LivePreview shows new PDF
```

### User Chats with AI

```
User types message in ChatPane
         ↓
POST /api/sessions/:id/chat (with message)
         ↓
Server runs chatOrchestrator
         ↓
Claude generates response (if API key set)
         ↓
Suggests CV updates
         ↓
Streams events:
   - user_message
   - cv_data_updated (if changes)
   - assistant_message
   - done
         ↓
Frontend updates chat history
         ↓
Frontend updates CV if suggested
         ↓
LivePreview updates PDF
```

## Design Principles

### 1. Single Source of Truth

All CV data rules live in `server/schemas/cvSchema.js`:
- Structure definition
- Validation logic
- Required-field rules
- Update merging

**Why**: Prevents inconsistency between frontend, chat, and API.

### 2. Reactive Updates

Frontend automatically syncs with server:
- Session updates via SSE
- PDF preview regenerates
- Missing-field list updates

**Why**: Real-time feedback to user.

### 3. Deterministic Fallback

If Claude API unavailable:
- Chat still works
- Uses rule-based prompting
- No feature loss, just less intelligent suggestions

**Why**: Graceful degradation.

### 4. Queue-based Rendering

Preview compilations are queued:
- Max 3 concurrent (configurable)
- Cache prevents re-compilation
- Diagnostics help debug

**Why**: Prevent server overload under heavy load.

### 5. Event-Driven Chat

Chat uses Server-Sent Events (SSE), not WebSockets:
- Simpler than WebSockets
- Native browser support
- Perfect for request-response pattern

**Event contract** (must not change):
```
event: user_message
event: cv_data_updated
event: assistant_message
event: done
```

## Technology Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 | Component-based, reactive |
| Build | Vite 5 | Fast, modern |
| Backend | Express 4 | Simple, proven |
| PDF Engine | pdflatex | Professional output |
| AI | Claude 3.5 | Best performance, fallback safe |
| Graph | LangGraph | Event-driven chat orchestration |
| State | In-memory | Session isolation, no DB setup |

## Scaling Considerations

If CV Builder grows:

### Current Constraints

- **In-memory sessions**: Lost on server restart
- **Single server**: No load balancing
- **Queue limit**: Max ~3 concurrent LaTeX compilations
- **No persistence**: Chat history lost

### Upgrade Path

1. **Add database** (MongoDB/PostgreSQL):
   - Replace sessionStore with DB queries
   - Persist messages and CV history

2. **Session pub/sub** (Redis):
   - Share sessions across multiple servers
   - Queue-based chat processing

3. **LaTeX worker pool**:
   - Offload to dedicated compilation service
   - Increase concurrent compilations

4. **CDN for assets**:
   - Serve compiled PDFs from edge locations
   - Cache LaTeX compilation results globally

## Error Handling

### Frontend

- Catch API errors, display user-friendly messages
- Graceful degradation if API unavailable

### Backend

- Validate all inputs against cvSchema
- Catch pdflatex errors, return diagnostics
- SSE events stay consistent even on error

### LaTeX Compilation

- Timeout protection (default 3 min)
- Capture stderr/stdout for debugging
- Return diagnostic headers in response

## Testing

Current test coverage:

- **Schema tests**: CV normalization and validation
- **Chat tests**: SSE event contract
- **API tests**: Request/response contracts
- **LaTeX tests**: Template rendering

Run with: `npm test`

Add tests when:
- Adding new required fields
- Changing API contracts
- Adding complex business logic

## Future Enhancements

Potential improvements (not roadmap commitments):

- Template selection (different resume styles)
- Export formats (Markdown, JSON)
- Custom CSS for PDF
- Version history
- Team collaboration
- Import from LinkedIn
- Multi-language support

## Debugging

### View LaTeX source

```
POST /api/latex-source with CV data
```

### Check session state

```
GET /api/sessions/:sessionId
```

### Monitor queue

```
GET /api/queue-stats
```

### Enable verbose logging

Add to Express routes:
```javascript
console.log('Session update:', { sessionId, cvData });
```

## Deployment

The app is designed to be cloud-ready:

- No file system writes (temp directories only)
- Environment-based configuration
- No session affinity required (with DB upgrade)
- Containerizable (Docker-ready)

Deployment checklist:
- [ ] Set environment variables
- [ ] Install LaTeX distro
- [ ] Run `npm build`
- [ ] Set `NODE_ENV=production`
- [ ] Ensure `ANTHROPIC_API_KEY` or acceptable fallback
