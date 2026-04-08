[README.md](https://github.com/user-attachments/files/26582541/README.md)
# WatchNews PWA

Full news articles delivered as chunked notifications to your **G-Shock GBX-100**.

## Deploy in 3 steps (free, no server needed)

### 1. Create a GitHub repo and push these files

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/watchnews.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Save — your URL will be: `https://YOUR_USERNAME.github.io/watchnews`

### 3. Install on your phone

1. Open the URL in **Chrome for Android**
2. Tap the three-dot menu → **Add to Home screen**
3. Tap Add — it installs like an app
4. Open it, allow notifications, press **START FEED**

---

## How it works

- Fetches RSS feeds for your enabled categories
- Pulls the full article text from the source page
- Splits it into ~280-character chunks
- Fires each chunk as a phone notification, 2.5 seconds apart
- Your GBX-100 mirrors each notification and scrolls the text

## Background sync

On Chrome for Android, the app uses **Periodic Background Sync** — it wakes up and fetches articles even when the app is closed, as long as it's installed as a PWA.

If your browser doesn't support Periodic Background Sync, the app falls back to an in-app timer (works while the app is open).

## Customization

All categories and RSS feeds are defined in the `CATEGORIES` array at the top of `index.html`. To add a new source, just add a line:

```js
{ group:'NEWS', name:'Reuters', emoji:'📰', rss:'https://feeds.reuters.com/reuters/topNews' },
```
