# Frontend Not Showing Games - Fix

## Issue
Backend returns games correctly (verified with curl), but frontend shows "NO ACTIVE GAMES".

## Root Cause
The frontend code has been updated to:
1. Filter out games with `gameId === "unknown"` 
2. Better error logging
3. Remove mock data fallback (so errors are visible)

## Next Steps

### 1. Redeploy Frontend
The frontend code has been updated. Redeploy to Vercel:

```bash
cd frontend
git add .
git commit -m "Fix game list display - filter invalid games"
git push
```

Or if using Vercel CLI:
```bash
vercel --prod
```

### 2. Check Browser Console
After redeploy, open browser DevTools (F12) → Console and look for:
- `[GameList] Fetching games from...`
- `[GameList] Response status: 200`
- `[GameList] Received X games:`
- `[GameList] Valid games after filtering: X`

### 3. Test Direct API Call in Browser
Open browser console and run:
```javascript
fetch('https://avalon-production-2fb1.up.railway.app/games')
  .then(r => r.json())
  .then(data => {
    console.log('Raw games:', data);
    const valid = data.filter(g => g.gameId && g.gameId !== 'unknown');
    console.log('Valid games:', valid);
  })
```

### 4. Check CORS
If you see CORS errors in console, the backend CORS config might need the frontend domain explicitly:

```typescript
// In backend/src/server.ts
app.use(cors({
  origin: ['https://avalon-nu-three.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

## Current Backend Response
The backend correctly returns:
```json
[
  {"gameId":"unknown", ...},  // This will be filtered out
  {"gameId":"1770987428689", "phase":"Lobby", "playerCount":4, ...},
  {"gameId":"1770987644951", "phase":"Lobby", "playerCount":4, ...}
]
```

After filtering, frontend should show 2 games.

## If Still Not Working

1. **Check Network Tab**: DevTools → Network → Look for `/games` request
   - Status should be 200
   - Response should contain games array

2. **Check Backend URL**: Verify `VITE_BACKEND_URL` in Vercel env vars is set correctly

3. **Hard Refresh**: Clear cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

4. **Check Backend Logs**: Look for `[API] GET /games` logs to confirm requests are reaching backend
