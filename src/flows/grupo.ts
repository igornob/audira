/**
 * Sub-fluxo #5 — Grupo de WhatsApp (passo 10) + disparo do checklist virtual (passo 13).
 *
 * Após a confirmação das partes, cria um grupo com o cliente, as testemunhas e
 * (quando houver) o correspondente. A criação efetiva é feita pelo n8n, que fala
 * com a API do WhatsApp; aqui montamos a lista de participantes e o nome do grupo.
 */
import { getAudiencia, setEstado } from '../state.js';
import { dispararN8n } from '../services/n8n.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { montarChecklistVirtual, montarGrupoCriado } from '../services/messages.js';
import { query } from '../db.js';

export async function criarGrupoWhatsapp(audienciaId: string): Promise<void> {
  const a = await getAudiencia(audienciaId);
  if (!a) return;

  // Participantes: cliente + testemunhas (com telefone).
  const testemunhas = await query<{ nome: string; telefone: string | null }>(
    `SELECT nome, telefone FROM pessoas
      WHERE audiencia_id = $1 AND papel = 'testemunha' AND telefone IS NOT NULL`,
    [audienciaId],
  );

  const participantes = [
    a.cliente_telefone,
    ...testemunhas.map((t) => t.telefone),
  ].filter((tel): tel is string => Boolean(tel));

  // Correspondente, se presencial.
  const corresp = await query<{ correspondente_telefone: string | null }>(
    `SELECT correspondente_telefone FROM audiencias WHERE id = $1`,
    [audienciaId],
  );
  if (corresp[0]?.correspondente_telefone) {
    participantes.push(corresp[0].correspondente_telefone);
  }

  const nomeGrupo = `Audiência ${a.numero_processo ?? ''} — ${a.cliente_nome ?? 'Cliente'}`.trim();

  await dispararN8n('whatsapp.grupo.criar', {
    audienciaId,
    nomeGrupo,
    participantes,
  });

  await query('UPDATE audiencias SET grupo_criado = true WHERE id = $1', [audienciaId]);

  // Passo 10 — avisa o cliente que o grupo de acompanhamento está sendo criado.
  if (a.cliente_telefone) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone,
      texto: montarGrupoCriado(nomeGrupo),
      audienciaId,
      template: 'grupo_criado',
    });
  }

  // Passo 13 — se virtual, manda o checklist e aguarda a confirmação (SIM/NÃO).
  if (a.modalidade === 'virtual' && a.cliente_telefone) {
    await enviarWhatsapp({
      telefone: a.cliente_telefone,
      texto: montarChecklistVirtual(a),
      audienciaId,
      template: 'checklist_virtual',
    });
    await setEstado(audienciaId, 'aguardando_confirmacao_checklist');
  } else {
    await setEstado(audienciaId, 'preparacao');
  }
  console.log(`[fluxo5] ${audienciaId}: grupo solicitado (${participantes.length} participantes).`);
}
