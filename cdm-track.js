/* Coach DM — suivi d'UN athlète + angles articulaires (analyses squat, saut, barre, course, hyrox)
   ---------------------------------------------------------------------------------------------
   Le modèle MediaPipe peut voir plusieurs personnes. Sans suivi, la page prend « la première »
   de la liste, qui change d'une image à l'autre : l'analyse saute sur un passant.
   cdmTrack(res, ts) remet TOUJOURS l'athlète suivi en position 0 de res.landmarks et
   res.worldLandmarks : le reste de la page ne change pas.
     - départ : la personne la plus grande et la plus centrée (celle qui est filmée) ;
     - ensuite : la plus proche (position + taille) de l'athlète à l'image précédente ;
     - si personne n'est assez proche : athlète « perdu » plutôt qu'un saut sur quelqu'un d'autre ;
     - bouton « Choisir l'athlète » : on touche l'athlète sur l'image, le suivi repart de lui.
   cdmTrackDraw(ctx, canvas, res, opts) dessine les autres personnes en gris et les angles
   (genou, hanche, coude si demandé) de l'athlète suivi. */
(function () {
  'use strict';
  var TX = {
    fr: { pick: "Choisir l'athlète", tap: "Touche l'athlète", ok: 'Athlète choisi', none: 'Personne ici', knee: 'genou', hip: 'hanche', elbow: 'coude' },
    en: { pick: 'Pick the athlete', tap: 'Tap the athlete', ok: 'Athlete selected', none: 'Nobody here', knee: 'knee', hip: 'hip', elbow: 'elbow' },
    nl: { pick: 'Atleet kiezen', tap: 'Tik op de atleet', ok: 'Atleet gekozen', none: 'Niemand hier', knee: 'knie', hip: 'heup', elbow: 'elleboog' }
  };
  function tx(k) { var l = (document.documentElement.lang || 'fr').slice(0, 2); return (TX[l] || TX.fr)[k]; }
  var T = { prev: null, seed: null, picking: false, multiAt: -1e9, lastTs: 0, aspect: 16 / 9 };

  function vis(p) { return p ? (p.visibility == null ? 1 : p.visibility) : 0; }
  function center(lm) {
    var ids = [11, 12, 23, 24], x = 0, y = 0, n = 0;
    for (var i = 0; i < ids.length; i++) { var p = lm[ids[i]]; if (p && vis(p) > 0.2) { x += p.x; y += p.y; n++; } }
    return n >= 2 ? { x: x / n, y: y / n } : null;
  }
  function height(lm) {
    var a = 1, b = 0;
    for (var i = 0; i < lm.length; i++) { var p = lm[i]; if (!p || vis(p) < 0.3) continue; if (p.y < a) a = p.y; if (p.y > b) b = p.y; }
    return b > a ? b - a : 0;
  }
  function dist(c, pt) { return Math.hypot((c.x - pt.x) * T.aspect, c.y - pt.y); }
  function nearest(all, pt, h, tol) {
    var best = -1, bd = Infinity;
    for (var k = 0; k < all.length; k++) {
      var c = center(all[k]); if (!c) continue;
      var d = dist(c, pt) + (h ? Math.abs(height(all[k]) - h) * 0.6 : 0);
      if (d < bd) { bd = d; best = k; }
    }
    return bd <= tol ? best : -1;
  }
  function front(arr, k) { if (!arr || k <= 0 || k >= arr.length) return arr; var a = arr.slice(); var x = a.splice(k, 1)[0]; a.unshift(x); return a; }

  window.cdmTrack = function (res, ts) {
    if (!res || !res.landmarks) return res;
    var all = res.landmarks, n = all.length;
    var tsec = (ts || 0) / 1000;
    if (n > 1) T.multiAt = tsec;
    T.lastTs = tsec;
    if (!n) return res;
    var k = -1;
    if (T.seed) {
      k = nearest(all, T.seed, 0, 0.45);
      if (k < 0) { toast(tx('none')); T.seed = null; return res; }
      T.seed = null; toast(tx('ok'));
    } else if (T.prev && tsec - T.prev.t < 1.5 && tsec >= T.prev.t) {
      k = nearest(all, T.prev.c, T.prev.h, 0.25 + 3 * (tsec - T.prev.t));
      if (k < 0) { res.landmarks = []; if (res.worldLandmarks) res.worldLandmarks = []; return res; }
    } else {
      var bs = -Infinity;
      for (var i = 0; i < n; i++) {
        var c = center(all[i]); if (!c) continue;
        var s = height(all[i]) - 0.5 * Math.abs(c.x - 0.5);
        if (s > bs) { bs = s; k = i; }
      }
      if (k < 0) k = 0;
    }
    var lm = all[k], cc = center(lm);
    T.prev = { c: cc || (T.prev && T.prev.c) || { x: 0.5, y: 0.5 }, h: height(lm) || (T.prev && T.prev.h) || 0, t: tsec };
    if (k > 0) {
      res.landmarks = front(all, k);
      if (res.worldLandmarks) res.worldLandmarks = front(res.worldLandmarks, k);
    }
    syncBtn();
    return res;
  };
  window.cdmTrackReset = function () { T.prev = null; T.seed = null; };

  /* ---------- angles ---------- */
  function ang(a, b, c) {
    if (!a || !b || !c || vis(a) < 0.35 || vis(b) < 0.35 || vis(c) < 0.35) return null;
    var ux = (a.x - b.x) * T.aspect, uy = a.y - b.y, vx = (c.x - b.x) * T.aspect, vy = c.y - b.y;
    var d = Math.hypot(ux, uy) * Math.hypot(vx, vy); if (!d) return null;
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) * 180 / Math.PI;
  }
  function side(lm) {
    var l = vis(lm[23]) + vis(lm[25]) + vis(lm[27]), r = vis(lm[24]) + vis(lm[26]) + vis(lm[28]);
    return l >= r ? { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 } : { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 };
  }
  function chip(ctx, canvas, p, txt, mirror) {
    var X = p.x * canvas.width, Y = p.y * canvas.height, s = Math.max(1, canvas.width / 720);
    ctx.save();
    ctx.translate(X, Y); if (mirror) ctx.scale(-1, 1);
    ctx.font = '700 ' + Math.round(13 * s) + 'px Inter, -apple-system, sans-serif';
    var w = ctx.measureText(txt).width + 14 * s, h = 22 * s, ox = 12 * s, oy = -h / 2;
    ctx.fillStyle = 'rgba(11,11,10,.82)'; ctx.strokeStyle = 'rgba(220,187,114,.75)'; ctx.lineWidth = 1.2 * s;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ox, oy, w, h, h / 2); ctx.fill(); ctx.stroke(); } else { ctx.fillRect(ox, oy, w, h); }
    ctx.fillStyle = '#F2E3B3'; ctx.textBaseline = 'middle'; ctx.fillText(txt, ox + 7 * s, 0);
    ctx.restore();
  }
  window.cdmTrackDraw = function (ctx, canvas, res, opts) {
    opts = opts || {};
    if (canvas && canvas.width && canvas.height) T.aspect = canvas.width / canvas.height;
    if (!ctx || !res || window.CDM_AFF === 'rien') return;
    var mirror = !!(canvas.closest && canvas.closest('.mirror'));
    var all = res.landmarks || [];
    // autres personnes en gris
    if (all.length > 1 && window.cdmAffSquelette && window.cdmAffSquelette()) {
      var B = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
      ctx.save(); ctx.strokeStyle = 'rgba(143,139,128,.45)'; ctx.lineWidth = Math.max(1.5, canvas.width / 480); ctx.lineCap = 'round';
      for (var k = 1; k < all.length; k++) for (var j = 0; j < B.length; j++) {
        var p = all[k][B[j][0]], q = all[k][B[j][1]]; if (vis(p) < 0.3 || vis(q) < 0.3) continue;
        ctx.beginPath(); ctx.moveTo(p.x * canvas.width, p.y * canvas.height); ctx.lineTo(q.x * canvas.width, q.y * canvas.height); ctx.stroke();
      }
      ctx.restore();
    }
    // angles de l'athlète suivi
    var lm = all[0]; if (!lm || opts.angles === false) return;
    var s = side(lm), list = opts.angles || ['knee', 'hip'];
    for (var i = 0; i < list.length; i++) {
      var a = null, at = null;
      if (list[i] === 'knee') { a = ang(lm[s.hip], lm[s.kn], lm[s.an]); at = lm[s.kn]; }
      else if (list[i] === 'hip') { a = ang(lm[s.sh], lm[s.hip], lm[s.kn]); at = lm[s.hip]; }
      else if (list[i] === 'elbow') { a = ang(lm[s.sh], lm[s.el], lm[s.wr]); at = lm[s.el]; }
      if (a != null) chip(ctx, canvas, at, tx(list[i]) + ' ' + Math.round(a) + '\u00B0', mirror);
    }
  };

  /* ---------- bouton « Choisir l'athlète » ---------- */
  var btn = null, stage = null, toastEl = null;
  function toast(m) {
    if (!stage) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'cdm-trk-toast'; stage.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }
  function syncBtn() {
    if (!btn) return;
    var show = T.picking || (T.lastTs - T.multiAt < 3);
    btn.hidden = !show;
    btn.textContent = T.picking ? tx('tap') : tx('pick');
    btn.classList.toggle('on', T.picking);
    if (stage) stage.classList.toggle('cdm-picking', T.picking);
  }
  function setup() {
    stage = document.getElementById('stage'); if (!stage) return;
    var st = document.createElement('style');
    st.textContent = '.cdm-trk{position:absolute;left:10px;top:10px;z-index:7;appearance:none;border:1px solid rgba(220,187,114,.6);background:rgba(11,11,10,.78);color:#F2E3B3;font:700 12px/1 Inter,-apple-system,sans-serif;padding:9px 13px;border-radius:999px;backdrop-filter:blur(6px);cursor:pointer}' +
      '.cdm-trk.on{background:#DCBB72;color:#1B1405;border-color:#DCBB72}.cdm-trk[hidden]{display:none}' +
      '#stage.cdm-picking{cursor:crosshair;touch-action:none}' +
      '.cdm-trk-toast{position:absolute;left:50%;top:52px;transform:translateX(-50%);z-index:7;background:rgba(11,11,10,.85);color:#F2E3B3;font:600 12px/1.2 Inter,sans-serif;padding:8px 12px;border-radius:999px;opacity:0;transition:opacity .2s;pointer-events:none}.cdm-trk-toast.on{opacity:1}';
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cdm-trk'; btn.hidden = true;
    stage.appendChild(btn);
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    btn.addEventListener('click', function (e) { e.stopPropagation(); T.picking = !T.picking; syncBtn(); });
    stage.addEventListener('pointerdown', function (e) {
      if (!T.picking || e.target === btn) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var cv = stage.querySelector('canvas'); if (!cv) return;
      var r = cv.getBoundingClientRect(), cw = cv.width || 16, ch = cv.height || 9;
      var sc = Math.min(r.width / cw, r.height / ch), w = cw * sc, h = ch * sc;
      var x = (e.clientX - r.left - (r.width - w) / 2) / w, y = (e.clientY - r.top - (r.height - h) / 2) / h;
      if (stage.classList.contains('mirror')) x = 1 - x;
      T.seed = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      T.picking = false; syncBtn();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
