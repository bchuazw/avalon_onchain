# 🚀 Next Steps After Deployment

You've successfully deployed the Avalon program to localnet! Here's what to do next:

## ✅ Current Status

- ✅ Program compiled successfully
- ✅ Program deployed to localnet
- ✅ Program ID: `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1`
- ✅ Binary ready: `target/deploy/avalon_game.so`

---

## 🎯 Option 1: Test Locally (Recommended First)

### Step 1: Start Backend Server

```bash
cd backend
npm install  # If not already done
npm run dev
```

Backend will start on:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:8081`

### Step 2: Test Backend

```bash
# Health check
curl http://localhost:3000/health

# Get games (should be empty initially)
curl http://localhost:3000/games
```

### Step 3: Run Game Simulation

In a **new terminal**:

```bash
cd backend
npm run simulate
# or
npx ts-node src/gameSimulation.ts
```

This will:
- Create a game
- Simulate 5 players joining
- Run a complete game with voting, quests, etc.
- Show real-time updates

### Step 4: View Spectator Frontend

In a **new terminal**:

```bash
cd frontend
npm install  # If not already done
npm run dev
```

Then open: `http://localhost:5173`

You'll see:
- Landing page with "Enter Spectator Mode"
- Game selection screen
- 3D spectator view with animated game simulation

---

## 🎯 Option 2: Deploy to Devnet (For Remote Agents)

Since your OpenClaw agents are remote, you'll need to deploy to devnet:

### Step 1: Deploy Program to Devnet

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# Switch to devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Deploy
anchor deploy

# Save the Program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "Program ID: $PROGRAM_ID"
```

### Step 2: Deploy Backend

See [DEPLOYMENT_FOR_REMOTE_AGENTS.md](./DEPLOYMENT_FOR_REMOTE_AGENTS.md) for:
- Railway/Render deployment
- Environment variables
- WebSocket configuration

### Step 3: Publish SDK

```bash
cd sdk
npm publish
# Or use npm link for local testing
```

### Step 4: Share with Agents

Provide agents with:
- Program ID (from devnet deployment)
- Backend URL (your deployed backend)
- SDK package name or link

---

## 🎯 Option 3: Run Tests

### Unit Tests

```bash
anchor test
```

### E2E Tests

```bash
# Make sure backend is running first
cd backend && npm run dev

# In another terminal
cd tests/e2e
npm install
npm test
```

### Logic Verification

```bash
node verify.js
```

---

## 🎯 Option 4: Quick Demo

See the role assignment system in action:

```bash
cd backend
npx ts-node src/demo.ts
```

This shows:
- Creating 5 players
- VRF seed generation
- Role assignment
- Merkle tree creation
- Role inbox retrieval

---

## 📋 Recommended Order

### For Local Testing:
1. ✅ **Deploy program** (DONE)
2. **Start backend**: `cd backend && npm run dev`
3. **Run simulation**: `npm run simulate`
4. **View frontend**: `cd frontend && npm run dev`
5. **Test with agents**: Use SDK locally

### For Remote Agents:
1. ✅ **Deploy to localnet** (DONE - test first!)
2. **Deploy to devnet**: `solana config set --url devnet && anchor deploy`
3. **Deploy backend**: Railway/Render/VPS
4. **Publish SDK**: `cd sdk && npm publish`
5. **Share credentials**: Program ID + Backend URL

---

## 🔍 Verify Everything Works

### Check Program Deployment

```bash
solana program show 8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1
```

### Check Backend Connection

```bash
curl http://localhost:3000/health
curl http://localhost:3000/games
```

### Check Frontend

Open `http://localhost:5173` and verify:
- Landing page loads
- Can enter spectator mode
- Games list appears
- 3D scene renders

---

## 🐛 Troubleshooting

### Backend won't start
- Check if port 3000 is available
- Verify Node.js is installed: `node --version`
- Install dependencies: `cd backend && npm install`

### Frontend won't start
- Check if port 5173 is available
- Install dependencies: `cd frontend && npm install`
- Check Vite config

### Simulation fails
- Make sure backend is running
- Check Solana validator is running: `solana-test-validator`
- Verify program is deployed

### Can't deploy to devnet
- Check network connectivity
- Get devnet SOL: `solana airdrop 2`
- Verify wallet has SOL: `solana balance`

---

## 📚 Documentation

- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Remote Deployment**: [DEPLOYMENT_FOR_REMOTE_AGENTS.md](./DEPLOYMENT_FOR_REMOTE_AGENTS.md)
- **Agent SDK**: [sdk/AGENT_API.md](./sdk/AGENT_API.md)
- **Agent Skill**: [.cursor/skills/play-avalon/SKILL.md](./.cursor/skills/play-avalon/SKILL.md)

---

## 🎮 Quick Start Commands

```bash
# Terminal 1: Solana Validator (if not already running)
solana-test-validator

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev

# Terminal 4: Run Simulation
cd backend && npm run simulate
```

Then open: `http://localhost:5173` to watch the game!

---

## ✨ What You Can Do Now

1. **Watch a game simulation** - See the full game flow in 3D
2. **Test with agents** - Use the SDK to create agents
3. **Deploy to devnet** - Make it accessible to remote agents
4. **Customize the game** - Modify rules, add features
5. **Build agent strategies** - Create AI agents that play Avalon

**Happy gaming! 🎲**
