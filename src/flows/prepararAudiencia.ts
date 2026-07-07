/**
 * Sub-fluxo #2 — Decisão presencial × virtual + contato inicial com o cliente
 * (passos 4 e 5 do manual).
 *
 * Disparado logo após a captura (Sub-fluxo #1). Para cada audiência nova:
 *  - Passo 4: se PRESENCIAL, aciona a contratação de correspondente.
 *             se VIRTUAL, segue direto para o contato com o cliente.
 *  - Passo 5: envia ao cliente data/hora/modalidade e pergunta se estará na cidade.
 *  - Grava o estado do fluxo (aguardando resposta do cliente).
 */
import { getAudiencia, setEstado } from '../state.js';
import { montarContatoInicialCliente } from '../services/messages.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { dispararN8n } from '../services/n8n.js';
import { pedirTestemunhasOuSeguir } from './testemunhas.js';

export async function prepararAudiencia(audienciaId: string): Promise<void> {
  const a = await getAudiencia(audienciaId);
  if (!a) {
    console.warn(`[prepara] Audiência ${audienciaId} não encontrada.`);
    return;
  }

  // ---- Passo 4: primeira decisão (presencial × virtual) ----
  if (a.modalidade === 'presencial') {
    // Aciona o n8n para iniciar a contratação de correspondente naquela comarca.
    await dispararN8n('correspondente.contratar', {
      audienciaId: a.id,
      cidade: a.cidade,
      estado: a.estado,
      data: a.data_audiencia,
      hora: a.hora_audiencia,
    });
    console.log(`[prepara] ${a.id}: presencial → correspondente acionado.`);
  }

  // ---- Passo 5: contato inicial com o cliente ----
  if (!a.cliente_telefone) {
    // Sem telefone não há como contatar — sinaliza a equipe.
    await setEstado(a.id, 'sem_contato');
    await dispararN8n('alerta.equipe', {
      audienciaId: a.id,
      motivo: 'Sem telefone do cliente — preencher contato para iniciar o fluxo.',
    });
    console.log(`[prepara] ${a.id}: sem telefone → equipe avisada.`);
    return;
  }

  const texto = montarContatoInicialCliente(a);
  await enviarWhatsapp({
    telefone: a.cliente_telefone,
    texto,
    audienciaId: a.id,
    template: 'contato_inicial_cliente',
  });
  console.log(`[prepara] ${a.id}: contato inicial enviado ao cliente.`);

  if (a.modalidade === 'virtual') {
    // Online: participa de onde estiver — sem "está na cidade?" nem documentos.
    // Segue direto pelo tipo (testemunhas ou grupo).
    await pedirTestemunhasOuSeguir(a);
  } else {
    // Presencial: aguarda a resposta "está na cidade?" (Sub-fluxo #3). Se estiver
    // fora, pediremos documentos para requerer a participação online ao juiz.
    await setEstado(a.id, 'aguardando_local_cliente');
  }
}
