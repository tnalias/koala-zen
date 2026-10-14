<p align="center">
  <img src="icons/icon-128.png" width="88" height="88" alt="Koala Zen">
</p>

# Koala Zen

> **English** · [Français](README.fr.md)

**A friendly koala for your workday.** It reminds you to take small breaks and build healthy habits, keeps you on time for your meetings, and shows you where your time goes. For **Chrome and Firefox**, free and open source.

- **A gentle nudge, never a guilt trip.** Every 5 to 240 minutes, a koala suggests one small thing: stand up, drink some water, look into the distance. Done or later, it's your call. Then it leaves you a short thought from about 60 hand-picked quotes. Never during a video call.
- **Never miss a meeting.** A bubble 3 minutes before, with the video link one click away, and a heads-up 5 minutes before the end. Quiet while you are in a meeting.
- **Running late? Let them know in one click.** A ready-made email to the attendees, from your own mailbox. You reread it, you send it.
- **See where your time goes.** Habits, screen time, meetings and emails, day by day, with streaks and records.
- **Make the koala yours.** Swap it for your own images or animated GIFs (up to 18), and write your own habits and quotes.
- **And sometimes, the cats chat.** For no reason at all. From 5 pm, it reminds you, a little more firmly each hour, that it's time to stop.

> **A free Infomaniak *my kSuite* account is all you need** for the advanced features: its Calendar and Mail unlock meeting reminders, attendee emails and meeting and email stats. **Calendar and email work with Infomaniak only.** They are not compatible with Google Calendar, Gmail or Microsoft Outlook. Everything else, breaks, quotes, statistics and passing animals, works for everyone.

**Your data stays yours.** No account, no Koala Zen server, no tracking. Everything stays in your browser, and a backup is a file you export yourself. The optional Infomaniak features use your own tokens, each limited to a single use and encrypted on your device.

**New in 2.2:** meeting reminders and attendee emails with Infomaniak, time in meetings and emails in the stats, a dark mode, a short guided tour, redrawn koalas and cats, evening and weekend rounds, and a full security review. See the [changelog](CHANGELOG.md).

---

## Overview

The koala nudges you to do your habit, keeps you on time for your meetings, and shows you where your time goes. Everything is tuned from one panel.

<table>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-1-nudge-en.png" alt="Move a little. No guilt." width="410"><br><sub><b>Move a little. No guilt.</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-2-meetings-en.png" alt="Never miss a meeting again" width="410"><br><sub><b>Never miss a meeting again</b></sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-3-warn-en.png" alt="Running late? Let them know." width="410"><br><sub><b>Running late? Let them know.</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-4-stats-en.png" alt="See where your time goes" width="410"><br><sub><b>See where your time goes</b></sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-5-cats-en.png" alt="And sometimes, the cats chat" width="410"><br><sub><b>And sometimes, the cats chat</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-6-ksuite-en.png" alt="A free Infomaniak my kSuite account is all you need" width="410"><br><sub><b>A free Infomaniak my kSuite account is all you need</b></sub></td>
  </tr>
</table>

---

## Installation

Koala Zen works on **Chrome and Firefox**. Pick your browser below. The ready-to-use packages are in the [`download/`](download) folder. The `.xpi` in `download/` is already **signed by Mozilla**, ready to install directly.

### Chrome, Edge, Brave (the simplest, about a minute)
The extension isn't on the Chrome Web Store yet, so you add it by hand. It stays installed across restarts, just leave developer mode on.
1. Download [`download/koala-zen-chrome.zip`](download/koala-zen-chrome.zip) and unzip it.
2. In Chrome, type `chrome://extensions` in the address bar and press Enter.
3. Turn on **Developer mode** (the switch in the top-right corner).
4. Click **Load unpacked**, then pick the unzipped folder (the one that contains `manifest.json`).

The koala icon appears in your toolbar. Click it to open the settings.

### Firefox
Koala Zen is **live on addons.mozilla.org**, install it in one click:

👉 https://addons.mozilla.org/en-US/firefox/addon/koala-zen/

**Alternative, install the `.xpi` from this repo directly**
[`download/koala-zen-firefox.xpi`](download/koala-zen-firefox.xpi) is the same Mozilla-signed build as the store listing above.
1. Open `about:addons`, click the gear icon, then **Install Add-on From File**, and pick [`download/koala-zen-firefox.xpi`](download/koala-zen-firefox.xpi) (you can also drag the file onto the Firefox window).
2. Confirm. Because the file is signed, it stays installed across restarts.

**Try it without installing (temporary)**
The extension disappears when you close Firefox.
1. Type `about:debugging#/runtime/this-firefox` in the address bar.
2. Click **Load Temporary Add-on** and pick the `.xpi`.

**If you modified the code, sign your own build (free)**
The provided signature only covers the unmodified file above, so a build you changed needs its own. It all happens in the browser, no command line. You submit it to AMO as a **private distribution**: Mozilla signs it for your own use, with no public page.
1. Create a free Firefox account at https://accounts.firefox.com, then open the developer dashboard: https://addons.mozilla.org/en-US/developers/
2. **Set your own add-on ID.** Open `manifest.json`, find `"id": "koala-zen@public.extension"` and replace it with an ID of your own, for example `"id": "koala-zen@your-name"`. The original ID is reserved for the public page. Then select **all the files inside the folder** (not the folder itself) and compress them into a `.zip`.
3. Click **Submit a New Add-on**, choose **On your own** (private, unlisted), upload your `.zip`, and Mozilla offers a **signed** `.xpi` to download.
4. Install that signed `.xpi` the same way as above.

Not comfortable with these steps? An AI like **Euria by Infomaniak** can walk you through them. Paste it the instructions above and describe where you're stuck.

---

## Signing with the command-line API (alternative)
*For people comfortable with a terminal who prefer to automate the signing. The result is the same as the recommended method above: a `.xpi` signed for private use. It is more technical, so each step is spelled out.*

Your API credentials never go inside the extension. They are used only by the `web-ext sign` command, on your machine.

1. **Set your own add-on ID**, as in step 2 of the recommended method: in `manifest.json`, replace `"id": "koala-zen@public.extension"` with your own.
2. Create an API key at https://addons.mozilla.org/developers/addon/api/key/. Mozilla gives you **two** values:
   - a **JWT issuer**, the "API key" (it looks like `user:12345:678`).
   - a **JWT secret**, a long random string shown **only once**, at creation. Copy it right away. If you lose it, generate a new key.
3. Install the tool: `npm install -g web-ext`
4. From the project folder (the one with `manifest.json`), run **one** of:
   ```bash
   web-ext sign --channel=unlisted --api-key=YOUR_ISSUER --api-secret=YOUR_SECRET
   ```
   or, to keep the values out of the command line:
   ```bash
   export WEB_EXT_API_KEY="YOUR_ISSUER"
   export WEB_EXT_API_SECRET="YOUR_SECRET"
   web-ext sign --channel=unlisted
   ```
   `--channel=unlisted` means private distribution, not listed in the public gallery.
5. The signed `.xpi` lands in `web-ext-artifacts/`. Install it as in step 6 of the recommended method (drag it into a Firefox window, or `about:addons` then **Install Add-on From File**). It stays installed across restarts.

> **Keep these two values private.** Never commit them to Git or place them in any project file. The included `.gitignore` already excludes `web-ext-artifacts/`.

Need help with a step? Here too, an AI like **Euria by Infomaniak** can get you unstuck.

*Alternative without a Mozilla account (Firefox Developer Edition or ESR only):* set `xpinstall.signatures.required` to `false` in `about:config`, then open the `.xpi`. This switch is ignored on regular Firefox.

---

## First launch
A four-step tour opens on install and can be replayed from the link under the version number: your first habit, **What you get** (the benefits), **Connect your calendar** (optional, a token limited to the single `workspace:calendar` scope, in three numbered steps: create it in the Manager, tick this scope only, paste it; then the calendars to watch), and **Your data stays with you** (no account, no Koala Zen server, everything stays on this device, your tokens are encrypted and each limited to one use, and a backup is a file you export from Data). The mail token is not asked here; it is added later in the calendar card if you turn on the mail features. Each step has its own illustration, with the reminder koala waving on the welcome screen. Back and Skip sit at the top, the main button stays at the bottom, and the popup keeps the same height from one step to the next.

## Plugin settings
**Everything in Koala Zen is customizable.** Click the koala icon in the toolbar to open the panel. The header shows when the next visit is due, and there are four tabs: **Settings** (how and when the koala shows up), **Custom** (what it shows), **Stats** (your progress) and **Data** (backup and erasing).

**Settings** tab, in order:
- **Pause**: postpone the next appearance (**Later**), pause for **1 hour**, or stop for **today**. A **Resume** button cancels the pause at any time, and your streak stays intact while paused.
- **Reminder rhythm**: pick **Pomodoro** (25 min), **Deep work** (52 min), **Ultradian** (90 min), or **Custom** and set the interval yourself with the slider (5 to 240 minutes, in steps of five).
- **Focus break** (off by default): the page is dimmed for the length of the break, so you really do stop. You choose the duration.
- **Passing animals** (on by default): a cat walks across the page to say hello and leaves. It asks nothing and counts for nothing. Sometimes two cats, or a cat and a fox, cross paths and greet each other in turn. At most one every two hours, four a day, only between 8am and 8pm, and never during a call, a pause or a focus break. **Evening rounds** (new in 2.2): on top of those free visits, a cat walks by at 5, 6, 7, 8 and 9 pm to suggest, with a smile and a little more firmly each hour, that it is time to think about stopping work. One per hour, never repeated, and they obey the same do-not-disturb rules; a round missed at the hour (no web page in front, keyboard left) is retried for twenty minutes, then dropped. The cats and the fox were also redrawn, with rounder heads, expressive eyes, blinking, twitching ears and a wagging tail. On Saturdays and Sundays the passing cat switches to its weekend lines: it wonders why you are working, and salutes it as something original, in the same teasing tone.
- **The heads-up before a call** (follows the same setting as passing animals): two seconds after landing on one of the listed videoconference pages, the cat walks by once with a teasing line about the meeting that is about to start.
- **Do not disturb**: **during a video call** (the koala never appears on the listed sites, by default `kmeet.infomaniak.com`, `teams.microsoft.com`, `teams.live.com`, `zoom.us`, `meet.google.com`, and subdomains are covered, so `zoom.us` also covers `us02web.zoom.us`), **when you leave the keyboard**, and **during a meeting in your Infomaniak Calendar** (off by default). The connection itself lives in its own card, **Infomaniak Calendar**, right below: connect with an Infomaniak token limited to the single `workspace:calendar` scope (a token that also opens email or kDrive is refused, see Privacy), then **tick the calendars to watch**, one or several (work and personal), among the ones you can read, yours first with the default one marked. Their events are merged, an event present in two calendars counts once. The card then shows the watched calendars and the next meeting. Back in Do not disturb, turn the switch on and, from then on, any event with two people or more, you included and not declined (full-day events and events marked free are ignored), silences passing animals for its whole duration, and the header reads "Quiet, meeting in progress". A habit reminder that would fall during such a meeting, or less than ten minutes before one, is not dropped but **moved to the first free slot of at least ten minutes**, one minute after it opens (a run of back-to-back meetings is skipped as a whole; with no slot within six hours the reminder is skipped). The same connection also feeds the **time in meetings** figure of the Stats tab: meetings with two people or more, you included and not declined, counted per day, with the last 90 days read once when you pick the calendar. A second switch in the calendar card, **3 min before the start**, works on its own, with or without the silence: three minutes before each such event it shows a bubble on the page, in blue with a calendar tag so that it is never mistaken for a habit reminder, with a live countdown, a **Join the call** button when it has a video link and a **Close** button, or a system notification when no web page is in front. The bubble never goes away on its own: it stays, counting down and then counting the minutes since the start, until you close it. Neither heads-up appears while the computer is asleep, locked or untouched for ten minutes; the extension checks again a minute later and shows it only if the meeting has not started yet. A third switch, **5 min before the end**, does the same five minutes before the end, in amber, so that you finish on time. Unlike the quiet and the start heads-up, it covers **every timed event** of the calendar, including the ones you are alone in (a focus block, a personal appointment); only full-day events and invitations you declined are left out.
- **Notify attendees by email** (new in 2.2, off by default): a fourth switch in the calendar card. It needs a **second token, limited to the single `workspace:mail` scope**, which the card asks for when you turn it on (a token that also opens the calendar or kDrive is refused); the calendar token keeps reading the attendees, the mail token only sends. You then pick the **sending address** among your mailboxes and their aliases. From then on the blue start bubble shows a **Notify** button, and so does the calendar card when a meeting starts within the hour or is running. It opens a small panel: three ready messages (5 minutes late, 10 minutes late, absent), the attendees as removable chips with the organizer first and you excluded, the subject, and the full text to reread and edit. One **Send** button, nothing leaves before you click it, each message can be sent once per meeting, at most six emails per hour, and a confirmation tells you how many people got it. Attendee addresses are fetched when you open the panel and never stored. **Change calendar** and **Disconnect calendar** are one click away.
- **Screen time**: choose the time zone that defines your day for the counter shown in the bubbles. Europe/Zurich by default, or **Automatic (browser)**.

At the bottom, **Bring the koala** triggers an immediate appearance, handy for testing, and it ignores the video-call pause. The version and last-update date are shown discreetly underneath.

**Custom** tab, in order:
- **Goals**: your habit prompts. Add them one by one, remove with ×, and drag the handle to reorder. They come up one at a time, in your order. Leave the list empty to use the bundled goals. Underneath, **your daily target** sets the number of habits you aim for each day, and it drives the marks in the reminder and the dashed line in the statistics. Once the target is reached the line turns green, and every habit beyond it adds a gold mark and reads, for instance, "5 of 3 today, +2 bonus", so the extra effort is counted rather than hidden behind a full bar.
- **Quotes**: switch between **Yours** and **Bundled**. Add your own as "Text | Author" (the author is optional). **Browse the bundled ones** opens a full list where you can search, **hide** a quote so the koala stops saying it, or **edit** one, which creates your own version and leaves the original untouched.
- **Characters**: by default, two koalas drawn by hand as busts, the face first, with real koala ears (a soft furry rim and a pale downy inside): one announces the reminders and waves on arrival, one shares the quote with half-closed eyes and a blade of grass in the corner of its mouth. They blink and twitch their ears in turn. Add your own PNG or animated GIF files (a transparent background works best). They replace the bundled koalas unless you tick **Keep the bundled koalas**. Click × to remove one. Static images are resized to save space, and everything stays on your device.
- **Theme** (new in 2.2): **Automatic** follows your system's light or dark mode, or force **Light** or **Dark**. Applies to the panel; the bubbles on web pages keep their own colors.
- **Animations**: **Automatic** follows your system's reduced-motion setting, or force them **Always** or **Never**.

Click **Save** on either tab after a change.

**Stats** tab. Pick a period (today, yesterday, this or last week, this or last month, since you started) and read four figures, each with a line of context: habits done compared with the previous period, habits postponed with the time of day you postpone most, and screen time with a daily average, plus, once an Infomaniak calendar is connected, your **time in meetings** with the number of meetings (and meetings per week over two weeks or more). Overlapping meetings, and the same meeting seen in two watched calendars, count once. With **Count my emails** on (calendar card, it uses the same mailbox as Notify attendees), two more tiles show **emails handled** (read or deleted, with how many were deleted and received) and **emails sent** with a daily average; only the counts are read, never a sender, subject or content. Below, a per-day chart for habits (done and postponed side by side) with your daily target as a dashed line, a per-day chart for screen time, a per-day chart for time in meetings when there is any, a per-day chart of emails handled and sent when they are counted, and under screen time a cadence line (one habit for so much screen time). All four charts share the same height and header, with a legend whenever they show two series. Over three weeks or more, a line under the meetings chart and one under the emails chart name your **busiest weekday** (the highest average, never a total), or say the load is spread when no day stands out by 15 % or more. Then your current streak as a progress bar toward your record. The wording adapts to your own data, so it never claims a link that is not there. On the very first run, the tab shows what will appear and when instead of a wall of zeros.

**Data** tab:
- **Backup and restore**: one card, one destination, a **local file**. Tick the parts you want (settings, goals and quotes, statistics, imported characters, each with its weight, and **Infomaniak connections**: your calendar and mail tokens with the chosen calendars and sending address, off by default) and choose **merge** or **replace** for restoring. **Export** writes a `.json` file, **Import** brings it back. Nothing is sent anywhere, and there is no automatic backup: exporting is up to you. The connections are encrypted with a passphrase of **at least 12 characters** that you type at export and again at restore, and that is never stored; a live counter tells you how many characters are still missing. The tokens are protected by PBKDF2-SHA256 with 600,000 iterations, then AES-GCM 256. A file made before 2026-09-29 restores its connection settings but never its tokens (they had too many rights): paste new single-scope tokens afterwards. *(Until 2026-09-29 this card also offered a kDrive backup and a daily automatic kDrive backup; both are gone.)*
- **What Koala Zen takes up**: a gauge splitting your storage between characters, history and content.
- **Everything stays with you**: no Koala Zen server, your data stays on this device, and the backup is a file you keep.
- **Erase**: the history alone, or everything including settings, content and the connections (erasing everything also deletes the tokens' encryption key). Both ask for a second click to confirm, so export first.

The koala appears on the active web page, not on the browser's internal pages (`chrome://`, `about:`…), which don't allow extensions.

---

## Build the packages from source (optional)
The already-built packages are in [`download/`](download). Rebuild them only if you change the code. One script regenerates both, in `dist/`:
```bash
bash build.sh
```
- `dist/koala-zen-chrome.zip` for Chrome, Edge, Brave or the Chrome Web Store.
- `dist/koala-zen-firefox.xpi` for Firefox and addons.mozilla.org, with zero validator errors, warnings, or notices.

The committed `manifest.json` targets both engines. For Firefox the script drops the Chrome-only `service_worker` key and sets the minimum versions that understand `data_collection_permissions`, which keeps the AMO report clean. The `dist/` folder is git-ignored.

---

## Customisation in the code
- **Default quotes and prompts** live in `quotes.js` (`KZ_QUOTES` = `{ t, a }`, `KZ_SPORT` = the default habit prompts). Most people can just use the settings above.
- **Default characters**: the two koalas are drawn in SVG in `KOALA_SVGS` at the top of `content.js`, one for the reminder (it waves), one for the quote (blade of grass, half-closed eyes). Ears, eyes and the waving paw carry classes the CSS animates. Edit the markup there; no image file is involved.
- **Reminder timings**: the `T` object at the top of `content.js` holds every duration of the choreography, in milliseconds.
- **Default video-call sites**: `DEFAULTS.mutedPatterns` in `background.js` and `popup.js`.

Reload the extension after editing any file.

## Project structure
```
manifest.json     extension manifest (Manifest V3, Chrome + Firefox)
background.js     service worker: schedules reminders, applies the video-call pause,
                  tracks daily active screen time and the daily statistics,
                  talks to the Infomaniak Calendar API for the optional meeting silence
                  and to the Infomaniak Mail API for the optional mail features
content.js        draws the koala, the bubbles and the reminder choreography
passages.js       the passing-animals scenes (cats, and occasional cat/fox meetings)
quotes.js         the default quotes, habit prompts and passing-animal lines
popup.html/js     the four-tab panel: Settings, Custom, Stats, Data
build.sh          builds the Chrome (.zip) and Firefox (.xpi) packages
download/         ready-to-install packages (Chrome .zip, Firefox .xpi)
images/           the welcome koala of the onboarding (SVG, animated and still)
icons/            toolbar icons
store-assets/     screenshots in 3 languages and the GitHub social preview
```

## Privacy
By default, nothing leaves your browser. Your settings, your goals and quotes, your statistics and any images you add are stored locally with the browser's storage API. Backup is a file you export and import yourself from the Data tab. No account, no Koala Zen server, no analytics, no tracking. Nothing is ever uploaded to a cloud.

Only two **optional** features reach the network, both towards your own Infomaniak account, with your own tokens, and only once you turn them on:
- The **Infomaniak Calendar** connection (Settings tab, Infomaniak Calendar card), with a token limited to the single `workspace:calendar` scope. While it is on, Koala Zen reads the events of the calendars you ticked, from 12 hours back to 36 hours ahead, every five minutes, through `api.infomaniak.com` only. It keeps locally nothing but the start, end, title, attendee count and video link of the events that qualify as meetings, plus a per-day count of minutes in meetings for the Stats tab, so that it can stay quiet and warn you, and it never sends any of it anywhere. Turning the switch off or disconnecting clears that cache. The `notifications` permission serves one purpose, the three-minute heads-up when no web page is in front to show the bubble.
- The **mail features**, **Notify attendees by email** and **Count my emails**, with a second token limited to the single `workspace:mail` scope, through `mail.infomaniak.com` (and `api.infomaniak.com` for your address's signature). Warn creates a draft in your own mailbox and sends it only when you click Send, only to the attendees you kept, and keeps nothing of them afterwards. Count my emails reads only the number of messages per day, never a sender, subject or content.

**Your tokens.** Create one token per use in the Infomaniak Manager, each with a single scope (`workspace:calendar` or `workspace:mail`) and an expiry date. Koala Zen refuses a token that opens more than it needs, keeps tokens encrypted on your device, uses them only for what its features need, and never shows them to web pages. They leave your device only inside a backup file you export, if you choose to include them, encrypted with your passphrase. To cut access at once, revoke the token in the Manager, or use **Erase everything** in the Data tab. Like any browser extension, Koala Zen cannot protect your tokens from malicious software already installed on your computer.

**Security.** The bubbles shown on web pages are kept apart from the site, nothing is sent without a real click from you, and an email can only go to the meeting's attendees. Found a security issue? Please report it privately, see [SECURITY.md](SECURITY.md), not in a public issue.

## License
MIT. See [LICENSE](LICENSE).
