import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** Extrai o texto da resposta do Claude e faz o parse do JSON. */
async function pedirJson(system: string, user: string): Promise<unknown> {
  const resp = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 200,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(json);
}

/** Resposta à pergunta "você estará na cidade do processo na data da audiência?" */
export const RespostaLocal = z.object({
  na_cidade: z.boolean().nullable(),
});
export type RespostaLocal = z.infer<typeof RespostaLocal>;

export async function interpretarRespostaLocal(texto: string): Promise<RespostaLocal> {
  const system =
    'Você interpreta a resposta de um cliente à pergunta: ' +
    '"você estará na cidade do processo na data da audiência?". ' +
    'Responda APENAS com JSON {"na_cidade": true|false|null}. ' +
    'true = estará na cidade; false = não estará / estará em outra cidade; ' +
    'null = resposta ambígua ou que não responde à pergunta.';
  const user = `Resposta do cliente: """${texto}"""\nResponda só: {"na_cidade": true|false|null}`;
  return RespostaLocal.parse(await pedirJson(system, user));
}

/** Interpretação genérica de sim/não em linguagem natural. */
export const SimNao = z.object({ resposta: z.enum(['sim', 'nao', 'indefinido']) });
export type SimNao = z.infer<typeof SimNao>;

export async function interpretarSimNao(pergunta: string, texto: string): Promise<SimNao> {
  const system =
    'Você interpreta a resposta de uma pessoa a uma pergunta de sim/não. ' +
    'Responda APENAS com JSON {"resposta": "sim"|"nao"|"indefinido"}. ' +
    'Use "indefinido" quando a resposta for ambígua ou não responder à pergunta.';
  const user = `Pergunta: "${pergunta}"\nResposta da pessoa: """${texto}"""\nResponda só: {"resposta":"sim|nao|indefinido"}`;
  return SimNao.parse(await pedirJson(system, user));
}

/** Dados de uma testemunha extraídos de texto livre. */
export const Testemunha = z.object({
  nome: z.string(),
  telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
});
export type Testemunha = z.infer<typeof Testemunha>;

export const ListaTestemunhas = z.object({ testemunhas: z.array(Testemunha) });
export type ListaTestemunhas = z.infer<typeof ListaTestemunhas>;

export async function extrairTestemunhas(texto: string): Promise<Testemunha[]> {
  const system =
    'Você extrai dados de testemunhas a partir de uma mensagem livre. ' +
    'Responda APENAS com JSON {"testemunhas": [{"nome":"","telefone":"","cidade":"","estado":""}]}. ' +
    'estado = sigla de 2 letras. Campo ausente = null. Se não houver testemunhas, retorne lista vazia.';
  const user = `Mensagem: """${texto}"""`;
  const parsed = ListaTestemunhas.parse(await pedirJson(system, user));
  return parsed.testemunhas;
}

/**
 * Verifica, por visão, se um documento (imagem/PDF) enviado corresponde a algum
 * dos documentos pendentes. Retorna a chave do tipo correspondente ou null.
 */
export const DocCheck = z.object({
  tipo: z.string().nullable(),
  descricao: z.string(),
});
export type DocCheck = z.infer<typeof DocCheck>;

export async function verificarDocumento(
  base64: string,
  mediaType: string,
  pendentes: { tipo: string; rotulo: string }[],
): Promise<{ tipo: string | null; descricao: string }> {
  const lista = pendentes.map((p) => `- ${p.tipo}: ${p.rotulo}`).join('\n');
  const system =
    'Você confere se o documento enviado (imagem ou PDF) corresponde a algum dos ' +
    'documentos que foram solicitados. Responda APENAS com JSON ' +
    '{"tipo": "<uma das chaves listadas, ou null>", "descricao": "o que o documento aparenta ser"}. ' +
    'Use "tipo": null se o documento não corresponder a NENHUM dos solicitados ' +
    '(ex.: foto de pessoa, paisagem, print aleatório).';
  const userText =
    `Documentos solicitados (chave: descrição):\n${lista}\n\n` +
    `O documento anexado corresponde a algum deles? Responda só o JSON.`;

  const bloco =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const resp = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 300,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: [bloco as any, { type: 'text', text: userText }] }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = DocCheck.parse(JSON.parse(json));

  const tiposValidos = pendentes.map((p) => p.tipo);
  return {
    tipo: parsed.tipo && tiposValidos.includes(parsed.tipo) ? parsed.tipo : null,
    descricao: parsed.descricao,
  };
}

/** Cidade/estado extraídos de uma resposta curta ("Recife-PE", "moro em Olinda, Pernambuco"). */
export const Localidade = z.object({
  cidade: z.string().nullable(),
  estado: z.string().nullable(),
});
export type Localidade = z.infer<typeof Localidade>;

export async function extrairLocalidade(texto: string): Promise<Localidade> {
  const system =
    'Você extrai a cidade e o estado (UF) mencionados numa mensagem curta. ' +
    'Responda APENAS com JSON {"cidade":"","estado":""}. ' +
    'estado = sigla de 2 letras (ex.: PE, PB). Campo ausente = null.';
  const user = `Mensagem: """${texto}"""\nResponda só: {"cidade":"...","estado":"..."}`;
  return Localidade.parse(await pedirJson(system, user));
}

/** Orientações da testemunha (passo 9). */
export const Orientacoes = z.object({
  periodo_trabalho: z.string().nullable().optional(),
  navio: z.string().nullable().optional(),
  funcao: z.string().nullable().optional(),
  agencia_recrutadora: z.string().nullable().optional(),
});
export type Orientacoes = z.infer<typeof Orientacoes>;

export async function extrairOrientacoes(texto: string): Promise<Orientacoes> {
  const system =
    'Você extrai dados trabalhistas de uma mensagem livre sobre uma testemunha embarcada. ' +
    'Responda APENAS com JSON ' +
    '{"periodo_trabalho":"","navio":"","funcao":"","agencia_recrutadora":""}. ' +
    'Campo ausente = null.';
  const user = `Mensagem: """${texto}"""`;
  return Orientacoes.parse(await pedirJson(system, user));
}
