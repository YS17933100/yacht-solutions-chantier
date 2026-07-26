-- Migration : Capacité cible par technicien
-- À coller dans Supabase SQL Editor > New query > Run

alter table technicians add column if not exists capacity_target integer default 100 check (capacity_target between 10 and 100);
