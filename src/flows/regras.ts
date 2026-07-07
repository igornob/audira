/**
 * Regras de negócio do fluxo de audiências (manual funcional).
 */

/** Remove acentos e normaliza para comparação. */
function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Tipos de audiência que instruem prova e, portanto, podem ter testemunha.
 * Conforme o manual: apenas *una* e *instrução*. Conciliação, mediação e
 * "outra" seguem direto para a preparação, sem coleta de testemunhas.
 */
export function tipoTemTestemunha(tipo: string | null | undefined): boolean {
  const t = normalizar(tipo);
  return t === 'una' || t === 'instrucao';
}
