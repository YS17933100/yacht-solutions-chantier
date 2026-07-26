-- Migration : Contrôles qualité
alter table technicians add column if not exists quality_access boolean default false;

create table if not exists quality_checks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  boat_id uuid references boats(id) on delete cascade,
  technician_id uuid references technicians(id) on delete set null,
  technician_name text,
  checked_at timestamp with time zone default now(),
  connexion boolean,
  fonctionnement boolean,
  aspect_visuel boolean,
  is_ok boolean generated always as (connexion and fonctionnement and aspect_visuel) stored
);

alter table quality_checks enable row level security;
create policy "Allow all on quality_checks" on quality_checks for all using (true) with check (true);

create index if not exists idx_quality_checks_task on quality_checks(task_id);
create index if not exists idx_quality_checks_boat on quality_checks(boat_id);
