// email-nurture v13 (25/10/2026) : nouvelle offre coach (gratuit 3 clients ; offre Coach unique,
// clients illimites, 39,99 €/mois, tarif fondateur seulement sur invitation), plus de Coach+. L'email coach (j12) pointe
// vers coachdm.be/offre-coach.html. Charte noir et or 2.4 (plus de vert), plus d'emoji dans les titres.
// Mecanique (cron, dedoublonnage, desinscription, premium_welcome, apercu) inchangee.
//
// v12 — textes reecrits le 12 octobre 2026 pour donner envie.
// v10 : pw_trial n'annonce plus de duree en jours, seule la date de fin.
// reply_to = contact@coachdm.be, jamais une adresse personnelle.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SECRET = Deno.env.get("PUSH_SECRET") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "Coach DM <noreply@coachdm.be>";
const REPLY = "contact@coachdm.be";
const APP = "https://coachdm.be/app.html";
const TARIFS = "https://coachdm.be/tarifs.html";
const OFFER = "https://coachdm.be/offre-coach.html";

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

interface Tpl { subject: string; pre: string; title: string; intro: string; feats: string[]; outro: string; cta: string; ctaUrl: string; priceCard: "member" | "coach" | false; }

const PRICE_M = {
  fr: { badge: "ABONNEMENT PREMIUM", month: "14,99 €/mois", year: "ou 149 €/an (2 mois offerts)", note: "Sans engagement · résiliable en un clic · même tarif sur le web et dans l’app" },
  en: { badge: "PREMIUM SUBSCRIPTION", month: "€14.99/month", year: "or €149/year (2 months free)", note: "No commitment · cancel in one click · same price on web and in the app" },
  nl: { badge: "PREMIUM-ABONNEMENT", month: "€14,99/maand", year: "of €149/jaar (2 maanden gratis)", note: "Zonder verbintenis · met één klik opzegbaar · zelfde prijs op web en in de app" },
};
const PRICE_C = {
  fr: { badge: "OFFRE COACH", l1: "39,99 €/mois", d1: "Clients illimités · ou 399 €/an", note: "Sans engagement · résiliable à tout moment · gratuit jusqu'à 3 clients" },
  en: { badge: "COACH PLAN", l1: "€39.99/month", d1: "Unlimited clients · or €399/year", note: "No commitment · cancel anytime · free up to 3 clients" },
  nl: { badge: "COACH-ABONNEMENT", l1: "€39,99/maand", d1: "Onbeperkt klanten · of €399/jaar", note: "Zonder verbintenis · altijd opzegbaar · gratis tot 3 klanten" },
};

const WEB_OFFER = {
  fr: { t: "Passer en Premium", b: "<b>14,99 €/mois</b> ou <b>149 €/an</b>, deux mois offerts. Sans engagement, résiliable en un clic.", c: "Voir les tarifs sur coachdm.be" },
  en: { t: "Go Premium", b: "<b>€14.99/month</b> or <b>€149/year</b>, two months free. No commitment, cancel in one click.", c: "See pricing on coachdm.be" },
  nl: { t: "Word Premium", b: "<b>€14,99/maand</b> of <b>€149/jaar</b>, twee maanden gratis. Zonder verbintenis, met één klik opzegbaar.", c: "Bekijk de tarieven op coachdm.be" },
};

function tpl(step: string, loc: Loc, name: string): Tpl {
  const n = name ? " " + name.split(" ")[0] : "";
  const T: Record<string, Record<Loc, Tpl>> = {
    j0: {
      fr: { subject: "Bienvenue chez Coach DM — une seule app pour tout", pre: "Ton programme, ma voix pendant la séance, ta nutrition", title: "Bienvenue" + n, intro: "Une app pour tes séances, une autre pour le chrono, une pour les calories, et YouTube pour la technique ? Ici, tout est au même endroit. Pour bien démarrer :", feats: [
        "<b>1 · Choisis ta direction</b> — un des 13 programmes, ou un objectif précis : un record à battre, ou un skill comme le muscle-up. L'app construit le reste.",
        "<b>2 · Lance ta première séance en Mode Séance</b> — je te coache à la voix, série après série : chrono, charges calculées, temps de repos. Les 2 premières séances de chaque programme sont offertes.",
        "<b>3 · Note ton premier repas</b> — en photo ou en recherche : calories, protéines, glucides et lipides, en direct.",
        "<b>Un mouvement que tu ne connais pas ?</b> — touche son nom : vidéo, consigne et bonhomme animé — et avec le premium, mes points clés et les erreurs à éviter. Même en plein WOD.",
      ], outro: "Et pour tout débloquer dès aujourd'hui — les 13 programmes, les programmes sur objectif, l'analyse vidéo IA et le Coach IA — c'est <b>14,99 €/mois</b>, ou 149 € l'année avec deux mois offerts. Sans engagement.", cta: "Ouvrir l'app", ctaUrl: APP, priceCard: "member" },
      en: { subject: "Welcome to Coach DM — one app for everything", pre: "Your program, my voice during the workout, your nutrition", title: "Welcome" + n, intro: "One app for your workouts, another for the timer, one for calories, and YouTube for technique? Here, it's all in one place. To start strong:", feats: [
        "<b>1 · Pick your direction</b> — one of the 13 programs, or a precise goal: a lift to break, or a skill like the muscle-up. The app builds the rest.",
        "<b>2 · Start your first workout in Workout Mode</b> — I coach you by voice, set after set: timer, calculated loads, rest times. The first 2 sessions of every program are free.",
        "<b>3 · Log your first meal</b> — by photo or by search: calories, protein, carbs and fat, live.",
        "<b>A movement you don't know?</b> — tap its name: video, cue and animated figure — and with premium, my key points and the mistakes to avoid. Even in the middle of a WOD.",
      ], outro: "And to unlock everything today — all 13 programs, goal-based programs, AI video analysis and the AI Coach — it's <b>€14.99/month</b>, or €149 a year with two months free. No commitment.", cta: "Open the app", ctaUrl: APP, priceCard: "member" },
      nl: { subject: "Welkom bij Coach DM — één app voor alles", pre: "Je programma, mijn stem tijdens de training, je voeding", title: "Welkom" + n, intro: "Eén app voor je trainingen, een andere voor de timer, een voor calorieën, en YouTube voor de techniek? Hier staat alles op één plek. Om goed te starten:", feats: [
        "<b>1 · Kies je richting</b> — een van de 13 programma's, of een precies doel: een record om te breken, of een skill zoals de muscle-up. De app bouwt de rest.",
        "<b>2 · Start je eerste training in de Trainingsmodus</b> — ik coach je met mijn stem, set na set: timer, berekende gewichten, rusttijden. De eerste 2 sessies van elk programma zijn gratis.",
        "<b>3 · Noteer je eerste maaltijd</b> — met een foto of via zoeken: calorieën, eiwitten, koolhydraten en vetten, live.",
        "<b>Een beweging die je niet kent?</b> — tik op de naam: video, aanwijzing en geanimeerd mannetje — en met premium mijn kernpunten en de fouten om te vermijden. Zelfs midden in een WOD.",
      ], outro: "En om vandaag alles te ontgrendelen — de 13 programma's, de programma's op doel, de AI-videoanalyse en de AI-coach — kost het <b>€14,99/maand</b>, of €149 per jaar met twee maanden gratis. Zonder verbintenis.", cta: "Open de app", ctaUrl: APP, priceCard: "member" },
    },
    j2: {
      fr: { subject: "Comme si j'étais à côté de toi", pre: "Ma voix, le chrono, ton score : le Mode Séance", title: "Je te coache, même quand je ne suis pas là", intro: "Le Mode Séance, c'est ce qui fait la différence avec les autres apps. Tu lances ta séance, et c'est moi que tu entends :", feats: [
        "<b>Ma voix, enregistrée par moi</b> — la série, les reps, la consigne qui compte, au bon moment. Pas une voix de robot.",
        "<b>Le WOD comme à la box</b> — échauffement, skill, WOD, retour au calme. Chrono géant, « 10 secondes », 3-2-1… « Time ! »",
        "<b>Le scaling intégré</b> — un mouvement trop dur aujourd'hui ? Une version plus simple en un tap. Et ton score en RX, Intermédiaire ou Scaled.",
        "<b>Tes charges calculées</b> — en % de ton record, avec les disques à mettre sur la barre, et ton 1RM qui se met à jour tout seul.",
        "<b>Ta carte story</b> — à la fin, une belle image de ta séance à partager. Tu l'as méritée.",
      ], outro: "Je n'ai vu aucune autre app grand public le faire avec la voix d'un vrai coach. Essaie-le sur tes 2 séances offertes.", cta: "Lancer une séance", ctaUrl: APP, priceCard: "member" },
      en: { subject: "As if I were right next to you", pre: "My voice, the clock, your score: Workout Mode", title: "I coach you, even when I'm not there", intro: "Workout Mode is what sets Coach DM apart from other apps. You start your session, and it's me you hear:", feats: [
        "<b>My voice, recorded by me</b> — the set, the reps, the cue that matters, at the right moment. Not a robot voice.",
        "<b>The WOD like at the box</b> — warm-up, skill, WOD, cool-down. Giant clock, “10 seconds”, 3-2-1… “Time!”",
        "<b>Built-in scaling</b> — a movement too hard today? An easier version in one tap. And your score as RX, Intermediate or Scaled.",
        "<b>Your loads calculated</b> — as a % of your record, with the plates to load on the bar, and your 1RM updating by itself.",
        "<b>Your story card</b> — at the end, a great-looking image of your workout to share. You earned it.",
      ], outro: "I haven't seen any other mainstream app do this with a real coach's voice. Try it on your 2 free sessions.", cta: "Start a workout", ctaUrl: APP, priceCard: "member" },
      nl: { subject: "Alsof ik naast je sta", pre: "Mijn stem, de klok, je score: de Trainingsmodus", title: "Ik coach je, ook als ik er niet ben", intro: "De Trainingsmodus maakt het verschil met andere apps. Je start je training, en het is mij die je hoort:", feats: [
        "<b>Mijn stem, door mij opgenomen</b> — de set, de repetities, de aanwijzing die telt, op het juiste moment. Geen robotstem.",
        "<b>De WOD zoals in de box</b> — opwarming, skill, WOD, cooling-down. Reuzenklok, „10 seconden”, 3-2-1… „Time!”",
        "<b>Scaling ingebouwd</b> — een beweging vandaag te zwaar? Een eenvoudigere versie met één tik. En je score in RX, Gemiddeld of Scaled.",
        "<b>Je gewichten berekend</b> — in % van je record, met de schijven die op de stang moeten, en je 1RM die zichzelf bijwerkt.",
        "<b>Je storykaart</b> — op het einde een mooie afbeelding van je training om te delen. Je hebt ze verdiend.",
      ], outro: "Ik heb geen enkele andere app voor het grote publiek gezien die dit doet met de stem van een echte coach. Probeer het op je 2 gratis sessies.", cta: "Start een training", ctaUrl: APP, priceCard: "member" },
    },
    j5: {
      fr: { subject: "13 programmes. Ou le tien, construit sur ton objectif.", pre: "478 séances · ton record 1RM · 15 skills de gym", title: "Un plan, pas de l'improvisation", intro: "Le premium Coach DM, ce sont d'abord des programmes construits comme je les construis pour mes clients :", feats: [
        "<b>13 programmes · 478 séances, dans l'app, avec ma voix</b> — pas des PDF : je te coache séance après séance. Foundation, Physique, Barbell Strength, Gravity, Open Prep, Hyrox Engine, Engine AMRAP, Metcon EMOM, Fat Burner, Football Elite, et les nouveaux <b>BOOTY 10W</b>, <b>CORE STRENGTH 8W</b> et <b>RUN 10K 12W</b> (de zéro à 10 km)",
        "<b>Ton record, ton programme</b> — squat, deadlift, bench, clean & jerk, snatch… Tu entres ton record et ta cible : l'app calcule chaque charge sur 8 semaines, et te dit si ta cible est réaliste dans le temps que tu as.",
        "<b>15 skills de gym</b> — strict pull-up, kipping, chest-to-bar, butterfly, toes-to-bar, bar et ring muscle-up, handstand push-up, handstand walk, double-under, rope climb, pistol, L-sit, ring dip, wall walk. Les éducatifs dans le bon ordre, test à la fin.",
        "<b>Rien au hasard</b> — échauffement complet, charges en % de ton 1RM, semaines de décharge, et le scaling quand un mouvement est trop dur.",
      ], outro: "Les 2 premières séances de chaque programme restent offertes : essaie avant de décider.", cta: "Voir les programmes", ctaUrl: APP, priceCard: "member" },
      en: { subject: "13 programs. Or yours, built on your goal.", pre: "478 sessions · your 1RM record · 15 gymnastics skills", title: "A plan, not guesswork", intro: "Coach DM premium starts with programs built the way I build them for my clients:", feats: [
        "<b>13 programs · 478 sessions, in the app, with my voice</b> — not PDFs: I coach you session after session. Foundation, Physique, Barbell Strength, Gravity, Open Prep, Hyrox Engine, Engine AMRAP, Metcon EMOM, Fat Burner, Football Elite, and the new <b>BOOTY 10W</b>, <b>CORE STRENGTH 8W</b> and <b>RUN 10K 12W</b> (zero to 10 km)",
        "<b>Your record, your program</b> — squat, deadlift, bench, clean & jerk, snatch… Enter your record and your target: the app calculates every load over 8 weeks, and tells you whether your target is realistic in the time you have.",
        "<b>15 gymnastics skills</b> — strict pull-up, kipping, chest-to-bar, butterfly, toes-to-bar, bar and ring muscle-up, handstand push-up, handstand walk, double-under, rope climb, pistol, L-sit, ring dip, wall walk. Drills in the right order, tested at the end.",
        "<b>Nothing left to chance</b> — full warm-up, loads as a % of your 1RM, deload weeks, and scaling when a movement is too hard.",
      ], outro: "The first 2 sessions of every program stay free: try before you decide.", cta: "See the programs", ctaUrl: APP, priceCard: "member" },
      nl: { subject: "13 programma's. Of het jouwe, gebouwd op je doel.", pre: "478 sessies · je 1RM-record · 15 gymnastiek-skills", title: "Een plan, geen improvisatie", intro: "Coach DM premium, dat zijn eerst en vooral programma's gebouwd zoals ik ze voor mijn klanten bouw:", feats: [
        "<b>13 programma's · 478 sessies, in de app, met mijn stem</b> — geen pdf's: ik coach je sessie na sessie. Foundation, Physique, Barbell Strength, Gravity, Open Prep, Hyrox Engine, Engine AMRAP, Metcon EMOM, Fat Burner, Football Elite, en de nieuwe <b>BOOTY 10W</b>, <b>CORE STRENGTH 8W</b> en <b>RUN 10K 12W</b> (van nul naar 10 km)",
        "<b>Jouw record, jouw programma</b> — squat, deadlift, bench, clean & jerk, snatch… Je geeft je record en je doel in: de app berekent elk gewicht over 8 weken, en zegt je of je doel haalbaar is in de tijd die je hebt.",
        "<b>15 gymnastiek-skills</b> — strict pull-up, kipping, chest-to-bar, butterfly, toes-to-bar, bar en ring muscle-up, handstand push-up, handstand walk, double-under, rope climb, pistol, L-sit, ring dip, wall walk. De oefeningen in de juiste volgorde, met een test op het einde.",
        "<b>Niets aan het toeval overgelaten</b> — volledige opwarming, gewichten in % van je 1RM, deloadweken, en scaling als een beweging te zwaar is.",
      ], outro: "De eerste 2 sessies van elk programma blijven gratis: probeer voor je beslist.", cta: "Bekijk de programma's", ctaUrl: APP, priceCard: "member" },
    },
    j8: {
      fr: { subject: "Tu paies combien d'apps ? Ici, une seule suffit.", pre: "WOD, carnet, nutrition, technique, Coach IA : 14,99 €/mois", title: "Une seule app au lieu de dix", intro: "Fais le compte de ce que tu utilises aujourd'hui. Avec le premium Coach DM :", feats: [
        "<b>Ton app de WOD et de chrono</b> → le Mode Séance : AMRAP, EMOM, For Time, score RX / Intermédiaire / Scaled et carte story",
        "<b>Ton carnet de muscu</b> → séries cochées, charges, records, et ton 1RM calculé automatiquement",
        "<b>Ton app de calories</b> → plus de 750 aliments, photo de repas IA, 100 recettes, historique de deux mois",
        "<b>YouTube pour la technique</b> → plus de 420 mouvements avec vidéo, mes points clés, les erreurs fréquentes et le bonhomme animé",
        "<b>Tes programmes en PDF ou sur Excel</b> → 13 programmes vivants dans l'app, où je te coache avec ma voix séance après séance, et des programmes sur objectif qui se construisent tout seuls",
        "<b>Un coach dans ta poche</b> → le Coach IA, qui connaît tes séances et répond avec ma méthode, et 5 analyses vidéo IA : squat, saut, barre, course, HYROX",
      ], outro: "Tout ça pour le prix d'un seul abonnement. Sans engagement : tu résilies en un clic, et tu gardes l'accès jusqu'à la fin de la période payée.", cta: "Passer au premium", ctaUrl: TARIFS, priceCard: "member" },
      en: { subject: "How many apps are you paying for? Here, one is enough.", pre: "WOD, log, nutrition, technique, AI Coach: €14.99/month", title: "One app instead of ten", intro: "Count what you use today. With Coach DM premium:", feats: [
        "<b>Your WOD and timer app</b> → Workout Mode: AMRAP, EMOM, For Time, RX / Intermediate / Scaled score and story card",
        "<b>Your lifting log</b> → sets ticked off, loads, PRs, and your 1RM calculated automatically",
        "<b>Your calorie app</b> → over 750 foods, AI meal photo, 100 recipes, two-month history",
        "<b>YouTube for technique</b> → over 420 movements with video, my key points, common mistakes and the animated figure",
        "<b>Your programs in a PDF or a spreadsheet</b> → 13 live programs in the app, where I coach you with my voice session after session, and goal-based programs that build themselves",
        "<b>A coach in your pocket</b> → the AI Coach, which knows your workouts and answers with my method, and 5 AI video analyses: squat, jump, barbell, running, HYROX",
      ], outro: "All of this for the price of a single subscription. No commitment: cancel in one click, and keep access until the end of the period you paid for.", cta: "Go premium", ctaUrl: TARIFS, priceCard: "member" },
      nl: { subject: "Voor hoeveel apps betaal je? Hier volstaat er één.", pre: "WOD, logboek, voeding, techniek, AI-coach: €14,99/maand", title: "Eén app in plaats van tien", intro: "Tel eens wat je vandaag gebruikt. Met Coach DM premium:", feats: [
        "<b>Je WOD- en timerapp</b> → de Trainingsmodus: AMRAP, EMOM, For Time, score in RX / Gemiddeld / Scaled en storykaart",
        "<b>Je krachtlogboek</b> → afgevinkte sets, gewichten, records, en je 1RM automatisch berekend",
        "<b>Je calorie-app</b> → meer dan 750 voedingsmiddelen, AI-maaltijdfoto, 100 recepten, geschiedenis van twee maanden",
        "<b>YouTube voor de techniek</b> → meer dan 420 bewegingen met video, mijn kernpunten, de vaakste fouten en het geanimeerde mannetje",
        "<b>Je programma's in pdf of Excel</b> → 13 levende programma's in de app, waar ik je met mijn stem coach, sessie na sessie, en programma's op doel die zichzelf bouwen",
        "<b>Een coach op zak</b> → de AI-coach, die je trainingen kent en antwoordt met mijn methode, en 5 AI-videoanalyses: squat, sprong, barbell, lopen, HYROX",
      ], outro: "Dat alles voor de prijs van één enkel abonnement. Zonder verbintenis: met één klik opzegbaar, en je behoudt toegang tot het einde van de betaalde periode.", cta: "Ga premium", ctaUrl: TARIFS, priceCard: "member" },
    },
    j12: {
      fr: { subject: "Tu coaches ? Coach DM est aussi ton outil de travail", pre: "Gratuit jusqu'à 3 clients · clients illimités avec l'offre Coach", title: "Le côté coach de Coach DM", intro: "Si tu accompagnes des sportifs — en salle ou à distance — il y a une console pro pensée pour toi, sur ordinateur, tablette et téléphone. <b>Gratuit jusqu'à 3 clients</b> :", feats: [
        "<b>Tes clients dans l'app</b> — tu les invites par email, ils acceptent dans leur app",
        "<b>La messagerie</b> — tu parles à tes clients, ils reçoivent leurs notifications sur iPhone et Android",
        "<b>Tes séances, programmes et plans repas</b> — que tu construis toi-même, et qu'ils retrouvent dans leur app",
        "<b>Leur suivi complet</b> — séances faites, charges, repas notés, bilans",
        "<b>Avec l'offre Coach</b> — clients illimités, les programmes Coach DM prêts à envoyer, l'assistant qui crée les programmes, la nutrition au gramme près, les visios et les vidéos",
      ], outro: "Tu commences gratuitement avec 3 clients, sans limite de durée. Pas coach ? Ignore simplement cet email.", cta: "Découvrir l'offre Coach", ctaUrl: OFFER, priceCard: "coach" },
      en: { subject: "Do you coach? Coach DM is your work tool too", pre: "Free up to 3 clients · unlimited clients with the Coach plan", title: "The coach side of Coach DM", intro: "If you train people — in the gym or remotely — there's a pro console built for you, on computer, tablet and phone. <b>Free up to 3 clients</b>:", feats: [
        "<b>Your clients in the app</b> — invite them by email, they accept in their app",
        "<b>Messaging</b> — talk to your clients, they get notifications on iPhone and Android",
        "<b>Your workouts, programs and meal plans</b> — built by you, right in their app",
        "<b>Their full tracking</b> — completed workouts, loads, logged meals, check-ins",
        "<b>With the Coach plan</b> — unlimited clients, ready-to-send Coach DM programs, the program assistant, nutrition to the gram, video calls and videos",
      ], outro: "You start free with 3 clients, with no time limit. Not a coach? Just ignore this email.", cta: "See the Coach plan", ctaUrl: OFFER, priceCard: "coach" },
      nl: { subject: "Coach jij? Coach DM is ook jouw werktool", pre: "Gratis tot 3 klanten · onbeperkt klanten met het Coach-abonnement", title: "De coachkant van Coach DM", intro: "Begeleid je sporters — in de zaal of op afstand — dan is er een pro console voor jou, op computer, tablet en telefoon. <b>Gratis tot 3 klanten</b>:", feats: [
        "<b>Je klanten in de app</b> — nodig ze uit per e-mail, ze aanvaarden in hun app",
        "<b>Berichten</b> — je praat met je klanten, ze krijgen meldingen op iPhone en Android",
        "<b>Je trainingen, programma's en maaltijdplannen</b> — zelf opgebouwd, rechtstreeks in hun app",
        "<b>Hun volledige opvolging</b> — gedane trainingen, gewichten, genoteerde maaltijden, check-ins",
        "<b>Met het Coach-abonnement</b> — onbeperkt klanten, de Coach DM-programma's klaar om te sturen, de programma-assistent, voeding tot op de gram, videogesprekken en video's",
      ], outro: "Je begint gratis met 3 klanten, zonder tijdslimiet. Geen coach? Negeer deze e-mail gewoon.", cta: "Bekijk het Coach-abonnement", ctaUrl: OFFER, priceCard: "coach" },
    },
    j21: {
      fr: { subject: "Deux façons de passer un cap", pre: "Le premium en autonomie, ou un vrai suivi avec moi", title: "À toi de choisir la suite", intro: "Je ne vais pas te noyer de messages. Si tu es là depuis trois semaines, voici simplement les deux façons d'aller plus loin :", feats: [
        "<b>Premium, en autonomie</b> — les 13 programmes, tes programmes sur objectif, le Mode Séance avec ma voix, l'analyse vidéo IA, le Coach IA et la nutrition complète. 14,99 €/mois, sans engagement.",
        "<b>Coaching en ligne avec moi</b> — un programme fait pour toi, mes corrections sur tes vidéos, ta nutrition et un vrai suivi, directement dans l'app. Avec une réduction spéciale pour les membres de l'app.",
      ], outro: "C'est une aventure : on construit d'abord les fondations, et c'est dans la constance que le corps change. Dans les deux cas, je suis là. Bon entraînement.", cta: "Voir les options", ctaUrl: TARIFS, priceCard: "member" },
      en: { subject: "Two ways to level up", pre: "Self-guided premium, or real follow-up with me", title: "You choose what's next", intro: "I won't flood you with messages. If you've been here for three weeks, here are simply the two ways to go further:", feats: [
        "<b>Premium, self-guided</b> — all 13 programs, your goal-based programs, Workout Mode with my voice, AI video analysis, the AI Coach and full nutrition. €14.99/month, no commitment.",
        "<b>Online coaching with me</b> — a program made for you, my corrections on your videos, your nutrition and real follow-up, right inside the app. With a special discount for app members.",
      ], outro: "It's a journey: we build the foundations first, and consistency is where the body changes. Either way, I'm here. Train hard.", cta: "See the options", ctaUrl: TARIFS, priceCard: "member" },
      nl: { subject: "Twee manieren om een stap verder te gaan", pre: "Premium op eigen houtje, of echte begeleiding met mij", title: "Jij kiest het vervolg", intro: "Ik ga je niet overspoelen met berichten. Ben je hier al drie weken, dan zijn dit simpelweg de twee manieren om verder te gaan:", feats: [
        "<b>Premium, op eigen houtje</b> — de 13 programma's, je programma's op doel, de Trainingsmodus met mijn stem, de AI-videoanalyse, de AI-coach en volledige voeding. €14,99/maand, zonder verbintenis.",
        "<b>Online coaching met mij</b> — een programma op jouw maat, mijn correcties op je video's, je voeding en echte opvolging, rechtstreeks in de app. Met een speciale korting voor leden van de app.",
      ], outro: "Het is een avontuur: eerst bouwen we de fundamenten, en in de regelmaat verandert je lichaam. In beide gevallen ben ik er. Train hard.", cta: "Bekijk de opties", ctaUrl: TARIFS, priceCard: "member" },
    },
    pw: {
      fr: { subject: "Bienvenue dans le premium — tout est débloqué", pre: "Ton accès complet est actif", title: "C'est débloqué" + n, intro: "Merci pour ta confiance. Ton accès premium est actif — voici par où commencer dès aujourd'hui :", feats: [
        "<b>1 · Choisis ta direction</b> — un des 13 programmes (478 séances), ou ton objectif dans Séances › Mes objectifs : un record à battre ou un des 15 skills de gym",
        "<b>2 · Lance le Mode Séance</b> — ma voix, le chrono, tes charges calculées, et ta carte story à la fin",
        "<b>3 · Teste l'IA</b> — filme ton squat pour une analyse, prends ton repas en photo, ou pose ta question au Coach IA",
        "<b>Gère ton abonnement</b> — à tout moment depuis Profil › Abonnement",
      ], outro: "Une question, un souci, une idée ? Réponds à cet email — je lis tout. Power · Transform · Excel.", cta: "Ouvrir l'app", ctaUrl: APP, priceCard: false },
      en: { subject: "Welcome to premium — everything is unlocked", pre: "Your full access is active", title: "You're in" + n, intro: "Thank you for your trust. Your premium access is active — here's where to start today:", feats: [
        "<b>1 · Pick your direction</b> — one of the 13 programs (478 sessions), or your goal in Workouts › My goals: a lift to break or one of the 15 gymnastics skills",
        "<b>2 · Start Workout Mode</b> — my voice, the clock, your calculated loads, and your story card at the end",
        "<b>3 · Try the AI</b> — film your squat for an analysis, snap your meal, or ask the AI Coach your question",
        "<b>Manage your subscription</b> — anytime from Profile › Subscription",
      ], outro: "A question, an issue, an idea? Reply to this email — I read everything. Power · Transform · Excel.", cta: "Open the app", ctaUrl: APP, priceCard: false },
      nl: { subject: "Welkom bij premium — alles is ontgrendeld", pre: "Je volledige toegang is actief", title: "Je bent binnen" + n, intro: "Bedankt voor je vertrouwen. Je premium-toegang is actief — hier begin je vandaag:", feats: [
        "<b>1 · Kies je richting</b> — een van de 13 programma's (478 sessies), of je doel in Trainingen › Mijn doelen: een record om te breken of een van de 15 gymnastiek-skills",
        "<b>2 · Start de Trainingsmodus</b> — mijn stem, de klok, je berekende gewichten, en je storykaart op het einde",
        "<b>3 · Probeer de AI</b> — film je squat voor een analyse, fotografeer je maaltijd, of stel je vraag aan de AI-coach",
        "<b>Beheer je abonnement</b> — altijd via Profiel › Abonnement",
      ], outro: "Een vraag, een probleem, een idee? Antwoord op deze e-mail — ik lees alles. Power · Transform · Excel.", cta: "Open de app", ctaUrl: APP, priceCard: false },
    },
    pw_trial: {
      fr: { subject: "Ton accès complet à Coach DM est activé", pre: "Accès complet jusqu'au {UNTIL}", title: "Accès complet activé" + n, intro: "Ton coach t'a offert l'accès complet à Coach DM, jusqu'au <b>{UNTIL}</b>. Voici par où commencer dès aujourd'hui :", feats: [
        "<b>1 · Choisis ta direction</b> — un des 13 programmes (478 séances), ou ton objectif dans Séances › Mes objectifs : un record à battre ou un des 15 skills de gym",
        "<b>2 · Lance le Mode Séance</b> — ma voix, le chrono, tes charges calculées, et ta carte story à la fin",
        "<b>3 · Teste l'IA</b> — filme ton squat pour une analyse, prends ton repas en photo, ou pose ta question au Coach IA",
      ], outro: "Le <b>{UNTIL}</b>, ton compte repasse automatiquement en accès gratuit limité — aucun prélèvement, aucune action de ta part. Si tu veux garder l'accès complet, tu peux passer au premium à tout moment depuis Profil › Abonnement.", cta: "Ouvrir l'app", ctaUrl: APP, priceCard: false },
      en: { subject: "Your full access to Coach DM is active", pre: "Full access until {UNTIL}", title: "Full access activated" + n, intro: "Your coach has given you full access to Coach DM, until <b>{UNTIL}</b>. Here's where to start today:", feats: [
        "<b>1 · Pick your direction</b> — one of the 13 programs (478 sessions), or your goal in Workouts › My goals: a lift to break or one of the 15 gymnastics skills",
        "<b>2 · Start Workout Mode</b> — my voice, the clock, your calculated loads, and your story card at the end",
        "<b>3 · Try the AI</b> — film your squat for an analysis, snap your meal, or ask the AI Coach your question",
      ], outro: "On <b>{UNTIL}</b>, your account automatically returns to limited free access — no charge, no action needed. If you want to keep full access, you can go premium anytime from Profile › Subscription.", cta: "Open the app", ctaUrl: APP, priceCard: false },
      nl: { subject: "Je volledige toegang tot Coach DM is actief", pre: "Volledige toegang tot {UNTIL}", title: "Volledige toegang geactiveerd" + n, intro: "Je coach heeft je volledige toegang tot Coach DM gegeven, tot <b>{UNTIL}</b>. Hier begin je vandaag:", feats: [
        "<b>1 · Kies je richting</b> — een van de 13 programma's (478 sessies), of je doel in Trainingen › Mijn doelen: een record om te breken of een van de 15 gymnastiek-skills",
        "<b>2 · Start de Trainingsmodus</b> — mijn stem, de klok, je berekende gewichten, en je storykaart op het einde",
        "<b>3 · Probeer de AI</b> — film je squat voor een analyse, fotografeer je maaltijd, of stel je vraag aan de AI-coach",
      ], outro: "Op <b>{UNTIL}</b> keert je account automatisch terug naar beperkte gratis toegang — geen kosten, geen actie nodig. Wil je volledige toegang behouden? Ga dan op elk moment naar premium via Profiel › Abonnement.", cta: "Open de app", ctaUrl: APP, priceCard: false },
    },
  };
  return (T[step] || T.j0)[loc];
}

function prospectize(t: Tpl, step: string, loc: Loc): Tpl {
  const cta = { fr: "Créer mon compte gratuit", en: "Create my free account", nl: "Mijn gratis account aanmaken" }[loc];
  const out = { ...t, cta, ctaUrl: APP };
  if (step === "j0") {
    out.title = { fr: "Découvre Coach DM", en: "Discover Coach DM", nl: "Ontdek Coach DM" }[loc];
    out.intro = { fr: "L'app d'entraînement et de nutrition de Coach DM est ouverte. L'inscription est gratuite — voici ce qui t'attend dès la première minute :", en: "Coach DM's training and nutrition app is open. Signing up is free — here's what's waiting from minute one:", nl: "De training- en voedingsapp van Coach DM is open. Inschrijven is gratis — dit wacht op je vanaf minuut één:" }[loc];
    out.subject = { fr: "Coach DM — ton app d'entraînement t'attend", en: "Coach DM — your training app awaits", nl: "Coach DM — jouw trainingsapp wacht" }[loc];
  }
  return out;
}

function fillDate(t: Tpl, untilStr: string): Tpl {
  const swap = (s: string) => s.split("{UNTIL}").join(untilStr);
  return { ...t, pre: swap(t.pre), intro: swap(t.intro), outro: swap(t.outro) };
}

const F = "-apple-system,Segoe UI,Arial,sans-serif";
function render(t: Tpl, loc: Loc, unsub: string, webOffer = true): string {
  const unsubTxt = { fr: "Se désinscrire de ces emails", en: "Unsubscribe from these emails", nl: "Afmelden voor deze e-mails" }[loc];
  const contact = { fr: "Questions ? Réponds simplement à cet email.", en: "Questions? Just reply to this email.", nl: "Vragen? Antwoord gewoon op deze e-mail." }[loc];
  const feats = t.feats.map((f) =>
    `<tr><td style="width:26px;vertical-align:top;padding:7px 0"><div style="width:18px;height:18px;border-radius:50%;background:rgba(220,187,114,.2);color:#DCBB72;font-size:11px;line-height:18px;text-align:center;font-family:Arial,sans-serif">&#10003;</div></td><td style="padding:6px 0 6px 8px;font-family:${F};color:#D2CDC1;font-size:15px;line-height:1.55">${f}</td></tr>`
  ).join("");
  let priceCard = "";
  if (t.priceCard === "member") {
    const P = PRICE_M[loc];
    priceCard = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border:1.5px solid rgba(220,187,114,.55);border-radius:20px;padding:20px 22px;background:#1D1C19" align="center">
<div style="display:inline-block;background:#DCBB72;color:#0B0B0A;font-family:Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;padding:5px 12px;border-radius:999px">${P.badge}</div>
<div style="font-family:${F};color:#DCBB72;font-size:34px;font-weight:800;margin-top:12px">${P.month}</div>
<div style="font-family:${F};color:#A8A396;font-size:14px;margin-top:4px">${P.year}</div>
<div style="font-family:${F};color:#6E6A60;font-size:12px;margin-top:10px">${P.note}</div>
</td></tr></table>`;
  } else if (t.priceCard === "coach") {
    const P = PRICE_C[loc];
    priceCard = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border:1.5px solid rgba(220,187,114,.55);border-radius:20px;padding:20px 22px;background:#1D1C19" align="center">
<div style="display:inline-block;background:#DCBB72;color:#0B0B0A;font-family:Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;padding:5px 12px;border-radius:999px">${P.badge}</div>
<div style="font-family:${F};color:#DCBB72;font-size:30px;font-weight:800;margin-top:12px">${P.l1}</div>
<div style="font-family:${F};color:#A8A396;font-size:13px;margin-top:3px">${P.d1}</div>
<div style="font-family:${F};color:#6E6A60;font-size:12px;margin-top:10px">${P.note}</div>
</td></tr></table>`;
  }
  let offerBand = "";
  if (webOffer && t.priceCard !== "coach") {
    const W = WEB_OFFER[loc];
    offerBand = `
<tr><td style="padding-top:14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#151513;border:1px dashed rgba(220,187,114,.5);border-radius:20px;padding:20px 22px" align="center">
<div style="font-family:${F};color:#DCBB72;font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase">${W.t}</div>
<div style="font-family:${F};color:#D2CDC1;font-size:15px;line-height:1.6;margin-top:8px">${W.b}</div>
<div style="margin-top:14px"><a href="${TARIFS}" style="display:inline-block;padding:12px 22px;border-radius:999px;border:1.5px solid #DCBB72;font-family:${F};font-weight:700;font-size:14px;color:#DCBB72;text-decoration:none">${W.c}</a></div>
</td></tr></table>
</td></tr>`;
  }
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
<p style="font-family:${F};color:#D2CDC1;font-size:16px;line-height:1.6;margin:0 0 16px">${t.intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${feats}</table>
<p style="font-family:${F};color:#D2CDC1;font-size:15px;line-height:1.6;margin:16px 0 0">${t.outro}</p>
${priceCard}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px" width="100%"><tr><td align="center" style="background:#DCBB72;border-radius:999px">
<a href="${t.ctaUrl}" style="display:block;padding:16px 26px;font-family:${F};font-weight:800;font-size:16px;color:#0B0B0A;text-decoration:none">${t.cta}</a>
</td></tr></table>
</td></tr>
${offerBand}
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
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: REPLY }),
  });
  if (!r.ok) console.log("resend", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if (!SECRET || req.headers.get("x-push-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  if (!RESEND) return new Response(JSON.stringify({ ok: false, reason: "no_resend_key" }), { status: 200 });
  let body: { preview?: { step: string; locale?: string; to: string; prospect?: boolean }; premium_welcome?: { user_id: string; trial?: boolean; trial_end?: string } } = {};
  try { body = await req.json(); } catch { /* cron */ }

  if (body.preview && body.preview.to && body.preview.step) {
    const loc = L(body.preview.locale);
    let t = tpl(body.preview.step, loc, "Coach");
    if (body.preview.step === "pw_trial") {
      const until = new Date(Date.now() + 7 * 86400000);
      const untilStr = until.toLocaleDateString(loc === "fr" ? "fr-BE" : loc === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
      t = fillDate(t, untilStr);
    }
    if (body.preview.prospect) t = prospectize(t, body.preview.step, loc);
    const unsub = SB_URL + "/functions/v1/email-unsub?u=preview&k=preview";
    const ok = await sendMail(body.preview.to, "[APERÇU " + body.preview.step + (body.preview.prospect ? "-prospect" : "") + "/" + loc + "] " + t.subject, render(t, loc, unsub, body.preview.step !== "pw" && body.preview.step !== "pw_trial"));
    return new Response(JSON.stringify({ ok, preview: body.preview.step }), { status: 200 });
  }

  if (body.premium_welcome && body.premium_welcome.user_id) {
    try {
      const uid = body.premium_welcome.user_id;
      const isTrial = !!body.premium_welcome.trial;
      const step = isTrial ? "pw_trial" : "pw";
      const logs = await sb(`email_log?user_id=eq.${uid}&step=eq.${step}&select=id`) as Array<{ id: string }>;
      if (logs && logs.length) return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
      const profs = await sb(`profiles?id=eq.${uid}&select=email,locale,full_name`) as Array<{ email: string; locale: string | null; full_name: string | null }>;
      const p = profs && profs[0];
      if (!p || !p.email) return new Response(JSON.stringify({ ok: false, reason: "no_email" }), { status: 200 });
      const loc = L(p.locale || undefined);
      let t = tpl(step, loc, p.full_name || "");
      if (isTrial && body.premium_welcome.trial_end) {
        const d = new Date(body.premium_welcome.trial_end);
        const untilStr = d.toLocaleDateString(loc === "fr" ? "fr-BE" : loc === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
        t = fillDate(t, untilStr);
      }
      const k = await hmac(uid);
      const unsub = SB_URL + "/functions/v1/email-unsub?u=" + uid + "&k=" + k;
      const ok = await sendMail(p.email, t.subject, render(t, loc, unsub, false));
      if (ok) await sb("email_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ user_id: uid, step }]) }).catch(() => null);
      return new Response(JSON.stringify({ ok }), { status: 200 });
    } catch (e) {
      console.log("pw err", String(e).slice(0, 300));
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }
  }

  try {
    const due = await sb("rpc/email_nurture_due", { method: "POST", body: "{}" }) as Array<{ kind: string; target_id: string; email: string; locale: string; full_name: string; step: string }>;
    let sent = 0, failed = 0;
    for (const u of (due || [])) {
      const loc = L(u.locale);
      let t = tpl(u.step, loc, u.full_name || "");
      const isProspect = u.kind === "prospect";
      if (isProspect) t = prospectize(t, u.step, loc);
      const k = await hmac(isProspect ? "p:" + u.target_id : u.target_id);
      const unsub = SB_URL + "/functions/v1/email-unsub?" + (isProspect ? "p=" : "u=") + u.target_id + "&k=" + k;
      const ok = await sendMail(u.email, t.subject, render(t, loc, unsub, u.step !== "pw"));
      if (ok) {
        sent++;
        if (isProspect) {
          await sb("email_prospect_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ prospect_id: u.target_id, step: u.step }]) }).catch(() => null);
        } else {
          await sb("email_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ user_id: u.target_id, step: u.step }]) }).catch(() => null);
        }
      } else failed++;
    }
    return new Response(JSON.stringify({ ok: true, sent, failed, due: (due || []).length }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("nurture err", String(e).slice(0, 300));
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
