# Contributing Guidelines

Wir verwenden das **GitHub Flow** Branching-Modell. 
Der `main`-Branch ist immer stabil und deploybar.

## 🌿 Branching & Pull Requests

1. **Branch erstellen:** Erstelle für jedes Feature oder jeden Bugfix einen eigenen Branch vom `main`  
Format: <type>/<kurze-beschreibung>
Types: feat, fix, refactor, chore, docs, test, ci
Beispiele: feat/web-slider-component, fix/api-cors-config
Nur Kleinbuchstaben, Bindestriche statt Leerzeichen/Unterstriche
2. **Commit:** Wir nutzen [Conventional Commits (v1.0.0)](https://www.conventionalcommits.org/de/v1.0.0/) für unsere Commit-Nachrichten (z.B. `feat: add new slider`, `fix: header padding`). Pushe danach auf deinen Branch.
3. **Pull Request (PR) erstellen:** Erstelle einen PR gegen den `main`-Branch.


## 🚧 CI/CD Workflow & PR-Gates

Bevor dein PR in den `main` gemerged werden kann, müssen zwingend alle automatisierten **PR-Gates** (Status Checks) erfolgreich durchlaufen sein:

- **Keine geleakten Secrets:** Der *Gitleaks*-Scanner prüft, ob versehentlich Passwörter oder Tokens eingecheckt wurden.
- **Unit Tests & Coverage:** Alle *Vitest* Tests müssen grün sein. Die Testabdeckung darf nicht signifikant sinken.
- **E2E Tests:** Die *Playwright* Tests müssen fehlerfrei im Headless-Browser durchlaufen.
- **SonarCloud Quality Gate:** Coverage und Code-Quality Kriterien müssen von SonarQube abgesegnet werden.
- **Docker Build Check:** Die Docker-Images für `apps/web` und `apps/api` müssen sich erfolgreich bauen lassen (Dry-Run).

Ohne diese erfolgreichen Checks blockiert GitHub den "Merge"-Button.

## 🚀 Releases

Releases werden erst **nach** einem erfolgreichen Merge in den `main` getriggert, und zwar manuell per Git Tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Sobald du ein solches Tag pusht, greift die `docker-publish.yml` Pipeline und lädt die finalen Container-Images in die Registry (GHCR) hoch. Watchtower auf deinem Server kann sich diese dann automatisch ziehen.
