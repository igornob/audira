/**
 * Sub-fluxo #6 (parte A) — recebimento e conferência de documentos (passo 11).
 *
 * Documento chega como anexo (foto/PDF). O Claude confere, por visão, se ele
 * corresponde a algum dos documentos pendentes:
 *  - corresponde → marca aquele tipo como recebido (marcação atômica).
 *  - não corresponde → recusa e pede o documento certo.
 *
 * Se o remetente for uma *testemunha* (passa `pessoa`), mexe só nos documentos
 * dela e responde no WhatsApp dela; ao concluir, avisa o cliente por checklist.
 * Se for o *cliente*, conclui os documentos dele e o fluxo avança pelo tipo.
 */
import type { Audiencia } from '../state.js';
import { enviarWhatsapp } from '../services/whatsapp.js';
import { verificarDocumento } from '../services/interpret.js';
import { baixarMidia } from '../services/twilioMedia.js';
import {
  rotuloDoc,
  montarDocNaoCorresponde,
  montarDocRecebidoParcial,
  montarTestemunhaDocsCompletos,
} from '../services/messages.js';
import { pedirTestemunhasOuSeguir } from './testemunhas.js';
import { query } from '../db.js';

export interface MidiaRecebida {
  url?: string;
  mediaType?: string;
}

export interface RemetentePessoa {
  id: string;
  nome: string;
  telefone: string | null;
}

export async function tratarDocumentoRecebido(
  a: Audiencia,
  _texto: string,
  temMidia = false,
  midia?: MidiaRecebida,
  pessoa?: RemetentePessoa,
): Promise<void> {
  const telefoneDestino = pessoa?.telefone ?? a.cliente_telefone!;

  // Sem anexo, é só texto — orienta a enviar o arquivo e não marca nada.
  if (!temMidia) {
    await enviarWhatsapp({
      telefone: telefoneDestino,
      texto:
        'Para registrar, preciso do *documento em anexo* (foto ou PDF) — ' +
        'é só enviar o arquivo aqui mesmo neste WhatsApp. 🙏',
      audienciaId: a.id,
      pessoaId: pessoa?.id ?? null,
      template: 'doc_aguardando_anexo',
    });
    return;
  }

  // Escopo dos documentos pendentes: da testemunha, ou do cliente (pessoa_id nulo).
  const scoped = (extra = '') => {
    if (pessoa) return { clause: `AND pessoa_id = $2 ${extra}`, params: [a.id, pessoa.id] };
    if (a.estado_fluxo === 'aguardando_docs_cliente')
      return { clause: `AND pessoa_id IS NULL ${extra}`, params: [a.id] };
    return { clause: extra, params: [a.id] };
  };

  const q1 = scoped();
  const pendentes = await query<{ id: string; tipo_documento: string }>(
    `SELECT id, tipo_documento FROM documentos
      WHERE audiencia_id = $1 AND status = 'pendente' ${q1.clause}
      ORDER BY created_at ASC`,
    q1.params,
  );

  if (pendentes.length === 0) {
    await enviarWhatsapp({
      telefone: telefoneDestino,
      texto: 'Recebido! Já temos todos os documentos necessários. Obrigado! 🙏',
      audienciaId: a.id,
      pessoaId: pessoa?.id ?? null,
      template: 'doc_extra',
    });
    return;
  }

  // Confere, por visão, a qual documento pendente o arquivo corresponde.
  let alvoTipo: string;
  if (midia?.url) {
    try {
      const img = await baixarMidia(midia.url);
      const v = await verificarDocumento(
        img.base64,
        midia.mediaType || img.mediaType,
        pendentes.map((p) => ({ tipo: p.tipo_documento, rotulo: rotuloDoc(p.tipo_documento) })),
      );
      if (!v.tipo) {
        await enviarWhatsapp({
          telefone: telefoneDestino,
          texto: montarDocNaoCorresponde(pendentes.map((p) => p.tipo_documento), v.descricao),
          audienciaId: a.id,
          pessoaId: pessoa?.id ?? null,
          template: 'doc_nao_corresponde',
        });
        console.log(`[docs] ${a.id}: documento não corresponde ("${v.descricao}") → recusado.`);
        return;
      }
      alvoTipo = v.tipo;
    } catch (err) {
      console.error(`[docs] ${a.id}: verificação indisponível (${(err as Error).message}) — aceitando sem checar.`);
      alvoTipo = pendentes[0].tipo_documento;
    }
  } else {
    alvoTipo = pendentes[0].tipo_documento;
  }

  // Marcação atômica: reserva UM documento pendente daquele tipo.
  const alvo = pendentes.find((p) => p.tipo_documento === alvoTipo) ?? pendentes[0];
  const claimed = await query<{ id: string }>(
    `UPDATE documentos SET status = 'recebido', recebido_em = now()
      WHERE id = $1 AND status = 'pendente' RETURNING id`,
    [alvo.id],
  );

  const q2 = scoped();
  const rest = await query<{ tipo_documento: string }>(
    `SELECT tipo_documento FROM documentos
      WHERE audiencia_id = $1 AND status = 'pendente' ${q2.clause}
      ORDER BY created_at ASC`,
    q2.params,
  );
  const restantes = rest.map((r) => r.tipo_documento);

  // Documento já estava recebido (reenvio/corrida) e ainda há pendências.
  if (claimed.length === 0 && restantes.length > 0) {
    await enviarWhatsapp({
      telefone: telefoneDestino,
      texto:
        `Esse *${rotuloDoc(alvo.tipo_documento)}* nós já tínhamos recebido. ✅\n\n` +
        `Ainda faltam:\n${restantes.map((t) => `• *${rotuloDoc(t)}*`).join('\n')}`,
      audienciaId: a.id,
      pessoaId: pessoa?.id ?? null,
      template: 'doc_duplicado',
    });
    return;
  }

  if (restantes.length > 0) {
    await enviarWhatsapp({
      telefone: telefoneDestino,
      texto: montarDocRecebidoParcial(alvo.tipo_documento, restantes),
      audienciaId: a.id,
      pessoaId: pessoa?.id ?? null,
      template: 'doc_recebido_parcial',
    });
    return;
  }

  // Sem pendências.
  const msgCompleto = 'Perfeito, recebemos todos os documentos. Muito obrigado! 🙏';

  if (pessoa) {
    // Testemunha concluiu os documentos dela → avisa ela e o cliente (checklist).
    await enviarWhatsapp({
      telefone: telefoneDestino,
      texto: msgCompleto,
      audienciaId: a.id,
      pessoaId: pessoa.id,
      template: 'doc_recebido_completo',
    });
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: montarTestemunhaDocsCompletos(pessoa.nome),
      audienciaId: a.id,
      pessoaId: pessoa.id,
      template: 'testemunha_docs_completos',
    });
    return;
  }

  // Cliente terminou os documentos dele → avança pelo tipo (guard atômico evita
  // "recebemos todos" e transição duplicados sob anexos simultâneos).
  if (a.estado_fluxo === 'aguardando_docs_cliente') {
    const venceu = await query<{ id: string }>(
      `UPDATE audiencias SET estado_fluxo = 'preparacao'
        WHERE id = $1 AND estado_fluxo = 'aguardando_docs_cliente' RETURNING id`,
      [a.id],
    );
    if (venceu.length === 0) return;
    await enviarWhatsapp({
      telefone: a.cliente_telefone!,
      texto: msgCompleto,
      audienciaId: a.id,
      template: 'doc_recebido_completo',
    });
    await pedirTestemunhasOuSeguir(a);
    return;
  }

  await enviarWhatsapp({
    telefone: a.cliente_telefone!,
    texto: msgCompleto,
    audienciaId: a.id,
    template: 'doc_recebido_completo',
  });
}
