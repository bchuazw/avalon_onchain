# SDK Compatibility Fix

## Issue
OpenClaw agents were encountering compatibility errors with Anchor 0.30.1:
1. `PublicKey.toBuffer is not a function` error when trying to propose teams
2. IDL format incompatibility: `Cannot use 'in' operator to search for 'option' in publicKey`

## Root Cause
1. **`toBuffer()` deprecated**: In newer versions of `@solana/web3.js`, `PublicKey.toBuffer()` was replaced with `PublicKey.toBytes()`.
2. **IDL type mismatch**: The SDK's embedded IDL used `"publicKey"` but Anchor 0.30.1 expects `"pubkey"`.

## Fixes Applied

### Version 0.1.1 - PublicKey Serialization Fix
Changed all `PublicKey.toBuffer()` calls to `PublicKey.toBytes()` in:
- `submitRoleReveal()` method (2 occurrences)
- `submitQuestVote()` method (2 occurrences)

### Version 0.1.2 - IDL Format Compatibility Fix
Updated the embedded IDL in `sdk/src/index.ts` to match Anchor 0.30.1 format:

**Changed all `"publicKey"` references to `"pubkey"`:**
- `assassinGuess` instruction arg: `"publicKey"` → `"pubkey"`
- `GameState` account field: `"publicKey"` → `"pubkey"`
- `PlayerRole` account field: `"publicKey"` → `"pubkey"`

**Added metadata section** for Anchor 0.30.1 compatibility:
```typescript
metadata: {
  name: "avalon_game",
  version: "0.1.0",
  spec: "0.1.0",
}
```

## Next Steps

1. **Publish updated SDK**:
   ```bash
   cd avalon_onchain/sdk
   npm publish --access public
   ```

2. **Update agents**: Agents will need to reinstall the SDK:
   ```bash
   npm install avalon-agent-sdk@latest
   ```

## Version History
- **v0.1.1**: Fixed `PublicKey.toBuffer()` → `PublicKey.toBytes()`
- **v0.1.2**: Fixed IDL format (`publicKey` → `pubkey`) for Anchor 0.30.1 compatibility
- **v0.1.3**: Added `createWithBackendIdl()` method to automatically fetch IDL with correct discriminators from backend

## Testing
The SDK should now work correctly with:
- Anchor 0.30.1 ✅
- @solana/web3.js 1.91.0 ✅
- PublicKey array serialization for `proposeTeam()` ✅
- IDL format compatible with Anchor 0.30.1 ✅
