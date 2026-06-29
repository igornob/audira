import express from 'express';
import { query } from './db.js';

export function buildServer() {
  const app = express();
  app.use(express.json());

  // Saúde
  app.get('/health', (_req, res) => res.json({ ok: true, app: 'audira' }));

  // Painel de Acompanhamento (passo 18) — lista de audiências com status
  app.get('/api/audiencias', async (_req, res) => {
    const rows = await query(
      `SELECT id, numero_processo, cliente_nome, cidade, estado,
              data_audiencia, hora_audiencia, tipo, modalidade, status,
              cliente_confirmado, grupo_criado, reuniao_realizada, audiencia_concluida
         FROM audiencias
        ORDER BY data_audiencia ASC NULLS LAST`,
    );
    res.json(rows);
  });

  // Webhook do WhatsApp (respostas do cliente/testemunhas chegam aqui via n8n)
  // TODO: Sub-fluxo da conversa — interpretar com Claude e avançar a máquina de estados.
  app.post('/webhook/whatsapp', async (req, res) => {
    console.log('[webhook] WhatsApp recebido:', JSON.stringify(req.body));
    res.json({ received: true });
  });

  return app;
}
