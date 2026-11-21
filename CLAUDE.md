# Werkafspraken Our Network

Lees bij de start van elke sessie eerst [HANDOVER.md](HANDOVER.md): status, structuur, data en beslissingen.

## Waar werken
- Werk **altijd** in deze projectmap: `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\Our Network`.
- Alles wat bij dit project hoort, staat in deze map: code, documentatie, scripts, testdata en exports.
  - Tijdelijke hulpbestanden mogen in de scratchpad; wat blijft, komt hier.
- **Persoonlijke gegevens komen nooit in git.** Zet ze in `exports/` of `reference/`, of in de hoofdmap als png, jpg of pdf. Die staan in `.gitignore`. De repo is publiek.
- Raak de andere apps niet aan: Be Strong, B lists (Boodschappenlijst) en Be finance. Hun kopie van `SUPABASE_SHARED.md` ook niet.

## Communicatie
- Altijd in het **Nederlands** (Vlaams), informeel en warm. Bjorn is geen programmeur.
- **Eerlijk rapporteren:** wat getest is, wat niet, en wat Bjorn zelf nog moet nakijken.
- **Technische keuzes:** neem ze zelf en blijf bouwen. Vraag enkel als het echt nodig is.
- **Nieuwe functies of grote wijzigingen in uitzicht:** eerst sparren en een voorbeeld tonen (mock-up), pas bouwen na Bjorns akkoord.
- **Stappen op websites die Bjorn zelf moet doen** (Supabase, GitHub): één stap per bericht, met de exacte knopnamen, en wachten op zijn bevestiging.

## Harde regels
- **Pushen pas na Bjorns uitdrukkelijke "ja".** Na het pushen:
  - controleer dat GitHub Actions slaagt (CI en "Deploy naar GitHub Pages");
  - controleer dat de live app werkt.
- **Kleine commits met een Nederlandse boodschap.**
- **Supabase-project `mngqptjikxeihmmnibio` is van Be Strong.**
  - Alles van Our Network heet `net_…`: bucket `net-photos`, storageKey `ournetwork-auth`, uitloggen met `scope: 'local'`.
  - Nooit een statement op een heel schema.
  - Nooit iets aan tabellen, functies of policies van Be Strong of `lists_`.
- **Geen SQL op productie zonder Bjorns uitdrukkelijke "ja".**
  - Een nieuwe migratie komt in `supabase/migrations/005_….sql`, gevolgd door `npm run gen:setup-sql`.
  - `tests/rls/shared-project.test.ts` moet groen blijven.
  - Na uitvoeren: een regel in `supabase/migrations/LOG.md`.
- **Nooit vragen naar of invullen:** secret- of service-role-key, databasewachtwoord of wachtwoorden. Geen service-role-key in de frontend.
- **Geen dataverlies.**
  - Dexie-schema alleen wijzigen met een nieuwe versie plus een upgrade.
  - Back-upformaat v2 blijft compatibel.
  - Nooit een `updated_at` in de toekomst.
- **iOS:**
  - Geen IndexedDB-cursors: gebruik `toArray()` en sorteer in JavaScript.
  - Test op 375 px breed.
  - Geen backdrop-blur op mobiele balken.
- **Controles vóór een commit:** `npm run typecheck`, `npm run lint` (0 fouten), `npm test` en `npm run test:e2e`.
  - `npm run build:artifact` moet blijven slagen.

## Stijlvoorkeuren (huisstijl, gelijk aan Be Strong, B lists en B finance)
- **Kleuren:** goud en antraciet. De tokens staan in `src/index.css`.
  - Donker: `--bg #101418`, `--accent #b08d57`, `--champ #dcc9a6`, tekst `#fbf6ee`.
  - Licht: `--bg #f6f1e8`.
  - Standaard is donker, met een licht/donker-knop.
- **Lettertype:** Inter. Titels vet en strak, een korte gouden streep onder de paginatitel.
- **Achtergrond:** de gloed (`--bg-glow`) zit op een vaste `body::before`-laag. `body` en `#root` blijven doorzichtig.
- **Vlakken:**
  - Kaarten en velden zijn doorschijnend (`--card`, `--card-line`, `--field`).
  - Sheets, toasts, pop-ups en zwevende knoppen zijn dekkend (`--surface-2`).
- **Bediening:**
  - Knoppen en tikvlakken minstens 44 px hoog.
  - Na opslaan een korte melding "… bewaard ✓".
  - Bij verwijderen "Ongedaan maken" in plaats van een bevestigingsvraag.
- **Teksten in de app:** Nederlands.
- **Indeling:** onderaan een menubalk op de gsm, een zijbalk vanaf tabletbreedte.
