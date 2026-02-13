#!/bin/bash
set -e

echo "🚀 Deploying Avalon program directly (bypassing Anchor buffer accounts)..."

# Configure devnet
solana config set --url devnet

# Check balance
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "💰 Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 3" | bc -l) )); then
  echo "⚠️  Low balance. Requesting more SOL..."
  solana airdrop 2 --url devnet || true
  sleep 2
  solana airdrop 2 --url devnet || true
fi

# Deploy directly using solana CLI (avoids Anchor buffer account issues)
echo "📦 Deploying program..."
solana program deploy \
  target/deploy/avalon_game.so \
  --program-id target/deploy/avalon_game-keypair.json \
  --url devnet \
  --keypair ~/.config/solana/id.json

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo ""
echo "✅ Deployment complete!"
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "Verify deployment:"
echo "solana program show $PROGRAM_ID --url devnet"
