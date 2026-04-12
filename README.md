# CV Builder

A modern, interactive CV/Resume builder with real-time LaTeX preview, AI-powered chat assistance, and PDF export.

## ✨ Features

- **Real-time Preview**: Watch your CV update as you edit
- **LaTeX-based**: Professional PDF output via pdflatex
- **AI Chat Assistant**: Get help completing your CV using Claude AI
- **Session Management**: Persistent editing sessions
- **Responsive Design**: Works on desktop and tablet
- **Social Links**: Include LinkedIn and GitHub profiles
- **Form & Chat Modes**: Edit via form or natural language conversation

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **LaTeX Distribution** with `pdflatex`:
  - **Windows**: [MiKTeX](https://miktex.org/) or [TeX Live](https://www.tug.org/texlive/)
  - **macOS**: [MacTeX](https://www.tug.org/mactex/)
  - **Linux**: `sudo apt-get install texlive-full` (Ubuntu/Debian)

### Verify LaTeX Installation

```bash
pdflatex --version
```

### Installation & Development

```bash
# Install dependencies
npm install

# Start development servers (client + server)
npm run dev
```

This starts:

- **Client**: React app at `http://localhost:5173` (Vite)
- **Server**: API at `http://localhost:3001`

### Production Build

```bash
npm run build     # Build frontend
npm run preview   # Preview production build
```

## 📁 Project Structure

```
cv-builder/
├── src/                          # React frontend
│   ├── components/              # React components
│   │   ├── FormEditor.jsx      # CV form editor
│   │   ├── ChatPane.jsx        # AI chat interface
│   │   ├── LivePreview.jsx     # PDF preview
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   │   └── useSession.js       # Session management
│   ├── data/
│   │   └── initialData.mts     # Default CV data
│   ├── App.jsx                 # Main app component
│   └── main.jsx                # Vite entry point
│
├── server/                       # Node.js/Express backend
│   ├── index.js                # Express server & routes
│   ├── latexTemplate.js        # CV → LaTeX template engine
│   ├── schemas/
│   │   └── cvSchema.js         # CV data validation & normalization
│   └── services/
│       ├── chatOrchestrator.js # AI chat logic with LangGraph
│       ├── sessionStore.js     # Session state management
│       └── previewRenderer.js  # Queue & cache for previews
│
├── public/                       # Static assets
├── package.json
└── vite.config.js              # Vite configuration
```

## 🔌 API Reference

### Session Management

#### `POST /api/sessions`

Create a new CV editing session.

**Request:**

```json
{
  "cvData": {
    /* Optional: initial CV data */
  }
}
```

**Response:**

```json
{
  "sessionId": "uuid",
  "cvData": {
    /* Normalized CV data */
  },
  "missingRequiredFields": ["personalInfo.name", "contact.email"],
  "requiredFieldsComplete": false
}
```

#### `GET /api/sessions/:sessionId`

Retrieve current session data.

**Response:**

```json
{
  "sessionId": "uuid",
  "createdAt": "2026-04-12T...",
  "updatedAt": "2026-04-12T...",
  "messages": [
    /* Chat history */
  ],
  "cvData": {
    /* Current CV data */
  },
  "missingRequiredFields": [],
  "requiredFieldsComplete": true
}
```

### Chat & Updates

#### `POST /api/sessions/:sessionId/chat`

Send a message to the AI assistant. Stream-based with Server-Sent Events.

**Request:**

```json
{
  "message": "Add my work experience at Google",
  "updates": {
    /* Optional: direct CV updates */
  }
}
```

**Events:**

- `user_message`: User message echoed back
- `cv_data_updated`: CV data changed
- `assistant_message`: Assistant response
- `done`: Stream complete

### CV Rendering

#### `POST /api/render-pdf`

Render CV as PDF (attachment - download).

**Request:**

```json
{
  /* Full CV data object */
}
```

**Response:**

- Binary PDF file
- Header: `Content-Disposition: attachment`

#### `POST /api/render-preview`

Render CV as PDF preview (inline - in-browser view).

**Features:**

- Queue limiting (max 3 concurrent compilations)
- Cache keying (SHA-256 of CV data)
- Compile diagnostics included
- Response headers:
  - `X-Cache-Key`: Hash of CV data
  - `X-Cache-Hit`: true/false
  - `X-Compilation-Exit-Code`: LaTeX exit code
  - `X-Queue-Stats`: Queue metrics

**Response:**

- Binary PDF (inline)
- Header: `Content-Disposition: inline`

#### `GET /api/queue-stats`

Get current preview queue statistics.

**Response:**

```json
{
  "activeCompilations": 1,
  "queuedCompilations": 2,
  "maxConcurrent": 3,
  "cachedItems": 5
}
```

### Utilities

#### `POST /api/latex-source`

Get raw LaTeX source for debugging/preview.

**Request:**

```json
{
  /* CV data */
}
```

**Response:**

```json
{
  "latexSource": "\\documentclass{article}...",
  "missingRequiredFields": [],
  "requiredFieldsComplete": true
}
```

#### `GET /api/health`

Health check endpoint.

**Response:**

```json
{ "ok": true, "service": "cv-pdf-service" }
```

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3001
PDFLATEX_PATH=/usr/bin/pdflatex              # (Optional) Path to pdflatex
PDFLATEX_TIMEOUT_MS=180000                   # Timeout for LaTeX compilation

# AI Configuration (Optional)
ANTHROPIC_API_KEY=sk-ant-...                 # Claude API key
CLAUDE_MODEL=claude-3-5-haiku-latest        # Model selection
CLAUDE_MAX_TOKENS=1024                       # Response token limit

# Preview Rendering
PREVIEW_MAX_CONCURRENT=3                     # Max concurrent compilations
```

Use `.env.example` as a template.

## 📋 Required CV Fields

To generate a complete CV, users must provide:

1. **Personal Info**
   - Full name
   - Birthdate

2. **Contact**
   - Phone number
   - Email address
   - Address

3. **Work Experience**
   - At least one entry with: role, company, period, description

4. **Education**
   - At least one entry with: institution, degree

5. **Profile**
   - Professional summary

Optional fields:

- LinkedIn URL
- GitHub URL
- Skills (programming languages, frameworks)
- Languages spoken
- Hobbies
- Hackathons
- Prizes/Awards

## 🧪 Testing

```bash
# Run all tests
npm test

# Test coverage includes:
# - Schema validation and normalization
# - Chat SSE event contract
# - LaTeX generation
```

## 🛠️ Development

### Key Technologies

- **Frontend**: React 18, Vite 5, CSS3
- **Backend**: Node.js, Express 4
- **PDF Engine**: pdflatex (LaTeX)
- **AI**: Anthropic Claude (optional)
- **State Graph**: LangGraph

### Code Organization

- **Single Source of Truth**: `server/schemas/cvSchema.js` defines CV structure
- **Reactive Preview**: Frontend automatically updates on CV changes
- **Session Isolation**: Each session is independent with its own state
- **SSE Streaming**: Real-time updates via Server-Sent Events

### Adding Features

1. **New CV Fields**: Update `server/schemas/cvSchema.js`
2. **Form Fields**: Update `src/components/FormEditor.jsx`
3. **LaTeX Rendering**: Update `server/latexTemplate.js`
4. **Chat Logic**: Update `server/services/chatOrchestrator.js`

## 🐛 Troubleshooting

### "pdflatex: command not found"

LaTeX is not installed or not in PATH.

- Install LaTeX distribution (see Prerequisites)
- Or set `PDFLATEX_PATH` environment variable:
  ```bash
  export PDFLATEX_PATH=/path/to/pdflatex
  npm run dev
  ```

### "Chat not responding"

Missing or invalid API key.

- Set `ANTHROPIC_API_KEY` in `.env`
- Fallback: Chat still works but uses deterministic prompting without Claude

### "Vite dev server not proxying /api"

Make sure backend server is running on port 3001.

### "PDF generation timeout"

LaTeX compilation taking too long.

- Increase `PDFLATEX_TIMEOUT_MS`
- Reduce CV content complexity

## 📄 License

MIT - See LICENSE file

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -am 'Add your feature'`
6. Push: `git push origin feature/your-feature`
7. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/cv-builder/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/cv-builder/discussions)

---

**Built with ❤️ | CV Builder v0.1.0**

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
