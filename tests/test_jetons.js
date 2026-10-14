// Tests des jetons Infomaniak (background.js), 2026-09-29 : coffre de cle,
// chiffrement, appels a l'API, regle Origin, sauvegarde des connexions et
// retrait de kDrive. Contexte vm, API simulees, fetch controle.
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

/* ---------- bac a sable ---------- */
// fetchMock(url, init) doit renvoyer un objet Response minimal, voir reponse()
// plus bas. Par defaut, un fetch qui n'a jamais ete configure leve une erreur
// explicite plutot que de renvoyer un succes silencieux qui masquerait un
// test mal ecrit.
function charge(etatInitial, fetchMock) {
  // 2026-10-06 : `brut` est storage.local tel que le voit un script de page ;
  // `store` y ajoute le coffre IndexedDB du fond (VAULT_KEYS).
  const idb = fakeIndexedDB();
  const brut = {};
  const store = coffreTest(brut, idb, RACINE);
  Object.assign(store, etatInitial || {});
  const journal = { alarmes: {}, messages: [], injections: 0, regles: [] };
  const ecouteurs = {};

  const api = {
    // Regles de session declarativeNetRequest, journalisees telles quelles.
    declarativeNetRequest: { updateSessionRules: async (o) => { journal.regles.push(JSON.parse(JSON.stringify(o))); } },
    runtime: {
      onInstalled: { addListener: (f) => { ecouteurs.installed = f; } },
      onStartup: { addListener: (f) => { ecouteurs.startup = f; } },
      onMessage: { addListener: (f) => { ecouteurs.message = f; } },
      getURL: (p) => "chrome-extension://kz/" + p,
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
          [].concat(cles).forEach((k) => { if (brut[k] !== undefined) out[k] = brut[k]; });
          return out;
        },
        set: async (o) => { Object.assign(brut, JSON.parse(JSON.stringify(o))); },
        clear: async () => { Object.keys(store).forEach((k) => delete brut[k]); }
      }
    },
    idle: { queryState: (s, cb) => { if (typeof cb === "function") { cb("active"); return undefined; } return Promise.resolve("active"); } },
    tabs: { query: async () => [{ id: 7, url: "https://example.com/page", active: true }], sendMessage: async () => {} },
    scripting: { executeScript: async () => { journal.injections++; } },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} }
  };

  const fetchImpl = fetchMock || (async () => { throw new Error("fetch non configure pour ce test"); });
  const contexte = { indexedDB: idb,
    globalThis: null, browser: api, chrome: api, console, URL, Date, Math, JSON,
    setTimeout, clearTimeout, Intl, crypto: webcrypto, fetch: fetchImpl,
    TextEncoder, TextDecoder, Uint8Array, Array
  };
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(path.join(RACINE, "background.js"), "utf8"), contexte);
  return { contexte, store, brut, journal, ecouteurs };
}

function lit(env, expr) { return vm.runInContext(expr, env.contexte); }

async function envoie(env, msg) {
  return new Promise((resolve) => {
    const retour = env.ecouteurs.message(msg, { url: "chrome-extension://kz/popup.html" }, resolve);
    if (retour !== true) resolve(undefined);
    setTimeout(() => resolve(undefined), 200);
  });
}

// Un Response minimal, juste ce que ikFetch lit reellement.
function reponse(body, opts) {
  opts = opts || {};
  return {
    ok: opts.status ? opts.status < 400 : true,
    status: opts.status || 200,
    redirected: !!opts.redirected,
    url: opts.url || "https://api.infomaniak.com/x",
    json: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)).buffer
  };
}

const attends = () => new Promise((r) => setTimeout(r, 20));

/* ================= 1. Le coffre et le chiffrement ================= */
async function testChiffrement() {
  const env = charge({});
  const enc = await env.contexte.secretEncrypt("mon-jeton-secret-123");
  verifie("le chiffre n'est jamais le jeton en clair", JSON.stringify(enc).indexOf("mon-jeton-secret-123") === -1, JSON.stringify(enc));
  verifie("le chiffre porte un vecteur d'initialisation et des donnees", Array.isArray(enc.iv) && enc.iv.length === 12 && Array.isArray(enc.data) && enc.data.length > 0);
  verifie("le dechiffrement rend exactement le jeton d'origine", (await env.contexte.secretDecrypt(enc)) === "mon-jeton-secret-123");
  verifie("un blob nul est absorbe", (await env.contexte.secretDecrypt(null)) === null);
  verifie("un blob mal forme est absorbe", (await env.contexte.secretDecrypt({ iv: "pas un tableau" })) === null);
  const enc2 = await env.contexte.secretEncrypt("mon-jeton-secret-123");
  verifie("deux chiffrements du meme jeton utilisent des IV differents", JSON.stringify(enc.iv) !== JSON.stringify(enc2.iv));
  const coffre = env.contexte.indexedDB._contenu("kz-secrets", "keys");
  const cle = coffre && coffre.get("tokens");
  verifie("la cle vit dans IndexedDB, jamais dans storage.local", !!cle && !Object.keys(env.store).some((k) => /Jwk|Key/.test(k)), Object.keys(env.store).join(","));
  verifie("elle est non exportable et limitee au chiffrement", cle.extractable === false && cle.algorithm.name === "AES-GCM" && cle.usages.slice().sort().join(",") === "decrypt,encrypt");
  // Un autre profil (autre coffre) ne relit pas ce chiffre.
  const autre = charge({});
  verifie("un chiffre ne se relit pas sans la cle de son coffre", (await autre.contexte.secretDecrypt(enc)) === null);
  // Sans IndexedDB, on refuse de chiffrer plutot que de ranger la cle ailleurs.
  const sansIdb = charge({});
  sansIdb.contexte.indexedDB = undefined;
  let refuse = false;
  try { await sansIdb.contexte.secretEncrypt("x"); } catch (e) { refuse = true; }
  verifie("sans coffre, aucun repli vers un stockage moins sur", refuse && !JSON.stringify(sansIdb.store).match(/Jwk/));
  const src = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  verifie("la cle n'est jamais generee exportable ni exportee", !/generateKey\([^)]*,\s*true/.test(src) && !/exportKey\(/.test(src));
}

/* ================= 2. Les appels a l'API, erreurs ================= */
async function testErreursReseau() {
  const r401 = await charge({}, async () => reponse({}, { status: 401 })).contexte.ikFetch("mauvais", "/1/calendar/pim/calendar");
  verifie("un 401 rend invalid_token", r401.ok === false && r401.error === "invalid_token", JSON.stringify(r401));
  const r403 = await charge({}, async () => reponse({ result: "error", error: { code: "all_scopes" } }, { status: 403 })).contexte.ikFetch("t", "/1/calendar/pim/calendar");
  verifie("un 403 all_scopes rend missing_scope", r403.ok === false && r403.error === "missing_scope", JSON.stringify(r403));
  const rOff = await charge({}, async () => { throw new TypeError("Failed to fetch"); }).contexte.ikFetch("t", "/1/calendar/pim/calendar");
  verifie("un fetch qui leve rend offline, jamais un succes silencieux", rOff.ok === false && rOff.error === "offline");
  // Aucune redirection suivie, lecture ou ecriture.
  const inits = [];
  const redir = async (url, init) => { inits.push(init || {}); return { ok: false, status: 0, type: "opaqueredirect", redirected: false, url: "", json: async () => ({}) }; };
  const rBloque = await charge({}, redir).contexte.ikFetch("t", "/mail/x/draft", { base: "https://mail.infomaniak.com/api", method: "POST", body: "{}" });
  verifie("une ecriture redirigee est bloquee", rBloque.ok === false && rBloque.error === "blocked", JSON.stringify(rBloque));
  const rLecture = await charge({}, redir).contexte.ikFetch("t", "/1/calendar/pim/calendar");
  verifie("une lecture redirigee aussi : les appels autorises n'en ont jamais besoin", rLecture.ok === false && rLecture.error === "blocked");
  verifie("le navigateur ne suit aucune redirection", inits.length === 2 && inits.every((i) => i.redirect === "manual"));
  const r302 = await charge({}, async () => reponse({}, { status: 302 })).contexte.ikFetch("t", "/1/calendar/pim/calendar");
  verifie("une reponse 302 visible est refusee aussi", r302.ok === false && r302.error === "blocked");
}

/* ================= 2 bis. La liste fermee des appels, 2026-09-29 ================= */
// Ce que les perimetres permettent mais que Koala Zen ne fait jamais : verifie
// dans les serveurs MCP officiels d'Infomaniak (ecrire et supprimer des
// rendez-vous, lire les contacts, lire, supprimer ou deplacer des mails).
async function testListeFermee() {
  const partis = [];
  const env = charge({}, async (url, init) => { partis.push({ url: String(url), method: (init && init.method) || "GET" }); return reponse({ result: "success", data: {} }); });
  const f = (path, opts) => env.contexte.ikFetch("jeton", path, opts);
  const MAIL = "https://mail.infomaniak.com/api";
  const refuses = [
    ["creer un rendez-vous", "/1/calendar/pim/event", { method: "POST", body: "{}" }],
    ["modifier un rendez-vous", "/1/calendar/pim/event/77", { method: "PUT", body: "{}" }],
    ["supprimer un rendez-vous", "/1/calendar/pim/event/77", { method: "DELETE" }],
    ["lire les contacts", "/1/calendar/pim/contact/all?with=emails"],
    ["lire les ressources reservables", "/1/calendar/pim/bookable-resources/all"],
    ["lister ou lire des fichiers kDrive", "/2/drive/5/files/1/files"],
    ["lire un mail", "/mail/mb-1/folder/INBOX/message/42", { base: MAIL }],
    ["lister les mails d'un dossier en detail", "/mail/mb-1/folder/INBOX/message/42/attachment/1", { base: MAIL }],
    ["supprimer des mails", "/mail/mb-1/folder/INBOX/message/delete", { base: MAIL, method: "POST", body: "{}" }],
    ["deplacer des mails", "/mail/mb-1/message/move", { base: MAIL, method: "POST", body: "{}" }],
    ["creer un dossier", "/mail/mb-1/folder", { base: MAIL, method: "POST", body: "{}" }],
    ["supprimer un brouillon", "/mail/mb-1/draft/d-1", { base: MAIL, method: "DELETE" }],
    ["un autre hote", "/1/calendar/pim/calendar", { base: "https://evil.example" }],
    ["une remontee de chemin", "/1/calendar/pim/event/../../2/drive/5/files"],
    ["une barre encodee", "/1/calendar/pim/event/77%2F..%2F..%2F2%2Fdrive"],
    ["un segment point", "/1/calendar/pim/event/."],
    ["un segment point encode", "/mail/mb-1/draft/%2e", { base: MAIL, method: "PUT", body: "{}" }],
    ["le bon chemin avec la mauvaise methode", "/mailbox", { base: MAIL, method: "DELETE" }]
  ];
  for (const [nom, path, opts] of refuses) {
    const r = await f(path, opts);
    verifie("refuse avant de partir : " + nom, r.ok === false && r.error === "not_allowed", JSON.stringify(r));
  }
  verifie("aucun de ces appels n'a atteint le reseau", partis.length === 0, JSON.stringify(partis));
  const permis = [
    ["/1/calendar/pim/calendar"], ["/1/calendar/pim/event?calendar_id=1&from=a&to=b&with=attendees"], ["/1/calendar/pim/event/77?with=attendees"],
    ["/2/profile"], ["/1/mail_hostings/377594/mailboxes/moi/signatures"], ["/2/drive/users/current/drives"],
    ["/mailbox?with=aliases", { base: MAIL }], ["/mail/3627b855-0000/folder?with=ik-static", { base: MAIL }],
    ["/mail/3627b855-0000/folder/INBOX/message?offset=0&limit=1", { base: MAIL }],
    ["/mail/3627b855-0000/draft", { base: MAIL, method: "POST", body: "{}" }], ["/mail/3627b855-0000/draft/d-1", { base: MAIL, method: "PUT", body: "{}" }]
  ];
  for (const [path, opts] of permis) await f(path, opts);
  verifie("les onze appels dont Koala Zen a besoin passent, et eux seuls", partis.length === 11 && lit(env, "IK_ALLOWED.length") === 11, String(partis.length));
}

/* ================= 3. Les sondes de perimetre ================= */
async function testSondes() {
  const scope = () => reponse({ result: "error", error: { code: "all_scopes" } }, { status: 403 });
  const vus = [];
  const env = charge({}, async (url, init) => {
    vus.push({ url: String(url), init: init || {} });
    if (String(url).indexOf("/2/drive/users/current/drives") >= 0) return reponse({ result: "success", data: [] });
    return scope();
  });
  const extras = await env.contexte.tokenExtras("jeton", "calendar");
  verifie("un jeton qui ouvre kDrive est signale, le mail non", extras.join(",") === "kdrive", extras.join(","));
  verifie("la sonde de son propre usage n'est pas faite", !vus.some((v) => v.url.indexOf("/pim/calendar") >= 0));
  verifie("les sondes sont des lectures, sans corps ni cookies", vus.every((v) => (v.init.method || "GET") === "GET" && !v.init.body && v.init.credentials === "omit"));
  const env2 = charge({}, async () => { throw new TypeError("hors ligne"); });
  verifie("hors ligne, une sonde ne compte pas comme un acces en trop", (await env2.contexte.tokenExtras("jeton", "mail")).length === 0);
  // Dans le doute, le jeton est refuse.
  verifie("hors ligne, le doute est signale", (await env2.contexte.tokenExtras("jeton", "mail")).doute === true);
  const env5 = charge({}, async (url) => (String(url).indexOf("/pim/calendar") >= 0 ? reponse({ result: "success", data: { calendars: [{ id: 1, name: "A", user_id: 5, default: true, permission: "owner" }] } }) : reponse({ result: "error" }, { status: 503 })));
  const r5 = await lit(env5, "agendaConnect('jeton-agenda')");
  verifie("un serveur en panne pendant la sonde fait refuser le jeton, sans l'enregistrer", r5.ok === false && r5.error === "probe_failed" && !env5.store.agendaTokenEnc, JSON.stringify(r5));
  const env6 = charge({}, async (url) => (String(url).indexOf("/pim/calendar") >= 0 ? reponse({ result: "success", data: { calendars: [] } }) : reponse({ result: "error" }, { status: 429 })));
  const v6 = await env6.contexte.tokenExtras("jeton", "calendar");
  verifie("une limite de debit (429) laisse aussi un doute qui fait refuser", JSON.stringify(env6.contexte.verdictSonde(v6)) === JSON.stringify({ ok: false, error: "probe_failed" }), JSON.stringify(env6.contexte.verdictSonde(v6)));
}

async function testRegleOrigin() {
  const env = charge({}, async (url, init) => reponse({ result: "success", data: [] }));
  await new Promise((r) => setTimeout(r, 30));
  verifie("le fond pose sa regle de session au reveil", env.journal.regles.length === 1, String(env.journal.regles.length));
  const o = env.journal.regles[0] || {};
  const regle = (o.addRules || [])[0];
  verifie("elle remplace d'abord son ancienne version, meme identifiant", Array.isArray(o.removeRuleIds) && regle && o.removeRuleIds.indexOf(regle.id) >= 0);
  verifie("elle retire l'en-tete Origin et rien d'autre",
    !!regle && regle.action.type === "modifyHeaders" && regle.action.requestHeaders.length === 1
    && regle.action.requestHeaders[0].header === "Origin" && regle.action.requestHeaders[0].operation === "remove"
    && !regle.action.responseHeaders, JSON.stringify(regle && regle.action));
  verifie("elle ne vise que l'API mail en XHR, plus celle de l'agenda", !!regle && regle.condition.urlFilter === "||mail.infomaniak.com/api/"
    && JSON.stringify(regle.condition.resourceTypes) === '["xmlhttprequest"]', JSON.stringify(regle && regle.condition));
  verifie("une seule regle posee, et l'ancienne regle de l'hote de l'agenda est retiree", (o.addRules || []).length === 1 && JSON.stringify(o.removeRuleIds) === "[1,2]", JSON.stringify(o.removeRuleIds));
  verifie("elle ne s'applique qu'aux requetes qui ne viennent d'aucun onglet, jamais a une page",
    !!regle && JSON.stringify(regle.condition.tabIds) === "[-1]", JSON.stringify(regle && regle.condition));
  await env.contexte.installOriginRule();
  await env.contexte.installOriginRule();
  verifie("la pose est idempotente, une seule mise a jour", env.journal.regles.length === 1, String(env.journal.regles.length));

  // Aucune regle statique ne subsiste : ni fichier, ni entree du manifeste.
  const man = JSON.parse(fs.readFileSync(path.join(RACINE, "manifest.json"), "utf8"));
  verifie("plus de jeu de regles statiques dans le manifeste", !man.declarative_net_request);
  verifie("plus de fichier rules.json", !fs.existsSync(path.join(RACINE, "rules.json")));
  verifie("la permission declarativeNetRequest reste declaree pour la regle de session", man.permissions.indexOf("declarativeNetRequest") >= 0);
  verifie("le paquet ne cite plus rules.json", fs.readFileSync(path.join(RACINE, "build.sh"), "utf8").indexOf("rules.json") < 0);

  // Les appels du fond ne portent jamais les cookies du Manager.
  const inits = [];
  const env2 = charge({}, async (url, init) => { inits.push(init || {}); return reponse({ result: "success", data: [] }); });
  await env2.contexte.ikFetch("jeton", "/1/calendar/pim/calendar");
  verifie("ikFetch envoie la requete sans cookies, jeton seul", inits.length === 1 && inits[0].credentials === "omit" && /^Bearer jeton$/.test(inits[0].headers.Authorization), JSON.stringify(inits[0]));
  verifie("et la regle est en place avant la requete", env2.journal.regles.length === 1);

  // Sans API declarativeNetRequest (harnais ou navigateur ancien), rien ne casse.
  const env3 = charge({}, async () => reponse({ result: "success", data: [] }));
  delete env3.contexte.chrome.declarativeNetRequest;
  delete env3.contexte.browser.declarativeNetRequest;
  const r3 = await env3.contexte.ikFetch("jeton", "/1/calendar/pim/calendar");
  verifie("sans declarativeNetRequest, la requete part quand meme", !!r3 && r3.ok === true, JSON.stringify(r3));
}

/* ============ Les connexions dans la sauvegarde, 2026-09-29 ============ */
// Les jetons ne quittent l'appareil que chiffres par une phrase secrete de
// 12 caracteres ou plus (PBKDF2-SHA256 600 000 tours puis AES-GCM 256).
async function ancienPaquet(clair, pass) {
  const s = webcrypto.subtle;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await s.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await s.deriveKey({ name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const data = await s.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify(clair)));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: 200000, salt: Array.from(salt), iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
}
async function testConnexionsSauvegarde() {
  const PHRASE = "une phrase assez longue";
  const env = charge({ agendaCalendars: [{ id: 132129, name: "Pro" }, { id: 60, name: "Perso" }], agendaCalendarId: 132129, agendaCalendarName: "Pro, Perso", agendaMyUserId: 218155, agendaMyEmail: "moi@example.com", notifyEnabled: true, notifyMailboxUuid: "mb-1", notifyMailboxEmail: "moi@example.ch", notifyMailboxName: "moi", notifyMailboxHosting: 5, notifyMailboxLogin: "moi" }, async () => reponse({ result: "success", data: [] }));
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton-agenda')");
  env.store.notifyTokenEnc = await lit(env, "secretEncrypt('jeton-mail')");
  verifie("une phrase de 11 caracteres est refusee", (await lit(env, "connexionsExport('onze-carac!')")).error === "pass_short");
  verifie("le minimum est de 12 caracteres, comme dans le popup", lit(env, "CONNEXIONS_MIN_PASS") === 12 && /const PASS_MIN = 12;/.test(fs.readFileSync(path.join(RACINE, "popup.js"), "utf8")));
  const ex = await lit(env, "connexionsExport(" + JSON.stringify(PHRASE) + ")");
  verifie("l'export reussit et dit ce qu'il contient", ex.ok && ex.parts.agenda && ex.parts.notify && ex.parts.kdrive === undefined, JSON.stringify(ex.parts));
  const blob = ex.blob;
  verifie("paquet v2 : 600 000 tours, sel, vecteur, rien d'autre en clair",
    blob.v === 2 && blob.kdf === "PBKDF2-SHA256" && blob.iter === 600000 && blob.salt.length === 16 && blob.iv.length === 12 && blob.data.length > 100
    && Object.keys(blob).sort().join(",") === "data,iter,iv,kdf,salt,v", JSON.stringify(Object.keys(blob)));
  const texte = JSON.stringify(blob);
  verifie("aucun jeton, aucune adresse, aucun nom d'agenda en clair", texte.indexOf("jeton") < 0 && texte.indexOf("example") < 0 && texte.indexOf("Perso") < 0 && texte.indexOf("mb-1") < 0);
  const ex2 = await lit(env, "connexionsExport(" + JSON.stringify(PHRASE) + ")");
  verifie("deux exports ne se ressemblent pas", JSON.stringify(ex2.blob.salt) !== JSON.stringify(blob.salt) && JSON.stringify(ex2.blob.data) !== JSON.stringify(blob.data));

  const urlsNeuf = [];
  // Le jeton agenda n'ouvre que l'agenda, le jeton mail que le mail.
  const sansDroit = () => reponse({ result: "error", error: { code: "all_scopes" } }, { status: 403 });
  const parJeton = (url, init) => {
    const jeton = ((init && init.headers && init.headers.Authorization) || "").replace("Bearer ", "");
    if (url.indexOf("/2/drive/") >= 0) return sansDroit();
    if (url.indexOf("/mailbox") >= 0) return jeton === "jeton-mail" ? reponse({ result: "success", data: [] }) : sansDroit();
    if (url.indexOf("/pim/calendar") >= 0) return jeton === "jeton-agenda" ? reponse({ result: "success", data: { calendars: [] } }) : sansDroit();
    return reponse({ result: "success", data: [] });
  };
  const neuf = charge({}, async (url, init) => { urlsNeuf.push(String(url)); return parJeton(String(url), init); });
  verifie("une mauvaise phrase est refusee sans rien ecrire", (await lit(neuf, "connexionsImport(" + JSON.stringify(blob) + ", 'pas la bonne phrase')")).error === "bad_passphrase" && !neuf.store.agendaTokenEnc);
  verifie("un paquet abime est refuse", (await lit(neuf, "connexionsImport({ v: 2, salt: [1] }, " + JSON.stringify(PHRASE) + ")")).error === "bad_blob");
  verifie("une phrase trop courte est refusee a l'import d'un paquet v2", (await lit(neuf, "connexionsImport(" + JSON.stringify(blob) + ", 'courte')")).error === "pass_short");
  const tricheur = Object.assign({}, blob, { iter: 1000 });
  verifie("un paquet qui annonce moins de tours n'affaiblit pas la derivation", (await lit(neuf, "connexionsImport(" + JSON.stringify(tricheur) + ", " + JSON.stringify(PHRASE) + ")")).ok === true);
  await new Promise((r) => setTimeout(r, 40));
  urlsNeuf.length = 0;
  // Hors ligne, les jetons d'un fichier ne sont pas restaures : rien n'est verifiable.
  const horsLigne = charge({}, async () => { throw new TypeError("Failed to fetch"); });
  const ih = await lit(horsLigne, "connexionsImport(" + JSON.stringify(blob) + ", " + JSON.stringify(PHRASE) + ")");
  verifie("hors ligne, l'import rend les reglages mais pas les jetons, et le dit", ih.ok === true && ih.tokensUnchecked === true && !horsLigne.store.agendaTokenEnc && !horsLigne.store.notifyTokenEnc, JSON.stringify(ih));
  // Un fichier piege ne bloque pas le fond et n'est pas lu.
  const piege = Object.assign({}, blob, { iter: 1e12 });
  verifie("un nombre de tours demesure est refuse sans calcul", (await lit(neuf, "connexionsImport(" + JSON.stringify(piege) + ", " + JSON.stringify(PHRASE) + ")")).error === "bad_blob");
  verifie("un sel ou un vecteur de mauvaise taille est refuse", (await lit(neuf, "connexionsImport(" + JSON.stringify(Object.assign({}, blob, { salt: [1, 2, 3] })) + ", " + JSON.stringify(PHRASE) + ")")).error === "bad_blob");
  verifie("des octets hors bornes sont refuses", (await lit(neuf, "connexionsImport(" + JSON.stringify(Object.assign({}, blob, { data: blob.data.slice(0, 50).concat([999]) })) + ", " + JSON.stringify(PHRASE) + ")")).error === "bad_blob");
  const im = await lit(neuf, "connexionsImport(" + JSON.stringify(blob) + ", " + JSON.stringify(PHRASE) + ")");
  verifie("la bonne phrase restaure les deux jetons", im.ok && im.parts.agenda && im.parts.notify && !im.tokensSkipped, JSON.stringify(im));
  verifie("rechiffres avec le coffre de l'appareil, jamais en clair",
    !!neuf.store.agendaTokenEnc && JSON.stringify(neuf.store).indexOf("jeton-agenda") < 0 && JSON.stringify(neuf.store.agendaTokenEnc) !== JSON.stringify(env.store.agendaTokenEnc));
  verifie("et ils se relisent", (await lit(neuf, "secretDecrypt(" + JSON.stringify(neuf.store.agendaTokenEnc) + ")")) === "jeton-agenda" && (await lit(neuf, "secretDecrypt(" + JSON.stringify(neuf.store.notifyTokenEnc) + ")")) === "jeton-mail");
  verifie("les agendas et la boite suivent", neuf.store.agendaCalendars.length === 2 && neuf.store.agendaCalendarId === 132129 && neuf.store.notifyMailboxEmail === "moi@example.ch" && neuf.store.notifyEnabled === true);
  verifie("les jetons repassent les sondes avant d'etre restaures", urlsNeuf.some((u) => u.indexOf("/mailbox") >= 0) && urlsNeuf.some((u) => u.indexOf("/2/drive/") >= 0));
  verifie("un rafraichissement de chaque agenda part tout de suite", (await new Promise((r) => setTimeout(r, 40)), urlsNeuf.filter((u) => u.indexOf("/pim/event") >= 0).length === 2), urlsNeuf.join(" "));

  // Un fichier v1 (avant le 2026-09-29) : ses reglages, jamais ses jetons.
  const v1 = await ancienPaquet({ v: 1, kdriveToken: "vieux-large", agendaToken: "vieux-agenda", notifyToken: "vieux-mail", kdriveDriveId: 42, agendaCalendarId: 7, agendaCalendarName: "Ancien", notifyMailboxUuid: "mb-9", notifyEnabled: true }, "abcd");
  const vieux = charge({}, async () => reponse({ result: "success", data: [] }));
  const iv1 = await lit(vieux, "connexionsImport(" + JSON.stringify(v1) + ", 'abcd')");
  verifie("un ancien fichier se relit avec son ancienne phrase", iv1.ok === true, JSON.stringify(iv1));
  verifie("mais ses jetons, trop larges, ne sont jamais restaures, et on le dit", iv1.tokensSkipped === true && !vieux.store.agendaTokenEnc && !vieux.store.notifyTokenEnc && JSON.stringify(vieux.store).indexOf("vieux") < 0);
  verifie("ses reglages suivent, sans rien de kDrive", vieux.store.agendaCalendarId === 7 && vieux.store.notifyMailboxUuid === "mb-9" && vieux.store.kdriveDriveId === undefined);

  const vide = charge({}, async () => reponse({ result: "success", data: [] }));
  const ev = await lit(vide, "connexionsExport(" + JSON.stringify(PHRASE) + ")");
  verifie("sans connexion, un paquet vide qui le dit", ev.ok && !ev.parts.agenda && !ev.parts.notify);
  verifie("les messages kz-connexions-* sont routes depuis le popup",
    (await envoie(env, { type: "kz-connexions-export", passphrase: PHRASE })).ok === true
    && (await envoie(neuf, { type: "kz-connexions-import", blob: blob, passphrase: "mauvaise phrase ici" })).error === "bad_passphrase");
}

/* ============ kDrive retire, 2026-09-29 ============ */
async function testKdriveRetire() {
  const bg = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  const pop = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  verifie("plus aucune fonction kDrive dans le fond", !/function kdrive[A-Z]/.test(bg) && !/kz-kdrive-/.test(bg));
  verifie("plus aucun appel a l'API kDrive hors de la sonde de perimetre", (bg.match(/\/2\/drive/g) || []).length === 1);
  verifie("plus aucune sauvegarde automatique au tic", !/AutoBackup/.test(bg.replace(/KDRIVE_OLD_KEYS = \[[^\]]*\]/, "")));
  verifie("DEFAULTS ne porte plus de cle kDrive", !/^\s+kdrive\w+:/m.test(bg));
  verifie("le popup n'envoie plus aucun message kDrive", !/kz-kdrive-/.test(pop));
  verifie("la carte kDrive a disparu de l'onglet Donnees", !/id="kdrive/.test(html) && !/id="frAuto/.test(html) && !/id="frDrives/.test(html));
  const env = charge({});
  verifie("un ancien message kDrive reste sans reponse", (await envoie(env, { type: "kz-kdrive-status" })) === undefined);
  // Ni le fichier exporte, ni les listes de cles ne portent un jeton.
  ["SETTINGS", "CONTENT", "STATS", "KOALA"].forEach((n) => {
    const m = pop.match(new RegExp("const " + n + "_KEYS = \\[([^\\]]*)\\]"));
    verifie(n + "_KEYS ne contient ni jeton ni cle", !!m && !/TokenEnc|Jwk|kdrive/i.test(m[1]), m && m[1]);
  });
}

/* ============ Tout effacer efface aussi le coffre ============ */
async function testResetAll() {
  const env = charge({ agendaCalendarId: 1 });
  env.store.agendaTokenEnc = await lit(env, "secretEncrypt('jeton')");
  await envoie(env, { type: "kz-reset-all" });
  await new Promise((r) => setTimeout(r, 30));
  const coffre = env.contexte.indexedDB._contenu("kz-secrets", "keys");
  verifie("kz-reset-all efface le jeton chiffre", !env.store.agendaTokenEnc);
  verifie("et la cle du coffre", !!coffre && coffre.size === 0);
  verifie("sans relancer la migration derriere", env.store.securityV === 4);
}

/* ---------- execution ---------- */
(async () => {
  const tests = [
    ["Coffre et chiffrement des jetons", testChiffrement],
    ["Appels a l'API, erreurs explicites", testErreursReseau],
    ["La liste fermee des appels", testListeFermee],
    ["Sondes de perimetre", testSondes],
    ["La regle Origin, limitee aux requetes du fond", testRegleOrigin],
    ["Les connexions dans la sauvegarde", testConnexionsSauvegarde],
    ["kDrive retire", testKdriveRetire],
    ["Tout effacer efface aussi le coffre", testResetAll]
  ];
  for (const [nom, fn] of tests) {
    const avantOk = ok, avantKo = ko;
    try { await fn(); } catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log((ko > avantKo ? "  KO  " : "  ok  ") + nom + " (" + (ok - avantOk + ko - avantKo) + " controles)");
  }
  console.log("\n=== jetons (background.js) : " + ok + " reussis, " + ko + " echecs ===");
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); process.exit(1); }
})();
