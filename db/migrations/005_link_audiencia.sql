-- Migração 005 — link de acesso da audiência virtual (Zoom/videoconferência).
-- Rode após a 004:  psql "$DATABASE_URL" -f db/migrations/005_link_audiencia.sql
--
-- Preenchido a partir da intimação (DJEN) ou pela equipe. É o link da SALA DA
-- AUDIÊNCIA (diferente de reuniao_zoom_link, que é a reunião de alinhamento).

ALTER TABLE audiencias
  ADD COLUMN IF NOT EXISTS link_audiencia text;
