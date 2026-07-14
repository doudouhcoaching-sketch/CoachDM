#!/bin/bash
# Coach DM — assemble le webDir embarque pour le build iOS
# app.html devient index.html (page d'entree). admin.html exclu (web only).
# sw.js exclu : service worker inutile/instable sous capacitor://
set -e

rm -rf www
mkdir -p www

cp app.html www/index.html

PAGES="app.html coach.html saut.html squat.html barre.html course.html aide.html privacy.html bienvenue.html"
for f in $PAGES; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

ASSETS="logo.png logodm.png logo-dm.png favicons.png favicon.png manifest.json icon-192.png icon-512.png apple-touch-icon.png"
for f in $ASSETS; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

echo "== Contenu www/ =="
ls -la www/
