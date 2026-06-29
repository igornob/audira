import express from 'express';
import { query } from './db.js';
import { rotearMensagem } from './flows/roteador.js';

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

  // Webhook do WhatsApp (respostas do cliente/testemunhas chegam aqui via n8n).
  // Espera { telefone, texto } — ajuste conforme o payload do seu provedor/n8n.
  app.post('/webhook/whatsapp', async (req, res) => {
    const telefone: string | undefined = req.body?.telefone ?? req.body?.from;
    const texto: string | undefined = req.body?.texto ?? req.body?.message ?? req.body?.body;
    if (!telefone || !texto) {
      return res.status(400).json({ error: 'payload precisa de { telefone, texto }' });
    }
    // Responde rápido ao provedor e processa em seguida.
    res.json({ received: true });
    rotearMensagem(telefone, texto).catch((err) =>
      console.error('[webhook] erro ao rotear mensagem:', err),
    );
  });

  return app;
}
