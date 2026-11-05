// Koala Zen, le fond : Prevenir les participants et l'envoi de mail.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Prevenir les participants par mail, 2026-09-22. Trois messages, retard de
// cinq ou dix minutes ou absence, relus et envoyes d'un clic depuis la boite
// Infomaniak de l'utilisateur. Circuit du serveur MCP mail, verifie dans son
// code : liste des boites sur mail.infomaniak.com/api/mailbox, brouillon POST
// /mail/{uuid}/draft en action "save", puis PUT du meme brouillon en action
// "send". L'identite d'expedition vient des signatures de la boite (API du
// Manager), facultative. Les adresses des participants sont relues a la
// demande et jamais stockees : le cache ne garde que leur nombre.
// ===========================================================================

const NOTIFY_KINDS = { late5: 5, late10: 10, absent: 0 };
const NOTIFY_SENT_MAX = 60;

// Le jeton du mail, workspace:mail seul. Plus de repli sur celui de l'agenda.
async function notifyToken() {
  await securityReady();
  const r = await kvGet(["notifyTokenEnc"]);
  if (!r.notifyTokenEnc) return null;
  return secretDecrypt(r.notifyTokenEnc);
}

// Connexion du mail avec un jeton saisi : il n'est garde que si la liste des
// boites repond avec lui. Sans jeton saisi, la liste passe par notifyToken().
async function notifyConnect(tokenArg) {
  const saisi = String(tokenArg || "").trim();
  const liste = await notifyListMailboxes(saisi || null);
  if (!liste.ok) return liste;
  let agendaAussi = false;
  if (saisi) {
    const v = verdictSonde(await tokenExtras(saisi, "mail"), ["calendar"]);
    if (!v.ok) return v;
    agendaAussi = v.communs.indexOf("calendar") >= 0;
    const patch = { notifyTokenEnc: await secretEncrypt(saisi) };
    // Jeton commun : il sert aussi a l'agenda, s'il n'a pas deja le sien.
    if (agendaAussi && !(await kvGet(["agendaTokenEnc"])).agendaTokenEnc) { patch.agendaTokenEnc = await secretEncrypt(saisi); patch.tokensReset = false; }
    await kvSet(patch);
  }
  return Object.assign({}, liste, { calendarToo: agendaAussi });
}

// Eteindre Prevenir oublie la boite, l'adresse et le jeton propre au mail.
async function notifyDisconnect() {
  // Les stats des mails se servent de la meme boite : tant qu'elles sont
  // allumees, eteindre Prevenir ne coupe que Prevenir.
  const r = await kvGet(["mailStatsEnabled"]);
  if (r.mailStatsEnabled) { await kvSet({ notifyEnabled: false }); return { ok: true, kept: true }; }
  await kvSet({ notifyEnabled: false, notifyMailboxUuid: "", notifyMailboxEmail: "", notifyMailboxName: "", notifyMailboxHosting: 0, notifyMailboxLogin: "", notifyTokenEnc: null, bilanEnabled: false, bilanEmail: "" });
  return { ok: true };
}

async function notifyListMailboxes(tokenArg) {
  const token = tokenArg || (await notifyToken());
  if (!token) return { ok: false, error: "not_configured" };
  const r = await ikFetch(token, "/mailbox?with=aliases", { base: MAIL_API });
  if (!r.ok) return r;
  const liste = (Array.isArray(r.data) ? r.data : [])
    .filter((m) => m && m.uuid && m.email)
    .map((m) => ({
      uuid: String(m.uuid),
      email: String(m.email).toLowerCase(),
      name: String(m.mailbox || m.email),
      hostingId: Number(m.hosting_id) || 0,
      login: String(m.mailbox || ""),
      aliases: Array.isArray(m.aliases) ? m.aliases.map(String) : []
    }));
  if (!liste.length) return { ok: false, error: "no_mailbox" };
  // Les adresses d'expedition possibles : l'adresse de chaque boite et ses
  // alias, une seule fois, avec la boite qui les porte.
  const adresses = [];
  const vus = {};
  liste.forEach((mb) => {
    [mb.email].concat(mb.aliases).forEach((a) => {
      const adr = String(a || "").trim().toLowerCase();
      if (!adr || vus[adr]) return;
      vus[adr] = true;
      adresses.push({ uuid: mb.uuid, email: adr, name: mb.name, hostingId: mb.hostingId, login: mb.login, principal: adr === mb.email });
    });
  });
  return { ok: true, mailboxes: liste, addresses: adresses };
}

async function notifyChoose(mb) {
  if (!mb || !mb.uuid || !mb.email) return { ok: false, error: "no_mailbox" };
  await kvSet({
    notifyEnabled: true,
    notifyMailboxUuid: String(mb.uuid),
    notifyMailboxEmail: String(mb.email).toLowerCase(),
    notifyMailboxName: String(mb.name || mb.email),
    notifyMailboxHosting: Number(mb.hostingId) || 0,
    notifyMailboxLogin: String(mb.login || "")
  });
  return { ok: true };
}

// L'identite : la signature par defaut de l'adresse, si elle a un nom. Sans
// elle, l'API prend le nom du profil du compte. Un echec ici n'empeche rien.
async function notifyIdentity(token, r) {
  if (!r.notifyMailboxHosting || !r.notifyMailboxLogin) return null;
  try {
    const s = await ikFetch(token, "/1/mail_hostings/" + encodeURIComponent(r.notifyMailboxHosting) + "/mailboxes/" + encodeURIComponent(r.notifyMailboxLogin) + "/signatures");
    const sigs = (s.ok && s.data && Array.isArray(s.data.signatures)) ? s.data.signatures : [];
    const adr = String(r.notifyMailboxEmail || "").toLowerCase();
    const nommees = sigs.filter((x) => x && String(x.sender || "").toLowerCase() === adr && String(x.full_name || "").trim());
    const choisie = nommees.find((x) => x.is_default) || nommees[0] || null;
    return choisie ? { id: String(choisie.id), name: String(choisie.full_name).trim() } : null;
  } catch (e) { return null; }
}

function notifyTemplates(title, startMs) {
  // Un titre d'invitation externe peut porter
  // des retours a la ligne ou des caracteres de controle ; jamais dans un objet.
  const t = String(title || "").replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || bgMsg("meetingUntitled", "Sans titre");
  const h = agendaHeure(startMs);
  const retard = (n) => ({
    subject: bgMsg("notifySubjLate", "Retard de {n} min · {t}").replace("{n}", n).replace("{t}", t),
    body: bgMsg("notifyBodyLate", "Bonjour,\n\nJ'aurai environ {n} minutes de retard pour « {t} » ({h}). Commencez sans moi, je vous rejoins dès que possible.\n\nMerci et à tout de suite").split("{n}").join(n).split("{t}").join(t).split("{h}").join(h)
  });
  return {
    late5: retard(5),
    late10: retard(10),
    absent: {
      subject: bgMsg("notifySubjAbsent", "Absence · {t}").replace("{t}", t),
      body: bgMsg("notifyBodyAbsent", "Bonjour,\n\nJe ne pourrai pas participer à « {t} » ({h}).\n\nDésolé pour ce contretemps").split("{t}").join(t).split("{h}").join(h)
    }
  };
}

// ===========================================================================
// Jeton d'envoi. Une page ne peut preparer
// ou envoyer un mail QUE pour la bulle que le fond vient de lui montrer : le
// fond remet avec la bulle un jeton aleatoire, lie a cet onglet, a ce
// rendez-vous et a sa fin. Le rendez-vous et son debut viennent du jeton,
// jamais de la page ; l'objet et le texte sont ceux du fond. Le popup (page
// de l'extension) n'en a pas besoin. Et un quota borne les envois.
// ===========================================================================
const NOTIFY_NONCE_MAX = 20;
const NOTIFY_RATE_MAX = 6;
const NOTIFY_RATE_WINDOW_MS = 60 * 60 * 1000;
function hexAleatoire(n) { return Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function notifyNonceCreate(tabId, m) {
  const now = Date.now();
  const r = await kvGet(["notifyNonces"]);
  const liste = (r.notifyNonces && typeof r.notifyNonces === "object") ? r.notifyNonces : {};
  Object.keys(liste).forEach((k) => { if (!liste[k] || Number(liste[k].expires) <= now) delete liste[k]; });
  const cle = hexAleatoire(16);
  liste[cle] = { tabId: Number(tabId), id: String(m.id), start: Number(m.start) || 0, expires: (Number(m.end) > Number(m.start)) ? Number(m.end) : (Number(m.start) || now) + 60 * 60000 };
  const cles = Object.keys(liste);
  while (cles.length > NOTIFY_NONCE_MAX) delete liste[cles.shift()];
  await kvSet({ notifyNonces: liste });
  return cle;
}
// Le rendez-vous vise : celui du jeton pour une page, celui demande par le popup.
async function notifyCible(msg, sender) {
  if (depuisExtension(sender)) return { ok: true, id: msg.id, start: Number(msg.start) || 0, page: false };
  const cle = String(msg.nonce || "");
  if (!/^[0-9a-f]{32}$/.test(cle)) return { ok: false, error: "not_allowed" };
  const r = await kvGet(["notifyNonces"]);
  const n = r.notifyNonces && r.notifyNonces[cle];
  const tabId = sender && sender.tab ? Number(sender.tab.id) : -1;
  if (!n || Number(n.tabId) !== tabId || Number(n.expires) <= Date.now()) return { ok: false, error: "not_allowed" };
  if (msg.id !== undefined && String(msg.id) !== String(n.id)) return { ok: false, error: "not_allowed" };
  return { ok: true, id: n.id, start: Number(n.start) || 0, page: true };
}
// Au plus NOTIFY_RATE_MAX envois par heure, toutes origines confondues.
async function notifyQuota() {
  const now = Date.now();
  const r = await kvGet(["notifyRate"]);
  const t = (Array.isArray(r.notifyRate) ? r.notifyRate : []).filter((x) => Number(x) > now - NOTIFY_RATE_WINDOW_MS);
  return { ok: t.length < NOTIFY_RATE_MAX, liste: t };
}
const notifyEnCours = new Set();

function notifyKey(id, startMs) { return String(id) + "@" + String(Number(startMs) || 0); }

// Les participants d'un rendez-vous, relus a la demande, moi exclu,
// l'organisateur en tete, une adresse une seule fois. Avec les trois
// messages prets et la liste de ceux deja envoyes pour ce rendez-vous.
async function notifyPrepare(eventId, startMs) {
  const r = await kvGet(["notifyEnabled", "notifyMailboxUuid", "agendaMyUserId", "agendaMyEmail", "notifySent"]);
  if (!r.notifyEnabled || !r.notifyMailboxUuid) return { ok: false, error: "notify_off" };
  if (!eventId) return { ok: false, error: "no_event" };
  const token = await agendaToken();
  if (!token) return { ok: false, error: "not_configured" };
  const ev = await ikFetch(token, "/1/calendar/pim/event/" + encodeURIComponent(eventId) + "?with=attendees");
  if (!ev.ok) return ev;
  const e = ev.data || {};
  let attendees = Array.isArray(e.attendees) ? e.attendees : [];
  // Repli : si l'appel unitaire ne rend aucun invite, la liste autour du
  // debut, qui en rend toujours avec with=attendees, sert de source.
  if (!attendees.length && startMs) {
    const liste = await agendaFetchAll(token, agendaIds(await kvGet(["agendaCalendarId", "agendaCalendars"])), Number(startMs) - 60000, Number(startMs) + 60000);
    if (liste.ok) {
      const trouve = liste.events.find((x) => String(x.id) === String(eventId));
      if (trouve && Array.isArray(trouve.attendees)) attendees = trouve.attendees;
    }
  }
  const me = { userId: Number(r.agendaMyUserId) || 0, email: String(r.agendaMyEmail || "").toLowerCase() };
  // Vu en reel le 2026-09-22 : un invite peut porter la meme adresse que le
  // profil du compte tout en etant un AUTRE utilisateur (autre user_id). Pour
  // les destinataires, l'identifiant prime ; l'adresse ne tranche que quand
  // l'invite n'en a pas. Sinon "Personne a prevenir" alors qu'il y a quelqu'un.
  const estMoi = (a) => {
    if (me.userId && a.user_id != null && a.user_id !== "") return Number(a.user_id) === me.userId;
    return agendaIsMe(a, me, e);
  };
  const vus = {};
  const recipients = [];
  attendees.forEach((a) => {
    if (!a || !a.address || estMoi(a)) return;
    const adr = String(a.address).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(adr) || vus[adr]) return;
    vus[adr] = true;
    recipients.push({ name: String(a.name || "").trim(), address: adr, organizer: !!a.organizer });
  });
  recipients.sort((a, b) => (b.organizer ? 1 : 0) - (a.organizer ? 1 : 0));
  const debut = Number(startMs) || agendaParseTs(e.start);
  const sent = (r.notifySent && r.notifySent[notifyKey(eventId, debut)]) || [];
  return { ok: true, id: eventId, start: debut, title: String(e.title || "").trim(), recipients: recipients, sent: sent, templates: notifyTemplates(e.title, debut) };
}

function notifyHtml(texte) {
  const esc = String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  return "<html><body><div style=\"font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px;\">" + esc.replace(/\n/g, "<br>") + "</div></body></html>";
}

async function notifySend(p, cible) {
  p = p || {};
  cible = cible || { page: false };
  const kind = String(p.kind || "");
  if (!(kind in NOTIFY_KINDS)) return { ok: false, error: "bad_kind" };
  const to = (Array.isArray(p.to) ? p.to : []).map((a) => String(a || "").trim().toLowerCase()).filter((a) => /^[^@\s]+@[^@\s]+$/.test(a));
  const uniques = to.filter((a, i) => to.indexOf(a) === i);
  if (!uniques.length) return { ok: false, error: "no_recipients" };
  // Le texte relu (et retouche) vient de la bulle ou du popup ; l'objet, lui,
  // est toujours construit ici. Une page ne peut envoyer qu'avec son jeton,
  // aux invites seulement, une fois par message, dans le quota.
  const corpsLibre = String(p.body || "").trim().slice(0, 4000);
  if (!corpsLibre) return { ok: false, error: "empty" };
  const r = await kvGet(["notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxHosting", "notifyMailboxLogin", "notifySent"]);
  if (!r.notifyEnabled || !r.notifyMailboxUuid) return { ok: false, error: "notify_off" };
  const cle = notifyKey(p.id, p.start);
  const deja = (r.notifySent && Array.isArray(r.notifySent[cle])) ? r.notifySent[cle] : [];
  if (deja.indexOf(kind) >= 0) return { ok: false, error: "already_sent" };
  // Deux envois simultanes du meme message (bulle et popup) : un seul passe.
  const verrou = cle + "#" + kind;
  if (notifyEnCours.has(verrou)) return { ok: false, error: "already_sent" };
  notifyEnCours.add(verrou);
  try { return await notifySendVerrouille(p, kind, uniques, corpsLibre, r, cle, deja); }
  finally { notifyEnCours.delete(verrou); }
}
// Un mail depuis la boite choisie : brouillon POST /mail/{uuid}/draft en
// action "save", puis PUT du meme brouillon en action "send". Prevenir et
// le bilan de la semaine passent par ici ; chacun verifie ses destinataires.
// html : le corps est deja une page HTML construite par le fond (le bilan) ;
// sinon c'est un texte relu, echappe ici.
async function mailEnvoie(r, destinataires, subject, body, html) {
  const token = await notifyToken();
  if (!token) return { ok: false, error: "not_configured" };
  const identite = await notifyIdentity(token, r);
  const from = { id: null, name: identite ? identite.name : String(r.notifyMailboxEmail).split("@")[0], email: String(r.notifyMailboxEmail) };
  const brouillon = {
    uuid: null, subject: subject, body: html ? body : notifyHtml(body), quote: null, mime_type: "text/html",
    from: from, reply_to: { name: from.name, email: from.email },
    to: destinataires.map((a) => ({ name: "", email: a })), cc: null, bcc: null,
    references: "", in_reply_to: null, in_reply_to_uid: null, forwarded_uid: null, attachments: [],
    identity_id: identite ? identite.id : null, ack_request: false, st_uuid: null, uid: null, resource: null,
    priority: "normal", encrypted: false, encryption_password: "", event_poll_uuid: null, action: "save", delay: 0
  };
  const uuid = encodeURIComponent(r.notifyMailboxUuid);
  const json = { "Content-Type": "application/json" };
  const c = await ikFetch(token, "/mail/" + uuid + "/draft", { base: MAIL_API, method: "POST", headers: json, body: JSON.stringify(brouillon) });
  if (!c.ok) return c;
  const d = c.data || {};
  if (!d.uuid) return { ok: false, error: "draft_failed" };
  const envoi = Object.assign({}, brouillon, { uuid: d.uuid, uid: d.uid || null, action: "send", delay: 0, resource: "/api/mail/" + uuid + "/draft/" + encodeURIComponent(d.uuid) });
  const s = await ikFetch(token, "/mail/" + uuid + "/draft/" + encodeURIComponent(d.uuid), { base: MAIL_API, method: "PUT", headers: json, body: JSON.stringify(envoi) });
  if (!s.ok) return s;
  return { ok: true };
}

async function notifySendVerrouille(p, kind, uniques, corpsLibre, r, cle, deja) {
  const quota = await notifyQuota();
  if (!quota.ok) return { ok: false, error: "rate_limited" };
  // 2026-09-29 : les destinataires sont relus dans l'agenda et CHAQUE
  // adresse demandee doit en faire partie. Une bulle detournee ne peut donc
  // ni ajouter une adresse ni ecrire a quelqu'un d'autre que les invites.
  const prep = await notifyPrepare(p.id, p.start);
  if (!prep.ok) return prep;
  const permis = {};
  prep.recipients.forEach((x) => { permis[x.address] = true; });
  if (uniques.some((a) => !permis[a])) return { ok: false, error: "bad_recipients" };
  // L'objet est toujours celui du fond, construit sur le vrai titre.
  const gabarit = prep.templates[kind];
  const subject = String(gabarit.subject || "").slice(0, 200);
  const body = corpsLibre || String(gabarit.body || "");
  const parti = await mailEnvoie(r, uniques, subject, body);
  if (!parti.ok) return parti;
  const sent = (r.notifySent && typeof r.notifySent === "object") ? r.notifySent : {};
  sent[cle] = deja.concat([kind]);
  const cles = Object.keys(sent);
  while (cles.length > NOTIFY_SENT_MAX) delete sent[cles.shift()];
  await kvSet({ notifySent: sent, notifyRate: quota.liste.concat([Date.now()]) });
  // Prevenir de son absence : la reunion n'aura pas lieu pour soi, elle sort
  // des statistiques comme avec "N'a pas eu lieu".
  // Absence ou retard : la decision est prise, la bulle n'a plus a rester.
  // Envoye depuis le popup, la bulle ouverte dans une page se ferme ; depuis
  // la bulle, c'est elle qui se ferme apres l'avoir dit.
  let late = 0;
  if (kind === "absent") await meetingSkip(p.id, p.start, "absent");
  else { late = NOTIFY_KINDS[kind]; await meetingLate(p.id, p.start, late); }
  if (!p.depuisPage) await agendaCloseBubbleOf(p.start);
  return { ok: true, count: uniques.length, skipped: kind === "absent", late: late };
}
