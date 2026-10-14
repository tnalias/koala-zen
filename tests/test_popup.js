// Tests fonctionnels du popup, charge tel quel sous jsdom avec des API simulees.
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

const HTML = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
const QUOTES = fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8");
const POPUP = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
const MSG = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales/fr/messages.json"), "utf8"));
function t(cle) { return (MSG[cle] || {}).message || ""; }

function jour(n) {
  // statsDaily utilise la date LOCALE, voir la note de test_background.js.
  const d = new Date(); d.setDate(d.getDate() + (n || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function historique(nbJours) {
  const stats = {}, ecran = {};
  for (let i = 0; i < nbJours; i++) {
    const k = jour(-i);
    const fait = (i % 7 === 6) ? 0 : (2 + (i % 3));
    const rep = i % 3;
    stats[k] = { due: fait + rep, done: fait, rep: rep,
                 eSum: (6 + (i % 3)) * Math.max(1, fait), eCount: Math.max(1, fait),
                 repH: [rep, 0, 0, 0] };
    ecran[k] = 3600 * 4 + 600 * (i % 6);
  }
  return { stats, ecran };
}

const DEFAUT = () => {
  const h = historique(40);
  return {
    intervalMinutes: 45, preset: "custom", muteInCalls: true,
    mutedPatterns: ["kmeet.infomaniak.com", "teams.microsoft.com", "teams.live.com", "zoom.us", "meet.google.com"],
    pauseWhenIdle: true, focusMode: false, focusSeconds: 30, screenTimezone: "Europe/Zurich",
    animMode: "never", customKoalas: [], includeDefaultKoalas: false,
    customQuotes: [{ t: "Une respiration suffit.", a: "Toi" }], customSport: ["Fais 3 pompes", "Bois de l'eau"],
    includeDefaultQuotes: true, hiddenQuotes: [], habitGoal: 3, sportIndex: 0, importMode: "merge",
    pausedUntil: 0, pending: 2, statsDaily: h.stats, screenDaily: h.ecran, firstRun: false
  };
};

/* ---------- bac a sable ---------- */
function monte(store, minutesAlarme) {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://localhost/" });
  const w = dom.window;
  Object.defineProperty(w.navigator, "language", { value: "fr-CH", configurable: true });
  const donnees = JSON.parse(JSON.stringify(store));
  const journal = { messages: [], ecrit: [], blobs: [] };

  w.URL.createObjectURL = (b) => { journal.blobs.push(b); return "blob:x"; };
  w.URL.revokeObjectURL = () => {};
  w.close = () => {};
  w.scrollTo = () => {};
  w.confirm = () => true;

  const api = {
    i18n: { getMessage: (k) => t(k), getUILanguage: () => "fr" },
    runtime: {
      getManifest: () => ({ version: "1.2.0" }),
      sendMessage: (m) => { journal.messages.push(JSON.parse(JSON.stringify(m))); return Promise.resolve(); }
    },
    storage: {
      local: {
        get: (cles) => {
          const out = {};
          [].concat(cles).forEach((k) => { if (donnees[k] !== undefined) out[k] = JSON.parse(JSON.stringify(donnees[k])); });
          return Promise.resolve(out);
        },
        set: (o) => { Object.assign(donnees, JSON.parse(JSON.stringify(o))); journal.ecrit.push(o); return Promise.resolve(); }
      }
    },
    alarms: { get: () => Promise.resolve(minutesAlarme === null ? null : { scheduledTime: Date.now() + (minutesAlarme || 12) * 60000 }) }
  };
  w.browser = api;
  w.chrome = api;
  const erreurs = [];
  w.addEventListener("error", (e) => erreurs.push(e.message));
  w.eval(QUOTES + "\n" + POPUP);
  return { w, donnees, journal, erreurs, $: (id) => w.document.getElementById(id) };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function clic(n) { if (n) n.dispatchEvent(new n.ownerDocument.defaultView.Event("click", { bubbles: true })); }
function saisi(n, v) {
  n.value = v;
  n.dispatchEvent(new n.ownerDocument.defaultView.Event("input", { bubbles: true }));
}
function entree(n) {
  const w = n.ownerDocument.defaultView;
  const e = new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true });
  n.dispatchEvent(e);
}
function txt(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : "<absent>"; }

/* ================= 1. En-tete et onglets ================= */
async function testOnglets() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  verifie("l'en-tete annonce la prochaine visite",
    txt(env.$("nextVisit")) === t("nextVisitIn").replace("{n}", "12"), txt(env.$("nextVisit")));
  verifie("la pastille du koala est remplie", env.$("headMark").children.length === 1);
  verifie("la version et la date sont affichees",
    txt(env.$("versionLine")).indexOf("1.2.0") >= 0, txt(env.$("versionLine")));

  const panneaux = ["panelSettings", "panelPerso", "panelStats", "panelData"];
  const boutons = ["tabSettingsBtn", "tabPersoBtn", "tabStatsBtn", "tabDataBtn"];
  for (let i = 0; i < 4; i++) {
    clic(env.$(boutons[i]));
    await pause(30);
    const visibles = panneaux.filter((p) => !env.$(p).hidden);
    verifie("l'onglet " + i + " affiche un seul panneau",
      visibles.length === 1 && visibles[0] === panneaux[i], JSON.stringify(visibles));
    verifie("l'onglet " + i + " est marque actif",
      env.$(boutons[i]).classList.contains("tab--on"));
  }

  // Pause en cours
  const env2 = monte(Object.assign(DEFAUT(), { pausedUntil: Date.now() + 3600000 }), 12);
  await pause(80);
  verifie("en pause, l'en-tete le dit",
    txt(env2.$("nextVisit")).indexOf(t("pausedUntilLabel")) === 0, txt(env2.$("nextVisit")));
  verifie("en pause, les raccourcis disparaissent", env2.$("quickActions").hidden);
  verifie("en pause, le bouton Reprendre apparait", !env2.$("pausedNotice").hidden);

  // Premier lancement
  const env3 = monte(Object.assign(DEFAUT(), { statsDaily: {}, screenDaily: {}, pending: 0 }), 45);
  await pause(80);
  verifie("sans historique, l'en-tete parle de premiere visite",
    txt(env3.$("nextVisit")) === t("firstVisitIn").replace("{n}", "45"), txt(env3.$("nextVisit")));
}

/* ================= 1b. Module N, l'ecran de premiere installation ================= */
// Sans firstRun a false en stockage, le popup ne montrait jamais cet ecran,
// showFirstRun existait mais n'etait appele nulle part, et Commencer n'avait
// aucun ecouteur. Une installation reelle ne peut donc jamais avoir ete
// accueillie par cette planche, malgre la case cochee au handoff.
async function testPremiereInstallation() {
  // Sans la cle firstRun du tout, comme une installation neuve dont le
  // stockage est vide, DEFAULTS.firstRun vaut true et doit etre suivi.
  const storeNeuf = DEFAUT();
  delete storeNeuf.firstRun;
  const env = monte(storeNeuf, 12);
  await pause(80);
  verifie("l'ecran de premiere installation est visible", env.$("firstRun").hidden === false);
  verifie("l'en-tete principal est masque", env.$("mainHead").hidden === true);
  verifie("les quatre panneaux sont masques",
    ["panelSettings", "panelPerso", "panelStats", "panelData"].every((id) => env.$(id).hidden === true));
  verifie("le champ d'habitude est prerempli, jamais vide",
    env.$("frHabit").value.length > 0, env.$("frHabit").value);
  // 2026-09-16 : sans la classe body, la carte et le bouton Commencer
  // collaient aux bords du popup, sans marge ni espacement.
  verifie("l'ecran de premiere installation a les memes marges que les panneaux",
    env.$("firstRun").querySelector(".pane-in").classList.contains("body"));

  clic(env.$("frStart"));
  await pause(60);
  verifie("apres Commencer, l'ecran de premiere installation se ferme", env.$("firstRun").hidden === true);
  verifie("apres Commencer, l'en-tete principal revient", env.$("mainHead").hidden === false);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("apres Commencer, firstRun est enregistre a faux",
    m && m.payload && m.payload.firstRun === false, JSON.stringify(m));
  verifie("apres Commencer, l'habitude saisie rejoint les objectifs",
    m && m.payload && m.payload.customSport && m.payload.customSport.indexOf(t("frHabitPh")) > -1,
    JSON.stringify(m && m.payload && m.payload.customSport));

  // Un utilisateur etabli, firstRun a false, ne voit jamais cet ecran.
  const env2 = monte(DEFAUT(), 12);
  await pause(80);
  verifie("un utilisateur deja installe ne voit pas la premiere installation",
    env2.$("firstRun").hidden === true && env2.$("mainHead").hidden === false);
}

/* ================= 2. Pause et rattrapage ================= */
async function testPause() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("snooze1h"));
  await pause(40);
  let m = env.journal.messages[env.journal.messages.length - 1];
  verifie("1 heure envoie une pause", m && m.type === "kz-pause", JSON.stringify(m));
  verifie("la pause d'une heure vise la bonne echeance",
    m && Math.abs(m.until - (Date.now() + 3600000)) < 3000);

  clic(env.$("snoozeToday"));
  await pause(40);
  m = env.journal.messages[env.journal.messages.length - 1];
  const finJour = new Date(); finJour.setHours(23, 59, 59, 999);
  verifie("aujourd'hui vise la fin de journee",
    m && Math.abs(m.until - finJour.getTime()) < 3000, JSON.stringify(m));

  clic(env.$("snoozeLater"));
  await pause(40);
  m = env.journal.messages[env.journal.messages.length - 1];
  verifie("plus tard vise un quart d'heure",
    m && Math.abs(m.until - (Date.now() + 900000)) < 3000, JSON.stringify(m));

  // 2026-09-16 : plus de rattrapage. Ni bandeau, ni bouton, ni compteur.
  verifie("aucun bandeau de rattrapage n'existe plus", !env.$("catchupCard") && !env.$("catchupBox") && !env.$("catchupBtn"));
  verifie("aucun message de rattrapage n'est envoye", !env.journal.messages.some((x) => x.type === "kz-catchup"));
}

/* ================= 3. Rythme ================= */
async function testRythme() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  verifie("l'intervalle enregistre est repris", env.$("interval").value === "45");
  verifie("le preset Perso est actif",
    env.w.document.querySelector(".pre--on").getAttribute("data-preset") === "custom");
  verifie("l'en-tete de carte affiche la valeur",
    txt(env.$("rhythmValue")) === "45 " + t("unitMin"), txt(env.$("rhythmValue")));

  const presets = { pomodoro: "25", deepwork: "52", ultradian: "90" };
  for (const [nom, val] of Object.entries(presets)) {
    clic(env.w.document.querySelector('[data-preset="' + nom + '"]'));
    await pause(20);
    verifie("le preset " + nom + " fixe " + val + " minutes", env.$("interval").value === val,
      env.$("interval").value);
    verifie("le preset " + nom + " devient actif",
      env.w.document.querySelector(".pre--on").getAttribute("data-preset") === nom);
  }

  // Module C. Le pas de 5 minutes ne concerne QUE l'intervalle Perso, un preset
  // fige garde sa valeur exacte. Ultradien reste a 90 et Deep work a 52.
  verifie("un preset fige garde sa valeur exacte, meme non multiple de 5",
    env.$("interval").value === "90", env.$("interval").value);
  clic(env.w.document.querySelector('[data-preset="deepwork"]'));
  await pause(20);
  verifie("Deep work reste a 52 et n'est pas arrondi a 50",
    env.$("interval").value === "52", env.$("interval").value);

  clic(env.$("intPlus"));
  await pause(20);
  verifie("le pas a pas repasse en Perso",
    env.w.document.querySelector(".pre--on").getAttribute("data-preset") === "custom");
  // Les boutons agissent sur la valeur PERSO memorisee, pas sur celle du preset
  // affiche. Depuis Deep work a 52, plus repart de la valeur Perso, 45, et donne 50.
  verifie("le pas a pas repart de la valeur Perso memorisee et non du preset",
    env.$("interval").value === "50", env.$("interval").value);
  clic(env.$("intMinus"));
  await pause(20);
  verifie("le pas a pas recule de cinq minutes", env.$("interval").value === "45", env.$("interval").value);

  // Bornes de l'intervalle Perso, 5 minutes au plancher et 240 au plafond.
  for (let i = 0; i < 20; i++) { clic(env.$("intMinus")); }
  await pause(30);
  verifie("l'intervalle Perso ne descend pas sous 5", env.$("interval").value === "5", env.$("interval").value);
  verifie("au plancher, le bouton moins est desactive", env.$("intMinus").disabled === true);
  for (let i = 0; i < 60; i++) { clic(env.$("intPlus")); }
  await pause(30);
  verifie("l'intervalle Perso ne depasse pas 240", env.$("interval").value === "240", env.$("interval").value);
  verifie("au plafond, le bouton plus est desactive", env.$("intPlus").disabled === true);

  // L'encadre Perso se grise quand un preset fige est choisi, et la valeur
  // memorisee est restituee au retour sur Perso.
  clic(env.w.document.querySelector('[data-preset="pomodoro"]'));
  await pause(20);
  verifie("un preset fige grise l'encadre Perso",
    env.$("intervalWrap").classList.contains("permin--off"));
  verifie("l'encadre grise montre toujours la valeur Perso memorisee",
    txt(env.$("customIntervalValue")).indexOf("240") >= 0, txt(env.$("customIntervalValue")));
  clic(env.w.document.querySelector('[data-preset="custom"]'));
  await pause(20);
  verifie("le retour sur Perso restitue la valeur memorisee",
    env.$("interval").value === "240", env.$("interval").value);
  verifie("sur Perso, l'encadre n'est plus grise",
    !env.$("intervalWrap").classList.contains("permin--off"));

  // Module C, l'interrupteur des animaux de passage.
  verifie("l'interrupteur des animaux de passage existe", !!env.$("passagesTgl"));
  verifie("les animaux de passage sont actives par defaut", env.$("passagesTgl").checked === true);

  // La frequence des animaux de passage, trois reglages, normal par defaut.
  const onFreq = () => env.w.document.querySelector("#passagesFreqSeg .seg-b--on");
  verifie("normal est selectionne par defaut", !!onFreq() && onFreq().getAttribute("data-freq") === "normal",
    onFreq() && onFreq().getAttribute("data-freq"));
  verifie("le sous-texte par defaut annonce deux heures",
    txt(env.$("passagesFreqHint")).indexOf("2 heures") >= 0, txt(env.$("passagesFreqHint")));

  clic(env.w.document.querySelector('[data-freq="rare"]'));
  await pause(20);
  verifie("choisir rare selectionne bien rare", onFreq().getAttribute("data-freq") === "rare");
  verifie("le sous-texte suit sur trois heures",
    txt(env.$("passagesFreqHint")).indexOf("3 heures") >= 0, txt(env.$("passagesFreqHint")));

  clic(env.w.document.querySelector('[data-freq="frequent"]'));
  await pause(20);
  verifie("choisir frequent selectionne bien frequent", onFreq().getAttribute("data-freq") === "frequent");
  verifie("le sous-texte suit sur une heure",
    txt(env.$("passagesFreqHint")).indexOf("heure") >= 0 && txt(env.$("passagesFreqHint")).indexOf("heures") === -1,
    txt(env.$("passagesFreqHint")));

  // Desactiver les animaux de passage grise le choix de frequence, sans le
  // reinitialiser, planche 04, coherent avec la pause focus.
  verifie("la frequence n'est pas grisee quand les passages sont actifs",
    !env.$("passagesFreqWrap").classList.contains("row-dim"));
  env.$("passagesTgl").checked = false;
  env.$("passagesTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(20);
  verifie("desactiver les passages grise le choix de frequence",
    env.$("passagesFreqWrap").classList.contains("row-dim"));
  verifie("le reglage choisi, frequent, reste selectionne malgre le grisage",
    onFreq().getAttribute("data-freq") === "frequent");
  env.$("passagesTgl").checked = true;
  env.$("passagesTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(20);
  verifie("reactiver les passages retire le grisage", !env.$("passagesFreqWrap").classList.contains("row-dim"));

  // L'enregistrement transmet le reglage choisi.
  clic(env.$("save"));
  await pause(60);
  const mFreq = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("l'enregistrement transmet la frequence choisie",
    mFreq && mFreq.payload.passageFrequency === "frequent", JSON.stringify(mFreq && mFreq.payload.passageFrequency));

  // Repasser sur normal, pour ne pas contaminer la suite avec un etat modifie.
  clic(env.w.document.querySelector('[data-freq="normal"]'));
  await pause(20);

  // Une frequence deja enregistree doit etre restituee telle quelle a l'ouverture.
  const envRare = monte(Object.assign({}, DEFAUT(), { passageFrequency: "rare" }));
  await pause(80);
  const onFreqRare = envRare.w.document.querySelector("#passagesFreqSeg .seg-b--on");
  verifie("une frequence rare deja enregistree est restituee a l'ouverture",
    !!onFreqRare && onFreqRare.getAttribute("data-freq") === "rare",
    onFreqRare && onFreqRare.getAttribute("data-freq"));
  verifie("le sous-texte suit des l'ouverture",
    txt(envRare.$("passagesFreqHint")).indexOf("3 heures") >= 0, txt(envRare.$("passagesFreqHint")));

  // Une valeur de stockage inconnue ou abimee retombe sur normal, jamais une
  // case vide ni une erreur silencieuse.
  const envAbime = monte(Object.assign({}, DEFAUT(), { passageFrequency: "n'importe quoi" }));
  await pause(80);
  const onFreqAbime = envAbime.w.document.querySelector("#passagesFreqSeg .seg-b--on");
  verifie("une frequence de stockage inconnue retombe sur normal",
    !!onFreqAbime && onFreqAbime.getAttribute("data-freq") === "normal",
    onFreqAbime && onFreqAbime.getAttribute("data-freq"));

  // L'enregistrement transmet la bonne valeur
  clic(env.w.document.querySelector('[data-preset="pomodoro"]'));
  await pause(20);
  clic(env.$("save"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("l'enregistrement transmet l'intervalle du preset",
    m && m.payload.intervalMinutes === 25, JSON.stringify(m && m.payload.intervalMinutes));
  verifie("l'enregistrement transmet le nom du preset", m && m.payload.preset === "pomodoro");
}

/* ================= 4. Pause focus ================= */
async function testFocus() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  verifie("le focus est desactive par defaut", env.$("focusMode").checked === false);
  verifie("la duree est grisee quand le focus est eteint",
    env.$("focusSecWrap").classList.contains("row-dim"));
  env.$("focusMode").checked = true;
  env.$("focusMode").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(20);
  verifie("la duree devient active", !env.$("focusSecWrap").classList.contains("row-dim"));
  verifie("la duree par defaut est 30 s", txt(env.$("focusValue")) === "30 " + t("unitSec"), txt(env.$("focusValue")));
  for (let i = 0; i < 30; i++) clic(env.$("focPlus"));
  await pause(20);
  verifie("la duree plafonne a 120 s", txt(env.$("focusValue")) === "120 " + t("unitSec"), txt(env.$("focusValue")));
  for (let i = 0; i < 40; i++) clic(env.$("focMinus"));
  await pause(20);
  verifie("la duree plancher est 5 s", txt(env.$("focusValue")) === "5 " + t("unitSec"), txt(env.$("focusValue")));
}

/* ================= 5. Sites en visio ================= */
async function testChips() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  const chips = () => Array.from(env.$("muteChips").querySelectorAll(".chip"));
  verifie("les sites sont replies au depart",
    chips().some((c) => c.textContent.trim().startsWith("+")), txt(env.$("muteChips")));
  clic(chips().find((c) => c.textContent.trim().startsWith("+")));
  await pause(20);
  verifie("le depliage montre les cinq sites",
    env.$("muteChips").querySelectorAll(".chip-x").length === 5,
    "vaut " + env.$("muteChips").querySelectorAll(".chip-x").length);

  clic(env.$("muteChips").querySelectorAll(".chip-x")[0]);
  await pause(20);
  verifie("retirer un site le retire de la liste",
    env.$("muteChips").querySelectorAll(".chip-x").length === 4);

  const ajouter = chips().find((c) => c.textContent.trim() === t("addSite"));
  clic(ajouter);
  await pause(20);
  const champ = env.$("muteChips").querySelector(".chip-in");
  verifie("ajouter ouvre un champ", !!champ);
  champ.value = "https://Whereby.COM/room/x";
  entree(champ);
  await pause(20);
  clic(env.$("save"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("le site ajoute est normalise en domaine",
    m && m.payload.mutedPatterns.indexOf("whereby.com") >= 0, JSON.stringify(m && m.payload.mutedPatterns));
  verifie("aucun doublon ni chemin conserve",
    m && m.payload.mutedPatterns.filter((x) => x === "whereby.com").length === 1);
}

/* ================= 6. Objectifs et objectif quotidien ================= */
async function testObjectifs() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabPersoBtn"));
  await pause(30);
  verifie("les objectifs enregistres sont listes",
    env.$("sportList").querySelectorAll(".li").length === 2,
    "vaut " + env.$("sportList").querySelectorAll(".li").length);
  verifie("chaque objectif a une poignee de glissement",
    env.$("sportList").querySelectorAll(".li-grab").length === 2);
  verifie("chaque objectif est glissable",
    Array.from(env.$("sportList").querySelectorAll(".li")).every((n) => n.draggable === true));

  saisi(env.$("sportInput"), "Etire-toi 30 secondes");
  clic(env.$("sportAdd"));
  await pause(30);
  verifie("un objectif s'ajoute", env.$("sportList").querySelectorAll(".li").length === 3);
  verifie("le champ est vide apres ajout", env.$("sportInput").value === "");
  saisi(env.$("sportInput"), "   ");
  clic(env.$("sportAdd"));
  await pause(20);
  verifie("un objectif vide est refuse", env.$("sportList").querySelectorAll(".li").length === 3);

  clic(env.$("sportList").querySelectorAll(".li-x")[0]);
  await pause(20);
  verifie("un objectif se retire", env.$("sportList").querySelectorAll(".li").length === 2);

  // Objectif quotidien
  verifie("l'objectif quotidien est repris", txt(env.$("goalValue")) === "3");
  for (let i = 0; i < 25; i++) clic(env.$("goalPlus"));
  await pause(20);
  verifie("l'objectif quotidien plafonne a 20", txt(env.$("goalValue")) === "20", txt(env.$("goalValue")));
  for (let i = 0; i < 25; i++) clic(env.$("goalMinus"));
  await pause(20);
  verifie("a zero, l'objectif quotidien s'annonce comme aucun",
    txt(env.$("goalValue")) === t("goalOff"), txt(env.$("goalValue")));

  clic(env.$("goalPlus")); clic(env.$("goalPlus"));
  clic(env.$("savePerso"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("l'objectif quotidien est enregistre", m && m.payload.habitGoal === 2, JSON.stringify(m && m.payload.habitGoal));
  verifie("les objectifs sont enregistres dans l'ordre affiche",
    m && m.payload.customSport.length === 2 && m.payload.customSport[0] === "Bois de l'eau",
    JSON.stringify(m && m.payload.customSport));

  // Liste vide
  const env2 = monte(Object.assign(DEFAUT(), { customSport: [] }), 12);
  await pause(80);
  clic(env2.$("tabPersoBtn"));
  await pause(30);
  verifie("liste vide, le message d'aide s'affiche", !env2.$("sportEmpty").hidden);
}

/* ================= 7. Citations et sous ecran ================= */
async function testCitations() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabPersoBtn"));
  await pause(30);
  verifie("le segment des tiennes compte juste",
    txt(env.$("qsegMine")) === t("quotesMine") + " 1", txt(env.$("qsegMine")));
  verifie("le segment des fournies compte juste",
    txt(env.$("qsegBuilt")).indexOf(t("quotesBuilt")) === 0 &&
    parseInt(txt(env.$("qsegBuilt")).split(" ").pop(), 10) > 40, txt(env.$("qsegBuilt")));
  verifie("la citation personnelle est listee", env.$("quoteList").querySelectorAll(".q").length === 1);

  saisi(env.$("quoteInput"), "Rien ne presse. - Un sage");
  clic(env.$("quoteAdd"));
  await pause(30);
  verifie("une citation s'ajoute", env.$("quoteList").querySelectorAll(".q").length === 2);
  const derniere = env.$("quoteList").querySelectorAll(".q")[1];
  verifie("le texte est separe de l'auteur",
    txt(derniere.querySelector(".q-t")) === "Rien ne presse." &&
    txt(derniere.querySelector(".q-a")) === "Un sage", txt(derniere));

  saisi(env.$("quoteInput"), "Sans auteur");
  clic(env.$("quoteAdd"));
  await pause(30);
  verifie("une citation sans auteur affiche Anonyme",
    txt(env.$("quoteList").querySelectorAll(".q")[2].querySelector(".q-a")) === t("authorUnknown"));

  clic(env.$("qsegBuilt"));
  await pause(30);
  verifie("le segment fournies masque le champ d'ajout", env.$("quoteAddRow").hidden);
  verifie("le segment fournies montre un apercu", env.$("quoteList").querySelectorAll(".q").length === 3);
  verifie("aucune croix sur les citations fournies",
    env.$("quoteList").querySelectorAll(".q-x").length === 0);

  // Sous ecran
  clic(env.$("browseQuotes"));
  await pause(40);
  verifie("le sous ecran s'ouvre", !env.$("panelBrowse").hidden);
  verifie("le sous ecran masque l'en-tete principal", env.$("mainHead").hidden);
  // KZ_QUOTES vit dans la portee du script, on lit le total dans le libelle du lien.
  const total = parseInt(txt(env.$("browseQuotesLabel")).replace(/[^0-9]/g, ""), 10);
  verifie("le lien annonce un nombre de citations fournies", total > 40, "vaut " + total);
  verifie("le compteur annonce toutes les citations actives",
    txt(env.$("browseCount")) === t("browseActive").replace("{a}", total).replace("{n}", total),
    txt(env.$("browseCount")));
  const lignes = env.$("browseList").querySelectorAll(".bq").length;
  verifie("la premiere page est paginee", lignes === 40, "vaut " + lignes);

  // Recherche
  saisi(env.$("browseSearch"), "zzzzintrouvable");
  await pause(30);
  verifie("une recherche sans resultat le dit",
    txt(env.$("browseList")).indexOf(t("browseNone")) >= 0, txt(env.$("browseList")));
  saisi(env.$("browseSearch"), "de");
  await pause(30);
  verifie("une recherche filtre la liste",
    env.$("browseList").querySelectorAll(".bq").length >= 1);
  saisi(env.$("browseSearch"), "");
  await pause(30);

  // Masquer
  const avantMasque = env.$("browseList").querySelectorAll(".bq").length;
  clic(env.$("browseList").querySelector(".bq-act--mute"));
  await pause(30);
  verifie("masquer une citation met a jour le compteur",
    txt(env.$("browseCount")) === t("browseActive").replace("{a}", total - 1).replace("{n}", total),
    txt(env.$("browseCount")));
  verifie("le segment des masquees compte une entree",
    txt(env.$("bsegHidden")) === t("browseHidden") + " 1", txt(env.$("bsegHidden")));
  clic(env.$("bsegHidden"));
  await pause(30);
  verifie("le segment des masquees ne montre que celle-la",
    env.$("browseList").querySelectorAll(".bq").length === 1);
  verifie("une citation masquee est barree",
    env.$("browseList").querySelector(".bq").classList.contains("bq--off"));
  clic(env.$("browseList").querySelector(".bq-act"));
  await pause(30);
  verifie("reafficher la remet en service",
    txt(env.$("bsegHidden")) === t("browseHidden") + " 0", txt(env.$("bsegHidden")));

  // Module E. Une citation fournie ne se modifie plus jamais. Elle se masque, ou
  // elle se copie dans les tiennes, et l'originale reste active de son cote.
  clic(env.$("bsegAll"));
  await pause(30);
  const original = env.w.document.querySelector("#browseList .bq .bq-t").textContent;
  const btn = env.w.document.querySelector("#browseList .bq-act");
  verifie("la premiere action est Copier dans les miennes",
    txt(btn) === t("browseCopy"), txt(btn));
  verifie("aucune action Modifier ne subsiste",
    Array.prototype.slice.call(env.w.document.querySelectorAll("#browseList .bq-act"))
      .every((a) => txt(a) !== t("browseEdit")));
  clic(btn);
  await pause(30);
  verifie("copier confirme sur le bouton", txt(btn) === t("browseCopied"), txt(btn));
  verifie("le bouton se desactive une fois copie", btn.disabled === true);
  verifie("copier ne masque PAS l'originale",
    txt(env.$("bsegHidden")) === t("browseHidden") + " 0", txt(env.$("bsegHidden")));
  clic(env.$("browseBack"));
  await pause(40);
  verifie("le retour ramene sur Perso", !env.$("panelPerso").hidden && env.$("panelBrowse").hidden);
  verifie("la copie a rejoint les tiennes",
    txt(env.$("qsegMine")) === t("quotesMine") + " 4", txt(env.$("qsegMine")));

  clic(env.$("savePerso"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("la copie porte le texte de l'originale",
    m && m.payload.customQuotes.some((q) => q.t === original), original);
  verifie("les citations masquees sont enregistrees par leur TEXTE et jamais par un index",
    m && Array.isArray(m.payload.hiddenQuotes)
    && m.payload.hiddenQuotes.every((h) => typeof h === "string"),
    JSON.stringify(m && m.payload.hiddenQuotes));

  // Une seconde copie, dans le meme environnement pour rester deterministe.
  clic(env.$("browseQuotes"));
  await pause(40);
  const autres = env.w.document.querySelectorAll("#browseList .bq");
  clic(autres[1].querySelector(".bq-act"));
  await pause(30);
  clic(env.$("browseBack"));
  await pause(40);
  verifie("une seconde copie distincte entre aussi",
    txt(env.$("qsegMine")) === t("quotesMine") + " 5", txt(env.$("qsegMine")));
}

/* ================= 8. Personnages et animations ================= */
async function testPersonnages() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabPersoBtn"));
  await pause(30);
  verifie("sans image importee, le compteur est a zero",
    txt(env.$("koalaCount")) === "0 " + t("outOf") + " 18", txt(env.$("koalaCount")));
  verifie("sans image importee, la tuile d'origine est montree",
    !!env.$("gallery").querySelector(".gal-d"));
  verifie("la tuile d'ajout est presente", !!env.$("gallery").querySelector(".gal-add"));

  const env2 = monte(Object.assign(DEFAUT(), {
    customKoalas: ["data:image/png;base64,iVBORw0KGgo=", "data:image/png;base64,iVBORw0KGgo="]
  }), 12);
  await pause(80);
  clic(env2.$("tabPersoBtn"));
  await pause(30);
  verifie("les images importees sont comptees",
    txt(env2.$("koalaCount")) === "2 " + t("outOf") + " 18", txt(env2.$("koalaCount")));
  verifie("chaque image a une croix", env2.$("gallery").querySelectorAll(".gal-x").length === 2);
  clic(env2.$("gallery").querySelectorAll(".gal-x")[0]);
  await pause(30);
  verifie("retirer une image met le compteur a jour",
    txt(env2.$("koalaCount")) === "1 " + t("outOf") + " 18");

  const pleine = [];
  for (let i = 0; i < 18; i++) pleine.push("data:image/png;base64,iVBORw0KGgo=");
  const env3 = monte(Object.assign(DEFAUT(), { customKoalas: pleine }), 12);
  await pause(80);
  clic(env3.$("tabPersoBtn"));
  await pause(30);
  verifie("a dix-huit images, la tuile d'ajout disparait", !env3.$("gallery").querySelector(".gal-add"));

  // Animations
  verifie("le mode Jamais est actif",
    env.w.document.querySelector("#animSeg .seg-b--on").getAttribute("data-anim") === "never");
  clic(env.w.document.querySelector('[data-anim="always"]'));
  await pause(20);
  verifie("choisir Toujours pose la classe d'animation",
    env.w.document.documentElement.classList.contains("anim-on"));
  clic(env.w.document.querySelector('[data-anim="never"]'));
  await pause(20);
  verifie("choisir Jamais retire la classe d'animation",
    env.w.document.documentElement.classList.contains("anim-off"));
  clic(env.$("savePerso"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("le mode d'animation est enregistre", m && m.payload.animMode === "never");
}

/* ================= 9. Statistiques ================= */
async function testStats() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  verifie("l'etat vide est masque quand il y a des donnees", env.$("statsBlank").hidden);
  verifie("les tuiles sont visibles", !env.$("statsTiles").hidden);
  verifie("les deux tuiles de serie sont visibles", !env.$("streakTiles").hidden);

  // Module G. Le filtre a cinq positions, et tout l'ecran en depend.
  const seg = env.$("rangeSeg").querySelectorAll(".seg-b");
  verifie("le filtre a cinq positions", seg.length === 5, "vaut " + seg.length);
  const attendus = ["day", "week", "month", "year", "all"];
  attendus.forEach((k, i) => {
    verifie("position " + i + " vaut " + k, seg[i].getAttribute("data-range") === k,
      seg[i].getAttribute("data-range"));
  });

  for (const k of attendus) {
    clic(env.$("rangeSeg").querySelector('[data-range="' + k + '"]'));
    await pause(60);
    verifie("periode " + k + ", la position est marquee active",
      env.$("rangeSeg").querySelector('[data-range="' + k + '"]').classList.contains("seg-b--on"), k);
    verifie("periode " + k + ", les dates sont affichees", txt(env.$("periodDates")).length > 3,
      k + " -> " + txt(env.$("periodDates")));
    verifie("periode " + k + ", le compteur des faites est un nombre",
      /^[0-9]/.test(txt(env.$("statDone"))), k + " -> " + txt(env.$("statDone")));
    verifie("periode " + k + ", le coiffage de total est renseigne",
      txt(env.$("totalHead")).length > 3, k + " -> " + txt(env.$("totalHead")));
    verifie("periode " + k + ", aucune erreur JS", env.erreurs.length === 0, env.erreurs.join(" | "));
  }

  // Les fleches de navigation. La fleche avant est grisee sur la periode en cours.
  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(60);
  verifie("sur la periode en cours, la fleche avant est grisee",
    env.$("rangeNext").disabled === true);
  verifie("la fleche arriere est active tant qu'il y a de l'historique",
    env.$("rangePrev").disabled === false);
  const datesAvant = txt(env.$("periodDates"));
  clic(env.$("rangePrev"));
  await pause(60);
  verifie("la fleche arriere change de periode", txt(env.$("periodDates")) !== datesAvant,
    datesAvant + " -> " + txt(env.$("periodDates")));
  verifie("une fois dans le passe, la fleche avant s'active",
    env.$("rangeNext").disabled === false);
  clic(env.$("rangeNext"));
  await pause(60);
  verifie("la fleche avant ramene a la periode de depart",
    txt(env.$("periodDates")) === datesAvant, txt(env.$("periodDates")));

  // Tout ne navigue pas.
  clic(env.$("rangeSeg").querySelector('[data-range="all"]'));
  await pause(60);
  verifie("Tout ne navigue ni en avant ni en arriere",
    env.$("rangeNext").disabled === true && env.$("rangePrev").disabled === true);

  // Changer de granularite ramene a la periode en cours.
  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(60);
  clic(env.$("rangePrev"));
  await pause(60);
  clic(env.$("rangeSeg").querySelector('[data-range="month"]'));
  await pause(60);
  verifie("changer de granularite ramene a la periode en cours",
    env.$("rangeNext").disabled === true);

  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(60);
  clic(env.$("rangePrev"));
  await pause(60);
  verifie("la semaine passee affiche sept colonnes",
    env.$("trendChart").children.length === 7, "vaut " + env.$("trendChart").children.length);
  verifie("l'axe porte sept jours", env.$("trendAxis").children.length === 7);
  verifie("la ligne d'objectif est visible", !env.$("goalLine").hidden);
  verifie("la legende de l'objectif est chiffree",
    txt(env.$("goalLegendText")) === t("statsGoalLegend").replace("{n}", "3"), txt(env.$("goalLegendText")));

  // Les six phrases d'analyse de la planche 14.
  verifie("la phrase des faites compare a la periode precedente",
    txt(env.$("statDoneSub")).length > 3, txt(env.$("statDoneSub")));
  verifie("la phrase de l'ecran donne une moyenne par jour",
    txt(env.$("statScreenSub")).length > 3, txt(env.$("statScreenSub")));
  verifie("la cadence relie habitudes et ecran",
    txt(env.$("cadenceText")).length > 3, txt(env.$("cadenceText")));
  verifie("la meilleure serie est un nombre",
    /^[0-9]+$/.test(txt(env.$("statBest"))), txt(env.$("statBest")));
  verifie("la meilleure serie porte son unite",
    txt(env.$("statBestUnit")).length > 2, txt(env.$("statBestUnit")));
  verifie("le record est un nombre",
    /^[0-9]+$/.test(txt(env.$("statRecord"))), txt(env.$("statRecord")));
  verifie("aucune sous ligne ne montre un tiret quand la donnee manque",
    ["statDoneSub", "statRepSub", "statScreenSub", "statBestSub", "statRecordSub"]
      .every((id) => txt(env.$(id)) !== "\u2014" && txt(env.$(id)) !== "-"),
    ["statDoneSub", "statRepSub", "statScreenSub", "statBestSub", "statRecordSub"]
      .map((id) => txt(env.$(id))).join(" | "));
  // 2026-09-25 : plus d'energie, ni tuile ni bloc benefice.
  verifie("plus aucune tuile d'energie ni bloc benefice", !env.$("statEnergy") && !env.$("benefitCard") && !env.$("benefitRows"));

  clic(env.$("rangeSeg").querySelector('[data-range="day"]'));
  await pause(60);
  verifie("sur un seul jour, les graphes sont remplaces par une note",
    env.$("chartsCard").hidden && !env.$("trendNote").hidden);

  // Etat de premier lancement
  const env2 = monte(Object.assign(DEFAUT(), { statsDaily: {}, screenDaily: {}, pending: 0 }), 45);
  await pause(80);
  clic(env2.$("tabStatsBtn"));
  await pause(80);
  verifie("sans donnees, le bloc d'accueil apparait", !env2.$("statsBlank").hidden);
  verifie("sans donnees, les tuiles sont masquees", env2.$("statsTiles").hidden);
  verifie("sans donnees, les tuiles de serie sont masquees", env2.$("streakTiles").hidden);
  verifie("sans donnees, le coiffage de total est masque", env2.$("totalHead").hidden);
  verifie("sans donnees, la serie est masquee", env2.$("streakCard").hidden);
  verifie("sans donnees, les trois etapes sont listees",
    env2.$("statsSoon").querySelectorAll(".step").length === 3);
  verifie("sans donnees, le graphe fantome est montre", !env2.$("statsGhost").hidden);
  verifie("sans donnees, l'axe fantome porte sept jours",
    env2.$("ghostAxis").children.length === 7);
  // Sans donnees, la ligne de filtre disparait entierement plutot que d'etre
  // grisee, sinon deux fleches encadrent une date vide.
  verifie("sans donnees, le segmente de periode est masque",
    env2.w.document.querySelector(".segbox--range").hidden === true);
  verifie("sans donnees, la ligne des fleches est masquee",
    env2.w.document.querySelector(".nav").hidden === true);
  verifie("sans donnees, le koala d'accueil est dessine",
    env2.$("blankKoala").children.length === 1);
  clic(env2.$("blankNow"));
  await pause(40);
  verifie("le bouton d'accueil fait venir le koala",
    env2.journal.messages.some((m) => m.type === "kz-trigger-now"));

  // Un seul jour de donnees, tout doit tenir
  const env3 = monte(Object.assign(DEFAUT(), {
    statsDaily: { [jour(0)]: { due: 1, done: 1, rep: 0, eSum: 7, eCount: 1, repH: [0, 0, 0, 0] } },
    screenDaily: { [jour(0)]: 3600 }, pending: 0
  }), 12);
  await pause(80);
  clic(env3.$("tabStatsBtn"));
  await pause(80);
  verifie("avec un seul jour, aucune erreur", env3.erreurs.length === 0, env3.erreurs.join(" | "));
  verifie("avec un seul jour, les tuiles s'affichent sans energie", !env3.$("statsTiles").hidden && !env3.$("statEnergy"));
}

/* ================= 10. Donnees, export, import, effacements ================= */
async function testDonnees() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabDataBtn"));
  await pause(60);
  verifie("le poids des reglages est affiche", /o|Ko|Mo/.test(txt(env.$("szSettings"))), txt(env.$("szSettings")));
  verifie("le poids des statistiques est affiche", /o|Ko|Mo/.test(txt(env.$("szStats"))));
  verifie("le total est affiche", /o|Ko|Mo/.test(txt(env.$("szTotal"))));
  verifie("le nombre de jours d'historique est donne",
    txt(env.$("historyDays")) === t("historyDays").replace("{n}", "40"), txt(env.$("historyDays")));
  verifie("les quatre parties sont cochees par defaut, personnages inclus",
    ["settings", "content", "stats", "koalas"].every((p) =>
      env.w.document.querySelector('[data-part="' + p + '"]').classList.contains("cbx--on")));
  verifie("le mode fusionner est actif par defaut",
    env.w.document.querySelector("#importSeg .seg-b--on").getAttribute("data-mode") === "merge");

  // Export
  clic(env.$("exportBtn"));
  await pause(80);
  verifie("l'export produit un fichier", env.journal.blobs.length === 1);
  if (env.journal.blobs.length) {
    const texte = await env.journal.blobs[0].text();
    const d = JSON.parse(texte);
    verifie("le fichier est signe koala-zen", d.app === "koala-zen");
    verifie("le fichier porte un numero de format", d.format === 1);
    verifie("le fichier porte la version du paquet", d.build === "1.2.0");
    verifie("le fichier porte une date d'export", typeof d.exportedAt === "string" && d.exportedAt.length > 10);
    verifie("les reglages sont exportes", d.settings && d.settings.intervalMinutes === 45);
    verifie("les contenus sont exportes", d.content && Array.isArray(d.content.customSport));
    verifie("les statistiques sont exportees",
      d.stats && Object.keys(d.stats.statsDaily || {}).length === 40);
    verifie("les personnages sont exportes par defaut", d.koalas !== undefined, JSON.stringify(d.koalas));
  }

  // Import en remplacement
  const remplacement = {
    app: "koala-zen", format: 1, build: "1.2.0", exportedAt: new Date().toISOString(),
    settings: { intervalMinutes: 90, preset: "ultradian" },
    content: { customSport: ["Objectif importe"], habitGoal: 7, customQuotes: [{ t: "Importee", a: "X" }], hiddenQuotes: [] },
    stats: { statsDaily: { [jour(-1)]: { due: 1, done: 1, rep: 0 } }, screenDaily: {}, pending: 0 }
  };
  clic(env.w.document.querySelector('[data-mode="replace"]'));
  await pause(30);
  await injecte(env, remplacement);
  verifie("en remplacement, l'intervalle est ecrase", env.donnees.intervalMinutes === 90,
    "vaut " + env.donnees.intervalMinutes);
  verifie("en remplacement, les objectifs sont ecrases",
    env.donnees.customSport.length === 1 && env.donnees.customSport[0] === "Objectif importe",
    JSON.stringify(env.donnees.customSport));
  verifie("en remplacement, l'historique est ecrase",
    Object.keys(env.donnees.statsDaily).length === 1, Object.keys(env.donnees.statsDaily).length + " jours");
  verifie("en remplacement, l'objectif quotidien suit", env.donnees.habitGoal === 7);

  // Import en fusion
  const env2 = monte(DEFAUT(), 12);
  await pause(80);
  clic(env2.$("tabDataBtn"));
  await pause(60);
  await injecte(env2, remplacement);
  verifie("en fusion, les objectifs existants sont gardes",
    env2.donnees.customSport.length === 3 && env2.donnees.customSport[0] === "Fais 3 pompes",
    JSON.stringify(env2.donnees.customSport));
  verifie("en fusion, l'objectif importe est ajoute",
    env2.donnees.customSport.indexOf("Objectif importe") >= 0);
  verifie("en fusion, l'historique existant est conserve",
    Object.keys(env2.donnees.statsDaily).length >= 40,
    Object.keys(env2.donnees.statsDaily).length + " jours");
  verifie("en fusion, les citations sont cumulees sans doublon",
    env2.donnees.customQuotes.length === 2, JSON.stringify(env2.donnees.customQuotes));

  // Un double import ne doit rien doubler
  const avant = JSON.stringify(env2.donnees.customSport);
  await injecte(env2, remplacement);
  verifie("un second import identique ne double rien",
    JSON.stringify(env2.donnees.customSport) === avant, env2.donnees.customSport.join("|"));

  // Fichier invalide
  const env3 = monte(DEFAUT(), 12);
  await pause(80);
  clic(env3.$("tabDataBtn"));
  await pause(60);
  const avant3 = env3.donnees.intervalMinutes;
  await injecte(env3, { app: "autre-chose", settings: { intervalMinutes: 5 } });
  verifie("un fichier etranger est refuse", env3.donnees.intervalMinutes === avant3);
  verifie("le refus est annonce", txt(env3.$("dataMsg")) === t("importBad"), txt(env3.$("dataMsg")));

  // Effacements a deux clics
  const env4 = monte(DEFAUT(), 12);
  await pause(80);
  clic(env4.$("tabDataBtn"));
  await pause(60);
  clic(env4.$("resetHistory"));
  await pause(30);
  verifie("un seul clic demande confirmation",
    txt(env4.$("resetHistory")) === t("eraseConfirm"), txt(env4.$("resetHistory")));
  verifie("un seul clic n'efface rien",
    !env4.journal.messages.some((m) => m.type === "kz-reset"));
  clic(env4.$("resetHistory"));
  await pause(60);
  verifie("le second clic efface l'historique",
    env4.journal.messages.some((m) => m.type === "kz-reset"));

  clic(env4.$("resetAll"));
  await pause(30);
  clic(env4.$("resetAll"));
  await pause(60);
  verifie("tout effacer demande aussi deux clics",
    env4.journal.messages.some((m) => m.type === "kz-reset-all"));
}

async function injecte(env, objet) {
  const w = env.w;
  const contenu = JSON.stringify(objet);
  const fichier = { name: "x.json", type: "application/json", text: () => Promise.resolve(contenu) };
  const input = env.$("importFile");
  Object.defineProperty(input, "files", { value: [fichier], configurable: true });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await pause(150);
}

// background.js n'est jamais charge dans ces tests, seul popup.js l'est. Le
// contrat entre les deux se limite a des messages, on simule donc directement
// les reponses que background.js rendrait, par type de message.
function repondKdrive(env, reponses) {
  env.w.chrome.runtime.sendMessage = (m) => {
    env.journal.messages.push(JSON.parse(JSON.stringify(m)));
    const r = typeof reponses === "function" ? reponses(m) : reponses[m.type];
    return Promise.resolve(r);
  };
}

/* ================= 10b. La carte kDrive ================= */
/* ================= 10c. Le choix du kDrive de destination ================= */
/* ================= 11. L'enregistrement ne perd pas les statistiques ================= */
async function testEnregistrement() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("save"));
  await pause(60);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  const cles = Object.keys(m.payload);
  verifie("l'enregistrement ne touche pas aux statistiques",
    !cles.includes("statsDaily") && !cles.includes("screenDaily"), cles.join(", "));
  verifie("l'enregistrement ne touche pas au retard", !cles.includes("pending"));
  verifie("l'enregistrement ne touche pas a la pause", !cles.includes("pausedUntil"));
  const attendues = ["intervalMinutes", "preset", "muteInCalls", "mutedPatterns", "pauseWhenIdle",
    "focusMode", "focusSeconds", "screenTimezone", "animMode", "customKoalas", "includeDefaultKoalas",
    "customQuotes", "includeDefaultQuotes", "customSport", "hiddenQuotes", "habitGoal"];
  const manquantes = attendues.filter((k) => !cles.includes(k));
  verifie("toutes les cles de reglage sont transmises", manquantes.length === 0, "manque " + manquantes.join(", "));
  verifie("un retour visuel confirme l'enregistrement", env.$("saved").classList.contains("on"));
  clic(env.$("now"));
  await pause(40);
  verifie("faire venir le koala envoie le bon message",
    env.journal.messages.some((x) => x.type === "kz-trigger-now"));
}


/* ================= Theme sombre et temps en reunion, 2026-09-22 ================= */
async function testThemeEtReunions() {
  const srcP = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  let env = monte(Object.assign(DEFAUT(), { theme: "dark" }), 12);
  await pause(80);
  const racineHtml = () => env.w.document.documentElement;
  verifie("theme Sombre enregistre : html porte data-theme=dark", racineHtml().getAttribute("data-theme") === "dark", racineHtml().getAttribute("data-theme"));
  verifie("le segment Theme a trois positions et marque Sombre",
    env.$("themeSeg").querySelectorAll(".seg-b").length === 3 && env.$("themeSeg").querySelector(".seg-b--on").getAttribute("data-th") === "dark");
  clic(env.$("themeSeg").querySelector('[data-th="light"]'));
  await pause(20);
  verifie("Clair s'applique tout de suite, avant Enregistrer", racineHtml().getAttribute("data-theme") === "light" && racineHtml().getAttribute("data-theme-mode") === "light");
  await env.w.eval("save()");
  await pause(80);
  verifie("Enregistrer envoie theme=light dans le paquet de reglages",
    env.journal.messages.some((m) => m.type === "kz-save" && m.payload && m.payload.theme === "light"));

  env = monte(DEFAUT(), 12);
  await pause(80);
  verifie("sans reglage, Automatique, et sans matchMedia le popup reste clair",
    env.w.document.documentElement.getAttribute("data-theme-mode") === "auto" && env.w.document.documentElement.getAttribute("data-theme") === "light");
  env.w.matchMedia = (q) => ({ matches: q.indexOf("dark") >= 0, addEventListener() {}, addListener() {} });
  await env.w.eval("applyTheme('auto')");
  verifie("Automatique suit un systeme sombre", env.w.document.documentElement.getAttribute("data-theme") === "dark");
  verifie("le CSS redefinit les variables sous html[data-theme=dark] et declare color-scheme dark",
    /:root\[data-theme="dark"\] \{\s*color-scheme: dark;/.test(html) && /:root\[data-theme="dark"\] \{[^}]*--w: #1E2327/.test(html));
  verifie("aucune regle prefers-color-scheme en CSS : c'est le script qui decide, pour respecter le choix Clair ou Sombre",
    html.indexOf("prefers-color-scheme") < 0);
  verifie("theme fait partie des reglages exportes", /"agendaEndWarn", "theme", "notifyEnabled", "mailStatsEnabled"\]/.test(srcP));

  // Le temps en reunion.
  const md = {}; md[jour(0)] = { "1@x": 90, "2@y": 30 }; md[jour(-1)] = { "3@z": 60 };
  env = monte(Object.assign(DEFAUT(), { meetingDaily: md }), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  clic(env.$("rangeSeg").querySelector('[data-range="day"]'));
  await pause(60);
  verifie("avec des reunions, la tuile Temps en reunion est visible et pleine largeur",
    !env.$("meetTile").hidden && env.$("meetTile").classList.contains("tile--meet"));
  verifie("aujourd'hui, deux heures de reunion", /2/.test(txt(env.$("statMeet"))) && txt(env.$("statMeet")) !== "—", txt(env.$("statMeet")));
  verifie("sous la tuile, le nombre de reunions", txt(env.$("statMeetSub")) === t("phMeetingMany").replace("{n}", "2"), txt(env.$("statMeetSub")));
  verifie("la vue du jour n'affiche pas de graphe", env.$("chartsCard").hidden);
  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(80);
  verifie("sur la semaine, le graphe Temps en reunion apparait avec une barre par jour",
    !env.$("meetChartWrap").hidden && env.$("meetChart").querySelectorAll(".col").length === 7 && env.$("meetChart").querySelectorAll(".col-b").length === 7, String(env.$("meetChart").querySelectorAll(".col-b").length));
  verifie("les graphes n'ont pas de total en tete : les tuiles le donnent", !env.$("meetText") && !env.$("screenText") && env.$("chartsCard").querySelectorAll(".ch-h").length === 4);
  verifie("les barres de reunion sont bleues, pas grises", /\.col-b--meet \{ background: var\(--ch-meet\); \}/.test(html) && env.$("meetChart").querySelectorAll(".col-b--meet").length >= 1);

  env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(60);
  verifie("sans agenda connecte, ni tuile ni graphe de reunion", env.$("meetTile").hidden && env.$("meetChartWrap").hidden);
  verifie("meetingDaily et mailDaily font partie des cles de statistiques exportees", /STATS_KEYS = \["statsDaily", "screenDaily", "meetingDaily", "mailDaily"\]/.test(srcP));
  verifie("la fusion a l'import garde mes reunions", /patch\.meetingDaily = Object\.assign\(\{\}, data\.stats\.meetingDaily \|\| \{\}, MEET\)/.test(srcP));
}


/* ================= Prevenir les participants, cote popup, 2026-09-22 ================= */
async function testPrevenirPopup() {
  const env = monte(DEFAUT(), 12);
  await pause(80);
  const debut = Date.now() + 30 * 60000;
  let etat = { enabled: true, warn: true, endWarn: true, configured: true, hasToken: true, tokenShared: true, lastError: "",
               inUntil: 0, inId: 0, inStart: 0, nextStart: debut + 5 * 3600000, nextTitle: "Loin", nextId: 5, calendarName: "Thomas (pro)",
               notifyEnabled: false, notifyMailboxEmail: "" };
  const adresses = [{ uuid: "mb-1", email: "moi@example.com", name: "moi", hostingId: 1, login: "moi", principal: true }, { uuid: "mb-1", email: "moi@example.ch", name: "moi", hostingId: 1, login: "moi", principal: false }, { uuid: "mb-2", email: "equipe@example.com", name: "equipe", hostingId: 1, login: "equipe", principal: true }];
  let listeReponse = { ok: true, mailboxes: [], addresses: adresses };
  let connectReponse = { ok: true, mailboxes: [], addresses: adresses };
  const data = { ok: true, id: 77, start: debut, title: "Point produit", sent: [],
    recipients: [{ name: "Boris", address: "boris@example.com", organizer: true }, { name: "", address: "claire@example.com" }],
    templates: { late5: { subject: "Retard de 5 min · Point produit", body: "Corps 5" }, late10: { subject: "Retard de 10 min · Point produit", body: "Corps 10" }, absent: { subject: "Absence · Point produit", body: "Corps absent" } } };
  env.w.chrome.runtime.sendMessage = (m) => {
    env.journal.messages.push(JSON.parse(JSON.stringify(m)));
    if (m.type === "kz-agenda-status") return Promise.resolve(JSON.parse(JSON.stringify(etat)));
    if (m.type === "kz-notify-mailboxes") return Promise.resolve(JSON.parse(JSON.stringify(listeReponse)));
    if (m.type === "kz-notify-connect") return Promise.resolve(JSON.parse(JSON.stringify(connectReponse)));
    if (m.type === "kz-notify-disconnect") { etat.notifyEnabled = false; etat.notifyMailboxEmail = ""; return Promise.resolve({ ok: true }); }
    if (m.type === "kz-notify-choose") { etat.notifyEnabled = true; etat.notifyMailboxEmail = m.mailbox.email; return Promise.resolve({ ok: true }); }
    if (m.type === "kz-notify-prepare") return Promise.resolve(JSON.parse(JSON.stringify(data)));
    if (m.type === "kz-notify-send") return Promise.resolve({ ok: true, count: 2 });
    if (m.type === "kz-save") { if (m.payload && m.payload.notifyEnabled === false) { etat.notifyEnabled = false; etat.notifyMailboxEmail = ""; } return Promise.resolve({ ok: true }); }
    return Promise.resolve({ ok: true });
  };
  await env.w.eval("agendaRefreshUI()");
  await pause(40);
  verifie("Prevenir par mail est propose dans la vue connectee, eteint, avec son explication",
    !env.$("agendaConnected").hidden && !env.$("notifyTgl").checked && txt(env.$("notifySub")) === t("notifyHint"));
  verifie("sans boite choisie, ni bouton Prevenir ni volet", env.$("notifyNow").hidden && env.$("notifyPanel").hidden);

  // Pas encore de jeton mail : on le demande, sans toast.
  listeReponse = { ok: false, error: "not_configured" };
  env.$("notifyTgl").checked = true;
  env.$("notifyTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(60);
  verifie("sans jeton mail, son champ apparait, avec le seul perimetre workspace:mail",
    !env.$("notifyTokenBox").hidden && env.$("notifyTokenInput").type === "password" && txt(env.$("notifyTokenBox").querySelector(".hint")) === t("notifyTokenHint"));
  clic(env.$("notifyConnect"));
  await pause(40);
  verifie("sans rien coller, on le dit et rien ne part", !env.journal.messages.some((m) => m.type === "kz-notify-connect") && txt(env.$("agendaMsg")).length > 0);
  connectReponse = { ok: false, error: "missing_scope" };
  env.$("notifyTokenInput").value = "mauvais";
  clic(env.$("notifyConnect"));
  await pause(60);
  verifie("un jeton sans le perimetre est refuse, en une phrase", txt(env.$("agendaMsg")) === t("tokenErrScope").replace("{s}", "workspace:mail") && !env.$("notifyTokenBox").hidden, txt(env.$("agendaMsg")));
  verifie("apres un refus, le jeton ne reste pas dans le champ", env.$("notifyTokenInput").value === "");
  connectReponse = { ok: false, error: "too_broad", extras: ["calendar"] };
  env.$("notifyTokenInput").value = "mail-large";
  clic(env.$("notifyConnect"));
  await pause(60);
  verifie("un jeton mail qui ouvre aussi l'agenda est refuse", txt(env.$("agendaMsg")) === t("tokenErrBroad").replace("{x}", t("scopeCalendar")).replace("{s}", "workspace:mail"), txt(env.$("agendaMsg")));
  connectReponse = { ok: true, mailboxes: [], addresses: adresses };
  env.$("notifyTokenInput").value = "mail-123";
  clic(env.$("notifyConnect"));
  await pause(80);
  const connexion = env.journal.messages.find((m) => m.type === "kz-notify-connect" && m.token === "mail-123");
  verifie("le jeton mail part au fond, le champ se vide, les adresses s'affichent", !!connexion && env.$("notifyTokenInput").value === "" && !env.$("notifyPick").hidden && env.$("notifyTokenBox").hidden);
  const lignes = env.$("notifyPickList").querySelectorAll(".bq");
  verifie("une ligne par adresse, alias compris, l'alias dit sa boite",
    lignes.length === 3 && txt(lignes[0].querySelector(".bq-t")) === "moi@example.com" && txt(lignes[1].querySelector(".bq-a")) === t("notifyAliasOf").replace("{m}", "moi") && !lignes[0].querySelector(".bq-a"));
  clic(lignes[1].querySelector(".bq-act"));
  await pause(80);
  const choix = env.journal.messages.find((m) => m.type === "kz-notify-choose");
  verifie("choisir un alias envoie l'adresse et sa boite au fond", !!choix && choix.mailbox.email === "moi@example.ch" && choix.mailbox.uuid === "mb-1");
  verifie("l'adresse choisie est nommee en tete du bloc Mail, l'interrupteur allume", env.$("notifyTgl").checked && txt(env.$("mailBoxLine")) === t("notifyFrom").replace("{e}", "moi@example.ch") && txt(env.$("notifySub")) === t("notifyHint") && env.$("notifyPick").hidden);
  verifie("prochain rendez-vous dans cinq heures : pas encore de bouton Prevenir", env.$("notifyNow").hidden);

  // Un rendez-vous dans trente minutes : le bouton apparait, le volet fonctionne.
  etat.nextStart = debut; etat.nextTitle = "Point produit"; etat.nextId = 77;
  await env.w.eval("agendaRefreshUI()");
  await pause(40);
  verifie("a moins d'une heure, le bouton Prevenir apparait", !env.$("notifyNow").hidden && txt(env.$("notifyNow")) === t("notifyButton"));
  clic(env.$("notifyNow"));
  await pause(80);
  const panel = env.$("notifyPanel");
  verifie("le volet demande les participants du bon rendez-vous", env.journal.messages.some((m) => m.type === "kz-notify-prepare" && m.id === 77 && m.start === debut));
  verifie("le volet nomme le rendez-vous, trois messages en segment, deux puces, texte prerempli",
    !panel.hidden && txt(panel.querySelector(".row-lab")) === "Point produit" && panel.querySelectorAll("#notifyKinds .seg-b").length === 3
    && panel.querySelectorAll(".nf-chip").length === 2 && panel.querySelector(".nf-ta").value === "Corps 5" && txt(panel.querySelector(".nf-subj")).indexOf("5 min") >= 0);
  clic(panel.querySelectorAll("#notifyKinds .seg-b")[2]);
  verifie("Absent remplace le texte non retouche", panel.querySelector(".nf-ta").value === "Corps absent" && panel.querySelectorAll("#notifyKinds .seg-b")[2].classList.contains("seg-b--on"));
  clic(panel.querySelector(".nf-send"));
  await pause(60);
  const envoi = env.journal.messages.find((m) => m.type === "kz-notify-send");
  verifie("Envoyer transmet le message, l'objet, le texte et les deux adresses",
    !!envoi && envoi.kind === "absent" && envoi.subject === "Absence · Point produit" && envoi.body === "Corps absent" && envoi.to.length === 2 && envoi.id === 77, JSON.stringify(envoi));
  verifie("le succes est confirme", txt(panel.querySelector(".nf-msg--ok")) === t("notifySentMany").replace("{n}", "2"));

  // En cours : le bouton reste, pour l'absence tardive ou le retard.
  etat.inUntil = Date.now() + 600000; etat.inId = 78; etat.inStart = Date.now() - 600000; etat.inTitle = "En cours";
  await env.w.eval("agendaRefreshUI()");
  await pause(40);
  verifie("pendant un rendez-vous en cours, le bouton Prevenir reste", !env.$("notifyNow").hidden);

  // Eteindre : enregistre tout de suite, sous sa propre cle.
  env.$("notifyTgl").checked = false;
  env.$("notifyTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(60);
  verifie("eteindre deconnecte le mail tout de suite, adresse et jeton propre compris", env.journal.messages.some((m) => m.type === "kz-notify-disconnect"));
  verifie("et le bouton Prevenir disparait", env.$("notifyNow").hidden && !env.$("notifyTgl").checked);
  const srcP = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  verifie("notifyEnabled est exporte avec les reglages, jamais la boite", /"theme", "notifyEnabled", "mailStatsEnabled"\]/.test(srcP) && !/SETTINGS_KEYS = \[[^\]]*notifyMailbox/.test(srcP));
}


/* ================= Stats equilibrees et justes, 2026-09-26 ================= */
async function testStatsJustes() {
  const h = (hh, mm) => new Date(new Date().setHours(hh, mm || 0, 0, 0)).getTime();
  // Aujourd'hui : A 9 h - 10 h, B 9 h 30 - 10 h 30 qui chevauche, et A vue
  // dans un second agenda sous un autre identifiant. Temps reel : 1 h 30.
  const md = {}; md[jour(0)] = { "1@a": [h(9), h(10)], "2@b": [h(9, 30), h(10, 30)], "9@a-copie": [h(9), h(10)] };
  md[jour(-1)] = { "ancien": 45 };
  const mails = {}; mails[jour(0)] = { in: 40, out: 10, read: 20, del: 12, done: 32 }; 
  // Deux autres jours de la MEME semaine que aujourd'hui (lundi a dimanche),
  // pour que le test ne depende pas du jour ou il tourne.
  const lundi = -((new Date().getDay() + 6) % 7);
  const autres = [0, 1, 2, 3, 4, 5, 6].map((i) => lundi + i).filter((n) => n !== 0).slice(0, 2);
  mails[jour(autres[0])] = { in: 20, out: 10, read: 8, del: 4, done: 12 };
  mails[jour(autres[1])] = { in: 30, out: 6 }; // ancien format : pas de traites mesures
  let env = monte(Object.assign(DEFAUT(), { meetingDaily: md, mailDaily: mails }), 12);
  await pause(80);
  verifie("deux reunions qui se chevauchent et un doublon d'agenda font 1 h 30, pas 3 h", env.w.eval("meetingSecDay(" + JSON.stringify(jour(0)) + ")") === 5400, String(env.w.eval("meetingSecDay(" + JSON.stringify(jour(0)) + ")")));
  verifie("et comptent pour deux reunions, pas trois", env.w.eval("meetingCountDay(" + JSON.stringify(jour(0)) + ")") === 2);
  verifie("un ancien historique en minutes reste lu", env.w.eval("meetingSecDay(" + JSON.stringify(jour(-1)) + ")") === 2700 && env.w.eval("meetingCountDay(" + JSON.stringify(jour(-1)) + ")") === 1);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  clic(env.$("rangeSeg").querySelector('[data-range="day"]'));
  await pause(60);
  verifie("la tuile reunion dit 1 h 30 et 2 reunions", txt(env.$("statMeet")) === "1 " + t("unitHour") + " 30" && txt(env.$("statMeetSub")) === t("phMeetingMany").replace("{n}", "2"), txt(env.$("statMeet")) + " / " + txt(env.$("statMeetSub")));
  verifie("les tuiles mails sont la : 32 traites, 10 envoyes", !env.$("mailInTile").hidden && txt(env.$("statMailIn")) === "32" && txt(env.$("statMailOut")) === "10");
  verifie("sous les traites, les supprimes et les recus", txt(env.$("statMailInSub")) === t("phMailDone").replace("{d}", "12").replace("{n}", "40"), txt(env.$("statMailInSub")));
  verifie("la tuile dit Mails traites", txt(env.$("mailInTile").querySelector(".tile-l")) === t("statsMailDone"));
  const grille = env.$("statsTiles");
  const visibles = Array.from(grille.children).filter((n) => !n.hidden);
  verifie("six tuiles, deux par ligne, aucune pleine largeur", visibles.length === 6 && !visibles.some((n) => n.classList.contains("tile--wide")), visibles.map((n) => n.className).join(" | "));
  clic(env.$("rangeSeg").querySelector('[data-range="week"]'));
  await pause(80);
  verifie("sur la semaine, le graphe des mails a une colonne par jour, traites et envoyes", !env.$("mailChartWrap").hidden && env.$("mailChart").querySelectorAll(".col").length === 7 && env.$("mailChart").querySelectorAll(".col-b").length === 14 && env.$("mailChart").querySelectorAll(".col-b--in").length === 2 && env.$("mailChart").querySelectorAll(".col-b--out").length === 3, [".col",".col-b",".col-b--in",".col-b--out"].map((s) => env.$("mailChart").querySelectorAll(s).length).join(" "));
  verifie("les traites ne comptent que les jours mesures : 44 sur 2 jours, recus 90 sur 3", txt(env.$("statMailIn")) === "44" && txt(env.$("statMailInSub")) === t("phMailDone").replace("{d}", "16").replace("{n}", "90"), txt(env.$("statMailIn")) + " / " + txt(env.$("statMailInSub")));
  verifie("la moyenne des envois par jour est ecrite", txt(env.$("statMailOutSub")) === t("phPerDay").replace("{n}", "8,7"), txt(env.$("statMailOutSub")));
  const lesCols = env.$("mailChart").querySelectorAll(".col");
  verifie("un jour ancien format montre ses envois mais pas de traites inventes", !!lesCols.length);
  verifie("sur une semaine, pas de jour le plus charge : le graphe le montre deja", env.$("meetBusy").hidden && env.$("mailBusy").hidden);
  // Cinq semaines : le jeudi domine en reunions et le lundi en mails.
  const md5 = {}, ml5 = {};
  for (let i = 0; i < 35; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(9, 0, 0, 0);
    const k = jour(-i), b = d.getTime();
    md5[k] = { ["r" + i]: [b, b + (d.getDay() === 4 ? 3 : 1) * 3600000] };
    ml5[k] = { in: 100, out: 5, done: d.getDay() === 1 ? 80 : 20, del: 5, read: 10 };
  }
  env = monte(Object.assign(DEFAUT(), { meetingDaily: md5, mailDaily: ml5 }), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  clic(env.$("rangeSeg").querySelector('[data-range="year"]'));
  await pause(80);
  verifie("sur l'annee, la phrase des reunions designe le jeudi, en gras",
    !env.$("meetBusy").hidden && /jeudi/i.test(txt(env.$("meetBusy").querySelector("b"))) && env.$("meetBusy").querySelectorAll("b").length === 2, txt(env.$("meetBusy")));
  verifie("et celle des mails le lundi", !env.$("mailBusy").hidden && /lundi/i.test(txt(env.$("mailBusy"))), txt(env.$("mailBusy")));

  // Sans reunion ni mail : l'ecran prend la ligne, pas de case vide.
  env = monte(DEFAUT(), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  const vis = Array.from(env.$("statsTiles").children).filter((n) => !n.hidden);
  verifie("sans reunion ni mail, trois tuiles et l'ecran pleine largeur", vis.length === 3 && vis[2].classList.contains("tile--scr") && vis[2].classList.contains("tile--wide"), vis.map((n) => n.className).join(" | "));
  verifie("la cadence dit ce qu'elle mesure", txt(env.$("cadenceText")) === "" || txt(env.$("cadenceText")).indexOf(t("phPace").split("{d}")[0]) === 0, txt(env.$("cadenceText")));

  // Un seul jour de serie : "1 jour", jamais "1 jours".
  const un = {}; un[jour(0)] = { due: 1, done: 1, rep: 0, repH: [0, 0, 0, 0] };
  env = monte(Object.assign(DEFAUT(), { statsDaily: un, screenDaily: {} }), 12);
  await pause(80);
  clic(env.$("tabStatsBtn"));
  await pause(60);
  verifie("une serie d'un jour s'accorde au singulier, tuiles et carte Serie", txt(env.$("statBestUnit")) === t("dayWord") && txt(env.$("statRecordUnit")) === t("dayWord") && txt(env.$("statStreakUnit")) === t("statsStreakDay"), txt(env.$("statBestUnit")) + " / " + txt(env.$("statRecordUnit")) + " / " + txt(env.$("statStreakUnit")));

  // Le rythme hebdomadaire des reunions sur deux semaines et plus.
  const long = {};
  for (let i = 0; i < 28; i++) { const k = jour(-i); long[k] = {}; if (i % 7 < 5) long[k]["r" + i] = [h(9) - i * 86400000, h(10) - i * 86400000]; }
  env = monte(Object.assign(DEFAUT(), { meetingDaily: long }), 12);
  await pause(80);
  const phrase = env.w.eval("phraseReunion(3600, 7200, 28, 20)");
  verifie("sur quatre semaines, le nombre et le rythme par semaine", phrase === t("phMeetingMany").replace("{n}", "20") + " · " + t("phMeetingPerWeek").replace("{n}", "5"), phrase);
  verifie("sur une semaine, le nombre seul", env.w.eval("phraseReunion(3600, 7200, 7, 4)") === t("phMeetingMany").replace("{n}", "4"));
  verifie("une reunion au singulier", env.w.eval("phraseReunion(3600, 7200, 1, 1)") === t("phMeetingOne"));

  // L'interrupteur Compter mes mails.
  verifie("Compter mes mails existe, eteint par defaut", !!env.$("mailStatsTgl") && !env.$("mailStatsTgl").checked);
  env.w.chrome.runtime.sendMessage = (m) => { env.journal.messages.push(m); if (m.type === "kz-agenda-status") return Promise.resolve({ configured: true, calendarName: "Pro", calendars: [{ id: 1, name: "Pro" }], notifyEnabled: false, notifyMailboxEmail: "" }); return Promise.resolve({ ok: true }); };
  env.$("mailStatsTgl").checked = true;
  env.$("mailStatsTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(60);
  verifie("sans boite choisie, l'interrupteur retombe et dit quoi faire", !env.$("mailStatsTgl").checked && txt(env.$("agendaMsg")) === t("mailStatsNeedsBox"));
  env.w.chrome.runtime.sendMessage = (m) => { env.journal.messages.push(m); if (m.type === "kz-agenda-status") return Promise.resolve({ configured: true, hasToken: true, notifyHasToken: true, calendarName: "Pro", calendars: [{ id: 1, name: "Pro" }], notifyEnabled: false, notifyMailboxEmail: "moi@example.com", mailStatsEnabled: true }); return Promise.resolve({ ok: true }); };
  env.$("mailStatsTgl").checked = true;
  env.$("mailStatsTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(60);
  // 2026-09-26 : l'adresse s'ecrit une seule fois, en tete du bloc Mail.
  verifie("avec une boite, l'allumage s'enregistre tout de suite et l'adresse est nommee en tete du bloc Mail",
    env.journal.messages.some((m) => m.type === "kz-save" && m.payload && m.payload.mailStatsEnabled === true)
    && !env.$("mailBoxLine").hidden && txt(env.$("mailBoxLine")) === t("notifyFrom").replace("{e}", "moi@example.com") && txt(env.$("mailStatsSub")) === t("mailStatsHint"),
    [env.journal.messages.filter((m) => m.type === "kz-save").map((m) => JSON.stringify(m.payload)).join(";"), env.$("mailBoxLine").hidden, txt(env.$("mailBoxLine")), txt(env.$("mailStatsSub"))].join(" | "));
}


/* ================= Onboarding et carte Agenda, 2026-09-26 ================= */
async function testOnboarding() {
  let env = monte(Object.assign(DEFAUT(), { firstRun: true }), 12);
  await pause(80);
  const pas = () => Array.from(env.w.document.querySelectorAll("#firstRun .fr-step")).findIndex((s) => !s.hidden);
  verifie("l'onboarding s'ouvre a la premiere etape, quatre points, le premier actif",
    !env.$("firstRun").hidden && pas() === 0 && env.$("frDots").children.length === 4 && env.$("frDots").children[0].classList.contains("on"));
  verifie("premiere etape : l'habitude prereplie, Continuer, ni Retour ni Passer", !!env.$("frHabit").value && !env.$("frNext").hidden && env.$("frBack").hidden && env.$("frSkip").hidden && env.$("frStart").hidden);
  clic(env.$("frNext")); await pause(20);
  verifie("deuxieme etape : cinq benefices, chacun titre par ce que l'on y gagne", pas() === 1 && env.w.document.querySelectorAll("#firstRun .fr-feat").length === 5 && !env.$("frBack").hidden && env.$("frSkip").hidden);
  clic(env.$("frNext")); await pause(20);
  verifie("troisieme etape : le jeton Infomaniak, facultatif, un lien pour le creer, seul Passer avant connexion",
    pas() === 2 && env.$("frToken").type === "password" && /manager\.infomaniak\.com/.test(env.w.document.querySelector("#firstRun a[target=_blank]").href) && !env.$("frSkip").hidden && env.$("frNext").hidden);
  verifie("un seul perimetre est nomme, en etiquette a recopier : workspace:calendar", Array.from(env.$("frScopes").querySelectorAll(".fr-chip")).map((n) => txt(n)).join(",") === "workspace:calendar");
  verifie("trois etapes numerotees : creer, cocher, coller", env.w.document.querySelectorAll("#frIkForm .fr-li").length === 3);
  clic(env.$("frConnect")); await pause(40);
  verifie("sans jeton, on le dit sans rien envoyer", !env.$("frIkErr").hidden && !env.journal.messages.some((m) => m.type === "kz-agenda-connect"));

  // Connexion : le jeton va directement a l'agenda, puis deux agendas a cocher.
  env.w.chrome.runtime.sendMessage = (m) => {
    env.journal.messages.push(JSON.parse(JSON.stringify(m)));
    if (m.type === "kz-agenda-connect") {
      if (m.token === "large") return Promise.resolve({ ok: false, error: "too_broad", extras: ["mail"] });
      if (m.token !== "bon") return Promise.resolve({ ok: false, error: "invalid_token" });
      return Promise.resolve({ ok: true, needsChoice: true, calendars: [{ id: 10, name: "Pro", isDefault: true }, { id: 11, name: "Perso" }] });
    }
    if (m.type === "kz-agenda-choose") return Promise.resolve({ ok: true });
    if (m.type === "kz-agenda-status") return Promise.resolve({ configured: true, hasToken: true, calendars: [], calendarName: "Pro" });
    if (m.type === "kz-save") { if (m.payload) Object.assign(env.donnees, m.payload); return Promise.resolve({ ok: true }); }
    return Promise.resolve({ ok: true });
  };
  env.$("frToken").value = "mauvais"; clic(env.$("frConnect")); await pause(60);
  verifie("un jeton refuse s'explique en une phrase", !env.$("frIkErr").hidden && txt(env.$("frIkErr")) === t("tokenErrInvalid"), txt(env.$("frIkErr")));
  env.$("frToken").value = "large"; clic(env.$("frConnect")); await pause(60);
  verifie("un jeton qui ouvre aussi le mail est refuse, en nommant le seul perimetre voulu",
    txt(env.$("frIkErr")) === t("tokenErrBroad").replace("{x}", t("scopeMail")).replace("{s}", "workspace:calendar"), txt(env.$("frIkErr")));
  env.$("frToken").value = "bon"; clic(env.$("frConnect")); await pause(80);
  verifie("aucun message kDrive ne part plus", !env.journal.messages.some((m) => /kdrive/.test(m.type)));
  verifie("le bon jeton : les agendas s'affichent, le defaut precoche, le champ se vide",
    !env.$("frCals").hidden && env.$("frCalList").querySelectorAll(".bq--on").length === 1 && env.$("frToken").value === "");
  clic(env.$("frCalList").querySelectorAll(".bq")[1]);
  clic(env.$("frCalOk")); await pause(80);
  const choixCal = env.journal.messages.find((m) => m.type === "kz-agenda-choose");
  verifie("deux agendas coches partent ensemble", !!choixCal && choixCal.calendars.length === 2);
  const res = Array.from(env.$("frIkDone").querySelectorAll(".fr-res")).map((n) => txt(n));
  verifie("la connexion se resume : l'agenda coche, le mail annonce pour plus tard, avec son propre jeton",
    !env.$("frIkDone").hidden && txt(env.$("frIkDone").querySelector(".fr-done-t")) === t("frIkDoneTitle") && res.join("|") === t("frIkAgenda") + "|" + t("frIkMailLater")
    && env.$("frIkDone").querySelectorAll(".fr-res--later").length === 1, res.join("|"));
  verifie("l'etape conseille une echeance pour le jeton", /échéance/.test(t("frIkStep2")));
  verifie("une fois connecte, Continuer remplace Passer", !env.$("frNext").hidden && env.$("frSkip").hidden);
  clic(env.$("frNext")); await pause(20);
  verifie("derniere etape : tes donnees chez toi, trois garanties, plus de sauvegarde automatique, et Commencer",
    pas() === 3 && env.w.document.querySelectorAll('#firstRun .fr-step[data-step="3"] .fr-res').length === 3 && !env.$("frAuto") && !env.$("frStart").hidden && env.$("frNext").hidden);
  clic(env.$("frStart")); await pause(120);
  verifie("Commencer enregistre l'habitude et ferme l'onboarding, sans rien envoyer a kDrive",
    env.donnees.firstRun === false && env.$("firstRun").hidden && !env.journal.messages.some((m) => /kdrive/.test(m.type)));

  // Sans connexion : Passer jusqu'au bout.
  env = monte(Object.assign(DEFAUT(), { firstRun: true }), 12);
  await pause(80);
  clic(env.$("frNext")); await pause(10); clic(env.$("frNext")); await pause(10); clic(env.$("frSkip")); await pause(20);
  verifie("Passer mene a la derniere etape", pas() === 3);
  clic(env.$("frBack")); await pause(10);
  verifie("Retour revient a l'etape precedente", pas() === 2);
  clic(env.$("frSkip")); await pause(10);
  clic(env.$("frStart")); await pause(120);
  verifie("sans connexion, Commencer ferme l'onboarding", env.$("firstRun").hidden && env.journal.messages.some((m) => m.type === "kz-save" && m.payload && m.payload.firstRun === false), String(env.$("firstRun").hidden));
  verifie("un lien permet de revoir la presentation", !!env.$("replayTour") && txt(env.$("replayTour")) === t("frReplay"));
  clic(env.$("replayTour")); await pause(80);
  verifie("et il la rouvre au debut", !env.$("firstRun").hidden && pas() === 0);

  // Refonte du 2026-09-28 : barre du haut, bouton principal fixe, koala du rappel.
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  const top = env.w.document.querySelector("#firstRun .fr-top");
  verifie("Retour et Passer vivent dans la barre du haut, autour de la progression", !!top && top.contains(env.$("frBack")) && top.contains(env.$("frSkip")) && top.contains(env.$("frDots")));
  verifie("le bouton principal est hors des etapes, donc toujours au meme endroit", !env.$("frNext").closest(".fr-step") && !env.$("frStart").closest(".fr-step"));
  verifie("le popup garde la meme hauteur d'une etape a l'autre", /\.fr \{ min-height: 554px;/.test(html));
  verifie("chaque etape a un titre de niveau 1", Array.from(env.w.document.querySelectorAll("#firstRun .fr-step")).every((s) => s.querySelector("h1.fr-t")));
  verifie("Retour est un bouton icone avec un nom lisible", env.$("frBack").getAttribute("aria-label") === t("notifyBack"));
  const src = env.$("frKoala").getAttribute("src");
  verifie("l'accueil montre le koala du rappel, anime ou fixe selon le reglage", /^images\/koala-hello(-still)?\.svg$/.test(src), src);
  const svgA = fs.readFileSync(path.join(RACINE, "images", "koala-hello.svg"), "utf8");
  const svgF = fs.readFileSync(path.join(RACINE, "images", "koala-hello-still.svg"), "utf8");
  const cjs = fs.readFileSync(path.join(RACINE, "content.js"), "utf8");
  const oreille = (cjs.match(/reminder: `[\s\S]*?(<g class="kz-ear kz-ear--l"><path d="[^"]{40})/) || [])[1];
  verifie("le dessin est celui de content.js, sans derive", !!oreille && svgA.indexOf(oreille) > 0 && svgF.indexOf(oreille) > 0);
  verifie("la version animee respecte la reduction des animations, la fixe n'anime rien", /prefers-reduced-motion/.test(svgA) && !/@keyframes|animation/.test(svgF));
  clic(env.$("frNext")); await pause(10);
  verifie("apres la premiere etape, le point passe se distingue", env.$("frDots").children[0].classList.contains("fait") && env.$("frDots").getAttribute("aria-valuenow") === "2");
}

async function testCarteAgenda() {
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  const bloc = html.slice(html.indexOf('<div id="agendaConnected"'), html.indexOf('<div class="saved" id="agendaMsg">'));
  const ordre = ["agendaConnectedLabel", "agendaNextLine", "notifyNow", "agendaGrpRemind", "agendaWarnTgl", "agendaEndWarnTgl", "agendaGrpMail", "mailBoxLine", "notifyTgl", "mailStatsTgl", "agendaChange"];
  const pos = ordre.map((k) => bloc.indexOf(k));
  verifie("la carte Agenda se lit en trois blocs : l'agenda et Prevenir, les rappels, le mail", pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), JSON.stringify(pos));
  verifie("le bouton Prevenir est sous le prochain rendez-vous, plus au milieu des reglages", bloc.indexOf("notifyNow") < bloc.indexOf("agendaWarnTgl"));
  const fr = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales", "fr", "messages.json"), "utf8"));
  const courts = ["agendaWarnLabel", "agendaEndWarnLabel", "notifyLabel", "mailStatsLabel", "agendaWarnHint", "agendaEndWarnHint", "notifyHint", "mailStatsHint", "agendaCardHint"];
  verifie("des libelles de moins de 30 signes et des explications de moins de 70", courts.every((k) => fr[k] && fr[k].message.length <= (/Label/.test(k) ? 30 : 70)), courts.map((k) => k + ":" + (fr[k] || {}).message.length).join(" "));
  // Les textes de secours du HTML suivent la locale francaise.
  const ecarts = [];
  html.replace(/<(div|span|button|a)(\s[^>]*?data-i18n="([^"]+)"[^>]*)>([^<]*)<\/\1>/g, (m0, tag, attrs, key, inner) => {
    if (fr[key] && fr[key].message.indexOf("{") < 0 && inner.trim() && inner.trim().replace(/&amp;/g, "&") !== fr[key].message) ecarts.push(key);
    return m0;
  });
  verifie("aucun texte de secours du HTML ne diverge de la locale", ecarts.length === 0, ecarts.slice(0, 6).join(","));
}

/* ---------- execution ---------- */
/* ================= Dessins filtres, revue ECC du 2026-10-06 ================= */
async function testSvgFiltre() {
  const env = monte(DEFAUT(), 12);
  await pause(60);
  const n = env.w.eval("svgNode('<svg xmlns=\\'http://www.w3.org/2000/svg\\' onload=\\'x()\\'><script>x()</script><foreignObject><div xmlns=\\'http://www.w3.org/1999/xhtml\\'>y</div></foreignObject><a href=\\'javascript:x()\\'><circle onclick=\\'x()\\' r=\\'2\\' fill=\\'red\\'/></a></svg>')");
  verifie("le dessin est reconstruit", !!n && n.localName === "svg");
  verifie("sans script ni objet etranger", !n.querySelector("script") && !n.querySelector("foreignObject"));
  verifie("sans attribut d'evenement", !n.hasAttribute("onload") && !n.querySelector("[onclick]"));
  verifie("sans lien javascript, le reste du dessin intact", !n.querySelector("a[href^='javascript']") && n.querySelector("circle").getAttribute("fill") === "red");
}

(async () => {
  /* ================= L'agenda Infomaniak, carte Ne pas deranger ================= */
  // Le popup ne fait que demander et afficher : un background simule repond
  // aux messages agenda, et l'on verifie les trois vues, la bascule
  // immediate des interrupteurs et l'en-tete pendant un rendez-vous.
  async function testAgenda() {
    const env = monte(DEFAUT(), 12);
    await pause(80);
    // 2026-09-17 : la connexion vit dans sa propre carte, toujours visible,
    // et la ligne de Ne pas deranger dit ou en est la connexion.
    verifie("l'interrupteur agenda est eteint par defaut et la carte Agenda est visible",
      !env.$("agendaTgl").checked && !env.$("agendaCard").hidden && !env.$("agendaSetup").hidden);
    verifie("la ligne de Ne pas deranger renvoie vers la carte tant que rien n'est connecte",
      txt(env.$("agendaDndSub")) === t("agendaDndNeeds"), txt(env.$("agendaDndSub")));

    let etat = { enabled: false, warn: true, endWarn: true, configured: false, hasToken: false, lastError: "",
                 inUntil: 0, nextStart: 0, nextTitle: "", calendarName: "" };
    const cals = [{ id: 132129, name: "Thomas (pro)", isDefault: true, permission: "owner" },
                  { id: 60, name: "Boris", isDefault: false, permission: "readwrite" }];
    env.w.chrome.runtime.sendMessage = (m) => {
      env.journal.messages.push(JSON.parse(JSON.stringify(m)));
      if (m.type === "kz-save") {
        if (m.payload.agendaEnabled !== undefined) etat.enabled = m.payload.agendaEnabled;
        if (m.payload.agendaWarn !== undefined) etat.warn = m.payload.agendaWarn;
        if (m.payload.agendaEndWarn !== undefined) etat.endWarn = m.payload.agendaEndWarn;
        return Promise.resolve({ ok: true });
      }
      if (m.type === "kz-agenda-status") return Promise.resolve(JSON.parse(JSON.stringify(etat)));
      if (m.type === "kz-agenda-connect") {
        if (m.token === "trop-large") return Promise.resolve({ ok: false, error: "too_broad", extras: ["mail", "kdrive"] });
        etat.hasToken = true;
        return Promise.resolve({ ok: true, needsChoice: true, calendars: cals });
      }
      if (m.type === "kz-agenda-list-calendars") return Promise.resolve({ ok: true, calendars: cals });
      if (m.type === "kz-agenda-choose") {
        etat.configured = true; etat.calendars = m.calendars; etat.calendarName = m.calendars.map((c) => c.name).join(", ");
        etat.nextStart = Date.now() + 2 * 3600000; etat.nextTitle = "Point";
        return Promise.resolve({ ok: true });
      }
      if (m.type === "kz-agenda-disconnect") {
        etat = Object.assign({}, etat, { enabled: false, configured: false, calendarName: "" });
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve();
    };

    env.$("agendaTgl").checked = true;
    env.$("agendaTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
    await pause(80);
    verifie("allumer enregistre tout de suite, sans passer par Enregistrer",
      env.journal.messages.some((m) => m.type === "kz-save" && m.payload.agendaEnabled === true));
    verifie("la carte reste sur la vue de connexion",
      !env.$("agendaSetup").hidden && env.$("agendaConnected").hidden && env.$("agendaPicker").hidden);
    // Apres la migration : agendas encore choisis, jeton a recoller, et on dit pourquoi.
    const etatAvant = etat;
    etat = Object.assign({}, etat, { configured: true, hasToken: false, tokensReset: true, calendarName: "Pro", calendars: [{ id: 1, name: "Pro" }] });
    await env.w.eval("agendaRefreshUI()");
    await pause(30);
    verifie("apres la migration, la carte redemande le jeton et explique pourquoi",
      !env.$("agendaSetup").hidden && env.$("agendaConnected").hidden && txt(env.$("agendaSetupHint")) === t("tokensResetHint"), txt(env.$("agendaSetupHint")));
    etat = etatAvant;
    await env.w.eval("agendaRefreshUI()");
    await pause(30);
    // 2026-09-29 : un jeton par usage, plus de jeton partage.
    verifie("le champ du jeton est la, avec le seul perimetre attendu",
      !env.$("agendaTokenRow").hidden && txt(env.$("agendaSetupHint")) === t("agendaTokenHint") && /workspace:calendar/.test(t("agendaTokenHint")) && !/kDrive|workspace:mail/.test(t("agendaTokenHint")), txt(env.$("agendaSetupHint")));
    clic(env.$("agendaConnect"));
    await pause(40);
    verifie("sans jeton colle, on le dit et rien ne part", txt(env.$("agendaMsg")) === t("tokenErrEmpty") && !env.journal.messages.some((m) => m.type === "kz-agenda-connect"));
    env.$("agendaTokenInput").value = "trop-large";
    clic(env.$("agendaConnect"));
    await pause(60);
    verifie("un jeton trop large est refuse, en nommant ce qu'il ouvre en trop et le seul perimetre voulu",
      txt(env.$("agendaMsg")) === t("tokenErrBroad").replace("{x}", t("scopeMail") + ", " + t("scopeKdrive")).replace("{s}", "workspace:calendar"), txt(env.$("agendaMsg")));
    env.$("agendaTokenInput").value = "jeton-agenda";
    clic(env.$("agendaConnect"));
    await pause(80);
    verifie("le jeton colle part au fond", env.journal.messages.some((m) => m.type === "kz-agenda-connect" && m.token === "jeton-agenda"));
    verifie("plusieurs agendas lisibles : le choix s'affiche", !env.$("agendaPicker").hidden && env.$("agendaSetup").hidden);
    const lignes = env.$("agendaPickList").querySelectorAll(".bq");
    verifie("une ligne par agenda, le defaut marque",
      lignes.length === 2 && txt(lignes[0]).indexOf(t("agendaDefaultTag")) >= 0, lignes.length ? txt(lignes[0]) : "aucune ligne");
    verifie("un agenda partage est marque", lignes.length === 2 && txt(lignes[1]).indexOf(t("agendaSharedTag")) >= 0, lignes.length ? txt(lignes[1]) : "");
    // 2026-09-22 : plusieurs agendas a cocher (pro et perso), puis Surveiller.
    verifie("rien de coche, Surveiller est verrouille", env.$("agendaPickOk").disabled && lignes[0].getAttribute("role") === "checkbox");
    clic(lignes[0]);
    clic(lignes[1]);
    verifie("deux agendas coches, Surveiller s'ouvre", lignes[0].classList.contains("bq--on") && lignes[1].classList.contains("bq--on") && !env.$("agendaPickOk").disabled);
    clic(lignes[1]);
    verifie("recliquer decoche", !lignes[1].classList.contains("bq--on"));
    lignes[1].dispatchEvent(new env.w.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    verifie("la barre d'espace coche aussi, au clavier", lignes[1].classList.contains("bq--on"));
    clic(env.$("agendaPickOk"));
    await pause(120);
    const choix = env.journal.messages.find((m) => m.type === "kz-agenda-choose");
    verifie("le choix part avec la liste des agendas, identifiants et noms",
      !!choix && Array.isArray(choix.calendars) && choix.calendars.length === 2 && choix.calendars[0].id === 132129 && choix.calendars[1].name === "Boris", JSON.stringify(choix));
    verifie("la vue connectee prend la place", !env.$("agendaConnected").hidden && env.$("agendaPicker").hidden);
    verifie("elle nomme les agendas surveilles, au pluriel",
      txt(env.$("agendaConnectedLabel")) === t("agendaConnectedToMany").replace("{n}", "Thomas (pro), Boris"), txt(env.$("agendaConnectedLabel")));
    verifie("la ligne de Ne pas deranger nomme aussi les agendas une fois connectes",
      txt(env.$("agendaDndSub")) === t("agendaConnectedToMany").replace("{n}", "Thomas (pro), Boris"), txt(env.$("agendaDndSub")));
    verifie("et annonce le prochain rendez-vous", txt(env.$("agendaNextLine")).indexOf("Point") >= 0, txt(env.$("agendaNextLine")));

    env.$("agendaWarnTgl").checked = false;
    env.$("agendaWarnTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
    await pause(60);
    verifie("le rappel trois minutes avant s'enregistre tout de suite",
      env.journal.messages.some((m) => m.type === "kz-save" && m.payload.agendaWarn === false));
    // 2026-09-21 : troisieme interrupteur, le rappel cinq minutes avant la fin.
    verifie("l'interrupteur du rappel de fin existe, allume par defaut, dans la vue connectee",
      !!env.$("agendaEndWarnTgl") && env.$("agendaEndWarnTgl").checked && env.$("agendaConnected").contains(env.$("agendaEndWarnTgl")));
    verifie("il porte son libelle et son explication",
      txt(env.$("agendaEndWarnTgl").closest(".row").querySelector(".row-lab")) === t("agendaEndWarnLabel")
      && txt(env.$("agendaEndWarnTgl").closest(".row").querySelector(".row-sub")) === t("agendaEndWarnHint"));
    env.$("agendaEndWarnTgl").checked = false;
    env.$("agendaEndWarnTgl").dispatchEvent(new env.w.Event("change", { bubbles: true }));
    await pause(60);
    verifie("le rappel de fin s'enregistre tout de suite, sous sa propre cle",
      env.journal.messages.some((m) => m.type === "kz-save" && m.payload.agendaEndWarn === false && m.payload.agendaWarn === undefined));
    await env.w.eval("agendaRefreshUI()");
    await pause(40);
    verifie("l'interrupteur de fin relit l'etat du fond", env.$("agendaEndWarnTgl").checked === false);

    // En-tete : un rendez-vous en cours passe avant la prochaine visite.
    // 2026-10-06 : l'etat vit dans le coffre du fond, le popup le demande.
    env.donnees.agendaEnabled = true;
    etat.enabled = true; etat.inUntil = Date.now() + 600000; etat.inTitle = "Point";
    await env.w.eval("refreshNextVisit()");
    await pause(40);
    verifie("l'en-tete annonce le rendez-vous en cours", txt(env.$("nextVisit")) === t("statusMeeting"), txt(env.$("nextVisit")));
    etat.inUntil = 0; etat.inTitle = "";
    await env.w.eval("refreshNextVisit()");
    await pause(40);
    verifie("une fois le rendez-vous fini, l'en-tete redevient normal", txt(env.$("nextVisit")) !== t("statusMeeting"), txt(env.$("nextVisit")));

    clic(env.$("agendaDisconnect"));
    await pause(80);
    verifie("deconnecter revient a la vue de connexion et eteint l'interrupteur du silence",
      env.journal.messages.some((m) => m.type === "kz-agenda-disconnect") && !env.$("agendaSetup").hidden
      && env.$("agendaConnected").hidden && !env.$("agendaTgl").checked && txt(env.$("agendaDndSub")) === t("agendaDndNeeds"));
  }

  /* ================= Corrections de la revue du 2026-09-16 ================= */
  async function testCorrectionsPopup() {
    const env = monte(DEFAUT(), 12);
    await pause(80);
    // Arrondi des durees : a la minute d'abord.
    verifie("7170 s donnent 2 h 00, plus jamais 1 h 60",
      env.w.eval("fmtDurShort(7170)") === "2 " + t("unitHour") + " 00", env.w.eval("fmtDurShort(7170)"));
    verifie("3590 s donnent 1 h 00, plus jamais 60 min",
      env.w.eval("fmtDurShort(3590)") === "1 " + t("unitHour") + " 00", env.w.eval("fmtDurShort(3590)"));
    verifie("89 s donnent 1 min", env.w.eval("fmtDurShort(89)") === "1 " + t("unitMin"), env.w.eval("fmtDurShort(89)"));
    verifie("la tuile de 7170 s donne 2 h", env.w.eval("fmtDurTile(7170)") === "2 " + t("unitHour"), env.w.eval("fmtDurTile(7170)"));

    // En-tete visio : l'hote exact ou un sous-domaine, jamais une sous-chaine,
    // exactement comme matchesMuted() dans background.js.
    const visio = async (url) => { env.w.chrome.tabs = { query: () => Promise.resolve([{ url: url }]) }; return env.w.eval("ongletEnVisio()"); };
    verifie("un sous-domaine de zoom.us est une visio", (await visio("https://us02web.zoom.us/j/1")) === true);
    verifie("zoom.us lui-meme est une visio", (await visio("https://zoom.us/")) === true);
    verifie("notzoom.us n'est pas une visio", (await visio("https://notzoom.us/x")) === false);
    verifie("zoom.us.evil.com n'est pas une visio", (await visio("https://zoom.us.evil.com/x")) === false);

    // Collage en lot : revenir de l'ecran de verification garde le texte.
    clic(env.$("tabPersoBtn")); await pause(30);
    clic(env.$("bulkOpen")); await pause(40);
    saisi(env.$("bulkText"), "Une phrase | Toi\nUne autre | Moi");
    clic(env.$("bulkCheck")); await pause(80);
    verifie("l'ecran de verification s'ouvre", !env.$("panelBulkOk").hidden);
    clic(env.$("bulkBackText")); await pause(40);
    verifie("revenir au texte garde le collage au lieu de le vider",
      env.$("bulkText").value.indexOf("Une autre") >= 0, JSON.stringify(env.$("bulkText").value));
    clic(env.$("bulkCancel")); await pause(30);
    clic(env.$("bulkOpen")); await pause(40);
    verifie("rouvrir le collage depuis l'onglet repart d'un texte vide", env.$("bulkText").value === "", JSON.stringify(env.$("bulkText").value));

    // Premiere installation : apres Commencer, l'onglet courant est visible.
    const neuf = DEFAUT(); delete neuf.firstRun;
    const env2 = monte(neuf, 12); await pause(80);
    clic(env2.$("frStart")); await pause(80);
    verifie("apres Commencer, l'onglet Reglages est visible, plus d'ecran vide sous l'en-tete",
      env2.$("panelSettings").hidden === false && env2.$("mainHead").hidden === false && env2.$("firstRun").hidden === true);

    // Puce de visio : Echap annule, et le blur qui suit ne valide rien. La
    // liste est un let de niveau script, invisible depuis eval : on la lit
    // dans la charge utile que save() envoie.
    const env3 = monte(DEFAUT(), 12); await pause(80);
    const listeSauvee = async () => {
      await env3.w.eval("save()");
      const m = env3.journal.messages.filter((x) => x.type === "kz-save").pop();
      return (m && m.payload && m.payload.mutedPatterns) || [];
    };
    const saisirPuce = async (texte, touche) => {
      // Le bouton Ajouter est le dernier des boutons d'action, le premier peut
      // etre le "+ n" qui deplie la liste.
      const actions = env3.$("muteChips").querySelectorAll(".chip--act");
      clic(actions[actions.length - 1]); await pause(30);
      const inp = env3.$("muteChips").querySelector(".chip-in");
      if (!inp) return false;
      inp.value = texte;
      inp.dispatchEvent(new env3.w.KeyboardEvent("keydown", { key: touche, bubbles: true }));
      inp.dispatchEvent(new env3.w.Event("blur"));
      await pause(30);
      return true;
    };
    verifie("le champ d'ajout de site apparait", await saisirPuce("ok.example", "Enter"));
    verifie("Entree valide bien un site", (await listeSauvee()).indexOf("ok.example") >= 0, JSON.stringify(await listeSauvee()));
    await saisirPuce("evil.example", "Escape");
    verifie("Echap annule l'ajout, le blur qui suit ne valide rien",
      (await listeSauvee()).indexOf("evil.example") === -1, JSON.stringify(await listeSauvee()));

  }

  const suites = [
    ["Dessins filtres", testSvgFiltre],
    ["En-tete et onglets", testOnglets],
    ["Premiere installation", testPremiereInstallation],
    ["Pause et rattrapage", testPause],
    ["Rythme des rappels", testRythme],
    ["Pause focus", testFocus],
    ["Sites en visio", testChips],
    ["Objectifs", testObjectifs],
    ["Citations et sous ecran", testCitations],
    ["Personnages et animations", testPersonnages],
    ["Statistiques", testStats],
    ["Theme sombre et temps en reunion", testThemeEtReunions],
    ["Stats equilibrees et justes", testStatsJustes],
    ["Onboarding", testOnboarding],
    ["La carte Agenda en trois blocs", testCarteAgenda],
    ["Prevenir les participants, cote popup", testPrevenirPopup],
    ["Donnees, export et import", testDonnees],
    ["L'agenda Infomaniak, carte Ne pas deranger", testAgenda],
    ["Corrections de la revue du 2026-09-16", testCorrectionsPopup],
    ["Enregistrement", testEnregistrement]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message + "\n      " + (e.stack || "").split("\n")[1]); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== popup.js : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
