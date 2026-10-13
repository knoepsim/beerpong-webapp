# Vollständiges Projekt-Audit: Logik, UI/UX & Priorisierung

Komplette Analyse des Projekts nach Durchsicht aller Seiten, Komponenten, Services und Router.

---

## 1. Logik & Real-World Fit (Bierpongturnier)

### 🔴 Kritische Bugs

| # | Problem | Datei | Zeile | Begründung | Status |
|---|---------|-------|-------|------------|--------|
| L1 | **`leave_tournament` ist kaputt** — der `delete()`-Aufruf hat eine **leere `.where()`-Klausel**, löscht also potentiell ALLE TournamentTeam-Einträge oder wirft einen Fehler | [tournament_service.py](file:///d:/github/beerpong-webapp/apps/api/app/services/tournament_service.py#L165-L169) | 165–169 | **Daten-Korruption möglich.** Die Where-Bedingung fehlt komplett: `delete(TournamentTeam).where()` | ✅ Done |
| L2 | **"Team abmelden" Button wird nach Bracket-Generierung ausgeblendet, aber `leave_tournament` hat keinen Backend-Guard** — User kann via API immer noch `DELETE /tournaments/{id}/leave` aufrufen, auch wenn das Bracket schon steht | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L306) + [tournament_service.py](file:///d:/github/beerpong-webapp/apps/api/app/services/tournament_service.py#L146) | — | Backend muss prüfen: Bracket existiert? → 400 | ✅ Done |
| L3 | **`start_tournament` Endpoint hat `await db.commit()` direkt im Router**, alle anderen nutzen den Autocommit-Middleware-Pattern — inkonsistent, kann zu Doppel-Commits führen | [tournaments.py](file:///d:/github/beerpong-webapp/apps/api/app/routers/tournaments.py#L175) | 175 | Entweder alle Endpoints committen im Router oder keiner | ✅ Done |

### 🟡 Logik-Probleme

| # | Problem | Begründung | Status |
|---|---------|------------|--------|
| L4 | **Doppelte API-Calls in `loadData`**: `api.teams.list()` wird **2x** parallel aufgerufen (Zeile 74 und 76). `allTeams` und `myTeams` erhalten exakt dieselben Daten | Unnötiger Netzwerk-Traffic, verwirrende Benennung | ✅ Done |
| L5 | **`teamsMap` basiert auf `allTeams` (= User's eigene Teams)** — das heißt im Bracket-View werden nur die eigenen Teamnamen aufgelöst, **alle anderen Teams zeigen "Unbekannt"**. Das ist in der echten Welt der Normalfall: ein Spieler sieht die Namen seiner Gegner nicht | `allTeams` sollte aus den Turnier-Teams (`tournamentTeams`) gebaut werden, nicht aus den eigenen Teams | ✅ Done |
| L6 | **Kein Guard gegen doppeltes Bracket-Generieren** — Admin kann den "Spielplan generieren"-Button mehrfach klicken und das System erstellt das Bracket nochmal (dupliziert alle Matches) | Backend: Check ob Bracket für dieses Tournament schon existiert | ✅ Done |
| L7 | **Kein Guard gegen doppeltes `start_tournament`** — `started_at` wird jedes Mal überschrieben | Backend: Check ob `started_at` schon gesetzt → 400 | ✅ Done |
| L8 | **`registration_end_time` wird nur beim Beitreten geprüft**, nicht beim Verlassen — User kann Team abmelden nach Reg-Deadline, was sinnvoll sein könnte, aber nicht explizit designed ist | Klare Entscheidung treffen und dokumentieren | ✅ Done |
| L9 | **Check-in/Check-out Buttons werden nur in `SETUP`, `CHECKIN`, `ANMELDUNG_GESCHLOSSEN` angezeigt** — aber nicht in `BRACKET_READY`. D.h. nach Bracket-Generierung kann man nicht mehr den Check-in Status korrigieren, was in der echten Welt problematisch ist (Team kommt zu spät an den Tisch) | Das ist korrekt für den Workflow, aber sollte bewusst sein | ✅ Done |
| L10 | **`TournamentUpdate` Schema enthält `started_at`** — Manager/Admin könnten via PATCH `started_at` setzen und damit den dedizierten `/start` Endpoint umgehen | `started_at` aus `TournamentUpdate` entfernen | ✅ Done |

### 🟢 Real-World Logik (Bierpong-spezifisch)

| # | Beobachtung | Status |
|---|-------------|--------|
| L11 | Anmeldung → Check-in → Bracket → Start → Spielen: **Ablauf ist korrekt und bildet die echte Welt gut ab** | ✅ |
| L12 | Check-in entfernt nicht-eingecheckte Teams beim Bracket-Generieren — **genau richtig** für ein Beerpong-Turnier | ✅ |
| L13 | Freilos-Handling (Byes) für nicht-Zweierpotenzen — **korrekt implementiert** | ✅ |
| L14 | Random Seeding — **für ein Casual-Beerpong-Turnier perfekt** (kein Ranking-basiertes Seeding nötig) | ✅ |

---

## 2. UI/UX Audit

### 🔴 Muss gefixt werden (schlecht für User)

| # | Problem | Bereich | Seite | Begründung | Status |
|---|---------|---------|-------|------------|--------|
| U1 | **Alle Error-Handler nutzen `alert()`** — 16x im Code! `alert()` ist blocking, hässlich, nicht mobile-freundlich. | Error Handling | überall | `sonner.tsx` (Toast) ist bereits installiert aber wird **nirgends genutzt** | ✅ Done |
| U2 | **Alle Confirm-Dialoge nutzen `confirm()`** — 4x im Code. Sollte `AlertDialog` nutzen | Destructive Actions | page.tsx, settings | Konsistenz: Teams-Page nutzt `AlertDialog`, Rest nutzt `confirm()` | ✅ Done |
| U3 | **Loading State der Tournament-Detail Seite ist nur ein Text** `"Lade Turnier…"` — kein Skeleton | Loading States | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L229-L231) | Tesler's Law: User erwartet visuelles Feedback | ✅ Done |
| U4 | **Teams-Page Loading ist auch nur Text** `"Lade Teams…"` | Loading States | [teams/page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/teams/page.tsx#L165-L167) | Tournaments-List hat schon Skeleton — inkonsistent | ✅ Done |
| U5 | **Error-State der Tournament-Detail Seite hat keinen Retry-Button** | Error Recovery | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L232-L234) | | ✅ Done |
| U6 | **Status-Badge zeigt rohe Enum-Werte** wie `SETUP` — mischung aus Deutsch und Englisch | Status Display | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L246) | User soll "Anmeldung", "Läuft", etc. sehen | ✅ Done |
| U7 | **Tournament Settings nutzt `alert()`** als Success-Feedback — nicht inline | Success Feedback | [tournament-settings.tsx](file:///d:/github/beerpong-webapp/apps/web/components/tournament-settings.tsx#L83) | Profil-Seite macht's richtig: inline grüner Text | ✅ Done |
| U8 | **Sichtbarkeits-Optionen in den Settings matchen nicht die tatsächlichen Enum-Werte** | Data Integrity | [tournament-settings.tsx](file:///d:/github/beerpong-webapp/apps/web/components/tournament-settings.tsx#L178-L180) | `<SelectItem value="PUBLIC">` existiert nicht als Enum-Wert | ✅ Done |
| U9 | **Spielplan-Tab: Kein Empty-State wenn Turnier noch nicht gestartet** | Empty States | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L484-L489) | Button oder Link zum Leitstand/Übersicht-Tab hinzufügen | ✅ Done |
| U10 | **Join-Dialog: `alert()` bei Fehler** statt inline-Fehler im Dialog | Error Placement | [page.tsx](file:///d:/github/beerpong-webapp/apps/web/app/(app)/tournaments/[id]/page.tsx#L165) | Jakobs Law: Fehler dort zeigen wo die Aktion passiert | ✅ Done |

### 🟡 Sollte angegangen werden (UX Best Practices)

| # | Problem | Bereich | Begründung |
|---|---------|---------|------------|
| U11 | **Kein Toast-System initialisiert** — `sonner.tsx` existiert als UI-Komponente | Infrastructure | Muss in `app/layout.tsx` eingebunden werden | ✅ Done |
| U12 | **"Team abmelden" Button hat keinen Loading-State** | Loading States | `handleLeave` setzt keinen `isLoading`-State | ✅ Done |
| U13 | **"Team entfernen" (Admin) hat keinen Loading-State** | Loading States | `handleRemoveTeam` setzt keinen State | ✅ Done |
| U14 | **Check-in Button hat keinen Loading-State** | Loading States | `handleCheckin` setzt keinen State | ✅ Done |
| U15 | **Bracket-View zeigt kein Gewinner-Highlight** | Visual Feedback | Gewinner fett/grün | ✅ Done |
| U16 | **Match-Result-Dialog hat kein "Bereits eingetragenes Ergebnis"** | State Display | Zeige vorheriges Ergebnis | ✅ Done |
| U17 | **Login-Seite: `Code an ${currentPhone} gesendet`** — zeigt die Nummer ohne +49 Prefix | Polish | Nicht mehr relevant, SMS Auth deaktiviert/geändert | ➖ Entfällt |
| U18 | **Turnier-Liste sortiert nach Start-Datum aufsteigend** | Information Architecture | Aktive oben sortiert | ✅ Done |
| U19 | **Kein "Kein Team vorhanden"-Hinweis im Join-Dialog** | Empty States | User sieht Hinweis mit Link | ✅ Done |
| U20 | **Admin-Icon im Mobile-Nav nutzt `Users` statt `Wrench`** (wie im Desktop) | Consistency | ShieldAlert für Admin hinzugefügt | ✅ Done |
| U21 | **Tournament Settings Form hat kein Dirty-State Tracking** | Form UX | Profil-Seite macht's richtig | ✅ Done |
| U22 | **Keine Bestätigung vor kritischen Aktionen im Leitstand** | Destructive Actions | AlertDialog hinzugefügt | ✅ Done |

### 🟢 Optional aber sinnvoll

| # | Verbesserung | Bereich | Begründung |
|---|-------------|---------|------------|
| U23 | **Toasts für Success-Feedback** — "Rolle zugewiesen!", "Team entfernt!", etc. | Success Feedback | Konsistentes Pattern über die ganze App | ✅ Done |
| U24 | **Pull-to-Refresh auf Mobile** für Turnier-Detail, Teams-Liste | Mobile UX | Standard-Pattern auf Mobile-Web-Apps | ⏳ Pending |
| U25 | **Turnierbaum: Gewinner des gesamten Turniers hervorheben** — wenn das Finale entschieden ist, einen Winner-Banner zeigen | Engagement | Emotionaler Höhepunkt des Turniers | ✅ Done |
| U26 | **Skeleton-Loader für Bracket-Tab** — momentan kein Loading-State während Bracket geladen wird | Loading States | | ✅ Done |
| U27 | **Turnier-Teilen per Link** — aktuell gibt es keinen "Turnier teilen" Button für Public-Turniere | Social | Teams-Page hat Share-Funktion, Tournament-Page nicht | ✅ Done |
| U28 | **Markdown-Preview für Turnier-Beschreibung im Edit-Modus** — User tippt Markdown, sieht aber erst nach Speichern wie es aussieht | Content Creation | | ⏳ Pending |

---

## 3. Autorisierung & Sichtbarkeit

### Rollen-Modell (Ist-Zustand)

Es existieren **4 Berechtigungsstufen** im System:

| Stufe | Rolle | Scope | Beschreibung |
|-------|-------|-------|-------------|
| 0 | **Nicht eingeloggt** | Global | Kein Token → Landing Page + Login. Kein API-Zugriff |
| 1 | **Eingeloggter User** | Global | Hat Token, kann Teams erstellen, Turnieren beitreten, Profil pflegen |
| 2 | **Turnier-Rolle** (Referee / Manager / Admin) | Pro Turnier | Rollen werden pro Turnier vergeben, mit Hierarchie: Referee < Manager < Admin |
| 3 | **System-Admin** | Global | `is_system_admin` Flag auf dem User-Objekt. Zugang zum System-Admin-Panel |

### Backend-Endpoint-Autorisierungsmatrix (Ist vs. Soll)

#### ✅ Korrekt gesicherte Endpoints

| Endpoint | Methode | Benötigte Berechtigung | Status |
|----------|---------|----------------------|--------|
| `POST /tournaments` | Erstellen | Eingeloggter User | ✅ |
| `PATCH /tournaments/{id}` | Bearbeiten | Manager+ | ✅ |
| `DELETE /tournaments/{id}` | Löschen | Admin | ✅ |
| `POST /tournaments/{id}/generate-bracket` | Bracket gen. | Admin | ✅ |
| `POST /tournaments/{id}/start` | Starten | Admin | ✅ |
| `DELETE /tournaments/{id}/teams/{team_id}` | Team entfernen | Manager+ | ✅ |
| `POST /tournaments/{id}/teams/{team_id}/checkin` | Check-in | Manager+ | ✅ |
| `POST /matches/{id}/results` | Ergebnis melden | Referee+ | ✅ |
| `PATCH /matches/{id}/results` | Ergebnis korrigieren | Referee+ | ✅ |
| `DELETE /matches/{id}/results` | Ergebnis löschen | Referee+ | ✅ |
| `POST /tournaments/{id}/roles` | Rolle vergeben | Hierarchie-Check | ✅ |
| `DELETE /tournaments/{id}/roles/{role_id}` | Rolle entziehen | Hierarchie-Check | ✅ |
| `PATCH /teams/{id}` | Team umbenennen | Team-Mitglied | ✅ |
| `DELETE /teams/{id}` | Team löschen | Team-Mitglied | ✅ |
| `GET /admin/*` | System-Admin | `is_system_admin` | ✅ |

#### 🔴 Fehlende oder fehlerhafte Autorisierung

| # | Endpoint | Problem | Begründung | Status |
|---|----------|---------|------------|--------|
| A1 | **`GET /tournaments/{id}`** | **Kein Sichtbarkeits-Check** — jeder eingeloggte User kann jedes Turnier abrufen, auch private, wenn er die UUID kennt | Private Turniere sollten nur für Teilnehmer + Rollen-Inhaber sichtbar sein. Für `public_unlisted` ist es OK (Link-Zugang). Für `private` ist es ein Leak | ✅ Done |
| A2 | **`GET /tournaments/{id}/teams`** | **Kein Sichtbarkeits-Check** — wie A1, leakt zudem Teilnehmer-Liste (inkl. Namen) an Unbefugte | Teilnehmerliste eines privaten Turniers ist sensibel | ✅ Done |
| A3 | **`GET /tournaments/{id}/bracket`** | **Kein Sichtbarkeits-Check** — wie A1 | Bracket eines privaten Turniers ist sensibel | ✅ Done |
| A4 | **`GET /tournaments/{id}/roles`** | **Kein Sichtbarkeits-Check** — jeder kann sehen wer Admin/Manager/Referee ist | Rolle-Liste zeigt User-IDs und Namen, die eigentlich nur für Admins/Manager relevant sind | ✅ Done |
| A5 | **`POST /tournaments/{id}/join`** | **Nur Registration-Deadline Check**, kein Sichtbarkeits-Check — jeder kann einem privaten Turnier beitreten, wenn er die UUID kennt | Beitreten zu einem `private` Turnier sollte nur über Einladungs-Mechanismus möglich sein (aktuell nicht implementiert) | ✅ Done |
| A6 | **`DELETE /tournaments/{id}/leave`** | **Kein Check ob User überhaupt im Turnier ist** (+ L1: Where-Klausel kaputt) | Der Bug in L1 ist gravierender, aber auch die Autorisierung fehlt | ✅ Done |
| A7 | **`GET /teams/{id}`** | **Jeder eingeloggte User kann jedes Team abrufen** — inklusive Mitgliedernamen | Unkritisch für die App (Teamnamen sind ohnehin öffentlich in Turnieren), aber ein Design-Entscheidung die bewusst getroffen werden sollte | ✅ Done |
| A8 | **`GET /matches/{id}/results`** | **Kein Check ob User zum Turnier gehört** | Ergebnisse sind tendenziell öffentlich, aber konsistenter wäre es, den Turnier-Sichtbarkeits-Check zu nutzen | ✅ Done |

### Frontend-Sichtbarkeitsmatrix (Ist vs. Soll)

Was sieht welcher User auf der **Tournament-Detail-Seite**?

| UI-Element | Gast (nicht eingeloggt) | Teilnehmer | Referee | Manager | Admin | Ist-Zustand | Soll-Zustand |
|---|---|---|---|---|---|---|---|
| **Turnier-Name/Meta** | ❌ kein Zugang | ✅ | ✅ | ✅ | ✅ | ✅ sehen alle | ✅ OK für public, private nur mit Berechtigung |
| **Turnier-Ablauf (Timeline)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Beschreibung** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **"Mein nächstes Spiel" Card** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ nur wenn `myTournamentTeam` existiert | ✅ korrekt |
| **"Mit Team beitreten" Button** | ❌ | ❌ (schon drin) | ✅ sieht ihn | ✅ sieht ihn | ✅ sieht ihn | 🟡 Referee/Manager/Admin ohne Team sehen den Button — ist das gewollt? | Sinnvoll: Admins könnten auch spielen wollen |
| **"Team abmelden" Button** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ nur wenn kein Bracket | ✅ |
| **Bracket-Tab** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ alle sehen es | ✅ |
| **Bracket: Match anklicken → Ergebnis** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ korrekt via `canReferee` | ✅ |
| **Teilnehmer-Tab** | ❌ | ✅ sieht Teams | ✅ sieht Teams | ✅ + Check-in/Remove | ✅ + Check-in/Remove | ✅ | ✅ |
| **"Einstellungen"-Tab** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ via `canManage` | ✅ |
| **"Turnier-Leitstand" Card** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ via `canManage` | 🟡 Nur Admin sollte Bracket generieren + starten können (Backend prüft Admin, UI zeigt es aber Managern) |
| **"Turnier löschen" Button** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ via `userRole === ADMIN` | ✅ |

### 🔴 Autorisierungs-Probleme (Muss gefixt werden)

| # | Problem | Bereich | Begründung | Status |
|---|---------|---------|------------|--------|
| A1 | **Kein Frontend-Route-Guard** — es gibt keine `middleware.ts`. Ein nicht-eingeloggter User kann `/tournaments`, `/teams`, `/profile` aufrufen. Die Seiten laden dann ins Leere (API-Calls schlagen fehl, User sieht leere Seite oder Fehler). | Route Protection | **Jakobs Law**: Jede Web-App redirected nicht-eingeloggte User automatisch zum Login. Next.js `middleware.ts` ist der Standardweg | ✅ Done |
| A2 | **Turnier-Detail-Seite hat keinen 403/404 Fallback** — wenn ein User ein privates Turnier aufruft, auf das er keinen Zugriff haben sollte, bekommt er trotzdem alle Daten (Backend prüft nicht). Frontend zeigt keine "Kein Zugriff"-Seite | Access Denied UX | User sollte eine verständliche "Nicht gefunden / Kein Zugriff"-Seite sehen | ✅ Done |
| A3 | **"Turnier-Leitstand" zeigt Buttons die nur Admin ausführen kann auch Managern** — "Spielplan generieren" und "Turnier starten" rufen Endpoints auf die `require_role(ADMIN)` verlangen, aber der Leitstand wird für `canManage` (= Admin ODER Manager) angezeigt. Manager klickt → bekommt 403 → `alert()` | Frontend/Backend Mismatch | Entweder Backend auf Manager+ ändern, oder UI nur für Admin zeigen | ✅ Done |
| A4 | **Rollen-Liste (`GET /tournaments/{id}/roles`) ist für alle sichtbar** — jeder eingeloggte User kann die Rollen-Zuweisungen (inkl. User-ID und Name) eines beliebigen Turniers abrufen | Information Leak | Nur Turnier-Rollen-Inhaber oder zumindest Turnier-Teilnehmer sollten das sehen | ✅ Done |

### 🟡 Autorisierungs-Überlegungen (Sollte angegangen werden)

| # | Problem | Bereich | Begründung | Status |
|---|---------|---------|------------|--------|
| A5 | **Private Turniere haben keinen Einladungs-Mechanismus** — ein privates Turnier ist nur "privat" weil es nicht in der Liste erscheint. Jeder mit der UUID kann beitreten. Es gibt keinen Invite-Link wie bei Teams. *Status: Umgesetzt (Token wird generiert, `?invite=` URL, Backend validiert Token).* | Feature Gap | Für MVP akzeptabel (URL = Einladung), aber für "echte" Privatheit braucht man einen Invite-Flow | ✅ Done |
| A6 | **System-Admin-Panel im Mobile-Nav sichtbar für Admins, aber ohne Indikation was es ist** — normaler User erwartet kein "Admin"-Tab. Wenn ein normaler User (der kein System-Admin ist) die URL `/admin` direkt aufruft, zeigt das Frontend-Layout kurz den Content, bevor `redirect()` greift (Flash of Unauthorized Content) | UX Polish | Admin-Layout prüft `user && !user.is_system_admin` — aber `user` ist initially `null` während des Ladens, also wird der Redirect erst nach API-Response ausgeführt | ✅ Done |
| A7 | **`join_tournament` prüft nicht ob der User Team-Captain/Mitglied des Teams ist** — theoretisch kann jeder eingeloggte User ein beliebiges (vollständiges) Team zu einem Turnier anmelden, auch wenn er nicht zum Team gehört | Logic Gap | Sollte prüfen ob `current_user.id` Mitglied des `team_id` ist | ✅ Done |
| A8 | **Token wird in `localStorage` gespeichert** — Standard-Ansatz, aber XSS-anfällig. Cookie wird nur für Middleware-Route-Protection gesetzt, aber es gibt keine Middleware | Redundanz | Cookie-Logik in `auth.ts` ist aktuell toter Code. Entweder Middleware implementieren oder Cookie-Code entfernen | ✅ Done (via Middleware) |
| A9 | **`generate_sms_code` gibt immer `"123456"` zurück** — offensichtlich Development-Only, aber es gibt keinen Guard der verhindert, dass das in Production deployed wird | Security | Environment-Variable oder Compile-Time-Check | ✅ Done |
| A10 | **`onboarding`-Seite hat keinen Guard** — ein User der bereits ein vollständiges Profil hat, kann trotzdem `/onboarding` aufrufen und sein Profil nochmal "erstellen". Kein Schaden, aber kein sauberes Routing | Edge Case | Onboarding sollte prüfen ob User schon vollständig ist und redirecten | ✅ Done |

### Rollen → UI-Sichtbarkeit (Soll-Konzept für maximale UX)

> **Teslers Law**: Komplexität für den Endnutzer minimieren. Admin-/Manager-Features sollen nur sichtbar sein wenn relevant.

```
┌──────────────────────────────────────────────────────────────┐
│                    NICHT EINGELOGGT                           │
│                                                              │
│  Landing Page (/) → "Jetzt loslegen" → /login                │
│  Login (/login) → OTP-Flow                                   │
│  Reset (/reset) → Placeholder                                │
│                                                              │
│  Alle anderen Routen → Redirect zu /login                    │
│  (Aktuell: NICHT implementiert, User sieht leere Seite)      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    EINGELOGGTER USER                          │
│                                                              │
│  /tournaments    → Liste eigener Turniere + "Neues Turnier"  │
│  /tournaments/id → Übersicht, Spielplan, Teilnehmer          │
│                    + "Mit Team beitreten" wenn erlaubt        │
│                    + "Mein nächstes Spiel" wenn teilnehmend   │
│  /teams          → Eigene Teams + Erstellen + Einladen       │
│  /profile        → Name, Email, Theme, Logout                │
│                                                              │
│  NICHT sichtbar:                                             │
│  - Turnier-Leitstand                                         │
│  - Check-in/Remove Buttons bei Teilnehmern                   │
│  - Einstellungen-Tab                                         │
│  - Match-Ergebnis-Dialog (nicht klickbar)                     │
│  - Admin-Nav-Item                                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    REFEREE (im Turnier)                       │
│                                                              │
│  Alles wie User, PLUS:                                       │
│  - Bracket: Matches anklicken → Ergebnis eintragen           │
│                                                              │
│  NICHT sichtbar:                                             │
│  - Turnier-Leitstand                                         │
│  - Check-in/Remove Buttons                                   │
│  - Einstellungen-Tab                                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    MANAGER (im Turnier)                       │
│                                                              │
│  Alles wie Referee, PLUS:                                    │
│  - Check-in / Check-out / Team entfernen Buttons             │
│  - Einstellungen-Tab (Turnier-Details, Rollen verwalten)     │
│                                                              │
│  NICHT sichtbar:                                             │
│  - "Spielplan generieren" Button (nur Admin)                 │
│  - "Turnier starten" Button (nur Admin)                      │
│  - "Turnier löschen" Button (nur Admin)                      │
│  - Admin-Rollen zuweisen (nur Admin)                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    ADMIN (im Turnier)                         │
│                                                              │
│  Alles wie Manager, PLUS:                                    │
│  - Turnier-Leitstand: Spielplan generieren, Turnier starten  │
│  - "Turnier löschen" in Gefahrenzone                         │
│  - Alle Rollen vergeben                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    SYSTEM-ADMIN                               │
│                                                              │
│  Alles wie normaler User, PLUS:                              │
│  - /admin Tab in Navigation                                  │
│  - System-weite User-Liste und Stats                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 80:20 Umkehr — Hoher Aufwand, minimaler Effekt

> Diese Features klingen gut, würden aber unverhältnismäßig viel Aufwand kosten für minimalen User-Value in diesem Projektstadium.

| # | Feature | Aufwand | Warum 80:20 umgekehrt |
|---|---------|---------|----------------------|
| X1 | **Real-Time Updates via WebSockets** — Bracket live updaten wenn Ergebnisse eingehen | Hoch (Infra, State-Management, Reconnect-Logik) | Page-Refresh oder Polling reicht für ein Beerpong-Turnier mit 8–32 Teams. Man steht eh nebeneinander |
| X2 | **Internationalisierung (i18n)** — Alles auf Deutsch, also müsste man i18n Framework einbauen für EN Support | Hoch (jeden String extrahieren, Context-Provider, etc.) | Zielgruppe ist deutsch. Kein ROI |
| X3 | **Offline-Support / PWA mit Caching** | Hoch (Service Worker, Cache-Strategien, Sync-Logik) | Bei einem Bierpong-Turnier hat man WiFi/Mobilnetz. Offline ist kein reales Problem |
| X4 | **Labor Illusion** (künstliche Wartezeit mit Animation) | Mittel | Alle API-Calls sind <500ms. Es gibt nichts zu "simulieren". Falscher Use-Case |
| X5 | **Drag & Drop Seeding** im Bracket | Hoch (DnD Library, Complex State) | Random Seeding ist für Casual-Turniere perfekt. Manuelles Seeding braucht kein Mensch beim Beerpong |
| X6 | **Double Elimination Bracket** | Sehr hoch (komplett neuer Bracket-Algorithmus, UI-Redesign) | Single Elimination ist Standard beim Beerpong. Feature-Request für Later |
| X7 | **Detailliertes Statistik-Dashboard** (Cups getroffen, Win-Rate pro Spieler) | Hoch (neues Datenmodell, Charts, Aggregation) | Nett, aber man spielt 3–5 Spiele pro Turnier. Die Daten sind zu dünn für sinnvolle Stats |
| X8 | **Granulares Permission-System** (z.B. "Referee darf nur Ergebnisse seiner zugewiesenen Tische eintragen") | Hoch (Permission-Matrix, UI-Komplexität) | Bierpong-Turnier hat 1–20 Tische, Referee-Zuordnung ist informell. Over-Engineering |

---

## 5. Priorisierte Umsetzungsreihenfolge

### Phase 1: Kritische Fixes (MUSS sofort)
1. **L1** — `leave_tournament` Where-Klausel fixen (Data Corruption Bug)
2. **L10** — `started_at` aus `TournamentUpdate` entfernen
3. **U8** — Sichtbarkeits-Enum-Werte in Settings fixen
4. **A1 (Frontend)** — `middleware.ts` erstellen: nicht-eingeloggte User → Redirect zu `/login`
5. **A3** — Leitstand-Buttons: "Spielplan generieren" und "Turnier starten" nur für Admin zeigen (nicht Manager)
6. **U11** — `<Toaster />` ist bereits im Layout ✅ — jetzt alle `alert()` → `toast()` migrieren
7. **U1** — Alle 16 `alert()` → `toast()` (sonner) migrieren
8. **U2** — Alle 4 `confirm()` → `AlertDialog` migrieren

### Phase 2: Backend Robustheit & Auth
9. **L2** — Backend-Guard für `leave_tournament` (nicht nach Bracket)
10. **L6** — Guard gegen doppeltes Bracket-Generieren
11. **L7** — Guard gegen doppeltes `start_tournament`
12. **L3** — Commit-Pattern konsistent machen
13. **A7** — `join_tournament`: Prüfen ob User Mitglied des Teams ist
14. **A9** — `generate_sms_code`: Dev-Hardcode mit Environment-Guard absichern

19. **U12–U14** — Loading-States für alle Buttons
20. **U10** — Inline-Fehler im Join-Dialog statt `alert()`
21. **U22** — Confirm-Dialoge für "Spielplan generieren" und "Turnier starten"
22. **A2** — 403/404-Fallback-Seite für Turnier ohne Zugriff
23. **A6** — Admin-Layout: Loading-State abwarten bevor Redirect (kein Flash)

### Phase 4: Polish
24. **U15** — Gewinner-Highlight im Bracket-View
25. **U17** — Login: Telefonnummer richtig formatieren
26. **U18** — Turnier-Liste: Aktive zuerst
27. **U19** — Empty-State im Join-Dialog
28. **U20** — Admin-Icon Konsistenz
29. **U21** — Dirty-State Tracking in Tournament Settings
30. **U7/U23** — Success-Toasts statt `alert()`
31. **A8** — Toter Cookie-Code in `auth.ts` aufräumen
32. **A10** — Onboarding-Guard: Bereits fertige User redirecten

> [!IMPORTANT]
> **L1 ist ein kritischer Bug**: Die `leave_tournament` Funktion hat eine leere `.where()` Klausel im `delete()` Statement. Das muss sofort gefixt werden — im besten Fall passiert nichts (SQLAlchemy wirft einen Fehler), im schlimmsten Fall werden **alle** TournamentTeam-Einträge gelöscht.

> [!WARNING]
> **U8 ist ein stiller Datenverlust**: Die Sichtbarkeits-Optionen in den Tournament Settings verwenden falsche Enum-Werte (`PUBLIC`/`PRIVATE` statt `public_listed`/`private`). Jeder Speichervorgang in den Settings könnte den Sichtbarkeitswert korrumpieren.

> [!CAUTION]
> **A1 (Route Protection fehlt)**: Aktuell gibt es keine `middleware.ts`. Ein nicht-eingeloggter User, der `/tournaments` oder `/teams` direkt aufruft, sieht eine leere/kaputte Seite statt eines Redirects zum Login. Das ist die grundlegendste UX-Erwartung im Web.

---

### Phase 5: Final Polish (Neu hinzugefügt)
33. **U28** — Markdown Preview: Implement for tournament descriptions in edit mode. ✅ Done
34. **UX Bug Fix** — Logout and Login state synchronization (Fetch Caching deaktiviert, damit Navbar/Profile State korrekt refreshen). ✅ Done
35. **Repo Cleanup & DB Reset** — Unused test files checked, DB Schema dropped & re-migrated. ✅ Done

## Verification Plan

### Automated Tests
- `uv run python -m pytest` — Lifecycle Test muss grün bleiben
- `pnpm run build` — TypeScript-Checks

### Manual Verification
- Einmal den kompletten Turnier-Lifecycle im Browser durchspielen
- Alle Toasts visuell prüfen (Error, Success)
- Mobile-Ansicht testen (Bottom-Nav, Dialoge)
- **Auth-Szenarien testen**:
  - Nicht eingeloggt → jede Route aufrufen → muss zu `/login` redirecten
  - Als normaler User → private Turnier-UUID direkt aufrufen → soll sinnvolle Fehlermeldung zeigen
  - Als Manager → "Spielplan generieren" Button → soll nicht sichtbar sein
  - Als Admin → kompletten Lifecycle durchspielen → alles verfügbar
