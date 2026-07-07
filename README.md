# Audira — Assistente Inteligente de Audiências

> Vigia o diário oficial para que **nenhuma audiência passe batida** e conduz toda a preparação — do cliente às testemunhas, documentos, lembretes e reunião prévia.

**Audira** (de *audire*, "ouvir") é o sistema que ouve o diário por você e cuida da audiência de ponta a ponta.
Concebido para **Hilton Lucena & Filhos Advogados Associados** e desenhado para virar produto (SaaS) atendendo outros escritórios.

> Nome confirmado livre de conflito no nicho jurídico. Confirmar domínio (`audira.com.br` / `audira.app`) e marca (INPI, classe de software) antes de formalizar.

---

## Arquitetura (híbrida: app + n8n)

```
DJEN / Comunica API (CNJ) ──┐
                            ▼
        ┌──────────────────────────────────────┐
        │            AUDIRA (este app)          │
        │  • Worker diário: captura audiências  │
        │  • Claude: extrai dados da intimação  │
        │  • Máquina de estados da conversa     │
        │  • Regras de documentos e cobranças   │
        │  • API + painel (status das audiências)│
        └───────┬───────────────────────┬───────┘
                │ webhook                │ SQL
                ▼                        ▼
        ┌──────────────┐        ┌─────────────────┐
        │     n8n      │        │  PostgreSQL /   │
        │ (encanação:  │        │   Supabase      │
        │  WhatsApp,   │        │  (db/schema.sql)│
        │  Zoom, retry)│        └─────────────────┘
        └──────┬───────┘
               ▼
        WhatsApp Business API (Twilio oficial)
```

**Divisão de responsabilidades**
- **Audira (código):** lógica de negócio, máquina de estados da conversa, interpretação com Claude, regras.
- **n8n:** integração e disparo (enviar WhatsApp, criar evento Zoom, agendamentos com retry, monitoramento visual).
- **Banco:** fonte da verdade compartilhada (ver `db/schema.sql`).

---

## Mapa dos 18 passos do manual → código

| Passo | Módulo |
|---|---|
| 3. Captura da audiência | `src/jobs/captureHearings.ts` + `src/services/djen.ts` |
| 3. Extração dos dados | `src/services/claude.ts` |
| 4–16. Fluxo da conversa | `src/state/hearingMachine.ts` (a implementar) |
| envio de mensagens | `src/services/n8n.ts` → n8n → WhatsApp |
| 17–18. Painéis | `src/server.ts` (API) + painel web (a implementar) |

---

## Stack
- **Node.js + TypeScript** (ESM)
- **Express** (API + recebimento de webhooks)
- **node-cron** (worker diário do DJEN)
- **pg** (PostgreSQL / Supabase)
- **@anthropic-ai/sdk** (Claude — extração e interpretação)
- **zod** (validação da saída do Claude)

---

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# preencha as variáveis (banco, OABs, chave Anthropic, URL do n8n)

# 3. Criar as tabelas no banco (rode os 3 arquivos, nesta ordem)
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/migrations/001_estado_fluxo.sql
psql "$DATABASE_URL" -f db/migrations/002_lembretes.sql
# (ou cole os arquivos no SQL Editor do Supabase, nessa ordem)

# 4. Rodar em desenvolvimento (server + agendadores)
npm run dev
# Painel de acompanhamento: http://localhost:3000/

# Jobs avulsos (teste manual)
npm run capture     # captura do DJEN uma vez
npm run cobrancas   # processa cobranças de documentos pendentes
npm run lembretes   # processa lembretes/reunião do dia

# Produção
npm run build && npm start
```

---

## Estrutura de pastas

```
audira/
├── README.md  ·  package.json  ·  tsconfig.json  ·  .env.example
├── db/
│   ├── schema.sql                 # esquema do banco (tabelas, status)
│   └── migrations/                # 001_estado_fluxo, 002_lembretes
└── src/
    ├── index.ts                   # entrada: server + 3 agendadores (cron)
    ├── config.ts                  # variáveis de ambiente
    ├── db.ts                      # pool PostgreSQL
    ├── state.ts                   # máquina de estados da audiência
    ├── status.ts                  # cálculo do semáforo (painel 18)
    ├── server.ts                  # API: painéis 17/18, encerramento, webhook
    ├── dashboard.ts               # página web do painel de acompanhamento
    ├── jobs/
    │   ├── captureHearings.ts     # #1: DJEN → Claude → banco → inicia fluxo
    │   ├── cobrancas.ts           # #6: cobranças 24/48/72h (de hora em hora)
    │   └── lembretes.ts           # #8: lembretes 7d/1d/dia (diário)
    ├── flows/
    │   ├── prepararAudiencia.ts   # #2: modalidade + contato inicial
    │   ├── respostaLocalCliente.ts# #3: "está na cidade?" → docs ou testemunhas
    │   ├── testemunhas.ts         # #4: coleta, decisão, orientações
    │   ├── documentos.ts          # #6: recebimento de documentos
    │   ├── grupo.ts               # #5: grupo de WhatsApp + checklist virtual
    │   └── roteador.ts            # despacha mensagens recebidas por estado
    └── services/
        ├── djen.ts                # Comunica API (DJEN)
        ├── claude.ts              # extração da intimação
        ├── interpret.ts           # interpretação de respostas livres
        ├── messages.ts            # templates de mensagens
        ├── whatsapp.ts            # envio (via n8n) + log
        └── n8n.ts                 # webhooks do n8n (WhatsApp, Zoom, grupo)
```

---

## Roadmap de construção
- [x] Esquema do banco
- [x] Sub-fluxo #1 — captura de audiências (DJEN → Claude → banco)
- [x] Sub-fluxo #2 — decisão presencial × virtual + correspondente + contato inicial do cliente
- [x] Sub-fluxo #3 — resposta do cliente ("está na cidade?") → documentos (passo 6) ou testemunhas (passo 7)
- [x] Sub-fluxo #4 — testemunhas (coleta, decisão presencial×telepresencial, orientações)
- [x] Sub-fluxo #5 — grupo de WhatsApp
- [x] Sub-fluxo #6 — documentos + cobranças 24/48/72h (job agendado)
- [x] Sub-fluxo #7 — checklist de audiência virtual
- [x] Sub-fluxo #8 — reunião prévia + lembretes (7 dias / 1 dia / no dia)
- [x] Sub-fluxo #9 — encerramento + status (endpoint)
- [x] Painéis 17 (checklist) e 18 (acompanhamento + dashboard web)

---

## Notas
- A consulta ao DJEN é pública; só o *envio* de comunicações exige credenciais.
- Nenhuma fonte do Judiciário traz telefone do cliente — ver tabela `contatos_clientes`.
- Confirme os nomes exatos dos campos da Comunica API no Swagger oficial: https://comunicaapi.pje.jus.br/
