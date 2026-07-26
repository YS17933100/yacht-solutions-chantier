-- ============================================================
-- Migration étape 3 — Planning techniciens, absences, heures réelles
-- À coller dans Supabase SQL Editor > New query > Run
-- ============================================================

-- Absences des techniciens
create table if not exists absences (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid references technicians(id) on delete cascade,
  type text not null default 'conges' check (type in ('conges', 'maladie', 'indisponible', 'formation')),
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamp with time zone default now()
);

alter table absences enable row level security;
create policy "Allow all on absences" on absences for all using (true) with check (true);

-- Colonnes supplémentaires sur les tâches
alter table tasks add column if not exists planned_date date;
alter table tasks add column if not exists planned_end_date date;
alter table tasks add column if not exists real_hours numeric;
alter table tasks add column if not exists validated_at timestamp with time zone;
alter table tasks add column if not exists validated_by text;
alter table tasks add column if not exists is_priority boolean default false;
alter table tasks add column if not exists priority_before text check (priority_before in ('launch', 'haulout', 'intervention_end'));
alter table tasks add column if not exists shift_accepted boolean default false;

-- Index utiles
create index if not exists idx_absences_technician on absences(technician_id);
create index if not exists idx_tasks_planned_date on tasks(planned_date);
create index if not exists idx_tasks_status on tasks(status);
