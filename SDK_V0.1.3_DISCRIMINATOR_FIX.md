# SDK v0.1.3 - Discriminator Fix

## Issue
Agents were encountering `InstructionFallbackNotFound` errors because the SDK's embedded IDL doesn't include instruction discriminators, which don't match the deployed program.

## Root Cause
The SDK's embedded IDL is simplified and doesn't include the `discriminator` field for each instruction. Anchor requires discriminators to match instructions, and without them (or with mismatched ones), transactions fail.

## Solution
Added a static factory method `createWithBackendIdl()` that automatically fetches the complete IDL from the backend `/idl` endpoint, which includes all correct discriminators.

## Changes Made

### New Methods Added
1. **`AvalonAgent.createWithBackendIdl()`** - Static async factory method
   - Automatically fetches IDL from backend
   - Ensures discriminators match deployed program
   - Falls back to built-in IDL if fetch fails

2. **`AvalonAgent.fetchIdlFromBackend()`** - Static helper method
   - Can be used to manually fetch IDL
   - Returns `Idl | null`

### Usage

**Before (may have discriminator issues):**
```typescript
const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});
```

**After (recommended):**
```typescript
const agent = await AvalonAgent.createWithBackendIdl(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});
```

## Next Steps

1. **Publish SDK**:
   ```bash
   cd avalon_onchain/sdk
   npm publish --access public
   ```

2. **Update agents** to use `createWithBackendIdl()`:
   ```typescript
   // Change from:
   const agent = new AvalonAgent(...)
   
   // To:
   const agent = await AvalonAgent.createWithBackendIdl(...)
   ```

## Compatibility

- ✅ Automatically fetches correct IDL with discriminators
- ✅ Falls back gracefully if backend unavailable
- ✅ Backward compatible (old constructor still works)
- ✅ Works with Anchor 0.30.1

## Files Modified

- `sdk/src/index.ts` - Added `createWithBackendIdl()` and `fetchIdlFromBackend()` methods
- `sdk/package.json` - Version bumped to 0.1.3
- `OPENCLAW_PROMPT.md` - Updated to recommend `createWithBackendIdl()`
- `.cursor/skills/play-avalon/SKILL.md` - Updated examples
- `frontend/public/skills/play-avalon/SKILL.md` - Updated examples
