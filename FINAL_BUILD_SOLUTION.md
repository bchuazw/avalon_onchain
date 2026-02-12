# Final Build Solution

## Root Cause
Solana's `cargo-build-sbf` (version 2.1.14) bundles Cargo 1.79.0, which cannot parse manifests requiring `edition2024`. The dependency `constant_time_eq v0.4.2` requires Rust 1.85+ (edition2024).

## Solution: Update Solana

The only reliable solution is to update Solana to a version that includes a newer Cargo (1.85+).

### Steps:

1. **Update Solana to latest version:**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   # Or if you have solana-install:
   solana-install init latest
   ```

2. **Verify the new Cargo version:**
   ```bash
   ~/.local/share/solana/install/active_release/bin/cargo-build-sbf --version
   # Should show rustc 1.85+ or newer
   ```

3. **Update Anchor to 0.32.1 (if not already):**
   ```bash
   avm install 0.32.1
   avm use 0.32.1
   ```

4. **Update project dependencies:**
   - Already done: `programs/avalon_game/Cargo.toml` uses Anchor 0.32.1
   - Already done: `Anchor.toml` specifies Anchor 0.32.1

5. **Build:**
   ```bash
   cd /Users/ryanongwx/Desktop/avalon/avalon_onchain
   rm -f Cargo.lock
   anchor build
   ```

## Alternative: Manual Cargo Override (Not Recommended)

If updating Solana isn't possible, you could try:
1. Setting `CARGO` environment variable to point to system Cargo
2. Modifying Anchor's build script (complex and fragile)

## Current Status
- ✅ Rust 1.93.0 installed (supports edition2024)
- ✅ Anchor 0.32.1 installed via avm
- ✅ Project dependencies updated to Anchor 0.32.1
- ❌ Solana 2.1.14 has Cargo 1.79.0 (too old)
- ⏳ Need to update Solana to latest version

## Next Steps
1. Update Solana: `solana-install init latest`
2. Verify Cargo version in cargo-build-sbf
3. Run `anchor build`
