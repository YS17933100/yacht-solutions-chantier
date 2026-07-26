-- ============================================================
-- Schéma de base de données — Yacht Solutions / Atelier Ys Brazza
-- À copier-coller dans Supabase : SQL Editor > New query > Run
-- ============================================================

create table if not exists technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null check (specialty in ('elec_plomb', 'menuiserie', 'libre')),
  created_at timestamp with time zone default now()
);

create table if not exists boats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hull text,
  arrival_date date,
  departure_date date,
  intervention_start date,
  intervention_end date,
  created_at timestamp with time zone default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid references boats(id) on delete cascade,
  article_number text,
  name text not null,
  provider text not null default 'Yacht Solutions',
  category text not null default 'autre' check (category in ('electricite', 'plomberie', 'menuiserie', 'accastillage', 'autre')),
  hours numeric not null default 0,
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'termine')),
  assigned_technician_id uuid references technicians(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_tasks_boat_id on tasks(boat_id);
create index if not exists idx_tasks_provider on tasks(provider);

alter table technicians enable row level security;
alter table boats enable row level security;
alter table tasks enable row level security;

create policy "Allow all on technicians" on technicians for all using (true) with check (true);
create policy "Allow all on boats" on boats for all using (true) with check (true);
create policy "Allow all on tasks" on tasks for all using (true) with check (true);

-- Équipe de départ
insert into technicians (name, specialty) values
  ('Marc', 'elec_plomb'),
  ('Julien', 'elec_plomb'),
  ('Antoine', 'menuiserie'),
  ('Paul', 'menuiserie'),
  ('Hendrik', 'libre')
on conflict do nothing;
