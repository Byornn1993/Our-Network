# Overdracht Our Network (naar Claude Cowork)

Laatst bijgewerkt: 21 november 2026 · laatste commit vóór deze overdracht: `74908aa`

**Projectmap (vaste werkmap):** `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\Our Network`

Lees dit document en [CLAUDE.md](CLAUDE.md) eerst. Daarna: [README.md](README.md), [SUPABASE_SHARED.md](SUPABASE_SHARED.md) en [docs/AUDIT.md](docs/AUDIT.md).

---

## 1. Wat is Our Network?

Our Network is de persoonlijke app (PWA) van Bjorn en zijn vriendin Stephanie. Ze bestaat uit twee delen:

- **Netwerk:** een interactieve kaart met "Bjorn & Stephanie" in het midden. Iedereen uit hun leven staat op ringen eromheen, volgens categorie: familie het dichtst bij, dan beste vrienden, goede vrienden, collega's en kennissen. Partners staan naast elkaar, en je kunt mensen zelf verslepen.
- **Our Story:** een tijdlijn van momenten (ontmoetingen, relaties, herinneringen) met foto's, gekoppeld aan personen. Er is ook een overzicht met statistieken en een jaaroverzicht.

De app draait op de iPhone als app op het beginscherm, en op de laptop in de browser. Ze werkt eerst lokaal en offline, en synchroniseert dan met Supabase. Bjorn en Stephanie delen dezelfde gegevens.

**Live:** https://byornn1993.github.io/Our-Network/ · **Code:** https://github.com/Byornn1993/Our-Network (publieke repo, branch `main`)

---

## 2. Huidige status

### Werkt (live en door Bjorn getest)
- Netwerkkaart met ringen, partners naast elkaar, verslepen ("Verplaatsen"), zoeken, filteren per categorie, zoomen en knijpen.
- Personen: toevoegen, bewerken, archiveren en verwijderen met "Ongedaan maken". Ook relaties, partners, een eerste-ontmoeting-moment en de geschiedenis van categoriewijzigingen.
- Our Story: momenten met datum (dag, maand of jaar), foto's, lightbox, filters en jaaroverzicht.
- Overzicht (dashboard): verjaardagen en statistieken.
- Instellingen: profielen, categorieën, soorten momenten, toegang (leden uitnodigen), synchronisatie, en back-up/import (formaat v2, met foto's).
- Huisstijl met licht/donker thema; standaard is donker.
- Inloggen met het **Be Strong-account** (zelfde Supabase-project).
- Gegevens zijn overgezet uit de oude artifact: 15 personen, 5 partners, 4 momenten, 2 persoonsfoto's.
- Menubalk onderaan op de iPhone bij het openen opgelost (commit `74908aa`); Bjorn bevestigde "werkt".
- Audit van november 2026 afgerond (zie [docs/AUDIT.md](docs/AUDIT.md)). `npm audit` voor productie geeft 0 lekken.

### Half af / door Bjorn zelf te doen
- **Profielfoto's:** Bjorn zet de profielfoto's zelf opnieuw in de app ("fotos voeg ik wel terug zelf toe").
- **Stephanie:** heeft nog geen toegang. Ze moet uitgenodigd worden (stappen in [STAPPENPLAN.md](STAPPENPLAN.md), deel D). Dit is nog niet getest met haar echte account.
- **"Dit ben ik":** Bjorn moet onder Instellingen › Profielen zijn profiel nog koppelen, als hij dat na de import niet deed. Dat is niet nagekeken.

### Nog te doen / mogelijk
- Playwright 1.49 → 1.65 (alleen testgereedschap; vraagt een browserdownload van ~150 MB).
- `NetworkMap.tsx` verder opsplitsen (een eigen hook voor slepen en zoomen). Dat bewust niet gedaan, omdat het zonder test op een echte iPhone te riskant is.
- 12–24 lintwaarschuwingen `react-refresh/only-export-components`. Die hebben geen invloed op de app.

---

## 3. Mappenstructuur

```
Our Network/
├─ HANDOVER.md            dit document
├─ CLAUDE.md              vaste werkafspraken voor Claude (wordt automatisch gelezen)
├─ README.md              technisch overzicht, starten, testen, deploy
├─ STAPPENPLAN.md         stappen voor Bjorn: database, Stephanie, iPhone-installatie
├─ SUPABASE_SHARED.md     contract voor het gedeelde Supabase-project (Be Strong + B lists + Our Network)
├─ .env / .env.example    Supabase-URL + publishable key (.env staat NIET in git)
├─ .claude/launch.json    dev-servers voor de browser in de Claude-app (poorten 5174 en 4174)
├─ .github/workflows/     ci.yml (tests bij elke push) en deploy.yml (main → GitHub Pages)
├─ docs/
│  ├─ AUDIT.md            audit november 2026: metingen, wat gedaan is, wat bewust niet
│  ├─ PLAN.md             origineel ontwerp (datamodel, schermen)
│  ├─ PROMPT-CONTROLE-EN-OPTIMALISATIE.md  opdracht van de audit (met harde regels)
│  ├─ screenshots/        voor/na-schermafbeeldingen van de audit (375 px)
│  └─ archief/            plannen uit de artifact-periode (enkel geschiedenis)
├─ public/                iconen (PWA, apple-touch-icon, favicon)
├─ scripts/
│  ├─ gen-setup-sql.mjs   voegt alle migraties samen tot supabase/setup-productie.sql
│  ├─ gen-icons.mjs       maakt de PWA-iconen
│  ├─ spa-fallback.mjs    kopieert index.html naar 404.html (diepe links op GitHub Pages)
│  └─ artifact-page.mjs   bouwt de reserve-versie als claude.ai-artifact
├─ supabase/
│  ├─ migrations/001..004_*.sql   schema, RLS, standaardinhoud, storage (alles net_)
│  ├─ migrations/LOG.md            welke migratie wanneer en door wie op productie gedraaid is
│  └─ setup-productie.sql          alle migraties in één bestand (gegenereerd, niet met de hand wijzigen)
├─ src/
│  ├─ main.tsx, App.tsx   start, routes (lazy geladen schermen), vooraf laden na 2,5 s
│  ├─ index.css           huisstijl-tokens (kleuren, gloed, schermhoogte --app-h)
│  ├─ domain/             pure logica: layout.ts (kaart, ringen, partners), timeline.ts, stats.ts, dates.ts, people.ts
│  ├─ lib/db/             Dexie-database (schema.ts), schrijflaag (repo.ts), live store (store.tsx), types
│  ├─ lib/sync/           outbox, sync-engine (pull/push/conflicten), scheduler, status
│  ├─ lib/backend/        supabase.ts (echt), local.ts (dev:local), artifact.ts (reserve), types
│  ├─ lib/actions.ts      alle wijzigingen (personen, relaties, momenten, foto's, ongedaan maken)
│  ├─ lib/backup.ts       back-up export/import (zod-schema, formaat v1/v2)
│  ├─ components/         layout (AppShell met menubalk/zijbalk), ui (Button, Sheet, Toast …), Avatar, useLeaveGuard
│  └─ features/           network · persons · story · dashboard · settings · auth
└─ tests/
   ├─ unit/               domein, sync tussen twee toestellen, back-up, ongedaan maken, artifact-backend
   ├─ rls/                migraties + RLS op echte Postgres (PGlite); shared-project.test.ts bewijst dat Be Strong en B lists ongemoeid blijven
   └─ e2e/flow.spec.ts    Playwright op iPhone-formaat (lokale testmodus, ook offline)
```

Mappen die niet in git staan (worden gegenereerd): `node_modules`, `dist`, `dist-e2e`, `dist-artifact`, `playwright-report`, `test-results`.

---

## 4. Technologie

| Onderdeel | Wat | Versie |
|---|---|---|
| Taal | TypeScript (strict) | 5.6.3 |
| UI | React + React DOM | 18.3.1 |
| Routing | react-router-dom | 7.18.5 |
| Build | Vite + @vitejs/plugin-react | 5.4.21 / 4.3.3 |
| Styling | Tailwind CSS (kleuren via CSS-tokens en `color-mix`) | 3.4.15 |
| Lettertype | Inter (via @fontsource-variable/inter) | 5.1.0 |
| Iconen | lucide-react | 0.460.0 |
| Lokale database | Dexie + dexie-react-hooks (IndexedDB) | 4.0.10 / 1.1.7 |
| Validatie | zod (enkel back-up importeren) | 4.6.7 |
| Datums | date-fns (nl-locale) | 4.1.0 |
| Backend | @supabase/supabase-js | 2.50.0 |
| PWA | vite-plugin-pwa (Workbox) | 0.21.0 |
| Tests | Vitest, PGlite (Postgres in het geheugen), fake-indexeddb, Playwright | 2.1.9 / 0.2.13 / 6.0.0 / 1.49.0 |
| Lint | ESLint + typescript-eslint | 9.39.5 / 8.15.0 |
| Runtime | Node.js (CI gebruikt Node 22) | 22 |
| Hosting | GitHub Pages via GitHub Actions | — |

---

## 5. Starten, testen en uitrollen

Alle commando's in de projectmap. Op deze pc: Git Bash of PowerShell. Python is er niet: gebruik `node` voor scripts.

### Starten (zonder Supabase, aanbevolen om te ontwikkelen)
1. `npm install` (eenmalig, of na een wijziging aan package.json)
2. `npm run dev:local`
3. Open http://localhost:5173 (of 5174 via `.claude/launch.json`, naam `our-network-local`). Log in met een willekeurig e-mailadres en wachtwoord `dev-password`. Alles blijft in de browser; er gaat niets naar Supabase.

### Starten tegen de echte Supabase
1. Zorg dat `.env` bestaat (kopie van `.env.example`, met URL en publishable key).
2. `npm run dev`. **Let op:** dan werk je met de echte gegevens.

### Testen
1. `npm run typecheck` · `npm run lint` (0 fouten verwacht)
2. `npm test`: 57 tests (domein, sync, back-up, RLS op PGlite)
3. `npm run test:e2e`: 4 Playwright-tests
4. `npm run build:artifact` moet blijven slagen (reserve-artifact), maar publiceren hoeft niet.
5. Een productiebuild lokaal in Git Bash: `MSYS_NO_PATHCONV=1 BASE_PATH=/Our-Network/ npm run build`. Zonder `MSYS_NO_PATHCONV` maakt Git Bash er een Windows-pad van.

### Uitrollen
1. Kleine Nederlandstalige commits op `main`.
2. **Pas pushen na Bjorns uitdrukkelijke "ja".**
3. `git push` → GitHub Actions draait CI ("CI") en deploy ("Deploy naar GitHub Pages").
4. Volg de runs via de publieke API, want `gh` staat niet op deze pc. Bijvoorbeeld: `curl -s "https://api.github.com/repos/Byornn1993/Our-Network/actions/runs?head_sha=<sha>"`.
5. Controleer de live app met `?v=<sha>`, omdat Pages ongeveer 10 minuten cachet. In de browser van de Claude-app: eerst de service worker uitschrijven en de caches leegmaken. Een diepe link zoals `/login` geeft HTTP 404 met de app erin; dat is normaal (SPA-fallback).
6. Op de iPhone: de app één of twee keer volledig sluiten en heropenen. Ze toont ook "Nieuwe versie beschikbaar".

### Git-identiteit
Op deze pc is geen globale git-naam ingesteld. Commits gebeuren als Bjorn, per commando: `git -c user.name="Bjorn Wevers" -c user.email="<Bjorns e-mail>" commit …`. Het e-mailadres staat in de eerdere commits (`git log -1 --format=%ae`). Pushen werkt via Git Credential Manager; dat is al ingelogd.

---

## 6. Waar staat de data?

| Waar | Wat |
|---|---|
| **Supabase-project van Be Strong** (ref `mngqptjikxeihmmnibio`, regio eu-west-1, gratis plan) | De echte gegevens. Our Network is er een **gast-app**: alles heet `net_…`. |
| Tabellen (schema `public`, 16 stuks, allemaal met RLS, geen rechten voor `anon`) | `net_profiles` (Bjorn, Stephanie) · `net_categories` · `net_persons` · `net_person_connections` · `net_relationships` · `net_network_positions` · `net_contact_history` · `net_event_categories` · `net_events` · `net_event_persons` · `net_event_profiles` · `net_event_photos` · `net_photo_persons` · `net_relationship_history` · `net_members` · `net_allowed_emails` |
| Functies | `net_set_row_meta`, `net_is_member`, `net_claim_membership`, `net_event_visible`, `net_photo_visible` |
| Storage | Privé-bucket `net-photos` (foto's worden verkleind tot max. 1600 px) |
| Toestel (IndexedDB via Dexie, versie 1) | Lokale kopie + wachtrij (outbox) van wijzigingen die nog naar de server moeten |
| localStorage | `ournetwork-theme` (licht/donker), `ournetwork-auth` (Supabase-sessie, eigen sleutel zodat de Be Strong-login niet botst) |
| Back-upbestand (JSON, formaat `our-network-backup` v2) | Download via Instellingen › Gegevens. Bevat alle tabellen + foto's als data-URL. Moet compatibel blijven. |
| Reserve-artifact | https://claude.ai/artifact/A5euRhFGiwRrz2RfmLkVzq ("B Netwerk"): de eerste versie. Niet meer in gebruik; wijzigingen daar komen niet in de app. |

**Opbouw in het kort:**
- Elke rij heeft `id` (UUID), `created_at`, `updated_at` en `deleted_at` (soft delete). Personen hebben ook `archived_at`.
- Datums van gebeurtenissen (`event_date`, `first_met_at`, `effective_date`) staan los van `created_at` en hebben een precisie: dag, maand of jaar.
- Een categoriewijziging overschrijft niets: elke wijziging is een rij in `net_relationship_history`.
- Privé-herinneringen (`is_private`) zijn via RLS alleen zichtbaar voor de maker.
- Koppel-id's voor partners zijn deterministisch (uuid v5), zodat twee toestellen offline dezelfde rij maken.
- Sync werkt met een cursor op `updated_at`. Push stopt bij het eerste conflict; dat zie je in Instellingen › Synchronisatie.

Geen Excel, geen andere API's.

---

## 7. Instellingen en omgevingsvariabelen (alleen namen)

| Naam | Waar | Waarvoor |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (lokaal) en GitHub › Settings › Secrets and variables › Actions › **Variables** | Project-URL van Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | idem | Publishable key (openbaar bedoeld, beveiliging zit in RLS) |
| `BASE_PATH` | deploy.yml (`/Our-Network/`) of lokaal bij een productiebuild | Submap op GitHub Pages |
| Vite-modes | `--mode devlocal` (nagebootste backend), `--mode artifact` (reserve-artifact) | Andere backend kiezen |

Supabase › Authentication › URL Configuration: de Site URL blijft van **Be Strong**. Bjorn heeft de redirect-URL `https://byornn1993.github.io/Our-Network/**` zelf toegevoegd op 16 november 2026. Registreren staat uit: nieuwe gebruikers maakt Bjorn aan in Supabase.

**Nooit** een secret- of service-role-key, databasewachtwoord of accountwachtwoord in code, git, GitHub of een chat.

---

## 8. Belangrijke beslissingen (en waarom)

1. **Gast-app in het Supabase-project van Be Strong:** het gratis plan laat maar 2 projecten toe, en die zijn al bezet door Bjorn Finance en Be Strong. Daarom gelden strikte regels:
   - Alles krijgt het voorvoegsel `net_`.
   - Nooit een statement op een heel schema.
   - Nooit iets aan Be Strong of aan Boodschappenlijst (`lists_`).
   - Bij de installatie is gecontroleerd dat 423 bestaande objecten identiek bleven.
2. **Zelfde stack als Be Strong** (Vite, React, Dexie local-first met outbox-sync, GitHub Pages): één bewezen patroon voor alle apps.
3. **Inloggen met het Be Strong-account, eigen `storageKey` en uitloggen met `scope: 'local'`:** uitloggen in Our Network logt je niet uit in Be Strong.
4. **Geen DELETE op datatabellen:** verwijderen = `deleted_at`. Dat maakt "Ongedaan maken" en synchronisatie veilig.
5. **Migraties draait Claude nooit automatisch op productie.** Elke wijziging komt in een nieuw bestand (`005_…sql`), gevolgd door `npm run gen:setup-sql`, en `tests/rls/shared-project.test.ts` moet groen blijven. Uitvoeren gebeurt pas na Bjorns uitdrukkelijke "ja" en komt in `LOG.md`.
6. **Geen IndexedDB-cursors** (Dexie `orderBy`, `.first()`, `.reverse()`, …): iOS Safari geeft dan "Unable to open cursor". Gebruik `toArray()` en sorteer in JavaScript.
7. **Huisstijl gelijk aan Be Strong, B lists en B finance:**
   - Goud/antraciet, Inter, standaard donker.
   - De gloed staat op een vaste `body::before`-laag (iOS negeert `background-attachment: fixed`).
   - Doorschijnende `--card`/`--field`; dekkende `--surface-2` voor sheets, toasts en pop-ups.
   - Geen backdrop-blur op mobiel.
8. **Partners als één eenheid op de binnenste ring.** De kaart wordt ruimer naarmate er meer mensen zijn; handmatige posities blijven exact staan.
9. **Schermhoogte `--app-h`:** in de geïnstalleerde iPhone-app is dat `100lvh` en staat de menubalk vast via `top`, omdat iOS bij het opstarten een te kleine `dvh` doorgeeft.
10. **Pakketten zonder onnodige grote sprongen.** supabase-js blijft op 2.50, omdat de nieuwste versie +28 KB zou kosten voor een lek dat 2.50 al oplost.
11. **De artifact blijft als reserve bestaan.** `npm run build:artifact` moet blijven slagen.

---

## 9. Bekende bugs en valkuilen

- **iOS:** geen IndexedDB-cursors (zie hierboven). Test altijd op 375 px.
- **GitHub Pages cachet ongeveer 10 minuten:** controleer met `?v=<sha>` en wis de service worker.
- **Git Bash** zet `BASE_PATH=/Our-Network/` om naar een Windows-pad. Gebruik `MSYS_NO_PATHCONV=1`.
- **Nooit een `updated_at` in de toekomst zetten.** Dat breekt de sync-cursor; de engine negeert intussen cursors in de toekomst.
- **Dexie-schema:** alleen wijzigen met een nieuwe `db.version(n)` en een upgrade-functie. Er mag geen data verloren gaan.
- **Back-upformaat v2** moet compatibel blijven. Oudere id's worden aanvaard via `z.guid()`, niet `z.uuid()`.
- **Een nieuwe gebruiker in Supabase** (bv. Stephanie) krijgt automatisch een leeg Be Strong-profiel via Be Strongs trigger `handle_new_user`. Dat is onschuldig, maar vermeld het aan Bjorn.
- **Supabase SQL Editor:** na het uitvoeren verschijnt een "Leave site?"-dialoog. Open de volgende pagina in een nieuw tabblad.
- **Claude mag de Auth-instellingen van Supabase niet zelf wijzigen.** Dat deed Bjorn zelf.
- In `.git/worktrees/` staan twee OneDrive-plaatshouders (`-before`, `on-before`) die git niet kan verwijderen. Ze zijn onschuldig en geven alleen een waarschuwing bij commits.
- **De repo is publiek:** zet nooit e-mailadressen van Stephanie of andere persoonsgegevens in code. Persoonlijke exportbestanden staan in `.gitignore` (`/*.png`, `/*.jpg`, `/*.pdf`, `/exports/`, `/reference/`, …).

---

## 10. Volgende stappen

1. **Stephanie toegang geven:** volg [STAPPENPLAN.md](STAPPENPLAN.md) deel D.
   - In de app: Instellingen › Toegang › uitnodigen.
   - In Supabase: gebruiker aanmaken (doet Bjorn).
   - Daarna samen testen op haar iPhone, ook of privé-herinneringen echt privé blijven.
2. **Profielfoto's en "Dit ben ik":** Bjorn zet de foto's terug. Controleer daarna dat ze op beide toestellen verschijnen (opslag in `net-photos`).
3. **Back-up van de echte gegevens:** download via Instellingen › Gegevens en bewaar buiten de repo.
4. **Optioneel:** de NetworkMap-gesturehook opsplitsen, met test op een echte iPhone, en Playwright bijwerken naar 1.65.
5. **Nieuwe wensen van Bjorn:** eerst sparren en een voorbeeld tonen, dan pas bouwen (zie [CLAUDE.md](CLAUDE.md)).

---

## 11. Samenhang met de andere apps

Alle apps staan in `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\`. Ze hebben elk een publieke repo bij GitHub-gebruiker `Byornn1993`, draaien op GitHub Pages en delen dezelfde huisstijl.

| App | Map | Live | Data |
|---|---|---|---|
| **Be Strong** ("B strong", fitness) | `Be strong` | byornn1993.github.io/Be-strong/ | **Eigenaar** van Supabase-project `mngqptjikxeihmmnibio`. Zijn tabellen (workouts, profiles, …) nooit aanraken. |
| **Boodschappenlijst** ("B lists": boodschappen, Thuis-taken, challenges) | `B lists` | byornn1993.github.io/Boodschappenlijst/ | Gast-app in hetzelfde project, voorvoegsel `lists_`. Niet aanraken. |
| **Bjorn Finance** ("B finance", huishoudbudget) | `Be finance` | byornn1993.github.io/Bjorn-finance/ | Eigen, apart Supabase-project. Nooit aanraken. |
| **Our Network** | `Our Network` | byornn1993.github.io/Our-Network/ | Gast-app in het Be Strong-project, voorvoegsel `net_`. |

- **Eén account:** Bjorn logt met hetzelfde account in op Be Strong, B lists en Our Network.
- **Het contract** voor het gedeelde project staat in `SUPABASE_SHARED.md`. Elke app heeft een eigen kopie. Bjorn besliste: de kopieën in Be Strong en Boodschappenlijst **niet** aanpassen vanuit dit project.
- **De huisstijl** is in alle vier gelijk (zie CLAUDE.md). Het originele huisstijlbestand stond op `D:\Apps claude\Bjorn huisstijl prompt.txt`, maar die schijf is nu niet beschikbaar. De regels zelf zitten in `src/index.css` en in CLAUDE.md.
