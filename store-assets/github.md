# Koala Zen, GitHub kit (2.2.0)

Everything for https://github.com/tnalias/koala-zen.

## 1. Repository "About" (gear icon next to About)

**Description** (max 350 characters):
> A friendly koala for your workday: gentle break reminders, healthy habits, meeting reminders and attendee emails with Infomaniak, and stats on where your time goes. Private, no account. Chrome and Firefox.

**Website:** leave empty for now, then put the Chrome Web Store or Mozilla Add-ons page once published.

**Topics:** `browser-extension` `chrome-extension` `firefox-addon` `webextension` `manifest-v3` `break-reminder` `habit-tracker` `wellbeing` `productivity` `pomodoro` `infomaniak` `privacy` `open-source`

## 2. Social preview

Settings > General > Social preview > Edit > upload `store-assets/github-social-preview.png` (1280 x 640).

## 3. Files to publish

Push the whole project except what `.gitignore` excludes (`node_modules/`, `dist/`, `store-assets/generateur/build/`, `.DS_Store`).

- **Delete `rules.json` on GitHub.** It was removed in 2.2 (the Origin rule is now a session rule set by the background script).
- `download/koala-zen-chrome.zip` is the 2.2.0 build.
- `download/koala-zen-firefox.xpi` is still the **2.1.0** signed build. Replace it with the 2.2.0 file signed by Mozilla (AMO) before announcing the release, so the README instructions stay true.
- New in the repository: `CHANGELOG.md`, `store-assets/chrome-web-store.md`, `store-assets/github.md`, `store-assets/generateur/` (regenerates screenshots and listings), new screenshots in three languages, `store-assets/archive-2.1/` (previous screenshots).

## 4. Release

**Tag:** `v2.2.0` · **Title:** `Koala Zen 2.2.0`

**Assets to attach:** `download/koala-zen-chrome.zip`, and the Mozilla-signed `koala-zen-firefox.xpi` 2.2.0 once available.

**Release notes, to paste:**

```markdown
**A friendly koala for your workday.** Breaks and habits, meetings on time, and a clear view of where your time goes.

### Highlights
- **Never miss a meeting** (Infomaniak Calendar): a bubble 3 minutes before with the video link one click away, a heads-up 5 minutes before the end, and quiet during your meetings.
- **Running late? Let them know in one click** (Infomaniak Mail): a ready-made email to the attendees, from your own mailbox, reviewed before sending.
- **See where your time goes:** time in meetings and emails handled join habits and screen time in the stats.
- **Dark mode**, a **short guided tour**, **redrawn koalas and cats**, and **evening rounds** from 5 pm.

> A free **Infomaniak *my kSuite*** account is all you need for the calendar and email features. They work with **Infomaniak only**, not with Google Calendar, Gmail or Microsoft Outlook. Everything else works for everyone.

### Security
Two tokens, each limited to a single scope, encrypted with a non-extractable key; a closed list of API calls; bubbles isolated from web pages; emails only to the meeting's attendees.

### After updating
- Paste your Infomaniak tokens again, one per use (older tokens had several scopes and are forgotten for your safety).
- The kDrive backup is gone: export a backup file from the Data tab instead.

Full details in [CHANGELOG.md](CHANGELOG.md).
```

**Notes de version, en français** (à ajouter sous la version anglaise si tu veux) :

```markdown
**Un koala bienveillant pour ta journée de travail.** Des pauses et des habitudes, des réunions à l'heure, et une vue claire sur ton temps.

- **Ne rate plus une réunion** (agenda Infomaniak) : une bulle 3 minutes avant avec le lien de la visio, un rappel 5 minutes avant la fin, et le silence pendant tes réunions.
- **En retard ? Préviens en un clic** (mail Infomaniak) : un mail déjà écrit pour les participants, depuis ta propre boîte, relu avant l'envoi.
- **Vois où passe ton temps** : temps en réunion et mails traités rejoignent les habitudes et l'écran dans les stats.
- **Mode sombre**, **présentation au démarrage**, **koalas et chats redessinés**, et **rondes du soir** dès 17 h.

> Un compte **Infomaniak *my kSuite***, gratuit, suffit pour l'agenda et le mail. Ils fonctionnent **uniquement avec Infomaniak**, pas avec Google Agenda, Gmail ni Microsoft Outlook.

**Après la mise à jour :** recolle tes jetons Infomaniak, un par usage. La sauvegarde kDrive disparaît : exporte un fichier depuis l'onglet Données.
```
