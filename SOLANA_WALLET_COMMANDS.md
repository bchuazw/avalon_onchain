# Solana Wallet Commands

## Check Wallet Balance

### Check Current Wallet Balance
```bash
solana balance
```

This shows the balance of your **default wallet** (configured in `~/.config/solana/id.json`).

### Check Balance on Specific Network
```bash
# Devnet
solana balance --url devnet

# Mainnet
solana balance --url mainnet-beta

# Localnet
solana balance --url localhost
```

### Check Balance of Specific Wallet
```bash
# By keypair file
solana balance ~/.config/solana/id.json

# By public key
solana balance <PUBLIC_KEY_ADDRESS>

# Example
solana balance 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### Check Balance with URL
```bash
solana balance <PUBLIC_KEY> --url devnet
```

---

## Get Devnet SOL (Airdrop)

If you need devnet SOL for testing:

```bash
# Request 2 SOL (may need to run multiple times)
solana airdrop 2 --url devnet

# Request more (max 2 SOL per request)
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
```

**Note:** Devnet airdrops are rate-limited. You may need to wait between requests.

---

## Check Current Wallet Address

```bash
# Show current wallet address
solana address

# Show address of specific keypair
solana address -k ~/.config/solana/id.json
```

---

## Switch Wallets

```bash
# Set default wallet
solana config set --keypair ~/.config/solana/id.json

# Or set to a different keypair
solana config set --keypair /path/to/your/keypair.json

# List available keypairs
ls ~/.config/solana/*.json
```

---

## Import a Wallet

### Import from Private Key (Base58)
```bash
# Import from base58 private key string
echo "YOUR_BASE58_PRIVATE_KEY" | solana-keygen recover 'prompt://?full-path=~/.config/solana/imported-wallet.json'
```

### Import from Seed Phrase (Mnemonic)
```bash
# Import from 12-word seed phrase
solana-keygen recover 'prompt://?full-path=~/.config/solana/imported-wallet.json'
# Then enter your seed phrase when prompted
```

### Import from JSON Keypair File
```bash
# If you have a keypair JSON file, just copy it
cp /path/to/your/keypair.json ~/.config/solana/imported-wallet.json

# Then set it as default
solana config set --keypair ~/.config/solana/imported-wallet.json
```

### Import from Phantom/Solflare (Export Private Key)
1. Export private key from Phantom/Solflare wallet
2. Save it as a JSON file or use base58 format
3. Import using one of the methods above

### Create New Wallet and Import
```bash
# Generate new keypair
solana-keygen new -o ~/.config/solana/new-wallet.json

# Set as default
solana config set --keypair ~/.config/solana/new-wallet.json

# Check address
solana address
```

## View Wallet Configuration

```bash
# Show current Solana config
solana config get
```

This shows:
- RPC URL (devnet/mainnet/localhost)
- Keypair path
- Commitment level

---

## Quick Examples

### Check Devnet Balance
```bash
solana config set --url devnet
solana balance
```

### Check Mainnet Balance
```bash
solana config set --url mainnet-beta
solana balance
```

### Check Specific Address on Devnet
```bash
solana balance AWemmHXA1oSqw94LNWXfN6NayNzCz4qiL1c9b6UYgDcf --url devnet
```

---

## For Your Avalon Deployment

To check if you have enough SOL to deploy:

```bash
# Check devnet balance
solana balance --url devnet

# If low, get more
solana airdrop 2 --url devnet

# You need ~2-3 SOL to deploy a program
```

---

## Troubleshooting

### "Insufficient funds"
- Request airdrop: `solana airdrop 2 --url devnet`
- May need multiple requests (rate limited)

### "Wallet not found"
- Check wallet path: `solana address`
- Verify keypair exists: `ls ~/.config/solana/id.json`

### "Connection refused"
- Check network: `solana config get`
- Ensure correct URL: `solana config set --url devnet`
