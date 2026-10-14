# Koala Zen, Chrome Web Store submission kit

Everything needed to fill in the listing on https://chrome.google.com/webstore/devconsole, version 2.2.0. The Chrome Web Store lets you localize the listing: fill English as the default language, then add French and German. Text source: `store-assets/generateur/textes_fiches.py`.

Upload `dist/koala-zen-chrome.zip` (built by `bash build.sh`, the same file as `download/koala-zen-chrome.zip`).

---

## 1. Store listing

**Name:** Koala Zen (comes from the manifest)

**Summary** (from the manifest, max 132 characters, already within the limit):

| Language | Summary | Length |
|---|---|---|
| English | A friendly koala reminds you to take small breaks, helps you never miss a meeting, and keeps your data on your device. | 118 |
| Français | Un koala te rappelle de faire de petites pauses, t'aide à ne rater aucune réunion, et tout reste sur ton appareil. | 114 |
| Deutsch | Ein Koala erinnert dich an kleine Pausen, hilft dir, kein Meeting zu verpassen, und alles bleibt auf deinem Gerät. | 114 |

**Category:** Lifestyle > Well-being (recommended, it is a break and habit companion). Good alternative: Productivity > Workflow & Planning.

**Language:** English (default), with French and German listings.

**Compatibility, stated in every language:** the calendar and email features work with Infomaniak only, not with Google Calendar, Gmail or Microsoft Outlook. Breaks, quotes, statistics and passing animals work for everyone.

### Detailed description, English
```
Koala Zen is a gentle, playful companion for your workday in the browser.

A gentle nudge, never a guilt trip
Every so often, from every 5 to every 240 minutes, a koala appears in a corner of the page and suggests one small thing: stand up, drink some water, look into the distance. Done or later, it's your call. Then it leaves you a short thought from one of about 60 hand-picked quotes. Never during a video call, and it waits when you step away.

Never miss a meeting (optional, Infomaniak only)
A free Infomaniak my kSuite account is all you need: its Calendar and Mail unlock every advanced feature. Works with Infomaniak only, not with Google Calendar, Gmail or Microsoft Outlook.
• Quiet during your meetings: no reminder while you are in a meeting with others.
• A blue bubble 3 minutes before, with a live countdown and the video link one click away.
• An amber bubble 5 minutes before the end, so you finish on time.
• Running late? Let the attendees know in one click: a ready-made email from your own mailbox, which you reread and send.

See where your time goes
Habits done and postponed, screen time, time in meetings, emails handled and sent, day by day or week by week. Streaks, records and your busiest day. Everything is computed on your device.

And sometimes, a cat drops by
For no reason at all. From 5 pm, a cat walks by every hour to tell you, a little more firmly each time, that it's time to stop. On weekends, it wonders why you are working at all.

Make it yours
• Make the koala yours: replace it with your own images or animated GIFs (up to 18).
• Your own habits and quotes.
• Rhythm presets: Pomodoro, Deep work, Ultradian, or your own interval.
• Pause for an hour or the rest of the day, an optional focus mode, and a dark mode.
• A short guided tour on first launch. English, French and German.

Your data stays yours
No account, no Koala Zen server, no tracking. Everything stays in your browser, and a backup is a file you export yourself. The Infomaniak features are off by default and use your own tokens, each limited to a single scope and encrypted on your device. Koala Zen talks only to Infomaniak, and only for what it needs.

Open source (MIT license): https://github.com/tnalias/koala-zen
```

### Description détaillée, Français
```
Koala Zen est un compagnon doux et joueur pour ta journée de travail dans le navigateur.

Un coup de pouce, jamais de culpabilité
De temps en temps, toutes les 5 à 240 minutes, un koala apparaît dans un coin de la page et te propose une petite chose : te lever, boire un verre d'eau, regarder au loin. Fait ou plus tard, c'est toi qui choisis. Puis il te laisse une courte pensée, parmi une soixantaine de citations choisies. Jamais pendant une visio, et il attend quand tu t'éloignes.

Ne rate plus une réunion (facultatif, Infomaniak uniquement)
Un compte Infomaniak my kSuite, gratuit, suffit : son agenda et son mail débloquent toutes les fonctions avancées. Uniquement avec Infomaniak, pas compatible avec Google Agenda, Gmail ni Microsoft Outlook.
• Silence pendant tes réunions : aucun rappel quand tu es en réunion avec d'autres.
• Une bulle bleue 3 minutes avant, avec un compte à rebours et le lien de la visio à un clic.
• Une bulle ambre 5 minutes avant la fin, pour finir à l'heure.
• En retard ? Préviens les participants en un clic : un mail déjà écrit, depuis ta propre boîte, que tu relis et que tu envoies.

Vois où passe ton temps
Habitudes faites et reportées, temps d'écran, temps en réunion, mails traités et envoyés, jour par jour ou semaine par semaine. Séries, records et ton jour le plus chargé. Tout est calculé sur ton appareil.

Et parfois, un chat passe
Sans aucune raison. Dès 17 h, un chat passe chaque heure pour te dire, un peu plus fermement à chaque fois, qu'il est temps d'arrêter. Le week-end, il se demande pourquoi tu travailles.

À ta façon
• Ton koala à toi : remplace-le par tes propres images ou GIF animés (jusqu'à 18).
• Tes propres habitudes et citations.
• Des rythmes prêts : Pomodoro, Deep work, Ultradien, ou ton propre intervalle.
• Une pause d'une heure ou jusqu'à demain, un mode focus facultatif, et un mode sombre.
• Une courte présentation au premier lancement. En français, anglais et allemand.

Tes données restent chez toi
Pas de compte, pas de serveur Koala Zen, aucun suivi. Tout reste dans ton navigateur, et une sauvegarde est un fichier que tu exportes toi-même. Les fonctions Infomaniak sont éteintes par défaut et utilisent tes propres jetons, chacun limité à un seul usage et chiffré sur ton appareil. Koala Zen ne parle qu'à Infomaniak, et seulement pour ce dont il a besoin.

Code source ouvert (licence MIT) : https://github.com/tnalias/koala-zen
```

### Ausführliche Beschreibung, Deutsch
```
Koala Zen ist ein sanfter, verspielter Begleiter für deinen Arbeitstag im Browser.

Ein sanfter Anstoss, nie ein schlechtes Gewissen
Ab und zu, alle 5 bis 240 Minuten, erscheint ein Koala in einer Ecke der Seite und schlägt dir eine kleine Sache vor: aufstehen, ein Glas Wasser trinken, in die Ferne schauen. Erledigt oder später, du entscheidest. Danach hinterlässt er dir einen kurzen Gedanken aus rund 60 ausgewählten Zitaten. Nie während eines Videocalls, und er wartet, wenn du weg bist.

Kein Meeting mehr verpassen (optional, nur mit Infomaniak)
Ein kostenloses Konto bei Infomaniak my kSuite genügt: Kalender und Mail schalten alle erweiterten Funktionen frei. Nur mit Infomaniak, nicht kompatibel mit Google Kalender, Gmail oder Microsoft Outlook.
• Ruhe in deinen Meetings: keine Erinnerung, solange du mit anderen im Meeting bist.
• Eine blaue Blase 3 Minuten vorher, mit Countdown und dem Videolink einen Klick entfernt.
• Eine bernsteinfarbene Blase 5 Minuten vor Schluss, damit du pünktlich endest.
• Verspätet? Informiere die Teilnehmenden mit einem Klick: eine fertige Mail aus deinem eigenen Postfach, die du prüfst und sendest.

Sieh, wohin deine Zeit geht
Erledigte und verschobene Gewohnheiten, Bildschirmzeit, Zeit in Meetings, bearbeitete und gesendete Mails, Tag für Tag oder Woche für Woche. Serien, Rekorde und dein vollster Tag. Alles wird auf deinem Gerät berechnet.

Und manchmal schaut eine Katze vorbei
Ganz ohne Grund. Ab 17 Uhr kommt jede Stunde eine Katze vorbei und sagt dir, jedes Mal etwas bestimmter, dass es Zeit ist aufzuhören. Am Wochenende wundert sie sich, warum du überhaupt arbeitest.

Ganz nach deinem Geschmack
• Dein eigener Koala: ersetze ihn durch eigene Bilder oder animierte GIFs (bis zu 18).
• Eigene Gewohnheiten und Zitate.
• Fertige Rhythmen: Pomodoro, Deep Work, Ultradian, oder dein eigenes Intervall.
• Pause für eine Stunde oder bis morgen, ein optionaler Fokusmodus und ein dunkles Design.
• Eine kurze Einführung beim ersten Start. Auf Deutsch, Englisch und Französisch.

Deine Daten bleiben bei dir
Kein Konto, kein Koala-Zen-Server, kein Tracking. Alles bleibt in deinem Browser, und eine Sicherung ist eine Datei, die du selbst exportierst. Die Infomaniak-Funktionen sind standardmässig aus und nutzen deine eigenen Token, jeder auf einen einzigen Zweck begrenzt und auf deinem Gerät verschlüsselt. Koala Zen spricht nur mit Infomaniak, und nur für das, was es braucht.

Open Source (MIT-Lizenz): https://github.com/tnalias/koala-zen
```

---

## 2. Graphic assets

All in `store-assets/`, regenerated from the real 2.2.0 interface with `python3 store-assets/generateur/generer.py` (screenshots, small tile and marquee, in three languages). Upload the `-en` files to the English listing, `-fr` to French and `-de` to German.

| Asset | Required | Size | Files |
|---|---|---|---|
| Store icon | yes | 128 x 128 | `icons/icon-128.png` |
| Screenshots | at least 1, up to 5 | 1280 x 800 | upload in this order: `screenshot-1-nudge-en.png`, `screenshot-2-meetings-en.png`, `screenshot-3-warn-en.png`, `screenshot-6-ksuite-en.png`, `screenshot-4-stats-en.png` |
| Small promo tile | yes | 440 x 280 | `chrome-small-tile-en.png` |
| Marquee promo tile | optional | 1400 x 560 | `chrome-marquee-en.png` |

Chrome takes five screenshots at most: keep the my kSuite one (6) and leave out the passing cat (5), which stays on Mozilla Add-ons and GitHub. Screenshots 2, 3 and 6 say the calendar and email features need Infomaniak (my kSuite is enough).

**Official URL / homepage:** https://github.com/tnalias/koala-zen
**Support URL:** https://github.com/tnalias/koala-zen/issues

---

## 3. Privacy practices tab

### Single purpose
```
Koala Zen is a break and habit companion: a koala reminds the user at regular intervals to do a small healthy habit and shares a short quote, with optional statistics and an optional Infomaniak Calendar connection so reminders stay quiet during meetings and the user gets meeting reminders.
```

### Permission justifications
| Permission | Justification to paste |
|---|---|
| `alarms` | Schedules the reminder at the interval the user chooses, the passing animals, the meeting reminders and the once-a-minute screen-time tick. |
| `idle` | Pauses reminders when the user is away from the keyboard, and keeps meeting reminders from appearing while the computer is asleep or locked. |
| `storage` | Saves the user's settings, habits, quotes and statistics locally in the browser. |
| `unlimitedStorage` | Lets the user import their own images (up to 18 PNG or GIF) and keep their full statistics history without hitting the default quota. |
| `tabs` | Finds the active tab to show the reminder there, and checks its address so reminders stay silent on video-call sites (kMeet, Teams, Zoom, Meet). |
| `scripting` | Re-injects the reminder script into tabs that were already open before the extension was installed or updated, so the reminder can appear. |
| `notifications` | Shows a system notification for a meeting reminder when no web page can display the bubble. |
| `declarativeNetRequest` | Removes the Origin header only from the extension's own requests (tabIds -1) to the user's Infomaniak mail API, which otherwise rejects them; never applied to web pages. |
| Host permission `http://*/*`, `https://*/*` | The reminder bubble and the passing animals are shown on the page the user is reading, whatever the site; the same access lets the extension recognise video-call sites to stay quiet. |

### Remote code
**No**, I am not using remote code. All JavaScript is packaged in the extension.

### Data usage
Tick only what applies (everything is optional and off by default):

| Category | Tick? | Why |
|---|---|---|
| Personally identifiable information | yes | Optional: the user's Infomaniak mailbox address and the email addresses of meeting attendees, used only to send the "running late / absent" email the user reviews and confirms. |
| Authentication information | yes | Optional: the user's own Infomaniak API tokens, encrypted on the device, sent only to Infomaniak. |
| Personal communications | yes | Optional: the email the user chooses to send to meeting attendees, sent through the user's own Infomaniak mailbox. |
| Health information, Financial and payment information, Location, Web history, User activity, Website content | no | None of these is collected. |

Certify the three statements: data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, not used to determine creditworthiness or for lending.

### Privacy policy URL
Required because tokens and email addresses are handled. Publish the ready-to-paste policy from `store-assets/mozilla-listing.md` (section "Privacy policy") at a stable public address, then paste that address here. Koala Zen itself has no server: nothing is collected by the developer.

---

## 4. Distribution

Visibility: Public (or Unlisted for a private release). Regions: all.
