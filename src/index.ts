import cron from 'node-cron';
import { config } from './config.js';
import { buildServer } from './server.js';
import { capturarAudiencias } from './jobs/captureHearings.js';
import { rodarCobrancas } from './jobs/cobrancas.js';
import { rodarLembretes } from './jobs/lembretes.js';

const app = buildServer();

app.listen(config.port, () => {
  console.log(`Audira rodando na porta ${config.port}`);
  console.log(
    `OABs monitoradas: ${config.oabs.map((o) => `${o.numero}-${o.uf}`).join(', ') || '(nenhuma)'}`,
  );
});

// Captura das audiências no DJEN — todo dia às 07:00.
cron.schedule('0 7 * * *', () => {
  console.log('[cron] captura diária do DJEN...');
  capturarAudiencias().catch((err) => console.error('[cron] erro na captura:', err));
});

// Cobranças de documentos (24/48/72h) — de hora em hora.
cron.schedule('0 * * * *', () => {
  rodarCobrancas().catch((err) => console.error('[cron] erro nas cobranças:', err));
});

// Lembretes e reunião prévia — de hora em hora (para pegar o "3 horas antes").
cron.schedule('0 * * * *', () => {
  rodarLembretes().catch((err) => console.error('[cron] erro nos lembretes:', err));
});
