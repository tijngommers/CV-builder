# Technical Implementation: Dynamic CV Sections

## Overview

The CV Builder has been refactored to support unlimited custom sections with flexible field types instead of a hardcoded schema.

## Architecture Changes

### Data Structure

**Before (Fixed Structure):**
```javascript
{
  personalInfo: { name, birthdate },
  contact: { email, phone, address },
  skills: { programmingLanguages[], frameworks[] },
  Work_experience: { [key]: { company, period, description } },
  Education: { [key]: { institution, degree } },
  // ... more fixed fields
}
```

**After (Dynamic Structure):**
```javascript
{
  sections: [
    {
      id: number,
      name: string,
      fields: [
        {
          id: number,
          name: string,
          type: 'text' | 'textarea' | 'list' | 'multi-line',
          value: string | string[]
        }
      ]
    }
  ]
}
```

## Frontend Changes

### FormEditor.jsx Refactor

**Old Approach:**
- Hardcoded form sections (Personal Info, Contact, Skills, etc.)
- Field validation tied to specific paths
- Manual handling of each field type

**New Approach:**
```javascript
// Dynamic section management
const handleAddSection = () => {
  // Prompt user for section name
  // Add new section with empty fields array
};

const handleAddField = (sectionId, fieldType) => {
  // Prompt user for field name
  // Add field to specified section
};

// Field rendering based on type
{field.type === 'text' && <input ... />}
{field.type === 'textarea' && <textarea ... />}
{field.type === 'list' && <ListFieldUI ... />}
```

### useSession Hook Updates

- Handles both old and new data formats
- SSE event parsing for updated CV data
- Optimistic state updates for form responsiveness

### CSS Reorganization

**FormEditor.css** now supports:
- Dynamic section rendering (no pre-defined layout classes)
- Field type-specific styling
- List item management UI
- Action buttons (rename, delete)
- Empty state messaging

## Server-Side Changes

### cvSchema.js - Multi-Format Support

```javascript
export function normalizeCvData(input) {
  // Detect format
  if (Array.isArray(input.sections)) {
    return { sections: toSection(input.sections) };
  }
  // Fallback to old format
  return { /* old structure */ };
}

export function getMissingRequiredFields(cvData) {
  // For new format: check if any section has content
  if (cvData.sections) {
    return hasSectionContent(cvData.sections) ? [] : ['Add content'];
  }
  // For old format: check specific fields
  // ...
}
```

**Key Functions:**
- `toSection(array)`: Validates and normalizes section array
- `hasSectionContent(sections)`: Checks if sections have any data
- `normalizeCvData()`: Auto-detects format and normalizes

### latexTemplate.js - Dynamic Rendering

**New Function:**
```javascript
function renderDynamicSections(sections) {
  // Iterate sections
  // For each section:
  //   Create \section{name}
  //   Iterate fields
  //   Render based on field type
  //     - text: \textbf{name}: value
  //     - textarea: \textbf{name}\\\\ value
  //     - list: \begin{itemize} ... \end{itemize}
}
```

**Modified buildCvLatex():**
```javascript
if (Array.isArray(cvData.sections) && cvData.sections.length > 0) {
  // New format rendering
  return String.raw`...${renderDynamicSections(sections)}...`;
}
// Old format fallback
```

## Component Interactions

```
App (state: cvData, missingFields, sessionId)
  ↓
useSession Hook
  ├→ fetch /api/sessions (create)
  ├→ fetch /api/sessions/:id/chat (update with SSE)
  └→ setCvData, setMissingFields

FormEditor
  └→ onUpdate(newCvData) → updateCvData()
     └→ POST /api/sessions/:id/chat
        └→ SSE stream: cv_data, missing_fields events

LivePreview
  └→ useEffect watches cvData
     ├→ POST /api/latex-source
     └→ POST /api/render-pdf
        └→ Display PDF

ChatPane
  └→ sendMessage(text)
     └→ POST /api/sessions/:id/chat
        └→ Parse SSE events
           └→ onDataUpdate() if cv_data event received
```

## Session Management

### Initial Session Creation
```javascript
POST /api/sessions
Body: { cvData: { sections: [] } }
Response: {
  sessionId: string,
  cvData: normalized data,
  missingRequiredFields: array,
  requiredFieldsComplete: boolean
}
```

### Form Updates
```javascript
POST /api/sessions/:sessionId/chat
Body: {
  message: '', // empty for form-only updates
  updates: newCvData // the updated CV data
}
Response: SSE stream with events
  - data: { cv_data: updated data }
  - data: { missing_fields: [] }
```

## Backward Compatibility

### Old Data Format Support
- Schema auto-detects by checking `Array.isArray(cvData.sections)`
- LaTeX template checks same condition
- Fallback to original field-based rendering

### Migration Path
- Old format CVs continue to work
- Can mix old/new formats in server (though not recommended)
- No data migration needed

## Validation Strategy

### For New Dynamic Format
```javascript
const isComplete = sections.some(section =>
  section.fields.some(field => {
    if (field.type === 'list') return field.value.length > 0;
    return field.value.trim().length > 0;
  })
);
```

### For Old Format
- Checks specific required fields (name, email, etc.)
- Validates at least one entry in Work_experience and Education

## LaTeX Escaping

- All user input escaped before LaTeX generation
- Handles special characters: & % $ # _ { } ~ ^ \
- Applied consistently across all field types

## Field Type Implementation

### Text Field
- Single `<input type="text">`
- Value stored as string
- Rendered in LaTeX as inline text

### Text Area Field
- `<textarea>` with rows="4"
- Value stored as string
- Rendered in LaTeX with line breaks preserved

### List Field
- Managed array of strings
- UI: input + button to add, item display with remove button
- Rendered in LaTeX as `\begin{itemize}...\end{itemize}`

### Multi-line Field
- `<textarea>` for visually similar to textarea
- Value stored as documentation (one per line)
- Rendered in LaTeX as multi-line text

## State Management

### Form State Flow
1. User edits field in FormEditor
2. FormEditor calls `onUpdate(newCvData)`
3. App passes to `updateCvData(newCvData)`
4. useSession sends via POST /api/sessions/:id/chat
5. Server processes and responds with SSE events
6. Component receives cv_data event
7. setCvData updates state
8. LivePreview re-renders with debounce
9. Back to step 1

### Real-Time Synchronization
- Optimistic updates (immediate UI feedback)
- Server validation & processing in background
- SSE events update actual values
- Missing fields updated from server response

## Error Handling

- Form updates that fail show error in chat
- Server validation errors sent via SSE
- Missing fields always show in summary
- Preview generation errors displayed
- Graceful fallback for missing content

## Performance Considerations

- Form updates debounced 1000ms for preview generation
- Field value changes don't trigger preview immediately
- List item operations are synchronous
- SSE streaming prevents large JSON responses
- Deep cloning of cvData for immutability

## Testing Points

✅ Build succeeds with new components
✅ normalizeCvData handles both formats
✅ getMissingRequiredFields works with dynamic data
✅ buildCvLatex renders dynamic sections correctly
✅ Form allows CRUD operations on sections/fields
✅ LivePreview updates on data changes
✅ ChatPane receives and processes SSE events

## Future Enhancements

- Reorder sections via drag-and-drop
- Clone/duplicate sections
- Section templates (pre-filled section types)
- Field validation rules
- Import/export CV data as JSON
- CV templates with different LaTeX styles
