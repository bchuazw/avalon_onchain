# Fixing Solana SDK Installation

## Problem
```
ERROR cargo_build_sbf] Solana SDK path does not exist: /usr/local/bin/sdk/sbf
```

The Solana SDK is not installed, which is required for building Anchor programs.

## Solution

Run these commands in your terminal (outside Cursor's sandbox):

### 1. Install/Update Solana SDK

```bash
# Install Solana SDK version 1.18.17 (matches your Solana CLI)
solana-install init 1.18.17
```

This will:
- Download the Solana SDK
- Set up the SDK path
- Configure your environment

### 2. Verify SDK Installation

After installation, verify:

```bash
# Check SDK path
echo $SBF_OUT_DIR
# Should show something like: /Users/ryanongwx/.local/share/solana/install/active_release/sdk/sbf

# Or check if SDK exists
ls -la ~/.local/share/solana/install/active_release/sdk/sbf
```

### 3. Set Environment Variable (if needed)

If the SDK path isn't automatically set, add to your `~/.zshrc`:

```bash
# Add to ~/.zshrc
export SBF_OUT_DIR="$HOME/.local/share/solana/install/active_release/sdk/sbf"

# Reload shell
source ~/.zshrc
```

### 4. Try Building Again

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain
anchor build
```

## Alternative: Reinstall Solana

If the above doesn't work, reinstall Solana completely:

```bash
# Remove old installation
rm -rf ~/.local/share/solana

# Reinstall Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"

# Add to PATH (if not already there)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Initialize SDK
solana-install init 1.18.17
```

## Verify Everything Works

```bash
# Check Solana version
solana --version

# Check SDK path
echo $SBF_OUT_DIR

# Try building
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain
anchor build
```
