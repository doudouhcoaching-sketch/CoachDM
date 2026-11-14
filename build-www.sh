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

# conditions.html : exige par Apple 3.1.2(a) — un lien vers les CGU doit etre
# joignable au point d'achat. Embarque pour rester lisible meme hors connexion.
# admin-subs.html : ecran d approbation des substitutions, ouvert par un href
# relatif depuis le profil admin de app.html. Meme piege que admin.html : hors
# du bundle, le clic donnait un 404 silencieux sous capacitor://.
PAGES="app.html coach.html saut.html squat.html barre.html course.html hyrox.html chrono.html jeu.html aide.html privacy.html conditions.html admin.html admin-subs.html tv.html studio.html studio-voix.html"
for f in $PAGES; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

ASSETS="logo.png logodm.png logo-dm.png favicons.png manifest.json tv-manifest.json anim.js cdm-icons.js cdm-ui.js cdm-track.js apple-touch-icon.png favicon.png favicon-16.png favicon-32x32.png"
for f in $ASSETS; do
  if [ -f "$f" ]; then cp "$f" www/; fi
done

# icons/, badges/ et fonts/ : sans eux l'app embarquee perd ses icones or,
# ses badges et ses polices (Barlow Condensed, Inter). Ajoute pour la 2.4.1.
for d in icons badges fonts; do
  if [ -d "$d" ]; then cp -R "$d" www/; fi
done

echo "== Contenu www/ =="
ls -la www/
