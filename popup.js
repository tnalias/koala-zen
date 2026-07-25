const api = globalThis.browser || globalThis.chrome;

const DEFAULT_MUTED = ["kmeet.infomaniak.com", "teams.microsoft.com", "teams.live.com", "zoom.us", "meet.google.com"];
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
  statsDaily: {},
  screenTimezone: "Europe/Zurich"
};

const MAX_KOALAS = 12;
const MAX_DIM = 300;
const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

const $ = (id) => document.getElementById(id);
const $tabSettingsBtn = $("tabSettingsBtn");
const $tabStatsBtn = $("tabStatsBtn");
const $panelSettings = $("panelSettings");
const $panelStats = $("panelStats");
const $quickActions = $("quickActions");
const $snoozeLater = $("snoozeLater");
const $snooze1h = $("snooze1h");
const $snoozeToday = $("snoozeToday");
const $pausedNotice = $("pausedNotice");
const $pausedText = $("pausedText");
const $resumeBtn = $("resumeBtn");
const $catchupRow = $("catchupRow");
const $pendingCount = $("pendingCount");
const $catchupBtn = $("catchupBtn");
const $catchupBox = $("catchupBox");
const $catchupPrompt = $("catchupPrompt");
const $catchupDone = $("catchupDone");
const $enabled = $("enabled");
const $rhythmHint = $("rhythmHint");
const $customWrap = $("customWrap");
const $interval = $("interval");
const $muteCalls = $("muteCalls");
const $mutedList = $("mutedList");
const $pauseIdle = $("pauseIdle");
const $focusMode = $("focusMode");
const $focusSecWrap = $("focusSecWrap");
const $focusSeconds = $("focusSeconds");
const $screenTz = $("screenTz");
const $koalaFile = $("koalaFile");
const $gallery = $("gallery");
const $includeDefault = $("includeDefault");
const $quotesList = $("quotesList");
const $resetQuotes = $("resetQuotes");
const $includeDefaultQuotes = $("includeDefaultQuotes");
const $sportList = $("sportList");
const $resetSport = $("resetSport");
const $now = $("now");
const $save = $("save");
const $saved = $("saved");
const $statPeriod = $("statPeriod");
const $statDone = $("statDone");
const $statOf = $("statOf");
const $statEnergy = $("statEnergy");
const $statEnergyN = $("statEnergyN");
const $statStreak = $("statStreak");
const $yearChart = $("yearChart");
const $energyChart = $("energyChart");

let customKoalas = [];
let STATS = {};
let PENDING = 0;

/* ---------- i18n ---------- */
function msg(key, fallback) {
  try { const m = (api.i18n && api.i18n.getMessage) ? api.i18n.getMessage(key) : ""; return m || fallback || ""; }
  catch (e) { return fallback || ""; }
}
function uiLang() {
  try { return (api.i18n && api.i18n.getUILanguage) ? api.i18n.getUILanguage() : (navigator.language || "en"); }
  catch (e) { return "en"; }
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { const t = msg(el.getAttribute("data-i18n"), ""); if (t) el.textContent = t; });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { const t = msg(el.getAttribute("data-i18n-ph"), ""); if (t) el.setAttribute("placeholder", t); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { const t = msg(el.getAttribute("data-i18n-aria"), ""); if (t) el.setAttribute("aria-label", t); });
  try { const l = uiLang(); if (l) document.documentElement.lang = l; } catch (e) { /* noop */ }
}

/* ---------- storage / messaging ---------- */
function getLocal(keys) {
  return new Promise((res) => {
    try {
      const p = api.storage.local.get(keys);
      if (p && typeof p.then === "function") { p.then(res, () => res({})); }
      else { api.storage.local.get(keys, res); }
    } catch (e) { res({}); }
  });
}
function send(type, extra) {
  const m = Object.assign({ type: type }, extra || {});
  return new Promise((res) => {
    try {
      const p = api.runtime.sendMessage(m);
      if (p && typeof p.then === "function") { p.then(() => res(), () => res()); }
      else { res(); }
    } catch (e) { res(); }
  });
}

/* ---------- helpers ---------- */
function clampInterval(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(240, Math.max(1, n)); }
function clampFocus(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(120, Math.max(5, n)); }
function pad2(n) { return String(n).padStart(2, "0"); }
function linesOf(text) { return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }
function parseQuotes(text) {
  return linesOf(text).map((line) => {
    const i = line.indexOf("|");
    if (i >= 0) return { t: line.slice(0, i).trim(), a: line.slice(i + 1).trim() };
    return { t: line, a: "" };
  }).filter((q) => q.t);
}
function serializeQuotes(arr) { return (arr || []).map((q) => (q.a ? (q.t + " | " + q.a) : q.t)).join("\n"); }
function builtinQuotes() { return (typeof KZ_QUOTES !== "undefined" && Array.isArray(KZ_QUOTES)) ? KZ_QUOTES : []; }
function builtinSport() { return (typeof KZ_SPORT !== "undefined" && Array.isArray(KZ_SPORT)) ? KZ_SPORT : []; }

/* ---------- tabs ---------- */
function showTab(which) {
  const settings = which === "settings";
  $tabSettingsBtn.classList.toggle("tab--on", settings);
  $tabStatsBtn.classList.toggle("tab--on", !settings);
  $panelSettings.hidden = !settings;
  $panelStats.hidden = settings;
  if (!settings) {
    if (!REDUCE_MOTION) { $panelStats.classList.remove("stats-anim"); void $panelStats.offsetWidth; $panelStats.classList.add("stats-anim"); }
    renderStats();
  }
}
$tabSettingsBtn.addEventListener("click", () => showTab("settings"));
$tabStatsBtn.addEventListener("click", () => showTab("stats"));

/* ---------- presets ---------- */
const CANON = { pomodoro: 25, deepwork: 52, ultradian: 90 };
const RATIONALE = { pomodoro: "rationalePomodoro", deepwork: "rationaleDeep", ultradian: "rationaleUltra", custom: "rationaleCustom" };
function selectPreset(preset, minutes) {
  document.querySelectorAll("#presetChips .chip").forEach((c) => c.classList.toggle("chip--on", c.getAttribute("data-preset") === preset));
  $rhythmHint.textContent = msg(RATIONALE[preset] || "rationaleCustom", "");
  $customWrap.hidden = (preset !== "custom");
  if (preset !== "custom" && minutes) $interval.value = String(minutes);
}
document.querySelectorAll("#presetChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const preset = chip.getAttribute("data-preset");
    const min = parseInt(chip.getAttribute("data-min"), 10);
    selectPreset(preset, isNaN(min) ? null : min);
    if (preset === "custom") $interval.focus();
  });
});
function currentPreset() { const on = document.querySelector("#presetChips .chip.chip--on"); return on ? on.getAttribute("data-preset") : "custom"; }

/* ---------- snooze / pause ---------- */
function endOfTodayTs() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
$snoozeLater.addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 15 * 60000 }); await refreshStatus(); });
$snooze1h.addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 60 * 60000 }); await refreshStatus(); });
$snoozeToday.addEventListener("click", async () => { await send("kz-pause", { until: endOfTodayTs() }); await refreshStatus(); });
$resumeBtn.addEventListener("click", async () => { await send("kz-resume"); await refreshStatus(); });

/* ---------- energy picker (popup) ---------- */
function showPopupEnergy(container, onPick) {
  const box = document.createElement("div"); box.className = "kzp-energy";
  const q = document.createElement("div"); q.className = "kzp-energy-q"; q.textContent = msg("energyQ", "Ton énergie, de 1 à 10 ?");
  const row = document.createElement("div"); row.className = "kzp-energy-row";
  let picked = false;
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement("button"); b.type = "button"; b.className = "kzp-energy-btn"; b.textContent = String(i);
    b.addEventListener("click", () => { if (!picked) { picked = true; onPick(i); } });
    row.appendChild(b);
  }
  const skip = document.createElement("button"); skip.type = "button"; skip.className = "kzp-energy-skip"; skip.textContent = msg("energySkip", "Passer");
  skip.addEventListener("click", () => { if (!picked) { picked = true; onPick(null); } });
  box.appendChild(q); box.appendChild(row); box.appendChild(skip);
  container.appendChild(box);
  return box;
}

/* ---------- catch-up ---------- */
function effectiveSport() {
  const custom = linesOf($sportList.value);
  return custom.length ? custom : builtinSport();
}
function pickSport() { const l = effectiveSport(); return l.length ? l[Math.floor(Math.random() * l.length)] : "Bouge un peu !"; }
$catchupBtn.addEventListener("click", () => {
  $catchupPrompt.textContent = pickSport();
  $catchupDone.hidden = false;
  const p = $catchupBox.querySelector(".kzp-energy"); if (p) p.remove();
  $catchupBox.hidden = false;
});
$catchupDone.addEventListener("click", () => {
  $catchupDone.hidden = true;
  showPopupEnergy($catchupBox, async (energy) => {
    await send("kz-catchup", { energy: energy });
    await refreshStatus();
    const p = $catchupBox.querySelector(".kzp-energy"); if (p) p.remove();
    $catchupDone.hidden = false;
    if (PENDING > 0) { $catchupPrompt.textContent = pickSport(); $catchupBox.hidden = false; }
    else { $catchupBox.hidden = true; }
    if (!$panelStats.hidden) renderStats();
  });
});

/* ---------- focus ---------- */
$focusMode.addEventListener("change", () => { $focusSecWrap.hidden = !$focusMode.checked; });

/* ---------- gallery ---------- */
function renderGallery() {
  $gallery.innerHTML = "";
  customKoalas.forEach((url, i) => {
    const t = document.createElement("div"); t.className = "thumb";
    const img = document.createElement("img"); img.src = url; img.alt = "";
    const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "×"; rm.title = msg("removeImg", "Retirer");
    rm.addEventListener("click", () => { customKoalas.splice(i, 1); renderGallery(); });
    t.appendChild(img); t.appendChild(rm); $gallery.appendChild(t);
  });
}
function fileToKoala(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.type === "image/gif") { resolve(dataUrl); return; }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const width = img.width, height = img.height;
        if (width <= MAX_DIM && height <= MAX_DIM) { resolve(dataUrl); return; }
        const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        const w = Math.round(width * scale), h = Math.round(height * scale);
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        try { canvas.getContext("2d").drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL("image/png")); }
        catch (e) { resolve(dataUrl); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
$koalaFile.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    if (customKoalas.length >= MAX_KOALAS) break;
    try { customKoalas.push(await fileToKoala(f)); } catch (_) { /* skip */ }
  }
  $koalaFile.value = "";
  renderGallery();
});
$resetQuotes.addEventListener("click", () => { $quotesList.value = serializeQuotes(builtinQuotes()); });
$resetSport.addEventListener("click", () => { $sportList.value = builtinSport().join("\n"); });

/* ---------- stats ---------- */
function keyOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function atMidnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function monday(d) { const x = atMidnight(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
function dayStat(k) { const v = STATS[k] || {}; return { due: v.due || 0, done: v.done || 0, eSum: v.eSum || 0, eCount: v.eCount || 0 }; }
function emptyAgg() { return { due: 0, done: 0, eSum: 0, eCount: 0 }; }
function addAgg(a, s) { a.due += s.due; a.done += s.done; a.eSum += s.eSum; a.eCount += s.eCount; return a; }
function sumRange(start, end) {
  const agg = emptyAgg();
  let d = atMidnight(start); const last = atMidnight(end); let guard = 0;
  while (d.getTime() <= last.getTime() && guard < 800) { addAgg(agg, dayStat(keyOf(d))); d = addDays(d, 1); guard++; }
  return agg;
}
function aggregateAll() {
  const agg = emptyAgg();
  Object.keys(STATS).forEach((k) => addAgg(agg, dayStat(k)));
  return agg;
}
function periodRange(period) {
  const now = new Date();
  if (period === "yesterday") { const y = addDays(now, -1); return [y, y]; }
  if (period === "thisweek") { const m = monday(now); return [m, addDays(m, 6)]; }
  if (period === "lastweek") { const m = addDays(monday(now), -7); return [m, addDays(m, 6)]; }
  if (period === "thismonth") { return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)]; }
  if (period === "lastmonth") { return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]; }
  return [now, now];
}
function currentStreak() {
  let d = atMidnight(new Date());
  if (dayStat(keyOf(d)).done === 0) d = addDays(d, -1);
  let n = 0, guard = 0;
  while (dayStat(keyOf(d)).done > 0 && guard < 800) { n++; d = addDays(d, -1); guard++; }
  return n;
}
function fmtEnergy(sum, count) { return count > 0 ? (Math.round((sum / count) * 10) / 10) : null; }
function countUp(el, to, decimals) {
  if (REDUCE_MOTION) { el.textContent = decimals ? to.toFixed(decimals) : String(to); return; }
  const dur = 460, start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = to * eased;
    el.textContent = decimals ? v.toFixed(decimals) : String(Math.round(v));
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = decimals ? to.toFixed(decimals) : String(to);
  }
  requestAnimationFrame(tick);
}
function renderStats() {
  const period = $statPeriod.value || "today";
  const agg = (period === "all") ? aggregateAll() : (function () { const r = periodRange(period); return sumRange(r[0], r[1]); })();
  countUp($statDone, agg.done, 0);
  $statOf.textContent = agg.due > 0 ? (msg("statsOfWord", "sur") + " " + agg.due + " " + msg("statsProposedWord", "proposés")) : "";
  const e = fmtEnergy(agg.eSum, agg.eCount);
  if (e == null) { $statEnergy.textContent = "—"; } else { countUp($statEnergy, e, 1); }
  $statEnergyN.textContent = agg.eCount > 0 ? (agg.eCount + " " + msg("statsMeasuresWord", "mesures")) : "";
  $statStreak.textContent = String(currentStreak());
  renderYearCharts();
}
function monthLabel(year, m) {
  let ml; try { ml = new Date(year, m, 1).toLocaleDateString(uiLang(), { month: "short" }); } catch (e) { ml = String(m + 1); }
  return (ml || "").replace(".", "").slice(0, 3);
}
function renderBars(host, values, max, empties) {
  host.innerHTML = "";
  const year = new Date().getFullYear();
  const targets = [];
  for (let m = 0; m < 12; m++) {
    const val = values[m], isEmpty = empties[m];
    const wrap = document.createElement("div"); wrap.className = "bar-wrap";
    const bar = document.createElement("div"); bar.className = "bar" + (isEmpty ? " bar--empty" : "");
    const h = isEmpty ? 2 : Math.max(4, Math.round((val / max) * 84));
    bar.title = isEmpty ? "" : String(val);
    if (REDUCE_MOTION) { bar.style.height = h + "px"; }
    else { bar.style.height = "0px"; bar.style.transitionDelay = (m * 22) + "ms"; targets.push([bar, h]); }
    const lab = document.createElement("div"); lab.className = "bar-label"; lab.textContent = monthLabel(year, m);
    wrap.appendChild(bar); wrap.appendChild(lab); host.appendChild(wrap);
  }
  if (!REDUCE_MOTION && targets.length) {
    requestAnimationFrame(() => requestAnimationFrame(() => { targets.forEach((t) => { t[0].style.height = t[1] + "px"; }); }));
  }
}
function renderYearCharts() {
  const year = new Date().getFullYear();
  const done = [], doneEmpty = [], energy = [], energyEmpty = [];
  for (let m = 0; m < 12; m++) {
    const agg = sumRange(new Date(year, m, 1), new Date(year, m + 1, 0));
    done.push(agg.done); doneEmpty.push(agg.done === 0);
    energy.push(agg.eCount > 0 ? (agg.eSum / agg.eCount) : 0); energyEmpty.push(agg.eCount === 0);
  }
  renderBars($yearChart, done, Math.max(1, Math.max.apply(null, done)), doneEmpty);
  renderBars($energyChart, energy, 10, energyEmpty);
}

/* ---------- status ---------- */
async function refreshStatus() {
  const r = await getLocal(["pausedUntil", "pending"]);
  const until = Number(r.pausedUntil) || 0;
  const paused = until > Date.now();
  $quickActions.hidden = paused;
  $pausedNotice.hidden = !paused;
  if (paused) {
    const t = new Date(until);
    $pausedText.textContent = msg("pausedUntilLabel", "En pause jusqu'à") + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes());
  }
  PENDING = Math.max(0, Number(r.pending) || 0);
  $pendingCount.textContent = String(PENDING);
  $catchupRow.hidden = PENDING <= 0;
  if (PENDING <= 0) $catchupBox.hidden = true;
}

/* ---------- load / save ---------- */
async function load() {
  const r = await getLocal(Object.keys(DEFAULTS));
  const cfg = Object.assign({}, DEFAULTS, r);

  $enabled.checked = cfg.enabled !== false;
  $interval.value = String(clampInterval(cfg.intervalMinutes));
  let preset = cfg.preset || "custom";
  if (preset !== "custom" && CANON[preset] && Number(cfg.intervalMinutes) !== CANON[preset]) preset = "custom";
  selectPreset(preset, CANON[preset] || null);

  $muteCalls.checked = cfg.muteInCalls !== false;
  $mutedList.value = (Array.isArray(cfg.mutedPatterns) ? cfg.mutedPatterns : DEFAULT_MUTED).join("\n");
  $pauseIdle.checked = cfg.pauseWhenIdle !== false;
  $focusMode.checked = !!cfg.focusMode;
  $focusSecWrap.hidden = !$focusMode.checked;
  $focusSeconds.value = String(clampFocus(cfg.focusSeconds));
  const tz = cfg.screenTimezone || "Europe/Zurich";
  if ($screenTz) {
    if (!Array.from($screenTz.options).some((o) => o.value === tz)) {
      const opt = document.createElement("option"); opt.value = tz; opt.textContent = tz; $screenTz.appendChild(opt);
    }
    $screenTz.value = tz;
  }

  customKoalas = Array.isArray(cfg.customKoalas) ? cfg.customKoalas.slice() : [];
  renderGallery();
  $includeDefault.checked = !!cfg.includeDefaultKoalas;
  $quotesList.value = serializeQuotes(cfg.customQuotes);
  $includeDefaultQuotes.checked = !!cfg.includeDefaultQuotes;
  $sportList.value = (Array.isArray(cfg.customSport) ? cfg.customSport : []).join("\n");

  STATS = (cfg.statsDaily && typeof cfg.statsDaily === "object") ? cfg.statsDaily : {};
  await refreshStatus();
}
async function save() {
  const preset = currentPreset();
  const interval = preset === "custom" ? clampInterval($interval.value) : (CANON[preset] || clampInterval($interval.value));
  const payload = {
    enabled: $enabled.checked,
    intervalMinutes: interval,
    preset: preset,
    muteInCalls: $muteCalls.checked,
    mutedPatterns: linesOf($mutedList.value),
    pauseWhenIdle: $pauseIdle.checked,
    focusMode: $focusMode.checked,
    focusSeconds: clampFocus($focusSeconds.value),
    customKoalas: customKoalas,
    includeDefaultKoalas: $includeDefault.checked,
    customQuotes: parseQuotes($quotesList.value),
    includeDefaultQuotes: $includeDefaultQuotes.checked,
    customSport: linesOf($sportList.value),
    screenTimezone: ($screenTz && $screenTz.value) ? $screenTz.value : "Europe/Zurich"
  };
  await send("kz-save", { payload: payload });
  $saved.classList.add("show");
  setTimeout(() => $saved.classList.remove("show"), 1600);
}
$save.addEventListener("click", save);
$now.addEventListener("click", () => { send("kz-trigger-now"); });
$statPeriod.addEventListener("change", renderStats);

/* ---------- init ---------- */
applyI18n();
showTab("settings");
load();
