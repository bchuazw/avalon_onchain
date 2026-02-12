#!/bin/bash

# Avalon Solana Deployment Script
# This script helps deploy the program and set up the environment

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     AVALON SOLANA - DEPLOYMENT SCRIPT                  ║"
echo "╚════════════════════════════════════════════════════════╝"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}Solana CLI not found. Installing...${NC}"
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}Anchor CLI not found. Please install Anchor first:${NC}"
    echo "npm install -g @coral-xyz/anchor-cli"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"

# Get network from args or default to devnet
NETWORK=${1:-devnet}
echo -e "\n${YELLOW}Deploying to: $NETWORK${NC}"

# Configure Solana CLI
solana config set --url $NETWORK

# Get wallet address
WALLET=$(solana address)
echo -e "${GREEN}✓ Wallet: $WALLET${NC}"

# Check balance
echo -e "\n${YELLOW}Checking balance...${NC}"
BALANCE=$(solana balance | cut -d' ' -f1)

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo -e "${RED}Low balance ($BALANCE SOL). Requesting airdrop...${NC}"
    solana airdrop 5
fi

echo -e "${GREEN}✓ Balance: $BALANCE SOL${NC}"

# Build program
echo -e "\n${YELLOW}Building program...${NC}"
anchor build

echo -e "${GREEN}✓ Build complete${NC}"

# Deploy program
echo -e "\n${YELLOW}Deploying program...${NC}"
anchor deploy

echo -e "${GREEN}✓ Deployment complete${NC}"

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/avalon_game-keypair.json)
echo -e "${GREEN}✓ Program ID: $PROGRAM_ID${NC}"

# Update Anchor.toml
echo -e "\n${YELLOW}Updating configuration files...${NC}"
sed -i.bak "s/AvalonGame111111111111111111111111111111111/$PROGRAM_ID/g" Anchor.toml

# Update .env
cp .env.example .env
sed -i.bak "s/AvalonGame111111111111111111111111111111111/$PROGRAM_ID/g" .env

echo -e "${GREEN}✓ Configuration updated${NC}"

# Run tests
echo -e "\n${YELLOW}Running tests...${NC}"
anchor test --skip-local-validator

echo -e "${GREEN}✓ Tests complete${NC}"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     DEPLOYMENT COMPLETE                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Network: $NETWORK"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && yarn dev"
echo "2. Run E2E tests: cd tests/e2e && yarn test"
echo ""
