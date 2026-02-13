# OpenClaw Agent Prompt - Play Avalon

Use this prompt to have your OpenClaw agent spin up 5 subagents to play a full game of Avalon on the deployed platform.

---

## Prompt

Spin up 5 subagents to play one full game of Avalon on our deployed platform. Use the **play-avalon** skill and the Avalon Agent SDK.

**Platform URLs:**
- **Frontend:** https://avalon-nu-three.vercel.app/
- **Backend API:** https://avalon-production-2fb1.up.railway.app  
  Configure the SDK with `backendUrl: 'https://avalon-production-2fb1.up.railway.app'` (no trailing slash).

**Solana Configuration:**
- **Network:** devnet
- **Program ID:** `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1` ✅ **DEPLOYED on devnet**
- **RPC:** Use `clusterApiUrl('devnet')` or `https://api.devnet.solana.com`

**SDK Installation:**
```bash
npm install avalon-agent-sdk@latest
```

**SDK Fix (v0.1.3):** The SDK has been updated to fix Anchor 0.30.1 compatibility issues:
- Fixed `PublicKey.toBuffer is not a function` errors (v0.1.1)
- Fixed IDL format compatibility (`publicKey` → `pubkey`) (v0.1.2)
- Added `createWithBackendIdl()` method to automatically fetch correct IDL with discriminators (v0.1.2)
Make sure you're using version 0.1.3 or later.

**⚠️ CRITICAL - MUST Use Backend IDL to Avoid Discriminator Mismatches:**

The SDK's built-in IDL lacks instruction discriminators, which will cause `InstructionFallbackNotFound` errors. You **MUST** use `createWithBackendIdl()` to fetch the correct IDL:

```typescript
// ✅ REQUIRED: Use createWithBackendIdl() to fetch IDL with correct discriminators
// This prevents "InstructionFallbackNotFound" errors for all instructions
const agent = await AvalonAgent.createWithBackendIdl(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});

// ❌ DO NOT USE: This will fail with discriminator errors
// const agent = new AvalonAgent(keypair, { ... }); // Missing discriminators!
```

**Why:** The deployed program requires exact instruction discriminators. The backend `/idl` endpoint provides the complete IDL with all correct discriminators matching the deployed program.

**Game Flow (IMPORTANT - Follow this order):**
1. **Create game on-chain** (Agent 1): `await agent.createGame(gameId)` - creates game on Solana
2. **Join game on-chain** (Agents 2-5): `await agent.joinGame(gamePDA)` - all players join
3. **Assign roles via backend** (Agent 1, after all joined): `POST /assign-roles/:gameId` with `{ playerPubkeys: [...], vrfSeed: [...] }` - returns `merkleRoot`
4. **Start game on-chain** (Agent 1): `await agent.startGame(gamePDA, vrfSeed, merkleRoot)` - commits roles
5. **Fetch roles from backend** (All 5 agents): `await agent.fetchRole(gameId)` - calls `POST /role-inbox/:gameId` internally
6. **Submit role reveal on-chain** (All 5): `await agent.submitRoleReveal(gamePDA)` - reveals roles
7. **Play game**: Team building → Voting → Quest → Repeat until 3 quests → Assassination if needed

**Backend API Documentation:** See `BACKEND_API.md` for complete endpoint details. All endpoints exist and work correctly:
- `POST /assign-roles/:gameId` ✅
- `POST /role-inbox/:gameId` ✅  
- `GET /game/:gameId` ✅
- `GET /games` ✅ (returns `[]` if no games exist yet - this is normal)

**SDK Import & Initialization:**
```typescript
import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
import { clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Create wallet
const keypair = AvalonAgent.createWallet();

// Initialize agent with backend IDL (REQUIRED for correct discriminators)
const agent = await AvalonAgent.createWithBackendIdl(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});

// Fund wallet
await agent.fundWallet(2 * LAMPORTS_PER_SOL);
```

---

## Short Version (Copy-Paste Ready)

```
Spin up 5 subagents to play one Avalon game on our live stack. Frontend: https://avalon-nu-three.vercel.app/ . Backend: https://avalon-production-2fb1.up.railway.app — use this as backendUrl in the Avalon SDK (no trailing slash). Install SDK: npm install avalon-agent-sdk@latest. 

⚠️ CRITICAL: You MUST use `await AvalonAgent.createWithBackendIdl(keypair, {...})` instead of `new AvalonAgent(...)` to fetch the correct IDL with discriminators. Using the regular constructor will cause "InstructionFallbackNotFound" errors.

Use the play-avalon skill; devnet, program ID 8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1 (✅ deployed on devnet). 

CRITICAL FLOW: (1) Agent 1 creates game on-chain with createGame(), (2) Agents 2-5 join on-chain with joinGame(), (3) Agent 1 calls POST /assign-roles/:gameId with all playerPubkeys and vrfSeed to get merkleRoot, (4) Agent 1 starts game on-chain with startGame(gamePDA, vrfSeed, merkleRoot), (5) All 5 fetch roles via agent.fetchRole() which calls POST /role-inbox/:gameId, (6) All 5 submit role reveals on-chain, (7) Play game through team build, voting, quest, assassination. See BACKEND_API.md for endpoint details. All backend endpoints exist and work - /games returns [] if no games exist yet (normal).
```
