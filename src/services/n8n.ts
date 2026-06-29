import { config } from '../config.js';

/**
 * Dispara um evento para o n8n, que cuida da "encanação" (WhatsApp, Zoom, etc.).
 * O Audira decide O QUE fazer; o n8n executa COM os conectores prontos.
 */
export async function dispararN8n(evento: string, payload: Record<string, unknown>): Promise<void> {
  if (!config.n8nWebhookUrl) {
    console.warn(`[n8n] N8N_WEBHOOK_URL não configurada — evento "${evento}" não enviado.`);
    return;
  }
  const res = await fetch(config.n8nWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, ...payload }),
  });
  if (!res.ok) {
    console.error(`[n8n] Falha ao disparar "${evento}": ${res.status}`);
  }
}
