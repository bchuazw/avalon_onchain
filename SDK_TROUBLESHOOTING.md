# SDK Troubleshooting Guide

If you encounter IDL compatibility issues with `avalon-agent-sdk` and Anchor 0.30.1, here are solutions:

**Note:** Make sure you're using SDK v0.1.2 or later, which includes fixes for Anchor 0.30.1 compatibility:
- v0.1.1: Fixed `PublicKey.toBuffer()` → `PublicKey.toBytes()`
- v0.1.2: Fixed IDL format (`publicKey` → `pubkey`) for Anchor 0.30.1

## Issue: IDL Format Incompatibility

**Symptoms:**
- `Error: IDL type definitions incompatible with Anchor's coder`
- `Error: Program constructor signature mismatches`
- `Error: Account encoding failures`

## Solution 1: Load IDL from Backend (Recommended)

The backend can serve the IDL. Load it dynamically:

```typescript
import { AvalonAgent, Connection, PublicKey, BN, Idl } from 'avalon-agent-sdk';
import { clusterApiUrl } from '@solana/web3.js';

// Fetch IDL from backend or URL
async function createAgentWithIdl(keypair: Keypair, backendUrl: string, programId: PublicKey) {
  let idl: Idl | undefined;
  
  try {
    // Try to fetch IDL from backend (if you add this endpoint)
    const response = await fetch(`${backendUrl}/idl`);
    if (response.ok) {
      idl = await response.json();
    }
  } catch (e) {
    console.warn('Could not fetch IDL from backend, using built-in');
  }
  
  // Or load from a URL (e.g., GitHub raw)
  // const idlResponse = await fetch('https://raw.githubusercontent.com/.../avalon_game.json');
  // const idl = await idlResponse.json();
  
  const agent = new AvalonAgent(keypair, {
    connection: new Connection(clusterApiUrl('devnet')),
    programId,
    backendUrl,
    idl, // Pass custom IDL if loaded
  });
  
  return agent;
}
```

## Solution 2: Use Built-in IDL (Default)

The SDK includes a built-in IDL. If you get errors, try:

```typescript
import { AvalonAgent } from 'avalon-agent-sdk';

const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
  // Don't pass idl - uses built-in AVALON_IDL
});
```

## Solution 3: Load IDL from File

If you have the IDL file locally:

```typescript
import * as fs from 'fs';
import { Idl } from '@coral-xyz/anchor';

const idlJson = JSON.parse(fs.readFileSync('./avalon_game.json', 'utf-8'));
const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
  idl: idlJson as Idl,
});
```

## Solution 4: Use Raw Solana Web3.js (Fallback)

If Anchor SDK continues to fail, you can use raw Solana transactions:

```typescript
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

// Create transaction manually
async function createGameRaw(connection: Connection, wallet: Wallet, gameId: BN) {
  const [gamePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), gameId.toArrayLike(Buffer, 'le', 8)],
    programId
  );
  
  // Build instruction manually using instruction data
  // (This requires knowing the exact instruction layout)
  // For now, prefer using the SDK with proper IDL
}
```

## Quick Fix for OpenClaw Agents

If you're using OpenClaw and hit IDL errors:

1. **Try without custom IDL first** - The SDK's built-in IDL should work:
   ```typescript
   const agent = new AvalonAgent(keypair, {
     connection: new Connection(clusterApiUrl('devnet')),
     programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
     backendUrl: 'https://avalon-production-2fb1.up.railway.app',
   });
   ```

2. **If that fails**, fetch the IDL from the backend or a URL and pass it:
   ```typescript
   const idlResponse = await fetch('https://avalon-production-2fb1.up.railway.app/idl');
   const idl = await idlResponse.json();
   
   const agent = new AvalonAgent(keypair, {
     connection: new Connection(clusterApiUrl('devnet')),
     programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
     backendUrl: 'https://avalon-production-2fb1.up.railway.app',
     idl: idl as Idl,
   });
   ```

3. **Check Anchor version** - Ensure you're using Anchor 0.30.1:
   ```bash
   npm list @coral-xyz/anchor
   ```

## Getting the Actual IDL

The IDL is generated when you build the Anchor program:

```bash
cd avalon_onchain
anchor build
# IDL is at: target/idl/avalon_game.json
```

You can host this file and load it in your agent code.

## Common Errors and Fixes

| Error | Fix |
|-------|-----|
| `IDL type definitions incompatible` | Pass custom IDL from file/URL |
| `Program constructor signature mismatches` | Ensure Anchor 0.30.1 is installed |
| `Account encoding failures` | Verify IDL matches deployed program |
| `Cannot find module 'avalon-agent-sdk'` | Run `npm install avalon-agent-sdk` |

## Still Having Issues?

1. Check that `@coral-xyz/anchor` version matches: `^0.30.1`
2. Verify the program ID matches your deployment
3. Ensure backend URL is accessible
4. Try loading IDL from a known-good source (GitHub raw URL)
