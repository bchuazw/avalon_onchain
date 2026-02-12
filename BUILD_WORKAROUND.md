# Build Workaround for IDL Generation Issue

## Current Status

✅ **Program compiles successfully!**
- The Rust program builds: `Finished release profile [optimized] target(s)`
- Binary is available at: `target/deploy/avalon_game.so`

⚠️ **IDL generation fails** due to Anchor 0.30.1's `source_file()` issue
- Error: `no method named 'source_file' found for struct 'proc_macro2::Span'`
- This is a known incompatibility between Anchor 0.30.1 and newer Rust versions

✅ **Existing IDL file found**
- Location: `target/idl/avalon_game.json`
- This IDL was generated previously and can be used

## Workaround: Use Existing IDL

Since the program compiles and there's an existing IDL file:

1. **The program is ready to deploy** - the `.so` file is built
2. **Use the existing IDL** - `target/idl/avalon_game.json` is available
3. **Skip IDL regeneration** - it's not needed if the IDL hasn't changed

## To Deploy Without Regenerating IDL

If you need to deploy without regenerating the IDL:

```bash
# Navigate to the project root (not backend/)
cd /Users/ryanongwx/Desktop/avalon/avalon_onchain

# The program is already built
ls target/deploy/avalon_game.so
# Output: target/deploy/avalon_game.so (305K, built Feb 13 00:38)

# Use the existing IDL
cp target/idl/avalon_game.json target/idl/avalon_game.json.backup

# Deploy (if IDL is needed, it will use the existing one)
anchor deploy
```

**Note:** The binary is in `/Users/ryanongwx/Desktop/avalon/avalon_onchain/target/deploy/`, not in the `backend/` directory.

## Permanent Fix

When network connectivity allows:

1. **Update Solana** to latest version (includes newer Cargo)
2. **Upgrade to Anchor 0.32.1** (fixes `source_file()` issue):
   ```bash
   avm use 0.32.1
   # Update Anchor.toml and Cargo.toml to 0.32.1
   ```
3. **Rebuild**:
   ```bash
   rm Cargo.lock
   anchor build
   ```

## Summary

- ✅ **Program builds successfully**
- ✅ **IDL file exists** (from previous build)
- ⚠️ **IDL regeneration fails** (but not needed if IDL hasn't changed)
- 🔧 **Fix**: Update Solana + Anchor 0.32.1 when network allows

The project is **functional** - you can deploy and use it with the existing IDL!
