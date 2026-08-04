const api = globalThis.browser || globalThis.chrome;
const ALARM = "kz-move";
const IDLE_SECONDS = 60;
const PENDING_MAX = 6;
const SNOOZE_MINUTES = 15;
const TICK = "kz-tick";
const TICK_MINUTES = 1;
const TICK_MAX_GAP_MS = 130000;
const DEFAULT_TZ = "Europe/Zurich";
const KDRIVE_API = "https://api.infomaniak.com";
const KDRIVE_FOLDER_PATH = ["Apps", "Koala Zen"];

const DEFAULT_MUTED = [
  "kmeet.infomaniak.com",
  "teams.microsoft.com",
  "teams.live.com",
  "zoom.us",
  "meet.google.com"
];

const DEFAULTS = {
  intervalMinutes: 30,
  preset: "custom",
  customInterval: 45,
  muteInCalls: true,
  mutedPatterns: DEFAULT_MUTED,
  pauseWhenIdle: true,
  focusMode: false,
  focusSeconds: 30,
  customKoalas: [],
  includeDefaultKoalas: false,
  customQuotes: [],
  customSport: [],
  includeDefaultQuotes: false,
  hiddenQuotes: [],
  habitGoal: 3,
  sportIndex: 0,
  animMode: "always",
  passages: true,
  passageFrequency: "normal",
  snarkIndex: 0,
  snarkDay: "",
  firstRun: true,
  importMode: "merge",
  pausedUntil: 0,
  pending: 0,
  statsDaily: {},
  screenTimezone: DEFAULT_TZ,
  screenDaily: {},
  screenLastTick: 0,
  // Ordonnancement des animaux de passage. Jamais exporte, jamais compte en statistique.
  passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0 },
  // kDrive, sauvegarde optionnelle. Jamais dans SETTINGS_KEYS de popup.js, jamais
  // dans un fichier exporte : le jeton ne doit JAMAIS pouvoir se retrouver dans
  // une sauvegarde locale partagee par erreur.
  kdriveTokenEnc: null,
  kdriveKeyJwk: null,
  kdriveDriveId: 0,
  kdriveDriveName: "",
  kdriveFolderId: 0,
  kdriveLastSync: 0,
  kdriveLastError: ""
};

function pad2(n) { return String(n).padStart(2, "0"); }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

// Les statistiques sont conservees a vie. Aucune purge automatique.

// Fuseau horaire pour le calcul du jour courant. La valeur "auto" reprend le
// fuseau du navigateur. Toute valeur invalide retombe sur le fuseau par defaut.
function resolveTz(tz) {
  if (!tz || tz === "auto") {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ; } catch (e) { return DEFAULT_TZ; }
  }
  return tz;
}

// Cle de jour AAAA-MM-JJ dans le fuseau choisi. en-CA rend directement ce format.
function tzDayKey(tz, d) {
  d = d || new Date();
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: resolveTz(tz), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch (e) {
    return dayKey(d);
  }
}

async function screenIsActive() {
  try {
    let st;
    if (globalThis.browser && globalThis.browser.idle) { st = await globalThis.browser.idle.queryState(IDLE_SECONDS); }
    else { st = await new Promise((r) => chrome.idle.queryState(IDLE_SECONDS, r)); }
    return st === "active";
  } catch (e) { return false; }
}

// Accumule le temps d'activite du jour. Appele a chaque tick d'une minute et
// juste avant d'afficher le koala, pour que la valeur soit a jour.
async function accrueScreen() {
  const now = Date.now();
  const r = await api.storage.local.get(["screenDaily", "screenLastTick", "screenTimezone"]);
  const daily = (r.screenDaily && typeof r.screenDaily === "object") ? r.screenDaily : {};
  const tz = r.screenTimezone || DEFAULT_TZ;
  const last = Number(r.screenLastTick) || 0;
  if (await screenIsActive() && last > 0) {
    const delta = now - last;
    if (delta > 0 && delta <= TICK_MAX_GAP_MS) {
      const k = tzDayKey(tz, new Date(now));
      daily[k] = (Number(daily[k]) || 0) + Math.round(delta / 1000);
    }
  }
  await api.storage.local.set({ screenDaily: daily, screenLastTick: now });
}

async function screenTodaySeconds() {
  const r = await api.storage.local.get(["screenDaily", "screenTimezone"]);
  const daily = (r.screenDaily && typeof r.screenDaily === "object") ? r.screenDaily : {};
  const tz = r.screenTimezone || DEFAULT_TZ;
  return Math.max(0, Math.round(Number(daily[tzDayKey(tz)]) || 0));
}

function ensureTick() {
  try { api.alarms.create(TICK, { periodInMinutes: TICK_MINUTES }); } catch (e) { /* noop */ }
}

// Tranche horaire d'un report, 0 matin, 1 midi, 2 apres-midi, 3 soir.
function hourSlot(d) {
  // Tranches de la planche 14, matin avant 12 h, debut d'apres-midi jusqu'a
  // 15 h, fin d'apres-midi jusqu'a 18 h, soiree apres 18 h. repH reste sur
  // quatre entiers, donc aucune migration de donnees.
  const h = (d || new Date()).getHours();
  if (h < 12) return 0;
  if (h < 15) return 1;
  if (h < 18) return 2;
  return 3;
}

function dayKeyOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function streakFrom(stats) {
  let i = 0;
  if (!(stats[dayKeyOffset(0)] || {}).done) i = -1;
  let n = 0, guard = 0;
  while (guard < 4000) {
    const day = stats[dayKeyOffset(i)] || {};
    if (!day.done) break;
    n++; i--; guard++;
  }
  return n;
}

async function recordOutcome(result, energy) {
  const r = await api.storage.local.get(["statsDaily", "pending"]);
  const stats = (r.statsDaily && typeof r.statsDaily === "object") ? r.statsDaily : {};
  let pending = Number(r.pending) || 0;
  const k = dayKey();
  const day = stats[k] || { due: 0, done: 0, rep: 0, eSum: 0, eCount: 0, repH: [0, 0, 0, 0] };
  if (day.eSum == null) day.eSum = 0;
  if (day.eCount == null) day.eCount = 0;
  if (day.rep == null) day.rep = 0;
  if (!Array.isArray(day.repH) || day.repH.length !== 4) day.repH = [0, 0, 0, 0];
  if (result === "done") { day.due += 1; day.done += 1; }
  else if (result === "later" || result === "missed") { day.due += 1; day.rep += 1; day.repH[hourSlot()] += 1; pending = Math.min(PENDING_MAX, pending + 1); }
  else if (result === "catchup") { day.done += 1; pending = Math.max(0, pending - 1); }
  const e = Math.round(Number(energy));
  if ((result === "done" || result === "catchup" || result === "later") && !isNaN(e) && e >= 1 && e <= 10) { day.eSum += e; day.eCount += 1; }
  stats[k] = day;
  await api.storage.local.set({ statsDaily: stats, pending: pending });
}

function clampInterval(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(240, Math.max(1, n)); }

async function schedule(delayMin) {
  const stored = await api.storage.local.get(["intervalMinutes"]);
  const cfg = { ...DEFAULTS, ...stored };
  await api.alarms.clear(ALARM);
  const interval = clampInterval(cfg.intervalMinutes);
  const delay = (delayMin != null && delayMin > 0) ? delayMin : interval;
  api.alarms.create(ALARM, { delayInMinutes: delay, periodInMinutes: interval });
}

api.runtime.onInstalled.addListener(async (details) => {
  const stored = await api.storage.local.get(Object.keys(DEFAULTS));
  const base = { ...DEFAULTS, ...stored, screenLastTick: Date.now() };
  // Le premier ecran ne doit apparaitre qu'a une INSTALLATION reelle, jamais a
  // une mise a jour, sinon un utilisateur de longue date le reverrait au
  // prochain numero de version.
  if (details && details.reason !== "install") base.firstRun = false;
  await api.storage.local.set(base);
  schedule();
  ensureTick();
  schedulePassage();
});

if (api.runtime.onStartup) {
  api.runtime.onStartup.addListener(async () => {
    await api.storage.local.set({ screenLastTick: Date.now() });
    schedule();
    ensureTick();
    schedulePassage();
  });
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) trigger({ respectMute: true });
  else if (alarm.name === TICK) accrueScreen();
  else if (alarm.name === ALARM_PASSAGE) {
    // Le creneau est replanifie quoi qu'il arrive, meme si le passage est refuse.
    triggerPassage().then(schedulePassage, schedulePassage);
  }
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  // Bouton de test des animaux de passage. Il ignore la plage horaire et l'ecart
  // de deux heures, mais PAS les interdits qui protegent l'utilisateur, visio,
  // pause et mode Jamais. Il ne consomme pas le quota du jour.
  if (msg.type === "kz-passage-now") { triggerPassage({ test: true }).catch(() => {}); return; }
  if (msg.type === "kz-trigger-now") {
    trigger({ force: true }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-save") {
    // schedulePassage() est rappelee a chaque sauvegarde, comme schedule(), pour
    // qu'un changement de frequence prenne effet immediatement plutot que
    // d'attendre le prochain reveil deja planifie avec l'ancien reglage.
    api.storage.local.set(msg.payload || {}).then(() => schedule()).then(() => schedulePassage()).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-outcome") {
    recordOutcome(msg.result, msg.energy).then(() => {
      if (msg.result === "later") return schedule(SNOOZE_MINUTES);
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-catchup") {
    recordOutcome("catchup", msg.energy).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-pause") {
    const until = Number(msg.until) || 0;
    api.storage.local.set({ pausedUntil: until }).then(() => {
      const delay = Math.max(0.05, (until - Date.now()) / 60000 + 0.05);
      return schedule(delay);
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-resume") {
    api.storage.local.set({ pausedUntil: 0 }).then(() => schedule()).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-reset-all") {
    // Tout remettre a zero, y compris reglages, contenus et images importees.
    api.storage.local.clear()
      .then(() => api.storage.local.set({ ...DEFAULTS, screenLastTick: Date.now() }))
      .then(() => schedule())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-reset") {
    // Efface l'historique (statistiques et temps d'ecran) et remet le rattrapage a zero.
    // Les reglages, koalas et pensees sont conserves.
    api.storage.local.set({ statsDaily: {}, screenDaily: {}, pending: 0, screenLastTick: 0 }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-kdrive-set-token") {
    kdriveSetToken(msg.token).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-clear") {
    kdriveClear().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-status") {
    kdriveState().then((r) => sendResponse(r)).catch(() => sendResponse({ configured: false, lastSync: 0, lastError: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-backup") {
    kdriveBackup(msg.bundle).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-restore-list") {
    kdriveRestoreList().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-restore-file") {
    kdriveRestoreFile(msg.fileId).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-choose-drive") {
    kdriveChooseDrive(msg.driveId, msg.driveName).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-kdrive-list-drives") {
    kdriveListDrivesForPopup().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
});

function hostFromUrl(url) { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; } }

function matchesMuted(url, patterns) {
  const host = hostFromUrl(url);
  if (!host || !Array.isArray(patterns)) return false;
  return patterns.some((raw) => {
    const base = String(raw).trim().toLowerCase().replace(/^\*\./, "").replace(/\/.*$/, "");
    if (!base) return false;
    return host === base || host.endsWith("." + base);
  });
}

async function isIdle() {
  try {
    let st;
    if (globalThis.browser && globalThis.browser.idle) { st = await globalThis.browser.idle.queryState(IDLE_SECONDS); }
    else { st = await new Promise((r) => chrome.idle.queryState(IDLE_SECONDS, r)); }
    return st && st !== "active";
  } catch (e) { return false; }
}

async function trigger(opts) {
  const force = !!(opts && opts.force);
  const respectMute = !opts || opts.respectMute !== false;
  const cfg = { ...DEFAULTS, ...(await api.storage.local.get(["muteInCalls", "mutedPatterns", "pauseWhenIdle", "pausedUntil", "focusMode", "focusSeconds", "intervalMinutes", "habitGoal", "statsDaily"])) };
  if (!force) {
    if (cfg.pausedUntil && Date.now() < cfg.pausedUntil) return;
    if (cfg.pauseWhenIdle && (await isIdle())) return;
  }
  const tab = await targetTab();
  if (!tab) return;
  if (!force && respectMute && cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns)) return;
  await accrueScreen();
  const screenToday = await screenTodaySeconds();
  const stats = (cfg.statsDaily && typeof cfg.statsDaily === "object") ? cfg.statsDaily : {};
  const today = stats[dayKeyOffset(0)] || {};
  const payload = {
    type: "kz-show",
    focus: !!cfg.focusMode,
    focusSeconds: clampFocus(cfg.focusSeconds),
    screenToday: screenToday,
    snoozeMinutes: SNOOZE_MINUTES,
    intervalMinutes: clampInterval(cfg.intervalMinutes),
    doneToday: today.done || 0,
    repToday: today.rep || 0,
    habitGoal: Math.max(0, Math.min(20, Math.round(Number(cfg.habitGoal) || 0))),
    streak: streakFrom(stats)
  };
  try {
    const brut = (await api.storage.local.get(["passageState"])).passageState;
    const majPassage = passageStateFrom(brut);
    majPassage.lastReminder = Date.now();
    await api.storage.local.set({ passageState: majPassage });
  } catch (e) { /* noop */ }
  try {
    await api.tabs.sendMessage(tab.id, payload);
  } catch (e) {
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["quotes.js", "passages.js", "content.js"] });
      await api.tabs.sendMessage(tab.id, payload);
    } catch (_) { /* page non compatible (ex : page interne du navigateur) */ }
  }
}

// ===========================================================================
// Les animaux de passage. Purement gratuits, ils ne demandent rien et
// n'entrent NULLE PART dans les donnees, ni comptes, ni exportes. Seul leur
// ordonnancement vit dans passageState, qui est hors de toute liste d'export.
// ===========================================================================

const ALARM_PASSAGE = "kz-passage";

// Duree en millisecondes, qui parle, poids de tirage relatif. Le chat, seul
// ou en rencontre, et le renard pour la rencontre la plus rare. Jamais le
// koala, jamais l'arbre.
const PASSAGES = [
  { id: "cross", ms: 15000, who: "cat", weight: 30 },
  { id: "sit",   ms: 20000, who: "cat", weight: 10 },
  { id: "yawn",  ms: 22500, who: "cat", weight: 8 },
  { id: "meetCats", ms: 14000, who: "both", weight: 3 },
  { id: "meetFox",  ms: 14000, who: "both", weight: 1 }
];

const PASSAGE_COATS = 7;          // sept pelages de chat
const PASSAGE_PHRASES = 8;        // huit phrases communes
// Trois reglages de frequence, choisis par l'utilisateur. gapHours fixe a la
// fois l'ecart minimum dur entre deux passages ET, par extension dans
// nextPassageDelayMinutes, la fenetre aleatoire du prochain reveil. maxPerDay
// suit dans la meme proportion pour rester coherent avec l'ecart choisi.
// "normal" reprend EXACTEMENT les valeurs historiques (2 h, 4 par jour).
const PASSAGE_FREQ = {
  rare:     { gapHours: 3, maxPerDay: 3 },
  normal:   { gapHours: 2, maxPerDay: 4 },
  frequent: { gapHours: 1, maxPerDay: 6 }
};
const PASSAGE_FREQ_DEFAULT = "normal";
// Plafond le plus haut de tous les reglages, utilise uniquement pour assainir
// une valeur de stockage abimee, jamais comme regle de blocage elle-meme.
const PASSAGE_MAX_PER_DAY_HARD = 6;
const PASSAGE_QUIET_AFTER_REMINDER = 60 * 1000; // jamais dans la minute qui suit un rappel
const PASSAGE_HOUR_FROM = 8;
const PASSAGE_HOUR_TO = 20;
const PASSAGE_FOX_GAP = 30 * 24 * 60 * 60 * 1000;  // le renard, une fois par mois au plus
const PASSAGE_MEET_GAP = 7 * 24 * 60 * 60 * 1000;  // les deux chats, une fois par semaine au plus

function passageFreq(cfg) {
  return PASSAGE_FREQ[cfg && cfg.passageFrequency] || PASSAGE_FREQ[PASSAGE_FREQ_DEFAULT];
}

function passageStateFrom(raw) {
  const s = (raw && typeof raw === "object") ? raw : {};
  return {
    day: typeof s.day === "string" ? s.day : "",
    count: Math.max(0, Math.min(PASSAGE_MAX_PER_DAY_HARD, Math.round(Number(s.count) || 0))),
    last: Math.max(0, Number(s.last) || 0),
    lastVariant: typeof s.lastVariant === "string" ? s.lastVariant : "",
    lastPhrase: Number.isFinite(Number(s.lastPhrase)) ? Number(s.lastPhrase) : -1,
    lastCoat: Number.isFinite(Number(s.lastCoat)) ? Number(s.lastCoat) : -1,
    lastReminder: Math.max(0, Number(s.lastReminder) || 0),
    lastFox: Math.max(0, Number(s.lastFox) || 0),
    lastMeet: Math.max(0, Number(s.lastMeet) || 0)
  };
}

// Heure locale dans le fuseau retenu, celui du reglage Temps d'ecran.
function tzHour(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), hour: "2-digit", hour12: false });
    return parseInt(f.format(when || new Date()), 10);
  } catch (e) { return (when || new Date()).getHours(); }
}

// Tirage pondere sur 100. Si le tirage tombe sur la variante du tour
// precedent, on prend la suivante.
function pickPassage(state, nowMs, rnd) {
  const st = passageStateFrom(state);
  const alea = typeof rnd === "function" ? rnd : Math.random;
  // Le renard et la rencontre a deux chats sont plafonnes independamment du
  // poids, retires du tirage AVANT qu'il n'ait lieu plutot qu'apres.
  const ouvertes = PASSAGES.filter((p) => {
    if (p.id === "meetFox" && st.lastFox && nowMs - st.lastFox < PASSAGE_FOX_GAP) return false;
    if (p.id === "meetCats" && st.lastMeet && nowMs - st.lastMeet < PASSAGE_MEET_GAP) return false;
    return true;
  });
  if (!ouvertes.length) return null;
  const total = ouvertes.reduce((a, p) => a + p.weight, 0);
  let seuil = alea() * total;
  let i = 0;
  for (; i < ouvertes.length; i++) { seuil -= ouvertes[i].weight; if (seuil < 0) break; }
  if (i >= ouvertes.length) i = ouvertes.length - 1;
  if (ouvertes.length > 1 && ouvertes[i].id === st.lastVariant) i = (i + 1) % ouvertes.length;
  const variante = ouvertes[i];

  // Jamais deux fois de suite le meme pelage ni la meme phrase.
  let coat = Math.floor(alea() * PASSAGE_COATS);
  if (coat >= PASSAGE_COATS) coat = PASSAGE_COATS - 1;
  if (coat === st.lastCoat) coat = (coat + 1) % PASSAGE_COATS;
  let phrase = Math.floor(alea() * PASSAGE_PHRASES);
  if (phrase >= PASSAGE_PHRASES) phrase = PASSAGE_PHRASES - 1;
  if (phrase === st.lastPhrase) phrase = (phrase + 1) % PASSAGE_PHRASES;

  return { variant: variante.id, ms: variante.ms, who: variante.who, coat: coat, phrase: phrase };
}

// Les interdits. Le silence est prioritaire sur tout le reste.
// Renvoie une chaine expliquant le refus, ou la chaine vide si le passage peut jouer.
function passageBlocked(cfg, state, nowMs, tz) {
  const st = passageStateFrom(state);
  if (!cfg.passages) return "reglage";
  if (cfg.animMode === "never") return "animations";
  const h = tzHour(tz, new Date(nowMs));
  if (h < PASSAGE_HOUR_FROM || h >= PASSAGE_HOUR_TO) return "horaire";
  if (cfg.pausedUntil && nowMs < cfg.pausedUntil) return "pause";
  // La fenetre de silence couvre le rappel ET la pause focus, qui peut durer
  // jusqu'a 120 s, sinon un passage traverserait pendant le voile.
  const silence = cfg.focusMode
    ? Math.max(PASSAGE_QUIET_AFTER_REMINDER, (Number(cfg.focusSeconds) || 30) * 1000 + PASSAGE_QUIET_AFTER_REMINDER)
    : PASSAGE_QUIET_AFTER_REMINDER;
  if (st.lastReminder && nowMs - st.lastReminder < silence) return "rappel";
  const freq = passageFreq(cfg);
  if (st.day === tzDayKey(tz, new Date(nowMs)) && st.count >= freq.maxPerDay) return "plafond";
  if (st.last && nowMs - st.last < freq.gapHours * 60 * 60 * 1000) return "ecart";
  return "";
}

// Heure du prochain passage, tiree au hasard et jamais fixe. On vise un creneau
// entre gapHours et 2,5 fois gapHours (2 a 5 h pour le reglage "normal", inchange
// par rapport a l'historique), borne a la plage 8 h 20 h par passageBlocked au
// moment du declenchement. Un creneau perdu n'est jamais rattrape.
function nextPassageDelayMinutes(gapHours, rnd) {
  const alea = typeof rnd === "function" ? rnd : Math.random;
  const gapMin = (Number(gapHours) || PASSAGE_FREQ[PASSAGE_FREQ_DEFAULT].gapHours) * 60;
  return gapMin + Math.floor(alea() * (gapMin * 1.5));
}

async function schedulePassage() {
  try { await api.alarms.clear(ALARM_PASSAGE); } catch (e) { /* noop */ }
  const cfg = { ...DEFAULTS, ...(await api.storage.local.get(["passageFrequency"])) };
  const mins = nextPassageDelayMinutes(passageFreq(cfg).gapHours);
  try { await api.alarms.create(ALARM_PASSAGE, { delayInMinutes: mins }); } catch (e) { /* noop */ }
}

async function triggerPassage(opts) {
  const test = !!(opts && opts.test);
  const cfg = { ...DEFAULTS, ...(await api.storage.local.get(["passages", "passageFrequency", "animMode", "pausedUntil", "pauseWhenIdle", "muteInCalls", "mutedPatterns", "screenTimezone", "focusMode", "focusSeconds", "passageState"])) };
  const now = Date.now();
  const st = passageStateFrom(cfg.passageState);
  const motif = passageBlocked(cfg, st, now, cfg.screenTimezone);
  // Le bouton de test contourne l'horaire, l'ecart de deux heures et le plafond
  // du jour. Il ne contourne JAMAIS ce qui protege l'utilisateur, le reglage
  // eteint, le mode Jamais, une pause en cours, le silence apres un rappel, ni
  // la visio et l'inactivite verifiees plus bas.
  const contournable = (motif === "horaire" || motif === "ecart" || motif === "plafond");
  if (motif && !(test && contournable)) return;
  if (cfg.pauseWhenIdle && !test && (await isIdle())) return;

  const tab = await targetTab();
  if (!tab) return;
  // La visio est prioritaire sur tout le reste, meme si rien n'est mis en pause.
  if (cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns)) return;

  const choix = pickPassage(st, now);
  if (!choix) return;
  const jour = tzDayKey(cfg.screenTimezone, new Date(now));
  // Un passage de TEST ne consomme ni le quota du jour ni le creneau des deux
  // heures, sinon essayer le bouton priverait l'utilisateur d'un vrai passage.
  const suivant = {
    day: jour,
    count: (st.day === jour ? st.count : 0) + (test ? 0 : 1),
    last: test ? st.last : now,
    lastVariant: choix.variant,
    lastPhrase: choix.phrase,
    lastCoat: choix.coat,
    lastReminder: st.lastReminder,
    lastFox: (choix.variant === "meetFox" && !test) ? now : st.lastFox,
    lastMeet: (choix.variant === "meetCats" && !test) ? now : st.lastMeet
  };

  try {
    const envoi = {
      type: "kz-passage",
      animMode: cfg.animMode,
      variant: choix.variant,
      ms: choix.ms,
      who: choix.who,
      coat: choix.coat,
      phrase: choix.phrase
    };
    try {
      await api.tabs.sendMessage(tab.id, envoi);
    } catch (e) {
      // Meme secours que pour le rappel. Un onglet ouvert AVANT l'installation ou
      // le rechargement de l'extension n'a pas les scripts de page, sendMessage
      // echoue, et sans cette reinjection le passage etait perdu en silence.
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["quotes.js", "passages.js", "content.js"] });
      await api.tabs.sendMessage(tab.id, envoi);
    }
    // Limite connue et acceptee : le creneau de deux heures et le quota du jour
    // sont consommes des que sendMessage reussit, pas quand la bulle est
    // effectivement affichee. Si passages.js avale l'appel en silence cote
    // page (reduceMotion, largeur trop etroite pour who:"both", 'vivant' deja
    // vrai), le passage est compte comme joue sans jamais avoir ete vu. Une
    // vraie correction demanderait un accuse de reception depuis la page, ce
    // qui n'existe pas aujourd'hui. Impact juge mineur : au pire un passage de
    // moins ce jour-la, jamais un passage en trop.
    await api.storage.local.set({ passageState: suivant });
  } catch (e) {
    // Page non compatible. Le creneau est perdu, jamais rattrape, et il n'est
    // pas consomme puisque aucune bulle n'a ete affichee.
  }
}

function clampFocus(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(120, Math.max(5, n)); }

async function targetTab() {
  // Le seul onglet valide est celui au premier plan de la fenetre au premier
  // plan. Si ce n'est pas une page http(s) (page interne, PDF, nouvel onglet),
  // il n'y a PAS d'onglet cible, meme si une page http(s) est ouverte ailleurs
  // en arriere plan. Se rabattre sur un onglet quelconque romprait le "jamais
  // dans l'onglet inactif" que le rappel et les passages doivent respecter.
  try {
    const [t] = await api.tabs.query({ active: true, lastFocusedWindow: true });
    if (t && /^https?:/.test(t.url || "")) return t;
  } catch (e) { /* noop */ }
  return null;
}

// ===========================================================================
// kDrive, sauvegarde et restauration optionnelles vers le kDrive de
// l'utilisateur, dossier Apps/Koala Zen. Repose sur un jeton d'acces personnel
// Infomaniak (perimetre kDrive), saisi une fois par l'utilisateur, jamais un
// flux OAuth. Aucun appel n'a lieu tant qu'aucun jeton n'est enregistre.
// ===========================================================================

// Le jeton n'est jamais garde en clair dans le stockage. La cle AES-GCM vit a
// cote de son chiffre, ce qui protege contre une lecture accidentelle ou une
// fuite dans un export, mais PAS contre un acces complet au stockage de
// l'extension : sans coffre-fort systeme disponible aux WebExtensions, c'est
// la meilleure protection realiste ici. Documente tel quel, jamais presente
// comme un chiffrement a l'epreuve d'un attaquant qui lirait storage.local.
async function kdriveKey() {
  const r = await api.storage.local.get(["kdriveKeyJwk"]);
  if (r.kdriveKeyJwk) {
    return crypto.subtle.importKey("jwk", r.kdriveKeyJwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await api.storage.local.set({ kdriveKeyJwk: jwk });
  return key;
}

async function kdriveEncryptToken(token) {
  const key = await kdriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
}

async function kdriveDecryptToken(blob) {
  if (!blob || !Array.isArray(blob.iv) || !Array.isArray(blob.data)) return null;
  try {
    const key = await kdriveKey();
    const iv = new Uint8Array(blob.iv);
    const data = new Uint8Array(blob.data);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch (e) { return null; }
}

// Enveloppe unique pour tous les appels a l'API. Distingue explicitement trois
// echecs qui ne doivent JAMAIS remonter comme une reussite silencieuse : un
// fetch qui n'a jamais atteint le serveur (hors ligne), une redirection d'une
// ECRITURE (POST) hors de l'hote de l'API (le piege de l'en-tete Origin, cense
// etre neutralise par rules.json, mais detecte quand meme au cas ou, jamais
// verifie sur une lecture qui redirige legitimement vers un autre hote de
// stockage), et une reponse HTTP en echec.
async function kdriveFetch(token, path, opts) {
  opts = opts || {};
  const method = opts.method || "GET";
  const headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
  let res;
  try {
    res = await fetch(KDRIVE_API + path, { method: method, headers: headers, body: opts.body });
  } catch (e) {
    return { ok: false, error: "offline" };
  }
  // Confirme en conditions reelles (2026-08-02) : une lecture (GET), par
  // exemple un telechargement, redirige legitimement vers un hote de stockage
  // kDrive different (ex. X-X-vX-X.download.kdrive.infomaniakuser...), succes
  // reel, jamais le piege. Le piege de l'en-tete Origin ne touche QUE les
  // ecritures (POST), jamais la lecture, comme documente des le depart. Ne
  // jamais bloquer une redirection hors de cet hote sur une lecture.
  if (method !== "GET" && res.redirected && res.url.indexOf(KDRIVE_API) !== 0) return { ok: false, error: "blocked" };
  if (res.status === 401 || res.status === 403) return { ok: false, error: "invalid_token" };
  if (!res.ok) return { ok: false, error: "http_" + res.status };
  if (opts.raw) {
    try { return { ok: true, raw: await res.arrayBuffer() }; }
    catch (e) { return { ok: false, error: "bad_body" }; }
  }
  let json;
  try { json = await res.json(); } catch (e) { return { ok: false, error: "bad_json" }; }
  if (json && json.result === "error") return { ok: false, error: (json.error && json.error.code) || "api_error" };
  return { ok: true, data: json && json.data };
}

// Le endpoint des drives rend des DriveUser, pas des Drive : "drive_id" et
// "drive_name" sont au premier niveau (relation utilisateur-drive), le detail
// du drive lui-meme (status, is_locked, in_maintenance, quota, used_size) vit
// dans un sous-objet "drive". Un seul compte peut porter plusieurs drives : on
// ecarte ceux qui ne sont pas utilisables (verrouille, en maintenance, statut
// non actif, ou role "external" qui n'a acces qu'a des dossiers partages,
// jamais a la racine) et on rend la liste de ceux qui restent, pour que
// l'appelant decide, auto-selection si un seul, choix explicite sinon.
function kdriveEligible(entree) {
  if (!entree || !entree.drive_id) return false;
  if (entree.role === "external") return false;
  const d = entree.drive || {};
  if (d.is_locked) return false;
  if (d.in_maintenance) return false;
  if (d.status && d.status !== "active") return false;
  return true;
}

async function kdriveListDrives(token) {
  const r = await kdriveFetch(token, "/2/drive/users/current/drives?with=capabilities");
  if (!r.ok) return r;
  const liste = (Array.isArray(r.data) ? r.data : []).filter(kdriveEligible);
  const drives = liste.map((entree) => {
    const d = entree.drive || {};
    const quota = Number(d.quota) || 0;
    const used = Number(d.used_size ?? d.size) || 0;
    return {
      driveId: entree.drive_id,
      name: entree.drive_name || d.name || ("kDrive " + entree.drive_id),
      freeBytes: quota > used ? quota - used : 0,
      quotaBytes: quota
    };
  });
  if (!drives.length) return { ok: false, error: "no_drive" };
  return { ok: true, drives: drives };
}

async function kdriveResolveDrive(token) {
  const r = await kdriveListDrives(token);
  if (!r.ok) return r;
  return { ok: true, driveId: r.drives[0].driveId };
}

// Toujours demander le maximum autorise : la pagination par defaut de l'API
// est de 10 resultats, sans le signaler par une erreur ni un indicateur, le
// dossier cherche serait simplement absent de la premiere page.
async function kdriveListFiles(token, driveId, folderId) {
  return kdriveFetch(token, "/3/drive/" + driveId + "/files/" + folderId + "/files?limit=1000");
}

async function kdriveCreateFolder(token, driveId, parentId, name) {
  return kdriveFetch(token, "/3/drive/" + driveId + "/files/" + parentId + "/directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name })
  });
}

// La racine (file_id 1) n'est pas toujours inscriptible sur un drive
// kSuite/equipe. Seul l'espace prive de l'utilisateur, marque
// visibility: "is_private_space" parmi les enfants de la racine, l'est
// toujours. Sur un drive personnel sans cette entree, la racine convient.
async function kdriveResolveRoot(token, driveId) {
  const r = await kdriveListFiles(token, driveId, 1);
  if (!r.ok) return r;
  const enfants = Array.isArray(r.data) ? r.data : [];
  const prive = enfants.find((f) => f.visibility === "is_private_space");
  return { ok: true, folderId: prive ? prive.id : 1 };
}

// Resout Apps/Koala Zen segment par segment en id numerique, en creant ce qui
// manque. Ne JAMAIS passer un chemin a l'upload en esperant une creation
// automatique, c'est exactement ce qui echoue en pratique.
async function kdriveResolveFolder(token, driveId) {
  const racine = await kdriveResolveRoot(token, driveId);
  if (!racine.ok) return racine;
  let parentId = racine.folderId;
  for (let i = 0; i < KDRIVE_FOLDER_PATH.length; i++) {
    const segment = KDRIVE_FOLDER_PATH[i];
    const liste = await kdriveListFiles(token, driveId, parentId);
    if (!liste.ok) return liste;
    const enfants = Array.isArray(liste.data) ? liste.data : [];
    let trouve = enfants.find((f) => f.type === "dir" && String(f.name).toLowerCase() === segment.toLowerCase());
    if (!trouve) {
      const cree = await kdriveCreateFolder(token, driveId, parentId, segment);
      if (cree.ok && cree.data && cree.data.id) {
        trouve = { id: cree.data.id };
      } else {
        // Un autre appel a pu creer ce dossier entre-temps, on revarifie avant
        // d'abandonner plutot que de faire echouer une sauvegarde pour ca.
        const relit = await kdriveListFiles(token, driveId, parentId);
        const enfants2 = (relit.ok && Array.isArray(relit.data)) ? relit.data : [];
        trouve = enfants2.find((f) => f.type === "dir" && String(f.name).toLowerCase() === segment.toLowerCase());
        if (!trouve) return cree;
      }
    }
    parentId = trouve.id;
  }
  return { ok: true, folderId: parentId };
}

async function kdriveFileInfo(token, driveId, fileId) {
  return kdriveFetch(token, "/2/drive/" + driveId + "/files/" + fileId);
}

async function kdriveUpload(token, driveId, folderId, fileName, jsonObj) {
  const bytes = new TextEncoder().encode(JSON.stringify(jsonObj, null, 2));
  const qs = "?file_name=" + encodeURIComponent(fileName) + "&conflict=version&total_size=" + bytes.length + "&directory_id=" + folderId;
  return kdriveFetch(token, "/3/drive/" + driveId + "/upload" + qs, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes
  });
}

async function kdriveListBackups(token, driveId, folderId) {
  const r = await kdriveListFiles(token, driveId, folderId);
  if (!r.ok) return r;
  const fichiers = (Array.isArray(r.data) ? r.data : []).filter((f) => f.type === "file");
  fichiers.sort((a, b) => (Number(b.last_modified_at || b.added_at || 0) - Number(a.last_modified_at || a.added_at || 0)));
  return {
    ok: true,
    files: fichiers.map((f) => ({ id: f.id, name: f.name, date: Number(f.last_modified_at || f.added_at || 0) * 1000 }))
  };
}

async function kdriveDownload(token, driveId, fileId) {
  const r = await kdriveFetch(token, "/2/drive/" + driveId + "/files/" + fileId + "/download", { raw: true });
  if (!r.ok) return r;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(r.raw)); }
  catch (e) { return { ok: false, error: "bad_json" }; }
  return { ok: true, data: data };
}

async function kdriveRememberError(code) {
  try { await api.storage.local.set({ kdriveLastError: code || "unknown" }); } catch (e) { /* noop */ }
}

async function kdriveSetToken(token) {
  token = String(token || "").trim();
  if (!token) return { ok: false, error: "empty_token" };
  const liste = await kdriveListDrives(token);
  if (!liste.ok) { await kdriveRememberError(liste.error); return liste; }
  const enc = await kdriveEncryptToken(token);
  if (liste.drives.length > 1) {
    // Le jeton est valide mais la destination appartient a l'utilisateur : on
    // stocke deja le jeton chiffre pour ne pas le faire recoller, driveId et
    // folderId restent a 0 tant que kdriveChooseDrive n'a pas tranche.
    await api.storage.local.set({ kdriveTokenEnc: enc, kdriveLastError: "" });
    return { ok: true, needsChoice: true, drives: liste.drives };
  }
  const drive = liste.drives[0];
  const dossier = await kdriveResolveFolder(token, drive.driveId);
  if (!dossier.ok) { await kdriveRememberError(dossier.error); return dossier; }
  await api.storage.local.set({
    kdriveTokenEnc: enc,
    kdriveDriveId: drive.driveId,
    kdriveDriveName: drive.name,
    kdriveFolderId: dossier.folderId,
    kdriveLastError: ""
  });
  return { ok: true, driveName: drive.name };
}

// Appele une fois l'utilisateur decide, quand kdriveSetToken a rendu
// needsChoice. Le jeton est deja stocke, seuls le drive et son dossier
// restent a resoudre. driveName vient du choix affiche au popup, jamais
// revalide contre l'API : purement cosmetique, jamais utilise pour l'appel.
async function kdriveChooseDrive(driveId, driveName) {
  driveId = Number(driveId) || 0;
  if (!driveId) return { ok: false, error: "no_drive" };
  const r = await api.storage.local.get(["kdriveTokenEnc"]);
  if (!r.kdriveTokenEnc) return { ok: false, error: "not_configured" };
  const token = await kdriveDecryptToken(r.kdriveTokenEnc);
  if (!token) return { ok: false, error: "not_configured" };
  const dossier = await kdriveResolveFolder(token, driveId);
  if (!dossier.ok) { await kdriveRememberError(dossier.error); return dossier; }
  await api.storage.local.set({
    kdriveDriveId: driveId,
    kdriveDriveName: String(driveName || ""),
    kdriveFolderId: dossier.folderId,
    kdriveLastError: ""
  });
  return { ok: true };
}

// Pour le lien "Changer de kDrive" une fois deja connecte : reutilise le
// jeton stocke, ne le redemande jamais a l'utilisateur.
async function kdriveListDrivesForPopup() {
  const r = await api.storage.local.get(["kdriveTokenEnc"]);
  if (!r.kdriveTokenEnc) return { ok: false, error: "not_configured" };
  const token = await kdriveDecryptToken(r.kdriveTokenEnc);
  if (!token) return { ok: false, error: "not_configured" };
  return kdriveListDrives(token);
}

async function kdriveClear() {
  await api.storage.local.set({
    kdriveTokenEnc: null,
    kdriveKeyJwk: null,
    kdriveDriveId: 0,
    kdriveDriveName: "",
    kdriveFolderId: 0,
    kdriveLastSync: 0,
    kdriveLastError: ""
  });
  return { ok: true };
}

async function kdriveState() {
  const r = await api.storage.local.get(["kdriveTokenEnc", "kdriveDriveId", "kdriveDriveName", "kdriveLastSync", "kdriveLastError"]);
  return {
    configured: !!r.kdriveTokenEnc,
    needsChoice: !!r.kdriveTokenEnc && !r.kdriveDriveId,
    driveName: r.kdriveDriveName || "",
    lastSync: Number(r.kdriveLastSync) || 0,
    lastError: r.kdriveLastError || ""
  };
}

// Resout le drive et le dossier une seule fois, puis les met en cache pour ne
// plus jamais refaire ce parcours a chaque sauvegarde, seulement au premier
// appel ou si le cache a ete perdu.
async function kdriveEnsureLocation(token, cache) {
  if (cache.kdriveDriveId && cache.kdriveFolderId) {
    return { ok: true, driveId: cache.kdriveDriveId, folderId: cache.kdriveFolderId };
  }
  const drive = await kdriveResolveDrive(token);
  if (!drive.ok) return drive;
  const dossier = await kdriveResolveFolder(token, drive.driveId);
  if (!dossier.ok) return dossier;
  await api.storage.local.set({ kdriveDriveId: drive.driveId, kdriveFolderId: dossier.folderId });
  return { ok: true, driveId: drive.driveId, folderId: dossier.folderId };
}

async function kdriveBackup(bundle) {
  const r = await api.storage.local.get(["kdriveTokenEnc", "kdriveDriveId", "kdriveFolderId"]);
  if (!r.kdriveTokenEnc) return { ok: false, error: "not_configured" };
  const token = await kdriveDecryptToken(r.kdriveTokenEnc);
  if (!token) return { ok: false, error: "not_configured" };
  const loc = await kdriveEnsureLocation(token, r);
  if (!loc.ok) { await kdriveRememberError(loc.error); return loc; }
  const fileName = "koala-zen-" + new Date().toISOString().slice(0, 10) + ".json";
  const up = await kdriveUpload(token, loc.driveId, loc.folderId, fileName, bundle);
  if (!up.ok) { await kdriveRememberError(up.error); return up; }
  // Verification apres coup plutot qu'une confiance aveugle dans un simple 2xx.
  const fileId = up.data && up.data.id;
  if (fileId) {
    const verif = await kdriveFileInfo(token, loc.driveId, fileId);
    if (!verif.ok) { await kdriveRememberError("verify_failed"); return { ok: false, error: "verify_failed" }; }
  }
  await api.storage.local.set({ kdriveLastSync: Date.now(), kdriveLastError: "" });
  return { ok: true, fileName: fileName };
}

async function kdriveRestoreList() {
  const r = await api.storage.local.get(["kdriveTokenEnc", "kdriveDriveId", "kdriveFolderId"]);
  if (!r.kdriveTokenEnc) return { ok: false, error: "not_configured" };
  const token = await kdriveDecryptToken(r.kdriveTokenEnc);
  if (!token) return { ok: false, error: "not_configured" };
  const loc = await kdriveEnsureLocation(token, r);
  if (!loc.ok) { await kdriveRememberError(loc.error); return loc; }
  const liste = await kdriveListBackups(token, loc.driveId, loc.folderId);
  if (!liste.ok) { await kdriveRememberError(liste.error); return liste; }
  return { ok: true, files: liste.files };
}

async function kdriveRestoreFile(fileId) {
  const r = await api.storage.local.get(["kdriveTokenEnc", "kdriveDriveId"]);
  if (!r.kdriveTokenEnc || !r.kdriveDriveId) return { ok: false, error: "not_configured" };
  const token = await kdriveDecryptToken(r.kdriveTokenEnc);
  if (!token) return { ok: false, error: "not_configured" };
  const dl = await kdriveDownload(token, r.kdriveDriveId, fileId);
  if (!dl.ok) { await kdriveRememberError(dl.error); return dl; }
  return { ok: true, data: dl.data };
}
