// Koala Zen, le fond : jetons chiffres, coffre et liste fermee des appels.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Les jetons Infomaniak. Deux jetons, chacun limite a UN usage :
// workspace:calendar pour l'agenda, workspace:mail pour Prevenir et les stats
// des mails. Chiffrement AES-GCM 256, avec une CryptoKey non exportable
// rangee dans IndexedDB ; elle ne part dans aucun export.
// ===========================================================================
const SECRET_DB = "kz-secrets";
const SECRET_STORE = "keys";
const SECRET_KEY_ID = "tokens";
// Un second magasin, le coffre des donnees
// sensibles. Voir VAULT_KEYS plus bas.
const VAULT_STORE = "vault";

function secretDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined" || !indexedDB) { reject(new Error("no_idb")); return; }
    const req = indexedDB.open(SECRET_DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SECRET_STORE)) db.createObjectStore(SECRET_STORE);
      if (!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb_open"));
  });
}
function secretTx(mode, fn, magasin) {
  const nom = magasin || SECRET_STORE;
  return secretDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(nom, mode);
    const req = fn(tx.objectStore(nom));
    tx.oncomplete = () => { try { db.close(); } catch (e) { /* noop */ } resolve(req ? req.result : undefined); };
    tx.onerror = tx.onabort = () => { try { db.close(); } catch (e) { /* noop */ } reject(tx.error || new Error("idb_tx")); };
  }));
}
let secretKeyPromise = null;
async function secretKeyLoad() {
  await securityReady();
  const existante = await secretTx("readonly", (st) => st.get(SECRET_KEY_ID));
  if (existante) return existante;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await secretTx("readwrite", (st) => st.put(key, SECRET_KEY_ID));
  return key;
}
function secretKey() {
  if (!secretKeyPromise) secretKeyPromise = secretKeyLoad().catch((e) => { secretKeyPromise = null; throw e; });
  return secretKeyPromise;
}
// Plus aucun jeton : la cle part aussi. Un nouveau jeton en cree une neuve.
async function secretForget() {
  secretKeyPromise = null;
  try { await secretTx("readwrite", (st) => st.delete(SECRET_KEY_ID)); } catch (e) { /* noop */ }
}

async function secretEncrypt(token) {
  const key = await secretKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
}

async function secretDecrypt(blob) {
  if (!blob || !Array.isArray(blob.iv) || !Array.isArray(blob.data)) return null;
  try {
    const key = await secretKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(blob.iv) }, key, new Uint8Array(blob.data));
    return new TextDecoder().decode(plain);
  } catch (e) { return null; }
}

// Migration du 2026-09-29, une seule fois. Les anciens jetons avaient ete
// crees avec plusieurs perimetres (kDrive, agenda et mail sur un seul jeton,
// comme le demandait l'ancienne consigne) : ils sont oublies, jamais
// reutilises, et l'utilisateur colle deux jetons a usage unique. Les agendas
// et la boite choisis restent, reconnecter ne demande que le jeton. kDrive
// disparait avec sa cle JWK, qui ne vit plus dans storage.local.
const SECURITY_VERSION = 4;
const KDRIVE_OLD_KEYS = ["kdriveTokenEnc", "kdriveKeyJwk", "kdriveDriveId", "kdriveDriveName", "kdriveFolderId", "kdriveLastSync", "kdriveAutoBackup", "kdriveAutoLast", "kdriveAutoTry", "kdriveLastError"];
async function securityMigrate() {
  const etat = await api.storage.local.get(["securityV"].concat(KDRIVE_OLD_KEYS, VAULT_KEYS));
  const v = Number(etat.securityV) || 0;
  if (v >= SECURITY_VERSION) return;
  // Un profil neuf n'a rien a migrer : aucune ecriture, rien a dire.
  if (!v && !KDRIVE_OLD_KEYS.concat(VAULT_KEYS).some((k) => etat[k] !== undefined && etat[k] !== null)) return;
  if (v < 3) await securityMigrateV3();
  await securityMigrateV4();
}
// Version 4, 2026-10-06 : les cles du coffre quittent storage.local, que les
// scripts de page peuvent lire et ecrire, pour IndexedDB, que seules les
// pages de l'extension atteignent.
async function securityMigrateV4() {
  const r = await api.storage.local.get(VAULT_KEYS);
  const presentes = VAULT_KEYS.filter((k) => r[k] !== undefined);
  const aGarder = {};
  presentes.forEach((k) => { if (r[k] !== null) aGarder[k] = r[k]; });
  if (Object.keys(aGarder).length) await vaultWrite(aGarder);
  await localRemove(presentes);
  await api.storage.local.set({ securityV: SECURITY_VERSION });
}
async function localRemove(cles) {
  if (!cles.length) return;
  if (typeof api.storage.local.remove === "function") await api.storage.local.remove(cles);
  else { const vide = {}; cles.forEach((k) => { vide[k] = null; }); await api.storage.local.set(vide); }
}
async function securityMigrateV3() {
  const r = await api.storage.local.get(["securityV", "agendaTokenEnc", "notifyTokenEnc", "agendaCalendarId", "notifyMailboxUuid"].concat(KDRIVE_OLD_KEYS));
  const avait = !!(r.kdriveTokenEnc || r.agendaTokenEnc || r.notifyTokenEnc);
  const patch = { securityV: 3 };
  if (r.agendaTokenEnc) patch.agendaTokenEnc = null;
  if (r.notifyTokenEnc) patch.notifyTokenEnc = null;
  if (avait && (r.agendaCalendarId || r.notifyMailboxUuid)) patch.tokensReset = true;
  await api.storage.local.set(patch);
  await localRemove(KDRIVE_OLD_KEYS.filter((k) => r[k] !== undefined));
  if (avait) { try { await secretTx("readwrite", (st) => st.delete(SECRET_KEY_ID)); } catch (e) { /* noop */ } }
}
// ===========================================================================
// Le coffre : les donnees sensibles (agenda, identite, boite, envois, jetons
// chiffres) vivent dans IndexedDB, a l'origine de l'extension, hors de portee
// des pages. kvGet et kvSet aiguillent chaque cle : coffre ou storage.local.
// Les stats (nombres seulement) restent dans storage.local, le popup les lit
// directement.
// ===========================================================================
const VAULT_KEYS = ["agendaCache", "agendaState", "agendaMyEmail", "agendaMyUserId", "agendaCalendars", "agendaCalendarName", "agendaCalendarId", "agendaWarned", "agendaEndWarned", "agendaLastWarned", "agendaLastOutWarned", "agendaRooms", "meetingMarks", "meetingSkipped", "meetingLate", "meetingEnded", "agendaTokenEnc", "notifyTokenEnc", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxHosting", "notifyMailboxLogin", "notifySent", "notifyNonces", "notifyRate", "bilanEmail"];
function estCoffre(k) { return VAULT_KEYS.indexOf(k) >= 0; }
async function vaultRead(cles) {
  const out = {};
  await secretTx("readonly", (st) => { cles.forEach((k) => { const q = st.get(k); q.onsuccess = () => { if (q.result !== undefined) out[k] = q.result; }; }); return null; }, VAULT_STORE);
  return out;
}
async function vaultWrite(obj) {
  const cles = Object.keys(obj).filter((k) => obj[k] !== undefined);
  if (!cles.length) return;
  await secretTx("readwrite", (st) => { cles.forEach((k) => st.put(obj[k], k)); return null; }, VAULT_STORE);
}
async function vaultClear() {
  try { await secretTx("readwrite", (st) => st.clear(), VAULT_STORE); } catch (e) { /* noop */ }
}
async function kvGet(cles) {
  const liste = [].concat(cles);
  const coffre = liste.filter(estCoffre);
  const locales = liste.filter((k) => !estCoffre(k));
  const out = locales.length ? await api.storage.local.get(locales) : {};
  if (coffre.length) {
    await securityReady();
    Object.assign(out, await vaultRead(coffre));
  }
  return out;
}
async function kvSet(obj) {
  const locales = {}, coffre = {};
  Object.keys(obj || {}).forEach((k) => { (estCoffre(k) ? coffre : locales)[k] = obj[k]; });
  if (Object.keys(locales).length) await api.storage.local.set(locales);
  if (Object.keys(coffre).length) { await securityReady(); await vaultWrite(coffre); }
}

// Paresseuse : a l'installation ou la mise a jour, et avant tout usage d'un
// jeton. Jamais au simple reveil du worker, qui n'a rien a migrer.
let securityPromise = null;
function securityReady() {
  if (!securityPromise) securityPromise = securityMigrate().catch(() => { securityPromise = null; });
  return securityPromise;
}

// Enveloppe unique pour tous les appels a l'API. Distingue explicitement trois
// echecs qui ne doivent JAMAIS remonter comme une reussite silencieuse : un
// fetch qui n'a jamais atteint le serveur (hors ligne), une redirection d'une
// ECRITURE (POST) hors de l'hote de l'API (le piege de l'en-tete Origin, cense
// etre neutralise par rules.json, mais detecte quand meme au cas ou, jamais
// verifie sur une lecture qui redirige legitimement vers un autre hote de
// stockage), et une reponse HTTP en echec.
// Liste fermee des appels, 2026-09-29. Les perimetres d'Infomaniak sont
// larges (verifie dans les serveurs MCP officiels : workspace:calendar cree,
// modifie et supprime des rendez-vous et lit les contacts ; workspace:mail
// lit, envoie, supprime et deplace des mails). Koala Zen n'en utilise
// qu'une petite partie : tout ce qui n'est pas ici est refuse AVANT de partir,
// si bien que meme detournee, l'extension ne peut pas se servir d'un jeton
// pour autre chose. Une methode, un hote, une forme de chemin (sans la
// requete) ; chaque segment variable est un identifiant deja encode.
const IK_ALLOWED = [
  { base: IK_API, method: "GET", path: /^\/1\/calendar\/pim\/calendar$/ },
  { base: IK_API, method: "GET", path: /^\/1\/calendar\/pim\/event$/ },
  { base: IK_API, method: "GET", path: /^\/1\/calendar\/pim\/event\/[A-Za-z0-9_.%-]+$/ },
  // Les noms des salles reservables, en lecture seule (2026-11-03).
  { base: IK_API, method: "GET", path: /^\/1\/calendar\/pim\/bookable-resources\/all$/ },
  { base: IK_API, method: "GET", path: /^\/2\/profile$/ },
  { base: IK_API, method: "GET", path: /^\/1\/mail_hostings\/\d+\/mailboxes\/[A-Za-z0-9_.%-]+\/signatures$/ },
  // Sonde de perimetre seulement : jamais un autre appel kDrive.
  { base: IK_API, method: "GET", path: /^\/2\/drive\/users\/current\/drives$/ },
  { base: MAIL_API, method: "GET", path: /^\/mailbox$/ },
  { base: MAIL_API, method: "GET", path: /^\/mail\/[A-Za-z0-9-]+\/folder$/ },
  { base: MAIL_API, method: "GET", path: /^\/mail\/[A-Za-z0-9-]+\/folder\/[A-Za-z0-9_.%-]+\/message$/ },
  { base: MAIL_API, method: "POST", path: /^\/mail\/[A-Za-z0-9-]+\/draft$/ },
  { base: MAIL_API, method: "PUT", path: /^\/mail\/[A-Za-z0-9-]+\/draft\/[A-Za-z0-9_.%-]+$/ }
];
function ikAllowed(base, method, path) {
  const chemin = String(path || "").split("?")[0];
  // Ni remontee ni barre encodee : un identifiant ne peut pas changer de route.
  if (/\.\.|%2f|%5c|\\/i.test(chemin)) return false;
  // Ni "." ni "%2e" seul, que fetch normaliserait.
  if (chemin.split("/").some((seg) => /^(\.|%2e)+$/i.test(seg))) return false;
  return IK_ALLOWED.some((a) => a.base === base && a.method === method && a.path.test(chemin));
}

async function ikFetch(token, path, opts) {
  opts = opts || {};
  const method = opts.method || "GET";
  if (!ikAllowed(opts.base || IK_API, method, path)) return { ok: false, error: "not_allowed" };
  const headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
  // La regle Origin doit etre en place avant la premiere ecriture. Sans
  // cookies non plus : l'API ne voit que le jeton, jamais la session du
  // Manager ouverte dans un autre onglet.
  try { await installOriginRule(); } catch (e) { /* noop */ }
  // opts.base : un autre hote Infomaniak, l'API mail par exemple. Meme jeton,
  // memes reponses, meme garde sur les redirections.
  const base = opts.base || IK_API;
  let res;
  try {
    // Aucune redirection suivie. Les appels
    // autorises n'en ont pas besoin ; une redirection est donc un refus.
    res = await fetch(base + path, { method: method, headers: headers, body: opts.body, credentials: "omit", redirect: "manual" });
  } catch (e) {
    return { ok: false, error: "offline" };
  }
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return { ok: false, error: "blocked" };
  if (res.status === 401 || res.status === 403) {
    // Un jeton valide mais sans le perimetre demande repond 403 avec le code
    // "all_scopes" (verifie en reel le 2026-09-16 sur /2/profile). Le
    // distinguer d'un jeton faux permet un message qui dit quoi corriger.
    try {
      const j = await res.json();
      if (j && j.error && j.error.code === "all_scopes") return { ok: false, error: "missing_scope" };
    } catch (e) { /* corps absent ou non JSON, jeton invalide */ }
    return { ok: false, error: "invalid_token" };
  }
  if (!res.ok) return { ok: false, error: "http_" + res.status };
  if (opts.raw) {
    try { return { ok: true, raw: await res.arrayBuffer() }; }
    catch (e) { return { ok: false, error: "bad_body" }; }
  }
  let json;
  try { json = await res.json(); } catch (e) { return { ok: false, error: "bad_json" }; }
  if (json && json.result === "error") return { ok: false, error: (json.error && json.error.code) || "api_error" };
  // pages : le nombre de pages d'une liste paginee, 1 sinon.
  return { ok: true, data: json && json.data, pages: Math.max(1, Number(json && json.pages) || 1) };
}

// Les sondes de perimetre, 2026-09-29. Un jeton doit ouvrir SON usage et
// rien d'autre parmi ceux que Koala Zen sait reconnaitre. Une sonde est une
// simple lecture ; un jeton qui n'a pas le perimetre repond 403 all_scopes
// (verifie en reel), seul un succes franc compte comme un acces en trop.
// Les perimetres que Koala Zen n'appelle jamais ne se detectent pas : la
// consigne demande de n'en cocher qu'un.
const IK_PROBES = {
  calendar: { path: "/1/calendar/pim/calendar" },
  mail: { path: "/mailbox", base: MAIL_API },
  kdrive: { path: "/2/drive/users/current/drives" }
};
// Refus en cas de doute. Seul un refus franc
// (403 sans le perimetre, ou 401) prouve qu'un acces manque ; hors ligne, une
// erreur serveur ou une limite de debit laissent le doute, et le jeton n'est
// alors pas accepte.
async function tokenExtras(token, besoin) {
  const extras = [];
  let doute = false;
  for (const nom of Object.keys(IK_PROBES)) {
    if (nom === besoin) continue;
    const sonde = IK_PROBES[nom];
    const r = await ikFetch(token, sonde.path, sonde.base ? { base: sonde.base } : {});
    if (r.ok) extras.push(nom);
    else if (r.error !== "missing_scope" && r.error !== "invalid_token") doute = true;
  }
  extras.doute = doute;
  return extras;
}
// Le verdict d'une sonde, pour la connexion et l'import. 2026-10-30 : un
// jeton commun agenda + mail est accepte (permis), et sert aux deux ; tout
// autre acces en plus (kDrive...) reste refuse. communs dit lesquels des
// acces permis le jeton ouvre aussi.
function verdictSonde(extras, permis) {
  const ok = Array.isArray(permis) ? permis : [];
  const trop = extras.filter((x) => ok.indexOf(x) < 0);
  if (trop.length) return { ok: false, error: "too_broad", extras: trop };
  if (extras.doute) return { ok: false, error: "probe_failed" };
  return { ok: true, communs: extras.filter((x) => ok.indexOf(x) >= 0) };
}
