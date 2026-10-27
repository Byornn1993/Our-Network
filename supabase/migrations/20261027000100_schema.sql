-- Our Network — basisschema (netwerk én Our Story vanaf dag één)
-- Principes:
--  * UUID-primary keys worden door de client gegenereerd (offline werken + idempotente sync).
--  * Eén gedeelde netwerkruimte voor Bjorn en Stephanie: toegang via public.members (zie RLS-migratie).
--  * Alle datatabellen hebben soft delete (deleted_at): verwijderingen synchroniseren mee en niets
--    verdwijnt definitief vanuit de app.
--  * updated_at wordt altijd door de server gezet (trigger); de client gebruikt het als sync-cursor.
--  * Datum van gebeuren (event_date, first_met_at, effective_date) staat los van created_at (ingevoerd in de app).

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_row_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

-- ───────────────────────── toegang ─────────────────────────
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- E-mailadressen die lid mogen worden zodra ze inloggen.
create table public.allowed_emails (
  email text primary key check (email = lower(email) and email like '%@%' and char_length(email) <= 254),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

-- ───────────────────────── profiles (Bjorn & Stephanie) ─────────────────────────
create table public.profiles (
  id uuid primary key,
  slot smallint not null unique check (slot in (1, 2)),
  name text not null check (char_length(name) between 1 and 60),
  avatar_path text check (char_length(avatar_path) <= 300),
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);

-- ───────────────────────── categories ─────────────────────────
create table public.categories (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 500),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'users' check (char_length(icon) <= 40),
  ring smallint not null check (ring between 1 and 4),
  avatar_size smallint not null default 44 check (avatar_size between 28 and 80),
  group_key text not null default 'other' check (group_key in ('family', 'friends', 'colleagues', 'acquaintances', 'other')),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create unique index categories_name_uq on public.categories (lower(name)) where deleted_at is null;

-- ───────────────────────── persons ─────────────────────────
create table public.persons (
  id uuid primary key,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text check (char_length(last_name) <= 80),
  avatar_path text check (char_length(avatar_path) <= 300),
  birth_date date,
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 254),
  other_contacts jsonb not null default '[]'::jsonb check (jsonb_typeof(other_contacts) = 'array'),
  description text check (char_length(description) <= 500),
  notes text check (char_length(notes) <= 10000),
  hobbies text check (char_length(hobbies) <= 1000),
  interests text check (char_length(interests) <= 1000),
  important_info text check (char_length(important_info) <= 2000),
  met_via text check (char_length(met_via) <= 300),
  first_met_at date,
  first_met_precision text not null default 'day' check (first_met_precision in ('day', 'month', 'year')),
  added_at date not null default current_date,
  category_id uuid not null references public.categories (id) on delete restrict,
  ring_override smallint check (ring_override between 1 and 4),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create index persons_category_idx on public.persons (category_id);
create index persons_updated_idx on public.persons (updated_at);

-- Persoon ↔ Bjorn/Stephanie
create table public.person_connections (
  id uuid primary key,
  person_id uuid not null references public.persons (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  description text check (char_length(description) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (person_id, profile_id)
);
create index person_connections_profile_idx on public.person_connections (profile_id);
create index person_connections_updated_idx on public.person_connections (updated_at);

-- Persoon ↔ persoon (symmetrisch: één rij per paar en type)
create table public.relationships (
  id uuid primary key,
  person_id uuid not null references public.persons (id) on delete cascade,
  related_person_id uuid not null references public.persons (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('partner', 'family', 'friend', 'colleague', 'other')),
  description text check (char_length(description) <= 200),
  since_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  check (person_id <> related_person_id)
);
create unique index relationships_pair_uq on public.relationships (
  least(person_id, related_person_id), greatest(person_id, related_person_id), relationship_type
);
create index relationships_related_idx on public.relationships (related_person_id);
create index relationships_updated_idx on public.relationships (updated_at);

-- Handmatige posities op de netwerkkaart (relatief t.o.v. het middelpunt)
create table public.network_positions (
  id uuid primary key,
  person_id uuid not null unique references public.persons (id) on delete cascade,
  x_position double precision not null check (x_position between -100000 and 100000),
  y_position double precision not null check (y_position between -100000 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create index network_positions_updated_idx on public.network_positions (updated_at);

-- Contactmomenten (voorbereid voor latere uitbreiding)
create table public.contact_history (
  id uuid primary key,
  person_id uuid not null references public.persons (id) on delete cascade,
  contact_date date not null,
  kind text not null default 'other' check (kind in ('meeting', 'call', 'message', 'visit', 'other')),
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create index contact_history_person_idx on public.contact_history (person_id, contact_date);
create index contact_history_updated_idx on public.contact_history (updated_at);

-- ───────────────────────── Our Story ─────────────────────────
create table public.event_categories (
  id uuid primary key,
  -- Vaste sleutel voor de standaardtypes (filters zoals "Eerste ontmoetingen"); null voor eigen types.
  system_key text unique check (system_key in ('first_meeting', 'new_relationship', 'family', 'friendship', 'social_change', 'memory', 'birthday')),
  name text not null check (char_length(name) between 1 and 60),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'sparkles' check (char_length(icon) <= 40),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create unique index event_categories_name_uq on public.event_categories (lower(name)) where deleted_at is null;

create table public.events (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (char_length(description) <= 5000),
  personal_note text check (char_length(personal_note) <= 5000),
  event_date date not null,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year')),
  event_end_date date,
  event_category_id uuid not null references public.event_categories (id) on delete restrict,
  theme text check (char_length(theme) <= 80),
  location text check (char_length(location) <= 200),
  is_highlight boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  check (event_end_date is null or event_end_date >= event_date)
);
create index events_date_idx on public.events (event_date desc);
create index events_category_idx on public.events (event_category_id);
create index events_updated_idx on public.events (updated_at);

create table public.event_persons (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (event_id, person_id)
);
create index event_persons_person_idx on public.event_persons (person_id);
create index event_persons_updated_idx on public.event_persons (updated_at);

create table public.event_profiles (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (event_id, profile_id)
);
create index event_profiles_profile_idx on public.event_profiles (profile_id);
create index event_profiles_updated_idx on public.event_profiles (updated_at);

create table public.event_photos (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null unique check (storage_path like 'events/%' and char_length(storage_path) <= 300),
  thumb_path text check (thumb_path like 'events/%' and char_length(thumb_path) <= 300),
  caption text check (char_length(caption) <= 500),
  width integer check (width > 0),
  height integer check (height > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create index event_photos_event_idx on public.event_photos (event_id, display_order);
create index event_photos_updated_idx on public.event_photos (updated_at);

create table public.photo_persons (
  id uuid primary key,
  photo_id uuid not null references public.event_photos (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (photo_id, person_id)
);
create index photo_persons_person_idx on public.photo_persons (person_id);
create index photo_persons_updated_idx on public.photo_persons (updated_at);

-- Relatie- en statusgeschiedenis: één rij per wijziging, met de datum waarop ze inging.
-- De huidige categorie staat op persons.category_id; deze tabel bewaart het verloop.
create table public.relationship_history (
  id uuid primary key,
  person_id uuid not null references public.persons (id) on delete cascade,
  change_type text not null check (change_type in ('category', 'status')),
  category_id uuid references public.categories (id) on delete restrict,
  previous_category_id uuid references public.categories (id) on delete restrict,
  status text check (status in ('active', 'archived')),
  effective_date date not null,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year')),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  check (
    (change_type = 'category' and category_id is not null and status is null)
    or (change_type = 'status' and status is not null and category_id is null)
  )
);
create index relationship_history_person_idx on public.relationship_history (person_id, effective_date);
create index relationship_history_updated_idx on public.relationship_history (updated_at);

-- ───────────────────────── triggers ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'persons', 'person_connections', 'relationships', 'network_positions',
    'contact_history', 'event_categories', 'events', 'event_persons', 'event_profiles', 'event_photos',
    'photo_persons', 'relationship_history'
  ] loop
    execute format('create trigger set_row_meta before insert or update on public.%I for each row execute function public.set_row_meta()', t);
  end loop;
end;
$$;

create index profiles_updated_idx on public.profiles (updated_at);
create index categories_updated_idx on public.categories (updated_at);
create index event_categories_updated_idx on public.event_categories (updated_at);
