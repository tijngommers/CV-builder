export const DEFAULT_LATEX_TEMPLATE = String.raw`%-------------------------
% Resume in Latex
% Structure-only starter template
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
% only for pdflatex
% \input{glyphtounicode}

% fontawesome
\usepackage{fontawesome5}

% fixed width
\usepackage[scale=0.90,lf]{FiraMono}

% light-grey
\definecolor{light-grey}{gray}{0.83}
\definecolor{dark-grey}{gray}{0.3}
\definecolor{text-grey}{gray}{.08}

\DeclareRobustCommand{\ebseries}{\fontseries{eb}\selectfont}
\DeclareTextFontCommand{\texteb}{\ebseries}

% custom underline
\usepackage{contour}
\usepackage[normalem]{ulem}
\renewcommand{\ULdepth}{1.8pt}
\contourlength{0.8pt}
\newcommand{\myuline}[1]{%
  \uline{\phantom{#1}}%
  \llap{\contour{white}{#1}}%
}

% custom font: helvetica-style
\usepackage{tgheros}
\renewcommand*\familydefault{\sfdefault}
% Only if the base font of the document is to be sans serif
\usepackage[T1]{fontenc}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{0in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% sans serif sections
\titleformat {\section}{
    \bfseries \vspace{2pt} \raggedright \large
}{}{0em}{}[\color{light-grey} {\titlerule[2pt]} \vspace{-4pt}]

% only for pdflatex
% Ensure that generate pdf is machine readable/ATS parsable
% \pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-1pt}}
  }
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

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

%----------HEADING----------
\begin{center}
    \textbf{\Huge [Your Name]} \\ \vspace{5pt}
    \small \faPhone* \texttt{[Phone]} \hspace{1pt} $|$
    \hspace{1pt} \faEnvelope \hspace{2pt} \texttt{[Email]} \hspace{1pt} $|$
    \hspace{1pt} \faMapMarker* \hspace{2pt}\texttt{[Location]}
    \\ \vspace{-3pt}
\end{center}

%-----------EXPERIENCE-----------
\section{EXPERIENCE}
  \resumeSubHeadingListStart
    \resumeSubheading
      {[Organization]}{[Start -- End]}
      {[Role]}{[City, Country]}
      \resumeItemListStart
        \resumeItem{[Impact or achievement]}
        \resumeItem{[Impact or achievement]}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

%-----------PROJECTS-----------
\section{PROJECTS}
  \resumeSubHeadingListStart
    \resumeProjectHeading
      {\textbf{[Project Name]}}{[Start -- End]}
      \resumeItemListStart
        \resumeItem{[Project impact or contribution]}
        \resumeItem{[Project impact or contribution]}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

%-----------EDUCATION-----------
\section{EDUCATION}
  \resumeSubHeadingListStart
    \resumeSubheading
      {[Institution]}{[Start -- End]}
      {[Degree / Program]}{[City, Country]}
      \resumeItemListStart
        \resumeItem{[Relevant coursework or distinction]}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

%-----------SKILLS-----------
\section{SKILLS}
\begin{itemize}[leftmargin=0in, label={}]
  \small{\item{
    \textbf{Languages}: {[Language 1, Language 2, Language 3]}\\
    \textbf{Tools}: {[Tool 1, Tool 2, Tool 3]}
  }}
\end{itemize}

%-------------------------------------------
\end{document}`;