-- Migração 003 — novos estados da conversa (orientações, cidade da testemunha,
-- confirmação do checklist virtual). Rode após a 002.
--   psql "$DATABASE_URL" -f db/migrations/003_estados_conversa.sql
--
-- Obs.: ALTER TYPE ... ADD VALUE não pode rodar dentro de um bloco de transação.
-- O psql executa cada comando em autocommit, então rode este arquivo direto.

ALTER TYPE estado_fluxo ADD VALUE IF NOT EXISTS 'aguardando_cidade_testemunha';
ALTER TYPE estado_fluxo ADD VALUE IF NOT EXISTS 'aguardando_orientacoes_testemunha';
ALTER TYPE estado_fluxo ADD VALUE IF NOT EXISTS 'aguardando_confirmacao_checklist';
