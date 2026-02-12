# Fixing edition2024 Compatibility Issue

## Problem
The `time-core v0.1.8` dependency requires Rust `edition2024`, which requires Rust 1.84.0+.

## Solution: Use Rust 1.84.0+

I've updated `rust-toolchain.toml` to use Rust 1.84.0. Run these commands:

```bash
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# Install Rust 1.84.0
rustup install 1.84.0

# Try building
anchor build
```

## If Anchor 0.30.1 Doesn't Work with Rust 1.84.0

If you get compatibility errors with Anchor 0.30.1 and Rust 1.84.0, you have two options:

### Option 1: Pin Older time-core Version (Complex)

Add to `programs/avalon_game/Cargo.toml`:

```toml
[dependencies]
# ... existing dependencies ...

[patch.crates-io]
time-core = "0.1.7"  # Older version that doesn't require edition2024
```

Then rebuild:
```bash
cargo update -p time-core
anchor build
```

### Option 2: Update Anchor to 0.31+ (Recommended if Option 1 fails)

If pinning doesn't work, update Anchor:

1. Update `Anchor.toml`:
   ```toml
   [toolchain]
   anchor_version = "0.31.0"
   ```

2. Update `programs/avalon_game/Cargo.toml`:
   ```toml
   [dependencies]
   anchor-lang = { version = "0.31.0", features = ["init-if-needed"] }
   anchor-spl = "0.31.0"
   ```

3. Update `package.json`:
   ```json
   "@coral-xyz/anchor": "^0.31.0"
   ```

4. Rebuild:
   ```bash
   anchor build
   ```

**Note:** Updating Anchor may require code changes for breaking changes between 0.30.1 and 0.31.0.

## Current Status

- ✅ Updated `rust-toolchain.toml` to Rust 1.84.0
- ⏳ Need to install Rust 1.84.0 and try building

## Next Steps

1. Install Rust 1.84.0: `rustup install 1.84.0`
2. Try building: `anchor build`
3. If it fails with Anchor compatibility issues, try Option 1 or 2 above
