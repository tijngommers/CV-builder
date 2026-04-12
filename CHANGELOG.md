# Changelog

All notable changes to the CV Builder project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-12

### Added

- **Core Features**
  - Interactive CV form editor with real-time validation
  - Live PDF preview with LaTeX rendering
  - AI-powered chat assistant for CV guidance
  - Session-based editing with state persistence
  - Support for multiple CV sections (Work Experience, Education, Projects, etc.)

- **Contact Information**
  - Traditional contact fields (name, email, phone, address)
  - LinkedIn profile URL integration
  - GitHub profile URL integration
  - Automatic icon rendering in PDF for social profiles

- **API Endpoints**
  - Session management (create, retrieve)
  - Chat with streaming SSE responses
  - PDF rendering (download and inline preview)
  - LaTeX source preview for debugging
  - Queue statistics monitoring

- **Rendering Features**
  - Preview rendering with queue management
  - SHA-256 cache keying for performance
  - Compile diagnostics and error reporting
  - Configurable concurrent compilation limits

- **Developer Experience**
  - Comprehensive README with API documentation
  - Architecture documentation (ARCHITECTURE.md)
  - Contribution guidelines (CONTRIBUTING.md)
  - Environment configuration template (.env.example)
  - EditorConfig for consistent formatting

- **Project Structure**
  - Professional repository organization
  - MIT License
  - Comprehensive .gitignore
  - Well-documented code comments

### Technical Details

- **Frontend**: React 18 with Vite 5 build tool
- **Backend**: Express.js 4 with Node.js
- **PDF Engine**: pdflatex with LaTeX
- **AI**: Optional Claude integration via Anthropic API
- **State Management**: In-memory session store

### Known Limitations

- Sessions persist only in-memory (lost on server restart)
- Single server instance (no load balancing)
- LaTeX distribution required on server
- No database persistence for chat history

### Future Roadmap

- [ ] Add database backend for session persistence
- [ ] Multiple resume templates/styles
- [ ] Export to additional formats (Markdown, JSON)
- [ ] Import from LinkedIn profiles
- [ ] Collaborative editing
- [ ] Version history and rollback
- [ ] Multi-language support
- [ ] Dark mode UI
- [ ] Mobile app

---

## Versioning

- **Major**: Breaking changes to API or structure
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes and minor improvements

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.
