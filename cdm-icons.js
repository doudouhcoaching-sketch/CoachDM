/* Coach DM — icones or des pages d'analyse (barre, squat, saut, course, hyrox).
   Remplace a l'affichage le bonhomme au trait de la camera et les emojis
   (📤 💾 📐 ⬇ ⛔ ⚠ ⇄) par les icones or du dossier icons/.
   Fichier a part, charge en haut de chaque page : il ne touche a aucune ligne
   du code d'analyse. Les textes reecrits par les pages (langue, statut) sont
   repris automatiquement. */
(function () {
  var page = (location.pathname.split('/').pop() || '').replace('.html', '');
  var HERO = { barre: 'an_bar', squat: 'an_squat', saut: 'an_jump', course: 'an_run', hyrox: 'an_hyrox', chrono: 'an_chrono' }[page];
  if (!HERO) return;

  var IMG = { '\u{1F4E4}': 'ui_share', '\u{1F4BE}': 'ui_save', '⬇': 'ui_save', '\u{1F4D0}': 'ui_measure' };
  var SVG = {
    /* avertissement et arret : petits pictos or, lisibles a 16 px */
    '⚠': '<svg viewBox="0 0 24 24" fill="none" stroke="#E9C767" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>',
    '⛔': '<svg viewBox="0 0 24 24" fill="none" stroke="#E9C767" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M7.5 12h9"/></svg>',
    '⇄': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>'
  };
  var KEYS = Object.keys(IMG).concat(Object.keys(SVG));
  var RE = new RegExp('(' + KEYS.join('|') + ')\\uFE0F?\\s*', 'u');

  var css = document.createElement('style');
  css.textContent =
    '.cdm-ei{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.28em;margin-right:.35em;border-radius:.3em;object-fit:cover}' +
    '.cdm-es{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.16em;margin-right:.3em}.cdm-es svg{width:100%;height:100%;display:block}' +
    '#b-share .cdm-ei,#b-flip .cdm-es{margin:0;width:26px;height:26px}#b-flip .cdm-es{width:20px;height:20px}' +
    '.cdm-hero{width:108px;height:108px;border-radius:26px;display:block;box-shadow:0 0 0 1px rgba(220,187,114,.22),0 18px 40px -12px rgba(0,0,0,.8)}';
  document.head.appendChild(css);

  function piece(ch) {
    if (IMG[ch]) { var i = document.createElement('img'); i.className = 'cdm-ei'; i.alt = ''; i.decoding = 'async'; i.src = 'icons/' + IMG[ch] + '.webp'; return i; }
    var s = document.createElement('span'); s.className = 'cdm-es'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = SVG[ch]; return s;
  }
  function fixText(node) {
    var v = node.nodeValue, m = v && v.match(RE);
    if (!m) return;
    var p = node.parentNode;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE)$/.test(p.nodeName) || p.closest('svg')) return;
    var before = v.slice(0, m.index), after = v.slice(m.index + m[0].length);
    if (before) p.insertBefore(document.createTextNode(before), node);
    p.insertBefore(piece(m[1]), node);
    node.nodeValue = after;
    if (after) fixText(node);
  }
  function scan(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) if (RE.test(n.nodeValue)) list.push(n);
    list.forEach(fixText);
  }
  function hero() {
    /* le bonhomme au trait au centre de la camera, avant le lancement */
    document.querySelectorAll('svg.squatter, svg.jumper').forEach(function (s) {
      var i = document.createElement('img');
      i.className = 'cdm-hero'; i.alt = ''; i.decoding = 'async'; i.src = 'icons/' + HERO + '.webp';
      s.replaceWith(i);
    });
  }
  function go() {
    hero(); scan(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else m.addedNodes.forEach(scan);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
