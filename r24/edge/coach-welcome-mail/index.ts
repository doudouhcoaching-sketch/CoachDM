// coach-welcome-mail v4 (25/10/2026) — email envoye quand un membre devient coach.
// v4 : nouvelle offre. Gratuit = 3 clients, messagerie, tout fait a la main.
//      Offre Coach unique et illimitee 39,99 €/mois (tarif fondateur : seulement sur invitation, jamais affiche publiquement), plus de Coach+.
//      Lien vers coachdm.be/offre-coach.html. Charte noir et or 2.4, plus d'emoji.
// Role : canal de vente de l'offre coach hors de l'app (aucun prix ni lien dans l'app iOS, regle Apple 3.1.1).
// Deux modes :
//   { preview: { to, locale? } }        → envoi de test, sans ecriture en base
//   { coach_welcome: { user_id } }      → envoi reel, deduplique via email_log
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SECRET = Deno.env.get("PUSH_SECRET") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "Coach DM <noreply@coachdm.be>";
const REPLY_TO = "contact@coachdm.be";
const CONSOLE = "https://coachdm.be/coach.html";
const OFFER = "https://coachdm.be/offre-coach.html";
const STEP = "coach_welcome";

const enc = new TextEncoder();
async function hmac(v: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(v));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error("sb " + path + " " + r.status + " " + await r.text());
  return r.status === 204 ? null : r.json();
}

type Loc = "fr" | "en" | "nl";
const L = (l?: string): Loc => (l === "en" || l === "nl") ? l : "fr";
interface Tpl { subject: string; pre: string; title: string; intro: string; freeTitle: string; feats: string[]; paidTitle: string; paid: string[]; outro: string; cta: string; }

const PRICE = {
  fr: { badge: "OFFRE COACH", l1: "39,99 € / mois", d1: "Clients illimités · sans engagement · ou 399 € par an", btn: "Découvrir l'offre Coach" },
  en: { badge: "COACH PLAN", l1: "€39.99 / month", d1: "Unlimited clients · no commitment · or €399 per year", btn: "See the Coach plan" },
  nl: { badge: "COACH-ABONNEMENT", l1: "€ 39,99 / maand", d1: "Onbeperkt klanten · zonder verplichting · of € 399 per jaar", btn: "Bekijk het Coach-abonnement" },
};

function tpl(loc: Loc, name: string): Tpl {
  const n = name ? " " + name.split(" ")[0] : "";
  const T: Record<Loc, Tpl> = {
    fr: {
      subject: "Ta console coach est ouverte",
      pre: "3 clients offerts · ce qui est inclus, ce que débloque l'offre Coach",
      title: "Bienvenue côté coach" + n,
      intro: "Ton compte est passé en coach. Tu as <b>3 places clients offertes</b>, sans limite de durée : de quoi accompagner de vrais clients et juger l'outil sur pièces.",
      freeTitle: "Gratuit, dès maintenant",
      feats: [
        "<b>3 clients</b> — la console complète, sans date d'expiration",
        "<b>La messagerie</b> — tu parles à tes clients dans l'app",
        "<b>Leur fiche complète</b> — séances, repas, poids, records, bilans",
        "<b>Tes propres séances et programmes</b> — que tu construis toi-même, semaine par semaine",
        "<b>Tes plans repas</b> — que tu composes toi-même, aliment par aliment",
      ],
      paidTitle: "Ce que débloque l'offre Coach",
      paid: [
        "<b>Clients illimités</b>",
        "<b>Les programmes Coach DM</b> — prêts à envoyer à tes clients",
        "<b>L'assistant qui crée les programmes</b> — tu dis ce que tu veux, il prépare le programme",
        "<b>La nutrition au gramme près</b> — la journée composée et dosée pour les macros de ton client",
        "<b>Visios et vidéos</b> dans la messagerie",
      ],
      outro: "L'offre Coach se souscrit sur le web, sur coachdm.be. Une question ? Réponds simplement à cet email.",
      cta: "Ouvrir ma console coach",
    },
    en: {
      subject: "Your coach console is open",
      pre: "3 free clients · what's included, what the Coach plan unlocks",
      title: "Welcome to the coach side" + n,
      intro: "Your account is now a coach account. You have <b>3 free client spots</b>, with no time limit — enough to coach real clients and judge the tool on results.",
      freeTitle: "Free, starting now",
      feats: [
        "<b>3 clients</b> — the full console, no expiry date",
        "<b>Messaging</b> — talk to your clients in the app",
        "<b>Their full profile</b> — workouts, meals, weight, records, check-ins",
        "<b>Your own workouts and programs</b> — built by you, week by week",
        "<b>Your meal plans</b> — put together by you, food by food",
      ],
      paidTitle: "What the Coach plan unlocks",
      paid: [
        "<b>Unlimited clients</b>",
        "<b>Coach DM programs</b> — ready to send to your clients",
        "<b>The program assistant</b> — say what you want, it prepares the program",
        "<b>Nutrition to the gram</b> — the day built and portioned for your client's macros",
        "<b>Video calls and videos</b> in messaging",
      ],
      outro: "The Coach plan is purchased on the web, at coachdm.be. A question? Just reply to this email.",
      cta: "Open my coach console",
    },
    nl: {
      subject: "Je coachconsole is open",
      pre: "3 gratis klanten · wat inbegrepen is, wat het Coach-abonnement opent",
      title: "Welkom aan de coachkant" + n,
      intro: "Je account is nu een coachaccount. Je hebt <b>3 gratis klantplaatsen</b>, zonder tijdslimiet — genoeg om echte klanten te begeleiden en de tool op resultaat te beoordelen.",
      freeTitle: "Gratis, vanaf nu",
      feats: [
        "<b>3 klanten</b> — de volledige console, zonder vervaldatum",
        "<b>Berichten</b> — je praat met je klanten in de app",
        "<b>Hun volledige fiche</b> — trainingen, maaltijden, gewicht, records, check-ins",
        "<b>Je eigen trainingen en programma's</b> — zelf opgebouwd, week per week",
        "<b>Je maaltijdplannen</b> — zelf samengesteld, voedingsmiddel per voedingsmiddel",
      ],
      paidTitle: "Wat het Coach-abonnement opent",
      paid: [
        "<b>Onbeperkt klanten</b>",
        "<b>De Coach DM-programma's</b> — klaar om naar je klanten te sturen",
        "<b>De programma-assistent</b> — zeg wat je wil, hij bereidt het programma voor",
        "<b>Voeding tot op de gram</b> — de dag samengesteld en afgewogen voor de macro's van je klant",
        "<b>Videogesprekken en video's</b> in de berichten",
      ],
      outro: "Het Coach-abonnement neem je op het web, via coachdm.be. Een vraag? Antwoord gewoon op deze e-mail.",
      cta: "Open mijn coachconsole",
    },
  };
  return T[loc];
}

const F = "-apple-system,Segoe UI,Arial,sans-serif";
function row(f: string, gold: boolean): string {
  return `<tr><td style="width:26px;vertical-align:top;padding:8px 0"><div style="width:18px;height:18px;border-radius:50%;background:${gold ? "rgba(220,187,114,.22)" : "rgba(244,241,233,.08)"};color:${gold ? "#DCBB72" : "#D2CDC1"};font-size:11px;line-height:18px;text-align:center;font-family:Arial,sans-serif">&#10003;</div></td><td style="padding:7px 0 7px 8px;font-family:${F};color:#D2CDC1;font-size:15px;line-height:1.55">${f}</td></tr>`;
}
function render(t: Tpl, loc: Loc, unsub: string): string {
  const unsubTxt = { fr: "Se désinscrire de ces emails", en: "Unsubscribe from these emails", nl: "Afmelden voor deze e-mails" }[loc];
  const contact = { fr: "Questions ? Réponds simplement à cet email.", en: "Questions? Just reply to this email.", nl: "Vragen? Antwoord gewoon op deze e-mail." }[loc];
  const P = PRICE[loc];
  const sec = (s: string, c: string) => `<div style="font-family:${F};color:${c};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin:24px 0 6px">${s}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0A">
<div style="display:none;max-height:0;overflow:hidden">${t.pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0A"><tr><td align="center" style="padding:40px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding-bottom:26px">
<img src="https://coachdm.be/logo-dm.png" width="80" height="80" alt="Coach DM" style="border-radius:20px;display:block">
<div style="font-family:${F};color:#DCBB72;font-size:12px;letter-spacing:3px;margin-top:12px;font-weight:700">POWER · TRANSFORM · EXCEL</div>
</td></tr>
<tr><td style="background:#151513;border-radius:26px;padding:36px 30px">
<h1 style="font-family:${F};color:#F4F1E9;font-size:28px;margin:0 0 14px;letter-spacing:-.02em">${t.title}</h1>
<p style="font-family:${F};color:#D2CDC1;font-size:16px;line-height:1.6;margin:0">${t.intro}</p>
${sec(t.freeTitle, "#A8A396")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${t.feats.map((f) => row(f, false)).join("")}</table>
${sec(t.paidTitle, "#DCBB72")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${t.paid.map((f) => row(f, true)).join("")}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr><td style="border-radius:20px;padding:22px;background:#1D1C19;border:1.5px solid rgba(220,187,114,.55)" align="center">
<div style="display:inline-block;background:#DCBB72;color:#0B0B0A;font-family:Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;padding:5px 12px;border-radius:999px">${P.badge}</div>
<div style="font-family:${F};color:#DCBB72;font-size:28px;font-weight:800;margin-top:12px">${P.l1}</div>
<div style="font-family:${F};color:#A8A396;font-size:13px;margin-top:3px">${P.d1}</div>
<div style="margin-top:18px"><a href="${OFFER}" style="display:inline-block;padding:13px 24px;border-radius:999px;border:1.5px solid #DCBB72;font-family:${F};font-weight:700;font-size:14px;color:#DCBB72;text-decoration:none">${P.btn}</a></div>
</td></tr></table>
<p style="font-family:${F};color:#D2CDC1;font-size:15px;line-height:1.6;margin:18px 0 0">${t.outro}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px" width="100%"><tr><td align="center" style="background:#DCBB72;border-radius:999px">
<a href="${CONSOLE}" style="display:block;padding:16px 26px;font-family:${F};font-weight:800;font-size:16px;color:#0B0B0A;text-decoration:none">${t.cta}</a>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:26px 10px">
<p style="font-family:${F};color:#6E6A60;font-size:12px;line-height:1.7;margin:0">${contact}<br>
Coach DM · <a href="https://coachdm.be" style="color:#6E6A60">coachdm.be</a> · <a href="https://www.instagram.com/coachdm.be" style="color:#6E6A60">@coachdm.be</a><br>
<a href="${unsub}" style="color:#6E6A60">${unsubTxt}</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: REPLY_TO }),
  });
  if (!r.ok) console.log("resend", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if (!SECRET || req.headers.get("x-push-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  if (!RESEND) return new Response(JSON.stringify({ ok: false, reason: "no_resend_key" }), { status: 200 });

  let body: { preview?: { to: string; locale?: string }; coach_welcome?: { user_id: string } } = {};
  try { body = await req.json(); } catch { /* corps vide */ }

  if (body.preview && body.preview.to) {
    const loc = L(body.preview.locale);
    const t = tpl(loc, "Coach");
    const unsub = SB_URL + "/functions/v1/email-unsub?u=preview&k=preview";
    const ok = await sendMail(body.preview.to, "[APERÇU coach_welcome/" + loc + "] " + t.subject, render(t, loc, unsub));
    return new Response(JSON.stringify({ ok, preview: true }), { status: 200 });
  }

  if (body.coach_welcome && body.coach_welcome.user_id) {
    try {
      const uid = body.coach_welcome.user_id;
      const logs = await sb(`email_log?user_id=eq.${uid}&step=eq.${STEP}&select=id`) as Array<{ id: string }>;
      if (logs && logs.length) return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
      const profs = await sb(`profiles?id=eq.${uid}&select=email,locale,full_name`) as Array<{ email: string; locale: string | null; full_name: string | null }>;
      const p = profs && profs[0];
      if (!p || !p.email) return new Response(JSON.stringify({ ok: false, reason: "no_email" }), { status: 200 });
      const loc = L(p.locale || undefined);
      const t = tpl(loc, p.full_name || "");
      const k = await hmac(uid);
      const unsub = SB_URL + "/functions/v1/email-unsub?u=" + uid + "&k=" + k;
      const ok = await sendMail(p.email, t.subject, render(t, loc, unsub));
      if (ok) await sb("email_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ user_id: uid, step: STEP }]) }).catch(() => null);
      return new Response(JSON.stringify({ ok }), { status: 200 });
    } catch (e) {
      console.log("coach_welcome err", String(e).slice(0, 300));
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }
  }
  return new Response(JSON.stringify({ ok: false, reason: "no_action" }), { status: 200 });
});
