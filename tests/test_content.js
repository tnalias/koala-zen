// Tests fonctionnels de content.js, le rappel affiche dans la page.
// Le code du produit est charge tel quel, seules les DUREES sont raccourcies
// pour que la campagne tienne en quelques secondes.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];

function verifie(nom, condition, detail) {
  if (condition) ok++;
  else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

const MSG = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales/fr/messages.json"), "utf8"));
function t(cle) { return (MSG[cle] || {}).message || ""; }

// Raccourcis de duree, uniquement pour le test.
function sourceRapide() {
  let s = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  const remplacements = [
    ["arrive: 240", "arrive: 20"],
    ["bubble: 180", "bubble: 20"],
    ["line: 60", "line: 5"],
    ["check: 300", "check: 30"],
    ["hold: 1200", "hold: 400"],
    ["leave: 200", "leave: 20"],
    ["quote: 260", "quote: 20"],
    ["swap: 200", "swap: 40"],
    ["reduced: 120", "reduced: 20"],
    ["waitOrDismiss(9500", "waitOrDismiss(900"],
    ["await sleep(T.arrive + 60)", "await sleep(T.arrive + 10)"],
    ["await sleep(900)", "await sleep(60)"]
  ];
  for (const [a, b] of remplacements) {
    if (!s.includes(a)) throw new Error("motif introuvable dans content.js: " + a);
    s = s.split(a).join(b);
  }
  return s;
}
const SRC = sourceRapide();
const QUOTES = fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8");

/* ---------- bac a sable ---------- */
let OUVRIR_RACINES = true;
function monte(store, avant) {
  const dom = new JSDOM("<!DOCTYPE html><html><body><p>page</p></body></html>",
    { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
  const w = dom.window;
  Object.defineProperty(w.navigator, "language", { value: "fr-CH", configurable: true });

  const donnees = Object.assign({ animMode: "never" }, store);
  const journal = { sorties: [], ecrit: [] };
  let ecouteur = null;

  const api = {
    i18n: { getMessage: (k) => t(k), getUILanguage: () => "fr" },
    runtime: {
      getURL: (p) => "https://example.com/" + p,
      sendMessage: (m) => { journal.sorties.push(m); return Promise.resolve(); },
      onMessage: { addListener: (f) => { ecouteur = f; } }
    },
    storage: {
      local: {
        get: (cles) => {
          const out = {};
          [].concat(cles).forEach((k) => { if (donnees[k] !== undefined) out[k] = donnees[k]; });
          return Promise.resolve(out);
        },
        set: (o) => { Object.assign(donnees, o); journal.ecrit.push(o); return Promise.resolve(); }
      }
    }
  };
  w.browser = api;
  w.chrome = api;
  // 2026-09-29 : le produit ferme ses racines (mode "closed"). Les tests ont
  // besoin d'y regarder : ils les ouvrent ici, sauf quand un test verifie
  // justement qu'elles sont fermees (OUVRIR_RACINES a faux). jsdom ne sait
  // pas produire de clic de confiance : __kzEssaiJsdom le remplace.
  if (OUVRIR_RACINES) {
    const attache = w.Element.prototype.attachShadow;
    w.Element.prototype.attachShadow = function (o) { return attache.call(this, Object.assign({}, o, { mode: "open" })); };
  }
  w.__kzEssaiJsdom = true;
  // avant(w) regle la page AVANT le script, par exemple un conteneur laisse
  // par une version precedente.
  if (typeof avant === "function") avant(w);
  w.eval(QUOTES + "\n" + SRC);
  // ecoute() passe aussi un sendResponse, pour les messages qui repondent
  // (le rappel de rendez-vous dit s'il s'est affiche).
  return { w, donnees, journal, montre: (m) => ecouteur && ecouteur(m), ecoute: (m, cb) => ecouteur && ecouteur(m, {}, cb) };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Attend qu'une condition se realise, jusqu'a un plafond. Evite les tests
// fragiles quand le nombre d'images du build change les temps de rendu.
async function jusqua(cond, plafond) {
  const fin = Date.now() + (plafond || 800);
  while (Date.now() < fin) {
    if (cond()) return true;
    await pause(20);
  }
  return false;
}

function racine(w) {
  const host = w.document.getElementById("kz-koala-host");
  return host ? host.shadowRoot : null;
}
function bulle(w) { const r = racine(w); return r ? r.querySelector(".kz-bubble") : null; }
function txt(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : "<absent>"; }
function clic(n) { if (n) n.dispatchEvent(new n.ownerDocument.defaultView.Event("click", { bubbles: true })); }
function parTexte(r, sel, texte) {
  return Array.from(r.querySelectorAll(sel)).find((n) => n.textContent.trim() === texte) || null;
}

const BASE = {
  customSport: ["3 pompes et on n'en parle plus", "Bois un verre d'eau", "Regarde au loin 20 secondes"],
  customQuotes: [], includeDefaultQuotes: true, customKoalas: [], includeDefaultKoalas: true,
  sportIndex: 0
};
const CTX = { type: "kz-show", screenToday: 15480, snoozeMinutes: 15, intervalMinutes: 45,
              doneToday: 1, repToday: 2, habitGoal: 3, streak: 6 };

/* ================= 1. La bulle d'habitude ================= */
async function testBulleHabitude() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  const r = racine(env.w);
  verifie("l'hote et son shadow DOM existent", !!r);
  const b = bulle(env.w);
  verifie("une bulle est ouverte", !!b);
  verifie("la bulle est visible",
    await jusqua(() => b && b.classList.contains("kz-show")), "la classe kz-show n'est pas venue");

  const pastille = b && b.querySelector(".kz-pill");
  verifie("la pastille salue", txt(pastille) === t("bubblePillHabit"), txt(pastille));
  verifie("la pastille porte le point vert", !!(pastille && pastille.querySelector(".kz-dot")));

  const n = b && b.querySelector(".kz-lead-n");
  const reste = b && b.querySelector(".kz-lead-t");
  verifie("le chiffre de tete est extrait", txt(n) === "3", txt(n));
  verifie("le reste de la phrase suit", txt(reste) === "pompes et on n'en parle plus", txt(reste));

  const segs = b ? b.querySelectorAll(".kz-seg") : [];
  verifie("un trait par objectif du jour", segs.length === 3, "vaut " + segs.length);
  verifie("un seul trait est rempli",
    Array.from(segs).filter((s) => s.classList.contains("kz-seg--on")).length === 1);
  verifie("la ligne de progression est chiffree",
    txt(b && b.querySelector(".kz-day-lab")) === "1 sur 3 aujourd'hui",
    txt(b && b.querySelector(".kz-day-lab")));

  verifie("le bouton de validation porte le bon libelle",
    txt(b && b.querySelector(".kz-btn--done")) === t("btnDone"));
  verifie("le bouton de report porte le bon libelle",
    txt(b && b.querySelector(".kz-btn--later")) === t("btnLater"));
  verifie("aucune croix de fermeture, Plus tard est la seule sortie",
    !(b && b.querySelector(".kz-close")));
  verifie("la bulle est focusable", b && b.getAttribute("tabindex") === "0", String(b && b.getAttribute("tabindex")));
  verifie("la bulle est annoncee comme un dialogue", b && b.getAttribute("role") === "dialog");
  verifie("la bulle porte un libelle accessible", !!(b && b.getAttribute("aria-label")));
  // 2026-09-25 : le personnage par defaut est un koala dessine, plus une photo.
  verifie("le koala du rappel est dessine en buste, oreilles, yeux et patte animables",
    !!(r && r.querySelector(".kz-svg")) && !r.querySelector(".kz-photo")
    && r.querySelectorAll(".kz-svg .kz-ear").length === 2 && r.querySelectorAll(".kz-svg .kz-eyes").length === 2
    && !!r.querySelector(".kz-svg .kz-paw") && !r.querySelector(".kz-svg .kz-grass"));
}

/* ================= 2. Une phrase sans chiffre reste entiere ================= */
async function testSansChiffre() {
  const env = monte(Object.assign({}, BASE, { customSport: ["Bois un verre d'eau"] }));
  env.montre(CTX);
  await pause(120);
  const b = bulle(env.w);
  verifie("pas de gros chiffre si la phrase n'en commence pas", !(b && b.querySelector(".kz-lead-n")));
  verifie("la phrase est affichee entiere",
    txt(b && b.querySelector(".kz-lead-t")) === "Bois un verre d'eau", txt(b && b.querySelector(".kz-lead-t")));
}

/* ================= 3. Rotation sequentielle des objectifs ================= */
async function testRotation() {
  // La croix a disparu, on ne peut plus enchainer les rappels dans un seul
  // montage. On remonte a chaque tour en reinjectant l'index memorise, ce qui
  // verifie du meme coup que sportIndex est bien persiste entre deux visites.
  let env = monte(BASE);
  const vus = [];
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    env = monte(Object.assign({}, BASE, { sportIndex: idx }));
    env.montre(CTX);
    await pause(90);
    const b = bulle(env.w);
    vus.push(txt(b && b.querySelector(".kz-lead")).replace(/^3 /, "3 "));
    idx = env.donnees.sportIndex;
  }
  verifie("les objectifs defilent dans l'ordre",
    vus[0].indexOf("pompes") >= 0 && vus[1].indexOf("Bois") >= 0 && vus[2].indexOf("Regarde") >= 0,
    JSON.stringify(vus));
  verifie("la liste boucle apres le dernier", vus[3].indexOf("pompes") >= 0, JSON.stringify(vus));
  verifie("l'index est memorise et boucle", env.donnees.sportIndex === 1,
    "vaut " + env.donnees.sportIndex);
}

/* ================= 3b. Au-dela de l'objectif, les bonus comptent ================= */
// Demande du 2026-09-18 : un "3 sur 3" fige laissait croire la journee close.
// Chaque habitude de plus se voit, trait dore et libelle avec le surplus.
async function testBonus() {
  let env = monte(BASE);
  env.montre({ ...CTX, doneToday: 5, habitGoal: 3 });
  await pause(120);
  let b = bulle(env.w);
  let segs = b.querySelectorAll(".kz-seg");
  verifie("cinq faites sur trois : trois traits d'objectif et deux traits bonus",
    segs.length === 5 && b.querySelectorAll(".kz-seg--bonus").length === 2, "vaut " + segs.length);
  verifie("les trois traits d'objectif sont tous remplis",
    Array.from(segs).filter((s) => s.classList.contains("kz-seg--on")).length === 3);
  verifie("les traits bonus viennent apres les traits d'objectif",
    !segs[3].classList.contains("kz-seg--on") && segs[3].classList.contains("kz-seg--bonus") && segs[4].classList.contains("kz-seg--bonus"));
  let lab = b.querySelector(".kz-day-lab");
  verifie("le libelle dit le total reel et le surplus",
    txt(lab) === t("dayProgressBonus").replace("{d}", "5").replace("{g}", "3").replace("{n}", "2"), txt(lab));
  verifie("le libelle bonus est mis en valeur", lab.classList.contains("kz-day-lab--bonus"));

  env = monte(BASE);
  env.montre({ ...CTX, doneToday: 9, habitGoal: 3 });
  await pause(120);
  b = bulle(env.w);
  verifie("neuf faites : les traits bonus plafonnent a trois, le libelle dit +6",
    b.querySelectorAll(".kz-seg--bonus").length === 3 && txt(b.querySelector(".kz-day-lab")).indexOf("+6") > -1,
    txt(b.querySelector(".kz-day-lab")));

  env = monte(BASE);
  env.montre({ ...CTX, doneToday: 3, habitGoal: 3 });
  await pause(120);
  b = bulle(env.w);
  verifie("pile a l'objectif : aucun trait bonus, libelle 3 sur 3, en vert",
    b.querySelectorAll(".kz-seg--bonus").length === 0
    && txt(b.querySelector(".kz-day-lab")) === t("dayProgress").replace("{d}", "3").replace("{g}", "3")
    && b.querySelector(".kz-day-lab").classList.contains("kz-day-lab--done"),
    txt(b.querySelector(".kz-day-lab")));

  env = monte(BASE);
  env.montre({ ...CTX, doneToday: 1, habitGoal: 3 });
  await pause(120);
  b = bulle(env.w);
  verifie("sous l'objectif, rien ne change", b.querySelectorAll(".kz-seg--bonus").length === 0
    && !b.querySelector(".kz-day-lab").classList.contains("kz-day-lab--done")
    && !b.querySelector(".kz-day-lab").classList.contains("kz-day-lab--bonus"));

  env = monte(BASE);
  env.montre({ ...CTX, doneToday: 4, habitGoal: 0 });
  await pause(120);
  b = bulle(env.w);
  verifie("sans objectif, aucune ligne de progression, bonus ou pas", !b.querySelector(".kz-day"));

  for (const L of ["fr", "en", "de"]) {
    const m = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales", L, "messages.json"), "utf8"));
    verifie("dayProgressBonus existe en " + L + " avec ses trois champs",
      !!m.dayProgressBonus && ["{d}", "{g}", "{n}"].every((k) => m.dayProgressBonus.message.indexOf(k) > -1));
  }
  verifie("le trait bonus est dore et court", /\.kz-seg--bonus \{ flex: 0 0 14px; background: #F5C877; \}/.test(SRC));
}

/* ================= 4. Validation, coche, citation ================= */
// 2026-09-25 : plus de question d'energie, la coche suit le clic sur Fait.
async function testValidation() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--done"));
  await pause(80);

  let b = bulle(env.w);
  verifie("aucune question d'energie ne s'intercale plus", !!b && !b.querySelector(".kz-energy-btn") && !b.querySelector(".kz-energy-row"));
  await pause(100);
  b = bulle(env.w);
  verifie("l'ecran de validation apparait", !!(b && b.classList.contains("kz-bubble--win")), txt(b));
  verifie("la coche est dessinee", !!(b && b.querySelector(".kz-check")));
  verifie("le felicitation est affiche", txt(b && b.querySelector(".kz-win-t")) === t("winTitle"));
  // CTX porte streak 6 et doneToday 1 : la serie transmise par background.js
  // compte DEJA aujourd'hui, l'ecran affiche donc 6, pas 7. Le jour de plus ne
  // s'ajoute qu'a la premiere validation de la journee, testee juste apres.
  verifie("la serie affichee ne compte pas aujourd'hui deux fois",
    txt(b && b.querySelector(".kz-win-n")) === "6", txt(b && b.querySelector(".kz-win-n")));
  verifie("des etincelles sont posees", (b ? b.querySelectorAll(".kz-spark").length : 0) === 4);

  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("l'issue faite est transmise", envoi && envoi.result === "done", JSON.stringify(envoi));
  verifie("aucune energie n'est transmise", envoi && envoi.energy === undefined, JSON.stringify(envoi));

  await pause(560);
  b = bulle(env.w);
  verifie("la citation arrive ensuite", !!(b && b.querySelector(".kz-quote-text")), txt(b));
  verifie("la pastille annonce la pensee du jour",
    txt(b && b.querySelector(".kz-pill")) === t("bubblePillQuote"), txt(b && b.querySelector(".kz-pill")));
  verifie("le temps d'ecran du jour est rappele",
    txt(b && b.querySelector(".kz-foot")).indexOf("4 h 18") >= 0, txt(b && b.querySelector(".kz-foot")));
  verifie("aucun report enregistre apres une habitude faite",
    !env.journal.sorties.some((m) => m.result === "later" || m.result === "missed"));

  // Premiere validation de la journee : la serie transmise s'arrete a hier,
  // l'ecran ajoute le jour qui vient d'etre gagne.
  const env0 = monte(BASE);
  env0.montre(Object.assign({}, CTX, { doneToday: 0, streak: 6 }));
  await pause(120);
  clic(bulle(env0.w).querySelector(".kz-btn--done"));
  await pause(230);
  const b0 = bulle(env0.w);
  verifie("a la premiere validation du jour, la serie gagne un jour a l'ecran",
    txt(b0 && b0.querySelector(".kz-win-n")) === "7", txt(b0 && b0.querySelector(".kz-win-n")));

  // Toutes les citations masquees et aucune personnelle : la validation se
  // joue quand meme, sans second koala et sans erreur (rand([]) plantait).
  const toutes = JSON.parse(fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8").match(/const KZ_QUOTES_FR = (\[[\s\S]*?\n\]);/)[1].replace(/(\w+):/g, '"$1":').replace(/,(\s*[\]}])/g, "$1")).map((q) => q.t);
  const envQ = monte(Object.assign({}, BASE, { customQuotes: [], includeDefaultQuotes: true, hiddenQuotes: toutes }));
  verifie("le harnais masque bien toutes les citations fournies", toutes.length > 50, String(toutes.length));
  // Sans garde, rand([]) rendait undefined et q.t plantait : la sequence etait
  // interrompue par le filet d'exception, qui l'ecrit dans la console.
  const avertissements = [];
  envQ.w.console.warn = (...a) => { avertissements.push(a.join(" ")); };
  envQ.montre(CTX);
  await pause(120);
  clic(bulle(envQ.w).querySelector(".kz-btn--done"));
  await pause(230);
  verifie("sans aucune citation disponible, l'ecran de validation s'affiche quand meme",
    !!(bulle(envQ.w) && bulle(envQ.w).classList.contains("kz-bubble--win")));
  verifie("sans aucune citation disponible, le koala repart sans second passage ni erreur",
    await jusqua(() => racine(envQ.w).querySelectorAll(".kz-koala").length === 0, 1500));
  verifie("l'issue faite a bien ete transmise malgre l'absence de citation",
    envQ.journal.sorties.some((m) => m.type === "kz-outcome" && m.result === "done"));
  // Laisser le temps ou le second koala aurait ete construit puis aurait
  // plante : le premier depart ne suffit pas a conclure.
  await pause(400);
  verifie("aucun second koala n'est apparu entre-temps", racine(envQ.w).querySelectorAll(".kz-koala").length === 0);
  verifie("aucune sequence interrompue par une exception",
    !avertissements.some((a) => a.indexOf("interrompue") >= 0), JSON.stringify(avertissements));
}

/* ================= 5. Report : un report est un report ================= */
// Decision du 2026-09-16. Apres Plus tard, le report est compte dans les
// statistiques et le koala repart avec sa bulle. Aucune
// relance, aucun personnage qui reste a l'ecran, aucune pause, aucun retour
// anticipe. Le rappel suivant repart de zero.
async function testReport() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(60);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("l'issue reportee est transmise des le clic, sans question d'energie", !!envoi && envoi.result === "later" && envoi.energy === undefined, JSON.stringify(envoi));
  const r = racine(env.w);
  verifie("le koala repart, plus rien a l'ecran",
    await jusqua(() => r.querySelectorAll(".kz-koala").length === 0, 900), String(r.querySelectorAll(".kz-koala").length));
  verifie("aucune relance, aucune bulle graphite, aucune pique", !r.querySelector(".kz-bubble--cat") && !r.querySelector(".kz-btn--never"));
  verifie("une seule issue enregistree, le report, et aucune pause demandee",
    env.journal.sorties.filter((m) => m.type === "kz-outcome").length === 1
    && !env.journal.sorties.some((m) => m.type === "kz-pause"), JSON.stringify(env.journal.sorties));
  // Le rappel suivant repart de zero, avec un koala neuf et sa bulle d'habitude.
  env.montre(CTX);
  await pause(120);
  verifie("le rappel suivant construit un koala neuf et sa bulle d'habitude",
    r.querySelectorAll(".kz-koala").length === 1 && !!bulle(env.w) && !!bulle(env.w).querySelector(".kz-btn--later"));
}

/* ================= Le rappel de rendez-vous, module agenda ================= */
// Trois minutes avant un rendez-vous a deux ou plus, background.js envoie
// kz-meeting-soon. La page repond tout de suite si elle affiche, et decline
// quand un rappel d'habitude occupe deja l'ecran (notification en repli).
async function testRendezVous() {
  const env = monte(BASE);
  const debut = Date.now() + 3 * 60000;
  let reponse = null;
  const retour = env.ecoute({ type: "kz-meeting-soon", title: "Point produit", start: debut, minutes: 3, url: "https://kmeet.infomaniak.com/abc", people: 3 }, (r) => { reponse = r; });
  verifie("la page garde le canal ouvert pour repondre plus tard", retour === true);
  verifie("la page ne repond qu'une fois la bulle vraiment posee",
    await jusqua(() => reponse !== null, 900) && !!reponse && reponse.shown === true, JSON.stringify(reponse));
  const r = racine(env.w);
  const b = bulle(env.w);
  verifie("un koala et sa bulle sont a l'ecran", !!b && r.querySelectorAll(".kz-koala").length === 1);
  verifie("la bulle est claire, jamais graphite", !!b && !b.classList.contains("kz-bubble--cat"));
  // 2026-09-17 : le rendez-vous a sa propre identite, bleue, pour ne pas se
  // confondre avec le rappel d'habitude.
  verifie("la bulle de rendez-vous porte son propre style", !!b && b.classList.contains("kz-bubble--meet"));
  verifie("sa pastille est celle de l'agenda, avec le calendrier dessine",
    !!(b && b.querySelector(".kz-pill.kz-pill--meet svg")) && !(b && b.querySelector(".kz-pill--hail")));
  const srcM = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("le bleu du rendez-vous vient de la planche, jamais du vert du rappel",
    /\.kz-bubble--meet \{[^}]*#EDF4FC/.test(srcM) && /\.kz-btn--join \{[^}]*#1F63A8/.test(srcM) && !/\.kz-btn--join \{[^}]*#146B2C/.test(srcM));
  verifie("la pastille annonce le delai",
    txt(b && b.querySelector(".kz-pill")) === t("meetingSoonPill").replace("{n}", "3"), txt(b && b.querySelector(".kz-pill")));
  verifie("le titre du rendez-vous est affiche", txt(b && b.querySelector(".kz-meet-title")) === "Point produit");
  const quand = txt(b && b.querySelector(".kz-meet-when"));
  const d = new Date(debut);
  const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  verifie("l'heure et le nombre de participants suivent", quand.indexOf(hh) >= 0 && quand.indexOf("3") >= 0, quand);
  verifie("rien a valider, ni Fait ni Plus tard", !!b && !b.querySelector(".kz-btn--done") && !b.querySelector(".kz-btn--later"));
  const join = b && b.querySelector(".kz-btn--join");
  verifie("le bouton Rejoindre est la puisqu'il y a un lien", !!join && txt(join) === t("meetingJoin"));
  clic(join);
  await pause(20);
  verifie("un clic dans la premiere demi-seconde n'ouvre rien : la bulle doit avoir ete vue", !env.journal.sorties.some((m) => m.type === "kz-open-url"));
  await pause(520);
  clic(join);
  await pause(60);
  const ouverture = env.journal.sorties.find((m) => m.type === "kz-open-url");
  verifie("Rejoindre passe par background.js avec le lien, jamais par la page",
    !!ouverture && ouverture.url === "https://kmeet.infomaniak.com/abc", JSON.stringify(ouverture));
  verifie("et le koala s'en va", await jusqua(() => r.querySelectorAll(".kz-koala").length === 0, 800),
    String(r.querySelectorAll(".kz-koala").length));

  // Sans lien : pas de bouton. Sans titre : un libelle de repli. Un clic sur
  // le koala le renvoie.
  const env2 = monte(BASE);
  env2.ecoute({ type: "kz-meeting-soon", title: "", start: Date.now() + 180000, minutes: 3, url: "", people: 2 }, () => {});
  await pause(120);
  const b2 = bulle(env2.w);
  verifie("sans lien, aucun bouton Rejoindre", !!b2 && !b2.querySelector(".kz-btn--join"));
  verifie("sans titre, un libelle de repli", txt(b2 && b2.querySelector(".kz-meet-title")) === t("meetingUntitled"), txt(b2 && b2.querySelector(".kz-meet-title")));
  clic(racine(env2.w).querySelector(".kz-koala"));
  verifie("un clic sur le koala le renvoie", await jusqua(() => racine(env2.w).querySelectorAll(".kz-koala").length === 0, 800));

  // Un rappel d'habitude est deja a l'ecran : la page decline, il reste seul.
  const env3 = monte(BASE);
  env3.montre(CTX);
  await pause(120);
  let rep3 = null;
  env3.ecoute({ type: "kz-meeting-soon", title: "X", start: Date.now() + 180000, minutes: 3, url: "", people: 2 }, (r3) => { rep3 = r3; });
  verifie("pendant un rappel d'habitude, la page decline", !!rep3 && rep3.shown === false, JSON.stringify(rep3));
  verifie("et le rappel d'habitude reste seul a l'ecran",
    racine(env3.w).querySelectorAll(".kz-koala").length === 1 && !!bulle(env3.w).querySelector(".kz-btn--later"));

}

/* ================= Le rendez-vous reste, et la fin en ambre, 2026-09-21 ================= */
// Demande de Thomas : la bulle de rendez-vous ne disparait plus toute seule.
// Un compte a rebours tourne, un bouton Fermer la retire. Cinq minutes avant
// la fin, meme bulle en ambre, pour tenir la duree prevue.
async function testRendezVousPersistant() {
  const env = monte(BASE);
  const debut = Date.now() + 2 * 60000 + 30000;
  env.ecoute({ type: "kz-meeting-soon", title: "Point produit", start: debut, end: debut + 30 * 60000, minutes: 3, url: "https://kmeet.infomaniak.com/abc", people: 3 }, () => {});
  await pause(120);
  const r = racine(env.w);
  let b = bulle(env.w);
  verifie("la bulle de debut est posee", !!b && b.classList.contains("kz-bubble--meet") && !b.classList.contains("kz-bubble--meetend"));
  const compte = b && b.querySelector(".kz-meet-count");
  verifie("un compte a rebours est affiche, en minutes et secondes",
    !!compte && txt(compte).indexOf(t("meetingCountdown").split("{t}")[0]) === 0 && /2 min [0-9]{2}/.test(txt(compte)), txt(compte));
  const avant = txt(compte);
  await pause(1150);
  verifie("le compte a rebours tourne a la seconde", txt(compte) !== avant, avant + " -> " + txt(compte));
  verifie("aucun delai automatique : passe l'ancien filet, la bulle est toujours la",
    !/waitOrDismiss\(20000/.test(SRC) && !!bulle(env.w) && r.querySelectorAll(".kz-koala").length === 1);
  const fermer = b.querySelector(".kz-btn--close");
  verifie("un bouton Fermer est present, a cote de Rejoindre",
    !!fermer && txt(fermer) === t("meetingClose") && !!b.querySelector(".kz-btn--join"));
  clic(fermer);
  verifie("Fermer renvoie le koala", await jusqua(() => r.querySelectorAll(".kz-koala").length === 0, 900));
  verifie("Fermer n'ouvre aucun lien", !env.journal.sorties.some((m) => m.type === "kz-open-url"));

  // Passe le debut, le compte continue en "depuis", jamais un zero fige.
  const env2 = monte(BASE);
  env2.ecoute({ type: "kz-meeting-soon", title: "X", start: Date.now() + 400, end: Date.now() + 60000, minutes: 1, url: "", people: 2 }, () => {});
  await pause(1700);
  const c2 = bulle(env2.w) && bulle(env2.w).querySelector(".kz-meet-count");
  verifie("une fois le debut passe, le compte dit depuis combien de temps",
    !!c2 && txt(c2).indexOf(t("meetingStarted").split("{t}")[0]) === 0, c2 && txt(c2));
  // Echap ferme aussi.
  env2.w.document.dispatchEvent(new env2.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  verifie("Echap ferme la bulle de rendez-vous", await jusqua(() => racine(env2.w).querySelectorAll(".kz-koala").length === 0, 900));

  // La fin, en ambre.
  const env3 = monte(BASE);
  const fin = Date.now() + 4 * 60000 + 50000;
  let rep3 = null;
  const retour3 = env3.ecoute({ type: "kz-meeting-end", title: "Point produit", start: fin - 30 * 60000, end: fin, minutes: 5, url: "https://kmeet.infomaniak.com/abc", people: 3 }, (x) => { rep3 = x; });
  verifie("la fin garde aussi le canal ouvert et repond une fois posee", retour3 === true && await jusqua(() => rep3 !== null, 900) && rep3.shown === true);
  const b3 = bulle(env3.w);
  verifie("la bulle de fin porte le style ambre en plus du style agenda",
    !!b3 && b3.classList.contains("kz-bubble--meet") && b3.classList.contains("kz-bubble--meetend"));
  verifie("sa pastille dit Fin dans 5 min, avec le calendrier",
    txt(b3 && b3.querySelector(".kz-pill")) === t("meetingEndPill").replace("{n}", "5") && !!(b3 && b3.querySelector(".kz-pill--meetend svg")), txt(b3 && b3.querySelector(".kz-pill")));
  const c3 = b3 && b3.querySelector(".kz-meet-count");
  verifie("son compte a rebours vise la fin", !!c3 && txt(c3).indexOf(t("meetingEndCountdown").split("{t}")[0]) === 0 && /4 min [0-9]{2}/.test(txt(c3)), c3 && txt(c3));
  const d = new Date(fin);
  const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  verifie("la ligne du dessous dit jusqu'a quelle heure", txt(b3 && b3.querySelector(".kz-meet-when")) === t("meetingUntil").replace("{h}", hh), txt(b3 && b3.querySelector(".kz-meet-when")));
  verifie("pas de bouton Rejoindre a la fin, on y est deja, mais Fermer",
    !!b3 && !b3.querySelector(".kz-btn--join") && !!b3.querySelector(".kz-btn--close"));
  const srcM = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("l'ambre vient de la planche et differe du bleu du debut",
    /\.kz-bubble--meetend \{ background: #FBE6CE; border-color: #F5C877; \}/.test(srcM)
    && /\.kz-bubble--meetend \.kz-meet-title \{ color: #8A5108; \}/.test(srcM)
    && /\.kz-pill--meetend \{ background: #F5C877; color: #8A5108; \}/.test(srcM));
  verifie("seule a sa ligne, Fermer est un vrai bouton plein dans la bulle ambre",
    /\.kz-bubble--meetend \.kz-btn--close \{ flex: 1 1 0; padding: 0; background: #8A5108; color: #FFFFFF; \}/.test(srcM));

  // Une nouvelle bulle d'agenda remplace la precedente au lieu d'etre refusee.
  let rep4 = null;
  env3.ecoute({ type: "kz-meeting-soon", title: "Suivant", start: Date.now() + 180000, end: Date.now() + 1800000, minutes: 3, url: "", people: 2 }, (x) => { rep4 = x; });
  verifie("le debut du suivant chasse la fin du precedent et s'affiche",
    await jusqua(() => rep4 !== null && !!bulle(env3.w) && txt(bulle(env3.w).querySelector(".kz-meet-title")) === "Suivant", 2500) && rep4.shown === true, JSON.stringify(rep4));
  verifie("un seul koala a l'ecran apres le remplacement", racine(env3.w).querySelectorAll(".kz-koala").length === 1);
  clic(bulle(env3.w).querySelector(".kz-btn--close"));
  await jusqua(() => racine(env3.w).querySelectorAll(".kz-koala").length === 0, 900);

  // Un rappel d'habitude a l'ecran : la fin decline, comme le debut.
  const env5 = monte(BASE);
  env5.montre(CTX);
  await pause(120);
  let rep5 = null;
  env5.ecoute({ type: "kz-meeting-end", title: "X", start: Date.now() - 60000, end: Date.now() + 300000, minutes: 5, url: "", people: 2 }, (x) => { rep5 = x; });
  verifie("pendant un rappel d'habitude, la fin decline aussi", !!rep5 && rep5.shown === false, JSON.stringify(rep5));

  // Le minuteur ne fuit pas : apres Fermer, plus aucun tick.
  const env6 = monte(BASE);
  env6.ecoute({ type: "kz-meeting-soon", title: "X", start: Date.now() + 120000, end: Date.now() + 1800000, minutes: 2, url: "", people: 2 }, () => {});
  await pause(120);
  const b6 = bulle(env6.w);
  clic(b6.querySelector(".kz-btn--close"));
  await jusqua(() => racine(env6.w).querySelectorAll(".kz-koala").length === 0, 900);
  const gele = txt(b6.querySelector(".kz-meet-count"));
  await pause(1200);
  verifie("apres Fermer, le compte a rebours de la bulle retiree ne tourne plus", txt(b6.querySelector(".kz-meet-count")) === gele);


  // 2026-09-21, vu en conditions reelles : un onglet ouvert avant une mise a
  // jour de l'extension garde le conteneur et la feuille de style de
  // l'ANCIEN script. Le nouveau script reinjecte le reutilisait tel quel,
  // la bulle de fin arrivait bleue, calendrier geant, sans aucune de ses
  // regles. La feuille doit etre remplacee des qu'elle differe.
  const STYLES_ATTENDUS = (SRC.match(/const STYLES = `([\s\S]*?)`;/) || [])[1];
  const env7 = monte(BASE, (w) => {
    const vieux = w.document.createElement("div");
    vieux.id = "kz-koala-host";
    const sh = vieux.attachShadow({ mode: "open" });
    const st = w.document.createElement("style");
    st.textContent = ".kz-bubble { background: red; } /* feuille d'une version precedente */";
    sh.appendChild(st);
    w.document.body.appendChild(vieux);
  });
  env7.ecoute({ type: "kz-meeting-end", title: "Vieux conteneur", start: Date.now() - 60000, end: Date.now() + 300000, minutes: 5, url: "", people: 1 }, () => {});
  await pause(120);
  const hote7 = env7.w.document.getElementById("kz-koala-host");
  verifie("le conteneur d'une version precedente est remplace, jamais double",
    env7.w.document.querySelectorAll("#kz-koala-host").length === 1 && !!bulle(env7.w) && bulle(env7.w).classList.contains("kz-bubble--meetend"));
  // La feuille du produit contient des interpolations, on ne compare donc pas
  // au texte brut du fichier : on verifie qu'elle a ete remplacee et que les
  // regles recentes y sont.
  const feuille7 = hote7.shadowRoot.querySelector("style").textContent;
  verifie("sa feuille de style perimee est remplacee par la notre",
    !!STYLES_ATTENDUS && hote7.shadowRoot.querySelectorAll("style").length === 1
    && feuille7.indexOf("version precedente") < 0 && feuille7.indexOf(".kz-bubble--meetend {") >= 0 && feuille7.indexOf(".kz-meet-count {") >= 0);
  clic(bulle(env7.w).querySelector(".kz-btn--close"));
  await jusqua(() => racine(env7.w).querySelectorAll(".kz-koala").length === 0, 900);

  for (const L of ["fr", "en", "de"]) {
    const m = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales", L, "messages.json"), "utf8"));
    verifie("les cles du rendez-vous persistant existent en " + L,
      ["meetingEndPill", "meetingCountdown", "meetingStarted", "meetingEndCountdown", "meetingEnded", "meetingUntil", "meetingClose", "agendaEndWarnLabel", "agendaEndWarnHint"].every((k) => m[k] && m[k].message));
  }
}


/* ================= Au-dessus de tout, 2026-10-01 (rtn.ch) ================= */
// Sur rtn.ch, le lecteur radio colle en bas passait devant le koala : le
// conteneur fixe sans z-index s'empilait au niveau 0. Il entre maintenant
// dans la couche superieure du navigateur (popover manuel).
async function testAuDessus() {
  const ouverts = [];
  let env = monte(BASE, (w) => {
    w.HTMLElement.prototype.showPopover = function () { ouverts.push(this.id); this.__ouvert = true; };
    const orig = w.Element.prototype.matches;
    w.Element.prototype.matches = function (sel) { return sel === ":popover-open" ? !!this.__ouvert : orig.call(this, sel); };
  });
  env.montre(CTX);
  await pause(120);
  const hote = env.w.document.getElementById("kz-koala-host");
  verifie("le conteneur entre dans la couche superieure, en popover manuel", !!hote && hote.getAttribute("popover") === "manual" && ouverts.indexOf("kz-koala-host") >= 0, JSON.stringify(ouverts));
  verifie("il garde 0 x 0 px, sans fond ni marge, et le z-index maximal en secours",
    /all:initial/.test(hote.getAttribute("style")) && /width:0/.test(hote.getAttribute("style")) && /height:0/.test(hote.getAttribute("style")) && /z-index:2147483647/.test(hote.getAttribute("style")));
  const avant = ouverts.length;
  env.montre(CTX);
  await pause(60);
  verifie("deja ouvert, il n est pas rouvert", ouverts.length === avant, String(ouverts.length));
  verifie("manuel, pas auto : Echap ou un clic ailleurs ne le ferment pas", hote.getAttribute("popover") !== "auto");
  env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  const h2 = env.w.document.getElementById("kz-koala-host");
  verifie("sans popover, le koala s affiche quand meme, z-index maximal", !!bulle(env.w) && !h2.hasAttribute("popover") && /z-index:2147483647/.test(h2.getAttribute("style")));
}

/* ================= Durcissements de la revue ECC, 2026-10-06 ================= */
async function testDurcissementsPage() {
  const NONCE = "cd".repeat(16);
  const debut = Date.now() + 3 * 60000;
  const info = { type: "kz-meeting-soon", id: 77, title: "Point", start: debut, end: debut + 1800000, minutes: 3, url: "https://kmeet.infomaniak.com/abc", people: 3, canNotify: true, notifyNonce: NONCE };
  const data = { ok: true, id: 77, start: debut, title: "Point", sent: [], recipients: [{ name: "Boris", address: "boris@example.com", organizer: true }],
    templates: { late5: { subject: "Retard de 5 min · Point", body: "Corps 5" }, late10: { subject: "s", body: "b" }, absent: { subject: "s", body: "b" } } };
  // L1 : une page rend le conteneur transparent, le clic ne vaut rien.
  let env = monte(BASE);
  env.w.chrome.runtime.sendMessage = async (m) => { env.journal.sorties.push(m); return m.type === "kz-notify-prepare" ? data : { ok: true, count: 1 }; };
  env.ecoute(info, () => {});
  await pause(120);
  let b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(600);
  env.w.document.getElementById("kz-koala-host").style.setProperty("opacity", "0");
  clic(b.querySelector(".kz-notify .kz-btn--send"));
  await pause(40);
  verifie("conteneur rendu transparent par la page : Envoyer ne part pas", !env.journal.sorties.some((m) => m.type === "kz-notify-send"));
  env.w.document.getElementById("kz-koala-host").style.removeProperty("opacity");
  env.w.document.body.style.setProperty("filter", "blur(8px)");
  clic(b.querySelector(".kz-notify .kz-btn--send"));
  await pause(40);
  verifie("page floutee : Envoyer ne part pas non plus", !env.journal.sorties.some((m) => m.type === "kz-notify-send"));
  env.w.document.body.style.setProperty("filter", "invert(1) hue-rotate(180deg)");
  clic(b.querySelector(".kz-notify .kz-btn--send"));
  await pause(60);
  verifie("un mode sombre par filtre de couleur ne bloque pas Envoyer", env.journal.sorties.some((m) => m.type === "kz-notify-send"));
  env.journal.sorties.length = 0;
  env.w.document.body.style.removeProperty("filter");
  b = bulle(env.w);
  if (b.querySelector(".kz-notify .kz-btn--send")) clic(b.querySelector(".kz-notify .kz-btn--send"));
  await pause(60);
  verifie("bulle bien visible depuis un moment : Envoyer part (deja verifie avec le mode sombre)", true);
  // jsdom ne connait pas toutes ces proprietes : on lit le style pose dans le code.
  const styleHote = (fs.readFileSync(path.join(RACINE, "content.js"), "utf8").match(/host\.setAttribute\("style", "([^"]+)"\)/) || [])[1] || "";
  verifie("les styles sensibles du conteneur sont verrouilles contre les feuilles du site", ["opacity:1!important", "visibility:visible!important", "filter:none!important", "clip-path:none!important", "transform:none!important"].every((x) => styleHote.indexOf(x) >= 0), styleHote);
  // L3 : Echap simule par la page.
  env = monte(BASE);
  env.montre(CTX);
  await pause(160);
  env.w.__kzEssaiJsdom = false;
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await pause(80);
  verifie("un Echap simule par la page ne ferme pas le rappel et ne compte rien", !!bulle(env.w) && !env.journal.sorties.some((m) => m.type === "kz-outcome"));
  env.w.__kzEssaiJsdom = true;
  // Clobbering : un element de la page nomme comme nos drapeaux.
  env = monte(BASE, (w) => {
    ["__kzLoaded", "__kzShadows", "__kzPassLoaded"].forEach((id) => { const d = w.document.createElement("div"); d.id = id; w.document.body.appendChild(d); });
  });
  env.montre(CTX);
  await pause(160);
  verifie("des elements nommes __kzLoaded ou __kzShadows ne desactivent pas le koala", !!bulle(env.w));
  // SVG : ni script, ni objet etranger, ni attribut d'evenement.
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8") + fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  verifie("la reconstruction des dessins ecarte script, objets etrangers, evenements et liens javascript", (src.match(/script\|foreignobject\|iframe\|object\|embed/g) || []).length === 2 && (src.match(/\^on\/i\.test\(a\.name\)/g) || []).length === 2);
}

/* ================= Une page ne pilote pas la bulle, 2026-09-29 ================= */
async function testPageNePilotePas() {
  const srcC = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  const srcP = fs.readFileSync(path.join(RACINE, "passages.js"), "utf8");
  verifie("les deux scripts ferment leur racine, plus aucune racine ouverte",
    /attachShadow\(\{ mode: "closed" \}\)/.test(srcC) && /attachShadow\(\{ mode: "closed" \}\)/.test(srcP) && !/mode: "open"/.test(srcC + srcP));
  verifie("aucun script ne relit host.shadowRoot, la reference reste dans le monde isole", !/\.shadowRoot\b(?!\s*vaut)/.test(srcC.replace(/\/\/.*$/gm, "")) && !/\.shadowRoot\b/.test(srcP.replace(/\/\/.*$/gm, "")));
  const debut = Date.now() + 3 * 60000;
  const info = { type: "kz-meeting-soon", id: 77, title: "Point secret", start: debut, end: debut + 1800000, minutes: 3, url: "https://kmeet.infomaniak.com/abc", people: 3, canNotify: true };
  const data = { ok: true, id: 77, start: debut, title: "Point secret", sent: [],
    recipients: [{ name: "Boris", address: "boris@example.com", organizer: true }],
    templates: { late5: { subject: "Retard de 5 min · Point secret", body: "Corps 5" }, late10: { subject: "s", body: "b" }, absent: { subject: "s", body: "b" } } };
  // Racines FERMEES, comme dans un vrai navigateur : la page ne voit rien.
  OUVRIR_RACINES = false;
  let env = monte(BASE);
  OUVRIR_RACINES = true;
  env.ecoute(info, () => {});
  await pause(120);
  const hote = env.w.document.getElementById("kz-koala-host");
  verifie("le conteneur existe mais sa racine est invisible au code de la page", !!hote && hote.shadowRoot === null);
  verifie("le titre du rendez-vous ne fuit ni dans le texte de la page ni dans son HTML",
    env.w.document.body.textContent.indexOf("Point secret") < 0 && env.w.document.body.innerHTML.indexOf("Point secret") < 0);
  verifie("aucun bouton de la bulle n'est atteignable depuis la page", env.w.document.querySelectorAll(".kz-btn, .kz-btn--send, .kz-notify").length === 0);

  // Un clic simule par du code (evenement non fiable) ne declenche pas l'envoi.
  env = monte(BASE);
  env.w.chrome.runtime.sendMessage = async (m) => { env.journal.sorties.push(m); return m.type === "kz-notify-prepare" ? data : { ok: true, count: 1 }; };
  env.ecoute(info, () => {});
  await pause(120);
  const b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(80);
  env.w.__kzEssaiJsdom = false;
  clic(b.querySelector(".kz-notify .kz-btn--send"));
  await pause(60);
  verifie("sans vrai geste de l'utilisateur, Envoyer ne part pas", !env.journal.sorties.some((m) => m.type === "kz-notify-send"));
  const rejoindre = b.querySelector(".kz-btn--join");
  if (rejoindre) { clic(rejoindre); await pause(20); }
  verifie("ni Rejoindre la visio", !env.journal.sorties.some((m) => m.type === "kz-open-url"));
  env.w.__kzEssaiJsdom = true;
}

/* ================= Prevenir les participants, volet de la bulle, 2026-09-22 ================= */
async function testPrevenirBulle() {
  const debut = Date.now() + 3 * 60000;
  const NONCE = "ab".repeat(16);
  const info = { type: "kz-meeting-soon", id: 77, title: "Point produit", start: debut, end: debut + 1800000, minutes: 3, url: "https://kmeet.infomaniak.com/abc", people: 3, canNotify: true, notifyNonce: NONCE };
  const data = { ok: true, id: 77, start: debut, title: "Point produit", sent: [],
    recipients: [{ name: "Boris", address: "boris@example.com", organizer: true }, { name: "", address: "claire@example.com", organizer: false }],
    templates: { late5: { subject: "Retard de 5 min · Point produit", body: "Corps 5" }, late10: { subject: "Retard de 10 min · Point produit", body: "Corps 10" }, absent: { subject: "Absence · Point produit", body: "Corps absent" } } };
  const brancheMock = (env, reponses) => {
    env.w.chrome.runtime.sendMessage = async (m) => { env.journal.sorties.push(m); return typeof reponses[m.type] === "function" ? reponses[m.type](m) : reponses[m.type]; };
  };
  let env = monte(BASE);
  brancheMock(env, { "kz-notify-prepare": data, "kz-notify-send": { ok: true, count: 1 } });
  env.ecoute(info, () => {});
  await pause(120);
  let b = bulle(env.w);
  const prev = b.querySelector(".kz-btn--notify");
  verifie("la bulle de debut propose Prevenir quand la boite est choisie", !!prev && txt(prev) === t("notifyButtonShort"), txt(prev));
  clic(prev);
  await pause(20);
  verifie("le compte a rebours, l'heure et les actions se masquent pendant le volet",
    b.querySelector(".kz-meet-count").classList.contains("kz-hide") && b.querySelector(".kz-actions").classList.contains("kz-hide"));
  verifie("le volet demande les participants au fond, avec l'identifiant et le jeton d'envoi de la bulle",
    env.journal.sorties.some((m) => m.type === "kz-notify-prepare" && m.id === 77 && m.nonce === NONCE && m.start === undefined));
  await pause(60);
  const panel = b.querySelector(".kz-notify");
  const kinds = panel.querySelectorAll(".kz-kind");
  verifie("trois messages proposes, le premier choisi", kinds.length === 3 && kinds[0].classList.contains("kz-kind--on") && txt(kinds[2]) === t("notifyAbsent"));
  verifie("deux destinataires en puces, l'organisateur d'abord, le nom ou l'adresse",
    panel.querySelectorAll(".kz-chip").length === 2 && txt(panel.querySelectorAll(".kz-chip-n")[0]) === "Boris" && txt(panel.querySelectorAll(".kz-chip-n")[1]) === "claire@example.com");
  const ta = panel.querySelector(".kz-notify-body");
  verifie("l'objet et le texte du premier message sont preremplis", txt(panel.querySelector(".kz-notify-subj")).indexOf("Retard de 5 min") >= 0 && ta.value === "Corps 5");
  clic(kinds[1]);
  verifie("changer de message remplace le texte non retouche", ta.value === "Corps 10" && txt(panel.querySelector(".kz-notify-subj")).indexOf("10 min") >= 0 && kinds[1].classList.contains("kz-kind--on"));
  ta.value = "Mon texte a moi";
  clic(kinds[2]);
  verifie("un texte retouche dans la bulle est garde quand on change de message, l'objet suit", ta.value === "Mon texte a moi" && txt(panel.querySelector(".kz-notify-subj")).indexOf("Absence") >= 0);
  clic(panel.querySelectorAll(".kz-chip-x")[0]);
  verifie("une puce se retire", panel.querySelectorAll(".kz-chip").length === 1 && txt(panel.querySelector(".kz-chip-n")) === "claire@example.com");
  clic(panel.querySelector(".kz-chip-x"));
  const envoyer = panel.querySelector(".kz-btn--send");
  verifie("sans destinataire, Envoyer est verrouille et le volet le dit", panel.querySelectorAll(".kz-chip").length === 0 && envoyer.disabled && txt(panel.querySelector(".kz-notify-msg")) === t("notifyNoRecipients"));
  clic(panel.querySelector(".kz-btn--close"));
  await pause(20);
  verifie("Retour referme le volet et rend la bulle", !b.querySelector(".kz-notify") && !b.querySelector(".kz-meet-count").classList.contains("kz-hide") && !b.querySelector(".kz-actions").classList.contains("kz-hide"));

  // Envoi.
  clic(b.querySelector(".kz-btn--notify"));
  await pause(80);
  let panel2 = b.querySelector(".kz-notify");
  clic(panel2.querySelectorAll(".kz-chip-x")[1]);
  panel2.querySelector(".kz-notify-body").value = "Texte final";
  verifie("Envoyer reste grise le temps d'etre vu, un clic trop rapide ne part pas", panel2.querySelector(".kz-btn--send").disabled);
  clic(panel2.querySelector(".kz-btn--send"));
  await pause(40);
  verifie("et rien n'est parti", !env.journal.sorties.some((m) => m.type === "kz-notify-send"));
  await pause(520);
  verifie("puis Envoyer s'ouvre", !panel2.querySelector(".kz-btn--send").disabled);
  clic(panel2.querySelector(".kz-btn--send"));
  await pause(60);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-notify-send");
  verifie("Envoyer transmet le jeton, le message choisi, le texte relu et les destinataires restants, jamais un objet",
    !!envoi && envoi.id === 77 && envoi.nonce === NONCE && envoi.kind === "late5" && envoi.subject === undefined && envoi.body === "Texte final" && JSON.stringify(envoi.to) === '["boris@example.com"]', JSON.stringify(envoi));
  verifie("le succes est confirme dans le volet", txt(panel2.querySelector(".kz-notify-msg--ok")) === t("notifySentOne"));
  verifie("la bulle reste, rien ne s'est ferme tout seul", !!bulle(env.w) && racine(env.w).querySelectorAll(".kz-koala").length === 1);
  await pause(2000);
  verifie("apres la confirmation, le volet se replie et la bulle reprend son cours", !b.querySelector(".kz-notify") && !b.querySelector(".kz-actions").classList.contains("kz-hide"));

  // Echec de l'envoi, messages deja envoyes, Echap.
  env = monte(BASE);
  brancheMock(env, { "kz-notify-prepare": Object.assign({}, data, { sent: ["late5"] }), "kz-notify-send": { ok: false, error: "missing_scope" } });
  env.ecoute(info, () => {});
  await pause(120);
  b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(80);
  panel2 = b.querySelector(".kz-notify");
  const k2 = panel2.querySelectorAll(".kz-kind");
  verifie("un message deja envoye est grise et coche, le choix passe au suivant", k2[0].disabled && txt(k2[0]).indexOf("✓") === 0 && k2[1].classList.contains("kz-kind--on"));
  await pause(520);
  clic(panel2.querySelector(".kz-btn--send"));
  await pause(60);
  verifie("un echec s'affiche dans le volet et Envoyer redevient possible",
    txt(panel2.querySelector(".kz-notify-msg--err")) === t("notifyErrScope") && !panel2.querySelector(".kz-btn--send").disabled && txt(panel2.querySelector(".kz-btn--send")) === t("notifySend"));
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await pause(30);
  verifie("Echap ferme d'abord le volet, la bulle reste", !b.querySelector(".kz-notify") && !!bulle(env.w));
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  verifie("un second Echap ferme la bulle", await jusqua(() => racine(env.w).querySelectorAll(".kz-koala").length === 0, 900));

  // Sans boite choisie, ou a la fin : pas de bouton.
  env = monte(BASE);
  env.ecoute(Object.assign({}, info, { canNotify: false }), () => {});
  await pause(120);
  verifie("sans boite choisie, aucun bouton Prevenir", !bulle(env.w).querySelector(".kz-btn--notify"));
  env = monte(BASE);
  env.ecoute({ type: "kz-meeting-end", id: 77, title: "X", start: debut - 1500000, end: debut + 300000, minutes: 5, url: "", people: 3, canNotify: true }, () => {});
  await pause(120);
  verifie("la bulle de fin ne propose jamais Prevenir", !bulle(env.w).querySelector(".kz-btn--notify"));
  // Le fond ne repond pas : le volet le dit et rend la main.
  env = monte(BASE);
  brancheMock(env, { "kz-notify-prepare": { ok: false, error: "notify_off" } });
  env.ecoute(info, () => {});
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--notify"));
  await pause(80);
  verifie("un refus du fond s'affiche avec un Retour", txt(bulle(env.w).querySelector(".kz-notify-msg--err")) === t("notifyErrOff") && !!bulle(env.w).querySelector(".kz-notify .kz-btn--close"));
  const srcM = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("les puces et le bouton Envoyer sont dans le bleu de l'agenda", /\.kz-chip \{[^}]*#EDF4FC/.test(srcM) && /\.kz-btn--send \{[^}]*#1F63A8/.test(srcM));

  // Retours de Thomas du 2026-09-22 : un clic dans le champ refermait le volet
  // (le clic remontait au koala), il manquait Fermer, et une fusee au depart.
  env = monte(BASE);
  brancheMock(env, { "kz-notify-prepare": data, "kz-notify-send": { ok: true, count: 2 } });
  env.ecoute(info, () => {});
  await pause(120);
  b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(80);
  const p3 = b.querySelector(".kz-notify");
  const champ = p3.querySelector(".kz-notify-body");
  clic(champ);
  champ.dispatchEvent(new env.w.MouseEvent("mousedown", { bubbles: true }));
  clic(p3.querySelector(".kz-chip-n"));
  verifie("un clic dans le champ ou sur une puce ne referme pas le volet", !!b.querySelector(".kz-notify") && racine(env.w).querySelectorAll(".kz-koala").length === 1);
  const boutons = Array.from(p3.querySelectorAll(".kz-actions .kz-btn")).map((x) => txt(x));
  verifie("le volet propose Envoyer, Retour et Fermer", boutons.length === 3 && boutons[0] === t("notifySend") && boutons[1] === t("notifyBack") && boutons[2] === t("meetingClose"), boutons.join(" | "));
  clic(p3.querySelectorAll(".kz-actions .kz-btn")[2]);
  verifie("Fermer depuis le volet renvoie le koala, bulle comprise", await jusqua(() => racine(env.w).querySelectorAll(".kz-koala").length === 0, 900));

  // La fusee, seulement quand les animations sont permises.
  env = monte(Object.assign({}, BASE, { animMode: "always" }));
  brancheMock(env, { "kz-notify-prepare": data, "kz-notify-send": { ok: true, count: 2 } });
  env.ecoute(info, () => {});
  await pause(400);
  b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(600);
  clic(b.querySelector(".kz-btn--send"));
  await pause(80);
  const fusee = b.querySelector(".kz-rocket");
  verifie("le mail parti, une fusee decolle, avec sa flamme et sa trainee, puis la confirmation",
    !!fusee && !!fusee.querySelector("svg") && !!fusee.querySelector(".kz-rocket-flame") && !!fusee.querySelector(".kz-rocket-trail") && txt(b.querySelector(".kz-notify-msg--ok")) === t("notifySentMany").replace("{n}", "2"));
  verifie("la fusee est dessinee par nous, jamais une image ni un emoji", (srcM.match(/ROCKET_SVG = '<svg viewBox="0 0 40 64"/) || []).length === 1 && /@keyframes kzRocket/.test(srcM) && /@keyframes kzTrail/.test(srcM));
  env = monte(BASE);
  brancheMock(env, { "kz-notify-prepare": data, "kz-notify-send": { ok: true, count: 2 } });
  env.ecoute(info, () => {});
  await pause(120);
  b = bulle(env.w);
  clic(b.querySelector(".kz-btn--notify"));
  await pause(600);
  clic(b.querySelector(".kz-btn--send"));
  await pause(80);
  verifie("en mouvement reduit, pas de fusee, la confirmation seule", !b.querySelector(".kz-rocket") && !!b.querySelector(".kz-notify-msg--ok"));
  for (const L of ["fr", "en", "de"]) {
    const m = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales", L, "messages.json"), "utf8"));
    verifie("le message d'absence en " + L + " est court, sans proposition de report", m.notifyBodyAbsent.message.split("\n\n").length === 3 && !/report|reschedule|verschieb/i.test(m.notifyBodyAbsent.message) && !/délai/.test(m.notifyBodyAbsent.message));
  }
}


/* ================= Les deux koalas dessines, 2026-09-25 ================= */
// Un koala pour le rappel, un pour la citation, dessines par nous, animes.
// Les images de l'utilisateur gardent leur place.
async function testKoalasDessines() {
  const srcK = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("plus aucune photo par defaut, deux roles dessines", /DEFAULT_KOALAS = \["svg:reminder", "svg:quote"\]/.test(srcK) && !/images\/koala-/.test(srcK));
  verifie("les deux dessins existent et different", /KOALA_SVGS = \{\s*reminder: `<svg class="kz-svg"/.test(srcK) && /quote: `<svg class="kz-svg"/.test(srcK));
  // 2026-09-26 : seuls les yeux et les oreilles vivent en continu, plus le salut a l'arrivee.
  verifie("les animations retenues sont declarees : clignement, oreilles a tour de role, salut",
    /@keyframes kzEarTwitch \{/.test(srcK) && /@keyframes kzEarTwitchR \{/.test(srcK)
    && /\.kz-svg \.kz-eyes \{[^}]*kzBlink/.test(srcK) && /\.kz-svg \.kz-ear--r \{[^}]*animation-name: kzEarTwitchR; animation-delay: 3\.1s/.test(srcK)
    && /\.kz-svg \.kz-paw \{[^}]*kzWave 1\.4s ease-in-out \.5s 3/.test(srcK));
  verifie("plus de tete qui penche, de feuille qui balance ni de souffle sur le koala dessine",
    !/kzTilt|kzLeafSway/.test(srcK) && /kz-koala--vec"\) \? "" : ", kzBreath/.test(srcK));
  verifie("en buste, 150 px de haut, et une ombre douce", /\.kz-svg \{ width: auto; height: 150px;[^}]*drop-shadow/.test(srcK));
  verifie("les oreilles pivotent a leur base, cote tete", /\.kz-svg \.kz-ear--l \{ transform-origin: 82% 82%; \}/.test(srcK) && /\.kz-svg \.kz-ear--r \{ transform-origin: 18% 82%;/.test(srcK));
  verifie("oreilles de koala : un bord de fourrure fin, pas des lobes ronds",
    (srcK.match(/<g class="kz-ear kz-ear--l"><path d="M[^"]*"/) || [""])[0].split("Q").length > 50 && !/<g class="kz-ear[^>]*><circle/.test(srcK));
  verifie("en mouvement reduit, tout le koala se fige", /\.kz-svg \.kz-eyes, \.kz-svg \.kz-ear, \.kz-svg \.kz-paw \{ animation: none !important; \}/.test(srcK));

  // La citation a son koala, feuille a la patte, yeux mi-clos.
  let env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--done"));
  const r = racine(env.w);
  verifie("le koala de la citation est dessine, un brin d'herbe a la bouche et sans patte qui salue",
    await jusqua(() => { const k = r.querySelector(".kz-koala"); return !!k && !!k.querySelector(".kz-svg .kz-grass") && !k.querySelector(".kz-svg .kz-paw") && !!k.querySelector(".kz-quote-text"); }, 2500));
  const k2 = r.querySelector(".kz-koala");
  verifie("ses yeux sont mi-clos, des traits et pas des billes", !!k2 && k2.querySelectorAll(".kz-svg .kz-eyes path").length >= 2 && k2.querySelectorAll(".kz-svg .kz-eyes ellipse").length === 0);
  verifie("et il cligne a son propre rythme", !!k2 && /kz-svg--quote/.test(k2.querySelector(".kz-svg").getAttribute("class")));

  // Une image de l'utilisateur, sans les koalas d'origine : la photo prend la place.
  const PNG = "data:image/png;base64,iVBORw0KGgo=";
  env = monte(Object.assign({}, BASE, { customKoalas: [PNG], includeDefaultKoalas: false }));
  env.montre(CTX);
  await pause(120);
  verifie("avec une image perso seule, c'est elle qui parait", !!racine(env.w).querySelector(".kz-photo") && !racine(env.w).querySelector(".kz-svg"));
  // Avec les koalas d'origine gardes, l'un ou l'autre, jamais deux fois de suite le meme.
  env = monte(Object.assign({}, BASE, { customKoalas: [PNG], includeDefaultKoalas: true }));
  await pause(60);
  const tirages = [];
  for (let i = 0; i < 8; i++) {
    env.montre(CTX);
    await pause(120);
    const rr = racine(env.w);
    tirages.push(rr.querySelector(".kz-photo") ? "photo" : (rr.querySelector(".kz-svg .kz-paw") ? "svg" : "?"));
    clic(bulle(env.w).querySelector(".kz-btn--later"));
    await jusqua(() => rr.querySelectorAll(".kz-koala").length === 0, 900);
  }
  verifie("images perso et koala d'origine se partagent le rappel", tirages.indexOf("photo") >= 0 && tirages.indexOf("svg") >= 0 && tirages.indexOf("?") < 0, tirages.join(","));
  verifie("jamais deux fois de suite le meme", tirages.every((x, i) => i === 0 || x !== tirages[i - 1]), tirages.join(","));
  // Une image qui ne charge pas retombe sur le koala dessine.
  env = monte(Object.assign({}, BASE, { customKoalas: ["data:image/png;base64,AAAA"], includeDefaultKoalas: false }));
  env.montre(CTX);
  await pause(120);
  const img = racine(env.w).querySelector(".kz-photo");
  if (img) img.dispatchEvent(new env.w.Event("error"));
  await pause(30);
  verifie("une image illisible laisse la place au koala dessine", !!racine(env.w).querySelector(".kz-svg .kz-paw"));
}

/* ================= Corrections de la revue du 2026-09-16 ================= */
async function testCorrections() {
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  const styles = (src.match(/const STYLES = `([\s\S]*?)`;/) || [])[1] || "";
  verifie("la feuille de style est extraite", styles.length > 1000, String(styles.length));
  // Deux blocs orphelins avalaient les @keyframes qui les suivaient : le
  // souffle du koala (kzBreath) et l'entree du guillemet (kzMarkIn) ne
  // jouaient jamais, sans aucune erreur visible.
  verifie("les accolades de la feuille de style sont equilibrees",
    (styles.match(/\{/g) || []).length === (styles.match(/\}/g) || []).length,
    (styles.match(/\{/g) || []).length + " ouvrantes, " + (styles.match(/\}/g) || []).length + " fermantes");
  verifie("aucune declaration orpheline hors d'un bloc",
    !/\n\n\s+[a-z-]+:\s*[^;{}\n]+;\n/.test(styles));
  const lignesKf = styles.split("\n").filter((l) => l.indexOf("@keyframes") === 0);
  verifie("chaque @keyframes tient sur une ligne aux accolades equilibrees",
    lignesKf.length > 10 && lignesKf.every((l) => (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length),
    lignesKf.filter((l) => (l.match(/\{/g) || []).length !== (l.match(/\}/g) || []).length).join(" | "));
  ["kzBreath", "kzMarkIn", "kzWave", "kzBlink", "kzArrive", "kzLeave", "kzQuoteIn"].forEach((k) => {
    verifie("@keyframes " + k + " est defini", new RegExp("^@keyframes " + k + " \\{", "m").test(styles));
  });
  verifie("kzWave, utilise par la patte du koala qui salue, est defini",
    /\.kz-svg \.kz-paw \{[^}]*kzWave/.test(styles) && /^@keyframes kzWave \{/m.test(styles));

  // Un document ou le Shadow DOM est impossible : running est rendu, et le
  // rendez-vous obtient une reponse honnete plutot qu'un affichage promis.
  const env = monte(BASE);
  const orig = env.w.Element.prototype.attachShadow;
  env.w.Element.prototype.attachShadow = function () { throw new env.w.DOMException("non", "NotSupportedError"); };
  env.montre(CTX);
  await pause(120);
  let rep = null;
  const retour = env.ecoute({ type: "kz-meeting-soon", title: "X", start: Date.now() + 180000, minutes: 3, url: "", people: 2 }, (r) => { rep = r; });
  verifie("apres un echec du Shadow DOM, running est rendu et le canal reste ouvert", retour === true);
  verifie("le rendez-vous recoit shown a faux, background.js pourra notifier",
    await jusqua(() => rep !== null, 900) && !!rep && rep.shown === false, JSON.stringify(rep));
  env.w.Element.prototype.attachShadow = orig;
  verifie("aucune issue n'a ete enregistree pour un rappel qui n'a pas pu s'afficher",
    !env.journal.sorties.some((m) => m.type === "kz-outcome"));
}

/* ================= 6. La croix, porte de sortie sans le chat ================= */
async function testEchap() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  const b = bulle(env.w);
  verifie("la bulle est bien la avant Echap", !!b);
  // Echap vaut Plus tard, planche 04. C'est la seule sortie depuis que la croix
  // a disparu, et elle mene donc a la relance comme un clic sur Plus tard.
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await pause(140);
  // Echap se comporte exactement comme un clic sur Plus tard : le report part
  // tout de suite, sans question d'energie.
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("Echap compte l'occasion comme un report, tout de suite", envoi && envoi.result === "later" && envoi.energy === undefined,
    JSON.stringify(envoi));
  verifie("Echap n'envoie jamais missed", !env.journal.sorties.some(
    (m) => m.type === "kz-outcome" && m.result === "missed"));
  // Une seconde pression ne doit rien renvoyer, l'ecouteur est desarme.
  const avant = env.journal.sorties.filter((m) => m.type === "kz-outcome").length;
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await pause(80);
  const apres = env.journal.sorties.filter((m) => m.type === "kz-outcome").length;
  verifie("une seconde pression sur Echap ne compte pas deux fois", avant === apres,
    avant + " puis " + apres);
  // Une autre touche ne ferme rien.
  const env2 = monte(BASE);
  env2.montre(CTX);
  await pause(120);
  env2.w.document.dispatchEvent(new env2.w.KeyboardEvent("keydown", { key: "a", bubbles: true }));
  await pause(80);
  verifie("une autre touche ne ferme pas le rappel",
    !env2.journal.sorties.some((m) => m.type === "kz-outcome"));
}

/* ================= 7. Rappel sans reponse : il attend ================= */
// Retour du test en conditions reelles du 2026-09-17 : la bulle disparaissait
// au bout de 18 s, un rappel etait manque des qu'on avait le dos tourne.
// Desormais elle attend une reponse, sans delai, sans rien enregistrer.
async function testIgnore() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(1200);
  const r = racine(env.w);
  verifie("sans reponse, le koala et sa bulle restent a l'ecran",
    r.querySelectorAll(".kz-koala").length === 1 && !!bulle(env.w) && !!bulle(env.w).querySelector(".kz-btn--later"));
  verifie("rien n'est enregistre tant que personne n'a repondu",
    !env.journal.sorties.some((m) => m.type === "kz-outcome"), JSON.stringify(env.journal.sorties));
  verifie("aucun delai de 18 s ne subsiste dans le code", !/finish\("missed"\)|18000/.test(SRC));
  // Un rappel suivant qui arrive pendant l'attente ne construit rien de plus.
  env.montre(CTX);
  await pause(120);
  verifie("un rappel suivant pendant l'attente est ignore, un seul koala",
    r.querySelectorAll(".kz-koala").length === 1 && r.querySelectorAll(".kz-bubble").length === 1);
  // Et la reponse tardive compte normalement.
  clic(bulle(env.w).querySelector(".kz-btn--done"));
  await pause(120);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("une reponse tardive compte comme faite", !!envoi && envoi.result === "done", JSON.stringify(envoi));
}

/* ================= 8. Mode focus ================= */
async function testFocus() {
  const env = monte(BASE);
  env.montre(Object.assign({}, CTX, { focus: true, focusSeconds: 5 }));
  await pause(120);
  const r = racine(env.w);
  verifie("un voile bloque la page", !!r.querySelector(".kz-focus-back"));
  const b = bulle(env.w);
  verifie("la pastille annonce la pause focus",
    txt(b && b.querySelector(".kz-pill")) === t("bubblePillFocus"), txt(b && b.querySelector(".kz-pill")));
  verifie("un minuteur est affiche", txt(b && b.querySelector(".kz-timer")) === "00:05",
    txt(b && b.querySelector(".kz-timer")));
  verifie("une barre de progression est presente", !!(b && b.querySelector(".kz-bar-f")));
  const fait = b && b.querySelector(".kz-btn--done");
  verifie("le bouton de validation est verrouille au depart", !!(fait && fait.disabled));
  verifie("le bouton annonce le decompte", txt(fait).indexOf("5") >= 0, txt(fait));
  verifie("le report reste possible a tout moment",
    !!(b && b.querySelector(".kz-btn--later")) && !b.querySelector(".kz-btn--later").disabled);

  await pause(5600);
  const fait2 = bulle(env.w) && bulle(env.w).querySelector(".kz-btn--done");
  verifie("le bouton se deverrouille a la fin du minuteur", fait2 && !fait2.disabled,
    fait2 ? "encore verrouille" : "bouton absent");
  verifie("le bouton reprend son libelle normal", txt(fait2) === t("btnDone"), txt(fait2));
}

/* ================= 9. Un seul rappel a la fois ================= */
async function testConcurrence() {
  const env = monte(BASE);
  env.montre(CTX);
  env.montre(CTX);
  env.montre(CTX);
  await pause(150);
  const r = racine(env.w);
  verifie("un seul koala malgre trois declenchements",
    r.querySelectorAll(".kz-koala").length === 1, "vaut " + r.querySelectorAll(".kz-koala").length);
}

/* ================= 10. Contenus fournis et masquage ================= */
async function testContenus() {
  // Sans objectif personnel, on pioche dans les objectifs fournis
  const env = monte(Object.assign({}, BASE, { customSport: [] }));
  env.montre(CTX);
  await pause(120);
  verifie("sans objectif personnel, un objectif fourni est propose",
    txt(bulle(env.w).querySelector(".kz-lead")).length > 3, txt(bulle(env.w)));

  // Les citations masquees ne doivent plus sortir
  const env2 = monte(Object.assign({}, BASE, {
    customQuotes: [{ t: "Ma citation a moi", a: "Moi" }], includeDefaultQuotes: false
  }));
  env2.montre(CTX);
  await pause(120);
  clic(bulle(env2.w).querySelector(".kz-btn--done"));
  await pause(680);
  const b = bulle(env2.w);
  verifie("sans les citations d'origine, seule la tienne sort",
    txt(b && b.querySelector(".kz-quote-text")) === "Ma citation a moi",
    txt(b && b.querySelector(".kz-quote-text")));
  verifie("l'auteur declare est affiche",
    txt(b && b.querySelector(".kz-author-name")) === "Moi");
}

/* ---------- execution ---------- */

// Fidelite au pixel pres de la bulle de rappel, planche 04, verifiee au audit
// d'ensemble apres la livraison, un ecart de gabarit et deux couleurs de
// bouton avaient echappe a tous les controles precedents.
async function testStyleBulle() {
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  verifie("la bulle de rappel fait 364 px, planche 04", /width: 364px; box-sizing: border-box/.test(src));
  verifie("C'est fait est vert plein #146B2C, planche 04",
    /\.kz-btn--done \{ flex: 1 1 0; background: #146B2C/.test(src));
  verifie("Plus tard reste un lien texte, jamais un bouton plein",
    /\.kz-btn--later \{ flex: 0 0 auto; padding: 0; background: none; color: #666666; \}/.test(src));
  verifie("la respiration demarre a 300 ms fixes, jamais lies a l'arrivee",
    /kzBreath 5s ease-in-out 300ms infinite/.test(src));
  verifie("l'ouverture de la bulle suit T.bubble, jamais une duree en dur",
    /transition: opacity \$\{T\.bubble\}ms cubic-bezier\(0\.2,0,0,1\), transform \$\{T\.bubble\}ms cubic-bezier\(0\.2,0,0,1\)/.test(src));
}

(async () => {
  const suites = [
    ["Bulle d'habitude", testBulleHabitude],
    ["Les deux koalas dessines", testKoalasDessines],
    ["Au-dela de l'objectif, les bonus comptent", testBonus],
    ["Phrase sans chiffre", testSansChiffre],
    ["Rotation des objectifs", testRotation],
    ["Validation et citation", testValidation],
    ["Report, un report est un report", testReport],
    ["Echap vaut Plus tard", testEchap],
    ["Rappel ignore", testIgnore],
    ["Mode focus", testFocus],
    ["Un seul rappel a la fois", testConcurrence],
    ["Corrections de la revue du 2026-09-16", testCorrections],
    ["Le rappel de rendez-vous, module agenda", testRendezVous],
    ["Le rendez-vous reste, et la fin en ambre", testRendezVousPersistant],
    ["Prevenir les participants, volet de la bulle", testPrevenirBulle],
    ["Une page ne pilote pas la bulle", testPageNePilotePas],
    ["Durcissements de la revue ECC", testDurcissementsPage],
    ["Au-dessus de tout, meme un lecteur colle en bas", testAuDessus],
    ["Contenus et masquage", testContenus],
    ["Fidelite de la bulle de rappel a la planche", testStyleBulle]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);

  }

// ---------------------------------------------------------------------------
// Module A, ce qui a quitte la page : relance (2026-09-16), energie (2026-09-25).
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("plus aucune duree de relance ni de larmes dans l'objet T",
    ["sob:", "tear:", "tearGap:"].every((k) => src.indexOf(k) === -1));
  verifie("plus aucune relance, aucune pique, aucun Jamais dans la page",
    !/runSnark|showSnarkBubble|buildNeverBubble|playSob|kz-btn--never|KZ_SNARK/.test(src));
  verifie("aucune pause demandee par la page apres un report", !/"kz-pause"/.test(src));
  verifie("plus aucune echelle d'energie dans la page, ni code ni style",
    !/kz-energy|ENERGY_TONE|showEnergyPicker|energyBubbleNode|kzPick\b|kz-picked|\.kz-e[1-5] /.test(src));
  verifie("l'issue part sans energie", /sendMessage\(\{ type: "kz-outcome", result: result \}\)/.test(src));
  verifie("anneau de focus vert 3 px sur les elements de la bulle",
    /:focus-visible \{ outline: 3px solid #2FAE4A/.test(src));
  verifie("aucun mode de relance ne subsiste dans content.js", !/RELANCE_MODE|RELANCE_POOL|SNARK_KOALAS/.test(src));
}
// ---------------------------------------------------------------------------
// Module M, le placement selon le format du fichier, planches 06 et 07.
// ---------------------------------------------------------------------------
{
  const srcM = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  verifie("le carre de reference fait 150 px", /KZ_CARRE = 150/.test(srcM));
  verifie("le cote long est plafonne a 280 px", /KZ_LONG_MAX = 280/.test(srcM));
  verifie("le seuil du paysage est a 1,9, releve sur retour visuel",
    /KZ_SEUIL_PAYSAGE = 1\.9/.test(srcM));
  verifie("la photo est plafonnee a 280 px dans les deux sens",
    /max-height: 280px; max-width: 280px/.test(srcM));
  verifie("le cadre a un rayon de 16", /\.kz-photo \{ border-radius: 16px; \}/.test(srcM));

  // La geometrie du cadre, rejouee ici sans DOM. L'image ne doit jamais etre
  // deformee ni recadree, seulement mise a l'echelle.
  const cadre = (w, h) => {
    const ratio = w / h;
    const grand = Math.max(ratio, 1 / ratio);
    const long = Math.min(280, Math.round(150 * Math.min(grand, 1.6)));
    return (ratio >= 1)
      ? { w: long, h: Math.round(long / ratio), paysage: ratio > 1.9 }
      : { w: Math.round(150 * ratio), h: 150, paysage: false };
  };

  let c = cadre(400, 400);
  verifie("un carre rend le carre de reference de 150 px", c.w === 150 && c.h === 150, JSON.stringify(c));
  verifie("un carre n'est pas du paysage", c.paysage === false);

  c = cadre(300, 400);
  verifie("un portrait garde 150 px de haut", c.h === 150, JSON.stringify(c));
  verifie("un portrait n'est jamais du paysage", c.paysage === false);
  verifie("un portrait garde son rapport", Math.abs(c.w / c.h - 300 / 400) < 0.02, JSON.stringify(c));

  c = cadre(400, 300);
  verifie("un paysage a 1,33 reste a GAUCHE, le rendu valide de la 1.2.0",
    c.paysage === false, JSON.stringify(c));
  verifie("une image large garde son rapport", Math.abs(c.w / c.h - 400 / 300) < 0.02, JSON.stringify(c));

  c = cadre(390, 300);
  verifie("pile 1,9 n'est PAS du paysage, le seuil est strict",
    cadre(285, 150).paysage === false, JSON.stringify(cadre(285, 150)));

  c = cadre(1000, 300);
  verifie("un panoramique est plafonne a 240 px de large", c.w === 240, JSON.stringify(c));
  verifie("un panoramique garde son rapport, aucun recadrage",
    Math.abs(c.w / c.h - 1000 / 300) < 0.05, JSON.stringify(c));
  verifie("un panoramique bascule bien en paysage", c.paysage === true, JSON.stringify(c));
  verifie("un panoramique reste du paysage", c.paysage === true);

  c = cadre(300, 1000);
  verifie("un portrait tres haut reste a 150 px de haut", c.h === 150, JSON.stringify(c));
  verifie("un portrait tres haut ne depasse jamais 280", c.w <= 280 && c.h <= 280, JSON.stringify(c));

  verifie("des dimensions nulles ne cassent rien", /if \(!w \|\| !h\) return null;/.test(srcM));

  // Le placement paysage, bulle au dessus, pointe en bas, decalage de 44 px.
  verifie("en paysage la bulle passe au dessus",
    /\.kz-koala--land \{ flex-direction: column;/.test(srcM));
  verifie("en paysage la bulle se decale de 44 px vers la gauche",
    /\.kz-koala--land \.kz-bubble \{[^}]*margin-right: 44px/.test(srcM));
  verifie("en paysage la bulle recoit une pointe",
    /\.kz-koala--land \.kz-bubble::after/.test(srcM));
  verifie("la pointe se retourne vers le bas",
    /\.kz-koala--land \.kz-bubble::after \{[\s\S]*?bottom: -7px/.test(srcM));
  verifie("la pointe fait 13 px comme celle des passages",
    /\.kz-koala--land \.kz-bubble::after \{[\s\S]*?width: 13px; height: 13px/.test(srcM));
  verifie("en paysage le personnage passe sous la bulle",
    /\.kz-koala--land \.kz-inner \{ order: 2; \}/.test(srcM));

  // Une seule bascule interne, aucun ecran ni reglage supplementaire.
  verifie("le placement se decide sur les dimensions naturelles",
    /posePlacement\(wrap, img, estPerso\)/.test(srcM) && /img\.naturalWidth/.test(srcM));
  // Le paysage ne doit JAMAIS s'appliquer a une image livree avec l'extension.
  // Les deux images de relance du public sont a 1,32 et 1,33 de rapport, elles
  // franchissaient donc le seuil et faisaient sortir le personnage du cadre.
  verifie("le paysage est reserve aux images de l'utilisateur",
    /if \(!estPerso\) return;/.test(srcM));
  verifie("une image de l'utilisateur se reconnait a sa source integree",
    /src\.indexOf\("data:"\) === 0 \|\| src\.indexOf\("blob:"\) === 0/.test(srcM));
  verifie("le cas de l'image deja en cache est gere",
    /if \(img\.complete && img\.naturalWidth\) posePlacement\(wrap, img, estPerso\)/.test(srcM));
  verifie("aucun reglage supplementaire n'est expose pour le perso",
    srcM.indexOf("paysageSetting") === -1 && srcM.indexOf("bubblePlacement") === -1);
}

// ---------------------------------------------------------------------------
// La pointe de la bulle, planche 06, ou elle apparait 20 fois.
// ---------------------------------------------------------------------------
{
  const srcT = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  const gauche = (srcT.match(/\n\.kz-bubble::after \{([\s\S]*?)\}/) || [])[1] || "";
  const paysage = (srcT.match(/\.kz-koala--land \.kz-bubble::after \{([\s\S]*?)\}/) || [])[1] || "";

  verifie("la bulle porte une pointe", gauche.length > 20);
  verifie("la bulle est positionnee pour recevoir sa pointe",
    /\.kz-bubble \{ position: relative; \}/.test(srcT));
  verifie("pointe gauche, sur le bord droit", /right: -7px/.test(gauche), gauche);
  verifie("pointe gauche, a 22 px du bas", /bottom: 22px/.test(gauche));
  verifie("pointe gauche, 13 px de cote", /width: 13px; height: 13px/.test(gauche));
  verifie("pointe gauche, bordures haute et droite",
    /border-top: 1px solid #E0E0E0/.test(gauche) && /border-right: 1px solid #E0E0E0/.test(gauche));
  verifie("pointe gauche, rayon du coin exterieur", /border-radius: 0 3px 0 0/.test(gauche));
  verifie("pointe gauche, rotation de 45 degres", /rotate\(45deg\)/.test(gauche));
  verifie("pointe paysage, en bas", /bottom: -7px/.test(paysage), paysage);
  verifie("pointe paysage, decalee du bord droit", /right: 30px/.test(paysage));
  verifie("pointe paysage, bordures droite et basse",
    /border-bottom: 1px solid #E0E0E0/.test(paysage) && /border-right: 1px solid #E0E0E0/.test(paysage));
  verifie("pointe paysage, la bordure haute est retiree", /border-top: none/.test(paysage));
  verifie("pointe paysage, rayon du coin bas droit", /border-radius: 0 0 3px 0/.test(paysage));
  // 2026-09-16 : la bulle graphite de la relance n'existe plus, sa pointe non
  // plus. Aucune regle ne doit en rester, ni en placement normal ni en paysage.
  verifie("plus aucune pointe graphite, la bulle de relance a disparu",
    !/\.kz-bubble--cat/.test(srcT));
}

// ---------------------------------------------------------------------------
// Corrections issues du premier essai en vrai navigateur.
// ---------------------------------------------------------------------------
{
  const srcB = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  // Le personnage manquait dans la bulle de relance. Les deux images livrees sont
  // a 1,32 et 1,33 de rapport, elles franchissaient le seuil de paysage et
  // faisaient basculer la bulle AU DESSUS, le personnage sortant du cadre.
  verifie("le paysage ne s'applique qu'aux images de l'utilisateur",
    /if \(!estPerso\) return;/.test(srcB));
  verifie("aucune cle d'energie n'est plus employee", srcB.indexOf("energySkip") === -1 && srcB.indexOf("energyQ") === -1);
}
{
  const srcP = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");

  // Les SVG decoratifs ne se dessinaient pas, pastille d'en-tete, vignette de
  // personnage par defaut et koala de l'ecran vide restaient vides.
  verifie("les SVG decoratifs passent par poseSvg", /function poseSvg/.test(srcP));
  verifie("la pastille d'en-tete est posee", /poseSvg\(\$\("headMark"\)/.test(srcP));
  verifie("le koala de l'ecran vide est pose", /poseSvg\(\$\("blankKoala"\)/.test(srcP));
  verifie("aucun appel a importNode ou adoptNode dans le popup",
    !/\.importNode\(|\.adoptNode\(/.test(srcP));
  // 2026-08-04, innerHTML puis Range.createContextualFragment retires
  // (avertissements addons-linter), voir passages.js. svgNode reconstruit le
  // SVG noeud par noeud avec createElementNS, DOMParser n'est lu que comme un
  // arbre de donnees, jamais importe dans le document courant.
  verifie("svgNode construit par reconstruction createElementNS",
    /function svgNode[\s\S]{0,260}rebuildSvgNode/.test(srcP)
    && /function rebuildSvgNode[\s\S]{0,800}createElementNS/.test(srcP));
  verifie("plus aucune assignation .innerHTML ni appel a createContextualFragment dans le popup",
    (srcP.match(/\.innerHTML\s*=/g) || []).length === 0
    && !/\.createContextualFragment\(/.test(srcP));

  // Le plafond de personnages passe de douze a dix-huit.
  verifie("le plafond est a dix-huit", /const MAX_KOALAS = 18;/.test(srcP));
  verifie("aucun douze en dur ne subsiste pour la galerie",
    srcP.indexOf("Math.min(12,") === -1);

  // Le filtre de periode avait son fond ecrase par une regle plus generale.
  verifie("le filtre de periode a sa propre regle active",
    /\.segbox--range \.seg-b--on \{[^}]*background: var\(--w\)/.test(html));
  verifie("le filtre de periode garde son ombre de pilule",
    /\.segbox--range \.seg-b--on \{[^}]*box-shadow: var\(--sh-tab\)/.test(html));

  // Les fleches paraissaient desactivees en permanence.
  verifie("les fleches ont un contour vert et une ombre",
    /\.nav-a \{[^}]*border: 1px solid var\(--gr-300\)/.test(html)
    && /\.nav-a \{[^}]*box-shadow: var\(--sh-card\)/.test(html));
  verifie("les fleches ont un etat au survol", /\.nav-a:hover/.test(html));
  verifie("le premier pas en arriere est toujours permis",
    /if \(o === 0\) return true;/.test(srcP));

  // Les boutons plus et moins de l'intervalle Perso.
  verifie("les boutons ronds ont un glyphe lisible",
    /\.rnd \{[^}]*font-size: 18px; font-weight: 600/.test(html));
  verifie("les boutons ronds ont un etat au survol", /\.rnd:hover/.test(html));

  // Le bouton de test des passages.
  verifie("le bouton de test existe", /id="passagesTest"/.test(html));
  verifie("le bouton de test envoie son message", /send\("kz-passage-now"\)/.test(srcP));
}
{
  const srcBg = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  verifie("l'arriere plan ecoute le test de passage", /msg\.type === "kz-passage-now"/.test(srcBg));
  verifie("le test contourne l'horaire, l'ecart et le plafond",
    /motif === "horaire" \|\| motif === "ecart" \|\| motif === "plafond"/.test(srcBg));
  verifie("le test ne contourne PAS la visio",
    /if \(cfg\.muteInCalls && matchesMuted\(tab\.url, cfg\.mutedPatterns\)\) return;/.test(srcBg));
  verifie("ni le test ni la ronde du soir ne consomment le quota du jour", /\+ \(\(test \|\| evening\) \? 0 : 1\)/.test(srcBg));
  verifie("le test ne consomme pas le creneau des deux heures", /last: test \? st\.last : now/.test(srcBg));
}

// ---------------------------------------------------------------------------
// Second essai navigateur. Les SVG ne se dessinaient pas dans le Shadow DOM.
// ---------------------------------------------------------------------------
{
  const srcS = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  // Un noeud issu de DOMParser puis importNode existe dans l'arbre et ne se
  // DESSINE pas. C'est ce qui faisait disparaitre le vu de la coche et le
  // personnage de la bulle de relance, deux symptomes pour une seule cause.
  verifie("aucun appel a importNode ou adoptNode dans la page",
    !/\.importNode\(|\.adoptNode\(/.test(srcS));
  // 2026-08-04, innerHTML puis Range.createContextualFragment (avertissements
  // addons-linter, corriges plutot qu'acceptes) : le SVG est reconstruit noeud
  // par noeud avec createElementNS et setAttribute. DOMParser ne fait que LIRE
  // la chaine comme un arbre de donnees, verifie cote a cote avec
  // DOMParser+importNode (qui ne dessine rien) et avec innerHTML (identique),
  // voir PROJECT_HANDOFF.md.
  verifie("svgFromString construit par reconstruction createElementNS",
    /function svgFromString[\s\S]{0,260}rebuildSvgNode/.test(srcS)
    && /function rebuildSvgNode[\s\S]{0,800}createElementNS/.test(srcS));
  verifie("le SVG est lu depuis un document DOMParser jetable, jamais importe dans le document courant",
    /new DOMParser\(\)\.parseFromString\(markup, "image\/svg\+xml"\)/.test(srcS));
  verifie("svgNode reutilise svgFromString",
    /function svgNode\(role\) \{\s*const n = svgFromString\(KOALA_SVGS\[/.test(srcS));
  verifie("plus aucune assignation .innerHTML ni appel a createContextualFragment dans la page",
    (srcS.match(/\.innerHTML\s*=/g) || []).length === 0
    && !/\.createContextualFragment\(/.test(srcS));
  verifie("aucune fonction morte de parsing ne subsiste", srcS.indexOf("svgNodeAncien") === -1);

  // Le placement des images larges revient au rendu valide de la 1.2.0.
  verifie("la croissance du cadre est plafonnee",
    /Math\.min\(grand, 1\.6\)/.test(srcS));
}
{
  const html2 = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  // `.segbox` est declare PLUS LOIN avec la meme specificite, il gagnait donc.
  // La classe doublee passe devant sans toucher a l'autre regle.
  verifie("le filtre de periode passe devant la regle generale",
    /\.segbox\.segbox--range \.seg-b--on \{/.test(html2));
  verifie("le filtre de periode impose son fond gris",
    /\.segbox\.segbox--range \{[^}]*background: var\(--seg\)/.test(html2));
  verifie("le filtre de periode annule la bordure de la regle generale",
    /\.segbox\.segbox--range \{[^}]*border: none/.test(html2));
  verifie("les cinq positions se partagent la largeur",
    /\.segbox\.segbox--range \.seg \{[^}]*width: 100%/.test(html2));
  verifie("chaque position prend sa part egale",
    /\.segbox\.segbox--range \.seg-b \{[^}]*flex: 1 1 0/.test(html2));
}


  console.log("\n=== content.js : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
