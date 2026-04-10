# CV Builder (React + LaTeX PDF Engine)

Frontend CV renderer with a backend PDF service that compiles CV data through `pdflatex` and returns a downloadable PDF.

## Architecture

- `src/`: React frontend (preview and CV data rendering)
- `server/index.js`: Express API for PDF generation
- `server/latexTemplate.js`: CV JSON → LaTeX template builder
- `POST /api/render-pdf`: accepts CV JSON, compiles `.tex` with `pdflatex`, returns PDF bytes

## Prerequisites

1. Node.js 18+
2. A LaTeX distribution with `pdflatex` on PATH:
   - Windows: MiKTeX or TeX Live
   - macOS: MacTeX
   - Linux: TeX Live

Verify LaTeX installation:

- `pdflatex --version`

## Development

- `npm install`
- `npm run dev`

This starts:

- React app on Vite dev server
- PDF API server on `http://localhost:3001`

Vite proxies `/api/*` to the backend in development.

## Production build

- `npm run build`

## API Contract

### `POST /api/render-pdf`

- Request body: CV JSON (same structure as `src/data/initialData.mts`)
- Response: `application/pdf`
- Errors: JSON `{ "error": "message" }`
