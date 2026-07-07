import express from 'express';
import { query } from './db.js';
import { rotearMensagem } from './flows/roteador.js';
import { prepararAudiencia } from './flows/prepararAudiencia.js';
import { calcularSemaforo } from './status.js';
import { dashboardHtml } from './dashboard.js';

interface LinhaPainel {
  id: string;
  numero_processo: string | null;
  cliente_nome: string | null;
  cidade: string | null;
  estado: string | null;
  data_audiencia: string | null;
  hora_audiencia: string | null;
  tipo: string | null;
  modalidade: string | null;
  estado_fluxo: string;
  cliente_confirmado: boolean;
  audiencia_concluida: boolean;
  responsavel_interno: string | null;
  dias_restantes: number | null;
  docs_pendentes: number;
  ultima_cobranca: string | null;
}

export function buildServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false })); // Twilio envia form-encoded

  app.get('/health', (_req, res) => res.json({ ok: true, app: 'audira' }));

  // Dashboard web (painel de acompanhamento renderizado).
  app.get('/', (_req, res) => res.type('html').send(dashboardHtml()));

  // Painel de Acompanhamento (passo 18) — lista com semáforo e pendências.
  app.get('/api/audiencias', async (_req, res) => {
    const rows = await query<LinhaPainel>(
      `SELECT a.id, a.numero_processo, a.cliente_nome, a.cidade, a.estado,
              a.data_audiencia, a.hora_audiencia, a.tipo, a.modalidade,
              a.estado_fluxo, a.cliente_confirmado, a.audiencia_concluida,
              a.responsavel_interno,
              (a.data_audiencia - CURRENT_DATE) AS dias_restantes,
              (SELECT count(*)::int FROM documentos d
                 WHERE d.audiencia_id = a.id AND d.status = 'pendente') AS docs_pendentes,
              (SELECT max(c.enviada_em) FROM cobrancas c
                 JOIN documentos d ON d.id = c.documento_id
                WHERE d.audiencia_id = a.id) AS ultima_cobranca
         FROM audiencias a
        ORDER BY a.data_audiencia ASC NULLS LAST`,
    );

    const enriquecidas = rows.map((r) => ({
      ...r,
      semaforo: calcularSemaforo({
        diasRestantes: r.dias_restantes,
        docsPendentes: r.docs_pendentes,
        clienteConfirmado: r.cliente_confirmado,
        concluida: r.audiencia_concluida,
      }),
    }));
    res.json(enriquecidas);
  });

  // Painel de Controle (passo 17) — checklist de uma audiência.
  app.get('/api/audiencias/:id/checklist', async (req, res) => {
    const id = req.params.id;
    const a = (
      await query<any>(`SELECT * FROM audiencias WHERE id = $1`, [id])
    )[0];
    if (!a) return res.status(404).json({ error: 'audiência não encontrada' });

    const [{ n: testemunhas }] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pessoas WHERE audiencia_id = $1 AND papel = 'testemunha'`,
      [id],
    );
    const [{ pend }] = await query<{ pend: number }>(
      `SELECT count(*)::int AS pend FROM documentos WHERE audiencia_id = $1 AND status = 'pendente'`,
      [id],
    );

    res.json({
      tipo_identificado: Boolean(a.tipo),
      correspondente_contratado: a.correspondente_contratado,
      cliente_confirmado: a.cliente_confirmado,
      cliente_na_cidade: a.cliente_na_cidade,
      testemunhas_cadastradas: testemunhas > 0,
      documentos_recebidos: pend === 0,
      grupo_criado: a.grupo_criado,
      reuniao_realizada: a.reuniao_realizada,
      audiencia_concluida: a.audiencia_concluida,
    });
  });

  // Encerramento (passo 16) — registra audiência realizada + observações.
  app.post('/api/audiencias/:id/encerrar', async (req, res) => {
    const id = req.params.id;
    const observacoes: string | null = req.body?.observacoes ?? null;
    const rows = await query(
      `UPDATE audiencias
          SET audiencia_concluida = true,
              reuniao_realizada = COALESCE(reuniao_realizada, true),
              observacoes_advogado = $2,
              estado_fluxo = 'concluida',
              status = 'verde',
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, observacoes],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'audiência não encontrada' });
    res.json({ ok: true, id });
  });

  // Teste — cria uma audiência com um número real e dispara a 1ª mensagem.
  // Ex.: curl -X POST localhost:3000/api/teste/audiencia -H 'content-type: application/json' \
  //        -d '{"telefone":"5583999990000","nome":"Igor","cidade":"João Pessoa","modalidade":"virtual"}'
  app.post('/api/teste/audiencia', async (req, res) => {
    const { telefone, nome, cidade, modalidade, tipo, linkAudiencia, numeroProcesso } = req.body ?? {};
    if (!telefone) return res.status(400).json({ error: 'informe { telefone }' });

    // tipo define se haverá testemunha (una/instrução). Default: instrução.
    const TIPOS = ['conciliacao', 'una', 'instrucao', 'mediacao', 'outra'];
    const tipoAudiencia = TIPOS.includes(tipo) ? tipo : 'instrucao';
    const processo = numeroProcesso ?? 'TESTE-0000000-00.2026.5.13.0000';

    const rows = await query<{ id: string }>(
      `INSERT INTO audiencias
        (numero_processo, vara, cidade, estado, data_audiencia, hora_audiencia,
         tipo, modalidade, cliente_nome, cliente_telefone, link_audiencia, fonte_captura, status, estado_fluxo)
       VALUES ($7, '1ª Vara', $1, 'PB',
               CURRENT_DATE + 15, '10:00', $5, $2, $3, $4, $6, 'manual', 'amarelo', 'nova')
       RETURNING id`,
      [cidade ?? 'João Pessoa', modalidade ?? 'virtual', nome ?? 'Cliente Teste', telefone, tipoAudiencia, linkAudiencia ?? null, processo],
    );
    const id = rows[0].id;
    await prepararAudiencia(id); // envia a 1ª mensagem ao número informado
    res.json({ ok: true, id });
  });

  // Webhook do WhatsApp — aceita o payload do Twilio (From/Body) e o de teste (telefone/texto).
  const handleWebhook = (req: express.Request, res: express.Response) => {
    const ehTwilio = Boolean(req.body?.From);
    const telefone: string | undefined =
      req.body?.telefone ?? req.body?.From ?? req.body?.from;
    // Anexos: Twilio manda NumMedia; no payload de teste, aceita { temMidia }.
    const temMidia = Number(req.body?.NumMedia ?? 0) > 0 || req.body?.temMidia === true;

    // Uma foto/PDF pode chegar sem legenda (Body vazio). Nesse caso registramos
    // um texto-marcador — o que importa é a mídia — e seguimos processando.
    let texto: string | undefined =
      req.body?.texto ?? req.body?.Body ?? req.body?.message ?? req.body?.body;
    if ((!texto || !texto.trim()) && temMidia) {
      texto = '[documento em anexo]';
    }

    if (!telefone || !texto) {
      return res.status(400).json({ error: 'payload precisa de { telefone } e texto ou mídia' });
    }

    // Mídia (foto/PDF): Twilio manda a URL em MediaUrl0 e o tipo em MediaContentType0.
    const midia = temMidia
      ? {
          url: req.body?.MediaUrl0 ?? req.body?.mediaUrl,
          mediaType: req.body?.MediaContentType0 ?? req.body?.mediaType,
        }
      : undefined;

    // Twilio espera TwiML; respondemos vazio (sem auto-resposta). Teste: JSON.
    if (ehTwilio) res.type('text/xml').send('<Response></Response>');
    else res.json({ received: true });

    rotearMensagem(telefone, texto, temMidia, midia).catch((err) =>
      console.error('[webhook] erro ao rotear mensagem:', err),
    );
  };
  app.post('/webhook/whatsapp', handleWebhook);
  app.post('/whatsapp', handleWebhook); // atalho usado na config do Twilio Sandbox

  return app;
}
