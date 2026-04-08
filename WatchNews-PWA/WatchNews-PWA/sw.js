const CACHE_NAME = 'watchnews-v1';
const CONFIG_CACHE = 'watchnews-config';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ── Offline fetch ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Periodic Background Sync ──────────────────────────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'fetch-news') {
    event.waitUntil(runNewsCycle());
  }
});

// ── Manual trigger from app (message) ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'FETCH_NOW') {
    runNewsCycle();
  }
});

// ── Core logic ────────────────────────────────────────────────────────────────
async function runNewsCycle() {
  const config = await loadConfig();
  if (!config) return;

  const enabled = config.categories.filter(c => c.enabled);
  if (!enabled.length) return;

  const idx = config.catIndex % enabled.length;
  const cat = enabled[idx];

  config.catIndex = idx + 1;

  try {
    // Fetch RSS feed
    const items = await fetchRss(cat.rssUrl);
    if (!items.length) { await saveConfig(config); return; }

    const artIdx = (cat.artIndex || 0) % items.length;
    const item = items[artIdx];
    cat.artIndex = artIdx + 1;

    // Fetch full article text
    const text = await fetchArticleText(item.link, item.description);
    if (!text || text.length < 100) { await saveConfig(config); return; }

    const fullText = item.title + '\n\n' + text;
    const chunkSize = config.chunkSize || 280;
    const chunks = splitChunks(fullText, chunkSize);

    // Fire notifications — one per chunk, staggered
    for (let i = 0; i < chunks.length; i++) {
      const label = `${cat.emoji} ${cat.name.toUpperCase()} [${i + 1}/${chunks.length}]`;
      await self.registration.showNotification(label, {
        body: chunks[i],
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: `watchnews-${Date.now()}-${i}`,
        renotify: true,
        silent: i > 0   // only first chunk makes sound
      });
      if (i < chunks.length - 1) await sleep(2500);
    }
  } catch (err) {
    console.error('[WatchNews SW] Error:', err);
  }

  await saveConfig(config);
}

// ── RSS fetch via rss2json (free, CORS-safe) ──────────────────────────────────
async function fetchRss(rssUrl) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
  const res = await fetch(api);
  const data = await res.json();
  if (data.status !== 'ok') return [];
  return data.items.map(i => ({
    title: i.title || '(no title)',
    link: i.link || i.guid,
    description: stripHtml(i.description || i.content || '')
  })).filter(i => i.link);
}

// ── Full article text via CORS proxy + DOM parsing ────────────────────────────
async function fetchArticleText(url, fallbackSummary) {
  try {
    const proxy = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy, { signal: AbortSignal.timeout(12000) });
    const html = await res.text();

    // Parse and extract paragraphs
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove noise
    ['script','style','nav','header','footer','aside',
     '.ad','.ads','.sidebar','.newsletter','.comments','.share'].forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Try article content selectors
    const selectors = ['article', '[role="main"]', '.article-body', '.article__body',
      '.story-body', '.entry-content', '.post-content', '.content-body', 'main'];
    let bodyText = '';
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) {
        const t = extractParagraphs(el);
        if (t.length > 300) { bodyText = t; break; }
      }
    }
    if (!bodyText) bodyText = extractParagraphs(doc.body);
    return bodyText.replace(/\s{2,}/g, ' ').trim() || fallbackSummary;
  } catch {
    return fallbackSummary || '';
  }
}

function extractParagraphs(root) {
  const paras = root.querySelectorAll('p');
  return Array.from(paras)
    .map(p => p.textContent.trim())
    .filter(t => t.length > 40)
    .join('\n\n');
}

function stripHtml(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  return d.body.textContent || '';
}

// ── Chunk splitting ───────────────────────────────────────────────────────────
function splitChunks(text, size) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + size / 2) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

// ── Config stored in Cache Storage (accessible from SW) ───────────────────────
async function loadConfig() {
  try {
    const cache = await caches.open(CONFIG_CACHE);
    const res = await cache.match('/config');
    if (!res) return null;
    return await res.json();
  } catch { return null; }
}

async function saveConfig(config) {
  const cache = await caches.open(CONFIG_CACHE);
  await cache.put('/config', new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' }
  }));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
