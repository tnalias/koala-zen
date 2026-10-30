<p align="center">
  <img src="icons/icon-128.png" width="88" height="88" alt="Koala Zen">
</p>

# Koala Zen

> **English** · [Français](README.fr.md)

**A friendly koala for your workday.** It reminds you to take small breaks, keeps you on time for your meetings, and shows you where your time goes. For **Chrome and Firefox**, free and open source.

- **A gentle nudge, never a guilt trip.** Every 5 to 240 minutes, a koala suggests one small thing: stand up, drink some water, look away from the screen. Never during a video call.
- **Never miss a meeting.** A bubble 5 minutes before, with the video link one click away, and a heads-up 5 minutes before the end.
- **Running late? Let them know in one click.** A ready-made email to the attendees. You reread it, you send it.
- **See where your time goes.** Habits, screen time, meetings and emails, day by day.
- **Make the koala yours.** Your own images or animated GIFs, your own habits and quotes. Or hide it for a sober, professional style.
- **And sometimes, the cats chat.** From 5 pm, they remind you it's time to stop.

> **A free Infomaniak *my kSuite* account is all you need** for the meeting and email features. They work **with Infomaniak only**, not with Google Calendar, Gmail or Microsoft Outlook. Everything else works for everyone.

**Your data stays yours.** No account, no Koala Zen server, no tracking.

<table>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-1-nudge-en.png" alt="Move a little. No guilt." width="410"></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-2-meetings-en.png" alt="Never miss a meeting again" width="410"></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-3-warn-en.png" alt="Running late? Let them know." width="410"></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-4-stats-en.png" alt="See where your time goes" width="410"></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-5-cats-en.png" alt="And sometimes, the cats chat" width="410"></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-6-ksuite-en.png" alt="A free Infomaniak my kSuite account is all you need" width="410"></td>
  </tr>
</table>

## Install

**Firefox:** one click on [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/koala-zen/).

**Chrome, Edge, Brave** (not on the Chrome Web Store yet):
1. Download [`koala-zen-chrome.zip`](download/koala-zen-chrome.zip) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.

## Get started

1. Follow the short tour that opens on install.
2. Pick your rhythm in **Settings**, and your habits in **Custom**.
3. Optional, with Infomaniak: in the Manager, create an API token ([how to](https://www.infomaniak.com/en/support/faq/2582/generate-and-manage-infomaniak-api-tokens)) with the `workspace:calendar` scope and an expiry date, then paste it in the **Infomaniak Calendar** card. For the email features, add `workspace:mail` to the same token, or create a second token with only that scope. Any other scope is refused.

## In the panel

- **Settings:** rhythm, pause, focus break, do not disturb, passing animals, and your Infomaniak calendar.
- **Custom:** habits and daily target, quotes, your own koala, theme.
- **Stats:** habits, screen time, meetings and emails, with your streak and record.
- **Data:** export or import a backup file, erase your data.

## Privacy

- Everything stays in your browser.
- The Infomaniak features are optional, use your own tokens, and talk only to Infomaniak. Nothing is sent without a click from you.
- To cut access at any time, revoke your token in the Infomaniak Manager.
- Found a security issue? Report it privately, see [SECURITY.md](SECURITY.md).

## Build from source

`bash build.sh` creates both packages in `dist/`.

## License

MIT, see [LICENSE](LICENSE). Changes in the [changelog](CHANGELOG.md).
