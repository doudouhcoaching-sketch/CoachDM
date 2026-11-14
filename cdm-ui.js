/* Coach DM — cdm-ui.js : plus aucun emoji en couleur dans l'app.
   Charge dans toutes les pages (app, consoles, analyses, TV, studio).
   Chaque emoji affiche est remplace, a l'ecran seulement, par une icone or
   (une icone du dossier icons/ quand elle existe, sinon un picto au trait or).
   Le caractere d'origine reste dans la page, invisible : le texte lu par le code
   (textContent, comparaisons, copier/coller) ne change pas.
   Aucun texte de champ (input, textarea, select) n'est touche. */
(function () {
  if (window.__cdmUi) return; window.__cdmUi = true;
  var G = '#DCBB72';
  function svg(p, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + p + '</svg>'; }
  var S = {
    warn: svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
    stop: svg('<circle cx="12" cy="12" r="9"/><path d="M7.5 12h9"/>'),
    swap: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
    clock: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M12 2.5V6M18.5 7l1.5-1.5"/>'),
    hour: svg('<path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9"/>'),
    pause: svg('<path d="M9 5v14M15 5v14"/>', ' stroke-width="2.6"'),
    next: svg('<path d="M5 5l9 7-9 7z" fill="currentColor"/><path d="M18 5v14"/>'),
    prev: svg('<path d="M19 5l-9 7 9 7z" fill="currentColor"/><path d="M6 5v14"/>'),
    rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#FF5A5F"/></svg>',
    plate: svg('<circle cx="12" cy="12" r="6"/><path d="M3 4v6a2 2 0 0 0 2 2V20M5 4v5M21 4c-2 0-2.5 3-2.5 6H21v10"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    star: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
    doc: svg('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
    pen: svg('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
    chart: svg('<path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/>'),
    thumb: svg('<path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.5 1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/>'),
    ok: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>'),
    f1: svg('<circle cx="12" cy="12" r="9"/><path d="M8 16.5c2.4-2.4 5.6-2.4 8 0M8.5 9.5l2 1M15.5 9.5l-2 1"/>'),
    f2: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 16c2.2-1.5 4.8-1.5 7 0M9 10h.01M15 10h.01"/>'),
    f3: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7M9 10h.01M15 10h.01"/>'),
    f4: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c2.2 1.6 4.8 1.6 7 0M9 10h.01M15 10h.01"/>'),
    f5: svg('<circle cx="12" cy="12" r="9"/><path d="M7.5 13.5c2.5 3.4 6.5 3.4 9 0zM9 9.5h.01M15 9.5h.01"/>'),
    sleep: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M15 4h4l-4 4h4"/>')
  };
  /* emoji -> ['img', fichier] ou ['svg', cle] */
  var M = {
    '\u{1F4AA}': ['img', 'ui_strength'], '\u{1F3CB}': ['img', 'ui_strength'], '\u{1F3C6}': ['img', 'ui_trophy'],
    '\u{1F3A5}': ['img', 'ui_film'], '\u{1F3AC}': ['img', 'ui_film'], '\u{1F4CB}': ['img', 'ui_list'], '\u{1F4AC}': ['img', 'ui_chat'],
    '⚙': ['img', 'ui_set'], '\u{1F512}': ['img', 'ui_lock'], '\u{1F5A8}': ['img', 'ui_print'], '✨': ['img', 'ui_spark'],
    '\u{1F4FA}': ['img', 'ui_tv'], '\u{1F50A}': ['img', 'ui_snd'], '\u{1F509}': ['img', 'ui_snd'], '\u{1F507}': ['img', 'ui_mute'],
    '\u{1F4A7}': ['img', 'ui_drop'], '\u{1F9F9}': ['img', 'ui_clear'], '\u{1F389}': ['img', 'ui_clap'], '\u{1F44F}': ['img', 'ui_clap'],
    '\u{1F525}': ['img', 'ui_flame'], '\u{1F3AE}': ['img', 'an_jeu'], '\u{1F4F7}': ['img', 'ui_camera'], '\u{1F4F8}': ['img', 'ui_camera'],
    '\u{1F50D}': ['img', 'ui_search'], '\u{1F3AF}': ['img', 'ui_goal'], '⚡': ['img', 'ui_bolt'], '\u{1F331}': ['img', 'ui_sprout'],
    '\u{1F4BE}': ['img', 'ui_save'], '⬇': ['img', 'ui_save'], '\u{1F4E4}': ['img', 'ui_share'], '\u{1F4D0}': ['img', 'ui_measure'],
    '⚠': ['svg', 'warn'], '⛔': ['svg', 'stop'], '⏱': ['svg', 'clock'], '⏲': ['svg', 'clock'], '⏳': ['svg', 'hour'], '⌛': ['svg', 'hour'],
    '⏸': ['svg', 'pause'], '⏭': ['svg', 'next'], '⏮': ['svg', 'prev'], '⏺': ['svg', 'rec'],
    '\u{1F37D}': ['svg', 'plate'], '\u{1F399}': ['svg', 'mic'], '\u{1F3A4}': ['svg', 'mic'], '\u{1F319}': ['svg', 'moon'], '☀': ['svg', 'sun'],
    '⭐': ['svg', 'star'], '\u{1F31F}': ['svg', 'star'], '\u{1F30D}': ['svg', 'globe'], '\u{1F30E}': ['svg', 'globe'], '\u{1F30F}': ['svg', 'globe'],
    '\u{1F4C4}': ['svg', 'doc'], '\u{1F4DD}': ['svg', 'doc'], '✏': ['svg', 'pen'], '\u{1F4C8}': ['svg', 'chart'], '\u{1F4CA}': ['svg', 'chart'],
    '\u{1F44D}': ['svg', 'thumb'], '\u{1F44C}': ['svg', 'ok'], '\u{1F64F}': ['svg', 'ok'], '\u{1F44A}': ['svg', 'thumb'], '✅': ['svg', 'ok'],
    '\u{1F62B}': ['svg', 'f1'], '\u{1F615}': ['svg', 'f2'], '\u{1F610}': ['svg', 'f3'], '\u{1F642}': ['svg', 'f4'], '\u{1F604}': ['svg', 'f5'], '\u{1F634}': ['svg', 'sleep']
  };
  /* les pages d'analyse ont deja cdm-icons.js pour ces caracteres-la */
  if (document.querySelector('script[src*="cdm-icons.js"]')) ['\u{1F4E4}', '\u{1F4BE}', '⬇', '\u{1F4D0}', '⚠', '⛔'].forEach(function (k) { delete M[k]; });
  var keys = Object.keys(M).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\uFE0F?', 'u');
  var css = document.createElement('style');
  css.textContent = '.cdm-e{display:inline-flex;align-items:center;justify-content:center;width:1.2em;height:1.2em;vertical-align:-.22em;color:' + G + ';line-height:1}' +
    '.cdm-e svg{width:100%;height:100%;display:block}.cdm-e img{width:100%;height:100%;object-fit:cover;border-radius:.28em;display:block}' +
    '.cdm-e .cdm-eh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.cdm-e{position:relative}';
  (document.head || document.documentElement).appendChild(css);
  function piece(ch, full) {
    var d = M[ch]; var s = document.createElement('span'); s.className = 'cdm-e'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = (d[0] === 'img' ? '<img alt="" decoding="async" src="icons/' + d[1] + '.webp">' : S[d[1]]) + '<span class="cdm-eh"></span>';
    s.lastChild.textContent = full;
    return s;
  }
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|SELECT|TITLE|NOSCRIPT|CODE|PRE)$/;
  function fix(node) {
    var v = node.nodeValue; if (!v || !RE.test(v)) return;
    var p = node.parentNode; if (!p || p.nodeType !== 1) return;
    if (SKIP.test(p.nodeName) || p.isContentEditable || (p.closest && (p.closest('.cdm-e,svg,[contenteditable="true"],[data-no-icons]')))) return;
    var m = v.match(RE); if (!m) return;
    var before = v.slice(0, m.index), after = v.slice(m.index + m[0].length);
    if (before) p.insertBefore(document.createTextNode(before), node);
    p.insertBefore(piece(m[1], m[0]), node);
    node.nodeValue = after;
    if (after) fix(node); else p.removeChild(node);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) if (RE.test(n.nodeValue)) list.push(n);
    list.forEach(fix);
  }
  var queue = [], pending = false;
  function flush() { pending = false; var q = queue; queue = []; q.forEach(scan); }
  function go() {
    scan(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') queue.push(m.target);
        else m.addedNodes.forEach(function (n) { queue.push(n); });
      });
      if (!pending && queue.length) { pending = true; (window.requestAnimationFrame || setTimeout)(flush); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();
