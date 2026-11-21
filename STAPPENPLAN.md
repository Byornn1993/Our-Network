# Our Network als app (PWA) — stappenplan

Our Network draait als app op GitHub Pages, net als Be Strong. De gegevens staan in het **Supabase-project van Be Strong**, als derde app naast Be Strong en Boodschappenlijst. Alles van Our Network heet `net_…`, dus Be Strong en Boodschappenlijst merken er niets van. Zie [SUPABASE_SHARED.md](SUPABASE_SHARED.md).

Je hoeft niets te programmeren. Reken op ongeveer 20 minuten.

**Belangrijk:** de *secret key* en het *databasewachtwoord* van Supabase deel je met niemand, ook niet met Claude.

---

## Deel A — Database (jij, in Supabase)

### Stap 1: Our Network installeren in het project van Be Strong

1. Ga naar **supabase.com**, log in en open het project **Be Strong**.
2. Klik links op **SQL Editor** (`>_`) › **+ New query**.
3. Open op je laptop **Documenten › Persoonlijke apps › Our Network › supabase › setup-productie.sql** met Kladblok.
4. **Ctrl + A**, **Ctrl + C**, terug naar Supabase, **Ctrl + V**.
5. Klik **Run**. Onderaan moet **Success. No rows returned** verschijnen.

**Controle:**
- **Table Editor** toont nieuwe tabellen die beginnen met `net_`, zoals `net_persons` en `net_events`. De tabellen van Be Strong (`workouts`, `profiles`, …) en Boodschappenlijst (`lists_…`) staan er nog, ongewijzigd.
- **Storage** toont een nieuwe privé-bucket `net-photos`.
- Open Be Strong en Boodschappenlijst even: alles werkt zoals voorheen.

Noteer daarna de datum in `supabase/migrations/LOG.md`.

### Stap 2: Het webadres van de app toelaten (voor "wachtwoord vergeten")

1. **Authentication** › **URL Configuration**.
2. Onder **Redirect URLs** › **Add URL**: `https://byornn1993.github.io/Our-Network/**`
3. **Save**. De **Site URL** laat je zoals hij is (die hoort bij Be Strong).

Je hoeft geen nieuwe gebruiker te maken: je logt in met je account van **Be Strong**.

---

## Deel B — De app online zetten (Claude, met jouw akkoord)

1. Een GitHub-repository **Our-Network** maken (zoals Be-strong) en de code pushen.
2. In de repository: **Settings › Pages › Source: GitHub Actions**.
3. **Settings › Secrets and variables › Actions › Variables**: dezelfde twee waarden als bij Be-strong:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Elke push naar `main` bouwt, test en publiceert de app op **https://byornn1993.github.io/Our-Network/**.

---

## Deel C — Je gegevens overzetten uit de artifact

1. Open de artifact **B Netwerk** › **Instellingen › Gegevens** › **Back-up downloaden**. De back-up bevat ook de foto's.
2. Open de app, log in met je Be Strong-account. Je bent automatisch het eerste lid.
3. **Instellingen › Gegevens** › zet **Back-up gaat voor** aan › **Bestand kiezen** › kies de back-up.
4. Controleer het netwerk, Our Story en de profielfoto's.
5. **Instellingen › Profielen** › tik bij je eigen profiel op **Dit ben ik** (de koppeling uit de artifact geldt hier niet).

Daarna gebruik je enkel nog de app. De artifact kan blijven bestaan als reserve, maar wat je daar nog wijzigt, komt niet in de app.

---

## Deel D — Stephanie toevoegen

1. In de app: **Instellingen › Toegang** › nodig Stephanie uit met haar e-mailadres.
2. In Supabase: **Authentication › Users › Add user › Create new user** met haar e-mailadres en een tijdelijk wachtwoord (registreren staat uit).
   - Let op: Be Strong maakt voor elke nieuwe gebruiker automatisch een leeg Be Strong-profiel aan. Dat is onschuldig: zonder workouts ziet ze in Be Strong niets van jou.
3. Stephanie installeert de app (zie hieronder), logt in en is meteen lid.

---

## Installeren op de iPhone

1. Open **https://byornn1993.github.io/Our-Network/** in **Safari**.
2. Tik op **Deel** (vierkant met pijl) › **Zet op beginscherm** › **Voeg toe**.
3. Open Our Network voortaan via het icoon.

Bij een nieuwe versie toont de app bovenaan **Nieuwe versie beschikbaar**. Tik op **Vernieuwen**.

---

## Gratis plan

Our Network deelt het project met Be Strong en Boodschappenlijst: samen 500 MB database en 1 GB foto-opslag. Foto's worden verkleind (max. 1600 px), dus dat is ruim voldoende. Maak af en toe zelf een back-up via **Instellingen › Gegevens**.
