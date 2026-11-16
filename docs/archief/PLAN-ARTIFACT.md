# Our Network als claude.ai-Artifact — plan

## Keuze
De bestaande React-app blijft. Alleen de backend wordt vervangen: `src/lib/backend/artifact.ts` implementeert dezelfde
`Backend`-interface bovenop de Artifact-capabilities. Build met `vite build --mode artifact` en publiceer
`index.html` plus de gebouwde JS/CSS/fonts/iconen als één Artifact met meerdere bestanden.

Waarom: alle schermen, de domeinlogica, de lokale cache (Dexie), de outbox en de conflictafhandeling zijn al getest.
Een herschrijving naar losse HTML zou functionaliteit kosten.

## Mapping `Backend` → capabilities

| Backend | Artifact |
|---|---|
| `auth.getUser` | `user.id()` (+ naam via scope `profile`). Geen login: wie de artifact opent, is gekend. |
| `auth.signIn/signOut/reset` | vervalt (uitloggen = Claude zelf). "Lokale kopie wissen" blijft in Synchronisatie. |
| `claimMembership` | toegang = wie de artifact gedeeld krijgt; schrijven bepaalt het platform (`user.can("data.write")`). |
| `members` | geen ledenlijst-API; het scherm Toegang legt uit hoe je deelt. |
| `remote.upsert` | `db.doc("<tabel>/<id>").set(rij)`. `updated_at` = monotone klok, altijd later dan de vorige versie. `created_by` = `user.id()` bij aanmaak. |
| `remote.fetchSince` | live `onSnapshot` per collectie houdt een cache bij; `fetchSince` filtert die cache (met 10 min overlap tegen klokverschillen). Elke wijziging van de ander start meteen een sync. |
| `storage.upload` | `assets.upload(blob)` → asset-id; dat id komt in `avatar_path` / `storage_path` / `thumb_path`. |
| `storage.signedUrls` | `"/_blob/" + id` |
| `storage.remove` | `assets.delete(id)` (enkel bij een bewuste verwijderactie) |
| export (JSON/CSV) | `downloads.save` |

## Collecties
Gedeeld: `profiles`, `categories`, `event_categories`, `persons`, `person_connections`, `relationships`, `network_positions`,
`contact_history`, `relationship_history`, `events`, `event_persons`, `event_profiles`, `event_photos`, `photo_persons`
(document-id = rij-id).

Privé: een privé-herinnering en alles wat eraan hangt (koppelingen, foto-rijen, personen-op-foto) staan onder
`data/users/<mijn id>/<tabel>/rows/<id>`. Die map is per persoon afgeschermd door het platform, ook voor de eigenaar.
Wordt een herinnering privé gemaakt of terug gedeeld, dan verhuizen de rij en alle kinderen mee.

## Rules
```
db: { rules: [
  { path: "", read: "admin", write: "admin" },
  { path: "data/users/{self}", write: "admin" }
] }
```
Enkel de eigenaar (Bjorn) en Editors (Stephanie, per e-mail uitgenodigd) lezen of schrijven. Viewers, Commenters en Contributors zien niets.
`assets` werkt voor dezelfde groep.

## Wat vervalt in de artifact-versie
- Installeren als losse PWA en een service worker: de app draait binnen Claude (iPhone-app, desktop, web).
- Offline zonder Claude. Wijzigingen tijdens een haperende verbinding blijven wel in de wachtrij (Dexie) en gaan later door.
- Inloggen met e-mail/wachtwoord en de uitnodigingslijst: vervangen door het delen van de artifact.

De Supabase- en lokale backend blijven in de code (andere build-modi).
