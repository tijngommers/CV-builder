import { useSession } from './hooks/useSession';
import { LivePreview } from './components/LivePreview';
import { ChatPane } from './components/ChatPane';
import { DEFAULT_LATEX_TEMPLATE } from '../shared/defaultLatexTemplate';
import './App.css';

const INITIAL_SAMPLE_LATEX = DEFAULT_LATEX_TEMPLATE;

function App() {
  const { sessionId, latexSource, messages, isLoading, refreshSessionData, resetSession } = useSession(INITIAL_SAMPLE_LATEX);

  console.log('[App] Current sessionId:', sessionId);

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
            <ChatPane sessionId={sessionId} messages={messages} isLoading={isLoading} onMessageSent={refreshSessionData} onResetSession={resetSession} />
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;