const api = globalThis.browser || globalThis.chrome;
const ALARM = "kz-move";
const IDLE_SECONDS = 60;
const TICK = "kz-tick";
const TICK_MINUTES = 1;
const TICK_MAX_GAP_MS = 130000;
const DEFAULT_TZ = "Europe/Zurich";
const IK_API = "https://api.infomaniak.com";
const MAIL_API = "https://mail.infomaniak.com/api";

// ===========================================================================
// L'en-tete Origin sur les appels a l'API Infomaniak.
// Le navigateur ajoute Origin: chrome-extension://... (ou moz-extension://)
// aux requetes du fond de l'extension, et l'API refuse alors les ecritures
// par une redirection silencieuse. Jusqu'au 2026-09-21 une regle STATIQUE
// (rules.json) retirait Origin sur TOUTES les requetes XHR vers
// api.infomaniak.com, y compris celles des pages Infomaniak ouvertes dans un
// onglet : l'outil Newsletter, qui appelle la meme API avec ses cookies,
// perdait son Origin et voyait ses requetes refusees. Signale par Thomas.
// La regle est desormais une regle de SESSION limitee aux requetes qui ne
// viennent d'aucun onglet (tabs.TAB_ID_NONE, -1), c'est a dire les notres
// depuis le service worker. Une page web garde son Origin, quoi qu'elle
// appelle. Posee a chaque reveil du worker, idempotente.
// ===========================================================================
// 2026-10-06 (revue ECC, point M3, ajuste) : la regle ne vise plus l'API du
// Manager (agenda, profil), dont les lectures passent avec l'en-tete Origin
// (verifie en reel des aout) et ou Koala Zen n'ecrit jamais. Elle reste sur
// l'API mail, toutes methodes, comme elle a fonctionne en usage reel : y
// limiter aux ecritures n'a pas pu etre verifie sans jeton, et casserait peut
// etre la liste des boites et les stats. tabIds [-1] : jamais une page.
const ORIGIN_RULE_IDS = [1, 2];
const ORIGIN_RULES = [{
  id: 2,
  priority: 1,
  action: { type: "modifyHeaders", requestHeaders: [{ header: "Origin", operation: "remove" }] },
  condition: { urlFilter: "||mail.infomaniak.com/api/", resourceTypes: ["xmlhttprequest"], tabIds: [-1] }
}];
let originRulePosee = null;
function installOriginRule() {
  if (originRulePosee) return originRulePosee;
  const dnr = api.declarativeNetRequest;
  if (!dnr || typeof dnr.updateSessionRules !== "function") { originRulePosee = Promise.resolve(false); return originRulePosee; }
  originRulePosee = Promise.resolve()
    .then(() => dnr.updateSessionRules({ removeRuleIds: ORIGIN_RULE_IDS, addRules: ORIGIN_RULES }))
    .then(() => true)
    .catch(() => { originRulePosee = null; return false; });
  return originRulePosee;
}
installOriginRule();

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
  firstRun: true,
  importMode: "merge",
  pausedUntil: 0,
  statsDaily: {},
  screenTimezone: DEFAULT_TZ,
  screenDaily: {},
  // Minutes de reunion par jour, par rendez-vous : { jour: { cle: minutes } }.
  // Alimente par l'agenda Infomaniak, exporte avec les statistiques.
  meetingDaily: {},
  screenLastTick: 0,
  // Ordonnancement des animaux de passage. Jamais exporte, jamais compte en statistique.
  passageState: { day: "", count: 0, last: 0, lastVariant: "", lastPhrase: -1, lastCoat: -1, lastFox: 0, lastMeet: 0, lastReminder: 0, eveningDay: "", eveningHour: -1, eveningPhrase: -1 },
  // Agenda Infomaniak, silence pendant les rendez-vous a deux ou plus et rappel
  // trois minutes avant. Les deux interrupteurs sont des reglages exportables,
  // le reste (agenda choisi, cache, jeton chiffre) ne quitte jamais l'appareil.
  agendaEnabled: false,
  agendaWarn: true,
  agendaEndWarn: true,
  theme: "auto",
  // Prevenir les participants par mail, 2026-09-22. Eteint par defaut : une
  // extension qui ecrit a tes collegues doit etre allumee expres. La boite
  // d'envoi est liee a l'appareil, comme l'agenda choisi, jamais exportee.
  notifyEnabled: false,
  notifyMailboxUuid: "",
  notifyMailboxEmail: "",
  notifyMailboxName: "",
  notifyMailboxHosting: 0,
  notifyMailboxLogin: "",
  // Jeton du mail, workspace:mail seul, chiffre comme celui de l'agenda.
  notifyTokenEnc: null,
  notifySent: {},
  // Compter ses mails dans les stats, 2026-09-26. Eteint par defaut. Seuls des
  // NOMBRES sont lus et gardes, jamais un expediteur, un objet ni un contenu.
  mailStatsEnabled: false,
  mailDaily: {},
  agendaCalendarId: 0,
  agendaCalendarName: "",
  // 2026-09-22 : plusieurs agendas surveilles (pro et perso). agendaCalendarId
  // garde le premier et agendaCalendarName les noms reunis, pour tout ce qui
  // ne demande que "configure ou pas" et un libelle.
  agendaCalendars: [],
  // Jeton de l'agenda, workspace:calendar seul, chiffre. Jamais exporte en
  // clair, jamais dans SETTINGS_KEYS de popup.js.
  agendaTokenEnc: null,
  // Vrai apres la migration du 2026-09-29 si des jetons ont ete oublies : la
  // carte Agenda explique pourquoi et demande les nouveaux.
  tokensReset: false
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
  const r = await kvGet(["screenDaily", "screenLastTick", "screenTimezone"]);
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
  await kvSet({ screenDaily: daily, screenLastTick: now });
}

async function screenTodaySeconds() {
  const r = await kvGet(["screenDaily", "screenTimezone"]);
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

// Les trois issues d'un rappel. Un report ou un rappel manque compte dans
// rep et repH (les statistiques et leurs phrases), et c'est TOUT : decision du
// 2026-09-16, plus de compteur a rattraper, plus de retour anticipe, plus de
// relance. Un report est un report.
// 2026-09-25 : plus d'energie notee, l'issue seule compte.
async function recordOutcome(result) {
  const r = await kvGet(["statsDaily"]);
  const stats = (r.statsDaily && typeof r.statsDaily === "object") ? r.statsDaily : {};
  const k = dayKey();
  const day = stats[k] || { due: 0, done: 0, rep: 0, repH: [0, 0, 0, 0] };
  if (day.rep == null) day.rep = 0;
  if (!Array.isArray(day.repH) || day.repH.length !== 4) day.repH = [0, 0, 0, 0];
  if (result === "done") { day.due += 1; day.done += 1; }
  else if (result === "later" || result === "missed") { day.due += 1; day.rep += 1; day.repH[hourSlot()] += 1; }
  stats[k] = day;
  await kvSet({ statsDaily: stats });
}

function clampInterval(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(240, Math.max(1, n)); }

async function schedule(delayMin) {
  const stored = await kvGet(["intervalMinutes"]);
  const cfg = { ...DEFAULTS, ...stored };
  await api.alarms.clear(ALARM);
  const interval = clampInterval(cfg.intervalMinutes);
  const delay = (delayMin != null && delayMin > 0) ? delayMin : interval;
  api.alarms.create(ALARM, { delayInMinutes: delay, periodInMinutes: interval });
}

api.runtime.onInstalled.addListener(async (details) => {
  const stored = await kvGet(Object.keys(DEFAULTS));
  const base = { ...DEFAULTS, ...stored, screenLastTick: Date.now() };
  // Le premier ecran ne doit apparaitre qu'a une INSTALLATION reelle, jamais a
  // une mise a jour, sinon un utilisateur de longue date le reverrait au
  // prochain numero de version.
  if (details && details.reason !== "install") base.firstRun = false;
  await kvSet(base);
  // Le badge du rattrapage n'existe plus (2026-09-16). Une installation qui
  // en gardait un l'efface, sinon un chiffre resterait pour toujours.
  try { if (api.action && api.action.setBadgeText) api.action.setBadgeText({ text: "" }); } catch (e) { /* noop */ }
  schedule();
  ensureTick();
  schedulePassage();
  installOriginRule();
  await securityReady();
  agendaRefresh({ force: true }).catch(() => {});
});

if (api.runtime.onStartup) {
  api.runtime.onStartup.addListener(async () => {
    await kvSet({ screenLastTick: Date.now() });
    installOriginRule();
    schedule();
    ensureTick();
    schedulePassage();
    agendaRefresh({ force: true }).catch(() => {});
  });
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) trigger({ respectMute: true });
  else if (alarm.name === TICK) { accrueScreen(); agendaTick().catch(() => {}); eveningTick().catch(() => {}); mailStatsRefresh().catch(() => {}); }
  else if (alarm.name === ALARM_AGENDA_WARN) agendaWarnFire().catch(() => {});
  else if (alarm.name === ALARM_AGENDA_END) agendaEndFire().catch(() => {});
  else if (alarm.name === ALARM_PASSAGE) {
    // Le creneau est replanifie quoi qu'il arrive, meme si le passage est refuse.
    triggerPassage().then(schedulePassage, schedulePassage);
  }
});

// Les messages qu'une page (content.js) a le droit d'envoyer, 2026-09-29.
// Tout le reste (jetons, connexions, reglages, sauvegardes) ne s'accepte que
// d'une page de l'extension (popup). Defense en profondeur : une page web ne
// peut deja pas parler a l'extension, mais un script de page detourne ne
// doit jamais pouvoir lire ou changer un jeton.
const PAGE_MESSAGES = ["kz-outcome", "kz-notify-prepare", "kz-notify-send", "kz-open-url"];
function depuisExtension(sender) {
  // 2026-10-06 (revue ECC, L5) : refus par defaut. Seule une page de
  // l'extension (adresse sous la racine de l'extension) est de confiance ;
  // un expediteur sans adresse ne l'est plus.
  if (!sender || !sender.url) return false;
  if (sender.id && api.runtime.id && sender.id !== api.runtime.id) return false;
  let racine = "";
  try { racine = api.runtime.getURL(""); } catch (e) { racine = ""; }
  return !!racine && String(sender.url).indexOf(racine) === 0;
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return;
  if (sender && sender.id && api.runtime.id && sender.id !== api.runtime.id) return;
  if (!depuisExtension(sender) && PAGE_MESSAGES.indexOf(msg.type) < 0) return;
  // Bouton de test des animaux de passage. Il ignore la plage horaire et l'ecart
  // de deux heures, mais PAS les interdits qui protegent l'utilisateur, visio,
  // pause et mode Jamais. Il ne consomme pas le quota du jour.
  if (msg.type === "kz-passage-now") {
    triggerPassage({ test: true }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-trigger-now") {
    trigger({ force: true }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-save") {
    // schedulePassage() est rappelee a chaque sauvegarde, comme schedule(), pour
    // qu'un changement de frequence prenne effet immediatement plutot que
    // d'attendre le prochain reveil deja planifie avec l'ancien reglage.
    // L'etat des interrupteurs de l'agenda est lu AVANT l'ecriture : le popup
    // envoie toujours agendaEnabled et agendaWarn dans une sauvegarde
    // complete, et sans cette comparaison chaque Enregistrer relancait un
    // appel reseau a l'agenda et retardait la confirmation d'autant.
    const charge = msg.payload || {};
    kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn"])
      .then((avant) => kvSet(charge).then(() => schedule()).then(() => schedulePassage()).then(() => agendaAfterSave(charge, avant)))
      .then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-outcome") {
    // Aucun retour anticipe apres un report : le prochain rappel arrive a
    // l'intervalle normal, deja planifie. Le report ne fait que compter.
    recordOutcome(msg.result).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-pause") {
    const until = Number(msg.until) || 0;
    kvSet({ pausedUntil: until }).then(() => {
      const delay = Math.max(0.05, (until - Date.now()) / 60000 + 0.05);
      return schedule(delay);
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-resume") {
    kvSet({ pausedUntil: 0 }).then(() => schedule()).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-reset-all") {
    // Tout remettre a zero, y compris reglages, contenus et images importees.
    // La cle du coffre part aussi : plus aucun jeton ne subsiste.
    api.storage.local.clear()
      .then(() => vaultClear())
      .then(() => kvSet({ ...DEFAULTS, screenLastTick: Date.now(), securityV: SECURITY_VERSION }))
      .then(() => secretForget())
      .then(() => schedule())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-reset") {
    // Efface l'historique (statistiques et temps d'ecran).
    // Les reglages, koalas et pensees sont conserves.
    kvSet({ statsDaily: {}, screenDaily: {}, meetingDaily: {}, mailDaily: {}, screenLastTick: 0 }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-agenda-connect") {
    agendaConnect(msg.token).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-agenda-list-calendars") {
    agendaListCalendarsForPopup().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-agenda-choose") {
    // {calendars: [{id, name}]} depuis le popup, ou l'ancienne forme a un seul agenda.
    agendaChoose(Array.isArray(msg.calendars) ? msg.calendars : msg.calendarId, msg.calendarName).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-agenda-status") {
    agendaState().then((r) => sendResponse(r)).catch(() => sendResponse({ enabled: false, configured: false, lastError: "unknown" }));
    return true;
  }
  if (msg.type === "kz-agenda-refresh") {
    agendaRefresh({ force: true }).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-agenda-disconnect") {
    agendaDisconnect().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-mailboxes") {
    notifyListMailboxes().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-mailstats-refresh") {
    mailStatsRefresh({ force: true }).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-connect") {
    notifyConnect(msg.token).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-disconnect") {
    notifyDisconnect().then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-choose") {
    notifyChoose(msg.mailbox).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-prepare") {
    notifyCible(msg, sender).then((c) => (c.ok ? notifyPrepare(c.id, c.start) : c))
      .then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-notify-send") {
    notifyCible(msg, sender).then((c) => (c.ok ? notifySend(Object.assign({}, msg, { id: c.id, start: c.start }), c) : c))
      .then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-connexions-export") {
    connexionsExport(msg.passphrase).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-connexions-import") {
    connexionsImport(msg.blob, msg.passphrase).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-open-url") {
    // Le bouton "Rejoindre" de la bulle de rendez-vous. Seules les adresses
    // http(s) venant du cache de l'agenda sont ouvertes, jamais une chaine
    // arbitraire de la page.
    agendaOpenUrl(msg.url).then((ok) => sendResponse({ ok: ok })).catch(() => sendResponse({ ok: false }));
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
  const cfg = { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns", "pauseWhenIdle", "pausedUntil", "focusMode", "focusSeconds", "intervalMinutes", "habitGoal", "statsDaily", "agendaEnabled", "agendaCache"])) };
  if (!force) {
    if (cfg.pausedUntil && Date.now() < cfg.pausedUntil) return;
    // Un rendez-vous a deux ou plus en cours dans l'agenda vaut une visio :
    // silence, sans toucher a pausedUntil (qui appartient a la pause manuelle
    // et a l'heure de calme du Jamais). Depuis le 2026-09-22 le rappel n'est
    // plus saute mais DECALE au premier creux d'au moins dix minutes, une
    // minute apres son debut, meme quand il tombe juste avant une reunion ou
    // entre deux reunions collees. Aucun creux dans les six heures : on saute,
    // l'alarme periodique reviendra d'elle-meme.
    if (cfg.agendaEnabled) {
      const maintenant = Date.now();
      const libre = agendaNextFreeSlot(cfg.agendaCache, maintenant);
      if (libre === null) return;
      if (libre > maintenant) {
        await schedule(Math.max(1, Math.ceil((libre + AGENDA_GAP_PAD_MS - maintenant) / 60000)));
        return;
      }
    }
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
    intervalMinutes: clampInterval(cfg.intervalMinutes),
    doneToday: today.done || 0,
    habitGoal: Math.max(0, Math.min(20, Math.round(Number(cfg.habitGoal) || 0))),
    streak: streakFrom(stats)
  };
  try {
    const brut = (await kvGet(["passageState"])).passageState;
    const majPassage = passageStateFrom(brut);
    majPassage.lastReminder = Date.now();
    await kvSet({ passageState: majPassage });
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
// Les passages de fin de journee, 2026-09-18. A chaque heure pleine de 17 h a
// 21 h, un chat passe pour glisser, avec humour, qu'il est temps de songer a
// arreter, de plus en plus franchement. Ils ne comptent ni dans le quota du
// jour ni dans l'ecart entre deux passages libres, et ils ignorent la plage
// 8 h 20 h. Ils respectent tout le reste : reglage eteint, animations sur
// Jamais, pause, rendez-vous, silence apres un rappel, visio, clavier quitte.
// Un passage manque a l'heure pile (aucun onglet, page interne, clavier
// quitte) est retente a chaque tic pendant vingt minutes, puis abandonne.
const PASSAGE_EVENING_HOURS = [17, 18, 19, 20, 21];
const PASSAGE_EVENING_WINDOW_MIN = 20;
const PASSAGE_EVENING_PHRASES = 4;        // quatre phrases par heure dans quotes.js
const PASSAGE_EVENING_VARIANT = { 17: "cross", 18: "yawn", 19: "sit", 20: "yawn", 21: "sit" };
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
    lastMeet: Math.max(0, Number(s.lastMeet) || 0),
    eveningDay: typeof s.eveningDay === "string" ? s.eveningDay : "",
    eveningHour: Number.isFinite(Number(s.eveningHour)) ? Number(s.eveningHour) : -1,
    eveningPhrase: Number.isFinite(Number(s.eveningPhrase)) ? Number(s.eveningPhrase) : -1
  };
}

// Heure locale dans le fuseau retenu, celui du reglage Temps d'ecran.
function tzHour(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), hour: "2-digit", hour12: false });
    return parseInt(f.format(when || new Date()), 10);
  } catch (e) { return (when || new Date()).getHours(); }
}

// Samedi ou dimanche dans le fuseau retenu : le chat de passage change de lot.
function tzWeekend(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), weekday: "short" });
    const j = f.format(when || new Date());
    return j === "Sat" || j === "Sun";
  } catch (e) { const d = (when || new Date()).getDay(); return d === 0 || d === 6; }
}

function tzMinute(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), minute: "2-digit" });
    return parseInt(f.format(when || new Date()), 10);
  } catch (e) { return (when || new Date()).getMinutes(); }
}

// L'heure de fin de journee a jouer maintenant, ou -1. Une heure ne joue
// qu'une fois par jour, dans les vingt minutes qui suivent l'heure pleine.
function eveningSlot(state, nowMs, tz) {
  const st = passageStateFrom(state);
  const d = new Date(nowMs);
  const h = tzHour(tz, d);
  if (PASSAGE_EVENING_HOURS.indexOf(h) < 0) return -1;
  if (tzMinute(tz, d) >= PASSAGE_EVENING_WINDOW_MIN) return -1;
  if (st.eveningDay === tzDayKey(tz, d) && st.eveningHour >= h) return -1;
  return h;
}

// Le passage de fin de journee : variante fixee par l'heure, pelage jamais
// identique au precedent, phrase jamais identique a celle de la veille a la
// meme heure ni a celle de l'heure d'avant.
function pickEvening(state, hour, rnd) {
  const st = passageStateFrom(state);
  const alea = typeof rnd === "function" ? rnd : Math.random;
  const id = PASSAGE_EVENING_VARIANT[hour] || "cross";
  const variante = PASSAGES.find((p) => p.id === id) || PASSAGES[0];
  let coat = Math.floor(alea() * PASSAGE_COATS);
  if (coat >= PASSAGE_COATS) coat = PASSAGE_COATS - 1;
  if (coat === st.lastCoat) coat = (coat + 1) % PASSAGE_COATS;
  let phrase = Math.floor(alea() * PASSAGE_EVENING_PHRASES);
  if (phrase >= PASSAGE_EVENING_PHRASES) phrase = PASSAGE_EVENING_PHRASES - 1;
  if (phrase === st.eveningPhrase) phrase = (phrase + 1) % PASSAGE_EVENING_PHRASES;
  return { variant: variante.id, ms: variante.ms, who: "cat", coat: coat, phrase: phrase, pool: "evening", slot: PASSAGE_EVENING_HOURS.indexOf(hour), hour: hour };
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
// L'ordre compte : les motifs que le bouton de test ne peut JAMAIS contourner
// (reglage, animations, pause, agenda, silence apres un rappel) sont evalues
// avant ceux qu'il contourne (horaire, ecart, plafond). Sinon un test lance a
// 21 h pendant une pause rendait "horaire", contournable, et le passage jouait.
function passageBlocked(cfg, state, nowMs, tz) {
  const st = passageStateFrom(state);
  if (!cfg.passages) return "reglage";
  if (cfg.animMode === "never") return "animations";
  if (cfg.pausedUntil && nowMs < cfg.pausedUntil) return "pause";
  // Meme regle que la visio, un rendez-vous de l'agenda en cours interdit tout
  // passage, y compris le bouton de test.
  if (cfg.agendaEnabled && agendaBusyAt(cfg.agendaCache, nowMs)) return "agenda";
  // La fenetre de silence couvre le rappel ET la pause focus, qui peut durer
  // jusqu'a 120 s, sinon un passage traverserait pendant le voile.
  const silence = cfg.focusMode
    ? Math.max(PASSAGE_QUIET_AFTER_REMINDER, (Number(cfg.focusSeconds) || 30) * 1000 + PASSAGE_QUIET_AFTER_REMINDER)
    : PASSAGE_QUIET_AFTER_REMINDER;
  if (st.lastReminder && nowMs - st.lastReminder < silence) return "rappel";
  const h = tzHour(tz, new Date(nowMs));
  if (h < PASSAGE_HOUR_FROM || h >= PASSAGE_HOUR_TO) return "horaire";
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
  const cfg = { ...DEFAULTS, ...(await kvGet(["passageFrequency"])) };
  const mins = nextPassageDelayMinutes(passageFreq(cfg).gapHours);
  try { await api.alarms.create(ALARM_PASSAGE, { delayInMinutes: mins }); } catch (e) { /* noop */ }
}

// Appele a chaque tic. Ne fait rien hors des fenetres de fin de journee.
async function eveningTick() {
  const r = await kvGet(["passageState", "screenTimezone"]);
  const slot = eveningSlot(r.passageState, Date.now(), r.screenTimezone);
  if (slot < 0) return;
  await triggerPassage({ evening: slot });
}

async function triggerPassage(opts) {
  const test = !!(opts && opts.test);
  const evening = (opts && PASSAGE_EVENING_HOURS.indexOf(opts.evening) > -1) ? opts.evening : 0;
  const cfg = { ...DEFAULTS, ...(await kvGet(["passages", "passageFrequency", "animMode", "pausedUntil", "pauseWhenIdle", "muteInCalls", "mutedPatterns", "screenTimezone", "focusMode", "focusSeconds", "passageState", "agendaEnabled", "agendaCache"])) };
  const now = Date.now();
  const st = passageStateFrom(cfg.passageState);
  const motif = passageBlocked(cfg, st, now, cfg.screenTimezone);
  // Le bouton de test contourne l'horaire, l'ecart de deux heures et le plafond
  // du jour. Il ne contourne JAMAIS ce qui protege l'utilisateur, le reglage
  // eteint, le mode Jamais, une pause en cours, le silence apres un rappel, ni
  // la visio et l'inactivite verifiees plus bas.
  // Le passage de fin de journee contourne les memes trois motifs, et rien
  // d'autre : il a son heure, son quota propre, et il n'a pas a attendre la
  // fin de l'ecart d'un passage libre.
  const contournable = (motif === "horaire" || motif === "ecart" || motif === "plafond");
  if (motif && !((test || evening) && contournable)) return;
  if (cfg.pauseWhenIdle && !test && (await isIdle())) return;

  const tab = await targetTab();
  if (!tab) return;
  // La visio est prioritaire sur tout le reste, meme si rien n'est mis en pause.
  if (cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns)) return;

  const choix = evening ? pickEvening(st, evening) : pickPassage(st, now);
  if (!choix) return;
  const jour = tzDayKey(cfg.screenTimezone, new Date(now));
  // Un passage de TEST ne consomme ni le quota du jour ni le creneau des deux
  // heures, sinon essayer le bouton priverait l'utilisateur d'un vrai passage.
  // Un passage de fin de journee ne compte pas dans le quota du jour mais
  // pose bien `last`, pour qu'un passage libre ne le suive pas de pres. Il
  // note son heure, une seule fois par jour et par heure.
  const suivant = {
    day: jour,
    count: (st.day === jour ? st.count : 0) + ((test || evening) ? 0 : 1),
    last: test ? st.last : now,
    lastVariant: choix.variant,
    lastPhrase: evening ? st.lastPhrase : choix.phrase,
    lastCoat: choix.coat,
    lastReminder: st.lastReminder,
    lastFox: (choix.variant === "meetFox" && !test) ? now : st.lastFox,
    lastMeet: (choix.variant === "meetCats" && !test) ? now : st.lastMeet,
    eveningDay: evening ? jour : st.eveningDay,
    eveningHour: evening ? evening : (st.eveningDay === jour ? st.eveningHour : -1),
    eveningPhrase: evening ? choix.phrase : st.eveningPhrase
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
    if (evening) { envoi.pool = "evening"; envoi.slot = choix.slot; envoi.hour = evening; }
    // Le week-end (2026-09-26), les passages libres puisent dans le lot du
    // week-end : meme nombre de phrases, meme tirage, autre lot cote page.
    else if (tzWeekend(cfg.screenTimezone, new Date(now))) envoi.pool = "weekend";
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
    await kvSet({ passageState: suivant });
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
// Les jetons Infomaniak, revus le 2026-09-29 (audit de securite demande par
// Thomas). Deux jetons, chacun limite a UN usage : workspace:calendar pour
// l'agenda, workspace:mail pour Prevenir et les stats des mails. kDrive est
// retire : plus aucune sauvegarde en ligne, l'export manuel seulement.
//
// Chiffrement AES-GCM 256. La cle est une CryptoKey NON EXPORTABLE rangee
// dans IndexedDB : aucun code, meme celui de l'extension, ne peut en lire les
// octets, elle n'est plus a cote des jetons dans storage.local et ne part
// dans aucun export. Limite assumee et documentee : un programme qui lit les
// fichiers du profil du navigateur sur le disque peut encore la retrouver.
// Aucun coffre du systeme n'est accessible a une extension sans application
// native installee a cote.
// ===========================================================================
const SECRET_DB = "kz-secrets";
const SECRET_STORE = "keys";
const SECRET_KEY_ID = "tokens";
// 2026-10-06 (revue ECC) : un second magasin, le coffre des donnees
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
// Le coffre, 2026-10-06 (revue de securite ECC, point M1). storage.local est
// lisible ET modifiable par les scripts de page (content.js) : un moteur de
// page compromis y lisait les titres de reunion et l'adresse mail, et
// pouvait y glisser un lien que Rejoindre ouvrirait, ou remettre a zero les
// envois deja faits. Ces cles vivent desormais dans IndexedDB, a l'origine
// de l'extension, hors de portee des pages. kvGet et kvSet aiguillent chaque
// cle : coffre ou storage.local. Les stats (nombres seulement) restent dans
// storage.local, le popup les lit directement.
// ===========================================================================
const VAULT_KEYS = ["agendaCache", "agendaState", "agendaMyEmail", "agendaMyUserId", "agendaCalendars", "agendaCalendarName", "agendaCalendarId", "agendaWarned", "agendaEndWarned", "agendaTokenEnc", "notifyTokenEnc", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxHosting", "notifyMailboxLogin", "notifySent", "notifyNonces", "notifyRate"];
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
  // 2026-10-06 (revue ECC, L10) : ni "." ni "%2e" seul, que fetch normaliserait.
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
    // 2026-10-06 (revue ECC, L8) : aucune redirection suivie. Les appels
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
  return { ok: true, data: json && json.data };
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
// 2026-10-06 (revue ECC, L4) : refus en cas de doute. Seul un refus franc
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
// Le verdict d'une sonde, pour la connexion et l'import.
function verdictSonde(extras) {
  if (extras.length) return { ok: false, error: "too_broad", extras: extras.slice() };
  if (extras.doute) return { ok: false, error: "probe_failed" };
  return { ok: true };
}

// ===========================================================================
// Agenda Infomaniak. Silence des rappels et des animaux pendant un rendez-vous
// a deux personnes ou plus (moi compris), et rappel visible trois minutes
// avant. Repose sur un jeton personnel limite a workspace:calendar, jamais
// un flux OAuth.
//
// Verifie en conditions reelles le 2026-09-16 sur l'API :
//  - GET /1/calendar/pim/event?calendar_id&from&to&with=attendees rend les
//    occurrences DEJA developpees des series recurrentes, chacune avec ses
//    participants. Sans "with=attendees" la liste rend attendees vide.
//  - from et to n'acceptent QUE le format naif "Y-m-d H:i:s" (422 sinon) et
//    sont interpretes dans le fuseau de l'agenda, pas en UTC. La liste rend
//    tout evenement qui CHEVAUCHE la fenetre. D'ou une fenetre large, moins
//    12 h a plus 36 h, puis un filtrage exact en local sur les vrais instants.
//  - start et end horaires arrivent en ISO avec decalage
//    ("2026-10-02T11:00:00+02:00"), directement parsables. Une journee entiere
//    arrive en date nue ("2026-10-12") avec fullday a vrai.
//  - "Moi" se reconnait sans le perimetre user_info : le user_id de l'attendee
//    est celui de l'agenda par defaut dont je suis owner. /2/profile, s'il est
//    autorise, ajoute l'adresse email comme second critere.
// ===========================================================================

const ALARM_AGENDA_WARN = "kz-agenda-warn";
// 2026-09-21 : seconde alarme, cinq minutes avant la FIN d'un rendez-vous,
// pour tenir la duree prevue. Meme mecanique que le rappel du debut, sa
// propre liste des fins deja annoncees, sa propre couleur cote page.
const ALARM_AGENDA_END = "kz-agenda-end";
const AGENDA_REFRESH_MS = 5 * 60 * 1000;
const AGENDA_WINDOW_BEFORE_MS = 12 * 60 * 60 * 1000;
const AGENDA_WINDOW_AFTER_MS = 36 * 60 * 60 * 1000;
const AGENDA_WARN_BEFORE_MS = 3 * 60 * 1000;
const AGENDA_END_BEFORE_MS = 5 * 60 * 1000;
// 2026-09-23 : les rappels de debut et de fin ne se posent que sur une machine
// eveillee. Ecran verrouille, ou aucune activite depuis dix minutes (ecran
// endormi, poste quitte) : rien ne s'affiche, et on reessaie une minute plus
// tard tant que le rendez-vous n'a pas commence (ou fini). Sinon la bulle
// attendait au retour, deja perimee, "commence il y a 40 min".
const AGENDA_ASLEEP_SECONDS = 10 * 60;
const AGENDA_RETRY_ASLEEP_MS = 60 * 1000;
// Les creux : un rappel d'habitude qui tombe en reunion ou trop pres d'une
// reunion est decale au premier creux d'au moins dix minutes, une minute
// apres son debut, dans la limite de six heures.
const AGENDA_GAP_MIN_MS = 10 * 60 * 1000;
const AGENDA_GAP_PAD_MS = 60 * 1000;
const AGENDA_SHIFT_MAX_MS = 6 * 60 * 60 * 1000;
// Le temps en reunion dans les statistiques : 90 jours relus une fois a la
// connexion, puis le cache quotidien nourrit jour apres jour. 400 jours gardes.
const AGENDA_BACKFILL_DAYS = 90;
const MEETING_DAILY_KEEP_DAYS = 400;
const AGENDA_WARNED_MAX = 60;
const AGENDA_PERMISSION_RANK = { owner: 0, readwrite: 1, read: 2 };

function bgMsg(key, fallback) {
  try { const m = (api.i18n && api.i18n.getMessage) ? api.i18n.getMessage(key) : ""; return m || fallback; } catch (e) { return fallback; }
}

// Le jeton de l'agenda, et lui seul : plus de jeton partage.
async function agendaToken() {
  await securityReady();
  const r = await kvGet(["agendaTokenEnc"]);
  if (!r.agendaTokenEnc) return null;
  return secretDecrypt(r.agendaTokenEnc);
}

// Format naif exige par l'API, dans l'heure locale de la machine. Le fuseau
// de l'agenda peut differer de quelques heures, la fenetre large l'absorbe.
function agendaFmt(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

function agendaParseTs(s) {
  if (!s) return 0;
  const t = Date.parse(String(s));
  return isNaN(t) ? 0 : t;
}

// Les agendas que l'utilisateur peut choisir : tout ce qui est lisible. Les
// salles de reunion (permission "none", user_id -1) ne le sont pas. Les
// siens d'abord, celui par defaut en tete, puis les partages en ecriture,
// puis en lecture, ceux qu'il affiche dans son agenda avant les autres.
function agendaCalendarsFrom(data) {
  const brut = (data && Array.isArray(data.calendars)) ? data.calendars : (Array.isArray(data) ? data : []);
  const liste = brut
    .filter((c) => c && c.id && c.permission && c.permission !== "none")
    .map((c) => ({
      id: Number(c.id),
      name: String(c.name || ("Agenda " + c.id)),
      isDefault: !!c.default,
      permission: String(c.permission),
      displayed: !!c.displayed,
      userId: Number(c.user_id) || 0
    }));
  liste.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    const ra = AGENDA_PERMISSION_RANK[a.permission] ?? 9, rb = AGENDA_PERMISSION_RANK[b.permission] ?? 9;
    if (ra !== rb) return ra - rb;
    if (a.displayed !== b.displayed) return a.displayed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return liste;
}

// Mon identite : le user_id de l'agenda par defaut, sinon du premier dont je
// suis owner. Independant de l'agenda surveille, qui peut etre partage.
function agendaMyUserIdFrom(calendars) {
  const moi = calendars.find((c) => c.isDefault && c.permission === "owner")
    || calendars.find((c) => c.permission === "owner")
    || calendars.find((c) => c.isDefault);
  return moi ? moi.userId : 0;
}

async function agendaListCalendars(token) {
  const r = await ikFetch(token, "/1/calendar/pim/calendar");
  if (!r.ok) return r;
  const calendars = agendaCalendarsFrom(r.data);
  if (!calendars.length) return { ok: false, error: "no_calendar" };
  return { ok: true, calendars: calendars, myUserId: agendaMyUserIdFrom(calendars) };
}

// Optionnel : le perimetre user_info n'est pas exige. Sans lui, 403
// all_scopes, on continue sans adresse.
async function agendaProfileEmail(token) {
  const r = await ikFetch(token, "/2/profile");
  if (!r.ok || !r.data) return "";
  return String(r.data.email || "").trim().toLowerCase();
}

async function agendaFetchEvents(token, calendarId, nowMs) {
  return agendaFetchEventsRange(token, calendarId, nowMs - AGENDA_WINDOW_BEFORE_MS, nowMs + AGENDA_WINDOW_AFTER_MS);
}
async function agendaFetchEventsRange(token, calendarId, fromMs, toMs) {
  const from = agendaFmt(new Date(fromMs));
  const to = agendaFmt(new Date(toMs));
  const qs = "?calendar_id=" + encodeURIComponent(calendarId)
    + "&from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to) + "&with=attendees";
  const r = await ikFetch(token, "/1/calendar/pim/event" + qs);
  if (!r.ok) return r;
  return { ok: true, events: Array.isArray(r.data) ? r.data : [] };
}

function agendaIsMe(attendee, me, event) {
  if (!attendee) return false;
  if (me && me.userId && Number(attendee.user_id) === Number(me.userId)) return true;
  const adr = String(attendee.address || "").trim().toLowerCase();
  if (!adr) return false;
  if (me && me.email && adr === me.email) return true;
  const origine = String((event && event.origin_attendee_email) || "").trim().toLowerCase();
  return !!origine && adr === origine;
}

// La regle du rendez-vous qui fait silence : pas une journee entiere, pas
// marque libre, au moins deux participants, moi parmi eux, et pas decline.
function agendaIsMeeting(e, me) {
  if (!e || e.fullday) return false;
  if (String(e.freebusy || "busy").toLowerCase() === "free") return false;
  const att = Array.isArray(e.attendees) ? e.attendees : [];
  if (att.length < 2) return false;
  const moi = att.find((a) => agendaIsMe(a, me, e));
  if (!moi) return false;
  if (String(moi.state || "").toUpperCase() === "DECLINED") return false;
  return true;
}

// 2026-09-21 : le rappel de fin vaut pour TOUS les evenements a horaire de
// l'agenda, y compris ceux ou je suis seul (bloc de travail, rendez-vous
// perso). Seules restent ecartees les journees entieres et les invitations
// que j'ai declinees. Le silence et le rappel de debut gardent la regle du
// rendez-vous a deux ou plus, via le marqueur `meeting` du cache.
function agendaIsTimed(e, me) {
  if (!e || e.fullday) return false;
  const att = Array.isArray(e.attendees) ? e.attendees : [];
  const moi = att.find((a) => agendaIsMe(a, me || {}, e));
  if (moi && String(moi.state || "").toUpperCase() === "DECLINED") return false;
  return true;
}

function agendaKey(m) { return String(m.id) + "@" + String(m.start); }

function agendaNormalize(e, me) {
  let url = String(e.meet_room_url || "");
  if (!url && Array.isArray(e.external_meet_room_urls) && e.external_meet_room_urls.length) url = String(e.external_meet_room_urls[0] || "");
  if (!/^https?:\/\//i.test(url)) url = "";
  return {
    id: e.id,
    title: String(e.title || "").trim(),
    start: agendaParseTs(e.start),
    end: agendaParseTs(e.end),
    url: url,
    people: Array.isArray(e.attendees) ? e.attendees.length : 0,
    meeting: agendaIsMeeting(e, me || {})
  };
}

// Le cache garde tous les evenements a horaire, chacun avec son marqueur
// `meeting`. Un cache d'avant le 2026-09-21 n'a pas ce marqueur : ses
// entrees etaient toutes des reunions, elles sont lues comme telles.
function agendaEventsFrom(events, me) {
  const vus = {};
  return (Array.isArray(events) ? events : [])
    .filter((e) => agendaIsTimed(e, me))
    .map((e) => agendaNormalize(e, me))
    .filter((m) => m.start && m.end && m.end > m.start)
    // Le meme evenement present dans deux agendas surveilles ne compte qu'une fois.
    .filter((m) => { const k = agendaKey(m); if (vus[k]) return false; vus[k] = true; return true; })
    .sort((a, b) => a.start - b.start);
}
function agendaMeetingsFrom(events, me) {
  return agendaEventsFrom(events, me).filter((m) => m.meeting !== false);
}
function agendaMeetings(cache) {
  const evs = (cache && Array.isArray(cache.events)) ? cache.events : [];
  return evs.filter((m) => m.meeting !== false);
}

function agendaBusyAt(cache, nowMs) {
  return agendaMeetings(cache).find((m) => m.start <= nowMs && nowMs < m.end) || null;
}

function agendaNextAfter(cache, nowMs) {
  return agendaMeetings(cache).find((m) => m.start > nowMs) || null;
}

// Le premier instant, a partir de nowMs, ou s'ouvre une plage libre d'au
// moins dix minutes : nowMs lui-meme si c'est deja le cas, la fin d'une
// reunion en cours sinon, en sautant les reunions collees. null si rien ne
// s'ouvre dans les six heures. Reunions seulement, comme le silence.
function agendaNextFreeSlot(cache, nowMs) {
  const evs = agendaMeetings(cache);
  let t = nowMs;
  for (let i = 0; i < 200; i++) {
    if (t - nowMs > AGENDA_SHIFT_MAX_MS) return null;
    const enCours = evs.filter((m) => m.start <= t && t < m.end);
    if (enCours.length) { t = Math.max.apply(null, enCours.map((m) => m.end)); continue; }
    let suivant = null;
    evs.forEach((m) => { if (m.start >= t && (!suivant || m.start < suivant.start)) suivant = m; });
    if (!suivant || suivant.start - t >= AGENDA_GAP_MIN_MS) return t;
    t = suivant.start;
  }
  return null;
}

// Le temps en reunion par jour, pour les statistiques. Chaque reunion du
// cache ecrit ses minutes ecoulees (jusqu'a maintenant, ou jusqu'a sa fin)
// sous la cle du jour de son debut, dans le fuseau du reglage Temps d'ecran.
// Reunions a deux ou plus seulement, meme regle que le silence. Idempotent :
// une reunion reecrit sa propre valeur, jamais additionnee deux fois.
// 2026-09-26 : chaque reunion est gardee comme un intervalle [debut, fin
// ecoulee], plus comme des minutes. Additionner les minutes comptait deux
// fois deux reunions qui se chevauchent, et deux fois la meme reunion vue
// dans deux agendas surveilles (deux identifiants). Le popup fait l'union
// des intervalles du jour et compte les reunions distinctes par creneau.
function agendaAccrueInto(daily, cache, nowMs, tz) {
  agendaMeetings(cache).forEach((m) => {
    const fin = Math.min(m.end, nowMs);
    if (fin - m.start < 60000) return;
    const jour = tzDayKey(tz, new Date(m.start));
    if (!daily[jour] || typeof daily[jour] !== "object") daily[jour] = {};
    daily[jour][agendaKey(m)] = [m.start, fin];
  });
  const jours = Object.keys(daily).sort();
  while (jours.length > MEETING_DAILY_KEEP_DAYS) delete daily[jours.shift()];
  return daily;
}
async function agendaAccrueMeetings(cache, nowMs) {
  const r = await kvGet(["meetingDaily", "screenTimezone"]);
  const daily = (r.meetingDaily && typeof r.meetingDaily === "object") ? r.meetingDaily : {};
  const avant = JSON.stringify(daily);
  agendaAccrueInto(daily, cache, nowMs, r.screenTimezone);
  if (JSON.stringify(daily) !== avant) await kvSet({ meetingDaily: daily });
  return daily;
}

// A la connexion d'un agenda, un seul appel relit les 90 derniers jours pour
// que l'onglet Stats compare tout de suite avec les periodes passees.
async function agendaBackfill(nowMs) {
  const r = await kvGet(["agendaCalendarId", "agendaCalendars", "agendaMyUserId", "agendaMyEmail"]);
  if (!r.agendaCalendarId) return { ok: false, error: "not_configured" };
  const token = await agendaToken();
  if (!token) return { ok: false, error: "not_configured" };
  const ev = await agendaFetchAll(token, agendaIds(r), nowMs - AGENDA_BACKFILL_DAYS * 24 * 60 * 60 * 1000, nowMs);
  if (!ev.ok) return ev;
  const me = { userId: Number(r.agendaMyUserId) || 0, email: String(r.agendaMyEmail || "").toLowerCase() };
  const passe = { at: nowMs, events: agendaEventsFrom(ev.events, me) };
  await agendaAccrueMeetings(passe, nowMs);
  return { ok: true, count: passe.events.length };
}

// L'etat lisible par le popup sans message : rendez-vous en cours (fin la
// plus tardive si plusieurs se chevauchent) et prochain a venir. Reunions
// seulement, un bloc solo ne fait pas taire le koala.
async function agendaUpdateState(cache, nowMs) {
  const evs = agendaMeetings(cache);
  const enCours = evs.filter((m) => m.start <= nowMs && nowMs < m.end);
  const suivant = agendaNextAfter(cache, nowMs);
  const etat = {
    inUntil: enCours.length ? Math.max.apply(null, enCours.map((m) => m.end)) : 0,
    inTitle: enCours.length ? enCours[0].title : "",
    inId: enCours.length ? enCours[0].id : 0,
    inStart: enCours.length ? enCours[0].start : 0,
    nextStart: suivant ? suivant.start : 0,
    nextTitle: suivant ? suivant.title : "",
    nextId: suivant ? suivant.id : 0
  };
  await kvSet({ agendaState: etat });
  return etat;
}

async function agendaRememberError(code) {
  try { await kvSet({ agendaLastError: code || "unknown" }); } catch (e) { /* noop */ }
}

// Le rafraichissement. Un seul appel, toutes les cinq minutes au plus, sauf
// force. Le cache ne garde QUE les rendez-vous qui font silence, deja
// normalises, jamais la liste brute.
async function agendaRefresh(opts) {
  opts = opts || {};
  const now = opts.now || Date.now();
  const r = await kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn", "agendaCalendarId", "agendaCalendars", "agendaMyUserId", "agendaMyEmail", "agendaCache"]);
  // La connexion sert a deux choses independantes, le silence (agendaEnabled)
  // et le rappel trois minutes avant (agendaWarn). Elle vit tant que l'une
  // des deux est allumee.
  if (!agendaActif(r)) return { ok: false, error: "not_configured" };
  if (!opts.force && r.agendaCache && now - (Number(r.agendaCache.at) || 0) < AGENDA_REFRESH_MS) return { ok: true, cached: true };
  const token = await agendaToken();
  if (!token) { await agendaRememberError("not_configured"); return { ok: false, error: "not_configured" }; }
  const ev = await agendaFetchAll(token, agendaIds(r), now - AGENDA_WINDOW_BEFORE_MS, now + AGENDA_WINDOW_AFTER_MS);
  if (!ev.ok) { await agendaRememberError(ev.error); return ev; }
  const me = { userId: Number(r.agendaMyUserId) || 0, email: String(r.agendaMyEmail || "").toLowerCase() };
  const cache = { at: now, events: agendaEventsFrom(ev.events, me) };
  await kvSet({ agendaCache: cache, agendaLastError: "" });
  await agendaUpdateState(cache, now);
  await agendaAccrueMeetings(cache, now);
  await agendaScheduleWarn(cache, now);
  await agendaScheduleEnd(cache, now);
  return { ok: true, count: cache.events.length };
}

// A chaque tick d'une minute : l'etat suit les debuts et fins de rendez-vous
// entre deux rafraichissements, et le cache est relu s'il a plus de cinq
// minutes. Une machine sortie de veille se remet donc a jour en une minute.
function agendaActif(r) {
  return !!(r && r.agendaCalendarId && (r.agendaEnabled || r.agendaWarn !== false || r.agendaEndWarn !== false));
}
// Les agendas surveilles : la liste si elle existe, sinon l'ancien agenda
// unique, pour une installation d'avant la liste.
function agendaIds(r) {
  const liste = (r && Array.isArray(r.agendaCalendars)) ? r.agendaCalendars.map((c) => Number(c && c.id) || 0).filter(Boolean) : [];
  if (liste.length) return liste;
  return (r && r.agendaCalendarId) ? [Number(r.agendaCalendarId)] : [];
}
// Tous les evenements des agendas surveilles, en un seul lot. Un agenda qui
// echoue fait echouer l'ensemble : mieux vaut garder le cache precedent
// qu'un cache a moitie vide qui ferait sonner des rappels a tort.
async function agendaFetchAll(token, ids, fromMs, toMs) {
  let tous = [];
  for (let i = 0; i < ids.length; i++) {
    const r = await agendaFetchEventsRange(token, ids[i], fromMs, toMs);
    if (!r.ok) return r;
    tous = tous.concat(r.events);
  }
  return { ok: true, events: tous };
}

async function agendaTick() {
  const r = await kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn", "agendaCalendarId", "agendaCache"]);
  if (!agendaActif(r)) return;
  const now = Date.now();
  if (r.agendaCache) { await agendaUpdateState(r.agendaCache, now); await agendaAccrueMeetings(r.agendaCache, now); }
  await agendaRefresh({ now: now });
}

// Une seule alarme ponctuelle, posee sur le prochain rendez-vous pas encore
// annonce, a la seconde pres. Chrome impose 30 s minimum, sans effet ici.
async function agendaScheduleWarn(cache, nowMs) {
  try { await api.alarms.clear(ALARM_AGENDA_WARN); } catch (e) { /* noop */ }
  const r = await kvGet(["agendaWarn", "agendaWarned"]);
  if (r.agendaWarn === false) return null;
  const deja = Array.isArray(r.agendaWarned) ? r.agendaWarned : [];
  const prochain = agendaMeetings(cache).find((m) => m.start > nowMs && deja.indexOf(agendaKey(m)) < 0);
  if (!prochain) return null;
  const when = Math.max(nowMs + 1000, prochain.start - AGENDA_WARN_BEFORE_MS);
  try { api.alarms.create(ALARM_AGENDA_WARN, { when: when }); } catch (e) { /* noop */ }
  return when;
}

// L'alarme sonne. Tous les rendez-vous dont le seuil est atteint et qui n'ont
// pas commence sont annonces (une alarme en retard apres une veille en couvre
// plusieurs), puis la suivante est posee.
// La machine est-elle eveillee ? Actif = oui. Verrouille, ou inactif depuis
// dix minutes = non. Une erreur de l'API ne bloque jamais un rappel.
async function machineEveillee() {
  try {
    let st;
    if (globalThis.browser && globalThis.browser.idle) { st = await globalThis.browser.idle.queryState(AGENDA_ASLEEP_SECONDS); }
    else { st = await new Promise((res) => chrome.idle.queryState(AGENDA_ASLEEP_SECONDS, res)); }
    return !st || st === "active";
  } catch (e) { return true; }
}

async function agendaWarnFire() {
  const now = Date.now();
  const r = await kvGet(["agendaCalendarId", "agendaWarn", "agendaCache", "agendaWarned"]);
  if (!r.agendaCalendarId || r.agendaWarn === false) return;
  if (!(await machineEveillee())) {
    try { api.alarms.create(ALARM_AGENDA_WARN, { when: now + AGENDA_RETRY_ASLEEP_MS }); } catch (e) { /* noop */ }
    return;
  }
  const cache = r.agendaCache || { events: [] };
  let deja = Array.isArray(r.agendaWarned) ? r.agendaWarned : [];
  const dus = agendaMeetings(cache).filter((m) => m.start > now && m.start - AGENDA_WARN_BEFORE_MS <= now + 15000 && deja.indexOf(agendaKey(m)) < 0);
  for (let i = 0; i < dus.length; i++) {
    await agendaNotify(dus[i], now);
    deja.push(agendaKey(dus[i]));
  }
  if (deja.length > AGENDA_WARNED_MAX) deja = deja.slice(-AGENDA_WARNED_MAX);
  await kvSet({ agendaWarned: deja });
  await agendaScheduleWarn(cache, now);
}

// L'alarme de fin : l'evenement dont la fin moins cinq minutes est la plus
// proche et pas encore annoncee. Un evenement deja en cours compte, c'est
// meme le cas le plus frequent. TOUS les evenements a horaire, reunions
// comme blocs solo, decision du 2026-09-21.
async function agendaScheduleEnd(cache, nowMs) {
  try { await api.alarms.clear(ALARM_AGENDA_END); } catch (e) { /* noop */ }
  const r = await kvGet(["agendaEndWarn", "agendaEndWarned"]);
  if (r.agendaEndWarn === false) return null;
  const deja = Array.isArray(r.agendaEndWarned) ? r.agendaEndWarned : [];
  const evs = (cache && Array.isArray(cache.events)) ? cache.events : [];
  let prochain = null;
  evs.forEach((m) => {
    if (m.end - AGENDA_END_BEFORE_MS <= nowMs || deja.indexOf(agendaKey(m)) >= 0) return;
    if (!prochain || m.end < prochain.end) prochain = m;
  });
  if (!prochain) return null;
  const when = Math.max(nowMs + 1000, prochain.end - AGENDA_END_BEFORE_MS);
  try { api.alarms.create(ALARM_AGENDA_END, { when: when }); } catch (e) { /* noop */ }
  return when;
}

async function agendaEndFire() {
  const now = Date.now();
  const r = await kvGet(["agendaCalendarId", "agendaEndWarn", "agendaCache", "agendaEndWarned"]);
  if (!r.agendaCalendarId || r.agendaEndWarn === false) return;
  if (!(await machineEveillee())) {
    try { api.alarms.create(ALARM_AGENDA_END, { when: now + AGENDA_RETRY_ASLEEP_MS }); } catch (e) { /* noop */ }
    return;
  }
  const cache = r.agendaCache || { events: [] };
  let deja = Array.isArray(r.agendaEndWarned) ? r.agendaEndWarned : [];
  // Une fin deja passee n'est plus annoncee : prevenir apres coup ne sert a rien.
  const dus = (cache.events || []).filter((m) => m.end > now && m.end - AGENDA_END_BEFORE_MS <= now + 15000 && deja.indexOf(agendaKey(m)) < 0);
  for (let i = 0; i < dus.length; i++) {
    await agendaNotify(dus[i], now, "end");
    deja.push(agendaKey(dus[i]));
  }
  if (deja.length > AGENDA_WARNED_MAX) deja = deja.slice(-AGENDA_WARNED_MAX);
  await kvSet({ agendaEndWarned: deja });
  await agendaScheduleEnd(cache, now);
}

function agendaHeure(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// La bulle dans la page d'abord, la notification du systeme sinon. La page
// repond {shown:false} si un rappel d'habitude est deja a l'ecran, ou ne
// repond pas du tout (page interne, nouvel onglet) : dans les deux cas le
// rendez-vous ne doit JAMAIS passer sous silence.
async function agendaNotify(m, nowMs, kind) {
  const fin = kind === "end";
  const minutes = Math.max(1, Math.round(((fin ? m.end : m.start) - nowMs) / 60000));
  const payload = { type: fin ? "kz-meeting-end" : "kz-meeting-soon", id: m.id, title: m.title, start: m.start, end: m.end, minutes: minutes, url: m.url || "", people: m.people || 0 };
  const tab = await targetTab();
  // Sur une page de visio (kMeet, Teams...), pas de bulle : l'utilisateur est
  // peut-etre deja en appel, et injecter les scripts dans cet onglet ferait
  // jouer le coucou de visio en plein appel. La notification suffit.
  const cfg = { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns", "notifyEnabled", "notifyMailboxUuid"])) };
  // Le bouton Prevenir n'a de sens qu'avant le debut, et seulement si la
  // boite d'envoi est choisie.
  payload.canNotify = !fin && !!cfg.notifyEnabled && !!cfg.notifyMailboxUuid;
  const enVisio = !!(tab && cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns));
  if (payload.canNotify && tab && !enVisio) payload.notifyNonce = await notifyNonceCreate(tab.id, m);
  if (tab && !enVisio && (await agendaSendToTab(tab, payload))) return "tab";
  await agendaSystemNotification(m, minutes, kind);
  return "notification";
}

async function agendaSendToTab(tab, payload) {
  try {
    const r = await api.tabs.sendMessage(tab.id, payload);
    return !!(r && r.shown);
  } catch (e) {
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["quotes.js", "passages.js", "content.js"] });
      const r = await api.tabs.sendMessage(tab.id, payload);
      return !!(r && r.shown);
    } catch (_) { return false; }
  }
}

async function agendaSystemNotification(m, minutes, kind) {
  if (!api.notifications || !api.notifications.create) return false;
  const fin = kind === "end";
  const titre = fin
    ? bgMsg("meetingEndPill", "Fin dans {n} min").replace("{n}", minutes)
    : bgMsg("meetingSoonPill", "Rendez-vous dans {n} min").replace("{n}", minutes);
  const nom = m.title || bgMsg("meetingUntitled", "Sans titre");
  try {
    await api.notifications.create("kz-agenda-" + (fin ? "end-" : "") + agendaKey(m), {
      type: "basic",
      iconUrl: api.runtime.getURL("icons/icon-128.png"),
      title: titre,
      message: nom + " · " + (fin ? bgMsg("meetingUntil", "jusqu'à {h}").replace("{h}", agendaHeure(m.end)) : agendaHeure(m.start))
    });
    return true;
  } catch (e) { return false; }
}

async function agendaOpenUrl(url) {
  url = String(url || "");
  if (!/^https?:\/\//i.test(url)) return false;
  const r = await kvGet(["agendaCache"]);
  const evs = (r.agendaCache && Array.isArray(r.agendaCache.events)) ? r.agendaCache.events : [];
  if (!evs.some((m) => m.url === url)) return false;
  try { await api.tabs.create({ url: url }); return true; } catch (e) { return false; }
}

// Un clic sur la notification ouvre la visio du rendez-vous, s'il en a une.
if (api.notifications && api.notifications.onClicked) {
  api.notifications.onClicked.addListener((id) => {
    if (typeof id !== "string" || id.indexOf("kz-agenda-") !== 0) return;
    const cle = id.slice("kz-agenda-".length).replace(/^end-/, "");
    kvGet(["agendaCache"]).then((r) => {
      const evs = (r.agendaCache && Array.isArray(r.agendaCache.events)) ? r.agendaCache.events : [];
      const m = evs.find((x) => agendaKey(x) === cle);
      if (m && m.url) agendaOpenUrl(m.url).catch(() => {});
      try { api.notifications.clear(id); } catch (e) { /* noop */ }
    }).catch(() => {});
  });
}

// La connexion. Un jeton saisi n'est garde que s'il lit les agendas et
// n'ouvre ni le mail ni kDrive ; il est chiffre sous agendaTokenEnc. Sans
// jeton saisi, celui deja enregistre sert (changer d'agendas). Un seul
// agenda lisible se choisit tout seul, plusieurs demandent un choix.
async function agendaConnect(tokenArg) {
  let token = String(tokenArg || "").trim();
  const saisi = !!token;
  if (!token) token = await agendaToken();
  if (!token) return { ok: false, error: "empty_token" };
  const liste = await agendaListCalendars(token);
  if (!liste.ok) { await agendaRememberError(liste.error); return liste; }
  if (saisi) {
    const v = verdictSonde(await tokenExtras(token, "calendar"));
    if (!v.ok) return v;
  }
  const patch = { agendaLastError: "", agendaMyUserId: liste.myUserId || 0 };
  if (saisi) { patch.agendaTokenEnc = await secretEncrypt(token); patch.tokensReset = false; }
  const email = await agendaProfileEmail(token);
  patch.agendaMyEmail = email || "";
  await kvSet(patch);
  if (liste.calendars.length === 1) {
    const seul = liste.calendars[0];
    const r = await agendaChoose(seul.id, seul.name);
    if (!r.ok) return r;
    return { ok: true, calendarName: seul.name };
  }
  return { ok: true, needsChoice: true, calendars: liste.calendars };
}

async function agendaListCalendarsForPopup() {
  const token = await agendaToken();
  if (!token) return { ok: false, error: "not_configured" };
  const liste = await agendaListCalendars(token);
  if (!liste.ok) await agendaRememberError(liste.error);
  return liste;
}

// Le choix de l'agenda. Le nom vient de la liste affichee, purement
// cosmetique. Le cache est vide puis relu tout de suite.
// Un identifiant et un nom, ou une liste de {id, name} : un ou plusieurs
// agendas (pro et perso), au moins un.
async function agendaChoose(calendarsOrId, calendarName) {
  let liste = Array.isArray(calendarsOrId) ? calendarsOrId : [{ id: calendarsOrId, name: calendarName }];
  const vus = {};
  liste = liste.map((c) => ({ id: Number(c && c.id) || 0, name: String((c && c.name) || "").trim() }))
    .filter((c) => c.id && !vus[c.id] && (vus[c.id] = true));
  if (!liste.length) return { ok: false, error: "no_calendar" };
  const token = await agendaToken();
  if (!token) return { ok: false, error: "not_configured" };
  await kvSet({
    agendaCalendars: liste,
    agendaCalendarId: liste[0].id,
    agendaCalendarName: liste.map((c) => c.name).filter(Boolean).join(", "),
    agendaEnabled: true,
    agendaCache: null,
    agendaWarned: [],
    agendaEndWarned: [],
    agendaLastError: ""
  });
  const r = await agendaRefresh({ force: true });
  if (!r.ok && r.error !== "not_configured") return r;
  // L'historique des reunions, une fois. Un echec ici n'empeche pas la
  // connexion : les stats partiront d'aujourd'hui.
  try { await agendaBackfill(Date.now()); } catch (e) { /* noop */ }
  return { ok: true };
}

// Appele apres chaque kz-save avec l'etat des deux interrupteurs AVANT
// l'ecriture. Seul un vrai changement agit : allumer rafraichit tout de
// suite, eteindre retire l'alarme et remet l'etat a plat, changer le rappel
// des trois minutes repose l'alarme depuis le cache, sans appel reseau.
async function agendaAfterSave(payload, avant) {
  if (payload && payload.mailStatsEnabled === true) mailStatsRefresh({ force: true }).catch(() => {});
  // Stats mail eteintes et Prevenir eteint : plus rien ne sert la boite,
  // l'adresse et le jeton mail sont oublies.
  if (payload && payload.mailStatsEnabled === false) {
    const n = await kvGet(["notifyEnabled"]);
    if (!n.notifyEnabled) await kvSet({ notifyMailboxUuid: "", notifyMailboxEmail: "", notifyMailboxName: "", notifyMailboxHosting: 0, notifyMailboxLogin: "", notifyTokenEnc: null });
  }
  if (!payload || (payload.agendaEnabled === undefined && payload.agendaWarn === undefined && payload.agendaEndWarn === undefined)) return;
  avant = avant || {};
  const r = await kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn", "agendaCalendarId", "agendaCache"]);
  if (!r.agendaCalendarId) return;
  const actifAvant = agendaActif(Object.assign({}, r, { agendaEnabled: avant.agendaEnabled, agendaWarn: avant.agendaWarn, agendaEndWarn: avant.agendaEndWarn }));
  const actifApres = agendaActif(r);
  const warnAvant = avant.agendaWarn !== false, warnApres = r.agendaWarn !== false;
  const finAvant = avant.agendaEndWarn !== false, finApres = r.agendaEndWarn !== false;
  // Les deux interrupteurs eteints : plus rien ne sert la connexion, l'alarme
  // part et l'etat se remet a plat. L'un des deux rallume : on relit tout de
  // suite. Seul le rappel change : l'alarme se repose depuis le cache.
  if (actifAvant && !actifApres) {
    try { await api.alarms.clear(ALARM_AGENDA_WARN); } catch (e) { /* noop */ }
    try { await api.alarms.clear(ALARM_AGENDA_END); } catch (e) { /* noop */ }
    await kvSet({ agendaState: { inUntil: 0, inTitle: "", nextStart: 0, nextTitle: "" } });
    return;
  }
  if (!actifAvant && actifApres) { await agendaRefresh({ force: true }); return; }
  if (warnAvant !== warnApres) await agendaScheduleWarn(r.agendaCache, Date.now());
  if (finAvant !== finApres) await agendaScheduleEnd(r.agendaCache, Date.now());
}

async function agendaDisconnect() {
  try { await api.alarms.clear(ALARM_AGENDA_WARN); } catch (e) { /* noop */ }
  try { await api.alarms.clear(ALARM_AGENDA_END); } catch (e) { /* noop */ }
  const patch = {
    agendaEnabled: false,
    agendaTokenEnc: null,
    agendaCalendarId: 0,
    agendaCalendarName: "",
    agendaCalendars: [],
    agendaMyUserId: 0,
    agendaMyEmail: "",
    agendaCache: null,
    agendaWarned: [],
    agendaEndWarned: [],
    agendaLastError: "",
    agendaState: { inUntil: 0, inTitle: "", nextStart: 0, nextTitle: "" },
    notifyEnabled: false,
    notifyMailboxUuid: "",
    notifyMailboxEmail: "",
    notifyMailboxName: "",
    notifyMailboxHosting: 0,
    notifyMailboxLogin: "",
    notifyTokenEnc: null,
    mailStatsEnabled: false,
    tokensReset: false
  };
  await kvSet(patch);
  // Plus aucun jeton : la cle de chiffrement part aussi.
  await secretForget();
  return { ok: true };
}

// ===========================================================================
// Prevenir les participants par mail, 2026-09-22. Trois messages, retard de
// cinq ou dix minutes ou absence, relus et envoyes d'un clic depuis la boite
// Infomaniak de l'utilisateur. Circuit du serveur MCP mail, verifie dans son
// code : liste des boites sur mail.infomaniak.com/api/mailbox, brouillon POST
// /mail/{uuid}/draft en action "save", puis PUT du meme brouillon en action
// "send". L'identite d'expedition vient des signatures de la boite (API du
// Manager), facultative. Les adresses des participants sont relues a la
// demande et jamais stockees : le cache ne garde que leur nombre.
// ===========================================================================

const NOTIFY_KINDS = { late5: 5, late10: 10, absent: 0 };
const NOTIFY_SENT_MAX = 60;

// Le jeton du mail, workspace:mail seul. Plus de repli sur celui de l'agenda.
async function notifyToken() {
  await securityReady();
  const r = await kvGet(["notifyTokenEnc"]);
  if (!r.notifyTokenEnc) return null;
  return secretDecrypt(r.notifyTokenEnc);
}

// Connexion du mail avec un jeton saisi : il n'est garde que si la liste des
// boites repond avec lui. Sans jeton saisi, la liste passe par notifyToken().
async function notifyConnect(tokenArg) {
  const saisi = String(tokenArg || "").trim();
  const liste = await notifyListMailboxes(saisi || null);
  if (!liste.ok) return liste;
  if (saisi) {
    const v = verdictSonde(await tokenExtras(saisi, "mail"));
    if (!v.ok) return v;
    await kvSet({ notifyTokenEnc: await secretEncrypt(saisi) });
  }
  return liste;
}

// Eteindre Prevenir oublie la boite, l'adresse et le jeton propre au mail.
async function notifyDisconnect() {
  // Les stats des mails se servent de la meme boite : tant qu'elles sont
  // allumees, eteindre Prevenir ne coupe que Prevenir.
  const r = await kvGet(["mailStatsEnabled"]);
  if (r.mailStatsEnabled) { await kvSet({ notifyEnabled: false }); return { ok: true, kept: true }; }
  await kvSet({ notifyEnabled: false, notifyMailboxUuid: "", notifyMailboxEmail: "", notifyMailboxName: "", notifyMailboxHosting: 0, notifyMailboxLogin: "", notifyTokenEnc: null });
  return { ok: true };
}

async function notifyListMailboxes(tokenArg) {
  const token = tokenArg || (await notifyToken());
  if (!token) return { ok: false, error: "not_configured" };
  const r = await ikFetch(token, "/mailbox?with=aliases", { base: MAIL_API });
  if (!r.ok) return r;
  const liste = (Array.isArray(r.data) ? r.data : [])
    .filter((m) => m && m.uuid && m.email)
    .map((m) => ({
      uuid: String(m.uuid),
      email: String(m.email).toLowerCase(),
      name: String(m.mailbox || m.email),
      hostingId: Number(m.hosting_id) || 0,
      login: String(m.mailbox || ""),
      aliases: Array.isArray(m.aliases) ? m.aliases.map(String) : []
    }));
  if (!liste.length) return { ok: false, error: "no_mailbox" };
  // Les adresses d'expedition possibles : l'adresse de chaque boite et ses
  // alias, une seule fois, avec la boite qui les porte.
  const adresses = [];
  const vus = {};
  liste.forEach((mb) => {
    [mb.email].concat(mb.aliases).forEach((a) => {
      const adr = String(a || "").trim().toLowerCase();
      if (!adr || vus[adr]) return;
      vus[adr] = true;
      adresses.push({ uuid: mb.uuid, email: adr, name: mb.name, hostingId: mb.hostingId, login: mb.login, principal: adr === mb.email });
    });
  });
  return { ok: true, mailboxes: liste, addresses: adresses };
}

async function notifyChoose(mb) {
  if (!mb || !mb.uuid || !mb.email) return { ok: false, error: "no_mailbox" };
  await kvSet({
    notifyEnabled: true,
    notifyMailboxUuid: String(mb.uuid),
    notifyMailboxEmail: String(mb.email).toLowerCase(),
    notifyMailboxName: String(mb.name || mb.email),
    notifyMailboxHosting: Number(mb.hostingId) || 0,
    notifyMailboxLogin: String(mb.login || "")
  });
  return { ok: true };
}

// L'identite : la signature par defaut de l'adresse, si elle a un nom. Sans
// elle, l'API prend le nom du profil du compte. Un echec ici n'empeche rien.
async function notifyIdentity(token, r) {
  if (!r.notifyMailboxHosting || !r.notifyMailboxLogin) return null;
  try {
    const s = await ikFetch(token, "/1/mail_hostings/" + encodeURIComponent(r.notifyMailboxHosting) + "/mailboxes/" + encodeURIComponent(r.notifyMailboxLogin) + "/signatures");
    const sigs = (s.ok && s.data && Array.isArray(s.data.signatures)) ? s.data.signatures : [];
    const adr = String(r.notifyMailboxEmail || "").toLowerCase();
    const nommees = sigs.filter((x) => x && String(x.sender || "").toLowerCase() === adr && String(x.full_name || "").trim());
    const choisie = nommees.find((x) => x.is_default) || nommees[0] || null;
    return choisie ? { id: String(choisie.id), name: String(choisie.full_name).trim() } : null;
  } catch (e) { return null; }
}

function notifyTemplates(title, startMs) {
  // 2026-10-06 (revue ECC, L6) : un titre d'invitation externe peut porter
  // des retours a la ligne ou des caracteres de controle ; jamais dans un objet.
  const t = String(title || "").replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || bgMsg("meetingUntitled", "Sans titre");
  const h = agendaHeure(startMs);
  const retard = (n) => ({
    subject: bgMsg("notifySubjLate", "Retard de {n} min · {t}").replace("{n}", n).replace("{t}", t),
    body: bgMsg("notifyBodyLate", "Bonjour,\n\nJ'aurai environ {n} minutes de retard pour « {t} » ({h}). Commencez sans moi, je vous rejoins dès que possible.\n\nMerci et à tout de suite").split("{n}").join(n).split("{t}").join(t).split("{h}").join(h)
  });
  return {
    late5: retard(5),
    late10: retard(10),
    absent: {
      subject: bgMsg("notifySubjAbsent", "Absence · {t}").replace("{t}", t),
      body: bgMsg("notifyBodyAbsent", "Bonjour,\n\nJe ne pourrai pas participer à « {t} » ({h}).\n\nDésolé pour ce contretemps").split("{t}").join(t).split("{h}").join(h)
    }
  };
}

// ===========================================================================
// Jeton d'envoi, 2026-10-06 (revue ECC, point M2). Une page ne peut preparer
// ou envoyer un mail QUE pour la bulle que le fond vient de lui montrer : le
// fond remet avec la bulle un jeton aleatoire, lie a cet onglet, a ce
// rendez-vous et a sa fin. Le rendez-vous et son debut viennent du jeton,
// jamais de la page ; l'objet et le texte sont ceux du fond. Le popup (page
// de l'extension) n'en a pas besoin. Et un quota borne les envois.
// ===========================================================================
const NOTIFY_NONCE_MAX = 20;
const NOTIFY_RATE_MAX = 6;
const NOTIFY_RATE_WINDOW_MS = 60 * 60 * 1000;
function hexAleatoire(n) { return Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function notifyNonceCreate(tabId, m) {
  const now = Date.now();
  const r = await kvGet(["notifyNonces"]);
  const liste = (r.notifyNonces && typeof r.notifyNonces === "object") ? r.notifyNonces : {};
  Object.keys(liste).forEach((k) => { if (!liste[k] || Number(liste[k].expires) <= now) delete liste[k]; });
  const cle = hexAleatoire(16);
  liste[cle] = { tabId: Number(tabId), id: String(m.id), start: Number(m.start) || 0, expires: (Number(m.end) > Number(m.start)) ? Number(m.end) : (Number(m.start) || now) + 60 * 60000 };
  const cles = Object.keys(liste);
  while (cles.length > NOTIFY_NONCE_MAX) delete liste[cles.shift()];
  await kvSet({ notifyNonces: liste });
  return cle;
}
// Le rendez-vous vise : celui du jeton pour une page, celui demande par le popup.
async function notifyCible(msg, sender) {
  if (depuisExtension(sender)) return { ok: true, id: msg.id, start: Number(msg.start) || 0, page: false };
  const cle = String(msg.nonce || "");
  if (!/^[0-9a-f]{32}$/.test(cle)) return { ok: false, error: "not_allowed" };
  const r = await kvGet(["notifyNonces"]);
  const n = r.notifyNonces && r.notifyNonces[cle];
  const tabId = sender && sender.tab ? Number(sender.tab.id) : -1;
  if (!n || Number(n.tabId) !== tabId || Number(n.expires) <= Date.now()) return { ok: false, error: "not_allowed" };
  if (msg.id !== undefined && String(msg.id) !== String(n.id)) return { ok: false, error: "not_allowed" };
  return { ok: true, id: n.id, start: Number(n.start) || 0, page: true };
}
// Au plus NOTIFY_RATE_MAX envois par heure, toutes origines confondues.
async function notifyQuota() {
  const now = Date.now();
  const r = await kvGet(["notifyRate"]);
  const t = (Array.isArray(r.notifyRate) ? r.notifyRate : []).filter((x) => Number(x) > now - NOTIFY_RATE_WINDOW_MS);
  return { ok: t.length < NOTIFY_RATE_MAX, liste: t };
}
const notifyEnCours = new Set();

function notifyKey(id, startMs) { return String(id) + "@" + String(Number(startMs) || 0); }

// Les participants d'un rendez-vous, relus a la demande, moi exclu,
// l'organisateur en tete, une adresse une seule fois. Avec les trois
// messages prets et la liste de ceux deja envoyes pour ce rendez-vous.
async function notifyPrepare(eventId, startMs) {
  const r = await kvGet(["notifyEnabled", "notifyMailboxUuid", "agendaMyUserId", "agendaMyEmail", "notifySent"]);
  if (!r.notifyEnabled || !r.notifyMailboxUuid) return { ok: false, error: "notify_off" };
  if (!eventId) return { ok: false, error: "no_event" };
  const token = await agendaToken();
  if (!token) return { ok: false, error: "not_configured" };
  const ev = await ikFetch(token, "/1/calendar/pim/event/" + encodeURIComponent(eventId) + "?with=attendees");
  if (!ev.ok) return ev;
  const e = ev.data || {};
  let attendees = Array.isArray(e.attendees) ? e.attendees : [];
  // Repli : si l'appel unitaire ne rend aucun invite, la liste autour du
  // debut, qui en rend toujours avec with=attendees, sert de source.
  if (!attendees.length && startMs) {
    const liste = await agendaFetchAll(token, agendaIds(await kvGet(["agendaCalendarId", "agendaCalendars"])), Number(startMs) - 60000, Number(startMs) + 60000);
    if (liste.ok) {
      const trouve = liste.events.find((x) => String(x.id) === String(eventId));
      if (trouve && Array.isArray(trouve.attendees)) attendees = trouve.attendees;
    }
  }
  const me = { userId: Number(r.agendaMyUserId) || 0, email: String(r.agendaMyEmail || "").toLowerCase() };
  // Vu en reel le 2026-09-22 : un invite peut porter la meme adresse que le
  // profil du compte tout en etant un AUTRE utilisateur (autre user_id). Pour
  // les destinataires, l'identifiant prime ; l'adresse ne tranche que quand
  // l'invite n'en a pas. Sinon "Personne a prevenir" alors qu'il y a quelqu'un.
  const estMoi = (a) => {
    if (me.userId && a.user_id != null && a.user_id !== "") return Number(a.user_id) === me.userId;
    return agendaIsMe(a, me, e);
  };
  const vus = {};
  const recipients = [];
  attendees.forEach((a) => {
    if (!a || !a.address || estMoi(a)) return;
    const adr = String(a.address).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(adr) || vus[adr]) return;
    vus[adr] = true;
    recipients.push({ name: String(a.name || "").trim(), address: adr, organizer: !!a.organizer });
  });
  recipients.sort((a, b) => (b.organizer ? 1 : 0) - (a.organizer ? 1 : 0));
  const debut = Number(startMs) || agendaParseTs(e.start);
  const sent = (r.notifySent && r.notifySent[notifyKey(eventId, debut)]) || [];
  return { ok: true, id: eventId, start: debut, title: String(e.title || "").trim(), recipients: recipients, sent: sent, templates: notifyTemplates(e.title, debut) };
}

function notifyHtml(texte) {
  const esc = String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  return "<html><body><div style=\"font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px;\">" + esc.replace(/\n/g, "<br>") + "</div></body></html>";
}

async function notifySend(p, cible) {
  p = p || {};
  cible = cible || { page: false };
  const kind = String(p.kind || "");
  if (!(kind in NOTIFY_KINDS)) return { ok: false, error: "bad_kind" };
  const to = (Array.isArray(p.to) ? p.to : []).map((a) => String(a || "").trim().toLowerCase()).filter((a) => /^[^@\s]+@[^@\s]+$/.test(a));
  const uniques = to.filter((a, i) => to.indexOf(a) === i);
  if (!uniques.length) return { ok: false, error: "no_recipients" };
  // Le texte relu (et retouche) vient de la bulle ou du popup ; l'objet, lui,
  // est toujours construit ici. Une page ne peut envoyer qu'avec son jeton,
  // aux invites seulement, une fois par message, dans le quota.
  const corpsLibre = String(p.body || "").trim().slice(0, 4000);
  if (!corpsLibre) return { ok: false, error: "empty" };
  const r = await kvGet(["notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxHosting", "notifyMailboxLogin", "notifySent"]);
  if (!r.notifyEnabled || !r.notifyMailboxUuid) return { ok: false, error: "notify_off" };
  const cle = notifyKey(p.id, p.start);
  const deja = (r.notifySent && Array.isArray(r.notifySent[cle])) ? r.notifySent[cle] : [];
  if (deja.indexOf(kind) >= 0) return { ok: false, error: "already_sent" };
  // Deux envois simultanes du meme message (bulle et popup) : un seul passe.
  const verrou = cle + "#" + kind;
  if (notifyEnCours.has(verrou)) return { ok: false, error: "already_sent" };
  notifyEnCours.add(verrou);
  try { return await notifySendVerrouille(p, kind, uniques, corpsLibre, r, cle, deja); }
  finally { notifyEnCours.delete(verrou); }
}
async function notifySendVerrouille(p, kind, uniques, corpsLibre, r, cle, deja) {
  const quota = await notifyQuota();
  if (!quota.ok) return { ok: false, error: "rate_limited" };
  // 2026-09-29 : les destinataires sont relus dans l'agenda et CHAQUE
  // adresse demandee doit en faire partie. Une bulle detournee ne peut donc
  // ni ajouter une adresse ni ecrire a quelqu'un d'autre que les invites.
  const prep = await notifyPrepare(p.id, p.start);
  if (!prep.ok) return prep;
  const permis = {};
  prep.recipients.forEach((x) => { permis[x.address] = true; });
  if (uniques.some((a) => !permis[a])) return { ok: false, error: "bad_recipients" };
  // L'objet est toujours celui du fond, construit sur le vrai titre.
  const gabarit = prep.templates[kind];
  const subject = String(gabarit.subject || "").slice(0, 200);
  const body = corpsLibre || String(gabarit.body || "");
  const token = await notifyToken();
  if (!token) return { ok: false, error: "not_configured" };
  const identite = await notifyIdentity(token, r);
  const from = { id: null, name: identite ? identite.name : String(r.notifyMailboxEmail).split("@")[0], email: String(r.notifyMailboxEmail) };
  const brouillon = {
    uuid: null, subject: subject, body: notifyHtml(body), quote: null, mime_type: "text/html",
    from: from, reply_to: { name: from.name, email: from.email },
    to: uniques.map((a) => ({ name: "", email: a })), cc: null, bcc: null,
    references: "", in_reply_to: null, in_reply_to_uid: null, forwarded_uid: null, attachments: [],
    identity_id: identite ? identite.id : null, ack_request: false, st_uuid: null, uid: null, resource: null,
    priority: "normal", encrypted: false, encryption_password: "", event_poll_uuid: null, action: "save", delay: 0
  };
  const uuid = encodeURIComponent(r.notifyMailboxUuid);
  const json = { "Content-Type": "application/json" };
  const c = await ikFetch(token, "/mail/" + uuid + "/draft", { base: MAIL_API, method: "POST", headers: json, body: JSON.stringify(brouillon) });
  if (!c.ok) return c;
  const d = c.data || {};
  if (!d.uuid) return { ok: false, error: "draft_failed" };
  const envoi = Object.assign({}, brouillon, { uuid: d.uuid, uid: d.uid || null, action: "send", delay: 0, resource: "/api/mail/" + uuid + "/draft/" + encodeURIComponent(d.uuid) });
  const s = await ikFetch(token, "/mail/" + uuid + "/draft/" + encodeURIComponent(d.uuid), { base: MAIL_API, method: "PUT", headers: json, body: JSON.stringify(envoi) });
  if (!s.ok) return s;
  const sent = (r.notifySent && typeof r.notifySent === "object") ? r.notifySent : {};
  sent[cle] = deja.concat([kind]);
  const cles = Object.keys(sent);
  while (cles.length > NOTIFY_SENT_MAX) delete sent[cles.shift()];
  await kvSet({ notifySent: sent, notifyRate: quota.liste.concat([Date.now()]) });
  return { ok: true, count: uniques.length };
}

// ===========================================================================
// Sauvegarde des connexions. Les deux jetons (agenda, mail) et ce qui va
// avec (agendas, boite) ne partent dans un fichier que chiffres par une
// phrase secrete tapee a l'export et a l'import, jamais enregistree.
// 2026-09-29 : 12 caracteres au moins (4 auparavant, cassable en quelques
// heures), PBKDF2-SHA256 600 000 tours (recommandation OWASP) puis AES-GCM
// 256. Le nombre de tours voyage avec le fichier. Un fichier v1 (avant ce
// jour) rend ses reglages mais JAMAIS ses jetons : ils avaient plusieurs
// perimetres. Les jetons ne transitent qu'ici, jamais en clair par le popup.
// ===========================================================================
const CONNEXIONS_ITER = 600000;
const CONNEXIONS_MIN_PASS = 12;
const CONNEXIONS_ITER_MAX = 5000000;
const CONNEXIONS_KEYS = ["agendaCalendars", "agendaCalendarId", "agendaCalendarName", "agendaMyUserId", "agendaMyEmail", "notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxHosting", "notifyMailboxLogin"];

async function connexionsKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function connexionsExport(pass) {
  pass = String(pass || "");
  if (pass.length < CONNEXIONS_MIN_PASS) return { ok: false, error: "pass_short" };
  const r = await kvGet(CONNEXIONS_KEYS.concat(["agendaTokenEnc", "notifyTokenEnc"]));
  const clair = { v: 2 };
  CONNEXIONS_KEYS.forEach((k) => { if (r[k] !== undefined) clair[k] = r[k]; });
  clair.agendaToken = r.agendaTokenEnc ? (await secretDecrypt(r.agendaTokenEnc)) || "" : "";
  clair.notifyToken = r.notifyTokenEnc ? (await secretDecrypt(r.notifyTokenEnc)) || "" : "";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await connexionsKey(pass, salt, CONNEXIONS_ITER);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify(clair)));
  return { ok: true, blob: { v: 2, kdf: "PBKDF2-SHA256", iter: CONNEXIONS_ITER, salt: Array.from(salt), iv: Array.from(iv), data: Array.from(new Uint8Array(data)) },
    parts: { agenda: !!clair.agendaToken, notify: !!clair.notifyToken } };
}

async function connexionsImport(blob, pass) {
  pass = String(pass || "");
  if (!blob || (blob.v !== 1 && blob.v !== 2) || !Array.isArray(blob.salt) || !Array.isArray(blob.iv) || !Array.isArray(blob.data)) return { ok: false, error: "bad_blob" };
  // 2026-10-06 (revue ECC, L9) : un fichier pieges ne bloque pas le fond.
  const octets = (a) => a.every((x) => Number.isInteger(x) && x >= 0 && x <= 255);
  if (blob.salt.length !== 16 || blob.iv.length !== 12 || blob.data.length > 1000000 || !octets(blob.salt) || !octets(blob.iv) || !octets(blob.data)) return { ok: false, error: "bad_blob" };
  if (blob.iter !== undefined && (!Number.isFinite(Number(blob.iter)) || Number(blob.iter) > CONNEXIONS_ITER_MAX)) return { ok: false, error: "bad_blob" };
  // Un ancien fichier se relit avec la phrase choisie a l'epoque, meme courte.
  if (blob.v === 2 && pass.length < CONNEXIONS_MIN_PASS) return { ok: false, error: "pass_short" };
  if (!pass) return { ok: false, error: "pass_short" };
  const iter = blob.v === 1 ? 200000 : Math.max(CONNEXIONS_ITER, Number(blob.iter) || 0);
  let clair;
  try {
    const key = await connexionsKey(pass, new Uint8Array(blob.salt), iter);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(blob.iv) }, key, new Uint8Array(blob.data));
    clair = JSON.parse(new TextDecoder().decode(plain));
  } catch (e) { return { ok: false, error: "bad_passphrase" }; }
  if (!clair || clair.v !== blob.v) return { ok: false, error: "bad_blob" };
  const patch = {};
  const nombre = (v) => Number(v) || 0;
  const texte = (v) => String(v || "");
  const jetons = blob.v === 2;
  // Les jetons d'un fichier repassent les sondes : trop larges ou non
  // verifiables (hors ligne), ils ne sont pas restaures et on le dit.
  let nonVerifies = false;
  if (jetons && clair.agendaToken) {
    const v = verdictSonde(await tokenExtras(String(clair.agendaToken), "calendar"));
    if (v.ok) { patch.agendaTokenEnc = await secretEncrypt(String(clair.agendaToken)); patch.tokensReset = false; } else nonVerifies = true;
  }
  if (jetons && clair.notifyToken) {
    const v = verdictSonde(await tokenExtras(String(clair.notifyToken), "mail"));
    if (v.ok) patch.notifyTokenEnc = await secretEncrypt(String(clair.notifyToken)); else nonVerifies = true;
  }
  ["agendaCalendarId", "agendaMyUserId", "notifyMailboxHosting"].forEach((k) => { if (clair[k] !== undefined) patch[k] = nombre(clair[k]); });
  ["agendaCalendarName", "agendaMyEmail", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxLogin"].forEach((k) => { if (clair[k] !== undefined) patch[k] = texte(clair[k]); });
  if (Array.isArray(clair.agendaCalendars)) patch.agendaCalendars = clair.agendaCalendars.map((c) => ({ id: nombre(c && c.id), name: texte(c && c.name) })).filter((c) => c.id);
  if (clair.notifyEnabled !== undefined) patch.notifyEnabled = !!clair.notifyEnabled && !!patch.notifyMailboxUuid;
  if (patch.agendaCalendarId) { patch.agendaCache = null; patch.agendaWarned = []; patch.agendaEndWarned = []; patch.agendaLastError = ""; }
  await kvSet(patch);
  if (patch.agendaCalendarId && patch.agendaTokenEnc) agendaRefresh({ force: true }).catch(() => {});
  const vieuxJetons = !jetons && !!(clair.kdriveToken || clair.agendaToken || clair.notifyToken);
  return { ok: true, tokensSkipped: vieuxJetons, tokensUnchecked: nonVerifies, parts: { agenda: !!patch.agendaTokenEnc, notify: !!patch.notifyTokenEnc } };
}

// ===========================================================================
// Les mails dans les stats, 2026-09-26. Par jour : envoyes et recus. Verifie
// en reel sur la boite de Thomas : le filtre sfromdate / stodate est en jours
// et la borne de fin INCLUT sa journee, donc un jour J se lit de J a J ; le
// total est rendu par total_messages_count sans lister les messages. Les
// recus partent vite en Archives, Corbeille ou Spam : recus = toute la boite
// (severywhere=1) moins Envoyes, Brouillons, Spam et Corbeille. Cinq appels
// par jour, aujourd'hui et hier toutes les trente minutes, puis l'historique
// rattrape un jour par tour sur quatorze jours.
// ===========================================================================
const MAIL_STATS_EVERY_MS = 30 * 60 * 1000;
const MAIL_STATS_BACKFILL_DAYS = 14;
const MAIL_DAILY_KEEP_DAYS = 400;

async function mailFolders(token, uuid) {
  const r = await ikFetch(token, "/mail/" + encodeURIComponent(uuid) + "/folder?with=ik-static", { base: MAIL_API });
  if (!r.ok) return r;
  const roles = {};
  const parcours = (liste) => (Array.isArray(liste) ? liste : []).forEach((f) => {
    const role = String((f && f.role) || "").toUpperCase();
    if (role && f.id && !roles[role]) roles[role] = String(f.id);
    parcours(f && f.children);
  });
  parcours(r.data);
  if (!roles.INBOX || !roles.SENT) return { ok: false, error: "no_folders" };
  return { ok: true, roles: roles };
}

// Verifie en reel le 2026-09-26 : severywhere=1 couvre toute la boite SAUF
// la Corbeille, le Spam et les Brouillons ; filters=unseen ne garde que les
// non lus ; la date filtree est celle du message, donc un mail supprime compte
// au jour ou il est arrive.
async function mailCount(token, uuid, folderId, jour, partout, nonLus) {
  const d = encodeURIComponent(jour + " 00:00:00");
  const q = "?offset=0&thread=off&limit=1&severywhere=" + (partout ? "1" : "0") + "&sfromdate=" + d + "&stodate=" + d + (nonLus ? "&filters=unseen" : "");
  const r = await ikFetch(token, "/mail/" + encodeURIComponent(uuid) + "/folder/" + encodeURIComponent(folderId) + "/message" + q, { base: MAIL_API });
  if (!r.ok) return null;
  const n = Number(r.data && r.data.total_messages_count);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Par jour, quatre nombres, jamais un expediteur ni un objet :
//   recus     = toute la boite - envoyes + corbeille
//   lus       = toute la boite - envoyes - non lus (les envoyes sont lus)
//   supprimes = corbeille
//   traites   = lus + supprimes, ce qui a ete lu ou jete ce jour-la
async function mailCountsForDay(token, uuid, roles, jour) {
  const tout = await mailCount(token, uuid, roles.INBOX, jour, true, false);
  const nonLus = await mailCount(token, uuid, roles.INBOX, jour, true, true);
  const sent = await mailCount(token, uuid, roles.SENT, jour, false, false);
  const del = roles.TRASH ? await mailCount(token, uuid, roles.TRASH, jour, false, false) : 0;
  if (tout === null || nonLus === null || sent === null || del === null) return null;
  const gardes = Math.max(0, tout - sent);
  const lus = Math.max(0, gardes - nonLus);
  return { in: gardes + del, out: sent, read: lus, del: del, done: lus + del };
}

async function mailStatsRefresh(opts) {
  opts = opts || {};
  const r = await kvGet(["mailStatsEnabled", "notifyMailboxUuid", "mailDaily", "mailStatsAt", "screenTimezone"]);
  if (!r.mailStatsEnabled || !r.notifyMailboxUuid) return { ok: false, error: "not_configured" };
  const now = Date.now();
  if (!opts.force && r.mailStatsAt && now - Number(r.mailStatsAt) < MAIL_STATS_EVERY_MS) return { ok: true, cached: true };
  const token = await notifyToken();
  if (!token) return { ok: false, error: "not_configured" };
  const f = await mailFolders(token, r.notifyMailboxUuid);
  if (!f.ok) return f;
  const daily = (r.mailDaily && typeof r.mailDaily === "object") ? r.mailDaily : {};
  const jourDe = (decalage) => tzDayKey(r.screenTimezone, new Date(now - decalage * 24 * 60 * 60 * 1000));
  // aujourd'hui et hier a chaque fois, plus le premier jour manquant de l'historique
  const jours = [jourDe(0), jourDe(1)];
  // Un jour absent, ou mesure avant le 2026-09-26 sans lus ni supprimes, se (re)mesure.
  for (let i = 2; i < MAIL_STATS_BACKFILL_DAYS; i++) { const j = jourDe(i); if (!daily[j] || daily[j].done === undefined) { jours.push(j); break; } }
  for (const j of jours) {
    const c = await mailCountsForDay(token, r.notifyMailboxUuid, f.roles, j);
    if (c) daily[j] = c;
  }
  const cles = Object.keys(daily).sort();
  while (cles.length > MAIL_DAILY_KEEP_DAYS) delete daily[cles.shift()];
  await kvSet({ mailDaily: daily, mailStatsAt: now });
  return { ok: true, days: jours.length };
}

async function agendaState() {
  const r = await kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn", "agendaCalendarId", "agendaCalendarName", "agendaLastError", "agendaCache", "agendaState", "agendaTokenEnc", "agendaCalendars", "tokensReset", "notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyTokenEnc", "mailStatsEnabled"]);
  const now = Date.now();
  const cache = r.agendaCache || null;
  const etat = r.agendaState || {};
  const evs = (cache && Array.isArray(cache.events)) ? cache.events : [];
  return {
    enabled: !!r.agendaEnabled,
    warn: r.agendaWarn !== false,
    endWarn: r.agendaEndWarn !== false,
    configured: !!r.agendaCalendarId,
    calendarName: r.agendaCalendarName || "",
    calendars: (Array.isArray(r.agendaCalendars) && r.agendaCalendars.length) ? r.agendaCalendars : (r.agendaCalendarId ? [{ id: r.agendaCalendarId, name: r.agendaCalendarName || "" }] : []),
    hasToken: !!r.agendaTokenEnc,
    tokensReset: !!r.tokensReset,
    lastError: r.agendaLastError || "",
    lastRefresh: cache ? (Number(cache.at) || 0) : 0,
    inUntil: Number(etat.inUntil) || 0,
    inTitle: etat.inTitle || "",
    nextStart: Number(etat.nextStart) || 0,
    nextTitle: etat.nextTitle || "",
    nextId: etat.nextId || 0,
    inId: etat.inId || 0,
    inStart: Number(etat.inStart) || 0,
    notifyEnabled: !!r.notifyEnabled,
    notifyMailboxEmail: r.notifyMailboxUuid ? String(r.notifyMailboxEmail || "") : "",
    notifyHasToken: !!r.notifyTokenEnc,
    mailStatsEnabled: !!r.mailStatsEnabled,
    upcoming: evs.filter((m) => m.meeting !== false && m.start > now && m.start - now < 24 * 60 * 60 * 1000).length
  };
}
