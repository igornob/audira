import { config, type OAB } from '../config.js';

/**
 * Comunicação retornada pela Comunica API (DJEN).
 * ATENÇÃO: confirme os nomes exatos dos campos no Swagger oficial
 * (https://comunicaapi.pje.jus.br/). Ajuste a interface conforme o retorno real.
 */
export interface ComunicacaoDJEN {
  id: string;
  numeroProcesso?: string;
  siglaTribunal?: string;
  nomeOrgao?: string;
  texto?: string;
  dataDisponibilizacao?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Consulta as comunicações publicadas no DJEN para uma OAB, num intervalo de datas.
 * A consulta é PÚBLICA (não exige autenticação).
 */
export async function consultarComunicacoes(
  oab: OAB,
  inicio: Date,
  fim: Date,
): Promise<ComunicacaoDJEN[]> {
  const params = new URLSearchParams({
    numeroOab: oab.numero,
    ufOab: oab.uf,
    dataDisponibilizacaoInicio: ymd(inicio),
    dataDisponibilizacaoFim: ymd(fim),
    itensPorPagina: '100',
    pagina: '1',
  });

  const url = `${config.djenBaseUrl}/comunicacao?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`DJEN respondeu ${res.status} para OAB ${oab.numero}-${oab.uf}`);
  }

  const json: any = await res.json();
  // O envelope varia; normalmente os itens vêm em `items` ou `content`.
  const items: any[] = json.items ?? json.content ?? json.data ?? [];
  return items as ComunicacaoDJEN[];
}

/** Consulta todas as OABs monitoradas para o dia de hoje. */
export async function consultarHoje(): Promise<ComunicacaoDJEN[]> {
  const hoje = new Date();
  const todas: ComunicacaoDJEN[] = [];
  for (const oab of config.oabs) {
    const c = await consultarComunicacoes(oab, hoje, hoje);
    todas.push(...c);
  }
  return todas;
}

/** Filtro barato: descarta o que claramente não é audiência antes de chamar o Claude. */
export function pareceAudiencia(c: ComunicacaoDJEN): boolean {
  const txt = (c.texto ?? '').toLowerCase();
  return txt.includes('audiência') || txt.includes('audiencia');
}
