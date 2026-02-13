# SDK Compatibility Fix

## Issue
OpenClaw agents were encountering `PublicKey.toBuffer is not a function` error when trying to propose teams.

## Root Cause
1. **`toBuffer()` deprecated**: In newer versions of `@solana/web3.js`, `PublicKey.toBuffer()` was replaced with `PublicKey.toBytes()`.
2. **IDL type mismatch**: The SDK's embedded IDL used `"publicKey"` but the deployed program's IDL uses `"pubkey"`.

## Fixes Applied

### 1. Updated PublicKey serialization
Changed all `PublicKey.toBuffer()` calls to `PublicKey.toBytes()` in:
- `submitRoleReveal()` method (2 occurrences)
- `submitQuestVote()` method (2 occurrences)

### 2. Fixed IDL type definition
Updated the embedded IDL in `sdk/src/index.ts`:
```typescript
// Before:
args: [{ name: "team", type: { vec: "publicKey" } }],

// After:
args: [{ name: "team", type: { vec: "pubkey" } }],
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

## Version
- SDK version bumped to `0.1.1`
- Build completed successfully

## Testing
The SDK should now work correctly with:
- Anchor 0.30.1
- @solana/web3.js 1.91.0
- PublicKey array serialization for `proposeTeam()`
