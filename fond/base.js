// Koala Zen, le fond : reglages, ecouteurs du fond, rappels d'habitude.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

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
// L'en-tete Origin sur les appels a l'API mail d'Infomaniak.
// Le navigateur ajoute Origin: chrome-extension://... (ou moz-extension://)
// aux requetes du fond, et l'API mail les refuse alors. Une regle de session
// retire cet en-tete, seulement sur l'API mail et seulement pour les requetes
// sans onglet (tabIds [-1]) : celles du service worker, jamais une page.
// Posee a chaque reveil du worker, idempotente.
// ===========================================================================
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
  // 2026-10-28 : les rappels du koala s'eteignent a part. Les rappels de
  // l'agenda, les passages et les stats continuent sans eux.
  remindersEnabled: true,
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
  // Le bilan de la semaine par mail, 2026-11-05. Eteint par defaut.
  bilanEnabled: false,
  sportIndex: 0,
  // 2026-10-30 : Automatique par defaut, qui suit la reduction des
  // animations demandee au systeme (guide Apple, Motion et Settings).
  animMode: "auto",
  animDefautRevu: false,
  passages: true,
  passageFrequency: "normal",
  // 2026-10-28 : trois sortes de passages, chacune a son interrupteur, sous
  // l'interrupteur general `passages`. Au hasard dans la journee, en fin de
  // journee (17 h a 21 h), au debut d'une visio.
  passagesRandom: true,
  passagesEvening: true,
  passagesMeeting: true,
  // 2026-10-28 : faux = affichage sobre, les bulles sans koala ni image.
  showCharacter: true,
  quotesEnabled: true,
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
  // cinq minutes avant. Les deux interrupteurs sont des reglages exportables,
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

// Reglages enregistres au clic, sans effet sur le rythme des rappels : les
// animaux de passage, l'affichage du personnage et les citations.
const NO_RHYTHM_KEYS = ["passages", "passagesRandom", "passagesEvening", "passagesMeeting", "showCharacter", "quotesEnabled"];

async function schedule(delayMin) {
  const stored = await kvGet(["intervalMinutes", "remindersEnabled"]);
  const cfg = { ...DEFAULTS, ...stored };
  await api.alarms.clear(ALARM);
  // Rappels du koala eteints : aucune alarme. Rallumer et enregistrer la repose.
  if (cfg.remindersEnabled === false) return;
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
  // Avant le 2026-10-30, « Toujours » etait enregistre par defaut a
  // l'installation, sans choix de l'utilisateur, et passait outre la
  // reduction des animations du systeme. Une seule fois, a la mise a jour,
  // il redevient Automatique ; un choix fait ensuite est respecte.
  if (details && details.reason === "update" && !stored.animDefautRevu && base.animMode === "always") base.animMode = "auto";
  base.animDefautRevu = true;
  await kvSet(base);
  // Le badge du rattrapage n'existe plus (2026-09-16). Une installation qui
  // en gardait un l'efface, sinon un chiffre resterait pour toujours.
  try { if (api.action && api.action.setBadgeText) api.action.setBadgeText({ text: "" }); } catch (e) { /* noop */ }
  schedule();
  ensureTick();
  schedulePassage();
  bilanPlanifie().catch(() => {});
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
    bilanPlanifie().catch(() => {});
    agendaRefresh({ force: true }).catch(() => {});
  });
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) trigger({ respectMute: true });
  else if (alarm.name === TICK) { accrueScreen(); agendaTick().catch(() => {}); eveningTick().catch(() => {}); mailStatsRefresh().catch(() => {}); }
  else if (alarm.name === ALARM_AGENDA_WARN) agendaWarnFire().catch(() => {});
  else if (alarm.name === ALARM_AGENDA_END) agendaEndFire().catch(() => {});
  else if (alarm.name === ALARM_AGENDA_LAST) agendaLastFire().catch(() => {});
  else if (alarm.name === ALARM_AGENDA_LAST_OUT) agendaLastOutFire().catch(() => {});
  else if (alarm.name === ALARM_BILAN) bilanEnvoie().then((r) => bilanPlanifie(Date.now(), !(r && r.ok))).catch(() => bilanPlanifie(Date.now(), true)).catch(() => {});
  else if (alarm.name === ALARM_PASSAGE) {
    // Le creneau est replanifie quoi qu'il arrive, meme si le passage est refuse.
    triggerPassage().then(schedulePassage, schedulePassage);
  }
});

// Les messages qu'une page (content.js) a le droit d'envoyer. Tout le reste
// (jetons, connexions, reglages, sauvegardes) ne s'accepte que d'une page de
// l'extension (popup).
const PAGE_MESSAGES = ["kz-outcome", "kz-notify-prepare", "kz-notify-send", "kz-open-url", "kz-bubble-closed", "kz-meeting-skip", "kz-meeting-joined", "kz-meeting-finish", "kz-meeting-bar-skip", "kz-meeting-bar-close", "kz-demo-bar"];
function depuisExtension(sender) {
  // Refus par defaut : seule une page de l'extension (adresse sous sa
  // racine) est de confiance.
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
  if (msg.type === "kz-bilan") {
    bilanCalcule(Number(msg.decalage) || 0).then((b) => sendResponse({ ok: true, bilan: b, lignes: bilanTexte(b).lignes }))
      .catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-bilan-state") {
    kvGet(["bilanEnabled", "bilanEmail", "bilanSent", "notifyMailboxUuid"]).then((r) => sendResponse({
      ok: true, enabled: !!r.bilanEnabled, email: String(r.bilanEmail || ""), sent: String(r.bilanSent || ""), mailReady: !!r.notifyMailboxUuid
    })).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-bilan-set") {
    bilanReglage(!!msg.enabled, msg.email).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-bilan-send") {
    bilanEnvoie({ force: true }).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-demo-meeting") {
    // Le mode essai : le popup seul le demande (pas une page), la page au
    // premier plan joue un faux rendez-vous. Rien n'est enregistre.
    targetTab().then((tab) => (tab ? bubbleSendToTab(tab, { type: "kz-demo-meeting" }) : false))
      .then((ok) => sendResponse(ok ? { ok: true } : { ok: false, error: "no_tab" })).catch(() => sendResponse({ ok: false, error: "no_tab" }));
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
    // Les interrupteurs des animaux et du personnage s'enregistrent au clic
    // (2026-10-28) : une sauvegarde qui ne touche qu'eux laisse le rappel a son
    // heure, sinon chaque clic repoussait le prochain rappel d'un intervalle.
    const charge = msg.payload || {};
    const cles = Object.keys(charge);
    const animauxSeuls = cles.length > 0 && cles.every((k) => NO_RHYTHM_KEYS.indexOf(k) >= 0);
    kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn"])
      .then((avant) => kvSet(charge).then(() => (animauxSeuls ? null : schedule())).then(() => schedulePassage()).then(() => agendaAfterSave(charge, avant)))
      .then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-bubble-closed") {
    // Seule la page qui porte la bulle peut la dire fermee. Un rappel
    // d'habitude mis de cote par ce rendez-vous revient alors a l'ecran.
    bubbleGet().then(async (st) => {
      if (!(st && st.id === msg.bubbleId && sender && sender.tab && sender.tab.id === st.tabId)) return;
      await agendaNotifsClear(agendaNotifIdOf(st.payload));
      if (msg.byUser === true) await meetingBarFromBubble(st.payload);
      if (st.parked) { await bubbleWrite(Object.assign({}, st.parked, { perdue: true, parked: null })); await bubbleQueue(); }
      else await bubbleClear(st.id);
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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
    notifyCible(msg, sender).then((c) => (c.ok ? notifySend(Object.assign({}, msg, { id: c.id, start: c.start, depuisPage: !!c.page }), c) : c))
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
  if (msg.type === "kz-meeting-finish" || msg.type === "kz-meeting-bar-skip" || msg.type === "kz-meeting-bar-close") {
    // La barre de reunion : Terminer, N'a pas eu lieu, ou la masquer. Elle
    // ne vise que la reunion de la barre en cours, par son identifiant.
    barCible(msg, sender).then((b) => {
      if (!b) return { ok: false, error: "not_allowed" };
      // La barre du mode essai : elle se comporte comme la vraie, sans rien marquer.
      if (b.essai) return barHide(b.start).then(() => (msg.type === "kz-meeting-finish" ? { ok: true, endedAt: Date.now() } : { ok: true }));
      if (msg.type === "kz-meeting-finish") return meetingFinish(b.id, b.start);
      if (msg.type === "kz-meeting-bar-skip") return meetingSkip(b.id, b.start);
      return barHide(b.start).then(() => ({ ok: true }));
    }).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-demo-bar") {
    // Le mode essai : la fin d'essai fermee pendant le faux rendez-vous. La
    // barre passe par le fond, comme la vraie, pour suivre d'un onglet et
    // d'une fenetre a l'autre.
    barEssai(msg, sender).then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-meeting-joined") {
    // Rejoindre la visio depuis la bulle du debut : l'alerte rouge n'a plus
    // lieu d'etre, ni la notification du debut.
    meetingSkipCible(msg, sender).then((c) => (c.ok ? agendaJoined(c.id, c.start) : c))
      .then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
    return true;
  }
  if (msg.type === "kz-meeting-skip") {
    // N'aura pas lieu (bulle du debut) ou N'a pas eu lieu (bulle de fin).
    meetingSkipCible(msg, sender).then((c) => (c.ok ? meetingSkip(c.id, c.start) : c))
      .then((r) => sendResponse(r)).catch(() => sendResponse({ ok: false, error: "unknown" }));
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
  const cfg = { ...DEFAULTS, ...(await kvGet(["remindersEnabled", "muteInCalls", "mutedPatterns", "pauseWhenIdle", "pausedUntil", "focusMode", "focusSeconds", "intervalMinutes", "habitGoal", "statsDaily", "agendaEnabled", "agendaCache"])) };
  if (!force) {
    // Le bouton "Faire venir le koala" (force) marche toujours, meme eteints.
    if (cfg.remindersEnabled === false) return;
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
  // Une bulle attend deja une reponse : jamais une seconde, celle-la vient
  // dans l'onglet au premier plan.
  if (await bubbleOpen()) { await bubbleQueue(); return; }
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
    streak: streakFrom(stats),
    bubbleId: bubbleNewId()
  };
  try {
    const brut = (await kvGet(["passageState"])).passageState;
    const majPassage = passageStateFrom(brut);
    majPassage.lastReminder = Date.now();
    await kvSet({ passageState: majPassage });
  } catch (e) { /* noop */ }
  // Page non compatible (page interne du navigateur) : rien ne s'affiche.
  if (await bubbleSendToTab(tab, payload)) await bubbleRemember(tab.id, payload);
}
