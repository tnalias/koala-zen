// Module G, le modele de periode et les six phrases d'analyse, planche 14.
// popup.js est charge TEL QUEL. Les fonctions testees sont PURES, l'instant de
// reference est toujours passe en argument, donc aucun test ne depend de l'heure.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];
function verifie(nom, cond, detail) {
  if (cond) ok++;
  else { ko++; echecs.push(nom + (detail !== undefined ? "  ->  " + JSON.stringify(detail) : "")); }
}

function charge(stats, screen) {
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const store = { statsDaily: stats || {}, screenDaily: screen || {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.chrome = {
    i18n: { getMessage: () => "" },
    runtime: { getManifest: () => ({ version: "2.0.0" }), sendMessage() {}, lastError: null,
      onMessage: { addListener() {} } },
    storage: { local: {
      get: (k, cb) => { const o = {}; (Array.isArray(k) ? k : Object.keys(k || {})).forEach((x) => { if (x in store) o[x] = store[x]; }); cb ? cb(o) : null; return Promise.resolve(o); },
      set: (o, cb) => { Object.assign(store, o); cb ? cb() : null; return Promise.resolve(); }
    } },
    alarms: { get: (n, cb) => { cb ? cb(null) : null; return Promise.resolve(null); } },
    tabs: { query: (q, cb) => { cb ? cb([]) : null; return Promise.resolve([]); } }
  };
  w.eval(fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(RACINE, "popup.js"), "utf8"));
  return w;
}
// popup.js charge le stockage de facon asynchrone. Sans cette attente, STATS est
// encore vide et tout ce qui depend de l'historique repond a cote.
const pause = (ms) => new Promise((r) => setTimeout(r, ms || 60));

// Un jeu de donnees deterministe, ancre sur une date fixe.
const REF = "2026-07-29";        // un mercredi
function jours(n, faites) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 6, 29 - i);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    out[k] = { due: 3, done: faites, rep: 1, eSum: 7, eCount: 1, repH: [0, 0, 0, 0] };
  }
  return out;
}
const W = charge(jours(60, 2), {});
const NOW = new Date(2026, 6, 29);

/* ============ 1. Le modele de periode ============ */
async function testPeriodes() {
  await pause();
  const src = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  verifie("les cinq positions de la planche",
    /STATS_RANGES = \["day", "week", "month", "year", "all"\]/.test(src));

  const j0 = W.rangeFor("day", 0, NOW);
  verifie("jour, decalage 0, c'est aujourd'hui", W.keyOf(j0[0]) === REF && W.keyOf(j0[1]) === REF, W.keyOf(j0[0]));
  const j1 = W.rangeFor("day", -1, NOW);
  verifie("jour, decalage moins 1, c'est la veille", W.keyOf(j1[0]) === "2026-07-28", W.keyOf(j1[0]));

  const s0 = W.rangeFor("week", 0, NOW);
  verifie("semaine, elle commence un lundi", s0[0].getDay() === 1, s0[0].getDay());
  verifie("semaine, sept jours", W.keyOf(s0[0]) === "2026-07-27" && W.keyOf(s0[1]) === "2026-08-02",
    W.keyOf(s0[0]) + " a " + W.keyOf(s0[1]));
  const s1 = W.rangeFor("week", -1, NOW);
  verifie("semaine, decalage moins 1, sept jours avant",
    W.keyOf(s1[0]) === "2026-07-20" && W.keyOf(s1[1]) === "2026-07-26", W.keyOf(s1[0]));

  const m0 = W.rangeFor("month", 0, NOW);
  verifie("mois, du premier au dernier jour",
    W.keyOf(m0[0]) === "2026-07-01" && W.keyOf(m0[1]) === "2026-07-31", W.keyOf(m0[1]));
  const m1 = W.rangeFor("month", -1, NOW);
  verifie("mois, decalage moins 1, juin entier",
    W.keyOf(m1[0]) === "2026-06-01" && W.keyOf(m1[1]) === "2026-06-30", W.keyOf(m1[1]));
  const m6 = W.rangeFor("month", -7, NOW);
  verifie("mois, decalage moins 7, on change d'annee",
    W.keyOf(m6[0]) === "2025-12-01" && W.keyOf(m6[1]) === "2025-12-31", W.keyOf(m6[0]));
  const mf = W.rangeFor("month", -5, NOW);
  verifie("mois, fevrier 2026 a bien 28 jours", W.keyOf(mf[1]) === "2026-02-28", W.keyOf(mf[1]));

  const a0 = W.rangeFor("year", 0, NOW);
  verifie("annee, du 1er janvier au 31 decembre",
    W.keyOf(a0[0]) === "2026-01-01" && W.keyOf(a0[1]) === "2026-12-31", W.keyOf(a0[1]));
  const a1 = W.rangeFor("year", -1, NOW);
  verifie("annee, decalage moins 1", W.keyOf(a1[0]) === "2025-01-01", W.keyOf(a1[0]));

  const t = W.rangeFor("all", 0, NOW);
  verifie("tout, part du premier jour connu", W.keyOf(t[0]) === "2026-05-31", W.keyOf(t[0]));
  verifie("tout, finit aujourd'hui", W.keyOf(t[1]) === REF, W.keyOf(t[1]));
  verifie("tout ignore le decalage",
    W.keyOf(W.rangeFor("all", -5, NOW)[0]) === W.keyOf(t[0]));

  // Un decalage positif n'existe pas, la periode en cours est la limite.
  verifie("un decalage positif est ramene a zero",
    W.keyOf(W.rangeFor("day", 3, NOW)[0]) === REF, W.keyOf(W.rangeFor("day", 3, NOW)[0]));
}

/* ============ 2. Les fleches de navigation ============ */
async function testFleches() {
  await pause();
  verifie("la fleche avant est grisee sur la periode en cours", W.canGoForward("week", 0) === false);
  verifie("la fleche avant s'active des qu'on est dans le passe", W.canGoForward("week", -1) === true);
  verifie("Tout ne navigue jamais vers l'avant", W.canGoForward("all", -3) === false);
  verifie("Tout ne navigue jamais vers l'arriere", W.canGoBack("all", 0, NOW) === false);
  verifie("on peut remonter tant qu'il y a de l'historique", W.canGoBack("week", 0, NOW) === true);
  verifie("on ne remonte pas avant le premier jour connu",
    W.canGoBack("year", -1, NOW) === false, W.canGoBack("year", -1, NOW));
  const vide = charge({}, {});
  await pause();
  verifie("sans aucun historique, on ne remonte pas", vide.canGoBack("week", 0, NOW) === false);

  const p = W.prevRangeFor("week", 0, NOW);
  verifie("la periode precedente a la meme duree et le meme jour de depart",
    W.keyOf(p[0]) === "2026-07-20" && p[0].getDay() === 1, W.keyOf(p[0]));
  verifie("Tout n'a pas de periode precedente", W.prevRangeFor("all", 0, NOW) === null);
}

/* ============ 3. Phrase 1, l'ecart de periode ============ */
function testEcart() {
  verifie("sans periode precedente, aucune phrase", W.phraseEcart(10, null, "week") === "");
  verifie("sous 5 pour cent d'ecart, on ecrit stable et pas un chiffre",
    /stable|steady|stabil/i.test(W.phraseEcart(100, 98, "week")), W.phraseEcart(100, 98, "week"));
  verifie("un ecart franc en hausse est chiffre",
    /4/.test(W.phraseEcart(18, 14, "week")), W.phraseEcart(18, 14, "week"));
  verifie("un ecart franc en baisse est chiffre sans jugement",
    /4/.test(W.phraseEcart(14, 18, "week")), W.phraseEcart(14, 18, "week"));
  verifie("une baisse ne porte aucun reproche",
    !/decroch|abandon|rate|echec|faible/i.test(W.phraseEcart(2, 20, "week")), W.phraseEcart(2, 20, "week"));
  verifie("la phrase nomme la periode de comparaison",
    W.phraseEcart(18, 14, "month") !== W.phraseEcart(18, 14, "week"),
    [W.phraseEcart(18, 14, "month"), W.phraseEcart(18, 14, "week")]);
  verifie("depuis zero, une hausse reste chiffree",
    /3/.test(W.phraseEcart(3, 0, "week")), W.phraseEcart(3, 0, "week"));
}

/* ============ 4. Phrase 2, le creneau des reports ============ */
function testCreneau() {
  verifie("moins de 5 reports, aucune phrase", W.phraseCreneau([1, 1, 1, 1]) === "");
  verifie("exactement 5 reports repartis, aucun creneau dominant",
    W.phraseCreneau([2, 1, 1, 1]) === "", W.phraseCreneau([2, 1, 1, 1]));
  verifie("un creneau a plus de 40 pour cent est nomme",
    W.phraseCreneau([6, 1, 1, 1]) !== "", W.phraseCreneau([6, 1, 1, 1]));
  verifie("pile 40 pour cent ne suffit pas",
    W.phraseCreneau([4, 2, 2, 2]) === "", W.phraseCreneau([4, 2, 2, 2]));
  verifie("le matin est nomme", /matin|morning|morgens/i.test(W.phraseCreneau([9, 1, 1, 1])));
  verifie("le debut d'apres-midi est nomme",
    /début|early|frühen/i.test(W.phraseCreneau([1, 9, 1, 1])), W.phraseCreneau([1, 9, 1, 1]));
  verifie("la fin d'apres-midi est nommee",
    /fin|late|späten/i.test(W.phraseCreneau([1, 1, 9, 1])), W.phraseCreneau([1, 1, 9, 1]));
  verifie("le soir est nomme", /soir|evening|abends/i.test(W.phraseCreneau([1, 1, 1, 9])));
  verifie("un tableau absent ne casse rien", W.phraseCreneau(null) === "");
  verifie("un tableau vide ne casse rien", W.phraseCreneau([]) === "");
}


/* ============ 6. Phrases 4, 5, 6 et la cadence ============ */
function testAutresPhrases() {
  verifie("sans temps d'ecran, aucune phrase", W.phraseEcran(0, 7) === "");
  verifie("sans jour, aucune phrase", W.phraseEcran(3600, 0) === "");
  verifie("la moyenne par jour est calculee",
    /5/.test(W.phraseEcran(5 * 3600 * 7, 7)), W.phraseEcran(5 * 3600 * 7, 7));

  verifie("sans bornes, aucune phrase de serie", W.phraseSerie(null) === "");
  verifie("une serie d'un seul jour n'a pas de bornes a citer",
    W.phraseSerie({ debut: new Date(2026, 6, 20), fin: new Date(2026, 6, 20) }) === "");
  verifie("une serie de plusieurs jours cite ses bornes",
    W.phraseSerie({ debut: new Date(2026, 6, 20), fin: new Date(2026, 6, 25) }) !== "");

  verifie("sans record, aucune phrase", W.phraseRecord(null) === "");
  verifie("le record cite son mois",
    W.phraseRecord(new Date(2026, 2, 14)) !== "", W.phraseRecord(new Date(2026, 2, 14)));

  verifie("sans habitude faite, aucune cadence", W.phraseCadence(7200, 0) === "");
  verifie("la cadence dit ce qu'elle mesure : une habitude pour tant d'ecran",
    W.phraseCadence(2 * 3600, 1) === W.msg("phPace", "").replace("{d}", "2 h 00") || /Une habitude toutes les 2 h 00|One habit every 2 h 00|Eine Gewohnheit alle 2 h 00/.test(W.phraseCadence(2 * 3600, 1)), W.phraseCadence(2 * 3600, 1));
}

/* ============ 7. Les bornes de serie ============ */
async function testSerieBornes() {
  const st = {};
  const mk = (d, done) => { st["2026-07-" + String(d).padStart(2, "0")] = { due: 3, done: done, rep: 0, eSum: 0, eCount: 0, repH: [0, 0, 0, 0] }; };
  [1, 2, 3].forEach((d) => mk(d, 1));   // serie de 3
  mk(4, 0);
  [6, 7, 8, 9, 10].forEach((d) => mk(d, 2)); // serie de 5, la meilleure
  const w = charge(st, {});
  await pause();
  const b = w.serieBornes(new Date(2026, 6, 1), new Date(2026, 6, 31));
  verifie("la plus longue serie est retenue", b && b.n === 5, b && b.n);
  verifie("la borne de debut est la bonne", b && w.keyOf(b.debut) === "2026-07-06", b && w.keyOf(b.debut));
  verifie("la borne de fin est la bonne", b && w.keyOf(b.fin) === "2026-07-10", b && w.keyOf(b.fin));
  verifie("un jour sans habitude coupe la serie", b && b.n !== 8);
  const vide = charge({}, {});
  await pause();
  verifie("sans historique, aucune serie",
    vide.serieBornes(new Date(2026, 6, 1), new Date(2026, 6, 31)) === null);
}

/* ============ 8. Les tranches horaires de la planche 14 ============ */
function testTranches() {
  const src = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  verifie("le matin va jusqu'a 12 h", /if \(h < 12\) return 0;/.test(src));
  verifie("le debut d'apres-midi jusqu'a 15 h", /if \(h < 15\) return 1;/.test(src));
  verifie("la fin d'apres-midi jusqu'a 18 h", /if \(h < 18\) return 2;/.test(src));
  verifie("les anciennes tranches a 5 et 11 h ont disparu",
    src.indexOf("h >= 5 && h < 11") === -1);
  verifie("repH reste sur quatre entiers, aucune migration",
    /repH: \[0, 0, 0, 0\]/.test(fs.readFileSync(path.join(RACINE, "popup.js"), "utf8")));
}

/* ============ 9. Aucun reproche, aucune causalite ============ */
function testTon() {
  const src = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  // Le ton se juge sur les textes VUS par l'utilisateur, donc sur les locales,
  // et pas sur les commentaires du code qui parlent justement de cette regle.
  const fr = fs.readFileSync(path.join(RACINE, "_locales/fr/messages.json"), "utf8");
  const phrases = Object.entries(JSON.parse(fr))
    .filter(([k]) => k.indexOf("ph") === 0)
    .map(([, v]) => v.message).join(" ");
  verifie("aucune phrase d'analyse ne parle de cause",
    !/\bcause\b|\bcausalit|\bparce que\b|\bgrâce à\b/i.test(phrases), phrases);
  verifie("aucune phrase d'analyse ne porte de reproche",
    !/décroch|abandon|échec|mauvais|faible|tu devrais|il faut/i.test(phrases), phrases);
  verifie("les phrases d'analyse existent bien dans les locales",
    phrases.length > 100, phrases.length);
  verifie("les seuils de la planche sont nommes et pas caches dans le code",
    /PHRASE_MIN_REPORTS = 5/.test(src) && /PHRASE_SEUIL_STABLE = 0\.05/.test(src));
  verifie("une phrase absente rend une chaine vide et jamais un tiret",
    W.phraseCreneau([1, 1]) === "" && W.phraseEcran(0, 0) === "" && W.phraseRecord(null) === "");
}

/* ============ 7. Le jour le plus charge, 2026-09-26 ============ */
function testJourCharge() {
  // Quatre semaines a partir du lundi 6 juillet 2026 ; le jeudi vaut 3 h, les autres 1 h.
  const sem = (n, fv) => { const out = []; for (let i = 0; i < n * 7; i++) { const d = new Date(2026, 6, 6 + i); out.push({ date: d, v: fv(d) }); } return out; };
  const jeudiFort = sem(4, (d) => (d.getDay() === 4 ? 10800 : 3600));
  const r = W.jourLePlusCharge(jeudiFort);
  verifie("un jour qui domine est designe", !!r && !r.even && r.wd === 4 && r.avg === 10800, JSON.stringify(r));
  verifie("moins de trois semaines, aucune conclusion", W.jourLePlusCharge(sem(2, (d) => (d.getDay() === 4 ? 10800 : 3600))) === null);
  verifie("moins de 21 jours, aucune conclusion", W.jourLePlusCharge(jeudiFort.slice(0, 20)) === null);
  const egal = sem(4, (d) => (d.getDay() === 4 ? 3900 : 3600));
  verifie("un ecart de moins de 15 %, repartition reguliere", JSON.stringify(W.jourLePlusCharge(egal)) === '{"even":true}');
  verifie("une periode vide ne designe personne", W.jourLePlusCharge(sem(4, () => 0)) === null);
  // Moyenne, pas total : cinq jeudis faibles contre quatre mardis forts.
  const cinq = []; for (let i = 0; i < 35; i++) { const d = new Date(2026, 6, 1 + i); cinq.push({ date: d, v: d.getDay() === 2 ? 7200 : (d.getDay() === 4 ? 5000 : 1000) }); }
  const rc = W.jourLePlusCharge(cinq);
  verifie("c'est la moyenne qui compte, jamais le total", !!rc && rc.wd === 2, JSON.stringify(rc));
  // Des jours sans donnee sont simplement absents : ils ne tirent rien.
  const trous = sem(5, (d) => (d.getDay() === 4 ? 10800 : 3600)).filter((j) => j.date.getDay() !== 0 && j.date.getDay() !== 6);
  verifie("un week-end sans releve ne fausse pas le resultat", !!W.jourLePlusCharge(trous) && W.jourLePlusCharge(trous).wd === 4);
  const p = W.phraseJourCharge(r, "meet");
  verifie("la phrase des reunions nomme le jour et la duree moyenne", p && p.j && /jeudi|thursday|donnerstag/i.test(p.j) && p.n === "3 h 00" && p.t.indexOf("{j}") >= 0 && p.t.indexOf("{n}") >= 0, JSON.stringify(p));
  const pm = W.phraseJourCharge({ wd: 1, date: new Date(2026, 6, 6), avg: 51.6 }, "mail");
  verifie("la phrase des mails arrondit au mail pres", pm && pm.n === "52" && /lundi|monday|montag/i.test(pm.j), JSON.stringify(pm));
  verifie("une repartition reguliere a sa propre phrase, sans jour", W.phraseJourCharge({ even: true }, "meet").t.indexOf("{j}") < 0 && W.phraseJourCharge({ even: true }, "mail").t.indexOf("{j}") < 0);
  verifie("rien a dire, aucune phrase", W.phraseJourCharge(null, "meet") === null);
  const LOC = JSON.parse(fs.readFileSync(path.join(RACINE, "_locales", "fr", "messages.json"), "utf8"));
  const phrases = ["busyMeet", "busyMeetEven", "busyMail", "busyMailEven"].map((k) => (LOC[k] || {}).message || "").join(" ");
  verifie("aucun jugement dans les phrases du jour charge", phrases.length > 40 && !/trop|mauvais|attention|il faut|too much|should/i.test(phrases), phrases);
}

(async () => {
  const suites = [
    ["Le jour le plus charge", testJourCharge],
    ["Le modele de periode", testPeriodes],
    ["Les fleches de navigation", testFleches],
    ["Phrase 1, l'ecart de periode", testEcart],
    ["Phrase 2, le creneau des reports", testCreneau],
    ["Phrases 4, 5, 6 et la cadence", testAutresPhrases],
    ["Les bornes de serie", testSerieBornes],
    ["Les tranches horaires", testTranches],
    ["Le ton, aucun reproche", testTon]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== phrases d'analyse : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
