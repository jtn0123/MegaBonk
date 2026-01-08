# 📱 Android Standalone App - Quick Start

Want the MegaBonk guide as a **true standalone Android app** that works without your computer? Here are the 3 easiest options:

## ⚡ Option 1: PWABuilder (No Installation Required)

**Perfect for**: Quick conversion, no technical setup

### Steps:
1. Deploy the app to free hosting (choose one):
   - **Netlify**: Go to [netlify.com](https://www.netlify.com/) → Drag & drop the `src/` folder → Get instant URL
   - **GitHub Pages**: See detailed instructions in `docs/ANDROID_STANDALONE.md`
   - **Vercel**: Connect GitHub repo at [vercel.com](https://vercel.com/)

2. Go to [PWABuilder.com](https://www.pwabuilder.com/)

3. Enter your deployed URL (e.g., `https://your-app.netlify.app`)

4. Click "Start" → Wait for analysis

5. Click "Package for Stores" → "Android"

6. Click "Generate" → Download the APK

7. Transfer APK to your Android phone and install

**Time**: 10-15 minutes
**Difficulty**: ⭐ Easy

---

## ⚡ Option 2: Bubblewrap CLI (Local Development)

**Perfect for**: Testing locally without deploying

### Requirements:
- Node.js installed ([nodejs.org](https://nodejs.org/))

### Steps:
```bash
# Run the automated script
./build-android.sh
```

Or manually:
```bash
# Install Bubblewrap
npm install -g @bubblewrap/cli

# Start local server
python3 serve.py &

# Build APK
bubblewrap init --manifest=http://localhost:8000/manifest.json
bubblewrap build

# Install on connected Android device (via USB)
bubblewrap install
```

**Time**: 15 minutes (first time)
**Difficulty**: ⭐⭐ Medium

---

## ⚡ Option 3: PWA2APK (Fastest)

**Perfect for**: Absolute fastest option

### Steps:
1. Deploy to free hosting (same as Option 1)

2. Go to [PWA2APK.com](https://pwa2apk.com/)

3. Enter your URL

4. Fill in app details (name, package ID)

5. Click "Generate APK"

6. Download and install on Android

**Time**: 5 minutes
**Difficulty**: ⭐ Very Easy

---

## 📲 Installing the APK on Android

Once you have the `.apk` file:

1. **Transfer to phone**: Email, Google Drive, or USB cable

2. **Enable installation**:
   - Settings → Security → "Install from Unknown Sources" → Enable
   - Or: Settings → Apps → Chrome/Files → "Install unknown apps" → Allow

3. **Install**: Tap the APK file → "Install"

4. **Done!** App appears in your app drawer and works 100% offline

---

## 🎯 Which Option Should I Choose?

| If you want... | Choose... |
|---------------|-----------|
| **Fastest** | Option 3 (PWA2APK) |
| **Easiest** | Option 1 (PWABuilder) |
| **Local testing** | Option 2 (Bubblewrap) |
| **Most control** | Option 2 (Bubblewrap) |

---

## 📚 Full Documentation

For detailed instructions, advanced options, and Play Store publishing:

**See: `docs/ANDROID_STANDALONE.md`**

---

## ✅ Your App is Already Ready!

The MegaBonk guide already has everything needed:
- ✅ PWA manifest configured
- ✅ Service worker for offline support
- ✅ App icons (192x192, 512x512)
- ✅ Responsive design
- ✅ Standalone display mode

**You can start packaging right now!**

---

## 🆘 Need Help?

Check the full guide at `docs/ANDROID_STANDALONE.md` for:
- Detailed walkthroughs
- Troubleshooting
- Publishing to Play Store
- Advanced native features with Capacitor

---

**Ready to go standalone? Pick an option above and start building!** 🚀
