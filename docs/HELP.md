# Taktbuch help

Taktbuch tracks your time account, vacation and activities. Everything stays in your browser, nothing is sent to a server. This help is part of the file and works offline.

## The day in brief

On **Today** you enter start and end. The break is deducted automatically until you enter one for the day yourself. The **time account** is the sum of all days: hours worked minus target.

- Vacation, public holiday, sick leave and time off in lieu do not change the account, because the day's target counts as met.
- Times entered on a vacation day (also special leave, company closed) are ignored. The app points this out on the day.
- Future days without times count as plan and do not burden the account.

## Activities and timer

Under **Activities** you log what you worked on: from to or duration, plus category, type, system, project number and topic. The timer starts an activity that keeps running until you stop it.

- When you enter a topic, category, type and system are suggested from the latest entry with the same topic (only empty fields are filled).
- After "Add" the fields are cleared.
- Which columns you see is set under Settings, Recording.

## Week and month

In the **week** you change times directly in the table. The weekly total works like the account: half vacation days (24 Dec and 31 Dec) only count with half the target if you work that day.

The **month** shows all days as a calendar. With the period tool you set several days at once to vacation, time off in lieu, business trip or a work location.


## Calendar: plan vacation and time off

In the **Calendar** pick a brush (vacation, half vacation, time off in lieu, business trip) and click or drag across days. A second click on a marked day removes it. At the top you see entitlement, taken, planned and remaining vacation, below it the course over the year.

- Expiry and carry-over to the long-term account follow the rules under Settings, Vacation and account.
- If the planning would make hours of the time account expire because of the cap, the calendar shows a warning.

## Reports and salary

**Reports** shows monthly and yearly tables, breakdowns by category, type and system and (if switched on) work location and business trips for your tax return. This is a plain count, not a tax calculation.

**Salary** shows the salary overview with pay rise and payday.


## Settings overview

- **Working time:** daily target (changes from a date), break rule, state for public holidays.
- **Vacation and account:** vacation days, 24 Dec and 31 Dec, expiry, long-term account, cap. Changes apply from a date, earlier periods keep their rules. The job change wizard starts here.
- **Salary:** inputs for the salary view and the payday.
- **Recording:** activity columns, work location, overtime payout, business trip (customer and place).
- **General:** display and rounding of times.
- **Data:** backup, restore, Excel import, automatic backup, version and updates.

## Job change

When you change jobs in the middle of a year, start the wizard under Settings, Vacation and account. It asks for the date, vacation days, vacation left until year end, starting values for account and long-term account and the new target. The old job counts pro rata in half months (1st to 15th = half a month), rounded up to half days. Everything before stays unchanged.


## Work location, payout and business trip

These are off by default and switched on under Settings, Recording. **Work location** counts office and home office per day, including split days (office first then home office or the other way round, with a switch time). **Payout** deducts paid-out overtime from the account. For a **business trip** you enter customer and place.


## Backup and updates

Your data lives only in this browser. Save a backup regularly under Settings, Data. In Chrome and Edge you can pick a folder there for the **automatic backup** (for example in OneDrive). Taktbuch keeps the latest files and leaves other files in the folder alone.

When an **update** is available a notice appears at the top. "Install" overwrites the file you currently have open, after confirmation. Save a backup first, do not rename the file and do not move it.


## Language, report a problem

Switch between German and English at the top right. Under Settings, Data you find "Report a problem / send a request". It opens your mail program with prefilled text (version, browser, active switches). Nothing is sent automatically and no data from the app.


## What's new

### 1.13.0

- With “every quarter hour”, typed times now stay exact to the minute, e.g. time clock entries from the office. The now buttons and the timer still round to the quarter hour, the list keeps 15-minute steps.
- Fixed: the time field (to the minute) saved right after the hour. The cursor did not move to the minutes, and 45 became 04. The time is now applied when leaving the field or with Enter.

### 1.12.2

- Online: a new e-mail address is now applied with the "Confirm address" button, not as soon as the link opens. Link scanners in company mail filters could otherwise use up the link.

### 1.12.1

- Fixed: if the start date was in the current week or in the future (new account), Today, Week and Calendar could not be opened. Days before the start date now show a note.
- Cut-off dates for vacation expiry and cap are entered and shown as day.month (e.g. 01.05.). Values accidentally saved that way are converted automatically.

### 1.12.0

- Choose color and appearance: under "Settings" → "General" eight accent colors and light, dark or automatic.
- In the dark theme the description on highlighted buttons is now easy to read.

### 1.11.4

- Fixed: the "Settings" tab was partly hidden behind the time account display at the top. The tabs now always sit in their own row.
- After an update "What's new" shows up to six skipped versions instead of three.

### 1.11.3

- Fixed: "Report a problem / send a request" now uses the correct mail address (Taktbuch@pm.me).

### 1.11.2

- Correction: time off in lieu days calculate as before; only vacation, special leave and company closed ignore entered times.

### 1.11.1

- On vacation days (also special leave and company closed) entered times are ignored and no longer change the time account. Time off in lieu is not affected.

### 1.11.0

- **Help** in the app: click "Help" at the top right. Works offline and is also available as a file in the repository.
- After an update Taktbuch shows **What's new** (this overview). You can open it any time from the help.
- The "Vacation" tab is now called **Calendar**.
- Fixed: the weekly total now counts half vacation days (24 Dec and 31 Dec) like the time account and no longer shows a wrong minus.
- Notice on the day when times are entered on a day off.

### 1.10.0

- Settings are split into **sub-menus**: Working time, Vacation and account, Salary, Recording, General, Data.
- The **automatic break** is configurable (statutory scale, fixed break from a minimum presence, or none), valid from a date.
- **Automatic backup** into a folder of your choice (Chrome, Edge), otherwise a weekly reminder.
- **Business trip** with customer and place, including a yearly table in Reports.

### 1.9.0

- The app is now called **Taktbuch** (formerly Zeitwerk). Your data stays.
- New button **Report a problem / send a request** under Settings, Data.

### 1.8.0

- **Work location** per day (office, home office, split) with a yearly table for your tax return.
- **Overtime payout** per day, deducted from the account.
- Fixed: category, type and system are no longer carried over after "Add"; the update notice appears sooner.

### 1.7.0

- **Job change wizard** under Settings, Vacation and account.
- Vacation rules, 24 Dec and 31 Dec, expiry and cap apply **from a date**.
