# Changelog

## 2.3.0

### New
- **Habit reminders can be turned off** with one switch at the top of their card: keep only your calendar reminders. Everything that only serves them (focus break, habits, quotes, habit stats and streak) is then hidden, with a note to turn them back on.
- **Quotes can be turned off.**
- **A new welcome tour:** pick what helps you (habit reminders, Infomaniak Calendar and Mail, passing animals, characters), then only the screens you need, and preview the bubble before you start. Replay it any time, it starts from your current settings.
- **One token for calendar and mail:** a single Infomaniak token with both scopes now works for both. Separate tokens still work. Any other scope is still refused.
- **Mail in the welcome tour:** connect it with your calendar, pick your address, and choose between notifying attendees and counting your emails. A "Your calendar" screen lists all your calendars, with the ones you watch ticked, and sets its reminders.
- **Clearer settings:** focus break now sits with habit reminders, Pause says what it stops, and your habit list is called Habits. When a feature is off, its options fold away and only its switch remains.
- **Readable monthly charts:** full dates on the axis, wider bars, and two series drawn one in front of the other.
- **Clearer stats for each period:** totals named after the period, monthly charts titled per month, averages over the days you actually used, best streaks with their dates, and the selected period stands out in dark mode.
- **Email stats catch up on the last 31 days**, so a full month fills in.
- **Motion that helps:** a ring around the koala fills up until its next visit, options fade with their switch, the end of the tour confirms with a drawn check, and charts rise once instead of on every change. All of it follows the Animations setting.
- **Accessibility:** switches show keyboard focus and are easier to see, small links and buttons are easier to hit, and animations now follow your system's reduced-motion setting by default.
- **Professional style:** turn characters off for neutral bubbles: a discreet label, ink text, a simple confirmation, no quotes and no celebration.
- **One bubble at a time, and it follows you:** switch tabs or windows and the waiting reminder moves with you, instead of piling up in every window.
- **Choose which cats drop by:** during the day, in the evening from 5 pm, or when a video call starts. Each one has its own switch.
- **A last call 20 seconds before a meeting:** a large red banner at the top of the page counts down, even if you closed the 5-minute bubble, and slips away on its own 3 seconds before the start. A 5-minute bubble you forgot to close leaves when it appears. It follows you if you switch tabs, and it no longer shows up late or leaves too early when the browser is slow to wake.
- **Meeting reminders reach you outside the browser:** when another app is in front, the start reminder, the red last call and the end reminder also arrive as system notifications, which stay until you close them.
- **Under the hood:** the background code is split into one file per area, and meeting decisions now live in a single record per meeting. Nothing changes for you.
- **In-person meetings:** for a meeting in a room with no video link, the start reminder comes 10 minutes before, to give you time to get there.
- **Your week:** a weekly report in Stats (habits, screen time, meetings, including those taken out, finished early or joined late, and emails). Turn it on to receive it every Monday at 8 am, by email from your mailbox to one of its own addresses: a readable page with each topic compared with the week before and the highlights of your week.
- **Try a meeting:** a button in the Calendar card plays the whole sequence in 3 minutes on a test meeting, without touching your stats.
- **A discreet meeting bar:** close a meeting bubble while the meeting is on, and a small bar stays at the bottom of the page with the time left, **Finish** (the meeting then counts only until your click) and **Didn't happen**.
- **Running late?** After you tell attendees, the bubble closes and the red last call moves to your announced arrival time.
- **Reminders keep up with you:** joining from the bubble, a meeting cancelled or moved in your calendar, or one you took out of your stats no longer leaves a red last call, a bubble or a system notification behind. System notifications also leave once the meeting has started or ended.
- **The room is shown** in meeting reminders and in the red last call: the booked room, or the location you typed.
- **The end bubble turns red** for the last 2 minutes of a meeting.
- **"Won't happen" and "Didn't happen":** one click in the start or end bubble takes the meeting out of your stats, then the bubble closes on its own. Telling attendees you will be absent does the same, and closes the bubble too. Either way, the koala no longer stays quiet for that meeting and its remaining reminders are cancelled.
- These new switches apply as soon as you click them.

### Fixed
- **Meeting reminders now come 5 minutes before the start**, instead of 3.
- **Back-to-back meetings no longer lose their start reminder.** When one meeting ended as the next began, both reminders rang at the same second and the end one could replace the start one. The end reminder now comes 6 minutes before the end, and never replaces the reminder of a meeting that has not started yet: it then shows as a system notification.
- The calendar reminder before the start now covers every timed event, not only meetings with attendees, including events with no duration and long calendars.
- A meeting reminder now takes priority over a waiting habit reminder, which comes back once you close it.
- Clicking Close in a bubble no longer closes a window open on the page, such as a Trello card.
- The Calendar card shows your next event, whatever it is. With habit reminders off, focus pause is greyed out.
- Yearly stats no longer divide screen time by 365 days, including days still to come.
- In dark mode, unticked addresses and calendars no longer show a faint check mark.
- Replaying the welcome tour no longer adds the sample habit again or replaces a custom reminder interval you did not touch.
- In the welcome tour, a calendar connected then switched off no longer stays on, and a calendar connected before closing the popup is shown as connected when you come back.

## 2.2.0

### New
- **Meeting reminders** with Infomaniak Calendar: a bubble 3 minutes before, a heads-up 5 minutes before the end, and quiet during your meetings.
- **Notify attendees** with Infomaniak Mail: a ready-made email when you are late or absent, reviewed before sending.
- **Stats:** time in meetings, emails handled and sent, your busiest day.
- **Dark mode**, a **short guided tour**, **redrawn koalas and cats**, and **evening rounds** from 5 pm.
- Habits beyond your daily target count as a bonus.

### Changed
- Calendar and email work with Infomaniak only. A free *my kSuite* account is enough.
- Backups are now a file you export and import yourself. The kDrive backup is gone.
- The energy question was removed.
- The koala always appears above the page.

### Security
- One token per use, each limited to a single scope.
- Stronger protection of your tokens and data.

### After updating
- Paste your Infomaniak tokens again, one per use.
- If you used the kDrive backup, export a backup file from the Data tab.

## 2.1 and earlier
Break reminders, habit goals, quotes, passing animals, statistics, custom rhythms and characters.
