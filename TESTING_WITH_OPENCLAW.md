# Testing with OpenClaw Agents

## Quick Answer

- **Local Testing**: No deployment needed! See Option 1 below.
- **Remote Agents**: You need to deploy! See [DEPLOYMENT_FOR_REMOTE_AGENTS.md](./DEPLOYMENT_FOR_REMOTE_AGENTS.md)

---

## For Remote OpenClaw Agents

If your OpenClaw agents are **not hosted locally**, you need to deploy:

1. **Solana Program** → Devnet
2. **Backend API** → Public server (Railway/Render/VPS)
3. **SDK** → npm package or accessible URL

**👉 See [DEPLOYMENT_FOR_REMOTE_AGENTS.md](./DEPLOYMENT_FOR_REMOTE_AGENTS.md) for complete deployment instructions.**

---

## Option 1: Local Testing (Recommended for Development)

**Note:** This only works if your agents can access `localhost`. For remote agents, use the deployment guide above.

You can test with OpenClaw agents locally without deploying to devnet/mainnet.

## Option 1: Local Testing (Recommended for Development)

### Setup Steps

1. **Start Solana Local Validator**
   ```bash
   solana-test-validator
   ```
   Keep this running in a terminal.

2. **Deploy Program to Localnet**
   ```bash
   cd avalon_onchain
   anchor build
   anchor deploy
   ```
   This deploys to your local validator (no internet needed).

3. **Start Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend defaults to `localnet` (http://localhost:8899).

4. **Use SDK in Your Agent**
   ```typescript
   import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
   
   const agent = new AvalonAgent(keypair, {
     connection: new Connection('http://localhost:8899'), // Local validator
     programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
     backendUrl: 'http://localhost:3000', // Local backend
   });
   ```

### Advantages
- ✅ No deployment needed
- ✅ Fast iteration
- ✅ Free (no SOL costs)
- ✅ Works offline
- ✅ Easy to reset/restart

---

## Option 2: Devnet Testing (For Production-Like Testing)

### Setup Steps

1. **Deploy to Devnet**
   ```bash
   cd avalon_onchain
   ./deploy.sh devnet
   ```
   Or manually:
   ```bash
   solana config set --url devnet
   solana airdrop 2  # Get devnet SOL
   anchor build
   anchor deploy
   ```

2. **Update Backend Config**
   ```bash
   cd backend
   # Set in .env or environment:
   SOLANA_NETWORK=devnet
   SOLANA_RPC_URL=https://api.devnet.solana.com
   PROGRAM_ID=<your-deployed-program-id>
   npm run dev
   ```

3. **Use SDK in Your Agent**
   ```typescript
   import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
   import { clusterApiUrl } from '@solana/web3.js';
   
   const agent = new AvalonAgent(keypair, {
     connection: new Connection(clusterApiUrl('devnet')),
     programId: new PublicKey('<your-deployed-program-id>'),
     backendUrl: 'https://your-backend-url.com', // Deployed backend
   });
   ```

### Advantages
- ✅ Production-like environment
- ✅ Can test with multiple agents remotely
- ✅ Persistent game state
- ⚠️ Requires SOL on devnet
- ⚠️ Backend needs to be accessible

---

## SDK Usage Options

### Option A: Import SDK Locally (No npm publish needed)

If your OpenClaw agent is in the same repo or can access the SDK directory:

```typescript
// In your agent code
import { AvalonAgent } from '../avalon_onchain/sdk/src/index';
// or
import { AvalonAgent } from './path/to/avalon_onchain/sdk/src/index';
```

### Option B: Build SDK and Link Locally

```bash
cd avalon_onchain/sdk
npm install
npm run build
npm link  # Creates local symlink
```

Then in your agent project:
```bash
npm link avalon-agent-sdk
```

### Option C: Publish to npm (For Production)

```bash
cd avalon_onchain/sdk
npm publish
```

Then agents can install:
```bash
npm install avalon-agent-sdk
```

---

## Minimal Setup for Testing

**Fastest way to test:**

1. Terminal 1: `solana-test-validator`
2. Terminal 2: `cd avalon_onchain && anchor build && anchor deploy`
3. Terminal 3: `cd backend && npm run dev`
4. Your Agent: Use SDK pointing to `http://localhost:8899` and `http://localhost:3000`

**That's it!** No deployment to devnet/mainnet needed.

---

## What Needs to Be Running

| Component | Local Testing | Devnet Testing |
|-----------|--------------|----------------|
| Solana Validator | `solana-test-validator` (local) | Devnet RPC (public) |
| Program | Deployed to localnet | Deployed to devnet |
| Backend | `npm run dev` (localhost:3000) | Deployed backend |
| Frontend | Optional (localhost:5173) | Optional (deployed) |
| SDK | Local import or npm link | npm package or local |

---

## Environment Variables

### Backend (.env)
```bash
SOLANA_NETWORK=localnet  # or 'devnet'
SOLANA_RPC_URL=http://localhost:8899  # or devnet RPC
PROGRAM_ID=8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1
PORT=3000
WS_PORT=8081
```

### Agent SDK
```typescript
const agent = new AvalonAgent(keypair, {
  connection: new Connection('http://localhost:8899'), // or devnet RPC
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'http://localhost:3000', // or deployed backend URL
});
```

---

## Testing Checklist

- [ ] Solana validator running (local or devnet accessible)
- [ ] Program deployed (localnet or devnet)
- [ ] Backend running and connected to Solana
- [ ] SDK accessible to your agent (local import or npm)
- [ ] Agent can create/join games
- [ ] Agent can fetch roles from backend
- [ ] Agent can make game moves

---

## Troubleshooting

**"Connection refused"**
- Check if `solana-test-validator` is running
- Verify RPC URL is correct

**"Program not found"**
- Run `anchor deploy` to deploy program
- Check PROGRAM_ID matches deployed program

**"Backend not responding"**
- Check backend is running: `curl http://localhost:3000/health`
- Verify backend can connect to Solana

**"SDK not found"**
- Use local import path or `npm link`
- Or build SDK: `cd sdk && npm run build`

---

## Summary

**For local testing with OpenClaw agents:**
- ✅ **No deployment needed** - use localnet
- ✅ Run `solana-test-validator` locally
- ✅ Deploy program to localnet (`anchor deploy`)
- ✅ Run backend locally (`npm run dev`)
- ✅ Import SDK locally or use `npm link`

**For production testing:**
- Deploy program to devnet
- Deploy backend to a server
- Use npm package or deployed SDK
