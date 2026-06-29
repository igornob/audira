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
