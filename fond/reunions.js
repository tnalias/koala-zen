// Koala Zen, le fond : les rappels de reunion a l'ecran : bulles, alerte, barre, notifications.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// La bulle dans la page d'abord, la notification du systeme sinon. La page
// repond {shown:false} si un rappel d'habitude est deja a l'ecran, ou ne
// repond pas du tout (page interne, nouvel onglet) : dans les deux cas le
// rendez-vous ne doit JAMAIS passer sous silence.
async function agendaNotify(m, nowMs, kind) {
  const fin = kind === "end";
  const minutes = Math.max(1, Math.round(((fin ? m.end : m.start) - nowMs) / 60000));
  const payload = { type: fin ? "kz-meeting-end" : "kz-meeting-soon", id: m.id, title: m.title, start: m.start, end: m.end, minutes: minutes, url: m.url || "", people: m.people || 0, room: m.room || "" };
  const tab = await targetTab();
  // Sur une page de visio (kMeet, Teams...), pas de bulle : l'utilisateur est
  // peut-etre deja en appel, et injecter les scripts dans cet onglet ferait
  // jouer le coucou de visio en plein appel. La notification suffit.
  const cfg = { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns", "notifyEnabled", "notifyMailboxUuid"])) };
  // Le bouton Prevenir n'a de sens qu'avant le debut, seulement si la boite
  // d'envoi est choisie, et seulement pour une reunion : un bloc solo n'a
  // personne a prevenir.
  payload.canNotify = !fin && m.meeting !== false && !!cfg.notifyEnabled && !!cfg.notifyMailboxUuid;
  const enVisio = !!(tab && cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns));
  // Une seule bulle a la fois, et le rendez-vous passe avant : il ne peut pas
  // attendre (2026-10-28). Un rappel d'habitude ouvert est mis de cote, sans
  // rien compter, et revient quand la bulle du rendez-vous se ferme. Une
  // bulle d'agenda ouverte cede la place a la nouvelle, avec le rappel
  // qu'elle gardait de cote.
  const ouverte = await bubbleOpen();
  // 2026-11-02 : un rappel de fin ne remplace jamais un rappel de debut
  // encore ouvert, dont le rendez-vous n'a pas commence : le debut compte
  // plus. La fin part alors en notification du systeme, jamais en silence.
  if (fin && ouverte && ouverte.payload && ouverte.payload.type === "kz-meeting-soon" && Number(ouverte.payload.start) > nowMs) {
    await agendaSystemNotification(m, minutes, kind);
    return "notification";
  }
  const peutAfficher = !!tab && !enVisio;
  let garee = ouverte ? (ouverte.parked || null) : null;
  if (ouverte && peutAfficher) {
    if (bubbleKind(ouverte) === "habit") {
      const r = await bubblePing(ouverte);
      garee = Object.assign({}, ouverte, { payload: Object.assign({}, ouverte.payload, (r && r.prompt) ? { prompt: r.prompt } : {}) });
    }
    try { await api.tabs.sendMessage(ouverte.tabId, { type: "kz-bubble-withdraw", bubbleId: ouverte.id }); } catch (e) { /* noop */ }
  }
  payload.bubbleId = bubbleNewId();
  await barHide(m.start);
  if (payload.canNotify && peutAfficher) payload.notifyNonce = await notifyNonceCreate(tab.id, m);
  if (peutAfficher && (await agendaSendToTab(tab, payload))) {
    await bubbleRemember(tab.id, payload, garee);
    // Une autre app au premier plan : la bulle attend dans la page, la
    // notification du systeme previent tout de suite.
    if (!(await navigateurDevant())) { await agendaSystemNotification(m, minutes, kind); return "tab+notification"; }
    return "tab";
  }
  // La page n'a rien pu afficher : la bulle retiree revient a sa place.
  if (ouverte && peutAfficher) { await bubbleWrite(Object.assign({}, ouverte, { perdue: true })); await bubbleQueue(); }
  await agendaSystemNotification(m, minutes, kind);
  return "notification";
}

function agendaSendToTab(tab, payload) { return bubbleSendToTab(tab, payload); }

// 2026-11-05 : une notification de rendez-vous qui reste a l'ecran doit
// partir quand elle n'a plus lieu d'etre : bulle fermee, rendez-vous
// commence (ou termine pour la fin), retire, rejoint, annule ou deplace.
function agendaNotifIdOf(payload) {
  if (!payload || (payload.type !== "kz-meeting-soon" && payload.type !== "kz-meeting-end")) return [];
  const cle = agendaKey({ id: payload.id, start: Number(payload.start) || 0 });
  return [(payload.type === "kz-meeting-end" ? "kz-agenda-end-" : "kz-agenda-") + cle];
}
async function agendaNotifsClear(ids) {
  if (!api.notifications || !api.notifications.clear) return;
  for (const id of ids) { try { await api.notifications.clear(id); } catch (e) { /* noop */ } }
}
function agendaNotifKey(id) {
  return String(id || "").slice("kz-agenda-".length).replace(/^(end|last)-/, "");
}
async function agendaNotifsMenage(cache, nowMs) {
  if (!api.notifications || !api.notifications.getAll) return [];
  let toutes = {};
  try { toutes = (await api.notifications.getAll()) || {}; } catch (e) { return []; }
  const evs = agendaTimed(cache);
  const parties = [];
  for (const id of Object.keys(toutes)) {
    if (id.indexOf("kz-agenda-") !== 0) continue;
    const m = evs.find((x) => agendaKey(x) === agendaNotifKey(id));
    const fin = id.indexOf("kz-agenda-end-") === 0;
    const alerte = id.indexOf("kz-agenda-last-") === 0;
    if (!m || (fin ? m.end : (alerte ? agendaLastAt(m) : m.start)) <= nowMs) { await agendaNotifsClear([id]); parties.push(id); }
  }
  return parties;
}

// Les onglets web ouverts (http, https), sans ceux de visio si demande. Un
// seul envoi pour l'alerte, son annulation et la barre de reunion.
async function ongletsWeb(sansVisio) {
  const cfg = sansVisio ? { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns"])) } : null;
  let tous = [];
  try { tous = await api.tabs.query({}); } catch (e) { tous = []; }
  return (Array.isArray(tous) ? tous : []).filter((t) => t && /^https?:/.test(t.url || "") && !(cfg && cfg.muteInCalls && matchesMuted(t.url, cfg.mutedPatterns)));
}
async function envoieAuxOnglets(onglets, msg) {
  for (const t of onglets) { try { await api.tabs.sendMessage(t.id, msg); } catch (e) { /* page sans script */ } }
}

// L'alerte armee dans les onglets, annulee pour ce debut.
async function agendaLastCancel(startMs) {
  await envoieAuxOnglets(await ongletsWeb(false), { type: "kz-meeting-last-cancel", start: Number(startMs) || 0 });
}

// Rejoint : plus d'alerte rouge ni de notification du debut pour lui, et
// ses alarmes passent au rendez-vous suivant.
async function agendaJoined(id, start) {
  const now = Date.now();
  const r = await kvGet(["agendaCache", "agendaLastWarned", "agendaLastOutWarned"]);
  const cache = r.agendaCache || null;
  const cles = agendaSameMeeting((cache && Array.isArray(cache.events)) ? cache.events : [], agendaKey({ id: id, start: Number(start) || 0 }));
  const marque = (liste) => {
    let l = Array.isArray(liste) ? liste.slice() : [];
    cles.forEach((k) => { if (l.indexOf(k) < 0) l.push(k); });
    return l.length > AGENDA_WARNED_MAX ? l.slice(-AGENDA_WARNED_MAX) : l;
  };
  await kvSet({ agendaLastWarned: marque(r.agendaLastWarned), agendaLastOutWarned: marque(r.agendaLastOutWarned) });
  if (cache) await agendaScheduleLast(cache, now);
  await agendaLastCancel(start);
  await agendaNotifsClear([].concat.apply([], cles.map((k) => ["kz-agenda-" + k, "kz-agenda-last-" + k])));
  return { ok: true };
}

// Apres une relecture de l'agenda : un rendez-vous annule, refuse ou deplace
// n'a plus ni bulle ouverte ni alerte armee. Le meme rendez-vous vu dans un
// autre agenda (meme debut, meme titre) le garde.
async function agendaApresRelecture(ancien, neuf, nowMs) {
  const neufs = agendaTimed(neuf);
  const encore = (m) => neufs.some((x) => x.start === m.start && (String(x.id) === String(m.id) || x.title === m.title));
  const partis = agendaTimed(ancien).filter((m) => m.start > nowMs && m.start - nowMs <= AGENDA_LAST_ARM_MS + 60000 && !encore(m));
  for (const m of partis) await agendaLastCancel(m.start);
  const st = await bubbleGet();
  const type = st && st.payload ? st.payload.type : "";
  if ((type === "kz-meeting-soon" || type === "kz-meeting-end") && !encore({ id: st.payload.id, start: Number(st.payload.start) || 0, title: st.payload.title })) {
    try { await api.tabs.sendMessage(st.tabId, { type: "kz-meeting-close", bubbleId: st.id }); } catch (e) { /* noop */ }
  }
  await agendaNotifsMenage(neuf, nowMs);
  const barre = await barRead();
  if (barre && !encore(barre)) await barHide(barre.start);
}

// 2026-11-05 : la barre de reunion. Quand l'utilisateur ferme une bulle
// d'agenda pendant la reunion, une barre discrete reste en bas de la page,
// avec le temps restant, Terminer (compte jusqu'au clic) et N'a pas eu lieu.
// Elle est dans tous les onglets web (sauf visio), suit les pages rechargees
// et part a la fin prevue, a la decision, ou quand une bulle de la meme
// reunion s'affiche. Son etat vit dans la session, avec celui de la bulle.
let barMemo = null;
async function barRead() {
  if (!bubbleSession) return barMemo;
  try { return (await bubbleSession.get("meetingBar")).meetingBar || null; } catch (e) { return barMemo; }
}
async function barWrite(b) {
  barMemo = b || null;
  if (!bubbleSession) return;
  try { await bubbleSession.set({ meetingBar: b || null }); } catch (e) { /* noop */ }
}
function barPayload(b) { return { type: "kz-meeting-bar", barId: b.barId, title: b.title, start: b.start, end: b.end, room: b.room || "" }; }
async function barEnvoie(msg) { await envoieAuxOnglets(await ongletsWeb(true), msg); }
async function meetingBarFromBubble(payload) {
  const now = Date.now();
  if (!payload || (payload.type !== "kz-meeting-soon" && payload.type !== "kz-meeting-end")) return null;
  const r = await kvGet(["agendaCache"]);
  const cle = agendaKey({ id: payload.id, start: Number(payload.start) || 0 });
  const m = agendaTimed(r.agendaCache).find((x) => agendaKey(x) === cle);
  if (!m || !(m.start <= now && now < m.end)) return null;
  const b = { barId: bubbleNewId(), id: m.id, start: m.start, end: m.end, title: m.title, room: m.room || "" };
  await barWrite(b);
  await barEnvoie(barPayload(b));
  return b;
}
// La barre du mode essai : un faux rendez-vous de quelques minutes, depuis un
// onglet. Elle ne marque rien ; ses boutons ne font que la masquer.
const BAR_ESSAI_MAX_MS = 10 * 60 * 1000;
async function barEssai(msg, sender) {
  const now = Date.now();
  const start = Number(msg && msg.start) || 0, end = Number(msg && msg.end) || 0;
  if (!(sender && sender.tab) || !(end > now && end - now <= BAR_ESSAI_MAX_MS && start <= now)) return { ok: false, error: "not_allowed" };
  const b = { barId: bubbleNewId(), essai: true, id: "essai", start: start, end: end, title: String((msg && msg.title) || "").slice(0, 80), room: "" };
  await barWrite(b);
  await barEnvoie(barPayload(b));
  return { ok: true };
}
// siStart : ne masque que la barre de cette reunion.
async function barHide(siStart) {
  const b = await barRead();
  if (!b || (siStart != null && Number(b.start) !== Number(siStart))) return;
  await barWrite(null);
  await barEnvoie({ type: "kz-meeting-bar-hide", barId: b.barId });
}
async function barRelay(tabId) {
  const b = await barRead();
  if (!b) return;
  if (b.end <= Date.now()) { await barWrite(null); return; }
  if (!(await ongletsWeb(true)).some((t) => t.id === tabId)) return;
  try { await api.tabs.sendMessage(tabId, barPayload(b)); } catch (e) { /* noop */ }
}
async function barCible(msg, sender) {
  const b = await barRead();
  if (!b || !msg || msg.barId !== b.barId || b.end <= Date.now()) return null;
  if (!depuisExtension(sender) && !(sender && sender.tab)) return null;
  return b;
}

// Terminer : la reunion ne compte que jusqu'au clic. Plus de silence, plus
// de rappel de fin, la bulle de fin et la barre partent.
async function meetingFinish(id, start) {
  const fin = Date.now();
  const t = await marquer(id, start, (f) => { f.endedAt = fin; });
  if (t.cache) {
    await agendaAccrueMeetings(t.cache, t.now);
    await agendaUpdateState(t.cache, t.now);
    await agendaScheduleEnd(t.cache, t.now);
  }
  await agendaNotifsClear(t.cles.map((k) => "kz-agenda-end-" + k));
  await agendaCloseBubbleOf(start);
  await barHide(start);
  return { ok: true, endedAt: fin };
}

// Le navigateur est-il l'app au premier plan ? Sans reponse claire, oui :
// on garde alors le comportement d'avant, la bulle dans la page.
async function navigateurDevant() {
  try {
    if (!api.windows || !api.windows.getLastFocused) return true;
    const w = await api.windows.getLastFocused();
    return !w || w.focused !== false;
  } catch (e) { return true; }
}

// Une notification qui reste a l'ecran jusqu'a ce qu'on la ferme. Firefox
// refuse requireInteraction : elle repart alors sans.
async function notificationSysteme(id, opts) {
  if (!api.notifications || !api.notifications.create) return false;
  try { await api.notifications.create(id, Object.assign({}, opts, { requireInteraction: true })); return true; }
  catch (e) {
    try { await api.notifications.create(id, opts); return true; } catch (_) { return false; }
  }
}

async function agendaSystemNotification(m, minutes, kind) {
  if (!api.notifications || !api.notifications.create) return false;
  const fin = kind === "end";
  const titre = fin
    ? bgMsg("meetingEndPill", "Fin dans {n} min").replace("{n}", minutes)
    : bgMsg("meetingSoonPill", "Rendez-vous dans {n} min").replace("{n}", minutes);
  const nom = m.title || bgMsg("meetingUntitled", "Sans titre");
  return notificationSysteme("kz-agenda-" + (fin ? "end-" : "") + agendaKey(m), {
    type: "basic",
    iconUrl: api.runtime.getURL("icons/icon-128.png"),
    title: titre,
    message: nom + " · " + (fin ? bgMsg("meetingUntil", "jusqu'à {h}").replace("{h}", agendaHeure(m.end)) : agendaHeure(m.start)) + (m.room ? " · " + m.room : "")
  });
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
    const cle = agendaNotifKey(id);
    const fin = id.indexOf("kz-agenda-end-") === 0;
    kvGet(["agendaCache"]).then((r) => {
      const evs = (r.agendaCache && Array.isArray(r.agendaCache.events)) ? r.agendaCache.events : [];
      const m = evs.find((x) => agendaKey(x) === cle);
      if (m && m.url) {
        agendaOpenUrl(m.url).catch(() => {});
        if (!fin) agendaJoined(m.id, m.start).catch(() => {});
      }
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
  // Un jeton saisi qui echoue est dit tout de suite, sans laisser d'erreur
  // memorisee pour la carte Agenda.
  if (!liste.ok) { if (!saisi) await agendaRememberError(liste.error); return liste; }
  let mailAussi = false;
  if (saisi) {
    const v = verdictSonde(await tokenExtras(token, "calendar"), ["mail"]);
    if (!v.ok) return v;
    mailAussi = v.communs.indexOf("mail") >= 0;
  }
  const patch = { agendaLastError: "", agendaMyUserId: liste.myUserId || 0 };
  if (saisi) { patch.agendaTokenEnc = await secretEncrypt(token); patch.tokensReset = false; }
  // Un jeton commun ouvre aussi le mail : il sert de jeton mail, sauf si un
  // jeton mail a part est deja enregistre.
  if (mailAussi && !(await kvGet(["notifyTokenEnc"])).notifyTokenEnc) patch.notifyTokenEnc = await secretEncrypt(token);
  const email = await agendaProfileEmail(token);
  patch.agendaMyEmail = email || "";
  await kvSet(patch);
  if (liste.calendars.length === 1) {
    const seul = liste.calendars[0];
    const r = await agendaChoose(seul.id, seul.name);
    if (!r.ok) return r;
    return { ok: true, calendarName: seul.name, mailToo: mailAussi };
  }
  return { ok: true, needsChoice: true, calendars: liste.calendars, mailToo: mailAussi };
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
// des cinq minutes repose l'alarme depuis le cache, sans appel reseau.
async function agendaAfterSave(payload, avant) {
  if (payload && payload.mailStatsEnabled === true) mailStatsRefresh({ force: true }).catch(() => {});
  // Stats mail eteintes et Prevenir eteint : plus rien ne sert la boite,
  // l'adresse et le jeton mail sont oublies.
  if (payload && payload.mailStatsEnabled === false) {
    const n = await kvGet(["notifyEnabled"]);
    if (!n.notifyEnabled) await kvSet({ notifyMailboxUuid: "", notifyMailboxEmail: "", notifyMailboxName: "", notifyMailboxHosting: 0, notifyMailboxLogin: "", notifyTokenEnc: null, bilanEnabled: false, bilanEmail: "" });
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
    try { await api.alarms.clear(ALARM_AGENDA_LAST); } catch (e) { /* noop */ }
    try { await api.alarms.clear(ALARM_AGENDA_LAST_OUT); } catch (e) { /* noop */ }
    await kvSet({ agendaState: { inUntil: 0, inTitle: "", nextStart: 0, nextTitle: "" } });
    return;
  }
  if (!actifAvant && actifApres) { await agendaRefresh({ force: true }); return; }
  if (warnAvant !== warnApres) { await agendaScheduleWarn(r.agendaCache, Date.now()); await agendaScheduleLast(r.agendaCache, Date.now()); }
  if (finAvant !== finApres) await agendaScheduleEnd(r.agendaCache, Date.now());
}

async function agendaDisconnect() {
  try { await api.alarms.clear(ALARM_AGENDA_WARN); } catch (e) { /* noop */ }
  try { await api.alarms.clear(ALARM_AGENDA_END); } catch (e) { /* noop */ }
  try { await api.alarms.clear(ALARM_AGENDA_LAST); } catch (e) { /* noop */ }
  try { await api.alarms.clear(ALARM_AGENDA_LAST_OUT); } catch (e) { /* noop */ }
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
    agendaRooms: null,
    agendaLastError: "",
    agendaState: { inUntil: 0, inTitle: "", nextStart: 0, nextTitle: "" },
    notifyEnabled: false,
    notifyMailboxUuid: "",
    notifyMailboxEmail: "",
    notifyMailboxName: "",
    notifyMailboxHosting: 0,
    notifyMailboxLogin: "",
    notifyTokenEnc: null,
    bilanEnabled: false,
    bilanEmail: "",
    mailStatsEnabled: false,
    tokensReset: false
  };
  await kvSet(patch);
  // Plus aucun jeton : la cle de chiffrement part aussi.
  await secretForget();
  return { ok: true };
}
