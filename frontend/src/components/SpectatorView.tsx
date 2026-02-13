import { useState, useEffect, useRef } from 'react';
import SpectatorScene3D from './three/SpectatorScene3D';
import { ChatMessage } from './three/SpeechBubble';

// Hook for responsive breakpoints
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
}

interface SpectatorViewProps {
  gameId: string | null;
  onSelectGame: (gameId: string | null) => void;
}

interface Game {
  gameId: string;
  phase: string;
  playerCount: number;
  successfulQuests: number;
  failedQuests: number;
  winner: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://avalon-production-2fb1.up.railway.app';

// ============================================================
// Dialogue templates for each game phase
// ============================================================
const PHASE_DIALOGUES: Record<string, string[][]> = {
  Lobby: [
    ["Ready for this mission.", "Let's go.", "Gathering intel...", "The council assembles."],
  ],
  RoleAssignment: [
    ["I sense darkness among us.", "Stay vigilant.", "Trust no one.", "My role is clear."],
  ],
  TeamBuilding: [
    ["I propose we send our best.", "Not that one... suspicious.", "Trust me on this.", "I have a good feeling about this team."],
    ["Wait, why them?", "This team seems balanced.", "I'll support this proposal.", "I'm not sure about this..."],
    ["We need to be careful here.", "Who can we trust?", "Let's think about this strategically.", "I have my doubts..."],
    ["This is a critical decision.", "We must choose wisely.", "Every choice matters now.", "I'm analyzing the options..."],
    ["Time is running out.", "We need to decide soon.", "Let's discuss our strategy.", "What's everyone thinking?"],
  ],
  Voting: [
    ["I approve this team!", "Reject! Something's off.", "This team will succeed.", "I have concerns..."],
    ["Think carefully before you vote.", "The fate of the realm depends on us.", "Trust your instincts."],
    ["This vote is crucial.", "We must be united.", "I'm voting with conviction.", "Every vote counts..."],
    ["I've made my decision.", "Let's see what happens.", "The council will decide.", "I stand by my choice."],
    ["The tension is palpable.", "This could change everything.", "We're at a crossroads.", "History will remember this moment."],
  ],
  Quest: [
    ["For the good of the realm!", "Succeed the mission!", "I'll do what I must...", "The quest begins..."],
    ["Hold steady...", "We can do this.", "Remember what's at stake."],
  ],
  Assassination: [
    ["I know who Merlin is...", "The seer will fall.", "Take the shot.", "I must choose wisely..."],
    ["Protect the seer!", "Stay hidden...", "Don't give it away."],
  ],
  Ended: [
    ["Well played, everyone.", "The prophecy is fulfilled.", "Until next time.", "What a game!"],
  ],
};

function generatePhaseDialogue(phase: string, playerCount: number): { playerIndex: number; text: string }[] {
  const dialogueSets = PHASE_DIALOGUES[phase] || PHASE_DIALOGUES.Lobby;
  const messages: { playerIndex: number; text: string }[] = [];

  for (const set of dialogueSets) {
    // Pick 2-3 random players and messages
    const numMessages = Math.min(3, Math.floor(Math.random() * 3) + 1);
    const usedPlayers = new Set<number>();

    for (let i = 0; i < numMessages && i < playerCount; i++) {
      let pIdx: number;
      do {
        pIdx = Math.floor(Math.random() * playerCount);
      } while (usedPlayers.has(pIdx) && usedPlayers.size < playerCount);
      usedPlayers.add(pIdx);

      const text = set[Math.floor(Math.random() * set.length)];
      messages.push({ playerIndex: pIdx, text });
    }
  }

  return messages;
}

// ============================================================
// SpectatorView component
// ============================================================
export default function SpectatorView({ gameId, onSelectGame }: SpectatorViewProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatIdCounter = useRef(0);
  const lastPhaseRef = useRef<string>('');
  const currentGameIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  // Reset chat when gameId changes (per-game chat sessions)
  useEffect(() => {
    if (gameId !== currentGameIdRef.current) {
      setChatMessages([]);
      lastPhaseRef.current = '';
      currentGameIdRef.current = gameId;
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      fetchGameState(gameId);
      connectWebSocket(gameId);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [gameId]);

  // Generate dialogue when game phase changes
  // NOTE: Voting phase dialogue is disabled - votes are announced as chat messages from simulation
  useEffect(() => {
    if (!gameState) return;

    const currentPhase = typeof gameState.phase === 'object'
      ? Object.keys(gameState.phase)[0]
      : gameState.phase;

    if (currentPhase && currentPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = currentPhase;

      // Skip dialogue generation for Voting phase - votes will be announced as chat messages
      if (currentPhase === 'Voting') {
        return;
      }

      const playerCount = gameState.playerCount || (gameState.players?.length || 0);
      if (playerCount === 0) return;

      const dialogues = generatePhaseDialogue(currentPhase, playerCount);

      // Get role info for messages
      const getRole = (idx: number) => {
        if (!gameState.players || !gameState.players[idx]) return 'Unknown';
        const p = gameState.players[idx];
        return typeof p === 'string' ? 'Unknown' : (p.role || 'Unknown');
      };

      // Stagger messages over time - longer delays for discussion phases
      const isDiscussionPhase = currentPhase === 'TeamBuilding';
      const baseDelay = isDiscussionPhase ? 5000 : 2500; // Longer initial delay for discussion
      const messageSpacing = isDiscussionPhase ? 4000 : 2500; // More spacing between messages
      
      // Generate more messages for discussion phases to simulate longer discussion
      const extendedDialogues = isDiscussionPhase 
        ? [...dialogues, ...generatePhaseDialogue(currentPhase, playerCount)] // Double the messages
        : dialogues;

      extendedDialogues.forEach((d, i) => {
        setTimeout(() => {
          const msg: ChatMessage = {
            id: `chat-${chatIdCounter.current++}`,
            playerIndex: d.playerIndex,
            role: getRole(d.playerIndex),
            text: d.text,
            timestamp: Date.now(),
          };
          setChatMessages((prev) => [...prev.slice(-20), msg]);
        }, baseDelay + i * messageSpacing + Math.random() * 2000);
      });
    }
  }, [gameState]);

  const fetchGames = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/games`);
      const data = await response.json();
      setGames(data);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchGameState = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/game/${id}`);
      const data = await response.json();
      setGameState(data);
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (id: string) => {
    const websocket = new WebSocket('ws://localhost:8081');

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'subscribe', gameId: id }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'stateUpdate') {
        setGameState(data.data);
      } else if (data.type === 'chatMessage') {
        // Handle chat message from backend
        const chatMsg: ChatMessage = {
          id: data.data.id,
          playerIndex: data.data.playerIndex,
          role: data.data.role,
          text: data.data.text,
          timestamp: data.data.timestamp,
        };
        setChatMessages((prev) => [...prev.slice(-20), chatMsg]);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);
  };

  // ============================================================
  // Game selection screen (no game selected)
  // ============================================================
  if (!gameId) {
    return (
      <div className="spectator-view">
        <div style={{ textAlign: 'center', padding: 'clamp(1rem, 4vw, 2rem) 0' }}>
          <div style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 30px rgba(182, 38, 255, 0.5))' }}>
            👁️
          </div>
          <h2
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              color: '#b026ff',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: 'clamp(2px, 1vw, 4px)',
            }}
          >
            SPECTATOR MODE
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 'clamp(1rem, 3vw, 1.2rem)', marginBottom: '0.5rem', padding: '0 1rem' }}>
            Select a game to view its complete state in 3D
          </p>
          <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', marginBottom: '2rem', padding: '0 1rem' }}>
            <span style={{ color: '#b026ff' }}>GOD VIEW:</span> See all roles, conversations, and hidden information
          </p>
        </div>

        {gamesLoading ? (
          <div style={{ textAlign: 'center', padding: 'clamp(2rem, 6vw, 3rem)' }}>
            <div className="loading" style={{ margin: '0 auto', width: '40px', height: '40px', borderWidth: '4px' }} />
            <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>SCANNING NETWORK...</p>
          </div>
        ) : games.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'clamp(1.5rem, 4vw, 2rem)', color: 'rgba(255, 255, 255, 0.5)' }}>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)' }}>No games found. Run a simulation to create a game.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
              gap: '1.5rem',
              padding: '0 clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem)',
            }}
          >
            {games.map((game) => (
              <div
                key={game.gameId}
                onClick={() => onSelectGame(game.gameId)}
                style={{
                  padding: 'clamp(1rem, 3vw, 1.5rem)',
                  background: 'rgba(182, 38, 255, 0.1)',
                  border: '2px solid rgba(182, 38, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(182, 38, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(182, 38, 255, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(182, 38, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(182, 38, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(182, 38, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontFamily: 'Orbitron, sans-serif', color: '#b026ff', fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', margin: 0 }}>
                    GAME #{game.gameId}
                  </h3>
                  <span
                    style={{
                      padding: '0.3rem clamp(0.6rem, 2vw, 0.8rem)',
                      borderRadius: '20px',
                      fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background:
                        game.phase === 'Ended'
                          ? 'rgba(255, 0, 0, 0.2)'
                          : game.phase === 'Lobby'
                          ? 'rgba(0, 255, 0, 0.2)'
                          : 'rgba(182, 38, 255, 0.2)',
                      color: game.phase === 'Ended' ? '#ff0064' : game.phase === 'Lobby' ? '#00ff64' : '#b026ff',
                      border: `1px solid ${game.phase === 'Ended' ? '#ff0064' : game.phase === 'Lobby' ? '#00ff64' : '#b026ff'}`,
                    }}
                  >
                    {game.phase}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', color: 'rgba(255, 255, 255, 0.8)', flexWrap: 'wrap' }}>
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

  // ============================================================
  // Loading state
  // ============================================================
  if (loading) {
    return (
      <div className="spectator-view">
        <div style={{ textAlign: 'center', padding: 'clamp(2rem, 8vw, 4rem)' }}>
          <div className="loading" style={{ margin: '0 auto', width: 'clamp(40px, 10vw, 50px)', height: 'clamp(40px, 10vw, 50px)', borderWidth: '5px' }} />
          <p style={{ marginTop: '1.5rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>LOADING GAME DATA...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 3D Spectator View
  // ============================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.75rem' : '0',
          padding: 'clamp(0.6rem, 2vw, 0.8rem) clamp(1rem, 3vw, 1.5rem)',
          background: 'rgba(5, 5, 16, 0.9)',
          borderBottom: '1px solid rgba(176, 38, 255, 0.3)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectGame(null)}
            style={{
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
              background: 'rgba(182, 38, 255, 0.15)',
              border: '1px solid rgba(182, 38, 255, 0.4)',
              borderRadius: '8px',
              color: '#b026ff',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            ← BACK
          </button>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(0.9rem, 3vw, 1.2rem)',
              color: '#b026ff',
              letterSpacing: 'clamp(1px, 0.5vw, 2px)',
            }}
          >
            GAME #{gameId}
          </h2>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'clamp(0.75rem, 2vw, 1.5rem)',
            alignItems: 'center',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 600,
            fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#00ffff' }}>
            {typeof gameState?.phase === 'object' ? Object.keys(gameState.phase)[0].toUpperCase() : (gameState?.phase || 'LOADING').toUpperCase()}
          </span>
          <span style={{ color: '#00ff64' }}>✅ {gameState?.successfulQuests || 0}</span>
          <span style={{ color: '#ff0064' }}>❌ {gameState?.failedQuests || 0}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>👥 {gameState?.playerCount || 0}</span>
        </div>
      </div>

      {/* 3D Scene */}
      <div style={{ flex: 1, position: 'relative' }}>
        <SpectatorScene3D gameState={gameState} chatMessages={chatMessages} />

        {/* Chat log sidebar */}
        <div
          style={{
            position: 'absolute',
            right: isMobile ? '0.5rem' : '1rem',
            bottom: isMobile ? '0.5rem' : '1rem',
            left: isMobile ? '0.5rem' : 'auto',
            width: isMobile ? 'auto' : '280px',
            maxWidth: isMobile ? 'calc(100% - 1rem)' : '280px',
            maxHeight: isMobile ? '200px' : '300px',
            background: 'rgba(5, 5, 16, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: 'clamp(8px, 2vw, 12px)',
            overflowY: 'auto',
            backdropFilter: 'blur(10px)',
            boxShadow: isMobile ? '0 -4px 20px rgba(0, 0, 0, 0.5)' : 'none',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 'clamp(7px, 2vw, 9px)',
              color: '#00ffff',
              textTransform: 'uppercase',
              letterSpacing: 'clamp(2px, 0.5vw, 3px)',
              marginBottom: '8px',
              borderBottom: '1px solid rgba(0, 255, 255, 0.15)',
              paddingBottom: '6px',
            }}
          >
            Conversation Log
          </div>
          {chatMessages.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 'clamp(10px, 2.5vw, 12px)', fontFamily: 'Rajdhani, sans-serif' }}>
              Waiting for activity...
            </div>
          ) : (
            chatMessages.slice(-15).map((msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom: '6px',
                  padding: 'clamp(4px, 1.5vw, 6px) clamp(6px, 2vw, 8px)',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `3px solid ${getMessageColor(msg.role)}`,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    fontSize: 'clamp(7px, 2vw, 9px)',
                    color: getMessageColor(msg.role),
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  {msg.role}
                </div>
                <div
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                    color: 'rgba(255,255,255,0.8)',
                    marginTop: '2px',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getMessageColor(role: string): string {
  const colors: Record<string, string> = {
    Merlin: '#4488ff',
    Percival: '#88bbff',
    Servant: '#44cc66',
    Assassin: '#ff2244',
    Morgana: '#9922cc',
    Mordred: '#cc0000',
    Oberon: '#444466',
  };
  return colors[role] || '#888888';
}
