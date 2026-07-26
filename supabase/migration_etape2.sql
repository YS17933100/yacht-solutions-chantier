-- Migration étape 2 — Ajouter les colonnes dates et jalons
-- À coller dans Supabase SQL Editor > New query > Run

alter table boats add column if not exists launch_date date;
alter table boats add column if not exists haulout_date date;
alter table boats add column if not exists note text;
alter table boats add column if not exists archived boolean default false;

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid references boats(id) on delete cascade,
  label text not null,
  date date not null,
  color text not null default '#8A6D3B',
  note text,
  created_at timestamp with time zone default now()
);

alter table milestones enable row level security;
create policy "Allow all on milestones" on milestones for all using (true) with check (true);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null
);

alter table settings enable row level security;
create policy "Allow all on settings" on settings for all using (true) with check (true);

insert into settings (key, value) values
  ('presence_color', '#1565C0'),
  ('intervention_color', '#E65100')
on conflict (key) do nothing;
