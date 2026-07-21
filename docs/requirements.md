# Anforderungsanalyse: Bierpong-Turnier-App v1.0 (Backend-Logik)

> [!NOTE]
> Dieses Dokument beschreibt die funktionalen und nicht-funktionalen Anforderungen für das Backend der Bierpong-Turnier-App.
> Es ist die **Single Source of Truth** für alle Implementierungsentscheidungen.

---

## Entity: User

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| id | Primärschlüssel, unabhängig von Telefonnummer |
| phoneNumber | Verifiziertes, änderbares Attribut, nicht PK |
| name | Pflichtfeld, echter Name bei Registrierung |
| profileImage | Optional |
| Auth-Methode | Ausschließlich SMS-Code an Telefonnummer, kein Passwort |
| SMS-Versand (v1) | Dummy-Funktion: loggt `{number, message}` in Backend-Konsole; Interface so gestalten, dass später httpsms-API (HTTP-Call statt Log) austauschbar ist ohne Aufrufer-Code zu ändern |
| Nummernwechsel | Durch Nutzer selbst (Frontend) oder Systemadmin; neue Nummer muss per SMS-Code verifiziert werden, bevor sie aktiv wird |
| Number-Recycling-Risiko | Bekannt und akzeptiert: alte, freigegebene Nummer könnte künftig anderer Person zugeteilt werden; kein Cooldown/Sperre implementiert |
| Social Login | Zukünftig zusätzlich, erfordert bei Erstregistrierung trotzdem Telefonnummer |
| E-Mail-Auth | Zukünftig optional als Alternativkanal zu SMS |
| Team-Zugehörigkeit | Kein Team bei Registrierung erforderlich (nicht Teil des Onboardings), da Beitritt auch später/über Einladung erfolgt |

---

## Entity: Team

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| id, name | Teamname wird bei Erstellung festgelegt |
| maxSize | Konfigurierbares Feld im Datenmodell, aktuell in Validierungslogik hart auf 2 gesetzt |
| Mitgliedschaft | Ein User kann Mitglied in mehreren Teams gleichzeitig sein |
| Erstellung | Durch Einladung eines registrierten Nutzers (Suche über Telefonnummer oder PWA Contact Picker API), oder über Team-Invite-Link |
| Vollständigkeit | Team ist "vollständig", wenn Mitgliederzahl == maxSize |

---

## Entity: TeamInvite (unabhängig von Team-Erstellungs-Flow)

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| id, teamId, token | Eindeutiger Link, NICHT an eine Telefonnummer gebunden |
| Verteilung | Frei teilbar über externe Kanäle (z.B. WhatsApp-Gruppe), jeder Inhaber des Links kann ihn öffnen |
| Registrierter Nutzer öffnet Link | Falls nicht eingeloggt: Login-Flow → danach direkter Team-Beitritt |
| Unregistrierter Nutzer öffnet Link | Registrierung (Telefonnummer + SMS-Code) → Onboarding (Name Pflicht, Bild optional) → automatischer Team-Beitritt direkt danach |
| Redirect-Logik | Zielseite (Team-Invite) muss über gesamten Auth+Onboarding-Flow hinweg gemerkt werden (z.B. serverseitig gespeicherter State/Session, referenziert durch Request); nach Onboarding-Abschluss automatischer Redirect zum ursprünglichen Ziel |
| Sicherheitsanforderung | Gemerktes Redirect-Ziel darf nur ein interner/relativer Verweis sein, keine beliebige externe URL (Open-Redirect-Schutz) |
| Turnierbezug | Bewusst nicht berücksichtigt – Team-Invite führt ausschließlich zum Team, nicht zu einem Turnier, auch wenn der Kontext (z.B. WhatsApp-Nachricht) ein Turnier erwähnt |
| Gültigkeit | Link wird nach erfolgreicher Nutzung (Team wird dadurch vollständig) invalidiert; bei maxSize=2 ist ein Link für den einen fehlenden Partner ausreichend |
| Race-Condition | Falls Team zwischen Linkaufruf und Bestätigung durch anderen Weg schon voll wurde: Beitritt schlägt fehl mit klarer Fehlermeldung |

---

## Entity: Tournament

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| Stammdaten | name, location, description (Markdown), startTime, tableCount, mode |
| mode (v1) | Nur einfacher KO-Modus implementiert |
| Modularität | Datenmodell/Logik so aufbauen, dass zusätzliche Modi (Rundenturnier, KO-Kombiturnier mit mehreren Etappen) später ergänzt werden können, ohne Kernstruktur umzubauen |
| Sichtbarkeit: privat | Nur Ersteller/Manager kann registrierte Nutzer per Telefonnummer einladen |
| Sichtbarkeit: öffentlich | Zusätzliche Option: gelistet auf Übersichtsseite ODER nur über direkten Link erreichbar |
| Löschung | Kein Hard-Delete; Soft-Delete-Flag (`deleted`), gelöschte Turniere verschwinden aus Listen/Suche, Daten bleiben erhalten; endgültige Löschstrategie ist zukünftiges Thema |

---

## Entity: TournamentUserRole (Many-to-Many: User × Tournament × Rolle)

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| Rollen | Ersteller (Admin), Manager, Schiedsrichter |
| Mehrfachrollen | Ein Nutzer kann mehrere Rollen im selben Turnier gleichzeitig haben (z.B. Spieler + Manager) |
| Mehrere Rolleninhaber | Mehrere Manager und/oder mehrere Schiedsrichter pro Turnier gleichzeitig möglich |
| Rechte: Ersteller | Alles, inkl. Löschen des Turniers |
| Rechte: Manager | Alles außer Löschen |
| Rechte: Schiedsrichter | Nur Ergebnismeldung |
| Rollenvergabe | Admin darf jede Rolle vergeben; Manager darf nur Schiedsrichter-Rolle vergeben; Auswahl ausschließlich unter registrierten Nutzern |
| Rollenentzug | Hierarchie Admin > Manager > Schiedsrichter: höherrangige Rolle darf niedrigrangige entziehen, unabhängig davon, wer sie ursprünglich vergeben hat |

---

## Turnier-Invite (zwei Fälle, unabhängig von Team-Invite)

| Fall | Logik |
| :-- | :-- |
| Öffentlicher Link | Jeder registrierte Nutzer mit Zugriff auf den Link kann versuchen beizutreten; Team ist trotzdem zwingend Voraussetzung (kein Beitritt ohne vollständiges Team) |
| Admin/Manager-Direkteinladung | Admin/Manager wählt registrierten Nutzer per Telefonnummer aus, Nutzer wird dem Turnier zugeordnet; keine aktive Benachrichtigung in v1 (spätere Frontend-Anzeige) |

---

## Turnier-Beitritt (Ablauflogik)

| Schritt | Logik |
| :-- | :-- |
| 1 | Ein Teammitglied initiiert Beitritt zu einem Turnier |
| 2 | Nutzer wählt eines seiner (evtl. mehreren) Teams aus |
| 3 | Validierung: gewähltes Team muss vollständig sein (Mitgliederzahl == maxSize) |
| 4 | Validierung: kein Mitglied des gewählten Teams ist bereits mit einem anderen Team in diesem Turnier registriert |
| 5 | Bei Erfolg: Team wird dem Turnier zugeordnet (unabhängig davon, ob der Teampartner die ursprüngliche Team-Einladung schon final bestätigt hat) |

---

## Turnierdurchführung: KO-Bracket

| Aspekt | Logik |
| :-- | :-- |
| Team-Zuordnung Runde 1 | Alle teilnehmenden Teams werden zufällig gemischt (Shuffle) |
| Ungerade Teilnehmerzahl | Ein Team erhält zufällig ein Freilos (Bye) für Runde 1 |
| Bye-Handling | Für die Bye-"Begegnung" wird kein Match-Objekt erstellt; das Freilos-Team wird direkt als Teilnehmer in das (im Baum bereits existierende) Match der nächsten Runde eingetragen |
| Bracket-Erzeugung | Bei Turnierstart wird die vollständige Baumstruktur aller Matches erzeugt (jede Runde, jede Position, Verknüpfung zum jeweils nachfolgenden Match) |
| Team-Befüllung höherer Runden | Matches ab Runde 2 haben zunächst keine Teams zugewiesen; das Gewinnerteam eines abgeschlossenen Matches wird automatisch in das verknüpfte Folge-Match eingetragen |
| Tischzuweisung (v1) | Keine automatische Logik |
| Tischzuweisung (zukünftig) | Erste n Matches (n = tableCount) erhalten automatisch einen Tisch; nach Ergebnismeldung eines Matches wird der frei werdende Tisch dem nächsten wartenden Match zugewiesen |

---

## Entity: Result

| Feld/Aspekt | Beschreibung |
| :-- | :-- |
| Berechtigung | Ausschließlich Nutzer mit Rolle Admin, Manager oder Schiedsrichter dürfen Ergebnisse melden; Teams/Spieler selbst können dies nie |
| Modell | Event-Log-Charakter statt einfachem Überschreiben: jeder Eintrag hat matchId (FK), type (created / modified / deleted), winnerTeamId (FK), cupsLeft, timestamp, reportedByUserId |
| Aktuelles Ergebnis | Ergibt sich aus dem letzten, nicht-gelöschten Eintrag pro matchId |
| Änderbarkeit | Ergebnisse können nachträglich modifiziert oder als gelöscht markiert werden, alte Einträge bleiben zur Nachvollziehbarkeit erhalten |

---

## Nicht in v1 berücksichtigt (bewusst zurückgestellt)

| Thema | Status |
| :-- | :-- |
| Solo-Turniere (Team-Größe 1) | Nicht implementiert, `maxSize` bleibt fix 2 |
| Cooldown/Sperre bei Nummernwechsel | Nicht implementiert, Risiko akzeptiert |
| Benachrichtigungen bei Einladung | Nicht implementiert, folgt im Frontend später |
| Turnier-Hard-Delete/Bereinigung | Nicht implementiert, nur Soft-Delete |

---

_Zuletzt aktualisiert: 19.07.2026_
