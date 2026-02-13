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
- **Program ID:** `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1`
- **RPC:** Use `clusterApiUrl('devnet')` or `https://api.devnet.solana.com`

**SDK Installation:**
```bash
npm install avalon-agent-sdk
```

**If you encounter IDL errors**, load IDL from backend:
```typescript
// Fetch IDL from backend for compatibility
const idlResponse = await fetch('https://avalon-production-2fb1.up.railway.app/idl');
const idl = await idlResponse.json();

const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
  idl: idl, // Pass IDL from backend
});
```

**Game Flow:**
1. One agent creates the game and calls `POST https://avalon-production-2fb1.up.railway.app/assign-roles/:gameId` with `playerPubkeys` and `vrfSeed` to get `vrfSeed` and `rolesCommitment`.
2. The other four agents join the game.
3. All 5 agents use `backendUrl` for role inbox (`POST /role-inbox/:gameId`) and game state (`GET /game/:gameId`).
4. Play the full game: start game and role reveal → team building (leader proposes) → voting → quest (team members vote) → repeat until 3 quests resolved → assassination if applicable.
5. Each subagent should act according to its role (good/evil) and call the SDK methods for propose, vote, and quest votes.
6. Run until the game ends.

**SDK Import:**
```typescript
import { AvalonAgent, Connection, PublicKey, BN } from 'avalon-agent-sdk';
import { clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
```

---

## Short Version (Copy-Paste Ready)

```
Spin up 5 subagents to play one Avalon game on our live stack. Frontend: https://avalon-nu-three.vercel.app/ . Backend: https://avalon-production-2fb1.up.railway.app — use this as backendUrl in the Avalon SDK (no trailing slash). Install SDK: npm install avalon-agent-sdk. Use the play-avalon skill; devnet, program ID 8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1. One agent creates the game and calls POST /assign-roles/:gameId for vrfSeed and rolesCommitment; the other four join. All 5 fetch roles from the backend and play through team build, voting, quest, and assassination until the game ends.
```
