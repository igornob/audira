/**
 * Sub-fluxo #4 (parte B) — recebe a cidade/estado de testemunhas que foram
 * cadastradas sem essa informação (passo 8, complemento).
 *
 * Estado: 'aguardando_cidade_testemunha'. Aplica a cidade às testemunhas
 * pendentes, decide presencial × telepresencial e segue para as orientações.
 */
import type { Audiencia } from '../state.js';
import { extrairLocalidade } from '../services/interpret.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { montarPedidoCidadeTestemunha } from '../services/messages.js';
import { decidirTestemunhaLocalizada, pedirOrientacoesTestemunha } from './testemunhas.js';
import { query } from '../db.js';

export async function tratarCidadeTestemunha(a: Audiencia, texto: string): Promise<void> {
  const pendentes = await query<{ id: string; nome: string }>(
    `SELECT id, nome FROM pessoas
      WHERE audiencia_id = $1 AND papel = 'testemunha'
        AND (cidade IS NULL OR cidade = '')`,
    [a.id],
  );

  if (pendentes.length === 0) {
    // Nada pendente (estado inconsistente) — segue para as orientações.
    await pedirOrientacoesTestemunha(a);
    return;
  }

  const loc = await extrairLocalidade(texto);
  if (!loc.cidade) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarPedidoCidadeTestemunha(pendentes.map((p) => p.nome)),
      audienciaId: a.id,
      template: 'reperguntar_cidade_testemunha',
    });
    return;
  }

  // Aplica a mesma cidade informada às testemunhas pendentes e decide cada uma.
  for (const p of pendentes) {
    await query('UPDATE pessoas SET cidade = $2, estado = $3 WHERE id = $1', [
      p.id,
      loc.cidade,
      loc.estado ?? null,
    ]);
    await decidirTestemunhaLocalizada(a, p.id, p.nome, loc.cidade);
  }

  await pedirOrientacoesTestemunha(a);
}
