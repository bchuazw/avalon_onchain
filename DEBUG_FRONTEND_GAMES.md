# Debug: Frontend Not Showing Games

## Issue
Backend logs show games are being indexed, but frontend shows no games.

## Debugging Steps

### 1. Check Backend Logs
Look for:
```
[API] GET /games - Returning X games
[API] Game IDs: ...
```

### 2. Check Frontend Console
Open browser DevTools (F12) → Console tab, look for:
```
[GameList] Fetching games from https://avalon-production-2fb1.up.railway.app/games
[GameList] Response status: 200
[GameList] Received X games: [...]
```

### 3. Test Backend API Directly

```bash
# Test the endpoint
curl https://avalon-production-2fb1.up.railway.app/games

# Should return JSON array of games
```

### 4. Check CORS
If you see CORS errors in browser console, the backend CORS config might need updating.

### 5. Check Backend URL
Verify frontend is using correct backend URL:
- Check browser console for `BACKEND_URL` value
- Should be: `https://avalon-production-2fb1.up.railway.app`

### 6. Check Network Tab
In browser DevTools → Network tab:
- Look for request to `/games`
- Check response status and body
- Verify response is JSON array

## Common Issues

### Issue: Backend returns empty array `[]`
**Cause:** Games exist on-chain but indexer hasn't scanned them yet  
**Solution:** Wait a few seconds, indexer scans every 10 seconds. Or manually trigger scan.

### Issue: CORS error
**Cause:** Backend CORS not allowing frontend domain  
**Solution:** Check backend CORS config allows `https://avalon-nu-three.vercel.app`

### Issue: Wrong backend URL
**Cause:** Frontend using wrong URL or localhost  
**Solution:** Check `VITE_BACKEND_URL` env var in Vercel, or check code default

### Issue: Response format mismatch
**Cause:** Frontend expects different fields than backend returns  
**Solution:** Check browser console logs to see actual response format

## Quick Test

Open browser console and run:
```javascript
fetch('https://avalon-production-2fb1.up.railway.app/games')
  .then(r => r.json())
  .then(data => console.log('Games:', data))
  .catch(e => console.error('Error:', e))
```

This will show you exactly what the backend is returning.
