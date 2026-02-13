# Deploy Avalon Program to Devnet

## Critical: Program Must Be Deployed

The program ID `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1` is **NOT deployed on devnet**. You need to deploy it first.

---

## Quick Deploy Steps

### 1. Prerequisites

```bash
# Ensure Solana CLI is installed
solana --version  # Should be v1.18.17+

# Ensure Anchor CLI is installed
anchor --version  # Should be v0.30.1

# Configure for devnet
solana config set --url devnet
```

### 2. Get Devnet SOL

```bash
# Request airdrop (may need to run multiple times)
solana airdrop 2

# Check balance
solana balance
```

You need at least **2-3 SOL** on devnet to deploy (programs cost ~1.5-2 SOL).

### 3. Build the Program

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# Build
anchor build
```

This will:
- Compile the Rust program
- Generate the IDL at `target/idl/avalon_game.json`
- Create the program keypair at `target/deploy/avalon_game-keypair.json`

### 4. Deploy to Devnet

```bash
# Deploy (this will use the program ID from Anchor.toml)
anchor deploy --provider.cluster devnet

# OR if that doesn't work:
solana program deploy target/deploy/avalon_game.so --program-id target/deploy/avalon_game-keypair.json
```

### 5. Verify Deployment

```bash
# Get the deployed program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Verify it's deployed
solana program show $PROGRAM_ID
```

You should see:
```
Program Id: <your-program-id>
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: <data-address>
Authority: <your-wallet-address>
Last Deployed In Slot: <slot-number>
Data Length: <size> bytes
```

### 6. Update Anchor.toml

After deployment, update `Anchor.toml` with the actual deployed program ID:

```toml
[programs.devnet]
avalon_game = "<your-actual-program-id>"
```

### 7. Update All Documentation

After deployment, update these files with the new program ID:

1. **`OPENCLAW_PROMPT.md`** - Update program ID
2. **`BACKEND_API.md`** - Update program ID in examples
3. **Skill files** - Update program ID in examples
4. **Backend environment** - Set `PROGRAM_ID` env var on Railway

---

## Current Program IDs

From `Anchor.toml`:
- **Localnet:** `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1`
- **Devnet (expected):** `AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf`

**However**, the actual deployed program ID may differ. Check after deployment.

---

## Troubleshooting

### Issue: "Insufficient funds" or "Account has insufficient funds for spend"

**Solution:**

This usually happens when an intermediate buffer account needs funding. Try:

1. **Get more SOL:**
```bash
# Request more airdrop (may need multiple requests)
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Check balance
solana balance --url devnet
```

2. **Close the failed intermediate account** (if deployment partially started):
```bash
# Recover the intermediate account from seed phrase
solana-keygen recover 'prompt://?full-path=/tmp/buffer-keypair.json'
# Enter the seed phrase shown in the error

# Close the account to recover lamports
solana program close <BUFFER_ACCOUNT_ADDRESS> --url devnet

# Then try deploying again
anchor deploy --provider.cluster devnet
```

3. **Or just get more SOL and retry:**
```bash
# Get more SOL
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Retry deployment
anchor deploy --provider.cluster devnet
```

**Note:** You need at least **3-4 SOL** total for deployment (program cost ~2.17 SOL + fees).

### Issue: "Program already exists"

**Solution:** The program ID is already taken. You have two options:

1. **Use existing deployment** - If you already deployed before, use that program ID
2. **Deploy with new keypair** - Generate a new keypair:
   ```bash
   anchor keys list
   # Or manually generate:
   solana-keygen new -o target/deploy/avalon_game-keypair.json
   ```

### Issue: "Program ID mismatch"

**Solution:** Ensure `Anchor.toml` matches the keypair:
```bash
# Check what program ID the keypair has
solana address -k target/deploy/avalon_game-keypair.json

# Update Anchor.toml to match
```

### Issue: Deployment succeeds but program not found

**Solution:** Wait a few seconds for devnet to propagate, then verify:
```bash
solana program show <program-id> --url devnet
```

---

## After Deployment

Once deployed, update:

1. **Railway Backend Environment Variable:**
   ```
   PROGRAM_ID=<your-deployed-program-id>
   ```

2. **All Documentation:**
   - Replace `8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1` with your actual devnet program ID
   - Or keep it if that's the ID you deployed

3. **Test the Deployment:**
   ```bash
   # Test from command line
   solana program show <program-id> --url devnet
   
   # Or test with SDK
   node -e "
   const { Connection, PublicKey } = require('@solana/web3.js');
   const conn = new Connection('https://api.devnet.solana.com');
   conn.getAccountInfo(new PublicKey('<program-id>')).then(info => {
     console.log('Program exists:', !!info);
   });
   "
   ```

---

## Quick Deploy Script

Save this as `deploy-devnet.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Avalon to Devnet..."

# Configure devnet
solana config set --url devnet

# Get SOL
echo "💰 Requesting devnet SOL..."
solana airdrop 2 || echo "Airdrop may have failed, continuing..."

# Build
echo "🔨 Building program..."
anchor build

# Deploy
echo "📦 Deploying program..."
anchor deploy --provider.cluster devnet

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo ""
echo "✅ Deployment complete!"
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Update Anchor.toml with: avalon_game = \"$PROGRAM_ID\""
echo "2. Update Railway PROGRAM_ID env var: $PROGRAM_ID"
echo "3. Update all docs with new program ID"
```

Run:
```bash
chmod +x deploy-devnet.sh
./deploy-devnet.sh
```

---

## Verify Program is Deployed

Before agents can use it, verify:

```bash
# Replace with your actual program ID
PROGRAM_ID="8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1"

# Check if program exists
solana program show $PROGRAM_ID --url devnet
```

If you get "Program not found", the program is not deployed and you need to deploy it first.
