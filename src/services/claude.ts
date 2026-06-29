import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config.js';
import type { ComunicacaoDJEN } from './djen.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** Estrutura que o Claude deve devolver ao ler a intimação. */
export const AudienciaExtraida = z.object({
  e_audiencia: z.boolean(),
  numero_processo: z.string().nullable().optional(),
  tribunal: z.string().nullable().optional(),
  vara: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  data_audiencia: z.string().nullable().optional(),
  hora_audiencia: z.string().nullable().optional(),
  tipo: z.enum(['conciliacao', 'una', 'instrucao', 'mediacao', 'outra']).nullable().optional(),
  modalidade: z.enum(['presencial', 'virtual']).nullable().optional(),
});
export type AudienciaExtraida = z.infer<typeof AudienciaExtraida>;

const SYSTEM = `Você é um assistente jurídico que lê intimações do Diário de Justiça
Eletrônico Nacional (DJEN) e extrai dados estruturados sobre audiências.
Responda APENAS com um objeto JSON válido, sem texto antes ou depois.
Se a comunicação NÃO for designação de audiência, retorne {"e_audiencia": false}.
Datas no formato YYYY-MM-DD. Horas no formato HH:MM (24h); se não houver, use null.
"tipo" ∈ {conciliacao, una, instrucao, mediacao, outra}.
"modalidade" ∈ {presencial, virtual} ou null. estado = sigla de 2 letras.
Não invente dados; campo ausente = null.`;

/** Extrai os dados da audiência a partir do texto da intimação. */
export async function extrairAudiencia(c: ComunicacaoDJEN): Promise<AudienciaExtraida> {
  const user = `Extraia os dados da seguinte comunicação processual.
NÚMERO DO PROCESSO (se já vier separado): ${c.numeroProcesso ?? ''}
TRIBUNAL: ${c.siglaTribunal ?? ''}

TEXTO DA INTIMAÇÃO:
"""
${c.texto ?? ''}
"""

Responda no formato:
{"e_audiencia": true|false, "numero_processo": "", "tribunal": "", "vara": "",
 "cidade": "", "estado": "", "data_audiencia": "YYYY-MM-DD", "hora_audiencia": "HH:MM",
 "tipo": "conciliacao|una|instrucao|mediacao|outra", "modalidade": "presencial|virtual|null"}`;

  const resp = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 512,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Remove cercas de código eventuais e faz o parse.
  const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return AudienciaExtraida.parse(JSON.parse(jsonStr));
}
