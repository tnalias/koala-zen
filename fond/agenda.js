// Koala Zen, le fond : l'agenda : lecture, marquage des reunions, planification des rappels.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Agenda Infomaniak. Silence des rappels et des animaux pendant un rendez-vous
// a deux personnes ou plus (moi compris), et rappel visible cinq minutes
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
// 2026-09-21 : seconde alarme, avant la FIN d'un rendez-vous (six minutes
// depuis le 2026-11-02, voir AGENDA_END_BEFORE_MS),
// pour tenir la duree prevue. Meme mecanique que le rappel du debut, sa
// propre liste des fins deja annoncees, sa propre couleur cote page.
const ALARM_AGENDA_END = "kz-agenda-end";
// 2026-11-03 : un dernier avertissement, rouge, vingt secondes avant le
// debut, meme si la bulle des cinq minutes a ete fermee. Il s'efface seul
// trois secondes avant le debut. Lie a l'interrupteur du rappel du debut.
const ALARM_AGENDA_LAST = "kz-agenda-last";
const AGENDA_LAST_BEFORE_MS = 20 * 1000;
const AGENDA_LAST_MIN_MS = 4 * 1000;
// 2026-11-04 : l'alerte arrivait en retard et repartait aussitot. Une alarme
// peut etre retardee d'une duree arbitraire (documentation de Chrome), et
// chaque seconde de retard etait retiree de l'affichage. L'alarme sonne
// maintenant une minute avant le debut ; les pages programment elles-memes
// l'affichage a vingt secondes, avec leur propre minuterie.
const AGENDA_LAST_ARM_MS = 60 * 1000;
// 2026-11-04 : hors du navigateur. Quand une autre app est au premier plan,
// les rappels de reunion partent aussi en notification du systeme, qui
// s'affiche par-dessus tout. Pour l'alerte des vingt secondes, une seconde
// alarme regarde, a l'heure dite, si le navigateur est devant.
const ALARM_AGENDA_LAST_OUT = "kz-agenda-last-out";
const AGENDA_REFRESH_MS = 5 * 60 * 1000;
const AGENDA_WINDOW_BEFORE_MS = 12 * 60 * 60 * 1000;
const AGENDA_WINDOW_AFTER_MS = 36 * 60 * 60 * 1000;
// 2026-10-29 : cinq minutes avant le debut, le temps de finir ce qu'on fait et de rejoindre.
const AGENDA_WARN_BEFORE_MS = 5 * 60 * 1000;
const AGENDA_MAX_PAGES = 10;
// 2026-11-02 : six minutes avant la fin, une de plus que le rappel du debut.
// Deux rendez-vous qui s'enchainent (13:00-13:30 puis 13:30) faisaient
// sonner la fin du premier et le debut du second a la meme seconde, et la
// fin prenait la place du debut : un rappel de debut a ete perdu. Desormais
// la fin passe d'abord, le debut une minute plus tard prend la place.
const AGENDA_END_BEFORE_MS = 6 * 60 * 1000;
// Les rappels d'agenda passent un par un, jamais en meme temps : deux
// alarmes simultanees lisaient la meme bulle ouverte et s'ecrasaient.
let agendaFile = Promise.resolve();
function agendaNotifyEnFile(m, nowMs, kind) {
  const p = agendaFile.then(() => agendaNotify(m, nowMs, kind));
  agendaFile = p.catch(() => {});
  return p;
}
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
  let events = Array.isArray(r.data) ? r.data : [];
  // Une liste rendue en plusieurs pages est lue en entier (2026-10-28) : un
  // agenda charge ne doit pas perdre ses rendez-vous au-dela de la premiere.
  for (let p = 2; p <= Math.min(r.pages || 1, AGENDA_MAX_PAGES); p++) {
    const suite = await ikFetch(token, "/1/calendar/pim/event" + qs + "&page=" + p);
    if (!suite.ok) return suite;
    if (Array.isArray(suite.data)) events = events.concat(suite.data);
  }
  return { ok: true, events: events };
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
// que j'ai declinees. Le rappel de debut suit la meme regle depuis le
// 2026-10-28. Seul le silence garde la regle du rendez-vous a deux ou plus,
// via le marqueur `meeting` du cache.
function agendaIsTimed(e, me) {
  if (!e || e.fullday) return false;
  const att = Array.isArray(e.attendees) ? e.attendees : [];
  const moi = att.find((a) => agendaIsMe(a, me || {}, e));
  if (moi && String(moi.state || "").toUpperCase() === "DECLINED") return false;
  return true;
}

function agendaKey(m) { return String(m.id) + "@" + String(m.start); }

// 2026-11-03 : la salle du rendez-vous, dans les rappels et l'alerte. Un
// rendez-vous porte l'identifiant de sa salle reservee (bookable_resource_id),
// dont le nom vient de la liste des salles (circuit du serveur MCP agenda
// officiel). Sans salle reservee, le lieu saisi a la main, sauf un lien.
const AGENDA_ROOMS_MS = 24 * 60 * 60 * 1000;
const AGENDA_ROOM_MAX = 80;
function agendaRoom(e, rooms) {
  const id = e && e.bookable_resource_id ? String(e.bookable_resource_id) : "";
  const nom = id && rooms && typeof rooms[id] === "string" ? rooms[id].trim() : "";
  if (nom) return nom.slice(0, AGENDA_ROOM_MAX);
  const lieu = (e && typeof e.location === "string") ? e.location.replace(/\s+/g, " ").trim() : "";
  if (!lieu || /:\/\//.test(lieu)) return "";
  return lieu.slice(0, AGENDA_ROOM_MAX);
}
// Les noms des salles, gardes dans le coffre. Relus une fois par jour, ou
// quand une salle encore inconnue apparait, jamais plus d'une fois par
// rafraichissement. Un refus (perimetre, reseau) laisse le lieu saisi.
async function agendaRoomNames(token, events, nowMs) {
  const ids = (Array.isArray(events) ? events : []).map((e) => (e && e.bookable_resource_id ? String(e.bookable_resource_id) : "")).filter(Boolean);
  const r = await kvGet(["agendaRooms"]);
  const memo = (r.agendaRooms && typeof r.agendaRooms === "object") ? r.agendaRooms : {};
  const noms = (memo.names && typeof memo.names === "object") ? memo.names : {};
  if (!ids.length) return noms;
  const age = nowMs - (Number(memo.at) || 0);
  const inconnue = ids.some((id) => !(id in noms));
  if (!(age >= AGENDA_ROOMS_MS || (inconnue && age >= AGENDA_REFRESH_MS))) return noms;
  const res = await ikFetch(token, "/1/calendar/pim/bookable-resources/all");
  if (!res.ok) { await kvSet({ agendaRooms: { at: nowMs, names: noms } }); return noms; }
  const neufs = {};
  (Array.isArray(res.data) ? res.data : []).forEach((x) => {
    if (x && x.uuid && typeof x.name === "string" && x.name.trim()) neufs[String(x.uuid)] = x.name.trim().slice(0, AGENDA_ROOM_MAX);
  });
  await kvSet({ agendaRooms: { at: nowMs, names: neufs } });
  return neufs;
}

function agendaNormalize(e, me, rooms) {
  let url = String(e.meet_room_url || "");
  if (!url && Array.isArray(e.external_meet_room_urls) && e.external_meet_room_urls.length) url = String(e.external_meet_room_urls[0] || "");
  if (!/^https?:\/\//i.test(url)) url = "";
  const start = agendaParseTs(e.start);
  return {
    id: e.id,
    title: String(e.title || "").trim(),
    start: start,
    // Un evenement sans duree (fin absente ou egale au debut) reste un
    // rendez-vous a rappeler : sa fin vaut son debut.
    end: Math.max(start, agendaParseTs(e.end) || start),
    url: url,
    people: Array.isArray(e.attendees) ? e.attendees.length : 0,
    room: agendaRoom(e, rooms),
    meeting: agendaIsMeeting(e, me || {})
  };
}

// Le cache garde tous les evenements a horaire, chacun avec son marqueur
// `meeting`. Un cache d'avant le 2026-09-21 n'a pas ce marqueur : ses
// entrees etaient toutes des reunions, elles sont lues comme telles.
function agendaEventsFrom(events, me, rooms) {
  const vus = {};
  return (Array.isArray(events) ? events : [])
    .filter((e) => agendaIsTimed(e, me))
    .map((e) => agendaNormalize(e, me, rooms))
    .filter((m) => m.start && m.end >= m.start)
    // Le meme evenement present dans deux agendas surveilles ne compte qu'une fois.
    .filter((m) => { const k = agendaKey(m); if (vus[k]) return false; vus[k] = true; return true; })
    .sort((a, b) => a.start - b.start);
}
function agendaMeetingsFrom(events, me) {
  return agendaEventsFrom(events, me).filter((m) => m.meeting !== false);
}
function agendaMeetings(cache) {
  return agendaTimed(cache).filter((m) => m.meeting !== false);
}
// Tous les evenements a horaire du cache, reunions comme blocs solo. Un
// rendez-vous marque "n'a pas eu lieu" n'y est plus : ni silence, ni rappel,
// ni minutes dans les statistiques.
function agendaTimed(cache) {
  return (cache && Array.isArray(cache.events)) ? cache.events.filter((m) => !m.skipped) : [];
}

// 2026-11-05 : un seul marquage par reunion, dans le coffre, sous sa cle
// id@debut : retiree (n'aura pas lieu, n'a pas eu lieu, absence), retard
// annonce en minutes, fin anticipee (Terminer). Il garde aussi le titre et la
// fin prevue, pour le bilan de la semaine. Chaque cache relu est marque a
// nouveau ; les marques de plus de cent jours partent. Il remplace trois
// listes separees (2026-11-03 au 05), reprises une fois a la lecture.
const MEETING_MARKS_DAYS = 100;
const MEETING_MARKS_MAX = 1000;
async function marquesLire() {
  const r = await kvGet(["meetingMarks", "meetingSkipped", "meetingLate", "meetingEnded"]);
  const marques = (r.meetingMarks && typeof r.meetingMarks === "object") ? r.meetingMarks : {};
  const fiche = (k) => (marques[k] = Object.assign({ start: Number(String(k).split("@").pop()) || 0 }, marques[k]));
  let ancien = false;
  if (Array.isArray(r.meetingSkipped)) { r.meetingSkipped.forEach((k) => { fiche(k).skipped = true; }); ancien = true; }
  if (r.meetingLate && typeof r.meetingLate === "object") { Object.keys(r.meetingLate).forEach((k) => { fiche(k).late = Number(r.meetingLate[k]) || 0; }); ancien = true; }
  if (r.meetingEnded && typeof r.meetingEnded === "object") { Object.keys(r.meetingEnded).forEach((k) => { fiche(k).endedAt = Number(r.meetingEnded[k]) || 0; }); ancien = true; }
  if (ancien) await kvSet({ meetingMarks: marques, meetingSkipped: null, meetingLate: null, meetingEnded: null });
  return marques;
}
function marquesElaguer(marques, nowMs) {
  Object.keys(marques).forEach((k) => { if ((Number(marques[k].start) || 0) < nowMs - MEETING_MARKS_DAYS * 24 * 60 * 60 * 1000) delete marques[k]; });
  const cles = Object.keys(marques).sort((a, b) => (marques[a].start || 0) - (marques[b].start || 0));
  while (cles.length > MEETING_MARKS_MAX) delete marques[cles.shift()];
  return marques;
}
function agendaApplyMarks(cache, marques) {
  const mq = (marques && typeof marques === "object") ? marques : {};
  ((cache && cache.events) || []).forEach((m) => {
    const f = mq[agendaKey(m)];
    if (f && f.skipped) m.skipped = true; else delete m.skipped;
    if (f && f.late > 0) m.lateMs = f.late * 60000; else delete m.lateMs;
    if (f && f.endedAt && f.endedAt < m.end) m.end = Math.max(m.start, f.endedAt);
  });
  return cache;
}
// Marque une reunion (et son double vu dans un autre agenda) : change(fiche)
// ecrit la decision. Le cache est marque dans la foulee.
async function marquer(id, start, change) {
  const now = Date.now();
  const cache = (await kvGet(["agendaCache"])).agendaCache || null;
  const evs = (cache && Array.isArray(cache.events)) ? cache.events : [];
  const cle = agendaKey({ id: id, start: Number(start) || 0 });
  const cles = agendaSameMeeting(evs, cle);
  const m0 = evs.find((x) => agendaKey(x) === cle);
  const marques = await marquesLire();
  cles.forEach((k) => {
    const f = Object.assign({ start: Number(String(k).split("@").pop()) || 0 }, marques[k]);
    if (m0) {
      f.title = m0.title;
      f.meeting = m0.meeting !== false;
      if (f.plannedEnd == null) f.plannedEnd = m0.end;
    }
    change(f);
    f.at = now;
    marques[k] = f;
  });
  marquesElaguer(marques, now);
  const patch = { meetingMarks: marques };
  if (cache) patch.agendaCache = agendaApplyMarks(cache, marques);
  await kvSet(patch);
  return { cles: cles, cache: cache, now: now };
}

// L'heure que vise l'alerte : le debut, ou l'arrivee annoncee.
function agendaLastAt(m) { return m.start + (Number(m.lateMs) || 0); }
function agendaParCible(evs) { return evs.slice().sort((a, b) => agendaLastAt(a) - agendaLastAt(b)); }

// 2026-11-05 : un retard annonce (Prevenir, 5 ou 10 min) decale l'alerte
// rouge a l'heure d'arrivee annoncee. La bulle du debut se ferme.
async function meetingLate(id, start, minutes) {
  const min = Number(minutes) || 0;
  const t = await marquer(id, start, (f) => { f.late = Math.max(Number(f.late) || 0, min); });
  // L'alerte deja passee ou armee pour l'heure prevue sera reposee a l'arrivee.
  const r = await kvGet(["agendaLastWarned", "agendaLastOutWarned"]);
  const sauf = (liste) => (Array.isArray(liste) ? liste : []).filter((k) => t.cles.indexOf(k) < 0);
  await kvSet({ agendaLastWarned: sauf(r.agendaLastWarned), agendaLastOutWarned: sauf(r.agendaLastOutWarned) });
  await agendaLastCancel(start);
  await agendaNotifsClear([].concat.apply([], t.cles.map((k) => ["kz-agenda-" + k, "kz-agenda-last-" + k])));
  if (t.cache) await agendaScheduleLast(t.cache, t.now);
  return { ok: true, late: min };
}

// La meme reunion vue dans deux agendas surveilles porte deux identifiants :
// meme titre, meme debut, meme fin, elle sort des deux.
function agendaSameMeeting(evs, cle) {
  const m = evs.find((x) => agendaKey(x) === cle);
  if (!m) return [cle];
  return evs.filter((x) => x.start === m.start && x.end === m.end && x.title === m.title).map(agendaKey);
}
// Retiree : hors des stats, du silence et des rappels. raison : "absent"
// quand on a prevenu de son absence, pour le bilan.
async function meetingSkip(id, start, raison) {
  const t = await marquer(id, start, (f) => { f.skipped = true; f.reason = raison === "absent" ? "absent" : "skip"; });
  const r = await kvGet(["meetingDaily"]);
  const daily = (r.meetingDaily && typeof r.meetingDaily === "object") ? r.meetingDaily : {};
  Object.keys(daily).forEach((j) => { if (daily[j] && typeof daily[j] === "object") t.cles.forEach((k) => { delete daily[j][k]; }); });
  await kvSet({ meetingDaily: daily });
  if (t.cache) {
    await agendaUpdateState(t.cache, t.now);
    await agendaScheduleLast(t.cache, t.now);
    await agendaScheduleEnd(t.cache, t.now);
  }
  await agendaLastCancel(start);
  await agendaNotifsClear([].concat.apply([], t.cles.map((k) => ["kz-agenda-" + k, "kz-agenda-end-" + k, "kz-agenda-last-" + k])));
  await barHide(start);
  return { ok: true, skipped: true };
}
// La bulle d'agenda ouverte de ce rendez-vous (meme heure de debut), fermee
// par sa page avec sa sortie habituelle.
async function agendaCloseBubbleOf(startMs) {
  const st = await bubbleGet();
  const type = st && st.payload ? st.payload.type : "";
  if (!st || (type !== "kz-meeting-soon" && type !== "kz-meeting-end") || Number(st.payload.start) !== Number(startMs)) return false;
  try {
    const r = await api.tabs.sendMessage(st.tabId, { type: "kz-meeting-close", bubbleId: st.id });
    return !!(r && r.closed);
  } catch (e) { return false; }
}
// Une page ne vise que le rendez-vous de SA bulle d'agenda ouverte, debut
// ou fin, relu dans l'etat de la bulle, jamais un identifiant qu'elle
// fournirait.
async function meetingSkipCible(msg, sender) {
  if (depuisExtension(sender)) return { ok: true, id: msg.id, start: Number(msg.start) || 0 };
  const st = await bubbleGet();
  const tabId = sender && sender.tab ? sender.tab.id : -1;
  const type = st && st.payload ? st.payload.type : "";
  if (!st || st.id !== msg.bubbleId || st.tabId !== tabId || (type !== "kz-meeting-end" && type !== "kz-meeting-soon")) return { ok: false, error: "not_allowed" };
  return { ok: true, id: st.payload.id, start: Number(st.payload.start) || 0 };
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
  // Le marquage relu ici fait foi : un cache lu juste avant un "n'a pas eu
  // lieu" ou un "Terminer" ne rend pas ses minutes a la reunion.
  agendaAccrueInto(daily, agendaApplyMarks(cache, await marquesLire()), nowMs, r.screenTimezone);
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
  const passe = agendaApplyMarks({ at: nowMs, events: agendaEventsFrom(ev.events, me) }, await marquesLire());
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
  // et le rappel cinq minutes avant (agendaWarn). Elle vit tant que l'une
  // des deux est allumee.
  if (!agendaActif(r)) return { ok: false, error: "not_configured" };
  if (!opts.force && r.agendaCache && now - (Number(r.agendaCache.at) || 0) < AGENDA_REFRESH_MS) return { ok: true, cached: true };
  const token = await agendaToken();
  if (!token) { await agendaRememberError("not_configured"); return { ok: false, error: "not_configured" }; }
  const ev = await agendaFetchAll(token, agendaIds(r), now - AGENDA_WINDOW_BEFORE_MS, now + AGENDA_WINDOW_AFTER_MS);
  if (!ev.ok) { await agendaRememberError(ev.error); return ev; }
  const me = { userId: Number(r.agendaMyUserId) || 0, email: String(r.agendaMyEmail || "").toLowerCase() };
  const salles = await agendaRoomNames(token, ev.events, now);
  const cache = agendaApplyMarks({ at: now, events: agendaEventsFrom(ev.events, me, salles) }, await marquesLire());
  await kvSet({ agendaCache: cache, agendaLastError: "" });
  await agendaApresRelecture(r.agendaCache, cache, now);
  await agendaUpdateState(cache, now);
  await agendaAccrueMeetings(cache, now);
  await agendaScheduleWarn(cache, now);
  await agendaScheduleLast(cache, now);
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
  if (r.agendaCache) { await agendaUpdateState(r.agendaCache, now); await agendaAccrueMeetings(r.agendaCache, now); await agendaNotifsMenage(r.agendaCache, now); }
  await agendaRefresh({ now: now });
}

// Une seule alarme ponctuelle, posee sur le prochain rendez-vous pas encore
// annonce, a la seconde pres. 2026-10-28 : TOUS les evenements a horaire,
// comme le rappel de fin. Avant, seules les reunions a deux ou plus ou l'on
// me reconnaissait parmi les invites sonnaient, et des rendez-vous passaient
// sans rappel. Chrome impose 30 s minimum, sans effet ici.
// 2026-11-05 : un seul planificateur pour les quatre rappels d'un
// rendez-vous. Chacun dit son alarme, sa liste de rendez-vous deja faits,
// l'interrupteur qui le commande, l'heure qu'il vise (0 : rien a viser),
// son avance, le delai sous lequel il ne vise plus, et sa marge de
// declenchement. Les quatre alarmes restent separees : une par rappel.
const AGENDA_RAPPELS = {
  // 2026-11-05 : une reunion en salle, sans visio, se rappelle dix minutes
  // avant, le temps d'y aller.
  warn: { alarme: ALARM_AGENDA_WARN, liste: "agendaWarned", interrupteur: "agendaWarn", cible: (m) => m.start, avance: (m) => (m.room && !m.url ? AGENDA_WARN_ROOM_MS : AGENDA_WARN_BEFORE_MS), apres: 0, marge: 15000 },
  // Sans duree, pas de fin a annoncer ; une fin dont l'heure d'annonce est
  // passee n'est plus visee.
  end: { alarme: ALARM_AGENDA_END, liste: "agendaEndWarned", interrupteur: "agendaEndWarn", cible: (m) => (m.end > m.start ? m.end : 0), avance: AGENDA_END_BEFORE_MS, apres: AGENDA_END_BEFORE_MS, marge: 15000 },
  last: { alarme: ALARM_AGENDA_LAST, liste: "agendaLastWarned", interrupteur: "agendaWarn", cible: (m) => agendaLastAt(m), avance: AGENDA_LAST_ARM_MS, apres: AGENDA_LAST_MIN_MS, marge: 2000 },
  out: { alarme: ALARM_AGENDA_LAST_OUT, liste: "agendaLastOutWarned", interrupteur: "agendaWarn", cible: (m) => agendaLastAt(m), avance: AGENDA_LAST_BEFORE_MS, apres: AGENDA_LAST_MIN_MS, marge: 2000 }
};
const AGENDA_WARN_ROOM_MS = 10 * 60 * 1000;
function agendaAvance(p, m) { return typeof p.avance === "function" ? p.avance(m) : p.avance; }
async function agendaPlanifie(type, cache, nowMs) {
  const p = AGENDA_RAPPELS[type];
  try { await api.alarms.clear(p.alarme); } catch (e) { /* noop */ }
  const r = await kvGet([p.interrupteur, p.liste]);
  if (r[p.interrupteur] === false) return null;
  const deja = Array.isArray(r[p.liste]) ? r[p.liste] : [];
  let prochain = null;
  agendaTimed(cache).forEach((m) => {
    const c = p.cible(m);
    if (!c || c <= nowMs + p.apres || deja.indexOf(agendaKey(m)) >= 0) return;
    // Le premier a sonner, pas le premier a commencer : les avances different.
    if (!prochain || c - agendaAvance(p, m) < p.cible(prochain) - agendaAvance(p, prochain)) prochain = m;
  });
  if (!prochain) return null;
  const when = Math.max(nowMs + 1000, p.cible(prochain) - agendaAvance(p, prochain));
  try { api.alarms.create(p.alarme, { when: when }); } catch (e) { /* noop */ }
  return when;
}
// Les rendez-vous dont le rappel est du maintenant, dans l'ordre de l'heure visee.
function agendaDus(type, cache, nowMs, deja) {
  const p = AGENDA_RAPPELS[type];
  return agendaTimed(cache).filter((m) => {
    const c = p.cible(m);
    return c && c > nowMs && c - agendaAvance(p, m) <= nowMs + p.marge && deja.indexOf(agendaKey(m)) < 0;
  }).sort((a, b) => p.cible(a) - p.cible(b));
}
function agendaScheduleWarn(cache, nowMs) { return agendaPlanifie("warn", cache, nowMs); }

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
  const dus = agendaDus("warn", cache, now, deja);
  for (let i = 0; i < dus.length; i++) {
    await agendaNotifyEnFile(dus[i], now);
    deja.push(agendaKey(dus[i]));
  }
  if (deja.length > AGENDA_WARNED_MAX) deja = deja.slice(-AGENDA_WARNED_MAX);
  await kvSet({ agendaWarned: deja });
  await agendaScheduleWarn(cache, now);
}

// Le dernier avertissement : le prochain debut pas encore averti, a vingt
// secondes. Un debut a moins de quatre secondes n'est plus averti.
async function agendaScheduleLast(cache, nowMs) {
  await agendaPlanifie("out", cache, nowMs);
  return agendaPlanifie("last", cache, nowMs);
}

function agendaScheduleLastOut(cache, nowMs) { return agendaPlanifie("out", cache, nowMs); }

// A vingt secondes : si une autre app est devant, l'alerte part aussi en
// notification du systeme. Navigateur devant, la page s'en charge seule.
async function agendaLastOutFire() {
  const now = Date.now();
  const r = await kvGet(["agendaCalendarId", "agendaWarn", "agendaCache", "agendaLastOutWarned"]);
  if (!r.agendaCalendarId || r.agendaWarn === false) return;
  const cache = r.agendaCache || { events: [] };
  let deja = Array.isArray(r.agendaLastOutWarned) ? r.agendaLastOutWarned : [];
  const dus = agendaDus("out", cache, now, deja);
  const m = dus[0];
  if (m && agendaLastAt(m) - now >= AGENDA_LAST_MIN_MS && !(await navigateurDevant()) && (await machineEveillee())) await agendaLastNotification(m, now);
  dus.forEach((x) => deja.push(agendaKey(x)));
  if (deja.length > AGENDA_WARNED_MAX) deja = deja.slice(-AGENDA_WARNED_MAX);
  await kvSet({ agendaLastOutWarned: deja });
  await agendaScheduleLastOut(cache, now);
}

async function agendaLastFire() {
  const now = Date.now();
  const r = await kvGet(["agendaCalendarId", "agendaWarn", "agendaCache", "agendaLastWarned"]);
  if (!r.agendaCalendarId || r.agendaWarn === false) return;
  const cache = r.agendaCache || { events: [] };
  let deja = Array.isArray(r.agendaLastWarned) ? r.agendaLastWarned : [];
  const dus = agendaDus("last", cache, now, deja);
  // Un seul avertissement a la fois : le premier debut. Une machine en veille
  // ou une alarme trop en retard n'avertit plus, l'instant est passe.
  const m = dus[0];
  if (m && agendaLastAt(m) - now >= AGENDA_LAST_MIN_MS && (await machineEveillee())) await agendaLastCall(m, now);
  dus.forEach((x) => deja.push(agendaKey(x)));
  if (deja.length > AGENDA_WARNED_MAX) deja = deja.slice(-AGENDA_WARNED_MAX);
  await kvSet({ agendaLastWarned: deja });
  await agendaScheduleLast(cache, now);
}

// Hors de la bulle unique : l'avertissement ne prend la place de rien et
// part tout seul. Il est confie a tous les onglets web ouverts, sauf ceux de
// visio : chaque page l'arme et ne l'affiche, a vingt secondes, que si elle
// est a l'ecran. Changer d'onglet pendant le compte le fait suivre. Sur une
// page de visio au premier plan, rien, on y est deja. Sans page web au
// premier plan, une notification du systeme, retiree a trois secondes du
// debut. La page qui l'affiche ferme la bulle du debut restee ouverte.
async function agendaLastCall(m, nowMs) {
  const tab = await targetTab();
  const cfg = { ...DEFAULTS, ...(await kvGet(["muteInCalls", "mutedPatterns"])) };
  const visio = (t) => !!(t && cfg.muteInCalls && matchesMuted(t.url, cfg.mutedPatterns));
  if (visio(tab)) return "visio";
  const at = agendaLastAt(m);
  const payload = { type: "kz-meeting-last", id: m.id, title: m.title, start: m.start, at: at, late: at > m.start, showAt: at - AGENDA_LAST_BEFORE_MS, room: m.room || "" };
  let armee = false;
  if (tab) armee = await bubbleSendToTab(tab, payload);
  await envoieAuxOnglets((await ongletsWeb(true)).filter((t) => !tab || t.id !== tab.id), payload);
  if (armee) return "tab";
  return (await agendaLastNotification(m, nowMs)) ? "notification" : "none";
}

// L'alerte en notification du systeme, retiree a trois secondes du debut.
async function agendaLastNotification(m, nowMs) {
  const id = "kz-agenda-last-" + agendaKey(m);
  const ok = await notificationSysteme(id, {
    type: "basic",
    iconUrl: api.runtime.getURL("icons/icon-128.png"),
    title: (agendaLastAt(m) > m.start ? bgMsg("meetingLastLateNotif", "À rejoindre dans {s} s") : bgMsg("meetingLastNotif", "Commence dans {s} s")).replace("{s}", Math.round((agendaLastAt(m) - nowMs) / 1000)),
    message: (m.title || bgMsg("meetingUntitled", "Sans titre")) + (m.room ? " · " + m.room : "")
  });
  if (ok) setTimeout(() => { try { api.notifications.clear(id); } catch (e) { /* noop */ } }, Math.max(0, agendaLastAt(m) - 3000 - Date.now()));
  return ok;
}

// L'alarme de fin : l'evenement dont la fin moins cinq minutes est la plus
// proche et pas encore annoncee. Un evenement deja en cours compte, c'est
// meme le cas le plus frequent. TOUS les evenements a horaire, reunions
// comme blocs solo, decision du 2026-09-21.
function agendaScheduleEnd(cache, nowMs) { return agendaPlanifie("end", cache, nowMs); }

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
  const dus = agendaDus("end", cache, now, deja);
  for (let i = 0; i < dus.length; i++) {
    await agendaNotifyEnFile(dus[i], now, "end");
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
