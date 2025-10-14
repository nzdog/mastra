# Deployment Guide

This app uses a split deployment architecture:

- **Frontend (Netlify)**: Static HTML served from CDN
- **Backend (Railway)**: Node.js API server with Claude integration

## Prerequisites

- GitHub repository (push your code)
- Railway account (https://railway.app)
- Netlify account (https://netlify.com)
- Anthropic API key

## Step 1: Deploy Backend to Railway

1. **Push code to GitHub** (if not already done):

   ```bash
   git push origin main
   ```

2. **Create Railway project**:
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository
   - Railway will auto-detect Node.js and use `npm run server`

3. **Set environment variables in Railway**:
   - Go to your project → Variables tab
   - Add:
     - `ANTHROPIC_API_KEY`: Your Claude API key
     - `FRONTEND_URL`: `https://your-app-name.netlify.app` (you'll get this in Step 2)
     - `PORT`: Railway auto-sets this, don't override

4. **Get your Railway URL**:
   - Go to Settings → Generate Domain
   - Copy the URL (e.g. `https://your-app.railway.app`)

## Step 2: Update Frontend with Backend URL

1. **Edit index.html**:
   - Replace `RAILWAY_BACKEND_URL_PLACEHOLDER` with your Railway URL
   - Example: `'https://your-app.railway.app'`

2. **Commit the change**:
   ```bash
   git add index.html
   git commit -m "Update backend URL for production"
   git push origin main
   ```

## Step 3: Deploy Frontend to Netlify

1. **Create Netlify site**:
   - Go to https://netlify.com
   - Click "Add new site" → "Import an existing project"
   - Select GitHub and your repository
   - Build settings (auto-detected from netlify.toml):
     - Build command: `echo 'No build needed for static frontend'`
     - Publish directory: `.` (root)
   - Click "Deploy site"

2. **Get your Netlify URL**:
   - Copy the URL (e.g. `https://your-app-name.netlify.app`)

3. **Update Railway environment**:
   - Go back to Railway → Variables
   - Update `FRONTEND_URL` with your actual Netlify URL
   - Railway will auto-redeploy

## Step 4: Test

Visit your Netlify URL and test the full protocol walk!

## Important Files

- `netlify.toml`: Netlify configuration
- `Procfile`: Railway start command
- `.env.example`: Template for environment variables
- `index.html`: Frontend (deployed to Netlify)
- `src/server.ts`: Backend (deployed to Railway)

## Local Development

Still works the same:

```bash
npm run build
npm run server
# Open http://localhost:3000 in browser
```

## Cost Monitoring

The cost display in the header shows estimated Claude API costs per session.
