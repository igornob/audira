# Passo a passo — testar o Audira

Três fases, da mais simples à mais completa. Pode parar em qualquer uma.
Todos os comandos rodam no terminal do VSCode, dentro de `~/Documents/audira/audira`.

---

## FASE 0 — Ver o que já roda (sem contas externas) · ~2 min

Prova o fluxo e o painel sem depender de Claude nem WhatsApp.

```bash
cd ~/Documents/audira/audira

# 1. Simulação do fluxo inteiro (passos 3 a 18) com as mensagens reais
npx tsx scripts/simular-fluxo.ts

# 2. Garantir que o banco (container) está de pé
docker start audira-db 2>/dev/null; docker ps | grep audira-db

# 3. Subir o app (se ainda não estiver rodando)
npm run dev
```

Abra **http://localhost:3000/** — o painel com as 3 audiências de exemplo e o semáforo.

✅ *O que isso valida:* as mensagens de cada etapa, as ramificações e o semáforo.

---

## FASE 1 — Testar o app de verdade (só com a chave do Claude, sem WhatsApp) · ~10 min

Aqui o app roda o fluxo real: banco + Claude interpretando + máquina de estados.
O WhatsApp é *simulado por curl* (as mensagens ficam registradas no banco).

### 1.1 Criar a chave do Claude
- Em **console.anthropic.com**: criar conta → verificar telefone →
  **Settings → Plans & Billing → Add credit** (US$ 5) →
  **Settings → API keys → Create Key** → copiar a `sk-ant-...`.

### 1.2 Colocar a chave no .env e reiniciar
Edite `.env` e troque a linha da chave (deixe o resto como está):
```
ANTHROPIC_API_KEY=sk-ant-SUACHAVEAQUI
```
No terminal do servidor: `Ctrl+C` e depois `npm run dev`.

### 1.3 Iniciar uma audiência de teste (dispara a 1ª mensagem)
```bash
curl -s -X POST http://localhost:3000/api/teste/audiencia \
  -H 'content-type: application/json' \
  -d '{"telefone":"5583999990000","nome":"Teste","cidade":"João Pessoa","modalidade":"virtual"}'
```

### 1.4 Simular a resposta do cliente (o Claude vai interpretar)
```bash
# cliente diz que está FORA da cidade → deve pedir documentos
curl -s -X POST http://localhost:3000/webhook/whatsapp \
  -H 'content-type: application/json' \
  -d '{"telefone":"5583999990000","texto":"Não, vou estar embarcado nessa data"}'
```

### 1.5 Ver o resultado
```bash
# a conversa registrada
docker exec -it audira-db psql -U audira -d audira \
  -c "SELECT direcao, template, left(conteudo,55) AS msg FROM mensagens ORDER BY enviada_em;"

# em que etapa a audiência ficou
docker exec -it audira-db psql -U audira -d audira \
  -c "SELECT cliente_nome, estado_fluxo FROM audiencias WHERE fonte_captura='manual';"
```

Continue a conversa mudando o `texto` (ex.: `"Sim, tenho uma testemunha: Marcos, (83) 98888-7777, mora em Recife/PE"`)
e rode 1.5 de novo para ver a máquina de estados avançando.

✅ *O que isso valida:* banco, interpretação do Claude e todo o roteamento — sem gastar com WhatsApp.

---

## FASE 2 — Teste com WhatsApp real (Twilio Sandbox) · ~20 min

Segue o guia dedicado: **docs/TESTE-WHATSAPP.md**. Resumo:

1. **Twilio Sandbox** (console.twilio.com → Messaging → Try it out → Send a WhatsApp message):
   enviar `join <código>` do seu WhatsApp; anotar **Account SID**, **Auth Token** e o **número do sandbox**.
2. **ngrok**: `brew install ngrok` → `ngrok http 3000` → copiar a URL `https://...`.
   No Twilio, campo **"When a message comes in"** = `https://SEU-NGROK/whatsapp` (POST).
3. **.env** (me mande os valores que eu preencho, ou edite você):
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
   Reinicie: `Ctrl+C` e `npm run dev`.
4. **Disparar** (com o SEU número, o que fez o join):
   ```bash
   curl -s -X POST http://localhost:3000/api/teste/audiencia \
     -H 'content-type: application/json' \
     -d '{"telefone":"5583SEUNUMERO","nome":"Igor","cidade":"João Pessoa","modalidade":"virtual"}'
   ```
   A 1ª mensagem chega **no seu WhatsApp**. Responda por lá e veja o fluxo andar,
   acompanhando o painel (http://localhost:3000/) e o log do servidor.

✅ *O que isso valida:* a troca real de mensagens de ponta a ponta.

---

## Dicas
- Ver o log do servidor mostra cada passo e a interpretação do Claude.
- Recomeçar do zero (limpar dados de teste):
  ```bash
  docker exec -it audira-db psql -U audira -d audira \
    -c "DELETE FROM audiencias WHERE fonte_captura='manual';"
  ```
- Nada de credenciais vai para o git — o `.env` é ignorado.
