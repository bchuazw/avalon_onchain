# Avalon on Solana - Architecture

## Three-Plane Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANE A: ONCHAIN TRUTH                            │
│                         (Solana Devnet/Mainnet)                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ANCHOR PROGRAM (avalon_game)                     │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │   │
│  │  │ Game State  │  │   Voting    │  │   Quests    │  │  Merkle   │ │   │
│  │  │  Machine    │  │   System    │  │  Execution  │  │   Root    │ │   │
│  │  │  (7 phases) │  │             │  │             │  │Commitment │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │   │
│  │                                                                     │   │
│  │  Game Phases:                                                       │   │
│  │  Lobby → RoleAssignment → TeamBuilding → Voting → Quest →           │   │
│  │  Assassination → Ended                                              │   │
│  │                                                                     │   │
│  │  Instructions:                                                      │   │
│  │  • create_game    • propose_team    • submit_quest_vote             │   │
│  │  • join_game      • vote_team       • assassin_guess                │   │
│  │  • start_game     • submit_role_reveal • advance_phase              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Program ID: [Deployed on Devnet via GitHub Actions]                        │
│  Tech: Anchor Framework, Rust, Solana Web3                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Transactions (Signatures)
                                      │ State Queries
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PLANE B: OFFCHAIN TRUTH                            │
│                     (Node.js Backend - Role Authority)                      │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐     │
│  │  Role Assignment│  │  Merkle Tree    │  │    Game Indexer         │     │
│  │    Engine       │  │   Generator     │  │  (On-chain Events)      │     │
│  │                 │  │                 │  │                         │     │
│  │ • VRF Seed      │  │ • Role Proofs   │  │ • Event Parsing         │     │
│  │ • Deterministic │  │ • Leaf Hashes   │  │ • State Sync            │     │
│  │ • Distribution  │  │ • Verification  │  │ • Real-time Updates     │     │
│  └────────┬────────┘  └────────┬────────┘  └───────────┬─────────────┘     │
│           │                    │                       │                    │
│           └────────────────────┼───────────────────────┘                    │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API SERVER (Express)                        │   │
│  │                                                                     │   │
│  │  POST /assign-roles/:gameId  → Assign & return Merkle root         │   │
│  │  POST /role-inbox/:gameId    → Agent fetches own role (auth)       │   │
│  │  GET  /god-view/:gameId      → Spectator full view (auth)          │   │
│  │  GET  /game/:gameId          → Public game state                   │   │
│  │                                                                     │   │
│  │  WebSocket: ws://localhost:8081 → Real-time updates                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Security:                                                                  │
│  • Role inbox requires signature verification                               │
│  • God view requires auth token (spectator only)                            │
│  • Roles never exposed to wrong players                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ WebSocket / HTTP
                                      │ Encrypted Role Proofs
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANE C: AGENT RUNTIME                            │
│                        (AI Agents Playing the Game)                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AGENT SDK (TypeScript)                       │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │    Wallet    │  │  On-Chain    │  │      Strategy Engine     │  │   │
│  │  │   Manager    │  │ Interactions │  │                          │  │   │
│  │  │              │  │              │  │ • Team Proposal Logic    │  │   │
│  │  │ • Keypairs   │  │ • Create Tx  │  │ • Vote Decision Making   │  │   │
│  │  │ • Signing    │  │ • Submit Tx  │  │ • Quest Participation    │  │   │
│  │  │ • Balance    │  │ • Poll State │  │ • Assassin Targeting     │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    ROLE INBOX CLIENT                        │   │   │
│  │  │                                                             │   │   │
│  │  │  • Fetch role from backend (authenticated)                  │   │   │
│  │  │  • Verify Merkle proof locally                              │   │   │
│  │  │  • No god view access - only sees own role                  │   │   │
│  │  │                                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Agent 1  │  │ Agent 2  │  │ Agent 3  │  │ Agent 4  │  │ Agent 5  │     │
│  │ (Merlin) │  │(Percival)│  │(Servant) │  │ (Morgana)│  │(Assassin)│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                             │
│  Each agent:                                                                │
│  • Sees public game state (on-chain)                                        │
│  • Knows own role (from role inbox)                                         │
│  • Cannot see other players' roles                                          │
│  • Makes decisions based on limited information                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ WebSocket Stream
                                      │ (Read-only)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SPECTATOR VIEW                                 │
│                        (God View - Human Watching)                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (React + WebSocket)                     │   │
│  │                                                                     │   │
│  │  • Real-time game state visualization                              │   │
│  │  • Shows ALL roles (God view)                                       │   │
│  │  • Quest progress, voting results                                   │   │
│  │  • Agent decision logs                                              │   │
│  │                                                                     │   │
│  │  Access: Secured auth token (spectator only)                        │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  YOU ARE HERE → Watching agents play in real-time!                          │
└─────────────────────────────────────────────────────────────────────────────┘


## Security Model: Semi-Trusted Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     TRUST ASSUMPTIONS                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Role Assignment (Off-chain)                                │
│     ├── Deterministic from VRF seed                            │
│     ├── Auditable by anyone                                    │
│     └── Results in Merkle root committed on-chain              │
│                                                                │
│  2. On-Chain Verification                                      │
│     ├── Merkle root stored in game account                     │
│     ├── Players prove role with Merkle proof                   │
│     └── Smart contract validates proofs                        │
│                                                                │
│  3. Information Flow                                           │
│     ├── Agents: Public state + own role only                   │
│     ├── Spectators: Full god view (read-only)                  │
│     └── Backend: Role authority but cannot change game state   │
│                                                                │
│  4. No Single Point of Failure                                 │
│     ├── Game state is on-chain (immutable)                     │
│     ├── Role assignment is deterministic (reproducible)        │
│     └── Even if backend fails, on-chain state persists         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow: Quest Execution Example

```
1. PROPOSE TEAM                    2. VOTE ON TEAM
   Agent 1 (Leader)                  All Agents
   ────────────────                  ───────────
   Sees: Public state                Sees: Proposed team
   Decides: Team of 3                Decides: Approve/Reject
   Action: propose_team()            Action: vote_team()
   ↓                                 ↓
   On-chain: Team proposal stored    On-chain: Votes tallied

3. EXECUTE QUEST                   4. REVEAL RESULTS
   Selected Agents                   All Agents
   ───────────────                  ───────────
   Sees: Approved team               Sees: Success/Fail count
   Decides: Success or Fail          Sees: (But not who voted what)
   Action: submit_quest_vote()       
   ↓                                 
   On-chain: Votes encrypted         

5. ADVANCE PHASE
   On-chain Program
   ────────────────
   Reveals: Quest results
   Updates: Game phase
   Checks: Win conditions
```

## Component Breakdown

| Component | Lines | Language | Purpose |
|-----------|-------|----------|---------|
| Anchor Program | ~26KB | Rust | On-chain game logic, state machine |
| Backend API | ~12KB | TypeScript | Role assignment, authentication, WebSocket |
| Agent SDK | ~14KB | TypeScript | Wallet mgmt, on-chain txs, strategy |
| E2E Tests | ~12KB | TypeScript | Multi-agent simulation, security tests |
| Frontend | ~8KB | React/TS | Spectator god view (optional) |

## Key Innovations

1. **Merkle-based Role Commitment**: Roles assigned off-chain with cryptographic proof on-chain
2. **Three-Plane Separation**: Clear boundaries between on-chain truth, off-chain authority, and agent runtime
3. **Deterministic Assignment**: Same VRF seed always produces same role distribution (auditable)
4. **No God View for Agents**: Agents truly only know their own role + public state
5. **Verifiable Fairness**: Anyone can verify role assignment was correct without seeing roles

## Tech Stack

- **Blockchain**: Solana (Devnet → Mainnet)
- **Smart Contracts**: Anchor Framework v0.30.1
- **Backend**: Node.js, Express, WebSocket
- **Frontend**: React, TypeScript
- **Testing**: Custom E2E harness with multi-agent simulation
