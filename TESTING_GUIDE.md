# 🧪 Testing Guide for Avalon on Solana

This guide covers all the ways to test the Avalon game, from quick logic verification to full end-to-end tests.

## 📋 Table of Contents

1. [Quick Logic Verification](#quick-logic-verification)
2. [Unit Tests (Anchor)](#unit-tests-anchor)
3. [End-to-End Tests](#end-to-end-tests)
4. [Local Demo](#local-demo)
5. [Manual Testing](#manual-testing)

---

## 1. Quick Logic Verification

**Fastest way to verify core game logic** without Solana/Anchor setup.

### Run Verification Script

```bash
node verify.js
```

### What it tests:
- ✅ Role assignment produces correct distribution (3 good, 2 evil for 5 players)
- ✅ Deterministic assignment (same VRF seed = same roles)
- ✅ Merkle leaf hash generation
- ✅ Quest configuration

**Use this when:** You want to quickly verify the game logic is working correctly.

---

## 2. Unit Tests (Anchor)

**Tests the Solana smart contract** using Anchor's test framework.

### Prerequisites

Make sure you have:
- Solana CLI installed (`solana --version`)
- Anchor CLI installed (`anchor --version`)
- Local validator running OR devnet configured

### Run Unit Tests

```bash
# Build the program first
anchor build

# Run tests
anchor test
```

### What it tests:
- ✅ Game initialization
- ✅ Players joining
- ✅ Duplicate join prevention
- ✅ Game start with VRF seed
- ✅ Role reveal with merkle proof
- ✅ Phase advancement
- ✅ Team proposal
- ✅ Voting on teams
- ✅ Quest voting

**Use this when:** You want to test the on-chain smart contract logic.

---

## 3. End-to-End Tests

**Full integration test** simulating multiple agents playing a complete game.

### Prerequisites

1. **Backend must be running:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend runs on:
   - HTTP API: `http://localhost:3000`
   - WebSocket: `ws://localhost:8081`

2. **Local validator OR devnet:**
   - For localnet: `solana-test-validator` (in another terminal)
   - For devnet: Configure Solana CLI for devnet

3. **Install E2E dependencies:**
   ```bash
   cd tests/e2e
   npm install
   ```

### Run E2E Tests

```bash
# Test on localnet (default)
cd tests/e2e
npm test

# Test on devnet
npm run test:devnet
```

### What it tests:
- ✅ Creating a game
- ✅ All players joining
- ✅ Starting game with role assignment
- ✅ Role reveal flow
- ✅ God view security (no unauthorized access)
- ✅ Complete quest round

**Use this when:** You want to test the full game flow with multiple agents.

---

## 4. Local Demo

**Interactive demo** showing role assignment and Merkle tree generation.

### Prerequisites

Backend dependencies installed:
```bash
cd backend
npm install
```

### Run Demo

```bash
cd backend
npx ts-node src/demo.ts
```

### What it demonstrates:
1. Creating 5 players
2. Generating VRF seed
3. Assigning roles deterministically
4. Creating Merkle tree commitment
5. Each player fetching their role privately
6. Spectator god view showing all roles

**Use this when:** You want to see the role assignment system in action.

---

## 5. Manual Testing

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend provides:
- HTTP API on `http://localhost:3000`
- WebSocket on `ws://localhost:8081`

### Test Endpoints

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Get All Games
```bash
curl http://localhost:3000/games
```

#### Get Game State
```bash
curl http://localhost:3000/game/{gameId}
```

#### Assign Roles (requires game creator)
```bash
curl -X POST http://localhost:3000/assign-roles/{gameId} \
  -H "Content-Type: application/json" \
  -d '{
    "playerPubkeys": ["...", "..."],
    "vrfSeed": [...]
  }'
```

#### Get Role (authenticated)
```bash
curl -X POST http://localhost:3000/role-inbox/{gameId} \
  -H "Content-Type: application/json" \
  -d '{
    "playerPubkey": "...",
    "signature": "...",
    "message": "..."
  }'
```

#### Spectator God View (authenticated)
```bash
curl "http://localhost:3000/god-view/{gameId}?authToken=spectator-secret"
```

### Frontend Testing

Open the architecture diagram:
```bash
open frontend/architecture.html
```

Or serve it:
```bash
cd frontend
python3 -m http.server 8000
# Then open http://localhost:8000/architecture.html
```

---

## 🚀 Quick Start Testing Workflow

### Option 1: Quick Verification (No Setup)
```bash
node verify.js
```

### Option 2: Full Test Suite
```bash
# 1. Verify logic
node verify.js

# 2. Build program
anchor build

# 3. Run unit tests
anchor test

# 4. Start backend (in separate terminal)
cd backend && npm run dev

# 5. Run E2E tests (in another terminal)
cd tests/e2e && npm test
```

---

## 🐛 Troubleshooting

### Tests fail with "Connection refused"
- Make sure Solana local validator is running: `solana-test-validator`
- Or configure for devnet: `solana config set --url devnet`

### E2E tests fail with "Backend not available"
- Start the backend: `cd backend && npm run dev`
- Check it's running on `http://localhost:3000`

### Anchor tests fail with "Program not deployed"
- Build first: `anchor build`
- Deploy: `anchor deploy` (or tests will auto-deploy)

### "Cannot find module" errors
- Install dependencies: `npm install` in each directory
- Check you're in the right directory

---

## 📊 Test Coverage

| Test Type | Coverage | Speed | Setup Required |
|-----------|----------|-------|----------------|
| `verify.js` | Core logic only | ⚡ Fast | None |
| `anchor test` | Smart contract | ⚡⚡ Medium | Solana + Anchor |
| E2E tests | Full integration | ⚡⚡⚡ Slow | Backend + Solana |
| Local demo | Role assignment | ⚡ Fast | Backend only |

---

## 🎯 Recommended Testing Order

1. **Start with `verify.js`** - Quick sanity check
2. **Run `anchor test`** - Verify smart contract
3. **Run local demo** - See role assignment in action
4. **Run E2E tests** - Full game flow

---

## 📝 Notes

- E2E tests create real transactions on the network (localnet or devnet)
- Tests use test keypairs and request airdrops automatically
- God view requires authentication token (see backend code for token)
- All tests are designed to be idempotent (can run multiple times)

---

**Happy Testing! 🎮**
