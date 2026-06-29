import type { Audiencia } from '../state.js';

/** Converte 'YYYY-MM-DD' em 'DD/MM/YYYY'. */
function dataBR(iso: string | null): string {
  if (!iso) return 'a confirmar';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function horaBR(hora: string | null): string {
  if (!hora) return '';
  return ` às ${hora.slice(0, 5)}`;
}

/**
 * Passo 5 — contato inicial com o cliente.
 * Informa data/hora/modalidade e pergunta se estará na cidade do processo.
 */
export function montarContatoInicialCliente(a: Audiencia): string {
  const nome = a.cliente_nome ? `Olá, ${a.cliente_nome}!` : 'Olá!';
  const quando = `${dataBR(a.data_audiencia)}${horaBR(a.hora_audiencia)}`;
  const modalidade =
    a.modalidade === 'virtual'
      ? 'de forma *virtual* (online)'
      : a.modalidade === 'presencial'
        ? '*presencialmente*'
        : '(modalidade a confirmar)';
  const cidade = a.cidade ? ` na cidade de *${a.cidade}*` : '';

  return (
    `${nome} Aqui é do escritório Hilton Lucena & Filhos Advogados.\n\n` +
    `Foi designada uma *audiência* no seu processo, marcada para *${quando}*, ${modalidade}${cidade}.\n\n` +
    `Para nos prepararmos, precisamos de uma informação: ` +
    `*você estará na cidade${a.cidade ? ` de ${a.cidade}` : ' do processo'} na data da audiência?* ` +
    `(responda *SIM* ou *NÃO*)`
  );
}
