import { dispararN8n } from './n8n.js';
import { query } from '../db.js';

/**
 * Envia uma mensagem de WhatsApp pelo n8n (que fala com a API oficial/Twilio)
 * e registra no log de mensagens.
 */
export async function enviarWhatsapp(opts: {
  telefone: string;
  texto: string;
  audienciaId: string;
  pessoaId?: string | null;
  template?: string;
}): Promise<void> {
  await dispararN8n('whatsapp.enviar', {
    telefone: opts.telefone,
    texto: opts.texto,
    audienciaId: opts.audienciaId,
  });

  await query(
    `INSERT INTO mensagens (audiencia_id, pessoa_id, direcao, template, conteudo)
     VALUES ($1, $2, 'enviada', $3, $4)`,
    [opts.audienciaId, opts.pessoaId ?? null, opts.template ?? null, opts.texto],
  );
}
