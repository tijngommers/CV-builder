# Contributing

Thanks for contributing.

## Prerequisites

- Node.js >= 18
- npm >= 9
- `pdflatex` installed and available on your machine

## Local Development

```bash
npm install
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

## Test and Build

```bash
npm test
npm run build
```

Both should pass before opening a PR.

## Branch and Commit

```bash
git checkout -b feat/short-description
```

Use conventional commit style where possible:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` structural improvement
- `test:` test updates
- `docs:` docs changes

## What to Update for Common Changes

### API contract changes

- Update server routes in `server/index.js`
- Update client callers in `src/hooks/useSession.js` and/or `src/components/*`
- Update `server/api.test.js`
- Update `README.md` and `ARCHITECTURE.md`

### Chat orchestration changes

- Update `server/services/chatOrchestrator.js`
- Keep SSE event payloads backward-compatible or update frontend parser in `src/components/ChatPane.jsx`
- Add/adjust tests in `server/api.test.js`

### Session behavior changes

- Update `server/services/sessionStore.js`
- Ensure history and revert behavior are covered by tests

## PR Checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No dead imports/files introduced
- [ ] README/API docs updated for any contract changes
- [ ] CHANGELOG entry added when behavior changes
