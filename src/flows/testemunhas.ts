/**
 * Sub-fluxo #4 — Testemunhas (passos 7, 8 e 9).
 *
 * Só entra aqui quando o tipo da audiência instrui prova (una/instrução).
 *  - "não há testemunhas" → segue para o grupo (passo 10).
 *  - dados de testemunhas → cadastra cada uma. Quem tem cidade: decide
 *    presencial × telepresencial (passo 8). Quem veio *sem* cidade: fica
 *    pendente e perguntamos só a cidade (sem repetir tudo).
 *  - com todas localizadas → orientações/impedimentos e coleta de dados
 *    trabalhistas (passo 9).
 */
import type { Audiencia } from '../state.js';
import { setEstado } from '../state.js';
import { interpretarSimNao, extrairTestemunhas } from '../services/interpret.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import {
  montarPerguntaTestemunhas,
  montarSemTestemunhaPorTipo,
  montarResumoTestemunhaCliente,
  montarPedidoCidadeTestemunha,
  montarOrientacoesTestemunha,
} from '../services/messages.js';
import { criarGrupoWhatsapp } from './grupo.js';
import { tipoTemTestemunha } from './regras.js';
import { query } from '../db.js';

/** Normaliza cidade para comparação (sem acento, minúscula). */
function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

const DOCS_TESTEMUNHA_FORA = ['rg', 'comprovante_residencia'];

/**
 * Passo 5→7: depois de confirmar a localização do cliente (ou de receber os
 * documentos), decide pelo *tipo* se pergunta testemunhas ou segue direto.
 */
export async function pedirTestemunhasOuSeguir(a: Audiencia): Promise<void> {
  if (tipoTemTestemunha(a.tipo)) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarPerguntaTestemunhas(a),
      audienciaId: a.id,
      template: 'pergunta_testemunhas',
    });
    await setEstado(a.id, 'coleta_testemunhas');
    console.log(`[fluxo4] ${a.id}: tipo "${a.tipo}" → perguntando testemunhas.`);
  } else {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarSemTestemunhaPorTipo(a),
      audienciaId: a.id,
      template: 'sem_testemunha_tipo',
    });
    console.log(`[fluxo4] ${a.id}: tipo "${a.tipo}" não instrui prova → pulando testemunhas.`);
    await criarGrupoWhatsapp(a.id);
  }
}

/**
 * Decide presencial × telepresencial para uma testemunha já localizada.
 * Se mora fora, cria os documentos pendentes e pede os comprovantes.
 */
export async function decidirTestemunhaLocalizada(
  a: Audiencia,
  pessoaId: string,
  nome: string,
  cidade: string,
): Promise<void> {
  const presencial = normalizar(cidade) === normalizar(a.cidade);
  await query('UPDATE pessoas SET presencial = $2 WHERE id = $1', [pessoaId, presencial]);

  // Testemunha de outra cidade → depoimento telepresencial: cria os documentos
  // pendentes (que serão cobrados *direto dela* pelo job de cobranças).
  if (!presencial) {
    for (const tipo of DOCS_TESTEMUNHA_FORA) {
      await query(
        `INSERT INTO documentos (audiencia_id, pessoa_id, tipo_documento, status)
         VALUES ($1, $2, $3, 'pendente')`,
        [a.id, pessoaId, tipo],
      );
    }
  }

  // O primeiro contato com a testemunha é feito pelo cliente (que a indicou);
  // o cliente recebe um checklist do andamento.
  await enviarWhatsapp({
    telefone: a.cliente_telefone!,
    texto: montarResumoTestemunhaCliente(nome, cidade, !presencial),
    audienciaId: a.id,
    pessoaId,
    template: 'resumo_testemunha_cliente',
  });
}

/** Envia impedimentos + coleta de dados trabalhistas e passa a aguardar (passo 9). */
export async function pedirOrientacoesTestemunha(a: Audiencia): Promise<void> {
  await enviarWhatsapp({
    telefone: a.cliente_telefone!,
    texto: montarOrientacoesTestemunha(),
    audienciaId: a.id,
    template: 'orientacoes_testemunha',
  });
  await setEstado(a.id, 'aguardando_orientacoes_testemunha');
  console.log(`[fluxo4] ${a.id}: testemunhas localizadas → aguardando orientações.`);
}

export async function tratarColetaTestemunhas(a: Audiencia, texto: string): Promise<void> {
  const simNao = await interpretarSimNao('Haverá testemunhas na audiência?', texto);
  if (simNao.resposta === 'nao') {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: 'Combinado, sem testemunhas então. Vamos seguir com a preparação. ✅',
      audienciaId: a.id,
      template: 'sem_testemunhas',
    });
    console.log(`[fluxo4] ${a.id}: sem testemunhas → criando grupo.`);
    await criarGrupoWhatsapp(a.id);
    return;
  }

  const testemunhas = await extrairTestemunhas(texto);
  if (testemunhas.length === 0) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto:
        'Para cadastrar as testemunhas, preciso, de *cada uma*: *nome completo*, ' +
        '*telefone*, *cidade* e *estado* onde mora. Pode enviar em uma mensagem?',
      audienciaId: a.id,
      template: 'reperguntar_testemunhas',
    });
    return;
  }

  const semCidade: string[] = [];
  for (const t of testemunhas) {
    const temCidade = normalizar(t.cidade) !== '';
    const inserida = await query<{ id: string }>(
      `INSERT INTO pessoas (audiencia_id, papel, nome, telefone, cidade, estado, presencial)
       VALUES ($1, 'testemunha', $2, $3, $4, $5, $6)
       RETURNING id`,
      [a.id, t.nome, t.telefone ?? null, t.cidade ?? null, t.estado ?? null, null],
    );
    const pessoaId = inserida[0]?.id;
    if (!pessoaId) continue;

    if (temCidade) {
      await decidirTestemunhaLocalizada(a, pessoaId, t.nome, t.cidade!);
    } else {
      semCidade.push(t.nome);
    }
  }

  // Alguma testemunha sem cidade → pergunta só a cidade (o resto já está salvo).
  if (semCidade.length > 0) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarPedidoCidadeTestemunha(semCidade),
      audienciaId: a.id,
      template: 'reperguntar_cidade_testemunha',
    });
    await setEstado(a.id, 'aguardando_cidade_testemunha');
    console.log(`[fluxo4] ${a.id}: falta cidade de ${semCidade.join(', ')} → aguardando.`);
    return;
  }

  await pedirOrientacoesTestemunha(a);
}
