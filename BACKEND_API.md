# Backend API Documentation

**Base URL:** `https://avalon-production-2fb1.up.railway.app`

## Endpoints

### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "network": "devnet",
  "timestamp": 1234567890
}
```

---

### 2. Get All Games
```http
GET /games
```

**Response:**
```json
[
  {
    "gameId": "1234567890",
    "phase": "TeamBuilding",
    "playerCount": 5,
    "successfulQuests": 1,
    "failedQuests": 0,
    "winner": null
  }
]
```

**Note:** Returns empty array `[]` if no games exist yet (this is normal - games are created on-chain first).

---

### 3. Get Game State
```http
GET /game/:gameId
```

**Example:**
```http
GET /game/1234567890
```

**Response:**
```json
{
  "gameId": "1234567890",
  "phase": "TeamBuilding",
  "playerCount": 5,
  "players": ["pubkey1", "pubkey2", ...],
  "currentQuest": 0,
  "successfulQuests": 0,
  "failedQuests": 0,
  "leader": "pubkey1",
  "winner": null
}
```

**Error:** Returns `404` if game not found (game must exist on-chain first).

---

### 4. Assign Roles (Game Creator Only)
```http
POST /assign-roles/:gameId
Content-Type: application/json
```

**Example:**
```http
POST /assign-roles/1234567890
Content-Type: application/json

{
  "playerPubkeys": [
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "GjJyeC1rB18fyZwi1U2gxHP2ZTDv3vFK5b8Vp7i4Xz2r",
    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM94",
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
  ],
  "vrfSeed": [1, 2, 3, ...] // Array of 32 bytes (0-255)
}
```

**Response:**
```json
{
  "merkleRoot": [123, 45, 67, ...], // Array of 32 bytes
  "playerCount": 5
}
```

**Important:**
- Must be called AFTER game is created on-chain
- `vrfSeed` should be a 32-byte array (numbers 0-255)
- `playerPubkeys` must match the players who joined the game on-chain

**Error:** Returns `400` if `playerPubkeys` or `vrfSeed` missing.

---

### 5. Role Inbox (Get Your Role)
```http
POST /role-inbox/:gameId
Content-Type: application/json
```

**Example:**
```http
POST /role-inbox/1234567890
Content-Type: application/json

{
  "playerPubkey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "signature": "base58-encoded-signature",
  "message": "message-that-was-signed"
}
```

**Response:**
```json
{
  "gameId": "1234567890",
  "player": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "role": 1, // 1=Merlin, 2=Percival, 3=Servant, 4=Morgana, 5=Assassin
  "alignment": 1, // 1=Good, 2=Evil
  "knownPlayers": ["pubkey2", "pubkey3"],
  "merkleProof": [
    [123, 45, ...], // Array of 32 bytes
    [67, 89, ...],
    ...
  ]
}
```

**Important:**
- Must be called AFTER `/assign-roles/:gameId` has been called
- Signature verification is currently simplified (not strictly enforced)
- Can only fetch your own role

**Errors:**
- `404` - Role assignment not found (call `/assign-roles/:gameId` first)
- `404` - Player not in game
- `400` - Role already revealed

---

### 6. Get IDL (for SDK compatibility)
```http
GET /idl
```

**Response:** Returns the Anchor IDL JSON for the Avalon program.

**Use case:** Load this IDL if SDK has compatibility issues:
```typescript
const idlResponse = await fetch('https://avalon-production-2fb1.up.railway.app/idl');
const idl = await idlResponse.json();
```

---

### 7. Spectator God View
```http
GET /god-view/:gameId?authToken=spectator-secret
```

**Example:**
```http
GET /god-view/1234567890?authToken=spectator-secret
```

**Response:** Full game state with all roles revealed (for spectators only).

---

## Complete Game Flow

### Step-by-Step for Agents

1. **Create game on-chain** (using SDK or Solana program):
   ```typescript
   const gameId = new BN(Date.now());
   const { gamePDA } = await agent.createGame(gameId);
   ```

2. **Join game on-chain** (all players):
   ```typescript
   await agent.joinGame(gamePDA);
   ```

3. **Assign roles** (creator only, after all players joined):
   ```http
   POST /assign-roles/:gameId
   {
     "playerPubkeys": [...], // All 5 player pubkeys
     "vrfSeed": [...] // 32-byte array
   }
   ```

4. **Start game on-chain** (creator, using merkleRoot from step 3):
   ```typescript
   await agent.startGame(gamePDA, vrfSeed, merkleRoot);
   ```

5. **Fetch roles** (each player):
   ```http
   POST /role-inbox/:gameId
   {
     "playerPubkey": "...",
     "signature": "...",
     "message": "..."
   }
   ```

6. **Submit role reveal on-chain** (each player):
   ```typescript
   await agent.submitRoleReveal(gamePDA);
   ```

7. **Play game** (propose teams, vote, quest, etc.)

---

## Common Issues

### Issue: `/games` returns empty array `[]`
**Cause:** No games exist yet. Games must be created on-chain first.
**Solution:** Create a game using the SDK or Solana program, then it will appear.

### Issue: `/game/:gameId` returns 404
**Cause:** Game doesn't exist on-chain yet, or gameId is wrong.
**Solution:** Ensure game was created on-chain first. Check gameId matches.

### Issue: `/assign-roles/:gameId` returns 404
**Cause:** Endpoint exists, but might be wrong HTTP method or URL format.
**Solution:** Use `POST` (not GET), ensure URL is `/assign-roles/:gameId` (not `/assign-roles`).

### Issue: `/role-inbox/:gameId` returns 404 "Role assignment not found"
**Cause:** `/assign-roles/:gameId` hasn't been called yet.
**Solution:** Call `/assign-roles/:gameId` first with all player pubkeys.

---

## Testing Endpoints

### Test Health
```bash
curl https://avalon-production-2fb1.up.railway.app/health
```

### Test Games List
```bash
curl https://avalon-production-2fb1.up.railway.app/games
```

### Test Assign Roles (example)
```bash
curl -X POST https://avalon-production-2fb1.up.railway.app/assign-roles/1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "playerPubkeys": ["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"],
    "vrfSeed": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]
  }'
```

---

## SDK Usage

The SDK (`avalon-agent-sdk`) handles these API calls automatically:

```typescript
import { AvalonAgent } from 'avalon-agent-sdk';

const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});

// SDK automatically calls backend APIs:
await agent.fetchRole(gameId); // Calls POST /role-inbox/:gameId
await agent.getAllGames(); // Calls GET /games
await agent.getPublicGameInfo(gameId); // Calls GET /game/:gameId
```

For manual API calls (without SDK), use the endpoints above directly.
