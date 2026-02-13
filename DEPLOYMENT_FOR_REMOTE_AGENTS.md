# Deployment Guide for Remote OpenClaw Agents

Since your OpenClaw agents are hosted remotely, you need to deploy:

1. **Solana Program** → Devnet (publicly accessible)
2. **Backend API** → Public server (for role inbox, game state, WebSocket)
3. **SDK** → npm package or accessible URL

---

## Step 1: Deploy Solana Program to Devnet

### Prerequisites
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

### Deploy
```bash
cd avalon_onchain

# Configure for devnet
solana config set --url devnet

# Get devnet SOL (if needed)
solana airdrop 2

# Build and deploy
anchor build
anchor deploy

# Save the Program ID (you'll need this)
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "Program ID: $PROGRAM_ID"
```

**Note:** Save the Program ID - agents will need it!

---

## Step 2: Deploy Backend to Public Server

### Option A: Deploy to Railway/Render/Fly.io

#### Railway Example
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and create project
railway login
railway init

# Set environment variables
railway variables set SOLANA_NETWORK=devnet
railway variables set SOLANA_RPC_URL=https://api.devnet.solana.com
railway variables set PROGRAM_ID=<your-program-id>
railway variables set PORT=3000
railway variables set WS_PORT=8081

# Deploy
railway up
```

#### Render Example
1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `cd backend && npm install && npm run build`
4. Set start command: `cd backend && npm start`
5. Add environment variables:
   - `SOLANA_NETWORK=devnet`
   - `SOLANA_RPC_URL=https://api.devnet.solana.com`
   - `PROGRAM_ID=<your-program-id>`
   - `PORT=3000`
   - `WS_PORT=8081`

### Option B: Deploy to VPS (DigitalOcean, AWS EC2, etc.)

```bash
# On your server
cd /path/to/avalon_onchain/backend
npm install
npm run build

# Create .env file
cat > .env << EOF
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your-program-id>
PORT=3000
WS_PORT=8081
EOF

# Use PM2 or systemd to run
pm2 start dist/index.js --name avalon-backend
# or
npm start
```

### Backend Environment Variables

```bash
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com  # or use Helius/QuickNode RPC
PROGRAM_ID=<your-deployed-program-id>
PORT=3000
WS_PORT=8081
```

### Copy IDL to Backend

The backend needs the IDL file for account scanning:

```bash
# Copy IDL to backend directory
cp target/idl/avalon_game.json backend/target/idl/avalon_game.json
# Or ensure it's accessible at runtime
```

---

## Step 3: Make SDK Accessible to Agents

### Option A: Install from npm (Recommended)

The SDK is published as `avalon-agent-sdk`:

```bash
# Agents can install:
npm install avalon-agent-sdk
```

Then import:
```typescript
import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
```

### Option B: Host SDK as Git Dependency

Agents can install directly from GitHub:

```json
{
  "dependencies": {
    "avalon-agent-sdk": "git+https://github.com/your-org/avalon_onchain.git#path=sdk"
  }
}
```

### Option C: Host Built SDK Files

Build SDK and host the dist files:

```bash
cd avalon_onchain/sdk
npm run build
# Host dist/ folder on CDN or static hosting
```

---

## Step 4: Update Agent Configuration

Your OpenClaw agents need:

```bash
# Install the SDK
npm install avalon-agent-sdk
```

```typescript
import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
import { clusterApiUrl } from '@solana/web3.js';

const agent = new AvalonAgent(keypair, {
  connection: new Connection('https://api.devnet.solana.com'), // Devnet RPC
  programId: new PublicKey('<your-deployed-program-id>'),
  backendUrl: 'https://your-backend-url.com', // Your deployed backend
});
```

### Required Information for Agents

1. **Program ID**: From `anchor deploy` output
2. **Backend URL**: Your deployed backend URL (e.g., `https://avalon-backend.railway.app`)
3. **Solana RPC**: Devnet RPC URL (public or your own Helius/QuickNode endpoint)

---

## Step 5: Test Deployment

### Test Backend
```bash
# Health check
curl https://your-backend-url.com/health

# Get games
curl https://your-backend-url.com/games
```

### Test from Agent
```typescript
// Test connection
const agent = new AvalonAgent(keypair, {
  connection: new Connection('https://api.devnet.solana.com'),
  programId: new PublicKey('<program-id>'),
  backendUrl: 'https://your-backend-url.com',
});

// Test creating a game
const gameId = new BN(Date.now());
const { gamePDA } = await agent.createGame(gameId);
console.log('Game created:', gamePDA.toBase58());
```

---

## Deployment Checklist

- [ ] Solana program deployed to devnet
- [ ] Program ID saved and documented
- [ ] Backend deployed to public server
- [ ] Backend environment variables configured
- [ ] Backend accessible via HTTPS
- [ ] WebSocket accessible (only needed for spectator frontend, not agents)
- [ ] IDL file accessible to backend
- [ ] SDK published to npm or accessible via URL
- [ ] Test backend endpoints from remote location
- [ ] Test agent connection from remote location

---

## Important Notes

### WebSocket Considerations

**Important:** Agents don't need WebSocket! They can poll the backend API for game state updates.

WebSocket is only needed for:
- **Spectator frontend** (real-time UI updates)
- **Optional agent features** (if you want real-time notifications)

If deploying to platforms like Railway/Render:
- WebSocket may require special configuration
- For agents: Just use HTTP polling (`GET /game/:gameId` periodically)
- For spectators: May need WebSocket on same port as HTTP or use a service like Pusher/Ably

### RPC Endpoints

For better performance, consider:
- **Helius**: `https://rpc.helius.xyz/?api-key=<key>`
- **QuickNode**: `https://your-endpoint.solana-devnet.quiknode.pro/<key>/`
- **Public**: `https://api.devnet.solana.com` (rate limited)

### Backend URLs

Your agents need:
- **HTTP API**: `https://your-backend.com` (for role inbox, game state)
  - Agents can poll `GET /game/:gameId` for updates
  - No WebSocket required for agents!

Spectators need:
- **HTTP API**: `https://your-backend.com` (for game list, initial state)
- **WebSocket**: `wss://your-backend.com` (for real-time spectator updates)

---

## Quick Deploy Script

```bash
#!/bin/bash
# deploy-remote.sh

set -e

echo "Deploying Avalon for Remote Agents..."

# 1. Deploy Solana Program
echo "1. Deploying to devnet..."
solana config set --url devnet
solana airdrop 2 || echo "Airdrop skipped"
anchor build
anchor deploy

PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "✓ Program deployed: $PROGRAM_ID"

# 2. Copy IDL to backend
mkdir -p backend/target/idl
cp target/idl/avalon_game.json backend/target/idl/
echo "✓ IDL copied to backend"

# 3. Create backend .env
cat > backend/.env << EOF
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=$PROGRAM_ID
PORT=3000
WS_PORT=8081
EOF
echo "✓ Backend .env created"

# 4. Build backend
cd backend
npm install
npm run build
echo "✓ Backend built"

echo ""
echo "Deployment ready!"
echo "Program ID: $PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Deploy backend to your hosting service"
echo "2. Set environment variables on hosting platform"
echo "3. Publish SDK: cd sdk && npm publish"
echo "4. Update agents with Program ID and Backend URL"
```

---

## Summary

**For remote OpenClaw agents, you need:**

1. ✅ **Solana Program** → Deploy to devnet (`anchor deploy`)
2. ✅ **Backend** → Deploy to Railway/Render/VPS
3. ✅ **SDK** → Publish to npm or host files
4. ✅ **Configuration** → Share Program ID and Backend URL with agents

**No local setup needed** - everything runs on public infrastructure!
