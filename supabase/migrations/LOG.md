# Uitgevoerde migraties (Supabase-project Be Strong, gast-app Our Network)

Elke migratie voer je zelf uit in de SQL Editor (of in één keer via `supabase/setup-productie.sql`).
Pas een uitgevoerd bestand nooit meer aan: maak een nieuw bestand met het volgende nummer.

| Bestand | Uitgevoerd op | Door |
|---|---|---|
| 001_schema.sql | 2026-11-14 (via setup-productie.sql) | Claude, op vraag van Bjorn |
| 002_rls.sql | 2026-11-14 (via setup-productie.sql) | Claude, op vraag van Bjorn |
| 003_defaults.sql | 2026-11-14 (via setup-productie.sql) | Claude, op vraag van Bjorn |
| 004_storage.sql | 2026-11-14 (via setup-productie.sql) | Claude, op vraag van Bjorn |

Controle na installatie (2026-11-14): 423 objecten van Be Strong, Boodschappenlijst en storage hebben exact dezelfde vingerafdruk als vóór de installatie; 16 `net_`-tabellen, allemaal met RLS, geen rechten voor `anon`; bucket `net-photos` is privé.
