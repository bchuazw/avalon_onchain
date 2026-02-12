import React, { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

interface Game {
  gameId: string;
  phase: string;
  playerCount: number;
  successfulQuests: number;
  failedQuests: number;
  winner: string | null;
}

interface GameListProps {
  onSelectGame: (gameId: string) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function GameList({ onSelectGame }: GameListProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/games`);
      const data = await response.json();
      setGames(data);
    } catch (error) {
      console.error('Failed to fetch games:', error);
      // Use mock data if backend is not available
      setGames([
        { gameId: '1', phase: 'Lobby', playerCount: 3, successfulQuests: 0, failedQuests: 0, winner: null },
        { gameId: '2', phase: 'Quest', playerCount: 5, successfulQuests: 2, failedQuests: 1, winner: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createGame = async () => {
    // This would integrate with the program
    console.log('Creating new game...');
  };

  const getStatusClass = (phase: string) => {
    switch (phase) {
      case 'Lobby': return 'lobby';
      case 'Ended': return 'ended';
      default: return 'active';
    }
  };

  return (
    <div className="game-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Active Games</h2>
        <button 
          onClick={createGame}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(90deg, #ffd700, #ff6b35)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          + Create Game
        </button>
      </div>

      {loading ? (
        <p>Loading games...</p>
      ) : games.length === 0 ? (
        <p>No active games. Create one to get started!</p>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <div 
              key={game.gameId} 
              className="game-card"
              onClick={() => onSelectGame(game.gameId)}
            >
              <div className="game-card-header">
                <h3>Game #{game.gameId}</h3>
                <span className={`game-status ${getStatusClass(game.phase)}`}>
                  {game.phase}
                </span>
              </div>
              <div className="game-card-info">
                <span>👥 {game.playerCount}/10 players</span>
                <span>✅ {game.successfulQuests}</span>
                <span>❌ {game.failedQuests}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
