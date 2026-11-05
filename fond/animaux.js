// Koala Zen, le fond : les animaux de passage.
// Un des fichiers du fond, charges dans l'ordre de background.js ; ils
// partagent la meme portee (scripts classiques).

// ===========================================================================
// Les animaux de passage. Purement gratuits, ils ne demandent rien et
// n'entrent NULLE PART dans les donnees, ni comptes, ni exportes. Seul leur
// ordonnancement vit dans passageState, qui est hors de toute liste d'export.
// ===========================================================================

const ALARM_PASSAGE = "kz-passage";

// Duree en millisecondes, qui parle, poids de tirage relatif. Le chat, seul
// ou en rencontre, et le renard pour la rencontre la plus rare. Jamais le
// koala, jamais l'arbre.
const PASSAGES = [
  { id: "cross", ms: 15000, who: "cat", weight: 30 },
  { id: "sit",   ms: 20000, who: "cat", weight: 10 },
  { id: "yawn",  ms: 22500, who: "cat", weight: 8 },
  { id: "meetCats", ms: 14000, who: "both", weight: 3 },
  { id: "meetFox",  ms: 14000, who: "both", weight: 1 }
];

const PASSAGE_COATS = 7;          // sept pelages de chat
const PASSAGE_PHRASES = 8;        // huit phrases communes
// Trois reglages de frequence, choisis par l'utilisateur. gapHours fixe a la
// fois l'ecart minimum dur entre deux passages ET, par extension dans
// nextPassageDelayMinutes, la fenetre aleatoire du prochain reveil. maxPerDay
// suit dans la meme proportion pour rester coherent avec l'ecart choisi.
// "normal" reprend EXACTEMENT les valeurs historiques (2 h, 4 par jour).
const PASSAGE_FREQ = {
  rare:     { gapHours: 3, maxPerDay: 3 },
  normal:   { gapHours: 2, maxPerDay: 4 },
  frequent: { gapHours: 1, maxPerDay: 6 }
};
const PASSAGE_FREQ_DEFAULT = "normal";
// Plafond le plus haut de tous les reglages, utilise uniquement pour assainir
// une valeur de stockage abimee, jamais comme regle de blocage elle-meme.
const PASSAGE_MAX_PER_DAY_HARD = 6;
const PASSAGE_QUIET_AFTER_REMINDER = 60 * 1000; // jamais dans la minute qui suit un rappel
const PASSAGE_HOUR_FROM = 8;
const PASSAGE_HOUR_TO = 20;
// Les passages de fin de journee, 2026-09-18. A chaque heure pleine de 17 h a
// 21 h, un chat passe pour glisser, avec humour, qu'il est temps de songer a
// arreter, de plus en plus franchement. Ils ne comptent ni dans le quota du
// jour ni dans l'ecart entre deux passages libres, et ils ignorent la plage
// 8 h 20 h. Ils respectent tout le reste : reglage eteint, animations sur
// Jamais, pause, rendez-vous, silence apres un rappel, visio, clavier quitte.
// Un passage manque a l'heure pile (aucun onglet, page interne, clavier
// quitte) est retente a chaque tic pendant vingt minutes, puis abandonne.
const PASSAGE_EVENING_HOURS = [17, 18, 19, 20, 21];
const PASSAGE_EVENING_WINDOW_MIN = 20;
const PASSAGE_EVENING_PHRASES = 4;        // quatre phrases par heure dans quotes.js
const PASSAGE_EVENING_VARIANT = { 17: "cross", 18: "yawn", 19: "sit", 20: "yawn", 21: "sit" };
const PASSAGE_FOX_GAP = 30 * 24 * 60 * 60 * 1000;  // le renard, une fois par mois au plus
const PASSAGE_MEET_GAP = 7 * 24 * 60 * 60 * 1000;  // les deux chats, une fois par semaine au plus

function passageFreq(cfg) {
  return PASSAGE_FREQ[cfg && cfg.passageFrequency] || PASSAGE_FREQ[PASSAGE_FREQ_DEFAULT];
}

function passageStateFrom(raw) {
  const s = (raw && typeof raw === "object") ? raw : {};
  return {
    day: typeof s.day === "string" ? s.day : "",
    count: Math.max(0, Math.min(PASSAGE_MAX_PER_DAY_HARD, Math.round(Number(s.count) || 0))),
    last: Math.max(0, Number(s.last) || 0),
    lastVariant: typeof s.lastVariant === "string" ? s.lastVariant : "",
    lastPhrase: Number.isFinite(Number(s.lastPhrase)) ? Number(s.lastPhrase) : -1,
    lastCoat: Number.isFinite(Number(s.lastCoat)) ? Number(s.lastCoat) : -1,
    lastReminder: Math.max(0, Number(s.lastReminder) || 0),
    lastFox: Math.max(0, Number(s.lastFox) || 0),
    lastMeet: Math.max(0, Number(s.lastMeet) || 0),
    eveningDay: typeof s.eveningDay === "string" ? s.eveningDay : "",
    eveningHour: Number.isFinite(Number(s.eveningHour)) ? Number(s.eveningHour) : -1,
    eveningPhrase: Number.isFinite(Number(s.eveningPhrase)) ? Number(s.eveningPhrase) : -1
  };
}

// Heure locale dans le fuseau retenu, celui du reglage Temps d'ecran.
function tzHour(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), hour: "2-digit", hour12: false });
    return parseInt(f.format(when || new Date()), 10);
  } catch (e) { return (when || new Date()).getHours(); }
}

// Samedi ou dimanche dans le fuseau retenu : le chat de passage change de lot.
function tzWeekend(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), weekday: "short" });
    const j = f.format(when || new Date());
    return j === "Sat" || j === "Sun";
  } catch (e) { const d = (when || new Date()).getDay(); return d === 0 || d === 6; }
}

function tzMinute(tz, when) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: resolveTz(tz), minute: "2-digit" });
    return parseInt(f.format(when || new Date()), 10);
  } catch (e) { return (when || new Date()).getMinutes(); }
}

// L'heure de fin de journee a jouer maintenant, ou -1. Une heure ne joue
// qu'une fois par jour, dans les vingt minutes qui suivent l'heure pleine.
function eveningSlot(state, nowMs, tz) {
  const st = passageStateFrom(state);
  const d = new Date(nowMs);
  const h = tzHour(tz, d);
  if (PASSAGE_EVENING_HOURS.indexOf(h) < 0) return -1;
  if (tzMinute(tz, d) >= PASSAGE_EVENING_WINDOW_MIN) return -1;
  if (st.eveningDay === tzDayKey(tz, d) && st.eveningHour >= h) return -1;
  return h;
}

// Le passage de fin de journee : variante fixee par l'heure, pelage jamais
// identique au precedent, phrase jamais identique a celle de la veille a la
// meme heure ni a celle de l'heure d'avant.
function pickEvening(state, hour, rnd) {
  const st = passageStateFrom(state);
  const alea = typeof rnd === "function" ? rnd : Math.random;
  const id = PASSAGE_EVENING_VARIANT[hour] || "cross";
  const variante = PASSAGES.find((p) => p.id === id) || PASSAGES[0];
  let coat = Math.floor(alea() * PASSAGE_COATS);
  if (coat >= PASSAGE_COATS) coat = PASSAGE_COATS - 1;
  if (coat === st.lastCoat) coat = (coat + 1) % PASSAGE_COATS;
  let phrase = Math.floor(alea() * PASSAGE_EVENING_PHRASES);
  if (phrase >= PASSAGE_EVENING_PHRASES) phrase = PASSAGE_EVENING_PHRASES - 1;
  if (phrase === st.eveningPhrase) phrase = (phrase + 1) % PASSAGE_EVENING_PHRASES;
  return { variant: variante.id, ms: variante.ms, who: "cat", coat: coat, phrase: phrase, pool: "evening", slot: PASSAGE_EVENING_HOURS.indexOf(hour), hour: hour };
}

// Tirage pondere sur 100. Si le tirage tombe sur la variante du tour
// precedent, on prend la suivante.
function pickPassage(state, nowMs, rnd) {
  const st = passageStateFrom(state);
  const alea = typeof rnd === "function" ? rnd : Math.random;
  // Le renard et la rencontre a deux chats sont plafonnes independamment du
  // poids, retires du tirage AVANT qu'il n'ait lieu plutot qu'apres.
  const ouvertes = PASSAGES.filter((p) => {
    if (p.id === "meetFox" && st.lastFox && nowMs - st.lastFox < PASSAGE_FOX_GAP) return false;
    if (p.id === "meetCats" && st.lastMeet && nowMs - st.lastMeet < PASSAGE_MEET_GAP) return false;
    return true;
  });
  if (!ouvertes.length) return null;
  const total = ouvertes.reduce((a, p) => a + p.weight, 0);
  let seuil = alea() * total;
  let i = 0;
  for (; i < ouvertes.length; i++) { seuil -= ouvertes[i].weight; if (seuil < 0) break; }
  if (i >= ouvertes.length) i = ouvertes.length - 1;
  if (ouvertes.length > 1 && ouvertes[i].id === st.lastVariant) i = (i + 1) % ouvertes.length;
  const variante = ouvertes[i];

  // Jamais deux fois de suite le meme pelage ni la meme phrase.
  let coat = Math.floor(alea() * PASSAGE_COATS);
  if (coat >= PASSAGE_COATS) coat = PASSAGE_COATS - 1;
  if (coat === st.lastCoat) coat = (coat + 1) % PASSAGE_COATS;
  let phrase = Math.floor(alea() * PASSAGE_PHRASES);
  if (phrase >= PASSAGE_PHRASES) phrase = PASSAGE_PHRASES - 1;
  if (phrase === st.lastPhrase) phrase = (phrase + 1) % PASSAGE_PHRASES;

  return { variant: variante.id, ms: variante.ms, who: variante.who, coat: coat, phrase: phrase };
}

// Les interdits. Le silence est prioritaire sur tout le reste.
// Renvoie une chaine expliquant le refus, ou la chaine vide si le passage peut jouer.
// L'ordre compte : les motifs que le bouton de test ne peut JAMAIS contourner
// (reglage, animations, pause, agenda, silence apres un rappel) sont evalues
// avant ceux qu'il contourne (horaire, ecart, plafond). Sinon un test lance a
// 21 h pendant une pause rendait "horaire", contournable, et le passage jouait.
function passageBlocked(cfg, state, nowMs, tz) {
  const st = passageStateFrom(state);
  if (!cfg.passages) return "reglage";
  if (cfg.animMode === "never") return "animations";
  if (cfg.pausedUntil && nowMs < cfg.pausedUntil) return "pause";
  // Meme regle que la visio, un rendez-vous de l'agenda en cours interdit tout
  // passage, y compris le bouton de test.
  if (cfg.agendaEnabled && agendaBusyAt(cfg.agendaCache, nowMs)) return "agenda";
  // La fenetre de silence couvre le rappel ET la pause focus, qui peut durer
  // jusqu'a 120 s, sinon un passage traverserait pendant le voile.
  const silence = cfg.focusMode
    ? Math.max(PASSAGE_QUIET_AFTER_REMINDER, (Number(cfg.focusSeconds) || 30) * 1000 + PASSAGE_QUIET_AFTER_REMINDER)
    : PASSAGE_QUIET_AFTER_REMINDER;
  if (st.lastReminder && nowMs - st.lastReminder < silence) return "rappel";
  const h = tzHour(tz, new Date(nowMs));
  if (h < PASSAGE_HOUR_FROM || h >= PASSAGE_HOUR_TO) return "horaire";
  const freq = passageFreq(cfg);
  if (st.day === tzDayKey(tz, new Date(nowMs)) && st.count >= freq.maxPerDay) return "plafond";
  if (st.last && nowMs - st.last < freq.gapHours * 60 * 60 * 1000) return "ecart";
  return "";
}

// Heure du prochain passage, tiree au hasard et jamais fixe. On vise un creneau
// entre gapHours et 2,5 fois gapHours (2 a 5 h pour le reglage "normal", inchange
// par rapport a l'historique), borne a la plage 8 h 20 h par passageBlocked au
// moment du declenchement. Un creneau perdu n'est jamais rattrape.
function nextPassageDelayMinutes(gapHours, rnd) {
  const alea = typeof rnd === "function" ? rnd : Math.random;
  const gapMin = (Number(gapHours) || PASSAGE_FREQ[PASSAGE_FREQ_DEFAULT].gapHours) * 60;
  return gapMin + Math.floor(alea() * (gapMin * 1.5));
}

async function schedulePassage() {
  try { await api.alarms.clear(ALARM_PASSAGE); } catch (e) { /* noop */ }
  const cfg = { ...DEFAULTS, ...(await kvGet(["passageFrequency"])) };
  const mins = nextPassageDelayMinutes(passageFreq(cfg).gapHours);
  try { await api.alarms.create(ALARM_PASSAGE, { delayInMinutes: mins }); } catch (e) { /* noop */ }
}

// Appele a chaque tic. Ne fait rien hors des fenetres de fin de journee.
async function eveningTick() {
  const r = await kvGet(["passageState", "screenTimezone"]);
  const slot = eveningSlot(r.passageState, Date.now(), r.screenTimezone);
  if (slot < 0) return;
  await triggerPassage({ evening: slot });
}

async function triggerPassage(opts) {
  const test = !!(opts && opts.test);
  const evening = (opts && PASSAGE_EVENING_HOURS.indexOf(opts.evening) > -1) ? opts.evening : 0;
  const cfg = { ...DEFAULTS, ...(await kvGet(["passages", "passagesRandom", "passagesEvening", "passageFrequency", "animMode", "pausedUntil", "pauseWhenIdle", "muteInCalls", "mutedPatterns", "screenTimezone", "focusMode", "focusSeconds", "passageState", "agendaEnabled", "agendaCache"])) };
  const now = Date.now();
  const st = passageStateFrom(cfg.passageState);
  const motif = passageBlocked(cfg, st, now, cfg.screenTimezone);
  // Le bouton de test contourne l'horaire, l'ecart de deux heures et le plafond
  // du jour. Il ne contourne JAMAIS ce qui protege l'utilisateur, le reglage
  // eteint, le mode Jamais, une pause en cours, le silence apres un rappel, ni
  // la visio et l'inactivite verifiees plus bas.
  // Le passage de fin de journee contourne les memes trois motifs, et rien
  // d'autre : il a son heure, son quota propre, et il n'a pas a attendre la
  // fin de l'ecart d'un passage libre.
  const contournable = (motif === "horaire" || motif === "ecart" || motif === "plafond");
  if (motif && !((test || evening) && contournable)) return;
  // Chaque sorte de passage a son interrupteur. Le bouton de test les ignore :
  // il montre un passage, rien de plus.
  if (!test && (evening ? cfg.passagesEvening === false : cfg.passagesRandom === false)) return;
  if (cfg.pauseWhenIdle && !test && (await isIdle())) return;

  const tab = await targetTab();
  if (!tab) return;
  // La visio est prioritaire sur tout le reste, meme si rien n'est mis en pause.
  if (cfg.muteInCalls && matchesMuted(tab.url, cfg.mutedPatterns)) return;

  const choix = evening ? pickEvening(st, evening) : pickPassage(st, now);
  if (!choix) return;
  const jour = tzDayKey(cfg.screenTimezone, new Date(now));
  // Un passage de TEST ne consomme ni le quota du jour ni le creneau des deux
  // heures, sinon essayer le bouton priverait l'utilisateur d'un vrai passage.
  // Un passage de fin de journee ne compte pas dans le quota du jour mais
  // pose bien `last`, pour qu'un passage libre ne le suive pas de pres. Il
  // note son heure, une seule fois par jour et par heure.
  const suivant = {
    day: jour,
    count: (st.day === jour ? st.count : 0) + ((test || evening) ? 0 : 1),
    last: test ? st.last : now,
    lastVariant: choix.variant,
    lastPhrase: evening ? st.lastPhrase : choix.phrase,
    lastCoat: choix.coat,
    lastReminder: st.lastReminder,
    lastFox: (choix.variant === "meetFox" && !test) ? now : st.lastFox,
    lastMeet: (choix.variant === "meetCats" && !test) ? now : st.lastMeet,
    eveningDay: evening ? jour : st.eveningDay,
    eveningHour: evening ? evening : (st.eveningDay === jour ? st.eveningHour : -1),
    eveningPhrase: evening ? choix.phrase : st.eveningPhrase
  };

  try {
    const envoi = {
      type: "kz-passage",
      animMode: cfg.animMode,
      variant: choix.variant,
      ms: choix.ms,
      who: choix.who,
      coat: choix.coat,
      phrase: choix.phrase
    };
    if (evening) { envoi.pool = "evening"; envoi.slot = choix.slot; envoi.hour = evening; }
    // Le week-end (2026-09-26), les passages libres puisent dans le lot du
    // week-end : meme nombre de phrases, meme tirage, autre lot cote page.
    else if (tzWeekend(cfg.screenTimezone, new Date(now))) envoi.pool = "weekend";
    try {
      await api.tabs.sendMessage(tab.id, envoi);
    } catch (e) {
      // Meme secours que pour le rappel. Un onglet ouvert AVANT l'installation ou
      // le rechargement de l'extension n'a pas les scripts de page, sendMessage
      // echoue, et sans cette reinjection le passage etait perdu en silence.
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["quotes.js", "passages.js", "content.js"] });
      await api.tabs.sendMessage(tab.id, envoi);
    }
    // Limite connue et acceptee : le creneau de deux heures et le quota du jour
    // sont consommes des que sendMessage reussit, pas quand la bulle est
    // effectivement affichee. Si passages.js avale l'appel en silence cote
    // page (reduceMotion, largeur trop etroite pour who:"both", 'vivant' deja
    // vrai), le passage est compte comme joue sans jamais avoir ete vu. Une
    // vraie correction demanderait un accuse de reception depuis la page, ce
    // qui n'existe pas aujourd'hui. Impact juge mineur : au pire un passage de
    // moins ce jour-la, jamais un passage en trop.
    await kvSet({ passageState: suivant });
  } catch (e) {
    // Page non compatible. Le creneau est perdu, jamais rattrape, et il n'est
    // pas consomme puisque aucune bulle n'a ete affichee.
  }
}

function clampFocus(v) { const n = parseInt(v, 10); return isNaN(n) ? 30 : Math.min(120, Math.max(5, n)); }

async function targetTab() {
  // Le seul onglet valide est celui au premier plan de la fenetre au premier
  // plan. Si ce n'est pas une page http(s) (page interne, PDF, nouvel onglet),
  // il n'y a PAS d'onglet cible, meme si une page http(s) est ouverte ailleurs
  // en arriere plan. Se rabattre sur un onglet quelconque romprait le "jamais
  // dans l'onglet inactif" que le rappel et les passages doivent respecter.
  try {
    const [t] = await api.tabs.query({ active: true, lastFocusedWindow: true });
    if (t && /^https?:/.test(t.url || "")) return t;
  } catch (e) { /* noop */ }
  return null;
}
