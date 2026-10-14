#!/usr/bin/env python3
# Regenere les textes des fiches a partir de textes_fiches.py :
#   - store-assets/mozilla-listing.md, sections 1 (resume) et 2 (description) ;
#   - store-assets/chrome-web-store.md, en entier.
#
#   python3 store-assets/generateur/fiches.py
import io
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
sys.path.insert(0, ICI)
from textes_fiches import RESUME, rendu  # noqa: E402


def mozilla():
    p = os.path.join(RACINE, "store-assets", "mozilla-listing.md")
    s = io.open(p, encoding="utf-8").read()
    a = s.index("## 1. Name & summary")
    b = s.index("## 3. Category")
    bloc = """## 1. Name & summary

**Name:** Koala Zen

**Summary, English** (max 250 characters):
> %s

**Résumé, Français** (max 250 caractères) :
> %s

**Zusammenfassung, Deutsch** (max. 250 Zeichen):
> %s

---

## 2. Description

Version 2.2.0, benefit-first, same text as the Chrome Web Store listing (both written from `store-assets/generateur/textes_fiches.py`). The calendar and email features are clearly marked as Infomaniak only.

### English
%s

### Français
%s

### Deutsch
%s

---

""" % (RESUME["en"], RESUME["fr"], RESUME["de"], rendu("en", "- "), rendu("fr", "- "), rendu("de", "- "))
    io.open(p, "w", encoding="utf-8").write(s[:a] + bloc + s[b:])


def chrome():
    desc = {l: json.load(io.open(os.path.join(RACINE, "_locales", l, "messages.json"), encoding="utf-8"))["extDesc"]["message"] for l in ("en", "fr", "de")}
    for l, v in desc.items():
        assert len(v) <= 132, (l, len(v))
    doc = """# Koala Zen, Chrome Web Store submission kit

Everything needed to fill in the listing on https://chrome.google.com/webstore/devconsole, version 2.2.0. The Chrome Web Store lets you localize the listing: fill English as the default language, then add French and German. Text source: `store-assets/generateur/textes_fiches.py`.

Upload `dist/koala-zen-chrome.zip` (built by `bash build.sh`, the same file as `download/koala-zen-chrome.zip`).

---

## 1. Store listing

**Name:** Koala Zen (comes from the manifest)

**Summary** (from the manifest, max 132 characters, already within the limit):

| Language | Summary | Length |
|---|---|---|
| English | %s | %d |
| Français | %s | %d |
| Deutsch | %s | %d |

**Category:** Lifestyle > Well-being (recommended, it is a break and habit companion). Good alternative: Productivity > Workflow & Planning.

**Language:** English (default), with French and German listings.

**Compatibility, stated in every language:** the calendar and email features work with Infomaniak only, not with Google Calendar, Gmail or Microsoft Outlook. Breaks, quotes, statistics and passing animals work for everyone.

### Detailed description, English
```
%s
```

### Description détaillée, Français
```
%s
```

### Ausführliche Beschreibung, Deutsch
```
%s
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
""" % (desc["en"], len(desc["en"]), desc["fr"], len(desc["fr"]), desc["de"], len(desc["de"]), rendu("en", "• "), rendu("fr", "• "), rendu("de", "• "))
    io.open(os.path.join(RACINE, "store-assets", "chrome-web-store.md"), "w", encoding="utf-8").write(doc)


if __name__ == "__main__":
    mozilla()
    chrome()
    print("fiches ok")
