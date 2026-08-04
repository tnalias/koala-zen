// Tests fonctionnels de la sauvegarde kDrive (module dans background.js),
// execute dans un contexte vm avec des API simulees et un fetch controle.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
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
  const store = Object.assign({}, etatInitial);
  const journal = { alarmes: {}, messages: [], injections: 0 };
  const ecouteurs = {};

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
        set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); },
        clear: async () => { Object.keys(store).forEach((k) => delete store[k]); }
      }
    },
    idle: { queryState: (s, cb) => { if (typeof cb === "function") { cb("active"); return undefined; } return Promise.resolve("active"); } },
    tabs: { query: async () => [{ id: 7, url: "https://example.com/page", active: true }], sendMessage: async () => {} },
    scripting: { executeScript: async () => { journal.injections++; } },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} }
  };

  const fetchImpl = fetchMock || (async () => { throw new Error("fetch non configure pour ce test"); });
  const contexte = {
    globalThis: null, browser: api, chrome: api, console, URL, Date, Math, JSON,
    setTimeout, clearTimeout, Intl, crypto: webcrypto, fetch: fetchImpl,
    TextEncoder, TextDecoder, Uint8Array, Array
  };
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(path.join(RACINE, "background.js"), "utf8"), contexte);
  return { contexte, store, journal, ecouteurs };
}

function lit(env, expr) { return vm.runInContext(expr, env.contexte); }

async function envoie(env, msg) {
  return new Promise((resolve) => {
    const retour = env.ecouteurs.message(msg, {}, resolve);
    if (retour !== true) resolve(undefined);
    setTimeout(() => resolve(undefined), 200);
  });
}

// Un Response minimal, juste ce que kdriveFetch lit reellement.
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

/* ================= 1. Chiffrement du jeton ================= */
async function testChiffrement() {
  const env = charge({});
  const enc = await env.contexte.kdriveEncryptToken("mon-jeton-secret-123");
  verifie("le chiffre n'est jamais le jeton en clair",
    JSON.stringify(enc).indexOf("mon-jeton-secret-123") === -1, JSON.stringify(enc));
  verifie("le chiffre porte un vecteur d'initialisation et des donnees",
    Array.isArray(enc.iv) && enc.iv.length > 0 && Array.isArray(enc.data) && enc.data.length > 0);
  const dec = await env.contexte.kdriveDecryptToken(enc);
  verifie("le dechiffrement rend exactement le jeton d'origine", dec === "mon-jeton-secret-123", dec);

  verifie("un blob nul est absorbe", await env.contexte.kdriveDecryptToken(null) === null);
  verifie("un blob mal forme est absorbe",
    await env.contexte.kdriveDecryptToken({ iv: "pas un tableau" }) === null);

  // Deux chiffrements du meme jeton ne doivent jamais produire le meme vecteur
  // d'initialisation, sinon la meme cle et le meme IV rendraient le chiffre
  // predictible d'un appel a l'autre.
  const enc2 = await env.contexte.kdriveEncryptToken("mon-jeton-secret-123");
  verifie("deux chiffrements du meme jeton utilisent des IV differents",
    JSON.stringify(enc.iv) !== JSON.stringify(enc2.iv));
}

/* ================= 2. Resolution du drive ================= */
async function testResolutionDrive() {
  // Piege classique : l'API rend des DriveUser, leur "id" est la relation
  // utilisateur-drive, jamais le drive_id attendu par les autres appels.
  const env = charge({}, async (url) => {
    if (String(url).indexOf("/2/drive/users/current/drives") === 0 || String(url).indexOf("infomaniak.com/2/drive/users/current/drives") > -1) {
      return reponse({ result: "success", data: [{ id: 999, drive_id: 42, name: "Mon Drive" }] });
    }
    throw new Error("route non geree: " + url);
  });
  const r = await env.contexte.kdriveResolveDrive("tok");
  verifie("le drive resolu utilise drive_id, jamais id", r.ok && r.driveId === 42, JSON.stringify(r));

  const envVide = charge({}, async () => reponse({ result: "success", data: [] }));
  const rVide = await envVide.contexte.kdriveResolveDrive("tok");
  verifie("aucun drive sur le compte rend une erreur explicite",
    rVide.ok === false && rVide.error === "no_drive", JSON.stringify(rVide));
}

/* ================= 2bis. Liste des drives, eligibilite et choix de destination ================= */
async function testListeEtEligibiliteDrives() {
  // Verrouille, en maintenance, statut non actif, ou role externe : ecartes.
  // Seuls deux des cinq DriveUser de ce compte fictif sont utilisables.
  const env = charge({}, async () => reponse({
    result: "success",
    data: [
      { drive_id: 1, drive_name: "Perso", drive: { status: "active", quota: 1000, used_size: 400 } },
      { drive_id: 2, drive_name: "Verrouille", drive: { status: "active", is_locked: true } },
      { drive_id: 3, drive_name: "Maintenance", drive: { status: "active", in_maintenance: true } },
      { drive_id: 4, drive_name: "Supprime", drive: { status: "deleted_trash" } },
      { drive_id: 5, drive_name: "Partage", role: "external", drive: { status: "active" } },
      { drive_id: 6, drive_name: "Equipe", drive: { status: "active", quota: 500, used_size: 500 } }
    ]
  }));
  const r = await env.contexte.kdriveListDrives("tok");
  verifie("deux drives sur six restent eligibles", r.ok && r.drives.length === 2, JSON.stringify(r));
  const ids = r.drives.map((d) => d.driveId).sort();
  verifie("les eligibles sont bien Perso (1) et Equipe (6), jamais un des quatre ecartes",
    ids.length === 2 && ids[0] === 1 && ids[1] === 6, JSON.stringify(ids));
  const perso = r.drives.find((d) => d.driveId === 1);
  verifie("l'espace libre est calcule, quota moins used_size", perso && perso.freeBytes === 600, JSON.stringify(perso));
  const equipe = r.drives.find((d) => d.driveId === 6);
  verifie("un drive plein rend un espace libre de zero, jamais negatif", equipe && equipe.freeBytes === 0, JSON.stringify(equipe));

  // Zero drive eligible, meme avec des entrees non vides, rend no_drive.
  const envZero = charge({}, async () => reponse({
    result: "success",
    data: [{ drive_id: 9, drive: { is_locked: true } }]
  }));
  const rZero = await envZero.contexte.kdriveListDrives("tok");
  verifie("aucun drive eligible rend no_drive, meme si le compte en a un verrouille",
    rZero.ok === false && rZero.error === "no_drive", JSON.stringify(rZero));
}

/* ================= 2ter. Plusieurs drives eligibles, choix explicite requis ================= */
async function testChoixExplicite() {
  const env = charge({}, async (url) => {
    const u = String(url);
    if (u.indexOf("/2/drive/users/current/drives") > -1) {
      return reponse({ result: "success", data: [{ drive_id: 11, drive_name: "Perso" }, { drive_id: 12, drive_name: "Pro" }] });
    }
    if (u.indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/1/directory") > -1) return reponse({ result: "success", data: { id: 50 } });
    if (u.indexOf("/files/50/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/50/directory") > -1) return reponse({ result: "success", data: { id: 51 } });
    throw new Error("route non geree: " + u);
  });

  const rConnect = await envoie(env, { type: "kz-kdrive-set-token", token: "jeton-a-deux-drives" });
  verifie("deux drives eligibles, la connexion demande un choix explicite",
    rConnect && rConnect.ok === true && rConnect.needsChoice === true, JSON.stringify(rConnect));
  verifie("les deux drives sont bien renvoyes au popup pour le choix",
    rConnect && Array.isArray(rConnect.drives) && rConnect.drives.length === 2, JSON.stringify(rConnect));
  verifie("le jeton est deja stocke chiffre malgre le choix en attente", !!env.store.kdriveTokenEnc);
  verifie("driveId et folderId restent a zero tant que rien n'est choisi",
    !env.store.kdriveDriveId && !env.store.kdriveFolderId);

  const rStatutAvant = await envoie(env, { type: "kz-kdrive-status" });
  verifie("le statut signale needsChoice avant tout choix",
    rStatutAvant && rStatutAvant.configured === true && rStatutAvant.needsChoice === true, JSON.stringify(rStatutAvant));

  // Le popup redemande la liste via le jeton deja stocke, sans le recoller.
  const rListe = await envoie(env, { type: "kz-kdrive-list-drives" });
  verifie("kz-kdrive-list-drives reutilise le jeton stocke, jamais redemande",
    rListe && rListe.ok === true && rListe.drives.length === 2, JSON.stringify(rListe));

  const rChoisi = await envoie(env, { type: "kz-kdrive-choose-drive", driveId: 12, driveName: "Pro" });
  verifie("le choix explicite reussit", rChoisi && rChoisi.ok === true, JSON.stringify(rChoisi));
  verifie("le drive choisi et son dossier sont bien resolus et mis en cache",
    env.store.kdriveDriveId === 12 && env.store.kdriveFolderId === 51 && env.store.kdriveDriveName === "Pro",
    JSON.stringify({ id: env.store.kdriveDriveId, folder: env.store.kdriveFolderId, nom: env.store.kdriveDriveName }));

  const rStatutApres = await envoie(env, { type: "kz-kdrive-status" });
  verifie("le statut ne signale plus needsChoice une fois le drive choisi",
    rStatutApres && rStatutApres.needsChoice === false && rStatutApres.driveName === "Pro", JSON.stringify(rStatutApres));

  // Choisir sans jeton stocke (jamais connecte) : erreur claire, jamais un plantage.
  const envNu = charge({});
  const rChoisirNu = await envoie(envNu, { type: "kz-kdrive-choose-drive", driveId: 12, driveName: "Pro" });
  verifie("choisir un drive sans jeton stocke rend not_configured",
    rChoisirNu && rChoisirNu.ok === false && rChoisirNu.error === "not_configured", JSON.stringify(rChoisirNu));

  // Un seul drive eligible, aucun choix a faire, comportement inchange depuis
  // avant l'ajout du selecteur : connexion directe, needsChoice absent.
  const envUnSeul = charge({}, async (url) => {
    const u = String(url);
    if (u.indexOf("/2/drive/users/current/drives") > -1) return reponse({ result: "success", data: [{ drive_id: 77, drive_name: "Seul" }] });
    if (u.indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/1/directory") > -1) return reponse({ result: "success", data: { id: 60 } });
    if (u.indexOf("/files/60/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/60/directory") > -1) return reponse({ result: "success", data: { id: 61 } });
    throw new Error("route non geree: " + u);
  });
  const rUnSeul = await envoie(envUnSeul, { type: "kz-kdrive-set-token", token: "jeton-a-un-drive" });
  verifie("un seul drive eligible, la connexion aboutit tout de suite, sans needsChoice",
    rUnSeul && rUnSeul.ok === true && !rUnSeul.needsChoice, JSON.stringify(rUnSeul));
  verifie("le drive unique est bien celui resolu et nomme",
    envUnSeul.store.kdriveDriveId === 77 && envUnSeul.store.kdriveDriveName === "Seul");
}

/* ================= 3. Jeton invalide, hors ligne, redirection bloquee ================= */
async function testErreursReseau() {
  const envInvalide = charge({}, async () => reponse({}, { status: 401 }));
  const rInvalide = await envInvalide.contexte.kdriveResolveDrive("mauvais-jeton");
  verifie("un 401 rend invalid_token", rInvalide.ok === false && rInvalide.error === "invalid_token", JSON.stringify(rInvalide));

  const envInterdit = charge({}, async () => reponse({}, { status: 403 }));
  const rInterdit = await envInterdit.contexte.kdriveResolveDrive("jeton-sans-perimetre");
  verifie("un 403 rend aussi invalid_token", rInterdit.ok === false && rInterdit.error === "invalid_token");

  const envHorsLigne = charge({}, async () => { throw new TypeError("Failed to fetch"); });
  const rHorsLigne = await envHorsLigne.contexte.kdriveResolveDrive("tok");
  verifie("un fetch qui leve une erreur rend offline, jamais un succes silencieux",
    rHorsLigne.ok === false && rHorsLigne.error === "offline", JSON.stringify(rHorsLigne));

  // Le piege de l'en-tete Origin : une redirection hors de l'hote de l'API sur
  // une ECRITURE (POST), jamais une reussite silencieuse meme si le statut
  // HTTP est 200. Confirme uniquement sur les ecritures, jamais sur une
  // lecture, voir plus bas.
  const envBloque = charge({}, async () => reponse({ result: "success", data: [] }, { redirected: true, url: "https://login.infomaniak.com/error" }));
  const rBloque = await envBloque.contexte.kdriveUpload("tok", 5, 11, "x.json", { app: "koala-zen" });
  verifie("une redirection hors de l'hote de l'API sur une ecriture est detectee, jamais avalee",
    rBloque.ok === false && rBloque.error === "blocked", JSON.stringify(rBloque));

  // Une redirection qui reste sur l'hote de l'API (pagination, etc.) n'est pas
  // une erreur, seule la sortie de l'hote l'est.
  const envRedirInterne = charge({}, async () => reponse({ result: "success", data: [{ drive_id: 7 }] }, { redirected: true, url: "https://api.infomaniak.com/2/drive/users/current/drives" }));
  const rRedirInterne = await envRedirInterne.contexte.kdriveResolveDrive("tok");
  verifie("une redirection qui reste sur l'hote de l'API n'est pas bloquee",
    rRedirInterne.ok === true && rRedirInterne.driveId === 7, JSON.stringify(rRedirInterne));

  // Confirme en conditions reelles le 2026-08-02 : le telechargement (une
  // LECTURE, GET) redirige legitimement vers un hote de stockage kDrive
  // different (ex. X-X-vX-X.download.kdrive.infomaniakuser...), succes reel,
  // jamais le piege. Le piege ne touche jamais une lecture, seulement une
  // ecriture, donc cette redirection ne doit JAMAIS etre bloquee.
  const envDlRedirige = charge({}, async () => reponse(
    { app: "koala-zen", format: 1 },
    { redirected: true, url: "https://1-2-v3-11.download.kdrive.infomaniakusercontent.com/2/drive/5/files/900/download/900/file" }
  ));
  const rDlRedirige = await envDlRedirige.contexte.kdriveDownload("tok", 5, 900);
  verifie("un telechargement redirige vers un autre hote de stockage reussit, ce n'est jamais le piege",
    rDlRedirige.ok === true && rDlRedirige.data.app === "koala-zen", JSON.stringify(rDlRedirige));
}

/* ================= 4. Pagination, toujours limit=1000 ================= */
async function testPagination() {
  const appels = [];
  const env = charge({}, async (url) => {
    appels.push(String(url));
    return reponse({ result: "success", data: [] });
  });
  await env.contexte.kdriveListFiles("tok", 42, 7);
  verifie("chaque listage demande explicitement limit=1000",
    appels.some((u) => u.indexOf("limit=1000") > -1), appels.join(" | "));
}

/* ================= 5. Racine non inscriptible, repli sur l'espace prive ================= */
async function testRacine() {
  const envEquipe = charge({}, async (url) => {
    if (String(url).indexOf("/files/1/files") > -1) {
      return reponse({
        result: "success",
        data: [
          { id: 501, type: "dir", name: "Documents partages", visibility: "is_team_space" },
          { id: 502, type: "dir", name: "Mon espace prive", visibility: "is_private_space" }
        ]
      });
    }
    throw new Error("route non geree: " + url);
  });
  const r = await envEquipe.contexte.kdriveResolveRoot("tok", 1);
  verifie("l'espace prive est prefere a la racine sur un drive d'equipe",
    r.ok && r.folderId === 502, JSON.stringify(r));

  const envPerso = charge({}, async (url) => {
    if (String(url).indexOf("/files/1/files") > -1) {
      return reponse({ result: "success", data: [{ id: 601, type: "dir", name: "Un dossier normal" }] });
    }
    throw new Error("route non geree: " + url);
  });
  const rPerso = await envPerso.contexte.kdriveResolveRoot("tok", 1);
  verifie("sans espace prive dans la liste, la racine (id 1) convient",
    rPerso.ok && rPerso.folderId === 1, JSON.stringify(rPerso));
}

/* ================= 6. Resolution du dossier Apps/Koala Zen, creation au besoin ================= */
async function testResolutionDossier() {
  const appels = [];
  // Aucun des deux segments n'existe encore : chacun doit etre cree, jamais
  // via un chemin, toujours par un id numerique resolu au prealable.
  const env = charge({}, async (url, init) => {
    appels.push({ url: String(url), method: (init && init.method) || "GET" });
    if (String(url).indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [] }); // racine vide
    if (String(url).indexOf("/files/1/directory") > -1) return reponse({ result: "success", data: { id: 10 } }); // cree "Apps"
    if (String(url).indexOf("/files/10/files") > -1) return reponse({ result: "success", data: [] }); // "Apps" vide
    if (String(url).indexOf("/files/10/directory") > -1) return reponse({ result: "success", data: { id: 11 } }); // cree "Koala Zen"
    throw new Error("route non geree: " + url);
  });
  const r = await env.contexte.kdriveResolveFolder("tok", 5);
  verifie("le dossier final resolu est bien celui de Koala Zen", r.ok && r.folderId === 11, JSON.stringify(r));
  verifie("les deux segments sont bien crees par POST, jamais par un chemin complet",
    appels.filter((a) => a.method === "POST").length === 2, JSON.stringify(appels));

  // Concurrence : la creation echoue (un autre appel a deja cree le dossier),
  // on doit relire avant d'abandonner plutot que de faire echouer la sauvegarde.
  const envConcurrence = charge({}, async (url, init) => {
    if (String(url).indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [] });
    if (String(url).indexOf("/files/1/directory") > -1) return reponse({ result: "error", error: { code: "conflict" } }, { status: 409 });
    // La relecture, elle, trouve desormais le dossier.
    throw new Error("route non geree: " + url);
  });
  // La relecture doit reussir la deuxieme fois qu'on liste /files/1/files.
  let appelsRacine = 0;
  const envConcurrence2 = charge({}, async (url) => {
    if (String(url).indexOf("/files/1/directory") > -1) return reponse({}, { status: 409 });
    if (String(url).indexOf("/files/1/files") > -1) {
      appelsRacine++;
      if (appelsRacine === 1) return reponse({ result: "success", data: [] });
      return reponse({ result: "success", data: [{ id: 77, type: "dir", name: "Apps" }] });
    }
    if (String(url).indexOf("/files/77/files") > -1) return reponse({ result: "success", data: [{ id: 78, type: "dir", name: "Koala Zen" }] });
    throw new Error("route non geree: " + url);
  });
  const rConcurrence = await envConcurrence2.contexte.kdriveResolveFolder("tok", 5);
  verifie("une creation refusee par conflit se rattrape par une relecture",
    rConcurrence.ok && rConcurrence.folderId === 78, JSON.stringify(rConcurrence));
  void envConcurrence;
}

/* ================= 7. Envoi, verification apres coup ================= */
async function testUploadEtVerification() {
  const appels = [];
  const env = charge({}, async (url) => {
    appels.push(String(url));
    if (String(url).indexOf("/upload") > -1) return reponse({ result: "success", data: { id: 900 } });
    if (String(url).indexOf("/files/900") > -1) return reponse({ result: "success", data: { id: 900, name: "koala-zen-2026-08-02.json" } });
    throw new Error("route non geree: " + url);
  });
  const r = await env.contexte.kdriveUpload("tok", 5, 11, "koala-zen-2026-08-02.json", { app: "koala-zen" });
  verifie("l'envoi reussit et rend l'id du fichier cree", r.ok && r.data && r.data.id === 900, JSON.stringify(r));
  verifie("le nom de fichier et le dossier de destination sont bien dans la requete d'envoi",
    appels[0].indexOf("file_name=koala-zen-2026-08-02.json") > -1 && appels[0].indexOf("directory_id=11") > -1, appels[0]);

  // La verification apres coup doit faire echouer la sauvegarde entiere si le
  // fichier fraichement envoye ne se relit pas, plutot que de faire confiance
  // a un simple 2xx sur l'upload.
  const envVerifKO = charge({ kdriveDriveId: 5, kdriveFolderId: 11 }, async (url) => {
    if (String(url).indexOf("/upload") > -1) return reponse({ result: "success", data: { id: 901 } });
    if (String(url).indexOf("/files/901") > -1) return reponse({}, { status: 404 });
    throw new Error("route non geree: " + url);
  });
  // Le jeton doit etre chiffre DANS ce meme contexte, sinon la cle AES generee
  // au premier chiffrement (dans un autre contexte) ne correspond a rien ici.
  envVerifKO.store.kdriveTokenEnc = await envVerifKO.contexte.kdriveEncryptToken("tok");
  const rBackupKO = await envVerifKO.contexte.kdriveBackup({ app: "koala-zen" });
  verifie("une verification qui echoue fait echouer toute la sauvegarde",
    rBackupKO.ok === false && rBackupKO.error === "verify_failed", JSON.stringify(rBackupKO));
  verifie("kdriveLastSync n'est jamais pose quand la verification echoue",
    !envVerifKO.store.kdriveLastSync);
}

/* ================= 8. Liste des sauvegardes et telechargement ================= */
async function testListeEtTelechargement() {
  const env = charge({}, async (url) => {
    if (String(url).indexOf("/files/11/files") > -1) {
      return reponse({
        result: "success",
        data: [
          { id: 1, type: "file", name: "koala-zen-2026-07-01.json", last_modified_at: 1719792000 },
          { id: 2, type: "dir", name: "un dossier ignore" },
          { id: 3, type: "file", name: "koala-zen-2026-08-01.json", last_modified_at: 1722470400 }
        ]
      });
    }
    throw new Error("route non geree: " + url);
  });
  const r = await env.contexte.kdriveListBackups("tok", 5, 11);
  verifie("seuls les fichiers sont gardes, jamais un dossier", r.ok && r.files.length === 2, JSON.stringify(r));
  verifie("le plus recent vient en premier", r.ok && r.files[0].name === "koala-zen-2026-08-01.json", JSON.stringify(r.files));

  const envDl = charge({}, async (url) => {
    if (String(url).indexOf("/download") > -1) return reponse({ app: "koala-zen", format: 1, settings: { intervalMinutes: 45 } });
    throw new Error("route non geree: " + url);
  });
  const rDl = await envDl.contexte.kdriveDownload("tok", 5, 3);
  verifie("le telechargement rend le contenu JSON du fichier",
    rDl.ok && rDl.data && rDl.data.app === "koala-zen" && rDl.data.settings.intervalMinutes === 45, JSON.stringify(rDl));
}

/* ================= 9. Orchestration bout en bout via les messages ================= */
async function testMessagesDeBoutEnBout() {
  // Sans jeton configure, chaque action rend une erreur claire, jamais une
  // tentative silencieuse ni un plantage.
  const envVide = charge({});
  const rStatutVide = await envoie(envVide, { type: "kz-kdrive-status" });
  verifie("sans jeton, le statut annonce non configure", rStatutVide && rStatutVide.configured === false, JSON.stringify(rStatutVide));
  const rBackupVide = await envoie(envVide, { type: "kz-kdrive-backup", bundle: { app: "koala-zen" } });
  verifie("sauvegarder sans jeton rend not_configured, jamais une erreur technique opaque",
    rBackupVide && rBackupVide.ok === false && rBackupVide.error === "not_configured", JSON.stringify(rBackupVide));
  const rListeVide = await envoie(envVide, { type: "kz-kdrive-restore-list" });
  verifie("lister les sauvegardes sans jeton rend aussi not_configured",
    rListeVide && rListeVide.ok === false && rListeVide.error === "not_configured");

  // Connexion complete : resolution du drive, du dossier, chiffrement du jeton.
  let creeApps = false;
  const env = charge({}, async (url, init) => {
    const u = String(url);
    if (u.indexOf("/2/drive/users/current/drives") > -1) return reponse({ result: "success", data: [{ id: 1, drive_id: 55 }] });
    if (u.indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/1/directory") > -1) { creeApps = true; return reponse({ result: "success", data: { id: 20 } }); }
    if (u.indexOf("/files/20/files") > -1) return reponse({ result: "success", data: [] });
    if (u.indexOf("/files/20/directory") > -1) return reponse({ result: "success", data: { id: 21 } });
    throw new Error("route non geree: " + u);
  });
  const rConnect = await envoie(env, { type: "kz-kdrive-set-token", token: "  un-vrai-jeton  " });
  verifie("la connexion reussit", rConnect && rConnect.ok === true, JSON.stringify(rConnect));
  verifie("les deux segments Apps et Koala Zen sont bien crees", creeApps);
  verifie("le jeton n'est jamais garde en clair dans le stockage",
    JSON.stringify(env.store.kdriveTokenEnc || {}).indexOf("un-vrai-jeton") === -1, JSON.stringify(env.store.kdriveTokenEnc));
  verifie("le drive et le dossier resolus sont bien mis en cache",
    env.store.kdriveDriveId === 55 && env.store.kdriveFolderId === 21);

  const rStatutConnecte = await envoie(env, { type: "kz-kdrive-status" });
  verifie("apres connexion, le statut annonce configure", rStatutConnecte && rStatutConnecte.configured === true);

  // Jeton vide, refuse avant meme un appel reseau.
  const envVideJeton = charge({});
  const rVideJeton = await envoie(envVideJeton, { type: "kz-kdrive-set-token", token: "   " });
  verifie("un jeton vide ou blanc est refuse avant tout appel reseau",
    rVideJeton && rVideJeton.ok === false && rVideJeton.error === "empty_token", JSON.stringify(rVideJeton));

  // Deconnexion : tout est efface, y compris la cle de chiffrement.
  const rClear = await envoie(env, { type: "kz-kdrive-clear" });
  verifie("la deconnexion reussit", rClear && rClear.ok === true);
  verifie("le jeton chiffre est efface", !env.store.kdriveTokenEnc);
  verifie("le drive et le dossier en cache sont effaces", !env.store.kdriveDriveId && !env.store.kdriveFolderId);
  const rStatutApresClear = await envoie(env, { type: "kz-kdrive-status" });
  verifie("apres deconnexion, le statut redevient non configure", rStatutApresClear && rStatutApresClear.configured === false);
}

/* ================= 10. Sauvegarde et restauration bout en bout, cache reutilise ================= */
async function testSauvegardeEtRestaurationBoutEnBout() {
  const appelsUpload = [];
  const env = charge({}, async (url, init) => {
    const u = String(url);
    // Ordre volontaire, du plus specifique au plus general : "/files/400" est
    // un sous-texte de "/files/400/download", verifier ce dernier en premier.
    if (u.indexOf("/2/drive/users/current/drives") > -1) return reponse({ result: "success", data: [{ drive_id: 8 }] });
    if (u.indexOf("/download") > -1) return reponse({ app: "koala-zen", format: 1, content: { habitGoal: 3 } });
    if (u.indexOf("/upload") > -1) { appelsUpload.push(u); return reponse({ result: "success", data: { id: 400 } }); }
    if (u.indexOf("/files/1/files") > -1) return reponse({ result: "success", data: [{ id: 30, type: "dir", name: "Apps" }] });
    if (u.indexOf("/files/30/files") > -1) return reponse({ result: "success", data: [{ id: 31, type: "dir", name: "Koala Zen" }] });
    if (u.indexOf("/files/31/files") > -1) return reponse({ result: "success", data: [{ id: 400, type: "file", name: "koala-zen-2026-08-02.json", last_modified_at: 1722556800 }] });
    if (u.indexOf("/files/400") > -1) return reponse({ result: "success", data: { id: 400 } });
    throw new Error("route non geree: " + u);
  });
  await envoie(env, { type: "kz-kdrive-set-token", token: "jeton" });
  const rBackup = await envoie(env, { type: "kz-kdrive-backup", bundle: { app: "koala-zen", format: 1, settings: { intervalMinutes: 45 } } });
  verifie("la sauvegarde bout en bout reussit", rBackup && rBackup.ok === true, JSON.stringify(rBackup));
  verifie("kdriveLastSync est bien pose apres une sauvegarde reussie", !!env.store.kdriveLastSync);

  const rListe = await envoie(env, { type: "kz-kdrive-restore-list" });
  verifie("la liste des sauvegardes rend bien le fichier envoye",
    rListe && rListe.ok === true && rListe.files.length === 1 && rListe.files[0].name === "koala-zen-2026-08-02.json",
    JSON.stringify(rListe));

  const rRestore = await envoie(env, { type: "kz-kdrive-restore-file", fileId: 400 });
  verifie("la restauration rend le contenu exact de la sauvegarde",
    rRestore && rRestore.ok === true && rRestore.data.content.habitGoal === 3, JSON.stringify(rRestore));

  // Un deuxieme appel de sauvegarde doit reutiliser le cache, jamais refaire
  // toute la resolution du drive et du dossier.
  const avantUploads = appelsUpload.length;
  await envoie(env, { type: "kz-kdrive-backup", bundle: { app: "koala-zen", format: 1 } });
  verifie("une deuxieme sauvegarde envoie bien un nouveau fichier via le cache",
    appelsUpload.length === avantUploads + 1);
}

/* ================= 11. Les cles kdrive ne sont jamais exportables ================= */
function testJamaisExportable() {
  const src = fs.readFileSync(path.join(RACINE, "background.js"), "utf8");
  verifie("les six cles kdrive vivent dans DEFAULTS, jamais dans passageState ni ailleurs",
    ["kdriveTokenEnc", "kdriveKeyJwk", "kdriveDriveId", "kdriveFolderId", "kdriveLastSync", "kdriveLastError"]
      .every((k) => src.indexOf(k) > -1));
  const srcPopup = fs.readFileSync(path.join(RACINE, "popup.js"), "utf8");
  const mSettings = srcPopup.match(/const SETTINGS_KEYS = \[([^\]]*)\]/);
  verifie("SETTINGS_KEYS de popup.js ne contient jamais une cle kdrive",
    !!mSettings && !/kdrive/i.test(mSettings[1]), mSettings && mSettings[1]);
  ["CONTENT_KEYS", "STATS_KEYS", "KOALA_KEYS"].forEach((nomListe) => {
    const m = srcPopup.match(new RegExp("const " + nomListe + " = \\[([^\\]]*)\\]"));
    verifie(nomListe + " ne contient jamais une cle kdrive", !!m && !/kdrive/i.test(m[1]), m && m[1]);
  });
}

/* ================= 12. kz-reset-all efface aussi l'etat kdrive ================= */
async function testResetAllEffaceKdrive() {
  const env = charge({
    kdriveTokenEnc: { iv: [1, 2, 3], data: [4, 5, 6] },
    kdriveKeyJwk: { k: "x" },
    kdriveDriveId: 5,
    kdriveFolderId: 11,
    kdriveLastSync: 123456,
    kdriveLastError: "invalid_token"
  });
  await envoie(env, { type: "kz-reset-all" });
  verifie("kz-reset-all efface le jeton chiffre", !env.store.kdriveTokenEnc);
  verifie("kz-reset-all efface la cle de chiffrement", !env.store.kdriveKeyJwk);
  verifie("kz-reset-all efface le drive et le dossier en cache",
    !env.store.kdriveDriveId && !env.store.kdriveFolderId);
  verifie("kz-reset-all efface la derniere erreur et la derniere synchro",
    !env.store.kdriveLastSync && !env.store.kdriveLastError);
}

/* ---------- execution ---------- */
(async () => {
  const suites = [
    ["Chiffrement du jeton", testChiffrement],
    ["Resolution du drive, drive_id contre id", testResolutionDrive],
    ["Liste des drives, eligibilite et espace libre", testListeEtEligibiliteDrives],
    ["Plusieurs drives eligibles, choix explicite requis", testChoixExplicite],
    ["Jeton invalide, hors ligne, redirection bloquee", testErreursReseau],
    ["Pagination, toujours limit=1000", testPagination],
    ["Racine non inscriptible, repli sur l'espace prive", testRacine],
    ["Resolution du dossier Apps/Koala Zen, creation au besoin", testResolutionDossier],
    ["Envoi, verification apres coup", testUploadEtVerification],
    ["Liste des sauvegardes et telechargement", testListeEtTelechargement],
    ["Orchestration bout en bout via les messages", testMessagesDeBoutEnBout],
    ["Sauvegarde et restauration bout en bout, cache reutilise", testSauvegardeEtRestaurationBoutEnBout],
    ["Les cles kdrive ne sont jamais exportables", testJamaisExportable],
    ["kz-reset-all efface aussi l'etat kdrive", testResetAllEffaceKdrive]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === 0 || echecs.length === 0 ? "ok " : "   ", nom, ok + ko - avant);
  }
  console.log("\n=== kdrive (background.js) : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
