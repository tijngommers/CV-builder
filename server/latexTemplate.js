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
  '\\': '\\textbackslash{}'
};

function escapeLatex(value = '') {
  return String(value).replace(/[&%$#_{}~^\\]/g, (char) => latexEscapeMap[char] || char);
}

function resumeItemList(items = []) {
  if (!items.length) {
    return ['\\resumeItemListStart', '\\resumeItem{N/A}', '\\resumeItemListEnd'].join('\n');
  }

  return [
    '\\resumeItemListStart',
    ...items.map((item) => `\\resumeItem{${escapeLatex(item)}}`),
    '\\resumeItemListEnd'
  ].join('\n');
}

function renderExperience(entries = []) {
  if (!entries.length) {
    return [
      '\\resumeSubHeadingListStart',
      '\\resumeSubheading',
      '  {N/A}{N/A}',
      '  {N/A}{N/A}',
      '\\resumeItemListStart',
      '\\resumeItem{N/A}',
      '\\resumeItemListEnd',
      '\\resumeSubHeadingListEnd'
    ].join('\n');
  }

  const blocks = entries.map(([role, details]) => {
    const company = escapeLatex(details?.company || 'N/A');
    const period = escapeLatex(details?.period || 'N/A');
    const title = escapeLatex(role || 'N/A');
    const description = details?.description ? [details.description] : ['N/A'];

    return [
      '\\resumeSubheading',
      `  {${company}}{${period}}`,
      `  {${title}}{}`,
      resumeItemList(description)
    ].join('\n');
  });

  return ['\\resumeSubHeadingListStart', ...blocks, '\\resumeSubHeadingListEnd'].join('\n\n');
}

function renderProjects(hackathons = [], prizes = []) {
  const allProjects = [
    ...hackathons.map(([name, details]) => ({
      name,
      date: details?.date || 'N/A',
      description: details?.description || 'N/A'
    })),
    ...prizes.map(([name, details]) => ({
      name,
      date: details?.date || 'N/A',
      description: details?.description || 'N/A'
    }))
  ];

  if (!allProjects.length) {
    return [
      '\\resumeSubHeadingListStart',
      '\\resumeProjectHeading',
      '  {\\textbf{N/A}}{N/A}',
      '\\resumeItemListStart',
      '\\resumeItem{N/A}',
      '\\resumeItemListEnd',
      '\\resumeSubHeadingListEnd'
    ].join('\n');
  }

  const blocks = allProjects.map((project) => [
    '\\resumeProjectHeading',
    `  {\\textbf{${escapeLatex(project.name)}}}{${escapeLatex(project.date)}}`,
    '\\resumeItemListStart',
    `  \\resumeItem{${escapeLatex(project.description)}}`,
    '\\resumeItemListEnd'
  ].join('\n'));

  return ['\\resumeSubHeadingListStart', ...blocks, '\\resumeSubHeadingListEnd'].join('\n\n');
}

function renderEducation(entries = []) {
  if (!entries.length) {
    return [
      '\\resumeSubHeadingListStart',
      '\\resumeSubheading',
      '  {N/A}{N/A}',
      '  {N/A}{N/A}',
      '\\resumeSubHeadingListEnd'
    ].join('\n');
  }

  const blocks = entries.map(([period, details]) => {
    const institution = escapeLatex(details?.institution || 'N/A');
    const degree = escapeLatex(details?.degree || 'N/A');
    const when = escapeLatex(period || details?.period || 'N/A');

    return [
      '\\resumeSubheading',
      `  {${institution}}{${when}}`,
      `  {${degree}}{}`
    ].join('\n');
  });

  return ['\\resumeSubHeadingListStart', ...blocks, '\\resumeSubHeadingListEnd'].join('\n\n');
}

function renderSkills(skills = {}, languages = {}) {
  const programming = (skills.programmingLanguages || []).map(escapeLatex).join(', ') || 'N/A';
  const frameworks = (skills.frameworks || []).map(escapeLatex).join(', ') || 'N/A';
  const languageRows = Object.entries(languages || {})
    .map(([name, level]) => `${escapeLatex(name)} (${escapeLatex(level)})`)
    .join(', ') || 'N/A';

  return [
    '\\begin{itemize}[leftmargin=0in, label={}]',
    '\\small{\\item{',
    `\\textbf{Programming Languages} {: ${programming}}\\`,
    `\\textbf{Frameworks} {: ${frameworks}}\\`,
    `\\textbf{Languages} {: ${languageRows}}`,
    '}}',
    '\\end{itemize}'
  ].join('\n');
}

function renderHobbies(hobbies = []) {
  const hobbyText = Array.isArray(hobbies) && hobbies.length
    ? hobbies.map(escapeLatex).join(', ')
    : 'N/A';

  return [
    '\\begin{itemize}[leftmargin=0in, label={}]',
    '\\small{\\item{',
    `\\textbf{Hobbies} {: ${hobbyText}}`,
    '}}',
    '\\end{itemize}'
  ].join('\n');
}

function renderDynamicSections(sections = []) {
  if (!sections.length) {
    return '% No sections added yet';
  }

  return sections
    .map((section) => {
      const sectionTitle = escapeLatex(section.name || 'Section');
      const fields = section.fields || [];

      if (!fields.length) {
        return `\\section{${sectionTitle}}\n\\emph{No content}`;
      }

      const fieldContent = fields
        .map((field) => {
          const fieldName = escapeLatex(field.name || 'Field');
          const value = field.value;

          if (field.type === 'list') {
            const items = Array.isArray(value)
              ? value.map((item) => `\\resumeItem{${escapeLatex(item)}}`).join('\n')
              : '\\resumeItem{N/A}';
            return `\\textbf{${fieldName}}\\\\
\\begin{itemize}
${items}
\\end{itemize}`;
          }

          if (field.type === 'textarea' || field.type === 'multi-line') {
            return `\\textbf{${fieldName}}\\\\\n${escapeLatex(value)}`;
          }

          return `\\textbf{${fieldName}:} ${escapeLatex(value)}`;
        })
        .join('\n\n');

      return `\\section{${sectionTitle}}\n\\begin{itemize}[leftmargin=0in, label={}]\n\\small{\\item{\n${fieldContent}\n}}\n\\end{itemize}`;
    })
    .join('\n\n');
}

export function buildCvLatex(cvData = {}) {
  // Handle new dynamic sections format
  if (Array.isArray(cvData.sections) && cvData.sections.length > 0) {
    const sections = cvData.sections || [];
    const dynamicContent = renderDynamicSections(sections);

    return String.raw`%-------------------------
% Resume in Latex
% Author : Harshibar
% Based off of: https://github.com/jakeryang/resume
% License : MIT
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome5}
\usepackage[scale=0.90,lf]{FiraMono}

\definecolor{light-grey}{gray}{0.83}
\definecolor{dark-grey}{gray}{0.3}
\definecolor{text-grey}{gray}{.08}

\DeclareRobustCommand{\ebseries}{\fontseries{eb}\selectfont}
\DeclareTextFontCommand{\texteb}{\ebseries}

\usepackage{contour}
\usepackage[normalem]{ulem}
\renewcommand{\ULdepth}{1.8pt}
\contourlength{0.8pt}
\newcommand{\myuline}[1]{%
  \uline{\phantom{#1}}%
  \llap{\contour{white}{#1}}%
}

\usepackage{tgheros}
\renewcommand*\familydefault{\sfdefault}
\usepackage[T1]{fontenc}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{0in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat {\section}{
    \bfseries \vspace{2pt} \raggedright \large
}{}{0em}{}[\color{light-grey} {\titlerule[2pt]} \vspace{-4pt}]

\newcommand{\resumeItem}[1]{
  \item\small{{#1 \vspace{-1pt}}}
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-1pt}\item
    \begin{tabular*}{\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & {\color{dark-grey}\small #2}\vspace{1pt}\\
      \textit{#3} & {\color{dark-grey} \small #4}\\
    \end{tabular*}\vspace{-4pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      #1 & {\color{dark-grey} #2} \\
    \end{tabular*}\vspace{-4pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{0pt}}

\color{text-grey}

\begin{document}

${dynamicContent}

\end{document}`;
  }

  // Handle old fixed format for backward compatibility
  const personalInfo = cvData.personalInfo || {};
  const contact = cvData.contact || {};
  const skills = cvData.skills || {};

  const workExperience = Object.entries(cvData.Work_experience || {});
  const education = Object.entries(cvData.Education || {});
  const hackathons = Object.entries(cvData.Hackathons || {});
  const prizes = Object.entries(cvData.Prizes || {});

  const name = escapeLatex(personalInfo.name || 'Name');
  const phone = escapeLatex(contact.phonenumber || 'Phone');
  const email = escapeLatex(contact.email || 'Email');
  const address = escapeLatex(contact.adress || 'Address');
  const birthdate = escapeLatex(personalInfo.Birthdate || 'Birthdate');
  const linkedin = contact.linkedin ? escapeLatex(contact.linkedin) : '';
  const github = contact.github ? escapeLatex(contact.github) : '';
  const profile = escapeLatex(cvData.Profile || 'N/A');

  return String.raw`%-------------------------

\DeclareRobustCommand{\ebseries}{\fontseries{eb}\selectfont}
\DeclareTextFontCommand{\texteb}{\ebseries}

\usepackage{contour}
\usepackage[normalem]{ulem}
\renewcommand{\ULdepth}{1.8pt}
\contourlength{0.8pt}
\newcommand{\myuline}[1]{%
  \uline{\phantom{#1}}%
  \llap{\contour{white}{#1}}%
}

\usepackage{tgheros}
\renewcommand*\familydefault{\sfdefault}
\usepackage[T1]{fontenc}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{0in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat {\section}{
    \bfseries \vspace{2pt} \raggedright \large
}{}{0em}{}[\color{light-grey} {\titlerule[2pt]} \vspace{-4pt}]

\newcommand{\resumeItem}[1]{
  \item\small{{#1 \vspace{-1pt}}}
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-1pt}\item
    \begin{tabular*}{\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & {\color{dark-grey}\small #2}\vspace{1pt}\\
      \textit{#3} & {\color{dark-grey} \small #4}\\
    \end{tabular*}\vspace{-4pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      #1 & {\color{dark-grey} #2} \\
    \end{tabular*}\vspace{-4pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{0pt}}

\color{text-grey}

\begin{document}

\begin{center}
    \textbf{\Huge ${name}} \\ \vspace{5pt}
    \small \faPhone* \texttt{${phone}} \hspace{1pt} $|$
    \hspace{1pt} \faEnvelope \hspace{2pt} \texttt{${email}} \hspace{1pt} $|$
    \hspace{1pt} \faMapMarker* \hspace{2pt}\texttt{${address}} \hspace{1pt} $|$
    \hspace{1pt} \faBirthdayCake \hspace{2pt}\texttt{${birthdate}}${linkedin ? ` \hspace{1pt} $|$
    \hspace{1pt} \faLinkedin \hspace{2pt} \href{${linkedin}}{LinkedIn}` : ''}${github ? ` \hspace{1pt} $|$
    \hspace{1pt} \faGithub \hspace{2pt} \href{${github}}{GitHub}` : ''}
    \\ \vspace{-3pt}
\end{center}

\section{PROFILE}
\begin{itemize}[leftmargin=0in, label={}]
  \small{\item{${profile}}}
\end{itemize}

\section{EXPERIENCE}
${renderExperience(workExperience)}

\section{PROJECTS}
${renderProjects(hackathons, prizes)}

\section{EDUCATION}
${renderEducation(education)}

\section{SKILLS}
${renderSkills(skills, cvData.languages || {})}

\section{HOBBIES}
${renderHobbies(cvData.Hobbies || [])}

\end{document}`;
}
