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

_(wordt per onderdeel aangevuld)_

## 4. Bewust niet gedaan

_(wordt aangevuld)_

## 5. Meetresultaten na

_(wordt aangevuld)_
