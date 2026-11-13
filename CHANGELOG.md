# Changelog

## 1.13.0

- With time grid "every quarter hour", typed times now stay exact to the minute (e.g. time clock entries from the office). The "now" buttons and the timer still round to the quarter hour, the time fields still offer the 15-minute list.
- Fix: in browser time fields (time grid "to the minute") the entry was saved and redrawn after the hour already. The cursor did not move on to the minutes, and typing 45 turned into 04. Times are now applied when leaving the field or with Enter.
- Moving to the next field while the previous one is being saved keeps the cursor and anything already typed there.

## 1.12.2

- Online: confirming a new e-mail address now takes a click on "Confirm address" instead of happening as soon as the page opens. Link scanners in company mail filters open links in advance and could otherwise use up the link.
- Online, operators: new command `change-email <old> <new>` changes an account's address directly, without a confirmation link (for addresses that do not receive mails from Taktbuch). Open confirmation and password links become invalid, signed-in devices stay signed in.

## 1.12.1

- The project moved to github.com/nullpointer-ruhr/Taktbuch. The update check now uses the new address (the old one still forwards).
- Fix: with a start date in the current week or in the future (typical for a new account), Today, Week and Calendar did not open. Days before the start date show a note that they are not counted.
- Cut-off dates for vacation expiry and time-balance cap are entered and shown as day.month (e.g. 01.05.) instead of MM-DD. Values accidentally saved as day.month are converted automatically.

## 1.12.0

- Choose color and appearance under Settings → General → Display: light, dark or automatic, and eight accent colors (orange, blue, teal, green, dark green, purple, red, graphite). Every color is checked for readable contrast in light and dark.
- Fix: in the dark theme the description on highlighted buttons (e.g. template choice) is readable again.

## 1.11.4

- Fix: the Settings tab was cut off behind the time account display in the header. The header is now two rows at every width, tabs in their own row.
- "What's new" after an update lists up to six skipped versions (before: three).

## 1.11.3

- Fix: the address of "Report a problem / send a request" was wrong (`pn.me`), now `Taktbuch@pm.me`.

## 1.11.2

- Correction to 1.11.1: Time off in lieu is not a day off from work in this sense and calculates as before. Only Vacation, Special leave and Company closed ignore entered times.

## 1.11.1

- Fix (GitHub issue #17): on weekdays marked Vacation, Special leave or Company closed, entered start and end times are ignored (nobody works on a day off). They no longer change the time account; the day card says so. Weekends are unchanged. Note: old days with times on such a day now count as 0 hours.

## 1.11.0

- **Help** (GitHub issue #14): button "Help" at the top right opens the manual inside the app (German and English, works offline). The same text is generated as `docs/HILFE.md` and `docs/HELP.md` by `build.py` from `src/help.json`.
- **What's new after an update** (GitHub issue #15): the first start after an update shows a short overview of the user-facing changes (source: `src/whatsnew.json`, one entry per release in both languages). It is shown once and is also part of the help. First start without data shows nothing.
- The tab **Vacation** is now called **Calendar** (GitHub issue #16). Internal keys and stored data are unchanged.
- Fix (GitHub issue #18): the weekly total (Week tab and Today card) now counts half vacation days (24.12. and 31.12.) like the time account: the half target only applies if you work that day, and the hours worked count as actual. Before, a half day without work showed a false minus and hours entered did not correct it.
- Notice on the day (GitHub issue #17) when times are entered on a day off.

## 1.10.0

- **Settings are split into sub-menus** (GitHub issue #7): Working time, Vacation and account, Salary, Recording, General, Data. The rule changes, the job change wizard and the starting values live under "Vacation and account".
- **Automatic break is configurable** (GitHub issue #8), as a rule with a valid-from date: statutory scale, fixed break from a minimum presence (e.g. 1 hour from 6 h), or no automatic break. Manual breaks per day still win. Earlier days keep the old rule.
- **Automatic backup** (GitHub issue #10): under Settings, Data, choose a folder (Chrome or Edge). Taktbuch writes one JSON backup per day or week there and keeps the latest ones (default 10, other files are left alone). After a browser restart the browser may ask once for permission, a banner then offers to confirm. Without folder access (other browsers) Taktbuch reminds you weekly to save a backup.
- **Business trip: customer and place** (GitHub issue #11): on business trip days two fields replace the office/home office choice. Names are editable and each field can be hidden. Period tool, calendar label and a yearly table in Reports (days per customer and place).

## 1.9.0

- **The app is now called Taktbuch** (formerly Zeitwerk). Your data stays: nothing about storage changed, just update in place as usual and keep the file name and location. Save a JSON backup before updating, as always. The repository moved to `taktbuch`, old links keep working.
- New button **Report a problem / send a request** under Settings, Data. It opens your mail program with prefilled text (version, browser, language, active switches). Nothing is sent automatically and no data from the app is included. (GitHub issue #9)

## 1.8.2

- Update check: runs on start and whenever you return to the tab, at most once an hour (before: once a day, and only at start). New releases show up much sooner and in tabs that stay open for days.

## 1.8.1

- Split work location days can start with home office: choose "office first" or "home office first" plus the switch time.
- Fix: after "Add" in activities, Category, Type and System are no longer carried over from the previous entry. This also restores the automatic fill of these fields from an earlier entry with the same Topic.

## 1.8.0

- **Work location** (GitHub issue #6): per day Office, Home office or split (office before a time, home office after). Default location and fixed home office weekdays in Settings, a period tool in the Month view, and a yearly table in Reports (days and hours per month, business trips separate). A plain count, no tax calculation. Off by default.
- **Overtime payout** (GitHub issue #5): field "Overtime payout (h)" on the day, reduces the time account and is summed per year in Reports. Off by default.

## 1.7.0

- New **Job change** wizard in Settings. Asks for the first day in the new job, vacation days per year, vacation days until year end, starting time account, starting long-term account and target hours. The old job counts pro rata in half months (1st to 15th = half a month), rounded up to half days. On the change date remaining vacation, time account and long-term account are reset to the entered values; everything before stays unchanged. Expiry, cap and 24.12./31.12. are copied from the previous rules and editable in the new entry. Dated rule changes from 1.6.0 stay for changes within the same job.

## 1.6.0

- Settings (GitHub issue #4): **Vacation days per year, 24.12./31.12., expiry date, days into the long-term account, and cap (date and balance after cap) now apply from a date.** Add a "rule change" with a "Valid from" date; earlier periods keep their old rules. The cap can be switched off per rule. "Expiry applies from year" is replaced by this: existing settings are converted automatically.
- Payday dropdown reordered: start of month, end of month, middle of month, 4th last working day. The old "Mon to Fri" variant only shows if it was already selected.
- Activity column names are laid out in one row.

## 1.5.0

- New day type **Business trip** (Dienstreise), next to Vacation and Time off in lieu (GitHub issue #3). It is only a marker in the calendar, vacation planner and day view: the day is calculated exactly like a normal working day, so hours, target and balance are unaffected. Its own colour in the calendars.

## 1.4.6

- Fix (quarter-hour mode): typing into the time text fields no longer inserts a leading `0` or `:00` while typing (GitHub issue #2). The value is normalised when you leave the field.

## 1.4.5

- Quarter-hour mode: the same text-field-with-dropdown applies to Break, Absence and Interruption: text field with a dropdown (00:00 to 08:00 in 15-minute steps). For these, `30` means 30 minutes.

## 1.4.4

- Quarter-hour mode: Arrive, Leave, From and To are now text fields with a dropdown listing the whole day in 15-minute steps (the browser's own time picker cannot be limited to quarter hours). Typing works too: `9`, `930`, `09:30` all become 09:30, rounded to the nearest quarter hour.

## 1.4.3

- The **Install** button now verifies the written file and restores the previous version if the result is incomplete (a 0 KB file after installing was reported).

## 1.4.2

- Fix (quarter-hour mode): typing an hour no longer resets the minutes to 00. Times are rounded when you leave the field, not while typing.

## 1.4.1

- Quarter-hour mode: the time fields (arrive, leave, from, to) now show a list of all quarter hours as a dropdown. Before, only the browser’s own minute picker appeared.

## 1.4.0

- Activity columns (Category, Type, System, Project number, Topic) have their own names and the first four can be shown or hidden under Settings. Hidden columns keep their values. Applies to the activity tables, filters, reports and CSV export.
- New optional column **Project number** (hidden by default), with filter and a grouping in Reports.
- Excel import now recognises the activity columns by their headers instead of by position, imports the project number, adopts custom headers as column names and tells you which columns were filled. If a column contains almost only one value, the import report suggests hiding it.
- Header: the tab row wraps below the title on screens up to 1360 px so that no tab is cut off.

## 1.3.1

- Fix: the **Install** button in the update banner failed with “Failed to fetch” (GitHub release downloads are not readable from the browser). The installer now loads the build from the `dist` branch and asks for the target file first.

## 1.3.0

- New setting **Federal state** (Settings → Public holidays): holidays for all 16 German states or nationwide holidays only. Default stays North Rhine-Westphalia. Affects calendar, target hours, payday and vacation planning.

## 1.2.0

- The **Data** tab is now **Settings**, with *Data* (import, backup, version, reset) as a sub-section.
- New setting **Record times**: to the minute or every quarter hour. In quarter-hour mode time fields step by 15 minutes and typed times, “Arrive/Leave now” and the activity timer are rounded to the nearest quarter hour.
- Activity columns (Category, Type, System, Topic) can be renamed under Settings. Names apply to the activity tables, filters, reports and CSV export.

## 1.1.1

- The browser tab title is just “Zeitwerk”, the version is shown only under **Data**.
- New **Install** button in the update banner (Chrome/Edge): pick your existing zeitwerk.html and the new version is written over it, no stray copy in Downloads. Falls back to a normal download.
- If the update check fails (offline, blocked, no release yet), it retries after one hour instead of one day.

## 1.1.0

- The app is now available in English and German. Switch with DE / EN in the top right. The browser language is preselected on first start.
- README and changelog are in English, the German README is in `README.de.md`.

## 1.0.1

- The version number moved from the header to **Data**, section “Version”.
- Fields in the input rows (Today) are aligned and have the same height.

## 1.0.0

First version under the name Zeitwerk (formerly “Stundenkonto”, internally up to v14).

- One shared file for everyone. On first start you choose a template: with or without vacation expiry and cap. Existing data from earlier versions is detected.
- Update check: at most once a day the app asks GitHub for a new version and shows a banner with a download button.
- Time tracking, activities, reports, salary and vacation planning, all local in the browser.
- Excel import (hours Excel file with the sheets “ab 2020” or “Zeiterfassung”, “Tätigkeiten”, “Gehalt”).
- Selectable payday: 4th last working day, 15th, first or last working day of the month.
- Flexible salary raise: month, percent or amount in euro.
- MIR column (staff canteen) can be hidden.
- Dec 24 and Dec 31 as half vacation days (configurable).
