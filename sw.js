// Coach DM — Service Worker (PWA web)
// Hors ligne : la coquille de l'app (HTML, supabase-js embarque, scripts,
// icones, polices) est servie depuis le cache quand le reseau manque.
// Les donnees Supabase ne passent JAMAIS par ici (autre origine) : c'est
// l'app elle-meme qui garde ses copies locales (programmes, seances).
const CACHE_NAME = "coachdm-shell-v2";
const SHELL_FILES = [
  "/app.html", "/manifest.json", "/vendor/supabase.js",
  "/cdm-ui.js", "/cdm-icons.js", "/cdm-track.js", "/anim.js",
  "/logo-dm.png", "/icon-192.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first, same-origin only : ne JAMAIS intercepter les appels
// vers Supabase ou autres APIs externes (auth, donnees premium, etc.)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // laisse passer Supabase, CDN, etc.

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((r) =>
          r || (event.request.mode === "navigate" ? caches.match("/app.html") : undefined)
        )
      )
  );
});
