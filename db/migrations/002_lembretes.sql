-- Migração 002 — flags de lembretes/reunião (passos 14-15), evita envios duplicados.
-- Rode após a 001:  psql "$DATABASE_URL" -f db/migrations/002_lembretes.sql

ALTER TABLE audiencias
  ADD COLUMN lembrete_7d_enviado     boolean NOT NULL DEFAULT false,
  ADD COLUMN reuniao_convite_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN lembrete_dia_enviado    boolean NOT NULL DEFAULT false;
