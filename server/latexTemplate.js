const latexEscapeMap = {
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '\\': '\\textbackslash{}',
};

function escapeLatex(value = '') {
  return String(value).replace(/[&%$#_{}~^\\]/g, (char) => latexEscapeMap[char] || char);
}

function listItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '\\item N/A';
  }

  return items.map((item) => `\\item ${escapeLatex(item)}`).join('\n');
}

function dictionaryRows(dict = {}) {
  const entries = Object.entries(dict || {});

  if (!entries.length) {
    return '\\textit{N/A}';
  }

  return entries
    .map(([label, value]) => `\\textbf{${escapeLatex(label)}}: ${escapeLatex(value)}\\\\`)
    .join('\n');
}

function timelineEntries(entries = [], options = {}) {
  const {
    periodKey = 'period',
    titleBuilder = () => '',
    subtitleBuilder = () => '',
    descriptionBuilder = () => '',
  } = options;

  if (!entries.length) {
    return '\\textit{N/A}';
  }

  return entries
    .map(([title, value]) => {
      const period = escapeLatex(value?.[periodKey] ?? title);
      const heading = escapeLatex(titleBuilder(title, value));
      const subtitle = escapeLatex(subtitleBuilder(title, value));
      const description = escapeLatex(descriptionBuilder(title, value));

      return [
        '\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}',
        `\\textbf{${heading}} & \\textit{${period}} \\\\`,
        '\\end{tabular*}',
        subtitle ? `${subtitle}\\\\` : '',
        description,
        '\\vspace{4pt}',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}

function section(title, body) {
  return [
    `\\section*{${escapeLatex(title)}}`,
    body || '\\textit{N/A}',
    '\\vspace{8pt}',
  ].join('\n');
}

export function buildCvLatex(cvData = {}) {
  const personalInfo = cvData.personalInfo || {};
  const contact = cvData.contact || {};
  const skills = cvData.skills || {};

  const workExperience = Object.entries(cvData.Work_experience || {});
  const education = Object.entries(cvData.Education || {});
  const hackathons = Object.entries(cvData.Hackathons || {});
  const prizes = Object.entries(cvData.Prizes || {});
  const degrees = Object.entries(cvData.Degrees || {});

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=1.8cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage{enumitem}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\setlist[itemize]{leftmargin=*,topsep=2pt,itemsep=2pt}
\setlength{\parindent}{0pt}
\setlength{\parskip}{4pt}
\definecolor{sectiongray}{HTML}{EDEDED}
\titleformat{\section}
  {\normalfont\large\bfseries}
  {}
  {0pt}
  {\colorbox{sectiongray}{\parbox{\dimexpr\textwidth-2\fboxsep\relax}{\thesection\hspace{0pt}#1}}}
\titlespacing*{\section}{0pt}{8pt}{6pt}
\pagestyle{empty}

\begin{document}

{\LARGE\textbf{${escapeLatex(personalInfo.name || 'Name')}}}\\[6pt]
\normalsize
${escapeLatex(contact.phonenumber || 'Phone')} \quad|\quad ${escapeLatex(contact.email || 'Email')} \quad|\quad ${escapeLatex(contact.adress || 'Address')} \quad|\quad ${escapeLatex(personalInfo.Birthdate || 'Birthdate')}

\vspace{10pt}\hrule\vspace{8pt}

${section('Profile', escapeLatex(cvData.Profile || ''))}

${section(
  'Work Experience',
  timelineEntries(workExperience, {
    periodKey: 'period',
    titleBuilder: (position) => position,
    subtitleBuilder: (_, entry) => entry?.company || '',
    descriptionBuilder: (_, entry) => entry?.description || '',
  }),
)}

${section(
  'Education',
  timelineEntries(education, {
    periodKey: 'period',
    titleBuilder: (_, entry) => entry?.institution || '',
    subtitleBuilder: (_, entry) => entry?.degree || '',
    descriptionBuilder: () => '',
  }),
)}

${section(
  'Skills',
  [
    `\\textbf{Programming Languages}: ${escapeLatex((skills.programmingLanguages || []).join(', '))}\\\\`,
    `\\textbf{Frameworks}: ${escapeLatex((skills.frameworks || []).join(', '))}`,
  ].join('\n'),
)}

${section('Languages', dictionaryRows(cvData.languages || {}))}

${section(
  'Hackathons',
  timelineEntries(hackathons, {
    periodKey: 'date',
    titleBuilder: (name) => name,
    subtitleBuilder: () => '',
    descriptionBuilder: (_, entry) => entry?.description || '',
  }),
)}

${section(
  'Prizes',
  timelineEntries(prizes, {
    periodKey: 'date',
    titleBuilder: (name) => name,
    subtitleBuilder: () => '',
    descriptionBuilder: (_, entry) => entry?.description || '',
  }),
)}

${section(
  'Degrees & Certifications',
  timelineEntries(degrees, {
    periodKey: 'date',
    titleBuilder: (name) => name,
    subtitleBuilder: (_, entry) => entry?.organization || '',
    descriptionBuilder: (_, entry) => entry?.degree || '',
  }),
)}

${section(
  'Hobbies',
  ['\\begin{itemize}', listItems(cvData.Hobbies || []), '\\end{itemize}'].join('\n'),
)}

\end{document}`;
}
