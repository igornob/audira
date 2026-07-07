/**
 * Sub-fluxo #7 — confirmação do checklist da audiência virtual (passo 13).
 *
 * Estado: 'aguardando_confirmacao_checklist'. Interpreta o SIM/NÃO do cliente:
 *  - SIM → cliente confirmado, segue para preparação.
 *  - NÃO → oferece ajuda e avisa a equipe (mantém aguardando).
 *  - ambíguo → repergunta.
 */
import type { Audiencia } from '../state.js';
import { setEstado } from '../state.js';
import { interpretarSimNao } from '../services/interpret.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { montarChecklistConfirmado, montarChecklistAjuda } from '../services/messages.js';
import { dispararN8n } from '../services/n8n.js';
import { query } from '../db.js';

export async function tratarConfirmacaoChecklist(a: Audiencia, texto: string): Promise<void> {
  const r = await interpretarSimNao(
    'Está tudo certo com internet, ambiente e equipamento para a audiência virtual?',
    texto,
  );

  if (r.resposta === 'sim') {
    await query('UPDATE audiencias SET cliente_confirmado = true WHERE id = $1', [a.id]);
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarChecklistConfirmado(),
      audienciaId: a.id,
      template: 'checklist_confirmado',
    });
    await setEstado(a.id, 'preparacao');
    console.log(`[fluxo7] ${a.id}: checklist confirmado → preparação.`);
    return;
  }

  if (r.resposta === 'nao') {
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarChecklistAjuda(),
      audienciaId: a.id,
      template: 'checklist_ajuda',
    });
    await dispararN8n('alerta.equipe', {
      audienciaId: a.id,
      motivo: 'Cliente sinalizou problema no checklist virtual (internet/ambiente/equipamento).',
    });
    console.log(`[fluxo7] ${a.id}: checklist com pendência → equipe avisada.`);
    return;
  }

  await enviarWhatsapp({
    telefone: a.cliente_telefone!,
    texto:
      'Só confirmando: está tudo certo com *internet*, *ambiente* e *equipamento* ' +
      'para a audiência virtual? (responda *SIM* ou *NÃO*)',
    audienciaId: a.id,
    template: 'checklist_reperguntar',
  });
}
