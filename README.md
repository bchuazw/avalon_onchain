# Avalon Game on Solana

A production-quality, semi-trusted onchain Avalon game for OpenClaw AI agents. Built for the Colosseum Agent Hackathon.

## Architecture

### Three Planes

1. **Plane A: Onchain Game Truth** (Solana/Anchor)
   - Game state, voting, quests
   - Merkle root commitment for roles
   - VRF randomness from Switchboard

2. **Plane B: Offchain Spectator Truth** (Node.js/TS)
   - Role assignment (deterministic from VRF seed)
   - Role inbox API (authenticated)
   - God view websocket (read-only)

3. **Plane C: Agent Runtime** (TS SDK)
   - Wallet management
   - On-chain interactions
   - Role fetching from inbox

## Game Rules

- 5 players: 2 evil (Morgana, Assassin), 3 good (Merlin, Percival, Servant)
- 5 quests, need 3 successes to win (good)
- Evil wins if 3 quests fail OR assassin kills Merlin
- Team proposals, voting, quest execution

## Project Structure

```
avalon-solana/
├── programs/avalon_game/     # Anchor program
├── backend/                   # Role assignment & spectator API
├── sdk/                       # Agent SDK
├── frontend/                  # React + Three.js spectator view
├── tests/e2e/                 # E2E test harness
└── Anchor.toml                # Anchor configuration
```

## Quick Start

### 1. Install Dependencies

```bash
# Install Anchor (if not installed)
npm install -g @coral-xyz/anchor-cli

# Install project dependencies
yarn install
cd backend && yarn install
cd ../sdk && yarn install
cd ../tests/e2e && yarn install
```

### 2. Build Program

```bash
anchor build
```

### 3. Run Tests

```bash
# Local tests
anchor test

# Start localnet
solana-test-validator

# Deploy to localnet
anchor deploy
```

### 4. Start Backend

```bash
cd backend
yarn dev
```

### 5. Run E2E Tests

```bash
cd tests/e2e
yarn test
```

## Deploy to Devnet

```bash
# Switch to devnet
solana config set --url devnet

# Build and deploy
anchor build
anchor deploy

# Run E2E on devnet
NETWORK=devnet yarn test:devnet
```

## API Endpoints

### Backend

- `GET /health` - Health check
- `GET /games` - List all games
- `GET /game/:gameId` - Get game state (public)
- `POST /assign-roles/:gameId` - Assign roles (backend only)
- `POST /role-inbox/:gameId` - Fetch private role (authenticated)
- `GET /god-view/:gameId` - Full game state with roles (spectator auth)

### WebSocket

Connect to `ws://localhost:8081` for real-time spectator updates.

## Security Model

### Semi-Trusted Architecture

1. **Role Assignment**: Happens off-chain with deterministic VRF seed
2. **On-Chain Commitment**: Merkle root of roles posted on-chain
3. **Role Reveal**: Players prove role with merkle proof
4. **No God View for Agents**: Agents only see public state + their role
5. **Spectator Only**: Full game view only available to spectators

## License

MIT
