# Vercel Frontend Deployment Guide

## Quick Deploy Settings

### 1. **Root Directory**
Set to: `frontend`

### 2. **Build Command**
```
npm install && npm run build
```

### 3. **Output Directory**
```
dist
```

### 4. **Install Command** (optional, defaults to `npm install`)
```
npm install
```

### 5. **Framework Preset**
Select: **Vite** (or leave as "Other" - Vercel auto-detects Vite)

---

## Environment Variables

Add these in **Vercel Dashboard → Your Project → Settings → Environment Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_BACKEND_URL` | `https://avalon-production-2fb1.up.railway.app` | Your Railway backend URL (no trailing slash) |

**Important:** 
- Vite requires the `VITE_` prefix for environment variables to be exposed to the client
- After adding env vars, **redeploy** for changes to take effect

---

## Step-by-Step Deployment

### Option A: Deploy via Vercel Dashboard

1. **Go to** [vercel.com](https://vercel.com) and sign in
2. **Click** "Add New Project"
3. **Import** your GitHub repository (or connect Git provider)
4. **Configure Project:**
   - **Root Directory:** Click "Edit" → Set to `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
   - **Install Command:** `npm install` (default)
5. **Add Environment Variable:**
   - Click "Environment Variables"
   - Add: `VITE_BACKEND_URL` = `https://avalon-production-2fb1.up.railway.app`
6. **Click** "Deploy"

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Login and deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No (first time) or Yes (updates)
# - Project name: avalon-frontend (or your choice)
# - Directory: ./ (current directory)
# - Override settings? No

# Set environment variable
vercel env add VITE_BACKEND_URL
# Enter: https://avalon-production-2fb1.up.railway.app
# Select: Production, Preview, Development (all)

# Redeploy with env var
vercel --prod
```

---

## Vercel Configuration File (Optional)

Create `frontend/vercel.json` for advanced settings:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures:
- Single Page App (SPA) routing works correctly
- All routes redirect to `index.html` for client-side routing

---

## Verify Deployment

After deployment:

1. **Check build logs** - Should see:
   ```
   ✓ built in Xs
   dist/index.html
   ```

2. **Test the app:**
   - Visit your Vercel URL (e.g., `https://avalon-nu-three.vercel.app`)
   - Open browser console (F12)
   - Check that `VITE_BACKEND_URL` is set correctly
   - Test API calls to backend

3. **Check environment variables:**
   - In browser console: `console.log(import.meta.env.VITE_BACKEND_URL)`
   - Should show: `https://avalon-production-2fb1.up.railway.app`

---

## Troubleshooting

### Issue: Environment variable not working

**Solution:**
- Ensure variable name starts with `VITE_`
- Redeploy after adding env vars
- Check Vercel dashboard → Settings → Environment Variables

### Issue: 404 on page refresh (SPA routing)

**Solution:**
- Add `vercel.json` with rewrites (see above)
- Or ensure Vercel detects it as a SPA

### Issue: Build fails

**Check:**
- Root directory is set to `frontend`
- Node version (Vercel auto-detects, or set in `package.json` engines)
- Build logs for specific errors

### Issue: Backend CORS errors

**Solution:**
- Ensure backend has CORS enabled for your Vercel domain
- Check backend `cors` configuration allows your Vercel URL

---

## Current Deployment

**Frontend URL:** https://avalon-nu-three.vercel.app/  
**Backend URL:** https://avalon-production-2fb1.up.railway.app

**Environment Variable:**
- `VITE_BACKEND_URL` = `https://avalon-production-2fb1.up.railway.app`

---

## Quick Reference

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Framework** | Vite |
| **Env Var** | `VITE_BACKEND_URL=https://avalon-production-2fb1.up.railway.app` |

---

## Next Steps After Deploy

1. ✅ Set `VITE_BACKEND_URL` environment variable
2. ✅ Deploy to Vercel
3. ✅ Test frontend → backend connection
4. ✅ Update any hardcoded backend URLs in code (if any)
5. ✅ Configure custom domain (optional)
