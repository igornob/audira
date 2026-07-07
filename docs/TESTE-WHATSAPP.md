# Teste do fluxo com WhatsApp real (Twilio Sandbox)

Guia para testar o Audira conversando de verdade com um número de WhatsApp,
usando o **Twilio Sandbox** (grátis) e uma **chave da Anthropic (Claude)**.

---

## 1. Criar a chave do Claude (Anthropic)

1. Acesse **https://console.anthropic.com** e crie a conta (e-mail ou Google).
2. Faça a **verificação por telefone** (obrigatória para gerar a chave).
3. Vá em **Settings → Plans & Billing → Add to credit balance** e adicione
   **US$ 5** (sistema é pré-pago; sem crédito a chave não funciona). O modelo
   usado é o Haiku, que é barato — o teste custa centavos.
4. Vá em **Settings → API keys → Create Key**, dê um nome (ex.: "Audira Local")
   e **copie a chave** (`sk-ant-...`) — ela só aparece uma vez.

---

## 2. Ativar o Twilio Sandbox de WhatsApp

1. Crie conta em **https://console.twilio.com** (trial grátis).
2. Menu **Messaging → Try it out → Send a WhatsApp message**.
3. Aparece um número do sandbox (ex.: `+1 415 523 8886`) e um código
   (ex.: `join apple-tree`).
4. No **seu WhatsApp**, envie `join apple-tree` para esse número. Você recebe
   uma confirmação — pronto, seu número está conectado ao sandbox.
5. Anote, no painel (**Account Info**): **Account SID** e **Auth Token**.

> A sessão do sandbox expira em 3 dias; depois é só reenviar o `join ...`.

---

## 3. Expor o servidor local com ngrok

O Twilio precisa alcançar seu app (que roda em `localhost`). Use um túnel:

```bash
# instalar (mac, via Homebrew)
brew install ngrok
# expor a porta 3000
ngrok http 3000
```

Copie a URL `https://xxxx.ngrok-free.app` que aparecer.

No console do Twilio (tela do Sandbox → **Sandbox settings**), no campo
**"When a message comes in"**, cole:

```
https://xxxx.ngrok-free.app/whatsapp
```

Método **POST** e salve.

---

## 4. Preencher o .env

No `~/Documents/audira/audira/.env`:

```
DATABASE_URL=postgres://audira:audira@localhost:5433/audira
ANTHROPIC_API_KEY=sk-ant-...        # a chave real do passo 1
OABS_MONITORADAS=12345-PB
PORT=3000

TWILIO_ACCOUNT_SID=AC...            # do passo 2
TWILIO_AUTH_TOKEN=...               # do passo 2
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # o número do sandbox
```

Reinicie o servidor: `Ctrl+C` e `npm run dev`.

---

## 5. Iniciar o teste (a conversa começa no seu WhatsApp)

Rode (troque pelo **seu número**, o mesmo que entrou no sandbox, com DDI 55):

```bash
curl -X POST http://localhost:3000/api/teste/audiencia \
  -H 'content-type: application/json' \
  -d '{"telefone":"5583999990000","nome":"Igor","cidade":"João Pessoa","modalidade":"virtual"}'
```

Você vai **receber no WhatsApp** a primeira mensagem do Audira ("...você estará
na cidade de João Pessoa na data da audiência? SIM ou NÃO").

A partir daí, **responda no WhatsApp** e veja o fluxo andar sozinho:

| Você responde | O que o Audira faz |
|---|---|
| `NÃO` | pede os documentos (contrato, passagens, locação) — passo 6 |
| `SIM` | pergunta sobre testemunhas — passo 7 |
| manda dados de testemunha | cadastra, decide presencial/telepresencial, envia orientações |
| `não há testemunhas` | segue para criação do grupo |

Acompanhe em paralelo:
- O **painel**: http://localhost:3000/ (a audiência de teste aparece e muda de etapa).
- O **log** do servidor no terminal (mostra cada passo e a interpretação do Claude).

---

## Observações
- O sandbox só conversa com números que fizeram `join`. Para falar com o cliente
  e as testemunhas de verdade, é preciso o WhatsApp Business API aprovado (produção).
- Enquanto o Twilio estiver no `.env`, o app envia direto por ele. Se remover as
  variáveis, ele volta a despachar para o n8n.
- Nada de credenciais vai para o git — o `.env` é ignorado.
