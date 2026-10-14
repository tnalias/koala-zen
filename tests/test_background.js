// Tests fonctionnels de background.js, execute dans un contexte vm avec des API simulees.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { fakeIndexedDB, coffreTest } = require("./fake_idb");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];

function verifie(nom, condition, detail) {
  if (condition) { ok++; }
  else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

/* ---------- bac a sable ---------- */
function charge(etatInitial, etatInactivite) {
  etatInactivite = etatInactivite || "active";
  // 2026-10-06 : `brut` est storage.local tel que le voit un script de page ;
  // `store` y ajoute le coffre IndexedDB du fond (VAULT_KEYS).
  const idb = fakeIndexedDB();
  const brut = {};
  const store = coffreTest(brut, idb, RACINE);
  Object.assign(store, etatInitial || {});
  const journal = { alarmes: {}, messages: [], injections: 0, badge: [] };
  const ecouteurs = {};

  const api = {
    runtime: {
      onInstalled: { addListener: (f) => { ecouteurs.installed = f; } },
      onStartup: { addListener: (f) => { ecouteurs.startup = f; } },
      onMessage: { addListener: (f) => { ecouteurs.message = f; } },
      getURL: (p) => "chrome-extension://kz/" + p,
      getManifest: () => ({ version: "1.2.0" }),
      lastError: null
    },
    alarms: {
      create: (nom, opts) => { journal.alarmes[nom] = opts; },
      clear: async (nom) => { delete journal.alarmes[nom]; return true; },
      get: async (nom) => (journal.alarmes[nom] ? { name: nom, scheduledTime: Date.now() + 60000 } : null),
      onAlarm: { addListener: (f) => { ecouteurs.alarme = f; } }
    },
    storage: {
      local: {
        get: async (cles) => {
          if (cles == null) return JSON.parse(JSON.stringify(store));
          const out = {};
          [].concat(cles).forEach((k) => { if (brut[k] !== undefined) out[k] = brut[k]; });
          return out;
        },
        set: async (o) => { Object.assign(brut, JSON.parse(JSON.stringify(o))); },
        clear: async () => { Object.keys(store).forEach((k) => delete brut[k]); }
      }
    },
    // Firefox rend une promesse, Chrome passe par un rappel. On sert les deux.
    idle: {
      queryState: (s, cb) => {
        if (typeof cb === "function") { cb(etatInactivite); return undefined; }
        return Promise.resolve(etatInactivite);
      }
    },
    tabs: {
      query: async () => [{ id: 7, url: "https://example.com/page", active: true }],
      sendMessage: async (id, msg) => { journal.messages.push(msg); }
    },
    scripting: { executeScript: async () => { journal.injections++; } },
    action: {
      setBadgeText: (o) => { journal.badge.push({ text: (o && o.text) || "" }); },
      setBadgeBackgroundColor: (o) => { journal.badge.push({ color: o && o.color }); }
    }
  };

  const contexte = { indexedDB: idb, globalThis: null, browser: (etatInitial && etatInitial.__chromeSeul) ? undefined : api, chrome: api, console, URL, Date, Math, JSON, setTimeout, clearTimeout, Intl };
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(path.join(RACINE, "background.js"), "utf8"), contexte);
  return { contexte, store, brut, journal, ecouteurs };
}

const attends = () => new Promise((r) => setTimeout(r, 30));

async function envoie(env, msg) {
  return new Promise((resolve) => {
    const retour = env.ecouteurs.message(msg, { url: "chrome-extension://kz/popup.html" }, resolve);
    if (retour !== true) resolve(undefined);
    setTimeout(() => resolve(undefined), 120);
  });
}


// ATTENTION, le produit a DEUX notions de jour, et les donnees d'exemple doivent
// suivre la meme que la cle qu'elles alimentent.
//   statsDaily  utilise dayKey(), la date LOCALE de la machine.
//   screenDaily utilise tzDayKey(screenTimezone), le fuseau regle par l'utilisateur.
// Melanger les deux fait echouer des suites des que le fuseau local et le fuseau
// regle ne sont pas sur la meme date, par exemple entre 22h et minuit UTC en ete.
function jour(n) {
  const d = new Date();
  d.setDate(d.getDate() + (n || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function jourEcran(n, tz) {
  const d = new Date(Date.now() + (n || 0) * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/Zurich" }).format(d);
}
/* ================= 1. Tranches horaires des reports ================= */
async function testTranches() {
  const env = charge({});
  const f = env.contexte.hourSlot;
  // Tranches de la planche 14, matin avant 12 h, debut d'apres-midi jusqu'a
  // 15 h, fin d'apres-midi jusqu'a 18 h, soiree apres 18 h.
  verifie("tranche 07h = matin", f(new Date(2026, 0, 1, 7)) === 0);
  verifie("tranche 13h = debut d'apres-midi", f(new Date(2026, 0, 1, 13)) === 1);
  verifie("tranche 16h = fin d'apres-midi", f(new Date(2026, 0, 1, 16)) === 2);
  verifie("tranche 21h = soir", f(new Date(2026, 0, 1, 21)) === 3);
  // Le petit matin compte comme le matin, il n'y a plus de trou avant 5 h.
  verifie("tranche 03h = matin", f(new Date(2026, 0, 1, 3)) === 0);
  verifie("borne, 11h59 est encore le matin", f(new Date(2026, 0, 1, 11, 59)) === 0);
  verifie("borne, 12h bascule sur debut d'apres-midi", f(new Date(2026, 0, 1, 12)) === 1);
  verifie("borne, 15h bascule sur fin d'apres-midi", f(new Date(2026, 0, 1, 15)) === 2);
  verifie("borne, 18h bascule sur soir", f(new Date(2026, 0, 1, 18)) === 3);
}

/* ================= 2. Serie en cours ================= */
async function testSerie() {
  const env = charge({});
  const f = env.contexte.streakFrom;
  verifie("serie vide = 0", f({}) === 0);
  verifie("serie d'un jour aujourd'hui", f({ [jour(0)]: { done: 1 } }) === 1);
  verifie("serie de trois jours", f({ [jour(0)]: { done: 2 }, [jour(-1)]: { done: 1 }, [jour(-2)]: { done: 3 } }) === 3);
  verifie("rien aujourd'hui mais hier, la serie tient",
    f({ [jour(-1)]: { done: 1 }, [jour(-2)]: { done: 1 } }) === 2);
  verifie("un trou casse la serie",
    f({ [jour(0)]: { done: 1 }, [jour(-2)]: { done: 5 } }) === 1);
  verifie("un jour a zero ne compte pas",
    f({ [jour(0)]: { done: 0 }, [jour(-1)]: { done: 0 } }) === 0);
}

/* ================= 3. Enregistrement des issues ================= */
// Decision du 2026-09-16 : un report est un report. Il compte dans rep et dans
// sa tranche horaire, et c'est tout. Plus de compteur a rattraper, plus de
// badge, plus de retour anticipe apres Plus tard, plus de relance.
async function testIssues() {
  const env = charge({ intervalMinutes: 30, statsDaily: {} });
  const k = jour(0);

  await envoie(env, { type: "kz-outcome", result: "done" });
  await attends();
  let d = env.store.statsDaily[k];
  verifie("fait, une occasion due", d && d.due === 1, JSON.stringify(d));
  verifie("fait, une reussie", d && d.done === 1);
  // 2026-09-25 : plus aucune energie notee, l'issue seule compte.
  verifie("fait, aucune energie n'est ecrite", d && d.eSum === undefined && d.eCount === undefined, JSON.stringify(d));
  verifie("fait, aucun compteur a rattraper n'existe plus", env.store.pending === undefined);
  verifie("fait, aucun badge n'est pose", env.journal.badge.length === 0);

  await envoie(env, { type: "kz-outcome", result: "later" });
  await attends();
  d = env.store.statsDaily[k];
  verifie("plus tard, deux occasions dues", d && d.due === 2);
  verifie("plus tard, un report", d && d.rep === 1);
  verifie("plus tard, aucun compteur a rattraper", env.store.pending === undefined);
  verifie("plus tard, l'alarme du rappel n'est PAS avancee a 15 minutes",
    !env.journal.alarmes["kz-move"] || !env.journal.alarmes["kz-move"].delayInMinutes || env.journal.alarmes["kz-move"].delayInMinutes !== 15,
    JSON.stringify(env.journal.alarmes["kz-move"]));
  verifie("plus tard, tranche horaire comptee",
    d && Array.isArray(d.repH) && d.repH.reduce((a, b) => a + b, 0) === 1, JSON.stringify(d && d.repH));

  await envoie(env, { type: "kz-outcome", result: "missed" });
  await attends();
  d = env.store.statsDaily[k];
  verifie("manque, un report de plus", d && d.rep === 2);
  verifie("manque, la tranche horaire compte aussi",
    d && d.repH.reduce((a, b) => a + b, 0) === 2, JSON.stringify(d && d.repH));
  verifie("manque, aucun badge", env.journal.badge.length === 0);

  // L'ancien message de rattrapage n'existe plus : il ne fait rien et ne casse rien.
  await envoie(env, { type: "kz-catchup" });
  await attends();
  d = env.store.statsDaily[k];
  verifie("kz-catchup n'a plus aucun effet sur les statistiques", d && d.done === 1 && d.rep === 2);

  // Dix rappels manques : les stats les comptent tous, sans plafond ni compteur.
  const env2 = charge({ statsDaily: {} });
  for (let i = 0; i < 10; i++) { await envoie(env2, { type: "kz-outcome", result: "missed" }); await attends(); }
  verifie("dix reports comptent dix fois dans les statistiques", env2.store.statsDaily[k].rep === 10, JSON.stringify(env2.store.statsDaily[k]));
  verifie("et aucun compteur a rattraper n'apparait", env2.store.pending === undefined);

  // Une installation qui gardait un badge d'avant : l'installation le vide.
  const env3 = charge({ statsDaily: {}, pending: 3 });
  await env3.ecouteurs.installed({ reason: "update" });
  await attends();
  verifie("a la mise a jour, le badge d'avant est efface",
    env3.journal.badge.some((b) => b.text === ""), JSON.stringify(env3.journal.badge));

  // kz-passage-now etait le seul message a ne jamais repondre.
  const r = await envoie(env3, { type: "kz-passage-now" });
  verifie("kz-passage-now repond comme les autres messages", !!r && typeof r.ok === "boolean", JSON.stringify(r));
}

/* ================= 4. Pause, reprise, planification ================= */
async function testPause() {
  const env = charge({ intervalMinutes: 45 });
  await envoie(env, { type: "kz-save", payload: { intervalMinutes: 45 } });
  await attends();
  verifie("l'alarme principale est posee", !!env.journal.alarmes["kz-move"]);
  verifie("l'intervalle enregistre est respecte",
    env.journal.alarmes["kz-move"] && env.journal.alarmes["kz-move"].delayInMinutes === 45,
    JSON.stringify(env.journal.alarmes["kz-move"]));

  const jusqua = Date.now() + 3600000;
  await envoie(env, { type: "kz-pause", until: jusqua });
  await attends();
  verifie("la pause est memorisee", env.store.pausedUntil === jusqua);
  verifie("la pause replanifie apres son terme",
    env.journal.alarmes["kz-move"] && env.journal.alarmes["kz-move"].delayInMinutes >= 59,
    JSON.stringify(env.journal.alarmes["kz-move"]));

  await envoie(env, { type: "kz-resume" });
  await attends();
  verifie("la reprise efface la pause", !env.store.pausedUntil);
  verifie("la reprise replanifie sur l'intervalle",
    env.journal.alarmes["kz-move"] && env.journal.alarmes["kz-move"].delayInMinutes === 45);

  // Un intervalle hors bornes doit etre ramene dans les limites
  const env2 = charge({});
  await envoie(env2, { type: "kz-save", payload: { intervalMinutes: 9999 } });
  await attends();
  verifie("un intervalle trop grand est ramene a 240",
    env2.journal.alarmes["kz-move"].delayInMinutes === 240,
    JSON.stringify(env2.journal.alarmes["kz-move"]));
  const env3 = charge({});
  await envoie(env3, { type: "kz-save", payload: { intervalMinutes: 0 } });
  await attends();
  verifie("un intervalle nul est ramene a 1",
    env3.journal.alarmes["kz-move"].delayInMinutes === 1,
    JSON.stringify(env3.journal.alarmes["kz-move"]));

  // Changer la frequence des animaux de passage doit replanifier LEUR alarme
  // tout de suite, jamais attendre le prochain reveil deja pose avec l'ancien
  // reglage, sinon l'utilisateur ne verrait l'effet de son choix qu'au hasard.
  const env4 = charge({ passageFrequency: "normal" });
  await envoie(env4, { type: "kz-save", payload: { passageFrequency: "normal" } });
  await attends();
  verifie("le creneau normal reste entre 120 et 300 minutes",
    env4.journal.alarmes["kz-passage"] &&
    env4.journal.alarmes["kz-passage"].delayInMinutes >= 120 &&
    env4.journal.alarmes["kz-passage"].delayInMinutes <= 300,
    JSON.stringify(env4.journal.alarmes["kz-passage"]));

  const env5 = charge({ passageFrequency: "normal" });
  await envoie(env5, { type: "kz-save", payload: { passageFrequency: "frequent" } });
  await attends();
  verifie("passer en frequent replanifie tout de suite entre 60 et 150 minutes",
    env5.journal.alarmes["kz-passage"] &&
    env5.journal.alarmes["kz-passage"].delayInMinutes >= 60 &&
    env5.journal.alarmes["kz-passage"].delayInMinutes <= 150,
    JSON.stringify(env5.journal.alarmes["kz-passage"]));

  const env6 = charge({ passageFrequency: "normal" });
  await envoie(env6, { type: "kz-save", payload: { passageFrequency: "rare" } });
  await attends();
  verifie("passer en rare replanifie tout de suite entre 180 et 450 minutes",
    env6.journal.alarmes["kz-passage"] &&
    env6.journal.alarmes["kz-passage"].delayInMinutes >= 180 &&
    env6.journal.alarmes["kz-passage"].delayInMinutes <= 450,
    JSON.stringify(env6.journal.alarmes["kz-passage"]));
}

/* ================= 5. Effacements ================= */
async function testEffacements() {
  const base = {
    intervalMinutes: 52, preset: "deepwork", customSport: ["a", "b"], habitGoal: 5,
    statsDaily: { [jour(0)]: { due: 3, done: 2, rep: 1 } }, screenDaily: { [jour(0)]: 7200 },
    pending: 3, customQuotes: [{ t: "x", a: "y" }], hiddenQuotes: ["z"], customKoalas: ["data:,"]
  };

  const env = charge(JSON.parse(JSON.stringify(base)));
  await envoie(env, { type: "kz-reset" });
  await attends();
  verifie("effacer l'historique vide les statistiques",
    Object.keys(env.store.statsDaily || {}).length === 0);
  verifie("effacer l'historique vide le temps d'ecran",
    Object.keys(env.store.screenDaily || {}).length === 0);
  verifie("effacer l'historique GARDE les reglages", env.store.intervalMinutes === 52);
  verifie("effacer l'historique GARDE les objectifs",
    Array.isArray(env.store.customSport) && env.store.customSport.length === 2);
  verifie("effacer l'historique GARDE les citations",
    Array.isArray(env.store.customQuotes) && env.store.customQuotes.length === 1);

  const env2 = charge(JSON.parse(JSON.stringify(base)));
  await envoie(env2, { type: "kz-reset-all" });
  await attends();
  verifie("tout effacer remet l'intervalle par defaut", env2.store.intervalMinutes === 30,
    "vaut " + env2.store.intervalMinutes);
  verifie("tout effacer vide les objectifs",
    Array.isArray(env2.store.customSport) && env2.store.customSport.length === 0);
  verifie("tout effacer vide les citations",
    Array.isArray(env2.store.customQuotes) && env2.store.customQuotes.length === 0);
  verifie("tout effacer vide les images importees",
    Array.isArray(env2.store.customKoalas) && env2.store.customKoalas.length === 0);
  verifie("tout effacer remet l'objectif quotidien a 3", env2.store.habitGoal === 3);
  verifie("tout effacer vide l'historique",
    Object.keys(env2.store.statsDaily || {}).length === 0);
  verifie("tout effacer replanifie une alarme", !!env2.journal.alarmes["kz-move"]);
}

/* ================= 6. Sites en sourdine ================= */
async function testSourdine() {
  const env = charge({});
  const f = env.contexte.matchesMuted;
  const liste = ["kmeet.infomaniak.com", "zoom.us", "meet.google.com"];
  verifie("domaine exact reconnu", f("https://zoom.us/j/123", liste) === true);
  verifie("sous-domaine reconnu", f("https://us02web.zoom.us/j/123", liste) === true);
  verifie("kmeet reconnu", f("https://kmeet.infomaniak.com/abc", liste) === true);
  verifie("site quelconque non filtre", f("https://news.ycombinator.com", liste) === false);
  verifie("un domaine qui finit pareil n'est pas filtre",
    f("https://notzoom.us/x", liste) === false, "notzoom.us ne doit pas matcher zoom.us");
  verifie("liste vide ne filtre rien", f("https://zoom.us", []) === false);
}

/* ================= 7. Temps d'ecran ================= */
async function testEcran() {
  const env = charge({ screenTimezone: "Europe/Zurich", screenDaily: {}, screenLastTick: Date.now() - 60000 });
  await env.contexte.accrueScreen();
  const k = env.contexte.tzDayKey("Europe/Zurich");
  verifie("une minute active est comptee",
    env.store.screenDaily[k] >= 55 && env.store.screenDaily[k] <= 65,
    JSON.stringify(env.store.screenDaily));

  // Un trou de plusieurs heures ne doit pas etre compte comme du temps actif
  // Chemin Chrome, ou queryState passe par un rappel
  const envC = charge({ __chromeSeul: true, screenTimezone: "Europe/Zurich", screenDaily: {}, screenLastTick: Date.now() - 60000 });
  await envC.contexte.accrueScreen();
  const kC = envC.contexte.tzDayKey("Europe/Zurich");
  verifie("le chemin Chrome par rappel compte aussi",
    (envC.store.screenDaily[kC] || 0) >= 55, JSON.stringify(envC.store.screenDaily));

  // Utilisateur inactif, rien ne doit etre compte
  const envI = charge({ screenTimezone: "Europe/Zurich", screenDaily: {}, screenLastTick: Date.now() - 60000 }, "idle");
  await envI.contexte.accrueScreen();
  verifie("rien n'est compte quand l'utilisateur est inactif",
    Object.keys(envI.store.screenDaily || {}).length === 0, JSON.stringify(envI.store.screenDaily));

  const env2 = charge({ screenTimezone: "Europe/Zurich", screenDaily: {}, screenLastTick: Date.now() - 6 * 3600000 });
  await env2.contexte.accrueScreen();
  const k2 = env2.contexte.tzDayKey("Europe/Zurich");
  const v = env2.store.screenDaily[k2] || 0;
  verifie("une veille longue est plafonnee", v <= 130, "compte " + v + " secondes");
}

/* ================= 8. Charge utile envoyee au rappel ================= */
async function testChargeUtile() {
  const k = jour(0);
  const kEcran = jourEcran(0);   // screenDaily suit le fuseau regle, pas le local
  const env = charge({
    intervalMinutes: 45, habitGoal: 4, focusMode: true, focusSeconds: 45,
    statsDaily: { [k]: { due: 5, done: 2, rep: 3, repH: [3, 0, 0, 0] }, [jour(-1)]: { done: 1 } },
    screenDaily: { [kEcran]: 9000 }, muteInCalls: false, pauseWhenIdle: false
  });
  await env.contexte.trigger({ force: true });
  await attends();
  const m = env.journal.messages[env.journal.messages.length - 1];
  verifie("un message kz-show est envoye", m && m.type === "kz-show", JSON.stringify(m));
  verifie("le mode focus est transmis", m && m.focus === true);
  verifie("la duree de focus est transmise", m && m.focusSeconds === 45);
  verifie("l'intervalle est transmis", m && m.intervalMinutes === 45);
  verifie("aucun report de 15 minutes n'est plus transmis", m && m.snoozeMinutes === undefined);
  verifie("les habitudes faites du jour sont transmises", m && m.doneToday === 2, JSON.stringify(m));
  verifie("les reports du jour ne sont plus transmis, la page n'en a plus l'usage", m && m.repToday === undefined);
  verifie("l'objectif quotidien est transmis", m && m.habitGoal === 4);
  verifie("la serie est transmise", m && m.streak === 2, "vaut " + (m && m.streak));
  verifie("le temps d'ecran du jour est transmis", m && m.screenToday >= 8900);
}

/* ================= 9. Ne pas deranger ================= */
async function testNePasDeranger() {
  // En visio, aucun rappel
  const env = charge({ muteInCalls: true, mutedPatterns: ["example.com"], pauseWhenIdle: false, statsDaily: {} });
  await env.contexte.trigger({});
  await attends();
  verifie("aucun rappel sur un site en sourdine", env.journal.messages.length === 0,
    JSON.stringify(env.journal.messages));

  // Le declenchement manuel passe outre
  const env2 = charge({ muteInCalls: true, mutedPatterns: ["example.com"], pauseWhenIdle: false, statsDaily: {} });
  await env2.contexte.trigger({ force: true });
  await attends();
  verifie("le declenchement manuel ignore la sourdine", env2.journal.messages.length === 1);

  // En pause, aucun rappel
  const env3 = charge({ pausedUntil: Date.now() + 600000, statsDaily: {}, muteInCalls: false });
  await env3.contexte.trigger({});
  await attends();
  verifie("aucun rappel pendant une pause", env3.journal.messages.length === 0);

  // Inactif depuis IDLE_SECONDS (60 s), pauseWhenIdle actif : aucun rappel.
  const env4 = charge({ pauseWhenIdle: true, statsDaily: {}, muteInCalls: false }, "idle");
  await env4.contexte.trigger({});
  await attends();
  verifie("aucun rappel apres 60 s d'inactivite quand pauseWhenIdle est actif",
    env4.journal.messages.length === 0, JSON.stringify(env4.journal.messages));

  // Meme inactivite, mais pauseWhenIdle desactive par l'utilisateur : le rappel part.
  const env5 = charge({ pauseWhenIdle: false, statsDaily: {}, muteInCalls: false }, "idle");
  await env5.contexte.trigger({});
  await attends();
  verifie("l'inactivite ne bloque rien si pauseWhenIdle est desactive",
    env5.journal.messages.length === 1, JSON.stringify(env5.journal.messages));

  // Le declenchement manuel passe outre l'inactivite, comme la sourdine.
  const env6 = charge({ pauseWhenIdle: true, statsDaily: {}, muteInCalls: false }, "idle");
  await env6.contexte.trigger({ force: true });
  await attends();
  verifie("le declenchement manuel ignore l'inactivite", env6.journal.messages.length === 1);

  // Actif, pauseWhenIdle n'a aucun effet.
  const env7 = charge({ pauseWhenIdle: true, statsDaily: {}, muteInCalls: false }, "active");
  await env7.contexte.trigger({});
  await attends();
  verifie("un utilisateur actif recoit son rappel meme avec pauseWhenIdle actif",
    env7.journal.messages.length === 1);
}

/* ================= 10. Stockage abime ================= */
async function testStockageAbime() {
  const abime = {
    statsDaily: "pas un objet", screenDaily: 42, pending: "beaucoup",
    intervalMinutes: "trente", habitGoal: null, mutedPatterns: "zoom.us",
    customSport: 7, screenTimezone: 999
  };
  const env = charge(JSON.parse(JSON.stringify(abime)));
  await envoie(env, { type: "kz-outcome", result: "done" });
  await attends();
  verifie("un historique abime est reconstruit",
    env.store.statsDaily && typeof env.store.statsDaily === "object" &&
    env.store.statsDaily[jour(0)] && env.store.statsDaily[jour(0)].done === 1,
    JSON.stringify(env.store.statsDaily).slice(0, 90));

  const env2 = charge(JSON.parse(JSON.stringify(abime)));
  await env2.contexte.trigger({ force: true });
  await attends();
  const m = env2.journal.messages[env2.journal.messages.length - 1];
  verifie("le rappel part malgre un stockage abime", m && m.type === "kz-show", JSON.stringify(m));
  verifie("l'intervalle transmis reste un nombre valide",
    m && typeof m.intervalMinutes === "number" && m.intervalMinutes >= 1 && m.intervalMinutes <= 240,
    JSON.stringify(m && m.intervalMinutes));
  verifie("l'objectif quotidien transmis reste un nombre",
    m && typeof m.habitGoal === "number" && m.habitGoal >= 0, JSON.stringify(m && m.habitGoal));
  verifie("la serie transmise reste un nombre", m && typeof m.streak === "number");
  verifie("le compteur du jour transmis reste un nombre",
    m && typeof m.doneToday === "number");

  const env3 = charge(JSON.parse(JSON.stringify(abime)));
  await env3.contexte.accrueScreen();
  verifie("le temps d'ecran se reconstruit sur un compteur abime",
    env3.store.screenDaily && typeof env3.store.screenDaily === "object" &&
    !Array.isArray(env3.store.screenDaily), JSON.stringify(env3.store.screenDaily).slice(0, 60));

  const env4 = charge(JSON.parse(JSON.stringify(abime)));
  await envoie(env4, { type: "kz-save", payload: {} });
  await attends();
  verifie("un stockage abime donne quand meme une alarme valide",
    env4.journal.alarmes["kz-move"] &&
    env4.journal.alarmes["kz-move"].delayInMinutes >= 1 &&
    env4.journal.alarmes["kz-move"].delayInMinutes <= 240,
    JSON.stringify(env4.journal.alarmes["kz-move"]));
}

/* ---------- execution ---------- */
(async () => {
  const suites = [
    ["Tranches horaires", testTranches],
    ["Serie en cours", testSerie],
    ["Enregistrement des issues", testIssues],
    ["Pause et planification", testPause],
    ["Effacements", testEffacements],
    ["Sites en sourdine", testSourdine],
    ["Temps d'ecran", testEcran],
    ["Charge utile du rappel", testChargeUtile],
    ["Ne pas deranger", testNePasDeranger],
    ["Stockage abime", testStockageAbime]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === 0 || echecs.length === 0 ? "ok " : "   ", nom, ok + ko - avant);
  }
  console.log("\n=== background.js : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
