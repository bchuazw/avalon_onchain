#!/bin/bash
set -e

echo "🔧 Fixing deployment issue..."

# Step 1: Recover the buffer account keypair
echo "📝 Recovering buffer account..."
echo "pudding satisfy shift cram fly junior obscure noise anchor symptom safe coach" | solana-keygen recover 'prompt://?full-path=/tmp/buffer-keypair.json' --outfile /tmp/buffer-keypair.json <<EOF
pudding satisfy shift cram fly junior obscure noise anchor symptom safe coach
EOF

# Get buffer account address
BUFFER_ADDRESS=$(solana address -k /tmp/buffer-keypair.json 2>/dev/null || echo "31VG18y3hhhjzqUyL5JfP7GxSEoWtrhVJ5GLeAgqeB9A")
echo "Buffer account: $BUFFER_ADDRESS"

# Step 2: Try to close the buffer account (may fail if already closed, that's ok)
echo "🗑️  Closing buffer account to recover lamports..."
solana program close $BUFFER_ADDRESS --url devnet 2>/dev/null || echo "Account may already be closed or doesn't exist"

# Step 3: Get more SOL
echo "💰 Requesting devnet SOL..."
solana airdrop 2 --url devnet || echo "Airdrop 1 may have failed"
sleep 2
solana airdrop 2 --url devnet || echo "Airdrop 2 may have failed"
sleep 2
solana airdrop 2 --url devnet || echo "Airdrop 3 may have failed"

# Check balance
echo ""
echo "💵 Current balance:"
solana balance --url devnet

# Step 4: Retry deployment
echo ""
echo "🚀 Retrying deployment..."
anchor deploy --provider.cluster devnet

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo ""
echo "✅ Deployment complete!"
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Verify: solana program show $PROGRAM_ID --url devnet"
echo "2. Update Anchor.toml with: avalon_game = \"$PROGRAM_ID\""
echo "3. Update Railway PROGRAM_ID env var"
echo "4. Update docs with new program ID"
