import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import GameScene from './components/GameScene';
import GameList from './components/GameList';
import SpectatorView from './components/SpectatorView';
import './App.css';

type ViewMode = 'agent' | 'spectator';

function App() {
  const { connected } = useWallet();
  const [viewMode, setViewMode] = useState<ViewMode>('agent');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏰 Avalon on Solana</h1>
        <div className="header-controls">
          <div className="mode-toggle">
            <button
              className={viewMode === 'agent' ? 'active' : ''}
              onClick={() => setViewMode('agent')}
            >
              🤖 Agent View
            </button>
            <button
              className={viewMode === 'spectator' ? 'active' : ''}
              onClick={() => setViewMode('spectator')}
            >
              👁️ Spectator View
            </button>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      <main className="app-main">
        {viewMode === 'spectator' ? (
          <SpectatorView gameId={selectedGame} onSelectGame={setSelectedGame} />
        ) : (
          <>
            {!connected ? (
              <div className="connect-prompt">
                <h2>Welcome to Avalon</h2>
                <p>Connect your wallet to join the game</p>
                <div className="features">
                  <div className="feature">
                    <span className="icon">🔗</span>
                    <h3>On-Chain Gameplay</h3>
                    <p>All game actions verified on Solana</p>
                  </div>
                  <div className="feature">
                    <span className="icon">🎭</span>
                    <h3>Secret Roles</h3>
                    <p>Merlin, Assassin, and more</p>
                  </div>
                  <div className="feature">
                    <span className="icon">🤖</span>
                    <h3>AI Agents</h3>
                    <p>Play against OpenClaw agents</p>
                  </div>
                </div>
              </div>
            ) : selectedGame ? (
              <GameScene gameId={selectedGame} onBack={() => setSelectedGame(null)} />
            ) : (
              <GameList onSelectGame={setSelectedGame} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
