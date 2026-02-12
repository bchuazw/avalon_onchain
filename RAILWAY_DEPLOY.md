# Railway Backend Deployment Settings

## If you see `Error: Cannot find module '/app/dist/index.js'`

**Fix:** Set Railway **Start Command** to **`npm run start:prod`**. That runs build then start so `dist/` exists when Node starts.

**When Root Directory is set to `/backend`** (your case):

Railway’s working directory is already the backend folder, so **do not** use `cd backend` in your commands. The problem is usually one of:

1. **Build command is wrong** – If you use `cd backend && npm run build`, that runs from the backend folder and tries to `cd backend` again (into a non‑existent `backend/backend`). The build may fail or run in the wrong place.
2. **Build never created `dist/`** – Check the **build logs** and confirm `tsc` runs and finishes without errors. You should see “Compiling…” or similar and no red errors.

**Correct settings when Root Directory = `backend` (or `/backend`):**

| Setting | Value |
|--------|--------|
| **Root Directory** | `backend` (or `/backend`) |
| **Build Command** | `npm install && npm run build` ← no `cd backend` |
| **Start Command** | **`npm run start:prod`** (builds then runs; fixes missing dist) |

**If Root Directory is the repo root** (not backend):

| Setting | Value |
|--------|--------|
| **Build Command** | `cd backend && npm install && npm run build` |
| **Start Command** | `cd backend && node dist/index.js` or `npm start` |

---

## Settings to Note

### 1. **Root directory / Service type**
- **Root Directory = `backend`**: Build and start run **inside** the backend folder. Use **Build:** `npm install && npm run build`, **Start:** `npm start`. Do **not** put `cd backend` in these commands.
- **Root Directory = repo root**: Use **Build:** `cd backend && npm install && npm run build`, **Start:** `cd backend && node dist/index.js`.

### 2. **Build & Start commands**

**When Root Directory is `backend`** (recommended):

| Setting | Value |
|--------|--------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` **or** `npm run build && node dist/index.js` |

Use **`npm run start:prod`** so the start phase builds and then runs. That way `dist/` is created at startup if the build phase didn’t persist it (fixes `Cannot find module '/app/dist/index.js'`).

**When Root Directory is repo root:**

| Setting | Value |
|--------|--------|
| **Build Command** | `cd backend && npm install && npm run build` |
| **Start Command** | `cd backend && node dist/index.js` or `npm start` |

### 3. **Environment variables (required)**

Set these in Railway → your service → **Variables**:

| Variable | Value | Notes |
|----------|--------|--------|
| `PORT` | *(do not set)* | Railway sets this automatically. Your app must use `process.env.PORT`. |
| `SOLANA_NETWORK` | `devnet` | Use `devnet` for public deployment. |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Or Helius/QuickNode URL for better rate limits. |
| `PROGRAM_ID` | Your deployed program ID | e.g. from `anchor deploy` on devnet. |

### 4. **Environment variables (optional)**

| Variable | Value | Notes |
|----------|--------|--------|
| `SPECTATOR_TOKEN` | e.g. `your-secret-token` | For `/god-view/:gameId?authToken=...`. Default: `spectator-secret`. |
| `WS_PORT` | *(see WebSocket note below)* | Separate WS port is **not** exposed on Railway. |

### 5. **WebSocket on Railway**

- Railway exposes **one port per service** (the one in `PORT`).
- The backend currently starts **HTTP on `PORT`** and **WebSocket on `WS_PORT` (8081)**.
- So **WebSocket on 8081 is not reachable** from the internet on Railway.

**Options:**

- **A) Spectators without real-time updates**  
  Leave as is. Frontend can poll `GET /game/:gameId` instead of WebSocket. No code change required for basic deploy.

- **B) Add HTTP + WebSocket on same port**  
  Change the server so the WebSocket server attaches to the same HTTP server (e.g. `path: '/ws'`). Then both HTTP and WS use `PORT`. This requires a small code change.

For now you can deploy with **Option A** and add Option B later if you want real-time spectator updates.

### 6. **IDL file (required for indexer)**

The backend expects the IDL at one of:

- `backend/target/idl/avalon_game.json`
- `target/idl/avalon_game.json` (if run from repo root)

**Option A – Copy at build time (recommended)**  
If build runs from repo root:

```bash
# In Build Command (before npm run build in backend):
cp target/idl/avalon_game.json backend/target/idl/avalon_game.json 2>/dev/null || true
cd backend && npm install && npm run build
```

Ensure `backend/target/idl/` exists and the IDL is committed or generated in `target/idl/` before deploy.

**Option B – Commit IDL under backend**  
Copy it once locally and commit:

```bash
mkdir -p backend/target/idl
cp target/idl/avalon_game.json backend/target/idl/
# Commit backend/target/idl/avalon_game.json
```

Then build can stay `cd backend && npm install && npm run build`.

### 7. **Health check**

- Railway can use the root path or a health endpoint.
- Your app has no `/` route; suggest adding a simple **health route** (e.g. `GET /health` returns 200) and set Railway’s health check to that URL (e.g. `https://your-app.railway.app/health`).

### 8. **Summary checklist**

- [ ] **Root / build / start**: Either project root = `backend` or build/start run from `backend`.
- [ ] **Build**: `npm install && npm run build` (inside `backend`).
- [ ] **Start**: `npm start` (inside `backend`).
- [ ] **PORT**: Not set in env (use Railway’s `PORT`).
- [ ] **SOLANA_NETWORK**: `devnet`.
- [ ] **SOLANA_RPC_URL**: `https://api.devnet.solana.com` or your RPC URL.
- [ ] **PROGRAM_ID**: Your devnet program ID.
- [ ] **IDL**: Available at runtime (e.g. `backend/target/idl/avalon_game.json` via copy or commit).
- [ ] **WebSocket**: Accept that WS on 8081 won’t be public, or plan to serve WS on `PORT` later.

### 9. **Quick variable list (copy-paste)**

```env
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your-devnet-program-id>
```

Do **not** set `PORT`; Railway sets it.

---

## After deploy

- Base URL: `https://<your-service>.up.railway.app` (or your custom domain).
- Test: `curl https://<your-service>.up.railway.app/health`
- Agents: set `backendUrl` to `https://<your-service>.up.railway.app`.
