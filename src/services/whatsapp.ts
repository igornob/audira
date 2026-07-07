import { dispararN8n } from './n8n.js';
import { twilioConfigurado, enviarTwilio } from './twilio.js';
import { query } from '../db.js';

/**
 * Envia uma mensagem de WhatsApp e registra no log.
 * - Se o Twilio estiver configurado, envia direto pela API do Twilio (teste real).
 * - Caso contrário, despacha o evento para o n8n (que fala com o provedor).
 */
export async function enviarWhatsapp(opts: {
  telefone: string;
  texto: string;
  audienciaId: string;
  pessoaId?: string | null;
  template?: string;
}): Promise<void> {
  if (twilioConfigurado()) {
    await enviarTwilio(opts.telefone, opts.texto);
  } else {
    await dispararN8n('whatsapp.enviar', {
      telefone: opts.telefone,
      texto: opts.texto,
      audienciaId: opts.audienciaId,
    });
  }

  await query(
    `INSERT INTO mensagens (audiencia_id, pessoa_id, direcao, template, conteudo)
     VALUES ($1, $2, 'enviada', $3, $4)`,
    [opts.audienciaId, opts.pessoaId ?? null, opts.template ?? null, opts.texto],
  );
}
