# Prompt: Our Network controleren, optimaliseren, gebruiksvriendelijker maken en opruimen

Werk in `C:\Users\Gebruiker\OneDrive\Documenten\Our Network` (git `main`, origin = github.com/Byornn1993/Our-Network, live op https://byornn1993.github.io/Our-Network/). Dit is de PWA van Bjorn & Stephanie: ons netwerk, onze mensen en ons verhaal. React 18 + Vite + TypeScript + Tailwind + Dexie (IndexedDB) + Supabase, met een sync-engine (outbox/cursor) en drie backends (`supabase`, `local`, `artifact`).

Je mag zelf beslissen en doorbouwen. Vraag alleen iets als het echt mijn keuze is. Rapporteer eerlijk: wat getest is, wat niet, en wat faalde (met uitvoer).

## Harde grenzen (niet onderhandelbaar)

1. **Gedeeld Supabase-project** `mngqptjikxeihmmnibio` hoort bij Be Strong. Our Network is daar een gast-app. Volg `SUPABASE_SHARED.md`:
   - Alles met prefix `net_` (tabellen, functies, policies, indexen), bucket `net-photos`, storageKey `ournetwork-auth`, signOut met scope `local`.
   - Nooit een statement op een heel schema, nooit iets aan tabellen, functies of policies van Be Strong (`public.*` zonder prefix) of Boodschappenlijst (`lists_`).
   - Geen SQL in productie uitvoeren zonder mijn uitdrukkelijke ja. Schrijf nieuwe migraties als `supabase/migrations/005_...sql` e.v., werk `setup-productie.sql` bij via `npm run gen:setup-sql`, en laat `tests/rls/shared-project.test.ts` groen.
2. **Raak Be Strong, B Finance en Boodschappenlijst niet aan** (ook hun kopie van `SUPABASE_SHARED.md` niet).
3. **Geen dataverlies.** Wijzigingen aan Dexie-schema (`src/lib/db/schema.ts`) alleen met een nieuwe versie + upgrade; sync-formaat en back-upformaat (v2, met foto's als data-URL) blijven compatibel of krijgen een migratie met test.
4. **iOS/Safari:** geen IndexedDB-cursors (`each`, `sortBy`, `orderBy().toArray()` op grote sets) — gebruik `toArray()` + sorteren in JS. Test op een smal scherm (375 px).
5. **Artifact-versie (reserve)** moet blijven bouwen: `npm run build:artifact` slaagt. Publiceren hoeft niet, tenzij ik erom vraag. Zet nooit een `updated_at` in de toekomst.
6. Commit in kleine, logische stappen met Nederlandse commitberichten (zoals de bestaande historie). Pushen pas na mijn ja; daarna deployt GitHub Actions naar Pages.

## Werkwijze

Begin met een nulmeting en schrijf die op in `docs/AUDIT.md` voordat je iets verandert:

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` en `npm run build:artifact` (lokaal in Git Bash: `MSYS_NO_PATHCONV=1 BASE_PATH=/Our-Network/ npm run build`).
- Bundelgrootte per chunk (uit de Vite-uitvoer) en de tijd tot het eerste scherm.
- Lijst van gevonden problemen, elk met ernst (hoog / middel / laag), bestand:regel en voorstel.

Werk daarna de onderdelen hieronder af, hoogste ernst eerst. Na elk onderdeel: typecheck, lint, tests en build opnieuw draaien, de app in de browser (preview) controleren op 375 px en desktop, in licht en donker thema, en `docs/AUDIT.md` bijwerken.

## 1. Controleren (correctheid en robuustheid)

- **Sync** (`src/lib/sync/engine.ts`, `outbox.ts`, `scheduler.ts`, `status.ts`): kan er data verdwijnen of dubbel komen bij offline bewerken, twee apparaten tegelijk, een verwijdering die terugkomt, een mislukte upload halverwege, of een verlopen sessie? Klopt conflictafhandeling (laatste wijziging wint?) en wordt die getest? Wordt een foutstatus zichtbaar in `SyncIndicator`?
- **Auth** (`src/features/auth/*`): inloggen, wachtwoord vergeten/nieuw wachtwoord, redirect-URL voor Pages, sessie herstellen na herstart, uitloggen raakt de sessie van Be Strong niet.
- **Foto's** (`src/lib/images.ts`, `AvatarEditor`, `Lightbox`): verkleinen vóór upload, juiste bucket/pad, opruimen van wezen-bestanden bij verwijderen, gedrag als upload offline faalt.
- **Back-up/import** (`src/lib/backup.ts`, `DataSettings`): export → import levert exact dezelfde data op (round-trip-test), ook met foto's; ongeldige bestanden geven een duidelijke melding (zod).
- **Domeinlogica** (`src/domain/*`): datums en tijdzones (verjaardagen, 29 februari, "x jaar geleden"), statistieken, tijdlijn, en de netwerkkaart-layout (`layout.ts`) met 0, 1, veel personen en partners.
- **RLS en beveiliging:** kan alleen een ingelogde gebruiker met toegang de `net_`-data en foto's lezen/schrijven? Geen sleutels of persoonlijke data in de repo of de bundel (alleen de anon-key). Check `.gitignore`.
- **PWA:** service worker/updateprompt (`UpdatePrompt`), cache-versie, werkt offline starten, manifest en iconen, SPA-fallback op Pages (diepe links verversen).
- Zoek naar onafgehandelde promises, ontbrekende `catch`, `console.log`-resten, `any`, `@ts-ignore`, en effecten zonder opruimen.

## 2. Optimaliseren (snelheid en zuinigheid)

- Lazy-load zware schermen (netwerkkaart, verhaal/jaaroverzicht, instellingen, formulieren) met `React.lazy` en stil vooraf ophalen na het eerste scherm. Doel: opstartbundel zo klein mogelijk; meet voor en na.
- `lucide-react` en `date-fns`: alleen losse imports, geen hele bibliotheek.
- `useLiveQuery`-queries: niet meer ophalen dan nodig, geen herberekening van grote lijsten bij elke render (memo waar het meetbaar helpt, niet overal).
- Netwerkkaart (`NetworkMap.tsx`, 443 regels): soepel slepen/zoomen met veel personen, geen layout-thrash, pointer-events goed op touch.
- Afbeeldingen: juiste formaten, `loading="lazy"`, thumbnails voor avatars.
- Sync: niet vaker pollen dan nodig, pauzeren op de achtergrond, batchen van outbox-items.

## 3. Gebruiksvriendelijker maken

Bekijk elk scherm als Stephanie die de app voor het eerst op haar telefoon opent:

- **Navigatie:** is het duidelijk waar je bent en hoe je terugkomt (AppShell, SubNav, PageHeader)? Logische volgorde van tabbladen?
- **Lege staten** met een duidelijke eerste actie (eerste persoon, eerste moment, eerste foto).
- **Formulieren** (persoon, gebeurtenis, relatie): verplichte velden duidelijk, fouten bij het veld, niet kwijtraken bij per ongeluk terug (waarschuwing bij onopgeslagen wijzigingen), datumkeuze prettig op iOS, toetsenbord type juist (`inputMode`).
- **Bevestiging:** korte melding "Bewaard ✓" na opslaan/verwijderen (zoals in Be Strong), ongedaan maken bij verwijderen waar mogelijk, `ConfirmDialog` alleen voor echt onomkeerbare acties.
- **Zoeken en filteren** in personen (naam, categorie, relatie) en in het verhaal (jaar, type, persoon).
- **Aanraakdoelen** minstens 44 px, tekst minstens 12 px (labels, assen, kalender), voldoende contrast in beide thema's.
- **Toegankelijkheid:** labels op knoppen met alleen een icoon, focusvolgorde, `aria-*` op sheets/dialogen, schermlezer-namen in het Nederlands.
- **Huisstijl:** gelijk aan de andere apps — gloed-achtergrond op een `position: fixed` `body::before` laag, doorschijnende kaarten met `--card`, `--card-line`, `--field`, en `--surface` ondoorzichtig voor sheets, pop-ups en toasts. Geen gestapelde doorschijnende lagen.
- **Teksten:** consequent Nederlands, kort, vriendelijk, zelfde woorden voor dezelfde dingen.

Maak voor de belangrijkste verbeteringen een schermafbeelding vóór en na.

## 4. Code opruimen

- Splits te grote bestanden zonder gedragswijziging (in aparte commits): `PersonPage.tsx` (426), `NetworkMap.tsx` (443), `PersonFormPage.tsx` (329), `lib/actions.ts` (291), `backend/artifact.ts` (299), `EventFormPage.tsx` en `EventPage.tsx`. Haal herbruikbare stukken naar `components/ui` of `domain/`.
- Verwijder dode code, ongebruikte exports, componenten en dependencies (controleer met een zoektocht, niet op gevoel). Kijk of `uuid` nog nodig is naast `crypto.randomUUID`.
- Eén plek voor gedeelde stijlen (knoppen, velden, kaarten) in plaats van herhaalde Tailwind-reeksen.
- Consistente naamgeving en mappenstructuur; geen dubbele typen tussen `db/types.ts`, `backend/types.ts` en `sync/types.ts`.
- Opruimen van de repo: horen `dist`, `dist-artifact`, `dist-e2e`, `playwright-report`, `test-results` in `.gitignore`? Zijn `docs/PLAN.md`, `PLAN-ARTIFACT.md`, `PROMPT-VERDER-ALS-ARTIFACT.md` en `STAPPENPLAN.md` nog actueel? Zo niet: samenvatten in `README.md` of archiveren in `docs/archief/` (niet zomaar verwijderen).
- Dependencies: verouderde of kwetsbare pakketten melden (`npm outdated`, `npm audit`), alleen veilig bijwerken als de tests groen blijven; grote upgrades (React 19, Vite-major) alleen voorstellen.

## 5. Tests

- Vul tests aan waar de audit gaten vond, vooral: sync-conflicten en offline outbox, back-up round-trip met foto's, datumrandgevallen, layout van de netwerkkaart.
- Minstens één e2e-scenario per hoofdtaak: persoon toevoegen → relatie leggen → moment met foto → terugzien op tijdlijn en kaart.
- RLS-tests blijven bewijzen dat de installatie niets aan Be Strong en Boodschappenlijst verandert.

## Oplevering

1. `docs/AUDIT.md` met: nulmeting, gevonden problemen, wat opgelost is (met commit), wat bewust niet, en meetresultaten voor/na (bundelgrootte, testen).
2. Alle checks groen: typecheck, lint, unit, e2e, build en build:artifact. Als iets niet groen is: zeg het, met uitvoer.
3. Schermafbeeldingen voor/na van de belangrijkste UX-verbeteringen.
4. Een korte lijst met voorstellen die mijn beslissing nodig hebben (bijv. nieuwe migratie uitvoeren in productie, grote upgrades, functies schrappen).
5. Vraag mij of je mag pushen; daarna controleer je dat de GitHub Actions-deploy slaagt en de live app werkt.
