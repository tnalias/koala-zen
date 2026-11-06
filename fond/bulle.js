// Koala Zen, le fond : la bulle unique, qui suit l'onglet au premier plan.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Une seule bulle a la fois, qui suit l'utilisateur (2026-10-28). La bulle qui
// attend une reponse (rappel d'habitude, pause focus, rendez-vous) ne reste
// pas dans un onglet quitte : elle passe dans l'onglet au premier plan, a
// chaque changement d'onglet ou de fenetre, et revient apres un rechargement.
// Une page de visio ou une page interne ne la recoit pas : elle attend la
// suivante. bubbleState = { id, tabId, payload, shownAt, perdue }.
// La bulle porte le titre d'un rendez-vous : son etat ne va jamais dans le
// stockage de l'appareil, seulement dans la memoire de session du navigateur
// (effacee a sa fermeture), ou en memoire a defaut.
// ===========================================================================
let bubbleMemo = null;
const bubbleSession = (api.storage && api.storage.session && api.storage.session.get) ? api.storage.session : null;
async function bubbleRead() {
  if (!bubbleSession) return bubbleMemo;
  try { return (await bubbleSession.get("bubbleState")).bubbleState || null; } catch (e) { return bubbleMemo; }
}
async function bubbleWrite(st) {
  bubbleMemo = st || null;
  if (!bubbleSession) return;
  try { await bubbleSession.set({ bubbleState: st || null }); } catch (e) { /* noop */ }
}
async function bubbleGet() {
  const st = await bubbleRead();
  return (st && typeof st === "object" && st.id && st.payload) ? st : null;
}
async function bubbleClear(id) {
  const st = await bubbleGet();
  if (st && (id == null || st.id === id)) await bubbleWrite(null);
}
// parked : un rappel d'habitude mis de cote par un rendez-vous, a reposer
// quand la bulle du rendez-vous se ferme.
async function bubbleRemember(tabId, payload, parked) {
  await bubbleWrite({ id: payload.bubbleId, tabId: tabId, payload: payload, shownAt: Date.now(), perdue: false, parked: parked || null });
}
// Un identifiant de bulle, sans valeur de secret : il distingue deux bulles.
function bubbleNewId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function bubbleKind(st) { return (st && st.payload && st.payload.type === "kz-show") ? "habit" : "meeting"; }

// La page dit si SA bulle est encore ouverte, et quel objectif elle montre.
// Pas de reponse : elle ne l'est plus.
async function bubblePing(st) {
  try {
    const r = await api.tabs.sendMessage(st.tabId, { type: "kz-bubble-ping", bubbleId: st.id });
    return (r && r.open) ? { open: true, prompt: typeof r.prompt === "string" ? r.prompt : "" } : null;
  } catch (e) { return null; }
}

// La bulle ouverte, verifiee aupres de sa page. Un etat que plus aucune page
// ne porte est efface, sinon il bloquerait tous les rappels suivants.
async function bubbleOpen() {
  const st = await bubbleGet();
  if (!st) return null;
  if (await bubblePing(st)) return st;
  await bubbleClear(st.id);
  return null;
}

// Envoie une bulle a un onglet, scripts injectes au besoin. Vrai si la page
// l'affiche vraiment.
async function bubbleSendToTab(tab, payload) {
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

// La meme bulle, remise a l'heure pour un autre onglet : le rappel garde son
// objectif, la pause focus son temps restant, le rendez-vous son compte de
// minutes, et Prevenir recoit un jeton lie au nouvel onglet.
async function bubbleMovedPayload(st, tab, prompt) {
  const p = Object.assign({}, st.payload, { instant: true });
  if (prompt) p.prompt = prompt;
  const now = Date.now();
  if (p.type === "kz-show" && p.focus) {
    p.focusSeconds = Math.max(5, clampFocus(p.focusSeconds) - Math.round((now - (Number(st.shownAt) || now)) / 1000));
  } else if (p.type !== "kz-show") {
    const cible = p.type === "kz-meeting-end" ? Number(p.end) : Number(p.start);
    if (cible) p.minutes = Math.max(1, Math.round((cible - now) / 60000));
    delete p.notifyNonce;
    if (p.canNotify) p.notifyNonce = await notifyNonceCreate(tab.id, p);
  }
  return p;
}

// Suit l'utilisateur. opts.lost : l'onglet de la bulle vient d'etre recharge
// ou ferme, la bulle est a reposer.
async function bubbleFollow(opts) {
  const st = await bubbleGet();
  if (!st) return;
  const lost = !!(opts && opts.lost === st.tabId);
  const reponse = lost ? null : await bubblePing(st);
  const ouverte = !!reponse;
  // Fermee par l'utilisateur sans qu'on l'apprenne : on oublie.
  if (!ouverte && !lost && !st.perdue) { await bubbleClear(st.id); return; }
  const tab = await targetTab();
  const cfg = { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns"])) };
  const accueil = !!tab && !(cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns));
  if (ouverte && (!accueil || tab.id === st.tabId)) return;
  if (!accueil) { await bubbleWrite(Object.assign({}, st, { perdue: true })); return; }
  const payload = await bubbleMovedPayload(st, tab, reponse && reponse.prompt);
  if (await bubbleSendToTab(tab, payload)) {
    if (ouverte && tab.id !== st.tabId) {
      try { await api.tabs.sendMessage(st.tabId, { type: "kz-bubble-withdraw", bubbleId: st.id }); } catch (e) { /* noop */ }
    }
    await bubbleWrite(Object.assign({}, st, { tabId: tab.id, payload: payload, perdue: false, shownAt: payload.focus ? Date.now() : st.shownAt }));
  } else if (!ouverte) {
    await bubbleWrite(Object.assign({}, st, { perdue: true }));
  }
}

// Les evenements arrivent en rafale (onglet et fenetre ensemble) : ils passent
// un par un.
let bubbleChain = Promise.resolve();
function bubbleQueue(opts) {
  bubbleChain = bubbleChain.then(() => bubbleFollow(opts)).catch(() => {});
  return bubbleChain;
}
if (api.tabs && api.tabs.onActivated) api.tabs.onActivated.addListener((info) => { bubbleQueue(); if (info && info.tabId != null) { barRelay(info.tabId).catch(() => {}); alerteRelay(info.tabId).catch(() => {}); } });
if (api.windows && api.windows.onFocusChanged) {
  api.windows.onFocusChanged.addListener((windowId) => {
    // WINDOW_ID_NONE : le navigateur perd le premier plan, rien a suivre.
    if (windowId === (api.windows.WINDOW_ID_NONE != null ? api.windows.WINDOW_ID_NONE : -1)) return;
    bubbleQueue();
  });
}
if (api.tabs && api.tabs.onRemoved) api.tabs.onRemoved.addListener((tabId) => { bubbleQueue({ lost: tabId }); });
if (api.tabs && api.tabs.onUpdated) {
  api.tabs.onUpdated.addListener((tabId, info) => {
    if (info && info.status === "complete") { bubbleQueue({ lost: tabId }); barRelay(tabId).catch(() => {}); alerteRelay(tabId).catch(() => {}); }
  });
}
