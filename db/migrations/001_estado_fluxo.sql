-- Migração 001 — estado do fluxo da audiência (máquina de estados)
-- Rode após o schema.sql:  psql "$DATABASE_URL" -f db/migrations/001_estado_fluxo.sql

CREATE TYPE estado_fluxo AS ENUM (
  'nova',                       -- recém-capturada
  'aguardando_correspondente',  -- presencial: correspondente a contratar
  'aguardando_local_cliente',   -- perguntamos se o cliente estará na cidade
  'aguardando_docs_cliente',    -- cliente fora: aguardando documentos
  'coleta_testemunhas',         -- coletando testemunhas
  'aguardando_docs_testemunha', -- testemunha telepresencial: aguardando docs
  'grupo_criado',               -- grupo de WhatsApp criado
  'preparacao',                 -- documentos ok, em preparação
  'reuniao_agendada',           -- reunião prévia marcada
  'concluida',                  -- audiência realizada
  'sem_contato'                 -- sem telefone do cliente (precisa equipe)
);

ALTER TABLE audiencias
  ADD COLUMN estado_fluxo estado_fluxo NOT NULL DEFAULT 'nova';

CREATE INDEX idx_audiencias_estado_fluxo ON audiencias (estado_fluxo);
