# AGENTS.md

## Setup
- Frontend: `pnpm install && pnpm dev` (apps/web)
- Backend: `uv sync && uv run fastapi dev` (apps/api)

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

## Do not
- Keine Secrets committen
- Docker-Publish-Workflow nicht manuell antriggern
- Keinen Code hinzufügen, um Symptome zu kaschieren, wenn die Ursache im bestehenden Code liegt
- Keine Speziallösungen für Einzelfälle, wenn eine generische Lösung möglich ist