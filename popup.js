const api = globalThis.browser || globalThis.chrome;

const DEFAULT_MUTED = ["kmeet.infomaniak.com", "teams.microsoft.com", "teams.live.com", "zoom.us", "meet.google.com"];

const SETTINGS_KEYS = ["intervalMinutes", "preset", "customInterval", "passages", "passageFrequency", "muteInCalls", "mutedPatterns", "pauseWhenIdle", "focusMode", "focusSeconds", "screenTimezone", "animMode"];
const CONTENT_KEYS = ["customQuotes", "customSport", "includeDefaultQuotes", "hiddenQuotes", "habitGoal"];
const STATS_KEYS = ["statsDaily", "screenDaily", "pending"];
const KOALA_KEYS = ["customKoalas", "includeDefaultKoalas"];

const DEFAULTS = {
  intervalMinutes: 30,
  preset: "custom",
  customInterval: 45,
  muteInCalls: true,
  mutedPatterns: DEFAULT_MUTED,
  pauseWhenIdle: true,
  focusMode: false,
  focusSeconds: 30,
  screenTimezone: "Europe/Zurich",
  animMode: "always",
  passages: true,
  passageFrequency: "normal",
  customKoalas: [],
  includeDefaultKoalas: false,
  customQuotes: [],
  customSport: [],
  includeDefaultQuotes: false,
  hiddenQuotes: [],
  habitGoal: 3,
  sportIndex: 0,
  importMode: "merge",
  statsRange: "week",
  statsOffset: 0,
  firstRun: true,
  pausedUntil: 0,
  pending: 0,
  statsDaily: {},
  screenDaily: {}
};

const ALARM = "kz-move";
const MAX_KOALAS = 18;
const MAX_DIM = 300;
const CORR_MIN = 7;
const BROWSE_PAGE = 40;
// Date de la derniere mise a jour, a actualiser a chaque release en meme temps que la version.
const KZ_BUILD_DATE = "2026-07-30";

function koalaSvg(size, variant) {
  const eyes = (variant === "sleepy")
    ? '<path d="M20 30 q4 -3 8 0" stroke="#3A3F43" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M36 30 q4 -3 8 0" stroke="#3A3F43" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    : '<circle class="kz-eye-l" cx="24" cy="30" r="2.6" fill="#3A3F43"/><circle class="kz-eye-r" cx="40" cy="30" r="2.6" fill="#3A3F43"/>';
  return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true"'
    + (variant === "sway" ? ' class="kz-sway"' : '') + '>'
    + '<circle class="kz-ear-l" cx="13" cy="21" r="10" fill="#9AA5AE"/><circle cx="13" cy="21" r="5.4" fill="#EFC3AC"/>'
    + '<circle class="kz-ear-r" cx="51" cy="21" r="10" fill="#9AA5AE"/><circle cx="51" cy="21" r="5.4" fill="#EFC3AC"/>'
    + '<circle cx="32" cy="34" r="20" fill="#B9C2C9"/>'
    + '<ellipse cx="18" cy="39" rx="4.2" ry="2.8" fill="#F2B48D"/><ellipse cx="46" cy="39" rx="4.2" ry="2.8" fill="#F2B48D"/>'
    + eyes
    + '<ellipse cx="32" cy="39" rx="7.5" ry="8.5" fill="#3A3F43"/></svg>';
}

let REDUCE_MOTION = false;
function systemReducedMotion() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function applyAnimMode(mode) {
  const animate = (mode === "always") ? true : (mode === "never") ? false : !systemReducedMotion();
  REDUCE_MOTION = !animate;
  document.documentElement.classList.toggle("anim-on", animate);
  document.documentElement.classList.toggle("anim-off", !animate);
}

const $ = (id) => document.getElementById(id);

/* ---------- etat en memoire ---------- */
let CFG = Object.assign({}, DEFAULTS);
let STATS = {};
let SCREEN = {};
let PENDING = 0;
let customKoalas = [];
let customSport = [];
let customQuotes = [];
let hiddenQuotes = [];
let mutedPatterns = DEFAULT_MUTED.slice();
let mutedExpanded = false;
let customMinutes = 30;
let currentPresetName = "custom";
let quoteSeg = "mine";
let browseSeg = "all";
let browseQuery = "";
let browseLimit = BROWSE_PAGE;
let editingQuote = null;
let exportParts = { settings: true, content: true, stats: true, koalas: true };
let importMode = "merge";
let currentTab = "settings";

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

/* ---------- utilitaires DOM ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
// Les SVG decoratifs du popup sont NOS propres chaines, jamais du contenu de
// page. Le chemin DOMParser plus importNode ne dessinait rien dans certains
// moteurs, ce qui laissait la pastille de l'en-tete, la vignette de personnage
// par defaut et le koala de l'ecran vide entierement vides. 2026-08-04, le
// puits "innerHTML" signale par le linter des extensions (et son remplacant
// Range.createContextualFragment, egalement signale) sont retires : on
// reconstruit le noeud racine noeud par noeud avec createElementNS et
// setAttribute, jamais d'assignation d'une chaine dans le DOM. DOMParser ne
// fait que LIRE une chaine comme un arbre de donnees ; le noeud etranger
// qu'il produit n'est jamais insere tel quel (pas d'importNode), ce qui evite
// a la fois le puits signale et le bug de rendu ci-dessus. Meme rendu verifie
// cote a cote contre les autres approches.
function rebuildSvgNode(foreign, doc) {
  if (foreign.nodeType === Node.TEXT_NODE) return doc.createTextNode(foreign.nodeValue);
  if (foreign.nodeType !== Node.ELEMENT_NODE) return null;
  const ns = foreign.namespaceURI || "http://www.w3.org/2000/svg";
  const n = doc.createElementNS(ns, foreign.localName || foreign.tagName);
  for (let i = 0; i < foreign.attributes.length; i++) {
    const a = foreign.attributes[i];
    n.setAttribute(a.name, a.value);
  }
  for (let j = 0; j < foreign.childNodes.length; j++) {
    const child = rebuildSvgNode(foreign.childNodes[j], doc);
    if (child) n.appendChild(child);
  }
  return n;
}
function svgNode(markup) {
  try {
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = parsed.documentElement;
    if (!root || root.nodeName === "parsererror") return null;
    return rebuildSvgNode(root, document);
  } catch (e) { return null; }
}
function poseSvg(host, markup) {
  if (!host) return false;
  try {
    clear(host);
    const n = svgNode(markup);
    if (!n) return false;
    host.appendChild(n);
    return !!host.firstChild;
  } catch (e) { return false; }
}

/* ---------- stockage et messages ---------- */
function getLocal(keys) {
  return new Promise((res) => {
    try {
      const p = api.storage.local.get(keys);
      if (p && typeof p.then === "function") { p.then(res, () => res({})); }
      else { api.storage.local.get(keys, res); }
    } catch (e) { res({}); }
  });
}
function setLocal(obj) {
  return new Promise((res) => {
    try {
      const p = api.storage.local.set(obj);
      if (p && typeof p.then === "function") { p.then(() => res(), () => res()); }
      else { api.storage.local.set(obj, () => res()); }
    } catch (e) { res(); }
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
function getAlarm(name) {
  return new Promise((res) => {
    try {
      const p = api.alarms.get(name);
      if (p && typeof p.then === "function") { p.then(res, () => res(null)); }
      else { api.alarms.get(name, res); }
    } catch (e) { res(null); }
  });
}

/* ---------- formats ---------- */
function clampInt(v, lo, hi, dflt) { const n = parseInt(v, 10); return isNaN(n) ? dflt : Math.min(hi, Math.max(lo, n)); }
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtMinutes(n) { return n + " " + msg("unitMin", "min"); }
function fmtDurShort(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h > 0) return h + " " + msg("unitHour", "h") + " " + pad2(m);
  return m + " " + msg("unitMin", "min");
}
function fmtDurTile(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h > 0) return h + " " + msg("unitHour", "h");
  return m + " " + msg("unitMin", "min");
}
function fmtBytes(n) {
  if (n < 1024) return n + " " + msg("unitByte", "o");
  if (n < 1024 * 1024) return Math.round(n / 1024) + " " + msg("unitKb", "Ko");
  return (Math.round(n / 1024 / 102.4) / 10).toLocaleString(uiLang()) + " " + msg("unitMb", "Mo");
}
function byteSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(value == null ? null : value)).length; }
  catch (e) { return String(JSON.stringify(value || "")).length; }
}
function fmtNum(n, dec) { try { return Number(n).toLocaleString(uiLang(), { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); } catch (e) { return String(n); } }

/* ---------- dates ---------- */
function keyOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function atMidnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function monday(d) { const x = atMidnight(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
function parseKey(k) { const p = String(k).split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function weekdayLetter(d) { try { const s = d.toLocaleDateString(uiLang(), { weekday: "short" }); return s.charAt(0).toUpperCase() + s.slice(1, 3).replace(".", ""); } catch (e) { return ""; } }
function monthLabel(year, m) {
  let s; try { s = new Date(year, m, 1).toLocaleDateString(uiLang(), { month: "short" }); } catch (e) { s = String(m + 1); }
  return (s || "").replace(".", "").slice(0, 3);
}

/* ---------- en-tete ---------- */
function fillHeadMark() {
  poseSvg($("headMark"), koalaSvg(26));
  poseSvg($("blankKoala"), koalaSvg(52, "sway"));
}
// L'onglet actif est-il un domaine de visio ? La liste vient des reglages, il
// n'y a aucune detection materielle, voir la decision 5 du handoff.
async function ongletEnVisio() {
  try {
    const r = await getLocal(["muteInCalls", "mutedPatterns"]);
    if (!r.muteInCalls) return false;
    const pats = Array.isArray(r.mutedPatterns) ? r.mutedPatterns : [];
    if (!pats.length) return false;
    const tabs = await new Promise((res) => {
      try {
        const q = api.tabs.query({ active: true, currentWindow: true });
        if (q && typeof q.then === "function") { q.then(res, () => res([])); }
        else { api.tabs.query({ active: true, currentWindow: true }, res); }
      } catch (e) { res([]); }
    });
    const url = (tabs && tabs[0] && tabs[0].url) || "";
    if (!url) return false;
    const host = String(url).replace(/^[a-z]+:\/\//i, "").split("/")[0].toLowerCase();
    return pats.some((p) => host.indexOf(String(p).toLowerCase()) >= 0);
  } catch (e) { return false; }
}

async function refreshNextVisit() {
  const node = $("nextVisit");
  if (!node) return;
  // Module B. La visio passe avant tout le reste, y compris la pause.
  if (await ongletEnVisio()) {
    node.textContent = msg("statusCall", "En silence, visio en cours");
    return;
  }
  const r = await getLocal(["pausedUntil"]);
  const until = Number(r.pausedUntil) || 0;
  if (until > Date.now()) {
    const t = new Date(until);
    node.textContent = msg("pausedUntilLabel", "En pause jusqu'à") + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes());
    return;
  }
  const al = await getAlarm(ALARM);
  if (!al || !al.scheduledTime) { node.textContent = msg("nextVisitSoon", "Prochaine visite bientôt"); return; }
  const mins = Math.round((al.scheduledTime - Date.now()) / 60000);
  if (mins <= 0) { node.textContent = msg("nextVisitNow", "Prochaine visite d'un instant à l'autre"); return; }
  const key = hasHistory() ? "nextVisitIn" : "firstVisitIn";
  node.textContent = msg(key, "Prochaine visite dans {n} min").replace("{n}", mins);
}

/* ---------- onglets ---------- */
function showTab(which) {
  currentTab = which;
  $("tabSettingsBtn").classList.toggle("tab--on", which === "settings");
  $("tabPersoBtn").classList.toggle("tab--on", which === "perso");
  $("tabStatsBtn").classList.toggle("tab--on", which === "stats");
  $("tabDataBtn").classList.toggle("tab--on", which === "data");
  $("panelSettings").hidden = which !== "settings";
  $("panelPerso").hidden = which !== "perso";
  $("panelStats").hidden = which !== "stats";
  $("panelData").hidden = which !== "data";
  $("panelBrowse").hidden = true;
  $("mainHead").hidden = false;
  if (which === "stats") renderStats();
  if (which === "data") renderData();
  window.scrollTo(0, 0);
}
function showBrowse(on) {
  $("panelBrowse").hidden = !on;
  $("mainHead").hidden = on;
  $("panelPerso").hidden = on;
  if (on) { browseLimit = BROWSE_PAGE; renderBrowse(); }
  window.scrollTo(0, 0);
}
$("tabSettingsBtn").addEventListener("click", () => showTab("settings"));
$("tabPersoBtn").addEventListener("click", () => showTab("perso"));
$("tabStatsBtn").addEventListener("click", () => showTab("stats"));
$("tabDataBtn").addEventListener("click", () => showTab("data"));

/* ---------- contenus fournis ---------- */
function builtinQuotes() { return (typeof KZ_QUOTES !== "undefined" && Array.isArray(KZ_QUOTES)) ? KZ_QUOTES : []; }
function builtinSport() { return (typeof KZ_SPORT !== "undefined" && Array.isArray(KZ_SPORT)) ? KZ_SPORT : []; }
function activeBuiltinQuotes() { return builtinQuotes().filter((q) => hiddenQuotes.indexOf(q.t) < 0); }

/* ================================================================
   ONGLET RÉGLAGES
   ================================================================ */

/* Pause et rattrapage */
function endOfTodayTs() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
$("snoozeLater").addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 15 * 60000 }); await refreshStatus(); });
$("snooze1h").addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 60 * 60000 }); await refreshStatus(); });
$("snoozeToday").addEventListener("click", async () => { await send("kz-pause", { until: endOfTodayTs() }); await refreshStatus(); });
$("resumeBtn").addEventListener("click", async () => { await send("kz-resume"); await refreshStatus(); });

async function refreshStatus() {
  const r = await getLocal(["pausedUntil", "pending"]);
  const until = Number(r.pausedUntil) || 0;
  const paused = until > Date.now();
  $("quickActions").hidden = paused;
  $("pausedNotice").hidden = !paused;
  if (paused) {
    const t = new Date(until);
    $("pausedText").textContent = msg("pausedUntilLabel", "En pause jusqu'à") + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes());
  }
  PENDING = Math.max(0, Number(r.pending) || 0);
  $("catchupCard").hidden = PENDING <= 0;
  if (PENDING <= 0) $("catchupBox").hidden = true;
  const key = PENDING > 1 ? "catchupTitlePlural" : "catchupTitleOne";
  $("catchupTitle").textContent = msg(key, PENDING > 1 ? "{n} habitudes à rattraper" : "{n} habitude à rattraper").replace("{n}", PENDING);
  await refreshNextVisit();
}

function effectiveSport() { return customSport.length ? customSport : builtinSport(); }
async function nextSport() {
  const list = effectiveSport();
  if (!list.length) return msg("sportFallback", "Bouge un peu");
  const r = await getLocal(["sportIndex"]);
  const i = Math.max(0, Number(r.sportIndex) || 0) % list.length;
  await setLocal({ sportIndex: (i + 1) % list.length });
  return list[i];
}

$("catchupBtn").addEventListener("click", async () => {
  $("catchupPrompt").textContent = await nextSport();
  $("catchupDone").hidden = false;
  clear($("catchupEnergy"));
  $("catchupBox").hidden = false;
});
$("catchupDone").addEventListener("click", () => {
  $("catchupDone").hidden = true;
  buildEnergyScale($("catchupEnergy"), async (energy) => {
    await send("kz-catchup", { energy: energy });
    await refreshStatus();
    clear($("catchupEnergy"));
    $("catchupDone").hidden = false;
    if (PENDING > 0) { $("catchupPrompt").textContent = await nextSport(); }
    else { $("catchupBox").hidden = true; }
  });
});

/* Echelle d'energie, meme graduation que dans la page */
const NRJ_TONE = ["nrj-1", "nrj-1", "nrj-1", "nrj-2", "nrj-2", "nrj-3", "nrj-3", "nrj-4", "nrj-5", "nrj-5"];
function buildEnergyScale(container, onPick) {
  clear(container);
  const box = el("div", "nrj");
  box.appendChild(el("div", "row-lab row-lab--big", msg("energyQ", "Ton énergie, là maintenant")));
  const grid = el("div", "nrj-grid");
  let picked = false;
  for (let i = 1; i <= 10; i++) {
    const b = el("button", "nrj-b " + NRJ_TONE[i - 1], String(i));
    b.type = "button";
    b.addEventListener("click", () => { if (!picked) { picked = true; onPick(i); } });
    grid.appendChild(b);
  }
  const ends = el("div", "nrj-ends");
  ends.appendChild(el("div", "nrj-lo", msg("energyLow", "À plat")));
  ends.appendChild(el("div", "nrj-hi", msg("energyHigh", "En pleine forme")));
  const skip = el("button", "nrj-skip", msg("energySkip", "Passer"));
  skip.type = "button";
  skip.addEventListener("click", () => { if (!picked) { picked = true; onPick(null); } });
  box.appendChild(grid); box.appendChild(ends); box.appendChild(skip);
  container.appendChild(box);
}

/* Rythme */
const CANON = { pomodoro: 25, deepwork: 52, ultradian: 90 };
function currentInterval() { return clampInt($("interval").value, 1, 240, 30); }
function paintRange() {
  const v = currentInterval();
  const pct = ((v - 1) / 239) * 100;
  $("interval").style.background = "linear-gradient(90deg, #2FAE4A 0%, #2FAE4A " + pct + "%, #F1F1F1 " + pct + "%, #F1F1F1 100%)";
}
function paintRhythm() {
  const v = currentInterval();
  $("rhythmValue").textContent = fmtMinutes(v);
  $("customPresetValue").textContent = fmtMinutes(currentPresetName === "custom" ? v : customMinutes);
  document.querySelectorAll("#presetGrid .pre").forEach((c) => c.classList.toggle("pre--on", c.getAttribute("data-preset") === currentPresetName));
  document.querySelectorAll("#presetGrid [data-min-label]").forEach((n) => {
    const m = parseInt(n.parentNode.getAttribute("data-min"), 10);
    if (!isNaN(m)) n.textContent = fmtMinutes(m);
  });
  // L'encadre Perso montre la valeur memorisee, et se grise quand un preset
  // fige est choisi. La valeur reste la, elle est restituee au retour sur Perso.
  const perso = (currentPresetName === "custom");
  const vPerso = perso ? v : customMinutes;
  $("intervalWrap").classList.toggle("permin--off", !perso);
  $("customIntervalValue").textContent = fmtMinutes(vPerso);
  $("intMinus").disabled = vPerso <= 5;
  $("intPlus").disabled = vPerso >= 240;
  paintRange();
}
function setInterval2(minutes, preset) {
  // Le pas de 5 minutes de la planche 1b ne concerne QUE l'intervalle Perso.
  // Les presets figes gardent leur valeur exacte, Deep work vaut bien 52 et
  // pas 50, sinon on abime un reglage que l'utilisateur n'a pas choisi.
  const brut = clampInt(minutes, 1, 240, 30);
  const v5 = (preset === "custom")
    ? Math.max(5, Math.min(240, Math.round(brut / 5) * 5))
    : brut;
  $("interval").value = String(v5);
  currentPresetName = preset;
  if (preset === "custom") customMinutes = currentInterval();
  paintRhythm();
}
document.querySelectorAll("#presetGrid .pre").forEach((card) => {
  card.addEventListener("click", () => {
    const p = card.getAttribute("data-preset");
    setInterval2(p === "custom" ? customMinutes : CANON[p], p);
  });
});
$("interval").addEventListener("input", () => {
  currentPresetName = "custom";
  // Le pas de 5 minutes doit tenir meme si la valeur brute de l'evenement
  // input n'est pas deja un multiple de 5 (l'attribut step du curseur ne
  // protege que le glisser-deposer natif, pas une valeur posee autrement).
  customMinutes = Math.max(5, Math.min(240, Math.round(currentInterval() / 5) * 5));
  $("interval").value = String(customMinutes);
  paintRhythm();
});
$("intMinus").addEventListener("click", () => { setInterval2(customMinutes - 5, "custom"); });
$("intPlus").addEventListener("click", () => { setInterval2(customMinutes + 5, "custom"); });

/* Pause focus */
let focusSeconds = 30;
function paintFocus() {
  $("focusValue").textContent = focusSeconds + " " + msg("unitSec", "s");
  $("focusSecWrap").classList.toggle("row-dim", !$("focusMode").checked);
}
$("focusMode").addEventListener("change", paintFocus);
$("focMinus").addEventListener("click", () => { focusSeconds = clampInt(focusSeconds - 5, 5, 120, 30); paintFocus(); });
$("focPlus").addEventListener("click", () => { focusSeconds = clampInt(focusSeconds + 5, 5, 120, 30); paintFocus(); });

/* Sites en visio */
function renderMuteChips() {
  const host = $("muteChips");
  clear(host);
  const show = (mutedExpanded || mutedPatterns.length <= 3) ? mutedPatterns.length : 2;
  mutedPatterns.slice(0, show).forEach((p, i) => {
    const c = el("span", "chip");
    c.appendChild(el("span", "chip-t", p));
    const x = el("button", "chip-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", msg("removeSite", "Retirer ce site"));
    x.addEventListener("click", () => { mutedPatterns.splice(i, 1); renderMuteChips(); });
    c.appendChild(x);
    host.appendChild(c);
  });
  if (show < mutedPatterns.length) {
    const more = el("button", "chip chip--act", "+ " + (mutedPatterns.length - show));
    more.type = "button";
    more.addEventListener("click", () => { mutedExpanded = true; renderMuteChips(); });
    host.appendChild(more);
  }
  const add = el("button", "chip chip--act", msg("addSite", "Ajouter"));
  add.type = "button";
  add.addEventListener("click", () => {
    const inp = el("input", "chip-in");
    inp.type = "text";
    inp.placeholder = "example.com";
    const commit = () => {
      const v = String(inp.value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (v && mutedPatterns.indexOf(v) < 0) mutedPatterns.push(v);
      mutedExpanded = true;
      renderMuteChips();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") renderMuteChips(); });
    inp.addEventListener("blur", commit);
    host.replaceChild(inp, add);
    inp.focus();
  });
  host.appendChild(add);
}

/* ================================================================
   ONGLET PERSO
   ================================================================ */

/* Objectifs, liste reordonnable */
let dragFrom = -1;
function renderSport() {
  const host = $("sportList");
  clear(host);
  $("sportEmpty").hidden = customSport.length > 0;
  customSport.forEach((text, i) => {
    const li = el("div", "li");
    li.draggable = true;
    li.appendChild(el("span", "li-grab", "⠿"));
    li.appendChild(el("span", "li-t", text));
    const x = el("button", "li-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", msg("removeItem", "Retirer"));
    x.addEventListener("click", () => { customSport.splice(i, 1); renderSport(); });
    li.appendChild(x);
    li.addEventListener("dragstart", (e) => { dragFrom = i; li.classList.add("li--drag"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } catch (_) { /* noop */ } });
    li.addEventListener("dragend", () => { dragFrom = -1; renderSport(); });
    li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("li--over"); });
    li.addEventListener("dragleave", () => li.classList.remove("li--over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("li--over");
      if (dragFrom < 0 || dragFrom === i) return;
      const moved = customSport.splice(dragFrom, 1)[0];
      customSport.splice(i, 0, moved);
      dragFrom = -1;
      renderSport();
    });
    host.appendChild(li);
  });
}
function addSport() {
  const v = String($("sportInput").value || "").trim();
  if (!v) return;
  customSport.push(v);
  $("sportInput").value = "";
  renderSport();
}
$("sportAdd").addEventListener("click", addSport);
$("sportInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSport(); } });

/* Objectif quotidien */
let habitGoal = 3;
function paintGoal() { $("goalValue").textContent = habitGoal > 0 ? String(habitGoal) : msg("goalOff", "aucun"); }
$("goalMinus").addEventListener("click", () => { habitGoal = clampInt(habitGoal - 1, 0, 20, 3); paintGoal(); });
$("goalPlus").addEventListener("click", () => { habitGoal = clampInt(habitGoal + 1, 0, 20, 3); paintGoal(); });

/* Citations */
function renderQuotes() {
  const host = $("quoteList");
  clear(host);
  const mine = quoteSeg === "mine";
  $("qsegMine").textContent = msg("quotesMine", "Les tiennes") + " " + customQuotes.length;
  $("qsegBuilt").textContent = msg("quotesBuilt", "Fournies") + " " + activeBuiltinQuotes().length;
  $("qsegMine").classList.toggle("seg-b--on", mine);
  $("qsegBuilt").classList.toggle("seg-b--on", !mine);
  $("quoteAddRow").hidden = !mine;
  $("quoteEmpty").hidden = !(mine && customQuotes.length === 0);
  $("browseQuotesLabel").textContent = msg("browseLink", "Parcourir les {n} fournies").replace("{n}", builtinQuotes().length);

  const list = mine ? customQuotes : activeBuiltinQuotes().slice(0, 3);
  list.forEach((q, i) => {
    const row = el("div", "q");
    row.appendChild(el("span", "q-m", "\u201C"));
    const body = el("div", "q-b");
    body.appendChild(el("div", "q-t", q.t));
    body.appendChild(el("div", "q-a", q.a || msg("authorUnknown", "Anonyme")));
    row.appendChild(body);
    if (mine) {
      const x = el("button", "q-x", "✕");
      x.type = "button";
      x.setAttribute("aria-label", msg("removeItem", "Retirer"));
      x.addEventListener("click", () => { customQuotes.splice(i, 1); renderQuotes(); });
      row.appendChild(x);
    }
    host.appendChild(row);
  });
}
function addQuote() {
  const raw = String($("quoteInput").value || "").trim();
  if (!raw) return;
  // Meme grammaire que le collage en lot, le tiret entoure d'espaces separe.
  const d = coupeLigne(raw);
  const q = { t: d.t, a: d.a || msg("authorUnknown", "Anonyme") };
  if (!q.t) return;
  customQuotes.push(q);
  $("quoteInput").value = "";
  quoteSeg = "mine";
  renderQuotes();
}
$("quoteAdd").addEventListener("click", addQuote);
$("quoteInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addQuote(); } });
document.querySelectorAll("#quoteSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => { quoteSeg = b.getAttribute("data-qseg"); renderQuotes(); });
});
/* ===================================================================
   Module F. Ajout de citations en lot, planche 02.
   L'analyseur est une fonction PURE, sans acces au DOM, pour etre testable
   ligne par ligne. Regles de lecture de la planche, dans l'ordre.
   Separateur, le DERNIER tiret entoure d'espaces, un tiret colle aux mots ne
   compte pas. La tabulation est acceptee en plus, pour coller deux colonnes
   depuis un tableur. Les espaces en trop sont retires des deux cotes du
   separateur. Auteur manquant, enregistre comme Anonyme. Lignes vides ignorees.
   Doublons compares sur le TEXTE seul, retires sans demander puis comptes.
   180 caracteres par citation, 500 lignes par collage.
   =================================================================== */
const BULK_MAX_LEN = 180;
const BULK_MAX_LINES = 500;

function coupeLigne(ligne) {
  // La tabulation prime, elle vient d'un tableur et ne peut pas etre ambigue.
  const tab = ligne.lastIndexOf("\t");
  if (tab >= 0) {
    return { t: ligne.slice(0, tab).trim(), a: ligne.slice(tab + 1).trim() };
  }
  // Le dernier tiret ENTOURE D'ESPACES. Un tiret colle aux mots n'est pas un
  // separateur, sinon un mot compose serait coupe en deux.
  let coupe = -1;
  for (let i = ligne.length - 3; i >= 1; i--) {
    if (ligne[i] === "-" && /\s/.test(ligne[i - 1]) && /\s/.test(ligne[i + 1])) { coupe = i; break; }
  }
  if (coupe < 0) return { t: ligne.trim(), a: "" };
  return { t: ligne.slice(0, coupe).trim(), a: ligne.slice(coupe + 1).trim() };
}

function parseLot(texte, dejaLa) {
  const vues = new Set();
  (dejaLa || []).forEach((q) => vues.add(String(q && q.t || "").trim().toLowerCase()));
  const brutes = String(texte || "").split(/\r?\n/);
  const trop = brutes.length > BULK_MAX_LINES;
  const lignes = brutes.slice(0, BULK_MAX_LINES);
  const out = { pretes: [], doublons: [], longues: [], vides: 0, tropDeLignes: trop };
  lignes.forEach((brute, i) => {
    const no = i + 1;
    if (!String(brute).trim()) { out.vides++; return; }
    const { t, a } = coupeLigne(String(brute));
    if (!t) { out.vides++; return; }
    if (t.length > BULK_MAX_LEN) { out.longues.push({ no: no, t: t }); return; }
    const cle = t.toLowerCase();
    if (vues.has(cle)) { out.doublons.push({ no: no, t: t }); return; }
    vues.add(cle);
    out.pretes.push({ t: t, a: a || msg("authorUnknown", "Anonyme") });
  });
  return out;
}

let bulkAnalyse = null;

function showBulk(on) {
  $("panelBulk").hidden = !on;
  $("panelBulkOk").hidden = true;
  $("mainHead").hidden = on;
  $("panelPerso").hidden = on;
  if (on) { $("bulkText").value = ""; majBulkCount(); }
  window.scrollTo(0, 0);
}
function showBulkOk(on) {
  $("panelBulkOk").hidden = !on;
  $("panelBulk").hidden = !!on;
  $("mainHead").hidden = on;
  $("panelPerso").hidden = on;
  window.scrollTo(0, 0);
}
function majBulkCount() {
  const n = String($("bulkText").value || "").split(/\r?\n/).filter((l) => l.trim()).length;
  // Le francais accorde nom et adjectif au singulier, "1 ligne" et pas "1 lignes".
  $("bulkCount").textContent = n === 1 ? msg("bulkLine", "{n} ligne").replace("{n}", n)
    : n ? msg("bulkLines", "{n} lignes").replace("{n}", n)
    : msg("bulkSub", "Une citation par ligne");
}

function renderBulkOk() {
  const a = bulkAnalyse;
  if (!a) return;
  const n = a.pretes.length;
  const nDup = a.doublons.length;
  const nLong = a.longues.length;
  $("bulkOkSub") .textContent = (n === 1 ? msg("bulkReady1", "{n} prête") : msg("bulkReady", "{n} prêtes")).replace("{n}", n);
  $("bulkPreviewN").textContent = (n === 1 ? msg("bulkLine", "{n} ligne") : msg("bulkLines", "{n} lignes")).replace("{n}", n);

  // Bandeau d'information, pas une confirmation. Les doublons sont seulement comptes.
  const info = $("bulkInfo");
  while (info.firstChild) info.removeChild(info.firstChild);
  const pastille = document.createElement("div");
  pastille.className = "info-i"; pastille.textContent = "i";
  const txt = document.createElement("div");
  const bouts = [(n === 1
    ? msg("bulkReadyN1", "{n} citation prête")
    : msg("bulkReadyN", "{n} citations prêtes")).replace("{n}", n)];
  if (nDup) bouts.push((nDup === 1
    ? msg("bulkDupN1", "{n} doublon retiré automatiquement")
    : msg("bulkDupN", "{n} doublons retirés automatiquement")).replace("{n}", nDup));
  if (nLong) bouts.push((nLong === 1
    ? msg("bulkLongN1", "{n} trop longue, ignorée")
    : msg("bulkLongN", "{n} trop longues, ignorées")).replace("{n}", nLong));
  if (a.tropDeLignes) bouts.push(msg("bulkTooMany", "au-delà de 500 lignes, le reste est ignoré"));
  txt.textContent = bouts.join(", ") + ".";
  info.appendChild(pastille); info.appendChild(txt);

  // Apercu rendu comme la liste finale.
  const host = $("bulkList");
  while (host.firstChild) host.removeChild(host.firstChild);
  a.pretes.forEach((q) => {
    const row = document.createElement("div");
    row.className = "q";
    const m = document.createElement("div"); m.className = "q-m"; m.textContent = "\u201C";
    const bloc = document.createElement("div"); bloc.className = "q-b";
    const t = document.createElement("div"); t.className = "q-t"; t.textContent = q.t;
    const au = document.createElement("div"); au.className = "q-a"; au.textContent = q.a;
    bloc.appendChild(t); bloc.appendChild(au);
    row.appendChild(m); row.appendChild(bloc);
    host.appendChild(row);
  });

  const btn = $("bulkApply");
  btn.textContent = n === 1 ? msg("bulkApplyN1", "Ajouter la citation")
    : n ? msg("bulkApplyN", "Ajouter les {n} citations").replace("{n}", n)
    : msg("bulkNothing", "Rien à ajouter");
  btn.disabled = !n;
}

/* Frequence des animaux de passage */
function passageFreqHint(freq) {
  // Cles litterales, jamais une variable indirecte, sinon le controle
  // d'integrite qui recherche les appels a msg par regex ne les voit jamais
  // et les signale a tort comme inutilisees.
  if (freq === "rare") return msg("freqHintRare", "Max. 1x toutes les 3 heures.");
  if (freq === "frequent") return msg("freqHintFrequent", "Max. 1x par heure.");
  return msg("freqHintNormal", "Max. 1x toutes les 2 heures.");
}
function applyPassageFrequency(freq) {
  const v = (freq === "rare" || freq === "frequent") ? freq : "normal";
  document.querySelectorAll("#passagesFreqSeg .seg-b").forEach((o) => o.classList.toggle("seg-b--on", o.getAttribute("data-freq") === v));
  $("passagesFreqHint").textContent = passageFreqHint(v);
}
function currentPassageFrequency() {
  const on = document.querySelector("#passagesFreqSeg .seg-b--on");
  return on ? on.getAttribute("data-freq") : "normal";
}
function paintPassagesFreqWrap() {
  $("passagesFreqWrap").classList.toggle("row-dim", !$("passagesTgl").checked);
}
document.querySelectorAll("#passagesFreqSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => { applyPassageFrequency(b.getAttribute("data-freq")); });
});
$("passagesTgl").addEventListener("change", paintPassagesFreqWrap);

// Un bouton de test discret, pour voir un passage sans attendre son heure.
$("passagesTest").addEventListener("click", async () => {
  // Fermer le popup immediatement annulait l'envoi. On attend la remise du
  // message, puis un souffle, avant de rendre la page visible.
  await send("kz-passage-now");
  await new Promise((r) => setTimeout(r, 120));
  window.close();
});

$("bulkOpen").addEventListener("click", () => { showTab("perso"); showBulk(true); });
$("bulkText").addEventListener("input", majBulkCount);
$("bulkBack").addEventListener("click", () => { showBulk(false); showTab("perso"); });
$("bulkCancel").addEventListener("click", () => { showBulk(false); showTab("perso"); });
$("bulkCheck").addEventListener("click", () => {
  bulkAnalyse = parseLot($("bulkText").value, customQuotes);
  renderBulkOk();
  showBulkOk(true);
});
$("bulkBackText").addEventListener("click", () => { showBulkOk(false); showBulk(true); });
$("bulkOkBack").addEventListener("click", () => { showBulkOk(false); showBulk(true); });
$("bulkApply").addEventListener("click", () => {
  if (!bulkAnalyse || !bulkAnalyse.pretes.length) return;
  bulkAnalyse.pretes.forEach((q) => customQuotes.push(q));
  bulkAnalyse = null;
  showBulkOk(false);
  showBulk(false);
  quoteSeg = "mine";
  showTab("perso");
  renderQuotes();
});

$("browseQuotes").addEventListener("click", () => showBrowse(true));
$("browseBack").addEventListener("click", () => { showBrowse(false); showTab("perso"); renderQuotes(); });

/* Cases a cocher simples */
function bindCheck(id, get, set) {
  const node = $(id);
  node.classList.toggle("cbx--on", !!get());
  node.addEventListener("click", () => { set(!get()); node.classList.toggle("cbx--on", !!get()); });
}

/* Galerie de personnages */
function renderGallery() {
  const host = $("gallery");
  clear(host);
  $("koalaCount").textContent = customKoalas.length + " " + msg("outOf", "sur") + " " + MAX_KOALAS;
  if (!customKoalas.length) {
    const d = el("div", "gal-d");
    const s = svgNode(koalaSvg(30));
    if (s) d.appendChild(s);
    d.title = msg("defaultKoalas", "Les koalas d'origine");
    host.appendChild(d);
  }
  customKoalas.forEach((url, i) => {
    const t = el("div", "gal-i");
    const img = el("img");
    img.src = url; img.alt = "";
    const x = el("button", "gal-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", msg("removeImg", "Retirer"));
    x.addEventListener("click", () => { customKoalas.splice(i, 1); renderGallery(); });
    t.appendChild(img); t.appendChild(x);
    host.appendChild(t);
  });
  if (customKoalas.length < MAX_KOALAS) {
    const add = el("label", "gal-add");
    add.appendChild(el("div", "p", "+"));
    add.appendChild(el("div", "f", "PNG, GIF"));
    const inp = el("input");
    inp.type = "file"; inp.accept = "image/png,image/gif,image/*"; inp.multiple = true;
    inp.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        if (customKoalas.length >= MAX_KOALAS) break;
        try { customKoalas.push(await fileToKoala(f)); } catch (_) { /* image ignoree */ }
      }
      renderGallery();
    });
    add.appendChild(inp);
    host.appendChild(add);
  }
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

/* Animations */
document.querySelectorAll("#animSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#animSeg .seg-b").forEach((o) => o.classList.toggle("seg-b--on", o === b));
    applyAnimMode(b.getAttribute("data-anim"));
  });
});
function currentAnimMode() {
  const on = document.querySelector("#animSeg .seg-b--on");
  return on ? on.getAttribute("data-anim") : "auto";
}
function setAnimSeg(mode) {
  document.querySelectorAll("#animSeg .seg-b").forEach((o) => o.classList.toggle("seg-b--on", o.getAttribute("data-anim") === mode));
}

/* ================================================================
   SOUS ÉCRAN, CITATIONS FOURNIES
   ================================================================ */
function renderBrowse() {
  const all = builtinQuotes();
  const active = all.length - hiddenQuotes.filter((h) => all.some((q) => q.t === h)).length;
  $("browseCount").textContent = msg("browseActive", "{a} actives sur {n}").replace("{a}", active).replace("{n}", all.length);
  $("bsegAll").textContent = msg("browseAll", "Toutes") + " " + all.length;
  $("bsegHidden").textContent = msg("browseHidden", "Masquées") + " " + (all.length - active);
  $("bsegAll").classList.toggle("seg-b--on", browseSeg === "all");
  $("bsegHidden").classList.toggle("seg-b--on", browseSeg === "hidden");

  const needle = browseQuery.trim().toLowerCase();
  const rows = all.filter((q) => {
    const hidden = hiddenQuotes.indexOf(q.t) >= 0;
    if (browseSeg === "hidden" && !hidden) return false;
    if (!needle) return true;
    return (q.t + " " + (q.a || "")).toLowerCase().indexOf(needle) >= 0;
  });

  const host = $("browseList");
  clear(host);
  rows.slice(0, browseLimit).forEach((q) => {
    const hidden = hiddenQuotes.indexOf(q.t) >= 0;
    const row = el("div", "bq" + (hidden ? " bq--off" : ""));
    row.appendChild(el("span", "bq-m", "\u201C"));
    const body = el("div", "bq-b");
    body.appendChild(el("div", "bq-t", q.t));
    body.appendChild(el("div", "bq-a", hidden ? msg("browseHiddenNote", "Masquée, le koala ne la dira plus") : (q.a || msg("authorUnknown", "Anonyme"))));
    const acts = el("div", "bq-acts");
    if (hidden) {
      const back = el("button", "bq-act", msg("browseUnhide", "Réafficher"));
      back.type = "button";
      back.addEventListener("click", () => { hiddenQuotes = hiddenQuotes.filter((h) => h !== q.t); renderBrowse(); });
      acts.appendChild(back);
    } else {
      const copie = el("button", "bq-act", msg("browseCopy", "Copier dans les miennes"));
      copie.type = "button";
      copie.addEventListener("click", () => {
        const deja = customQuotes.some((c) => String(c.t).trim().toLowerCase() === String(q.t).trim().toLowerCase());
        if (!deja) customQuotes.push({ t: q.t, a: q.a || msg("authorUnknown", "Anonyme") });
        copie.textContent = msg("browseCopied", "Copiée");
        copie.disabled = true;
        renderQuotes();
      });
      const hide = el("button", "bq-act bq-act--mute", msg("browseHide", "Masquer"));
      hide.type = "button";
      hide.addEventListener("click", () => { if (hiddenQuotes.indexOf(q.t) < 0) hiddenQuotes.push(q.t); renderBrowse(); });
      acts.appendChild(copie); acts.appendChild(hide);
    }
    body.appendChild(acts);
    row.appendChild(body);
    host.appendChild(row);
  });

  const rest = rows.length - Math.min(rows.length, browseLimit);
  $("browseMore").hidden = rest <= 0;
  if (rest > 0) $("browseMore").textContent = msg("browseMore", "{n} autres citations plus bas").replace("{n}", rest);
  if (!rows.length) host.appendChild(el("div", "hint", msg("browseNone", "Aucune citation ne correspond.")));
}
$("editCancel").addEventListener("click", () => { editingQuote = null; $("quoteEdit").hidden = true; });
$("editSave").addEventListener("click", () => {
  const t = String($("editText").value || "").trim();
  if (!t) return;
  customQuotes.push({ t: t, a: String($("editAuthor").value || "").trim() });
  if (editingQuote && hiddenQuotes.indexOf(editingQuote.t) < 0) hiddenQuotes.push(editingQuote.t);
  editingQuote = null;
  $("quoteEdit").hidden = true;
  renderBrowse();
});
$("browseSearch").addEventListener("input", () => { browseQuery = $("browseSearch").value; browseLimit = BROWSE_PAGE; renderBrowse(); });
document.querySelectorAll("#browseSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => { browseSeg = b.getAttribute("data-bseg"); browseLimit = BROWSE_PAGE; renderBrowse(); });
});
window.addEventListener("scroll", () => {
  if ($("panelBrowse").hidden) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 40) {
    const before = browseLimit;
    browseLimit += BROWSE_PAGE;
    if (before !== browseLimit) renderBrowse();
  }
});

/* ================================================================
   ONGLET STATS
   ================================================================ */
function dayStat(k) {
  const v = STATS[k] || {};
  // Number() avant le repli, sinon une valeur importee stockee en texte (ex.
  // un fichier edite a la main ou produit par un autre outil) reste une
  // chaine "truthy" et addAgg() fait alors une concatenation de texte au
  // lieu d'une addition, faussant les totaux affiches sans jamais planter.
  return { due: Number(v.due) || 0, done: Number(v.done) || 0, rep: Number(v.rep) || 0, eSum: Number(v.eSum) || 0, eCount: Number(v.eCount) || 0, repH: Array.isArray(v.repH) ? v.repH.map((n) => Number(n) || 0) : [0, 0, 0, 0] };
}
function emptyAgg() { return { due: 0, done: 0, rep: 0, eSum: 0, eCount: 0, repH: [0, 0, 0, 0] }; }
function addAgg(a, s) {
  a.due += s.due; a.done += s.done; a.rep += s.rep; a.eSum += s.eSum; a.eCount += s.eCount;
  for (let i = 0; i < 4; i++) a.repH[i] += (s.repH[i] || 0);
  return a;
}
function sumRange(start, end) {
  const agg = emptyAgg();
  let d = atMidnight(start); const last = atMidnight(end); let guard = 0;
  while (d.getTime() <= last.getTime() && guard < 4000) { addAgg(agg, dayStat(keyOf(d))); d = addDays(d, 1); guard++; }
  return agg;
}
function screenSecRange(start, end) {
  let sec = 0, d = atMidnight(start); const last = atMidnight(end); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) { sec += Math.max(0, Number(SCREEN[keyOf(d)]) || 0); d = addDays(d, 1); g++; }
  return sec;
}
/* ===================================================================
   Module G. Le modele de periode et les six phrases d'analyse.
   Tout est en fonctions PURES, sans acces au DOM ni a l'horloge, l'instant de
   reference est toujours passe en argument. C'est ce qui les rend testables.

   La planche impose cinq positions, jour, semaine, mois, annee, tout, plus une
   navigation par decalage vers le passe. Le decalage est un entier negatif ou
   nul, 0 est la periode en cours, moins 1 la precedente. La fleche avant est
   grisee sur la periode en cours.
   =================================================================== */
const STATS_RANGES = ["day", "week", "month", "year", "all"];

function firstDayKey() {
  const keys = Object.keys(STATS).concat(Object.keys(SCREEN)).sort();
  return keys.length ? keys[0] : null;
}

function rangeFor(kind, offset, now) {
  const ref = atMidnight(now || new Date());
  const o = Math.min(0, Math.round(Number(offset) || 0));
  if (kind === "day") { const d = addDays(ref, o); return [d, d]; }
  if (kind === "week") { const m = addDays(monday(ref), o * 7); return [m, addDays(m, 6)]; }
  if (kind === "month") {
    const s = new Date(ref.getFullYear(), ref.getMonth() + o, 1);
    return [s, new Date(s.getFullYear(), s.getMonth() + 1, 0)];
  }
  if (kind === "year") {
    const y = ref.getFullYear() + o;
    return [new Date(y, 0, 1), new Date(y, 11, 31)];
  }
  // Tout, du premier jour connu a aujourd'hui. Le decalage n'a pas de sens ici.
  const k = firstDayKey();
  return [k ? atMidnight(parseKey(k)) : ref, ref];
}

// La fleche avant est grisee sur la periode en cours, et Tout ne navigue pas.
function canGoForward(kind, offset) {
  if (kind === "all") return false;
  return Math.round(Number(offset) || 0) < 0;
}
// On ne remonte pas plus haut que le premier jour connu, sinon on navigue dans le vide.
function canGoBack(kind, offset, now) {
  if (kind === "all") return false;
  const k = firstDayKey();
  if (!k) return false;
  const o = Math.round(Number(offset) || 0);
  // Le premier pas en arriere est TOUJOURS permis. Sans cela, avec un seul jour
  // d'historique la fleche reste grisee et l'utilisateur la croit cassee.
  if (o === 0) return true;
  const prem = atMidnight(parseKey(k));
  const r = rangeFor(kind, o - 1, now);
  return r[1].getTime() >= prem.getTime();
}

// La periode equivalente precedente, meme duree et meme jour de depart.
function prevRangeFor(kind, offset, now) {
  if (kind === "all") return null;
  return rangeFor(kind, Math.round(Number(offset) || 0) - 1, now);
}

/* ---------- Les six phrases d'analyse, planche 14 ----------
   Chaque phrase interprete le chiffre au lieu de le repeter, et ne repete
   jamais le chiffre au dessus. Si la donnee manque, elle rend la chaine vide et
   la tuile ne montre PAS de tiret. Jamais de reproche, une baisse se dit sans
   jugement. Le mot cause n'apparait nulle part.                                */

const PHRASE_MIN_JOURS = 4;      // une tendance demande au moins 4 jours renseignes
const PHRASE_MIN_REPORTS = 5;    // un creneau demande au moins 5 reports
const PHRASE_SEUIL_STABLE = 0.05; // sous 5 pour cent d'ecart, on ecrit stable
const PHRASE_SEUIL_PENTE = 0.2;   // 0,2 point par jour pour parler de tendance

// 1. Habitudes faites, ecart avec la periode equivalente precedente.
function phraseEcart(done, donePrev, kind) {
  if (donePrev === null || donePrev === undefined) return "";
  const d = done - donePrev;
  const base = Math.max(1, donePrev);
  if (Math.abs(d) / base < PHRASE_SEUIL_STABLE) {
    return msg("phStable", "stable par rapport à {p}").replace("{p}", prevLabelFor(kind));
  }
  const n = String(Math.abs(d));
  return (d > 0
    ? msg("phMore", "{n} de plus que {p}")
    : msg("phLess", "{n} de moins que {p}")
  ).replace("{n}", n).replace("{p}", prevLabelFor(kind));
}
function prevLabelFor(kind) {
  if (kind === "day") return msg("phPrevDay", "la veille");
  if (kind === "week") return msg("phPrevWeek", "la semaine passée");
  if (kind === "month") return msg("phPrevMonth", "le mois passé");
  if (kind === "year") return msg("phPrevYear", "l'an passé");
  return msg("phPrevPeriod", "la période précédente");
}

// 2. Reportees, le creneau ou les reports se concentrent.
// La journee est coupee en quatre, matin avant 12 h, debut d'apres-midi jusqu'a
// 15 h, fin d'apres-midi jusqu'a 18 h, soiree apres 18 h. On ne nomme le creneau
// que s'il depasse 40 pour cent des reports.
function phraseCreneau(repH) {
  const t = Array.isArray(repH) ? repH : [0, 0, 0, 0];
  const total = t.reduce((a, b) => a + (Number(b) || 0), 0);
  if (total < PHRASE_MIN_REPORTS) return "";
  let best = 0;
  for (let i = 1; i < 4; i++) if ((t[i] || 0) > (t[best] || 0)) best = i;
  if ((t[best] || 0) / total <= 0.4) return "";
  if (best === 0) return msg("phSlotMorning", "surtout le matin");
  if (best === 1) return msg("phSlotEarly", "surtout en début d'après-midi");
  if (best === 2) return msg("phSlotLate", "surtout en fin d'après-midi");
  return msg("phSlotEvening", "surtout le soir");
}

// 3. Energie, droite de regression sur les valeurs de la periode. En hausse ou
// en baisse si la pente depasse 0,2 point par jour, sinon stable, et on cite le
// jour ou le sens a change.
function penteLineaire(points) {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  points.forEach((p, i) => { sx += i; sy += p; sxy += i * p; sxx += i * i; });
  const den = n * sxx - sx * sx;
  if (!den) return 0;
  return (n * sxy - sx * sy) / den;
}
function phraseTendance(jours) {
  // jours, tableau ordonne de { date, energie } ou energie vaut null si non note.
  const notes = (jours || []).filter((j) => j && typeof j.energie === "number");
  if (notes.length < PHRASE_MIN_JOURS) return "";
  const pente = penteLineaire(notes.map((j) => j.energie));
  if (Math.abs(pente) < PHRASE_SEUIL_PENTE) return msg("phEnergyFlat", "stable sur la période");
  // Le jour ou le sens a change, le dernier point qui va contre la pente finale.
  let bascule = null;
  for (let i = notes.length - 1; i > 0; i--) {
    const d = notes[i].energie - notes[i - 1].energie;
    if ((pente > 0 && d < 0) || (pente < 0 && d > 0)) { bascule = notes[i]; break; }
  }
  const jour = bascule ? nomDeJour(bascule.date) : nomDeJour(notes[0].date);
  return (pente > 0
    ? msg("phEnergyUp", "en hausse depuis {j}")
    : msg("phEnergyDown", "en baisse depuis {j}")
  ).replace("{j}", jour);
}
function nomDeJour(d) {
  try { return d.toLocaleDateString(uiLang(), { weekday: "long" }); }
  catch (e) { return ""; }
}

// 4. Temps d'ecran, moyenne par jour de la periode.
function phraseEcran(sec, jours) {
  const n = Math.max(0, Math.round(Number(jours) || 0));
  if (!n || !sec) return "";
  return msg("phScreenAvg", "{d} en moyenne par jour").replace("{d}", fmtDurShort(Math.round(sec / n)));
}

// 5. Meilleure serie, ses bornes.
function phraseSerie(bornes) {
  if (!bornes || !bornes.debut || !bornes.fin) return "";
  if (keyOf(bornes.debut) === keyOf(bornes.fin)) return "";
  return msg("phStreakSpan", "du {a} au {b}")
    .replace("{a}", nomDeJour(bornes.debut)).replace("{b}", nomDeJour(bornes.fin));
}

// 6. Record, le mois ou il a ete pose.
function phraseRecord(fin) {
  if (!fin) return "";
  let mois = "";
  try { mois = fin.toLocaleDateString(uiLang(), { month: "long" }); } catch (e) { return ""; }
  return msg("phRecordMonth", "en {m}, tous temps confondus").replace("{m}", mois);
}

// Cadence, temps d'ecran divise par le nombre d'habitudes faites.
function phraseCadence(sec, done) {
  if (!done || !sec) return "";
  return msg("phPace", "1 habitude / {d}").replace("{d}", fmtDurShort(Math.round(sec / done)));
}

// Les bornes de la plus longue serie d'une plage, pour la phrase 5.
function serieBornes(start, end) {
  let d = atMidnight(start); const last = atMidnight(end);
  let meilleur = null, cur = null, g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) {
    if (dayStat(keyOf(d)).done > 0) {
      if (!cur) cur = { debut: new Date(d), fin: new Date(d), n: 1 };
      else { cur.fin = new Date(d); cur.n++; }
      if (!meilleur || cur.n > meilleur.n) meilleur = { debut: cur.debut, fin: cur.fin, n: cur.n };
    } else { cur = null; }
    d = addDays(d, 1); g++;
  }
  return meilleur;
}

function rangeDays(range) { return Math.round((atMidnight(range[1]).getTime() - atMidnight(range[0]).getTime()) / 86400000) + 1; }
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
function countUp(node, to, dec) {
  if (REDUCE_MOTION) { node.textContent = fmtNum(to, dec); return; }
  const dur = 460, start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const v = to * (1 - Math.pow(1 - p, 3));
    node.textContent = fmtNum(dec ? v : Math.round(v), dec);
    if (p < 1) requestAnimationFrame(tick); else node.textContent = fmtNum(to, dec);
  }
  requestAnimationFrame(tick);
}

// Aucune occasion enregistree, ni faite ni reportee.
function hasHistory() {
  const keys = Object.keys(STATS);
  for (let i = 0; i < keys.length; i++) {
    const d = dayStat(keys[i]);
    if (d.done > 0 || d.rep > 0 || d.due > 0) return true;
  }
  return false;
}
function renderBlankStats() {
  const axis = $("ghostAxis");
  clear(axis);
  const m = monday(new Date());
  for (let i = 0; i < 7; i++) axis.appendChild(el("div", "ax", weekdayLetter(addDays(m, i))));
  let mins = 0;
  getAlarm(ALARM).then((al) => {
    mins = (al && al.scheduledTime) ? Math.max(1, Math.round((al.scheduledTime - Date.now()) / 60000)) : currentInterval();
    $("blankSub").textContent = msg("blankSub", "Tes chiffres se remplissent tout seuls. Le koala passe une première fois dans {n} minutes, et cet écran commence à vivre dès ta première habitude faite.").replace("{n}", mins);
  });
}
/* ---------- Module G, l'affichage pilote par le filtre ---------- */
let statsKind = "day";
let statsOffset = 0;

function majRangeSeg() {
  document.querySelectorAll("#rangeSeg .seg-b").forEach((b) => {
    b.classList.toggle("seg-b--on", b.getAttribute("data-range") === statsKind);
  });
  $("rangePrev").disabled = !canGoBack(statsKind, statsOffset);
  $("rangeNext").disabled = !canGoForward(statsKind, statsOffset);
}
function libellePeriode(kind, range) {
  try {
    if (kind === "day") return range[0].toLocaleDateString(uiLang(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (kind === "month") return range[0].toLocaleDateString(uiLang(), { month: "long", year: "numeric" });
    if (kind === "year") return String(range[0].getFullYear());
    const a = range[0], b = range[1];
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + " \u2013 " + b.toLocaleDateString(uiLang(), { day: "numeric", month: "long", year: "numeric" });
    }
    return a.toLocaleDateString(uiLang(), { day: "numeric", month: "short" }) + " \u2013 "
      + b.toLocaleDateString(uiLang(), { day: "numeric", month: "short", year: "numeric" });
  } catch (e) { return ""; }
}
document.querySelectorAll("#rangeSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => {
    statsKind = b.getAttribute("data-range");
    statsOffset = 0;   // changer de granularite ramene a la periode en cours
    setLocal({ statsRange: statsKind, statsOffset: 0 });
    renderStats();
  });
});
$("rangePrev").addEventListener("click", () => {
  if (!canGoBack(statsKind, statsOffset)) return;
  statsOffset -= 1; setLocal({ statsOffset: statsOffset }); renderStats();
});
$("rangeNext").addEventListener("click", () => {
  if (!canGoForward(statsKind, statsOffset)) return;
  statsOffset += 1; setLocal({ statsOffset: statsOffset }); renderStats();
});

// L'energie moyenne par jour de la plage, pour la droite de regression.
function joursEnergie(range) {
  const out = [];
  let d = atMidnight(range[0]); const last = atMidnight(range[1]); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) {
    const st = dayStat(keyOf(d));
    out.push({ date: new Date(d), energie: st.eCount > 0 ? st.eSum / st.eCount : null });
    d = addDays(d, 1); g++;
  }
  return out;
}
// Le record ignore le filtre, il porte sur tout l'historique.
function recordTousTemps() {
  const keys = Object.keys(STATS).sort();
  if (!keys.length) return null;
  return serieBornes(parseKey(keys[0]), new Date());
}

/* ---------- Module N, la premiere installation ---------- */
function showFirstRun(on) {
  $("firstRun").hidden = !on;
  $("mainHead").hidden = on;
  ["panelSettings", "panelPerso", "panelStats", "panelData"].forEach((id) => {
    const n = $(id); if (n) n.hidden = on || n.hidden;
  });
  if (on) {
    const k = svgNode(koalaSvg(64, "sway"));
    if (k) { clear($("frKoala")); $("frKoala").appendChild(k); }
    // Une habitude prereplie, jamais un champ vide, planche N. applyI18n()
    // a deja pose le placeholder localise, on le reprend comme valeur.
    if (!$("frHabit").value) $("frHabit").value = $("frHabit").placeholder || "";
  }
}
$("frStart").addEventListener("click", async () => {
  const v = String($("frHabit").value || $("frHabit").placeholder || "").trim();
  if (v && customSport.indexOf(v) === -1) customSport.push(v);
  await send("kz-save", { payload: { firstRun: false, customSport: customSport } });
  CFG.firstRun = false;
  renderSport();
  showFirstRun(false);
});

function renderStats() {
  const empty = !hasHistory();
  $("statsBlank").hidden = !empty;
  $("statsSoon").hidden = !empty;
  $("statsGhost").hidden = !empty;
  $("statsTiles").hidden = empty;
  $("streakCard").hidden = empty;
  $("benefitCard").hidden = empty;
  // Sans aucune donnee, il n'y a rien a filtrer. On masque le segmente ET la
   // ligne des fleches, sinon deux boutons ronds encadrent une date vide.
  const boiteFiltre = document.querySelector(".segbox--range");
  if (boiteFiltre) boiteFiltre.hidden = empty;
  const ligneNav = document.querySelector(".nav");
  if (ligneNav) ligneNav.hidden = empty;
  $("streakTiles").hidden = empty;
  $("totalHead").hidden = empty;
  if (empty) {
    $("chartsCard").hidden = true;
    $("trendNote").hidden = true;
    renderBlankStats();
    return;
  }
  const period = statsKind;
  const range = rangeFor(statsKind, statsOffset);
  const agg = sumRange(range[0], range[1]);
  const days = rangeDays(range);

  majRangeSeg();
  $("periodDates").textContent = libellePeriode(statsKind, range);
  $("totalHead").textContent = (statsKind === "all")
    ? msg("stTotalAll", "Total, tout l'historique")
    : msg("stTotalOf", "Total des {n} jours").replace("{n}", String(days));

  countUp($("statDone"), agg.done, 0);
  countUp($("statRep"), agg.rep, 0);
  const e = agg.eCount > 0 ? Math.round((agg.eSum / agg.eCount) * 10) / 10 : null;
  if (e == null) { $("statEnergy").textContent = "—"; $("statEnergyUnit").textContent = ""; }
  else { countUp($("statEnergy"), e, 1); $("statEnergyUnit").textContent = msg("outOfTen", "/ 10"); }
  const scr = screenSecRange(range[0], range[1]);
  $("statScreen").textContent = scr > 0 ? fmtDurTile(scr) : "—";

  // Sous lignes des tuiles
  const pr = prevRangeFor(statsKind, statsOffset);
  const donePrev = pr ? sumRange(pr[0], pr[1]).done : null;
  $("statDoneSub").textContent = phraseEcart(agg.done, donePrev, statsKind);
  $("statRepSub").textContent = phraseCreneau(agg.repH);
  $("statEnergySub").textContent = phraseTendance(joursEnergie(range));
  $("statScreenSub").textContent = phraseEcran(scr, days);

  // Les deux tuiles de serie. La meilleure porte sur la periode, le record est
  // tous temps confondus, c'est la seule chose qui ignore le filtre.
  const b = serieBornes(range[0], range[1]);
  $("statBest").textContent = String(b ? b.n : 0);
  $("statBestUnit").textContent = msg("daysWord", "jours");
  $("statBestSub").textContent = phraseSerie(b);
  const rec = recordTousTemps();
  $("statRecord").textContent = String(rec ? rec.n : 0);
  $("statRecordUnit").textContent = msg("daysWord", "jours");
  $("statRecordSub").textContent = phraseRecord(rec ? rec.fin : null);

  // Cadence
  $("cadenceText").textContent = (scr >= 600) ? phraseCadence(scr, agg.done) : "";

  renderTrend(period, range);
  renderStreak();
  renderBenefit();
}
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
  const n = Math.min(MAX_KOALAS, Math.max(1, total));
  let y = end.getFullYear(), m = end.getMonth() - (n - 1);
  while (m < 0) { m += 12; y -= 1; }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = sumRange(new Date(y, m, 1), new Date(y, m + 1, 0));
    out.push({ done: a.done, rep: a.rep, scr: screenSecRange(new Date(y, m, 1), new Date(y, m + 1, 0)), label: monthLabel(y, m) });
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}
function renderTrend(period, range) {
  // Une seule journee, un graphe par jour n'aurait qu'une colonne.
  const single = (period === "day");
  $("chartsCard").hidden = single;
  $("trendNote").hidden = !single;
  if (single) return;

  const days = rangeDays(range);
  const monthly = (period === "all" || days > 45);
  const buckets = monthly ? monthBuckets(range) : dayBuckets(range);
  // Ligne d'objectif quotidien, seulement en granularite jour
  const showGoal = !monthly && habitGoal > 0;
  const maxBar = Math.max(1, Math.max.apply(null, buckets.map((b) => Math.max(b.done, b.rep))));
  const maxVal = showGoal ? Math.max(maxBar, habitGoal) : maxBar;
  $("goalLegend").hidden = !showGoal;
  $("goalLine").hidden = !showGoal;
  if (showGoal) {
    $("goalLegendText").textContent = msg("statsGoalLegend", "Ton objectif, {n} par jour").replace("{n}", habitGoal);
    $("goalLine").style.bottom = Math.round((habitGoal / maxVal) * 72) + "px";
  }

  const host = $("trendChart");
  clear(host);
  const targets = [];
  buckets.forEach((b, i) => {
    const col = el("div", "col");
    if (b.done === 0 && b.rep === 0) {
      const flat = el("div", "col-b col-b--none");
      flat.style.height = "3px";
      col.appendChild(flat);
    } else {
      const bd = el("div", "col-b col-b--done");
      bd.style.height = Math.max(2, Math.round((b.done / maxVal) * 72)) + "px";
      const br = el("div", "col-b col-b--rep");
      br.style.height = Math.max(2, Math.round((b.rep / maxVal) * 72)) + "px";
      bd.title = b.done + " " + msg("statsDoneWord", "faites");
      br.title = b.rep + " " + msg("statsReportsWord", "reportées");
      if (!REDUCE_MOTION) { bd.style.transform = "scaleY(0)"; br.style.transform = "scaleY(0)"; bd.style.transitionDelay = (i * 20) + "ms"; br.style.transitionDelay = (i * 20 + 10) + "ms"; targets.push(bd, br); }
      col.appendChild(bd); col.appendChild(br);
    }
    host.appendChild(col);
  });
  fillAxis($("trendAxis"), buckets);

  const maxScr = Math.max(1, Math.max.apply(null, buckets.map((b) => b.scr)));
  const shost = $("screenChart");
  clear(shost);
  buckets.forEach((b, i) => {
    const bar = el("div", "scr-b");
    bar.style.height = (b.scr <= 0 ? 3 : Math.max(4, Math.round((b.scr / maxScr) * 34))) + "px";
    if (b.scr > 0) bar.title = fmtDurShort(b.scr);
    if (!REDUCE_MOTION) { bar.style.transform = "scaleY(0)"; bar.style.transitionDelay = (i * 18) + "ms"; targets.push(bar); }
    shost.appendChild(bar);
  });
  fillAxis($("screenAxis"), buckets);

  if (!REDUCE_MOTION && targets.length) {
    requestAnimationFrame(() => requestAnimationFrame(() => targets.forEach((n) => { n.style.transform = "scaleY(1)"; })));
  }
}
function fillAxis(host, buckets) {
  clear(host);
  buckets.forEach((b) => host.appendChild(el("div", "ax", b.label || "")));
}

function renderStreak() {
  const cur = currentStreak();
  const rec = longestStreak();
  $("statStreak").textContent = String(cur);
  $("statRecordPill").textContent = msg("statsRecordWord", "Record") + " " + rec;
  const pct = rec > 0 ? Math.min(1, cur / rec) : 0;
  const fill = $("streakFill");
  if (REDUCE_MOTION) { fill.style.width = Math.round(pct * 100) + "%"; }
  else { fill.style.width = "0%"; requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.round(pct * 100) + "%"; })); }
  let goal;
  if (rec === 0) goal = msg("statsStreakFirst", "Fais une habitude pour lancer ta série.");
  else if (cur === 0) goal = msg("statsStreakResume", "Reprends ta série aujourd'hui.");
  else if (cur >= rec) goal = msg("statsStreakAtRecord", "Tu es à ton record, continue.");
  else goal = msg("statsStreakGoal", "Encore {n} jours et tu bats ton record.").replace("{n}", rec - cur + 1);
  $("streakGoal").textContent = goal;
}

const BEN_FILL = ["#9BD4A8", "#63C177", "#2FAE4A"];
function renderBenefit() {
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
  const rows = $("benefitRows");
  clear(rows);
  if (qualifying < CORR_MIN) {
    $("benefitNote").hidden = false;
    $("benefitVerdict").textContent = "";
    $("benefitTitle").textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    return;
  }
  $("benefitNote").hidden = true;
  const labels = [msg("statsBenefitB1", "Peu"), msg("statsBenefitB2", "Moyen"), msg("statsBenefitB3", "Beaucoup")];
  const vals = buckets.map((b) => (b.n > 0 ? (b.s / b.n) : null));
  const fills = [];
  vals.forEach((v, i) => {
    const r = el("div", "ben-r");
    r.appendChild(el("div", "ben-l", labels[i]));
    const tr = el("div", "ben-tr");
    const f = el("div", "ben-f");
    f.style.background = BEN_FILL[i];
    tr.appendChild(f);
    r.appendChild(tr);
    r.appendChild(el("div", "ben-v", v == null ? "—" : fmtNum(Math.round(v * 10) / 10, 1)));
    rows.appendChild(r);
    fills.push({ node: f, pct: v == null ? 0 : Math.round((v / 10) * 100) });
  });
  if (REDUCE_MOTION) fills.forEach((f) => { f.node.style.width = f.pct + "%"; });
  else requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f) => { f.node.style.width = f.pct + "%"; })));
  applyBenefitText(vals);
}
function applyBenefitText(vals) {
  let lo = null, hi = null;
  for (let i = 0; i < vals.length; i++) { if (vals[i] != null) { if (lo == null) lo = { i: i, v: vals[i] }; hi = { i: i, v: vals[i] }; } }
  if (lo == null || hi == null || lo.i === hi.i) {
    $("benefitTitle").textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $("benefitVerdict").textContent = msg("statsBenefitFlat", "Continue à noter pour voir le lien se dessiner.");
    return;
  }
  const diff = Math.round((hi.v - lo.v) * 10) / 10;
  if (diff >= 0.5) {
    $("benefitTitle").textContent = msg("statsBenefitUp", "Tes habitudes te donnent de l'énergie");
    $("benefitVerdict").textContent = msg("statsBenefitUpText", "Les jours où tu t'y tiens le plus, {n} d'énergie en plus").replace("{n}", fmtNum(diff, 1));
  } else if (diff <= -0.5) {
    $("benefitTitle").textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $("benefitVerdict").textContent = msg("statsBenefitDownText", "Les jours où tu t'y tiens le plus, ton énergie est plus basse.");
  } else {
    $("benefitTitle").textContent = msg("statsBenefitNeutral", "Impact sur ton énergie");
    $("benefitVerdict").textContent = msg("statsBenefitNone", "Pas de lien net entre ton habitude et ton énergie.");
  }
}

/* ================================================================
   ONGLET DONNÉES
   ================================================================ */
function partSizes() {
  return {
    settings: byteSize({
      intervalMinutes: CFG.intervalMinutes, preset: CFG.preset, muteInCalls: CFG.muteInCalls,
      mutedPatterns: mutedPatterns, pauseWhenIdle: CFG.pauseWhenIdle, focusMode: CFG.focusMode,
      focusSeconds: focusSeconds, screenTimezone: CFG.screenTimezone, animMode: currentAnimMode()
    }),
    content: byteSize({ customQuotes: customQuotes, customSport: customSport, hiddenQuotes: hiddenQuotes, includeDefaultQuotes: CFG.includeDefaultQuotes, habitGoal: habitGoal }),
    stats: byteSize({ statsDaily: STATS, screenDaily: SCREEN, pending: PENDING }),
    koalas: byteSize({ customKoalas: customKoalas, includeDefaultKoalas: CFG.includeDefaultKoalas })
  };
}
function renderData() {
  const sz = partSizes();
  $("szSettings").textContent = fmtBytes(sz.settings);
  $("szContent").textContent = fmtBytes(sz.content);
  $("szStats").textContent = fmtBytes(sz.stats);
  $("szKoalas").textContent = fmtBytes(sz.koalas);
  // Module H. Les trois blocs nommes, en proportion. On ne repete pas les
  // valeurs, elles sont deja en bout de chaque ligne de case.
  const tot = Math.max(1, sz.koalas + sz.stats + sz.content + sz.settings);
  $("segKoalas").style.width = (100 * sz.koalas / tot) + "%";
  $("segStats").style.width = (100 * sz.stats / tot) + "%";
  $("segContent").style.width = (100 * (sz.content + sz.settings) / tot) + "%";

  const total = sz.settings + sz.content + sz.stats + sz.koalas;
  $("szTotal").textContent = fmtBytes(total);
  const pc = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0) + "%";
  $("dlKoalas").style.width = pc(sz.koalas);
  $("dlStats").style.width = pc(sz.stats);
  $("dlContent").style.width = pc(sz.content + sz.settings);

  const nDays = Object.keys(STATS).length;
  $("historyDays").textContent = nDays > 0
    ? msg("historyDays", "{n} jours").replace("{n}", nDays)
    : msg("historyEmpty", "Rien pour l'instant");

  document.querySelectorAll("#partList .cbx").forEach((b) => b.classList.toggle("cbx--on", !!exportParts[b.getAttribute("data-part")]));
  document.querySelectorAll("#importSeg .seg-b").forEach((b) => b.classList.toggle("seg-b--on", b.getAttribute("data-mode") === importMode));
  kdriveRefreshStatus();
}
document.querySelectorAll("#partList .cbx").forEach((b) => {
  b.addEventListener("click", () => {
    const k = b.getAttribute("data-part");
    exportParts[k] = !exportParts[k];
    b.classList.toggle("cbx--on", exportParts[k]);
  });
});
document.querySelectorAll("#importSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => {
    importMode = b.getAttribute("data-mode");
    document.querySelectorAll("#importSeg .seg-b").forEach((o) => o.classList.toggle("seg-b--on", o === b));
    setLocal({ importMode: importMode });
  });
});
function dataMsg(text, warn) {
  const node = $("dataMsg");
  node.textContent = text;
  node.classList.toggle("saved--warn", !!warn);
  node.classList.add("on");
  setTimeout(() => node.classList.remove("on"), 2600);
}
// Construit exactement le meme paquet que celui du fichier local, reutilise
// tel quel par la sauvegarde kDrive : une seule regle sur ce qui est inclus,
// jamais deux logiques d'export qui pourraient diverger.
async function buildExportBundle() {
  const stored = await getLocal(SETTINGS_KEYS.concat(CONTENT_KEYS, STATS_KEYS, KOALA_KEYS));
  const cfg = Object.assign({}, DEFAULTS, stored);
  const out = { app: "koala-zen", format: 1, exportedAt: new Date().toISOString(), build: manifestVersion() };
  if (exportParts.settings) { out.settings = {}; SETTINGS_KEYS.forEach((k) => { out.settings[k] = cfg[k]; }); }
  if (exportParts.content) { out.content = {}; CONTENT_KEYS.forEach((k) => { out.content[k] = cfg[k]; }); }
  if (exportParts.stats) { out.stats = {}; STATS_KEYS.forEach((k) => { out.stats[k] = cfg[k]; }); }
  if (exportParts.koalas) { out.koalas = {}; KOALA_KEYS.forEach((k) => { out.koalas[k] = cfg[k]; }); }
  return out;
}

// Applique un paquet deja analyse (fichier local ou telechargement kDrive),
// exactement la meme logique de fusion/remplacement dans les deux cas. Rend
// false si le paquet n'est pas reconnu, jamais une exception.
async function applyImportedBundle(data) {
  if (!data || data.app !== "koala-zen") return false;
  const patch = {};
  const replace = importMode === "replace";
  if (data.settings) SETTINGS_KEYS.forEach((k) => { if (data.settings[k] !== undefined) patch[k] = data.settings[k]; });
  if (data.koalas) {
    KOALA_KEYS.forEach((k) => { if (data.koalas[k] !== undefined) patch[k] = data.koalas[k]; });
    // L'import copiait les images SANS plafonner. Un fichier contenant plus
    // d'images que la limite les faisait toutes entrer, la tuile d'ajout
    // disparaissait et le stockage gonflait sans qu'on puisse rien retirer.
    // On plafonne, et on ne garde que des chaines, jamais un objet ou un nul.
    if (Array.isArray(patch.customKoalas)) {
      patch.customKoalas = patch.customKoalas
        .filter((x) => typeof x === "string" && x.length > 0)
        .slice(0, MAX_KOALAS);
    } else if (patch.customKoalas !== undefined) {
      patch.customKoalas = [];
    }
  }
  if (data.content) {
    CONTENT_KEYS.forEach((k) => {
      if (data.content[k] === undefined) return;
      const incoming = data.content[k];
      if (!replace && Array.isArray(incoming)) {
        const mine = k === "customQuotes" ? customQuotes : (k === "customSport" ? customSport : hiddenQuotes);
        patch[k] = mergeLists(mine, incoming, k === "customQuotes");
      } else { patch[k] = incoming; }
    });
  }
  if (data.stats) {
    if (replace) { STATS_KEYS.forEach((k) => { if (data.stats[k] !== undefined) patch[k] = data.stats[k]; }); }
    else {
      patch.statsDaily = Object.assign({}, data.stats.statsDaily || {}, STATS);
      patch.screenDaily = Object.assign({}, data.stats.screenDaily || {}, SCREEN);
      patch.pending = Math.max(PENDING, Number(data.stats.pending) || 0);
    }
  }
  await setLocal(patch);
  await send("kz-save", { payload: {} });
  await load();
  renderData();
  return true;
}
$("exportBtn").addEventListener("click", async () => {
  const out = await buildExportBundle();
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "koala-zen-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  dataMsg(msg("exportDone", "Fichier créé"));
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = (e.target.files || [])[0];
  $("importFile").value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (_) { dataMsg(msg("importBad", "Fichier illisible"), true); return; }
  const appliqué = await applyImportedBundle(data);
  if (!appliqué) { dataMsg(msg("importBad", "Fichier illisible"), true); return; }
  dataMsg(msg("importDone", "Données restaurées"));
});
function mergeLists(mine, incoming, isQuote) {
  const out = mine.slice();
  const seen = {};
  out.forEach((x) => { seen[isQuote ? (x && x.t) : x] = true; });
  incoming.forEach((x) => {
    const k = isQuote ? (x && x.t) : x;
    if (k && !seen[k]) { seen[k] = true; out.push(x); }
  });
  return out;
}

/* Effacements a deux clics */
function armDanger(node, labelKey, confirmKey, action) {
  const base = node.textContent;
  let armed = false, timer = 0;
  const disarm = () => { armed = false; clearTimeout(timer); node.textContent = msg(labelKey, base); };
  node.addEventListener("click", async () => {
    if (!armed) {
      armed = true;
      node.textContent = msg(confirmKey, "Confirmer");
      timer = setTimeout(() => { armed = false; node.textContent = msg(labelKey, base); }, 4000);
      return;
    }
    disarm();
    await action();
  });
}
armDanger($("resetHistory"), "eraseBtn", "eraseConfirm", async () => {
  await send("kz-reset");
  STATS = {}; SCREEN = {}; PENDING = 0;
  await refreshStatus();
  renderData();
  dataMsg(msg("eraseHistoryDone", "Historique effacé"));
});
armDanger($("resetAll"), "eraseAllBtn", "eraseConfirm", async () => {
  await send("kz-reset-all");
  await load();
  renderData();
  dataMsg(msg("eraseAllDone", "Tout est remis à zéro"));
});

/* ================================================================
   SAUVEGARDE KDRIVE. Le jeton et toute la logique reseau vivent dans
   background.js, jamais ici : le popup ne fait que demander et afficher.
   ================================================================ */
// send() ignore toujours la reponse de sendResponse, il ne sert qu'a
// declencher une action. Les operations kDrive ont besoin de la reponse
// elle-meme (reussite, erreur precise, liste de fichiers...), d'ou ce
// deuxieme envoi qui la transmet telle quelle plutot que de la jeter.
function sendR(type, extra) {
  const m = Object.assign({ type: type }, extra || {});
  return new Promise((res) => {
    try {
      const p = api.runtime.sendMessage(m);
      if (p && typeof p.then === "function") { p.then((r) => res(r), () => res(undefined)); }
      else { res(undefined); }
    } catch (e) { res(undefined); }
  });
}

// Chaque code d'erreur porte SA propre cle et SON propre texte de secours,
// jamais un message generique partage : un jeton invalide et une panne
// reseau n'appellent pas la meme action de la part de l'utilisateur. Les
// cles sont ecrites en toutes lettres, chacune dans son propre appel a msg,
// jamais via une table indirecte, sinon le controle d'integrite qui
// recherche ces appels par expression reguliere ne les detecte jamais et
// les signale a tort comme inutilisees.
function kdriveErrText(code) {
  if (code === "empty_token") return msg("kdriveErrEmpty", "Colle d'abord un jeton.");
  if (code === "invalid_token") return msg("kdriveErrInvalid", "Ce jeton ne fonctionne pas. Vérifie qu'il a bien le périmètre kDrive.");
  if (code === "offline") return msg("kdriveErrOffline", "Impossible de joindre kDrive, vérifie ta connexion.");
  if (code === "blocked") return msg("kdriveErrBlocked", "La requête a été bloquée de façon inattendue. Réessaie.");
  if (code === "no_drive") return msg("kdriveErrNoDrive", "Aucun kDrive disponible sur ce compte.");
  if (code === "not_configured") return msg("kdriveErrNotConfigured", "Aucun kDrive connecté pour l'instant.");
  if (code === "verify_failed") return msg("kdriveErrVerify", "La sauvegarde envoyée n'a pas pu être vérifiée, réessaie.");
  return msg("kdriveErrUnknown", "Une erreur inattendue est survenue ({c}).").replace("{c}", code || "?");
}
function kdriveToast(node, text, warn) {
  node.textContent = text;
  node.classList.toggle("saved--warn", !!warn);
  node.classList.add("on");
  setTimeout(() => node.classList.remove("on"), 3200);
}
function fmtDateTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(uiLang(), { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString(uiLang(), { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}

// Trois etats mutuellement exclusifs pour la carte kDrive : pas de jeton
// (kdriveSetup), jeton valide mais drive pas encore choisi (kdrivePicker, cas
// rare ou le popup a ete ferme entre la validation du jeton et le choix), et
// connecte a un drive precis (kdriveConnected). Un seul est visible a la fois.
async function kdriveRefreshStatus() {
  const st = await sendR("kz-kdrive-status");
  const configured = !!(st && st.configured);
  const needsChoice = !!(st && st.needsChoice);
  if (needsChoice) {
    $("kdriveSetup").hidden = true;
    $("kdriveConnected").hidden = true;
    $("kdrivePicker").hidden = false;
    const drives = await sendR("kz-kdrive-list-drives");
    if (drives && drives.ok) renderKdrivePicker(drives.drives);
    else kdriveToast($("kdrivePickMsg"), kdriveErrText(drives && drives.error), true);
    return false;
  }
  $("kdrivePicker").hidden = true;
  $("kdriveSetup").hidden = configured;
  $("kdriveConnected").hidden = !configured;
  if (configured) {
    $("kdriveConnectedLabel").textContent = st.driveName
      ? msg("kdriveConnectedTo", "Connecté à {n}").replace("{n}", st.driveName)
      : msg("kdriveConnectedGeneric", "Connecté à kDrive");
    $("kdriveLastSync").textContent = (st && st.lastSync)
      ? msg("kdriveLastSyncAt", "Dernière sauvegarde le {d}").replace("{d}", fmtDateTime(st.lastSync))
      : msg("kdriveNeverSynced", "Pas encore de sauvegarde envoyée.");
    if (st && st.lastError) kdriveToast($("kdriveMsg"), kdriveErrText(st.lastError), true);
  }
  $("kdriveRestoreList").hidden = true;
  return configured;
}

// Meme rendu pour les deux appels du choix de drive, la premiere connexion
// (kz-kdrive-set-token a repondu needsChoice) et le changement volontaire
// depuis l'etat connecte (bouton Changer de kDrive). Chaque ligne agit tout
// de suite au clic, pas de case a cocher plus bouton Confirmer separe, meme
// logique que la liste des sauvegardes a restaurer juste en dessous.
function renderKdrivePicker(drives) {
  const host = $("kdrivePickList");
  clear(host);
  drives.forEach((d) => {
    const row = el("div", "bq");
    row.appendChild(el("span", "bq-m", "☁"));
    const body = el("div", "bq-b");
    body.appendChild(el("div", "bq-t", d.name));
    body.appendChild(el("div", "bq-a", msg("kdriveFreeSpace", "{f} libres").replace("{f}", fmtBytes(d.freeBytes))));
    const acts = el("div", "bq-acts");
    const bouton = el("button", "bq-act", msg("kdrivePickChoose", "Choisir"));
    bouton.type = "button";
    bouton.addEventListener("click", async () => {
      bouton.disabled = true;
      const r = await sendR("kz-kdrive-choose-drive", { driveId: d.driveId, driveName: d.name });
      if (!r || !r.ok) { bouton.disabled = false; kdriveToast($("kdrivePickMsg"), kdriveErrText(r && r.error), true); return; }
      await kdriveRefreshStatus();
      kdriveToast($("kdriveMsg"), msg("kdriveLinked", "Connecté à kDrive"));
    });
    acts.appendChild(bouton);
    row.appendChild(body);
    row.appendChild(acts);
    host.appendChild(row);
  });
}

$("kdriveTokenShow").addEventListener("click", () => {
  const champ = $("kdriveTokenInput");
  const affiche = champ.type === "text";
  champ.type = affiche ? "password" : "text";
  $("kdriveTokenShow").textContent = affiche ? msg("kdriveShow", "Afficher") : msg("kdriveHideTok", "Masquer");
});

$("kdriveConnect").addEventListener("click", async () => {
  const token = $("kdriveTokenInput").value.trim();
  $("kdriveConnect").disabled = true;
  const avant = $("kdriveConnect").textContent;
  $("kdriveConnect").textContent = msg("kdriveConnecting", "Connexion…");
  const r = await sendR("kz-kdrive-set-token", { token: token });
  $("kdriveConnect").disabled = false;
  $("kdriveConnect").textContent = avant;
  if (!r || !r.ok) { kdriveToast($("kdriveSetupMsg"), kdriveErrText(r && r.error), true); return; }
  $("kdriveTokenInput").value = "";
  if (r.needsChoice) {
    $("kdriveSetup").hidden = true;
    $("kdrivePicker").hidden = false;
    renderKdrivePicker(r.drives);
    return;
  }
  await kdriveRefreshStatus();
  kdriveToast($("kdriveMsg"), msg("kdriveLinked", "Connecté à kDrive"));
});

$("kdriveChangeDrive").addEventListener("click", async () => {
  $("kdriveChangeDrive").disabled = true;
  const r = await sendR("kz-kdrive-list-drives");
  $("kdriveChangeDrive").disabled = false;
  if (!r || !r.ok) { kdriveToast($("kdriveMsg"), kdriveErrText(r && r.error), true); return; }
  if (r.drives.length < 2) { kdriveToast($("kdriveMsg"), msg("kdriveOnlyOneDrive", "Un seul kDrive est disponible sur ce compte.")); return; }
  $("kdriveConnected").hidden = true;
  $("kdrivePicker").hidden = false;
  renderKdrivePicker(r.drives);
});

$("kdriveBackupNow").addEventListener("click", async () => {
  const bundle = await buildExportBundle();
  $("kdriveBackupNow").disabled = true;
  const r = await sendR("kz-kdrive-backup", { bundle: bundle });
  $("kdriveBackupNow").disabled = false;
  if (!r || !r.ok) { kdriveToast($("kdriveMsg"), kdriveErrText(r && r.error), true); return; }
  await kdriveRefreshStatus();
  kdriveToast($("kdriveMsg"), msg("kdriveBackupDone", "Sauvegarde envoyée"));
});

function renderKdriveFiles(files) {
  const host = $("kdriveFiles");
  clear(host);
  if (!files.length) {
    host.appendChild(el("div", "note", msg("kdriveNoBackup", "Aucune sauvegarde trouvée sur kDrive.")));
    return;
  }
  files.forEach((f) => {
    const row = el("div", "bq");
    row.appendChild(el("span", "bq-m", "☁"));
    const body = el("div", "bq-b");
    body.appendChild(el("div", "bq-t", f.name));
    body.appendChild(el("div", "bq-a", fmtDateTime(f.date)));
    const acts = el("div", "bq-acts");
    const bouton = el("button", "bq-act", msg("kdriveApply", "Restaurer"));
    bouton.type = "button";
    bouton.addEventListener("click", () => kdriveApplyRestore(f.id, bouton));
    acts.appendChild(bouton);
    row.appendChild(body);
    row.appendChild(acts);
    host.appendChild(row);
  });
}

async function kdriveApplyRestore(fileId, bouton) {
  bouton.disabled = true;
  const r = await sendR("kz-kdrive-restore-file", { fileId: fileId });
  if (!r || !r.ok) { bouton.disabled = false; kdriveToast($("kdriveMsg"), kdriveErrText(r && r.error), true); return; }
  const appliqué = await applyImportedBundle(r.data);
  if (!appliqué) { bouton.disabled = false; kdriveToast($("kdriveMsg"), msg("importBad", "Fichier illisible"), true); return; }
  $("kdriveRestoreList").hidden = true;
  kdriveToast($("kdriveMsg"), msg("importDone", "Données restaurées"));
}

$("kdriveRestoreOpen").addEventListener("click", async () => {
  const doitOuvrir = $("kdriveRestoreList").hidden;
  if (!doitOuvrir) { $("kdriveRestoreList").hidden = true; return; }
  $("kdriveRestoreOpen").disabled = true;
  const r = await sendR("kz-kdrive-restore-list");
  $("kdriveRestoreOpen").disabled = false;
  if (!r || !r.ok) { kdriveToast($("kdriveMsg"), kdriveErrText(r && r.error), true); return; }
  renderKdriveFiles(r.files || []);
  $("kdriveRestoreList").hidden = false;
});

armDanger($("kdriveDisconnect"), "kdriveDisconnect", "eraseConfirm", async () => {
  await sendR("kz-kdrive-clear");
  await kdriveRefreshStatus();
  kdriveToast($("kdriveSetupMsg"), msg("kdriveUnlinked", "kDrive déconnecté"));
});

/* ================================================================
   VERSION, CHARGEMENT, ENREGISTREMENT
   ================================================================ */
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
  const v = manifestVersion();
  $("versionLine").textContent = "v" + v + " · " + msg("updatedOn", "mis à jour le") + " " + fmtBuildDate(KZ_BUILD_DATE);
}

async function load() {
  const stored = await getLocal(Object.keys(DEFAULTS));
  CFG = Object.assign({}, DEFAULTS, stored);

  // Rythme
  customMinutes = clampInt(CFG.intervalMinutes, 1, 240, 30);
  let preset = CFG.preset || "custom";
  if (preset !== "custom" && CANON[preset] && Number(CFG.intervalMinutes) !== CANON[preset]) preset = "custom";
  // La derniere valeur Perso reelle est dans customInterval, jamais ecrasee
  // par le choix d'un preset. Sans elle, revenir sur Perso apres un preset
  // retombait toujours a 30, en perdant la valeur que l'utilisateur avait
  // vraiment reglee.
  if (preset !== "custom") customMinutes = clampInt(CFG.customInterval, 5, 240, 45);
  setInterval2(clampInt(CFG.intervalMinutes, 1, 240, 30), preset);

  // Ne pas deranger
  $("muteCalls").checked = CFG.muteInCalls !== false;
  mutedPatterns = Array.isArray(CFG.mutedPatterns) ? CFG.mutedPatterns.slice() : DEFAULT_MUTED.slice();
  mutedExpanded = false;
  renderMuteChips();
  $("pauseIdle").checked = CFG.pauseWhenIdle !== false;

  // Focus
  $("focusMode").checked = !!CFG.focusMode;
  $("passagesTgl").checked = CFG.passages !== false;
  applyPassageFrequency(CFG.passageFrequency);
  paintPassagesFreqWrap();
  focusSeconds = clampInt(CFG.focusSeconds, 5, 120, 30);
  paintFocus();

  // Temps d'ecran
  const tz = CFG.screenTimezone || "Europe/Zurich";
  if (!Array.from($("screenTz").options).some((o) => o.value === tz)) {
    const opt = document.createElement("option"); opt.value = tz; opt.textContent = tz; $("screenTz").appendChild(opt);
  }
  $("screenTz").value = tz;

  // Perso
  customKoalas = Array.isArray(CFG.customKoalas) ? CFG.customKoalas.slice() : [];
  customSport = Array.isArray(CFG.customSport) ? CFG.customSport.slice() : [];
  customQuotes = Array.isArray(CFG.customQuotes) ? CFG.customQuotes.filter((q) => q && q.t) : [];
  hiddenQuotes = Array.isArray(CFG.hiddenQuotes) ? CFG.hiddenQuotes.slice() : [];
  habitGoal = clampInt(CFG.habitGoal, 0, 20, 3);
  paintGoal();
  renderSport();
  renderQuotes();
  renderGallery();
  $("includeDefault").classList.toggle("cbx--on", !!CFG.includeDefaultKoalas);
  $("includeDefaultQuotes").classList.toggle("cbx--on", !!CFG.includeDefaultQuotes);

  // Animations
  // Le filtre de periode etait ECRIT en stockage mais jamais relu, donc l'onglet
  // Stats s'ouvrait toujours sur le jour, la vue la moins parlante, et le choix
  // de l'utilisateur etait perdu a chaque ouverture du popup.
  if (STATS_RANGES.indexOf(CFG.statsRange) >= 0) statsKind = CFG.statsRange;
  statsOffset = Math.min(0, Math.round(Number(CFG.statsOffset) || 0));
  const am = (CFG.animMode === "always" || CFG.animMode === "never") ? CFG.animMode : "auto";
  setAnimSeg(am);
  applyAnimMode(am);

  // Statistiques
  STATS = (CFG.statsDaily && typeof CFG.statsDaily === "object") ? CFG.statsDaily : {};
  SCREEN = (CFG.screenDaily && typeof CFG.screenDaily === "object") ? CFG.screenDaily : {};
  importMode = CFG.importMode === "replace" ? "replace" : "merge";

  await refreshStatus();

  // Module N, une seule fois avant la premiere habitude ecrite. showTab() a
  // deja affiche Reglages plus haut dans l'init, avant que ce firstRun soit
  // connu, on le rattrape ici en repassant par dessus.
  if (CFG.firstRun) showFirstRun(true);
}

async function save() {
  const preset = currentPresetName;
  const interval = preset === "custom" ? currentInterval() : (CANON[preset] || currentInterval());
  const payload = {
    intervalMinutes: interval,
    preset: preset,
    customInterval: customMinutes,
    muteInCalls: $("muteCalls").checked,
    mutedPatterns: mutedPatterns,
    pauseWhenIdle: $("pauseIdle").checked,
    focusMode: $("focusMode").checked,
    passages: $("passagesTgl").checked,
    passageFrequency: currentPassageFrequency(),
    focusSeconds: focusSeconds,
    screenTimezone: $("screenTz").value || "Europe/Zurich",
    animMode: currentAnimMode(),
    customKoalas: customKoalas,
    includeDefaultKoalas: $("includeDefault").classList.contains("cbx--on"),
    customQuotes: customQuotes,
    includeDefaultQuotes: $("includeDefaultQuotes").classList.contains("cbx--on"),
    customSport: customSport,
    hiddenQuotes: hiddenQuotes,
    habitGoal: habitGoal
  };
  CFG = Object.assign(CFG, payload);
  applyAnimMode(payload.animMode);
  await send("kz-save", { payload: payload });
  const node = (currentTab === "perso") ? $("savedPerso") : $("saved");
  node.classList.add("on");
  setTimeout(() => node.classList.remove("on"), 1600);
  await refreshNextVisit();
}
$("save").addEventListener("click", save);
$("savePerso").addEventListener("click", save);
$("now").addEventListener("click", () => { send("kz-trigger-now"); });
$("blankNow").addEventListener("click", () => { send("kz-trigger-now"); window.close(); });

bindCheck("includeDefault", () => CFG.includeDefaultKoalas, (v) => { CFG.includeDefaultKoalas = v; });
bindCheck("includeDefaultQuotes", () => CFG.includeDefaultQuotes, (v) => { CFG.includeDefaultQuotes = v; });

/* ---------- init ---------- */
applyI18n();
fillHeadMark();
setVersionLine();
showTab("settings");
load();
