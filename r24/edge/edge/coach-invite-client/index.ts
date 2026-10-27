// coach-invite-client v5 (25/10/2026) : securite.
// - Compte DEJA existant : plus jamais de lien de connexion (magic link) cree ni renvoye
//   au coach. La relation reste « en attente » et le membre accepte dans SON app
//   (Moi > demandes de coach). L'email l'invite simplement a ouvrir l'app.
// - Nouveau compte : lien d'invitation envoye par email (et QR pour le coach, compte neuf).
// v4 : email dans la langue du client, reply_to contact@coachdm.be.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ONBOARD_URL = "https://coachdm.be/bienvenue.html";
const APP_URL = "https://coachdm.be/app.html";
const REPLY_TO = "contact@coachdm.be";

const T: Record<string, any> = {
  fr: {
    anon: "Ton coach",
    subject: (c: string) => `${c} t'invite sur Coach DM`,
    hi: (n: string) => n ? `Bonjour ${n} 👋` : "Bonjour 👋",
    body: (c: string) => `<b>${c}</b> t'invite sur Coach DM : tes séances, ta nutrition et ton suivi, au même endroit, avec ton coach.`,
    sub: "Clique ci-dessous pour créer ton compte et compléter ton profil. Ça prend deux minutes.",
    cta: "Créer mon compte",
    subEx: "Tu as déjà un compte Coach DM : ouvre l'app, la demande t'attend. Tu choisis de l'accepter ou non.",
    ctaEx: "Ouvrir Coach DM",
    foot: "Tu ne t'attendais pas à cet email ? Ignore-le simplement, rien ne se passe sans toi.",
  },
  en: {
    anon: "Your coach",
    subject: (c: string) => `${c} invited you to Coach DM`,
    hi: (n: string) => n ? `Hi ${n} 👋` : "Hi 👋",
    body: (c: string) => `<b>${c}</b> invited you to Coach DM: your workouts, your nutrition and your progress, in one place, with your coach.`,
    sub: "Tap below to create your account and complete your profile. It takes two minutes.",
    cta: "Create my account",
    subEx: "You already have a Coach DM account: open the app, the request is waiting for you. You decide whether to accept it.",
    ctaEx: "Open Coach DM",
    foot: "Weren't expecting this email? Just ignore it, nothing happens without you.",
  },
  nl: {
    anon: "Je coach",
    subject: (c: string) => `${c} nodigt je uit op Coach DM`,
    hi: (n: string) => n ? `Hallo ${n} 👋` : "Hallo 👋",
    body: (c: string) => `<b>${c}</b> nodigt je uit op Coach DM: je trainingen, je voeding en je opvolging op één plek, samen met je coach.`,
    sub: "Klik hieronder om je account aan te maken en je profiel te vervolledigen. Het duurt twee minuten.",
    cta: "Account aanmaken",
    subEx: "Je hebt al een Coach DM-account: open de app, het verzoek wacht op je. Jij beslist of je het aanvaardt.",
    ctaEx: "Coach DM openen",
    foot: "Verwachtte je deze e-mail niet? Negeer hem gewoon, er gebeurt niets zonder jou.",
  },
};

function inviteEmail(lang: string, name: string, coachName: string, link: string, existed: boolean) {
  const t = T[lang] || T.fr;
  const f = "-apple-system,Segoe UI,Arial,sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0A"><tr><td align="center" style="padding:40px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding-bottom:24px">
<img src="https://coachdm.be/logo-dm.png" width="76" height="76" alt="Coach DM" style="border-radius:18px;display:block">
<div style="font-family:${f};color:#E9C767;font-size:12px;letter-spacing:3px;margin-top:12px;font-weight:700">POWER · TRANSFORM · EXCEL</div>
</td></tr>
<tr><td style="background:#151513;border-radius:24px;padding:34px 30px">
<h1 style="font-family:${f};color:#ffffff;font-size:24px;margin:0 0 12px">${t.hi(name)}</h1>
<p style="font-family:${f};color:#D9D4C8;font-size:16px;line-height:1.6;margin:0 0 10px">${t.body(coachName)}</p>
<p style="font-family:${f};color:#9A958A;font-size:14.5px;line-height:1.6;margin:0 0 22px">${existed ? t.subEx : t.sub}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="background:#D9B65C;border-radius:16px">
<a href="${link}" style="display:block;padding:16px 26px;font-family:${f};font-weight:800;font-size:16px;color:#0B0B0A;text-decoration:none">${existed ? t.ctaEx : t.cta}</a>
</td></tr></table>
<p style="font-family:${f};color:#6E6A61;font-size:12.5px;line-height:1.6;margin:18px 0 0">${t.foot}</p>
</td></tr>
<tr><td align="center" style="padding:24px 10px">
<p style="font-family:${f};color:#6E6A61;font-size:12px;margin:0">Coach DM · <a href="https://coachdm.be" style="color:#6E6A61">coachdm.be</a> · <a href="https://www.instagram.com/coachdm.be" style="color:#6E6A61">@coachdm.be</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ ok: false, reason: "no_auth" }, 401);

    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND = Deno.env.get("RESEND_API_KEY");

    const admin = createClient(SUPA_URL, SERVICE);
    const asCoach = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.full_name || "").trim();
    const phone = (body.phone || "").trim();
    const goal = (body.goal || "").trim();
    let lang = (body.lang || "fr").trim().toLowerCase();
    if (!["fr", "en", "nl"].includes(lang)) lang = "fr";
    if (!email) return json({ ok: false, reason: "email_required" }, 400);

    const pre = await asCoach.rpc("coach_invite_precheck");
    if (pre.error) return json({ ok: false, reason: "forbidden" }, 403);
    if (!pre.data?.ok) return json({ ok: false, reason: pre.data?.reason || "denied" }, 403);

    const { data: caller } = await admin.auth.getUser(jwt);
    const coachId = caller?.user?.id;
    const t = T[lang] || T.fr;
    let coachName = t.anon;
    if (coachId) {
      const { data: cp } = await admin.from("profiles").select("full_name,email").eq("id", coachId).single();
      if (cp?.full_name && String(cp.full_name).trim()) coachName = String(cp.full_name).trim();
      if (cp?.email && String(cp.email).toLowerCase() === email) return json({ ok: false, reason: "self" }, 400);
    }

    let existed = false;
    let actionLink: string | null = null;
    let clientId: string | null = null;

    const gen = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: name, role: "client", locale: lang }, redirectTo: ONBOARD_URL },
    });
    if (gen.error) {
      // Compte existant : AUCUN lien de connexion. On retrouve seulement son identifiant.
      existed = true;
      const safe = email.replace(/[\\%_]/g, (c: string) => "\\" + c);
      const { data: prof } = await admin.from("profiles").select("id").ilike("email", safe).limit(1).maybeSingle();
      if (!prof?.id) return json({ ok: false, reason: "not_found" }, 400);
      clientId = prof.id;
    } else {
      actionLink = gen.data?.properties?.action_link || null;
      clientId = gen.data?.user?.id || null;
    }
    if (!clientId) return json({ ok: false, reason: "no_client" }, 400);

    const link = await asCoach.rpc("coach_link_invited", {
      p_client_id: clientId, p_full_name: name, p_phone: phone, p_goal: goal,
    });
    if (link.error || !link.data?.ok) return json({ ok: false, reason: link.data?.reason || "link_rpc_failed" }, 400);

    let emailed = false, email_status = 0, email_error = "";
    if (!RESEND) { email_error = "no_resend_key"; }
    else {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coach DM <noreply@coachdm.be>",
          to: [email],
          reply_to: REPLY_TO,
          subject: t.subject(coachName),
          html: inviteEmail(lang, name, coachName, existed ? APP_URL : actionLink!, existed),
        }),
      });
      email_status = r.status;
      const txt = await r.text();
      emailed = r.ok;
      if (!r.ok) email_error = txt.slice(0, 300);
      console.log("RESEND", lang, existed ? "existing" : "new", r.status, txt.slice(0, 200));
    }

    // Le lien n'est rendu au coach (QR) que pour un compte cree a l'instant.
    return json({ ok: true, action_link: existed ? null : actionLink, client_id: clientId, existed, pending: true, emailed, email_status, email_error });
  } catch (e) {
    console.log("EXCEPTION", String(e));
    return json({ ok: false, reason: "exception", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
