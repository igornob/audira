-- =====================================================================
-- Assistente Inteligente de Audiências — Esquema do Banco de Dados
-- Hilton Lucena & Filhos Advogados Associados
-- PostgreSQL / Supabase  ·  v1  ·  28/06/2026
-- =====================================================================
-- Como usar: rode este arquivo no SQL Editor do Supabase (ou em qualquer
-- PostgreSQL). Cria as tabelas, os tipos (status), índices e relações.
-- =====================================================================

-- ---------- Tipos (enums) -------------------------------------------
CREATE TYPE modalidade_audiencia AS ENUM ('presencial', 'virtual');
CREATE TYPE tipo_audiencia       AS ENUM ('conciliacao', 'una', 'instrucao', 'mediacao', 'outra');
CREATE TYPE status_semaforo      AS ENUM ('verde', 'amarelo', 'vermelho');
CREATE TYPE status_documento     AS ENUM ('pendente', 'recebido', 'dispensado');
CREATE TYPE papel_pessoa         AS ENUM ('cliente', 'testemunha', 'advogado', 'correspondente');

-- ---------- Audiências (tabela central) -----------------------------
CREATE TABLE audiencias (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_processo     text NOT NULL,                 -- CNJ
    vara                text,
    cidade              text,
    estado              char(2),
    tribunal            text,                           -- ex.: TRT13
    data_audiencia      date,
    hora_audiencia      time,
    tipo                tipo_audiencia,
    modalidade          modalidade_audiencia,
    -- Origem / captura
    fonte_captura       text DEFAULT 'DJEN',            -- DJEN | manual | comercial
    id_comunicacao_djen text,                           -- id da intimação na Comunica API (dedup)
    texto_intimacao     text,                           -- texto bruto da publicação
    -- Cliente
    cliente_nome        text,
    cliente_telefone    text,                           -- preenchido no enriquecimento
    cliente_na_cidade   boolean,                        -- passo 6
    -- Correspondente (passo 4, se presencial)
    correspondente_nome     text,
    correspondente_telefone text,
    correspondente_contratado boolean DEFAULT false,
    -- Controle de fluxo / painel
    status              status_semaforo DEFAULT 'amarelo',
    cliente_confirmado  boolean DEFAULT false,
    grupo_whatsapp_id   text,
    grupo_criado        boolean DEFAULT false,
    reuniao_zoom_link   text,
    reuniao_realizada   boolean DEFAULT false,
    audiencia_concluida boolean DEFAULT false,
    observacoes_advogado text,
    responsavel_interno text,
    -- Auditoria
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    UNIQUE (id_comunicacao_djen)                        -- evita duplicar a mesma intimação
);

-- ---------- Pessoas (testemunhas, e opcionalmente outros papéis) -----
CREATE TABLE pessoas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audiencia_id    uuid NOT NULL REFERENCES audiencias(id) ON DELETE CASCADE,
    papel           papel_pessoa NOT NULL,
    nome            text NOT NULL,
    telefone        text,
    cidade          text,
    estado          char(2),
    -- Testemunha: decisão de comparecimento (passo 8)
    presencial      boolean,                            -- true=presencial / false=telepresencial
    -- Orientações coletadas (passo 9)
    periodo_trabalho text,
    navio           text,
    funcao          text,
    agencia_recrutadora text,
    created_at      timestamptz DEFAULT now()
);

-- ---------- Documentos (controle individual — passo 11) --------------
CREATE TABLE documentos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audiencia_id    uuid NOT NULL REFERENCES audiencias(id) ON DELETE CASCADE,
    pessoa_id       uuid REFERENCES pessoas(id) ON DELETE CASCADE, -- null = doc do cliente
    tipo_documento  text NOT NULL,         -- ex.: 'contrato_trabalho', 'passagens', 'rg', 'comprovante_residencia'
    status          status_documento DEFAULT 'pendente',
    recebido_em     timestamptz,
    arquivo_url     text,
    created_at      timestamptz DEFAULT now()
);

-- ---------- Cobranças automáticas (passo 12) -------------------------
CREATE TABLE cobrancas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id    uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    nivel           smallint NOT NULL,    -- 1=24h, 2=48h, 3=72h
    enviada_em      timestamptz,
    canal           text DEFAULT 'whatsapp',
    sucesso         boolean,
    created_at      timestamptz DEFAULT now()
);

-- ---------- Log de mensagens WhatsApp -------------------------------
CREATE TABLE mensagens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audiencia_id    uuid REFERENCES audiencias(id) ON DELETE CASCADE,
    pessoa_id       uuid REFERENCES pessoas(id) ON DELETE SET NULL,
    direcao         text,                 -- 'enviada' | 'recebida'
    template        text,                 -- nome do template usado
    conteudo        text,
    interpretacao_claude jsonb,           -- saída estruturada do Claude
    enviada_em      timestamptz DEFAULT now()
);

-- ---------- Índices úteis -------------------------------------------
CREATE INDEX idx_audiencias_data     ON audiencias (data_audiencia);
CREATE INDEX idx_audiencias_status   ON audiencias (status);
CREATE INDEX idx_audiencias_processo ON audiencias (numero_processo);
CREATE INDEX idx_pessoas_audiencia   ON pessoas (audiencia_id);
CREATE INDEX idx_documentos_audiencia ON documentos (audiencia_id);
CREATE INDEX idx_documentos_status   ON documentos (status);

-- ---------- Tabela auxiliar: base de contatos (planilha exportada) ---
-- Usada no enriquecimento: dado o nº do processo, achar o telefone do cliente.
CREATE TABLE contatos_clientes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_processo text,
    cliente_nome    text,
    telefone        text,
    email           text,
    atualizado_em   timestamptz DEFAULT now()
);
CREATE INDEX idx_contatos_processo ON contatos_clientes (numero_processo);

-- =====================================================================
-- Fim do esquema. Os painéis (17 e 18) leem de 'audiencias' + joins.
-- =====================================================================
