# Audit Our Network — november 2026

Opdracht: [PROMPT-CONTROLE-EN-OPTIMALISATIE.md](PROMPT-CONTROLE-EN-OPTIMALISATIE.md). Dit document is eerst geschreven als nulmeting (vóór wijzigingen) en daarna per onderdeel bijgewerkt.

## 1. Nulmeting (16-11-2026, commit 907f593)

| Controle | Resultaat |
|---|---|
| `npm run typecheck` | ✅ geen fouten |
| `npm run lint` | ✅ 0 fouten, 12 waarschuwingen (allemaal `react-refresh/only-export-components`) |
| `npm test` (Vitest + PGlite) | ✅ 6 bestanden, 52 tests |
| `npm run test:e2e` (Playwright, iPhone 13) | ✅ 3 tests |
| `npm run build` (`MSYS_NO_PATHCONV=1 BASE_PATH=/Our-Network/`) | ✅ 65 bestanden in de precache (1039 KiB) |
| `npm run build:artifact` | ✅ |

### Bundels (gzip), vóór

Wordt bij elke start geladen (het inlogscherm of de kaart):

| Chunk | Inhoud | gzip |
|---|---|---|
| `react` | react, react-dom, react-router | 54,0 KB |
| `data` | dexie, dexie-react-hooks, **zod**, uuid | 47,2 KB |
| `index` | app-schil, routes, date-fns + nl-locale, store | 34,9 KB |
| `supabase` | @supabase/supabase-js | 28,4 KB |
| `workbox-window` + kleine supabase-chunk | | 3,7 KB |
| **Totaal opstart-JS** | 6 bestanden | **≈ 168 KB** |
| CSS | | 8,2 KB |

Alle schermen zijn al apart (lazy) geladen; het grootste scherm is de netwerkkaart (8,1 KB).
Tijd tot `DOMContentLoaded` op de productiebuild (lokaal, zonder cache): ≈ 0,14 s.

## 2. Gevonden problemen

Ernst: **H** = kan data of toegang kosten · **M** = merkbaar voor de gebruiker of onderhoud · **L** = klein.

| # | Ernst | Waar | Probleem | Voorstel |
|---|---|---|---|---|
| 1 | H | `src/lib/backup.ts` (importBackup, `reupload`) | Eén foto die niet opgeslagen kan worden (bv. verkeerd bestandstype, netwerkfout) breekt de **hele** import af; niets wordt bewaard. Waarschijnlijke oorzaak van de tweede import op 14-11 die niets veranderde. | Per foto opvangen: rij toch importeren zonder die foto, aantal mislukte foto's melden. Ook een ongeldige foto-data-URL mag niet de hele back-up afkeuren. |
| 2 | M | `src/lib/sync/engine.ts` (push) | Eén conflict blokkeert de volledige wachtrij; de melding "Er is een conflict" verschijnt enkel in de statusregel. | Na import/opslaan een duidelijke melding met link naar Synchronisatie (zie UX). |
| 3 | M | `vite.config.ts` (manualChunks `data`) | `zod` (enkel nodig bij back-up importeren) zit in de opstartbundel. | Uit de vaste chunk halen zodat het enkel met het Gegevens-scherm laadt. |
| 4 | L | `src/lib/db/repo.ts` | `uuid` v4 terwijl `crypto.randomUUID` overal beschikbaar is. v5 (deterministische koppel-id's) blijft nodig. | v4 vervangen door `crypto.randomUUID`, enkel v5 importeren. |
| 5 | M | formulieren (`PersonFormPage`, `EventFormPage`) | Geen waarschuwing bij per ongeluk terug met onopgeslagen wijzigingen. | Bevestiging bij Annuleren/terug als er iets gewijzigd is. |
| 6 | M | overal | Geen korte "Bewaard ✓"-melding na opslaan of verwijderen (de toast bestaat al, maar wordt enkel voor het thema gebruikt). | `toast()` na opslaan/verwijderen/importeren. |
| 7 | L | `src/domain/dates.ts` `daysUntilBirthday` | Verjaardag op 29 februari valt in een gewoon jaar op 1 maart (JS-datumoverloop); niet getest. | Bewust gedrag vastleggen in een test (28 feb vieren) . |
| 8 | L | lint | 12 waarschuwingen fast-refresh (componenten en functies in één bestand). | Geen gedragsimpact; enkel aanpakken waar we toch splitsen. |
| 9 | L | grote bestanden | `NetworkMap.tsx` 443, `PersonPage.tsx` 426, `PersonFormPage.tsx` 329 regels. | Splitsen zonder gedragswijziging. |
| 10 | L | `docs/` | `PLAN-ARTIFACT.md`, `PROMPT-VERDER-ALS-ARTIFACT.md` gaan over de vorige (artifact-)fase. | Archiveren in `docs/archief/`. |

Gecontroleerd en in orde (geen actie): `.gitignore` (dist, dist-artifact, dist-e2e, playwright-report, test-results, `.env`), geen `console.log`, `any` of `@ts-ignore` in `src/`, SPA-fallback (`404.html`) voor diepe links op Pages, uitloggen met `scope: 'local'`, eigen `storageKey`, sync pauzeert op de achtergrond (enkel bij zichtbare app elke minuut), afbeeldingen op de tijdlijn met `loading="lazy"`, RLS-test bewijst dat Be Strong en Boodschappenlijst ongemoeid blijven.

## 3. Uitgevoerd

| # | Wat | Commit |
|---|---|---|
| 1 | Import: elke foto apart opgevangen; de rij wordt toch geïmporteerd (zonder die foto), aantal mislukte foto's gemeld. Ongeldige foto keurt de back-up niet meer af. Tests: dubbele import (zonder en met "gaat voor") komt volledig op de server; mislukte foto's houden niets tegen. | ef87ea0 |
| 3, 4 | `zod` niet meer in de opstartbundel; `crypto.randomUUID` i.p.v. uuid v4. | fce7436 |
| — | Hoofdschermen stil vooraf ophalen 2,5 s na het eerste scherm. | 6b21ebc |
| 5, 6 | "Bewaard ✓" na opslaan (persoon, moment, relatie), meldingen na archiveren en foto verwijderen; persoon of moment verwijderen met **Ongedaan maken**; waarschuwing bij Annuleren/terug/sluiten met onbewaarde wijzigingen; knoppenbalk onder formulieren met eigen achtergrond; huisstijl zoals Be Strong (gloed op `body::before`, doorschijnende `--card`/`--field`, dekkende sheets, meldingen en zwevende kaartknoppen); geen backdrop-blur op de jaarkop (iOS). | 79282bb, da3046a |
| 7 | 29 februari: in een gewoon jaar op 28 februari gevierd, met test. | 9a809bd |
| 9 | Opgesplitst zonder gedragswijziging: `PersonPage` (426 → 383), `NetworkMap` (443 → 419), `EventPage` (→ 222) met `PersonSections`, `HistoryEditSheet`, `SvgAvatar`, `EventPhotos`. `AuthScreen` apart zodat het inlogscherm echt lazy laadt. | 59f66ac, 1e8b98c |
| — | Ongebruikte code weg: `CardHeader`, `Stat`, `Tabs`, `RING_LABEL`, `AnyRow`, `getSyncStatus`, `useNow.ts` (gecontroleerd met een zoektocht over src en tests). | 58c1eb4 |
| — | Afhankelijkheden zonder grote versiesprong: react-router-dom 6.30.6 (XSS/open redirect), @supabase/supabase-js 2.50.0 (auth-js-lek; de nieuwste 2.119 zou +28 KB gzip kosten), uuid 11.1.1; dev: vite 5.4.21, vitest 2.1.9, postcss 8.5.33, eslint 9.39.5. | 4e4fcbb |
| 10 | `PLAN-ARTIFACT.md` en `PROMPT-VERDER-ALS-ARTIFACT.md` naar `docs/archief/`; `PLAN.md` gemarkeerd als origineel ontwerp. | 3c58a94 |
| — | Tests: e2e "koppel, moment met foto, verwijderen + ongedaan maken, waarschuwing bij verlaten"; unit: ongedaan maken (lokaal + server), kaart met 0/1 persoon en een partner die er niet is. | 1e8b98c |

Probleem 2 (conflict blokkeert de wachtrij) bleek al zichtbaar: op mobiel verschijnt dan een rode synchronisatiebalk bovenaan, met link naar Synchronisatie. Geen wijziging nodig.

Schermafbeeldingen (375 px) in [screenshots/](screenshots/): `voor-dashboard-375` / `na-dashboard-375` (gloed en doorschijnende kaarten), `voor-formulier-375` / `na-formulier-375` (knoppenbalk met eigen achtergrond i.p.v. zwevend over de tekst), `na-personen-licht-375` (licht thema).

## 4. Bewust niet gedaan

| Wat | Waarom |
|---|---|
| `NetworkMap` verder opsplitsen (slepen/zoomen in een eigen hook) | Raakt de aanraakbediening; zonder test op een echte iPhone te riskant. Kandidaat voor een volgende ronde. |
| `lib/actions.ts` (≈300) en `backend/artifact.ts` (299) opsplitsen | Hangen samen met de sync en de artifact-reserve; geen winst voor de gebruiker. |
| 24 lint-waarschuwingen `react-refresh/only-export-components` | Enkel van belang voor herladen tijdens ontwikkelen; geen invloed op de app. (Door de nieuwere eslint-plugin telt hij er nu 24 i.p.v. 12; zelfde regel.) |
| Playwright 1.65, sharp 0.35, Vite 6+, TypeScript 7 | Grote versiesprongen in ontwikkelgereedschap; geen invloed op de app. |
| Batchen van outbox-items naar Supabase | Bij de huidige hoeveelheid (honderden rijen) geen merkbaar verschil; de import van 14-11 ging in enkele seconden. |

## 5. Meetresultaten na (16-11-2026, commit 1e8b98c)

| Controle | Vóór | Na |
|---|---|---|
| typecheck | ✅ | ✅ |
| lint | 0 fouten, 12 waarschuwingen | 0 fouten, 24 waarschuwingen (zelfde regel, nieuwere plugin) |
| unit + RLS (Vitest) | 52 | **56** ✅ |
| e2e (Playwright) | 3 | **4** ✅ |
| build / build:artifact | ✅ / ✅ | ✅ / ✅ |
| Opstart-JS (gzip) | ≈ 168 KB | **≈ 156 KB** (react 53,8 · data 33,3 · index 34,1 · supabase 31,2 · overig 3,7) |
| `data`-chunk | 47,2 KB | 33,3 KB |
| Inlogscherm | in de opstartbundel | eigen chunk (1,5 KB) |
| npm audit (productie) | 7 (waarvan hoog: react-router) | 3: react-router (middel, enkel op te lossen met v7), zod (hoog, enkel met v4) |

`tests/rls/shared-project.test.ts` (Be Strong en Boodschappenlijst ongemoeid) blijft groen. Er is **geen** nieuwe migratie: niets aan de database gewijzigd.

## 6. Vervolg na jouw akkoord (16-11-2026)

Gepusht (907f593..2e67ace): CI en "Deploy naar GitHub Pages" geslaagd; live app laadt de nieuwe bundels zonder consolefouten.

Daarna, op jouw "doe maar verder":

| Wat | Resultaat | Commit |
|---|---|---|
| **zod 4.6.7** | Hoog lek dicht. `z.string().uuid()` is in zod 4 strenger (versiecijfer); vervangen door `z.guid()` zodat oudere back-ups (formaat v1/v2) geldig blijven. Nieuwe test bewijst dat, en faalt met de strenge variant. Enkel het Gegevens-scherm wordt groter (lazy, 29,3 KB gzip); de opstartbundel niet. | 8498ce7 |
| **React Router 7.18.5** | Laatste lek dicht: `npm audit --omit=dev` geeft **0**. Geen codewijziging nodig (geen future-flags, geen relatieve splat-links). Kost +5,8 KB gzip in de react-chunk (53,8 → 59,6). | 7016d0c |

Controles hierna: typecheck ✅ · lint 0 fouten ✅ · Vitest **57** ✅ · Playwright 4 ✅ · build + build:artifact ✅. Opstart-JS nu ≈ 162 KB (nog steeds onder de 168 KB van de nulmeting).

Nog open (enkel ontwikkelgereedschap): Playwright 1.65 (nieuwe browserdownload ~150 MB).
