# Fix Deployment "Insufficient Funds" Error

## Your Error

```
Error: Account 31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A has insufficient funds for spend (2.17400472 SOL) + fee (0.001565 SOL)
```

## Quick Fix

You have 5 SOL in your main wallet, but the intermediate buffer account needs funding. Here's how to fix it:

### Option 1: Get More SOL and Retry (Easiest)

```bash
# Request more devnet SOL (may need multiple requests)
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Check balance
solana balance --url devnet

# Retry deployment
anchor deploy --provider.cluster devnet
```

**Why:** The deployment process creates intermediate accounts that need to be funded. Having more SOL ensures all accounts have enough.

---

### Option 2: Close Failed Buffer Account and Retry

If the deployment partially started, close the intermediate account first:

```bash
# Step 1: Recover the intermediate account keypair
solana-keygen recover 'prompt://?full-path=/tmp/buffer-keypair.json'
# When prompted, enter the seed phrase from the error:
# "mind sausage foster food neutral anxiety number loop actress senior increase fatal"

# Step 2: Get the account address
solana address -k /tmp/buffer-keypair.json

# Step 3: Close the account to recover lamports
solana program close <BUFFER_ACCOUNT_ADDRESS> --url devnet
# Replace <BUFFER_ACCOUNT_ADDRESS> with the address from step 2

# Step 4: Get more SOL
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Step 5: Retry deployment
anchor deploy --provider.cluster devnet
```

---

### Option 3: Use solana program deploy directly (BEST OPTION)

**This bypasses Anchor's buffer account issues!** Deploy directly:

```bash
# Deploy directly with solana CLI (avoids buffer account problems)
solana program deploy \
  target/deploy/avalon_game.so \
  --program-id target/deploy/avalon_game-keypair.json \
  --url devnet \
  --keypair ~/.config/solana/id.json

# Get the program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Verify
solana program show $PROGRAM_ID --url devnet
```

**OR use the script:**
```bash
chmod +x DEPLOY_DIRECT.sh
./DEPLOY_DIRECT.sh
```

This method avoids the intermediate buffer account issue entirely!

---

## Recommended Solution

**Close the failed buffer account, get more SOL, and retry:**

```bash
# Step 1: Close the failed buffer account
solana program close 31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A --url devnet

# Step 2: Get more devnet SOL (you need ~7-8 SOL total for buffer accounts)
solana airdrop 2 --url devnet
sleep 2
solana airdrop 2 --url devnet
sleep 2
solana airdrop 2 --url devnet

# Step 3: Verify balance
solana balance --url devnet

# Step 4: Retry deployment
anchor deploy --provider.cluster devnet
```

**OR use the automated script:**
```bash
chmod +x DEPLOY_NOW.sh
./DEPLOY_NOW.sh
```

The deployment needs about **2.17 SOL** for the program + fees, but intermediate buffer accounts also need funding. Having **7-8 SOL total** ensures all accounts are funded.

---

## After Successful Deployment

Once deployment succeeds:

1. **Save the program ID:**
```bash
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo "Program ID: $PROGRAM_ID"
```

2. **Verify deployment:**
```bash
solana program show $PROGRAM_ID --url devnet
```

3. **Update Anchor.toml** (if program ID changed):
```bash
# Edit Anchor.toml and update the devnet program ID
```

4. **Update Railway backend** with the new `PROGRAM_ID` environment variable

5. **Update all docs** with the new program ID

---

## Why This Happens

During deployment, Solana creates intermediate "buffer" accounts to upload the program. These accounts need to be funded with SOL. If the deployment fails partway through, these accounts may be left with insufficient funds.

The easiest fix is to just get more SOL and retry - Solana will handle cleaning up old accounts automatically.
