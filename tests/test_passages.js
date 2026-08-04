// Tests fonctionnels des animaux de passage, module L.
// background.js est charge TEL QUEL dans un contexte vm avec des API simulees.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];

function verifie(nom, condition, detail) {
  if (condition) { ok++; }
  else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

/* ---------- bac a sable ---------- */
function charge(etatInitial, opts) {
  opts = opts || {};
  const store = Object.assign({}, etatInitial);
  const journal = { alarmes: {}, messages: [], injections: 0, ecrits: [] };
  const ecouteurs = {};
  const urlOnglet = opts.url || "https://example.com/page";

  const api = {
    runtime: {
      onInstalled: { addListener: (f) => { ecouteurs.installed = f; } },
      onStartup: { addListener: (f) => { ecouteurs.startup = f; } },
      onMessage: { addListener: (f) => { ecouteurs.message = f; } },
      getManifest: () => ({ version: "2.0.0" }),
      lastError: null
    },
    alarms: {
      create: (nom, o) => { journal.alarmes[nom] = o; },
      clear: async (nom) => { delete journal.alarmes[nom]; return true; },
      get: async (nom) => (journal.alarmes[nom] ? { name: nom } : null),
      onAlarm: { addListener: (f) => { ecouteurs.alarme = f; } }
    },
    storage: {
      local: {
        get: async (cles) => {
          if (cles == null) return JSON.parse(JSON.stringify(store));
          const out = {};
          [].concat(cles).forEach((k) => { if (store[k] !== undefined) out[k] = store[k]; });
          return out;
        },
        set: async (o) => { journal.ecrits.push(Object.keys(o)); Object.assign(store, JSON.parse(JSON.stringify(o))); },
        clear: async () => { Object.keys(store).forEach((k) => delete store[k]); }
      }
    },
    idle: {
      queryState: (s, cb) => {
        const st = opts.inactif ? "idle" : "active";
        if (typeof cb === "function") { cb(st); return undefined; }
        return Promise.resolve(st);
      }
    },
    tabs: {
      query: async () => (opts.aucunOnglet ? [] : [{ id: 7, url: urlOnglet, active: true }]),
      sendMessage: async (id, msg) => {
        if (opts.pageIncompatible) throw new Error("no receiver");
        // Onglet ouvert avant l'installation, le script de page n'existe pas
        // encore. Le premier envoi echoue, le second doit passer apres injection.
        if (opts.scriptAbsent && journal.injections === 0) throw new Error("no receiver");
        journal.messages.push(msg);
      }
    },
    scripting: { executeScript: async (o) => { journal.injections++; journal.fichiers = o && o.files; if (opts.pageIncompatible) throw new Error("nope"); } },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} }
  };

  // Horloge figeable. Un test qui depend de l'heure reelle passe le matin et
  // echoue le soir, la plage 8h-20h des passages en fait un piege direct.
  // Toute suite qui touche a l'horaire DOIT passer un instant fixe.
  let DateInjecte = Date;
  if (opts.instant) {
    const fixe = opts.instant;
    DateInjecte = class extends Date {
      constructor() {
        if (arguments.length === 0) { super(fixe); }
        else { super(...arguments); }
      }
      static now() { return fixe; }
    };
  }
  const contexte = { globalThis: null, browser: api, chrome: api, console, URL, Date: DateInjecte, Math, JSON, setTimeout, clearTimeout, Intl };
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(path.join(RACINE, "background.js"), "utf8"), contexte);
  return { contexte, store, journal, ecouteurs };
}

// Les declarations const du script ne deviennent pas des proprietes du contexte,
// contrairement aux declarations de fonction. On les lit donc par evaluation.
function lit(env, expr) { return vm.runInContext(expr, env.contexte); }

const attends = () => new Promise((r) => setTimeout(r, 40));
const JOUR = 24 * 60 * 60 * 1000;
// Mercredi 29 juillet 2026, 12h00 et 22h00 a Zurich, en UTC donc moins deux heures.
const MIDI_ZURICH = Date.UTC(2026, 6, 29, 10, 0, 0);
const NUIT_ZURICH = Date.UTC(2026, 6, 29, 20, 0, 0);

// Generateur pseudo aleatoire a graine, mulberry32. Les tests statistiques doivent
// etre reproductibles, sinon la campagne devient flottante et on finit par
// l'ignorer. Aucun test de ce fichier n'utilise Math.random.
function graine(n) {
  let a = n >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cle(tz, ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(ms));
}

/* ================= 1. La table des cinq passages ================= */
function testTable() {
  const env = charge({});
  const P = lit(env, "PASSAGES");
  verifie("le chat seul ou en rencontre, cinq passages sont declares", P.length === 5, String(P.length));
  verifie("jamais le koala, cat ou both seulement",
    P.every((p) => p.who === "cat" || p.who === "both"), P.map((p) => p.who).join(","));

  // Duree, qui parle et poids. Le chat seul, puis les deux rencontres.
  const ATTENDU = {
    cross: [15000, "cat", 30], sit: [20000, "cat", 10], yawn: [22500, "cat", 8],
    meetCats: [14000, "both", 3], meetFox: [14000, "both", 1]
  };
  Object.keys(ATTENDU).forEach((id) => {
    const p = P.find((x) => x.id === id);
    const [ms, who, w] = ATTENDU[id];
    verifie("passage " + id + ", duree " + ms + " ms", p && p.ms === ms, p ? String(p.ms) : "absent");
    verifie("passage " + id + ", qui parle " + who, p && p.who === who, p ? p.who : "absent");
    verifie("passage " + id + ", poids " + w, p && p.weight === w, p ? String(p.weight) : "absent");
  });

  verifie("sept pelages de chat", lit(env, "PASSAGE_COATS") === 7);
  verifie("huit phrases communes", lit(env, "PASSAGE_PHRASES") === 8);
  const freq = lit(env, "PASSAGE_FREQ");
  verifie("trois reglages de frequence, rare, normal, frequent",
    JSON.stringify(Object.keys(freq).sort()) === JSON.stringify(["frequent", "normal", "rare"]),
    JSON.stringify(freq));
  verifie("normal reprend exactement l'historique, 2 h et 4 par jour",
    freq.normal.gapHours === 2 && freq.normal.maxPerDay === 4, JSON.stringify(freq.normal));
  verifie("rare, 3 h et 3 par jour", freq.rare.gapHours === 3 && freq.rare.maxPerDay === 3, JSON.stringify(freq.rare));
  verifie("frequent, 1 h et 6 par jour",
    freq.frequent.gapHours === 1 && freq.frequent.maxPerDay === 6, JSON.stringify(freq.frequent));
  verifie("le reglage par defaut est normal", lit(env, "PASSAGE_FREQ_DEFAULT") === "normal");
  verifie("silence d'une minute apres un rappel", lit(env, "PASSAGE_QUIET_AFTER_REMINDER") === 60000);
  verifie("plage horaire de 8 h a 20 h",
    lit(env, "PASSAGE_HOUR_FROM") === 8 && lit(env, "PASSAGE_HOUR_TO") === 20);
  verifie("le renard plafonne a une fois par mois",
    lit(env, "PASSAGE_FOX_GAP") === 30 * 24 * 60 * 60 * 1000);
  verifie("la rencontre a deux chats plafonnee a une fois par semaine",
    lit(env, "PASSAGE_MEET_GAP") === 7 * 24 * 60 * 60 * 1000);
}

/* ================= 1b. Le renard et la rencontre, plafonnes independamment du poids ================= */
function testPlafondsRencontre() {
  const env = charge({});
  const pick = env.contexte.pickPassage;
  const alea = graine(20260731);
  const now = Date.UTC(2026, 6, 31, 10, 0, 0);
  const JOUR = 24 * 60 * 60 * 1000;

  // Le renard est sorti il y a une semaine, dans les 30 jours du plafond.
  const recemmentFox = { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: now - 7 * JOUR, lastMeet: 0 };
  const tirsFox = Array.from({ length: 2000 }, () => pick(recemmentFox, now, alea));
  verifie("le renard ne sort jamais avant un mois", tirsFox.every((r) => r.variant !== "meetFox"),
    String(tirsFox.filter((r) => r.variant === "meetFox").length));

  // Le renard est sorti il y a plus d'un mois, redevient tirable.
  const ancienFox = Object.assign({}, recemmentFox, { lastFox: now - 31 * JOUR });
  const tirsFoxOk = Array.from({ length: 4000 }, () => pick(ancienFox, now, alea));
  verifie("le renard redevient tirable passe un mois", tirsFoxOk.some((r) => r.variant === "meetFox"));

  // La rencontre a deux chats, sortie il y a deux jours, dans les 7 jours du plafond.
  const recemmentMeet = { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: now - 2 * JOUR };
  const tirsMeet = Array.from({ length: 2000 }, () => pick(recemmentMeet, now, alea));
  verifie("la rencontre a deux chats ne sort jamais avant une semaine",
    tirsMeet.every((r) => r.variant !== "meetCats"),
    String(tirsMeet.filter((r) => r.variant === "meetCats").length));

  // Sortie il y a plus d'une semaine, redevient tirable.
  const ancienMeet = Object.assign({}, recemmentMeet, { lastMeet: now - 8 * JOUR });
  const tirsMeetOk = Array.from({ length: 2000 }, () => pick(ancienMeet, now, alea));
  verifie("la rencontre a deux chats redevient tirable passe une semaine",
    tirsMeetOk.some((r) => r.variant === "meetCats"));
}

/* ================= 2. Le tirage pondere ================= */
function testTirage() {
  const env = charge({});
  const alea = graine(20260729);
  const pick = env.contexte.pickPassage;
  const now = Date.UTC(2026, 6, 29, 10, 0, 0);
  const vide = { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0 };

  // Distribution sur 20000 tirages, avec un etat vide a chaque fois pour ne pas
  // que la regle du non repetition biaise le comptage.
  const compte = {};
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const r = pick(vide, now, alea);
    compte[r.variant] = (compte[r.variant] || 0) + 1;
  }
  const totalPoids = lit(env, "PASSAGES").reduce((a, p) => a + p.weight, 0);
  lit(env, "PASSAGES").forEach((p) => {
    const attendu = p.weight / totalPoids;
    const obtenu = (compte[p.id] || 0) / N;
    const ecart = Math.abs(obtenu - attendu) / attendu;
    verifie("distribution de " + p.id + ", poids " + p.weight + " respecte a 20 pour cent",
      ecart < 0.20, "attendu " + attendu.toFixed(4) + " obtenu " + obtenu.toFixed(4));
  });

  verifie("le tirage rend toujours une variante connue",
    Array.from({ length: 300 }, () => pick(vide, now, alea))
      .every((r) => lit(env, "PASSAGES").some((p) => p.id === r.variant)));

  verifie("le tirage rend la duree et le locuteur de la variante",
    Array.from({ length: 300 }, () => pick(vide, now, alea)).every((r) => {
      const p = lit(env, "PASSAGES").find((x) => x.id === r.variant);
      return p.ms === r.ms && p.who === r.who;
    }));

  // Jamais deux fois de suite le meme passage.
  let repet = 0;
  let etat = Object.assign({}, vide);
  for (let i = 0; i < 4000; i++) {
    const r = pick(etat, now, alea);
    if (r.variant === etat.lastVariant) repet++;
    etat = Object.assign({}, etat, { lastVariant: r.variant, lastCoat: r.coat, lastPhrase: r.phrase });
  }
  verifie("jamais deux fois de suite le meme passage", repet === 0, String(repet));

  // Jamais deux fois de suite le meme pelage ni la meme phrase.
  let repCoat = 0, repPhrase = 0;
  etat = Object.assign({}, vide);
  for (let i = 0; i < 4000; i++) {
    const r = pick(etat, now, alea);
    if (r.coat === etat.lastCoat) repCoat++;
    if (r.phrase === etat.lastPhrase) repPhrase++;
    etat = Object.assign({}, etat, { lastVariant: r.variant, lastCoat: r.coat, lastPhrase: r.phrase });
  }
  verifie("jamais deux fois de suite le meme pelage", repCoat === 0, String(repCoat));
  verifie("jamais deux fois de suite la meme phrase", repPhrase === 0, String(repPhrase));

  // Les index restent dans leurs bornes.
  const tirs = Array.from({ length: 3000 }, () => pick(vide, now, alea));
  verifie("le pelage reste entre 0 et 6", tirs.every((r) => r.coat >= 0 && r.coat <= 6));
  verifie("la phrase reste entre 0 et 7", tirs.every((r) => r.phrase >= 0 && r.phrase <= 7));

  // Bornes du generateur, 0 et presque 1 ne doivent jamais sortir de la table.
  verifie("un tirage a 0 reste valide", !!pick(vide, now, () => 0));
  verifie("un tirage a 0,999999 reste valide", !!pick(vide, now, () => 0.999999));
}

/* ================= 4. Les interdits ================= */
function testInterdits() {
  // Un passage ne doit pas traverser pendant une pause focus, qui peut durer
  // jusqu'a 120 s alors que la fenetre de silence de base ne fait que 60 s.
  {
    const env = charge({});
    const base = Date.UTC(2026, 6, 29, 10, 0, 0);
    const cfgFocus = { passages: true, animMode: "always", pausedUntil: 0, focusMode: true, focusSeconds: 120 };
    const cfgSans = { passages: true, animMode: "always", pausedUntil: 0, focusMode: false, focusSeconds: 120 };
    const etat = { day: "", count: 0, last: 0, lastReminder: base - 90 * 1000 };
    verifie("pause focus de 120 s, un passage 90 s apres le rappel est bloque",
      env.contexte.passageBlocked(cfgFocus, etat, base, "Europe/Zurich") === "rappel",
      String(env.contexte.passageBlocked(cfgFocus, etat, base, "Europe/Zurich")));
    verifie("sans mode focus, 90 s apres le rappel le passage est autorise",
      env.contexte.passageBlocked(cfgSans, etat, base, "Europe/Zurich") === "",
      String(env.contexte.passageBlocked(cfgSans, etat, base, "Europe/Zurich")));
    verifie("pause focus, le passage redevient possible passe la fenetre",
      env.contexte.passageBlocked(cfgFocus, { day: "", count: 0, last: 0, lastReminder: base - 200 * 1000 }, base, "Europe/Zurich") === "");
  }
  // Le passageState des DEFAULTS doit porter les memes champs que le normaliseur.
  {
    const src = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
    const m = src.match(/passageState:\s*\{([^}]*)\}/);
    verifie("passageState des DEFAULTS porte lastReminder", m && m[1].indexOf("lastReminder") > -1);
  }

  const env = charge({});
  const bloque = env.contexte.passageBlocked;
  const TZ = "Europe/Zurich";
  // 29 juillet 2026, 10 h a Zurich, donc 08 h UTC en heure d'ete.
  const dixHeures = Date.UTC(2026, 6, 29, 8, 0, 0);
  const cfgOk = { passages: true, animMode: "always", pausedUntil: 0 };
  const stOk = { day: "", count: 0, last: 0, lastReminder: 0 };

  verifie("rien ne bloque un passage dans les conditions normales",
    bloque(cfgOk, stOk, dixHeures, TZ) === "", bloque(cfgOk, stOk, dixHeures, TZ));

  verifie("le reglage eteint bloque",
    bloque({ passages: false, animMode: "always", pausedUntil: 0 }, stOk, dixHeures, TZ) === "reglage");
  verifie("les animations sur Jamais bloquent",
    bloque({ passages: true, animMode: "never", pausedUntil: 0 }, stOk, dixHeures, TZ) === "animations");
  verifie("les animations sur Automatique ne bloquent pas",
    bloque({ passages: true, animMode: "auto", pausedUntil: 0 }, stOk, dixHeures, TZ) === "");

  // La plage 8 h 20 h, bornes comprises du bon cote.
  const aHeure = (h) => Date.UTC(2026, 6, 29, h - 2, 0, 0); // Zurich = UTC+2 en juillet
  verifie("7 h bloque, avant la plage", bloque(cfgOk, stOk, aHeure(7), TZ) === "horaire");
  verifie("8 h passe, premiere heure de la plage", bloque(cfgOk, stOk, aHeure(8), TZ) === "");
  verifie("19 h passe, derniere heure de la plage", bloque(cfgOk, stOk, aHeure(19), TZ) === "");
  verifie("20 h bloque, la plage est fermee", bloque(cfgOk, stOk, aHeure(20), TZ) === "horaire");
  verifie("23 h bloque", bloque(cfgOk, stOk, aHeure(23), TZ) === "horaire");
  verifie("3 h bloque", bloque(cfgOk, stOk, aHeure(3), TZ) === "horaire");

  // La plage suit le fuseau reglé, pas celui de la machine.
  verifie("la plage suit le fuseau, 10 h a Zurich vaut 1 h a Los Angeles donc bloque",
    bloque(cfgOk, stOk, dixHeures, "America/Los_Angeles") === "horaire");

  verifie("une pause en cours bloque",
    bloque({ passages: true, animMode: "always", pausedUntil: dixHeures + 60000 }, stOk, dixHeures, TZ) === "pause");
  verifie("une pause echue ne bloque plus",
    bloque({ passages: true, animMode: "always", pausedUntil: dixHeures - 1 }, stOk, dixHeures, TZ) === "");

  verifie("un rappel il y a 30 s bloque",
    bloque(cfgOk, { day: "", count: 0, last: 0, lastReminder: dixHeures - 30000 }, dixHeures, TZ) === "rappel");
  verifie("un rappel il y a 61 s ne bloque plus",
    bloque(cfgOk, { day: "", count: 0, last: 0, lastReminder: dixHeures - 61000 }, dixHeures, TZ) === "");

  const jourDuTest = cle(TZ, dixHeures);
  verifie("le quatrieme passage du jour bloque",
    bloque(cfgOk, { day: jourDuTest, count: 4, last: 0, lastReminder: 0 }, dixHeures, TZ) === "plafond");
  verifie("le troisieme passage du jour passe",
    bloque(cfgOk, { day: jourDuTest, count: 3, last: 0, lastReminder: 0 }, dixHeures, TZ) === "");
  verifie("un compteur de la veille ne bloque pas, il repart a zero",
    bloque(cfgOk, { day: cle(TZ, dixHeures - JOUR), count: 4, last: 0, lastReminder: 0 }, dixHeures, TZ) === "");

  verifie("moins de 2 heures depuis le dernier passage bloque",
    bloque(cfgOk, { day: "", count: 0, last: dixHeures - 90 * 60000, lastReminder: 0 }, dixHeures, TZ) === "ecart");
  verifie("2 heures pile ne bloquent plus",
    bloque(cfgOk, { day: "", count: 0, last: dixHeures - 120 * 60000, lastReminder: 0 }, dixHeures, TZ) === "");

  // Le silence est prioritaire, le reglage passe avant tout le reste.
  verifie("le reglage eteint gagne sur tous les autres motifs",
    bloque({ passages: false, animMode: "never", pausedUntil: dixHeures + 1 },
      { day: "", count: 9, last: dixHeures, lastReminder: dixHeures }, aHeure(3), TZ) === "reglage");

  // Un etat de stockage abime ne doit jamais faire tomber la fonction.
  verifie("un etat nul est absorbe", bloque(cfgOk, null, dixHeures, TZ) === "");
  verifie("un etat aux mauvais types est absorbe",
    bloque(cfgOk, { day: 42, count: "beaucoup", last: "hier", lastReminder: {} }, dixHeures, TZ) === "");

  // Le reglage de frequence choisi par l'utilisateur pilote l'ecart et le plafond.
  const cfgRare = { passages: true, animMode: "always", pausedUntil: 0, passageFrequency: "rare" };
  const cfgFrequent = { passages: true, animMode: "always", pausedUntil: 0, passageFrequency: "frequent" };
  verifie("rare, 2 h 30 depuis le dernier passage bloque encore (ecart de 3 h)",
    bloque(cfgRare, { day: "", count: 0, last: dixHeures - 150 * 60000, lastReminder: 0 }, dixHeures, TZ) === "ecart");
  verifie("rare, 3 h pile ne bloquent plus",
    bloque(cfgRare, { day: "", count: 0, last: dixHeures - 180 * 60000, lastReminder: 0 }, dixHeures, TZ) === "");
  verifie("rare, le troisieme passage du jour bloque (plafond a 3)",
    bloque(cfgRare, { day: jourDuTest, count: 3, last: 0, lastReminder: 0 }, dixHeures, TZ) === "plafond");
  verifie("frequent, 45 min depuis le dernier passage ne bloquent plus (ecart de 1 h)",
    bloque(cfgFrequent, { day: "", count: 0, last: dixHeures - 45 * 60000, lastReminder: 0 }, dixHeures, TZ) === "ecart");
  verifie("frequent, 1 h pile ne bloque plus",
    bloque(cfgFrequent, { day: "", count: 0, last: dixHeures - 60 * 60000, lastReminder: 0 }, dixHeures, TZ) === "");
  verifie("frequent, le sixieme passage du jour bloque (plafond a 6)",
    bloque(cfgFrequent, { day: jourDuTest, count: 6, last: 0, lastReminder: 0 }, dixHeures, TZ) === "plafond");
  verifie("frequent, le cinquieme passage du jour passe",
    bloque(cfgFrequent, { day: jourDuTest, count: 5, last: 0, lastReminder: 0 }, dixHeures, TZ) === "");
  verifie("une frequence inconnue ou absente retombe sur normal, 2 h et 4 par jour",
    bloque({ passages: true, animMode: "always", pausedUntil: 0, passageFrequency: "n'importe quoi" },
      { day: "", count: 0, last: dixHeures - 90 * 60000, lastReminder: 0 }, dixHeures, TZ) === "ecart");
}

/* ================= 5. Le delai de planification ================= */
function testDelai() {
  const env = charge({});
  const alea = graine(7);
  const f = env.contexte.nextPassageDelayMinutes;

  // Reglage "normal" (2 h), inchange par rapport a l'historique, 2 a 5 heures.
  const tirs = Array.from({ length: 4000 }, () => f(2, alea));
  verifie("le delai normal est toujours de 120 minutes au moins", Math.min.apply(null, tirs) >= 120,
    String(Math.min.apply(null, tirs)));
  verifie("le delai normal ne depasse jamais 300 minutes", Math.max.apply(null, tirs) <= 300,
    String(Math.max.apply(null, tirs)));
  verifie("le delai n'est jamais fixe", new Set(tirs).size > 100, String(new Set(tirs).size));
  verifie("le delai normal borne bas vaut 120", f(2, () => 0) === 120, String(f(2, () => 0)));
  verifie("le delai normal borne haut vaut 299", f(2, () => 0.999999) === 299, String(f(2, () => 0.999999)));

  // Reglage "rare" (3 h), fenetre 3 a 7,5 heures soit 180 a 450 minutes.
  const tirsRares = Array.from({ length: 2000 }, () => f(3, alea));
  verifie("le delai rare reste entre 180 et 450 minutes",
    Math.min.apply(null, tirsRares) >= 180 && Math.max.apply(null, tirsRares) <= 450,
    Math.min.apply(null, tirsRares) + " a " + Math.max.apply(null, tirsRares));

  // Reglage "frequent" (1 h), fenetre 1 a 2,5 heures soit 60 a 150 minutes.
  const tirsFrequents = Array.from({ length: 2000 }, () => f(1, alea));
  verifie("le delai frequent reste entre 60 et 150 minutes",
    Math.min.apply(null, tirsFrequents) >= 60 && Math.max.apply(null, tirsFrequents) <= 150,
    Math.min.apply(null, tirsFrequents) + " a " + Math.max.apply(null, tirsFrequents));

  // Une valeur absente ou invalide retombe sur le reglage par defaut, 2 h.
  verifie("gapHours absent retombe sur le reglage normal, 2 h",
    f(undefined, () => 0) === 120, String(f(undefined, () => 0)));
}

/* ================= 6. Le declenchement ================= */
async function testDeclenchement() {
  const TZ = "Europe/Zurich";
  const maintenant = MIDI_ZURICH;
  const base = {
    passages: true, animMode: "always", pausedUntil: 0, pauseWhenIdle: false,
    muteInCalls: true, mutedPatterns: ["kmeet.infomaniak.com"], screenTimezone: TZ,
    passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0 }
  };
  const heureOk = env => env; // lisibilite

  // Le declenchement depend de l'heure reelle de la machine. On ne teste donc le
  // depart du message que si la plage est ouverte, et on teste toujours le reste.
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date());
  // L'horloge est figee a midi, donc on est toujours dans la plage.
  const dansLaPlage = true;

  let env = charge(base, { instant: MIDI_ZURICH, instant: MIDI_ZURICH });
  await env.contexte.triggerPassage();
  await attends();
  const msg = env.journal.messages.filter((m) => m.type === "kz-passage");
  if (dansLaPlage) {
    verifie("un message kz-passage part", msg.length === 1, String(msg.length));
    if (msg.length) {
      const m = msg[0];
      verifie("le message porte la variante", typeof m.variant === "string" && m.variant.length > 0);
      verifie("le message porte la duree", typeof m.ms === "number" && m.ms >= 6000);
      verifie("le message porte le locuteur", ["cat", "koala", "both"].indexOf(m.who) > -1);
      verifie("le message porte le pelage", m.coat >= 0 && m.coat <= 6);
      verifie("le message porte la phrase", m.phrase >= 0 && m.phrase <= 7);
    }
    verifie("passageState est enregistre", env.store.passageState && env.store.passageState.last > 0);
    verifie("le compteur du jour passe a 1", env.store.passageState.count === 1,
      String(env.store.passageState.count));
    verifie("le jour est enregistre dans le fuseau retenu",
      env.store.passageState.day === cle(TZ, MIDI_ZURICH), env.store.passageState.day);
    verifie("la variante jouee est memorisee",
      env.store.passageState.lastVariant === msg[0].variant);
  } else {
    verifie("hors plage horaire, aucun message ne part", msg.length === 0, String(msg.length));
    verifie("hors plage horaire, passageState n'est pas touche",
      !env.store.passageState || env.store.passageState.last === 0);
  }

  // Le compteur repart a 1 quand le jour change.
  env = charge(Object.assign({}, base, {
    passageState: Object.assign({}, base.passageState, { day: cle(TZ, MIDI_ZURICH - JOUR), count: 4 })
  }), { instant: MIDI_ZURICH });
  await env.contexte.triggerPassage();
  await attends();
  if (dansLaPlage) {
    verifie("un compteur de la veille repart a 1", env.store.passageState.count === 1,
      String(env.store.passageState.count));
  }

  // La visio est prioritaire sur tout le reste.
  env = charge(base, { instant: MIDI_ZURICH, url: "https://kmeet.infomaniak.com/abc" });
  await env.contexte.triggerPassage();
  await attends();
  verifie("aucun passage pendant une visio",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);
  verifie("pendant une visio, passageState n'est pas touche",
    !env.store.passageState || env.store.passageState.last === 0);

  // Un sous domaine de visio est reconnu aussi.
  env = charge(base, { instant: MIDI_ZURICH, url: "https://eu.kmeet.infomaniak.com/abc" });
  await env.contexte.triggerPassage();
  await attends();
  verifie("aucun passage sur un sous domaine de visio",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);

  // L'inactivite du clavier coupe aussi.
  env = charge(Object.assign({}, base, { pauseWhenIdle: true }), { instant: MIDI_ZURICH, inactif: true });
  await env.contexte.triggerPassage();
  await attends();
  verifie("aucun passage quand le clavier est quitte",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);

  // Aucun onglet cible, rien ne part et rien n'est ecrit.
  env = charge(base, { instant: MIDI_ZURICH, aucunOnglet: true });
  await env.contexte.triggerPassage();
  await attends();
  verifie("aucun onglet cible, aucun message",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);

  // Page incompatible, le creneau est perdu mais NON consomme.
  env = charge(base, { instant: MIDI_ZURICH, pageIncompatible: true });
  await env.contexte.triggerPassage();
  await attends();
  verifie("page incompatible, le creneau n'est pas consomme",
    !env.store.passageState || env.store.passageState.last === 0);

  // Le reglage eteint, rien ne part.
  env = charge(Object.assign({}, base, { passages: false }), { instant: MIDI_ZURICH, instant: MIDI_ZURICH });
  await env.contexte.triggerPassage();
  await attends();
  verifie("reglage eteint, aucun message",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);

  // Animations sur Jamais, rien ne part.
  env = charge(Object.assign({}, base, { animMode: "never" }), { instant: MIDI_ZURICH, instant: MIDI_ZURICH });
  await env.contexte.triggerPassage();
  await attends();
  verifie("animations sur Jamais, aucun message",
    env.journal.messages.filter((m) => m.type === "kz-passage").length === 0);
}

/* ================= 6b. Le declenchement memorise le renard et la rencontre ================= */
// triggerPassage tire au hasard reel, jamais injectable de l'exterieur. On
// force donc le tirage sur le renard en truquant Math.random le temps de
// l'appel, seul moyen de verifier que lastFox et lastMeet sont bien ecrits,
// et pas seulement lus par pickPassage. Restaure aussitot apres, sous peine
// de fausser tout le reste de la campagne qui tourne dans le meme processus.
async function testMemoirePlafonds() {
  const TZ = "Europe/Zurich";
  const base = {
    passages: true, animMode: "always", pausedUntil: 0, pauseWhenIdle: false,
    muteInCalls: true, mutedPatterns: ["kmeet.infomaniak.com"], screenTimezone: TZ,
    passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0 }
  };
  const original = Math.random;
  try {
    // Poids cross 30, sit 10, yawn 8, meetCats 3, meetFox 1, total 52. Un
    // tirage a 0,999 tombe au-dela du seuil des quatre premiers, sur meetFox.
    Math.random = () => 0.999;
    const env = charge(base, { instant: MIDI_ZURICH });
    await env.contexte.triggerPassage();
    await attends();
    const msg = env.journal.messages.find((m) => m.type === "kz-passage");
    verifie("le tirage truque tombe bien sur le renard", msg && msg.variant === "meetFox",
      msg ? msg.variant : "aucun message");
    verifie("lastFox est enregistre lors d'une rencontre avec le renard",
      env.store.passageState && env.store.passageState.lastFox === MIDI_ZURICH,
      env.store.passageState && String(env.store.passageState.lastFox));
    verifie("lastMeet n'est pas touche par une rencontre avec le renard",
      env.store.passageState && env.store.passageState.lastMeet === 0);
  } finally {
    Math.random = original;
  }

  const original2 = Math.random;
  try {
    // Meme logique, un seuil qui tombe juste avant meetFox, sur meetCats.
    Math.random = () => 0.97;
    const env = charge(base, { instant: MIDI_ZURICH });
    await env.contexte.triggerPassage();
    await attends();
    const msg = env.journal.messages.find((m) => m.type === "kz-passage");
    verifie("le tirage truque tombe bien sur la rencontre a deux chats", msg && msg.variant === "meetCats",
      msg ? msg.variant : "aucun message");
    verifie("lastMeet est enregistre lors d'une rencontre a deux chats",
      env.store.passageState && env.store.passageState.lastMeet === MIDI_ZURICH,
      env.store.passageState && String(env.store.passageState.lastMeet));
    verifie("lastFox n'est pas touche par une rencontre a deux chats",
      env.store.passageState && env.store.passageState.lastFox === 0);
  } finally {
    Math.random = original2;
  }
}

/* ================= 7. Aucune trace dans les donnees ================= */
async function testAucuneTrace() {
  const TZ = "Europe/Zurich";
  const base = {
    passages: true, animMode: "always", pausedUntil: 0, pauseWhenIdle: false,
    muteInCalls: false, mutedPatterns: [], screenTimezone: TZ,
    statsDaily: { "2026-07-28": { due: 3, done: 2, rep: 1, eSum: 14, eCount: 2 } },
    screenDaily: { "2026-07-28": 3600 },
    pending: 2,
    passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0 }
  };
  const env = charge(base);
  const statsAvant = JSON.stringify(env.store.statsDaily);
  const ecranAvant = JSON.stringify(env.store.screenDaily);
  const retardAvant = env.store.pending;

  await env.contexte.triggerPassage();
  await attends();

  verifie("un passage ne touche jamais statsDaily",
    JSON.stringify(env.store.statsDaily) === statsAvant);
  verifie("un passage ne touche jamais screenDaily",
    JSON.stringify(env.store.screenDaily) === ecranAvant);
  verifie("un passage ne touche jamais le retard", env.store.pending === retardAvant);

  // La seule cle ecrite par un passage est passageState.
  const ecrites = new Set();
  env.journal.ecrits.forEach((liste) => liste.forEach((k) => ecrites.add(k)));
  const interdites = [...ecrites].filter((k) => k !== "passageState");
  verifie("un passage n'ecrit que passageState", interdites.length === 0, interdites.join(","));
}

/* ================= 8. La planification et l'alarme ================= */
async function testPlanification() {
  const env = charge({});
  verifie("l'alarme des passages porte le bon nom", lit(env, "ALARM_PASSAGE") === "kz-passage");

  await env.ecouteurs.installed();
  await attends();
  verifie("l'installation planifie un passage", !!env.journal.alarmes["kz-passage"]);
  const o = env.journal.alarmes["kz-passage"];
  verifie("le creneau est pose en minutes", o && typeof o.delayInMinutes === "number");
  verifie("le creneau tombe entre 120 et 300 minutes",
    o && o.delayInMinutes >= 120 && o.delayInMinutes <= 300, o ? String(o.delayInMinutes) : "-");
  verifie("l'installation planifie aussi le rappel et le tic",
    !!env.journal.alarmes["kz-move"] && !!env.journal.alarmes["kz-tick"]);

  const env2 = charge({});
  await env2.ecouteurs.startup();
  await attends();
  verifie("le demarrage du navigateur replanifie un passage", !!env2.journal.alarmes["kz-passage"]);

  // L'alarme est replanifiee meme quand le passage est refuse.
  const env3 = charge({ passages: false, animMode: "always", screenTimezone: "Europe/Zurich" });
  delete env3.journal.alarmes["kz-passage"];
  env3.ecouteurs.alarme({ name: "kz-passage" });
  await attends();
  verifie("un passage refuse replanifie quand meme le creneau suivant",
    !!env3.journal.alarmes["kz-passage"]);

  // L'alarme du rappel ne doit pas declencher un passage, et l'inverse non plus.
  const env4 = charge({ screenTimezone: "Europe/Zurich" });
  env4.ecouteurs.alarme({ name: "kz-tick" });
  await attends();
  verifie("l'alarme du tic ne declenche aucun passage",
    env4.journal.messages.filter((m) => m.type === "kz-passage").length === 0);
}

/* ================= 9. Un rappel impose une minute de silence ================= */
async function testSilenceApresRappel() {
  const env = charge({
    intervalMinutes: 30, pausedUntil: 0, pauseWhenIdle: false, muteInCalls: false,
    mutedPatterns: [], focusMode: false, focusSeconds: 30, habitGoal: 3,
    statsDaily: {}, screenTimezone: "Europe/Zurich"
  }, { instant: MIDI_ZURICH });
  await env.contexte.trigger({ force: true });
  await attends();
  verifie("un rappel envoie bien sa charge utile",
    env.journal.messages.filter((m) => m.type === "kz-show").length === 1);
  verifie("un rappel horodate lastReminder dans passageState",
    env.store.passageState && env.store.passageState.lastReminder > 0,
    JSON.stringify(env.store.passageState || null));

  // Et ce lastReminder bloque bien un passage immediat. On fige l'instant DANS
  // la plage horaire, sinon le motif rendu serait horaire et non rappel, et le
  // test passerait le matin pour echouer le soir.
  const bloque = env.contexte.passageBlocked;
  const etat = Object.assign({}, env.store.passageState, { lastReminder: MIDI_ZURICH });
  verifie("le lastReminder pose par un rappel bloque un passage immediat",
    bloque({ passages: true, animMode: "always", pausedUntil: 0 },
      etat, MIDI_ZURICH + 10000, "Europe/Zurich") === "rappel",
    String(bloque({ passages: true, animMode: "always", pausedUntil: 0 },
      etat, MIDI_ZURICH + 10000, "Europe/Zurich")));
  verifie("passe la minute de silence, le passage redevient possible",
    bloque({ passages: true, animMode: "always", pausedUntil: 0 },
      etat, MIDI_ZURICH + 70000, "Europe/Zurich") === "");
  // Et hors plage horaire, c'est l'horaire qui bloque, pas le rappel.
  verifie("hors plage horaire, le motif rendu est horaire",
    bloque({ passages: true, animMode: "always", pausedUntil: 0 },
      etat, NUIT_ZURICH, "Europe/Zurich") === "horaire",
    String(bloque({ passages: true, animMode: "always", pausedUntil: 0 },
      etat, NUIT_ZURICH, "Europe/Zurich")));

  verifie("un rappel n'ecrase pas le compteur de passages du jour",
    env.store.passageState.count === 0, String(env.store.passageState.count));
}

/* ================= 10. Les phrases fournies ================= */
function testPhrases() {
  const src = fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8");
  ["FR", "EN", "DE"].forEach((lg) => {
    const m = src.match(new RegExp("KZ_HELLO_" + lg + "\\s*=\\s*\\[([\\s\\S]*?)\\]"));
    verifie("KZ_HELLO_" + lg + " est declare", !!m);
    if (m) {
      const n = (m[1].match(/"/g) || []).length / 2;
      verifie("KZ_HELLO_" + lg + " porte huit phrases", n === 8, String(n));
    }
  });
  verifie("KZ_HELLO suit la langue du navigateur",
    /const KZ_HELLO = KZ_IS_FR \? KZ_HELLO_FR : \(KZ_IS_DE \? KZ_HELLO_DE : KZ_HELLO_EN\);/.test(src));
  const mde = src.match(/KZ_HELLO_DE\s*=\s*\[([\s\S]*?)\]/);
  verifie("aucun eszett dans les phrases allemandes", mde && mde[1].indexOf("\u00df") === -1);

  // Aucune phrase ne demande quoi que ce soit ni ne parle d'habitude.
  const mfr = src.match(/KZ_HELLO_FR\s*=\s*\[([\s\S]*?)\]/);
  const interdits = ["habitude", "pompe", "objectif", "temps d'ecran", "energie", "serie"];
  const trouves = interdits.filter((mot) => mfr && mfr[1].toLowerCase().indexOf(mot) > -1);
  verifie("aucune phrase de passage ne parle d'habitude ni de statistiques",
    trouves.length === 0, trouves.join(","));
  verifie("aucune phrase de passage ne se termine par un point d'interrogation",
    mfr && !/\?\s*"/.test(mfr[1]));
}

/* ================= bilan ================= */
/* ============ 11. Reinjection quand la page n'a pas les scripts ============ */
async function testReinjection() {
  const base = {
    passages: true, animMode: "always", pausedUntil: 0, muteInCalls: false,
    mutedPatterns: [], pauseWhenIdle: false, screenTimezone: "Europe/Zurich",
    passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0 }
  };
  // Onglet ouvert AVANT l'installation. Sans reinjection, le passage etait perdu
  // en silence et AUCUN animal ne traversait jamais. C'est le defaut signale.
  let env = charge(base, { instant: MIDI_ZURICH, scriptAbsent: true });
  await env.contexte.triggerPassage();
  await attends();
  verifie("le script de page absent declenche une reinjection",
    env.journal.injections === 1, String(env.journal.injections));
  verifie("la reinjection embarque les TROIS scripts de page",
    Array.isArray(env.journal.fichiers)
    && env.journal.fichiers.join(",") === "quotes.js,passages.js,content.js",
    JSON.stringify(env.journal.fichiers));
  verifie("le passage est bien envoye apres la reinjection",
    env.journal.messages.some((m) => m.type === "kz-passage"),
    JSON.stringify(env.journal.messages.map((m) => m.type)));

  // Page reellement incompatible, on abandonne sans bruit et sans consommer.
  env = charge(base, { instant: MIDI_ZURICH, pageIncompatible: true });
  await env.contexte.triggerPassage();
  await attends();
  verifie("une page incompatible n'envoie aucun passage",
    !env.journal.messages.some((m) => m.type === "kz-passage"));
  verifie("une page incompatible ne consomme pas le quota",
    !env.journal.ecrits.some((o) => o.passageState && o.passageState.count > 0),
    JSON.stringify(env.journal.ecrits));
}

(async () => {
  const suites = [
    ["La table des cinq passages", testTable],
    ["Le renard et la rencontre, plafonnes", testPlafondsRencontre],
    ["Le tirage pondere", testTirage],
    ["Les interdits", testInterdits],
    ["Le delai de planification", testDelai],
    ["Le declenchement", testDeclenchement],
    ["Le declenchement memorise le renard et la rencontre", testMemoirePlafonds],
    ["Aucune trace dans les donnees", testAucuneTrace],
    ["La planification et l'alarme", testPlanification],
    ["Silence d'une minute apres un rappel", testSilenceApresRappel],
    ["Les phrases fournies", testPhrases],
    ["Reinjection des scripts de page", testReinjection]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== animaux de passage : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
