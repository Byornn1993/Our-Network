# Our Network — technisch implementatieplan

## 1. Analyse van de bestaande apps

| | Bjorn Finance | Be Strong | Our Network (keuze) |
|---|---|---|---|
| Frontend | PWA (code niet lokaal, enkel rapport) | Vite 5 + React 18 + TypeScript strict | **Zelfde als Be Strong** |
| Styling | donker | Tailwind 3 met CSS-tokens (`--bg`, `--surface`, …) | Zelfde aanpak, eigen palet (#080D0C, mint) |
| Routing | – | react-router 6, lazy routes, `basename` voor Pages | Zelfde |
| Data | Supabase | Dexie (IndexedDB) local-first + outbox-sync | Zelfde patroon, **generieke** sync (1:1 tabellen) |
| Backend | eigen Supabase-project (Frankfurt) | eigen Supabase-project | **Eigen, nieuw Supabase-project** |
| Auth | e-mail + wachtwoord, signups uit | idem, wachtwoord-reset via mail | Idem + ledenlijst (allowlist) voor de gedeelde ruimte |
| RLS | per gebruiker | per gebruiker (`user_id = auth.uid()`) | **Gedeelde ruimte**: `is_member()` |
| Tests | – | Vitest, RLS-tests op PGlite (embedded Postgres), Playwright | Zelfde |
| PWA | ja | vite-plugin-pwa, prompt-update, enkel app-shell gecachet | Zelfde |
| Deploy | GitHub Pages | GitHub Actions → Pages, repo-variabelen voor URL/key | Zelfde |
| Migraties | – | versioned SQL + gegenereerd `setup-productie.sql` | Zelfde |

Geen nieuwe technologieën: de netwerkkaart is een eigen SVG-component (pan/zoom/drag met pointer events),
dus geen React Flow of D3 nodig. Diagrammen zijn eenvoudige SVG.

## 2. Architectuur

```
src/
  lib/db        Dexie-schema per gebruiker, generieke repo (save/softDelete + outbox)
  lib/sync      outbox, engine (pull met cursor per tabel, push in volgorde, conflicten), scheduler
  lib/backend   Supabase-implementatie (auth, remote, storage) + lokale dev-backend (alleen `--mode local`)
  lib/images    comprimeren, vierkante uitsnede, thumbnails
  domain        pure logica: netwerklayout, tijdlijn, statistieken, datums (unit-getest)
  features/*    network, persons, story, dashboard, settings, auth
  components    ui-bouwstenen, AppShell, Avatar
```

### Gedeelde netwerkruimte en toegang
* `members` = wie toegang heeft. `is_member()` (security definer) zit in **elke** RLS-policy.
* De eerste ingelogde gebruiker wordt automatisch lid (bootstrap, alleen als er nog geen leden zijn).
  Daarna voegt een lid in *Instellingen › Toegang* het e-mailadres van Stephanie toe (`allowed_emails`);
  zodra zij inlogt wordt ze lid. Registraties staan uit in Supabase.
* Geen hard delete vanuit de app: er bestaan geen DELETE-policies op datatabellen. Verwijderen = `deleted_at`.
  Zo kan geen herinnering per ongeluk definitief verdwijnen.
* Privé-herinneringen: `events.is_private` → enkel zichtbaar voor wie ze aanmaakte (ook koppelingen en foto's).

### Datamodel (alles UUID, `created_at`, server-`updated_at`, `deleted_at`, `created_by`)
* `profiles` — Bjorn (slot 1) en Stephanie (slot 2), optioneel gekoppeld aan een login.
* `categories` — naam, kleur, icoon, ring (1–4), fotogrootte, groep (familie/vrienden/collega's/kennissen/andere), volgorde.
* `persons` — basis-, contact- en persoonlijke gegevens; `first_met_at` + precisie (dag/maand/jaar),
  `added_at` (in netwerk gezet), `created_at` (ingevoerd in de app), `category_id` (huidig), `ring_override`, `archived_at`.
* `person_connections` — persoon ↔ Bjorn/Stephanie, met omschrijving ("zus van Stephanie").
* `relationships` — persoon ↔ persoon (partner, familie, vriend, collega, andere), symmetrisch uniek.
* `network_positions` — handmatige posities op de kaart (gedeeld tussen beide toestellen).
* `contact_history` — contactmomenten (voorbereid voor later).
* `event_categories` — uitbreidbare gebeurtenistypes (eerste ontmoeting, nieuwe relatie, familie, vriendschap, sociale verandering, herinnering, verjaardag).
* `events` — `event_date` (wanneer het gebeurde) + precisie + einddatum, type, thema, locatie, beschrijving, persoonlijke notitie, hoogtepunt, privé.
* `event_persons`, `event_profiles` — many-to-many; één gebeurtenis, overal zichtbaar, één keer opgeslagen.
* `event_photos` + `photo_persons` — foto's in Supabase Storage, gekoppeld aan personen.
* `relationship_history` — elke categorie- én statuswijziging (archief/terug actief) met ingangsdatum. Nooit overschreven.

Koppeltabellen krijgen een **deterministische id** (UUID v5 van de twee sleutels): twee toestellen die offline
dezelfde koppeling maken, komen zo op dezelfde rij uit in plaats van op een unieke-sleutelfout.

### Storage
Privé-bucket `our-network`: `avatars/profiles/…`, `avatars/persons/…`, `events/<event_id>/…`.
Afbeeldingen worden in de browser verkleind (JPEG; avatars 512×512 vierkant, foto's max 1600 px + thumbnail 480 px).
Weergave via kortlevende signed URLs. Policies: alleen leden.

### Offline
App-shell via service worker; data staat lokaal in IndexedDB (per gebruiker, gewist bij uitloggen) en werkt offline.
Wijzigingen gaan in de outbox en worden verstuurd zodra er verbinding is; conflicten worden nooit stil overschreven.
Foto's uploaden vraagt verbinding (duidelijk gemeld). Geen API-responses in de service-worker-cache.

## 3. Fases
1. **Fundament** — repo, migraties, RLS + storage policies, RLS-tests, auth, sync, PWA-basis.
2. **Netwerkkaart** — hub, ringen, satellieten, auto-layout zonder overlap, zoom/pan/drag, zoeken, filters, posities bewaren/resetten.
3. **Personen** — lijst/grid, snel toevoegen, bewerken, archiveren/verwijderen, profielfoto met uitsnede, profiel met geschiedenis.
4. **Our Story** — tijdlijn, gebeurtenissen + foto's, koppelingen, filters, persoonlijke tijdlijn, relatiegeschiedenis.
5. **Dashboard & instellingen** — statistieken, jaaroverzicht, profielen, categorieën, types, toegang, export/import.
6. **Afwerking** — mobiel, offline, tests, deploy.

## 4. Wat Bjorn zelf doet (infrastructuur)
* Nieuw Supabase-project aanmaken en `supabase/setup-productie.sql` uitvoeren (zie STAPPENPLAN.md).
* Accounts aanmaken voor Bjorn en Stephanie; signups uit.
* GitHub-repository + Pages (Claude kan helpen via de browser).
