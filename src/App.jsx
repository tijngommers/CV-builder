import { useSession } from './hooks/useSession';
import { LivePreview } from './components/LivePreview';
import { ChatPane } from './components/ChatPane';
import './App.css';

const INITIAL_SAMPLE_LATEX = `\\documentclass[letterpaper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}

\\definecolor{light-grey}{gray}{0.83}
\\definecolor{dark-grey}{gray}{0.3}
\\definecolor{text-grey}{gray}{.08}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{0in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat {\\section}{\\bfseries \\vspace{2pt} \\raggedright \\large}{}{0em}{}[\\color{light-grey} {\\titlerule[2pt]} \\vspace{-4pt}]

\\color{text-grey}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge Your Name} \\\\ \\vspace{5pt}
    \\small \\faPhone* \\texttt{(123) 456-7890} \\hspace{1pt} $|$
    \\hspace{1pt} \\faEnvelope \\hspace{2pt} \\texttt{email@example.com}
    \\\\ \\vspace{-3pt}
\\end{center}

\\section{ABOUT}
Welcome to CV Builder! Start chatting to build your resume. Tell me about your name, contact info, work experience, education, and skills.

\\section{HOW TO USE}
\\begin{itemize}
    \\item Describe your professional information
    \\item Share your work experience and achievements
    \\item List your education and skills
    \\item The CV will update in real-time as you chat
\\end{itemize}

\\end{document}`;

function App() {
  const { sessionId, latexSource, isLoading, refreshSessionData } = useSession(INITIAL_SAMPLE_LATEX);

  return (
    <div className="app-container">
      <div className="panes-layout">
        <div className="pane left-pane preview-pane">
          <LivePreview latexSource={latexSource} isLoading={isLoading} />
        </div>

        <aside className="pane right-pane chat-pane">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading session...</p>
            </div>
          ) : (
            <ChatPane sessionId={sessionId} isLoading={isLoading} onMessageSent={refreshSessionData} />
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;