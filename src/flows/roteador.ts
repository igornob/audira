/**
 * Roteador de mensagens recebidas no WhatsApp.
 *
 * Dada uma mensagem do cliente/testemunha, encontra a audiência correspondente
 * (pelo telefone) e despacha para o handler certo conforme o estado do fluxo.
 */
import { query } from '../db.js';
import { getAudiencia } from '../state.js';
import type { Audiencia } from '../state.js';
import { tratarRespostaLocal } from './respostaLocalCliente.js';
import { tratarColetaTestemunhas } from './testemunhas.js';
import { tratarCidadeTestemunha } from './cidadeTestemunha.js';
import { tratarOrientacoesTestemunha } from './orientacoes.js';
import { tratarDocumentoRecebido } from './documentos.js';
import type { MidiaRecebida, RemetentePessoa } from './documentos.js';
import { tratarConfirmacaoChecklist } from './confirmacaoChecklist.js';

/** Mantém só os dígitos do telefone (para casar formatos diferentes). */
function digitos(tel: string): string {
  return tel.replace(/\D/g, '');
}

/** Estados em que o fluxo realmente espera uma mensagem de entrada. */
const ESTADOS_AGUARDANDO_MENSAGEM = [
  'aguardando_local_cliente',
  'coleta_testemunhas',
  'aguardando_docs_cliente',
  'aguardando_docs_testemunha',
];

/**
 * Acha a audiência ativa cujo telefone do cliente bate com o remetente.
 *
 * Desambiguação (um mesmo telefone pode ter mais de um caso ativo):
 *  1. quem está de fato aguardando uma resposta vem primeiro;
 *  2. entre essas, a audiência mais próxima da data;
 *  3. desempate final pela mais recente.
 */
async function acharAudienciaCliente(telefone: string): Promise<Audiencia | null> {
  const tail = digitos(telefone).slice(-8); // últimos 8 dígitos
  const rows = await query<Audiencia>(
    `SELECT * FROM audiencias
      WHERE right(regexp_replace(cliente_telefone, '\\D', '', 'g'), 8) = $1
        AND estado_fluxo NOT IN ('concluida', 'sem_contato')
      ORDER BY
        (estado_fluxo::text = ANY($2)) DESC,
        data_audiencia ASC NULLS LAST,
        created_at DESC
      LIMIT 1`,
    [tail, ESTADOS_AGUARDANDO_MENSAGEM],
  );
  return rows[0] ?? null;
}

/**
 * Identifica quem enviou a mensagem: uma *testemunha* (pelo telefone dela numa
 * audiência ativa) ou o *cliente*. Testemunha tem prioridade por ser mais
 * específica (o número dela é único da participante).
 */
async function identificarRemetente(
  telefone: string,
): Promise<{ audiencia: Audiencia; pessoa?: RemetentePessoa } | null> {
  const tail = digitos(telefone).slice(-8);

  const pessoas = await query<{ id: string; nome: string; telefone: string | null; audiencia_id: string }>(
    `SELECT id, nome, telefone, audiencia_id FROM pessoas
      WHERE telefone IS NOT NULL
        AND right(regexp_replace(telefone, '\\D', '', 'g'), 8) = $1
      ORDER BY created_at DESC`,
    [tail],
  );
  for (const p of pessoas) {
    const a = await getAudiencia(p.audiencia_id);
    if (a && a.estado_fluxo !== 'concluida' && a.estado_fluxo !== 'sem_contato') {
      return { audiencia: a, pessoa: { id: p.id, nome: p.nome, telefone: p.telefone } };
    }
  }

  const a = await acharAudienciaCliente(telefone);
  return a ? { audiencia: a } : null;
}

export async function rotearMensagem(
  telefone: string,
  texto: string,
  temMidia = false,
  midia?: MidiaRecebida,
): Promise<void> {
  const r = await identificarRemetente(telefone);
  if (!r) {
    console.log(`[roteador] Nenhuma audiência ativa para o telefone ${telefone}.`);
    return;
  }
  const { audiencia: a, pessoa } = r;

  // Registra a mensagem recebida (com a pessoa, se for uma testemunha).
  await query(
    `INSERT INTO mensagens (audiencia_id, pessoa_id, direcao, conteudo) VALUES ($1, $2, 'recebida', $3)`,
    [a.id, pessoa?.id ?? null, texto],
  );

  // Remetente é uma testemunha → trata os documentos dela (e responde a ela).
  if (pessoa) {
    await tratarDocumentoRecebido(a, texto, temMidia, midia, pessoa);
    return;
  }

  // Cliente: documento (anexo) pode chegar a qualquer momento — se houver
  // pendência DELE, trata como recebimento, independentemente do estado.
  if (temMidia) {
    const pend = await query<{ id: string }>(
      `SELECT id FROM documentos
        WHERE audiencia_id = $1 AND pessoa_id IS NULL AND status = 'pendente' LIMIT 1`,
      [a.id],
    );
    if (pend.length > 0) {
      await tratarDocumentoRecebido(a, texto, true, midia);
      return;
    }
  }

  switch (a.estado_fluxo) {
    case 'aguardando_local_cliente':
      await tratarRespostaLocal(a, texto);
      break;

    case 'coleta_testemunhas':
      await tratarColetaTestemunhas(a, texto);
      break;

    case 'aguardando_cidade_testemunha':
      await tratarCidadeTestemunha(a, texto);
      break;

    case 'aguardando_orientacoes_testemunha':
      await tratarOrientacoesTestemunha(a, texto);
      break;

    case 'aguardando_docs_cliente':
    case 'aguardando_docs_testemunha':
      await tratarDocumentoRecebido(a, texto, temMidia, midia);
      break;

    case 'aguardando_confirmacao_checklist':
      await tratarConfirmacaoChecklist(a, texto);
      break;

    default:
      console.log(`[roteador] ${a.id}: estado "${a.estado_fluxo}" sem handler de mensagem.`);
  }
}
