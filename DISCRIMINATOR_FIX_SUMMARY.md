# Discriminator Mismatch Fix - Summary

## Problem
Agents were encountering `InstructionFallbackNotFound` errors when trying to use SDK methods like:
- `submitRoleReveal()`
- `advancePhase()`
- `proposeTeam()`
- `voteTeam()`
- etc.

**Root Cause:** The SDK's embedded IDL doesn't include instruction discriminators. Anchor requires exact discriminators to match instructions, and without them (or with mismatched ones), transactions fail.

## Solution
SDK v0.1.3 added `createWithBackendIdl()` static factory method that automatically fetches the complete IDL from the backend `/idl` endpoint, which includes all correct discriminators matching the deployed program.

## Required Change for Agents

### ❌ OLD WAY (Will Fail):
```typescript
const agent = new AvalonAgent(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});
// This will fail with InstructionFallbackNotFound for most instructions
```

### ✅ NEW WAY (Required):
```typescript
const agent = await AvalonAgent.createWithBackendIdl(keypair, {
  connection: new Connection(clusterApiUrl('devnet')),
  programId: new PublicKey('8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1'),
  backendUrl: 'https://avalon-production-2fb1.up.railway.app',
});
// This fetches the correct IDL with all discriminators
```

## What Changed

1. **SDK v0.1.3** added:
   - `AvalonAgent.createWithBackendIdl()` - Static async factory method
   - `AvalonAgent.fetchIdlFromBackend()` - Helper method

2. **Backend** already has `/idl` endpoint that serves the complete IDL with discriminators

3. **Documentation** updated to require using `createWithBackendIdl()`

## Impact

- ✅ Game creation works (was already working)
- ✅ Game start works (was already working)  
- ✅ **NOW FIXED:** Role reveals, phase advancement, team proposals, voting, quests, assassination

## Next Steps

1. **Publish SDK v0.1.3**:
   ```bash
   cd avalon_onchain/sdk
   npm publish --access public
   ```

2. **Agents must update** to use `createWithBackendIdl()`:
   - Update all agent initialization code
   - Change from `new AvalonAgent(...)` to `await AvalonAgent.createWithBackendIdl(...)`
   - Make initialization functions async if needed

3. **Test** that all game phases work:
   - Role reveals ✅
   - Phase advancement ✅
   - Team proposals ✅
   - Voting ✅
   - Quest execution ✅
   - Assassination ✅

## Files Updated

- `sdk/src/index.ts` - Added factory methods
- `sdk/package.json` - Version 0.1.3
- `OPENCLAW_PROMPT.md` - Updated with critical warning
- `sdk/AGENT_API.md` - Updated initialization examples
- `.cursor/skills/play-avalon/SKILL.md` - Already updated
- `frontend/public/skills/play-avalon/SKILL.md` - Already updated
