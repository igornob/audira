/**
 * Roteador de mensagens recebidas no WhatsApp.
 *
 * Dada uma mensagem do cliente/testemunha, encontra a audiência correspondente
 * (pelo telefone) e despacha para o handler certo conforme o estado do fluxo.
 */
import { query } from '../db.js';
import type { Audiencia } from '../state.js';
import { tratarRespostaLocal } from './respostaLocalCliente.js';

/** Mantém só os dígitos do telefone (para casar formatos diferentes). */
function digitos(tel: string): string {
  return tel.replace(/\D/g, '');
}

/** Acha a audiência ativa cujo telefone do cliente bate com o remetente. */
async function acharAudienciaPorTelefone(telefone: string): Promise<Audiencia | null> {
  const tail = digitos(telefone).slice(-8); // últimos 8 dígitos
  const rows = await query<Audiencia>(
    `SELECT * FROM audiencias
      WHERE right(regexp_replace(cliente_telefone, '\\D', '', 'g'), 8) = $1
        AND estado_fluxo NOT IN ('concluida', 'sem_contato')
      ORDER BY created_at DESC
      LIMIT 1`,
    [tail],
  );
  return rows[0] ?? null;
}

export async function rotearMensagem(telefone: string, texto: string): Promise<void> {
  const a = await acharAudienciaPorTelefone(telefone);
  if (!a) {
    console.log(`[roteador] Nenhuma audiência ativa para o telefone ${telefone}.`);
    return;
  }

  // Registra a mensagem recebida.
  await query(
    `INSERT INTO mensagens (audiencia_id, direcao, conteudo) VALUES ($1, 'recebida', $2)`,
    [a.id, texto],
  );

  switch (a.estado_fluxo) {
    case 'aguardando_local_cliente':
      await tratarRespostaLocal(a, texto);
      break;

    // TODO Sub-fluxos seguintes:
    case 'aguardando_docs_cliente':       // recebimento de documentos do cliente
    case 'coleta_testemunhas':            // dados das testemunhas
    case 'aguardando_docs_testemunha':    // documentos das testemunhas
      console.log(`[roteador] ${a.id}: estado "${a.estado_fluxo}" ainda não implementado.`);
      break;

    default:
      console.log(`[roteador] ${a.id}: estado "${a.estado_fluxo}" sem handler de mensagem.`);
  }
}
