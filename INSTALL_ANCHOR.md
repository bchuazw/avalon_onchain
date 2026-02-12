# Installing Anchor CLI v0.30.1

## Problem
Anchor v0.30.1 is incompatible with Rust 1.80+ due to a dependency issue with the `time` crate.

## Solution 1: Use Older Rust Version (Recommended)

Install Rust 1.79.0 (last version before 1.80):

```bash
# Install Rust 1.79.0
rustup install 1.79.0

# Set it as default for this project
rustup default 1.79.0

# Verify version
rustc --version  # Should show 1.79.0

# Now install Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

## Solution 2: Use Anchor Version Manager (avm)

avm handles version management and dependencies better:

```bash
# Install avm
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor 0.30.1 via avm
avm install 0.30.1

# Use it
avm use 0.30.1

# Verify
anchor --version
```

## Solution 3: Use Rust Toolchain Override (Project-specific)

If you want to keep newer Rust for other projects:

```bash
# Install Rust 1.79.0
rustup install 1.79.0

# Create rust-toolchain.toml in project root
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain
cat > rust-toolchain.toml << EOF
[toolchain]
channel = "1.79.0"
EOF

# Now install Anchor (it will use Rust 1.79.0)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

## Verify Installation

After installation, verify:

```bash
anchor --version
# Should output: anchor-cli 0.30.1
```

## Next Steps

Once Anchor is installed:

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain
anchor build
anchor test
```
