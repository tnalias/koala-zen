#!/usr/bin/env python3
# Generateur des captures des stores (Chrome Web Store et Mozilla Add-ons).
#
#   python3 store-assets/generateur/generer.py
#
# Met en scene la VRAIE interface : content.js, passages.js et popup.js sont
# charges tels quels, avec une API d'extension simulee et des donnees
# d'exemple. Chaque capture fait 1280 x 800, composee a 2x puis reduite pour
# un texte net. Trois langues (en, fr, de), cinq scenes. Rien de ce dossier
# n'entre dans le paquet de l'extension (build.sh ne le copie pas).
import datetime
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys

from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.abspath(os.path.join(ICI, ".."))
TRAVAIL = os.path.join(ICI, "build")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = "file://" + RACINE + "/"
LANGUES = ["en", "fr", "de"]


def locale(l):
    return json.load(io.open(os.path.join(RACINE, "_locales", l, "messages.json"), encoding="utf-8"))


# --------------------------------------------------------------------------
# Les textes des captures, courts et centres sur le benefice.
# --------------------------------------------------------------------------
# Direction artistique du 2026-10-13 (facon agence) : une couleur par
# message, un titre court et tres gros avec le mot cle en couleur (**...**),
# une phrase, deux pastilles, et l'interface agrandie sur une page epuree.
TEXTES = {
    "nudge": {
        "fr": ("Bouge un peu.|**Sans culpabiliser.**", "Un koala te propose une petite pause au bon moment. Fait ou plus tard, tu choisis.", ["Toutes les 5 à 240 min", "Le koala, ou tes propres GIF"]),
        "en": ("Move a little.|**No guilt.**", "A koala suggests a small break at the right moment. Done or later, you choose.", ["Every 5 to 240 min", "The koala, or your own GIFs"]),
        "de": ("Beweg dich.|**Ohne schlechtes Gewissen.**", "Ein Koala schlägt dir im richtigen Moment eine kleine Pause vor. Du entscheidest.", ["Alle 5 bis 240 Min", "Der Koala oder deine GIFs"]),
    },
    "meetings": {
        "fr": ("Ne rate **plus jamais**|une réunion", "Une bulle 3 min avant, le lien de la visio à un clic, un rappel 5 min avant la fin.", ["Rejoindre en un clic", "Finir à l'heure"]),
        "en": ("**Never** miss|a meeting again", "A bubble 3 min before, the video link one click away, a heads-up 5 min before the end.", ["Join in one click", "End on time"]),
        "de": ("**Nie wieder** ein|Meeting verpassen", "Eine Blase 3 Min vorher, der Videolink einen Klick entfernt, ein Hinweis 5 Min vor Schluss.", ["Mit einem Klick beitreten", "Pünktlich enden"]),
    },
    "warn": {
        "fr": ("En retard ?|**Préviens en un clic.**", "Un mail tout prêt pour les participants, depuis ta boîte Infomaniak. Tu relis, tu envoies.", ["Retard ou absence", "Rien ne part sans toi"]),
        "en": ("Running late?|**Let them know.**", "A ready-made email to the attendees, from your Infomaniak mailbox. Reread it, send it.", ["Late or absent", "Nothing leaves without you"]),
        "de": ("Verspätet?|**Sag kurz Bescheid.**", "Eine fertige Mail an die Teilnehmenden, aus deinem Infomaniak-Postfach. Prüfen, senden.", ["Verspätung oder Absage", "Nichts geht ohne dich raus"]),
    },
    "stats": {
        "fr": ("Vois où passe|**ton temps**", "Habitudes, écran, réunions et mails, jour par jour. Tout reste sur ton appareil.", ["Réunions et mails", "100 % privé"]),
        "en": ("See where|**your time** goes", "Habits, screen time, meetings and emails, day by day. All on your device.", ["Meetings and emails", "100% private"]),
        "de": ("Sieh, wohin|**deine Zeit** geht", "Gewohnheiten, Bildschirmzeit, Meetings und Mails, Tag für Tag. Alles auf deinem Gerät.", ["Meetings und Mails", "100 % privat"]),
    },
    "cats": {
        "fr": ("Et parfois,|**les chats papotent**", "Ils passent sans raison, se croisent et papotent. Dès 17 h, ils te rappellent qu'il est temps d'arrêter.", ["Rondes du soir", "Juste pour sourire"]),
        "en": ("And sometimes,|**the cats chat**", "They drop by for no reason, cross paths and chat. From 5 pm, they remind you it's time to stop.", ["Evening rounds", "Just for a smile"]),
        "de": ("Und manchmal|**plaudern die Katzen**", "Sie kommen einfach so vorbei und plaudern. Ab 17 Uhr erinnern sie dich, dass Feierabend ist.", ["Abendrunden", "Einfach zum Lächeln"]),
    },
    "ksuite": {
        "fr": ("Un compte gratuit|Infomaniak *my kSuite*|suffit", "*my kSuite* est gratuit. Avec son agenda et son mail, toutes les fonctions avancées de Koala Zen sont à toi.", []),
        "en": ("A free Infomaniak|*my kSuite* account|is all you need", "*my kSuite* is free. With its calendar and mail, all of Koala Zen's advanced features are yours.", []),
        "de": ("Ein kostenloses Konto|bei Infomaniak *my kSuite*|genügt", "*my kSuite* ist kostenlos. Mit Kalender und Mail gehören dir alle erweiterten Funktionen von Koala Zen.", []),
    },
}
ORDRE = ["nudge", "meetings", "warn", "stats", "cats", "ksuite"]
# Les couleurs : fond (deux tons), accent (mot cle, puces), encre du titre.
THEMES = {
    "nudge": ("#E3F7E8", "#B9EBC8", "#1E9E48", "#0F3A1E"),
    "meetings": ("#E4F0FF", "#BCD8FF", "#1F63D0", "#0D2550"),
    "warn": ("#EFE9FF", "#D3C4FF", "#6A3FE0", "#24135A"),
    "stats": ("#FFF1DE", "#FFD49A", "#E07A10", "#4A2604"),
    "cats": ("#FFE9E4", "#FFC2B5", "#E0533A", "#4D160C"),
    "ksuite": ("#E2F6F4", "#AEE6DF", "#0E9488", "#073C37"),
}
# Agenda et mail : Infomaniak seulement. Une etiquette positive en haut, une
# ligne claire en bas, sans detour.
BADGE = {"fr": "Gratuit avec Infomaniak *my kSuite*", "en": "Free with Infomaniak *my kSuite*", "de": "Kostenlos mit Infomaniak *my kSuite*"}
NOTE = {"fr": "Agenda et mail Infomaniak uniquement. Pas compatible avec Google, Gmail ni Outlook.",
        "en": "Infomaniak Calendar and Mail only. Not compatible with Google, Gmail or Outlook.",
        "de": "Nur Kalender und Mail von Infomaniak. Nicht kompatibel mit Google, Gmail oder Outlook."}
KSUITE = {
    "fr": [("Rappels de réunion", "Une bulle avant le début et avant la fin"), ("Mail aux participants", "En retard ou absent, prévenu en un clic"), ("Réunions et mails dans tes stats", "Ton temps, vu clairement")],
    "en": [("Meeting reminders", "A bubble before the start and before the end"), ("Notify attendees", "Late or absent, they know in one click"), ("Meetings and emails in your stats", "Your time, at a glance")],
    "de": [("Meeting-Erinnerungen", "Eine Blase vor Beginn und vor Schluss"), ("Teilnehmende informieren", "Verspätet oder verhindert, mit einem Klick"), ("Meetings und Mails in der Statistik", "Deine Zeit auf einen Blick")],
}

PAGE = {
    "en": ("notes.example.com", "Quarterly planning", ["The team agreed on three priorities for the quarter: a faster onboarding, a clearer pricing page and fewer support tickets.", "Each priority has one owner, one metric and a review every two weeks. We keep the list short on purpose.", "Next step: draft the onboarding flow and share it before Friday's review."]),
    "fr": ("notes.example.com", "Planification du trimestre", ["L'équipe s'est mise d'accord sur trois priorités : un onboarding plus rapide, une page de tarifs plus claire et moins de tickets au support.", "Chaque priorité a un responsable, un indicateur et un point toutes les deux semaines. La liste reste courte, exprès.", "Prochaine étape : esquisser le parcours d'accueil et le partager avant la revue de vendredi."]),
    "de": ("notes.example.com", "Quartalsplanung", ["Das Team hat sich auf drei Prioritäten geeinigt: ein schnelleres Onboarding, eine klarere Preisseite und weniger Support-Tickets.", "Jede Priorität hat eine verantwortliche Person, eine Kennzahl und alle zwei Wochen einen Check. Die Liste bleibt bewusst kurz.", "Nächster Schritt: den Einstieg skizzieren und vor dem Review am Freitag teilen."]),
}
REUNION = {"en": "Sprint review", "fr": "Revue de sprint", "de": "Sprint-Review"}


def api_simulee(lang, donnees, etat_agenda, preparation):
    """L'API d'extension simulee, partagee par les pages de scene et le popup."""
    return """<script>
// Une horloge fixee en debut d'apres-midi : un rendez-vous a 14:30, pas a minuit.
(() => { const V = Date; const c = new V(); c.setHours(14, 27, 0, 0); const dec = c.getTime() - V.now();
  class H extends V { constructor(...a) { if (a.length) super(...a); else super(V.now() + dec); } static now() { return V.now() + dec; } }
  window.Date = H; })();
const kzSimFr = %s;
const kzSimDonnees = %s;
const kzSimAgenda = %s;
const kzSimPrep = %s;
const kzSimEcouteurs = [];
const kzSimApi = {
  i18n: { getMessage: (k, s) => { const e = kzSimFr[k]; if (!e) return ""; let m = e.message; [].concat(s || []).forEach((v, i) => { m = m.replace("$" + (i + 1), v); }); return m; }, getUILanguage: () => %s },
  runtime: {
    id: "kz", getURL: (p) => p, getManifest: () => ({ version: "2.2.0" }),
    sendMessage: async (m) => {
      if (m && m.type === "kz-agenda-status") return kzSimAgenda;
      if (m && m.type === "kz-notify-prepare") return kzSimPrep;
      if (m && m.type === "kz-kdrive-status") return { configured: false };
      return { ok: true };
    },
    onMessage: { addListener: (f) => { kzSimEcouteurs.push(f); } }
  },
  storage: { local: {
    get: async (k) => { const o = {}; (k == null ? Object.keys(kzSimDonnees) : [].concat(k)).forEach((x) => { if (kzSimDonnees[x] !== undefined) o[x] = kzSimDonnees[x]; }); return o; },
    set: async (o) => { Object.assign(kzSimDonnees, o); }
  } },
  alarms: { get: async () => ({ scheduledTime: Date.now() + 12 * 60000 }), clear: async () => true, create: () => {} },
  tabs: { query: async () => [] }
};
window.chrome = kzSimApi; window.browser = kzSimApi;
window.__kzEnvoie = (m) => kzSimEcouteurs.forEach((f) => { try { f(m, {}, () => {}); } catch (e) {} });
</script>""" % (json.dumps(locale(lang), ensure_ascii=False), json.dumps(donnees, ensure_ascii=False), json.dumps(etat_agenda), json.dumps(preparation, ensure_ascii=False), json.dumps(lang))


def page_scene(scene, lang):
    """Une page web neutre, avec la vraie bulle ou le vrai chat par-dessus."""
    fr = locale(lang)
    hote, titre, paras = PAGE[lang]
    maintenant_ms = "Date.now()"
    habitude = fr["frHabitPh"]["message"]
    donnees = {"animMode": "always" if scene == "cats" else "never", "customSport": [habitude], "customQuotes": [], "includeDefaultQuotes": True, "customKoalas": [], "includeDefaultKoalas": True, "sportIndex": 0, "passages": True}
    prep = {"ok": True, "id": 77, "start": 0, "title": REUNION[lang], "sent": [],
            "recipients": [{"name": "Boris", "address": "boris@example.com", "organizer": True}, {"name": "Claire", "address": "claire@example.com"}, {"name": "", "address": "lea@example.com"}],
            "templates": {}}
    t = REUNION[lang]
    h = "14:30"
    corps_retard = fr["notifyBodyLate"]["message"]
    prep["templates"] = {
        "late5": {"subject": fr["notifySubjLate"]["message"].replace("{n}", "5").replace("{t}", t), "body": corps_retard.replace("{n}", "5").replace("{t}", t).replace("{h}", h)},
        "late10": {"subject": fr["notifySubjLate"]["message"].replace("{n}", "10").replace("{t}", t), "body": corps_retard.replace("{n}", "10").replace("{t}", t).replace("{h}", h)},
        "absent": {"subject": fr["notifySubjAbsent"]["message"].replace("{t}", t), "body": fr["notifyBodyAbsent"]["message"].replace("{t}", t).replace("{h}", h)},
    }
    if scene == "nudge":
        declencheur = """window.__kzEnvoie({ type: "kz-show", screenToday: 15480, snoozeMinutes: 15, intervalMinutes: 45, doneToday: 1, repToday: 0, habitGoal: 3, streak: 6 });"""
    elif scene in ("meetings", "warn"):
        declencheur = """window.__kzEnvoie({ type: "kz-meeting-soon", id: 77, title: %s, start: Date.now() + 3 * 60000, end: Date.now() + 33 * 60000, minutes: 3, url: "https://kmeet.infomaniak.com/sprint", people: 4, canNotify: true, notifyNonce: "ab".repeat(16) });""" % json.dumps(t)
        if scene == "warn":
            declencheur += """setTimeout(() => { const r = document.getElementById("kz-koala-host").shadowRoot; const b = r && r.querySelector(".kz-btn--notify"); if (b) b.click(); }, 900);"""
    else:
        declencheur = """window.__kzEnvoie({ type: "kz-passage", animMode: "always", variant: "meetCats", ms: 16000, who: "both", coat: 0, phrase: 3 });
setTimeout(() => { const r = document.getElementById("kz-passage-host").shadowRoot; r.getAnimations().forEach((a) => { try { const d = a.effect.getTiming().duration; const f = a.animationName === "kzSay1" ? 0.44 : (a.animationName === "kzSay2" ? 0.62 : 0.5); a.pause(); a.currentTime = (typeof d === "number" ? d : 16000) * f; } catch (e) {} }); }, 400);"""
    # Mise en scene seulement : la racine s'ouvre pour pouvoir cliquer Prevenir.
    ouvre = """<script>const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: "open" })); };</script>""" if scene in ("warn", "cats") else ""
    # Une page epuree : un titre, des blocs gris. Rien ne vole la vedette a la bulle.
    blocs = '<div class="img"></div>' + "".join('<div class="bar" style="width:%d%%"></div>' % w for w in (94, 88, 91, 72, 0, 90, 84, 60))
    if scene == "cats":
        # Les chats marchent sur le fond de la composition : page transparente.
        return """<!doctype html><html><head><meta charset="utf-8"><base href="%s"><style>html,body{margin:0;background:transparent}</style></head><body>
%s%s<script src="quotes.js"></script><script src="passages.js"></script><script src="content.js"></script>
<script>setTimeout(() => { %s }, 300);</script></body></html>""" % (BASE, ouvre, api_simulee(lang, donnees, {"configured": True}, prep), declencheur)
    return """<!doctype html><html lang="%s"><head><meta charset="utf-8"><base href="%s"><title>%s</title>
<style>html,body{margin:0;background:#FFFFFF}body{font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#2B2F33}
.wrap{max-width:540px;margin:36px 40px}h1{font:700 26px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;margin:0 0 18px;color:#1F2326}
.img{height:120px;border-radius:12px;background:linear-gradient(135deg,#EEF1F4,#E3E7EB);margin-bottom:18px}.bar{height:10px;border-radius:5px;background:#EEF0F2;margin:12px 0}</style></head>
<body><div class="wrap"><h1>%s</h1>%s</div>
%s%s<script src="quotes.js"></script><script src="passages.js"></script><script src="content.js"></script>
<script>setTimeout(() => { %s }, 300);</script></body></html>""" % (lang, BASE, titre, titre, blocs, ouvre, api_simulee(lang, donnees, {"configured": True}, prep), declencheur)


def page_popup(lang, cible="charts"):
    """Le vrai popup, onglet Stats, semaine passee, donnees d'exemple."""
    html = io.open(os.path.join(RACINE, "popup.html"), encoding="utf-8").read()
    html = re.sub(r'<script[^>]*src="[^"]*"[^>]*></script>', "", html)
    html = html.replace("<head>", '<head><base href="%s">' % BASE, 1)
    random.seed(7)
    auj = datetime.date.today()
    st, sc, md, ml = {}, {}, {}, {}
    for i in range(1, 22):
        d = auj - datetime.timedelta(days=i)
        k = d.isoformat()
        ouvre = d.weekday() < 5
        rep = random.choice([0, 1, 1, 2]) if ouvre else 0
        rep = random.choice([0, 0, 1]) if ouvre else 0
        st[k] = {"due": 5, "done": random.choice([4, 5, 5, 6]) if ouvre else random.choice([2, 3]), "rep": rep, "repH": [0, rep, 0, 0]}
        sc[k] = random.randint(19000, 27000) if ouvre else random.randint(3000, 6000)
        if ouvre:
            b = int(datetime.datetime(d.year, d.month, d.day, 9).timestamp() * 1000)
            n = random.choice([1, 2, 2, 3])
            md[k] = {"r%d-%d" % (i, j): [b + j * 7200000, b + j * 7200000 + random.choice([1800000, 3600000])] for j in range(n)}
            tot = random.randint(35, 70)
            ml[k] = {"in": tot + 8, "out": random.randint(6, 16), "read": tot - 12, "del": 12, "done": tot}
        else:
            ml[k] = {"in": 7, "out": 1, "read": 3, "del": 3, "done": 6}
    donnees = {"theme": "light", "firstRun": False, "statsRange": "week", "statsOffset": -1, "habitGoal": 3, "customSport": ["x"],
               "statsDaily": st, "screenDaily": sc, "meetingDaily": md, "mailDaily": ml, "agendaEnabled": True, "mailStatsEnabled": True}
    etat = {"configured": True, "hasToken": True, "enabled": True, "warn": True, "endWarn": True, "calendarName": "Pro", "calendars": [{"id": 1, "name": "Pro"}], "notifyEnabled": True, "notifyMailboxEmail": "moi@example.com", "notifyHasToken": True, "mailStatsEnabled": True}
    corps = api_simulee(lang, donnees, etat, {"ok": False}) + '<script src="quotes.js"></script><script src="popup.js"></script>' + \
        '<script>setTimeout(() => { const b = document.getElementById("tabStatsBtn"); if (b) b.click(); }, 400);' + \
        ('setTimeout(() => { const c = document.getElementById(%s); if (c) window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - %d); }, 900);</script>' % (json.dumps("chartsCard" if cible == "charts" else "totalHead"), 117 if cible == "charts" else 119))
    return html[:html.rindex("</body>")] + corps + "</body></html>"


def produit(t):
    # "my kSuite" se lit comme un nom de produit : en italique, jamais coupe.
    return re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", lambda m: '<em class="prod">%s</em>' % m.group(1).replace(" ", "\u00a0"), t)


def surligne(t, accent):
    t = produit(t).replace("|", "<br>")
    return re.sub(r"\*\*(.+?)\*\*", r'<span style="color:%s">\1</span>' % accent, t)


ICONES = [
    '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
    '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>',
]


def composition(scene, lang):
    titre, sous, pastilles = TEXTES[scene][lang]
    fond1, fond2, accent, encre = THEMES[scene]
    pills = "".join('<div class="pill"><i></i>%s</div>' % p for p in pastilles)
    infomaniak = scene in ("meetings", "warn", "ksuite")
    badge = '<div class="badge"><b>✓</b>%s</div>' % produit(BADGE[lang]) if scene in ("meetings", "warn") else ""
    note = '<div class="note">%s</div>' % NOTE[lang] if infomaniak else ""
    if scene == "stats":
        droite = ('<div class="popup p1"><iframe src="file://%s/popup-%s-tiles.html" scrolling="no"></iframe></div>'
                  '<div class="popup p2"><iframe src="file://%s/popup-%s-charts.html" scrolling="no"></iframe></div>') % (TRAVAIL, lang, TRAVAIL, lang)
    elif scene == "ksuite":
        cartes = "".join('<div class="carte"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg></div><div><div class="ct">%s</div><div class="cs">%s</div></div></div>' % (ICONES[i], t, st) for i, (t, st) in enumerate(KSUITE[lang]))
        droite = '<div class="cartes">%s</div>' % cartes
    elif scene == "cats":
        droite = '<iframe class="chats" src="file://%s/scene-cats-%s.html" scrolling="no"></iframe>' % (TRAVAIL, lang)
    else:
        large = ""
        h = {"warn": 656, "cats": 520}.get(scene, 480)
        droite = '<div class="win" style="height:%dpx;top:%dpx"><div class="chrome"><i></i><i></i><i></i></div><div class="vue" style="height:%dpx"><iframe%s src="file://%s/scene-%s-%s.html" scrolling="no"></iframe></div></div>' % (h, (800 - h) // 2, h - 36, large, TRAVAIL, scene, lang)
    return """<!doctype html><html><head><meta charset="utf-8"><base href="%(base)s"><style>
html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Helvetica,Arial,sans-serif;background:linear-gradient(135deg,%(f1)s 0%%,%(f2)s 100%%);position:relative}
.blob{position:absolute;border-radius:50%%;filter:blur(2px)}
.marque{position:absolute;left:72px;top:56px;display:flex;align-items:center;gap:12px;font-weight:800;font-size:22px;color:%(encre)s}
.marque img{width:40px;height:40px;border-radius:11px;box-shadow:0 4px 12px rgba(0,0,0,.12)}
.texte{position:absolute;left:72px;top:50%%;transform:translateY(-50%%);width:500px}
.badge{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;padding:8px 16px 8px 10px;border-radius:999px;background:#FFFFFF;box-shadow:0 4px 14px rgba(0,0,0,.08);font-size:16px;font-weight:700;color:%(encre)s}
.badge b{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%%;background:%(accent)s;color:#FFFFFF;font-size:13px}
h1{margin:0;font-size:58px;line-height:1.04;font-weight:800;color:%(encre)s;letter-spacing:-.025em}
.sous{margin:22px 0 28px;font-size:22px;line-height:1.45;color:%(encre)s;opacity:.78}
.pill{display:inline-flex;align-items:center;gap:10px;margin:0 10px 12px 0;padding:12px 20px;border-radius:999px;background:#FFFFFF;box-shadow:0 4px 14px rgba(0,0,0,.08);font-size:18px;font-weight:700;color:%(encre)s}
.pill i{width:10px;height:10px;border-radius:50%%;background:%(accent)s}
em.prod{font-style:italic;font-weight:800;letter-spacing:-.005em;color:%(accent)s;padding-right:.06em}
.sous em.prod,.badge em.prod{font-weight:700}
.note{position:absolute;left:72px;bottom:44px;width:520px;font-size:14px;line-height:1.4;color:%(encre)s;opacity:.7}
.win{position:absolute;right:56px;top:72px;width:640px;height:656px;border-radius:18px;background:#FFFFFF;box-shadow:0 30px 70px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06);overflow:hidden}
.chrome{height:36px;background:#F3F4F6;display:flex;align-items:center;gap:8px;padding:0 16px}
.chrome i{width:11px;height:11px;border-radius:50%%;background:#D9DCE0}
.vue{position:relative;width:640px;height:620px;overflow:hidden}
.vue iframe{position:absolute;right:0;bottom:0;border:0;width:566px;height:548px;transform:scale(1.13);transform-origin:100%% 100%%}
.vue iframe.large{width:700px;height:678px;transform:scale(.9143)}
.popup{position:absolute;width:300px;height:440px;transform:scale(1.22);transform-origin:top left;border-radius:14px;overflow:hidden;box-shadow:0 26px 60px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.06);background:#FFFFFF}
.popup iframe{border:0;width:300px;height:440px;display:block}
.p2{left:604px;top:58px;z-index:1}
.p1{left:892px;top:196px;z-index:2;box-shadow:0 34px 80px rgba(0,0,0,.24),0 2px 8px rgba(0,0,0,.08)}
iframe.chats{position:absolute;right:0;bottom:0;border:0;width:940px;height:400px;background:transparent;transform:scale(1.3);transform-origin:100%% 100%%}
.cartes{position:absolute;right:72px;top:50%%;transform:translateY(-50%%);width:560px;display:flex;flex-direction:column;gap:20px}
.carte{display:flex;align-items:center;gap:22px;padding:26px 28px;border-radius:22px;background:#FFFFFF;box-shadow:0 18px 40px rgba(0,0,0,.10)}
.ic{flex:0 0 auto;width:64px;height:64px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:%(f1)s;color:%(accent)s}
.ic svg{width:32px;height:32px}
.ct{font-size:24px;font-weight:800;color:%(encre)s;letter-spacing:-.01em}
.cs{margin-top:4px;font-size:18px;color:%(encre)s;opacity:.7}
</style></head><body>
<div class="blob" style="width:560px;height:560px;left:-200px;top:-240px;background:rgba(255,255,255,.55)"></div>
<div class="blob" style="width:420px;height:420px;right:-120px;bottom:-200px;background:%(accent)s;opacity:.14"></div>
<div class="blob" style="width:180px;height:180px;left:520px;top:600px;background:%(accent)s;opacity:.10"></div>
<div class="marque"><img src="icons/icon-128.png" alt="">Koala Zen</div>
<div class="texte"%(large_txt)s%(haut)s>%(badge)s<h1%(petit)s>%(titre)s</h1><div class="sous">%(sous)s</div>%(pills)s</div>
%(note)s
%(droite)s
</body></html>""" % {"base": BASE, "f1": fond1, "f2": fond2, "accent": accent, "encre": encre, "badge": badge,
                       "titre": surligne(titre, accent), "sous": produit(sous), "pills": pills, "note": note, "droite": droite,
                       "petit": ' style="font-size:50px"' if scene == "ksuite" else "", "haut": ' style="top:290px"' if scene == "cats" else "", "large_txt": ' style="width:540px"' if scene == "ksuite" else ""}


# Tuile promotionnelle du Chrome Web Store (440 x 280, obligatoire) et
# bandeau (1400 x 560, facultatif). Le koala, le nom, une promesse courte.
PROMESSE = {
    "en": ("Small breaks, meetings on time", "A koala for your workday"),
    "fr": ("Des pauses, des réunions à l'heure", "Un koala pour ta journée de travail"),
    "de": ("Kleine Pausen, Meetings pünktlich", "Ein Koala für deinen Arbeitstag"),
}


def tuile(lang, largeur, hauteur):
    titre, sous = PROMESSE[lang]
    grand = largeur > 600
    return """<!doctype html><html><head><meta charset="utf-8"><base href="%s"><style>
html,body{margin:0;width:%dpx;height:%dpx;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:linear-gradient(150deg,#EAF7EE 0%%,#CFE9D7 100%%);position:relative}
.k{position:absolute;right:%dpx;bottom:-%dpx;width:%dpx}
.t{position:absolute;left:%dpx;top:50%%;transform:translateY(-50%%);width:%dpx}
.m{display:flex;align-items:center;gap:%dpx;font-weight:800;font-size:%dpx;color:#163F24;letter-spacing:-.01em}
.m img{width:%dpx;height:%dpx;border-radius:%dpx}
.p{margin-top:%dpx;font-size:%dpx;line-height:1.25;font-weight:700;color:#1B5E2E}
.s{margin-top:%dpx;font-size:%dpx;color:#3F5446}
</style></head><body>
<div class="t"><div class="m"><img src="icons/icon-128.png" alt="">Koala Zen</div><div class="p">%s</div>%s</div>
<img class="k" src="images/koala-hello-still.svg" alt="">
</body></html>""" % (BASE, largeur, hauteur,
        60 if grand else -4, 12 if grand else 8, 440 if grand else 165,
        90 if grand else 24, 760 if grand else 205,
        18 if grand else 9, 64 if grand else 28, 72 if grand else 32, 72 if grand else 32, 16 if grand else 8,
        22 if grand else 12, 40 if grand else 17,
        12 if grand else 6, 26 if grand else 13,
        titre, ('<div class="s">%s</div>' % sous) if grand else "")


def photographie_tuile(html_path, png_path, l, h):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--force-device-scale-factor=2", "--window-size=%d,%d" % (l, h), "--virtual-time-budget=800",
                    "--screenshot=" + png_path, "file://" + html_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    Image.open(png_path).convert("RGB").resize((l, h), Image.LANCZOS).save(png_path, optimize=True)


def photographie(html_path, png_path, budget_ms):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--force-device-scale-factor=2", "--window-size=1280,800", "--virtual-time-budget=%d" % budget_ms,
                    "--screenshot=" + png_path, "file://" + html_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png_path).convert("RGB")
    im.resize((1280, 800), Image.LANCZOS).save(png_path, optimize=True)


def main():
    os.makedirs(TRAVAIL, exist_ok=True)
    seules = sys.argv[1:]
    if not seules or "tuiles" in seules:
        for lang in LANGUES:
            for nom, (l, h) in (("small-tile", (440, 280)), ("marquee", (1400, 560))):
                src = os.path.join(TRAVAIL, "%s-%s.html" % (nom, lang))
                io.open(src, "w", encoding="utf-8").write(tuile(lang, l, h))
                png = os.path.join(SORTIE, "chrome-%s-%s.png" % (nom, lang))
                photographie_tuile(src, png, l, h)
                print("ok", os.path.basename(png))
        # Apercu des partages du depot GitHub (1280 x 640), en anglais.
        src = os.path.join(TRAVAIL, "github-social.html")
        io.open(src, "w", encoding="utf-8").write(tuile("en", 1280, 640))
        png = os.path.join(SORTIE, "github-social-preview.png")
        photographie_tuile(src, png, 1280, 640)
        print("ok", os.path.basename(png))
    for lang in LANGUES:
        for cible in ("tiles", "charts"):
            io.open(os.path.join(TRAVAIL, "popup-%s-%s.html" % (lang, cible)), "w", encoding="utf-8").write(page_popup(lang, cible))
        for i, scene in enumerate(ORDRE, 1):
            if seules and scene not in seules:
                continue
            if scene not in ("stats", "ksuite"):
                io.open(os.path.join(TRAVAIL, "scene-%s-%s.html" % (scene, lang)), "w", encoding="utf-8").write(page_scene(scene, lang))
            compo = os.path.join(TRAVAIL, "compo-%s-%s.html" % (scene, lang))
            io.open(compo, "w", encoding="utf-8").write(composition(scene, lang))
            png = os.path.join(SORTIE, "screenshot-%d-%s-%s.png" % (i, scene, lang))
            budget = {"cats": 2400, "warn": 2600}.get(scene, 2200)
            photographie(compo, png, budget)
            print("ok", os.path.basename(png))
    # Les pages de travail contiennent des chemins locaux : on ne les garde pas.
    shutil.rmtree(TRAVAIL, ignore_errors=True)


if __name__ == "__main__":
    main()
