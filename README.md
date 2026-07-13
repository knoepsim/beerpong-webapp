[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)


# Beerpong Webapp

Willkommen zur Beerpong Webapp!

Dieses Projekt nutzt einen modernen Tech-Stack (Next.js, FastAPI, Docker) in einem Monorepo-Setup.

## Dokumentation

Die ausführliche Dokumentation, Architektur-Beschreibungen und Anforderungen findest du im [`/docs` Verzeichnis](./docs/README.md).

## Struktur

- `apps/web/`: Frontend (Next.js, React, Tailwind, Shadcn)
- `apps/api/`: Backend (FastAPI, Python)
- `docs/`: Projektdokumentation
- `.github/`: CI/CD Workflows

## Lokales Setup

Mit Docker Compose kannst du die komplette Umgebung lokal starten:

```bash
docker-compose up --build
```
