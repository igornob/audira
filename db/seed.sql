-- Seed de demonstração — 3 audiências de exemplo para ver o painel/semáforo.
-- Rode após schema.sql + migrações:  psql "$DATABASE_URL" -f db/seed.sql

INSERT INTO audiencias
  (numero_processo, vara, cidade, estado, data_audiencia, hora_audiencia, tipo,
   modalidade, cliente_nome, cliente_telefone, cliente_confirmado, estado_fluxo, status)
VALUES
  ('0001111-22.2026.5.13.0001', '1ª Vara do Trabalho', 'João Pessoa', 'PB',
   CURRENT_DATE + 30, '14:00', 'instrucao', 'presencial',
   'Maria Souza', '5583999990001', true, 'preparacao', 'verde'),

  ('0002222-33.2026.5.13.0002', '2ª Vara do Trabalho', 'João Pessoa', 'PB',
   CURRENT_DATE + 10, '09:30', 'una', 'virtual',
   'João Lima', '5583999990002', true, 'aguardando_docs_cliente', 'amarelo'),

  ('0003333-44.2026.5.13.0003', '3ª Vara do Trabalho', 'Campina Grande', 'PB',
   CURRENT_DATE + 1, '10:00', 'instrucao', 'virtual',
   'Pedro Alves', '5583999990003', false, 'aguardando_local_cliente', 'vermelho');

-- Documentos pendentes (deixam a 2ª amarela e a 3ª vermelha pela proximidade da data)
INSERT INTO documentos (audiencia_id, tipo_documento, status)
SELECT id, 'contrato_trabalho', 'pendente'
  FROM audiencias
 WHERE numero_processo IN ('0002222-33.2026.5.13.0002', '0003333-44.2026.5.13.0003');
