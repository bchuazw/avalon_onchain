# OpenClaw Agent Issues & Solutions

## Issue 1: "Invalid option winner" Error

**Problem:** Agents crash when parsing game state due to winner field format.

**Root Cause:** Anchor Option types are returned as `{ some: value }` or `null`, but code wasn't handling the `some` wrapper.

**Fix Applied:** Updated `backend/src/indexer.ts` to properly parse Anchor Option<Winner> format:
- Handle `{ some: Winner }` format
- Extract the actual Winner enum from the Option wrapper
- Then parse Winner enum as `{ good: {} }` or `{ evil: {} }`

**Status:** ✅ Fixed in backend code

---

## Issue 2: Players Stuck at 4/5

**Problem:** Backend shows 4 players but agents report all 5 are "already in game".

**Possible Causes:**
1. **Backend cache not synced** - Indexer scans every 10 seconds, might be stale
2. **Same wallets joining multiple games** - Agents might be reusing wallets that already joined
3. **On-chain vs backend mismatch** - On-chain has 5 players, backend cache shows 4

**Solutions:**

### Option A: Wait for Backend Sync
The indexer scans every 10 seconds. Wait 15-20 seconds and check again:
```bash
curl https://avalon-production-2fb1.up.railway.app/games
```

### Option B: Use Fresh Wallets
Create 5 completely new wallets that haven't joined any game:
```typescript
// Generate 5 fresh wallets
const wallets = Array.from({ length: 5 }, () => AvalonAgent.createWallet());
```

### Option C: Check On-Chain Directly
Query the program account directly to see actual on-chain state:
```typescript
const gameState = await agent.getGameState(gamePDA);
console.log('On-chain players:', gameState.players.length);
```

### Option D: Force Backend Rescan
The backend automatically rescans every 10 seconds. You can also trigger it by calling `/games` endpoint (it forces a rescan).

---

## Issue 3: Double Game Creation

**Problem:** Two games were created (1770987428689 and 1770987644951) with same wallets.

**Solution:** Use one game only. Pick game `1770987644951` (the newer one) and have all 5 agents join that one.

---

## Recommended Fix for Agents

### Updated Agent Flow:

1. **Create ONE game** (Agent 1)
2. **Wait for game to be indexed** (10-15 seconds)
3. **Join with 5 FRESH wallets** (Agents 1-5)
4. **Wait for all 5 to join** (check backend: `GET /games`)
5. **Assign roles** (Agent 1 calls `/assign-roles/:gameId`)
6. **Start game** (Agent 1 calls `startGame()`)
7. **Fetch roles** (All 5 agents)
8. **Play game**

### Key Changes:

```typescript
// 1. Use fresh wallets for each game
const wallets = Array.from({ length: 5 }, () => AvalonAgent.createWallet());

// 2. Wait for backend to sync after creating game
await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

// 3. Check backend before proceeding
const games = await agent.getAllGames();
const ourGame = games.find(g => g.gameId === gameId);
if (ourGame.playerCount < 5) {
  console.log(`Waiting for players... Current: ${ourGame.playerCount}/5`);
  // Poll until 5 players
}

// 4. Handle Option types correctly in SDK
// Winner field: account.winner might be { some: { good: {} } } or null
```

---

## Backend Fixes Applied

✅ Fixed winner Option parsing in `indexer.ts`
✅ Added better error handling
✅ Added debug logging

**Next:** Redeploy backend to Railway for fixes to take effect.

---

## Testing

After backend redeploy, test with:

```bash
# Check games
curl https://avalon-production-2fb1.up.railway.app/games

# Check specific game
curl https://avalon-production-2fb1.up.railway.app/game/1770987644951
```

The winner parsing fix should resolve the "Invalid option winner" error.
