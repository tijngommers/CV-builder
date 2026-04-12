# CV Builder - 3-Pane Refactor

## Architecture Overview

The frontend has been refactored into a modern 3-pane layout:

### Left Pane - Form Editor

- Interactive form for editing CV data
- Real-time validation with missing required fields highlighting
- Displays all missing required fields at the bottom
- Auto-syncs changes to the server session

### Center Pane - Live Preview

- Real-time PDF preview that updates as you type
- Debounced (1000ms) to avoid excessive recompilation
- Shows LaTeX source code (collapsible)
- Download button for the generated PDF
- Loading state with spinner

### Right Pane - AI Assistant Chat

- Server-Sent Events (SSE) powered chat interface
- Messages stream in real-time from the AI
- Auto-updates CV data when assistant makes changes
- Shows missing required fields and provides helpful suggestions
- Typing indicator during response generation

## Key Components

### Components Created

1. **FormEditor.jsx** (`src/components/FormEditor.jsx`)
   - Main form with sections for Personal Info, Contact, Profile, Skills
   - Field validation with visual indicators for missing required fields
   - Handles nested data structure updates

2. **LivePreview.jsx** (`src/components/LivePreview.jsx`)
   - Renders PDF preview from `/api/render-pdf` endpoint
   - Fetches LaTeX source from `/api/latex-source` endpoint
   - Debounced updates on CV data changes

3. **ChatPane.jsx** (`src/components/ChatPane.jsx`)
   - Consumes SSE events from `/api/sessions/:sessionId/chat`
   - Displays messages with timestamps
   - Handles data updates from AI responses
   - Typing indicator during message generation

### Hooks Created

1. **useSession.js** (`src/hooks/useSession.js`)
   - Manages session lifecycle (create, fetch, update)
   - Tracks CV data and missing required fields
   - Provides updateCvData function for form changes

2. **useChat.js** (`src/hooks/useChat.js`)
   - Handles message sending
   - Processes SSE event stream
   - Manages message history and loading states

## Server Integration

### Endpoints Used

- `POST /api/sessions` - Create a new session
- `GET /api/sessions/:sessionId` - Get session details
- `POST /api/sessions/:sessionId/chat` - Send message with SSE response
- `POST /api/latex-source` - Get LaTeX source code
- `POST /api/render-pdf` - Generate PDF

### SSE Event Types

The chat endpoint streams these events:

- `assistant_message` - AI response text
- `cv_data` - Updated CV data object
- `missing_fields` - Array of missing required fields
- `done` - End of stream marker

## Missing Required Fields

The system validates CV data against defined required fields:

- `personalInfo.name` - Your full name
- `personalInfo.Birthdate` - Birth date
- `contact.phonenumber` - Phone number
- `contact.email` - Email address
- `contact.adress` - Address
- `Profile` - Professional summary
- `Work_experience` - At least one work entry
- `Education` - At least one education entry

Missing fields are:

- Highlighted in the form editor
- Listed in the "Missing Required Fields" section
- Tracked in session state
- Used by the AI to provide relevant suggestions

## Styling

### CSS Files

- **App.css** - 3-pane grid layout with responsive design
- **FormEditor.css** - Form styling, validation states
- **ChatPane.css** - Chat UI, message styling, animations
- **LivePreview.css** - Preview container, PDF viewer, LaTeX display
- **index.css** - Base styles and global utilities

### Layout Breakpoints

- **Desktop (>1400px)**: Full 3-pane grid (1fr 2fr 1fr)
- **Tablet (1024px-1400px)**: Left + Center (1fr 1.5fr)
- **Mobile (<768px)**: Stacked single column

## Data Flow

```
User Input (Form) → handleFormUpdate
                 → updateCvData (async)
                 → POST /api/sessions/:sessionId/chat
                 → Server updates session
                 → Server sends updates via SSE
                 → ChatPane receives cv_data event
                 → onDataUpdate updates display
                 → LivePreview re-renders with new data
```

## Real-Time Features

1. **Form Updates**: Changes propagate to preview (debounced 1s)
2. **Chat Integration**: Messages stream in real-time via SSE
3. **Data Synchronization**: All panes update from single source of truth
4. **Status Indicators**: Loading states, typing indicators, generation progress

## Getting Started

1. Start the development server:

   ```bash
   npm run dev
   ```

2. The app initializes with:
   - Session creation on first load
   - Loading state while fetching initial data
   - Empty chat ready for interaction

3. Fill out the form to see:
   - Live PDF preview in center
   - Missing fields highlighted in red
   - AI suggestions in chat pane

## Performance Optimizations

- **Debounced Updates**: Preview generation debounced to 1s to avoid excessive compilations
- **SSE Streaming**: Chat responses stream without waiting for complete message
- **Deep Cloning**: Ensures immutable state updates
- **URL Cleanup**: Object URLs properly revoked to prevent memory leaks

## Future Enhancements

- Preview renderer with caching (`/api/render-preview`)
- Multi-session support
- Export to other formats
- Template selection
- Undo/redo functionality
