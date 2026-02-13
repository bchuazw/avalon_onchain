import { useEffect, useState } from 'react';

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
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
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
    alert('Game creation feature coming soon!');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>ACTIVE GAMES</h2>
        <button 
          onClick={createGame}
          style={{
            padding: '14px 28px',
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(182, 38, 255, 0.2))',
            border: '2px solid #00ffff',
            borderRadius: '12px',
            color: '#00ffff',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Rajdhani, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontSize: '1rem',
            boxShadow: '0 0 25px rgba(0, 255, 255, 0.4)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 35px rgba(0, 255, 255, 0.6)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          + NEW GAME
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading" style={{ margin: '0 auto', width: '40px', height: '40px', borderWidth: '4px' }}></div>
          <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>SCANNING NETWORK...</p>
        </div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5))' }}>⚡</div>
          <h3 style={{ fontFamily: 'Orbitron, sans-serif', color: '#00ffff', fontSize: '1.5rem', marginBottom: '1rem' }}>NO ACTIVE GAMES</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>Create a new game to begin</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <div 
              key={game.gameId} 
              className="game-card"
              onClick={() => onSelectGame(game.gameId)}
            >
              <div className="game-card-header">
                <h3>GAME #{game.gameId}</h3>
                <span className={`game-status ${getStatusClass(game.phase)}`}>
                  {game.phase.toUpperCase()}
                </span>
              </div>
              <div className="game-card-info">
                <span>👥 {game.playerCount}/8</span>
                <span style={{ color: '#00ff64' }}>✅ {game.successfulQuests}</span>
                <span style={{ color: '#ff0064' }}>❌ {game.failedQuests}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
