# PROMPT — OUR NETWORK VERDER BOUWEN ALS CLAUDE-ARTIFACT (ZONDER SUPABASE)

Ik ben Bjorn. Je gaat verder met **Our Network**, mijn persoonlijke app voor mij en mijn vriendin Stephanie.
De app is al grotendeels gebouwd, maar kan niet op Supabase draaien: mijn gratis Supabase-plan laat maar
2 actieve projecten toe (Bjorn Finance en Be Strong) en ik wil niet betalen.

**Nieuwe richting:** Our Network wordt een gepubliceerd **claude.ai-Artifact** met gedeelde opslag, op dezelfde
manier als mijn boodschappenlijst-artifact (https://claude.ai/artifact/4kLm2QhwPPYbxoA6VcjqL7). Die werkt met
`claude.use("db")` en `onSnapshot`, zodat iedereen met toegang dezelfde, live bijgewerkte gegevens ziet.
Stephanie en ik gebruiken Our Network dan allebei via Claude (iPhone-app en laptop).

Gooi het bestaande werk niet weg. Hergebruik zoveel mogelijk en vervang alleen de backend.

---

## 1. WAT ER AL BESTAAT (eerst lezen, niet opnieuw bedenken)

Projectmap: `C:\Users\Gebruiker\OneDrive\Documenten\Our Network` (git, branch `main`, eerste commit `8d87a9e`, nog niet gepusht).

Lees eerst: `docs/PLAN.md`, `README.md`, `src/lib/backend/types.ts`, `src/lib/backend/local.ts`, `src/lib/sync/engine.ts`,
`src/lib/db/types.ts`, `src/lib/actions.ts`, `supabase/migrations/*.sql`.

Gebouwd en getest:

- **Stack:** Vite 5 + React 18 + TypeScript strict + Tailwind (CSS-tokens), react-router 6, Dexie local-first + outbox-sync.
- **Backend-abstractie** `Backend` (`src/lib/backend/types.ts`): `auth`, `claimMembership`, `members`, `remote` (`upsert` + `fetchSince`), `storage` (`upload`, `remove`, `signedUrls`).
  Er zijn twee implementaties: Supabase en een lokale nabootsing (`npm run dev:local`, `--mode devlocal`) die niet in de productiebuild zit.
- **Datamodel** (14 synctabellen, alles UUID, `created_at`, `updated_at`, `deleted_at`): `profiles` (Bjorn = slot 1, Stephanie = slot 2), `categories`, `persons`,
  `person_connections`, `relationships`, `network_positions`, `contact_history`, `event_categories`, `events`,
  `event_persons`, `event_profiles`, `event_photos`, `photo_persons`, `relationship_history`.
  - Koppelrijen hebben deterministische UUID v5-id's.
  - Er wordt nooit hard verwijderd, enkel soft delete en archiveren.
  - Een categoriewijziging is een nieuwe rij in `relationship_history` met ingangsdatum.
  - Datums kennen een precisie: dag, maand of jaar.
  - Privé-herinneringen (`is_private`) zijn enkel zichtbaar voor wie ze aanmaakte.
- **Schermen:**
  - Netwerkkaart: eigen SVG met hub, ringen en automatische layout zonder overlap; zoom, pan, knijpen; slepen met bewaarde posities; zoeken, filters en onderlinge relaties.
  - Personen: lijst/raster, snel toevoegen, profiel met persoonlijke tijdlijn en relatieontwikkeling, archiveren/verwijderen, profielfoto met vierkante uitsnede.
  - Our Story: tijdlijn met filters, gebeurtenissen met foto's, lightbox, jaaroverzicht.
  - Dashboard en alle instellingen: profielen, categorieën, gebeurtenistypes, toegang, back-up/import/CSV, sync, thema.
- **Design:** donker premium (#080D0C, #111817, kaarten #151E1C, borders #26332F, accent mint #62E3B0, goud #E9B949). De categoriekleuren staan in de defaults.
  De mockups die ik eerder gaf blijven de referentie.
- **Tests:**
  - 41 Vitest-tests: domein, sync tussen twee toestellen, back-up, RLS op PGlite.
  - 3 Playwright-tests: volledige flow, offline, toegang.

---

## 2. DOEL VAN DEZE STAP

Dezelfde app als gepubliceerd Artifact, met de gegevens in de gedeelde Artifact-database in plaats van Supabase.

### 2.1 Architectuur (voorkeur — weeg zelf af en motiveer kort)

1. **Hergebruik de React-app** en publiceer de build als Artifact met meerdere bestanden: `index.html` plus de JS/CSS
   via de `files`-optie van het Artifact-tool. Geen herschrijving naar vanilla JS.
2. **Nieuwe backend** `src/lib/backend/artifact.ts` die de bestaande `Backend`-interface implementeert:
   - `auth` → `claude.use("user")`. Er is geen login meer: wie de artifact opent, is bekend. `user.id()` vervangt de auth-gebruikers-id.
     Map Bjorn en Stephanie op `profiles.user_id` (de knop "Dit ben ik" bestaat al in Instellingen › Profielen).
   - `remote.upsert` / `remote.fetchSince` → `claude.use("db")`. Gebruik één collectie per tabel (`persons/<id>`, …). Laat de pagina `updated_at`
     zetten met een monotone klok. Of vervang de pull door `onSnapshot` per collectie; kies wat het eenvoudigst correct blijft.
     De outbox en de conflictlogica mogen blijven of vereenvoudigd worden, maar wijzigingen mogen nooit stilzwijgend verloren gaan.
   - `storage` → `claude.use("assets")`: `upload(blob)` geeft `{id, url}`. Bewaar het asset-`id` in `avatar_path` / `storage_path` / `thumb_path`.
     Toon de foto via `"/_blob/" + id`. `signedUrls` geeft die URL's terug. `remove` → `assets.delete(id)`, alleen bij een bewuste verwijderactie.
   - `members` / `claimMembership` → vervallen. Toegang = wie ik de artifact deel. Vervang het scherm "Toegang" door een korte uitleg
     en, indien beschikbaar, de lijst van wie meekijkt (`user.profiles`).
3. **Build-modus** `--mode artifact`. Selecteer de backend in `src/lib/backend/index.ts` net zoals `devlocal`, statisch weggefilterd uit andere builds.
   Gebruik `HashRouter` (of een router zonder serverpaden) in deze modus. De Supabase- en lokale code blijven bestaan voor later.
4. **PWA-onderdelen** (service worker, manifest, update-prompt) zijn in een Artifact niet zinvol: zet ze uit in `--mode artifact`.
   Dexie mag blijven als lokale cache, maar de bron van waarheid is de Artifact-db.

### 2.2 Capabilities en toegangsregels

- Declareer minimaal `db`, `user`, `assets` en `downloads` (voor back-up/CSV-export via `downloads.save`). Lees eerst de
  `artifact-capabilities`-skill en de `.d.ts`-bestanden; die zijn leidend boven wat je denkt te weten.
- Gedeelde gegevens: iedereen met toegang leest, en Stephanie en ik schrijven. Stel de `rules` zo in dat lezers met
  enkel kijkrechten niets kunnen wijzigen.
- **Privé-herinneringen** moeten privé blijven, ook in de nieuwe opslag. Bewaar ze onder `data/users/<id>/…`
  (privé per persoon), met hun koppelingen en foto's, in plaats van in de gedeelde collecties. Behandel ze in de UI zoals nu.
- **Standaardinhoud** (2 profielen, 5 categorieën, 7 gebeurtenistypes, zie `supabase/migrations/20261027000300_defaults.sql`):
  niet hardcoderen in de pagina. Zet ze na de eerste publicatie in de db met `ArtifactData` (batch), met dezelfde vaste UUID's.
  De app moet een lege db netjes opvangen.
- `assets` werkt alleen voor wie de artifact mag bewerken. Zeg me expliciet welk toegangsniveau Stephanie nodig heeft
  om ook foto's te kunnen uploaden. Verberg de upload-knoppen netjes als dat niet kan.

### 2.3 Wat moet blijven werken (geen functionaliteit inleveren zonder het te melden)

- [ ] Netwerkkaart volledig: posities gedeeld tussen ons twee, reset, filters, zoeken, hover-preview op desktop.
- [ ] Personen toevoegen in enkele seconden, bewerken, archiveren, verwijderen zonder dat gebeurtenissen verdwijnen.
- [ ] Profielfoto met uitsnede, gebeurtenisfoto's (meerdere), lightbox, foto's koppelen aan personen.
- [ ] Our Story: tijdlijn, alle filters, persoonlijke tijdlijn, relatiegeschiedenis, jaaroverzicht.
- [ ] Wijzigingen van Stephanie verschijnen live bij mij (en omgekeerd).
- [ ] Dashboard en instellingen. Back-up-export (JSON) en CSV via `downloads`, import van een JSON-back-up.
- [ ] Mobiel (iPhone in de Claude-app) én desktop, donker en licht thema.

Wat in een Artifact echt niet kan (bv. installeren als losse PWA, offline zonder Claude): benoem het duidelijk, met het alternatief.

---

## 3. WERKWIJZE

1. Lees de bestaande code (sectie 1) en de capability-documentatie. Maak daarna een kort plan in `docs/PLAN-ARTIFACT.md`:
   architectuurkeuze, collecties en rules, mapping per `Backend`-functie, wat vervalt.
2. Bouw de artifact-backend. Pas de bestaande tests aan en voeg tests toe voor de nieuwe backend (met een nep-`claude.use`).
   Alle bestaande tests moeten groen blijven.
3. Build in `--mode artifact` en publiceer met het Artifact-tool: `index.html` als pagina, de rest via `files`.
   Gebruik een korte titel, bv. "Our Network", en het icoon `network`.
4. Zet de standaardinhoud in de db met `ArtifactData`.
5. Controleer na publicatie met `ArtifactData`:
   - per collectie een `list`;
   - een check op een lager toegangsniveau (`as_level`) dat privé-herinneringen en schrijfrechten correct afgeschermd zijn.
6. Commit met duidelijke berichten in de bestaande repo (nog niet pushen tenzij ik het vraag).

## 4. REGELS

- Verander niets aan Bjorn Finance, Be Strong of hun Supabase-projecten.
- Geen verzonnen of voorbeeldgegevens in de gepubliceerde artifact of de db, behalve de standaardcategorieën en -types.
- Geen secrets in de pagina of de db.
- Iedere knop moet echt werken. Wat je niet kon testen, meld je eerlijk.
- Neem zelf technische beslissingen. Vraag mij alleen iets bij keuzes over privacy, toegang of kosten.

## 5. OPLEVERING

Geef me:
- de link naar de gepubliceerde artifact;
- wat ik moet doen om hem met Stephanie te delen, en met welk toegangsniveau;
- wat je gebouwd en aangepast hebt (bestanden, collecties, rules);
- welke tests geslaagd zijn en wat ik zelf nog op mijn iPhone moet controleren.
