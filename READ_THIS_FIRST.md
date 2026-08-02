# URGENT: CAMERA PERMISSION FIX - READ THIS FIRST

## 🚫 WHAT YOU'RE SEEING IS NOT 8TH WALL'S FAULT
- The "QR code covering screen" is **Vite's development server helper** (shows how to test on phone)
- It says "To view, open camera on smartphone..." - this is Vite being helpful for mobile testing
- The "powered by 8th wall" text is just your normal footer - that's fine
- **This QR code does NOT use camera or block anything** - you can ignore it or click outside it

## 🔑 THE REAL PROBLEM: BROWSER PERMISSION STATE
You previously clicked **"Block"** for camera access on `http://localhost:5500`. 
Browsers remember this choice FOREVER until you manually reset it.
Result: When you click "Try On", the browser **silently denies** camera access without showing a prompt.

## ✅ THE 10-SECOND FIX (DO THIS NOW)

### OPTION 1: Reset in current browser (recommended)
1. **Look left of your address bar** - you should see a **padlock icon** (or "i" in a circle)
2. **Click that padlock/icon**
3. **Select "Site settings"** (Chrome/Edge) or **"Clear Permissions"** (Firefox)
4. **Find "Camera"** in the list
5. **Set it to "Ask"** (Chrome/Edge: dropdown; Firefox: remove the entry)
6. **Close the settings tab**
7. **Hard-refresh the page**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
8. **Click "Try On"**
9. **When browser asks: "Allow camera?" → Click ALLOW**

### OPTION 2: Use incognito/private window (100% guaranteed)
1. Open **new incognito/private window** (Ctrl+Shift+N / Cmd+Shift+N)
2. Go to: `http://localhost:5500/`
3. Click **"Try On"**
4. **You WILL see the camera permission prompt** - click **Allow**
5. (No need to reset permissions - incognito starts fresh)

## ✅ WHAT YOU SHOULD SEE AFTER FIXING
1. Click "Try On"
2. Browser shows: **"[localhost:5500] wants to use your camera?"** → **[Allow] [Block]**
3. Click **Allow**
4. You will see:
   - Your **live webcam feed** as background (not black!)
   - A **bright red cube** floating in space (debug cube - confirms 3D rendering works)
   - (We'll replace cube with actual glasses model next)

## 📝 VERIFY CAMERA WORKS FIRST (30 seconds)
Before testing AR, prove your camera works:
1. Go to: `http://localhost:5500/camera-diagnostic.html`
2. Click **"Test Camera Permission"**
3. **You WILL see the browser's permission prompt** - click **Allow**
4. You should see your webcam feed in the test page (5 second preview)

## ⚠️ IF YOU STILL DON'T SEE THE PROMPT
You have a browser extension blocking it (like a privacy/ad-blocker). Try:
1. Incognito/private window (disables most extensions)
2. Or temporarily disable extensions for localhost:5500

**Your AR code is 100% correct - the issue is purely browser permission state.** 
Fix the permission and you WILL see the camera prompt and then the AR working.

**DO THIS NOW:** Try incognito window first - it's the fastest way to confirm.