import 'dotenv/config';

/** Lê e valida as variáveis de ambiente uma única vez. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export interface OAB {
  numero: string;
  uf: string;
}

/** Converte "12345-PB,67890-PB" em [{numero,uf}, ...] */
function parseOabs(raw: string): OAB[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const [numero, uf] = item.split('-');
      return { numero: numero.trim(), uf: (uf ?? '').trim().toUpperCase() };
    });
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
  djenBaseUrl: process.env.DJEN_BASE_URL ?? 'https://comunicaapi.pje.jus.br/api/v1',
  oabs: parseOabs(process.env.OABS_MONITORADAS ?? ''),
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ?? '',
  escritorioTelefone: process.env.ESCRITORIO_TELEFONE ?? '(83) 0000-0000',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    from: process.env.TWILIO_WHATSAPP_FROM ?? '', // ex.: whatsapp:+14155238886
  },
  port: Number(process.env.PORT ?? 3000),
};
