# Our Network

> Onze mensen. Onze momenten. Ons verhaal.

Persoonlijke PWA van Bjorn en Stephanie. Twee geïntegreerde onderdelen:

- **Our Network** — een interactieve kaart met Bjorn & Stephanie in het midden en iedereen die deel uitmaakt van hun leven op concentrische ringen (familie het dichtst bij, kennissen het verst).
- **Our Story** — een chronologische tijdlijn van ontmoetingen, relaties en herinneringen, met foto's, gekoppeld aan de personen.

Onderdeel van het persoonlijke app-ecosysteem naast Bjorn Finance en Be Strong, met dezelfde architectuur.

## Stack

| | |
|---|---|
| Frontend | Vite 5, React 18, TypeScript (strict), Tailwind 3 met CSS-tokens, react-router 7 |
| Data | Dexie (IndexedDB) local-first + outbox-synchronisatie |
| Backend | Supabase-project van Be Strong, als gast-app met prefix `net_` (Postgres + RLS, Auth, privé-bucket `net-photos`). Zie [SUPABASE_SHARED.md](SUPABASE_SHARED.md) |
| PWA | vite-plugin-pwa (Workbox), enkel de app-shell wordt gecachet |
| Tests | Vitest (unit + sync), RLS-tests op echte Postgres (PGlite), Playwright (e2e, offline) |
| Hosting | GitHub Pages via GitHub Actions |

De netwerkkaart is een eigen SVG-component (pan, zoom, knijpen, slepen, automatische layout zonder overlap): geen extra bibliotheek nodig. Zie [docs/PLAN.md](docs/PLAN.md) voor het volledige ontwerp.

## Structuur

```
src/
  domain/        pure logica: layout van de kaart, tijdlijn, statistieken, datums
  lib/db         lokale database, schrijflaag (soft delete + outbox), live store
  lib/sync       outbox, sync-engine (pull/push/conflicten), scheduler
  lib/backend    Supabase + lokale testbackend (alleen `--mode devlocal`)
  lib/actions.ts alle wijzigingen (personen, relatiegeschiedenis, gebeurtenissen, foto's …)
  features/      network · persons · story · dashboard · settings · auth
supabase/
  migrations/    versioned SQL (schema, RLS, standaardinhoud, storage)
  setup-productie.sql  alle migraties in één bestand (gegenereerd)
tests/           unit · rls · e2e
```

## Datamodel (kort)

`profiles` (Bjorn, Stephanie) · `categories` · `persons` · `person_connections` · `relationships` ·
`network_positions` · `contact_history` · `event_categories` · `events` · `event_persons` · `event_profiles` ·
`event_photos` · `photo_persons` · `relationship_history` · `members` · `allowed_emails`.

- Datum van gebeuren (`event_date`, `first_met_at`, `effective_date`, met precisie dag/maand/jaar) staat los van `created_at`.
- Een categoriewijziging overschrijft niets: elke wijziging is een rij in `relationship_history` met ingangsdatum.
- Geen DELETE-rechten op datatabellen: verwijderen = `deleted_at`. Archiveren = `archived_at`. Gebeurtenissen blijven altijd bestaan.
- Privé-herinneringen (`is_private`) zijn via RLS enkel zichtbaar voor de maker.

## Productie

**App (PWA):** https://byornn1993.github.io/Our-Network/ met de gegevens in het Supabase-project van Be Strong. Alles van Our Network heet `net_…`; Be Strong en Boodschappenlijst blijven ongemoeid (getest in `tests/rls/shared-project.test.ts`). Inloggen met het Be Strong-account. Installatie en overzetten: [STAPPENPLAN.md](STAPPENPLAN.md).

**Artifact (reserve):** de eerste versie draaide als claude.ai-Artifact:
https://claude.ai/artifact/A5euRhFGiwRrz2RfmLkVzq — zie [docs/archief/PLAN-ARTIFACT.md](docs/archief/PLAN-ARTIFACT.md) (gearchiveerd: de artifact is enkel nog reserve).

```bash
npm run build:artifact
```

Dit bouwt `dist-artifact/` (`page.html` + `artifact-files.json`), dat met het Artifact-tool gepubliceerd wordt
(capabilities `db` met rules, `user`, `assets`, `downloads`). Toegang: eigenaar + per e-mail uitgenodigde Editors, geen openbare link.

## Lokaal ontwikkelen

```bash
npm install
npm run dev:local
```

`dev:local` draait volledig in de browser met een nagebootste backend (elk e-mailadres, wachtwoord `dev-password`). Er gaat niets naar Supabase en dit zit niet in de productiebuild.

Tegen een echte Supabase: kopieer `.env.example` naar `.env`, vul URL en publishable key in, en `npm run dev`.

## Testen

```bash
npm test
```

```bash
npm run test:e2e
```

- `npm test`: domeinlogica, sync tussen twee toestellen (conflicten, offline, deterministische koppelingen), back-up, én alle migraties + RLS-policies op een echte Postgres (PGlite) met drie gebruikers (lid, uitgenodigd lid, vreemde).
- `npm run test:e2e`: Playwright op iPhone-formaat tegen een build in testmodus, inclusief offline.

## Database installeren / wijzigen

Zie [STAPPENPLAN.md](STAPPENPLAN.md). Nieuwe migratie: voeg een bestand toe in `supabase/migrations/` en draai `npm run gen:setup-sql`. Migraties worden nooit automatisch op productie uitgevoerd.

## Deploy

Elke push naar `main` → GitHub Actions → typecheck, lint, tests, build → GitHub Pages.
Repo-variabelen (Settings › Secrets and variables › Actions › Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
Nooit een service-role/secret key in de frontend of in GitHub.
