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

  // Rattrapage
  verifie("le bandeau de rattrapage est visible avec du retard", !env.$("catchupCard").hidden);
  verifie("le bandeau annonce le nombre",
    txt(env.$("catchupTitle")) === t("catchupTitlePlural").replace("{n}", "2"), txt(env.$("catchupTitle")));
  clic(env.$("catchupBtn"));
  await pause(60);
  verifie("rattraper propose un objectif", txt(env.$("catchupPrompt")).length > 3, txt(env.$("catchupPrompt")));
  clic(env.$("catchupDone"));
  await pause(40);
  verifie("valider un rattrapage demande l'energie",
    env.$("catchupEnergy").querySelectorAll(".nrj-b").length === 10);
  clic(env.$("catchupEnergy").querySelectorAll(".nrj-b")[6]);
  await pause(60);
  m = env.journal.messages.find((x) => x.type === "kz-catchup");
  verifie("le rattrapage est transmis", !!m, JSON.stringify(env.journal.messages.slice(-2)));
  verifie("l'energie du rattrapage est transmise", m && m.energy === 7, JSON.stringify(m));

  const env2 = monte(Object.assign(DEFAUT(), { pending: 0 }), 12);
  await pause(80);
  verifie("sans retard, aucun bandeau", env2.$("catchupCard").hidden);
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
  verifie("l'energie est notee sur dix",
    txt(env.$("statEnergyUnit")) === t("outOfTen"), txt(env.$("statEnergyUnit")));
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
    ["statDoneSub", "statRepSub", "statEnergySub", "statScreenSub", "statBestSub", "statRecordSub"]
      .every((id) => txt(env.$(id)) !== "\u2014" && txt(env.$(id)) !== "-"),
    ["statDoneSub", "statRepSub", "statEnergySub", "statScreenSub", "statBestSub", "statRecordSub"]
      .map((id) => txt(env.$(id))).join(" | "));
  verifie("le bloc benefice montre trois tranches",
    env.$("benefitRows").children.length === 3, "vaut " + env.$("benefitRows").children.length);

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
  verifie("sans donnees, le benefice est masque", env2.$("benefitCard").hidden);
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
  verifie("avec peu de donnees, le benefice reste prudent",
    !env3.$("benefitNote").hidden, "le garde-fou du benefice devrait etre visible");
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
async function testKdrive() {
  // Sans jeton configure, l'ecran de saisie est montre, jamais l'ecran connecte.
  const env = monte(DEFAUT(), 12);
  repondKdrive(env, { "kz-kdrive-status": { configured: false } });
  clic(env.$("tabDataBtn"));
  await pause(80);
  verifie("sans jeton, l'ecran de connexion est visible", !env.$("kdriveSetup").hidden);
  verifie("sans jeton, l'ecran connecte est cache", env.$("kdriveConnected").hidden);

  // Le jeton est masque par defaut, "Afficher" bascule le champ en clair.
  verifie("le champ du jeton est masque par defaut", env.$("kdriveTokenInput").type === "password");
  clic(env.$("kdriveTokenShow"));
  await pause(20);
  verifie("Afficher bascule le champ en texte clair", env.$("kdriveTokenInput").type === "text");
  verifie("le bouton propose alors de le masquer a nouveau", txt(env.$("kdriveTokenShow")) === t("kdriveHideTok"));

  // Connexion refusee, jeton invalide : le message d'erreur precis s'affiche,
  // et l'ecran de connexion reste visible.
  const envRefus = monte(DEFAUT(), 12);
  repondKdrive(envRefus, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: false };
    if (m.type === "kz-kdrive-set-token") return { ok: false, error: "invalid_token" };
    return undefined;
  });
  clic(envRefus.$("tabDataBtn"));
  await pause(80);
  saisi(envRefus.$("kdriveTokenInput"), "mauvais-jeton");
  clic(envRefus.$("kdriveConnect"));
  await pause(100);
  verifie("un jeton invalide affiche le message d'erreur precis",
    txt(envRefus.$("kdriveSetupMsg")) === t("kdriveErrInvalid"), txt(envRefus.$("kdriveSetupMsg")));
  verifie("apres un refus, l'ecran de connexion reste affiche", !envRefus.$("kdriveSetup").hidden);
  verifie("apres un refus, le champ jeton n'est PAS vide, l'utilisateur n'a pas a le retaper",
    envRefus.$("kdriveTokenInput").value === "mauvais-jeton");

  // Connexion reussie : le formulaire disparait, l'ecran connecte apparait.
  const envOk = monte(DEFAUT(), 12);
  let statutConfigure = false;
  repondKdrive(envOk, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: statutConfigure, lastSync: statutConfigure ? 1722556800000 : 0 };
    if (m.type === "kz-kdrive-set-token") { statutConfigure = true; return { ok: true }; }
    return undefined;
  });
  clic(envOk.$("tabDataBtn"));
  await pause(80);
  saisi(envOk.$("kdriveTokenInput"), "un-vrai-jeton");
  clic(envOk.$("kdriveConnect"));
  await pause(100);
  verifie("une connexion reussie affiche l'ecran connecte", !envOk.$("kdriveConnected").hidden);
  verifie("une connexion reussie cache l'ecran de saisie", envOk.$("kdriveSetup").hidden);
  verifie("le champ jeton est vide apres une connexion reussie, jamais garde en memoire visible",
    envOk.$("kdriveTokenInput").value === "");
  verifie("la derniere synchronisation est annoncee avec sa date",
    txt(envOk.$("kdriveLastSync")).indexOf(t("kdriveLastSyncAt").split("{")[0]) === 0, txt(envOk.$("kdriveLastSync")));
  verifie("le jeton envoye au fond est bien celui saisi, sans espaces superflus",
    envOk.journal.messages.some((m) => m.type === "kz-kdrive-set-token" && m.token === "un-vrai-jeton"));

  // Sauvegarder maintenant transmet exactement le meme paquet que l'export local.
  clic(envOk.$("kdriveBackupNow"));
  await pause(100);
  const msgBackup = envOk.journal.messages.filter((m) => m.type === "kz-kdrive-backup").pop();
  verifie("la sauvegarde transmet un paquet signe koala-zen",
    msgBackup && msgBackup.bundle && msgBackup.bundle.app === "koala-zen", JSON.stringify(msgBackup));
  verifie("la sauvegarde transmet les reglages, comme l'export local",
    msgBackup && msgBackup.bundle.settings && msgBackup.bundle.settings.intervalMinutes === 45);

  // Restaurer : ouvre la liste, applique EXACTEMENT la meme logique d'import
  // que le fichier local (module deja teste par testDonnees).
  const envRestore = monte(DEFAUT(), 12);
  const paquetDistant = {
    app: "koala-zen", format: 1, build: "1.2.0", exportedAt: new Date().toISOString(),
    settings: { intervalMinutes: 90, preset: "ultradian" }
  };
  repondKdrive(envRestore, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, lastSync: 0 };
    if (m.type === "kz-kdrive-restore-list") {
      return { ok: true, files: [{ id: 42, name: "koala-zen-2026-08-02.json", date: 1722556800000 }] };
    }
    if (m.type === "kz-kdrive-restore-file" && m.fileId === 42) return { ok: true, data: paquetDistant };
    return undefined;
  });
  clic(envRestore.$("tabDataBtn"));
  await pause(80);
  clic(envRestore.$("kdriveRestoreOpen"));
  await pause(100);
  verifie("la liste des sauvegardes distantes s'affiche", !envRestore.$("kdriveRestoreList").hidden);
  verifie("le nom du fichier distant est affiche",
    txt(envRestore.$("kdriveFiles")).indexOf("koala-zen-2026-08-02.json") > -1, txt(envRestore.$("kdriveFiles")));
  // Un second clic sur Restaurer, sans rouvrir, referme la liste.
  clic(envRestore.$("kdriveRestoreOpen"));
  await pause(30);
  verifie("un second clic sur Restaurer referme la liste sans rappeler le fond",
    envRestore.$("kdriveRestoreList").hidden === true &&
    envRestore.journal.messages.filter((m) => m.type === "kz-kdrive-restore-list").length === 1);
  clic(envRestore.$("kdriveRestoreOpen"));
  await pause(100);
  const boutonRestaurer = envRestore.w.document.querySelector("#kdriveFiles .bq-act");
  verifie("un bouton Restaurer existe pour la sauvegarde listee", !!boutonRestaurer);
  clic(boutonRestaurer);
  await pause(150);
  verifie("restaurer depuis kDrive applique bien les reglages du paquet distant",
    envRestore.donnees.intervalMinutes === 90, "vaut " + envRestore.donnees.intervalMinutes);
  verifie("apres restauration, la liste se referme", envRestore.$("kdriveRestoreList").hidden);

  // Aucune sauvegarde distante : message clair, pas de liste vide silencieuse.
  const envAucune = monte(DEFAUT(), 12);
  repondKdrive(envAucune, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, lastSync: 0 };
    if (m.type === "kz-kdrive-restore-list") return { ok: true, files: [] };
    return undefined;
  });
  clic(envAucune.$("tabDataBtn"));
  await pause(80);
  clic(envAucune.$("kdriveRestoreOpen"));
  await pause(100);
  verifie("l'absence de sauvegarde distante est annoncee, pas une liste vide muette",
    txt(envAucune.$("kdriveFiles")) === t("kdriveNoBackup"), txt(envAucune.$("kdriveFiles")));

  // Une panne reseau au moment de sauvegarder affiche l'erreur correspondante.
  const envPanne = monte(DEFAUT(), 12);
  repondKdrive(envPanne, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, lastSync: 0 };
    if (m.type === "kz-kdrive-backup") return { ok: false, error: "offline" };
    return undefined;
  });
  clic(envPanne.$("tabDataBtn"));
  await pause(80);
  clic(envPanne.$("kdriveBackupNow"));
  await pause(100);
  verifie("une panne reseau a la sauvegarde affiche le message hors ligne",
    txt(envPanne.$("kdriveMsg")) === t("kdriveErrOffline"), txt(envPanne.$("kdriveMsg")));

  // Deconnexion, deux clics, comme toutes les actions destructrices du panneau.
  const envDeco = monte(DEFAUT(), 12);
  let configureDeco = true;
  repondKdrive(envDeco, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: configureDeco, lastSync: 0 };
    if (m.type === "kz-kdrive-clear") { configureDeco = false; return { ok: true }; }
    return undefined;
  });
  clic(envDeco.$("tabDataBtn"));
  await pause(80);
  clic(envDeco.$("kdriveDisconnect"));
  await pause(30);
  verifie("un seul clic sur deconnecter demande confirmation",
    txt(envDeco.$("kdriveDisconnect")) === t("eraseConfirm"), txt(envDeco.$("kdriveDisconnect")));
  verifie("un seul clic ne deconnecte rien encore",
    !envDeco.journal.messages.some((m) => m.type === "kz-kdrive-clear"));
  clic(envDeco.$("kdriveDisconnect"));
  await pause(100);
  verifie("le second clic deconnecte kDrive", envDeco.journal.messages.some((m) => m.type === "kz-kdrive-clear"));
  verifie("apres deconnexion, l'ecran de saisie revient", !envDeco.$("kdriveSetup").hidden);
}

/* ================= 10c. Le choix du kDrive de destination ================= */
async function testKdriveChoixDrive() {
  const deuxDrives = [
    { driveId: 1, name: "Perso", freeBytes: 6 * 1024 * 1024 * 1024 },
    { driveId: 2, name: "Pro", freeBytes: 1024 * 1024 }
  ];

  // Connexion qui revele plusieurs drives : le picker s'affiche, jamais
  // l'ecran connecte tant que rien n'est choisi.
  const env = monte(DEFAUT(), 12);
  repondKdrive(env, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: false };
    if (m.type === "kz-kdrive-set-token") return { ok: true, needsChoice: true, drives: deuxDrives };
    return undefined;
  });
  clic(env.$("tabDataBtn"));
  await pause(80);
  saisi(env.$("kdriveTokenInput"), "jeton-a-deux-drives");
  clic(env.$("kdriveConnect"));
  await pause(100);
  verifie("plusieurs drives, le picker s'affiche", !env.$("kdrivePicker").hidden);
  verifie("plusieurs drives, l'ecran de saisie se cache", env.$("kdriveSetup").hidden);
  verifie("plusieurs drives, l'ecran connecte reste cache", env.$("kdriveConnected").hidden);
  verifie("les deux drives sont bien listes par leur nom",
    txt(env.$("kdrivePickList")).indexOf("Perso") > -1 && txt(env.$("kdrivePickList")).indexOf("Pro") > -1,
    txt(env.$("kdrivePickList")));
  verifie("l'espace libre de chaque drive est affiche, pas seulement son nom",
    txt(env.$("kdrivePickList")).indexOf(t("unitMb", "Mo")) > -1, txt(env.$("kdrivePickList")));

  // Choisir "Pro" : le message part avec le bon id, le statut redevient
  // configure avec le nom du drive choisi.
  let choisi = null;
  env.w.chrome.runtime.sendMessage = (m) => {
    env.journal.messages.push(JSON.parse(JSON.stringify(m)));
    if (m.type === "kz-kdrive-choose-drive") { choisi = m; return Promise.resolve({ ok: true }); }
    if (m.type === "kz-kdrive-status") return Promise.resolve({ configured: true, needsChoice: false, driveName: "Pro", lastSync: 0 });
    return Promise.resolve(undefined);
  };
  const boutons = env.w.document.querySelectorAll("#kdrivePickList .bq-act");
  verifie("un bouton Choisir existe par drive liste", boutons.length === 2, String(boutons.length));
  clic(boutons[1]);
  await pause(100);
  verifie("choisir Pro envoie bien son driveId, jamais celui de Perso",
    choisi && choisi.driveId === 2 && choisi.driveName === "Pro", JSON.stringify(choisi));
  verifie("apres le choix, l'ecran connecte s'affiche et le picker se cache",
    !env.$("kdriveConnected").hidden && env.$("kdrivePicker").hidden);
  verifie("l'ecran connecte affiche le nom du drive choisi",
    txt(env.$("kdriveConnectedLabel")) === t("kdriveConnectedTo").replace("{n}", "Pro"),
    txt(env.$("kdriveConnectedLabel")));

  // Popup rouvert en plein milieu du choix (statut needsChoice direct, sans
  // repasser par Se connecter) : le picker doit s'afficher tout seul.
  const envReprise = monte(DEFAUT(), 12);
  repondKdrive(envReprise, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, needsChoice: true, driveName: "" };
    if (m.type === "kz-kdrive-list-drives") return { ok: true, drives: deuxDrives };
    return undefined;
  });
  clic(envReprise.$("tabDataBtn"));
  await pause(100);
  verifie("un statut needsChoice a l'ouverture affiche le picker sans passer par Se connecter",
    !envReprise.$("kdrivePicker").hidden && envReprise.$("kdriveConnected").hidden && envReprise.$("kdriveSetup").hidden);

  // Changer de kDrive, un seul disponible : message clair, jamais un picker
  // a une seule ligne inutile.
  const envUnSeul = monte(DEFAUT(), 12);
  repondKdrive(envUnSeul, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, needsChoice: false, driveName: "Perso", lastSync: 0 };
    if (m.type === "kz-kdrive-list-drives") return { ok: true, drives: [deuxDrives[0]] };
    return undefined;
  });
  clic(envUnSeul.$("tabDataBtn"));
  await pause(80);
  clic(envUnSeul.$("kdriveChangeDrive"));
  await pause(100);
  verifie("un seul drive disponible, le message le dit, jamais un picker",
    txt(envUnSeul.$("kdriveMsg")) === t("kdriveOnlyOneDrive"), txt(envUnSeul.$("kdriveMsg")));
  verifie("l'ecran connecte reste affiche, aucun picker ouvert pour rien",
    !envUnSeul.$("kdriveConnected").hidden && envUnSeul.$("kdrivePicker").hidden);

  // Changer de kDrive, plusieurs disponibles : le picker s'ouvre par dessus
  // l'ecran connecte.
  const envChanger = monte(DEFAUT(), 12);
  repondKdrive(envChanger, (m) => {
    if (m.type === "kz-kdrive-status") return { configured: true, needsChoice: false, driveName: "Perso", lastSync: 0 };
    if (m.type === "kz-kdrive-list-drives") return { ok: true, drives: deuxDrives };
    return undefined;
  });
  clic(envChanger.$("tabDataBtn"));
  await pause(80);
  clic(envChanger.$("kdriveChangeDrive"));
  await pause(100);
  verifie("plusieurs drives disponibles, le picker s'ouvre",
    !envChanger.$("kdrivePicker").hidden && envChanger.$("kdriveConnected").hidden);
}

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

/* ---------- execution ---------- */
(async () => {
  const suites = [
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
    ["Donnees, export et import", testDonnees],
    ["La carte kDrive", testKdrive],
    ["Le choix du kDrive de destination", testKdriveChoixDrive],
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
