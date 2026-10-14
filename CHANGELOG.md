# Changelog

## 2.2.0

**A friendly koala for your workday:** breaks and habits, meetings on time, and a clear view of where your time goes.

### New
- **Meeting reminders with Infomaniak Calendar** (optional): quiet during your meetings, a blue bubble 3 minutes before with the video link one click away, and an amber bubble 5 minutes before the end. Habit reminders that fall during a meeting move to the next free slot.
- **Notify attendees by email** (optional, Infomaniak Mail): a ready-made "5 or 10 minutes late" or "absent" email to the attendees, from your own mailbox, reviewed before sending.
- **Statistics:** time in meetings and number of meetings, emails handled and sent, your busiest weekday, and harmonised per-day charts.
- **Dark mode**, following your system or set by hand.
- **A short guided tour** on first launch.
- **Redrawn characters:** two vector koalas (reminder and quote) and cuter passing cats and fox.
- **Evening rounds:** from 5 pm to 9 pm a cat walks by every hour to suggest it is time to stop; on weekends it wonders why you are working.
- **Habits beyond your daily goal** now count as a bonus.

### Changed
- **Calendar and email work with Infomaniak only**, and a free Infomaniak *my kSuite* account is all you need. They are not compatible with Google Calendar, Gmail or Microsoft Outlook.
- **kDrive backup removed.** Backup and restore now use a local file you export and import yourself, from the Data tab.
- **The energy question was removed**, including its statistics.
- The reminder bubble always appears above the page, even on sites with sticky players or bars.

### Security
- Two separate Infomaniak tokens, each limited to a single scope (`workspace:calendar`, `workspace:mail`); a token that opens more is refused.
- Tokens are encrypted with a non-extractable key; sensitive data lives in a store web pages cannot read.
- The extension only makes the eleven API calls it needs; anything else is refused before it leaves.
- Bubbles are isolated from the page's code; emails can only go to the meeting's attendees, once per message, within an hourly limit.
- Backup passphrases need at least 12 characters.

### After updating
- **Paste your Infomaniak tokens again**, one per use. Tokens from earlier versions had several scopes and are forgotten for your safety. Your calendars and mailbox stay selected.
- If you used the kDrive backup, export a backup file from the Data tab.

## Earlier versions
2.1 and before: break reminders, habit goals, quotes, passing animals, statistics, custom rhythms and characters. See the repository history for details.
