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

# 3. Criar as tabelas no banco
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/migrations/001_estado_fluxo.sql
# (ou cole os arquivos no SQL Editor do Supabase, nessa ordem)

# 4. Rodar em desenvolvimento (server + scheduler)
npm run dev

# Rodar a captura do DJEN uma vez, manualmente (teste)
npm run capture
```

---

## Estrutura de pastas

```
audira/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── db/
│   └── schema.sql                 # esquema do banco (tabelas, status)
└── src/
    ├── index.ts                   # ponto de entrada: server + scheduler
    ├── config.ts                  # leitura/validação das variáveis de ambiente
    ├── db.ts                      # pool de conexão PostgreSQL
    ├── server.ts                  # API + webhooks (painel e WhatsApp)
    ├── jobs/
    │   └── captureHearings.ts     # Sub-fluxo #1: DJEN → Claude → banco
    └── services/
        ├── djen.ts                # consulta à Comunica API (DJEN)
        ├── claude.ts              # extração/interpretação com Claude
        └── n8n.ts                 # dispara webhooks do n8n (WhatsApp, Zoom)
```

---

## Roadmap de construção
- [x] Esquema do banco
- [x] Sub-fluxo #1 — captura de audiências (DJEN → Claude → banco)
- [x] Sub-fluxo #2 — decisão presencial × virtual + correspondente + contato inicial do cliente
- [ ] Sub-fluxo #3 — contato com cliente / "está na cidade?" / documentos
- [ ] Sub-fluxo #4 — testemunhas (coleta, decisão, orientações)
- [ ] Sub-fluxo #5 — grupo de WhatsApp
- [ ] Sub-fluxo #6 — documentos + cobranças 24/48/72h
- [ ] Sub-fluxo #7 — checklist de audiência virtual
- [ ] Sub-fluxo #8 — reunião prévia + lembretes + dia da audiência
- [ ] Sub-fluxo #9 — encerramento + status
- [ ] Painéis 17 e 18 (web)

---

## Notas
- A consulta ao DJEN é pública; só o *envio* de comunicações exige credenciais.
- Nenhuma fonte do Judiciário traz telefone do cliente — ver tabela `contatos_clientes`.
- Confirme os nomes exatos dos campos da Comunica API no Swagger oficial: https://comunicaapi.pje.jus.br/
