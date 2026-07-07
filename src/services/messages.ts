import type { Audiencia } from '../state.js';
import { config } from '../config.js';

/** Converte uma data ('YYYY-MM-DD', ISO ou Date do pg) em 'DD/MM/YYYY'. */
function dataBR(valor: string | Date | null): string {
  if (!valor) return 'a confirmar';
  // A coluna `date` do Postgres chega como objeto Date pelo driver pg.
  const iso =
    valor instanceof Date
      ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(
          valor.getDate(),
        ).padStart(2, '0')}`
      : valor;
  const [y, m, d] = iso.slice(0, 10).split('-');
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
  const ondeTramita = a.cidade ? ` (processo em *${a.cidade}*)` : '';
  const abertura = `${nome} Aqui é do escritório Hilton Lucena & Filhos Advogados.`;

  // Virtual (online): participa de onde estiver — sem pergunta de localização nem
  // documentos de deslocamento. Só informamos e seguimos para a preparação.
  if (a.modalidade === 'virtual') {
    return (
      `${abertura}\n\n` +
      `Foi designada uma *audiência virtual (online)* no seu processo, marcada para *${quando}*${ondeTramita}.\n\n` +
      `Como é *online*, você participa de onde estiver — não precisa se deslocar nem enviar comprovantes de viagem. ` +
      `Vamos seguir com a preparação. 👇`
    );
  }

  // Presencial (ou modalidade a confirmar → tratamos como presencial por segurança):
  // aí sim a localização importa. Se estiver em outra cidade/estado, pediremos
  // documentos para requerer ao juiz a participação online daquela pessoa.
  const cidadeNome = a.cidade ?? 'a cidade do processo';
  const cidadeQ = a.cidade ? `na cidade de ${a.cidade}` : 'na cidade do processo';
  return (
    `${abertura}\n\n` +
    `Foi designada uma *audiência presencial* no seu processo, marcada para *${quando}*${ondeTramita}.\n\n` +
    `Para nos organizarmos, precisamos saber: na data da audiência, *você estará ${cidadeQ}?*\n` +
    `➡️ Se você estará *em ${cidadeNome}*, responda *SIM* (comparecimento presencial).\n` +
    `➡️ Se estará *em outra cidade/estado*, responda *NÃO* — aí podemos pedir ao juiz que, para você, a participação seja *online*.`
  );
}

/**
 * Passo 6 — cliente fora da cidade.
 * Pede os documentos para fundamentar o pedido de comparecimento virtual.
 */
export function montarPedidoDocsCliente(a: Audiencia): string {
  const cidade = a.cidade ? ` de ${a.cidade}` : ' do processo';
  return (
    `Entendido! Como você não estará na cidade${cidade} na data, ` +
    `podemos pedir ao juízo que você participe *virtualmente*.\n\n` +
    `Para fundamentar esse pedido, precisamos que você envie um ou mais destes documentos:\n` +
    `• *Contrato de trabalho* (se estiver trabalhando em outra cidade/embarcado)\n` +
    `• *Passagens* (aéreas, marítimas ou rodoviárias)\n` +
    `• *Contrato de locação* na outra cidade\n` +
    `• Ou documento equivalente que comprove que você estará fora\n\n` +
    `Pode enviar as fotos ou PDFs aqui mesmo neste WhatsApp. 🙏`
  );
}

/**
 * Passo 7 — pergunta sobre testemunhas (só para audiências de instrução/una).
 */
export function montarPerguntaTestemunhas(_a: Audiencia): string {
  return (
    `Perfeito! Vamos seguir com a preparação.\n\n` +
    `Essa audiência é de *instrução* (colhe depoimentos). *Você terá testemunhas?*\n` +
    `➡️ Se *sim*, envie agora, para *cada testemunha*, em uma mensagem:\n` +
    `   *nome completo*, *telefone*, *cidade* e *estado* onde ela mora.\n` +
    `➡️ Se *não* terá testemunhas, responda *NÃO*.`
  );
}

/**
 * Tipo de audiência sem instrução de prova (conciliação, mediação, etc.):
 * não há coleta de testemunhas — seguimos direto para a preparação.
 */
export function montarSemTestemunhaPorTipo(_a: Audiencia): string {
  return (
    `Ótimo, já temos o essencial! ✅\n\n` +
    `Pelo *tipo* dessa audiência, ela *não* colhe depoimento de testemunhas — ` +
    `então não precisamos desses dados. Vamos seguir com a preparação e criar o ` +
    `grupo de acompanhamento com você e a nossa equipe.`
  );
}

/**
 * Passo 7 — falta a cidade/estado de uma ou mais testemunhas.
 * Pergunta só o que falta (guardamos o resto), sem pedir tudo de novo.
 */
export function montarPedidoCidadeTestemunha(nomes: string[]): string {
  const plural = nomes.length > 1;
  const lista = nomes.map((n) => `*${n}*`).join(', ');
  if (plural) {
    return (
      `Anotei as testemunhas! ✅ Faltou só *um dado* delas: em qual *cidade e estado* moram — ${lista}?\n` +
      `_(não precisa reenviar nome e telefone — é para completar o cadastro que já fiz)_\n` +
      `Responda com a cidade e o estado de cada uma — ex.: *Recife, PE*.`
    );
  }
  return (
    `Anotei a testemunha ${lista}! ✅ Faltou só *um dado dela*: em qual *cidade e estado* ela mora?\n` +
    `_(é a mesma testemunha — não precisa reenviar nome e telefone)_\n` +
    `Responda só com a cidade e o estado — ex.: *Recife, PE*.`
  );
}

/**
 * Passo 8 — testemunha em outra cidade: pede documentos para depoimento telepresencial.
 */
export function montarPedidoDocsTestemunha(nomeTestemunha: string): string {
  return (
    `Sobre a testemunha *${nomeTestemunha}*, como ela mora em outra cidade, ` +
    `podemos pedir o depoimento de forma *telepresencial*.\n\n` +
    `Para isso, precisamos dos documentos dela:\n` +
    `• *Documento de identidade (RG/CNH)*\n` +
    `• *Comprovante de residência*\n\n` +
    `Pode enviar as fotos ou PDFs aqui mesmo. 🙏`
  );
}

/**
 * Passo 8 — checklist ao cliente sobre a testemunha cadastrada. O primeiro
 * contato com a testemunha é feito pelo cliente (que a indicou); o app inclui a
 * testemunha no grupo e, depois, cobra os documentos direto dela.
 */
export function montarResumoTestemunhaCliente(
  nome: string,
  cidade: string | null,
  telepresencial: boolean,
): string {
  const ondeMora = cidade ? ` (mora em *${cidade}*)` : '';
  if (telepresencial) {
    return (
      `✅ Testemunha *${nome}*${ondeMora} cadastrada.\n\n` +
      `Como ela é de *outra cidade*, o depoimento poderá ser *telepresencial*. Para isso, ` +
      `precisaremos do *documento de identidade (RG/CNH)* e do *comprovante de residência* dela.\n\n` +
      `👉 Fale com ela para avisá-la. Vamos *incluí-la no grupo* da audiência e, a partir daí, ` +
      `pedir esses documentos *direto a ela* — você acompanha o andamento por aqui. 👍`
    );
  }
  return (
    `✅ Testemunha *${nome}*${ondeMora} cadastrada.\n\n` +
    `Ela mora na cidade da audiência, então o comparecimento é *presencial*. ` +
    `Vamos incluí-la no *grupo* da audiência. 👍`
  );
}

/** Aviso ao cliente de que a testemunha entregou todos os documentos dela. */
export function montarTestemunhaDocsCompletos(nome: string): string {
  return `📎 A testemunha *${nome}* enviou todos os documentos dela. ✅ Tudo certo por esse lado!`;
}

/**
 * Passo 9 — orientações e impedimentos legais + coleta de dados trabalhistas.
 */
export function montarOrientacoesTestemunha(): string {
  return (
    `⚠️ *Orientações importantes sobre as testemunhas:*\n\n` +
    `A lei impede que sejam testemunhas pessoas como *amigo(a) íntimo(a)*, *cônjuge/companheiro(a)* ` +
    `ou parentes próximos. Também não vale *trocar depoimentos* (uma testemunha depor pela outra em outro processo) — ` +
    `isso pode anular o depoimento.\n\n` +
    `Para prepararmos o depoimento, envie sobre cada testemunha:\n` +
    `• *Período de trabalho* (de quando a quando)\n` +
    `• *Navio* em que trabalhou\n` +
    `• *Função* exercida\n` +
    `• *Agência recrutadora*`
  );
}

/**
 * Passo 13 — checklist de audiência virtual.
 */
export function montarChecklistVirtual(a: Audiencia): string {
  const linkTxt = a.link_audiencia
    ? `\n🔗 *Link da sala da audiência (Zoom):*\n${a.link_audiencia}\n`
    : '';
  return (
    `📋 *Sua audiência será virtual.* Para tudo correr bem, confirme:\n\n` +
    `✅ *Internet estável* (de preferência cabeada ou bom Wi-Fi)\n` +
    `✅ *Ambiente silencioso* e reservado\n` +
    `✅ *Equipamento adequado* (celular/computador com câmera e microfone)\n\n` +
    `❌ *Evite* participar dirigindo, na rua, no trabalho com barulho, ou em locais públicos.\n` +
    `${linkTxt}\n` +
    `No dia, esteja pronto(a) *15 minutos antes*. Está tudo certo com esses pontos? (responda *SIM* ou *NÃO*)`
  );
}

/** Passo 13 — cliente confirmou o checklist virtual (respondeu SIM). */
export function montarChecklistConfirmado(): string {
  return (
    `Perfeito! ✅ Está tudo certo para a sua audiência virtual.\n\n` +
    `Vamos te enviar lembretes conforme a data se aproxima e, um dia antes, ` +
    `faremos uma *reunião de alinhamento*. Qualquer dúvida, é só chamar aqui. 💪`
  );
}

/** Passo 13 — cliente sinalizou problema no checklist (respondeu NÃO). */
export function montarChecklistAjuda(): string {
  return (
    `Sem problema, vamos te ajudar a resolver. 🙏\n\n` +
    `Qual ponto precisa de atenção?\n` +
    `• *Internet* (conexão instável)\n` +
    `• *Ambiente* (sem lugar silencioso/reservado)\n` +
    `• *Equipamento* (câmera/microfone)\n\n` +
    `Me conte qual é a situação que a nossa equipe já entra em contato para orientar.`
  );
}

/** Passo 10 — grupo de acompanhamento criado/solicitado. */
export function montarGrupoCriado(nomeGrupo: string): string {
  return (
    `📱 Estamos criando o *grupo de acompanhamento* da sua audiência ` +
    `("${nomeGrupo}") com você e a nossa equipe.\n\n` +
    `É por lá que vamos alinhar os últimos detalhes até o dia. Fique atento(a)!`
  );
}

const ROTULOS_DOC: Record<string, string> = {
  contrato_trabalho: 'contrato de trabalho',
  passagens: 'passagens',
  contrato_locacao: 'contrato de locação',
  rg: 'documento de identidade (RG/CNH)',
  comprovante_residencia: 'comprovante de residência',
};

/** Rótulo amigável de um tipo de documento. */
export function rotuloDoc(tipo: string): string {
  return ROTULOS_DOC[tipo] ?? tipo;
}

/** Documento enviado não corresponde a nenhum dos pendentes (passo 11). */
export function montarDocNaoCorresponde(pendentes: string[], descricao: string): string {
  const lista = pendentes.map((t) => `• *${rotuloDoc(t)}*`).join('\n');
  const oQueE = descricao ? ` (parece ser ${descricao})` : '';
  return (
    `Hmm, esse arquivo não parece ser um dos documentos que precisamos${oQueE}. 🤔\n\n` +
    `Ainda faltam:\n${lista}\n\n` +
    `Pode reenviar o documento correto, por favor?`
  );
}

/** Um documento correto foi recebido; ainda há pendências (passo 11). */
export function montarDocRecebidoParcial(recebidoTipo: string, pendentes: string[]): string {
  const lista = pendentes.map((t) => `• *${rotuloDoc(t)}*`).join('\n');
  return (
    `Recebido o *${rotuloDoc(recebidoTipo)}*! ✅\n\n` +
    `Ainda faltam:\n${lista}\n\nPode enviar quando puder.`
  );
}

/**
 * Passo 12 — cobrança de documento pendente (níveis 24h / 48h / 72h).
 */
export function montarCobranca(tipoDocumento: string, nivel: number): string {
  const doc = ROTULOS_DOC[tipoDocumento] ?? tipoDocumento;
  const urgencia =
    nivel >= 3
      ? '⏰ *Última lembrança:* ainda precisamos'
      : nivel === 2
        ? 'Reforçando: ainda estamos no aguardo'
        : 'Passando para lembrar';
  return `${urgencia} do seu *${doc}* para a audiência. Pode nos enviar aqui, por favor? 🙏`;
}

/** Passo 14 — lembrete 7 dias antes. */
export function montarLembrete7dias(a: Audiencia): string {
  return (
    `📅 Faltam *7 dias* para a sua audiência (${dataBR(a.data_audiencia)}${horaBR(a.hora_audiencia)}).\n` +
    `Estamos finalizando a preparação. Em breve marcaremos uma *reunião de alinhamento*. Qualquer dúvida, é só chamar!`
  );
}

/** Passo 14 — convite para a reunião de alinhamento (1 dia antes), via Zoom. */
export function montarConviteReuniao(a: Audiencia, linkZoom: string): string {
  return (
    `🎥 *Reunião de alinhamento* da sua audiência (amanhã, ${dataBR(a.data_audiencia)}).\n\n` +
    `Vamos repassar tudo antes do grande dia. Link do Zoom:\n${linkZoom}\n\n` +
    `Sua presença é muito importante!`
  );
}

/** Heads-up à testemunha 7 dias antes (participante). */
export function montarLembrete7diasParticipante(a: Audiencia, nome: string): string {
  return (
    `Olá, ${nome}! Aqui é do escritório Hilton Lucena & Filhos Advogados.\n\n` +
    `Você foi indicado(a) como *testemunha* em uma audiência marcada para ` +
    `*${dataBR(a.data_audiencia)}${horaBR(a.hora_audiencia)}*. Faltam *7 dias*.\n` +
    `Em breve enviaremos as orientações finais. Qualquer dúvida, é só chamar!`
  );
}

/**
 * Passo 15 — lembrete final, ~3h antes. Adapta-se à modalidade (virtual ×
 * presencial) e ao destinatário (cliente × testemunha/participante).
 */
export function montarLembreteFinal(
  a: Audiencia,
  opts: { paraParticipante?: boolean; nome?: string } = {},
): string {
  const hora = horaBR(a.hora_audiencia).replace(' às ', '');
  const saudacao = opts.paraParticipante && opts.nome ? `${opts.nome}, ` : '';
  const papel = opts.paraParticipante
    ? 'a audiência em que você é *testemunha*'
    : 'a sua *audiência*';
  const linkTxt = a.link_audiencia
    ? `\n\n🔗 *Entre pela sala da audiência (Zoom):*\n${a.link_audiencia}`
    : `\n\n_O link de acesso será enviado pela nossa equipe em instantes._`;
  const instrucoes =
    a.modalidade === 'virtual'
      ? `Ela será *online*. Fique pronto(a) *15 minutos antes*, com *internet estável*, ` +
        `em *local silencioso e reservado* e com câmera/microfone funcionando.${linkTxt}`
      : `Ela será *presencial*${a.cidade ? ` em *${a.cidade}*` : ''}. Compareça ao fórum com ` +
        `*30 minutos de antecedência*, levando um *documento de identidade*.`;
  return (
    `🔔 ${saudacao}faltam poucas horas para ${papel}, hoje às *${hora}*.\n\n` +
    `${instrucoes}\n\n` +
    `Qualquer imprevisto, fale com a gente imediatamente: *${config.escritorioTelefone}*. Estamos com você! 💪`
  );
}

/** Passo 15 — lembrete no dia da audiência (legado). */
export function montarLembreteDia(a: Audiencia): string {
  const canal =
    a.modalidade === 'virtual'
      ? 'Fique pronto(a) 15 minutos antes, no link já enviado.'
      : 'Chegue ao fórum com *30 minutos de antecedência*, com documento de identidade.';
  return (
    `🔔 *Hoje é o dia da sua audiência!* (${horaBR(a.hora_audiencia).replace(' às ', '')})\n\n` +
    `${canal}\n\n` +
    `Qualquer imprevisto, fale conosco imediatamente: *${config.escritorioTelefone}*. Estamos com você! 💪`
  );
}
