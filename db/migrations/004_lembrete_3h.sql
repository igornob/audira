-- Migração 004 — lembrete final "3 horas antes" (cliente + participantes).
-- Rode após a 003:  psql "$DATABASE_URL" -f db/migrations/004_lembrete_3h.sql

ALTER TABLE audiencias
  ADD COLUMN IF NOT EXISTS lembrete_3h_enviado boolean NOT NULL DEFAULT false;
