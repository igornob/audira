/** Semáforo do painel de acompanhamento (passo 18). */
export type Semaforo = 'verde' | 'amarelo' | 'vermelho';

export function calcularSemaforo(opts: {
  diasRestantes: number | null;
  docsPendentes: number;
  clienteConfirmado: boolean;
  concluida: boolean;
}): Semaforo {
  if (opts.concluida) return 'verde';
  const dias = opts.diasRestantes ?? 999;

  // Crítico: audiência próxima (<= 2 dias) com pendências.
  if (dias <= 2 && (opts.docsPendentes > 0 || !opts.clienteConfirmado)) return 'vermelho';

  // Atenção: há pendências, mas ainda há tempo.
  if (opts.docsPendentes > 0 || !opts.clienteConfirmado) return 'amarelo';

  return 'verde';
}
