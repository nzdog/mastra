# Frontend Integration Guide

## ✅ Your Frontend is Already Integrated!

Good news! Your frontend files from the Claude conversation are already in your project and wired up to the backend.

## Current Setup

```
mastra-lichen-agent/
├── index.html              # 🎨 Your production frontend (Lichen Field interface)
├── test-frontend.html      # 🧪 Simple test interface
├── src/
│   └── server.ts          # 🔌 Backend serving both frontends
└── ...
```

## How It Works

1. **Backend serves the frontend** - No separate frontend server needed
2. **Single HTML files** - All CSS and JavaScript embedded (no build tools required)
3. **Zero configuration** - Just run the server and open your browser

## Running the Full Stack

```bash
# Start the backend (serves frontend automatically)
npm run server

# Open in browser
# Production: http://localhost:3000
# Test UI:    http://localhost:3000/test
```

## Available Endpoints

### Frontend Pages
- **`/`** - Production Lichen Field interface (`index.html`)
- **`/test`** - Simple test interface (`test-frontend.html`)
- **`/health`** - API health check (JSON)

### API Endpoints (used by frontend)
- **`POST /api/walk/start`** - Start protocol session
- **`POST /api/walk/continue`** - Continue through themes
- **`POST /api/walk/complete`** - Generate field diagnosis

## How the Frontend Was Integrated

The frontend from your Claude conversation was saved as `index.html` in your project root. The backend automatically serves it:

```typescript
// src/server.ts
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});
```

## File Structure Explanation

### 1. **`index.html`** (Production Frontend)
- **Format:** Single HTML file with embedded CSS and JavaScript
- **Why:** No build tools needed, works immediately in any browser
- **Contains:**
  - Full UI for the Lichen Field protocol
  - API integration code
  - All styling

### 2. **`test-frontend.html`** (Test Interface)
- **Format:** Simple single-file testing UI
- **Purpose:** Quick testing of API endpoints
- **Usage:** Good for debugging backend responses

## How to Update the Frontend

If you get new artifacts from Claude conversations:

### Method 1: Direct Download (Easiest)
1. In the Claude conversation, click the **"↓"** icon on the artifact
2. Save the HTML file to your project root:
   - Save as `index.html` (replace existing)
3. Refresh your browser at `http://localhost:3000`

### Method 2: Copy-Paste
1. Click the artifact title to expand it
2. Click **"Copy code"** button
3. Open `index.html` in your editor
4. Replace all content with the copied code
5. Save and refresh browser

### Method 3: Export Multiple Files
If you want to split CSS/JS into separate files later:

```bash
# Create public directory
mkdir public
cd public

# Extract CSS
# (Open index.html, copy everything between <style> tags)
cat > styles.css

# Extract JavaScript
# (Copy everything between <script> tags)
cat > app.js

# Create new index.html that links to them
cat > index.html
```

Then update `src/server.ts` to serve static files:
```typescript
app.use(express.static('public'));
```

## No Build Tools Needed! ✨

Your current setup is **intentionally simple**:
- ❌ No webpack/vite/parcel
- ❌ No npm build step
- ❌ No transpilation
- ✅ Just HTML, CSS, and vanilla JavaScript
- ✅ Works immediately in any browser
- ✅ Easy to update by replacing the HTML file

## Testing the Integration

### 1. Start the server
```bash
npm run server
```

### 2. Open production UI
```
http://localhost:3000
```

### 3. Try the protocol
- Type a message (e.g., "What field am I in?")
- Follow the protocol through all themes
- Check the browser console for API calls

### 4. Use the test interface (for debugging)
```
http://localhost:3000/test
```

## Troubleshooting

### "Cannot GET /"
- Server might not be running
- Run: `npm run server`
- Check: `http://localhost:3000/health` returns JSON

### "API calls failing"
- Check browser console for errors
- Verify server is running on port 3000
- Check CORS is enabled (it is by default)

### "Need to update frontend"
1. Get new HTML from Claude artifact (click download)
2. Replace `index.html` in project root
3. Hard refresh browser (Cmd+Shift+R on Mac)

### "Want to split into separate files"
This is optional! Only do this if you need:
- Better editor support (syntax highlighting)
- Easier version control (smaller diffs)
- Shared components across pages

Current single-file approach is simpler for rapid iteration.

## Architecture Overview

```
Browser (http://localhost:3000)
    ↓
Express Server (src/server.ts)
    ↓
    ├─ / → index.html (production UI)
    ├─ /test → test-frontend.html
    └─ /api/* → Backend API
           ↓
       Agent (src/agent.ts)
           ↓
       Claude API
```

## Summary

**You're all set!** Your frontend and backend are fully integrated. Just:

1. Run `npm run server`
2. Open `http://localhost:3000`
3. Start using the protocol

No downloads, exports, or wiring needed. The artifacts from your Claude conversation are already here and working.

**To update:** Download new HTML from Claude artifacts → Replace `index.html` → Refresh browser.
