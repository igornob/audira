/**
 * Simulador do fluxo de audiências (sem banco, sem Claude, sem WhatsApp).
 *
 * Usa as MENSAGENS REAIS do código (src/services/messages.ts) e percorre as
 * ramificações do documento, imprimindo a conversa do começo ao fim. Serve para
 * validar a cobertura do fluxo de ponta a ponta.
 *
 * Rodar:  npx tsx scripts/simular-fluxo.ts
 */
import {
  montarContatoInicialCliente,
  montarPedidoDocsCliente,
  montarPerguntaTestemunhas,
  montarPedidoDocsTestemunha,
  montarOrientacoesTestemunha,
  montarChecklistVirtual,
  montarCobranca,
  montarLembrete7dias,
  montarLembreteDia,
} from '../src/services/messages.js';
import { calcularSemaforo } from '../src/status.js';
import type { Audiencia } from '../src/state.js';

const sep = (t: string) => console.log(`\n\x1b[36m──── ${t} ────\x1b[0m`);
const bot = (m: string) => console.log(`\x1b[32m[Audira → cliente]\x1b[0m\n${m}\n`);
const cli = (m: string) => console.log(`\x1b[33m[cliente → Audira]\x1b[0m ${m}`);
const sys = (m: string) => console.log(`\x1b[90m(${m})\x1b[0m`);

const audiencia: Audiencia = {
  id: 'sim-1',
  numero_processo: '0001234-56.2026.5.13.0001',
  vara: '1ª Vara do Trabalho',
  cidade: 'João Pessoa',
  estado: 'PB',
  data_audiencia: '2026-07-20',
  hora_audiencia: '14:30',
  tipo: 'instrucao',
  modalidade: 'virtual',
  cliente_nome: 'Carlos',
  cliente_telefone: '5583999990000',
  link_audiencia: 'https://us02web.zoom.us/j/0000000000',
  estado_fluxo: 'nova',
};

console.log('\x1b[1m=== SIMULAÇÃO DO FLUXO AUDIRA (mensagens reais do código) ===\x1b[0m');

sep('Passo 3-4 — audiência capturada, decisão de modalidade');
sys(`modalidade = ${audiencia.modalidade} → segue direto para o contato com o cliente`);

sep('Passo 5 — contato inicial com o cliente');
bot(montarContatoInicialCliente(audiencia));

sep('Passo 6 — cliente responde que está FORA da cidade');
cli('Não, vou estar embarcado nessa data');
sys('Claude interpretaria: { na_cidade: false } → pede documentos');
bot(montarPedidoDocsCliente(audiencia));
sys('documentos criados (pendentes): contrato_trabalho, passagens, contrato_locacao');

sep('Passo 12 — cobranças automáticas (se o cliente demorar)');
console.log('24h:', montarCobranca('contrato_trabalho', 1));
console.log('48h:', montarCobranca('contrato_trabalho', 2));
console.log('72h:', montarCobranca('contrato_trabalho', 3));
sys('após a 3ª cobrança → alerta para a equipe');

sep('Cliente envia os documentos → segue para testemunhas (passo 7)');
cli('[envia fotos do contrato e das passagens]');
bot(montarPerguntaTestemunhas(audiencia));

sep('Passo 7-8 — cliente informa uma testemunha de OUTRA cidade');
cli('Sim, a testemunha é o Marcos Lima, (83) 98888-7777, mora em Recife/PE');
sys('cidade da testemunha (Recife) ≠ cidade da audiência (João Pessoa) → telepresencial');
bot(montarPedidoDocsTestemunha('Marcos Lima'));

sep('Passo 9 — orientações e impedimentos legais');
bot(montarOrientacoesTestemunha());

sep('Passo 10/13 — grupo criado e, por ser virtual, checklist técnico');
sys('grupo de WhatsApp solicitado (cliente + testemunha + correspondente)');
bot(montarChecklistVirtual(audiencia));

sep('Passo 14-15 — lembretes');
bot(montarLembrete7dias(audiencia));
sys('1 dia antes → reunião de alinhamento agendada no Zoom (via n8n)');
bot(montarLembreteDia(audiencia));

sep('Passo 18 — semáforo do painel em diferentes cenários');
console.log('tudo ok, audiência distante:',
  calcularSemaforo({ diasRestantes: 20, docsPendentes: 0, clienteConfirmado: true, concluida: false }));
console.log('documento pendente, com tempo:',
  calcularSemaforo({ diasRestantes: 20, docsPendentes: 1, clienteConfirmado: true, concluida: false }));
console.log('pendência e audiência em 1 dia:',
  calcularSemaforo({ diasRestantes: 1, docsPendentes: 1, clienteConfirmado: false, concluida: false }));

sep('Passo 16 — encerramento');
sys('advogado registra a audiência como realizada + observações → status verde');

console.log('\n\x1b[1m=== FIM — fluxo percorrido do passo 3 ao 18 ===\x1b[0m');
