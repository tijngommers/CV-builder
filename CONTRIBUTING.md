# Contributing to CV Builder

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the CV Builder project.

## Code of Conduct

Be respectful, inclusive, and professional. We welcome contributors from all backgrounds.

## Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/your-username/cv-builder.git
cd cv-builder
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings (especially ANTHROPIC_API_KEY if testing AI)
```

### 3. Start Development Servers

```bash
npm run dev
```

## Development Workflow

### Creating a Feature Branch

```bash
# Create and switch to feature branch
git checkout -b feature/short-description

# Examples:
# git checkout -b feature/add-phone-input-validation
# git checkout -b feature/improve-pdf-rendering
# git checkout -b bugfix/fix-session-timeout
```

### Making Changes

1. **Frontend (React)**
   - Components are in `src/components/`
   - Hooks are in `src/hooks/`
   - Styles are in `src/style/` and component `.css` files

2. **Backend (Node.js/Express)**
   - Routes are in `server/index.js`
   - Schema rules are in `server/schemas/cvSchema.js`
   - LaTeX generation is in `server/latexTemplate.js`
   - Services are in `server/services/`

3. **Data Structure**
   - CV data shape is defined in `server/schemas/cvSchema.js`
   - This is the single source of truth
   - Update this first when adding new fields

### Testing Changes

```bash
# Run test suite
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Running Manual Tests

1. **Test in browser**: http://localhost:5173
2. **API health**: http://localhost:3001/api/health
3. **Test PDF generation**: Create a session and try rendering
4. **Test chat**: Try messaging the AI assistant (if API key is set)

## Commit Guidelines

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build scripts, dependencies, etc.

### Examples

```bash
git commit -m "feat(form): add github profile input field"
git commit -m "fix(preview): resolve pdf timeout on large cvs"
git commit -m "docs(readme): update api reference section"
```

## Pull Request Process

1. **Update your branch**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push your changes**
   ```bash
   git push origin feature/your-feature
   ```

3. **Create Pull Request**
   - Go to GitHub and create a PR
   - Use a descriptive title
   - Reference any related issues: "Fixes #123"
   - Describe what changed and why

4. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Changes
   - Change 1
   - Change 2

   ## Testing
   How you tested the changes

   ## Screenshots (if UI changes)
   Add before/after screenshots

   ## Closes
   Closes #123
   ```

5. **PR Checklist**
   - [ ] Code follows style guidelines
   - [ ] Tests pass: `npm test`
   - [ ] Build succeeds: `npm run build`
   - [ ] No console errors/warnings
   - [ ] Documentation updated (if needed)
   - [ ] Commit messages are descriptive

## Common Development Tasks

### Adding a New CV Field

1. **Add to schema** (`server/schemas/cvSchema.js`):
   ```javascript
   export function normalizeCvData(input = {}) {
     return {
       // ... existing fields
       newField: typeof source.newField === 'string' ? source.newField : ''
     };
   }
   ```

2. **Add to form** (`src/components/FormEditor.jsx`):
   ```jsx
   <div className="form-group">
     <label htmlFor="newfield">New Field</label>
     <input
       id="newfield"
       type="text"
       value={cvData.newField || ''}
       onChange={(e) => handleInputChange('newField', e.target.value)}
       placeholder="Enter new field"
     />
   </div>
   ```

3. **Add to LaTeX template** (`server/latexTemplate.js`):
   ```javascript
   const newFieldValue = escapeLatex(cvData.newField || 'N/A');
   // Use newFieldValue in LaTeX template string
   ```

4. **Test it**:
   ```bash
   npm test
   npm run build
   ```

### Adding Required Field Validation

1. **Update schema** (`server/schemas/cvSchema.js`):
   ```javascript
   export const REQUIRED_FIELD_QUESTIONS = {
     'newField': 'Question to ask about new field?',
     // ...
   };

   export function getMissingRequiredFields(cvData = {}) {
     const missing = [];
     if (!hasText(normalized.newField)) {
       missing.push('newField');
     }
     return missing;
   }
   ```

2. Test with: `npm test`

### Pushing Styling Changes

1. Modify component CSS file or `src/style/index.css`
2. Test responsiveness: Resize browser window
3. Check on different browsers if possible

## Code Style Guidelines

### JavaScript/JSX

```javascript
// Use descriptive variable names
const userSessionId = 'abc123';
const isFormValid = checkValidation();

// Use const/let (not var)
const config = { /* ... */ };
let state = '';

// Prefer arrow functions
const handleClick = () => { /* ... */ };

// Use template literals
const message = `Hello, ${name}!`;

// Add comments for complex logic
// Check if all required fields are present before allowing export
```

### CSS

```css
/* Use semantic class names */
.form-editor { /* ... */ }
.missing-field { /* ... */ }

/* Use consistent spacing */
.button {
  padding: 10px 20px;
  margin: 5px 0;
}
```

### Comments

```javascript
// ✓ Good: Explains why, not what
// Check required fields first to avoid unnecessary API calls
const missing = getMissingRequiredFields(cvData);

// ✗ Bad: States the obvious
// Get missing required fields
const missing = getMissingRequiredFields(cvData);
```

## Reporting Issues

### Bug Reports

Best format:
```markdown
## Description
What's the issue?

## Steps to Reproduce
1. ...
2. ...
3. ...

## Expected Behavior
What should happen?

## Actual Behavior
What actually happens?

## Environment
- OS: Windows/macOS/Linux
- Node version: 18.x
- Browser: Chrome/Firefox/Safari
```

### Feature Requests

```markdown
## Description
What do you want to add?

## Use Case
Why is this needed?

## Proposed Solution
How should it work?

## Alternatives
Any other approaches?
```

## Documentation

When adding features, please update:

1. **README.md** - Add to features or API sections
2. **Code comments** - Explain complex logic
3. **Commit messages** - Describe changes clearly

## Performance Considerations

- Test with large CVs (many entries)
- Check browser DevTools Performance tab
- Keep dependencies minimal
- Optimize render cycles in React components

## Security

- Never commit API keys or sensitive data
- Use `.env.example` for configuration templates
- Validate user input on backend
- Keep dependencies updated: `npm audit`

## Questions?

- Check existing issues and PRs
- Create a [discussion](https://github.com/yourusername/cv-builder/discussions)
- Open an issue to ask questions

## Thank You!

Your contributions help make CV Builder better. We appreciate your time and effort!
