// Tests exhaustifs de l'export et de l'import du popup.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];
function verifie(nom, cond, detail) {
  if (cond) ok++; else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

const HTML = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
const QUOTES = fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8");
const POPUP = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
const MSG = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales/fr/messages.json"), "utf8"));
const t = (k) => (MSG[k] || {}).message || "";

function jour(n) {
  // statsDaily utilise la date LOCALE, voir la note de test_background.js.
  const d = new Date(); d.setDate(d.getDate() + (n || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function etat(sur) {
  return Object.assign({
    intervalMinutes: 45, preset: "custom", muteInCalls: true,
    mutedPatterns: ["zoom.us", "meet.google.com"], pauseWhenIdle: true,
    focusMode: false, focusSeconds: 30, screenTimezone: "Europe/Zurich", animMode: "never",
    customKoalas: [PNG], includeDefaultKoalas: true,
    customQuotes: [{ t: "Ma citation", a: "Moi" }], customSport: ["Fais 3 pompes", "Bois de l'eau"],
    includeDefaultQuotes: true, hiddenQuotes: ["Une citation fournie a masquer"],
    habitGoal: 3, sportIndex: 0, importMode: "merge", pausedUntil: 0, pending: 2,
    statsDaily: {
      [jour(0)]: { due: 3, done: 2, rep: 1, eSum: 14, eCount: 2, repH: [1, 0, 0, 0] },
      [jour(-1)]: { due: 2, done: 2, rep: 0, eSum: 16, eCount: 2, repH: [0, 0, 0, 0] }
    },
    screenDaily: { [jour(0)]: 7200, [jour(-1)]: 5400 }
  }, sur || {});
}

function monte(store) {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://localhost/" });
  const w = dom.window;
  Object.defineProperty(w.navigator, "language", { value: "fr-CH", configurable: true });
  const donnees = JSON.parse(JSON.stringify(store));
  const journal = { messages: [], blobs: [], noms: [] };
  w.URL.createObjectURL = (b) => { journal.blobs.push(b); return "blob:x"; };
  w.URL.revokeObjectURL = () => {};
  w.scrollTo = () => {};
  const creer = w.document.createElement.bind(w.document);
  w.document.createElement = (tag) => {
    const n = creer(tag);
    if (String(tag).toLowerCase() === "a") {
      n.click = () => { journal.noms.push(n.getAttribute("download")); };
    }
    return n;
  };
  const api = {
    i18n: { getMessage: t, getUILanguage: () => "fr" },
    runtime: {
      getManifest: () => ({ version: "1.2.0" }),
      // L'arriere plan ecrit la charge utile de kz-save, le bouchon fait pareil.
      sendMessage: (m) => {
        journal.messages.push(m);
        if (m && m.type === "kz-save" && m.payload) Object.assign(donnees, JSON.parse(JSON.stringify(m.payload)));
        return Promise.resolve();
      }
    },
    storage: { local: {
      get: (cles) => { const o = {}; [].concat(cles).forEach((k) => { if (donnees[k] !== undefined) o[k] = JSON.parse(JSON.stringify(donnees[k])); }); return Promise.resolve(o); },
      set: (o) => { Object.assign(donnees, JSON.parse(JSON.stringify(o))); return Promise.resolve(); } } },
    alarms: { get: () => Promise.resolve({ scheduledTime: Date.now() + 720000 }) }
  };
  w.browser = api; w.chrome = api;
  const erreurs = [];
  w.addEventListener("error", (e) => erreurs.push(e.message));
  w.eval(QUOTES + "\n" + POPUP);
  return { w, donnees, journal, erreurs, $: (id) => w.document.getElementById(id) };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const clic = (n) => n && n.dispatchEvent(new n.ownerDocument.defaultView.Event("click", { bubbles: true }));
const txt = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "<absent>");

async function ouvreDonnees(env) {
  await pause(90);
  clic(env.$("tabDataBtn"));
  await pause(60);
}

async function exporte(env, parties) {
  if (parties) {
    for (const [nom, voulu] of Object.entries(parties)) {
      const b = env.w.document.querySelector('[data-part="' + nom + '"]');
      const actif = b.classList.contains("cbx--on");
      if (actif !== voulu) { clic(b); await pause(20); }
    }
  }
  const avant = env.journal.blobs.length;
  clic(env.$("exportBtn"));
  await pause(90);
  if (env.journal.blobs.length === avant) return null;
  return JSON.parse(await env.journal.blobs[env.journal.blobs.length - 1].text());
}

async function importe(env, objet, mode, brut) {
  if (mode) { clic(env.w.document.querySelector('[data-mode="' + mode + '"]')); await pause(30); }
  const contenu = brut !== undefined ? brut : JSON.stringify(objet);
  const input = env.$("importFile");
  Object.defineProperty(input, "files", {
    value: [{ name: "s.json", type: "application/json", text: () => Promise.resolve(contenu) }],
    configurable: true
  });
  input.dispatchEvent(new env.w.Event("change", { bubbles: true }));
  await pause(200);
}

/* ================= 1. Export, chaque combinaison de parties ================= */
async function testExportParties() {
  const env = monte(etat());
  await ouvreDonnees(env);

  let d = await exporte(env, { settings: true, content: true, stats: true, koalas: true });
  verifie("export complet, les quatre sections sont la",
    d && d.settings && d.content && d.stats && d.koalas, Object.keys(d || {}).join(","));
  verifie("export complet, les images importees sont incluses",
    d && Array.isArray(d.koalas.customKoalas) && d.koalas.customKoalas.length === 1);
  verifie("export complet, la case Garder les koalas d'origine suit",
    d && d.koalas.includeDefaultKoalas === true);

  d = await exporte(env, { settings: true, content: false, stats: false, koalas: false });
  verifie("reglages seuls, une seule section", d && !!d.settings && !d.content && !d.stats && !d.koalas,
    Object.keys(d || {}).join(","));
  // On verifie la LISTE et non un simple compte, pour attraper aussi bien un oubli
  // qu'un ajout involontaire. passageState, snarkIndex, statsRange, statsOffset et
  // firstRun ne doivent JAMAIS apparaitre ici.
  const REGLAGES_ATTENDUS = ["intervalMinutes", "preset", "customInterval", "passages",
    "passageFrequency", "muteInCalls", "mutedPatterns", "pauseWhenIdle", "focusMode", "focusSeconds",
    "screenTimezone", "animMode"];
  verifie("reglages seuls, les douze cles attendues y sont, ni plus ni moins",
    d && JSON.stringify(Object.keys(d.settings).sort()) === JSON.stringify(REGLAGES_ATTENDUS.slice().sort()),
    JSON.stringify(Object.keys(d.settings || {})));
  verifie("reglages seuls, aucune cle d'ordonnancement des passages n'est exportee",
    d && ["passageState", "snarkIndex", "statsRange", "statsOffset", "firstRun"]
      .every((k) => d.settings[k] === undefined));

  d = await exporte(env, { settings: false, content: true, stats: false, koalas: false });
  verifie("contenus seuls, une seule section", d && !d.settings && !!d.content);
  verifie("contenus seuls, les objectifs sont la", d && Array.isArray(d.content.customSport));
  verifie("contenus seuls, les citations masquees sont la",
    d && Array.isArray(d.content.hiddenQuotes) && d.content.hiddenQuotes.length === 1);
  verifie("contenus seuls, l'objectif quotidien est la", d && d.content.habitGoal === 3);

  d = await exporte(env, { settings: false, content: false, stats: true, koalas: false });
  verifie("statistiques seules, une seule section", d && !!d.stats && !d.content);
  verifie("statistiques seules, les deux jours sont la",
    d && Object.keys(d.stats.statsDaily).length === 2);
  verifie("statistiques seules, le temps d'ecran suit",
    d && Object.keys(d.stats.screenDaily).length === 2);
  verifie("statistiques seules, le retard suit", d && d.stats.pending === 2);
  verifie("les tranches horaires des reports survivent a l'export",
    d && Array.isArray(d.stats.statsDaily[jour(0)].repH), JSON.stringify(d && d.stats.statsDaily[jour(0)]));

  d = await exporte(env, { settings: false, content: false, stats: false, koalas: false });
  verifie("aucune partie cochee, le fichier ne contient que l'entete",
    d && !d.settings && !d.content && !d.stats && !d.koalas && d.app === "koala-zen",
    JSON.stringify(Object.keys(d || {})));

  verifie("le nom du fichier porte la date",
    env.journal.noms.length > 0 && /^koala-zen-\d{4}-\d{2}-\d{2}\.json$/.test(env.journal.noms[0]),
    JSON.stringify(env.journal.noms.slice(0, 1)));
  verifie("le type du fichier est json",
    env.journal.blobs[0].type === "application/json", env.journal.blobs[0].type);
}

/* ================= 2. L'export lit le stockage, pas l'ecran ================= */
async function testExportSource() {
  const env = monte(etat());
  await pause(90);
  clic(env.$("tabPersoBtn"));
  await pause(40);
  // On modifie l'ecran SANS enregistrer
  const champ = env.$("sportInput");
  champ.value = "Objectif jamais enregistre";
  clic(env.$("sportAdd"));
  await pause(30);
  clic(env.$("tabDataBtn"));
  await pause(60);
  const d = await exporte(env, { settings: false, content: true, stats: false, koalas: false });
  verifie("l'export ignore les modifications non enregistrees",
    d && d.content.customSport.indexOf("Objectif jamais enregistre") < 0,
    JSON.stringify(d && d.content.customSport));

  // Apres enregistrement, la modification part
  clic(env.$("tabPersoBtn"));
  await pause(40);
  clic(env.$("savePerso"));
  await pause(80);
  clic(env.$("tabDataBtn"));
  await pause(60);
  const d2 = await exporte(env);
  verifie("apres enregistrement, l'export contient la modification",
    d2 && d2.content.customSport.indexOf("Objectif jamais enregistre") >= 0,
    JSON.stringify(d2 && d2.content.customSport));
}

/* ================= 3. Aller retour complet ================= */
async function testAllerRetour() {
  const source = monte(etat());
  await ouvreDonnees(source);
  const fichier = await exporte(source, { settings: true, content: true, stats: true, koalas: true });

  const vide = monte(etat({
    intervalMinutes: 30, preset: "custom", customSport: [], customQuotes: [], hiddenQuotes: [],
    customKoalas: [], includeDefaultKoalas: false, habitGoal: 3, statsDaily: {}, screenDaily: {}, pending: 0,
    mutedPatterns: [], animMode: "auto", focusSeconds: 30, screenTimezone: "Europe/Zurich"
  }));
  await ouvreDonnees(vide);
  await importe(vide, fichier, "replace");

  verifie("aller retour, l'intervalle est restitue", vide.donnees.intervalMinutes === 45,
    "vaut " + vide.donnees.intervalMinutes);
  verifie("aller retour, les objectifs sont restitues",
    JSON.stringify(vide.donnees.customSport) === JSON.stringify(["Fais 3 pompes", "Bois de l'eau"]),
    JSON.stringify(vide.donnees.customSport));
  verifie("aller retour, les citations sont restituees",
    vide.donnees.customQuotes.length === 1 && vide.donnees.customQuotes[0].t === "Ma citation");
  verifie("aller retour, les citations masquees sont restituees",
    vide.donnees.hiddenQuotes.length === 1);
  verifie("aller retour, l'objectif quotidien est restitue", vide.donnees.habitGoal === 3);
  verifie("aller retour, les deux jours d'historique sont restitues",
    Object.keys(vide.donnees.statsDaily).length === 2, JSON.stringify(Object.keys(vide.donnees.statsDaily)));
  verifie("aller retour, le detail d'un jour est intact",
    vide.donnees.statsDaily[jour(0)].done === 2 && vide.donnees.statsDaily[jour(0)].rep === 1);
  verifie("aller retour, le temps d'ecran est restitue",
    vide.donnees.screenDaily[jour(0)] === 7200);
  verifie("aller retour, les images sont restituees", vide.donnees.customKoalas.length === 1);
  verifie("aller retour, les sites en visio sont restitues",
    vide.donnees.mutedPatterns.length === 2, JSON.stringify(vide.donnees.mutedPatterns));
  verifie("aller retour, le mode d'animation est restitue", vide.donnees.animMode === "never");
  verifie("l'import replanifie l'arriere plan",
    vide.journal.messages.some((m) => m.type === "kz-save"));
  verifie("l'import annonce sa reussite", txt(vide.$("dataMsg")) === t("importDone"), txt(vide.$("dataMsg")));
  verifie("aucune erreur pendant l'aller retour", vide.erreurs.length === 0, vide.erreurs.join(" | "));

  // L'ecran doit refleter les donnees restaurees
  clic(vide.$("tabPersoBtn"));
  await pause(60);
  verifie("apres import, l'ecran Perso est rafraichi",
    vide.$("sportList").querySelectorAll(".li").length === 2,
    "vaut " + vide.$("sportList").querySelectorAll(".li").length);
  verifie("apres import, l'objectif quotidien s'affiche", txt(vide.$("goalValue")) === "3");
  clic(vide.$("tabSettingsBtn"));
  await pause(40);
  verifie("apres import, le curseur de rythme suit", vide.$("interval").value === "45",
    vide.$("interval").value);
}

/* ================= 4. Fusion, cas par cas ================= */
async function testFusion() {
  const env = monte(etat());
  await ouvreDonnees(env);
  const entrant = {
    app: "koala-zen", format: 1, build: "1.2.0", exportedAt: new Date().toISOString(),
    settings: { intervalMinutes: 90, focusSeconds: 60 },
    content: {
      customSport: ["Fais 3 pompes", "Nouveau venu"],
      customQuotes: [{ t: "Ma citation", a: "Moi" }, { t: "Autre citation", a: "Lui" }],
      hiddenQuotes: ["Une citation fournie a masquer", "Une autre a masquer"],
      habitGoal: 9
    },
    stats: {
      statsDaily: { [jour(0)]: { due: 99, done: 99, rep: 99 }, [jour(-5)]: { due: 1, done: 1, rep: 0 } },
      screenDaily: { [jour(0)]: 99999, [jour(-5)]: 1234 },
      pending: 5
    }
  };
  await importe(env, entrant, "merge");

  verifie("fusion, les objectifs sont cumules sans doublon",
    JSON.stringify(env.donnees.customSport) === JSON.stringify(["Fais 3 pompes", "Bois de l'eau", "Nouveau venu"]),
    JSON.stringify(env.donnees.customSport));
  verifie("fusion, les citations sont cumulees sans doublon",
    env.donnees.customQuotes.length === 2, JSON.stringify(env.donnees.customQuotes.map((q) => q.t)));
  verifie("fusion, les citations masquees sont cumulees",
    env.donnees.hiddenQuotes.length === 2, JSON.stringify(env.donnees.hiddenQuotes));
  verifie("fusion, un jour deja present n'est PAS ecrase",
    env.donnees.statsDaily[jour(0)].done === 2, JSON.stringify(env.donnees.statsDaily[jour(0)]));
  verifie("fusion, un jour absent est ajoute",
    !!env.donnees.statsDaily[jour(-5)], JSON.stringify(Object.keys(env.donnees.statsDaily)));
  verifie("fusion, le temps d'ecran existant est garde",
    env.donnees.screenDaily[jour(0)] === 7200, "vaut " + env.donnees.screenDaily[jour(0)]);
  verifie("fusion, le temps d'ecran manquant est ajoute",
    env.donnees.screenDaily[jour(-5)] === 1234);
  verifie("fusion, le retard prend le plus grand", env.donnees.pending === 5,
    "vaut " + env.donnees.pending);
  verifie("fusion, un reglage simple est bien ecrase", env.donnees.intervalMinutes === 90);
  verifie("fusion, l'objectif quotidien est ecrase", env.donnees.habitGoal === 9,
    "vaut " + env.donnees.habitGoal);

  // Deuxieme import identique, rien ne doit bouger
  const empreinte = JSON.stringify([env.donnees.customSport, env.donnees.customQuotes,
                                    env.donnees.hiddenQuotes, Object.keys(env.donnees.statsDaily).sort()]);
  await importe(env, entrant, "merge");
  const apres = JSON.stringify([env.donnees.customSport, env.donnees.customQuotes,
                                env.donnees.hiddenQuotes, Object.keys(env.donnees.statsDaily).sort()]);
  verifie("un second import identique ne change rien", empreinte === apres);
}

/* ================= 5. Remplacement, cas par cas ================= */
async function testRemplacement() {
  const env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, {
    app: "koala-zen", format: 1,
    content: { customSport: ["Seul objectif"], customQuotes: [], hiddenQuotes: [], habitGoal: 1 },
    stats: { statsDaily: { [jour(-3)]: { due: 1, done: 1, rep: 0 } }, screenDaily: {}, pending: 0 }
  }, "replace");
  verifie("remplacement, les objectifs sont ecrases",
    JSON.stringify(env.donnees.customSport) === JSON.stringify(["Seul objectif"]),
    JSON.stringify(env.donnees.customSport));
  verifie("remplacement, les citations sont videes", env.donnees.customQuotes.length === 0);
  verifie("remplacement, les masquees sont videes", env.donnees.hiddenQuotes.length === 0);
  verifie("remplacement, l'historique est ecrase",
    Object.keys(env.donnees.statsDaily).length === 1 && !!env.donnees.statsDaily[jour(-3)],
    JSON.stringify(Object.keys(env.donnees.statsDaily)));
  verifie("remplacement, le temps d'ecran est vide",
    Object.keys(env.donnees.screenDaily).length === 0);
  verifie("remplacement, le retard est remis a zero", env.donnees.pending === 0);
  verifie("remplacement, une section ABSENTE du fichier est preservee",
    env.donnees.intervalMinutes === 45, "vaut " + env.donnees.intervalMinutes);
  verifie("remplacement, les images sont preservees si absentes du fichier",
    env.donnees.customKoalas.length === 1);
}

/* ================= 6. Fichiers abimes ou hostiles ================= */
async function testFichiersAbimes() {
  const cas = [
    ["du texte qui n'est pas du json", "ceci n'est pas du json", true],
    ["un json vide", "{}", true],
    ["un json qui n'est pas un objet", "[1,2,3]", true],
    ["une signature etrangere", JSON.stringify({ app: "autre", settings: { intervalMinutes: 5 } }), true],
    ["un fichier nul", "null", true]
  ];
  for (const [nom, brut, doitEchouer] of cas) {
    const env = monte(etat());
    await ouvreDonnees(env);
    clic(env.w.document.querySelector('[data-mode="replace"]'));
    await pause(40);
    const avant = JSON.stringify(env.donnees);
    await importe(env, null, null, brut);
    verifie(nom + " est refuse", JSON.stringify(env.donnees) === avant, "les donnees ont bouge");
    if (doitEchouer) {
      verifie(nom + " affiche un refus", txt(env.$("dataMsg")) === t("importBad"), txt(env.$("dataMsg")));
    }
    verifie(nom + " ne provoque aucune erreur JS", env.erreurs.length === 0, env.erreurs.join(" | "));
  }

  // Un fichier edite a la main, avec de mauvais types
  const env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, {
    app: "koala-zen", format: 1,
    settings: { intervalMinutes: "beaucoup", focusSeconds: -5, screenTimezone: 42, mutedPatterns: "zoom.us" },
    content: { customSport: "pas un tableau", customQuotes: { t: "pas un tableau" }, habitGoal: "trois", hiddenQuotes: 7 },
    stats: { statsDaily: "pas un objet", screenDaily: null, pending: "beaucoup" }
  }, "replace");
  verifie("un fichier aux mauvais types ne casse pas le panneau Donnees",
    env.erreurs.length === 0, env.erreurs.join(" | "));
  clic(env.$("tabPersoBtn"));
  await pause(80);
  verifie("apres un fichier aux mauvais types, l'onglet Perso reste utilisable",
    env.erreurs.length === 0, env.erreurs.join(" | "));
  verifie("un objectif mal type retombe sur une liste vide",
    env.$("sportList").querySelectorAll(".li").length === 0 && !env.$("sportEmpty").hidden,
    "vaut " + env.$("sportList").querySelectorAll(".li").length);
  verifie("une citation mal typee retombe sur une liste vide",
    env.$("quoteList").querySelectorAll(".q").length === 0);
  verifie("un objectif quotidien mal type retombe sur la valeur par defaut",
    txt(env.$("goalValue")) === "3", txt(env.$("goalValue")));
  verifie("la galerie reste affichable", !!env.$("gallery").querySelector(".gal-add"));
  clic(env.$("tabStatsBtn"));
  await pause(80);
  verifie("apres un fichier aux mauvais types, l'onglet Stats reste utilisable",
    env.erreurs.length === 0, env.erreurs.join(" | "));
  verifie("un historique mal type est vu comme vide, l'accueil s'affiche",
    !env.$("statsBlank").hidden, "le bloc d'accueil devrait etre visible");
  verifie("une duree de focus negative est ramenee dans les bornes",
    env.donnees.focusSeconds === -5, "la valeur brute reste en stockage, l'ecran doit la borner");
  clic(env.$("tabSettingsBtn"));
  await pause(60);
  verifie("apres un fichier aux mauvais types, le rythme reste dans les bornes",
    Number(env.$("interval").value) >= 1 && Number(env.$("interval").value) <= 240,
    env.$("interval").value);
  verifie("la duree de focus affichee reste dans les bornes",
    (function () { const v = parseInt(txt(env.$("focusValue")), 10); return v >= 5 && v <= 120; })(),
    txt(env.$("focusValue")));
  verifie("les sites en visio retombent sur la liste d'origine",
    env.$("muteChips").querySelectorAll(".chip").length > 1,
    "vaut " + env.$("muteChips").querySelectorAll(".chip").length);
  clic(env.$("save"));
  await pause(80);
  const m = env.journal.messages.filter((x) => x.type === "kz-save").pop();
  verifie("un enregistrement apres nettoyage renvoie des valeurs saines",
    m && typeof m.payload.intervalMinutes === "number" && m.payload.intervalMinutes >= 1 &&
    Array.isArray(m.payload.customSport) && Array.isArray(m.payload.mutedPatterns) &&
    typeof m.payload.habitGoal === "number",
    JSON.stringify(m && { i: m.payload.intervalMinutes, g: m.payload.habitGoal }));
}

/* ================= 7. Fichier d'une version future ================= */
async function testVersionFuture() {
  const env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, {
    app: "koala-zen", format: 99, build: "9.9.9",
    content: { customSport: ["Venu du futur"] }
  }, "replace");
  verifie("un fichier d'un format inconnu est traite sans casser",
    env.erreurs.length === 0, env.erreurs.join(" | "));
  verifie("un fichier d'un format inconnu applique ce qu'il peut",
    env.donnees.customSport.indexOf("Venu du futur") >= 0, JSON.stringify(env.donnees.customSport));
}

/* ================= 8. Le mode d'import est memorise ================= */
async function testModeMemorise() {
  const env = monte(etat());
  await ouvreDonnees(env);
  clic(env.w.document.querySelector('[data-mode="replace"]'));
  await pause(40);
  verifie("le mode choisi est enregistre", env.donnees.importMode === "replace",
    "vaut " + env.donnees.importMode);
  const env2 = monte(etat({ importMode: "replace" }));
  await ouvreDonnees(env2);
  verifie("le mode enregistre est repris a l'ouverture",
    env2.w.document.querySelector("#importSeg .seg-b--on").getAttribute("data-mode") === "replace");
}

/* ================= 9. Un export vide se reimporte sans degat ================= */
async function testExportVideReimporte() {
  const env = monte(etat());
  await ouvreDonnees(env);
  const d = await exporte(env, { settings: false, content: false, stats: false, koalas: false });
  clic(env.w.document.querySelector('[data-mode="replace"]'));
  await pause(40);
  const avant = JSON.stringify(env.donnees);
  await importe(env, d, null);
  verifie("reimporter un fichier sans section ne touche a rien",
    JSON.stringify(env.donnees) === avant, "les donnees ont bouge");
  verifie("reimporter un fichier sans section annonce quand meme la reussite",
    txt(env.$("dataMsg")) === t("importDone"), txt(env.$("dataMsg")));
}

/* ================= 10. Poids affiche et jauge ================= */
async function testPoids() {
  const gros = [];
  for (let i = 0; i < 8; i++) gros.push("data:image/png;base64," + "A".repeat(4000));
  const env = monte(etat({ customKoalas: gros }));
  await ouvreDonnees(env);
  verifie("le poids des images est en Ko", /Ko|Mo/.test(txt(env.$("szKoalas"))), txt(env.$("szKoalas")));
  const total = txt(env.$("szTotal"));
  verifie("le total est affiche", /o|Ko|Mo/.test(total), total);
  const l = (id) => parseFloat(env.$(id).style.width) || 0;
  verifie("la jauge se repartit sur trois segments",
    l("dlKoalas") > 0 && l("dlStats") > 0 && l("dlContent") > 0,
    [l("dlKoalas"), l("dlStats"), l("dlContent")].join(" / "));
  verifie("la jauge totalise cent pour cent",
    Math.abs(l("dlKoalas") + l("dlStats") + l("dlContent") - 100) < 1.5,
    (l("dlKoalas") + l("dlStats") + l("dlContent")).toFixed(1));
  verifie("les images dominent la jauge quand elles sont lourdes",
    l("dlKoalas") > 80, l("dlKoalas") + "%");
}

/* ---------- execution ---------- */
/* ================= 11. L'import plafonne les images ================= */
async function testPlafondImport() {
  // L'import copiait customKoalas sans plafonner. Un fichier trop garni faisait
  // entrer toutes les images, la tuile d'ajout disparaissait et le stockage
  // gonflait sans recours.
  const trop = Array.from({ length: 40 }, (_, i) => "data:image/png;base64,AAAA" + i);
  let env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, { app: "koala-zen", format: 1, koalas: { customKoalas: trop, includeDefaultKoalas: false } }, "replace");
  let k = env.donnees.customKoalas;
  verifie("l'import plafonne les images a dix-huit",
    Array.isArray(k) && k.length === 18, k && k.length);
  verifie("l'import garde les premieres images du fichier", k && k[0] === trop[0]);

  // Des entrees qui ne sont pas des chaines ne doivent pas entrer.
  env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, { app: "koala-zen", format: 1, koalas: { customKoalas: ["data:image/png;base64,AAAA", null, 42, {}, "", "data:image/png;base64,BBBB"] } }, "replace");
  k = env.donnees.customKoalas;
  verifie("l'import ne garde que des chaines non vides", k && k.length === 2, k && JSON.stringify(k));

  // Une valeur qui n'est pas un tableau ne casse rien.
  env = monte(etat());
  await ouvreDonnees(env);
  await importe(env, { app: "koala-zen", format: 1, koalas: { customKoalas: "pas un tableau" } }, "replace");
  k = env.donnees.customKoalas;
  verifie("une valeur non tabulaire devient une liste vide",
    Array.isArray(k) && k.length === 0, JSON.stringify(k));
}

(async () => {
  const suites = [
    ["Export, combinaisons de parties", testExportParties],
    ["Export, source des donnees", testExportSource],
    ["Aller retour complet", testAllerRetour],
    ["Import en fusion", testFusion],
    ["Import en remplacement", testRemplacement],
    ["Fichiers abimes ou hostiles", testFichiersAbimes],
    ["Fichier d'une version future", testVersionFuture],
    ["Memorisation du mode", testModeMemorise],
    ["Export vide reimporte", testExportVideReimporte],
    ["Poids et jauge", testPoids],
    ["L'import plafonne les images", testPlafondImport]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== sauvegarde et restauration : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
