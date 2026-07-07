import { config } from '../config.js';

/** Há credenciais do Twilio configuradas? */
export function twilioConfigurado(): boolean {
  const { accountSid, authToken, from } = config.twilio;
  return Boolean(accountSid && authToken && from);
}

/** Garante o prefixo whatsapp:+<digitos>. */
function paraWhatsapp(telefone: string): string {
  if (telefone.startsWith('whatsapp:')) return telefone;
  const digitos = telefone.replace(/\D/g, '');
  return `whatsapp:+${digitos}`;
}

/** Envia uma mensagem de WhatsApp via API REST do Twilio. */
export async function enviarTwilio(telefone: string, texto: string): Promise<void> {
  const { accountSid, authToken, from } = config.twilio;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({
    From: from,
    To: paraWhatsapp(telefone),
    Body: texto,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    console.error(`[twilio] falha ao enviar (${res.status}):`, await res.text());
  }
}
