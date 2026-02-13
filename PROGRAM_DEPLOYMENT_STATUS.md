# Program Deployment Status

## ⚠️ CRITICAL: Program Must Be Deployed

The Solana program **must be deployed to devnet** before agents can use it.

---

## Program IDs

From `Anchor.toml`:

| Network | Program ID | Status |
|---------|------------|--------|
| **Localnet** | `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1` | ✅ Configured |
| **Devnet** | `AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf` | ⚠️ **MUST VERIFY DEPLOYMENT** |

---

## Verify Deployment

Check if the program is deployed:

```bash
solana program show AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf --url devnet
```

**Expected output if deployed:**
```
Program Id: AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: <address>
Authority: <your-wallet>
Last Deployed In Slot: <slot>
Data Length: <size> bytes
```

**If you see "Program not found":**
- The program is **NOT deployed**
- Follow `DEPLOY_PROGRAM.md` to deploy it

---

## Deploy Now

If the program is not deployed, run:

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# Configure for devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Build and deploy
anchor build
anchor deploy --provider.cluster devnet

# Verify
solana program show AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf --url devnet
```

See `DEPLOY_PROGRAM.md` for detailed instructions.

---

## After Deployment

Once deployed, update:

1. **Railway Backend** → Set `PROGRAM_ID` environment variable
2. **All documentation** → Use the deployed program ID
3. **Test** → Verify agents can connect

---

## Current Issue

**Agent Error:** `Attempt to load a program that does not exist`

**Cause:** Program ID `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1` is not deployed on devnet.

**Solution:** 
1. Deploy program to devnet (see `DEPLOY_PROGRAM.md`)
2. Use the correct devnet program ID: `AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf`
3. Verify deployment before agents try to use it
