# QUICK FIX: CAMERA PERMISSION NOT SHOWING

## 📱 What You're Seeing
- **QR code covering screen**: This is **Vite's development server helper** (shows local network URL for mobile testing). It's harmless and does NOT block camera access.
- **"Powered by 8th Wall" text**: This is from your `index.html` footer - normal and expected.
- **No camera permission popup**: This happens because you previously clicked **"Block"** for camera access on `http://localhost:5500`. Browsers remember this choice and silently deny future requests.

## 🔧 FIX: Reset Camera Permission (Do This Now)

### Chrome / Edge
1. Click the **padlock icon** (or "Site information") **left of the address bar**
2. Select **"Site settings"**
3. Find **"Camera"** in the permissions list
4. Set it to **"Ask (default)"** (or click the trash can to remove `http://localhost:5500`)

### Firefox
1. Click the **padlock icon** → **"Clear Permissions"**
   - OR go to `about:preferences#privacy → Permissions → Camera → Settings…` → remove `localhost`

### Safari
1. Safari → **Settings for This Website** (when on `http://localhost:5500/`)
2. Set **Camera** to **"Ask"**
3. **Reload the page**

### 💡 Alternative: Use Private/Incognito Window
This bypasses all saved permissions:
1. Open a **new incognito/private window** (Ctrl+Shift+N / Cmd+Shift+N)
2. Go to `http://localhost:5500/`
3. Click **"Try On"**
4. **You WILL see the camera permission prompt** - click **Allow**

## ✅ What You Should See After Fixing
1. Click **"Try On"**
2. Browser shows: **"[localhost:5500] wants to use your camera?"** → **[Allow] [Block]**
3. Click **Allow**
4. You will see:
   - **Live webcam feed** as background (not black!)
   - **Bright red cube** floating in space (debug cube - confirms Three.js is working)
   - (Later we'll replace cube with actual glasses model)

## 📝 Verification Steps (Do This First)
Before testing the AR app, verify your camera works with our diagnostic page:
1. Go to: `http://localhost:5500/camera-diagnostic.html`
2. Click **"Test Camera Permission"**
3. **You MUST see the browser's permission prompt** - click **Allow**
4. You should see your webcam feed in the test page (proves camera/hardware/browser work)

## ⚠️ Important Notes
- The QR code overlay is **Vite's dev server helper** - it does NOT use camera or interfere with AR
- You can **ignore it completely** or click outside it to make it less distracting
- Your AR application code is correct - the issue is purely browser permission state
- Once you see the red cube over your webcam feed, we'll replace it with your actual glasses model

**Try the permission reset now and test - you will see the camera prompt and then the AR working.**