# CoachDM
## Hors ligne & écran verrouillé (nov. 2026)

- `vendor/supabase.js` : supabase-js embarqué (plus de CDN) — l'app démarre sans réseau.
  Régénérer : `npm i @supabase/supabase-js@2 esbuild` puis
  `echo "export { createClient } from '@supabase/supabase-js';" > e.js && npx esbuild e.js --bundle --format=esm --minify --outfile=vendor/supabase.js`
- Hors ligne : entrée avec la session du téléphone, accès premium gardé 14 jours, catalogue,
  1RM, plan du coach et détail des séances relus localement (IndexedDB `cdm-offline`).
  Une fois une séance ouverte avec réseau, tout son programme est copié sur le téléphone.
- Séances et séries validées hors ligne : file d'envoi `cdm_outbox` (localStorage), envoyée
  dans l'ordre au retour du réseau.
- Écran verrouillé : notifications locales programmées pour chaque transition des timers
  (`lkPlan`) + son muet Web Audio pour garder l'app éveillée (`UIBackgroundModes: audio`).
  Plugins natifs requis : `@capacitor/local-notifications`, `@capacitor-community/keep-awake`.
