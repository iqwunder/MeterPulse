# MeterPulse

MeterPulse erfasst Strom-, Gas- und Wasserverbrauch. Messwerte werden mit Verbrauch und Ablesedatum in MariaDB gespeichert. Die Anwendung zeigt den Verlauf für den gesamten Zeitraum oder ein ausgewähltes Jahr und kann historische Werte aus CSV-Dateien importieren.

## Voraussetzungen

- Node.js 20.19 oder neuer
- Docker Desktop mit Docker Compose (für die mitgelieferte MariaDB)

## Jenkins konfigurieren

Das gemeinsame Service-Modul benötigt die Credentials `meterpulse-database-url`
und `buecherei-database-url`; die Einrichtung ist in
[services/README.md](../services/README.md) beschrieben.

Das Frontend deployed nur, wenn `DEPLOY` aktiviert und `SERVICE_API_URL` auf
die interne API-Basis-URL gesetzt ist. `DEPLOY_SSH_KEY` und `WEBSERVER_IP`
müssen ebenfalls gesetzt sein.

## Entwicklungsstart unter Windows

Öffne PowerShell im Projektordner und führe diese Schritte aus:

1. Konfiguration anlegen:

   ```powershell
   Copy-Item .env.example .env
   ```

   Die Standardwerte in `.env` passen zur lokalen Compose-Datenbank. Passe dort bei Bedarf Datenbankname, Benutzer und Passwort an.

2. MariaDB starten:

   ```powershell
   docker compose up -d mariadb
   ```

   Beim ersten Start legt MariaDB die Datenbank und Tabelle anhand von [db/schema.sql](db/schema.sql) an. Den Status kannst du mit `docker compose ps` prüfen.

   Für eine bestehende MeterPulse-Tabelle führe einmalig [db/migrations/001-remove-reading-name.sql](db/migrations/001-remove-reading-name.sql) aus. Sie entfernt die Namensspalte und ersetzt die bisherige Positivitätsprüfung, damit auch ein Zählerstand von `0` gespeichert werden kann. Messwerte bleiben erhalten.

3. Node-Abhängigkeiten installieren (beim ersten Start oder nach Änderungen an `package-lock.json`):

   ```powershell
   npm ci
   ```

4. In einem zweiten Terminal das Service-Modul konfigurieren und starten. In
   `../services` `.env.example` nach `.env` kopieren, die beiden Datenbank-URLs
   eintragen und dann ausführen:

   ```powershell
   cd ..\services
   npm.cmd ci
   npm.cmd start
   ```

5. In einem dritten Terminal Angular starten:

   ```powershell
   cd ..\MeterPulse
   npm.cmd start
   ```

6. Im Browser öffnen: <http://localhost:4200>

Das Frontend leitet lokal `/api`-Anfragen an den gemeinsamen Service auf Port
3000 weiter. MariaDB kann mit `docker compose stop mariadb` angehalten werden.

## Datenbank konfigurieren

Die Zugangsdaten werden ausschließlich vom gemeinsamen Service verwendet und
dürfen nicht in den Angular-Code eingetragen werden. `DATABASE_URL` konfiguriert
MeterPulse, `BUECHEREI_DATABASE_URL` die Bücherei-Datenbank. Beide URLs stehen in
der `.env` des Service-Moduls.

## CSV-Import

Die UTF-8-kodierte CSV-Datei darf Komma oder Semikolon als Trennzeichen verwenden und benötigt die Spalten `utility`, `value` und `date`. Eine Hilfeseite mit Formatbeschreibung ist in der App über den Menüpunkt „Hilfe“ erreichbar:

```csv
utility,value,date
electricity,285.4,2025-01-31
gas,82.1,2025-01-31
water,12.6,2025-01-31
```

`utility` ist `electricity`, `gas` oder `water`. Der Zählerstand darf ab null liegen; das Datum muss im Format `YYYY-MM-DD` vorliegen. Pro Datei sind bis zu 5 MB und 5.000 Messwerte erlaubt. Fehlerhafte Dateien werden vollständig abgelehnt. Die Tagesverbräuche werden aus den Differenzen berechnet; sinkt der Stand, wird ein Zählerwechsel angenommen und dieses nicht messbare Intervall ausgelassen.

## PV-Daten

Die Seite **PV-Anlage** importiert und visualisiert tägliche Erzeugungs-, Verbrauchs-, Einspeise- und Netzbezugswerte in kWh. Die UTF-8-CSV muss diese Spalten enthalten. Das Trennzeichen wird aus der Kopfzeile erkannt. Bei Semikolon als Trennzeichen dürfen Dezimalwerte Punkt oder Komma verwenden. Bei Komma als Trennzeichen müssen Dezimalwerte einen Punkt verwenden:

```csv
Datum;Erzeugt;Verbraucht;Einspeisung;Netzbezug
2026-01-01;5,2;9,1;2,3;6,8
```

Pro Datum wird ein Tagesdatensatz gespeichert. Ein erneuter Import desselben Datums aktualisiert die Werte. Die PV-Tabelle wird bei einer neuen Datenbank durch [db/schema.sql](db/schema.sql) angelegt. Für eine bestehende Datenbank führe einmalig [db/migrations/002-create-pv-daily-readings.sql](db/migrations/002-create-pv-daily-readings.sql) aus, zum Beispiel:

```bash
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/002-create-pv-daily-readings.sql
```

Der Import ist vollständig oder gar nicht: Ungültige Zeilen oder doppelte Datumswerte in derselben Datei werden abgelehnt.

### PV-Verkaufsvertrag

Der Bruttoerlös pro kWh wird im PV-Verkaufsvertrag gespeichert. Monatliche Einnahmen ergeben sich aus den eingespeisten kWh der PV-Tageswerte multipliziert mit diesem Preis. Der einstellbare Umsatzsteuersatz teilt den Bruttobetrag rechnerisch in Nettoerlös und enthaltene Umsatzsteuer auf; dies ist keine Einkommensteuerberechnung.

Die Vertragstabelle wird bei einer neuen Datenbank durch [db/schema.sql](db/schema.sql) angelegt. Für bestehende Datenbanken führe einmalig [db/migrations/006-create-pv-feed-in-contract.sql](db/migrations/006-create-pv-feed-in-contract.sql) aus:

```bash
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/006-create-pv-feed-in-contract.sql
```

Die tatsächlichen Bruttozahlungen an oder von den Stadtwerken werden monatlich erfasst: positive Werte sind erhaltene Einnahmen, negative Werte gezahlte Beträge. Alle zwölf Monatswerte werden gemeinsam gespeichert. Die Jahresstatistik weist die Umsatzsteuer aus erhaltenen und gezahlten Beträgen getrennt aus und vergleicht positive Auszahlungen, sofern PV-Messwerte und Vertragspreis vorliegen, mit der errechneten Bruttovergütung. Für bestehende Datenbanken führe danach einmalig [db/migrations/007-create-pv-utility-payments.sql](db/migrations/007-create-pv-utility-payments.sql) aus:

```bash
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/007-create-pv-utility-payments.sql
```

Wenn Migration 007 bereits ausgeführt wurde, muss zusätzlich [db/migrations/008-allow-negative-pv-utility-payments.sql](db/migrations/008-allow-negative-pv-utility-payments.sql) ausgeführt werden, damit auch negative Zahlungen gespeichert werden können.

## Vertragsdaten

Unter **Verträge** können Vertragsbeginn, monatliche Grundgebühr, Arbeitspreis, Abschlag und optionales Vertragsende je Energieträger gepflegt werden. Für Gas werden zusätzlich Brennwert in kWh/m³ und Zustandszahl erfasst. Der Gaszähler bleibt in m³; für die Abrechnung wird die Menge mit `Brennwert × Zustandszahl` in kWh umgerechnet und mit dem Preis pro kWh bewertet. Bei Wasser werden Trink- und Abwasserkosten pro m³ auf denselben gemessenen Wasserverbrauch angewendet. Niederschlagswasser wird mit dem Jahrespreis pro m² und der versiegelten Fläche berechnet. Die Jahresbilanz zählt aktive Kalendermonate für Grundgebühr und Abschläge. Der erwartete Verbrauch kombiniert die bis zur letzten Ablesung gemessene Nutzung mit einer Hochrechnung des Tagesdurchschnitts für den Rest des Vertragsjahres. Ohne ausreichende Messhistorie wird keine Verbrauchsprognose angezeigt.

Die Tabelle wird bei einer neuen Datenbank durch [db/schema.sql](db/schema.sql) angelegt. Für eine bestehende Datenbank, auf der noch keine Vertragstabelle existiert, führe die Migrationen 003, 004 und 005 in dieser Reihenfolge aus:

```bash
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/003-create-utility-contracts.sql
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/004-add-gas-contract-factors.sql
mariadb -h DB-HOST -u meterpulse -p meterpulse < db/migrations/005-add-water-contract-rates.sql
```

Wenn Migration 003 bereits ausgeführt wurde, müssen noch 004 und 005 ausgeführt werden. Wenn auch Migration 004 bereits ausgeführt wurde, genügt Migration 005.

## Deployment

Die Pipeline deployed nur das Frontend nach `/var/www/meterpulse`. Für ein
Deployment muss `SERVICE_API_URL` auf die interne URL des separat deployten
Service-Moduls zeigen, zum Beispiel `http://dbserver.intern:3000`. Die URL wird
in `api-config.js` als Laufzeitkonfiguration hinterlegt und kann beim
Frontend-Deployment geändert werden, ohne die Anwendung neu zu bauen. Der
API-Port auf dem Datenbankserver darf nur aus dem internen Netz erreichbar sein.