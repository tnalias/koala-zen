const api = globalThis.browser || globalThis.chrome;
const ALARM = "kz-move";
const IDLE_SECONDS = 60;
const PENDING_MAX = 6;
const SNOOZE_MINUTES = 15;

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
  enabled: true,
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
  statsDaily: {}
};

function pad2(n) { return String(n).padStart(2, "0"); }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

function pruneStats(stats) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const ck = dayKey(cutoff);
  for (const k of Object.keys(stats)) { if (k < ck) delete stats[k]; }
  return stats;
}

async function recordOutcome(result, energy) {
  const r = await api.storage.local.get(["statsDaily", "pending"]);
  const stats = (r.statsDaily && typeof r.statsDaily === "object") ? r.statsDaily : {};
  let pending = Number(r.pending) || 0;
  const k = dayKey();
  const day = stats[k] || { due: 0, done: 0, eSum: 0, eCount: 0 };
  if (day.eSum == null) day.eSum = 0;
  if (day.eCount == null) day.eCount = 0;
  if (result === "done") { day.due += 1; day.done += 1; }
  else if (result === "later" || result === "missed") { day.due += 1; pending = Math.min(PENDING_MAX, pending + 1); }
  else if (result === "catchup") { day.done += 1; pending = Math.max(0, pending - 1); }
  const e = Math.round(Number(energy));
  if ((result === "done" || result === "catchup") && !isNaN(e) && e >= 1 && e <= 10) { day.eSum += e; day.eCount += 1; }
  stats[k] = day;
  pruneStats(stats);
  await api.storage.local.set({ statsDaily: stats, pending: pending });
}

function clampInterval(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(240, Math.max(1, n)); }

async function schedule(delayMin) {
  const stored = await api.storage.local.get(["intervalMinutes", "enabled"]);
  const cfg = { ...DEFAULTS, ...stored };
  await api.alarms.clear(ALARM);
  if (cfg.enabled) {
    const interval = clampInterval(cfg.intervalMinutes);
    const delay = (delayMin != null && delayMin > 0) ? delayMin : interval;
    api.alarms.create(ALARM, { delayInMinutes: delay, periodInMinutes: interval });
  }
}

api.runtime.onInstalled.addListener(async () => {
  const stored = await api.storage.local.get(Object.keys(DEFAULTS));
  await api.storage.local.set({ ...DEFAULTS, ...stored });
  schedule();
});

if (api.runtime.onStartup) { api.runtime.onStartup.addListener(() => schedule()); }

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) trigger({ respectMute: true });
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
  const payload = { type: "kz-show", focus: !!cfg.focusMode, focusSeconds: clampFocus(cfg.focusSeconds) };
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
