import cron from 'node-cron';
import { config } from './config.js';
import { buildServer } from './server.js';
import { capturarAudiencias } from './jobs/captureHearings.js';

const app = buildServer();

app.listen(config.port, () => {
  console.log(`Audira rodando na porta ${config.port}`);
  console.log(`OABs monitoradas: ${config.oabs.map((o) => `${o.numero}-${o.uf}`).join(', ') || '(nenhuma)'}`);
});

// Worker diário: captura as audiências do DJEN todo dia às 07:00.
cron.schedule('0 7 * * *', () => {
  console.log('[cron] Iniciando captura diária do DJEN...');
  capturarAudiencias().catch((err) => console.error('[cron] Erro na captura:', err));
});
