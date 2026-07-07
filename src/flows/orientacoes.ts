/**
 * Sub-fluxo #4 (parte C) — orientações/dados trabalhistas das testemunhas (passo 9).
 *
 * Estado: 'aguardando_orientacoes_testemunha'. Extrai período de trabalho,
 * navio, função e agência recrutadora e grava nas testemunhas que ainda não
 * têm esses dados. Em seguida, cria o grupo de acompanhamento (passo 10).
 */
import type { Audiencia } from '../state.js';
import { extrairOrientacoes } from '../services/interpret.js';
import { query } from '../db.js';
import { criarGrupoWhatsapp } from './grupo.js';

export async function tratarOrientacoesTestemunha(a: Audiencia, texto: string): Promise<void> {
  const o = await extrairOrientacoes(texto);

  // Preenche apenas os campos ainda vazios das testemunhas desta audiência.
  await query(
    `UPDATE pessoas SET
        periodo_trabalho    = COALESCE(periodo_trabalho, $2),
        navio               = COALESCE(navio, $3),
        funcao              = COALESCE(funcao, $4),
        agencia_recrutadora = COALESCE(agencia_recrutadora, $5)
      WHERE audiencia_id = $1 AND papel = 'testemunha'`,
    [
      a.id,
      o.periodo_trabalho ?? null,
      o.navio ?? null,
      o.funcao ?? null,
      o.agencia_recrutadora ?? null,
    ],
  );

  console.log(`[fluxo4] ${a.id}: orientações recebidas → criando grupo.`);
  await criarGrupoWhatsapp(a.id);
}
