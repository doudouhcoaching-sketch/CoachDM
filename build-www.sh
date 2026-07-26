#!/bin/bash
# Coach DM — assemble le webDir embarqué pour le build iOS
# app.html devient index.html (page d'entrée).
# sw.js exclu : service worker inutile/instable sous capacitor://
#
# admin.html EST embarqué. Il était exclu ("web only"), mais le bouton
# "Console Admin" du profil pointe vers un href relatif : dans l'app il se
# résolvait donc en https://localhost/admin.html, absent du bundle, soit un 404
# silencieux — le clic ne faisait rien. Embarquer le fichier n'ouvre aucun accès :
# chaque action passe par une fonction admin_* protégée par is_admin() côté base.
# admin-seances.html reste exclu : plus référencé nulle part.
set -e

rm -rf www
mkdir -p www

cp app.html www/index.html

PAGES="app.html coach.html saut.html squat.html barre.html course.html hyrox.html aide.html privacy.html admin.html"
for f in $PAGES; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

ASSETS="logo.png logodm.png logo-dm.png favicons.png manifest.json"
for f in $ASSETS; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

echo "== Contenu www/ =="
ls -la www/
