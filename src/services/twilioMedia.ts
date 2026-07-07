import { config } from '../config.js';

/**
 * Baixa uma mídia recebida pelo Twilio (a URL exige Basic auth com a conta).
 * O Twilio redireciona para um link temporário (S3); o fetch segue o redirect
 * e a credencial é descartada no cross-origin, como esperado.
 */
export async function baixarMidia(url: string): Promise<{ base64: string; mediaType: string }> {
  const { accountSid, authToken } = config.twilio;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`falha ao baixar mídia (${res.status})`);
  const mediaType = (res.headers.get('content-type') ?? 'application/octet-stream')
    .split(';')[0]
    .trim();
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString('base64'), mediaType };
}
