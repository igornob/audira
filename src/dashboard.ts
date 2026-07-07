/** Painel de Acompanhamento (passo 18) renderizado como página única. */
export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Audira — Painel de Audiências</title>
<style>
  :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  body { margin: 0; background: #0f1115; color: #e6e8eb; }
  header { padding: 20px 28px; border-bottom: 1px solid #222; display: flex; align-items: baseline; gap: 12px; }
  header h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
  header span { color: #8a90a0; font-size: 13px; }
  .wrap { padding: 20px 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #1c2027; }
  th { color: #8a90a0; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; }
  tr:hover td { background: #151821; }
  .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
  .verde { background: #2ecc71; } .amarelo { background: #f1c40f; } .vermelho { background: #e74c3c; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #1c2230; color: #aab2c5; }
  .muted { color: #6b7280; }
  .count { color: #8a90a0; font-size: 13px; margin-left: 6px; }
</style>
</head>
<body>
<header>
  <h1>Audira</h1>
  <span>Painel de Acompanhamento de Audiências <span id="count" class="count"></span></span>
</header>
<div class="wrap">
  <table>
    <thead>
      <tr>
        <th></th><th>Processo</th><th>Cliente</th><th>Cidade</th>
        <th>Data</th><th>Hora</th><th>Modalidade</th><th>Etapa</th>
        <th>Pendências</th><th>Última cobrança</th>
      </tr>
    </thead>
    <tbody id="rows"><tr><td colspan="10" class="muted">Carregando…</td></tr></tbody>
  </table>
</div>
<script>
  const fmtData = (s) => s ? s.slice(0,10).split('-').reverse().join('/') : '—';
  const fmtHora = (s) => s ? s.slice(0,5) : '—';
  const fmtDT = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—';
  async function carregar() {
    const res = await fetch('/api/audiencias');
    const data = await res.json();
    document.getElementById('count').textContent = '(' + data.length + ')';
    const tbody = document.getElementById('rows');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="10" class="muted">Nenhuma audiência ainda.</td></tr>'; return; }
    tbody.innerHTML = data.map(a => \`
      <tr>
        <td><span class="dot \${a.semaforo}" title="\${a.semaforo}"></span></td>
        <td>\${a.numero_processo || '—'}</td>
        <td>\${a.cliente_nome || '—'}</td>
        <td>\${a.cidade || '—'}\${a.estado ? '/'+a.estado : ''}</td>
        <td>\${fmtData(a.data_audiencia)}</td>
        <td>\${fmtHora(a.hora_audiencia)}</td>
        <td>\${a.modalidade || '—'}</td>
        <td><span class="pill">\${a.estado_fluxo}</span></td>
        <td>\${a.docs_pendentes > 0 ? a.docs_pendentes + ' doc(s)' : '<span class="muted">ok</span>'}</td>
        <td>\${fmtDT(a.ultima_cobranca)}</td>
      </tr>\`).join('');
  }
  carregar();
  setInterval(carregar, 30000);
</script>
</body>
</html>`;
}
