/**
 * Sub-fluxo #8 — lembretes e reunião prévia (passos 14-15).
 *
 * Roda de hora em hora. Para cada audiência futura:
 *  - 7 dias antes  → aviso ao cliente + heads-up às testemunhas.
 *  - 1 dia antes   → agenda a reunião de alinhamento no Zoom (via n8n).
 *  - ~3 horas antes → lembrete final ao cliente e às testemunhas (com as
 *    instruções do dia: link se virtual, local se presencial).
 */
import { query } from '../db.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { dispararN8n } from '../services/n8n.js';
import { setEstado } from '../state.js';
import {
  montarLembrete7dias,
  montarLembrete7diasParticipante,
  montarLembreteFinal,
} from '../services/messages.js';
import type { Audiencia } from '../state.js';

interface AudienciaLembrete extends Audiencia {
  lembrete_7d_enviado: boolean;
  reuniao_convite_enviado: boolean;
  lembrete_3h_enviado: boolean;
  dias_restantes: number;
}

interface Participante {
  id: string;
  nome: string;
  telefone: string;
}

/** Quantas horas faltam até a audiência (data + hora), no horário local do servidor. */
function horasAte(a: Audiencia): number | null {
  if (!a.data_audiencia || !a.hora_audiencia) return null;
  const d = new Date(a.data_audiencia); // pg entrega a data como meia-noite local
  const [hh, mm] = String(a.hora_audiencia).split(':').map(Number);
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh || 0, mm || 0);
  return (alvo.getTime() - Date.now()) / 3_600_000;
}

async function participantes(audienciaId: string): Promise<Participante[]> {
  return query<Participante>(
    `SELECT id, nome, telefone FROM pessoas
      WHERE audiencia_id = $1 AND papel = 'testemunha' AND telefone IS NOT NULL`,
    [audienciaId],
  );
}

export async function rodarLembretes(): Promise<void> {
  const rows = await query<AudienciaLembrete>(
    `SELECT *,
            (data_audiencia - CURRENT_DATE) AS dias_restantes
       FROM audiencias
      WHERE audiencia_concluida = false
        AND data_audiencia IS NOT NULL
        AND data_audiencia >= CURRENT_DATE`,
  );

  for (const a of rows) {
    const dias = Number(a.dias_restantes);
    if (!a.cliente_telefone) continue;

    // 7 dias antes → aviso ao cliente + heads-up às testemunhas.
    if (dias <= 7 && dias > 1 && !a.lembrete_7d_enviado) {
      await enviarWhatsapp({
        telefone: a.cliente_telefone,
        texto: montarLembrete7dias(a),
        audienciaId: a.id,
        template: 'lembrete_7d',
      });
      for (const p of await participantes(a.id)) {
        await enviarWhatsapp({
          telefone: p.telefone,
          texto: montarLembrete7diasParticipante(a, p.nome),
          audienciaId: a.id,
          pessoaId: p.id,
          template: 'lembrete_7d_testemunha',
        });
      }
      await query('UPDATE audiencias SET lembrete_7d_enviado = true WHERE id = $1', [a.id]);
    }

    // 1 dia antes → reunião de alinhamento (Zoom via n8n).
    if (dias === 1 && !a.reuniao_convite_enviado) {
      await dispararN8n('reuniao.agendar', {
        audienciaId: a.id,
        clienteTelefone: a.cliente_telefone,
        data: a.data_audiencia,
      });
      await query('UPDATE audiencias SET reuniao_convite_enviado = true WHERE id = $1', [a.id]);
      await setEstado(a.id, 'reuniao_agendada');
    }

    // ~3 horas antes → lembrete final ao cliente e às testemunhas.
    const horas = horasAte(a);
    if (horas !== null && horas >= 0 && horas <= 3 && !a.lembrete_3h_enviado) {
      await enviarWhatsapp({
        telefone: a.cliente_telefone,
        texto: montarLembreteFinal(a),
        audienciaId: a.id,
        template: 'lembrete_final',
      });
      for (const p of await participantes(a.id)) {
        await enviarWhatsapp({
          telefone: p.telefone,
          texto: montarLembreteFinal(a, { paraParticipante: true, nome: p.nome }),
          audienciaId: a.id,
          pessoaId: p.id,
          template: 'lembrete_final_testemunha',
        });
      }
      await query('UPDATE audiencias SET lembrete_3h_enviado = true WHERE id = $1', [a.id]);
    }
  }

  console.log(`[lembretes] processadas ${rows.length} audiências futuras.`);
}

const isMain = process.argv[1]?.endsWith('lembretes.ts');
if (isMain) {
  rodarLembretes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
