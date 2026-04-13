import { DEFAULT_LATEX_TEMPLATE } from '../../shared/defaultLatexTemplate.js';

const TEMPLATE_BEGIN_DOCUMENT = '\\begin{document}';

function escapeLatex(value = '') {
  return String(value)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function getTemplatePreamble() {
  const index = DEFAULT_LATEX_TEMPLATE.indexOf(TEMPLATE_BEGIN_DOCUMENT);
  if (index === -1) {
    return DEFAULT_LATEX_TEMPLATE;
  }
  return DEFAULT_LATEX_TEMPLATE.slice(0, index).trimEnd();
}

function joinNonEmpty(parts, separator = ' ') {
  return parts.filter(Boolean).join(separator);
}

// Returns a line counter object with methods to track and emit line numbers
function createLineTracker() {
  let currentLine = 1;

  return {
    count(text) {
      if (!text) return 0;
      const newlines = (text.match(/\n/g) || []).length;
      currentLine += newlines;
      return newlines;
    },
    current() {
      return currentLine;
    },
    getMarker(label) {
      return `% [LINE ${this.current()}] ${label}`;
    }
  };
}

function renderHeading(contact, lineTracker = null) {
  const fullName = escapeLatex(contact?.fullName || '[Your Name]');
  const phone = escapeLatex(contact?.phone || '[Phone]');
  const email = escapeLatex(contact?.email || '[Email]');
  const location = escapeLatex(contact?.location || '[Location]');

  const middleLinks = Array.isArray(contact?.links)
    ? contact.links
        .filter((link) => link?.label && link?.url)
        .map((link) => `\\href{${escapeLatex(link.url)}}{${escapeLatex(link.label)}}`)
    : [];

  const infoParts = [
    `\\faPhone* \\texttt{${phone}}`,
    `\\faEnvelope \\hspace{2pt} \\texttt{${email}}`,
    ...middleLinks,
    `\\faMapMarker* \\hspace{2pt}\\texttt{${location}}`
  ];

  const contactLine = infoParts.join(' \\hspace{1pt} $|$ \\hspace{1pt} ');

  const lines = [
    '%----------HEADING----------',
    '\\begin{center}',
    `    \\textbf{\\Huge ${fullName}} \\\\ \\vspace{5pt}`,
    `    \\small ${contactLine}`,
    '    \\\\ \\vspace{-3pt}',
    '\\end{center}'
  ];

  if (lineTracker) {
    lineTracker.count(lines.join('\n'));
  }

  return lines.join('\n');
}

function renderTimelineSection(section, lineTracker = null) {
  if (!section?.visible) {
    return '';
  }

  const entries = Array.isArray(section.entries) ? section.entries : [];
  const renderedEntries = entries
    .map((entry) => {
      const heading = escapeLatex(entry.organization || entry.heading || '[Organization]');
      const dateLabel = escapeLatex(entry.dateLabel || joinNonEmpty([entry.startDate, entry.endDate], ' -- ') || '[Start -- End]');
      const role = escapeLatex(entry.subheading || entry.heading || '[Role]');
      const location = escapeLatex(entry.location || '[Location]');
      const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];

      const bulletBlock = bullets.length > 0
        ? [
            '      \\resumeItemListStart',
            ...bullets.map((bullet) => `        \\resumeItem{${escapeLatex(bullet)}}`),
            '      \\resumeItemListEnd'
          ].join('\n')
        : '';

      return [
        '    \\resumeSubheading',
        `      {${heading}}{${dateLabel}}`,
        `      {${role}}{${location}}`,
        bulletBlock
      ].filter(Boolean).join('\n');
    })
    .filter((rendered) => rendered && rendered.trim().length > 0);

  if (renderedEntries.length === 0) {
    return '';
  }

  const lines = [
    `%-----------${escapeLatex(section.title)}-----------`,
    `\\section{${escapeLatex(section.title)}}`,
    lineTracker ? lineTracker.getMarker(`SECTION_START ${section.id}`) : '',
    '  \\resumeSubHeadingListStart',
    lineTracker ? lineTracker.getMarker(`LIST_START ${section.id}`) : '',
    ...renderedEntries,
    lineTracker ? lineTracker.getMarker(`LIST_END ${section.id}`) : '',
    '  \\resumeSubHeadingListEnd'
  ].filter(Boolean);

  const output = lines.join('\n');
  if (lineTracker) {
    lineTracker.count(output);
  }

  return output;
}

function renderProjectsSection(section, lineTracker = null) {
  if (!section?.visible) {
    return '';
  }

  const entries = Array.isArray(section.entries) ? section.entries : [];
  const renderedEntries = entries
    .map((entry) => {
      const title = escapeLatex(entry.heading || entry.organization || '[Project]');
      const dateLabel = escapeLatex(entry.dateLabel || joinNonEmpty([entry.startDate, entry.endDate], ' -- ') || '[Start -- End]');
      const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];

      return [
        '    \\resumeProjectHeading',
        `      {\\textbf{${title}}}{${dateLabel}}`,
        bullets.length > 0
          ? [
              '      \\resumeItemListStart',
              ...bullets.map((bullet) => `        \\resumeItem{${escapeLatex(bullet)}}`),
              '      \\resumeItemListEnd'
            ].join('\n')
          : ''
      ].filter(Boolean).join('\n');
    })
    .filter((rendered) => rendered && rendered.trim().length > 0);

  if (renderedEntries.length === 0) {
    return '';
  }

  const lines = [
    '%-----------PROJECTS-----------',
    `\\section{${escapeLatex(section.title)}}`,
    lineTracker ? lineTracker.getMarker(`SECTION_START ${section.id}`) : '',
    '  \\resumeSubHeadingListStart',
    lineTracker ? lineTracker.getMarker(`LIST_START ${section.id}`) : '',
    ...renderedEntries,
    lineTracker ? lineTracker.getMarker(`LIST_END ${section.id}`) : '',
    '  \\resumeSubHeadingListEnd'
  ].filter(Boolean);

  const output = lines.join('\n');
  if (lineTracker) {
    lineTracker.count(output);
  }

  return output;
}

function renderSkillsSection(section, lineTracker = null) {
  if (!section?.visible) {
    return '';
  }

  const topicLines = (Array.isArray(section.entries) ? section.entries : [])
    .filter((entry) => entry && entry.topicLabel)
    .map((entry) => {
      const items = Array.isArray(entry.items) ? entry.items.map((item) => escapeLatex(item)).join(', ') : '';
      return `    \\textbf{${escapeLatex(entry.topicLabel)}}: {${items || '[Add items]'}}`;
    });

  if (topicLines.length === 0) {
    return '';
  }

  const lines = [
    '%-----------SKILLS-----------',
    `\\section{${escapeLatex(section.title)}}`,
    lineTracker ? lineTracker.getMarker(`SECTION_START ${section.id}`) : '',
    '\\begin{itemize}[leftmargin=0in, label={}]',
    lineTracker ? lineTracker.getMarker(`ITEMIZE_START ${section.id}`) : '',
    '  \\small{\\item{',
    ...topicLines,
    '  }}',
    lineTracker ? lineTracker.getMarker(`ITEMIZE_END ${section.id}`) : '',
    '\\end{itemize}'
  ].filter(Boolean);

  const output = lines.join('\n');
  if (lineTracker) {
    lineTracker.count(output);
  }

  return output;
}

function resolveSectionById(resumeData, sectionId) {
  if (resumeData.sections?.[sectionId]) {
    return resumeData.sections[sectionId];
  }
  return (resumeData.customSections || []).find((section) => section.id === sectionId) || null;
}

function renderSection(section, lineTracker = null) {
  if (!section) {
    return '';
  }

  if (section.id === 'projects') {
    return renderProjectsSection(section, lineTracker);
  }

  if (section.id === 'skills' || section.type === 'topic_groups') {
    return renderSkillsSection(section, lineTracker);
  }

  return renderTimelineSection(section, lineTracker);
}

export function translateResumeDataToLatex(resumeData) {
  const lineTracker = createLineTracker();
  const preamble = getTemplatePreamble();
  lineTracker.count(preamble);

  const heading = renderHeading(resumeData.contact || {}, lineTracker);
  lineTracker.count('\n\n');

  const sectionOrder = Array.isArray(resumeData.presentation?.sectionOrder)
    ? resumeData.presentation.sectionOrder
    : Object.keys(resumeData.sections || {});

  const renderedSections = sectionOrder
    .map((sectionId) => resolveSectionById(resumeData, sectionId))
    .filter(Boolean)
    .map((section) => renderSection(section, lineTracker))
    .filter(Boolean)
    .join('\n\n');

  lineTracker.count(renderedSections);

  return [
    preamble,
    '',
    '\\begin{document}',
    '',
    heading,
    '',
    renderedSections,
    '',
    '%-------------------------------------------',
    '\\end{document}'
  ].join('\n');
}
