import { useState } from 'react';
import LandingPage from './components/LandingPage';
import SpectatorView from './components/SpectatorView';
import './App.css';

function App() {
  const [isSpectating, setIsSpectating] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  return (
    <div className="app">
      {!isSpectating ? (
        <LandingPage onEnterSpectator={() => setIsSpectating(true)} />
      ) : (
        <>
          <header className="app-header">
            <h1>⚡ AVALON ⚡</h1>
            <div className="header-controls">
              <button
                onClick={() => {
                  setIsSpectating(false);
                  setSelectedGame(null);
                }}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(182, 38, 255, 0.15)',
                  border: '1px solid rgba(182, 38, 255, 0.4)',
                  borderRadius: '8px',
                  color: '#b026ff',
                  cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                ← Back to Home
              </button>
            </div>
          </header>
          <main className="app-main">
            <SpectatorView gameId={selectedGame} onSelectGame={setSelectedGame} />
          </main>
        </>
      )}
    </div>
  );
}

export default App;
