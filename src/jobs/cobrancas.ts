/**
 * Sub-fluxo #6 (parte B) — cobranças automáticas de documentos (passo 12).
 *
 * Roda periodicamente. Para cada documento pendente, cobra em 24h, 48h e 72h.
 * Após a 3ª cobrança (72h), avisa a equipe e segue acompanhando.
 */
import { query } from '../db.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { dispararN8n } from '../services/n8n.js';
import { montarCobranca } from '../services/messages.js';

interface DocPendente {
  documento_id: string;
  tipo_documento: string;
  audiencia_id: string;
  cliente_telefone: string | null;
  pessoa_id: string | null;
  pessoa_telefone: string | null;
  horas: number;
  cobrancas_enviadas: number;
}

/** Nível-alvo conforme as horas decorridas. */
function nivelAlvo(horas: number): number {
  if (horas >= 72) return 3;
  if (horas >= 48) return 2;
  if (horas >= 24) return 1;
  return 0;
}

export async function rodarCobrancas(): Promise<void> {
  const docs = await query<DocPendente>(
    `SELECT d.id AS documento_id, d.tipo_documento, d.audiencia_id, d.pessoa_id,
            a.cliente_telefone, p.telefone AS pessoa_telefone,
            EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600 AS horas,
            (SELECT count(*)::int FROM cobrancas c WHERE c.documento_id = d.id) AS cobrancas_enviadas
       FROM documentos d
       JOIN audiencias a ON a.id = d.audiencia_id
       LEFT JOIN pessoas p ON p.id = d.pessoa_id
      WHERE d.status = 'pendente'`,
  );

  for (const d of docs) {
    const alvo = nivelAlvo(Number(d.horas));
    if (alvo === 0) continue;

    // Documento de testemunha → cobra direto dela; do cliente → cobra o cliente.
    const destino = d.pessoa_id ? d.pessoa_telefone : d.cliente_telefone;

    // Envia uma cobrança por nível ainda não enviado, até o nível-alvo.
    for (let nivel = d.cobrancas_enviadas + 1; nivel <= alvo; nivel++) {
      if (destino) {
        await enviarWhatsapp({
          telefone: destino,
          texto: montarCobranca(d.tipo_documento, nivel),
          audienciaId: d.audiencia_id,
          pessoaId: d.pessoa_id,
          template: `cobranca_nivel_${nivel}`,
        });
      }
      await query(
        `INSERT INTO cobrancas (documento_id, nivel, enviada_em, canal, sucesso)
         VALUES ($1, $2, now(), 'whatsapp', true)`,
        [d.documento_id, nivel],
      );

      // 72h sem resolver → avisa a equipe.
      if (nivel >= 3) {
        await dispararN8n('alerta.equipe', {
          audienciaId: d.audiencia_id,
          motivo: `Documento "${d.tipo_documento}" pendente há mais de 72h após 3 cobranças.`,
        });
      }
    }
  }

  console.log(`[cobranças] processados ${docs.length} documentos pendentes.`);
}

const isMain = process.argv[1]?.endsWith('cobrancas.ts');
if (isMain) {
  rodarCobrancas()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
