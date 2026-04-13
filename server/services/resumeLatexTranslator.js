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

function renderHeading(contact) {
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

  return [
    '%----------HEADING----------',
    '\\begin{center}',
    `    \\textbf{\\Huge ${fullName}} \\\\ \\vspace{5pt}`,
    `    \\small ${contactLine}`,
    '    \\\\ \\vspace{-3pt}',
    '\\end{center}'
  ].join('\n');
}

function renderTimelineSection(section) {
  if (!section?.visible) {
    return '';
  }

  const entries = Array.isArray(section.entries) ? section.entries : [];
  const renderedEntries = entries.map((entry) => {
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
  });

  return [
    `%-----------${escapeLatex(section.title)}-----------`,
    `\\section{${escapeLatex(section.title)}}`,
    '  \\resumeSubHeadingListStart',
    ...renderedEntries,
    '  \\resumeSubHeadingListEnd'
  ].join('\n');
}

function renderProjectsSection(section) {
  if (!section?.visible) {
    return '';
  }

  const entries = Array.isArray(section.entries) ? section.entries : [];
  const renderedEntries = entries.map((entry) => {
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
  });

  return [
    '%-----------PROJECTS-----------',
    `\\section{${escapeLatex(section.title)}}`,
    '  \\resumeSubHeadingListStart',
    ...renderedEntries,
    '  \\resumeSubHeadingListEnd'
  ].join('\n');
}

function renderSkillsSection(section) {
  if (!section?.visible) {
    return '';
  }

  const topicLines = (Array.isArray(section.entries) ? section.entries : [])
    .filter((entry) => entry && entry.topicLabel)
    .map((entry) => {
      const items = Array.isArray(entry.items) ? entry.items.map((item) => escapeLatex(item)).join(', ') : '';
      return `    \\textbf{${escapeLatex(entry.topicLabel)}}: {${items || '[Add items]'}}`;
    });

  return [
    '%-----------SKILLS-----------',
    `\\section{${escapeLatex(section.title)}}`,
    '\\begin{itemize}[leftmargin=0in, label={}]',
    '  \\small{\\item{',
    ...topicLines,
    '  }}',
    '\\end{itemize}'
  ].join('\n');
}

function resolveSectionById(resumeData, sectionId) {
  if (resumeData.sections?.[sectionId]) {
    return resumeData.sections[sectionId];
  }
  return (resumeData.customSections || []).find((section) => section.id === sectionId) || null;
}

function renderSection(section) {
  if (!section) {
    return '';
  }

  if (section.id === 'projects') {
    return renderProjectsSection(section);
  }

  if (section.id === 'skills' || section.type === 'topic_groups') {
    return renderSkillsSection(section);
  }

  return renderTimelineSection(section);
}

export function translateResumeDataToLatex(resumeData) {
  const preamble = getTemplatePreamble();
  const heading = renderHeading(resumeData.contact || {});
  const sectionOrder = Array.isArray(resumeData.presentation?.sectionOrder)
    ? resumeData.presentation.sectionOrder
    : Object.keys(resumeData.sections || {});

  const renderedSections = sectionOrder
    .map((sectionId) => resolveSectionById(resumeData, sectionId))
    .filter(Boolean)
    .map((section) => renderSection(section))
    .filter(Boolean)
    .join('\n\n');

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
