# Dynamic CV Builder Guide

## What's New

Your CV Builder now supports **fully dynamic sections with no hardcoded structure**! You can create any sections you want with any fields you need.

## Getting Started

When you open the app, you'll see:
- **Left pane**: Empty form editor with "+ Add Section" button
- **Center pane**: Live preview (empty until you add content)
- **Right pane**: AI Assistant ready to help

## How to Use

### 1. Add Your First Section

Click **"+ Add Section"** in the left pane.

You'll be prompted: `Enter section name (e.g., "Experience", "Skills", "Education"):`

Examples:
- `Personal Information`
- `Work Experience`
- `Education`
- `Technical Skills`
- `Languages`
- `Projects`
- `Certifications`
- Custom: Any name you want!

### 2. Add Fields to a Section

Once you have a section, click one of the field type buttons:

| Button | Type | Best For |
|--------|------|----------|
| **+ Text Field** | Single-line input | Names, titles, locations, dates |
| **+ Text Area** | Multi-line text | Descriptions, summaries, bios |
| **+ List** | Managed list | Languages, technologies, skills |
| **+ Multi-line** | One item per line | Lists without item manipulation UI |

When you click a button, you'll be prompted: `Enter field name:`

Examples:
- `Company Name`
- `Job Title`
- `Duration`
- `Description`
- `Programming Languages`
- `Technologies Used`

### 3. Enter Data

- **Text fields**: Type values directly
- **Text areas**: Type longer content
- **Lists**: Click "+ Add [field name]" to add items, then ✕ to remove them
- **Multi-line**: Enter content (one item per line)

### 4. Edit Sections

At the top of each section:
- **✏️ (Edit button)**: Rename the section
- **🗑️ (Delete button)**: Remove the entire section

Each field has an **✕** to remove it.

## Example: Building a Real CV

### Step 1: Personal Information Section
```
+ Add Section → "Personal Information"
  + Text Field → "Name" → "John Doe"
  + Text Field → "Email" → "john@example.com"
  + Text Field → "Phone" → "+1-234-567-8900"
  + Text Area → "Summary" → "Experienced software engineer..."
```

### Step 2: Experience Section
```
+ Add Section → "Experience"
  + Text Field → "Company" → "Tech Corp"
  + Text Field → "Job Title" → "Senior Engineer"
  + Text Field → "Period" → "2020-2024"
  + Text Area → "Description" → "Led development of..."
  → Rename to "Experience Entry 1" (optional)
```

### Step 3: Skills Section
```
+ Add Section → "Skills"
  + List → "Programming Languages"
    → Add "Python" → Add "JavaScript" → Add "Go"
  + List → "Frameworks"
    → Add "React" → Add "Django"
```

### Step 4: Education Section
```
+ Add Section → "Education"
  + Text Field → "University" → "MIT"
  + Text Field → "Degree" → "BS Computer Science"
  + Text Field → "Graduation" → "2020"
```

## Live Preview

As you add sections and fill in fields:
1. The **center pane** generates a PDF preview
2. Click the **⬇ Download PDF** button to save
3. Expand **"View LaTeX Source"** to see the raw LaTeX code

## AI Assistant Chat

The **right pane** has:
- **Message history** of your conversation
- **Type a message** to ask the AI for help
- The AI will:
  - Suggest sections to add
  - Help improve your descriptions
  - Recommend missing fields
  - Update your CV based on requests

Example prompts:
- "Add a projects section"
- "Help me write a better summary"
- "What should I include for a software engineer role?"
- "Add my GitHub and LinkedIn profiles"

## Data is Synchronized

- Changes in the form appear in the preview instantly (debounced for performance)
- The AI can update your CV when you ask
- All data is saved in your session

## Field Types Explained

### Text Field
- Single line of input
- Good for: names, dates, locations, titles, roles
- Example: "2020-2024" for duration

### Text Area
- Multiple lines with word wrapping
- Good for: descriptions, summaries, longer text
- Example: Multi-paragraph descriptions of roles

### List Field
- Organized list of items
- Click "+ Add [name]" to add items
- Click "✕" to remove items
- Good for: languages, skills, technologies
- Example: [Python, JavaScript, Go]

### Multi-line Field
- Text area where each line is treated as an item
- Useful for simple lists
- One item per line automatically

## Tips & Tricks

1. **Rename Sections**: Use the ✏️ button to rename sections for clarity
2. **Reorder Content**: Delete and re-add sections in desired order
3. **Complex Descriptions**: Use Text Areas for detailed content, not Text Fields
4. **Lists for Skills**: Use List fields for technologies/skills/languages
5. **Ask AI for Help**: The assistant can make suggestions (e.g., "What sections should a CV have?")

## Validation

Your CV is considered "complete" when:
- At least one section exists
- At least one section has at least one field with content

When complete, all visible content will appear in your PDF.

## No More Fixed Structure!

Unlike before when you had hardcoded sections (personalInfo, contact, etc.), now:
✅ Add any sections you want
✅ Use any field names you want
✅ Choose your field types
✅ Completely flexible layout
✅ Multiple entries of the same section type

## Notes

- The LaTeX template automatically renders all sections
- Field order in sections is preserved in the PDF
- Empty sections don't appear in the PDF
- Your session persists as you work
