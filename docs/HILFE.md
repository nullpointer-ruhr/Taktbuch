# Hilfe zu Taktbuch

Taktbuch führt dein Zeitkonto, deinen Urlaub und deine Tätigkeiten. Alles liegt in deinem Browser, nichts wird an einen Server gesendet. Diese Hilfe ist Teil der Datei und funktioniert offline.

## Der Tag in Kürze

Unter **Heute** trägst du Kommen und Gehen ein. Die Pause wird automatisch abgezogen, bis du sie für den Tag selbst einträgst. Das **Zeitkonto** ist die Summe aller Tage: gearbeitete Stunden minus Soll.

- Urlaub, Feiertag, Krankheit und Zeitausgleich ändern das Konto nicht, weil das Soll des Tages dann als erfüllt gilt.
- Zeiten, die an einem Urlaubstag (auch Sonderurlaub, Betriebsfrei) eingetragen sind, werden ignoriert. Die App weist am Tag darauf hin.
- Tage in der Zukunft ohne Zeiten gelten als Plan und belasten das Konto nicht.

## Tätigkeiten und Timer

Unter **Tätigkeiten** buchst du, woran du gearbeitet hast: von bis oder Dauer, dazu Kategorie, Art, System, Projektnummer und Thema. Mit dem Timer startest du eine Tätigkeit, die bis zum Stopp mitläuft.

- Wer ein Thema eingibt, bekommt Kategorie, Art und System aus dem letzten Eintrag mit demselben Thema vorgeschlagen (nur leere Felder werden gefüllt).
- Nach „Hinzufügen“ werden die Felder geleert.
- Welche Spalten du siehst, stellst du unter Einstellungen, Erfassung ein.

## Woche und Monat

In der **Woche** änderst du Zeiten direkt in der Tabelle. Die Wochensumme rechnet wie das Konto: halbe Urlaubstage (24.12. und 31.12.) zählen nur dann mit halbem Soll, wenn du an dem Tag arbeitest.

Der **Monat** zeigt alle Tage als Kalender. Mit dem Zeitraum-Werkzeug setzt du mehrere Tage auf einmal auf Urlaub, Zeitausgleich, Dienstreise oder einen Arbeitsort.


## Kalender: Urlaub und Zeitausgleich planen

Im **Kalender** wählst du einen Pinsel (Urlaub, Urlaub halb, Zeitausgleich, Dienstreise) und klickst oder ziehst über die Tage. Ein zweiter Klick auf einen belegten Tag nimmt ihn zurück. Oben siehst du Anspruch, genommen, geplant und den Resturlaub, darunter den Verlauf über das Jahr.

- Verfall und Übertrag ins Langzeitkonto richten sich nach den Regeln unter Einstellungen, Urlaub und Konto.
- Die Kappung des Zeitkontos wird im Kalender mit einer Warnung angezeigt, wenn nach der aktuellen Planung Stunden verfallen würden.

## Auswertung und Gehalt

Die **Auswertung** zeigt Monats- und Jahrestabellen, Auswertungen nach Kategorie, Art und System sowie (wenn eingeschaltet) Arbeitsort und Dienstreisen für die Steuererklärung. Das ist eine reine Zählung, keine Steuerberechnung.

Unter **Gehalt** siehst du die Gehaltsübersicht mit Gehaltserhöhung und Zahltag.


## Einstellungen im Überblick

- **Arbeitszeit:** Soll pro Tag (mit Änderungen ab Datum), Pausenregel, Bundesland für Feiertage.
- **Urlaub und Konto:** Urlaubstage, 24.12. und 31.12., Verfall, Langzeitkonto, Kappung. Änderungen gelten ab einem Datum, frühere Zeiträume behalten ihre Regeln. Hier startet auch der Jobwechsel-Assistent.
- **Gehalt:** Angaben für die Gehaltsansicht und den Zahltag.
- **Erfassung:** Spalten der Tätigkeiten, Arbeitsort, Auszahlung von Überstunden, Dienstreise (Kunde und Ort).
- **Allgemein:** Anzeige und Rundung der Zeiten.
- **Daten:** Sicherung, Wiederherstellung, Excel-Import, automatische Sicherung, Version und Updates.

## Jobwechsel

Beim Wechsel mitten im Jahr startest du den Assistenten unter Einstellungen, Urlaub und Konto. Er fragt Datum, Urlaubstage, Resturlaub bis Jahresende, Startwerte für Konto und Langzeitkonto und das neue Soll ab. Der alte Job zählt anteilig in halben Monaten (1. bis 15. = halber Monat), aufgerundet auf halbe Tage. Alles davor bleibt unverändert.


## Arbeitsort, Auszahlung und Dienstreise

Diese Funktionen sind standardmäßig aus und werden unter Einstellungen, Erfassung eingeschaltet. **Arbeitsort** zählt Büro und Homeoffice je Tag, auch geteilte Tage (erst Büro, dann Homeoffice oder umgekehrt, mit Umschaltzeit). **Auszahlung** zieht ausgezahlte Überstunden vom Konto ab. Bei einer **Dienstreise** trägst du Kunde und Ort ein.


## Sicherung und Updates

Deine Daten liegen nur in diesem Browser. Speichere deshalb regelmäßig eine Sicherung unter Einstellungen, Daten. In Chrome und Edge kannst du dort einen Ordner für die **automatische Sicherung** wählen (zum Beispiel in OneDrive). Taktbuch behält die letzten Dateien und lässt andere Dateien im Ordner in Ruhe.

Bei einem **Update** erscheint oben ein Hinweis. „Installieren“ überschreibt die Datei, die du gerade geöffnet hast, nach Bestätigung. Speichere vorher eine Sicherung, benenne die Datei nicht um und verschiebe sie nicht.


## Sprache, Problem melden

Oben rechts schaltest du zwischen Deutsch und Englisch um. Unter Einstellungen, Daten findest du „Problem melden / Wunsch senden“. Das öffnet dein Mailprogramm mit vorbefülltem Text (Version, Browser, aktive Schalter). Es wird nichts automatisch gesendet und keine Daten aus der App.


## Was ist neu

### 1.12.2

- Online: Eine neue E-Mail-Adresse wird jetzt mit dem Knopf „Adresse bestätigen“ übernommen, nicht schon beim Öffnen des Links. Link-Scanner in Firmen-Mailfiltern haben den Link sonst vorab verbraucht.

### 1.12.1

- Fehler behoben: Liegt das Startdatum in der aktuellen Woche oder in der Zukunft (neues Konto), ließen sich Heute, Woche und Kalender nicht öffnen. Tage vor dem Startdatum zeigen jetzt einen Hinweis.
- Stichtage für Urlaubsverfall und Kappung werden als Tag.Monat eingegeben und angezeigt (z. B. 01.05.). Versehentlich so gespeicherte Werte werden automatisch übernommen.

### 1.12.0

- Farbe und Darstellung wählbar: unter „Einstellungen“ → „Allgemein“ acht Akzentfarben und hell, dunkel oder automatisch.
- Im dunklen Design ist die Beschreibung auf hervorgehobenen Knöpfen jetzt gut lesbar.

### 1.11.4

- Fehler behoben: Der Reiter „Einstellungen“ wurde oben von der Zeitkonto-Anzeige verdeckt. Die Reiter stehen jetzt immer in einer eigenen Zeile.
- Nach einem Update zeigt „Was ist neu“ bis zu sechs übersprungene Versionen statt drei.

### 1.11.3

- Fehler behoben: „Problem melden / Wunsch senden“ nutzt jetzt die richtige Mailadresse (Taktbuch@pm.me).

### 1.11.2

- Korrektur: Zeitausgleich-Tage rechnen wieder wie zuvor; nur Urlaub, Sonderurlaub und Betriebsfrei ignorieren eingetragene Zeiten.

### 1.11.1

- An Urlaubstagen (auch Sonderurlaub und Betriebsfrei) werden eingetragene Zeiten ignoriert und ändern das Zeitkonto nicht mehr. Zeitausgleich ist davon nicht betroffen.

### 1.11.0

- **Hilfe** in der App: oben rechts auf „Hilfe“. Läuft offline und gibt es auch als Datei im Repository.
- Nach einem Update zeigt Taktbuch **Was ist neu** (diese Übersicht). Du findest sie jederzeit in der Hilfe.
- Der Reiter „Urlaub“ heißt jetzt **Kalender**.
- Fehler behoben: Die Wochensumme zählt halbe Urlaubstage (24.12. und 31.12.) jetzt wie das Zeitkonto und zeigt kein falsches Minus mehr.
- Hinweis am Tag, wenn an einem freien Tag Zeiten eingetragen sind.

### 1.10.0

- Einstellungen sind in **Untermenüs** gegliedert: Arbeitszeit, Urlaub und Konto, Gehalt, Erfassung, Allgemein, Daten.
- Die **automatische Pause** ist einstellbar (gesetzliche Staffel, feste Pause ab Mindestanwesenheit oder keine), gültig ab einem Datum.
- **Automatische Sicherung** in einen Ordner deiner Wahl (Chrome, Edge), sonst eine wöchentliche Erinnerung.
- **Dienstreise** mit Kunde und Ort, inklusive Jahrestabelle in der Auswertung.

### 1.9.0

- Die App heißt jetzt **Taktbuch** (vorher Zeitwerk). Deine Daten bleiben erhalten.
- Neuer Knopf **Problem melden / Wunsch senden** unter Einstellungen, Daten.

### 1.8.0

- **Arbeitsort** je Tag (Büro, Homeoffice, geteilt) mit Jahrestabelle für die Steuererklärung.
- **Auszahlung von Überstunden** je Tag, vom Konto abgezogen.
- Fehler behoben: Kategorie, Art und System werden nach „Hinzufügen“ nicht mehr übernommen; Update-Hinweis erscheint früher.

### 1.7.0

- **Jobwechsel-Assistent** unter Einstellungen, Urlaub und Konto.
- Urlaubsregeln, 24.12. und 31.12., Verfall und Kappung gelten **ab einem Datum**.
