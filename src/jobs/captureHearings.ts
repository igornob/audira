/**
 * Sub-fluxo #1 — Captura da Audiência (DJEN → Claude → Banco)
 *
 * Roda 1x/dia. Para cada OAB monitorada:
 *  1. consulta o DJEN do dia
 *  2. filtra o que parece audiência
 *  3. extrai os dados com o Claude
 *  4. deduplica (id da comunicação)
 *  5. enriquece com o telefone do cliente (tabela contatos_clientes, por processo)
 *  6. insere em `audiencias`
 *  7. dispara o n8n para iniciar o passo 4 (presencial × virtual)
 */
import { consultarHoje, pareceAudiencia } from '../services/djen.js';
import { extrairAudiencia } from '../services/claude.js';
import { prepararAudiencia } from '../flows/prepararAudiencia.js';
import { query } from '../db.js';

export async function capturarAudiencias(): Promise<void> {
  const comunicacoes = await consultarHoje();
  console.log(`[captura] ${comunicacoes.length} comunicações recebidas do DJEN.`);

  let criadas = 0;

  for (const c of comunicacoes) {
    if (!pareceAudiencia(c)) continue;

    // 4. dedup — já capturamos essa comunicação?
    const existente = await query(
      'SELECT id FROM audiencias WHERE id_comunicacao_djen = $1 LIMIT 1',
      [c.id],
    );
    if (existente.length > 0) continue;

    // 3. extração com o Claude
    let dados;
    try {
      dados = await extrairAudiencia(c);
    } catch (err) {
      console.error(`[captura] Falha ao extrair comunicação ${c.id}:`, err);
      continue;
    }
    if (!dados.e_audiencia) continue;

    const numeroProcesso = dados.numero_processo ?? c.numeroProcesso ?? null;

    // 5. enriquecimento — telefone do cliente pelo nº do processo
    let clienteNome: string | null = null;
    let clienteTelefone: string | null = null;
    if (numeroProcesso) {
      const contato = await query<{ cliente_nome: string; telefone: string }>(
        'SELECT cliente_nome, telefone FROM contatos_clientes WHERE numero_processo = $1 LIMIT 1',
        [numeroProcesso],
      );
      if (contato[0]) {
        clienteNome = contato[0].cliente_nome;
        clienteTelefone = contato[0].telefone;
      }
    }

    // 6. cria a audiência (status inicial amarelo)
    const inserida = await query<{ id: string }>(
      `INSERT INTO audiencias
        (numero_processo, tribunal, vara, cidade, estado, data_audiencia, hora_audiencia,
         tipo, modalidade, fonte_captura, id_comunicacao_djen, texto_intimacao,
         cliente_nome, cliente_telefone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DJEN',$10,$11,$12,$13,'amarelo')
       ON CONFLICT (id_comunicacao_djen) DO NOTHING
       RETURNING id`,
      [
        numeroProcesso,
        dados.tribunal ?? c.siglaTribunal ?? null,
        dados.vara ?? null,
        dados.cidade ?? null,
        dados.estado ?? null,
        dados.data_audiencia ?? null,
        dados.hora_audiencia ?? null,
        dados.tipo ?? null,
        dados.modalidade ?? null,
        c.id,
        c.texto ?? null,
        clienteNome,
        clienteTelefone,
      ],
    );

    if (inserida[0]) {
      criadas++;
      // 7. inicia o Sub-fluxo #2 (presencial × virtual + contato com o cliente)
      await prepararAudiencia(inserida[0].id);
    }
  }

  console.log(`[captura] ${criadas} novas audiências criadas.`);
}

// Permite rodar manualmente: `npm run capture`
const isMain = process.argv[1]?.endsWith('captureHearings.ts');
if (isMain) {
  capturarAudiencias()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
