# Simple Deployment Solution

## The Problem

The buffer account `31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A` keeps getting reused but doesn't have enough SOL. You have ~3 SOL but need ~2.18 SOL in the buffer account.

## Solution: Fund the Buffer Account Directly

### Step 1: Recover Buffer Account Keypair

```bash
# Create the buffer keypair from seed phrase
solana-keygen recover 'prompt://?full-path=/tmp/buffer-keypair.json'
# When prompted, enter: bless shock hurt neck lock echo home embrace butter useless atom vapor
```

### Step 2: Transfer SOL to Buffer Account

```bash
# Transfer 2.5 SOL to the buffer account
solana transfer 31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A 2.5 --url devnet --allow-unfunded-recipient
```

### Step 3: Deploy Using Buffer Account

```bash
# Deploy using the funded buffer account
solana program deploy \
  target/deploy/avalon_game.so \
  --program-id target/deploy/avalon_game-keypair.json \
  --url devnet \
  --keypair ~/.config/solana/id.json \
  --buffer /tmp/buffer-keypair.json
```

---

## OR: Wait for Airdrop Rate Limit

If you don't have enough SOL, wait 5-10 minutes for the airdrop rate limit to reset, then:

```bash
# Get more SOL
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Then try deploying again
solana program deploy \
  target/deploy/avalon_game.so \
  --program-id target/deploy/avalon_game-keypair.json \
  --url devnet \
  --keypair ~/.config/solana/id.json
```

---

## Quick Script

Use the automated script:

```bash
chmod +x FUND_BUFFER_AND_DEPLOY.sh
./FUND_BUFFER_AND_DEPLOY.sh
```

This will:
1. Recover the buffer keypair
2. Transfer SOL to it
3. Deploy using the buffer account

---

## Why This Works

The buffer account `31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A` was created in a previous deployment attempt but never got funded. By funding it directly and using it with `--buffer`, we can complete the deployment.
