# AGENTS.md

## Setup
- Frontend: `pnpm install && pnpm dev` (apps/web)
- Backend: `uv sync && uv run fastapi dev` (apps/api)
- Test-Turniere mit Dummy-Spielern/-Teams (bleiben in der DB, werden wiederverwendet): `uv run python -m scripts.seed_dummy_tournaments create --teams 28 --state running` (apps/api; `--state fresh|running|finished`, `delete` entfernt nur die Dummy-Turniere, `token N` gibt ein Bearer-Token von Dummy Spieler N aus; Dummy-Login in der App: `+49 158 99000001`, SMS-Code `123456`)

## Tests (müssen vor PR grün sein)
- Unit: `pnpm test` (Vitest)
- E2E: `pnpm test:e2e` (Playwright)
- Alle Changes müssen lokal verifiziert sein, bevor ein PR erstellt wird — kein "hoffentlich funktioniert's"

## Branch/Commit Rules
- Nie direkt auf main pushen, immer Feature-Branch + PR
- Commits nach Conventional Commits (feat, fix, chore, docs, refactor, test, ci, perf, style)
- main = immer deploybar, Publish nur bei git tag v*.*.*

## Code-Qualität
- Best Practices statt Quick-Fixes: etablierte Patterns der jeweiligen Sprache/Frameworks nutzen (React, FastAPI, TypeScript-Konventionen), keine Eigenkonstruktionen ohne Grund
- Wiederverwendbarkeit vor Duplikation: gemeinsame Logik in Hooks, Utils, Shared-Modules auslagern statt Copy-Paste
- Allgemeine Lösungen bevorzugen: keine Hardcoded-Edge-Cases oder Nischenlösungen für einzelne Sonderfälle — wenn ein Problem generisch lösbar ist, generisch lösen
- Vor jedem Fix: bestehenden Code hinterfragen, nicht nur Code addieren
  - Frage dich: Ist der Fix ein Symptom eines strukturellen Problems?
  - Gibt es eine Stelle im bestehenden Code, die durch Umbau statt Erweiterung das Problem eliminiert?
  - Wächst die Codebase nur, weil an der falschen Stelle gepatcht wird?
  - Bevorzuge Refactoring/Vereinfachung über additive Patches, wenn beides möglich ist
- Bevor du einen Fix implementierst, beschreibe kurz im PR/Commit, warum du dich für Patch vs. Refactor entschieden hast

## UI/UX (jede Frontend-Änderung)
Ausgangslage: Die App wird **vor Ort am Handy, einhändig und oft unter Zeitdruck** benutzt (Turnier, Orga-Team, Spieler). Jeder Screen beantwortet: *Wo bin ich? Wie ist der Stand? Was ist der nächste sinnvolle Schritt?* Entscheidungen werden begründet mit den Laws of UX, nicht mit Geschmack.

### Laws of UX – so wenden wir sie an
- **Hick's Law:** Wenige Optionen pro Screen. Optionales per Progressive Disclosure (Beispiel: Check-in-Zeitfelder erscheinen erst, wenn Check-in aktiviert ist). Irrelevante Schritte weglassen (Timeline ohne Check-in hat keinen Check-in-Schritt).
- **Fitts's Law:** Touch-Ziele mindestens 36–44 px mit Abstand. Primäre Aktion groß und mit dem Daumen erreichbar; destruktive Aktionen (Entfernen, Löschen) nie direkt neben der Primäraktion.
- **Jakob's Law:** Bekannte Muster und die vorhandenen shadcn/Base-UI-Komponenten nutzen, keine Eigenbauten (Schalter, Dialoge, Tabs).
- **Miller's Law / Chunking:** Zusammengehöriges gruppieren (Cards, Abschnitte), keine langen unstrukturierten Formulare.
- **Law of Proximity / Common Region:** Beschriftung, Hilfetext und Fehlermeldung stehen direkt am Feld.
- **Von Restorff:** Pro Screen genau eine hervorgehobene Primäraktion.
- **Goal-Gradient / Zeigarnik:** Fortschritt sichtbar machen (Phasen-Timeline, "5 von 8 Teams eingecheckt").
- **Doherty Threshold:** Rückmeldung unter ca. 400 ms: Ladezustand (Skeleton/Spinner), optimistische Updates mit Rollback, Toast nach Aktionen.
- **Postel's Law:** Eingaben großzügig akzeptieren (Telefonnummer in verschiedenen Schreibweisen), Ausgaben strikt und einheitlich.
- **Tesler's Law:** Komplexität gehört ins Backend, nicht zum Nutzer. Regeln wie Phasen, Fristen oder Start-Logik entscheidet die API; das Frontend zeigt nur an, was sie liefert (`phase`, `registration_open`, `checkin_open`).
- **Aesthetic-Usability / Peak-End:** Wichtige Momente (Turnierstart, Sieger) bewusst gestalten; Konsistenz in Abständen, Farben, Begriffen.

### Praxisregeln (Nielsen-Heuristiken)
- **Systemstatus sichtbar:** Der Zustand eines Turniers ist immer erkennbar (Status-Badge, Timeline).
- **Fehler vermeiden statt melden:** Eingaben vor dem Senden prüfen (Inline-Fehler am Feld, Speichern gesperrt), identische Regeln wie im Backend. Unumkehrbare Aktionen brauchen einen Bestätigungsdialog, der die **konkreten Folgen** nennt (z. B. welche Teams entfernt werden).
- **Gesperrtes erklären:** Ein deaktivierter Button braucht einen sichtbaren Grund im Text (auf dem Handy gibt es keinen Tooltip).
- **Fehlertexte:** sagen, was passiert ist und wie es weitergeht; Deutsch, Du-Form, keine Fachbegriffe oder Fehlercodes.
- **Konsistente Begriffe:** Anmeldung, Check-in, Turnier starten, Team. Buttons mit Verb + Objekt ("Turnier starten"), nie "OK" oder "Submit".
- **Erkennen statt Erinnern:** Relevante Info dort anzeigen, wo sie gebraucht wird (z. B. eigener Check-in-Status auf der Turnierseite).

### Barrierefreiheit (WCAG 2.2 AA)
- Textkontrast mindestens 4.5:1, auch auf farbigen Flächen und im Dark Mode.
- Information nie nur über Farbe: immer Text oder Icon dazu (z. B. "Eingecheckt" mit Haken).
- Jedes Eingabefeld hat ein Label; Icon-Buttons ein `aria-label` mit Objektbezug ("Team A entfernen"); Zustände über `aria-pressed`/`aria-current`/`role="progressbar"`.
- Semantisches HTML (`ol`, `button`, `label`), vollständig per Tastatur bedienbar, Animationen respektieren `prefers-reduced-motion`.

### Vor dem PR
- Geänderte Screens **im Browser ansehen**: mobil (375 px Breite) und Desktop, hell und dunkel, alle relevanten Zustände (leer, lädt, Fehler, gesperrt, Erfolg).
- Neue Logik und Komponenten bekommen Vitest-Tests; wiederverwendbare Bausteine werden extrahiert (`components/`, `lib/`), statt Seiten weiter aufzublähen.

## Do not
- Keine Secrets committen
- Docker-Publish-Workflow nicht manuell antriggern
- Keinen Code hinzufügen, um Symptome zu kaschieren, wenn die Ursache im bestehenden Code liegt
- Keine Speziallösungen für Einzelfälle, wenn eine generische Lösung möglich ist