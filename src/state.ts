import { query } from './db.js';

/** Estados do fluxo de uma audiência (espelha o enum estado_fluxo no banco). */
export type EstadoFluxo =
  | 'nova'
  | 'aguardando_correspondente'
  | 'aguardando_local_cliente'
  | 'aguardando_docs_cliente'
  | 'coleta_testemunhas'
  | 'aguardando_docs_testemunha'
  | 'grupo_criado'
  | 'preparacao'
  | 'reuniao_agendada'
  | 'concluida'
  | 'sem_contato';

/** Registro de audiência (campos usados pelos fluxos). */
export interface Audiencia {
  id: string;
  numero_processo: string | null;
  vara: string | null;
  cidade: string | null;
  estado: string | null;
  data_audiencia: string | null;
  hora_audiencia: string | null;
  tipo: string | null;
  modalidade: 'presencial' | 'virtual' | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  estado_fluxo: EstadoFluxo;
}

export async function getAudiencia(id: string): Promise<Audiencia | null> {
  const rows = await query<Audiencia>('SELECT * FROM audiencias WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function setEstado(id: string, estado: EstadoFluxo): Promise<void> {
  await query('UPDATE audiencias SET estado_fluxo = $1, updated_at = now() WHERE id = $2', [
    estado,
    id,
  ]);
}
