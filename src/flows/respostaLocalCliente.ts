/**
 * Sub-fluxo #3 (parte A) — resposta do cliente sobre estar na cidade.
 *
 * Ramifica (passo 6 × passo 7):
 *  - NÃO está na cidade → cria documentos pendentes e pede comprovantes (passo 6).
 *  - SIM está na cidade  → pergunta sobre testemunhas (passo 7).
 *  - Ambíguo            → repergunta, mantendo o estado.
 */
import type { Audiencia } from '../state.js';
import { setEstado } from '../state.js';
import { interpretarRespostaLocal } from '../services/interpret.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { montarPedidoDocsCliente, montarPerguntaTestemunhas } from '../services/messages.js';
import { query } from '../db.js';

/** Documentos solicitados quando o cliente está fora da cidade (passo 6). */
const DOCS_CLIENTE_FORA = ['contrato_trabalho', 'passagens', 'contrato_locacao'];

export async function tratarRespostaLocal(a: Audiencia, texto: string): Promise<void> {
  const r = await interpretarRespostaLocal(texto);

  if (r.na_cidade === false) {
    // Passo 6 — cliente fora: cria documentos pendentes e pede comprovantes.
    await query('UPDATE audiencias SET cliente_na_cidade = false WHERE id = $1', [a.id]);
    for (const tipo of DOCS_CLIENTE_FORA) {
      await query(
        `INSERT INTO documentos (audiencia_id, tipo_documento, status)
         VALUES ($1, $2, 'pendente')`,
        [a.id, tipo],
      );
    }
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarPedidoDocsCliente(a),
      audienciaId: a.id,
      template: 'pedido_docs_cliente',
    });
    await setEstado(a.id, 'aguardando_docs_cliente');
    console.log(`[fluxo3] ${a.id}: cliente fora da cidade → documentos solicitados.`);
    return;
  }

  if (r.na_cidade === true) {
    // Passo 7 — cliente na cidade: parte para as testemunhas.
    await query('UPDATE audiencias SET cliente_na_cidade = true WHERE id = $1', [a.id]);
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarPerguntaTestemunhas(a),
      audienciaId: a.id,
      template: 'pergunta_testemunhas',
    });
    await setEstado(a.id, 'coleta_testemunhas');
    console.log(`[fluxo3] ${a.id}: cliente na cidade → perguntando testemunhas.`);
    return;
  }

  // Ambíguo — repergunta sem trocar de estado.
  await enviarWhatsapp({
    telefone: a.cliente_telefone!,
    texto:
      `Desculpe, não entendi sua resposta. ` +
      `*Você estará na cidade${a.cidade ? ` de ${a.cidade}` : ' do processo'} na data da audiência?* ` +
      `Por favor responda *SIM* ou *NÃO*.`,
    audienciaId: a.id,
    template: 'reperguntar_local',
  });
  console.log(`[fluxo3] ${a.id}: resposta ambígua → reperguntado.`);
}
