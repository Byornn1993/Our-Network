# Our Network online zetten — stappenplan

Je hoeft niets te programmeren. Volg de stappen in volgorde. Reken op ongeveer 15 minuten.

**Belangrijk:** de *secret key* en het *databasewachtwoord* van Supabase deel je met niemand, ook niet met Claude.

---

## Deel A — Supabase klaarzetten (jij)

### Stap 1: Een nieuw project maken

1. Ga naar **supabase.com** en log in.
2. Klik op **New project**. Naam: **our-network**. Regio: **Frankfurt (eu-central-1)** of **Ireland (eu-west-1)**.
3. Kies een sterk databasewachtwoord en bewaar het in je wachtwoordbeheerder. Je hebt het verder niet nodig.
4. Wacht tot het project klaar is (±2 minuten).

> Lukt het niet omdat het gratis plan al 2 actieve projecten heeft (Bjorn Finance en Be Strong)? Zie onderaan: **Gratis limiet**.

### Stap 2: De database installeren

1. Klik links op **SQL Editor** (`>_`) › **+ New query**.
2. Open op je laptop **Documenten › Our Network › supabase › setup-productie.sql** met Kladblok.
3. **Ctrl + A**, **Ctrl + C**, terug naar Supabase, **Ctrl + V**.
4. Klik **Run**. Onderaan moet **Success. No rows returned** verschijnen.

**Controle:** **Table Editor** toont onder andere `persons`, `events` en `relationship_history`. **Storage** toont de bucket `our-network` (privé).

### Stap 3: Registraties uitzetten

1. **Authentication** › **Sign In / Providers**.
2. **Allow new users to sign up**: **UIT**. **Confirm email**: **UIT**. **Save**.

### Stap 4: Accounts aanmaken

1. **Authentication** › **Users** › **Add user** › **Create new user**.
2. Jouw e-mailadres + een **nieuw** wachtwoord (niet dat van Finance of Be Strong). Vink **Auto Confirm User** aan.
3. Doe hetzelfde voor Stephanie (of later).

De **eerste** persoon die inlogt, wordt automatisch lid. Stephanie voeg je daarna toe in de app: **Instellingen › Toegang › Iemand uitnodigen**. Zonder uitnodiging ziet een account niets.

### Stap 5: Adressen instellen

1. **Authentication** › **URL Configuration**:
   - Site URL: `https://byornn1993.github.io/Our-Network/`
   - Redirect URLs: dezelfde, plus `http://localhost:5173`
2. **Project Settings** › **API Keys**: kopieer de **Project URL** en de **Publishable key** (`sb_publishable_…`) en stuur ze naar Claude. Die twee zijn veilig om te delen. Stuur **niet** de *secret* key.

---

## Deel B — GitHub (Claude helpt)

1. Nieuwe repository **Our-Network** onder je account (net als Be Strong).
2. **Settings › Pages › Source: GitHub Actions**.
3. **Settings › Secrets and variables › Actions › Variables**: `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Code pushen → na ±2 minuten staat de app op `https://byornn1993.github.io/Our-Network/`.

## Deel C — Op je iPhone

Open de link in **Safari** › **Deel** › **Zet op beginscherm**. Stephanie doet hetzelfde op haar toestel.

---

### Gratis limiet

Het gratis Supabase-plan laat 2 actieve projecten toe. Opties:

1. **Aanbevolen:** een tweede Supabase-organisatie of -account voor Our Network (blijft gratis, volledig gescheiden).
2. Upgraden naar het Pro-plan (betalend).
3. Our Network in het bestaande Be Strong-project zetten. Kan technisch (alle tabellen hebben eigen namen), maar dan delen twee apps één database. Alleen doen als je dat uitdrukkelijk wilt.
