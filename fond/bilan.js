// Koala Zen, le fond : le bilan de la semaine.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Le bilan de la semaine, 2026-11-05. Du lundi 0 h au dimanche 24 h :
// habitudes, temps d'ecran, reunions (dont retirees, terminees plus tot,
// retards annonces) et mails. Le popup l'affiche dans Stats. Allume, il part
// par mail le lundi a 8 h pour la semaine ecoulee, depuis la boite choisie,
// a UNE adresse de cette boite (adresse ou alias), relue aupres de l'API a
// chaque envoi : jamais ailleurs. Des nombres seulement, aucune adresse de
// participant ni titre de reunion.
// ===========================================================================
const ALARM_BILAN = "kz-bilan";
const BILAN_HEURE = 8;
const BILAN_RETRY_MS = 60 * 60 * 1000;

function bilanLundi(ms, decalage) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * (Number(decalage) || 0));
  return d;
}

async function bilanCalcule(decalage, nowMs) {
  const lundi = bilanLundi(nowMs || Date.now(), decalage);
  const debut = lundi.getTime();
  const lundiSuivant = new Date(lundi);
  lundiSuivant.setDate(lundiSuivant.getDate() + 7);
  const fin = lundiSuivant.getTime();
  const r = await kvGet(["statsDaily", "screenDaily", "meetingDaily", "mailDaily", "screenTimezone", "habitGoal"]);
  const objet = (x) => ((x && typeof x === "object") ? x : {});
  const tz = r.screenTimezone || DEFAULT_TZ;
  const but = Math.max(1, Number(r.habitGoal) || DEFAULTS.habitGoal);
  const b = {
    debut: debut, fin: fin,
    jours: [],
    habits: { done: 0, due: 0, goalDays: 0, goal: but },
    screen: { secs: 0, days: 0 },
    meetings: { count: 0, ms: 0, skipped: 0, absent: 0, early: 0, savedMs: 0, late: 0 },
    mail: null
  };
  for (let i = 0; i < 7; i++) {
    const j = new Date(lundi);
    j.setDate(j.getDate() + i);
    const kLocal = dayKey(j);
    const kTz = tzDayKey(tz, new Date(j.getFullYear(), j.getMonth(), j.getDate(), 12));
    const jour = { date: j.getTime(), done: 0, screenSecs: 0, meetMs: 0 };
    b.jours.push(jour);
    const h = objet(r.statsDaily)[kLocal];
    if (h) {
      jour.done = Number(h.done) || 0;
      b.habits.done += Number(h.done) || 0;
      b.habits.due += Number(h.due) || 0;
      if ((Number(h.done) || 0) >= but) b.habits.goalDays += 1;
    }
    const sec = Number(objet(r.screenDaily)[kTz]) || 0;
    if (sec > 0) { b.screen.secs += sec; b.screen.days += 1; jour.screenSecs = sec; }
    // Reunions : l'union des intervalles du jour, une reunion par creneau.
    const iv = Object.keys(objet(objet(r.meetingDaily)[kTz])).map((k) => r.meetingDaily[kTz][k])
      .filter((x) => Array.isArray(x) && Number(x[1]) > Number(x[0])).map((x) => [Number(x[0]), Number(x[1])])
      .sort((a, z) => a[0] - z[0]);
    const creneaux = {};
    let bord = 0;
    iv.forEach((x) => {
      creneaux[x[0] + "-" + x[1]] = true;
      const de = Math.max(x[0], bord);
      if (x[1] > de) { b.meetings.ms += x[1] - de; jour.meetMs += x[1] - de; }
      bord = Math.max(bord, x[1]);
    });
    b.meetings.count += Object.keys(creneaux).length;
    const m = objet(r.mailDaily)[kTz];
    if (m && typeof m === "object") {
      b.mail = b.mail || { done: 0, out: 0 };
      b.mail.done += Number(m.done) || 0;
      b.mail.out += Number(m.out) || 0;
    }
  }
  // Les decisions de la semaine, une par reunion (son double ecarte).
  const marques = await marquesLire();
  const vues = {};
  Object.keys(marques).forEach((k) => {
    const f = marques[k];
    const st = Number(f.start) || 0;
    if (st < debut || st >= fin) return;
    const id = st + "|" + (f.title || k);
    if (vues[id]) return;
    vues[id] = true;
    if (f.skipped) { b.meetings.skipped += 1; if (f.reason === "absent") b.meetings.absent += 1; return; }
    if (f.endedAt && f.plannedEnd && f.plannedEnd > f.endedAt) { b.meetings.early += 1; b.meetings.savedMs += f.plannedEnd - Math.max(st, f.endedAt); }
    if (Number(f.late) > 0) b.meetings.late += 1;
  });
  return b;
}

function bilanDuree(ms) {
  const min = Math.round((Number(ms) || 0) / 60000);
  const h = Math.floor(min / 60);
  return h ? h + " h " + String(min % 60).padStart(2, "0") : (min % 60) + " min";
}
function bilanDate(ms) {
  let langue;
  try { langue = api.i18n && api.i18n.getUILanguage ? api.i18n.getUILanguage() : undefined; } catch (e) { langue = undefined; }
  try { return new Date(ms).toLocaleDateString(langue, { day: "numeric", month: "long" }); } catch (e) { return dayKey(new Date(ms)); }
}
// Les morceaux du bilan, partages par la carte du popup et le mail : chaque
// sujet a un chiffre principal et un detail, au singulier pour 1.
function bilanNombre(n, un, plusieurs) {
  return String(n === 1 ? un : plusieurs).split("{n}").join(String(n));
}
function bilanMorceaux(b) {
  const m = {};
  if (b.habits.done > 0 || b.habits.due > 0) m.habits = {
    big: bilanNombre(b.habits.done, bgMsg("bilanHabitsBigOne", "1 faite"), bgMsg("bilanHabitsBig", "{n} faites")),
    detail: b.habits.goalDays === 1 ? bgMsg("bilanHabitsDetailOne", "objectif atteint 1 jour sur 7") : bgMsg("bilanHabitsDetail", "objectif atteint {j} jours sur 7").split("{j}").join(String(b.habits.goalDays))
  };
  if (b.screen.secs > 0) m.screen = {
    big: bilanDuree(b.screen.secs * 1000),
    detail: bgMsg("bilanScreenDetail", "{m} par jour en moyenne").split("{m}").join(bilanDuree(b.screen.secs * 1000 / Math.max(1, b.screen.days)))
  };
  if (b.meetings.count > 0 || b.meetings.skipped > 0) {
    const plus = [];
    if (b.meetings.skipped > 0) plus.push(bilanNombre(b.meetings.skipped, bgMsg("bilanMeetSkippedOne", "1 retirée des stats"), bgMsg("bilanMeetSkipped", "{n} retirées des stats")));
    if (b.meetings.early > 0) plus.push(bilanNombre(b.meetings.early, bgMsg("bilanMeetEarlyOne", "1 terminée plus tôt"), bgMsg("bilanMeetEarly", "{n} terminées plus tôt")));
    if (b.meetings.late > 0) plus.push(bilanNombre(b.meetings.late, bgMsg("bilanMeetLateOne", "1 retard annoncé"), bgMsg("bilanMeetLate", "{n} retards annoncés")));
    m.meetings = {
      big: bilanDuree(b.meetings.ms),
      detail: bilanNombre(b.meetings.count, bgMsg("bilanMeetingsDetailOne", "1 réunion"), bgMsg("bilanMeetingsDetail", "{n} réunions")),
      plus: plus.join(" · ")
    };
  }
  if (b.mail) m.mail = {
    big: bilanNombre(b.mail.done, bgMsg("bilanMailBigOne", "1 traité"), bgMsg("bilanMailBig", "{n} traités")),
    detail: bilanNombre(b.mail.out, bgMsg("bilanMailDetailOne", "1 envoyé"), bgMsg("bilanMailDetail", "{n} envoyés"))
  };
  return m;
}
// Les lignes du bilan (la carte du popup) et l'objet du mail.
function bilanTexte(b) {
  const m = bilanMorceaux(b);
  const lignes = [];
  const ligne = (titre, x) => lignes.push(titre + " : " + x.big + ", " + x.detail + (x.plus ? " · " + x.plus : ""));
  if (m.habits) ligne(bgMsg("bilanSecHabits", "Habitudes"), m.habits);
  if (m.screen) ligne(bgMsg("bilanSecScreen", "Temps d'écran"), m.screen);
  if (m.meetings) ligne(bgMsg("bilanSecMeetings", "Réunions"), m.meetings);
  if (b.meetings.savedMs > 0) lignes.push(bgMsg("bilanSavedTime", "Temps gagné en terminant plus tôt : {t}").split("{t}").join(bilanDuree(b.meetings.savedMs)));
  if (m.mail) ligne(bgMsg("bilanSecMail", "Mails"), m.mail);
  if (!lignes.length) lignes.push(bgMsg("bilanEmpty", "Rien de mesuré cette semaine."));
  const subject = bgMsg("bilanSubject", "Koala Zen · ta semaine du {d} au {f}").split("{d}").join(bilanDate(b.debut)).split("{f}").join(bilanDate(b.fin - 1));
  return { lignes: lignes, subject: subject.slice(0, 200) };
}

// Le reglage : l'adresse doit etre une adresse de la boite choisie.
async function bilanReglage(allume, email) {
  const r = await kvGet(["notifyMailboxUuid", "bilanEmail", "bilanEnabled"]);
  if (!allume) {
    // Seul usage restant de la boite : eteindre le bilan l'oublie, comme
    // Prevenir et les stats le font.
    const u = await kvGet(["notifyEnabled", "mailStatsEnabled"]);
    if (!u.notifyEnabled && !u.mailStatsEnabled) await kvSet({ bilanEnabled: false, bilanEmail: "", notifyMailboxUuid: "", notifyMailboxEmail: "", notifyMailboxName: "", notifyMailboxHosting: 0, notifyMailboxLogin: "", notifyTokenEnc: null });
    else await kvSet({ bilanEnabled: false });
    await bilanPlanifie();
    return { ok: true, enabled: false };
  }
  if (!r.notifyMailboxUuid) return { ok: false, error: "notify_off" };
  const adr = String(email || r.bilanEmail || "").trim().toLowerCase();
  const liste = await notifyListMailboxes();
  if (!liste.ok) return liste;
  if (!adr || !liste.addresses.some((a) => a.email === adr)) return { ok: false, error: "bad_recipients" };
  // Allume en milieu de semaine : le premier envoi est lundi prochain, pas
  // celui de la semaine ecoulee dans la minute (le popup peut l'envoyer).
  const patch = { bilanEnabled: true, bilanEmail: adr };
  if (!r.bilanEnabled) patch.bilanSent = dayKey(bilanLundi(Date.now(), -1));
  await kvSet(patch);
  await bilanPlanifie();
  return { ok: true, enabled: true, email: adr };
}

// L'envoi : la semaine ecoulee, une seule fois (sauf demande du popup).
async function bilanEnvoie(opts) {
  opts = opts || {};
  const now = Date.now();
  const r = await kvGet(["bilanEnabled", "bilanEmail", "bilanSent", "notifyEnabled", "notifyMailboxUuid", "notifyMailboxEmail", "notifyMailboxHosting", "notifyMailboxLogin"]);
  if (!opts.force && !r.bilanEnabled) return { ok: false, error: "off" };
  if (!r.notifyMailboxUuid || !r.bilanEmail) return { ok: false, error: "not_configured" };
  const b = await bilanCalcule(-1, now);
  const semaine = dayKey(new Date(b.debut));
  if (!opts.force && r.bilanSent === semaine) return { ok: true, already: true };
  const adr = String(r.bilanEmail).toLowerCase();
  const liste = await notifyListMailboxes();
  if (!liste.ok) return liste;
  if (!liste.addresses.some((a) => a.email === adr)) return { ok: false, error: "bad_recipients" };
  const quota = await notifyQuota();
  if (!quota.ok) return { ok: false, error: "rate_limited" };
  const t = bilanTexte(b);
  const avant = await bilanCalcule(-2, now);
  const parti = await mailEnvoie(r, [adr], t.subject, bilanHtml(b, avant), true);
  if (!parti.ok) return parti;
  await kvSet({ bilanSent: semaine, notifyRate: quota.liste.concat([now]) });
  return { ok: true, sentTo: adr };
}

// Lundi 8 h. Une semaine pas encore envoyee apres lundi 8 h part dans la
// minute (machine eteinte le lundi) ; un echec reessaie dans une heure.
async function bilanPlanifie(nowMs, apresEchec) {
  const now = nowMs || Date.now();
  try { await api.alarms.clear(ALARM_BILAN); } catch (e) { /* noop */ }
  const r = await kvGet(["bilanEnabled", "bilanSent"]);
  if (!r.bilanEnabled) return null;
  const ce = bilanLundi(now, 0);
  ce.setHours(BILAN_HEURE);
  const prochain = bilanLundi(now, 1);
  prochain.setHours(BILAN_HEURE);
  const dueCetteSemaine = now >= ce.getTime() && r.bilanSent !== dayKey(bilanLundi(now, -1));
  let when;
  if (dueCetteSemaine) when = now + (apresEchec ? BILAN_RETRY_MS : 60000);
  else if (now < ce.getTime()) when = ce.getTime();
  else when = prochain.getTime();
  when = Math.min(when, prochain.getTime());
  try { api.alarms.create(ALARM_BILAN, { when: when }); } catch (e) { /* noop */ }
  return when;
}

// 2026-11-05 : le mail du bilan, une page lisible. Un titre, une phrase
// d'ouverture choisie d'apres les chiffres, une section par sujet avec son
// chiffre principal et l'ecart avec la semaine d'avant, puis les moments
// forts. Des nombres seulement ; chaque valeur inseree est echappee.
function bilanEsc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function bilanRemplit(texte, vals) {
  return Object.keys(vals).reduce((t, k) => t.split("{" + k + "}").join(String(vals[k])), texte);
}
// Un ecart : "+2", "-1 h 20", ou "comme la semaine d'avant". Rien si la
// semaine d'avant n'a rien mesure.
function bilanEcart(maintenant, avant, duree) {
  if (!(avant > 0)) return "";
  const d = maintenant - avant;
  if (duree ? Math.abs(d) < 60000 : d === 0) return bgMsg("bilanSame", "comme la semaine d'avant");
  const v = duree ? bilanDuree(Math.abs(d)) : String(Math.abs(d));
  return bilanRemplit(bgMsg("bilanDelta", "{d} par rapport à la semaine d'avant"), { d: (d > 0 ? "+" : "−") + v });
}
function bilanJour(ms) {
  let langue;
  try { langue = api.i18n && api.i18n.getUILanguage ? api.i18n.getUILanguage() : undefined; } catch (e) { langue = undefined; }
  try { return new Date(ms).toLocaleDateString(langue, { weekday: "long" }); } catch (e) { return dayKey(new Date(ms)); }
}
// La phrase d'ouverture, sans jugement : elle releve ce qui ressort.
function bilanPhrase(b, avant) {
  const t = bilanRemplit;
  if (b.habits.goalDays >= 5) return t(bgMsg("bilanPhraseRegular", "Belle régularité : ton objectif atteint {j} jours sur 7."), { j: b.habits.goalDays });
  if (b.meetings.savedMs >= 30 * 60000) return t(bgMsg("bilanPhraseSaved", "En terminant plus tôt, tu as rendu {t} à ta semaine."), { t: bilanDuree(b.meetings.savedMs) });
  if (avant && avant.meetings.ms > 0 && b.meetings.ms - avant.meetings.ms >= 2 * 3600000) return bgMsg("bilanPhraseBusier", "Une semaine plus chargée en réunions que la précédente. Garde-toi quelques pauses.");
  if (avant && avant.meetings.ms - b.meetings.ms >= 2 * 3600000) return bgMsg("bilanPhraseLighter", "Moins de réunions que la semaine d'avant : du temps pour toi.");
  if (!b.habits.done && !b.screen.secs && !b.meetings.count && !b.mail) return bgMsg("bilanPhraseCalm", "Une semaine calme, rien à signaler.");
  return bgMsg("bilanPhraseDefault", "Voici ta semaine en quelques chiffres.");
}
function bilanHtml(b, avant) {
  avant = avant || null;
  const e = bilanEsc;
  const vert = "#1F5C2E", encre = "#333333", gris = "#666666", trait = "#E0E0E0";
  const section = (titre, grand, detail, ecart, plus) =>
    '<tr><td style="padding:16px 0;border-top:1px solid ' + trait + ';">'
    + '<div style="font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:' + gris + ';">' + e(titre) + '</div>'
    + '<div style="font-size:24px;line-height:30px;font-weight:600;color:' + encre + ';margin-top:2px;">' + e(grand) + '</div>'
    + (detail ? '<div style="font-size:14px;line-height:20px;color:' + encre + ';">' + e(detail) + '</div>' : '')
    + (plus ? '<div style="font-size:14px;line-height:20px;color:' + encre + ';">' + e(plus) + '</div>' : '')
    + (ecart ? '<div style="font-size:13px;line-height:18px;color:' + gris + ';margin-top:2px;">' + e(ecart) + '</div>' : '')
    + '</td></tr>';
  const t = bilanRemplit;
  const m = bilanMorceaux(b);
  const lignes = [];
  if (m.habits) lignes.push(section(bgMsg("bilanSecHabits", "Habitudes"), m.habits.big, m.habits.detail, avant ? bilanEcart(b.habits.done, avant.habits.done, false) : ""));
  if (m.screen) lignes.push(section(bgMsg("bilanSecScreen", "Temps d'écran"), m.screen.big, m.screen.detail, avant ? bilanEcart(b.screen.secs * 1000, avant.screen.secs * 1000, true) : ""));
  if (m.meetings) lignes.push(section(bgMsg("bilanSecMeetings", "Réunions"), m.meetings.big, m.meetings.detail, avant ? bilanEcart(b.meetings.ms, avant.meetings.ms, true) : "", m.meetings.plus));
  if (m.mail) lignes.push(section(bgMsg("bilanSecMail", "Mails"), m.mail.big, m.mail.detail, avant && avant.mail ? bilanEcart(b.mail.done, avant.mail.done, false) : ""));
  // Les moments forts.
  const forts = [];
  const jours = Array.isArray(b.jours) ? b.jours : [];
  const meilleur = jours.reduce((m, j) => (j.done > (m ? m.done : 0) ? j : m), null);
  if (meilleur && meilleur.done > 0) forts.push(t(meilleur.done === 1 ? bgMsg("bilanBestDayOne", "Ton meilleur jour : {j}, 1 habitude faite") : bgMsg("bilanBestDay", "Ton meilleur jour : {j}, {n} habitudes faites"), { j: bilanJour(meilleur.date), n: meilleur.done }));
  const charge = jours.reduce((m, j) => (j.meetMs > (m ? m.meetMs : 0) ? j : m), null);
  if (charge && charge.meetMs > 0) forts.push(t(bgMsg("bilanBusiestDay", "Jour le plus chargé : {j}, {t} de réunions"), { j: bilanJour(charge.date), t: bilanDuree(charge.meetMs) }));
  if (b.meetings.savedMs > 0) forts.push(t(bgMsg("bilanSavedTime", "Temps gagné en terminant plus tôt : {t}"), { t: bilanDuree(b.meetings.savedMs) }));
  const corps = lignes.length ? lignes.join("") : '<tr><td style="padding:16px 0;border-top:1px solid ' + trait + ';font-size:15px;color:' + encre + ';">' + e(bgMsg("bilanEmpty", "Rien de mesuré cette semaine.")) + '</td></tr>';
  const blocForts = forts.length
    ? '<div style="margin-top:8px;padding:16px;border-radius:12px;background:#F2FBF3;">'
      + '<div style="font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:' + vert + ';">' + e(bgMsg("bilanHighlights", "Moments forts")) + '</div>'
      + forts.map((f) => '<div style="font-size:14px;line-height:20px;color:' + encre + ';margin-top:6px;">' + e(f) + '</div>').join("")
      + '</div>'
    : "";
  const titre = t(bgMsg("bilanMailTitle", "Ta semaine du {d} au {f}"), { d: bilanDate(b.debut), f: bilanDate(b.fin - 1) });
  return '<html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#FFFFFF;">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:' + encre + ';max-width:520px;margin:0 auto;padding:24px 16px;">'
    + '<div style="font-size:13px;line-height:18px;color:' + gris + ';">Koala Zen</div>'
    + '<h1 style="font-size:22px;line-height:28px;font-weight:600;color:' + vert + ';margin:4px 0 8px;">' + e(titre) + '</h1>'
    + '<p style="font-size:15px;line-height:22px;margin:0 0 16px;color:' + encre + ';">' + e(bilanPhrase(b, avant)) + '</p>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">' + corps + '</table>'
    + blocForts
    + '<p style="font-size:12px;line-height:17px;color:' + gris + ';margin:24px 0 0;">' + e(bgMsg("bilanFooter", "Envoyé par Koala Zen depuis ta boîte, à ta demande. Pour l'arrêter : Stats, Ta semaine.")) + '</p>'
    + '</div></body></html>';
}
