// Tests fonctionnels de l'agenda Infomaniak (module dans background.js),
// execute dans un contexte vm avec des API simulees, un fetch controle et
// une horloge FIXE. Aucun test ne lit l'heure reelle : Date.now() rend la
// valeur de `horloge.now`, que chaque test regle lui-meme.
//
// Les charges utiles simulees reproduisent la forme REELLE de l'API,
// observee le 2026-09-16 : liste d'agendas avec permission/default/user_id,
// evenements en ISO avec decalage, participants avec user_id et state.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { fakeIndexedDB, coffreTest } = require("./fake_idb");
const { webcrypto } = require("node:crypto");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];

function verifie(nom, condition, detail) {
  if (condition) { ok++; }
  else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

/* ---------- horloge fixe ---------- */
// 2026-09-16 10:00 a Zurich (heure d'ete, UTC+2), un mercredi en pleine
// plage des passages (8 h a 20 h).
const T0 = Date.UTC(2026, 8, 16, 8, 0, 0);
const MIN = 60 * 1000;

function horlogeFixe(depart) {
  const horloge = { now: depart };
  class DateFixe extends Date {
    constructor(...args) { super(...(args.length ? args : [horloge.now])); }
    static now() { return horloge.now; }
  }
  return { horloge, DateFixe };
}

/* ---------- bac a sable ---------- */
function reponse(status, json) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    redirected: false,
    url: "https://api.infomaniak.com/x",
    json: async () => json,
    text: async () => JSON.stringify(json),
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(json)).buffer
  };
}

function charge(etatInitial, fetchMock, opts) {
  opts = opts || {};
  // 2026-10-06 : `brut` est storage.local tel que le voit un script de page ;
  // `store` y ajoute le coffre IndexedDB du fond (VAULT_KEYS).
  const idb = fakeIndexedDB();
  const brut = {};
  const store = coffreTest(brut, idb, RACINE);
  Object.assign((opts && opts.brut) ? brut : store, etatInitial || {});
  const journal = { alarmes: {}, messages: [], notifs: [], onglets: [], injections: 0, fetches: [], veille: [] };
  const ecouteurs = {};
  const { horloge, DateFixe } = horlogeFixe(opts.depart || T0);
  let reponseOnglet = opts.reponseOnglet !== undefined ? opts.reponseOnglet : { shown: true };

  const api = {
    runtime: {
      onInstalled: { addListener: (f) => { ecouteurs.installed = f; } },
      onStartup: { addListener: (f) => { ecouteurs.startup = f; } },
      onMessage: { addListener: (f) => { ecouteurs.message = f; } },
      getManifest: () => ({ version: "2.2.0" }),
      getURL: (p) => "chrome-extension://kz/" + p,
      lastError: null
    },
    i18n: { getMessage: () => "" },
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
          [].concat(cles).forEach((k) => { if (brut[k] !== undefined) out[k] = JSON.parse(JSON.stringify(brut[k])); });
          return out;
        },
        set: async (o) => { Object.assign(brut, JSON.parse(JSON.stringify(o))); },
        clear: async () => { Object.keys(store).forEach((k) => delete brut[k]); }
      }
    },
    // opts.etatVeille : "active", "idle" ou "locked". Les seuils demandes sont journalises.
    idle: { queryState: (s, cb) => { journal.veille.push(s); const st = opts.etatVeille || "active"; if (typeof cb === "function") { cb(st); return undefined; } return Promise.resolve(st); } },
    tabs: {
      query: async () => (opts.sansOnglet ? [] : [{ id: 7, url: opts.ongletUrl || "https://example.com/page", active: true }]),
      sendMessage: async (id, msg) => { journal.messages.push(msg); return reponseOnglet; },
      create: async (o) => { journal.onglets.push(o.url); return { id: 99 }; }
    },
    scripting: { executeScript: async () => { journal.injections++; } },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
    notifications: {
      create: async (id, o) => { journal.notifs.push({ id: id, o: o }); return id; },
      clear: async () => true,
      onClicked: { addListener: (f) => { ecouteurs.notifClic = f; } }
    }
  };

  const fetchImpl = async (url, init) => {
    journal.fetches.push({ url: String(url), init: init || {} });
    if (!fetchMock) throw new Error("fetch non configure pour ce test");
    return fetchMock(String(url), init || {});
  };
  const contexte = { indexedDB: idb,
    globalThis: null, browser: api, chrome: api, console, URL, Date: DateFixe, Math, JSON,
    setTimeout, clearTimeout, Intl, crypto: webcrypto, fetch: fetchImpl,
    TextEncoder, TextDecoder, Uint8Array, Array, encodeURIComponent, decodeURIComponent
  };
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(path.join(RACINE, "background.js"), "utf8"), contexte);
  return { contexte, store, brut, journal, ecouteurs, horloge, setReponseOnglet: (r) => { reponseOnglet = r; }, setVeille: (s) => { opts.etatVeille = s; } };
}

function lit(env, expr) { return vm.runInContext(expr, env.contexte); }

async function envoie(env, msg) {
  return new Promise((resolve) => {
    const retour = env.ecouteurs.message(msg, { url: "chrome-extension://kz/popup.html" }, resolve);
    if (retour !== true) resolve(undefined);
    setTimeout(() => resolve(undefined), 200);
  });
}

/* ---------- charges utiles, forme reelle de l'API ---------- */
const MOI = 218155;
const CALENDARS = {
  result: "success",
  data: {
    calendars: [
      { id: 631037, user_id: MOI, account_id: 28, name: "MarCom", default: false, permission: "owner", displayed: true },
      { id: 1715215, user_id: -1, account_id: 378083, name: "Focus Room", default: false, permission: "none", displayed: false },
      { id: 60, user_id: 91, account_id: 28, name: "Boris", default: false, permission: "readwrite", displayed: false },
      { id: 141, user_id: 52, account_id: 28, name: "Alexandre", default: false, permission: "read", displayed: false },
      { id: 132129, user_id: MOI, account_id: 28, name: "Thomas (pro)", default: true, permission: "owner", displayed: true },
      { id: 1370300, user_id: -1, account_id: 28, name: "Salle Chat", default: false, permission: "none", displayed: false },
      { id: 1079108, user_id: 7, account_id: null, name: "Jours feries", default: false, permission: "read", displayed: true }
    ]
  }
};

// Un instant ISO avec decalage Zurich (+02:00) a partir d'un instant absolu.
function iso(ms) {
  const d = new Date(ms + 2 * 60 * MIN);
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + "+02:00";
}
function att(userId, state, organizer) {
  return { address: "u" + userId + "@example.com", name: "U" + userId, user_id: userId, state: state || "ACCEPTED", organizer: !!organizer };
}
function ev(id, startMs, endMs, extra) {
  return Object.assign({
    id: id, title: "Reunion " + id, start: iso(startMs), end: iso(endMs), fullday: false, freebusy: "busy",
    timezone_start: "Europe/Zurich", attendees: [], meet_room_url: "", external_meet_room_urls: [], origin_attendee_email: null
  }, extra || {});
}

function fetchStandard(evenements, options) {
  options = options || {};
  return (url) => {
    if (url.indexOf("/1/calendar/pim/calendar") >= 0) return reponse(200, CALENDARS);
    if (url.indexOf("/2/profile") >= 0) {
      if (options.profil) return reponse(200, { result: "success", data: { email: options.profil } });
      return reponse(403, { result: "error", error: { code: "all_scopes", description: "This method require this specific scope: \"user_info\"" } });
    }
    if (url.indexOf("/1/calendar/pim/event") >= 0) return reponse(200, { result: "success", data: evenements });
    // Comme le vrai serveur : une sonde de perimetre sans le droit repond 403 all_scopes.
    if (/mail\.infomaniak\.com\/api\/mailbox|\/2\/drive\/users\/current\/drives|\/1\/calendar\/pim\/calendar$/.test(url)) return reponse(403, { result: "error", error: { code: "all_scopes" } });
    return reponse(404, { result: "error", error: { code: "not_found" } });
  };
}

/* ================= 1. Les agendas proposes ================= */
async function testAgendas() {
  const env = charge({}, fetchStandard([]));
  const liste = lit(env, "agendaCalendarsFrom(" + JSON.stringify(CALENDARS.data) + ")");
  verifie("les salles (permission none) sont ecartees", liste.every((c) => c.permission !== "none") && liste.length === 5, JSON.stringify(liste.map((c) => c.name)));
  verifie("l'agenda par defaut vient en tete", liste[0].id === 132129, liste[0].name);
  verifie("mes agendas d'abord, puis ecriture, puis lecture",
    liste.map((c) => c.permission).join(",") === "owner,owner,readwrite,read,read", liste.map((c) => c.permission).join(","));
  verifie("en lecture, l'agenda affiche passe avant l'autre", liste[3].name === "Jours feries", liste[3].name);
  verifie("mon identite vient de l'agenda par defaut dont je suis owner",
    lit(env, "agendaMyUserIdFrom(" + JSON.stringify(liste) + ")") === MOI);
  const sansDefaut = liste.map((c) => Object.assign({}, c, { isDefault: false }));
  verifie("sans agenda par defaut, le premier owner fait foi",
    lit(env, "agendaMyUserIdFrom(" + JSON.stringify(sansDefaut) + ")") === MOI);
}

/* ================= 2. La regle du rendez-vous qui fait silence ================= */
async function testRegle() {
  const env = charge({}, fetchStandard([]));
  const me = JSON.stringify({ userId: MOI, email: "" });
  const est = (e) => lit(env, "agendaIsMeeting(" + JSON.stringify(e) + ", " + me + ")");
  const base = ev(1, T0, T0 + 60 * MIN, { attendees: [att(1), att(MOI)] });
  verifie("deux participants dont moi, accepte : silence", est(base) === true);
  verifie("journee entiere : jamais", est(Object.assign({}, base, { fullday: true, start: "2026-09-16", end: "2026-09-17" })) === false);
  verifie("marque libre : jamais", est(Object.assign({}, base, { freebusy: "free" })) === false);
  verifie("un seul participant : jamais", est(Object.assign({}, base, { attendees: [att(MOI)] })) === false);
  verifie("aucun participant : jamais", est(Object.assign({}, base, { attendees: [] })) === false);
  verifie("deux participants sans moi : jamais", est(Object.assign({}, base, { attendees: [att(1), att(2)] })) === false);
  verifie("moi mais decline : jamais", est(Object.assign({}, base, { attendees: [att(1), att(MOI, "DECLINED")] })) === false);
  verifie("moi en attente de reponse : silence quand meme", est(Object.assign({}, base, { attendees: [att(1), att(MOI, "NEEDS-ACTION")] })) === true);
  verifie("moi reconnu par origin_attendee_email sans user_id",
    est(Object.assign({}, base, { origin_attendee_email: "Moi@Infomaniak.com", attendees: [att(1), { address: "moi@infomaniak.com", state: "ACCEPTED" }] })) === true);
  const meEmail = JSON.stringify({ userId: 0, email: "moi@infomaniak.com" });
  verifie("moi reconnu par l'adresse du profil",
    lit(env, "agendaIsMeeting(" + JSON.stringify(Object.assign({}, base, { attendees: [att(1), { address: "MOI@infomaniak.com", state: "ACCEPTED" }] })) + ", " + meEmail + ")") === true);

  verifie("le format naif exige par l'API", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(lit(env, "agendaFmt(new Date(" + T0 + "))")));
  verifie("un instant ISO avec decalage se lit", lit(env, "agendaParseTs('2026-10-02T11:00:00+02:00')") === Date.UTC(2026, 9, 2, 9, 0, 0));
  verifie("une chaine vide vaut zero", lit(env, "agendaParseTs('')") === 0);
  const n = lit(env, "agendaNormalize(" + JSON.stringify(ev(5, T0, T0 + MIN, { meet_room_url: "", external_meet_room_urls: ["https://kmeet.infomaniak.com/abc"], attendees: [att(1), att(MOI)] })) + ")");
  verifie("le lien externe sert quand la salle kMeet manque", n.url === "https://kmeet.infomaniak.com/abc" && n.people === 2, JSON.stringify(n));
  const n2 = lit(env, "agendaNormalize(" + JSON.stringify(ev(6, T0, T0 + MIN, { meet_room_url: "javascript:alert(1)" })) + ")");
  verifie("un lien qui n'est pas http(s) est ecarte", n2.url === "", n2.url);
}

/* ================= 3. Connexion et choix de l'agenda ================= */
async function testConnexion() {
  const evenements = [ev(10, T0 + 30 * MIN, T0 + 90 * MIN, { attendees: [att(1), att(MOI)] })];
  const env = charge({ kdriveTokenEnc: null }, fetchStandard(evenements));
  const r = await lit(env, "agendaConnect('jeton-de-test')");
  verifie("plusieurs agendas lisibles demandent un choix", r && r.ok && r.needsChoice === true, JSON.stringify(r));
  verifie("la liste proposee est triee, defaut en tete", r.calendars && r.calendars[0].id === 132129);
  verifie("le jeton saisi est chiffre sous sa propre cle", !!env.store.agendaTokenEnc && !env.store.kdriveTokenEnc);
  verifie("le jeton n'est jamais en clair dans le stockage", JSON.stringify(env.store).indexOf("jeton-de-test") === -1);
  verifie("mon identite est memorisee", env.store.agendaMyUserId === MOI);
  verifie("sans user_info, pas d'adresse, et ce n'est pas une erreur", env.store.agendaMyEmail === "" && !env.store.agendaLastError);
  verifie("rien n'est choisi tant que l'utilisateur n'a pas tranche", !env.store.agendaCalendarId);

  const c = await lit(env, "agendaChoose(132129, 'Thomas (pro)')");
  verifie("le choix est accepte", c && c.ok === true, JSON.stringify(c));
  verifie("l'agenda choisi est memorise et l'interrupteur allume",
    env.store.agendaCalendarId === 132129 && env.store.agendaCalendarName === "Thomas (pro)" && env.store.agendaEnabled === true);
  const appel = env.journal.fetches.find((f) => f.url.indexOf("/1/calendar/pim/event") >= 0);
  verifie("la liste est demandee avec les participants", !!appel && appel.url.indexOf("with=attendees") >= 0, appel && appel.url);
  verifie("la fenetre est au format naif, jamais ISO", !!appel && /from=\d{4}-\d{2}-\d{2}(%20| )\d{2}%3A\d{2}%3A\d{2}/.test(appel.url), appel && appel.url);
  verifie("le porteur est le jeton saisi", !!appel && appel.init.headers && appel.init.headers.Authorization === "Bearer jeton-de-test");
  verifie("le cache ne garde que les rendez-vous qui font silence, normalises",
    env.store.agendaCache && env.store.agendaCache.events.length === 1 && env.store.agendaCache.events[0].start === T0 + 30 * MIN, JSON.stringify(env.store.agendaCache));
  verifie("l'etat annonce le prochain rendez-vous",
    env.store.agendaState && env.store.agendaState.nextStart === T0 + 30 * MIN && env.store.agendaState.inUntil === 0, JSON.stringify(env.store.agendaState));
  verifie("l'alarme des trois minutes est posee a la seconde",
    env.journal.alarmes["kz-agenda-warn"] && env.journal.alarmes["kz-agenda-warn"].when === T0 + 27 * MIN, JSON.stringify(env.journal.alarmes));

  // Un seul agenda lisible : pas de choix, connexion directe.
  const unSeul = { result: "success", data: { calendars: [CALENDARS.data.calendars[4]] } };
  const env2 = charge({}, (url) => url.indexOf("/pim/calendar") >= 0 ? reponse(200, unSeul) : fetchStandard([])(url));
  const r2 = await lit(env2, "agendaConnect('jeton')");
  verifie("un seul agenda se choisit tout seul", r2 && r2.ok && !r2.needsChoice && env2.store.agendaCalendarId === 132129, JSON.stringify(r2));

  // 2026-09-29 : un jeton par usage. Un jeton qui ouvre aussi le mail ou
  // kDrive est refuse, et rien n'est enregistre.
  const SCOPE = (nom) => reponse(403, { result: "error", error: { code: "all_scopes", description: "This method require this specific scope: \"" + nom + "\"" } });
  const fetchLarge = (extras) => (url) => {
    if (url.indexOf("mail.infomaniak.com/api/mailbox") >= 0) return extras.indexOf("mail") >= 0 ? reponse(200, { result: "success", data: [{ uuid: "u", email: "a@b.ch" }] }) : SCOPE("workspace:mail");
    if (url.indexOf("/2/drive/users/current/drives") >= 0) return extras.indexOf("kdrive") >= 0 ? reponse(200, { result: "success", data: [] }) : SCOPE("drive");
    return fetchStandard([])(url);
  };
  const env3 = charge({}, fetchLarge(["mail", "kdrive"]));
  const r3 = await lit(env3, "agendaConnect('jeton-trop-large')");
  verifie("un jeton qui ouvre aussi le mail et kDrive est refuse, en le disant", r3 && r3.ok === false && r3.error === "too_broad" && r3.extras.join(",") === "mail,kdrive", JSON.stringify(r3));
  verifie("et il n'est pas enregistre", !env3.store.agendaTokenEnc && JSON.stringify(env3.store).indexOf("jeton-trop-large") === -1);
  const env3b = charge({}, fetchLarge([]));
  const r3b = await lit(env3b, "agendaConnect('jeton-agenda')");
  verifie("un jeton limite a l'agenda passe", r3b && r3b.ok === true && !!env3b.store.agendaTokenEnc, JSON.stringify(r3b));
  verifie("les sondes sont de simples lectures, sans cookies", env3b.journal.fetches.every((f) => (f.init.method || "GET") === "GET" && f.init.credentials === "omit"));
  const r3c = await lit(env3b, "agendaConnect('')");
  verifie("sans saisie, le jeton deja enregistre sert (changer d'agendas)", r3c && r3c.ok === true, JSON.stringify(r3c));
  const st = await lit(env3b, "agendaState()");
  verifie("l'etat dit qu'un jeton est la, sans notion de jeton partage", st.hasToken === true && st.tokenShared === undefined, JSON.stringify(st));

  // Aucun jeton du tout.
  const env4 = charge({}, fetchStandard([]));
  const r4 = await lit(env4, "agendaConnect('')");
  verifie("sans aucun jeton, erreur explicite", r4 && r4.ok === false && r4.error === "empty_token", JSON.stringify(r4));

  // Le perimetre manque : 403 all_scopes sur la liste des agendas.
  const env5 = charge({}, () => reponse(403, { result: "error", error: { code: "all_scopes", description: "scope" } }));
  const r5 = await lit(env5, "agendaConnect('jeton')");
  verifie("un jeton sans le perimetre calendar est reconnu comme tel", r5 && r5.error === "missing_scope", JSON.stringify(r5));
  verifie("l'erreur est memorisee pour le popup", env5.store.agendaLastError === "missing_scope");
  const env6 = charge({}, () => reponse(401, { result: "error", error: { code: "unauthorized" } }));
  const r6 = await lit(env6, "agendaConnect('jeton')");
  verifie("un jeton faux reste un jeton invalide", r6 && r6.error === "invalid_token", JSON.stringify(r6));
}

/* ================= 4. Le silence pendant le rendez-vous ================= */
async function testSilence() {
  const cache = { at: T0, events: [{ id: 1, title: "Point", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "", people: 2 }] };
  const base = { intervalMinutes: 30, statsDaily: {}, agendaEnabled: true, agendaCalendarId: 132129, agendaCache: cache,
                 passages: true, animMode: "always", screenTimezone: "Europe/Zurich", muteInCalls: false, pauseWhenIdle: false };

  const env = charge(base, fetchStandard([]));
  env.horloge.now = T0 + 20 * MIN;
  await lit(env, "trigger({ respectMute: true })");
  verifie("pendant le rendez-vous, aucun rappel n'est envoye a la page", env.journal.messages.length === 0, JSON.stringify(env.journal.messages));
  env.horloge.now = T0 + 50 * MIN;
  await lit(env, "trigger({ respectMute: true })");
  verifie("apres le rendez-vous, le rappel repart", env.journal.messages.length === 1 && env.journal.messages[0].type === "kz-show");
  env.journal.messages.length = 0;
  env.horloge.now = T0 + 20 * MIN;
  await lit(env, "trigger({ force: true })");
  verifie("le bouton de test du popup (force) passe quand meme", env.journal.messages.length === 1);

  const envOff = charge(Object.assign({}, base, { agendaEnabled: false }), fetchStandard([]));
  envOff.horloge.now = T0 + 20 * MIN;
  await lit(envOff, "trigger({ respectMute: true })");
  verifie("interrupteur eteint, le cache n'a aucun effet", envOff.journal.messages.length === 1);

  const cfg = JSON.stringify(Object.assign({}, base, { pausedUntil: 0, focusMode: false, passageFrequency: "normal" }));
  const etat = JSON.stringify({ day: "", count: 0, last: 0, lastReminder: 0 });
  verifie("passageBlocked rend le motif agenda pendant le rendez-vous",
    lit(env, "passageBlocked(" + cfg + ", " + etat + ", " + (T0 + 20 * MIN) + ", 'Europe/Zurich')") === "agenda");
  verifie("passageBlocked laisse passer en dehors",
    lit(env, "passageBlocked(" + cfg + ", " + etat + ", " + (T0 + 50 * MIN) + ", 'Europe/Zurich')") === "");
  const cfgOff = JSON.stringify(Object.assign({}, JSON.parse(cfg), { agendaEnabled: false }));
  verifie("passageBlocked ignore le cache si l'interrupteur est eteint",
    lit(env, "passageBlocked(" + cfgOff + ", " + etat + ", " + (T0 + 20 * MIN) + ", 'Europe/Zurich')") === "");
  // Le bouton de test des passages ne contourne pas l'agenda.
  env.journal.messages.length = 0;
  env.horloge.now = T0 + 20 * MIN;
  await lit(env, "triggerPassage({ test: true })");
  verifie("le passage de test respecte le rendez-vous", env.journal.messages.length === 0);

  // agendaBusyAt aux bornes.
  const c = JSON.stringify(cache);
  verifie("occupe des la premiere seconde", !!lit(env, "agendaBusyAt(" + c + ", " + (T0 + 10 * MIN) + ")"));
  verifie("libre a la fin exacte", lit(env, "agendaBusyAt(" + c + ", " + (T0 + 40 * MIN) + ")") === null);
  verifie("un cache absent ne bloque rien", lit(env, "agendaBusyAt(null, " + T0 + ")") === null);

  // L'etat suit le tick sans rafraichir si le cache est frais (moins de cinq
  // minutes), et rafraichit au-dela. Il faut un jeton pour que l'appel parte.
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton')");
  env.store.agendaCache = Object.assign({}, cache, { at: T0 + 18 * MIN });
  env.horloge.now = T0 + 20 * MIN;
  env.journal.fetches.length = 0;
  await lit(env, "agendaTick()");
  verifie("le tick met l'etat a jour", env.store.agendaState.inUntil === T0 + 40 * MIN && env.store.agendaState.inTitle === "Point", JSON.stringify(env.store.agendaState));
  verifie("le tick ne rappelle pas l'API tant que le cache a moins de cinq minutes", env.journal.fetches.length === 0, String(env.journal.fetches.length));
  env.horloge.now = T0 + 24 * MIN;
  await lit(env, "agendaTick()");
  verifie("passe cinq minutes, le tick rafraichit", env.journal.fetches.length === 1, String(env.journal.fetches.length));

  // L'ordre des interdits : ceux qui protegent l'utilisateur (pause, agenda)
  // passent avant ceux que le bouton de test contourne (horaire). A 21 h en
  // pause, le motif est "pause", jamais "horaire", sinon le test jouait.
  const nuit = Date.UTC(2026, 8, 16, 19, 0, 0); // 21 h a Zurich
  const cfgNuitPause = JSON.stringify(Object.assign({}, JSON.parse(cfg), { pausedUntil: nuit + 3600000 }));
  verifie("a 21 h en pause, le motif est la pause, jamais l'horaire contournable",
    lit(env, "passageBlocked(" + cfgNuitPause + ", " + etat + ", " + nuit + ", 'Europe/Zurich')") === "pause");
  const cfgNuitAgenda = JSON.stringify(Object.assign({}, JSON.parse(cfg), {
    agendaCache: { at: nuit, events: [{ id: 9, title: "Soir", start: nuit - MIN, end: nuit + 30 * MIN, url: "", people: 2 }] }
  }));
  verifie("a 21 h en rendez-vous, le motif est l'agenda, jamais l'horaire",
    lit(env, "passageBlocked(" + cfgNuitAgenda + ", " + etat + ", " + nuit + ", 'Europe/Zurich')") === "agenda");
  verifie("a 21 h sans autre interdit, l'horaire reste le motif",
    lit(env, "passageBlocked(" + cfg + ", " + etat + ", " + nuit + ", 'Europe/Zurich')") === "horaire");
}


/* ================= 4b. Les creux et le temps en reunion, 2026-09-22 ================= */
async function testCreux() {
  const TZ = "Europe/Zurich";
  const cle = (tz, ms) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(ms));
  const cache = { at: T0, events: [
    { id: 1, title: "A", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "", people: 2, meeting: true },
    { id: 2, title: "B", start: T0 + 45 * MIN, end: T0 + 70 * MIN, url: "", people: 3, meeting: true },
    { id: 3, title: "Solo", start: T0 + 80 * MIN, end: T0 + 110 * MIN, url: "", people: 1, meeting: false }
  ] };
  const base = { intervalMinutes: 30, statsDaily: {}, agendaEnabled: true, agendaCalendarId: 132129, agendaCache: cache,
                 passages: true, animMode: "always", screenTimezone: TZ, muteInCalls: false, pauseWhenIdle: false };
  const env = charge(base, fetchStandard([]));
  const creux = (ms) => lit(env, "agendaNextFreeSlot(" + JSON.stringify(cache) + ", " + ms + ")");
  verifie("dix minutes de constantes, une minute de marge, six heures au plus",
    lit(env, "AGENDA_GAP_MIN_MS") === 10 * MIN && lit(env, "AGENDA_GAP_PAD_MS") === MIN && lit(env, "AGENDA_SHIFT_MAX_MS") === 6 * 60 * MIN);
  verifie("libre avec dix minutes devant : tout de suite", creux(T0 - 20 * MIN) === T0 - 20 * MIN);
  verifie("libre mais la reunion commence dans 4 min : apres elle, et B est collee, donc apres B", creux(T0 + 6 * MIN) === T0 + 70 * MIN);
  verifie("en pleine reunion A, le creux A-B fait 5 min, trop court : apres B", creux(T0 + 20 * MIN) === T0 + 70 * MIN);
  verifie("apres B, dix minutes avant le bloc solo qui ne compte pas : tout de suite", creux(T0 + 70 * MIN) === T0 + 70 * MIN);
  verifie("pendant le bloc solo, libre : il n'est pas une reunion", creux(T0 + 90 * MIN) === T0 + 90 * MIN);
  verifie("un cache absent rend l'instant meme", lit(env, "agendaNextFreeSlot(null, " + T0 + ")") === T0);
  const long = { at: T0, events: [{ id: 9, title: "Marathon", start: T0, end: T0 + 7 * 60 * MIN, url: "", people: 4 }] };
  verifie("aucun creux dans les six heures : null", lit(env, "agendaNextFreeSlot(" + JSON.stringify(long) + ", " + (T0 + MIN) + ")") === null);
  const chevauche = { at: T0, events: [
    { id: 1, title: "A", start: T0, end: T0 + 30 * MIN, url: "", people: 2 },
    { id: 2, title: "B", start: T0 + 20 * MIN, end: T0 + 50 * MIN, url: "", people: 2 }
  ] };
  verifie("deux reunions qui se chevauchent : le creux s'ouvre a la fin la plus tardive", lit(env, "agendaNextFreeSlot(" + JSON.stringify(chevauche) + ", " + (T0 + 5 * MIN) + ")") === T0 + 50 * MIN);

  // Le declenchement : en reunion, le rappel est DECALE, pas saute.
  env.horloge.now = T0 + 20 * MIN;
  await lit(env, "trigger({ respectMute: true })");
  verifie("en reunion, aucun rappel n'est envoye", env.journal.messages.length === 0);
  const al = env.journal.alarmes["kz-move"];
  verifie("mais l'alarme est reposee au premier creux, une minute apres la fin de B (51 min)",
    !!al && al.delayInMinutes === 51 && al.periodInMinutes === 30, JSON.stringify(al));
  env.horloge.now = T0 + 6 * MIN;
  delete env.journal.alarmes["kz-move"];
  await lit(env, "trigger({ respectMute: true })");
  verifie("juste avant une reunion (4 min), pas de rappel, decale apres B (65 min)",
    env.journal.messages.length === 0 && env.journal.alarmes["kz-move"] && env.journal.alarmes["kz-move"].delayInMinutes === 65, JSON.stringify(env.journal.alarmes["kz-move"]));
  delete env.journal.alarmes["kz-move"];
  env.horloge.now = T0 + 71 * MIN;
  await lit(env, "trigger({ respectMute: true })");
  verifie("dans le creux, le rappel part et l'alarme n'est pas touchee", env.journal.messages.length === 1 && env.journal.messages[0].type === "kz-show" && !env.journal.alarmes["kz-move"]);
  env.journal.messages.length = 0;
  const envLong = charge(Object.assign({}, base, { agendaCache: long }), fetchStandard([]));
  envLong.horloge.now = T0 + MIN;
  await lit(envLong, "trigger({ respectMute: true })");
  verifie("aucun creux dans les six heures : saute, sans reposer l'alarme", envLong.journal.messages.length === 0 && !envLong.journal.alarmes["kz-move"]);
  const envOff = charge(Object.assign({}, base, { agendaEnabled: false }), fetchStandard([]));
  envOff.horloge.now = T0 + 20 * MIN;
  await lit(envOff, "trigger({ respectMute: true })");
  verifie("silence eteint : rien n'est decale, le rappel passe", envOff.journal.messages.length === 1 && !envOff.journal.alarmes["kz-move"]);
  env.horloge.now = T0 + 20 * MIN;
  await lit(env, "trigger({ force: true })");
  verifie("le bouton du popup (force) passe quand meme, sans decaler", env.journal.messages.length === 1);

  // Le temps en reunion par jour.
  const jour = cle(TZ, T0 + 10 * MIN);
  const accrue = (nowMs, daily) => lit(env, "agendaAccrueInto(" + JSON.stringify(daily || {}) + ", " + JSON.stringify(cache) + ", " + nowMs + ", '" + TZ + "')");
  let d = accrue(T0 + 20 * MIN);
  // 2026-09-26 : un intervalle [debut, fin ecoulee] par reunion, l'union se fait a la lecture.
  const iv = (k) => d[jour] && d[jour][k];
  verifie("en cours, A garde son intervalle ecoule, B et le bloc solo rien", JSON.stringify(iv("1@" + (T0 + 10 * MIN))) === JSON.stringify([T0 + 10 * MIN, T0 + 20 * MIN]) && Object.keys(d[jour]).length === 1, JSON.stringify(d));
  d = accrue(T0 + 200 * MIN, d);
  verifie("passees, A et B gardent leurs intervalles complets, le bloc solo n'apparait jamais", JSON.stringify(iv("1@" + (T0 + 10 * MIN))) === JSON.stringify([T0 + 10 * MIN, T0 + 40 * MIN]) && JSON.stringify(iv("2@" + (T0 + 45 * MIN))) === JSON.stringify([T0 + 45 * MIN, T0 + 70 * MIN]) && Object.keys(d[jour]).length === 2, JSON.stringify(d));
  d = accrue(T0 + 300 * MIN, d);
  verifie("recompter ne double jamais", Object.keys(d[jour]).length === 2 && JSON.stringify(iv("1@" + (T0 + 10 * MIN))) === JSON.stringify([T0 + 10 * MIN, T0 + 40 * MIN]));
  const vieux = {}; for (let i = 0; i < 405; i++) vieux[new Date(Date.UTC(2020, 0, 1) + i * 24 * 60 * MIN).toISOString().slice(0, 10)] = { x: 1 };
  const taille = Object.keys(accrue(T0 + 300 * MIN, vieux)).length;
  verifie("au plus 400 jours gardes, les plus anciens partent", taille === 400, String(taille));

  env.horloge.now = T0 + 200 * MIN;
  env.store.meetingDaily = {};
  await lit(env, "agendaTick()");
  verifie("le tic ecrit le temps en reunion du jour", env.store.meetingDaily[jour] && JSON.stringify(env.store.meetingDaily[jour]["2@" + (T0 + 45 * MIN)]) === JSON.stringify([T0 + 45 * MIN, T0 + 70 * MIN]), JSON.stringify(env.store.meetingDaily));
  const ecritsAvant = env.journal.ecrits ? env.journal.ecrits.length : -1;
  await lit(env, "agendaAccrueMeetings(" + JSON.stringify(cache) + ", " + (T0 + 200 * MIN) + ")");
  verifie("sans changement, rien n'est reecrit", ecritsAvant < 0 || env.journal.ecrits.length === ecritsAvant);

  // L'historique de 90 jours a la connexion.
  const envH = charge({ agendaEnabled: true, agendaCalendarId: 0, agendaMyUserId: MOI, statsDaily: {} }, fetchStandard([
    ev(31, T0 - 30 * 24 * 60 * MIN, T0 - 30 * 24 * 60 * MIN + 60 * MIN, { attendees: [att(1), att(MOI)] }),
    ev(32, T0 - 10 * 24 * 60 * MIN, T0 - 10 * 24 * 60 * MIN + 45 * MIN, { attendees: [att(MOI)] })
  ]));
  envH.store.agendaTokenEnc = await lit(envH, "secretEncrypt('jeton')");
  envH.horloge.now = T0;
  await lit(envH, "agendaChoose(132129, 'Thomas (pro)')");
  const urls = envH.journal.fetches.filter((f) => f.url.indexOf("/pim/event") >= 0).map((f) => decodeURIComponent(f.url));
  verifie("la connexion fait deux lectures d'evenements, la fenetre courante et l'historique", urls.length === 2, JSON.stringify(urls));
  const hist = urls.find((u) => u.indexOf("from=" + lit(envH, "agendaFmt(new Date(" + (T0 - 90 * 24 * 60 * MIN) + "))")) >= 0);
  verifie("l'historique remonte exactement 90 jours et s'arrete a maintenant", !!hist && hist.indexOf("to=" + lit(envH, "agendaFmt(new Date(" + T0 + "))")) >= 0, JSON.stringify(urls));
  verifie("la constante vaut 90 jours", lit(envH, "AGENDA_BACKFILL_DAYS") === 90);
  const md = envH.store.meetingDaily || {};
  const j31 = cle(TZ, T0 - 30 * 24 * 60 * MIN);
  verifie("la reunion d'il y a 30 jours est comptee, une heure", md[j31] && Object.values(md[j31])[0][1] - Object.values(md[j31])[0][0] === 60 * MIN, JSON.stringify(md));
  verifie("le rendez-vous solo d'il y a 10 jours n'est pas compte", Object.keys(md).length === 1, JSON.stringify(Object.keys(md)));
  verifie("meetingDaily est dans les DEFAULTS", JSON.stringify(lit(envH, "DEFAULTS.meetingDaily")) === "{}");
}

/* ================= 5. Le rappel trois minutes avant ================= */
async function testRappel() {
  const debut = T0 + 30 * MIN;
  const cache = { at: T0, events: [
    { id: 1, title: "Point produit", start: debut, end: debut + 30 * MIN, url: "https://kmeet.infomaniak.com/abc", people: 3 },
    { id: 2, title: "Suite", start: debut + 60 * MIN, end: debut + 90 * MIN, url: "", people: 2 }
  ] };
  const base = { agendaEnabled: true, agendaWarn: true, agendaCalendarId: 132129, agendaCache: cache, agendaWarned: [] };

  const env = charge(base, fetchStandard([]));
  const when = await lit(env, "agendaScheduleWarn(" + JSON.stringify(cache) + ", " + T0 + ")");
  verifie("l'alarme vise trois minutes avant le premier rendez-vous", when === debut - 3 * MIN && env.journal.alarmes["kz-agenda-warn"].when === when);

  // L'alarme sonne, la page repond qu'elle affiche.
  env.horloge.now = debut - 3 * MIN;
  await lit(env, "agendaWarnFire()");
  const m = env.journal.messages.find((x) => x.type === "kz-meeting-soon");
  verifie("la page recoit le rendez-vous", !!m, JSON.stringify(env.journal.messages));
  verifie("avec son titre, son debut, son lien et ses participants",
    m && m.title === "Point produit" && m.start === debut && m.url === "https://kmeet.infomaniak.com/abc" && m.people === 3 && m.minutes === 3, JSON.stringify(m));
  verifie("aucune notification systeme quand la page a affiche", env.journal.notifs.length === 0);
  verifie("le rendez-vous est marque comme annonce", env.store.agendaWarned.length === 1);
  verifie("l'alarme suivante vise le second rendez-vous",
    env.journal.alarmes["kz-agenda-warn"] && env.journal.alarmes["kz-agenda-warn"].when === debut + 57 * MIN, JSON.stringify(env.journal.alarmes));
  env.journal.messages.length = 0;
  await lit(env, "agendaWarnFire()");
  verifie("une seconde sonnerie n'annonce pas deux fois", env.journal.messages.length === 0);

  // La page decline (un rappel d'habitude est deja a l'ecran) : notification.
  const env2 = charge(base, fetchStandard([]), { reponseOnglet: { shown: false } });
  env2.horloge.now = debut - 3 * MIN;
  await lit(env2, "agendaWarnFire()");
  verifie("si la page decline, une notification systeme prend le relais",
    env2.journal.notifs.length === 1 && env2.journal.notifs[0].o.type === "basic", JSON.stringify(env2.journal.notifs));
  verifie("la notification porte le titre et l'heure du rendez-vous",
    env2.journal.notifs[0].o.message.indexOf("Point produit") === 0 && /\d{2}:\d{2}$/.test(env2.journal.notifs[0].o.message), env2.journal.notifs[0].o.message);

  // Aucun onglet http(s) : notification aussi, sans meme tenter la page.
  const env3 = charge(base, fetchStandard([]), { sansOnglet: true });
  env3.horloge.now = debut - 3 * MIN;
  await lit(env3, "agendaWarnFire()");
  verifie("sans onglet eligible, notification directe", env3.journal.notifs.length === 1 && env3.journal.messages.length === 0);

  // Une alarme en retard (machine sortie de veille) : les rendez-vous pas
  // encore commences sont annonces, ceux deja commences sont passes.
  // Il est debut + 58 min : le premier a commence, le second commence dans
  // deux minutes, son seuil des trois minutes est depasse de peu.
  const env4 = charge(base, fetchStandard([]));
  env4.horloge.now = debut + 58 * MIN;
  await lit(env4, "agendaWarnFire()");
  const titres = env4.journal.messages.map((x) => x.title);
  verifie("en retard, seul le rendez-vous a venir est annonce", titres.length === 1 && titres[0] === "Suite", JSON.stringify(titres));

  // L'interrupteur du rappel eteint : rien, et aucune alarme.
  const env5 = charge(Object.assign({}, base, { agendaWarn: false }), fetchStandard([]));
  verifie("rappel desactive, aucune alarme posee", (await lit(env5, "agendaScheduleWarn(" + JSON.stringify(cache) + ", " + T0 + ")")) === null && !env5.journal.alarmes["kz-agenda-warn"]);
  env5.horloge.now = debut - 3 * MIN;
  await lit(env5, "agendaWarnFire()");
  verifie("rappel desactive, la sonnerie ne fait rien", env5.journal.messages.length === 0 && env5.journal.notifs.length === 0);

  // Le clic sur la notification ouvre la visio, et seulement un lien du cache.
  const env6 = charge(base, fetchStandard([]));
  await new Promise((r) => { env6.ecouteurs.notifClic("kz-agenda-1@" + debut); setTimeout(r, 60); });
  verifie("un clic sur la notification ouvre la visio", env6.journal.onglets.length === 1 && env6.journal.onglets[0] === "https://kmeet.infomaniak.com/abc", JSON.stringify(env6.journal.onglets));
  verifie("kz-open-url refuse une adresse absente du cache", (await lit(env6, "agendaOpenUrl('https://evil.example/x')")) === false && env6.journal.onglets.length === 1);
  verifie("kz-open-url ouvre une adresse du cache", (await lit(env6, "agendaOpenUrl('https://kmeet.infomaniak.com/abc')")) === true);

  // Sur une page de visio (hote en sourdine), jamais de bulle ni d'injection :
  // l'utilisateur est peut-etre deja en appel, et injecter les scripts ferait
  // jouer le coucou de visio en plein appel. La notification prend le relais.
  const env7 = charge(Object.assign({}, base, { muteInCalls: true, mutedPatterns: ["kmeet.infomaniak.com"] }), fetchStandard([]),
    { ongletUrl: "https://kmeet.infomaniak.com/abc-def" });
  env7.horloge.now = debut - 3 * MIN;
  await lit(env7, "agendaWarnFire()");
  verifie("sur une page de visio, aucune bulle n'est tentee et rien n'est injecte",
    env7.journal.messages.length === 0 && env7.journal.injections === 0, JSON.stringify(env7.journal.messages));
  verifie("sur une page de visio, la notification systeme prend le relais", env7.journal.notifs.length === 1);
}

/* ================= 5b. Rien en veille, 2026-09-23 ================= */
// Ecran verrouille ou machine inactive depuis dix minutes : ni rappel de
// debut ni rappel de fin. Rien n'est marque comme annonce, l'alarme revient
// une minute plus tard, et le rappel part au reveil s'il est encore utile.
async function testVeille() {
  const debut = T0 + 30 * MIN;
  const cache = { at: T0, events: [{ id: 1, title: "Point", start: debut, end: debut + 30 * MIN, url: "", people: 2, meeting: true }] };
  const base = { agendaEnabled: true, agendaWarn: true, agendaEndWarn: true, agendaCalendarId: 132129, agendaCache: cache, agendaWarned: [], agendaEndWarned: [] };
  verifie("dix minutes sans activite valent une veille, une minute avant de reessayer",
    lit(charge(base, fetchStandard([])), "AGENDA_ASLEEP_SECONDS") === 600 && lit(charge(base, fetchStandard([])), "AGENDA_RETRY_ASLEEP_MS") === 60000);

  for (const etat of ["locked", "idle"]) {
    const env = charge(base, fetchStandard([]), { etatVeille: etat });
    env.horloge.now = debut - 3 * MIN;
    await lit(env, "agendaWarnFire()");
    verifie(etat + " : aucun rappel de debut, ni bulle ni notification", env.journal.messages.length === 0 && env.journal.notifs.length === 0);
    verifie(etat + " : le rendez-vous n'est pas marque comme annonce", (env.store.agendaWarned || []).length === 0);
    verifie(etat + " : l'alarme de debut revient une minute plus tard", env.journal.alarmes["kz-agenda-warn"] && env.journal.alarmes["kz-agenda-warn"].when === debut - 3 * MIN + 60000, JSON.stringify(env.journal.alarmes));
    verifie(etat + " : la veille est demandee au seuil de dix minutes", env.journal.veille.indexOf(600) >= 0, JSON.stringify(env.journal.veille));
    env.horloge.now = debut + 25 * MIN;
    await lit(env, "agendaEndFire()");
    verifie(etat + " : aucun rappel de fin non plus", env.journal.messages.length === 0 && (env.store.agendaEndWarned || []).length === 0);
    verifie(etat + " : l'alarme de fin revient une minute plus tard", env.journal.alarmes["kz-agenda-end"] && env.journal.alarmes["kz-agenda-end"].when === debut + 25 * MIN + 60000);
  }

  // Reveil avant le debut : le rappel part au tour suivant.
  const env = charge(base, fetchStandard([]), { etatVeille: "locked" });
  env.horloge.now = debut - 3 * MIN;
  await lit(env, "agendaWarnFire()");
  env.setVeille("active");
  env.horloge.now = debut - 2 * MIN;
  await lit(env, "agendaWarnFire()");
  const m = env.journal.messages.find((x) => x.type === "kz-meeting-soon");
  verifie("reveille avant le debut, le rappel part avec le temps restant reel", !!m && m.minutes === 2, JSON.stringify(m));
  // Reveil apres le debut : plus rien, et l'alarme repart sur la suite.
  const env2 = charge(base, fetchStandard([]), { etatVeille: "locked" });
  env2.horloge.now = debut - 3 * MIN;
  await lit(env2, "agendaWarnFire()");
  env2.setVeille("active");
  env2.horloge.now = debut + 5 * MIN;
  await lit(env2, "agendaWarnFire()");
  verifie("reveille apres le debut, aucun rappel perime ne s'affiche", env2.journal.messages.length === 0 && env2.journal.notifs.length === 0);
  // Une API idle en erreur ne bloque jamais.
  const env3 = charge(base, fetchStandard([]));
  env3.contexte.chrome.idle.queryState = () => { throw new Error("pas d'idle"); };
  env3.horloge.now = debut - 3 * MIN;
  await lit(env3, "agendaWarnFire()");
  verifie("si l'API de veille echoue, le rappel part quand meme", env3.journal.messages.length === 1);
  // Le rappel d'habitude garde sa propre regle (Quand tu quittes le clavier).
  const env4 = charge(Object.assign({}, base, { pauseWhenIdle: false, statsDaily: {}, intervalMinutes: 30, agendaEnabled: false }), fetchStandard([]), { etatVeille: "idle" });
  env4.horloge.now = debut - 20 * MIN;
  await lit(env4, "trigger({ respectMute: true })");
  verifie("la veille de l'agenda ne touche pas au rappel d'habitude, qui suit son propre reglage", env4.journal.messages.some((x) => x.type === "kz-show"));
}

/* ================= 6b. Le rappel cinq minutes avant la fin, 2026-09-21 ================= */
async function testFin() {
  const debut = T0 + 30 * MIN;
  const cache = { at: T0, events: [
    { id: 1, title: "Point produit", start: debut, end: debut + 30 * MIN, url: "https://kmeet.infomaniak.com/abc", people: 3 },
    { id: 2, title: "Suite", start: debut + 20 * MIN, end: debut + 45 * MIN, url: "", people: 2 }
  ] };
  const base = { agendaEnabled: true, agendaWarn: true, agendaEndWarn: true, agendaCalendarId: 132129, agendaCache: cache, agendaWarned: [], agendaEndWarned: [] };

  let env = charge(base, fetchStandard([]));
  verifie("la constante vaut cinq minutes", lit(env, "AGENDA_END_BEFORE_MS") === 5 * MIN);
  verifie("agendaEndWarn est allume par defaut", lit(env, "DEFAULTS.agendaEndWarn") === true);
  const when = await lit(env, "agendaScheduleEnd(" + JSON.stringify(cache) + ", " + T0 + ")");
  verifie("l'alarme de fin vise cinq minutes avant la fin la plus proche",
    when === debut + 25 * MIN && env.journal.alarmes["kz-agenda-end"] && env.journal.alarmes["kz-agenda-end"].when === when, JSON.stringify(env.journal.alarmes));
  verifie("l'alarme de fin a son propre nom, distincte de celle du debut", lit(env, "ALARM_AGENDA_END") === "kz-agenda-end" && !!env.journal.alarmes["kz-agenda-warn"] === false);

  // Un rendez-vous deja en cours compte : il est debut + 10, la fin la plus
  // proche est toujours celle du premier.
  const w2 = await lit(env, "agendaScheduleEnd(" + JSON.stringify(cache) + ", " + (debut + 10 * MIN) + ")");
  verifie("un rendez-vous en cours garde son alarme de fin", w2 === debut + 25 * MIN);

  // L'alarme sonne : la page recoit kz-meeting-end avec la fin.
  env.horloge.now = debut + 25 * MIN;
  await lit(env, "agendaEndFire()");
  const m = env.journal.messages.find((x) => x.type === "kz-meeting-end");
  verifie("la page recoit la fin de rendez-vous", !!m, JSON.stringify(env.journal.messages));
  verifie("avec son titre, son debut, sa fin, cinq minutes et le lien",
    m && m.title === "Point produit" && m.start === debut && m.end === debut + 30 * MIN && m.minutes === 5 && m.url === "https://kmeet.infomaniak.com/abc", JSON.stringify(m));
  verifie("aucun kz-meeting-soon n'est parti par erreur", !env.journal.messages.some((x) => x.type === "kz-meeting-soon"));
  verifie("la fin est marquee comme annoncee, a part des debuts",
    env.store.agendaEndWarned.length === 1 && (!env.store.agendaWarned || env.store.agendaWarned.length === 0));
  verifie("l'alarme suivante vise la fin du second rendez-vous",
    env.journal.alarmes["kz-agenda-end"] && env.journal.alarmes["kz-agenda-end"].when === debut + 40 * MIN, JSON.stringify(env.journal.alarmes["kz-agenda-end"]));
  env.journal.messages.length = 0;
  await lit(env, "agendaEndFire()");
  verifie("une seconde sonnerie n'annonce pas deux fois la meme fin", env.journal.messages.length === 0);

  // La page decline : notification systeme, texte de fin, identifiant propre.
  const env2 = charge(base, fetchStandard([]), { reponseOnglet: { shown: false } });
  env2.horloge.now = debut + 25 * MIN;
  await lit(env2, "agendaEndFire()");
  const n = env2.journal.notifs[0];
  verifie("si la page decline, une notification de fin prend le relais", env2.journal.notifs.length === 1, JSON.stringify(env2.journal.notifs));
  verifie("la notification dit Fin dans 5 min et l'heure de fin",
    !!n && n.o.title.indexOf("5") >= 0 && n.o.message.indexOf("Point produit") === 0 && /\d{2}:\d{2}$/.test(n.o.message) && n.o.title !== "Rendez-vous dans 5 min", n ? n.o.title + " / " + n.o.message : "");
  verifie("son identifiant distingue la fin du debut", !!n && n.id.indexOf("kz-agenda-end-") === 0, n && n.id);
  await new Promise((r) => { env2.ecouteurs.notifClic(n.id); setTimeout(r, 60); });
  verifie("un clic sur la notification de fin ouvre quand meme la visio", env2.journal.onglets.length === 1 && env2.journal.onglets[0] === "https://kmeet.infomaniak.com/abc", JSON.stringify(env2.journal.onglets));

  // Une fin deja passee n'est plus annoncee.
  const env3 = charge(base, fetchStandard([]));
  env3.horloge.now = debut + 31 * MIN;
  await lit(env3, "agendaEndFire()");
  verifie("en retard, une fin deja passee est passee sous silence, la suivante attend son heure",
    env3.journal.messages.length === 0 && env3.journal.notifs.length === 0, JSON.stringify(env3.journal.messages));
  verifie("mais l'alarme est reposee sur la fin suivante", env3.journal.alarmes["kz-agenda-end"] && env3.journal.alarmes["kz-agenda-end"].when === debut + 40 * MIN);

  // Interrupteur eteint : rien.
  const env4 = charge(Object.assign({}, base, { agendaEndWarn: false }), fetchStandard([]));
  verifie("rappel de fin desactive, aucune alarme", (await lit(env4, "agendaScheduleEnd(" + JSON.stringify(cache) + ", " + T0 + ")")) === null && !env4.journal.alarmes["kz-agenda-end"]);
  env4.horloge.now = debut + 25 * MIN;
  await lit(env4, "agendaEndFire()");
  verifie("rappel de fin desactive, la sonnerie ne fait rien", env4.journal.messages.length === 0 && env4.journal.notifs.length === 0);

  // Le rafraichissement pose les deux alarmes.
  const env5 = charge(Object.assign({}, base, { agendaCache: null }), fetchStandard([
    ev(7, T0 + 60 * MIN, T0 + 90 * MIN, { attendees: [att(1), att(MOI)] })
  ]));
  env5.store.agendaTokenEnc = await lit(env5, "secretEncrypt('jeton')");
  env5.store.agendaMyUserId = MOI;
  await lit(env5, "agendaRefresh({ force: true })");
  verifie("un rafraichissement pose l'alarme du debut ET celle de la fin",
    !!env5.journal.alarmes["kz-agenda-warn"] && !!env5.journal.alarmes["kz-agenda-end"], JSON.stringify(Object.keys(env5.journal.alarmes)));

  // La connexion vit aussi pour le seul rappel de fin.
  const env6 = charge({ agendaEnabled: false, agendaWarn: false, agendaEndWarn: true, agendaCalendarId: 132129, agendaCache: cache }, fetchStandard([]));
  verifie("le rappel de fin seul garde la connexion active", lit(env6, "agendaActif({ agendaCalendarId: 1, agendaEnabled: false, agendaWarn: false, agendaEndWarn: true })") === true);
  verifie("les trois eteints, la connexion dort", lit(env6, "agendaActif({ agendaCalendarId: 1, agendaEnabled: false, agendaWarn: false, agendaEndWarn: false })") === false);
  env6.journal.alarmes["kz-agenda-end"] = { when: debut + 25 * MIN };
  await envoie(env6, { type: "kz-save", payload: { agendaEndWarn: false } });
  verifie("eteindre le dernier interrupteur retire l'alarme de fin", !env6.journal.alarmes["kz-agenda-end"]);
  env6.store.agendaTokenEnc = await lit(env6, "secretEncrypt('jeton')");
  await envoie(env6, { type: "kz-save", payload: { agendaEndWarn: true } });
  verifie("le rallumer relit l'agenda tout de suite", env6.journal.fetches.some((f) => f.url.indexOf("/pim/event") >= 0));
  const st = await lit(env6, "agendaState()");
  verifie("l'etat expose endWarn au popup", st && st.endWarn === true);

  // 2026-09-21, seconde decision : le rappel de fin vaut pour TOUS les
  // evenements a horaire, meme ceux ou je suis seul. Le silence et le rappel
  // de debut gardent la regle du rendez-vous a deux ou plus.
  const est = (e) => lit(env, "agendaIsTimed(" + JSON.stringify(e) + ", " + JSON.stringify({ userId: MOI, email: "" }) + ")");
  verifie("un evenement sans aucun participant compte pour la fin", est(ev(1, T0, T0 + MIN, { attendees: [] })) === true);
  verifie("un evenement ou je suis seul compte pour la fin", est(ev(1, T0, T0 + MIN, { attendees: [att(MOI)] })) === true);
  verifie("une reunion a deux compte aussi pour la fin", est(ev(1, T0, T0 + MIN, { attendees: [att(1), att(MOI)] })) === true);
  verifie("une invitation que j'ai declinee ne compte pas", est(ev(1, T0, T0 + MIN, { attendees: [att(1), att(MOI, "DECLINED")] })) === false);
  verifie("une journee entiere ne compte pas", est(ev(1, T0, T0 + MIN, { fullday: true })) === false);
  verifie("un evenement marque libre compte quand meme pour la fin", est(ev(1, T0, T0 + MIN, { freebusy: "free", attendees: [] })) === true);

  const env8 = charge(Object.assign({}, base, { agendaCache: null, agendaEnabled: true, agendaWarn: true, statsDaily: {}, intervalMinutes: 30 }), fetchStandard([
    ev(11, T0 + 10 * MIN, T0 + 40 * MIN, { title: "Bloc solo", attendees: [att(MOI)] }),
    ev(12, T0 + 60 * MIN, T0 + 90 * MIN, { title: "Reunion", attendees: [att(1), att(MOI)] }),
    ev(13, T0 + 100 * MIN, T0 + 130 * MIN, { title: "Declinee", attendees: [att(1), att(MOI, "DECLINED")] }),
    ev(14, T0 + 200 * MIN, T0 + 230 * MIN, { title: "Journee", fullday: true })
  ]));
  env8.store.agendaTokenEnc = await lit(env8, "secretEncrypt('jeton')");
  env8.store.agendaMyUserId = MOI;
  await lit(env8, "agendaRefresh({ force: true })");
  const evs8 = env8.store.agendaCache.events;
  verifie("le cache garde le bloc solo et la reunion, ecarte la declinee et la journee entiere",
    evs8.length === 2 && evs8[0].title === "Bloc solo" && evs8[1].title === "Reunion", JSON.stringify(evs8.map((m) => m.title)));
  verifie("chaque entree porte son marqueur de reunion", evs8[0].meeting === false && evs8[1].meeting === true);
  verifie("pendant le bloc solo, l'agenda ne rend pas occupe", lit(env8, "agendaBusyAt(" + JSON.stringify(env8.store.agendaCache) + ", " + (T0 + 20 * MIN) + ")") === null);
  verifie("pendant la reunion, il rend occupe", !!lit(env8, "agendaBusyAt(" + JSON.stringify(env8.store.agendaCache) + ", " + (T0 + 70 * MIN) + ")"));
  verifie("l'alarme du debut vise la reunion, pas le bloc solo", env8.journal.alarmes["kz-agenda-warn"].when === T0 + 57 * MIN, JSON.stringify(env8.journal.alarmes["kz-agenda-warn"]));
  verifie("l'alarme de fin vise le bloc solo, la fin la plus proche", env8.journal.alarmes["kz-agenda-end"].when === T0 + 35 * MIN, JSON.stringify(env8.journal.alarmes["kz-agenda-end"]));
  verifie("l'etat du popup ne connait que la reunion", env8.store.agendaState.nextTitle === "Reunion", JSON.stringify(env8.store.agendaState));
  env8.horloge.now = T0 + 20 * MIN;
  await lit(env8, "trigger({ respectMute: true })");
  verifie("pendant le bloc solo, le rappel d'habitude passe", env8.journal.messages.some((m) => m.type === "kz-show"));
  env8.journal.messages.length = 0;
  env8.horloge.now = T0 + 35 * MIN;
  await lit(env8, "agendaEndFire()");
  const fin8 = env8.journal.messages.find((m) => m.type === "kz-meeting-end");
  verifie("cinq minutes avant la fin du bloc solo, la bulle ambre part", !!fin8 && fin8.title === "Bloc solo" && fin8.people === 1, JSON.stringify(fin8));
  env8.journal.messages.length = 0;
  env8.horloge.now = T0 + 20 * MIN;
  await lit(env8, "agendaWarnFire()");
  verifie("le bloc solo n'a jamais de rappel de debut", !env8.journal.messages.some((m) => m.type === "kz-meeting-soon"));
  const st8 = await lit(env8, "agendaState()");
  verifie("le compte des rendez-vous a venir ne compte que les reunions", st8.upcoming === 1, String(st8.upcoming));
  // Un cache d'avant le marqueur est lu comme des reunions.
  const ancien = { at: T0, events: [{ id: 1, title: "Vieux", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "", people: 2 }] };
  verifie("un cache ancien sans marqueur reste occupe pendant ses rendez-vous", !!lit(env8, "agendaBusyAt(" + JSON.stringify(ancien) + ", " + (T0 + 20 * MIN) + ")"));

  // Deconnexion : l'alarme de fin et sa memoire partent aussi.
  const env7 = charge(base, fetchStandard([]));
  env7.journal.alarmes["kz-agenda-end"] = { when: 1 };
  env7.store.agendaEndWarned = ["x"];
  await lit(env7, "agendaDisconnect()");
  verifie("la deconnexion retire l'alarme de fin et vide sa memoire",
    !env7.journal.alarmes["kz-agenda-end"] && Array.isArray(env7.store.agendaEndWarned) && env7.store.agendaEndWarned.length === 0);
}

/* ================= 7. Prevenir les participants par mail, 2026-09-22 ================= */
// Circuit du serveur MCP mail, verifie en reel le 2026-09-22 sur la boite de
// Thomas : liste des boites, brouillon POST en "save" (reponse {uuid, uid}),
// puis PUT du meme brouillon en "send". Les signatures peuvent manquer de
// perimetre : l'identite retombe sur le profil sans bloquer.
async function testPrevenir() {
  const debut = T0 + 30 * MIN;
  const MB = "3627b855-0000-0000-0000-000000000001";
  const BOITES = { result: "success", data: [
    { uuid: MB, email: "Moi@Example.com", mailbox: "moi", hosting_id: 377594, aliases: ["moi@example.ch"] },
    { uuid: "00baf78d-0000-0000-0000-000000000002", email: "equipe@example.com", mailbox: "equipe", hosting_id: 377594, aliases: [] }
  ] };
  const EVENEMENT = ev(77, debut, debut + 30 * MIN, { title: "Point produit", attendees: [
    att(2), att(MOI), att(1, "ACCEPTED", true), { address: "U2@EXAMPLE.COM", name: "Doublon", user_id: 2, state: "ACCEPTED" }, { address: "", name: "Sans adresse" }
  ] });
  const journalMail = [];
  const fetchMail = (options) => (url, init) => {
    options = options || {};
    if (url.indexOf("mail.infomaniak.com/api/mailbox") >= 0) {
      if (options.sansScope) return reponse(403, { result: "error", error: { code: "all_scopes" } });
      return reponse(200, BOITES);
    }
    if (url.indexOf("/1/calendar/pim/event/77") >= 0) return reponse(200, { result: "success", data: EVENEMENT });
    if (url.indexOf("/signatures") >= 0) {
      if (options.signatures) return reponse(200, { result: "success", data: { signatures: [{ id: 5, sender: "moi@example.com", full_name: "Thomas J.", is_default: true }, { id: 6, sender: "moi@example.com", full_name: "", is_default: false }] } });
      return reponse(403, { result: "error", error: { code: "all_scopes" } });
    }
    if (url.indexOf("mail.infomaniak.com/api/mail/" + MB + "/draft") >= 0) {
      journalMail.push({ url: url, init: init });
      if ((init || {}).method === "POST") return reponse(200, { result: "success", data: { uuid: "d-1", uid: 42, attachments: [] } });
      if ((init || {}).method === "PUT") return options.envoiEchoue ? reponse(500, { result: "error" }) : reponse(200, { result: "success", data: { uuid: "d-1" } });
    }
    // Comme le vrai serveur : une sonde de perimetre sans le droit repond 403 all_scopes.
    if (/mail\.infomaniak\.com\/api\/mailbox|\/2\/drive\/users\/current\/drives|\/1\/calendar\/pim\/calendar$/.test(url)) return reponse(403, { result: "error", error: { code: "all_scopes" } });
    return reponse(404, { result: "error", error: { code: "not_found" } });
  };
  const base = { agendaEnabled: true, agendaWarn: true, agendaCalendarId: 132129, agendaMyUserId: MOI,
    notifyEnabled: true, notifyMailboxUuid: MB, notifyMailboxEmail: "moi@example.com", notifyMailboxHosting: 377594, notifyMailboxLogin: "moi", notifySent: {} };

  let env = charge(base, fetchMail());
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton')");
  env.store.notifyTokenEnc = await lit(env, "secretEncrypt('jeton-mail')");
  verifie("prevenir est eteint par defaut", lit(env, "DEFAULTS.notifyEnabled") === false);
  verifie("la regle Origin ne vise que l'API mail, jamais une page", lit(env, "ORIGIN_RULES.length") === 1 && lit(env, "ORIGIN_RULES[0].condition.urlFilter") === "||mail.infomaniak.com/api/" && JSON.stringify(lit(env, "ORIGIN_RULES[0].condition.tabIds")) === "[-1]");

  const boites = await lit(env, "notifyListMailboxes()");
  verifie("les boites sont listees depuis l'API mail, adresses en minuscules",
    boites.ok && boites.mailboxes.length === 2 && boites.mailboxes[0].email === "moi@example.com" && boites.mailboxes[0].uuid === MB && boites.mailboxes[0].hostingId === 377594 && boites.mailboxes[0].login === "moi", JSON.stringify(boites));
  verifie("l'appel part sur mail.infomaniak.com sans cookies", env.journal.fetches.some((f) => f.url.indexOf("https://mail.infomaniak.com/api/mailbox") === 0 && f.init.credentials === "omit"));
  const envScope = charge(base, fetchMail({ sansScope: true }));
  envScope.store.agendaTokenEnc = await lit(envScope, "secretEncrypt('jeton')");
  envScope.store.notifyTokenEnc = await lit(envScope, "secretEncrypt('jeton-mail')");
  verifie("un jeton sans workspace:mail rend missing_scope", (await lit(envScope, "notifyListMailboxes()")).error === "missing_scope");

  const envChoix = charge(Object.assign({}, base, { notifyEnabled: false, notifyMailboxUuid: "" }), fetchMail());
  await envoie(envChoix, { type: "kz-notify-choose", mailbox: boites.mailboxes[0] });
  verifie("choisir une boite l'enregistre et allume Prevenir",
    envChoix.store.notifyEnabled === true && envChoix.store.notifyMailboxUuid === MB && envChoix.store.notifyMailboxEmail === "moi@example.com" && envChoix.store.notifyMailboxHosting === 377594 && envChoix.store.notifyMailboxLogin === "moi");
  verifie("une boite sans uuid est refusee", (await lit(envChoix, "notifyChoose({ email: 'x@y.z' })")).error === "no_mailbox");

  // Les destinataires.
  const prep = await lit(env, "notifyPrepare(77, " + debut + ")");
  verifie("les participants sont relus a la demande", prep.ok && prep.title === "Point produit" && prep.start === debut, JSON.stringify(prep));
  verifie("moi exclu, l'organisateur en tete, un doublon retire, une adresse vide ignoree",
    prep.recipients.length === 2 && prep.recipients[0].address === "u1@example.com" && prep.recipients[0].organizer === true && prep.recipients[1].address === "u2@example.com", JSON.stringify(prep.recipients));
  verifie("les trois messages sont prets, dans la langue de l'extension",
    prep.templates.late5.subject.indexOf("5") >= 0 && prep.templates.late5.subject.indexOf("Point produit") >= 0
    && prep.templates.late10.body.indexOf("10") >= 0 && prep.templates.absent.subject.indexOf("Point produit") >= 0
    && prep.templates.absent.body.indexOf("Point produit") >= 0 && /\d{2}:\d{2}/.test(prep.templates.late5.body), JSON.stringify(prep.templates.late5));
  verifie("rien n'a encore ete envoye pour ce rendez-vous", Array.isArray(prep.sent) && prep.sent.length === 0);
  // Vu en reel : un invite qui porte l'adresse du profil mais un autre user_id
  // est bien quelqu'un d'autre. Sans user_id, l'adresse tranche.
  const envHom = charge(Object.assign({}, base, { agendaMyEmail: "u2@example.com" }), fetchMail());
  envHom.store.agendaTokenEnc = await lit(envHom, "secretEncrypt('jeton')");
  envHom.store.notifyTokenEnc = await lit(envHom, "secretEncrypt('jeton-mail')");
  const prepHom = await lit(envHom, "notifyPrepare(77, " + debut + ")");
  verifie("un invite a l'adresse de mon profil mais avec un autre identifiant reste destinataire",
    prepHom.ok && prepHom.recipients.some((x) => x.address === "u2@example.com"), JSON.stringify(prepHom.recipients));
  const evSansId = ev(79, debut, debut + 30 * MIN, { title: "Sans id", attendees: [{ address: "u2@example.com", name: "Moi ailleurs", state: "ACCEPTED" }, { address: "autre@example.com", name: "Autre", state: "ACCEPTED" }] });
  const fetchSansId = (url, init) => (url.indexOf("/1/calendar/pim/event/79") >= 0 ? reponse(200, { result: "success", data: evSansId }) : fetchMail()(url, init));
  const envSansId = charge(Object.assign({}, base, { agendaMyEmail: "u2@example.com" }), fetchSansId);
  envSansId.store.agendaTokenEnc = await lit(envSansId, "secretEncrypt('jeton')");
  envSansId.store.notifyTokenEnc = await lit(envSansId, "secretEncrypt('jeton-mail')");
  const prepSansId = await lit(envSansId, "notifyPrepare(79, " + debut + ")");
  verifie("sans identifiant, l'adresse de mon profil m'exclut, l'autre reste", prepSansId.ok && prepSansId.recipients.length === 1 && prepSansId.recipients[0].address === "autre@example.com", JSON.stringify(prepSansId.recipients));
  // Appel unitaire sans invites : repli sur la liste autour du debut.
  const evVide = ev(80, debut, debut + 30 * MIN, { title: "Vide", attendees: [] });
  const evListe = ev(80, debut, debut + 30 * MIN, { title: "Vide", attendees: [att(3), att(MOI)] });
  const fetchVide = (url, init) => {
    if (url.indexOf("/1/calendar/pim/event/80") >= 0) return reponse(200, { result: "success", data: evVide });
    if (url.indexOf("/1/calendar/pim/event?") >= 0) return reponse(200, { result: "success", data: [evListe] });
    return fetchMail()(url, init);
  };
  const envVide = charge(base, fetchVide);
  envVide.store.agendaTokenEnc = await lit(envVide, "secretEncrypt('jeton')");
  envVide.store.notifyTokenEnc = await lit(envVide, "secretEncrypt('jeton-mail')");
  const prepVide = await lit(envVide, "notifyPrepare(80, " + debut + ")");
  verifie("sans invite dans l'appel unitaire, la liste autour du debut prend le relais", prepVide.ok && prepVide.recipients.length === 1 && prepVide.recipients[0].address === "u3@example.com", JSON.stringify(prepVide.recipients));
  verifie("aucune adresse n'est ecrite dans le stockage", JSON.stringify(env.store).indexOf("u1@example.com") < 0 && JSON.stringify(env.store).indexOf("u2@example.com") < 0);
  const envOff = charge(Object.assign({}, base, { notifyEnabled: false }), fetchMail());
  envOff.store.agendaTokenEnc = await lit(envOff, "secretEncrypt('jeton')");
  envOff.store.notifyTokenEnc = await lit(envOff, "secretEncrypt('jeton-mail')");
  verifie("Prevenir eteint : la preparation refuse sans appeler l'API", (await lit(envOff, "notifyPrepare(77, " + debut + ")")).error === "notify_off" && envOff.journal.fetches.length === 0);
  verifie("sans identifiant d'evenement, refus", (await lit(env, "notifyPrepare(0, " + debut + ")")).error === "no_event");

  // L'envoi.
  journalMail.length = 0;
  const envoi = await lit(env, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "late5", subject: prep.templates.late5.subject, body: "Bonjour,\n\nJ'aurai 5 min de retard <3", to: ["u1@example.com", "U2@example.com", "u2@example.com", "pas une adresse"] }) + ")");
  verifie("l'envoi reussit et compte les destinataires uniques et valides", envoi.ok && envoi.count === 2, JSON.stringify(envoi));
  verifie("deux appels a l'API mail, le brouillon puis l'envoi", journalMail.length === 2 && journalMail[0].init.method === "POST" && journalMail[1].init.method === "PUT", JSON.stringify(journalMail.map((j) => j.init.method)));
  const brouillon = JSON.parse(journalMail[0].init.body);
  verifie("le brouillon porte l'objet, les destinataires, l'expediteur de la boite et l'action save",
    brouillon.action === "save" && brouillon.subject === prep.templates.late5.subject && brouillon.to.length === 2 && brouillon.to[0].email === "u1@example.com" && brouillon.from.email === "moi@example.com" && brouillon.reply_to.email === "moi@example.com" && brouillon.mime_type === "text/html", JSON.stringify(brouillon.to));
  verifie("le corps est du HTML echappe, les retours a la ligne conserves", brouillon.body.indexOf("&lt;3") >= 0 && brouillon.body.indexOf("<br>") >= 0 && brouillon.body.indexOf("<3") < 0);
  verifie("sans signature lisible, aucune identite forcee", brouillon.identity_id === null && brouillon.from.name === "moi");
  const envoiPut = JSON.parse(journalMail[1].init.body);
  verifie("l'envoi reprend le brouillon avec l'action send et son chemin", envoiPut.action === "send" && envoiPut.uuid === "d-1" && envoiPut.uid === 42 && envoiPut.resource === "/api/mail/" + MB + "/draft/d-1" && journalMail[1].url.indexOf("/draft/d-1") > 0);
  verifie("l'en-tete JSON est pose sur les deux appels", journalMail.every((j) => j.init.headers["Content-Type"] === "application/json"));
  verifie("l'envoi est memorise pour ce rendez-vous et ce message", JSON.stringify(env.store.notifySent["77@" + debut]) === '["late5"]', JSON.stringify(env.store.notifySent));
  const rejoue = await lit(env, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "late5", subject: "x", body: "y", to: ["u1@example.com"] }) + ")");
  verifie("le meme message deux fois est refuse", rejoue.error === "already_sent");
  const autre = await lit(env, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "absent", subject: "x", body: "y", to: ["u1@example.com"] }) + ")");
  verifie("un autre message pour le meme rendez-vous passe", autre.ok === true && JSON.stringify(env.store.notifySent["77@" + debut]) === '["late5","absent"]');
  const prep2 = await lit(env, "notifyPrepare(77, " + debut + ")");
  verifie("la preparation rend la liste des messages deja envoyes", JSON.stringify(prep2.sent) === '["late5","absent"]');
  const intrus = await lit(env, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "late10", subject: "x", body: "y", to: ["u1@example.com", "pirate@evil.example"] }) + ")");
  verifie("une adresse qui n'est pas un invite fait tout refuser, rien ne part", intrus.ok === false && intrus.error === "bad_recipients", JSON.stringify(intrus));
  verifie("aucun destinataire valide : refus sans appel", (await lit(env, "notifySend(" + JSON.stringify({ id: 78, start: debut, kind: "late5", subject: "x", body: "y", to: ["nope"] }) + ")")).error === "no_recipients");
  verifie("texte vide : refus", (await lit(env, "notifySend(" + JSON.stringify({ id: 78, start: debut, kind: "late5", subject: "x", body: "", to: ["a@b.c"] }) + ")")).error === "empty");
  verifie("message inconnu : refus", (await lit(env, "notifySend(" + JSON.stringify({ id: 78, start: debut, kind: "insulte", subject: "x", body: "y", to: ["a@b.c"] }) + ")")).error === "bad_kind");
  verifie("Prevenir eteint : l'envoi refuse", (await lit(envOff, "notifySend(" + JSON.stringify({ id: 78, start: debut, kind: "late5", subject: "x", body: "y", to: ["a@b.c"] }) + ")")).error === "notify_off");

  // Signature disponible : l'identite nommee par defaut est prise.
  const envSig = charge(base, fetchMail({ signatures: true }));
  envSig.store.agendaTokenEnc = await lit(envSig, "secretEncrypt('jeton')");
  envSig.store.notifyTokenEnc = await lit(envSig, "secretEncrypt('jeton-mail')");
  journalMail.length = 0;
  await lit(envSig, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "late10", subject: "x", body: "y", to: ["u1@example.com"] }) + ")");
  const bSig = JSON.parse(journalMail[0].init.body);
  verifie("avec une signature nommee par defaut, elle devient l'identite d'envoi", bSig.identity_id === "5" && bSig.from.name === "Thomas J.", JSON.stringify(bSig.from) + " " + bSig.identity_id);

  // Envoi qui echoue : rien n'est memorise.
  const envKo = charge(base, fetchMail({ envoiEchoue: true }));
  envKo.store.agendaTokenEnc = await lit(envKo, "secretEncrypt('jeton')");
  envKo.store.notifyTokenEnc = await lit(envKo, "secretEncrypt('jeton-mail')");
  const ko = await lit(envKo, "notifySend(" + JSON.stringify({ id: 77, start: debut, kind: "late5", subject: "x", body: "y", to: ["u1@example.com"] }) + ")");
  verifie("un envoi en echec remonte l'erreur et ne memorise rien", ko.ok === false && /^http_/.test(ko.error) && !(envKo.store.notifySent && envKo.store.notifySent["77@" + debut]));

  // La bulle sait si elle peut proposer Prevenir.
  const cache = { at: T0, events: [{ id: 77, title: "Point produit", start: debut, end: debut + 30 * MIN, url: "", people: 3, meeting: true }] };
  const envB = charge(Object.assign({}, base, { agendaCache: cache, agendaWarned: [], agendaEndWarned: [], agendaEndWarn: true }), fetchMail());
  envB.horloge.now = debut - 3 * MIN;
  await lit(envB, "agendaWarnFire()");
  const mSoon = envB.journal.messages.find((x) => x.type === "kz-meeting-soon");
  verifie("le rappel de debut porte l'identifiant et canNotify quand la boite est choisie", !!mSoon && mSoon.id === 77 && mSoon.canNotify === true, JSON.stringify(mSoon));
  envB.horloge.now = debut + 25 * MIN;
  await lit(envB, "agendaEndFire()");
  const mEnd = envB.journal.messages.find((x) => x.type === "kz-meeting-end");
  verifie("le rappel de fin ne propose jamais Prevenir", !!mEnd && mEnd.canNotify === false);
  const envSans = charge(Object.assign({}, base, { agendaCache: cache, agendaWarned: [], notifyEnabled: false }), fetchMail());
  envSans.horloge.now = debut - 3 * MIN;
  await lit(envSans, "agendaWarnFire()");
  verifie("Prevenir eteint : canNotify est faux", envSans.journal.messages[0] && envSans.journal.messages[0].canNotify === false);

  // 2026-10-06 (revue ECC, M2) : une page n'agit que pour la bulle montree.
  verifie("la bulle de debut porte un jeton d'envoi aleatoire", !!mSoon && /^[0-9a-f]{32}$/.test(mSoon.notifyNonce || ""), JSON.stringify(mSoon));
  verifie("la bulle de fin n'en porte pas", !!mEnd && !mEnd.notifyNonce);
  verifie("le jeton vit dans le coffre, jamais dans storage.local", !!envB.store.notifyNonces && !envB.brut.notifyNonces);
  envB.store.agendaTokenEnc = await lit(envB, "secretEncrypt('jeton')");
  envB.store.notifyTokenEnc = await lit(envB, "secretEncrypt('jeton-mail')");
  envB.horloge.now = debut - 2 * MIN;
  const depuis = (msg, sender) => new Promise((resolve) => {
    const retour = envB.ecouteurs.message(msg, sender, resolve);
    if (retour !== true) resolve("ignore");
    setTimeout(() => resolve("ignore"), 400);
  });
  const page7 = { tab: { id: 7 }, url: "https://site.example/" };
  const nonce = mSoon.notifyNonce;
  verifie("sans jeton, une page ne prepare rien", (await depuis({ type: "kz-notify-prepare", id: 77 }, page7)).error === "not_allowed");
  verifie("un jeton invente est refuse", (await depuis({ type: "kz-notify-prepare", id: 77, nonce: "0".repeat(32) }, page7)).error === "not_allowed");
  verifie("le bon jeton depuis un autre onglet est refuse", (await depuis({ type: "kz-notify-prepare", id: 77, nonce: nonce }, { tab: { id: 8 }, url: "https://autre.example/" })).error === "not_allowed");
  verifie("le bon jeton pour un autre rendez-vous est refuse", (await depuis({ type: "kz-notify-prepare", id: 99, nonce: nonce }, page7)).error === "not_allowed");
  const pp = await depuis({ type: "kz-notify-prepare", id: 77, nonce: nonce, start: 1 }, page7);
  verifie("le bon jeton, le bon onglet : la preparation passe, avec le debut du fond et non celui de la page", pp.ok === true && pp.start === debut, JSON.stringify(pp).slice(0, 200));
  journalMail.length = 0;
  const pe = await depuis({ type: "kz-notify-send", id: 77, nonce: nonce, start: 1, kind: "late10", subject: "Facture urgente", body: "Cliquez ici : https://evil.example", to: ["u1@example.com"] }, page7);
  verifie("l'envoi depuis la page passe", pe.ok === true, JSON.stringify(pe));
  const bp = journalMail.length ? JSON.parse(journalMail[0].init.body) : {};
  verifie("l'objet est toujours celui du fond, jamais celui de la page ; le texte relu passe, echappe",
    bp.subject === pp.templates.late10.subject && bp.subject.indexOf("Facture") < 0 && bp.body.indexOf("Cliquez ici") >= 0 && bp.body.indexOf("<a ") < 0, JSON.stringify({ s: bp.subject }));
  verifie("et compte sur le vrai debut : changer start ne permet pas de rejouer", (await depuis({ type: "kz-notify-send", id: 77, nonce: nonce, start: 2, kind: "late10", body: "Texte", to: ["u1@example.com"] }, page7)).error === "already_sent");
  envB.horloge.now = debut + 40 * MIN;
  verifie("apres la fin du rendez-vous, le jeton ne vaut plus rien", (await depuis({ type: "kz-notify-send", id: 77, nonce: nonce, kind: "absent", body: "Texte", to: ["u1@example.com"] }, page7)).error === "not_allowed");
  envB.horloge.now = debut - 2 * MIN;
  // Quota : au plus six envois par heure.
  envB.store.notifyRate = [1, 2, 3, 4, 5, 6].map((i) => envB.horloge.now - i * 60000);
  verifie("au-dela de six envois dans l'heure, refus", (await depuis({ type: "kz-notify-send", id: 77, nonce: nonce, kind: "absent", body: "Texte", to: ["u1@example.com"] }, page7)).error === "rate_limited");
  envB.store.notifyRate = [];
  // Verrou : deux envois simultanes du meme message, un seul part.
  const popupS = { url: "chrome-extension://kz/popup.html" };
  const [a1, a2] = await Promise.all([
    depuis({ type: "kz-notify-send", id: 77, start: debut, kind: "absent", body: "Texte du popup", to: ["u1@example.com"] }, popupS),
    depuis({ type: "kz-notify-send", id: 77, start: debut, kind: "absent", body: "Texte du popup", to: ["u1@example.com"] }, popupS)
  ]);
  verifie("deux envois simultanes : un seul part", [a1, a2].filter((x) => x && x.ok).length === 1 && [a1, a2].some((x) => x && x.error === "already_sent"), JSON.stringify([a1, a2]));
  // Le titre d'une invitation ne glisse rien dans l'objet.
  const tpl = lit(envB, "notifyTemplates('Point\\r\\nBcc: pirate@evil.example\\u0000', " + debut + ")");
  verifie("retours a la ligne et caracteres de controle sont retires de l'objet", !/[\r\n\u0000]/.test(tpl.late5.subject) && tpl.late5.subject.indexOf("Point Bcc:") >= 0, JSON.stringify(tpl.late5.subject));

  // 2026-10-06 (revue ECC, M1) : apres tout un parcours (rappel, jeton,
  // preparation, envoi), storage.local, que les pages lisent, ne contient
  // aucune cle du coffre.
  const cles = JSON.parse(fs.readFileSync(path.join(RACINE, "background.js"), "utf8").match(/const VAULT_KEYS = (\[[^\]]*\]);/)[1]);
  verifie("storage.local ne contient aucune cle du coffre apres un parcours complet", cles.every((k) => envB.brut[k] === undefined), JSON.stringify(Object.keys(envB.brut).filter((k) => cles.indexOf(k) >= 0)));
  verifie("ni titre de reunion ni adresse mail", JSON.stringify(envB.brut).indexOf("Point produit") < 0 && JSON.stringify(envB.brut).indexOf("@example.com") < 0, JSON.stringify(envB.brut).slice(0, 300));

  // L'etat du popup et la deconnexion.
  await lit(envB, "agendaUpdateState(" + JSON.stringify(cache) + ", " + (debut - 10 * MIN) + ")");
  const st = await lit(envB, "agendaState()");
  verifie("l'etat expose Prevenir, la boite et l'identifiant du prochain rendez-vous", st.notifyEnabled === true && st.notifyMailboxEmail === "moi@example.com" && st.nextId === 77 && st.nextStart === debut, JSON.stringify(st));
  await lit(envB, "agendaUpdateState(" + JSON.stringify(cache) + ", " + (debut + 5 * MIN) + ")");
  const st2 = await lit(envB, "agendaState()");
  verifie("en cours, l'etat expose l'identifiant et le debut du rendez-vous en cours", st2.inId === 77 && st2.inStart === debut);
  await lit(envB, "agendaDisconnect()");
  verifie("la deconnexion eteint Prevenir et oublie la boite", envB.store.notifyEnabled === false && envB.store.notifyMailboxUuid === "" && envB.store.notifyMailboxEmail === "");
  const viaMsg = await envoie(env, { type: "kz-notify-mailboxes" });
  verifie("les messages kz-notify-* sont routes", !!viaMsg && viaMsg.ok === true && viaMsg.mailboxes.length === 2);
}

/* ================= 8. Plusieurs agendas et jeton propre au mail, 2026-09-22 ================= */
async function testPlusieursAgendas() {
  const TZ = "Europe/Zurich";
  // Deux agendas, un evenement commun aux deux (meme id, meme debut) qui ne
  // doit compter qu'une fois, un evenement propre a chacun.
  const commun = ev(500, T0 + 60 * MIN, T0 + 90 * MIN, { title: "Commun", attendees: [att(1), att(MOI)] });
  const fetchDeux = (url) => {
    if (url.indexOf("/1/calendar/pim/calendar") >= 0) return reponse(200, CALENDARS);
    if (url.indexOf("/2/profile") >= 0) return reponse(403, { result: "error", error: { code: "all_scopes" } });
    if (url.indexOf("/1/calendar/pim/event") >= 0) {
      if (url.indexOf("calendar_id=132129") >= 0) return reponse(200, { result: "success", data: [commun, ev(501, T0 + 120 * MIN, T0 + 150 * MIN, { title: "Pro", attendees: [att(2), att(MOI)] })] });
      if (url.indexOf("calendar_id=631037") >= 0) return reponse(200, { result: "success", data: [commun, ev(502, T0 + 200 * MIN, T0 + 230 * MIN, { title: "Perso", attendees: [att(MOI)] })] });
      return reponse(500, { result: "error" });
    }
    // Comme le vrai serveur : une sonde de perimetre sans le droit repond 403 all_scopes.
    if (/mail\.infomaniak\.com\/api\/mailbox|\/2\/drive\/users\/current\/drives|\/1\/calendar\/pim\/calendar$/.test(url)) return reponse(403, { result: "error", error: { code: "all_scopes" } });
    return reponse(404, { result: "error", error: { code: "not_found" } });
  };
  const env = charge({ agendaEnabled: true, agendaWarn: true, agendaEndWarn: true, agendaMyUserId: MOI, statsDaily: {}, screenTimezone: TZ }, fetchDeux);
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton')");
  env.horloge.now = T0;
  const r = await lit(env, "agendaChoose(" + JSON.stringify([{ id: 132129, name: "Thomas (pro)" }, { id: 631037, name: "MarCom" }, { id: 132129, name: "doublon" }]) + ")");
  verifie("choisir deux agendas reussit", r && r.ok === true, JSON.stringify(r));
  verifie("la liste est memorisee sans doublon, le premier reste l'agenda de reference, les noms sont reunis",
    JSON.stringify(env.store.agendaCalendars) === JSON.stringify([{ id: 132129, name: "Thomas (pro)" }, { id: 631037, name: "MarCom" }])
    && env.store.agendaCalendarId === 132129 && env.store.agendaCalendarName === "Thomas (pro), MarCom", JSON.stringify(env.store.agendaCalendars));
  const lectures = env.journal.fetches.filter((f) => f.url.indexOf("/pim/event") >= 0).map((f) => f.url);
  verifie("le rafraichissement lit chaque agenda, et l'historique aussi", lectures.filter((u) => u.indexOf("calendar_id=132129") >= 0).length === 2 && lectures.filter((u) => u.indexOf("calendar_id=631037") >= 0).length === 2, JSON.stringify(lectures.length));
  const titres = env.store.agendaCache.events.map((m) => m.title);
  verifie("le cache reunit les deux agendas, l'evenement commun une seule fois, tries par debut", JSON.stringify(titres) === JSON.stringify(["Commun", "Pro", "Perso"]), JSON.stringify(titres));
  verifie("le bloc perso solo n'est pas une reunion, les deux autres le sont", env.store.agendaCache.events[2].meeting === false && env.store.agendaCache.events[0].meeting === true);
  const st = await lit(env, "agendaState()");
  verifie("l'etat expose la liste des agendas et le libelle reuni", st.configured && st.calendars.length === 2 && st.calendars[1].name === "MarCom" && st.calendarName === "Thomas (pro), MarCom");
  verifie("agendaIds rend la liste", JSON.stringify(lit(env, "agendaIds(" + JSON.stringify(env.store) + ")")) === "[132129,631037]");
  verifie("agendaIds retombe sur l'ancien agenda unique d'une installation d'avant", JSON.stringify(lit(env, "agendaIds({ agendaCalendarId: 7 })")) === "[7]" && JSON.stringify(lit(env, "agendaIds({})")) === "[]");
  verifie("un seul agenda passe toujours par l'ancienne forme", (await lit(env, "agendaChoose(132129, 'Thomas (pro)')")).ok === true && env.store.agendaCalendars.length === 1 && env.store.agendaCalendarName === "Thomas (pro)");
  verifie("aucun agenda : refus", (await lit(env, "agendaChoose([])")).error === "no_calendar");
  await envoie(env, { type: "kz-agenda-choose", calendars: [{ id: 631037, name: "MarCom" }, { id: 132129, name: "Thomas (pro)" }] });
  verifie("le message du popup porte la liste", env.store.agendaCalendars.length === 2 && env.store.agendaCalendarId === 631037);
  // Un agenda en panne : le choix le signale, et au rafraichissement suivant
  // le cache precedent est garde plutot qu'un cache a moitie vide.
  const rKo = await lit(env, "agendaChoose(" + JSON.stringify([{ id: 132129, name: "Thomas (pro)" }, { id: 99, name: "Casse" }]) + ")");
  verifie("choisir un agenda en panne remonte l'erreur", rKo.ok === false && env.store.agendaLastError !== "", JSON.stringify(rKo));
  const cacheOk = { at: T0 - 10 * MIN, events: [{ id: 1, title: "Garde", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "", people: 2, meeting: true }] };
  env.store.agendaCache = cacheOk;
  await lit(env, "agendaRefresh({ force: true })");
  verifie("si un agenda echoue au rafraichissement, le cache precedent reste en place", JSON.stringify(env.store.agendaCache) === JSON.stringify(cacheOk));
  await lit(env, "agendaDisconnect()");
  verifie("la deconnexion vide la liste", Array.isArray(env.store.agendaCalendars) && env.store.agendaCalendars.length === 0 && env.store.agendaCalendarId === 0);

  // Le jeton propre au mail.
  const MB = "3627b855-0000-0000-0000-000000000001";
  const jetonsVus = [];
  const fetchMail = (url, init) => {
    const auth = (init && init.headers && init.headers.Authorization) || "";
    if (url.indexOf("mail.infomaniak.com/api/mailbox") >= 0) {
      jetonsVus.push(auth);
      if (auth.indexOf("Bearer mail-") < 0) return reponse(403, { result: "error", error: { code: "all_scopes" } });
      return reponse(200, { result: "success", data: [{ uuid: MB, email: "Moi@Example.com", mailbox: "moi", hosting_id: 1, aliases: ["moi@example.ch", "MOI@example.com", "contact@example.com"] }] });
    }
    // Comme le vrai serveur : une sonde de perimetre sans le droit repond 403 all_scopes.
    if (/mail\.infomaniak\.com\/api\/mailbox|\/2\/drive\/users\/current\/drives|\/1\/calendar\/pim\/calendar$/.test(url)) return reponse(403, { result: "error", error: { code: "all_scopes" } });
    return reponse(404, { result: "error", error: { code: "not_found" } });
  };
  const envM = charge({ agendaCalendarId: 132129, notifyEnabled: false }, fetchMail);
  envM.store.agendaTokenEnc = await lit(envM, "secretEncrypt('partage')");
  const sansJeton = await lit(envM, "notifyListMailboxes()");
  verifie("le jeton de l'agenda ne sert jamais au mail : sans jeton mail, rien ne part", sansJeton.error === "not_configured" && jetonsVus.length === 0);
  const mauvais = await lit(envM, "notifyConnect('nope')");
  verifie("un jeton saisi qui ne marche pas n'est pas garde", mauvais.error === "missing_scope" && !envM.store.notifyTokenEnc);
  const bon = await lit(envM, "notifyConnect('mail-123')");
  verifie("un jeton mail qui marche est garde chiffre", bon.ok && !!envM.store.notifyTokenEnc && JSON.stringify(envM.store).indexOf("mail-123") < 0);
  verifie("les adresses d'expedition reunissent l'adresse et les alias, une fois, la principale marquee",
    bon.addresses.length === 3 && bon.addresses[0].email === "moi@example.com" && bon.addresses[0].principal === true && bon.addresses[1].email === "moi@example.ch" && bon.addresses[1].principal === false && bon.addresses[2].email === "contact@example.com", JSON.stringify(bon.addresses));
  verifie("chaque adresse porte sa boite pour l'envoi", bon.addresses.every((a) => a.uuid === MB && a.login === "moi"));
  jetonsVus.length = 0;
  await lit(envM, "notifyListMailboxes()");
  verifie("desormais les appels mail partent avec le jeton propre, pas le partage", jetonsVus[0] === "Bearer mail-123");
  verifie("notifyToken prefere le jeton propre", (await lit(envM, "notifyToken()")) === "mail-123");
  await envoie(envM, { type: "kz-notify-choose", mailbox: bon.addresses[2] });
  verifie("choisir un alias enregistre cette adresse comme expediteur", envM.store.notifyMailboxEmail === "contact@example.com" && envM.store.notifyMailboxUuid === MB && envM.store.notifyEnabled === true);
  const stM = await lit(envM, "agendaState()");
  verifie("l'etat dit qu'un jeton mail propre existe", stM.notifyHasToken === true && stM.notifyMailboxEmail === "contact@example.com");
  await envoie(envM, { type: "kz-notify-disconnect" });
  verifie("eteindre Prevenir oublie l'adresse et le jeton mail", envM.store.notifyEnabled === false && envM.store.notifyMailboxUuid === "" && envM.store.notifyTokenEnc === null);
  verifie("sans jeton mail, notifyToken ne retombe pas sur celui de l'agenda", (await lit(envM, "notifyToken()")) === null);
  // Un jeton mail qui ouvre aussi l'agenda est refuse.
  const envL = charge({}, (url, init) => (url.indexOf("/1/calendar/pim/calendar") >= 0 ? reponse(200, CALENDARS) : fetchMail(url, init)));
  const large = await lit(envL, "notifyConnect('mail-large')");
  verifie("un jeton mail qui lit aussi l'agenda est refuse, et pas garde", large.ok === false && large.error === "too_broad" && large.extras.join(",") === "calendar" && !envL.store.notifyTokenEnc, JSON.stringify(large));
}

/* ================= 9. Les mails dans les stats, 2026-09-26 ================= */
// Filtre en jours, borne de fin incluse : un jour se lit de J a J. Recus =
// toute la boite moins envoyes, brouillons, spam et corbeille.
async function testMailStats() {
  const MB = "mb-1";
  const DOSSIERS = { result: "success", data: [
    { id: "IN", role: "INBOX", children: [] }, { id: "SE", role: "SENT" }, { id: "DR", role: "DRAFT" },
    { id: "SP", role: "SPAM" }, { id: "TR", role: "TRASH" }, { id: "AR", role: "ARCHIVE", children: [{ id: "SUB", role: "" }] }
  ] };
  const appels = [];
  const par = { SE: 8, DR: 2, SP: 8, TR: 13 };
  const fetchMail = (url) => {
    appels.push(url);
    if (url.indexOf("/folder?with=ik-static") >= 0) return reponse(200, DOSSIERS);
    const m = url.match(/\/folder\/([A-Z]+)\/message\?(.*)$/);
    if (m) {
      const q = new URLSearchParams(m[2]);
      if (q.get("sfromdate") !== q.get("stodate")) return reponse(200, { result: "success", data: { total_messages_count: 999 } });
      const n = m[1] === "IN" ? (q.get("severywhere") === "1" ? (q.get("filters") === "unseen" ? 40 : 122) : 94) : par[m[1]];
      return reponse(200, { result: "success", data: { total_messages_count: n, threads: [] } });
    }
    return reponse(404, { result: "error" });
  };
  // Un jour mesure avant le 2026-09-26 (in et out seuls) est remesure.
  const ancien = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date(T0 - 2 * 86400000));
  const md0 = {}; md0[ancien] = { in: 50, out: 3 };
  const env = charge({ mailStatsEnabled: true, notifyMailboxUuid: MB, screenTimezone: "Europe/Zurich", mailDaily: md0 }, fetchMail);
  env.store.notifyTokenEnc = await lit(env, "secretEncrypt('jeton-mail')");
  const r = await lit(env, "mailStatsRefresh({ force: true })");
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date(T0));
  verifie("le releve reussit", r && r.ok === true, JSON.stringify(r));
  // L'API compte toute la boite HORS corbeille, spam et brouillons (verifie
  // en direct le 2026-09-26). Gardes = 122 - 8 envoyes = 114, dont 40 non lus.
  const dj = env.store.mailDaily[jour] || {};
  verifie("lus = gardes moins non lus : 114 - 40 = 74 ; supprimes = corbeille 13", dj.read === 74 && dj.del === 13, JSON.stringify(dj));
  verifie("traites = lus + supprimes = 87 ; recus = gardes + supprimes = 127 ; envoyes 8", dj.done === 87 && dj.in === 127 && dj.out === 8, JSON.stringify(dj));
  verifie("les non lus se comptent sur toute la boite avec le filtre unseen", appels.some((u) => /folder\/IN\/message/.test(u) && /severywhere=1/.test(u) && /filters=unseen/.test(u)));
  verifie("la corbeille se compte dossier seul", appels.some((u) => /folder\/TR\/message/.test(u) && /severywhere=0/.test(u)));
  verifie("ni spam ni brouillons ne sont lus", !appels.some((u) => /folder\/(SP|DR)\/message/.test(u)));
  verifie("un jour d'ancien format est remesure", env.store.mailDaily[ancien] && env.store.mailDaily[ancien].done === 87, JSON.stringify(env.store.mailDaily[ancien]));
  verifie("un jour se lit de J a J, jamais sur deux jours", appels.filter((u) => /message\?/.test(u)).every((u) => { const q = new URLSearchParams(u.split("?")[1]); return q.get("sfromdate") === q.get("stodate") && /^\d{4}-\d{2}-\d{2} 00:00:00$/.test(q.get("sfromdate")); }));
  verifie("les recus se comptent sur toute la boite, les autres dossier par dossier", appels.some((u) => /folder\/IN\/message/.test(u) && /severywhere=1/.test(u)) && appels.some((u) => /folder\/SE\/message/.test(u) && /severywhere=0/.test(u)));
  verifie("aujourd'hui, hier et un jour d'historique a chaque tour", Object.keys(env.store.mailDaily).length === 3, JSON.stringify(Object.keys(env.store.mailDaily)));
  verifie("seuls des nombres sont gardes", Object.values(env.store.mailDaily).every((v) => Object.keys(v).sort().join(",") === "del,done,in,out,read" && Object.values(v).every((x) => typeof x === "number")));
  verifie("les appels partent avec le jeton mail, vers l'API mail", env.journal.fetches.every((f) => f.url.indexOf("https://mail.infomaniak.com/api/") === 0 && f.init.headers.Authorization === "Bearer jeton-mail"));
  appels.length = 0;
  const r2 = await lit(env, "mailStatsRefresh()");
  verifie("moins de trente minutes apres, pas de nouvel appel", r2.cached === true && appels.length === 0);
  const envOff = charge({ mailStatsEnabled: false, notifyMailboxUuid: MB }, fetchMail);
  verifie("eteint, rien n'est lu", (await lit(envOff, "mailStatsRefresh({ force: true })")).error === "not_configured");
  // Eteindre Prevenir garde la boite tant que les stats mail s'en servent.
  const envK = charge({ mailStatsEnabled: true, notifyEnabled: true, notifyMailboxUuid: MB, notifyMailboxEmail: "moi@example.com" }, fetchMail);
  envK.store.notifyTokenEnc = await lit(envK, "secretEncrypt('jeton-mail')");
  await lit(envK, "notifyDisconnect()");
  verifie("eteindre Prevenir garde la boite et le jeton pour les stats", envK.store.notifyEnabled === false && envK.store.notifyMailboxUuid === MB && !!envK.store.notifyTokenEnc);
  await envoie(envK, { type: "kz-save", payload: { mailStatsEnabled: false } });
  verifie("puis eteindre les stats oublie la boite et le jeton", envK.store.notifyMailboxUuid === "" && envK.store.notifyTokenEnc === null);
  verifie("mailDaily fait partie des donnees et s'efface avec les stats", JSON.stringify(lit(env, "DEFAULTS.mailDaily")) === "{}" && /mailDaily: \{\}, screenLastTick: 0/.test(fs.readFileSync(path.join(RACINE, "background.js"), "utf8")));
}

/* ================= 6. Interrupteurs, deconnexion et jeton partage ================= */
async function testCycleDeVie() {
  const cache = { at: T0, events: [{ id: 1, title: "Point", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "", people: 2 }] };
  // agendaEndWarn eteint ici : depuis le 2026-09-21 le rappel de fin est un
  // troisieme consommateur de la connexion, il est teste plus bas.
  const env = charge({ agendaEnabled: true, agendaWarn: true, agendaEndWarn: false, agendaCalendarId: 132129, agendaCache: cache }, fetchStandard([]));
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton')");
  env.journal.alarmes["kz-agenda-warn"] = { when: T0 + 7 * MIN };
  // 2026-09-17 : silence et rappel trois minutes avant sont independants, la
  // connexion vit tant que l'un des deux est allume.
  await envoie(env, { type: "kz-save", payload: { agendaEnabled: false } });
  verifie("eteindre le silence seul garde l'alarme du rappel", !!env.journal.alarmes["kz-agenda-warn"]);
  await envoie(env, { type: "kz-save", payload: { agendaWarn: false } });
  verifie("les deux eteints, l'alarme du rappel part", !env.journal.alarmes["kz-agenda-warn"]);
  verifie("et l'etat se remet a plat", env.store.agendaState && env.store.agendaState.inUntil === 0);
  await envoie(env, { type: "kz-save", payload: { agendaEnabled: true } });
  verifie("rallumer l'un des deux rafraichit tout de suite", env.journal.fetches.some((f) => f.url.indexOf("/pim/event") >= 0));

  // Rappel allume, silence eteint : la connexion tourne et le rappel sonne,
  // mais rien ne fait taire les rappels d'habitude.
  const envW = charge({ agendaEnabled: false, agendaWarn: true, agendaCalendarId: 132129, agendaCache: cache, statsDaily: {}, intervalMinutes: 30 }, fetchStandard([]));
  envW.store.agendaTokenEnc = await lit(envW, "secretEncrypt('jeton')");
  envW.horloge.now = T0 + 20 * MIN;
  await lit(envW, "trigger({ respectMute: true })");
  verifie("silence eteint, le rappel d'habitude passe pendant le rendez-vous", envW.journal.messages.some((m) => m.type === "kz-show"));
  envW.journal.messages.length = 0;
  envW.horloge.now = T0 + 7 * MIN;
  await lit(envW, "agendaWarnFire()");
  verifie("silence eteint, le rappel trois minutes avant sonne quand meme", envW.journal.messages.some((m) => m.type === "kz-meeting-soon"));
  envW.horloge.now = T0 + 30 * MIN;
  envW.store.agendaCache.at = T0;
  await lit(envW, "agendaTick()");
  verifie("silence eteint, la connexion continue de se rafraichir pour le rappel", envW.journal.fetches.length === 1);

  // Deconnexion complete.
  const enc = await lit(env, "secretEncrypt('jeton')");
  env.store.agendaTokenEnc = enc;
  const d = await lit(env, "agendaDisconnect()");
  verifie("la deconnexion repond ok", d && d.ok === true);
  verifie("tout l'agenda est efface", !env.store.agendaEnabled && !env.store.agendaTokenEnc && !env.store.agendaCalendarId && !env.store.agendaCache && !env.store.agendaMyUserId);
  const coffre = env.contexte.indexedDB._contenu("kz-secrets", "keys");
  verifie("plus aucun jeton : la cle part aussi du coffre", !!coffre && coffre.size === 0);
  const st = await lit(env, "agendaState()");
  verifie("l'etat est celui d'un agenda non configure", st.enabled === false && st.configured === false && st.hasToken === false, JSON.stringify(st));

  // 2026-09-29 : la migration oublie les anciens jetons (plusieurs
  // perimetres), garde les agendas et la boite, et le dit une fois.
  const env2 = charge({ agendaEnabled: true, agendaCalendarId: 132129, agendaCalendarName: "Pro", notifyMailboxUuid: "mb", kdriveDriveId: 5, kdriveFolderId: 9, kdriveAutoBackup: true,
    kdriveTokenEnc: { iv: [1], data: [2] }, agendaTokenEnc: { iv: [3], data: [4] }, notifyTokenEnc: { iv: [5], data: [6] }, kdriveKeyJwk: { kty: "oct", k: "secret" } }, fetchStandard([]), { brut: true });
  await lit(env2, "securityReady()");
  verifie("la migration oublie les trois anciens jetons", !env2.store.kdriveTokenEnc && !env2.store.agendaTokenEnc && !env2.store.notifyTokenEnc);
  verifie("la cle JWK quitte storage.local, kDrive disparait", !env2.store.kdriveKeyJwk && !env2.store.kdriveDriveId && !env2.store.kdriveAutoBackup);
  verifie("les agendas et la boite restent, reconnecter ne demande que le jeton", env2.store.agendaCalendarId === 132129 && env2.store.notifyMailboxUuid === "mb");
  verifie("et l'utilisateur est prevenu une fois", env2.store.tokensReset === true && env2.store.securityV === 4);
  verifie("puis tout ce qui est sensible quitte storage.local pour le coffre",
    ["agendaCalendarId", "agendaCalendarName", "notifyMailboxUuid", "agendaTokenEnc", "notifyTokenEnc"].every((k) => env2.brut[k] === undefined || env2.brut[k] === null) && env2.store.agendaCalendarId === 132129, JSON.stringify(Object.keys(env2.brut)));
  const st2 = await lit(env2, "agendaState()");
  verifie("l'etat dit jeton absent et raison de la demande", st2.hasToken === false && st2.tokensReset === true, JSON.stringify(st2));
  env2.store.tokensReset = false;
  await lit(env2, "securityMigrate()");
  verifie("la migration ne tourne qu'une fois", env2.store.tokensReset === false);
  const env3 = charge({}, fetchStandard([]));
  await lit(env3, "securityReady()");
  verifie("une installation neuve n'a rien a oublier ni a dire, et n'ecrit rien", env3.store.securityV === undefined && !env3.store.tokensReset);
  // Version 4 seule (2026-10-06) : un profil deja en version 3 garde ses
  // jetons, qui passent simplement dans le coffre.
  const cache4 = { at: T0, events: [{ id: 1, title: "Point secret", start: T0 + 10 * MIN, end: T0 + 40 * MIN, url: "https://kmeet.infomaniak.com/x", people: 2 }] };
  const env4m = charge({ securityV: 3, agendaEnabled: true, agendaCalendarId: 132129, agendaCache: cache4, agendaTokenEnc: { iv: [7], data: [8] }, notifyMailboxEmail: "moi@example.com", notifySent: { "1@2": ["late5"] } }, fetchStandard([]), { brut: true });
  await lit(env4m, "securityReady()");
  verifie("en version 3, les jetons ne sont pas oublies : ils passent dans le coffre", JSON.stringify(env4m.store.agendaTokenEnc) === JSON.stringify({ iv: [7], data: [8] }) && !env4m.store.tokensReset);
  verifie("storage.local, lisible par les pages, ne garde ni titres, ni adresse, ni envois, ni jetons",
    JSON.stringify(env4m.brut).indexOf("Point secret") < 0 && JSON.stringify(env4m.brut).indexOf("moi@example.com") < 0 && env4m.brut.notifySent == null && env4m.brut.agendaTokenEnc == null && env4m.brut.securityV === 4, JSON.stringify(env4m.brut));
  verifie("et le fond relit tout depuis le coffre", (await lit(env4m, "kvGet(['agendaCache', 'agendaEnabled'])")).agendaCache.events[0].title === "Point secret");

  // La cle vit dans IndexedDB, non exportable, jamais dans storage.local.
  const envK = charge({}, fetchStandard([]));
  const blob = await lit(envK, "secretEncrypt('jeton-coffre')");
  const cle = envK.contexte.indexedDB._contenu("kz-secrets", "keys").get("tokens");
  verifie("la cle de chiffrement est dans IndexedDB, pas dans storage.local", !!cle && !JSON.stringify(envK.store).match(/Jwk|"k":/));
  verifie("elle est non exportable : aucun code ne peut en lire les octets", cle.extractable === false);
  let exporte = true;
  try { await envK.contexte.crypto.subtle.exportKey("jwk", cle); } catch (e) { exporte = false; }
  verifie("l'exporter echoue", exporte === false);
  verifie("et elle dechiffre bien", (await lit(envK, "secretDecrypt(" + JSON.stringify(blob) + ")")) === "jeton-coffre");

  // Le rafraichissement force echoue proprement hors ligne, sans casser le cache.
  const env4 = charge({ agendaEnabled: true, agendaCalendarId: 132129, agendaCache: cache }, async () => { throw new Error("reseau"); });
  env4.store.agendaTokenEnc = await lit(env4, "secretEncrypt('jeton')");
  const r4 = await lit(env4, "agendaRefresh({ force: true })");
  verifie("hors ligne, l'erreur est explicite", r4 && r4.error === "offline", JSON.stringify(r4));
  verifie("et le cache precedent est conserve", env4.store.agendaCache && env4.store.agendaCache.events.length === 1);
  verifie("l'erreur est memorisee pour le popup", env4.store.agendaLastError === "offline");

  // Le reset general efface aussi l'agenda.
  const env5 = charge({ agendaEnabled: true, agendaCalendarId: 132129, agendaCache: cache }, fetchStandard([]));
  await envoie(env5, { type: "kz-reset-all" });
  verifie("kz-reset-all remet l'agenda a zero", env5.store.agendaEnabled === false && !env5.store.agendaCalendarId && !env5.store.agendaCache);

  // Enregistrer sans changer les interrupteurs de l'agenda ne rappelle pas
  // l'API : le popup envoie toujours agendaEnabled et agendaWarn dans une
  // sauvegarde complete, et chaque Enregistrer relancait un appel reseau.
  const env6 = charge({ agendaEnabled: true, agendaWarn: true, agendaCalendarId: 132129, agendaCache: cache }, fetchStandard([]));
  env6.store.agendaTokenEnc = await lit(env6, "secretEncrypt('jeton')");
  await envoie(env6, { type: "kz-save", payload: { agendaEnabled: true, agendaWarn: true, intervalMinutes: 30 } });
  verifie("un Enregistrer sans changement n'appelle pas l'agenda", env6.journal.fetches.length === 0, String(env6.journal.fetches.length));
  await envoie(env6, { type: "kz-save", payload: { agendaWarn: false } });
  verifie("eteindre le rappel des trois minutes retire l'alarme, sans appel reseau",
    env6.journal.fetches.length === 0 && !env6.journal.alarmes["kz-agenda-warn"], JSON.stringify(env6.journal.alarmes));
  await envoie(env6, { type: "kz-save", payload: { agendaWarn: true } });
  verifie("le rallumer repose l'alarme depuis le cache, toujours sans appel reseau",
    env6.journal.fetches.length === 0 && !!env6.journal.alarmes["kz-agenda-warn"], JSON.stringify(env6.journal.alarmes));

  // 2026-09-29 : une page (content.js) n'envoie que ses quatre messages.
  const env7 = charge({ agendaCalendarId: 132129 }, fetchStandard([]));
  env7.store.agendaTokenEnc = await lit(env7, "secretEncrypt('jeton-agenda')");
  const depuis = (msg, sender) => new Promise((resolve) => {
    const retour = env7.ecouteurs.message(msg, sender, resolve);
    if (retour !== true) resolve("ignore");
    setTimeout(() => resolve("ignore"), 200);
  });
  const page = { tab: { id: 7 }, url: "https://site.example/", id: undefined };
  verifie("une page ne peut pas exporter les connexions", (await depuis({ type: "kz-connexions-export", passphrase: "une phrase tres longue" }, page)) === "ignore");
  verifie("ni connecter un jeton", (await depuis({ type: "kz-agenda-connect", token: "x" }, page)) === "ignore");
  verifie("ni changer un reglage", (await depuis({ type: "kz-save", payload: { agendaEnabled: false } }, page)) === "ignore" && env7.store.agendaEnabled !== false);
  verifie("mais la bulle peut preparer Prevenir", (await depuis({ type: "kz-notify-prepare", id: 1 }, page)) !== "ignore");
  verifie("le popup, lui, a tout", (await depuis({ type: "kz-agenda-status" }, { url: "chrome-extension://kz/popup.html" })) !== "ignore");
  verifie("un onglet ouvert sur une page de l'extension compte comme l'extension", (await depuis({ type: "kz-agenda-status" }, { tab: { id: 3 }, url: "chrome-extension://kz/popup.html" })) !== "ignore");
  verifie("les anciens messages kDrive n'existent plus", (await depuis({ type: "kz-kdrive-status" }, {})) === "ignore");
}

/* ================= 7. Le manifeste ================= */
async function testManifeste() {
  const m = JSON.parse(fs.readFileSync(path.join(RACINE, "manifest.json"), "utf8"));
  verifie("la permission notifications est declaree", (m.permissions || []).indexOf("notifications") >= 0);
  verifie("aucune permission host nouvelle, l'API est deja couverte", (m.host_permissions || []).length === 2);
  // 2026-09-21 : la regle Origin est une regle de session posee par le fond,
  // limitee aux requetes sans onglet. Elle couvre tout l'hote de l'API, donc
  // l'agenda aussi, sans toucher aux pages Infomaniak ouvertes dans un onglet.
  const bg = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  // 2026-10-06 (revue ECC, M3) : plus que les ecritures vers l'API mail ; les
  // lectures de l'agenda partent sans toucher a l'en-tete.
  verifie("la regle Origin de session ne vise plus l'hote de l'agenda, seulement les ecritures mail",
    !/urlFilter: "\|\|api\.infomaniak\.com"/.test(bg) && /urlFilter: "\|\|mail\.infomaniak\.com\/api\/"/.test(bg) && /tabIds: \[-1\]/.test(bg) && !fs.existsSync(path.join(RACINE, "rules.json")));
}

(async () => {
  const suites = [
    ["Les agendas proposes", testAgendas],
    ["La regle du rendez-vous", testRegle],
    ["Connexion et choix", testConnexion],
    ["Le silence pendant le rendez-vous", testSilence],
    ["Les creux et le temps en reunion", testCreux],
    ["Le rappel trois minutes avant", testRappel],
    ["Interrupteurs, deconnexion, migration et expediteurs", testCycleDeVie],
    ["Le rappel cinq minutes avant la fin", testFin],
    ["Rien en veille", testVeille],
    ["Prevenir les participants par mail", testPrevenir],
    ["Plusieurs agendas et jeton mail", testPlusieursAgendas],
    ["Les mails dans les stats", testMailStats],
    ["Le manifeste", testManifeste]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== agenda (background.js) : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
