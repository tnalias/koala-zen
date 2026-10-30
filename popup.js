const api = globalThis.browser || globalThis.chrome;

const DEFAULT_MUTED = ["kmeet.infomaniak.com", "teams.microsoft.com", "teams.live.com", "zoom.us", "meet.google.com"];

const SETTINGS_KEYS = ["intervalMinutes", "preset", "customInterval", "remindersEnabled", "passages", "passagesRandom", "passagesEvening", "passagesMeeting", "passageFrequency", "muteInCalls", "mutedPatterns", "pauseWhenIdle", "focusMode", "focusSeconds", "screenTimezone", "animMode", "showCharacter", "quotesEnabled", "agendaEnabled", "agendaWarn", "agendaEndWarn", "theme", "notifyEnabled", "mailStatsEnabled"];
const CONTENT_KEYS = ["customQuotes", "customSport", "includeDefaultQuotes", "hiddenQuotes", "habitGoal"];
const STATS_KEYS = ["statsDaily", "screenDaily", "meetingDaily", "mailDaily"];
const KOALA_KEYS = ["customKoalas", "includeDefaultKoalas"];

const DEFAULTS = {
  intervalMinutes: 30,
  preset: "custom",
  customInterval: 45,
  remindersEnabled: true,
  muteInCalls: true,
  mutedPatterns: DEFAULT_MUTED,
  pauseWhenIdle: true,
  focusMode: false,
  focusSeconds: 30,
  screenTimezone: "Europe/Zurich",
  animMode: "auto",
  showCharacter: true,
  quotesEnabled: true,
  passages: true,
  passagesRandom: true,
  passagesEvening: true,
  passagesMeeting: true,
  passageFrequency: "normal",
  agendaEnabled: false,
  agendaWarn: true,
  agendaEndWarn: true,
  theme: "auto",
  notifyEnabled: false,
  mailStatsEnabled: false,
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
  screenDaily: {},
  meetingDaily: {},
  mailDaily: {}
};

const ALARM = "kz-move";
const MAX_KOALAS = 18;
const MAX_DIM = 300;
const BROWSE_PAGE = 40;
// Date de la derniere mise a jour, a actualiser a chaque release en meme temps que la version.
const KZ_BUILD_DATE = "2026-10-28";

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
// Le theme du popup, 2026-09-22. Automatique suit prefers-color-scheme et
// reagit a son changement, Clair et Sombre forcent. Applique sur html, le
// CSS ne connait que data-theme="dark".
let themeMedia = null;
function effectiveTheme(mode) {
  if (mode === "dark" || mode === "light") return mode;
  try { return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"; }
  catch (e) { return "light"; }
}
function applyTheme(mode) {
  const m = (mode === "dark" || mode === "light") ? mode : "auto";
  document.documentElement.setAttribute("data-theme", effectiveTheme(m));
  document.documentElement.setAttribute("data-theme-mode", m);
  if (!themeMedia) {
    try {
      themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
      const suit = () => { if (currentThemeMode() === "auto") applyTheme("auto"); };
      if (themeMedia && themeMedia.addEventListener) themeMedia.addEventListener("change", suit);
      else if (themeMedia && themeMedia.addListener) themeMedia.addListener(suit);
    } catch (e) { /* noop */ }
    if (!themeMedia) themeMedia = { matches: false };
  }
}
function currentThemeMode() {
  const on = document.querySelector("#themeSeg .seg-b--on");
  const v = on ? on.getAttribute("data-th") : "auto";
  return (v === "dark" || v === "light") ? v : "auto";
}
function setThemeSeg(mode) {
  document.querySelectorAll("#themeSeg .seg-b").forEach((o) => o.classList.toggle("seg-b--on", o.getAttribute("data-th") === mode));
}
document.querySelectorAll("#themeSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => { setThemeSeg(b.getAttribute("data-th")); applyTheme(b.getAttribute("data-th")); });
});

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
let MEET = {};
let MAIL = {};
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
let exportParts = { settings: true, content: true, stats: true, koalas: true, connexions: false };
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
  // Filtre : jamais de script, d'objet etranger, d'attribut d'evenement ni de lien javascript, meme si nos dessins n'en ont pas.
  if (/^(script|foreignobject|iframe|object|embed)$/i.test(foreign.localName || foreign.tagName || "")) return null;
  const ns = foreign.namespaceURI || "http://www.w3.org/2000/svg";
  const n = doc.createElementNS(ns, foreign.localName || foreign.tagName);
  for (let i = 0; i < foreign.attributes.length; i++) {
    const a = foreign.attributes[i];
    if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*(javascript|data):/i.test(a.value))) continue;
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
// Arrondi a la minute AVANT de separer heures et minutes : arrondir le reste
// seul donnait "1 h 60" pour 7170 s et "60 min" pour 3590 s.
function fmtDurShort(sec) {
  const min = Math.max(0, Math.round((Number(sec) || 0) / 60));
  const h = Math.floor(min / 60), m = min % 60;
  if (h > 0) return h + " " + msg("unitHour", "h") + " " + pad2(m);
  return m + " " + msg("unitMin", "min");
}
// Le gros chiffre d'une tuile : les heures seules a partir de dix heures
// ("23 h"), les minutes en plus en dessous ("1 h 30"), sinon 1 h 30 de
// reunion s'affichait "1 h".
function fmtDurTile(sec) {
  const min = Math.max(0, Math.round((Number(sec) || 0) / 60));
  const h = Math.floor(min / 60), m = min % 60;
  if (h >= 10 || (h > 0 && m === 0)) return h + " " + msg("unitHour", "h");
  if (h > 0) return h + " " + msg("unitHour", "h") + " " + pad2(m);
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
// Une decimale au plus, aucune quand le nombre est rond : 4 et pas 4,0.
function fmtDec(n) { try { return Number(n).toLocaleString(uiLang(), { minimumFractionDigits: 0, maximumFractionDigits: 1 }); } catch (e) { return String(n); } }
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
    const host = String(url).replace(/^[a-z]+:\/\//i, "").split("/")[0].toLowerCase().replace(/:\d+$/, "");
    // Meme regle que matchesMuted() dans background.js : l'hote exact ou un
    // sous-domaine, jamais une simple sous-chaine. Sinon l'en-tete annoncait
    // une visio sur "notzoom.us" alors que le rappel, lui, tombait.
    return pats.some((brut) => {
      const base = String(brut).trim().toLowerCase().replace(/^\*\./, "").replace(/\/.*$/, "");
      return !!base && (host === base || host.endsWith("." + base));
    });
  } catch (e) { return false; }
}

// L'anneau de l'en-tete : la part du rythme deja ecoulee avant la prochaine
// visite. null le cache (rappels eteints, pause, visio, rendez-vous).
const RING_LONGUEUR = 116.24;
// Un <svg> n'a pas de propriete hidden : on passe par l'attribut.
function paintRing(part) {
  const ring = $("headRing");
  if (!ring) return;
  if (part === null || !isFinite(part)) { ring.setAttribute("hidden", ""); return; }
  const p = Math.max(0, Math.min(1, part));
  const fill = $("headRingFill");
  const premier = ring.hasAttribute("hidden");
  ring.removeAttribute("hidden");
  const cible = String(Math.round(RING_LONGUEUR * (1 - p) * 100) / 100);
  if (premier && !REDUCE_MOTION) {
    // Il part de vide, puis se remplit jusqu'a sa valeur.
    fill.style.strokeDashoffset = String(RING_LONGUEUR);
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = cible; }));
  } else {
    fill.style.strokeDashoffset = cible;
  }
}
async function refreshNextVisit() {
  const node = $("nextVisit");
  if (!node) return;
  // Module B. La visio passe avant tout le reste, y compris la pause.
  if (await ongletEnVisio()) {
    node.textContent = msg("statusCall", "En silence, visio en cours");
    paintRing(null);
    return;
  }
  // Un rendez-vous de l'agenda en cours vaut une visio, avant la pause.
  // 2026-10-06 : l'etat de l'agenda vit dans le coffre du fond, on le demande.
  const ag = (await getLocal(["agendaEnabled"])).agendaEnabled ? await sendR("kz-agenda-status") : null;
  if (ag && ag.enabled && Number(ag.inUntil) > Date.now()) {
    node.textContent = msg("statusMeeting", "Rendez-vous en cours, rappels en pause");
    paintRing(null);
    return;
  }
  const r = await getLocal(["pausedUntil", "remindersEnabled"]);
  if (r.remindersEnabled === false) {
    node.textContent = msg("statusRemindersOff", "Rappels d'habitude éteints");
    paintRing(null);
    return;
  }
  const until = Number(r.pausedUntil) || 0;
  if (until > Date.now()) {
    const t = new Date(until);
    node.textContent = msg("pausedUntilLabel", "En pause jusqu'à") + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes());
    paintRing(null);
    return;
  }
  const al = await getAlarm(ALARM);
  if (!al || !al.scheduledTime) { node.textContent = msg("nextVisitSoon", "Prochaine visite bientôt"); paintRing(null); return; }
  const periode = (Number(al.periodInMinutes) || currentInterval()) * 60000;
  paintRing(1 - (al.scheduledTime - Date.now()) / periode);
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

/* Pause */
function endOfTodayTs() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
$("snoozeLater").addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 15 * 60000 }); await refreshStatus(); });
$("snooze1h").addEventListener("click", async () => { await send("kz-pause", { until: Date.now() + 60 * 60000 }); await refreshStatus(); });
$("snoozeToday").addEventListener("click", async () => { await send("kz-pause", { until: endOfTodayTs() }); await refreshStatus(); });
$("resumeBtn").addEventListener("click", async () => { await send("kz-resume"); await refreshStatus(); });

async function refreshStatus() {
  const r = await getLocal(["pausedUntil"]);
  const until = Number(r.pausedUntil) || 0;
  const paused = until > Date.now();
  $("quickActions").hidden = paused;
  $("pausedNotice").hidden = !paused;
  if (paused) {
    const t = new Date(until);
    $("pausedText").textContent = msg("pausedUntilLabel", "En pause jusqu'à") + " " + pad2(t.getHours()) + ":" + pad2(t.getMinutes());
  }
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


/* Echelle d'energie, meme graduation que dans la page */
/* Rythme */
const CANON = { pomodoro: 25, deepwork: 52, ultradian: 90 };
function currentInterval() { return clampInt($("interval").value, 1, 240, 30); }
function paintRange() {
  const v = currentInterval();
  // Le curseur va de 5 a 240 (popup.html), le remplissage suit la meme echelle.
  const pct = Math.max(0, Math.min(100, ((v - 5) / 235) * 100));
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
    // Echap annule : retirer le champ declenche un blur, qui validait quand
    // meme le texte tape. Le drapeau fait ignorer ce blur.
    let annule = false;
    const commit = () => {
      if (annule) return;
      const v = String(inp.value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (v && mutedPatterns.indexOf(v) < 0) mutedPatterns.push(v);
      mutedExpanded = true;
      renderMuteChips();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { annule = true; renderMuteChips(); }
    });
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

// garder : on revient de l'ecran de verification, le texte colle reste en
// place pour etre corrige. Sans ce drapeau, "Revenir au texte" vidait tout.
function showBulk(on, garder) {
  $("panelBulk").hidden = !on;
  $("panelBulkOk").hidden = true;
  $("mainHead").hidden = on;
  $("panelPerso").hidden = on;
  if (on) { if (!garder) $("bulkText").value = ""; majBulkCount(); }
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
  const on = $("passagesTgl").checked;
  $("passagesSubWrap").classList.toggle("row-dim", !on);
  $("passagesFreqWrap").classList.toggle("row-dim", !on || !$("passagesRandomTgl").checked);
}
document.querySelectorAll("#passagesFreqSeg .seg-b").forEach((b) => {
  b.addEventListener("click", () => { applyPassageFrequency(b.getAttribute("data-freq")); });
});
$("passagesTgl").addEventListener("change", paintPassagesFreqWrap);
$("passagesRandomTgl").addEventListener("change", paintPassagesFreqWrap);

/* Rappels d'habitude, eteints a part depuis le 2026-10-28 */
// Mettre en pause dit ce qu'il arrete (2026-10-30) : les rappels d'habitude,
// les animaux, ou les deux. Sans l'un ni l'autre, il n'y a rien a arreter et
// la carte disparait. L'agenda, lui, n'est jamais mis en pause.
function paintPause() {
  const habitudes = habitsOn();
  const animaux = $("passagesTgl").checked;
  $("pauseCard").hidden = !habitudes && !animaux;
  $("pauseHint").textContent = habitudes && animaux
    ? msg("pauseHintAll", "Coupe les rappels d'habitude et les animaux. Ta série reste intacte.")
    : (habitudes ? msg("pauseHintHabits", "Coupe les rappels d'habitude. Ta série reste intacte.") : msg("pauseHintAnimals", "Coupe les animaux de passage."));
}
$("passagesTgl").addEventListener("change", paintPause);

// Rappels d'habitude eteints (2026-10-28) : leur rythme se grise sous
// l'interrupteur, et tout ce qui n'existe que pour eux disparait des autres
// cartes et onglets. La pause focus et le bouton d'essai dans Reglages, les
// objectifs et les citations dans Perso, les habitudes et la serie dans
// Statistiques. Une note dit ce qui est masque, avec de quoi les rallumer.
function habitsOn() { return $("remindersTgl").checked; }
function paintReminders() {
  const on = habitsOn();
  // La pause focus vit dans rhythmWrap : elle se grise avec le rythme.
  $("rhythmWrap").classList.toggle("row-dim", !on);
  $("now").hidden = !on;
  // Sans rappels, plus de visite a attendre : l'anneau part tout de suite.
  if (!on) paintRing(null);
  paintPause();
  $("sportCard").hidden = !on;
  $("quotesCard").hidden = !on;
  $("persoRemindersNote").hidden = on;
  $("statsRemindersNote").hidden = on;
  if (currentTab === "stats") renderStats();
}
document.querySelectorAll("[data-turn-on-reminders]").forEach((b) => {
  b.addEventListener("click", () => {
    $("remindersTgl").checked = true;
    $("remindersTgl").dispatchEvent(new Event("change", { bubbles: true }));
  });
});

// Citations (2026-10-28) : un interrupteur a elles. Le style sobre n'en
// affiche jamais ; il le dit, et l'interrupteur se grise avec la liste.
function paintQuotes() {
  const sobre = !$("characterTgl").checked;
  $("quotesSoberNote").hidden = !sobre;
  $("quotesTglRow").classList.toggle("row-dim", sobre);
  $("quotesWrap").classList.toggle("row-dim", sobre || !$("quotesTgl").checked);
}
$("quotesTgl").addEventListener("change", paintQuotes);

// Style pro, 2026-10-28. Sans personnage, la galerie se grise, les boutons
// d'essai ne parlent plus du koala, la carte Citations dit qu'elles ne
// s'affichent plus (sans bloquer leur edition), et si les animaux de passage
// traversent encore l'ecran, on le dit avec de quoi les eteindre d'un clic,
// plutot que de les couper en silence.
function paintCharacter() {
  const on = $("characterTgl").checked;
  $("characterWrap").classList.toggle("row-dim", !on);
  $("characterPassagesNote").hidden = on || !$("passagesTgl").checked;
  paintQuotes();
  const essai = on ? msg("bringNow", "Faire venir le koala") : msg("bringNowPlain", "Afficher un rappel maintenant");
  $("now").textContent = essai;
  $("blankNow").textContent = essai;
}
$("characterTgl").addEventListener("change", paintCharacter);
$("passagesTgl").addEventListener("change", paintCharacter);
$("characterPassagesOff").addEventListener("click", () => {
  $("passagesTgl").checked = false;
  $("passagesTgl").dispatchEvent(new Event("change", { bubbles: true }));
});

// Ces interrupteurs s'enregistrent au clic, comme ceux de l'agenda : couper
// puis fermer le popup sans passer par Enregistrer perdait le choix en silence.
function saveToggleNow(id, key, after) {
  $(id).addEventListener("change", async () => {
    const on = $(id).checked;
    CFG[key] = on;
    await send("kz-save", { payload: { [key]: on } });
    if (after) await after();
  });
}
$("remindersTgl").addEventListener("change", paintReminders);
saveToggleNow("remindersTgl", "remindersEnabled", refreshNextVisit);
saveToggleNow("passagesTgl", "passages");
saveToggleNow("passagesRandomTgl", "passagesRandom");
saveToggleNow("passagesEveningTgl", "passagesEvening");
saveToggleNow("passagesMeetingTgl", "passagesMeeting");
saveToggleNow("characterTgl", "showCharacter");
saveToggleNow("quotesTgl", "quotesEnabled");

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
$("bulkBackText").addEventListener("click", () => { showBulkOk(false); showBulk(true, true); });
$("bulkOkBack").addEventListener("click", () => { showBulkOk(false); showBulk(true, true); });
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
  return { due: Number(v.due) || 0, done: Number(v.done) || 0, rep: Number(v.rep) || 0, repH: Array.isArray(v.repH) ? v.repH.map((n) => Number(n) || 0) : [0, 0, 0, 0] };
}
function emptyAgg() { return { due: 0, done: 0, rep: 0, repH: [0, 0, 0, 0] }; }
function addAgg(a, s) {
  a.due += s.due; a.done += s.done; a.rep += s.rep;
  for (let i = 0; i < 4; i++) a.repH[i] += (s.repH[i] || 0);
  return a;
}
function sumRange(start, end) {
  const agg = emptyAgg();
  let d = atMidnight(start); const last = atMidnight(end); let guard = 0;
  while (d.getTime() <= last.getTime() && guard < 4000) { addAgg(agg, dayStat(keyOf(d))); d = addDays(d, 1); guard++; }
  return agg;
}
// Le temps en reunion, en secondes, depuis meetingDaily { jour: { cle: minutes } }.
// meetingDaily { jour: { cle: [debut, fin] } } depuis le 2026-09-26, ou
// { cle: minutes } pour un historique plus ancien. Le temps du jour est
// l'UNION des intervalles : deux reunions qui se chevauchent, ou la meme
// reunion vue dans deux agendas, ne comptent qu'une fois.
function meetingDayParts(k) {
  const d = MEET[k];
  const iv = [], anciens = [];
  if (d && typeof d === "object") Object.keys(d).forEach((c) => {
    const v = d[c];
    if (Array.isArray(v) && v.length === 2 && Number(v[1]) > Number(v[0])) iv.push([Number(v[0]), Number(v[1])]);
    else if (Number(v) > 0) anciens.push(Number(v));
  });
  return { iv: iv, anciens: anciens };
}
function meetingSecDay(k) {
  const p = meetingDayParts(k);
  const iv = p.iv.slice().sort((a, b) => a[0] - b[0]);
  let ms = 0, cur = null;
  iv.forEach((x) => {
    if (!cur || x[0] > cur[1]) { if (cur) ms += cur[1] - cur[0]; cur = [x[0], x[1]]; }
    else if (x[1] > cur[1]) cur[1] = x[1];
  });
  if (cur) ms += cur[1] - cur[0];
  return Math.round(ms / 1000) + p.anciens.reduce((a, m) => a + m * 60, 0);
}
// Les reunions distinctes du jour : un meme creneau exact vu dans deux
// agendas ne compte qu'une fois.
function meetingCountDay(k) {
  const p = meetingDayParts(k);
  const vus = {};
  p.iv.forEach((x) => { vus[x[0] + "-" + x[1]] = true; });
  return Object.keys(vus).length + p.anciens.length;
}
function meetingCountRange(start, end) {
  let n = 0, d = atMidnight(start); const last = atMidnight(end); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) { n += meetingCountDay(keyOf(d)); d = addDays(d, 1); g++; }
  return n;
}
// Les mails du jour, mailDaily { jour: { in, out } }.
// mailDaily { jour: { in, out, read, del, done } }. Les jours mesures avant le
// 2026-09-26 n'ont que in et out : done vaut alors null, jamais un zero invente.
function mailDay(k) {
  const v = MAIL[k] || {};
  const n = (x) => Math.max(0, Number(x) || 0);
  return { in: n(v.in), out: n(v.out), del: n(v.del), done: v.done === undefined ? null : n(v.done) };
}
function mailRange(start, end) {
  const a = { in: 0, out: 0, del: 0, done: 0, jours: 0, joursDone: 0 }; let d = atMidnight(start); const last = atMidnight(end); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) {
    const k = keyOf(d);
    if (MAIL[k]) {
      const m = mailDay(k); a.in += m.in; a.out += m.out; a.jours++;
      if (m.done !== null) { a.done += m.done; a.del += m.del; a.joursDone++; }
    }
    d = addDays(d, 1); g++;
  }
  return a;
}
function hasMail() { return Object.keys(MAIL).length > 0; }
function meetingSecRange(start, end) {
  let sec = 0, d = atMidnight(start); const last = atMidnight(end); let g = 0;
  while (d.getTime() <= last.getTime() && g < 4000) { sec += meetingSecDay(keyOf(d)); d = addDays(d, 1); g++; }
  return sec;
}
function hasMeetings() {
  return Object.keys(MEET).some((k) => meetingSecDay(k) > 0);
}
// Sous la tuile : la part du temps d'ecran quand elle a un sens, sinon la
// moyenne par jour. Jamais un pourcentage au-dela de cent, qui ne voudrait
// rien dire (une reunion sans ecran devant soi).
function phraseReunion(meetSec, scrSec, days, count) {
  if (meetSec <= 0) return "";
  // Le nombre de reunions d'abord, puis leur rythme par semaine sur une
  // periode d'au moins deux semaines.
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n > 0) {
    const nb = (n === 1 ? msg("phMeetingOne", "1 réunion") : msg("phMeetingMany", "{n} réunions").replace("{n}", String(n)));
    if (days >= 14) return nb + " · " + msg("phMeetingPerWeek", "{n} par semaine").replace("{n}", fmtDec(Math.round((n / days) * 7 * 10) / 10));
    return nb;
  }
  if (scrSec > 0 && meetSec <= scrSec) return msg("phMeetingShare", "{p} % de ton temps d'écran").replace("{p}", String(Math.round((meetSec / scrSec) * 100)));
  return msg("phScreenAvg", "{d} en moyenne par jour").replace("{d}", fmtDurShort(Math.round(meetSec / Math.max(1, days))));
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

const PHRASE_MIN_REPORTS = 5;    // un creneau demande au moins 5 reports
const PHRASE_SEUIL_STABLE = 0.05; // sous 5 pour cent d'ecart, on ecrit stable

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
// 7. Le jour le plus charge de la semaine, 2026-09-26. Fonction PURE : elle
// recoit des jours { date, v } deja filtres (seulement les jours ou la donnee
// existe) et rend { wd, date, avg } pour le jour le plus charge, { even:
// true } si aucun jour ne se detache, ou null si la periode ne permet pas de
// conclure. Moyenne par jour de la semaine, jamais un total : un mois a cinq
// jeudis ne fait pas gagner le jeudi.
const BUSY_MIN_SEMAINES = 3;     // au moins trois semaines de donnees
const BUSY_MIN_JOURS = 21;       // et au moins 21 jours
const BUSY_SEUIL_ECART = 0.15;   // le premier doit depasser le second de 15 %
function jourLePlusCharge(jours) {
  const liste = (jours || []).filter((j) => j && j.date && typeof j.date.getTime === "function" && Number.isFinite(j.date.getTime()) && Number.isFinite(Number(j.v)));
  if (liste.length < BUSY_MIN_JOURS) return null;
  const semaines = {};
  liste.forEach((j) => { semaines[keyOf(monday(j.date))] = true; });
  if (Object.keys(semaines).length < BUSY_MIN_SEMAINES) return null;
  const groupes = [0, 1, 2, 3, 4, 5, 6].map(() => ({ s: 0, n: 0, date: null }));
  liste.forEach((j) => { const g = groupes[j.date.getDay()]; g.s += Math.max(0, Number(j.v)); g.n++; if (!g.date) g.date = j.date; });
  const moyennes = groupes.map((g, wd) => ({ wd: wd, date: g.date, avg: g.n ? g.s / g.n : 0 })).filter((m) => m.date);
  moyennes.sort((a, b) => b.avg - a.avg);
  const premier = moyennes[0], second = moyennes[1];
  if (!premier || premier.avg <= 0) return null;
  if (second && premier.avg < second.avg * (1 + BUSY_SEUIL_ECART)) return { even: true };
  return premier;
}
function phraseJourCharge(res, sorte) {
  if (!res) return null;
  if (res.even) return { t: sorte === "mail" ? msg("busyMailEven", "Tes mails sont répartis sur la semaine.") : msg("busyMeetEven", "Tes réunions sont réparties sur la semaine.") };
  const jour = nomDeJour(res.date);
  if (sorte === "mail") return { t: msg("busyMail", "Le {j} est ton jour le plus chargé : {n} mails traités en moyenne."), j: jour, n: String(Math.round(res.avg)) };
  return { t: msg("busyMeet", "Le {j} est ton jour le plus chargé : {n} de réunion en moyenne."), j: jour, n: fmtDurShort(Math.round(res.avg)) };
}
// Pose la phrase dans son emplacement, le jour et la valeur en gras.
function poseJourCharge(host, p) {
  clear(host);
  host.hidden = !p;
  if (!p) return;
  const morceaux = p.t.split(/(\{j\}|\{n\})/);
  morceaux.forEach((m) => {
    if (m === "{j}") host.appendChild(el("b", "", p.j));
    else if (m === "{n}") host.appendChild(el("b", "", p.n));
    else if (m) host.appendChild(document.createTextNode(m));
  });
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
  // 2026-09-26 : "1 habitude / 1 h 47" ne se comprenait pas. La phrase dit
  // maintenant ce qu'elle mesure : une habitude faite pour tant d'ecran.
  return msg("phPace", "Une habitude toutes les {d} d'écran").replace("{d}", fmtDurShort(Math.round(sec / done)));
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
  if (on) {
    ["panelSettings", "panelPerso", "panelStats", "panelData"].forEach((id) => { const n = $(id); if (n) n.hidden = true; });
  } else {
    // Au retour, l'onglet courant se reaffiche. Avant, les panneaux restaient
    // tous caches et le popup etait vide sous l'en-tete apres Commencer.
    showTab(currentTab || "settings");
  }
  if (on) {
    // Le koala du rappel, meme dessin que sur les pages. Il salue et cligne
    // des yeux ; animations coupees, sa version fixe.
    const anime = document.documentElement.classList.contains("anim-on");
    $("frKoala").src = anime ? "images/koala-hello.svg" : "images/koala-hello-still.svg";
    // Une habitude prereplie, jamais un champ vide, planche N. applyI18n()
    // a deja pose le placeholder localise, on le reprend comme valeur.
    if (!$("frHabit").value) $("frHabit").value = $("frHabit").placeholder || "";
    frPrepare();
    frStep(0);
  }
}

/* ---------- Onboarding, refait le 2026-10-30 ----------
   Un parcours court qui suit les choix (guide Apple : rapide, facultatif,
   de bons reglages par defaut, la configuration non essentielle remise a
   plus tard). Ce qui t'aide : quatre interrupteurs. Ta pause et son rythme,
   seulement si les rappels d'habitude sont allumes. L'agenda, seulement
   s'il est allume. Le resume pour finir. Continuer avance, Retour recule,
   Passer saute la connexion de l'agenda. */
const FR_ORDRE = ["choix", "habitude", "agenda", "fin"];
let frEtape = 0;
let frAgendaOk = false;
// L'etat de depart des interrupteurs : a la premiere installation, les
// valeurs par defaut ; quand on revoit la presentation, les reglages actuels.
let frDepart = { agenda: false };
function frParcours() {
  return FR_ORDRE.filter((n) => (n !== "habitude" || $("frOptHabits").checked) && (n !== "agenda" || $("frOptAgenda").checked));
}
function frRythme() {
  const b = document.querySelector("#frRhythm .seg-b--on") || document.querySelector('#frRhythm [data-min="30"]');
  return { min: Number(b.getAttribute("data-min")), preset: b.getAttribute("data-preset") };
}
function frPeintRythme(min) {
  document.querySelectorAll("#frRhythm .seg-b").forEach((b) => {
    const on = Number(b.getAttribute("data-min")) === min;
    b.classList.toggle("seg-b--on", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
    b.textContent = fmtMinutes(Number(b.getAttribute("data-min")));
  });
}
async function frPrepare() {
  const premiere = CFG.firstRun !== false;
  $("frOptHabits").checked = premiere || CFG.remindersEnabled !== false;
  $("frOptPassages").checked = premiere || CFG.passages !== false;
  $("frOptCharacter").checked = premiere || CFG.showCharacter !== false;
  $("frHeroK").classList.toggle("fr-hero--off", !$("frOptCharacter").checked);
  const actuel = clampInt(CFG.intervalMinutes, 1, 240, 30);
  frPeintRythme([25, 30, 52, 90].indexOf(actuel) >= 0 ? actuel : 30);
  // L'agenda : eteint a la premiere installation (il faut un compte
  // Infomaniak) ; allume en revoyant la presentation s'il est connecte et
  // qu'un de ses rappels ou son silence est actif, et alors deja « connecte ».
  $("frIkForm").hidden = false; $("frCals").hidden = true; $("frIkDone").hidden = true; frErreur("");
  frAgendaOk = false;
  frDepart = { agenda: false };
  $("frOptAgenda").checked = false;
  if (!premiere) {
    const st = await sendR("kz-agenda-status");
    const connecte = !!(st && st.configured && st.hasToken);
    frDepart.agenda = connecte && (st.warn !== false || st.endWarn !== false || !!st.enabled);
    $("frOptAgenda").checked = frDepart.agenda;
    if (connecte) { frAgendaOk = true; frFini([{ ok: true, t: msg("frIkAgenda", "Agenda connecté") }]); }
  }
  frStep(frEtape);
}
function frStep(n) {
  const parcours = frParcours();
  frEtape = Math.max(0, Math.min(parcours.length - 1, n));
  const nom = parcours[frEtape];
  document.querySelectorAll("#firstRun .fr-step").forEach((s) => { s.hidden = s.getAttribute("data-fr") !== nom; });
  // Autant de points que d'ecrans dans ce parcours.
  const dots = $("frDots");
  while (dots.children.length < parcours.length) dots.appendChild(document.createElement("i"));
  while (dots.children.length > parcours.length) dots.removeChild(dots.lastChild);
  Array.prototype.forEach.call(dots.children, (d, i) => { d.classList.toggle("on", i === frEtape); d.classList.toggle("fait", i < frEtape); });
  dots.setAttribute("aria-valuemax", String(parcours.length));
  dots.setAttribute("aria-valuenow", String(frEtape + 1));
  const derniere = nom === "fin";
  $("frBack").hidden = frEtape === 0;
  $("frStart").hidden = !derniere;
  // A l'etape de l'agenda, avant connexion, Continuer et Passer feraient la
  // meme chose : seul Passer s'affiche, Continuer vient une fois connecte.
  const ikEnAttente = nom === "agenda" && $("frIkDone").hidden;
  $("frSkip").hidden = !ikEnAttente;
  $("frNext").hidden = derniere || ikEnAttente;
  if (derniere) frResume();
  $("frDemoOpen").hidden = !$("frOptHabits").checked && !$("frOptAgenda").checked;
  if (!derniere && !$("frDemo").hidden) frDemoFerme();
  const cible = document.querySelector('#firstRun .fr-step[data-fr="' + nom + '"] input:not([type=checkbox]), #firstRun .fr-step[data-fr="' + nom + '"] .btn-main');
  try { if (cible && frEtape > 0) cible.focus(); } catch (e) { /* noop */ }
}
// Le resume : une ligne par choix, coche s'il est allume, trait s'il est
// eteint ou a faire plus tard.
function frResume() {
  const lignes = [];
  // Le nombre et son unite ne se separent jamais en fin de ligne.
  if ($("frOptHabits").checked) lignes.push({ ok: true, t: msg("frSumHabits", "Un rappel d'habitude toutes les {n}").replace("{n}", fmtMinutes(frRythme().min).replace(" ", "\u00a0")) });
  else lignes.push({ ok: false, t: msg("frSumHabitsOff", "Rappels d'habitude éteints") });
  if (!$("frOptAgenda").checked) lignes.push({ ok: false, t: msg("frSumAgendaOff", "Agenda Infomaniak éteint") });
  else if (frAgendaOk) lignes.push({ ok: true, t: msg("frSumAgenda", "Agenda Infomaniak, une bulle 5 min avant") });
  else lignes.push({ ok: false, t: msg("frSumAgendaLater", "Agenda Infomaniak à connecter plus tard, dans Réglages") });
  lignes.push($("frOptPassages").checked ? { ok: true, t: msg("frOptPassages", "Animaux de passage") } : { ok: false, t: msg("frSumPassagesOff", "Animaux de passage éteints") });
  lignes.push($("frOptCharacter").checked ? { ok: true, t: msg("frSumCharacter", "Le koala dans chaque bulle") } : { ok: true, t: msg("frSumCharacterOff", "Style sobre, sans personnage") });
  const host = $("frSummary"); clear(host);
  lignes.forEach((l) => {
    const row = el("div", "fr-res" + (l.ok ? "" : " fr-res--later"));
    const i = el("span", "fr-res-i"); const ic = svgNode(l.ok ? FR_CHECK : FR_LATER); if (ic) i.appendChild(ic);
    row.appendChild(i); row.appendChild(el("span", "fr-res-t", l.t));
    host.appendChild(row);
  });
}
["frOptHabits", "frOptAgenda", "frOptPassages", "frOptCharacter"].forEach((id) => {
  $(id).addEventListener("change", () => {
    if (id === "frOptCharacter") $("frHeroK").classList.toggle("fr-hero--off", !$(id).checked);
    frStep(frEtape);
  });
});
document.querySelectorAll("#frRhythm .seg-b").forEach((b) => {
  b.addEventListener("click", () => frPeintRythme(Number(b.getAttribute("data-min"))));
});
// L'apercu de la bulle (2026-10-30) : le rappel d'habitude s'il est allume,
// sinon celui de l'agenda, avec le koala ou en style sobre selon le choix.
// Il reprend la forme et les couleurs des bulles de la page, qui restent
// claires quel que soit le theme du popup.
function frDemoRender() {
  const habitudes = $("frOptHabits").checked;
  const sobre = !$("frOptCharacter").checked;
  const zone = $("frDemoZone"); clear(zone);
  const b = el("div", "demo-b" + (habitudes ? "" : " demo-b--meet") + (sobre ? " demo-b--pro" : ""));
  b.setAttribute("aria-hidden", "true");
  const pill = el("div", "demo-pill");
  pill.appendChild(el("i"));
  if (habitudes) {
    pill.appendChild(document.createTextNode(sobre ? msg("proEyebrowHabit", "Pause conseillée") : msg("bubblePillHabit", "Coucou, c'est l'heure")));
    b.appendChild(pill);
    b.appendChild(el("div", "demo-lead", String($("frHabit").value || $("frHabit").placeholder || "").trim()));
    const jour = el("div", "demo-day");
    for (let i = 0; i < 3; i++) jour.appendChild(el("i", i === 0 ? "on" : ""));
    b.appendChild(jour);
  } else {
    pill.appendChild(document.createTextNode(msg("meetingSoonPill", "Rendez-vous dans {n} min").replace("{n}", "5")));
    b.appendChild(pill);
    b.appendChild(el("div", "demo-lead", msg("frDemoMeeting", "Point d'équipe")));
  }
  const act = el("div", "demo-act");
  act.appendChild(el("span", "demo-done", habitudes ? msg("btnDone", "C'est fait") : msg("meetingJoin", "Rejoindre la visio")));
  act.appendChild(el("span", "demo-later", habitudes ? msg("btnLater", "Plus tard") : msg("meetingClose", "Fermer")));
  b.appendChild(act);
  zone.appendChild(b);
  if (!sobre) {
    const k = el("img", "demo-k"); k.src = "images/koala-hello-still.svg"; k.alt = "";
    zone.appendChild(k);
  }
  $("frDemoTitle").textContent = habitudes ? msg("frDemoTitle", "Voici ton rappel") : msg("frDemoTitleMeet", "Voici un rappel de rendez-vous");
  $("frDemoNote").textContent = msg("frDemoNote", "Il arrive en bas à droite de la page et reste jusqu'à ta réponse.");
}
let frDemoDesarme = null;
function frDemoOuvre() {
  frDemoRender();
  $("frDemo").hidden = false;
  try { $("frDemoClose").focus(); } catch (e) { /* noop */ }
  const h = (e) => { if (e.key === "Escape") { e.preventDefault(); frDemoFerme(); } };
  document.addEventListener("keydown", h);
  frDemoDesarme = () => document.removeEventListener("keydown", h);
}
function frDemoFerme() {
  $("frDemo").hidden = true;
  if (frDemoDesarme) { frDemoDesarme(); frDemoDesarme = null; }
  try { $("frDemoOpen").focus(); } catch (e) { /* noop */ }
}
$("frDemoOpen").addEventListener("click", frDemoOuvre);
$("frDemoClose").addEventListener("click", frDemoFerme);

$("frNext").addEventListener("click", () => frStep(frEtape + 1));
$("frBack").addEventListener("click", () => frStep(frEtape - 1));
$("frSkip").addEventListener("click", () => frStep(frEtape + 1));
$("frTokenShow").addEventListener("click", () => {
  const c = $("frToken"); const vu = c.type === "text";
  c.type = vu ? "password" : "text";
  $("frTokenShow").textContent = vu ? msg("tokenShow", "Afficher") : msg("tokenHide", "Masquer");
});
function frErreur(texte) { $("frIkErr").textContent = texte || ""; $("frIkErr").hidden = !texte; }
// Le resultat de la connexion : un titre, puis une ligne par service, coche
// verte si c'est fait, gris si c'est pour plus tard.
const FR_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const FR_LATER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 12h12"/></svg>';
function frFini(lignes) {
  $("frIkForm").hidden = true; $("frCals").hidden = true;
  const host = $("frIkDone"); clear(host);
  host.appendChild(el("div", "fr-done-t", msg("frIkDoneTitle", "C'est connecté")));
  lignes.forEach((l) => {
    const row = el("div", "fr-res" + (l.ok ? "" : " fr-res--later"));
    const i = el("span", "fr-res-i"); const ic = svgNode(l.ok ? FR_CHECK : FR_LATER); if (ic) i.appendChild(ic);
    row.appendChild(i); row.appendChild(el("span", "fr-res-t", l.t));
    host.appendChild(row);
  });
  host.hidden = false;
  frStep(frEtape);
}
// Etape agenda : un jeton saisi, verifie par le fond (il doit lire les
// agendas et n'ouvrir ni le mail ni kDrive), puis les agendas a cocher.
function frAgendas(calendars) {
  $("frIkForm").hidden = true;
  $("frCals").hidden = false;
  const host = $("frCalList"); clear(host);
  const coches = {};
  calendars.forEach((c) => {
    const row = el("div", "bq bq--pick"); row.setAttribute("role", "checkbox"); row.setAttribute("tabindex", "0");
    row.appendChild(el("span", "bq-ck", "✓"));
    const b = el("div", "bq-b"); b.appendChild(el("div", "bq-t", c.name));
    if (c.isDefault) b.appendChild(el("div", "bq-a", msg("agendaDefaultTag", "Agenda par défaut")));
    row.appendChild(b);
    if (c.isDefault) coches[c.id] = c.name;
    const peint = () => { row.classList.toggle("bq--on", !!coches[c.id]); row.setAttribute("aria-checked", coches[c.id] ? "true" : "false"); $("frCalOk").disabled = !Object.keys(coches).length; };
    const bascule = () => { if (coches[c.id]) delete coches[c.id]; else coches[c.id] = c.name; peint(); };
    row.addEventListener("click", bascule);
    row.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); bascule(); } });
    peint(); host.appendChild(row);
  });
  $("frCalOk").onclick = async () => {
    const choix = Object.keys(coches).map((id) => ({ id: Number(id), name: coches[id] }));
    if (!choix.length) return;
    $("frCalOk").disabled = true;
    const c = await sendR("kz-agenda-choose", { calendars: choix });
    if (!c || !c.ok) { $("frCalOk").disabled = false; frErreur(ikErrText(c && c.error, "calendar")); return; }
    frAgendaOk = true;
    frFini([{ ok: true, t: msg("frIkAgenda", "Agenda connecté") }, { ok: false, t: msg("frIkMailLater", "Mail : plus tard, carte Agenda, avec son propre jeton") }]);
  };
}
$("frConnect").addEventListener("click", async () => {
  const token = $("frToken").value.trim();
  frErreur("");
  if (!token) { frErreur(ikErrText("empty_token", "calendar")); return; }
  $("frConnect").disabled = true;
  const r = await sendR("kz-agenda-connect", { token: token });
  $("frConnect").disabled = false;
  // Le jeton quitte le champ quoi qu'il arrive.
  $("frToken").value = "";
  if (!r || !r.ok) { frErreur(ikErrText(r && r.error, "calendar", r && r.extras)); return; }
  if (r.needsChoice && Array.isArray(r.calendars)) { frAgendas(r.calendars); return; }
  frAgendaOk = true;
  frFini([{ ok: true, t: msg("frIkAgenda", "Agenda connecté") }, { ok: false, t: msg("frIkMailLater", "Mail : plus tard, carte Agenda, avec son propre jeton") }]);
});
// Commencer enregistre les choix d'un coup, et le popup les montre aussitot.
// L'agenda n'est touche que si son interrupteur a change : l'eteindre coupe
// ses rappels et son silence sans oublier la connexion ; le laisser eteint a
// la premiere installation ne change rien, et le connecter plus tard dans
// Reglages donne bien les rappels.
$("frStart").addEventListener("click", async () => {
  const habitudes = $("frOptHabits").checked;
  const agenda = $("frOptAgenda").checked;
  const payload = { firstRun: false, remindersEnabled: habitudes, passages: $("frOptPassages").checked, showCharacter: $("frOptCharacter").checked };
  if (habitudes) {
    const v = String($("frHabit").value || $("frHabit").placeholder || "").trim();
    if (v && customSport.indexOf(v) === -1) customSport.push(v);
    payload.customSport = customSport;
    const r = frRythme();
    payload.intervalMinutes = r.min;
    payload.preset = r.preset;
    if (r.preset === "custom") payload.customInterval = r.min;
  }
  if (agenda !== frDepart.agenda) {
    payload.agendaWarn = agenda;
    payload.agendaEndWarn = agenda;
    if (!agenda) payload.agendaEnabled = false;
  }
  await send("kz-save", { payload: payload });
  CFG = Object.assign(CFG, payload);
  // Le popup reflete les choix sans etre rouvert.
  $("remindersTgl").checked = habitudes;
  $("passagesTgl").checked = payload.passages;
  $("characterTgl").checked = payload.showCharacter;
  if (habitudes) {
    if (payload.preset === "custom") customMinutes = payload.intervalMinutes;
    setInterval2(payload.intervalMinutes, payload.preset);
  }
  renderSport();
  paintReminders();
  paintPassagesFreqWrap();
  paintCharacter();
  showFirstRun(false);
  try { await agendaRefreshUI(); } catch (e) { /* noop */ }
  await refreshNextVisit();
});
$("replayTour").addEventListener("click", () => { showFirstRun(true); });

// Sans rappels d'habitude, l'ecran vit du temps d'ecran, des reunions et des
// mails : il n'est vide que s'il n'a rien de tout cela.
function hasOtherHistory() {
  return Object.keys(SCREEN).some((k) => Number(SCREEN[k]) > 0) || hasMeetings() || hasMail();
}
function renderStats() {
  const habitudes = habitsOn();
  const empty = habitudes ? !hasHistory() : !hasOtherHistory();
  $("statsBlank").hidden = !empty;
  $("statsSoon").hidden = !empty;
  $("statsGhost").hidden = !empty;
  $("statsTiles").hidden = empty;
  $("streakCard").hidden = empty;
  // Sans aucune donnee, il n'y a rien a filtrer. On masque le segmente ET la
   // ligne des fleches, sinon deux boutons ronds encadrent une date vide.
  const boiteFiltre = document.querySelector(".segbox--range");
  if (boiteFiltre) boiteFiltre.hidden = empty;
  const ligneNav = document.querySelector(".nav");
  if (ligneNav) ligneNav.hidden = empty;
  $("streakTiles").hidden = empty || !habitudes;
  $("totalHead").hidden = empty;
  if (empty) {
    $("chartsCard").hidden = true;
    $("trendNote").hidden = true;
    // L'ecran vide parle du koala et de la premiere habitude : sans rappels
    // d'habitude, il ne parle que du temps d'ecran.
    $("statsSoon").hidden = !habitudes;
    $("statsGhost").hidden = !habitudes;
    $("blankNow").hidden = !habitudes;
    if (habitudes) renderBlankStats();
    else $("blankSub").textContent = msg("blankSubNoHabits", "Ton temps d'écran s'affiche ici dès aujourd'hui.");
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
    : (days === 1 ? msg("stTotalOne", "Total du jour") : msg("stTotalOf", "Total des {n} jours").replace("{n}", String(days)));

  countUp($("statDone"), agg.done, 0);
  countUp($("statRep"), agg.rep, 0);
  const scr = screenSecRange(range[0], range[1]);
  $("statScreen").textContent = scr > 0 ? fmtDurTile(scr) : "—";

  // Sous lignes des tuiles
  const pr = prevRangeFor(statsKind, statsOffset);
  const donePrev = pr ? sumRange(pr[0], pr[1]).done : null;
  $("statDoneSub").textContent = phraseEcart(agg.done, donePrev, statsKind);
  $("statRepSub").textContent = phraseCreneau(agg.repH);
  $("statScreenSub").textContent = phraseEcran(scr, days);

  // Le temps en reunion, seulement quand l'agenda en a fourni.
  const montrerReu = hasMeetings();
  $("meetTile").hidden = !montrerReu;
  // Sans reunions, l'ecran prend la ligne entiere : jamais de case vide.
  document.querySelector("#statsTiles .tile--scr").classList.toggle("tile--wide", !montrerReu);
  if (montrerReu) {
    const meet = meetingSecRange(range[0], range[1]);
    $("statMeet").textContent = meet > 0 ? fmtDurTile(meet) : "—";
    $("statMeetSub").textContent = phraseReunion(meet, scr, days, meetingCountRange(range[0], range[1]));
  }
  const montrerMail = hasMail();
  $("mailInTile").hidden = !montrerMail;
  $("mailOutTile").hidden = !montrerMail;
  if (montrerMail) {
    const ma = mailRange(range[0], range[1]);
    // 2026-09-26, choix produit : les mails TRAITES (lus ou
    // supprimes) plutot que les recus, plus parlants. Les recus restent en
    // sous-titre, avec les supprimes.
    $("statMailIn").textContent = ma.joursDone ? String(ma.done) : "—";
    $("statMailOut").textContent = ma.jours ? String(ma.out) : "—";
    $("statMailInSub").textContent = ma.joursDone
      ? msg("phMailDone", "dont {d} supprimés, sur {n} reçus").replace("{d}", String(ma.del)).replace("{n}", String(ma.in))
      : "";
    $("statMailOutSub").textContent = ma.jours > 1 ? msg("phPerDay", "{n} par jour en moyenne").replace("{n}", fmtDec(Math.round((ma.out / ma.jours) * 10) / 10)) : "";
  }

  // Les deux tuiles de serie. La meilleure porte sur la periode, le record est
  // tous temps confondus, c'est la seule chose qui ignore le filtre.
  const b = serieBornes(range[0], range[1]);
  $("statBest").textContent = String(b ? b.n : 0);
  $("statBestUnit").textContent = (b && b.n === 1) ? msg("dayWord", "jour") : msg("daysWord", "jours");
  $("statBestSub").textContent = phraseSerie(b);
  const rec = recordTousTemps();
  $("statRecord").textContent = String(rec ? rec.n : 0);
  $("statRecordUnit").textContent = (rec && rec.n === 1) ? msg("dayWord", "jour") : msg("daysWord", "jours");
  $("statRecordSub").textContent = phraseRecord(rec ? rec.fin : null);

  // Cadence
  $("cadenceText").textContent = (habitudes && scr >= 600) ? phraseCadence(scr, agg.done) : "";

  renderTrend(period, range);
  renderStreak();
  // Rappels d'habitude eteints : ni habitudes, ni serie, ni leur graphe.
  document.querySelector("#statsTiles .tile--done").hidden = !habitudes;
  document.querySelector("#statsTiles .tile--rep").hidden = !habitudes;
  $("streakCard").hidden = !habitudes;
  $("chHabits").hidden = !habitudes;
}
function dayBuckets(range) {
  const out = []; const days = rangeDays(range);
  let d = atMidnight(range[0]); const last = atMidnight(range[1]); let g = 0;
  while (d.getTime() <= last.getTime() && g < 400) {
    const s = dayStat(keyOf(d));
    const dom = d.getDate();
    const label = (days <= 7) ? weekdayLetter(d) : ((dom === 1 || dom % 5 === 1) ? String(dom) : "");
    out.push({ done: s.done, rep: s.rep, scr: (Number(SCREEN[keyOf(d)]) || 0), meet: meetingSecDay(keyOf(d)), mail: mailDay(keyOf(d)), label: label });
    d = addDays(d, 1); g++;
  }
  return out;
}
// Le graphe par mois de la vue "Tout" garde les derniers mois qui tiennent a
// l'ecran, les tuiles au-dessus totalisent quand meme tout l'historique.
const MAX_MONTH_BARS = 24;
function monthBuckets(range) {
  const end = atMidnight(range[1]);
  const total = (end.getFullYear() - range[0].getFullYear()) * 12 + (end.getMonth() - range[0].getMonth()) + 1;
  const n = Math.min(MAX_MONTH_BARS, Math.max(1, total));
  let y = end.getFullYear(), m = end.getMonth() - (n - 1);
  while (m < 0) { m += 12; y -= 1; }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = sumRange(new Date(y, m, 1), new Date(y, m + 1, 0));
    const mm = mailRange(new Date(y, m, 1), new Date(y, m + 1, 0));
    out.push({ done: a.done, rep: a.rep, scr: screenSecRange(new Date(y, m, 1), new Date(y, m + 1, 0)), meet: meetingSecRange(new Date(y, m, 1), new Date(y, m + 1, 0)), mail: { in: mm.in, out: mm.out, done: mm.done }, label: monthLabel(y, m) });
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}
// La hauteur commune des quatre graphes, 2026-09-26. Une seule valeur, dans
// le CSS (.plot, .cols, .col) et ici.
const PLOT_H = 64;

// Dessine un graphe en colonnes : une colonne par periode, une barre par
// serie, toutes de la meme largeur, grandissant depuis la meme ligne de
// base. Une valeur nulle pose une marque de 2 px, jamais un vide. L'echelle
// part de zero et s'arrete au maximum (ou a l'objectif s'il est plus haut).
function drawColumns(host, buckets, series, maxVal, targets) {
  clear(host);
  const max = Math.max(1, maxVal);
  buckets.forEach((b, i) => {
    const col = el("div", "col");
    series.forEach((s, k) => {
      const v = Math.max(0, Number(s.val(b)) || 0);
      const bar = el("div", "col-b " + (v > 0 ? s.cls : "col-b--zero"));
      bar.style.height = (v > 0 ? Math.max(3, Math.round((v / max) * PLOT_H)) : 2) + "px";
      bar.title = s.label(v);
      if (v > 0 && !REDUCE_MOTION && !barresMontees) { bar.style.transform = "scaleY(0)"; bar.style.transitionDelay = (i * 18 + k * 8) + "ms"; targets.push(bar); }
      col.appendChild(bar);
    });
    host.appendChild(col);
  });
}
function maxDe(buckets, fns) { return Math.max.apply(null, [0].concat(buckets.map((b) => Math.max.apply(null, fns.map((f) => Number(f(b)) || 0))))); }

let barresMontees = false;
function renderTrend(period, range) {
  // Une seule journee, un graphe par jour n'aurait qu'une colonne.
  const single = (period === "day");
  $("chartsCard").hidden = single;
  $("trendNote").hidden = !single;
  if (single) return;

  const days = rangeDays(range);
  const monthly = (period === "all" || days > 45);
  const buckets = monthly ? monthBuckets(range) : dayBuckets(range);
  const targets = [];

  // 1. Habitudes : faites et reportees cote a cote, avec l'objectif du jour
  // en pointille (seulement en granularite jour, l'objectif est quotidien).
  const showGoal = !monthly && habitGoal > 0;
  const maxBar = maxDe(buckets, [(b) => b.done, (b) => b.rep]);
  const maxVal = showGoal ? Math.max(maxBar, habitGoal) : Math.max(1, maxBar);
  $("goalLegend").hidden = !showGoal;
  $("goalLine").hidden = !showGoal;
  if (showGoal) {
    $("goalLegendText").textContent = msg("statsGoalLegend", "Objectif : {n} par jour").replace("{n}", habitGoal);
    $("goalLine").style.bottom = Math.round((habitGoal / maxVal) * PLOT_H) + "px";
  }
  drawColumns($("trendChart"), buckets, [
    { val: (b) => b.done, cls: "col-b--done", label: (v) => v + " " + msg("statsDoneWord", "Faites").toLowerCase() },
    { val: (b) => b.rep, cls: "col-b--rep", label: (v) => v + " " + msg("statsReportsWord", "Reportées").toLowerCase() }
  ], maxVal, targets);
  fillAxis($("trendAxis"), buckets);

  // 2. Temps d'ecran : une serie, la cadence dessous. Les quatre graphes ont
  // le meme en-tete (titre, legende des qu'il y a deux series) et aucun total :
  // les tuiles juste au-dessus le donnent deja (revue du 2026-09-26).
  drawColumns($("screenChart"), buckets, [{ val: (b) => b.scr, cls: "col-b--scr", label: (v) => (v > 0 ? fmtDurShort(v) : "0") }], maxDe(buckets, [(b) => b.scr]), targets);
  fillAxis($("screenAxis"), buckets);

  // 3. Temps en reunion, seulement si l'agenda en a fourni.
  const montrerReu = hasMeetings();
  $("meetChartWrap").hidden = !montrerReu;
  if (montrerReu) {
    drawColumns($("meetChart"), buckets, [{ val: (b) => b.meet, cls: "col-b--meet", label: (v) => (v > 0 ? fmtDurShort(v) : "0") }], maxDe(buckets, [(b) => b.meet]), targets);
    fillAxis($("meetAxis"), buckets);
    const premier = Object.keys(MEET).sort()[0];
    const joursReu = [];
    let dr = atMidnight(range[0]); const finR = atMidnight(range[1]); let gr = 0;
    while (dr.getTime() <= finR.getTime() && gr < 4000) { if (premier && keyOf(dr) >= premier) joursReu.push({ date: new Date(dr), v: meetingSecDay(keyOf(dr)) }); dr = addDays(dr, 1); gr++; }
    poseJourCharge($("meetBusy"), phraseJourCharge(jourLePlusCharge(joursReu), "meet"));
  }

  // 4. Mails, recus et envoyes cote a cote, seulement s'ils sont comptes.
  const montrerMail = hasMail();
  $("mailChartWrap").hidden = !montrerMail;
  if (montrerMail) {
    const mi = (b) => (b.mail || {}).done || 0, mo = (b) => (b.mail || {}).out || 0;
    drawColumns($("mailChart"), buckets, [
      { val: mi, cls: "col-b--in", label: (v) => v + " " + msg("statsMailDoneWord", "Traités").toLowerCase() },
      { val: mo, cls: "col-b--out", label: (v) => v + " " + msg("statsMailOutWord", "Envoyés").toLowerCase() }
    ], maxDe(buckets, [mi, mo]), targets);
    fillAxis($("mailAxis"), buckets);
    const joursMail = [];
    let dm = atMidnight(range[0]); const finM = atMidnight(range[1]); let gm = 0;
    while (dm.getTime() <= finM.getTime() && gm < 4000) { if (MAIL[keyOf(dm)]) joursMail.push({ date: new Date(dm), v: (function (m) { return m.done !== null ? m.done : m.in; })(mailDay(keyOf(dm))) }); dm = addDays(dm, 1); gm++; }
    poseJourCharge($("mailBusy"), phraseJourCharge(jourLePlusCharge(joursMail), "mail"));
  }

  if (!REDUCE_MOTION && targets.length) {
    requestAnimationFrame(() => requestAnimationFrame(() => targets.forEach((n) => { n.style.transform = "scaleY(1)"; })));
  }
  // 2026-10-30 : les barres montent une seule fois, la premiere fois qu'elles
  // apparaissent (la vue Jour n'en montre pas). Changer de periode ensuite les
  // montre aussitot (guide Apple : pas de mouvement sur ce qu'on refait souvent).
  if (targets.length) barresMontees = true;
}
function fillAxis(host, buckets) {
  clear(host);
  buckets.forEach((b) => host.appendChild(el("div", "ax", b.label || "")));
}

function renderStreak() {
  const cur = currentStreak();
  const rec = longestStreak();
  $("statStreak").textContent = String(cur);
  $("statStreakUnit").textContent = (Number(cur) === 1) ? msg("statsStreakDay", "jour de suite") : msg("statsStreakDays", "jours de suite");
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
    stats: byteSize({ statsDaily: STATS, screenDaily: SCREEN, meetingDaily: MEET, mailDaily: MAIL }),
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
  $("historyDays").textContent = nDays > 1
    ? msg("historyDays", "{n} jours").replace("{n}", nDays)
    : (nDays === 1 ? msg("historyDayOne", "1 jour") : msg("historyEmpty", "Rien pour l'instant"));

  document.querySelectorAll("#partList .cbx").forEach((b) => b.classList.toggle("cbx--on", !!exportParts[b.getAttribute("data-part")]));
  $("backupPassRow").hidden = !exportParts.connexions;
  document.querySelectorAll("#importSeg .seg-b").forEach((b) => b.classList.toggle("seg-b--on", b.getAttribute("data-mode") === importMode));
}
document.querySelectorAll("#partList .cbx").forEach((b) => {
  b.addEventListener("click", () => {
    const k = b.getAttribute("data-part");
    exportParts[k] = !exportParts[k];
    b.classList.toggle("cbx--on", exportParts[k]);
    if (k === "connexions") { $("backupPassRow").hidden = !exportParts.connexions; if (exportParts.connexions) { passCompteur(); try { $("backupPass").focus(); } catch (e) { /* noop */ } } }
  });
});
// Le compteur dit ce qui manque, sans jamais afficher la phrase elle-meme.
function passCompteur() {
  const n = $("backupPass").value.length;
  const node = $("backupPassCount");
  node.textContent = n >= PASS_MIN
    ? msg("backupPassOk", "Longueur suffisante.")
    : msg("backupPassLeft", "Encore {n} caractères au minimum.").replace("{n}", String(PASS_MIN - n));
}
$("backupPass").addEventListener("input", passCompteur);
$("backupPassShow").addEventListener("click", () => {
  const champ = $("backupPass");
  const affiche = champ.type === "text";
  champ.type = affiche ? "password" : "text";
  $("backupPassShow").textContent = affiche ? msg("tokenShow", "Afficher") : msg("tokenHide", "Masquer");
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
// Construit le paquet du fichier local, seule destination depuis le 2026-09-29.
async function buildExportBundle() {
  const stored = await getLocal(SETTINGS_KEYS.concat(CONTENT_KEYS, STATS_KEYS, KOALA_KEYS));
  const cfg = Object.assign({}, DEFAULTS, stored);
  const out = { app: "koala-zen", format: 1, exportedAt: new Date().toISOString(), build: manifestVersion() };
  if (exportParts.settings) { out.settings = {}; SETTINGS_KEYS.forEach((k) => { out.settings[k] = cfg[k]; }); }
  if (exportParts.content) { out.content = {}; CONTENT_KEYS.forEach((k) => { out.content[k] = cfg[k]; }); }
  if (exportParts.stats) { out.stats = {}; STATS_KEYS.forEach((k) => { out.stats[k] = cfg[k]; }); }
  if (exportParts.koalas) { out.koalas = {}; KOALA_KEYS.forEach((k) => { out.koalas[k] = cfg[k]; }); }
  // Les connexions : chiffrees par le fond avec la phrase secrete, jamais en
  // clair ici. Sans phrase, la partie est laissee de cote et on le dit.
  if (exportParts.connexions) {
    const pass = $("backupPass").value;
    const r = pass ? await sendR("kz-connexions-export", { passphrase: pass }) : null;
    if (r && r.ok) out.connexions = r.blob;
  }
  return out;
}
// Avant un export qui inclut les connexions : la phrase doit etre la.
// 2026-09-29 : 12 caracteres au moins, comme le fond (CONNEXIONS_MIN_PASS).
const PASS_MIN = 12;
function connexionsPretes() {
  if (!exportParts.connexions) return true;
  const pass = $("backupPass").value;
  if (pass.length >= PASS_MIN) return true;
  dataMsg(msg("backupPassMissing", "Ta phrase secrète doit faire au moins 12 caractères pour inclure les connexions.").replace("{n}", String(PASS_MIN)), true);
  try { $("backupPass").focus(); } catch (e) { /* noop */ }
  return false;
}
let importConnexionsNote = "";

// Applique un paquet deja analyse (fichier local), avec la logique de
// fusion ou de remplacement choisie. Rend
// false si le paquet n'est pas reconnu, jamais une exception.
async function applyImportedBundle(data) {
  if (!data || data.app !== "koala-zen") return false;
  const patch = {};
  const replace = importMode === "replace";
  if (data.settings) SETTINGS_KEYS.forEach((k) => { if (data.settings[k] !== undefined) patch[k] = data.settings[k]; });
  if (data.koalas) {
    KOALA_KEYS.forEach((k) => { if (data.koalas[k] !== undefined) patch[k] = data.koalas[k]; });
    if (patch.customKoalas !== undefined) {
      // Seules des images integrees (data:image) entrent : une adresse http
      // glissee dans un fichier ferait sortir une requete a chaque page visitee,
      // contre la promesse "rien ne sort de ton appareil". Fusionner garde les
      // images deja en place, comme pour les citations et les objectifs, et le
      // plafond s'applique au total, sinon la tuile d'ajout disparaissait et le
      // stockage gonflait sans qu'on puisse rien retirer.
      const entrants = Array.isArray(patch.customKoalas)
        ? patch.customKoalas.filter((x) => typeof x === "string" && /^data:image\//i.test(x))
        : [];
      const base = replace ? [] : customKoalas.filter((x) => typeof x === "string");
      entrants.forEach((x) => { if (base.indexOf(x) < 0) base.push(x); });
      patch.customKoalas = base.slice(0, MAX_KOALAS);
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
      patch.meetingDaily = Object.assign({}, data.stats.meetingDaily || {}, MEET);
      patch.mailDaily = Object.assign({}, data.stats.mailDaily || {}, MAIL);
    }
  }
  await setLocal(patch);
  // Les connexions chiffrees : seulement avec la phrase secrete, par le fond.
  importConnexionsNote = "";
  if (data.connexions) {
    const pass = $("backupPass").value;
    if (!pass) importConnexionsNote = msg("connexionsSkipped", "Connexions non restaurées : il manque la phrase secrète.");
    else {
      const r = await sendR("kz-connexions-import", { blob: data.connexions, passphrase: pass });
      importConnexionsNote = (r && r.ok)
        ? (r.tokensSkipped ? msg("connexionsOldTokens", "Réglages des connexions restaurés. Colle de nouveaux jetons, ceux de ce fichier avaient trop de droits.")
          : r.tokensUnchecked ? msg("connexionsUnchecked", "Réglages restaurés. Jetons non vérifiés : colle-les à nouveau dans la carte Agenda.")
          : msg("connexionsRestored", "Connexions restaurées"))
        : msg("connexionsBadPass", "Phrase secrète incorrecte. Connexions non restaurées.");
    }
  }
  if (data.connexions) { $("backupPass").value = ""; passCompteur(); }
  await send("kz-save", { payload: {} });
  await load();
  renderData();
  return true;
}
$("exportBtn").addEventListener("click", async () => {
  if (!connexionsPretes()) return;
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
  // La phrase secrete ne reste pas dans le champ.
  $("backupPass").value = ""; passCompteur();
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
  dataMsg(importConnexionsNote ? msg("importDone", "Données restaurées") + " · " + importConnexionsNote : msg("importDone", "Données restaurées"), !!importConnexionsNote && importConnexionsNote !== msg("connexionsRestored", "Connexions restaurées"));
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
  STATS = {}; SCREEN = {};
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
   JETONS INFOMANIAK. Les jetons et toute la logique reseau vivent dans
   background.js, jamais ici : le popup ne fait que demander et afficher.
   ================================================================ */
// send() ignore toujours la reponse de sendResponse, il ne sert qu'a
// declencher une action. Les operations sur les jetons ont besoin de la reponse
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
// Ce a quoi sert un jeton, pour les messages : l'agenda ou le mail.
function ikUsage(nom) {
  if (nom === "calendar") return msg("scopeCalendar", "l'agenda");
  if (nom === "mail") return msg("scopeMail", "le mail");
  if (nom === "kdrive") return msg("scopeKdrive", "kDrive");
  return String(nom || "");
}
// besoin : "calendar" ou "mail", le perimetre attendu dans ce contexte.
function ikErrText(code, besoin, extras) {
  const perimetre = besoin === "mail" ? "workspace:mail" : "workspace:calendar";
  if (code === "empty_token") return msg("tokenErrEmpty", "Colle d'abord un jeton.");
  if (code === "invalid_token") return msg("tokenErrInvalid", "Ce jeton ne fonctionne pas. Vérifie qu'il est actif et copié en entier.");
  if (code === "offline") return msg("tokenErrOffline", "Impossible de joindre Infomaniak. Vérifie ta connexion.");
  if (code === "blocked") return msg("tokenErrBlocked", "La requête a été bloquée de façon inattendue. Réessaie.");
  if (code === "not_configured") return msg("tokenErrNotConfigured", "Aucun jeton enregistré pour l'instant.");
  if (code === "missing_scope") return msg("tokenErrScope", "Ce jeton n'a pas le périmètre {s}.").replace("{s}", perimetre);
  if (code === "probe_failed") return msg("tokenErrProbe", "Impossible de vérifier les droits de ce jeton. Vérifie ta connexion et réessaie.");
  if (code === "too_broad") return msg("tokenErrBroad", "Ce jeton ouvre aussi {x}. Crée-en un avec le seul périmètre {s}.").replace("{x}", (extras || []).map(ikUsage).join(", ")).replace("{s}", perimetre);
  if (code === "no_calendar") return msg("agendaErrNoCalendar", "Aucun agenda lisible sur ce compte.");
  if (code === "no_mailbox") return msg("notifyErrNoMailbox", "Aucune boîte mail sur ce compte.");
  if (code === "notify_off") return msg("notifyErrOff", "Active « Prévenir les participants » dans Koala Zen.");
  if (code === "no_recipients") return msg("notifyNoRecipients", "Personne à prévenir.");
  if (code === "not_allowed") return msg("tokenErrNotAllowed", "Koala Zen a refusé cet appel : il ne fait pas partie de ses usages.");
  if (code === "rate_limited") return msg("notifyErrRate", "Trop d'envois en peu de temps. Réessaie dans un moment.");
  if (code === "bad_recipients") return msg("notifyErrRecipients", "Un destinataire ne fait pas partie des invités. Rien n'est parti.");
  if (code === "already_sent") return msg("notifyAlready", "Déjà envoyé");
  return msg("tokenErrUnknown", "Une erreur inattendue est survenue ({c}).").replace("{c}", code || "?");
}
function ikToast(node, text, warn) {
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

/* ---------- Agenda Infomaniak, carte Ne pas deranger ---------- */
// Trois vues exclusives sous l'interrupteur : jeton a saisir ou a reutiliser
// (agendaSetup), choix de l'agenda (agendaPicker), connecte (agendaConnected).
// La boite entiere reste cachee tant que l'interrupteur est eteint. Meme
// vocabulaire visuel que les autres cartes de Reglages.
function agendaHeure(ts) {
  const d = new Date(ts);
  const auj = new Date();
  const meme = d.getFullYear() === auj.getFullYear() && d.getMonth() === auj.getMonth() && d.getDate() === auj.getDate();
  const h = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  if (meme) return h;
  let jour = "";
  try { jour = d.toLocaleDateString(uiLang() || undefined, { weekday: "short", day: "numeric" }); } catch (e) { jour = pad2(d.getDate()) + "." + pad2(d.getMonth() + 1); }
  return jour + " " + h;
}

// 2026-09-17 : la connexion a l'agenda vit dans sa propre carte "Agenda
// Infomaniak". La carte "Ne pas deranger" ne garde que l'interrupteur du
// silence pendant un rendez-vous, avec un sous-titre qui dit ou en est la
// connexion. Le rappel cinq minutes avant et le silence sont independants,
// chacun son interrupteur, tous deux nourris par la meme connexion.
function agendaLibelleSurveille(st) {
  const n = (st && Array.isArray(st.calendars)) ? st.calendars.length : 1;
  return (n > 1 ? msg("agendaConnectedToMany", "Agendas surveillés : {n}") : msg("agendaConnectedTo", "Agenda surveillé : {n}")).replace("{n}", (st && st.calendarName) || "");
}
async function agendaRefreshUI() {
  const st = await sendR("kz-agenda-status");
  // Configure = agendas choisis ET jeton present. Apres la migration du
  // 2026-09-29, les agendas restent mais le jeton est a recoller.
  const configured = !!(st && st.configured && st.hasToken);
  $("agendaTgl").checked = !!(st && st.enabled);
  $("agendaWarnTgl").checked = !st || st.warn !== false;
  $("agendaEndWarnTgl").checked = !st || st.endWarn !== false;
  $("agendaDndSub").textContent = configured
    ? agendaLibelleSurveille(st)
    : msg("agendaDndNeeds", "Connecte d'abord ton agenda, plus bas.");
  $("agendaSetup").hidden = configured;
  $("agendaPicker").hidden = true;
  $("agendaConnected").hidden = !configured;
  if (!configured) {
    $("agendaSetupHint").textContent = (st && st.tokensReset)
      ? msg("tokensResetHint", "Pour ta sécurité, Koala Zen demande maintenant un jeton par usage. Colle un jeton limité à workspace:calendar.")
      : msg("agendaTokenHint", "Un jeton limité au seul périmètre workspace:calendar.");
    if (st && st.lastError && st.lastError !== "not_configured") ikToast($("agendaMsg"), ikErrText(st.lastError, "calendar"), true);
    return;
  }
  $("agendaConnectedLabel").textContent = agendaLibelleSurveille(st);
  const now = Date.now();
  let ligne;
  if (Number(st.inUntil) > now) {
    ligne = msg("agendaInProgress", "Rendez-vous en cours jusqu'à {h}").replace("{h}", agendaHeure(st.inUntil));
  } else if (Number(st.nextEventStart) > 0) {
    ligne = msg("agendaNextAt", "Prochain : {t} à {h}")
      .replace("{t}", st.nextEventTitle || msg("meetingUntitled", "Sans titre"))
      .replace("{h}", agendaHeure(st.nextEventStart));
  } else {
    ligne = msg("agendaNone", "Rien dans ton agenda pour les 36 prochaines heures.");
  }
  $("agendaNextLine").textContent = ligne;
  if (st.lastError) ikToast($("agendaMsg"), ikErrText(st.lastError), true);

  // Prevenir par mail : l'interrupteur ne se dit allume que si la boite est
  // choisie, et le bouton n'apparait que quand un rendez-vous approche (une
  // heure) ou est en cours.
  const notifOk = !!(st.notifyEnabled && st.notifyMailboxEmail);
  $("notifyTgl").checked = notifOk;
  // L'adresse d'envoi, une seule fois pour tout le bloc Mail.
  $("mailBoxLine").hidden = !st.notifyMailboxEmail;
  $("mailBoxLine").textContent = st.notifyMailboxEmail ? msg("notifyFrom", "Depuis {e}").replace("{e}", st.notifyMailboxEmail) : "";
  $("notifyPick").hidden = true;
  // Le mail est allume mais son jeton manque (migration du 2026-09-29) : on
  // le demande tout de suite, avec le perimetre attendu.
  const mailSansJeton = !!((st.notifyEnabled || st.mailStatsEnabled) && st.notifyMailboxEmail && !st.notifyHasToken);
  $("notifyTokenBox").hidden = !mailSansJeton;
  $("notifyTokenHint").textContent = mailSansJeton
    ? msg("tokensResetMail", "Colle un nouveau jeton, limité au seul périmètre workspace:mail.")
    : msg("notifyTokenHint", "Un second jeton, limité au seul périmètre workspace:mail.");
  notifyCible = null;
  if (notifOk) {
    if (Number(st.inUntil) > now && st.inId) notifyCible = { id: st.inId, start: Number(st.inStart) || 0, title: st.inTitle || "" };
    else if (Number(st.nextStart) > now && Number(st.nextStart) - now <= 60 * 60000 && st.nextId) notifyCible = { id: st.nextId, start: Number(st.nextStart), title: st.nextTitle || "" };
  }
  $("notifyNow").hidden = !notifyCible;
  $("mailStatsTgl").checked = !!(st.mailStatsEnabled && st.notifyMailboxEmail);

  if (!notifyCible) $("notifyPanel").hidden = true;
}

// Le volet Prevenir du popup, meme logique que celui de la bulle : trois
// messages, destinataires retirables, texte relu, un seul Envoyer.
let notifyCible = null;
function renderNotifyPicker(adresses) {
  const host = $("notifyPickList");
  clear(host);
  (adresses || []).forEach((ad) => {
    const row = el("div", "bq");
    row.appendChild(el("span", "bq-m", "✉"));
    const body = el("div", "bq-b");
    body.appendChild(el("div", "bq-t", ad.email));
    if (!ad.principal) body.appendChild(el("div", "bq-a", msg("notifyAliasOf", "Alias de {m}").replace("{m}", ad.name || "")));
    const acts = el("div", "bq-acts");
    const bouton = el("button", "bq-act", msg("pickChoose", "Choisir"));
    bouton.type = "button";
    bouton.addEventListener("click", async () => {
      bouton.disabled = true;
      const r = await sendR("kz-notify-choose", { mailbox: ad });
      if (!r || !r.ok) { bouton.disabled = false; ikToast($("agendaMsg"), ikErrText(r && r.error, "calendar", r && r.extras), true); return; }
      CFG.notifyEnabled = true;
      await agendaRefreshUI();
      ikToast($("agendaMsg"), msg("notifyLinked", "Adresse choisie"));
    });
    acts.appendChild(bouton);
    row.appendChild(body); row.appendChild(acts); host.appendChild(row);
  });
}
// Apres la liste des adresses : une seule, elle est prise ; plusieurs, on choisit.
async function notifyApresListe(r) {
  if (r.addresses.length === 1) {
    const c = await sendR("kz-notify-choose", { mailbox: r.addresses[0] });
    if (!c || !c.ok) { $("notifyTgl").checked = false; ikToast($("agendaMsg"), ikErrText(c && c.error), true); return; }
    CFG.notifyEnabled = true;
    await agendaRefreshUI();
    ikToast($("agendaMsg"), msg("notifyLinked", "Adresse choisie"));
    return;
  }
  $("notifyTokenBox").hidden = true;
  renderNotifyPicker(r.addresses);
  $("notifyPick").hidden = false;
}
$("notifyTgl").addEventListener("change", async () => {
  const on = $("notifyTgl").checked;
  if (!on) {
    CFG.notifyEnabled = false;
    await sendR("kz-notify-disconnect");
    await agendaRefreshUI();
    return;
  }
  const r = await sendR("kz-notify-mailboxes");
  if (r && r.ok) { await notifyApresListe(r); return; }
  const code = r && r.error;
  if (code === "missing_scope" || code === "invalid_token" || code === "not_configured") {
    // Le jeton partage ne sait pas envoyer de mail : on demande un jeton propre.
    $("notifyTokenInput").value = "";
    $("notifyTokenBox").hidden = false;
    return;
  }
  $("notifyTgl").checked = false;
  ikToast($("agendaMsg"), ikErrText(code, "mail"), true);
});
// Compter les mails : il faut une boite, la meme que Prevenir. Sans boite,
// on passe par le meme parcours (jeton mail, choix de l'adresse).
$("mailStatsTgl").addEventListener("change", async () => {
  const on = $("mailStatsTgl").checked;
  const st = await sendR("kz-agenda-status");
  if (on && !(st && st.notifyMailboxEmail)) {
    $("mailStatsTgl").checked = false;
    ikToast($("agendaMsg"), msg("mailStatsNeedsBox", "Choisis d'abord ta boîte dans « Prévenir les participants »."), true);
    return;
  }
  CFG.mailStatsEnabled = on;
  await send("kz-save", { payload: { mailStatsEnabled: on } });
  await agendaRefreshUI();
});
$("notifyTokenShow").addEventListener("click", () => {
  const champ = $("notifyTokenInput");
  const affiche = champ.type === "text";
  champ.type = affiche ? "password" : "text";
  $("notifyTokenShow").textContent = affiche ? msg("tokenShow", "Afficher") : msg("tokenHide", "Masquer");
});
$("notifyConnect").addEventListener("click", async () => {
  const token = $("notifyTokenInput").value.trim();
  if (!token) { ikToast($("agendaMsg"), ikErrText("empty_token", "mail"), true); return; }
  $("notifyConnect").disabled = true;
  const r = await sendR("kz-notify-connect", { token: token });
  $("notifyConnect").disabled = false;
  $("notifyTokenInput").value = "";
  if (!r || !r.ok) { ikToast($("agendaMsg"), ikErrText(r && r.error, "mail", r && r.extras), true); return; }
  await notifyApresListe(r);
});
$("notifyNow").addEventListener("click", async () => {
  if (!notifyCible) return;
  const host = $("notifyPanel");
  clear(host);
  host.hidden = false;
  host.appendChild(el("div", "nf-msg", msg("notifyLoading", "Chargement des participants…")));
  const data = await sendR("kz-notify-prepare", { id: notifyCible.id, start: notifyCible.start });
  clear(host);
  if (!data || !data.ok) {
    host.appendChild(el("div", "nf-msg nf-msg--err", ikErrText(data && data.error)));
    const b = el("button", "tiny", msg("notifyBack", "Retour")); b.type = "button";
    b.addEventListener("click", () => { host.hidden = true; });
    host.appendChild(b);
    return;
  }
  buildNotifyForm(host, data);
});
// La fusee du mail parti, meme dessin que dans la bulle, construite noeud par noeud.
function nfRocket() {
  const w = el("div", "nf-rocket");
  w.appendChild(el("div", "nf-rocket-trail"));
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 40 64"); svg.setAttribute("aria-hidden", "true");
  const forme = (nom, attrs) => { const n = document.createElementNS(NS, nom); Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k])); svg.appendChild(n); };
  forme("path", { class: "nf-rocket-flame", d: "M14 50 Q20 64 26 50 Q20 56 14 50 Z", fill: "#F5C877" });
  forme("path", { d: "M20 2 C30 12 32 30 30 46 L10 46 C8 30 10 12 20 2 Z", fill: "#FFFFFF", stroke: "#1F63A8", "stroke-width": "2" });
  forme("circle", { cx: "20", cy: "24", r: "5", fill: "#EDF4FC", stroke: "#1F63A8", "stroke-width": "2" });
  forme("path", { d: "M10 34 L2 46 L10 46 Z M30 34 L38 46 L30 46 Z", fill: "#1F63A8" });
  w.appendChild(svg);
  return w;
}
function buildNotifyForm(host, data) {
  const kinds = [["late5", msg("notifyLate5", "5 min de retard")], ["late10", msg("notifyLate10", "10 min de retard")], ["absent", msg("notifyAbsent", "Absence")]];
  const sent = Array.isArray(data.sent) ? data.sent : [];
  let kind = (kinds.find((k) => sent.indexOf(k[0]) < 0) || kinds[0])[0];
  let dest = (data.recipients || []).slice();
  const seg = el("div", "seg"); seg.id = "notifyKinds";
  const boutons = {};
  const subj = el("div", "nf-subj");
  const ta = el("textarea", "nf-ta"); ta.setAttribute("aria-label", msg("notifyBodyLabel", "Message"));
  let gabarit = "";
  const applique = () => {
    Object.keys(boutons).forEach((k) => boutons[k].classList.toggle("seg-b--on", k === kind));
    const g = (data.templates && data.templates[kind]) || { subject: "", body: "" };
    clear(subj);
    subj.appendChild(document.createTextNode(msg("notifySubject", "Objet") + " : "));
    const b = el("b", "", g.subject); subj.appendChild(b);
    if (!ta.value || ta.value === gabarit) ta.value = g.body;
    gabarit = g.body;
  };
  kinds.forEach(([k, lib]) => {
    const bt = el("button", "seg-b", lib); bt.type = "button"; bt.setAttribute("data-kind", k);
    if (sent.indexOf(k) >= 0) { bt.disabled = true; bt.classList.add("seg-b--off"); bt.title = msg("notifyAlready", "Déjà envoyé"); bt.textContent = "✓ " + lib; }
    bt.addEventListener("click", () => { kind = k; applique(); });
    boutons[k] = bt; seg.appendChild(bt);
  });
  const a = el("div", "nf-to");
  a.appendChild(el("span", "nf-lab", msg("notifyTo", "À") + " :"));
  const ligne = el("div", "nf-msg");
  const acts = el("div", "nf-acts");
  const envoyer = el("button", "nf-send", msg("notifySend", "Envoyer")); envoyer.type = "button";
  const annuler = el("button", "tiny", msg("notifyCancel", "Annuler")); annuler.type = "button";
  const puces = () => {
    Array.from(a.querySelectorAll(".nf-chip")).forEach((n) => n.remove());
    dest.forEach((d) => {
      const chip = el("span", "nf-chip");
      const n = el("span", "nf-chip-n", d.name || d.address); n.title = d.address;
      const x = el("button", "nf-chip-x", "×"); x.type = "button";
      x.setAttribute("aria-label", msg("notifyRemove", "Retirer {n}").replace("{n}", d.name || d.address));
      x.addEventListener("click", () => { dest = dest.filter((z) => z.address !== d.address); puces(); });
      chip.appendChild(n); chip.appendChild(x); a.appendChild(chip);
    });
    envoyer.disabled = dest.length === 0;
    ligne.textContent = dest.length === 0 ? msg("notifyNoRecipients", "Personne à prévenir.") : "";
    ligne.className = "nf-msg" + (dest.length === 0 ? " nf-msg--err" : "");
  };
  puces();
  host.appendChild(el("div", "row-lab", data.title || msg("meetingUntitled", "Sans titre")));
  host.appendChild(seg); host.appendChild(a); host.appendChild(subj); host.appendChild(ta); host.appendChild(ligne);
  applique();
  envoyer.addEventListener("click", async () => {
    if (envoyer.disabled) return;
    envoyer.disabled = true; annuler.disabled = true; envoyer.textContent = msg("notifySending", "Envoi…");
    const g = (data.templates && data.templates[kind]) || { subject: "" };
    const r = await sendR("kz-notify-send", { id: data.id, start: data.start, kind: kind, subject: g.subject, body: ta.value, to: dest.map((d) => d.address) });
    if (!r || !r.ok) {
      envoyer.disabled = false; annuler.disabled = false; envoyer.textContent = msg("notifySend", "Envoyer");
      ligne.textContent = ikErrText(r && r.error, "calendar", r && r.extras); ligne.className = "nf-msg nf-msg--err";
      return;
    }
    clear(host);
    if (!REDUCE_MOTION) host.appendChild(nfRocket());
    host.appendChild(el("div", "nf-msg nf-msg--ok", r.count === 1 ? msg("notifySentOne", "Envoyé à 1 personne") : msg("notifySentMany", "Envoyé à {n} personnes").replace("{n}", r.count)));
    setTimeout(() => { host.hidden = true; }, REDUCE_MOTION ? 1800 : 2600);
  });
  annuler.addEventListener("click", () => { host.hidden = true; });
  acts.appendChild(envoyer); acts.appendChild(annuler); host.appendChild(acts);
}

// Meme rendu que les autres listes de choix : chaque ligne agit au clic. L'agenda par
// defaut est marque, les partages aussi, pour que le choix soit eclaire.
function renderAgendaPicker(calendars, cochesIds) {
  const host = $("agendaPickList");
  clear(host);
  const coches = {};
  (cochesIds || []).forEach((id) => { coches[id] = true; });
  (calendars || []).forEach((c) => {
    const row = el("div", "bq bq--pick");
    row.setAttribute("role", "checkbox");
    row.setAttribute("tabindex", "0");
    row.setAttribute("data-id", String(c.id));
    row.setAttribute("data-name", c.name);
    const ck = el("span", "bq-ck", "✓");
    row.appendChild(ck);
    const body = el("div", "bq-b");
    body.appendChild(el("div", "bq-t", c.name));
    const tags = [];
    if (c.isDefault) tags.push(msg("agendaDefaultTag", "Agenda par défaut"));
    if (c.permission !== "owner") tags.push(msg("agendaSharedTag", "Partagé"));
    if (tags.length) body.appendChild(el("div", "bq-a", tags.join(" · ")));
    row.appendChild(body);
    const peint = () => { row.classList.toggle("bq--on", !!coches[c.id]); row.setAttribute("aria-checked", coches[c.id] ? "true" : "false"); };
    const bascule = () => { coches[c.id] = !coches[c.id]; peint(); $("agendaPickOk").disabled = !Object.keys(coches).some((k) => coches[k]); };
    row.addEventListener("click", bascule);
    row.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); bascule(); } });
    peint();
    host.appendChild(row);
  });
  $("agendaPickOk").disabled = !Object.keys(coches).some((k) => coches[k]);
}
function agendaPickSelection() {
  return Array.from($("agendaPickList").querySelectorAll(".bq--on")).map((r) => ({ id: Number(r.getAttribute("data-id")), name: r.getAttribute("data-name") || "" }));
}
$("agendaPickOk").addEventListener("click", async () => {
  const choix = agendaPickSelection();
  if (!choix.length) return;
  $("agendaPickOk").disabled = true;
  const r = await sendR("kz-agenda-choose", { calendars: choix });
  if (!r || !r.ok) { $("agendaPickOk").disabled = false; ikToast($("agendaMsg"), ikErrText(r && r.error, "calendar", r && r.extras), true); return; }
  await agendaRefreshUI();
  await refreshNextVisit();
  ikToast($("agendaMsg"), msg("agendaLinked", "Agenda connecté"));
});

async function agendaShowPicker(calendars) {
  const st = await sendR("kz-agenda-status");
  const deja = (st && Array.isArray(st.calendars)) ? st.calendars.map((c) => c.id) : [];
  $("agendaSetup").hidden = true;
  $("agendaConnected").hidden = true;
  $("agendaPicker").hidden = false;
  renderAgendaPicker(calendars, deja);
}

// L'interrupteur s'enregistre tout de suite, sans attendre Enregistrer : il
// devoile une configuration qui agit au clic, oublier Enregistrer ensuite
// laisserait tout le bloc inactif en silence.
$("agendaTgl").addEventListener("change", async () => {
  const on = $("agendaTgl").checked;
  CFG.agendaEnabled = on;
  await send("kz-save", { payload: { agendaEnabled: on } });
  await agendaRefreshUI();
  await refreshNextVisit();
});

$("agendaWarnTgl").addEventListener("change", async () => {
  const on = $("agendaWarnTgl").checked;
  CFG.agendaWarn = on;
  await send("kz-save", { payload: { agendaWarn: on } });
});

$("agendaEndWarnTgl").addEventListener("change", async () => {
  const on = $("agendaEndWarnTgl").checked;
  CFG.agendaEndWarn = on;
  await send("kz-save", { payload: { agendaEndWarn: on } });
});

$("agendaTokenShow").addEventListener("click", () => {
  const champ = $("agendaTokenInput");
  const affiche = champ.type === "text";
  champ.type = affiche ? "password" : "text";
  $("agendaTokenShow").textContent = affiche ? msg("tokenShow", "Afficher") : msg("tokenHide", "Masquer");
});

$("agendaConnect").addEventListener("click", async () => {
  const token = $("agendaTokenInput").value.trim();
  if (!token) { ikToast($("agendaMsg"), ikErrText("empty_token", "calendar"), true); return; }
  $("agendaConnect").disabled = true;
  const avant = $("agendaConnect").textContent;
  $("agendaConnect").textContent = msg("tokenConnecting", "Connexion…");
  const r = await sendR("kz-agenda-connect", { token: token });
  $("agendaConnect").disabled = false;
  $("agendaConnect").textContent = avant;
  $("agendaTokenInput").value = "";
  if (!r || !r.ok) { ikToast($("agendaMsg"), ikErrText(r && r.error, "calendar", r && r.extras), true); return; }
  if (r.needsChoice) { await agendaShowPicker(r.calendars); return; }
  await agendaRefreshUI();
  await refreshNextVisit();
  ikToast($("agendaMsg"), msg("agendaLinked", "Agenda connecté"));
});

$("agendaChange").addEventListener("click", async () => {
  $("agendaChange").disabled = true;
  const r = await sendR("kz-agenda-list-calendars");
  $("agendaChange").disabled = false;
  if (!r || !r.ok) { ikToast($("agendaMsg"), ikErrText(r && r.error, "calendar", r && r.extras), true); return; }
  await agendaShowPicker(r.calendars);
});

$("agendaDisconnect").addEventListener("click", async () => {
  const r = await sendR("kz-agenda-disconnect");
  if (!r || !r.ok) { ikToast($("agendaMsg"), ikErrText(r && r.error, "calendar", r && r.extras), true); return; }
  CFG.agendaEnabled = false;
  await agendaRefreshUI();
  await refreshNextVisit();
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
  $("remindersTgl").checked = CFG.remindersEnabled !== false;
  paintReminders();

  // Ne pas deranger
  $("muteCalls").checked = CFG.muteInCalls !== false;
  mutedPatterns = Array.isArray(CFG.mutedPatterns) ? CFG.mutedPatterns.slice() : DEFAULT_MUTED.slice();
  mutedExpanded = false;
  renderMuteChips();
  $("pauseIdle").checked = CFG.pauseWhenIdle !== false;
  $("agendaTgl").checked = !!CFG.agendaEnabled;
  $("agendaWarnTgl").checked = CFG.agendaWarn !== false;
  $("agendaEndWarnTgl").checked = CFG.agendaEndWarn !== false;
  $("mailStatsTgl").checked = !!CFG.mailStatsEnabled;
  agendaRefreshUI();

  // Focus
  $("focusMode").checked = !!CFG.focusMode;
  $("passagesTgl").checked = CFG.passages !== false;
  $("passagesRandomTgl").checked = CFG.passagesRandom !== false;
  $("passagesEveningTgl").checked = CFG.passagesEvening !== false;
  $("passagesMeetingTgl").checked = CFG.passagesMeeting !== false;
  applyPassageFrequency(CFG.passageFrequency);
  paintPassagesFreqWrap();
  paintPause();
  $("characterTgl").checked = CFG.showCharacter !== false;
  $("quotesTgl").checked = CFG.quotesEnabled !== false;
  paintCharacter();
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
  const th = (CFG.theme === "dark" || CFG.theme === "light") ? CFG.theme : "auto";
  setThemeSeg(th);
  applyTheme(th);

  // Statistiques
  STATS = (CFG.statsDaily && typeof CFG.statsDaily === "object") ? CFG.statsDaily : {};
  SCREEN = (CFG.screenDaily && typeof CFG.screenDaily === "object") ? CFG.screenDaily : {};
  MEET = (CFG.meetingDaily && typeof CFG.meetingDaily === "object") ? CFG.meetingDaily : {};
  MAIL = (CFG.mailDaily && typeof CFG.mailDaily === "object") ? CFG.mailDaily : {};
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
    remindersEnabled: $("remindersTgl").checked,
    muteInCalls: $("muteCalls").checked,
    mutedPatterns: mutedPatterns,
    pauseWhenIdle: $("pauseIdle").checked,
    agendaEnabled: $("agendaTgl").checked,
    agendaWarn: $("agendaWarnTgl").checked,
    agendaEndWarn: $("agendaEndWarnTgl").checked,
    mailStatsEnabled: $("mailStatsTgl").checked,
    focusMode: $("focusMode").checked,
    passages: $("passagesTgl").checked,
    passagesRandom: $("passagesRandomTgl").checked,
    passagesEvening: $("passagesEveningTgl").checked,
    passagesMeeting: $("passagesMeetingTgl").checked,
    showCharacter: $("characterTgl").checked,
    quotesEnabled: $("quotesTgl").checked,
    passageFrequency: currentPassageFrequency(),
    focusSeconds: focusSeconds,
    screenTimezone: $("screenTz").value || "Europe/Zurich",
    animMode: currentAnimMode(),
    theme: currentThemeMode(),
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
  applyTheme(payload.theme);
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
// Une fois le popup rempli, les fondus des options s'allument (kz-pret) : ils
// ne jouent qu'aux vrais changements, jamais a l'ouverture. L'en-tete et son
// anneau se tiennent a jour tant que le popup reste ouvert.
Promise.resolve(load()).then(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("kz-pret")));
}, () => {});
setInterval(() => { refreshNextVisit().catch(() => {}); }, 30000);
