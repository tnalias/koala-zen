const api = globalThis.browser || globalThis.chrome;
const ALARM = "kz-move";
const IDLE_SECONDS = 60;
const PENDING_MAX = 6;
const SNOOZE_MINUTES = 15;
const TICK = "kz-tick";
const TICK_MINUTES = 1;
const TICK_MAX_GAP_MS = 130000;
const DEFAULT_TZ = "Europe/Zurich";

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
  pausedUntil: 0,
  pending: 0,
  statsDaily: {},
  screenTimezone: DEFAULT_TZ,
  screenDaily: {},
  screenLastTick: 0
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

async function recordOutcome(result, energy) {
  const r = await api.storage.local.get(["statsDaily", "pending"]);
  const stats = (r.statsDaily && typeof r.statsDaily === "object") ? r.statsDaily : {};
  let pending = Number(r.pending) || 0;
  const k = dayKey();
  const day = stats[k] || { due: 0, done: 0, rep: 0, eSum: 0, eCount: 0 };
  if (day.eSum == null) day.eSum = 0;
  if (day.eCount == null) day.eCount = 0;
  if (day.rep == null) day.rep = 0;
  if (result === "done") { day.due += 1; day.done += 1; }
  else if (result === "later" || result === "missed") { day.due += 1; day.rep += 1; pending = Math.min(PENDING_MAX, pending + 1); }
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

api.runtime.onInstalled.addListener(async () => {
  const stored = await api.storage.local.get(Object.keys(DEFAULTS));
  await api.storage.local.set({ ...DEFAULTS, ...stored, screenLastTick: Date.now() });
  schedule();
  ensureTick();
});

if (api.runtime.onStartup) {
  api.runtime.onStartup.addListener(async () => {
    await api.storage.local.set({ screenLastTick: Date.now() });
    schedule();
    ensureTick();
  });
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) trigger({ respectMute: true });
  else if (alarm.name === TICK) accrueScreen();
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "kz-trigger-now") {
    trigger({ force: true }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "kz-save") {
    api.storage.local.set(msg.payload || {}).then(() => schedule()).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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
  if (msg.type === "kz-reset") {
    // Efface l'historique (statistiques et temps d'ecran) et remet le rattrapage a zero.
    // Les reglages, koalas et pensees sont conserves.
    api.storage.local.set({ statsDaily: {}, screenDaily: {}, pending: 0, screenLastTick: 0 }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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
  const cfg = { ...DEFAULTS, ...(await api.storage.local.get(["muteInCalls", "mutedPatterns", "pauseWhenIdle", "pausedUntil", "focusMode", "focusSeconds"])) };
  if (!force) {
    if (cfg.pausedUntil && Date.now() < cfg.pausedUntil) return;
    if (cfg.pauseWhenIdle && (await isIdle())) return;
  }
  const tab = await targetTab();
  if (!tab) return;
  if (!force && respectMute && cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns)) return;
  await accrueScreen();
  const screenToday = await screenTodaySeconds();
  const payload = { type: "kz-show", focus: !!cfg.focusMode, focusSeconds: clampFocus(cfg.focusSeconds), screenToday: screenToday };
  try {
    await api.tabs.sendMessage(tab.id, payload);
  } catch (e) {
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["quotes.js", "content.js"] });
      await api.tabs.sendMessage(tab.id, payload);
    } catch (_) { /* page non compatible (ex : page interne du navigateur) */ }
  }
}

function clampFocus(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(120, Math.max(5, n)); }

async function targetTab() {
  try {
    const [t] = await api.tabs.query({ active: true, lastFocusedWindow: true });
    if (t && /^https?:/.test(t.url || "")) return t;
  } catch (e) { /* noop */ }
  try {
    const tabs = await api.tabs.query({ url: ["http://*/*", "https://*/*"] });
    return tabs.find((t) => t.active) || tabs[0] || null;
  } catch (e) { return null; }
}
