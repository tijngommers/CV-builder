import { CV } from './data/initialData.mts';
import { useSession } from './hooks/useSession';
import { FormEditor } from './components/FormEditor';
import { LivePreview } from './components/LivePreview';
import { ChatPane } from './components/ChatPane';
import './App.css';

function App() {
  const { sessionId, cvData, missingFields, isLoading, updateCvData, applyServerCvUpdate } = useSession(CV);

  const handleFormUpdate = async (newCvData) => {
    await updateCvData(newCvData);
  };

  const handleChatDataUpdate = (newCvData, nextMissingFields) => {
    applyServerCvUpdate(newCvData, nextMissingFields);
  };

  return (
    <div className="app-container">
      <div className="panes-layout">
        <aside className="pane left-pane">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading session...</p>
            </div>
          ) : (
            <FormEditor cvData={cvData} onUpdate={handleFormUpdate} missingFields={missingFields} />
          )}
        </aside>

        <div className="pane center-pane">
          <LivePreview cvData={cvData} isLoading={isLoading} />
        </div>

        <aside className="pane right-pane">
          <ChatPane sessionId={sessionId} onDataUpdate={handleChatDataUpdate} isLoading={isLoading} />
        </aside>
      </div>
    </div>
  );
}

export default App;