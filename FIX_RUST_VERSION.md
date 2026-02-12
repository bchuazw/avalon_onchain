# Fixing Rust Version Compatibility Issue

## Problem
```
error: feature `edition2024` is required
The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.79.0)
```

Rust 1.79.0 doesn't support `edition2024` which is required by newer crate versions.

## Solution 1: Use Rust 1.81.0 (Recommended)

I've updated `rust-toolchain.toml` to use Rust 1.81.0. Try building again:

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# Install Rust 1.81.0
rustup install 1.81.0

# Try building
anchor build
```

Rust 1.81.0 should:
- Support `edition2024` feature
- Still work with Anchor 0.30.1 (the original issue was specific to Rust 1.80.0)

## Solution 2: If Rust 1.81 Still Has Issues

If you still get compatibility issues, try Rust 1.82.0:

```bash
# Update rust-toolchain.toml to use 1.82.0
# Then:
rustup install 1.82.0
anchor build
```

## Solution 3: Use Cargo.lock to Pin Versions

If newer Rust versions cause Anchor 0.30.1 issues, you can try pinning dependency versions:

```bash
# Delete Cargo.lock to regenerate with compatible versions
rm Cargo.lock

# Build with Rust 1.79.0 but pin older dependency versions
# This might require manually editing Cargo.toml dependencies
```

## Solution 4: Update Anchor (If Project Allows)

If the project can be updated to Anchor 0.31+, it should work better with newer Rust:

```bash
# Update Anchor.toml
anchor_version = "0.31.0"

# Update Cargo.toml dependencies
anchor-lang = "0.31.0"
anchor-spl = "0.31.0"

# Then rebuild
anchor build
```

**Note:** This requires updating code for any breaking changes between Anchor 0.30.1 and 0.31.0.

## Current Status

- ✅ Updated `rust-toolchain.toml` to Rust 1.81.0
- ⏳ Need to install Rust 1.81.0 and try building

## Next Steps

1. Install Rust 1.81.0: `rustup install 1.81.0`
2. Try building: `anchor build`
3. If it works, run tests: `anchor test`
