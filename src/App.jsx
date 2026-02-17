import { useState } from 'react';
import { initialData } from './data/initialData';

function App() {
  const [cvData, setCvData] = useState(initialData);

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }}>
      <section style={{ flex: 1, padding: '20px', background: '#f4f4f4' }}>
        <h1>Editor</h1>
        {/* Hier komen je formulieren om cvData aan te passen */}
      </section>

      <section style={{ flex: 1, padding: '20px' }}>
        <h1>Preview</h1>
        {/* Hier komt de visuele weergave van cvData */}
        <pre>{JSON.stringify(cvData, null, 2)}</pre> 
      </section>
    </main>
  );
}

export default App;