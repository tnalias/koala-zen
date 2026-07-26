const api = globalThis.browser || globalThis.chrome;

const DEFAULT_MUTED = ["kmeet.infomaniak.com", "teams.microsoft.com", "teams.live.com", "zoom.us", "meet.google.com"];
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
  screenDaily: {},
  screenTimezone: "Europe/Zurich",
  animMode: "auto"
};

const MAX_KOALAS = 12;
const MAX_DIM = 300;
// Date de la derniere mise a jour, a actualiser a chaque release en meme temps que la version.
const KZ_BUILD_DATE = "2026-07-26";
let REDUCE_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function systemReducedMotion() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function applyAnimMode(mode) {
  const animate = (mode === "always") ? true : (mode === "never") ? false : !systemReducedMotion();
  REDUCE_MOTION = !animate;
  document.documentElement.classList.toggle("anim-on", animate);
  document.documentElement.classList.toggle("anim-off", !animate);
}

const $ = (id) => document.getElementById(id);
const $tabSettingsBtn = $("tabSettingsBtn");
const $tabPersoBtn = $("tabPersoBtn");
const $tabStatsBtn = $("tabStatsBtn");
const $panelSettings = $("panelSettings");
const $panelPerso = $("panelPerso");
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
const $savePerso = $("savePerso");
const $savedPerso = $("savedPerso");
const $statPeriod = $("statPeriod");
const $statDone = $("statDone");
const $statOf = $("statOf");
const $statRep = $("statRep");
const $statRepOf = $("statRepOf");
const $statEnergy = $("statEnergy");
const $statEnergyN = $("statEnergyN");
const $statStreak = $("statStreak");
const $statRecord = $("statRecord");
const $statScreen = $("statScreen");
const $statScreenSub = $("statScreenSub");
const $cadenceLine = $("cadenceLine");
const $cadenceText = $("cadenceText");
const $trendWrap = $("trendWrap");
const $trendChart = $("trendChart");
const $screenChart = $("screenChart");
const $trendNote = $("trendNote");
const $streakFill = $("streakFill");
const $streakGoal = $("streakGoal");
const $benefitTitle = $("benefitTitle");
const $corrWrap = $("corrWrap");
const $corrChart = $("corrChart");
const $corrVerdict = $("corrVerdict");
const $corrNote = $("corrNote");
const $animMode = $("animMode");
const $resetData = $("resetData");
const $dataCleared = $("dataCleared");
const $versionLine = $("versionLine");

let customKoalas = [];
let STATS = {};
let SCREEN = {};
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

function manifestVersion() {
  try { return (api.runtime && api.runtime.getManifest && api.runtime.getManifest().version) || ""; }
  catch (e) { return ""; }
}
function fmtBuildDate(iso) {
  try {
    const p = String(iso).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(uiLang(), { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) { return String(iso); }
}
function setVersionLine() {
  if (!$versionLine) return;
  const v = manifestVersion();
  $versionLine.textContent = (v ? "v" + v : "") + (v && KZ_BUILD_DATE ? " · " : "") + (KZ_BUILD_DATE ? fmtBuildDate(KZ_BUILD_DATE) : "");
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
  const isSettings = which === "settings";
  const isPerso = which === "perso";
  const isStats = which === "stats";
  $tabSettingsBtn.classList.toggle("tab--on", isSettings);
  $tabPersoBtn.classList.toggle("tab--on", isPerso);
  $tabStatsBtn.classList.toggle("tab--on", isStats);
  $panelSettings.hidden = !isSettings;
  $panelPerso.hidden = !isPerso;
  $panelStats.hidden = !isStats;
  if (isStats) {
    if (!REDUCE_MOTION) { $panelStats.classList.remove("stats-anim"); void $panelStats.offsetWidth; $panelStats.classList.add("stats-anim"); }
    renderStats();
  }
}
$tabSettingsBtn.addEventListener("click", () => showTab("settings"));
$tabPersoBtn.addEventListener("click", () => showTab("perso"));
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
function dayStat(k) { const v = STATS[k] || {}; return { due: v.due || 0, done: v.done || 0, rep: v.rep || 0, eSum: v.eSum || 0, eCount: v.eCount || 0 }; }
function emptyAgg() { return { due: 0, done: 0, rep: 0, eSum: 0, eCount: 0 }; }
function addAgg(a, s) { a.due += s.due; a.done += s.done; a.rep += s.rep; a.eSum += s.eSum; a.eCount += s.eCount; return a; }
function sumRange(start, end) {
  const agg = emptyAgg();
  let d = atMidnight(start); const last = atMidnight(end); let guard = 0;
  while (d.getTime() <= last.getTime() && guard < 4000) { addAgg(agg, dayStat(keyOf(d))); d = addDays(d, 1); guard++; }
  return agg;
}
function parseKey(k) { const p = k.split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function periodRange(period) {
  const now = new Date();
  if (period === "yesterday") { const y = addDays(now, -1); return [y, y]; }
  if (period === "thisweek") { const m = monday(now); return [m, addDays(m, 6)]; }
  if (period === "lastweek") { const m = addDays(monday(now), -7); return [m, addDays(m, 6)]; }
  if (period === "thismonth") { return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)]; }
  if (period === "lastmonth") { return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]; }
  if (period === "all") { const keys = Object.keys(STATS).sort(); const start = keys.length ? parseKey(keys[0]) : now; return [start, now]; }
  return [now, now];
}
function currentStreak() {
  let d = atMidnight(new Date());
  if (dayStat(keyOf(d)).done === 0) d = addDays(d, -1);
  let n = 0, guard = 0;
  while (dayStat(keyOf(d)).done > 0 && guard < 4000) { n++; d = addDays(d, -1); guard++; }
  return n;
}
function longestStreak() {
  const keys = Object.keys(STATS).filter((k) => dayStat(k).done > 0).sort();
  if (!keys.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < keys.length; i++) {
    const diff = Math.round((atMidnight(parseKey(keys[i])).getTime() - atMidnight(parseKey(keys[i - 1])).getTime()) / 86400000);
    cur = (diff === 1) ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}
function fmtEnergy(sum, count) { return count > 0 ? (Math.round((sum / count) * 10) / 10) : null; }
function screenSecRange(start, end) {
  let sec = 0, d = atMidnight(start); const last = atMidnight(end); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) { sec += Math.max(0, Number(SCREEN[keyOf(d)]) || 0); d = addDays(d, 1); g++; }
  return sec;
}
function fmtDurShort(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h > 0) return h + msg("unitHour", "h") + pad2(m);
  return m + " " + msg("unitMin", "min");
}
function fmtDurLong(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h > 0 && m > 0) return h + " " + msg("unitHour", "h") + " " + pad2(m);
  if (h > 0) return h + " " + msg("unitHour", "h");
  return m + " " + msg("unitMin", "min");
}
function setScreenTile(el, sec) {
  sec = Math.max(0, Math.round(sec));
  el.textContent = "";
  if (sec <= 0) { el.textContent = "—"; return; }
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h > 0) {
    el.appendChild(document.createTextNode(String(h)));
    const u = document.createElement("span"); u.className = "u"; u.textContent = msg("unitHour", "h"); el.appendChild(u);
    el.appendChild(document.createTextNode(pad2(m)));
  } else {
    el.appendChild(document.createTextNode(String(m)));
    const u = document.createElement("span"); u.className = "u"; u.textContent = msg("unitMin", "min"); el.appendChild(u);
  }
}
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
function monthLabel(year, m) {
  let ml; try { ml = new Date(year, m, 1).toLocaleDateString(uiLang(), { month: "short" }); } catch (e) { ml = String(m + 1); }
  return (ml || "").replace(".", "").slice(0, 3);
}
function weekdayLetter(d) { try { return d.toLocaleDateString(uiLang(), { weekday: "short" }).charAt(0).toUpperCase(); } catch (e) { return ""; } }

function renderStats() {
  const period = $statPeriod.value || "today";
  const range = periodRange(period);
  const agg = sumRange(range[0], range[1]);
  countUp($statDone, agg.done, 0);
  countUp($statRep, agg.rep, 0);
  const ofTxt = agg.due > 0 ? (msg("statsOfWord", "sur") + " " + agg.due) : "";
  $statOf.textContent = ofTxt;
  $statRepOf.textContent = ofTxt;
  const e = fmtEnergy(agg.eSum, agg.eCount);
  if (e == null) { $statEnergy.textContent = "—"; } else { countUp($statEnergy, e, 1); }
  $statEnergyN.textContent = agg.eCount > 0 ? (agg.eCount + " " + msg("statsMeasuresWord", "mesures")) : "";
  const scr = screenSecRange(range[0], range[1]);
  setScreenTile($statScreen, scr);
  $statScreenSub.textContent = "";
  // Cadence: une habitude faite pour tant de temps d'ecran
  if (agg.done > 0 && scr >= 600) {
    $cadenceText.textContent = msg("statsCadence", "1 habitude toutes les {d} d'écran").replace("{d}", fmtDurLong(scr / agg.done));
    $cadenceLine.hidden = false;
  } else {
    $cadenceLine.hidden = true;
  }
  renderTrend(period, range);
  renderOverview();
}

function rangeDays(range) { return Math.round((atMidnight(range[1]).getTime() - atMidnight(range[0]).getTime()) / 86400000) + 1; }
function dayBuckets(range) {
  const out = []; const days = rangeDays(range);
  let d = atMidnight(range[0]); const last = atMidnight(range[1]); let g = 0;
  while (d.getTime() <= last.getTime() && g < 400) {
    const s = dayStat(keyOf(d));
    const dom = d.getDate();
    const label = (days <= 7) ? weekdayLetter(d) : ((dom === 1 || dom % 5 === 1) ? String(dom) : "");
    out.push({ done: s.done, rep: s.rep, scr: (Number(SCREEN[keyOf(d)]) || 0), label: label });
    d = addDays(d, 1); g++;
  }
  return out;
}
function monthBuckets(range) {
  const end = atMidnight(range[1]);
  const total = (end.getFullYear() - range[0].getFullYear()) * 12 + (end.getMonth() - range[0].getMonth()) + 1;
  const n = Math.min(12, Math.max(1, total));
  let y = end.getFullYear(), m = end.getMonth() - (n - 1);
  while (m < 0) { m += 12; y -= 1; }
  const out = [];
  for (let i = 0; i < n; i++) {
    const agg = sumRange(new Date(y, m, 1), new Date(y, m + 1, 0));
    const scr = screenSecRange(new Date(y, m, 1), new Date(y, m + 1, 0));
    out.push({ done: agg.done, rep: agg.rep, scr: scr, label: monthLabel(y, m) });
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}
function renderTrend(period, range) {
  const single = (period === "today" || period === "yesterday");
  if (single) { $trendWrap.hidden = true; $trendNote.hidden = false; return; }
  $trendWrap.hidden = false; $trendNote.hidden = true;
  const days = rangeDays(range);
  const buckets = (period === "all" || days > 45) ? monthBuckets(range) : dayBuckets(range);
  const maxTotal = Math.max(1, Math.max.apply(null, buckets.map((b) => b.done + b.rep)));
  renderStackBars($trendChart, buckets, maxTotal);
  const maxScr = Math.max(1, Math.max.apply(null, buckets.map((b) => b.scr)));
  renderScreenBars($screenChart, buckets, maxScr);
}
function animateIn(nodes) {
  if (REDUCE_MOTION || !nodes.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { nodes.forEach((n) => { n.style.transform = "scaleY(1)"; }); }));
}
function renderStackBars(host, buckets, maxTotal) {
  host.innerHTML = "";
  const targets = [];
  buckets.forEach((b, i) => {
    const wrap = document.createElement("div"); wrap.className = "bar-wrap";
    const total = b.done + b.rep;
    const col = document.createElement("div"); col.className = "stackcol" + (total === 0 ? " stackcol--empty" : "");
    col.style.height = (total === 0 ? 3 : Math.max(4, Math.round((total / maxTotal) * 58))) + "px";
    col.title = total === 0 ? "" : (b.done + " / " + b.rep);
    if (total > 0) {
      const rep = document.createElement("div"); rep.className = "seg seg--rep"; rep.style.height = Math.round((b.rep / total) * 100) + "%";
      const done = document.createElement("div"); done.className = "seg seg--done"; done.style.height = Math.round((b.done / total) * 100) + "%";
      col.appendChild(rep); col.appendChild(done);
    }
    if (!REDUCE_MOTION) { col.style.transform = "scaleY(0)"; col.style.transitionDelay = (i * 20) + "ms"; targets.push(col); }
    const lab = document.createElement("div"); lab.className = "bar-label"; lab.textContent = b.label || "";
    wrap.appendChild(col); wrap.appendChild(lab); host.appendChild(wrap);
  });
  animateIn(targets);
}
function renderScreenBars(host, buckets, maxScr) {
  host.innerHTML = "";
  const targets = [];
  buckets.forEach((b, i) => {
    const empty = b.scr <= 0;
    const wrap = document.createElement("div"); wrap.className = "bar-wrap";
    const bar = document.createElement("div"); bar.className = "bar" + (empty ? " bar--empty" : "");
    bar.style.height = (empty ? 3 : Math.max(4, Math.round((b.scr / maxScr) * 44))) + "px";
    bar.title = empty ? "" : fmtDurShort(b.scr);
    if (!REDUCE_MOTION) { bar.style.transform = "scaleY(0)"; bar.style.transitionDelay = (i * 18) + "ms"; targets.push(bar); }
    const lab = document.createElement("div"); lab.className = "bar-label"; lab.textContent = b.label || "";
    wrap.appendChild(bar); wrap.appendChild(lab); host.appendChild(wrap);
  });
  animateIn(targets);
}

var CORR_MIN = 7;
function renderOverview() {
  renderStreak();
  renderBenefit();
}
function renderStreak() {
  const cur = currentStreak();
  const rec = longestStreak();
  $statStreak.textContent = String(cur);
  $statRecord.textContent = String(rec);
  const pct = rec > 0 ? Math.min(1, cur / rec) : 0;
  if (REDUCE_MOTION) { $streakFill.style.transform = "scaleX(" + pct + ")"; }
  else { $streakFill.style.transform = "scaleX(0)"; requestAnimationFrame(() => requestAnimationFrame(() => { $streakFill.style.transform = "scaleX(" + pct + ")"; })); }
  let goal;
  if (rec === 0) goal = msg("statsStreakFirst", "Fais une habitude pour lancer ta série.");
  else if (cur === 0) goal = msg("statsStreakResume", "Reprends ta série aujourd'hui.");
  else if (cur >= rec) goal = msg("statsStreakAtRecord", "Tu es à ton record, continue !");
  else { const left = rec - cur + 1; goal = msg("statsStreakGoal", "Encore {n} jours pour battre ton record 🎉").replace("{n}", left); }
  $streakGoal.textContent = goal;
}
function renderBenefit() {
  // Correlation energie selon le nombre d'habitudes faites dans la journee
  const buckets = [{ s: 0, n: 0 }, { s: 0, n: 0 }, { s: 0, n: 0 }];
  let qualifying = 0;
  Object.keys(STATS).forEach((k) => {
    const s = dayStat(k);
    if (s.eCount > 0) {
      qualifying++;
      const avg = s.eSum / s.eCount;
      const bi = s.done <= 1 ? 0 : (s.done <= 3 ? 1 : 2);
      buckets[bi].s += avg; buckets[bi].n++;
    }
  });
  if (qualifying < CORR_MIN) {
    $corrWrap.hidden = true; $corrNote.hidden = false;
    $benefitTitle.textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    return;
  }
  $corrWrap.hidden = false; $corrNote.hidden = true;
  const vals = buckets.map((b) => (b.n > 0 ? (b.s / b.n) : null));
  renderCorrBars($corrChart, vals);
  applyBenefitText(vals);
}
function applyBenefitText(vals) {
  let lo = null, hi = null;
  for (let i = 0; i < vals.length; i++) { if (vals[i] != null) { if (lo == null) lo = { i: i, v: vals[i] }; hi = { i: i, v: vals[i] }; } }
  if (lo == null || hi == null || lo.i === hi.i) {
    $benefitTitle.textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $corrVerdict.textContent = msg("statsBenefitFlat", "Continue à noter pour voir le lien se dessiner.");
    return;
  }
  const diff = Math.round((hi.v - lo.v) * 10) / 10;
  if (diff >= 0.5) {
    $benefitTitle.textContent = msg("statsBenefitUp", "Ton habitude te donne de l'énergie");
    $corrVerdict.textContent = msg("statsBenefitUpText", "Les jours où tu t'y tiens le plus : +{n} d'énergie").replace("{n}", diff.toFixed(1));
  } else if (diff <= -0.5) {
    $benefitTitle.textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $corrVerdict.textContent = msg("statsBenefitDownText", "Les jours où tu t'y tiens le plus, ton énergie est plus basse ({n}).").replace("{n}", diff.toFixed(1));
  } else {
    $benefitTitle.textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $corrVerdict.textContent = msg("statsBenefitNone", "Pas de lien net entre ton habitude et ton énergie.");
  }
}
function renderCorrBars(host, vals) {
  host.innerHTML = "";
  const labels = [msg("statsBenefitB1", "rarement"), msg("statsBenefitB2", "parfois"), msg("statsBenefitB3", "souvent")];
  const targets = [];
  vals.forEach((v, i) => {
    const wrap = document.createElement("div"); wrap.className = "corr-wrap";
    const valEl = document.createElement("div"); valEl.className = "corr-val"; valEl.textContent = (v == null) ? "—" : (Math.round(v * 10) / 10).toFixed(1);
    const bar = document.createElement("div"); bar.className = "corr-bar" + (v == null ? " corr-bar--empty" : "");
    bar.style.height = (v == null ? 4 : Math.max(6, Math.round((v / 10) * 68))) + "px";
    if (!REDUCE_MOTION) { bar.style.transform = "scaleY(0)"; bar.style.transitionDelay = (i * 90) + "ms"; targets.push(bar); }
    const lab = document.createElement("div"); lab.className = "corr-lab"; lab.textContent = labels[i];
    wrap.appendChild(valEl); wrap.appendChild(bar); wrap.appendChild(lab); host.appendChild(wrap);
  });
  animateIn(targets);
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
  SCREEN = (cfg.screenDaily && typeof cfg.screenDaily === "object") ? cfg.screenDaily : {};
  const am = (cfg.animMode === "always" || cfg.animMode === "never") ? cfg.animMode : "auto";
  if ($animMode) $animMode.value = am;
  applyAnimMode(am);
  await refreshStatus();
}
async function save() {
  const preset = currentPreset();
  const interval = preset === "custom" ? clampInterval($interval.value) : (CANON[preset] || clampInterval($interval.value));
  const payload = {
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
    screenTimezone: ($screenTz && $screenTz.value) ? $screenTz.value : "Europe/Zurich",
    animMode: ($animMode && $animMode.value) ? $animMode.value : "auto"
  };
  applyAnimMode(payload.animMode);
  await send("kz-save", { payload: payload });
  const savedEl = (!$panelPerso.hidden && $savedPerso) ? $savedPerso : $saved;
  savedEl.classList.add("show");
  setTimeout(() => savedEl.classList.remove("show"), 1600);
}
$save.addEventListener("click", save);
if ($savePerso) $savePerso.addEventListener("click", save);
$now.addEventListener("click", () => { send("kz-trigger-now"); });
$statPeriod.addEventListener("change", renderStats);
if ($animMode) $animMode.addEventListener("change", () => applyAnimMode($animMode.value));

let resetArmed = false, resetTimer = 0;
function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  $resetData.classList.remove("btn-danger--confirm");
  $resetData.textContent = msg("resetData", "Effacer toutes les données");
}
if ($resetData) {
  $resetData.addEventListener("click", async () => {
    if (!resetArmed) {
      resetArmed = true;
      $resetData.classList.add("btn-danger--confirm");
      $resetData.textContent = msg("resetDataConfirm", "Confirmer, c'est définitif");
      resetTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    await send("kz-reset");
    STATS = {}; SCREEN = {}; PENDING = 0;
    $dataCleared.classList.add("show");
    setTimeout(() => $dataCleared.classList.remove("show"), 1800);
    await refreshStatus();
    if (!$panelStats.hidden) renderStats();
  });
}

/* ---------- init ---------- */
applyI18n();
setVersionLine();
showTab("settings");
load();
