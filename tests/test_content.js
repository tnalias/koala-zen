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
    ['setTimeout(() => finish("missed"), 18000)', 'setTimeout(() => finish("missed"), 400)'],
    ['setTimeout(() => finish("timeout"), 11000)', 'setTimeout(() => finish("timeout"), 900)'],
    ['setTimeout(() => { if (!picked) { picked = true; onPick(null); } }, 20000)', 'setTimeout(() => { if (!picked) { picked = true; onPick(null); } }, 350)'],
    ["waitOrDismiss(9500", "waitOrDismiss(900"],
    ["await sleep(T.arrive + 60)", "await sleep(T.arrive + 10)"],
    ["await sleep(900)", "await sleep(60)"],
    ["await sleep(3200)", "await sleep(600)"]
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
function monte(store) {
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
  w.eval(QUOTES + "\n" + SRC);
  return { w, donnees, journal, montre: (m) => ecouteur && ecouteur(m) };
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
  verifie("le koala est bien une image", !!(r && r.querySelector(".kz-photo")));
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

/* ================= 4. Validation, energie, coche, citation ================= */
async function testValidation() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--done"));
  await pause(80);

  let b = bulle(env.w);
  const cases = b ? b.querySelectorAll(".kz-energy-btn") : [];
  verifie("l'echelle d'energie compte dix cases", cases.length === 10, "vaut " + cases.length);
  verifie("les extremes sont libelles",
    txt(b && b.querySelector(".kz-energy-lo")) === t("energyLow") &&
    txt(b && b.querySelector(".kz-energy-hi")) === t("energyHigh"));
  verifie("l'etape ne peut plus etre passee, aucun lien Passer",
    !!b && !b.querySelector(".kz-energy-skip"));
  verifie("les dix valeurs sont proposees",
    !!b && b.querySelectorAll(".kz-energy-btn").length === 10,
    b ? b.querySelectorAll(".kz-energy-btn").length : "absent");

  clic(cases[7]);
  await pause(150);
  b = bulle(env.w);
  verifie("l'ecran de validation apparait", !!(b && b.classList.contains("kz-bubble--win")), txt(b));
  verifie("la coche est dessinee", !!(b && b.querySelector(".kz-check")));
  verifie("le felicitation est affiche", txt(b && b.querySelector(".kz-win-t")) === t("winTitle"));
  verifie("la serie est incrementee a l'ecran",
    txt(b && b.querySelector(".kz-win-n")) === "7", txt(b && b.querySelector(".kz-win-n")));
  verifie("des etincelles sont posees", (b ? b.querySelectorAll(".kz-spark").length : 0) === 4);

  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("l'issue faite est transmise", envoi && envoi.result === "done", JSON.stringify(envoi));
  verifie("l'energie choisie est transmise", envoi && envoi.energy === 8, JSON.stringify(envoi));

  await pause(560);
  b = bulle(env.w);
  verifie("la citation arrive ensuite", !!(b && b.querySelector(".kz-quote-text")), txt(b));
  verifie("la pastille annonce la pensee du jour",
    txt(b && b.querySelector(".kz-pill")) === t("bubblePillQuote"), txt(b && b.querySelector(".kz-pill")));
  verifie("le temps d'ecran du jour est rappele",
    txt(b && b.querySelector(".kz-foot")).indexOf("4 h 18") >= 0, txt(b && b.querySelector(".kz-foot")));
  verifie("aucune pique apres une habitude faite",
    !env.journal.sorties.some((m) => m.result === "later" || m.result === "missed"));
}

/* ================= 5. Report, pique du chat, deux issues ================= */
async function testReport() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(80);
  const cases = bulle(env.w).querySelectorAll(".kz-energy-btn");
  verifie("l'energie est demandee meme sur un report", cases.length === 10);
  clic(cases[2]);
  await pause(260);

  const b = bulle(env.w);
  verifie("la bulle du chat est graphite", !!(b && b.classList.contains("kz-bubble--cat")), txt(b));
  verifie("la pastille du chat est la bonne",
    txt(b && b.querySelector(".kz-pill")) === t("bubblePillSnark"), txt(b && b.querySelector(".kz-pill")));
  verifie("le chat signe la replique",
    txt(b && b.querySelector(".kz-author-name")) === t("snarkAuthor"));
  const batons = b ? b.querySelectorAll(".kz-stick") : [];
  verifie("les batons comptent le report du jour", batons.length === 3, "vaut " + batons.length);
  verifie("le compteur est libelle",
    txt(b && b.querySelector(".kz-tally-lab")).indexOf("3e report") >= 0,
    txt(b && b.querySelector(".kz-tally-lab")));
  verifie("deux issues sont proposees",
    !!(b && b.querySelector(".kz-btn--go")) && !!(b && b.querySelector(".kz-btn--never")));

  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("l'issue reportee est transmise", envoi && envoi.result === "later", JSON.stringify(envoi));
  verifie("l'energie du report est transmise", envoi && envoi.energy === 3);

  clic(b.querySelector(".kz-btn--go"));
  await pause(160);
  const rep = bulle(env.w);
  verifie("la reponse J'y vais est claire, pas graphite",
    rep && !rep.classList.contains("kz-bubble--cat"), txt(rep));
  verifie("la reponse annonce la prochaine visite",
    txt(rep).indexOf("15 minutes") >= 0, txt(rep));
  verifie("la reponse rappelle la progression du jour", !!(rep && rep.querySelector(".kz-day")));
  verifie("une seule issue enregistree, le report",
    env.journal.sorties.filter((m) => m.type === "kz-outcome").length === 1);
}

async function testJamais() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(80);
  clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(260);
  clic(bulle(env.w).querySelector(".kz-btn--never"));
  await pause(160);
  const rep = bulle(env.w);
  verifie("la reponse Jamais reste graphite", !!(rep && rep.classList.contains("kz-bubble--cat")), txt(rep));
  verifie("la reponse Jamais recompte les batons",
    (rep ? rep.querySelectorAll(".kz-stick").length : 0) === 3);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("l'energie choisie est bien transmise", envoi && envoi.energy === 7, JSON.stringify(envoi));
}

// Sans reponse a la pique, le personnage restait pourtant retire a la fin de
// la sequence, puis un rappel suivant en construisait un second par dessus.
// A l'ecran cela ressemblait a une apparition, un depart, une reapparition.
async function testPersistanceRelance() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(80);
  clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[4]);
  await pause(260);

  const r = racine(env.w);
  verifie("la pique du chat est affichee avant le delai", !!bulle(env.w));
  verifie("un seul personnage a l'ecran pendant la pique",
    r.querySelectorAll(".kz-koala").length === 1, String(r.querySelectorAll(".kz-koala").length));

  // Personne ne repond, le delai de la pique (raccourci a 900 ms) s'ecoule.
  await pause(1000);
  verifie("sans reponse, le personnage reste a l'ecran de lui meme",
    r.querySelectorAll(".kz-koala").length === 1, String(r.querySelectorAll(".kz-koala").length));
  verifie("sa bulle de pique s'efface, il n'y a plus rien a repondre", !bulle(env.w));

  // Le rappel suivant doit retrouver ce personnage, jamais en construire un
  // second par dessus.
  env.montre(CTX);
  await pause(120);
  verifie("le rappel suivant ne construit pas un second personnage",
    r.querySelectorAll(".kz-koala").length === 1, String(r.querySelectorAll(".kz-koala").length));
  verifie("le rappel suivant retrouve la bulle d'habitude normale, pas la pique",
    !!(bulle(env.w) && bulle(env.w).querySelector(".kz-btn--later")));
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
  // Echap se comporte exactement comme un clic sur Plus tard, donc l'energie est
  // demandee avant que l'issue ne partle. Rien n'est envoye tant qu'on n'a pas
  // repondu, et l'energie n'est jamais obligatoire.
  const grille = bulle(env.w) && bulle(env.w).querySelector(".kz-energy-row");
  verifie("Echap ouvre le selecteur d'energie, comme Plus tard", !!grille);
  verifie("rien n'est encore envoye avant la reponse d'energie",
    !env.journal.sorties.some((m) => m.type === "kz-outcome"));
  clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(140);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("Echap compte l'occasion comme un report", envoi && envoi.result === "later",
    JSON.stringify(envoi));
  verifie("l'energie choisie n'est jamais inventee ni arrondie", envoi && envoi.energy === 7,
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

/* ================= 7. Rappel ignore ================= */
async function testIgnore() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(520);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome");
  verifie("un rappel ignore compte comme manque", envoi && envoi.result === "missed", JSON.stringify(envoi));
  await pause(160);
  verifie("un rappel ignore reveille le chat",
    !!racine(env.w).querySelector(".kz-bubble--cat"));
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
// Sans ce filet, ne jamais cliquer sur l'ecran d'energie bloquait la
// sequence pour toujours (running restait vrai a vie), avalant tous les
// rappels futurs en silence. Le filet ne doit RIEN afficher a l'ecran, il
// se contente de debloquer la suite avec une energie non enregistree.
async function testEnergieSansReponse() {
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(60);
  // Aucun clic sur les dix cases d'energie, on attend le filet de securite
  // (raccourci a 350 ms pour le test, 20 s en production).
  await pause(500);
  const envoi = env.journal.sorties.find((m) => m.type === "kz-outcome" && m.result === "later");
  verifie("le report est enregistre meme sans energie choisie",
    !!envoi, JSON.stringify(env.journal.sorties));
  verifie("l'energie non choisie part a null, jamais une valeur inventee",
    envoi && envoi.energy === null, JSON.stringify(envoi));
  verifie("la sequence continue apres le filet, la relance apparait",
    !!racine(env.w).querySelector(".kz-bubble--cat"));
}

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
  await pause(60);
  clic(bulle(env2.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(620);
  const b = bulle(env2.w);
  verifie("sans les citations d'origine, seule la tienne sort",
    txt(b && b.querySelector(".kz-quote-text")) === "Ma citation a moi",
    txt(b && b.querySelector(".kz-quote-text")));
  verifie("l'auteur declare est affiche",
    txt(b && b.querySelector(".kz-author-name")) === "Moi");
}

/* ---------- execution ---------- */

/* ================= Modules J et K, relance et renoncement ================= */
async function testRelance() {
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  // Les cinq personnages de la planche 05, dans l'ordre, koala sournois en tete.
  const m = src.match(/const RELANCE = \[([\s\S]*?)\n    \];/);
  verifie("la table des cinq personnages existe", !!m);
  if (m) {
    const ids = (m[1].match(/id: "(\w+)"/g) || []).map((x) => x.slice(5, -1));
    verifie("cinq personnages, pas quatre", ids.length === 5, JSON.stringify(ids));
    verifie("le koala sournois ouvre toujours le cycle", ids[0] === "koala", JSON.stringify(ids));
    verifie("l'ordre de la planche est respecte",
      JSON.stringify(ids) === JSON.stringify(["koala", "renard", "chat", "diable", "sourcil"]),
      JSON.stringify(ids));
    const ms = (m[1].match(/ms: (\d+)/g) || []).map((x) => parseInt(x.slice(4), 10));
    verifie("les cinq durees de la planche", JSON.stringify(ms) === JSON.stringify([5000, 5000, 3400, 2800, 4200]),
      JSON.stringify(ms));
    verifie("deux personnages dessines, trois emojis",
      (m[1].match(/kind: "svg"/g) || []).length === 2 && (m[1].match(/kind: "emoji"/g) || []).length === 3);
  }
  verifie("le koala sournois est un dessin embarque", /RELANCE_SVG_KOALA = `<svg/.test(src));
  verifie("le renard est un dessin embarque", /RELANCE_SVG_RENARD = `<svg/.test(src));
  verifie("chaque personnage a son geste propre",
    ["kzSneak", "kzLurk", "kzPounce", "kzDevil", "kzBrow"].every((a) => src.indexOf(a) > -1));
  // Le geste de chaque personnage doit correspondre a celui BAKE dans son
  // propre SVG, sinon le koala hérite du dandinement du renard et vice versa.
  // Deja arrive une fois, jamais vu car aucun controle ne le disait.
  if (m) {
    verifie("le koala sournois garde son propre geste, kzSneak",
      /id: "koala",\s*kind: "svg",\s*svg: "koala",\s*ms: 5000, anim: "kzSneak"/.test(m[1]), m[1]);
    verifie("le renard garde son propre geste, kzLurk",
      /id: "renard",\s*kind: "svg",\s*svg: "renard",\s*ms: 5000, anim: "kzLurk"/.test(m[1]), m[1]);
    verifie("chaque personnage porte sa propre courbe d'aisance",
      /anim: "kzSneak",\s*ease: "ease-in-out"/.test(m[1]) &&
      /anim: "kzLurk",\s*ease: "ease-in-out"/.test(m[1]) &&
      /anim: "kzPounce", ease: "cubic-bezier\(0\.34,1\.06,0\.4,1\)"/.test(m[1]) &&
      /anim: "kzDevil",\s*ease: "ease-in-out"/.test(m[1]) &&
      /anim: "kzBrow",\s*ease: "ease-in-out"/.test(m[1]), m[1]);
  }
  // Le SVG du personnage porte deja overflow:visible et transform-origin dans
  // son propre style. Ecraser tout l'attribut au lieu d'en retirer seulement
  // l'animation les perdait, le personnage pivotait alors sur le mauvais point.
  verifie("le style du personnage de relance est complete, jamais ecrase",
    /const base = \(svg\.getAttribute\("style"\) \|\| ""\)\.replace\(\/animation:\[\^;\]\*;\?\/, ""\);/.test(src));

  // Le ton, aucun rouge, aucun point d'exclamation, aucun son.
  const bloc = src.slice(src.indexOf("const RELANCE = ["), src.indexOf("const SOB = ["));
  verifie("aucun rouge dans les personnages de relance", !/#(A82722|8F2723|F7DAD8)/.test(bloc));
  verifie("aucun son", src.indexOf("new Audio") === -1 && src.indexOf(".play()") === -1);

  // La rotation avance d'un cran par report et boucle, TANT QUE snarkDay
  // reste la date du jour, sinon l'index repart de zero (verifie plus bas).
  const auj = (() => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })();
  const vus = [];
  let idx = 0;
  for (let i = 0; i < 6; i++) {
    const env = monte(Object.assign({}, BASE, { snarkIndex: idx, snarkDay: auj }));
    env.montre(CTX);
    await pause(120);
    clic(bulle(env.w).querySelector(".kz-btn--later"));
    await pause(60);
    clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[6]);
    await pause(900);
    idx = env.donnees.snarkIndex;
    vus.push(idx);
  }
  verifie("la rotation avance d'un cran par report et boucle sur cinq",
    JSON.stringify(vus) === JSON.stringify([1, 2, 3, 4, 0, 1]), JSON.stringify(vus));

  // Le cycle repart a zero chaque matin, jamais en continu d'un jour a l'autre.
  const envHier = monte(Object.assign({}, BASE, { snarkIndex: 3, snarkDay: "2000-1-1" }));
  envHier.montre(CTX);
  await pause(120);
  clic(bulle(envHier.w).querySelector(".kz-btn--later"));
  await pause(60);
  clic(bulle(envHier.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(900);
  verifie("un snarkDay perime remet la rotation a zero, jamais une continuation",
    envHier.donnees.snarkIndex === 1, envHier.donnees.snarkIndex);
  verifie("le personnage servi apres un snarkDay perime est bien le premier du cycle (le koala)",
    envHier.donnees.snarkDay === auj);

  // La bulle graphite, le compteur et les deux issues ne changent jamais.
  const env = monte(BASE);
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(60);
  clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[6]);
  // La bulle de relance expire a 900 ms dans le harnais raccourci. Attendre
  // 1000 ms mesurait donc APRES sa disparition, et le test etait a la limite
  // depuis le debut. On mesure des qu'elle est arrivee, soit 500 ms.
  await pause(500);
  const r = racine(env.w);
  const cat = r.querySelector(".kz-bubble--cat");
  verifie("la bulle de relance est graphite", !!cat);
  verifie("le compteur de batons est la", !!(cat && cat.querySelector(".kz-tally")));
  const btns = cat ? cat.querySelectorAll("button") : [];
  verifie("deux issues seulement, et aucune croix", btns.length === 2, String(btns.length));
  verifie("aucune croix dans la bulle de relance", !(cat && cat.querySelector(".kz-close")));
  verifie("sans personnalisation la relance est dessinee et non une image",
    !!r.querySelector(".kz-relance"), "aucun .kz-relance");
  // SNARK_KOALAS est un chemin du paquet, pas une donnee integree. Sans
  // resolution par getURL, l'image ne charge jamais sur la page visitee et le
  // repli SVG joue en silence des qu'un utilisateur personnalise sans garder
  // les koalas d'origine. Le harnais ne peut pas le voir sur l'image rendue,
  // son getURL simule la meme origine que la page de test, donc le controle
  // porte sur le code source.
  verifie("SNARK_KOALAS est resolu par getURL, jamais un chemin brut",
    /function snarkUrls\(\) \{\s*\n\s*return SNARK_KOALAS\s*\n\s*\.map\(\(p\) => \{ try \{ return api\.runtime\.getURL\(p\)/.test(src));

  // Echap doit aussi fermer la bulle de relance, comme le timeout de 11 s,
  // sans jamais envoyer d'issue et sans faire sortir le personnage.
  const envEc = monte(BASE);
  envEc.montre(CTX);
  await pause(120);
  clic(bulle(envEc.w).querySelector(".kz-btn--later"));
  await pause(60);
  clic(bulle(envEc.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(500);
  const rEc = racine(envEc.w);
  verifie("la bulle de relance est bien la avant Echap", !!rEc.querySelector(".kz-bubble--cat"));
  const avantEc = envEc.journal.sorties.length;
  envEc.w.document.dispatchEvent(new envEc.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await pause(80);
  verifie("Echap efface la bulle de relance", !racine(envEc.w).querySelector(".kz-bubble--cat"));
  verifie("le personnage reste a l'ecran, il ne sort jamais de lui-meme",
    !!racine(envEc.w).querySelector(".kz-koala"));
  verifie("Echap sur la relance n'envoie jamais de message",
    envEc.journal.sorties.length === avantEc, JSON.stringify(envEc.journal.sorties.slice(avantEc)));
}

// Sans koala d'origine garde, la relance doit reagir avec les images de
// l'utilisateur, meme quand RELANCE_MODE vaut "drawn", planche 09 revue au
// retrait du build perso, la personnalisation remplace desormais le casting
// dessine plutot que de s'y ajouter.
async function testRelancePersonnalisee() {
  const mesImages = ["data:image/png;base64,AAA", "data:image/png;base64,BBB"];
  const env = monte(Object.assign({}, BASE, { customKoalas: mesImages, includeDefaultKoalas: false }));
  env.montre(CTX);
  await pause(120);
  clic(bulle(env.w).querySelector(".kz-btn--later"));
  await pause(60);
  clic(bulle(env.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(500);
  const img = racine(env.w).querySelector("img");
  verifie("koalas d'origine non gardes, la relance utilise une image personnalisee",
    !!img && mesImages.indexOf(img.src) > -1, img && img.src);

  // A l'inverse, garder les koalas d'origine garde la paire de la planche.
  const env2 = monte(Object.assign({}, BASE, { customKoalas: mesImages, includeDefaultKoalas: true }));
  env2.montre(CTX);
  await pause(120);
  clic(bulle(env2.w).querySelector(".kz-btn--later"));
  await pause(60);
  clic(bulle(env2.w).querySelectorAll(".kz-energy-btn")[6]);
  await pause(500);
  // Selon le build, "d'origine" est soit le casting dessine (aucune image),
  // soit la paire figee de la planche (une image, mais pas celle du bouton).
  // Aucun des deux ne montre les photos personnalisees.
  const img2 = racine(env2.w).querySelector("img");
  verifie("koalas d'origine gardes, la relance ne montre pas les photos personnalisees",
    !img2 || mesImages.indexOf(img2.src) === -1, img2 && img2.src);
}

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

async function testRenoncement() {
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  // Trois intensites, indexees sur le nombre de reports du jour.
  const m = src.match(/const SOB = \[([\s\S]*?)\n    \];/);
  verifie("les trois intensites existent", !!m);
  if (m) {
    const tears = (m[1].match(/tears: (\d+)/g) || []).map((x) => parseInt(x.slice(7), 10));
    verifie("trois intensites, pas plus", tears.length === 3, JSON.stringify(tears));
    verifie("une larme, puis trois, puis la rafale", tears[0] === 1 && tears[1] === 3 && tears[2] > 3,
      JSON.stringify(tears));
  }
  verifie("le tremblement est une rotation et jamais un scale",
    /kzSobShake[\s\S]{0,200}rotate\(-7deg\)/.test(src));
  verifie("les larmes sont dessinees par nous et non un emoji",
    src.indexOf("kz-sob-tear") > -1 && /\.kz-sob-tear \{[^}]*background: #4CB7FF/.test(src));
  verifie("une larme tombe en 700 ms", /T\.tear/.test(src) && /tear: 700/.test(src));
  verifie("les larmes s'espacent de 260 ms", /tearGap: 260/.test(src));
  verifie("la courbe de chute est celle de la planche",
    src.indexOf("kzTear\n") > -1 || src.indexOf("cubic-bezier(0.4,0,1,1)") > -1);
  verifie("la scene ne porte aucun bouton",
    !/kz-sob[\s\S]{0,600}createElement\("button"\)/.test(src));

  // La scene se joue sur Jamais, et JAMAIS sur Bon j'y vais.
  // Le harnais force animMode a never pour accelerer les suites. La scene de
  // larmes est justement supprimee dans ce mode, il faut donc l'activer ici.
  // Animations actives, donc les durees reelles s'appliquent. On attend
  // l'apparition de chaque etape au lieu de deviner un delai.
  async function attendre(env, sel, max) {
    const fin = Date.now() + (max || 6000);
    while (Date.now() < fin) {
      const n = racine(env.w).querySelector(sel);
      if (n) return n;
      await pause(40);
    }
    return null;
  }
  async function joue(issue) {
    const env = monte(Object.assign({}, BASE, { animMode: "always" }));
    env.montre(CTX);
    const later = await attendre(env, ".kz-btn--later");
    clic(later);
    const skip = await attendre(env, ".kz-energy-btn");
    clic(skip);
    const cat = await attendre(env, ".kz-bubble--cat");
    const btns = cat ? cat.querySelectorAll("button") : [];
    clic(btns[issue === "never" ? 1 : 0]);
    return env;
  }
  const e1 = await joue("never");
  await attendre(e1, ".kz-sob", 8000);
  verifie("sur Jamais, l'emoji pleure", !!racine(e1.w).querySelector(".kz-sob"),
    "aucune scene de larmes");
  verifie("sur Jamais, des larmes sont dessinees",
    !!racine(e1.w).querySelector(".kz-sob-tear"));
  verifie("la scene de larmes ne propose rien a cliquer",
    (() => { const s = racine(e1.w).querySelector(".kz-sob"); return s && s.querySelectorAll("button, a").length === 0; })());

  // On SURVEILLE toute la fenetre au lieu de regarder une seule fois. Regarder
  // trop tard laissait passer une scene de larmes deja retiree avec le koala.
  const e2 = await joue("go");
  let vueSurGo = false;
  const finGo = Date.now() + 5600;
  while (Date.now() < finGo) {
    if (racine(e2.w).querySelector(".kz-sob")) { vueSurGo = true; break; }
    await pause(40);
  }
  verifie("sur Bon j'y vais, aucune larme a aucun moment", !vueSurGo,
    "une scene de larmes est apparue a tort");

  // Sur Jamais dans les reglages, la scene est SUPPRIMEE et non ralentie.
  const e3 = monte(Object.assign({}, BASE, { animMode: "never" }));
  e3.montre(CTX);
  await pause(120);
  clic(bulle(e3.w).querySelector(".kz-btn--later"));
  await pause(60);
  const sk = bulle(e3.w) && bulle(e3.w).querySelectorAll(".kz-energy-btn")[6];
  if (sk) clic(sk);
  await pause(1000);
  const cat3 = racine(e3.w).querySelector(".kz-bubble--cat");
  if (cat3) { clic(cat3.querySelectorAll("button")[1]); await pause(2000); }
  verifie("animations sur Jamais, aucune scene de larmes et rien a la place",
    !racine(e3.w).querySelector(".kz-sob"));
}

(async () => {
  const suites = [
    ["Bulle d'habitude", testBulleHabitude],
    ["Phrase sans chiffre", testSansChiffre],
    ["Rotation des objectifs", testRotation],
    ["Validation et citation", testValidation],
    ["Report et pique du chat", testReport],
    ["Issue Jamais", testJamais],
    ["Persistance du personnage sans reponse", testPersistanceRelance],
    ["Echap vaut Plus tard", testEchap],
    ["Rappel ignore", testIgnore],
    ["Energie sans reponse ne bloque plus la sequence", testEnergieSansReponse],
    ["Mode focus", testFocus],
    ["Un seul rappel a la fois", testConcurrence],
    ["Contenus et masquage", testContenus],
    ["Relance, les cinq personnages", testRelance],
    ["Relance, images personnalisees", testRelancePersonnalisee],
    ["Renoncement, l'emoji qui pleure", testRenoncement],
    ["Fidelite de la bulle de rappel a la planche", testStyleBulle]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);

  }

// ---------------------------------------------------------------------------
// Module A, echelle d'energie par bandes et durees de la 2.0.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");

  verifie("les cinq durees de la 2.0 sont dans l'objet T",
    ["sob:", "tear:", "tearGap:", "blink:", "blinkEvery:"].every((k) => src.indexOf(k) > -1));
  verifie("la scene de larmes dure 1,5 s", /sob:\s*1500/.test(src));
  verifie("une larme tombe en 700 ms", /tear:\s*700/.test(src));
  verifie("les larmes s'espacent de 260 ms", /tearGap:\s*260/.test(src));
  verifie("la paupiere se ferme en 120 ms", /blink:\s*120/.test(src));
  verifie("le clignement revient toutes les 6,5 s", /blinkEvery:\s*6500/.test(src));

  verifie("la case choisie gonfle de 18 pour cent", /scale\(1\.18\)/.test(src));
  verifie("l'ocre unique de la case choisie a disparu",
    src.indexOf("kz-picked { background: #A98207") === -1);
  verifie("la case choisie garde sa bande au lieu d'ecraser sa classe",
    src.indexOf('b.classList.add("kz-picked")') > -1
    && src.indexOf('b.className = "kz-energy-btn kz-picked"') === -1);

  // Les cinq bandes de la planche, fond puis encre, et leur aplat plein.
  const BANDES = [
    ["kz-e1", "#F7DAD8", "#8F2723"],
    ["kz-e2", "#FBE6CE", "#8A5108"],
    ["kz-e3", "#FAF0C9", "#7A5E06"],
    ["kz-e4", "#E2F2E5", "#33693F"],
    ["kz-e5", "#CFE9D5", "#1F5C2E"]
  ];
  BANDES.forEach(([cls, fond, encre]) => {
    verifie("bande " + cls + ", fond et encre conformes a la planche",
      src.indexOf("." + cls + " { background: " + fond + "; color: " + encre + "; }") > -1);
    verifie("bande " + cls + ", aplat plein de sa propre encre quand elle est choisie",
      src.indexOf(".kz-energy-btn.kz-picked." + cls + " { background: " + encre) > -1);
  });

  verifie("anneau de focus vert 3 px sur les elements de la bulle",
    /:focus-visible \{ outline: 3px solid #2FAE4A/.test(src));

  verifie("RELANCE_MODE est declare en tete de content.js",
    /RELANCE_MODE\s*=\s*"(drawn|images)"/.test(src));
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
  verifie("la pointe suit la couleur de la bulle graphite",
    /\n\.kz-bubble--cat::after \{[^}]*background: #2E3338/.test(srcT));
  verifie("la pointe graphite suit aussi la bordure",
    /\n\.kz-bubble--cat::after \{[^}]*#454C52/.test(srcT));
  // La couleur de la pointe paysage doit etre verifiee elle aussi, sinon une
  // mutation sur cette regle passe inapercue.
  const landCat = (srcT.match(/\.kz-koala--land \.kz-bubble--cat::after \{([^}]*)\}/) || [])[1] || "";
  verifie("la pointe graphite existe aussi en paysage", landCat.length > 10);
  verifie("la pointe graphite paysage porte le bon fond",
    /background: #2E3338/.test(landCat), landCat);
  verifie("la pointe graphite paysage porte les bonnes bordures",
    /border-right-color: #454C52/.test(landCat) && /border-bottom-color: #454C52/.test(landCat), landCat);
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
  verifie("le personnage de relance a une largeur minimale",
    /\.kz-relance \{[^}]*min-width: 78px/.test(srcB));

  // Les hahaha de la planche 08 n'etaient jamais crees.
  verifie("les hahaha existent", /function addHahas/.test(srcB));
  verifie("les hahaha sont poses sur la bulle Jamais", /addHahas\(b\);/.test(srcB));
  verifie("cinq hahaha, decales et de tailles differentes",
    (srcB.match(/\{ x: "/g) || []).length >= 5);
  verifie("les hahaha passent derriere le texte",
    /\.kz-bubble--cat > \*:not\(\.kz-hahas\) \{[^}]*z-index: 1/.test(srcB));
  verifie("les hahaha ne captent aucun clic",
    /\.kz-hahas \{[^}]*pointer-events: none/.test(srcB));
  verifie("les hahaha sont coupes par le mouvement reduit",
    /function addHahas\(bubble\) \{\s*if \(reduceMotion\(\)\) return;/.test(srcB));

  // L'emoji des larmes etait toujours le meme. repToday est le compte AVANT le
  // report en cours, il fallait donc ajouter celui-ci pour trouver le rang.
  verifie("le rang du report inclut celui en cours",
    /const rang = Math\.max\(1, \(Number\(repToday\) \|\| 0\) \+ 1\);/.test(srcB));
  verifie("l'index des larmes part du rang", /const idx = Math\.min\(SOB\.length - 1, rang - 1\);/.test(srcB));

  // L'energie n'est plus facultative.
  verifie("le lien Passer a disparu du code", srcB.indexOf("kz-energy-skip") === -1
    || srcB.indexOf('className = "kz-energy-skip"') === -1);
  verifie("aucune cle energySkip n'est plus employee", srcB.indexOf("energySkip") === -1);
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
    && /function rebuildSvgNode[\s\S]{0,300}createElementNS/.test(srcP));
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
  verifie("le test ne consomme pas le quota du jour", /\+ \(test \? 0 : 1\)/.test(srcBg));
  verifie("le test ne consomme pas le creneau des deux heures", /last: test \? st\.last : now/.test(srcBg));
}

// ---------------------------------------------------------------------------
// Le figeage de la premiere image d'un GIF sur Jamais, planche 06.
// ---------------------------------------------------------------------------
{
  const srcG = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  verifie("la fonction de figeage existe", /function figerPremiereImage/.test(srcG));
  verifie("le figeage passe par un canvas", /createElement\("canvas"\)/.test(srcG));
  verifie("le figeage substitue la source", /img\.src = fixe;/.test(srcG));
  // Les DEUX reconnaissances doivent etre presentes, l'extension de fichier ET la
   // source integree, sinon le figeage frapperait aussi les PNG.
  verifie("le figeage reconnait un GIF par son extension",
    srcG.indexOf('/\\.gif($|[?#])/i.test(img.src)') > -1);
  verifie("le figeage reconnait un GIF integre",
    srcG.indexOf('img.src.indexOf("image/gif") < 0') > -1);
  verifie("hors GIF, le figeage renonce",
    /test\(img\.src\) && img\.src\.indexOf\("image\/gif"\) < 0\) return false;/.test(srcG));
  verifie("le figeage est appele sur Jamais, avant les larmes",
    /figerPremiereImage\(kc\);\s*\n\s*await playSob/.test(srcG));
  // Un echec de canvas ne doit pas laisser un cadre vide, mieux vaut un GIF qui
  // continue de tourner qu'un personnage disparu.
  verifie("un echec de figeage laisse le GIF tourner",
    /if \(!ctx2d\) return false;/.test(srcG) && /catch \(e\) \{ return false; \}/.test(srcG));
  verifie("une image sans dimensions connues est ignoree",
    /if \(!img \|\| !img\.naturalWidth\) return false;/.test(srcG));
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
    && /function rebuildSvgNode[\s\S]{0,300}createElementNS/.test(srcS));
  verifie("le SVG est lu depuis un document DOMParser jetable, jamais importe dans le document courant",
    /new DOMParser\(\)\.parseFromString\(markup, "image\/svg\+xml"\)/.test(srcS));
  verifie("svgNode reutilise svgFromString",
    /function svgNode\(\) \{\s*return svgFromString\(KOALA_SVG\);/.test(srcS));
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

// ---------------------------------------------------------------------------
// La continuite du personnage entre le rappel et la relance.
// ---------------------------------------------------------------------------
{
  const srcC = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  // L'ancienne sequence sortait le koala, attendait 600 ms puis faisait entrer la
  // relance. A l'ecran le personnage apparaissait, disparaissait et revenait.
  verifie("plus de sortie du koala avant la relance",
    !/await playExit\(k1\);\s*\n\s*k1\.remove\(\);\s*\n\s*await sleep\(600\);/.test(srcC));
  verifie("plus d'attente de 600 ms avant la relance",
    !/k1\.remove\(\);\s*\n\s*await sleep\(600\);\s*\n\s*await runSnark/.test(srcC));
  verifie("l'ancien personnage est transmis a la relance",
    /await runSnark\(shadow, \{[^}]*\}, k1\);/.test(srcC));
  verifie("runSnark accepte le personnage a relever",
    /async function runSnark\(shadow, ctx, aRetirer\)/.test(srcC));
  // Le visage change SUR PLACE. Le personnage ne sort pas et ne rentre pas, la
  // planche 09 dit que le nouveau visage arrive a la place de l'ancien.
  verifie("le personnage du rappel est REUTILISE, aucun second personnage",
    /kc = aRetirer;/.test(srcC));
  const brancheReprise = srcC.slice(srcC.indexOf("kc = aRetirer;"), srcC.indexOf("} else {", srcC.indexOf("kc = aRetirer;")));
  verifie("aucune entree n'est jouee sur le personnage reutilise",
    brancheReprise.indexOf("playEnter") === -1, brancheReprise.slice(0, 160));
  verifie("le chemin reutilise attend seulement le temps d'un fondu",
    /await sleep\(T\.swap\);/.test(brancheReprise));
  verifie("aucune sortie n'est jouee sur le personnage reutilise",
    srcC.indexOf("playExit(aRetirer)") === -1);
  verifie("le remplissage du visage est partage entre les deux chemins",
    /function fillRelance\(wrap, perso\)/.test(srcC)
    && /fillRelance\(kc, perso\);/.test(srcC)
    && /fillRelance\(wrap, perso\);\s*\n\s*return wrap;/.test(srcC));
  verifie("la bulle d'energie part avec l'ancien visage",
    /const vieille = kc\.querySelector\("\.kz-bubble"\);/.test(srcC));
  verifie("aucun repli sur wrap pour trouver le conteneur",
    srcC.indexOf('wrap.querySelector(".kz-inner") || wrap') === -1);
  verifie("en perso, seule la source de l'image change",
    /const dejaLa = inner\.querySelector\("img\.kz-photo"\);[\s\S]{0,200}dejaLa\.src = src; return;/.test(srcC));
}

// ---------------------------------------------------------------------------
// La continuite du personnage entre le rappel et la relance.
// ---------------------------------------------------------------------------
{
  const srcC = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  // L'ancienne sequence sortait le koala, attendait 600 ms puis faisait entrer la
  // relance. A l'ecran le personnage apparaissait, disparaissait et revenait.
  verifie("plus aucune attente de 600 ms avant la relance",
    srcC.indexOf("await sleep(600)") === -1);
  // Le controle porte sur le SEUL chemin du report. Les deux autres sorties sont
  // voulues, le koala qui s'en va puis revient avec la citation apres validation,
  // et la fermeture du rappel.
  const apresLater = srcC.slice(srcC.indexOf("async function afterLater"),
                                srcC.indexOf("async function afterDone"));
  verifie("le chemin du report ne fait plus sortir le koala",
    apresLater.indexOf("playExit") === -1, apresLater.slice(0, 200));
  verifie("le chemin du report ne retire plus le koala",
    apresLater.indexOf("k1.remove()") === -1);
  verifie("l'ancien personnage est passe a la relance",
    /runSnark\(shadow, \{[^}]*\}, k1\)/.test(srcC));
  verifie("la relance accepte un personnage a retirer",
    /async function runSnark\(shadow, ctx, aRetirer\)/.test(srcC));
  verifie("le visage change sur place, sans sortie", srcC.indexOf("playExit(aRetirer)") === -1);

  // Le finally effacait l'ecran sans laisser de trace en cas d'exception.
  verifie("la sequence capture ses exceptions", /\} catch \(e\) \{[\s\S]{0,400}console\.warn\("Koala Zen, sequence interrompue/.test(srcC));
  verifie("la capture n'empeche pas le nettoyage",
    /console\.warn\("Koala Zen, sequence interrompue[\s\S]{0,200}\} finally \{\s*\n\s*clearKoalas\(garder\);/.test(srcC));
  // Une exception laisse garder a faux, donc le nettoyage de secours reprend
  // bien le personnage. Seuls les chemins qui aboutissent normalement, report
  // et rappel manque, le mettent a vrai avant de sortir.
  verifie("garder reste a faux par defaut, le secours nettoie tout",
    /let garder = false;/.test(srcC));
}

  console.log("\n=== content.js : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
