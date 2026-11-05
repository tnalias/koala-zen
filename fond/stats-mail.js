// Koala Zen, le fond : sauvegarde des connexions et mails dans les stats.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Sauvegarde des connexions. Les deux jetons (agenda, mail) et ce qui va
// avec (agendas, boite) ne partent dans un fichier que chiffres par une
// phrase secrete tapee a l'export et a l'import, jamais enregistree.
// 2026-09-29 : 12 caracteres au moins (4 auparavant, cassable en quelques
// heures), PBKDF2-SHA256 600 000 tours (recommandation OWASP) puis AES-GCM
// 256. Le nombre de tours voyage avec le fichier. Un fichier v1 (avant ce
// jour) rend ses reglages mais JAMAIS ses jetons : ils avaient plusieurs
// perimetres. Les jetons ne transitent qu'ici, jamais en clair par le popup.
// ===========================================================================
const CONNEXIONS_ITER = 600000;
const CONNEXIONS_MIN_PASS = 12;
const CONNEXIONS_ITER_MAX = 5000000;
const CONNEXIONS_KEYS = ["agendaCalendars", "agendaCalendarId", "agendaCalendarName", "agendaMyUserId", "agendaMyEmail", "notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxHosting", "notifyMailboxLogin"];

async function connexionsKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function connexionsExport(pass) {
  pass = String(pass || "");
  if (pass.length < CONNEXIONS_MIN_PASS) return { ok: false, error: "pass_short" };
  const r = await kvGet(CONNEXIONS_KEYS.concat(["agendaTokenEnc", "notifyTokenEnc"]));
  const clair = { v: 2 };
  CONNEXIONS_KEYS.forEach((k) => { if (r[k] !== undefined) clair[k] = r[k]; });
  clair.agendaToken = r.agendaTokenEnc ? (await secretDecrypt(r.agendaTokenEnc)) || "" : "";
  clair.notifyToken = r.notifyTokenEnc ? (await secretDecrypt(r.notifyTokenEnc)) || "" : "";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await connexionsKey(pass, salt, CONNEXIONS_ITER);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify(clair)));
  return { ok: true, blob: { v: 2, kdf: "PBKDF2-SHA256", iter: CONNEXIONS_ITER, salt: Array.from(salt), iv: Array.from(iv), data: Array.from(new Uint8Array(data)) },
    parts: { agenda: !!clair.agendaToken, notify: !!clair.notifyToken } };
}

async function connexionsImport(blob, pass) {
  pass = String(pass || "");
  if (!blob || (blob.v !== 1 && blob.v !== 2) || !Array.isArray(blob.salt) || !Array.isArray(blob.iv) || !Array.isArray(blob.data)) return { ok: false, error: "bad_blob" };
  // Un fichier piege ne bloque pas le fond.
  const octets = (a) => a.every((x) => Number.isInteger(x) && x >= 0 && x <= 255);
  if (blob.salt.length !== 16 || blob.iv.length !== 12 || blob.data.length > 1000000 || !octets(blob.salt) || !octets(blob.iv) || !octets(blob.data)) return { ok: false, error: "bad_blob" };
  if (blob.iter !== undefined && (!Number.isFinite(Number(blob.iter)) || Number(blob.iter) > CONNEXIONS_ITER_MAX)) return { ok: false, error: "bad_blob" };
  // Un ancien fichier se relit avec la phrase choisie a l'epoque, meme courte.
  if (blob.v === 2 && pass.length < CONNEXIONS_MIN_PASS) return { ok: false, error: "pass_short" };
  if (!pass) return { ok: false, error: "pass_short" };
  const iter = blob.v === 1 ? 200000 : Math.max(CONNEXIONS_ITER, Number(blob.iter) || 0);
  let clair;
  try {
    const key = await connexionsKey(pass, new Uint8Array(blob.salt), iter);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(blob.iv) }, key, new Uint8Array(blob.data));
    clair = JSON.parse(new TextDecoder().decode(plain));
  } catch (e) { return { ok: false, error: "bad_passphrase" }; }
  if (!clair || clair.v !== blob.v) return { ok: false, error: "bad_blob" };
  const patch = {};
  const nombre = (v) => Number(v) || 0;
  const texte = (v) => String(v || "");
  const jetons = blob.v === 2;
  // Les jetons d'un fichier repassent les sondes : trop larges ou non
  // verifiables (hors ligne), ils ne sont pas restaures et on le dit.
  let nonVerifies = false;
  if (jetons && clair.agendaToken) {
    const v = verdictSonde(await tokenExtras(String(clair.agendaToken), "calendar"), ["mail"]);
    if (v.ok) { patch.agendaTokenEnc = await secretEncrypt(String(clair.agendaToken)); patch.tokensReset = false; } else nonVerifies = true;
  }
  if (jetons && clair.notifyToken) {
    const v = verdictSonde(await tokenExtras(String(clair.notifyToken), "mail"), ["calendar"]);
    if (v.ok) patch.notifyTokenEnc = await secretEncrypt(String(clair.notifyToken)); else nonVerifies = true;
  }
  ["agendaCalendarId", "agendaMyUserId", "notifyMailboxHosting"].forEach((k) => { if (clair[k] !== undefined) patch[k] = nombre(clair[k]); });
  ["agendaCalendarName", "agendaMyEmail", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxName", "notifyMailboxLogin"].forEach((k) => { if (clair[k] !== undefined) patch[k] = texte(clair[k]); });
  if (Array.isArray(clair.agendaCalendars)) patch.agendaCalendars = clair.agendaCalendars.map((c) => ({ id: nombre(c && c.id), name: texte(c && c.name) })).filter((c) => c.id);
  if (clair.notifyEnabled !== undefined) patch.notifyEnabled = !!clair.notifyEnabled && !!patch.notifyMailboxUuid;
  if (patch.agendaCalendarId) { patch.agendaCache = null; patch.agendaWarned = []; patch.agendaEndWarned = []; patch.agendaLastError = ""; }
  await kvSet(patch);
  if (patch.agendaCalendarId && patch.agendaTokenEnc) agendaRefresh({ force: true }).catch(() => {});
  const vieuxJetons = !jetons && !!(clair.kdriveToken || clair.agendaToken || clair.notifyToken);
  return { ok: true, tokensSkipped: vieuxJetons, tokensUnchecked: nonVerifies, parts: { agenda: !!patch.agendaTokenEnc, notify: !!patch.notifyTokenEnc } };
}

// ===========================================================================
// Les mails dans les stats, 2026-09-26. Par jour : envoyes et recus. Verifie
// en reel sur une vraie boite : le filtre sfromdate / stodate est en jours
// et la borne de fin INCLUT sa journee, donc un jour J se lit de J a J ; le
// total est rendu par total_messages_count sans lister les messages. Les
// recus partent vite en Archives, Corbeille ou Spam : recus = toute la boite
// (severywhere=1) moins Envoyes, Brouillons, Spam et Corbeille. Cinq appels
// par jour, aujourd'hui et hier toutes les trente minutes, puis l'historique
// rattrape un jour par tour sur trente et un jours.
// ===========================================================================
const MAIL_STATS_EVERY_MS = 30 * 60 * 1000;
// 2026-10-30 : 31 jours, pour qu'un mois entier se remplisse dans les stats.
const MAIL_STATS_BACKFILL_DAYS = 31;
const MAIL_DAILY_KEEP_DAYS = 400;

async function mailFolders(token, uuid) {
  const r = await ikFetch(token, "/mail/" + encodeURIComponent(uuid) + "/folder?with=ik-static", { base: MAIL_API });
  if (!r.ok) return r;
  const roles = {};
  const parcours = (liste) => (Array.isArray(liste) ? liste : []).forEach((f) => {
    const role = String((f && f.role) || "").toUpperCase();
    if (role && f.id && !roles[role]) roles[role] = String(f.id);
    parcours(f && f.children);
  });
  parcours(r.data);
  if (!roles.INBOX || !roles.SENT) return { ok: false, error: "no_folders" };
  return { ok: true, roles: roles };
}

// Verifie en reel le 2026-09-26 : severywhere=1 couvre toute la boite SAUF
// la Corbeille, le Spam et les Brouillons ; filters=unseen ne garde que les
// non lus ; la date filtree est celle du message, donc un mail supprime compte
// au jour ou il est arrive.
async function mailCount(token, uuid, folderId, jour, partout, nonLus) {
  const d = encodeURIComponent(jour + " 00:00:00");
  const q = "?offset=0&thread=off&limit=1&severywhere=" + (partout ? "1" : "0") + "&sfromdate=" + d + "&stodate=" + d + (nonLus ? "&filters=unseen" : "");
  const r = await ikFetch(token, "/mail/" + encodeURIComponent(uuid) + "/folder/" + encodeURIComponent(folderId) + "/message" + q, { base: MAIL_API });
  if (!r.ok) return null;
  const n = Number(r.data && r.data.total_messages_count);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Par jour, quatre nombres, jamais un expediteur ni un objet :
//   recus     = toute la boite - envoyes + corbeille
//   lus       = toute la boite - envoyes - non lus (les envoyes sont lus)
//   supprimes = corbeille
//   traites   = lus + supprimes, ce qui a ete lu ou jete ce jour-la
async function mailCountsForDay(token, uuid, roles, jour) {
  const tout = await mailCount(token, uuid, roles.INBOX, jour, true, false);
  const nonLus = await mailCount(token, uuid, roles.INBOX, jour, true, true);
  const sent = await mailCount(token, uuid, roles.SENT, jour, false, false);
  const del = roles.TRASH ? await mailCount(token, uuid, roles.TRASH, jour, false, false) : 0;
  if (tout === null || nonLus === null || sent === null || del === null) return null;
  const gardes = Math.max(0, tout - sent);
  const lus = Math.max(0, gardes - nonLus);
  return { in: gardes + del, out: sent, read: lus, del: del, done: lus + del };
}

async function mailStatsRefresh(opts) {
  opts = opts || {};
  const r = await kvGet(["mailStatsEnabled", "notifyMailboxUuid", "mailDaily", "mailStatsAt", "screenTimezone"]);
  if (!r.mailStatsEnabled || !r.notifyMailboxUuid) return { ok: false, error: "not_configured" };
  const now = Date.now();
  if (!opts.force && r.mailStatsAt && now - Number(r.mailStatsAt) < MAIL_STATS_EVERY_MS) return { ok: true, cached: true };
  const token = await notifyToken();
  if (!token) return { ok: false, error: "not_configured" };
  const f = await mailFolders(token, r.notifyMailboxUuid);
  if (!f.ok) return f;
  const daily = (r.mailDaily && typeof r.mailDaily === "object") ? r.mailDaily : {};
  const jourDe = (decalage) => tzDayKey(r.screenTimezone, new Date(now - decalage * 24 * 60 * 60 * 1000));
  // aujourd'hui et hier a chaque fois, plus le premier jour manquant de l'historique
  const jours = [jourDe(0), jourDe(1)];
  // Un jour absent, ou mesure avant le 2026-09-26 sans lus ni supprimes, se (re)mesure.
  for (let i = 2; i < MAIL_STATS_BACKFILL_DAYS; i++) { const j = jourDe(i); if (!daily[j] || daily[j].done === undefined) { jours.push(j); break; } }
  for (const j of jours) {
    const c = await mailCountsForDay(token, r.notifyMailboxUuid, f.roles, j);
    if (c) daily[j] = c;
  }
  const cles = Object.keys(daily).sort();
  while (cles.length > MAIL_DAILY_KEEP_DAYS) delete daily[cles.shift()];
  await kvSet({ mailDaily: daily, mailStatsAt: now });
  return { ok: true, days: jours.length };
}

async function agendaState() {
  const r = await kvGet(["agendaEnabled", "agendaWarn", "agendaEndWarn", "agendaCalendarId", "agendaCalendarName", "agendaLastError", "agendaCache", "agendaState", "agendaTokenEnc", "agendaCalendars", "tokensReset", "notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyTokenEnc", "mailStatsEnabled"]);
  const now = Date.now();
  const cache = r.agendaCache || null;
  const etat = r.agendaState || {};
  const evs = (cache && Array.isArray(cache.events)) ? cache.events : [];
  const prochain = agendaTimed(cache).filter((m) => m.start > now).sort((a, b) => a.start - b.start)[0] || null;
  return {
    enabled: !!r.agendaEnabled,
    warn: r.agendaWarn !== false,
    endWarn: r.agendaEndWarn !== false,
    configured: !!r.agendaCalendarId,
    calendarName: r.agendaCalendarName || "",
    calendars: (Array.isArray(r.agendaCalendars) && r.agendaCalendars.length) ? r.agendaCalendars : (r.agendaCalendarId ? [{ id: r.agendaCalendarId, name: r.agendaCalendarName || "" }] : []),
    hasToken: !!r.agendaTokenEnc,
    tokensReset: !!r.tokensReset,
    lastError: r.agendaLastError || "",
    lastRefresh: cache ? (Number(cache.at) || 0) : 0,
    inUntil: Number(etat.inUntil) || 0,
    inTitle: etat.inTitle || "",
    nextStart: Number(etat.nextStart) || 0,
    nextTitle: etat.nextTitle || "",
    nextId: etat.nextId || 0,
    // La carte Agenda montre le prochain evenement, reunion ou bloc solo,
    // puisque le rappel les couvre tous. nextStart reste la prochaine
    // reunion : c'est elle que Prevenir les participants vise.
    nextEventStart: prochain ? prochain.start : 0,
    nextEventTitle: prochain ? (prochain.title || "") : "",
    inId: etat.inId || 0,
    inStart: Number(etat.inStart) || 0,
    notifyEnabled: !!r.notifyEnabled,
    notifyMailboxEmail: r.notifyMailboxUuid ? String(r.notifyMailboxEmail || "") : "",
    notifyHasToken: !!r.notifyTokenEnc,
    mailStatsEnabled: !!r.mailStatsEnabled,
    upcoming: evs.filter((m) => m.meeting !== false && m.start > now && m.start - now < 24 * 60 * 60 * 1000).length
  };
}
