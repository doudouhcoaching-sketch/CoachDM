// supabase/functions/coach-invite-client/index.ts
// Invite un client : génère le lien d'activation, pré-remplit le profil,
// crée le lien coach↔client (pending), envoie l'email brandé via Resend.
// Renvoie action_link pour le QR code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ONBOARD_URL = "https://coachdm.be/bienvenue.html";

// Email trilingue, halal-compliant, charte or/néon
function inviteEmail(name: string, coachName: string, link: string) {
  const hi = name ? name : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#050807;font-family:'Outfit',Arial,sans-serif;color:#EDE7DA">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:linear-gradient(145deg,#E9C767,#9A6E1B);line-height:56px;font-weight:800;font-size:22px;color:#3a2b08">DM</div>
      <div style="margin-top:12px;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#E9C767">COACH DM</div>
    </div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 12px">Bonjour ${hi} 👋</h1>
    <p style="font-size:15px;line-height:1.6;color:#c9c4b6;margin:0 0 8px"><b>${coachName}</b> t'invite à le rejoindre sur Coach DM — ta plateforme d'entraînement, nutrition et suivi personnalisé.</p>
    <p style="font-size:14px;line-height:1.6;color:#8A8578;margin:0 0 24px">Clique ci-dessous pour créer ton compte et compléter ton profil.</p>
    <a href="${link}" style="display:block;text-align:center;background:linear-gradient(180deg,#00FFA3,#00c47e);color:#04120a;font-weight:700;font-size:15px;text-decoration:none;padding:15px;border-radius:12px;margin-bottom:20px">Créer mon compte</a>
    <p style="font-size:12px;line-height:1.6;color:#6f6a5d;margin:0">EN — <b>${coachName}</b> invited you to join Coach DM. Click the button above to create your account.<br>
    NL — <i>${coachName} nodigt je uit voor Coach DM. Klik hierboven om je account aan te maken.</i></p>
    <hr style="border:none;border-top:1px solid #221f18;margin:24px 0">
    <p style="font-size:11px;color:#5a564c;text-align:center;margin:0">Power · Transform · Excel — coachdm.be</p>
  </div></body></html>`;
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
    // client au nom du coach appelant (pour auth.uid() dans les RPC)
    const asCoach = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.full_name || "").trim();
    const phone = (body.phone || "").trim();
    const goal = (body.goal || "").trim();
    if (!email) return json({ ok: false, reason: "email_required" }, 400);

    // 1) Précheck rôle + quota
    const pre = await asCoach.rpc("coach_invite_precheck");
    if (pre.error) return json({ ok: false, reason: "forbidden" }, 403);
    if (!pre.data?.ok) return json({ ok: false, reason: pre.data?.reason || "denied" }, 403);

    // 2) Nom du coach (pour l'email)
    const { data: caller } = await admin.auth.getUser(jwt);
    const coachId = caller?.user?.id;
    let coachName = "Ton coach";
    if (coachId) {
      const { data: cp } = await admin.from("profiles").select("full_name").eq("id", coachId).single();
      if (cp?.full_name) coachName = cp.full_name;
    }

    // 3) Générer le lien d'invitation (crée le user si nouveau)
    const gen = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: name, role: "client" }, redirectTo: ONBOARD_URL },
    });
    if (gen.error) {
      // user existe déjà → régénérer un magiclink pour le rattacher
      const alt = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: ONBOARD_URL } });
      if (alt.error) return json({ ok: false, reason: "link_failed", detail: gen.error.message }, 400);
      gen.data = alt.data as any;
    }
    const actionLink = gen.data?.properties?.action_link;
    const clientId = gen.data?.user?.id;
    if (!actionLink || !clientId) return json({ ok: false, reason: "no_link" }, 400);

    // 4) Pré-remplir profil + lien coach↔client (pending)
    const link = await asCoach.rpc("coach_link_invited", {
      p_client_id: clientId, p_full_name: name, p_phone: phone, p_goal: goal,
    });
    if (link.error || !link.data?.ok) return json({ ok: false, reason: link.data?.reason || "link_rpc_failed" }, 400);

    // 5) Email brandé via Resend (si configuré)
    let emailed = false;
    if (RESEND) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coach DM <noreply@coachdm.be>",
          to: [email],
          subject: `${coachName} t'invite sur Coach DM`,
          html: inviteEmail(name, coachName, actionLink),
        }),
      });
      emailed = r.ok;
    }

    return json({ ok: true, action_link: actionLink, client_id: clientId, emailed });
  } catch (e) {
    return json({ ok: false, reason: "exception", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
