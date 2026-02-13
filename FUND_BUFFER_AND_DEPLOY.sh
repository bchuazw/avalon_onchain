#!/bin/bash
set -e

echo "🔧 Funding buffer account and deploying..."

# The buffer account that needs funding
BUFFER_ADDRESS="31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A"

# Recover the buffer keypair from the latest seed phrase
echo "📝 Recovering buffer account keypair..."
echo "bless shock hurt neck lock echo home embrace butter useless atom vapor" | solana-keygen recover 'prompt://?full-path=/tmp/buffer-keypair.json' <<EOF
bless shock hurt neck lock echo home embrace butter useless atom vapor
EOF

# Check current balance
MY_BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "💰 Your balance: $MY_BALANCE SOL"

# Calculate how much to transfer (need 2.18 SOL + small buffer)
TRANSFER_AMOUNT=2.5

if (( $(echo "$MY_BALANCE < $TRANSFER_AMOUNT + 0.5" | bc -l) )); then
  echo "⚠️  Not enough SOL. Need at least $((TRANSFER_AMOUNT + 1)) SOL total."
  echo "💡 Try waiting a few minutes for airdrop rate limit to reset, then:"
  echo "   solana airdrop 2 --url devnet"
  exit 1
fi

# Transfer SOL to buffer account
echo "💸 Transferring $TRANSFER_AMOUNT SOL to buffer account..."
solana transfer $BUFFER_ADDRESS $TRANSFER_AMOUNT --url devnet --allow-unfunded-recipient

# Wait for confirmation
sleep 3

# Check buffer account balance
echo "✅ Checking buffer account balance..."
solana balance $BUFFER_ADDRESS --url devnet

# Now deploy using the buffer account
echo "🚀 Deploying program using buffer account..."
solana program deploy \
  target/deploy/avalon_game.so \
  --program-id target/deploy/avalon_game-keypair.json \
  --url devnet \
  --keypair ~/.config/solana/id.json \
  --buffer /tmp/buffer-keypair.json

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo ""
echo "✅ Deployment complete!"
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "Verify: solana program show $PROGRAM_ID --url devnet"
