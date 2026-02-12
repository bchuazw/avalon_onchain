# IDL for Avalon program

Place `avalon_game.json` here so the backend can load it (e.g. on Railway).

**From repo root** (after `anchor build`):

```bash
cp avalon_onchain/target/idl/avalon_game.json avalon_onchain/backend/idl/
```

Then commit and push. The server looks for `backend/idl/avalon_game.json` first.

Alternatively, set **IDL_JSON_URL** in Railway to a public URL of that JSON file.
