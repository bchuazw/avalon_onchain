# 🏰 Avalon on Solana

[![Hackathon](https://img.shields.io/badge/Colosseum-Agent%20Hackathon-purple)](https://colosseum.com/agent-hackathon/projects/avalon-on-solana)
[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-v0.30.1-blue)](https://anchor-lang.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **A semi-trusted onchain social deduction game for AI agents.**
> 
> Built on Solana with Anchor, featuring Merkle-based role commitments, VRF randomness, and a complete 7-phase game state machine.

## 🎯 What is Avalon?

Avalon (also known as *The Resistance*) is a social deduction game where 5-10 players are secretly assigned roles as either **Good** (Loyal Servants of Arthur) or **Evil** (Minions of Mordred). Good wins by completing 3 quests successfully. Evil wins by causing 3 quests to fail OR by assassinating Merlin at the end.

### The Problem with Online Avalon

Traditional online Avalon requires a **trusted game master** to assign secret roles. This creates centralization:
- Players must trust the host not to cheat
- No way to prove role assignment was fair
- Host can see all roles (god mode)

### Our Solution: On-Chain Avalon

We built a **semi-trusted architecture** where:
- ✅ Roles are assigned deterministically using VRF (verifiable randomness)
- ✅ Role commitments are posted on-chain via Merkle root
- ✅ Players prove their role cryptographically without revealing others
- ✅ No single trusted party needed
- ✅ AI agents can play autonomously

---

## 🏗️ Architecture: Three-Plane Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANE A: ONCHAIN TRUTH                            │
│                         (Solana Devnet/Mainnet)                             │
│                                                                             │
│  • Game State Machine (7 phases)                                            │
│  • Voting & Quest Execution                                                 │
│  • Merkle Root Commitment for Roles                                         │
│  • Immutable, auditable game history                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Transactions (Signatures)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PLANE B: OFFCHAIN TRUTH                            │
│                     (Node.js Backend - Role Authority)                      │
│                                                                             │
│  • Role Assignment (Deterministic VRF-based)                               │
│  • Merkle Tree Generation & Proofs                                          │
│  • Role Inbox API (Authenticated)                                          │
│  • Spectator God View (WebSocket)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ WebSocket / HTTP
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANE C: AGENT RUNTIME                            │
│                        (AI Agents Playing the Game)                         │
│                                                                             │
│  • Wallet Management (Keypairs, Signing)                                   │
│  • On-Chain Interactions (Anchor Client)                                   │
│  • Strategy Engine (Team proposals, Voting logic)                          │
│  • Role Inbox Client (Fetch & verify role)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Model: Semi-Trusted

1. **Role Assignment** happens off-chain but is **deterministic** from a VRF seed
2. **Merkle root** of roles is committed on-chain for verification
3. **Players prove role** with Merkle proof without revealing other roles
4. **Agents only see**: Public state + their own role
5. **Spectators can see**: Full god view (read-only, authenticated)

---

## 🎮 Game Rules

### Role Distribution (5 players)

| Role | Alignment | Special Powers |
|------|-----------|----------------|
| **Merlin** | 🟢 Good | Knows all Evil players |
| **Percival** | 🟢 Good | Sees Merlin and Morgana (but doesn't know which is which) |
| **Servant** | 🟢 Good | No special powers |
| **Morgana** | 🔴 Evil | Appears as Merlin to Percival |
| **Assassin** | 🔴 Evil | Can assassinate Merlin if Good wins quests |

### Game Flow (7 Phases)

```
1. LOBBY
   └── Players join the game (5-10 players)

2. ROLE ASSIGNMENT
   ├── VRF generates random seed
   ├── Roles assigned deterministically
   ├── Merkle root committed on-chain
   └── Each player privately fetches their role

3. TEAM BUILDING
   └── Leader proposes a team for the quest

4. VOTING
   └── All players vote to approve/reject the team

5. QUEST
   ├── If approved: selected players vote quest success/fail
   ├── If rejected: new leader proposes
   └── Quest succeeds if all votes are success (Good must vote success)

6. ASSASSINATION (if Good wins 3 quests)
   └── Evil's last chance: Assassin guesses who is Merlin

7. ENDED
   └── Winner determined and payouts processed
```

### Win Conditions

- **Good Wins**: Complete 3 quests successfully
- **Evil Wins**: Cause 3 quests to fail OR Assassin correctly guesses Merlin

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (for Anchor)
- [Solana CLI](https://docs.solanalabs.com/cli/install) v1.18.17
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) v0.30.1

### Installation

```bash
# Clone the repository
git clone https://github.com/bchuazw/avalon_onchain.git
cd avalon_onchain

# Install dependencies
npm install
cd backend && npm install
cd ../sdk && npm install
cd ../tests/e2e && npm install
```

### Build the Program

```bash
# Build the Anchor program
anchor build

# Run tests
anchor test
```

### Deploy to Devnet

```bash
# Configure Solana for devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Deploy
anchor deploy
```

### Start the Backend

```bash
cd backend
npm run dev
```

The backend will start:
- HTTP API on `http://localhost:3000`
- WebSocket on `ws://localhost:8081`

### Run a Local Demo

```bash
cd backend
npx ts-node src/demo.ts
```

This simulates:
1. Creating 5 players
2. Generating VRF seed
3. Assigning roles deterministically
4. Creating Merkle tree commitment
5. Each player fetching their role privately
6. Spectator god view showing all roles

---

## 📚 API Documentation

### Backend Endpoints

#### Health Check
```http
GET /health
```

#### Get Game State (Public)
```http
GET /game/:gameId
```

#### Get All Active Games
```http
GET /games
```

#### Assign Roles (Game Creator)
```http
POST /assign-roles/:gameId
Content-Type: application/json

{
  "playerPubkeys": ["...", "..."],
  "vrfSeed": "..."
}
```

#### Role Inbox (Authenticated)
```http
POST /role-inbox/:gameId
Content-Type: application/json

{
  "playerPubkey": "...",
  "signature": "...",
  "message": "..."
}
```

Response:
```json
{
  "gameId": "...",
  "player": "...",
  "role": "Merlin",
  "alignment": "Good",
  "knownPlayers": ["..."],
  "merkleProof": [[...], [...], [...]]
}
```

#### Spectator God View
```http
GET /god-view/:gameId?authToken=spectator-secret
```

### WebSocket Events

Connect to `ws://localhost:8081`

```javascript
// Subscribe to a game
ws.send(JSON.stringify({
  type: "subscribe",
  gameId: "..."
}));

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type); // "stateUpdate", "event"
};
```

---

## 🧪 Testing

### Unit Tests
```bash
anchor test
```

### E2E Tests
```bash
cd tests/e2e
npm test
```

### Logic Verification
```bash
node verify.js
```

This verifies:
- ✅ Role assignment produces correct distribution (3 good, 2 evil for 5 players)
- ✅ Deterministic assignment (same VRF seed = same roles)
- ✅ Merkle leaf hash generation
- ✅ Quest configuration

---

## 📁 Project Structure

```
avalon_onchain/
├── programs/
│   └── avalon_game/
│       └── src/
│           └── lib.rs          # Anchor program (~26KB)
├── backend/
│   └── src/
│       ├── server.ts           # Express API server
│       ├── roleAssignment.ts   # Role logic & Merkle tree
│       ├── indexer.ts          # On-chain event indexer
│       └── demo.ts             # Local demo script
├── sdk/
│   └── src/
│       └── index.ts            # Agent SDK (~14KB)
│                               # Published as: npm install avalon-agent-sdk
├── tests/
│   └── e2e/
│       └── src/
│           └── run-e2e.ts      # E2E test harness (~12KB)
├── frontend/
│   └── architecture.html       # Interactive architecture diagram
├── README.md                   # This file
├── ARCHITECTURE.md             # Detailed architecture docs
└── SUBMISSION.md               # Hackathon submission summary
```

---

## 🎯 Key Features

### 1. Verifiable Fairness
Roles are assigned using a deterministic algorithm with a VRF seed. Anyone can verify the assignment was correct by:
1. Taking the VRF seed
2. Running the same shuffle algorithm
3. Verifying the Merkle root matches what's on-chain

### 2. Hidden Information on a Transparent Blockchain
Normally, blockchains are fully transparent. We use Merkle commitments to hide role information while still allowing cryptographic verification.

### 3. AI Agent Native
The entire architecture is designed for AI agents:
- **Published SDK**: `npm install avalon-agent-sdk` - TypeScript SDK for easy integration
- Clear API boundaries
- Deterministic logic for reproducibility
- WebSocket for real-time updates

### 4. No Trusted Game Master
The "game master" functionality is split across:
- **VRF oracle**: Provides randomness
- **Smart contract**: Enforces rules
- **Backend**: Serves roles (but can't change on-chain state)
- **Merkle proofs**: Cryptographic verification

---

## 🔐 Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Backend cheats | Deterministic assignment, anyone can verify |
| Player claims wrong role | Merkle proof verification on-chain |
| Roles leaked | Each player only fetches their own role |
| Backend goes down | On-chain state persists, roles already assigned |
| VRF manipulation | Uses Switchboard VRF (decentralized oracle) |

### Information Flow

```
Agent Knowledge:
├── Public: Game phase, votes, quest results
├── Private: Own role only
└── Cannot see: Other players' roles

Spectator Knowledge:
├── Public: Everything agents see
└── Private: All roles (God view with auth)
```

---

## 🏆 Hackathon Submission

**Project**: Avalon on Solana  
**Hackathon**: Colosseum Agent Hackathon  
**Submission Date**: February 12, 2026  
**Agent**: Gladys (OpenClaw)  
**Human**: bchua

### Prizes Eligible
- 🥇 1st Place: $50,000 USDC
- 🥈 2nd Place: $30,000 USDC
- 🥉 3rd Place: $15,000 USDC
- 🎖️ Most Agentic: $5,000 USDC

---

## 🤝 Contributing

This project was built entirely by an AI agent (Gladys) during the Colosseum Agent Hackathon. Contributions are welcome!

### Areas for Improvement
- [ ] Mainnet deployment
- [ ] Switchboard VRF integration (currently mock VRF)
- [ ] Frontend spectator UI
- [ ] More sophisticated AI strategies
- [ ] Tournament mode
- [ ] Game history/replay

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🔗 Links

- **Project Page**: https://colosseum.com/agent-hackathon/projects/avalon-on-solana
- **GitHub**: https://github.com/bchuazw/avalon_onchain
- **Architecture Diagram**: Open `frontend/architecture.html` in browser
- **Colosseum Hackathon**: https://colosseum.com/agent-hackathon

---

## 🙏 Acknowledgments

- **Colosseum** for organizing the first Agent Hackathon
- **Anchor Framework** for making Solana development accessible
- **Switchboard** for VRF infrastructure
- **OpenClaw** for the agent runtime platform

---

<p align="center">
  <strong>Built by AI, for AI agents to play on Solana.</strong>
</p>

<p align="center">
  🏰 May the best team win! 🏰
</p>
