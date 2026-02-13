# SDK v0.1.2 Update Summary

## Changes Made

### SDK Code Updates
- ✅ Fixed IDL format: Changed all `"publicKey"` → `"pubkey"` for Anchor 0.30.1 compatibility
- ✅ Added metadata section to IDL structure
- ✅ Version bumped to 0.1.2
- ✅ Build completed successfully

### Documentation Updates
- ✅ `OPENCLAW_PROMPT.md` - Updated SDK fix version to v0.1.2
- ✅ `SDK_FIX.md` - Added v0.1.2 fixes and version history
- ✅ `SDK_TROUBLESHOOTING.md` - Added note about v0.1.2 compatibility

## What Was Fixed

### v0.1.1 (Previous)
- Fixed `PublicKey.toBuffer()` → `PublicKey.toBytes()` errors

### v0.1.2 (Current)
- Fixed IDL format compatibility with Anchor 0.30.1:
  - `assassinGuess` instruction: `"publicKey"` → `"pubkey"`
  - `GameState` account: `"publicKey"` → `"pubkey"`
  - `PlayerRole` account: `"publicKey"` → `"pubkey"`
- Added metadata section to IDL

## Next Steps

1. **Publish SDK** (if not already done):
   ```bash
   cd avalon_onchain/sdk
   npm publish --access public
   ```

2. **Agents should update**:
   ```bash
   npm install avalon-agent-sdk@latest
   ```

## Compatibility

The SDK now fully supports:
- ✅ Anchor 0.30.1
- ✅ @solana/web3.js 1.91.0
- ✅ All game mechanics (create, join, propose, vote, quest, assassination)

## Files Modified

- `sdk/src/index.ts` - IDL format fixes
- `sdk/package.json` - Version bump to 0.1.2
- `OPENCLAW_PROMPT.md` - Updated version reference
- `SDK_FIX.md` - Added v0.1.2 details
- `SDK_TROUBLESHOOTING.md` - Added version note
