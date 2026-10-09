# 🤖 Agente IA de Gestão — 6 áreas da empresa

O **Agente IA** transforma o ERP em um consultor de gestão disponível 24 horas por dia. Ele lê os
dados reais da empresa (vendas, compras, estoque, financeiro, clientes, fornecedores e despesas),
calcula indicadores por área, aplica regras de especialista com faixas de referência de mercado e
devolve **nota de saúde, leitura em linguagem natural, alertas priorizados com impacto em reais,
plano de ação 7/30/90 dias e relatório executivo exportável**.

Atua nas 6 áreas pedidas:

| # | Área | Perfil do agente | Missão |
|---|------|------------------|--------|
| 1 | 🏢 **Gestão Empresarial** | CEO / Diretor Geral | Crescer com lucro, caixa saudável e risco controlado, alinhando metas, indicadores e decisões estratégicas |
| 2 | 🏭 **Gestão de Produção e Processos** | Gerente de Operações / PCP | Entregar a demanda com o menor custo, sem gargalos e com processos padronizados, medidos e melhorados |
| 3 | 🤝 **Gestão Comercial e Vendas** | Gerente Comercial | Aumentar receita com margem: ampliar carteira, elevar ticket médio e recuperar clientes inativos |
| 4 | 📣 **Gestão de Marketing** | Gerente de Marketing | Gerar demanda qualificada e previsível, medindo CAC, LTV, sazonalidade e retorno por portfólio |
| 5 | 💰 **Gestão Financeira** | Controller / Gerente Financeiro | Proteger o caixa: liquidez, inadimplência, despesas, margens e capital de giro |
| 6 | 📦 **Gestão de Estoque e Expedição** | Supervisor de Logística | Produto certo, na quantidade certa, no momento certo: sem ruptura, sem excesso, expedição rápida |

> **Funciona 100% offline.** O motor de análise é local e determinístico: nenhuma chamada externa é
> necessária. Um modelo de linguagem (OpenAI, Anthropic, Gemini ou Ollama) pode ser conectado por
> variável de ambiente apenas para enriquecer a redação das respostas — os números continuam vindo
> do motor local.

---

## 1. Como o agente pensa

```
        ┌──────────────────────────────────────────────────────────────┐
        │                        BANCO DO ERP                          │
        │  vendas · sale_items · compras · produtos · clientes ·       │
        │  fornecedores · despesas · contas a receber/pagar · caixa    │
        └───────────────────────────┬──────────────────────────────────┘
                                    │  ~40 consultas SQL por análise
                                    ▼
                    ┌───────────────────────────────┐
                    │  1. CAMADA DE MÉTRICAS        │  src/agent/metrics.js
                    │  série mensal, CMV, margens,  │
                    │  giro, cobertura, aging,      │
                    │  ABC, CAC/LTV, ciclo de caixa │
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  2. MOTOR DE ANÁLISE          │  src/agent/engine.js
                    │  regras de especialista,      │
                    │  nota 0-100 por área,         │
                    │  alertas + recomendações      │
                    └───────────────┬───────────────┘
                                    ▼
              ┌─────────────────────┴──────────────────────┐
              ▼                                            ▼
┌───────────────────────────┐              ┌───────────────────────────────┐
│ 3. LINGUAGEM NATURAL      │              │ 4. BASE DE CONHECIMENTO       │
│    nlu.js  → intenção,    │              │    knowledge.js               │
│    domínio e entidades    │              │    conceitos, fórmulas,       │
│    compose.js → resposta  │              │    playbooks e check-ups      │
└─────────────┬─────────────┘              └───────────────┬───────────────┘
              └────────────────────┬───────────────────────┘
                                   ▼
                    ┌───────────────────────────────┐
                    │  5. LLM OPCIONAL (llm.js)     │  reescreve a resposta
                    │  OpenAI · Anthropic · Gemini  │  mantendo os números
                    │  Ollama (local)               │  do motor local
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  6. ENTREGA                   │  interface web, API
                    │  chat, relatório .md,         │  REST e histórico
                    │  faixa no dashboard           │  persistido por usuário
                    └───────────────────────────────┘
```

Princípios de projeto:

1. **Nada de número inventado.** Cada afirmação vem de uma consulta ao banco. Se não há dado, o
   agente diz "sem dados" e indica onde lançar.
2. **Determinístico e auditável.** Cada nota tem os componentes e pesos expostos na interface
   ("Como a nota foi calculada").
3. **Orientado a ação.** Todo alerta traz impacto estimado em reais e todo plano traz passos,
   esforço, prazo e o módulo do ERP onde executar.
4. **Privado por padrão.** O histórico fica no banco do próprio sistema; nenhuma chave de API é
   exposta ao navegador.

---

## 2. Índice de saúde e notas por área

Cada área recebe uma nota de 0 a 100, calculada como **média ponderada** de indicadores
normalizados. O índice da empresa é a média das 6 áreas.

| Faixa | Situação | Cor |
|-------|----------|-----|
| 80 – 100 | Excelente | 🟢 |
| 60 – 79 | Bom | 🟢 |
| 40 – 59 | Atenção | 🟡 |
| 0 – 39 | Crítico | 🔴 |

### Componentes avaliados por área

| Área | Componentes da nota (peso) |
|------|---------------------------|
| 🏢 Empresarial | Crescimento da receita (2) · Margem líquida (2,5) · Folga sobre o ponto de equilíbrio (2) · Diversificação de receita (1,5) · Liquidez em meses de caixa (2) · Qualidade dos dados (1) |
| 🏭 Produção e Processos | Capacidade de atendimento (2,5) · Ciclo financeiro (2) · Itens sem margem (2) · Estabilidade de custos de compra (1,5) · Padronização de processos (1) |
| 🤝 Comercial e Vendas | Carteira ativa (2,5) · Recompra (2) · Crescimento de receita (2) · Volume de vendas (1,5) · Controle de desconto (1) · Portfólio vendável (1) |
| 📣 Marketing | Eficiência de aquisição LTV/CAC (2,5) · Retenção (2) · Previsibilidade de demanda (1,5) · Saúde do portfólio/BCG (1,5) |
| 💰 Financeiro | Liquidez imediata (2,5) · Inadimplência (2,5) · Controle de despesas (2) · Margem bruta (2) · Prazos DSO x DPO (1,5) |
| 📦 Estoque e Expedição | Ruptura (3) · Itens abaixo do mínimo (2) · Giro de estoque (2) · Excesso e obsolescência (1,5) · Fila de expedição (1,5) |

### Faixas de referência usadas nas regras

| Indicador | Crítico | Atenção | Bom / Excelente |
|-----------|---------|---------|-----------------|
| Margem líquida | < 0% | 0 – 8% | > 15% |
| Margem bruta | < 10% | 10 – 25% | > 45% |
| Inadimplência (vencidos / a receber) | > 25% | 5 – 15% | < 2% |
| Liquidez (caixa + recebíveis) / contas a pagar | < 0,5x | 1x | > 2x |
| Reserva de caixa | < 0,3 mês | 1 mês | > 2 meses de despesas fixas |
| Giro de estoque (anualizado) | < 1x | 3x | > 10x |
| Ruptura (% de itens zerados) | > 30% | 10% | 0% |
| Cobertura mínima de itens com demanda | < 10 dias | 15 dias | > 30 dias |
| Concentração (5 maiores clientes) | > 70% | 50% | < 35% |
| Desconto médio concedido | > 15% | 8% | < 2% |
| Taxa de recompra | 0% | 20% | > 45% |
| LTV / CAC | < 1 | 1 – 3 | > 4 |
| Sazonalidade (CV da receita mensal) | > 60% | 35% | < 12% |
| Ciclo financeiro (DSO + estoque − DPO) | > 120 dias | 60 dias | < 0 dia |
| Capacidade de atendimento (itens com cobertura ≥ 15 dias) | < 40% | 70% | > 95% |

### Ponto de equilíbrio e margem de contribuição

O ponto de equilíbrio usa a **margem de contribuição real**, e não apenas a margem bruta:

```
CMV%                 = soma do CMV dos últimos meses fechados / soma da receita
Despesas variáveis%  = (despesas totais − despesas fixas) / receita
Margem de contribuição (MC%) = 100% − CMV% − Despesas variáveis%
Ponto de equilíbrio (receita) = despesas fixas médias do mês / MC%
```

A projeção de resultado usa **exatamente a mesma decomposição** (`resultado = receita − CMV% −
fixas − variáveis%`), por isso o agente nunca diz "acima do ponto de equilíbrio" e "operação no
prejuízo" ao mesmo tempo.

### Mês em andamento (comparação justa)

Comparar um mês que ainda não fechou com meses completos geraria alarme falso de queda todo dia 1º.
O agente detecta o mês parcial e projeta o fechamento:

| Situação | Como projeta |
|----------|--------------|
| Até o 4º dia do mês | Média dos últimos meses fechados (amostra pequena demais para extrapolar) |
| Do 5º dia em diante | Ritmo linear: `lançado ÷ dias vividos × dias do mês` |
| CMV | Taxa real do próprio mês (ou a taxa dos meses fechados, no início do mês) |
| Despesas | Fixas médias + variáveis pela taxa sobre a receita projetada — nunca menos que o já lançado |
| Sazonalidade, melhor/pior mês e média móvel | Ignoram o mês em andamento |

Na interface o mês parcial aparece marcado com `*` no gráfico e com a nota
_"9 de 31 dias do mês em andamento — ritmo dos 9 primeiros dias: receita projetada de R$ 33.685"_.
Nos textos o agente sempre separa **o que já foi lançado** da **projeção do mês fechado**, e a
previsão do próximo mês é calculada apenas com meses fechados.

---

## 3. Alertas: severidade, impacto e ação

Cada alerta nasce de uma regra aplicada aos dados e carrega: **severidade**, **área**, **descrição
com números reais**, **impacto estimado em R$** e **módulo do ERP onde resolver**.

Exemplos de regras implementadas:

| Gatilho | Severidade | Impacto calculado |
|---------|-----------|-------------------|
| Resultado operacional negativo no mês | 🔴 Crítica | R$ do prejuízo |
| Receita abaixo do ponto de equilíbrio | 🔴 Crítica | R$ que faltam para cobrir as despesas fixas |
| Caixa + recebíveis < contas a pagar | 🔴 Crítica | R$ da falta de liquidez |
| Recebíveis vencidos (ou > 60 dias) | 🔴 Crítica / 🟠 Alta | R$ em atraso |
| Produto em ruptura com demanda ativa | 🔴 Crítica | venda perdida/mês = demanda diária × 30 × preço |
| Custo ≥ preço de venda em algum produto | 🔴 Crítica | perda por unidade × unidades vendidas em 90 dias |
| Receita caiu mais de 10% no mês | 🔴 Crítica | R$ da queda |
| Gargalo (alta demanda, cobertura < 10 dias) | 🟠 Alta | R$ em risco por mês |
| Fila de expedição com itens em ruptura | 🟠 Alta | R$ dos pedidos parados |
| Clientes inativos há mais de 90 dias | 🟠 Alta / 🟡 Média | receita histórica recuperável |
| Descontos acima de 8% do valor cheio | 🟠 Alta | R$ concedidos |
| Custo da última compra ≠ custo cadastrado (≥ 5%) | 🟡 Média | R$ de margem em risco no estoque |
| Despesas crescendo mais que a receita | 🟠 Alta | R$ da variação |
| Excesso de estoque (cobertura > 90 dias) | 🟡 Média | R$ de capital parado |
| Produtos sem venda há 90+ dias | 🟡 Média / 🔵 Baixa | R$ parado em estoque |
| Concentração de receita ou de fornecedor | 🟠 Alta / 🟡 Média | % da receita dependente |
| LTV/CAC < 1 | 🟠 Alta | R$ perdidos por cliente adquirido |
| Cadastros incompletos (categoria, custo, mínimo, e-mail) | 🔵 Baixa | nº de falhas |

---

## 4. Plano de ação 7 / 30 / 90 dias

As recomendações são priorizadas em três horizontes e cada uma traz **por que fazer**, **passo a
passo**, **esforço**, **impacto esperado** e **botão para o módulo do ERP** onde executar:

- 🔥 **Agora (7 dias)** — estancar perda: emergência de resultado, gargalo principal, régua de
  cobrança, pedido de reposição, liquidez imediata, preços com margem negativa.
- 📅 **30 dias** — corrigir processo: atualizar custos e reprecificar, liberar capital parado,
  regularizar expedição, medir CAC/LTV, calendário sazonal, programa de corte de despesas,
  reserva de caixa, recorrência da carteira, política de desconto, higienização de cadastros.
- 🎯 **90 dias** — estruturar: meta comercial, diversificar carteira, padronizar processos (POP/BPMN),
  escalonar produtos estrela, reposicionar ou liquidar "abacaxis", alongar prazos com fornecedores.

---

## 5. Interface

O agente aparece no menu lateral em **Inteligência → Agente IA** e também em uma **faixa no
Dashboard** com a nota de saúde, a leitura do dia e os 3 principais alertas.

| Aba | O que mostra |
|-----|--------------|
| 📊 **Visão geral** | Medidor do índice de saúde, sumário executivo, gráfico radar das 6 notas, evolução mensal (receita × despesas × resultado) e os 6 cards de área |
| 🗂 **6 Áreas** | Detalhe completo: componentes da nota, KPIs, leitura do agente, alertas, plano da área, módulos relacionados, rotinas de gestão, conceitos/fórmulas, playbooks, check-up e as tabelas de dados usados |
| 🚨 **Alertas** | Central com filtro por severidade e por área, impacto em R$ e atalho para o módulo |
| 🎯 **Plano de ação** | Três colunas (7/30/90 dias) com passos, esforço e impacto |
| 💬 **Chat** | Conversa com o agente, seletor de área, sugestões de pergunta, histórico de conversas persistido e tabelas/KPIs renderizados na resposta |
| 📚 **Conhecimento** | Base técnica completa: conceitos, fórmulas, referências de mercado, playbooks, check-ups e "como fazer" dentro do ERP |

Botões **Exportar relatório** (diagnóstico completo das 6 áreas) e **Relatório da área** geram
Markdown pronto para imprimir, anexar em reunião de resultados ou versionar.

---

## 6. Chat: o que o agente entende

O interpretador local (em português, sem dependências) classifica **intenção**, **área** e
**entidades** (período, severidade, quantidade, produto, cliente, valor).

| Intenção | Exemplos de pergunta |
|----------|---------------------|
| Diagnóstico | "como está a saúde da empresa?", "situação do financeiro" |
| Alertas | "quais são os problemas mais urgentes?", "o que está em risco?" |
| Plano de ação | "o que devo fazer primeiro nesta semana?", "como reduzir a inadimplência?" |
| Indicadores | "quanto tenho a receber vencido?", "qual é o ticket médio?", "saldo de caixa" |
| Listagens | "quais produtos estão em ruptura?", "top 5 clientes", "clientes inativos", "gargalos" |
| Projeção | "previsão do próximo mês", "vai sobrar caixa?" |
| Relatório | "monte o DRE gerencial", "exportar relatório completo" |
| Conceito | "o que é curva ABC?", "como calculo o CAC?", "o que é ponto de equilíbrio?" |
| Como fazer | "como registro uma compra no sistema?", "onde vejo o fluxo de caixa?" |
| Comparação | "evolução dos últimos meses", "receita caiu ou subiu?" |

A área é detectada pelo vocabulário da pergunta ("gargalo" → Produção, "inadimplência" →
Financeiro, "CAC" → Marketing, "expedição" → Estoque…) e pode ser fixada pelos botões do chat.
Termos genéricos como "empresa" ou "negócio" são tratados como **visão global**, não como a área
Gestão Empresarial.

Perguntas sobre um **produto** ou **cliente** nominal (ex.: "como está o Monitor 27 4K?") devolvem
a ficha do item: margem, cobertura, reposição sugerida, histórico e alertas específicos.

---

## 7. API REST

Todas as rotas exigem JWT (`Authorization: Bearer <token>`) e ficam sob `/api/agent`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/agent/config` | Versão do motor, provedor LLM habilitado (sem expor chaves) e limites |
| GET | `/api/agent/quick-prompts` | Sugestões de pergunta por área |
| GET | `/api/agent/domains` | As 6 áreas com nota, nível, contagem de alertas e metadados |
| GET | `/api/agent/diagnostic` | Diagnóstico completo: empresa, áreas, alertas, recomendações, plano e destaques |
| GET | `/api/agent/domains/:id` | Aprofundamento de uma área (análise + conhecimento + métricas + markdown) |
| GET | `/api/agent/alerts?domain=&severity=` | Alertas filtrados e contagem por severidade |
| GET | `/api/agent/plan` | Plano de ação 7/30/90 dias |
| GET | `/api/agent/report?domain=&download=1` | Relatório executivo em Markdown (ou download) |
| GET | `/api/agent/knowledge` · `/knowledge/:domain` | Base de conhecimento (conceitos, playbooks, fórmulas, como fazer) |
| POST | `/api/agent/chat` | Conversa: `{ message, domain?, conversationId?, useLlm? }` |
| GET | `/api/agent/conversations` | Histórico de conversas do usuário |
| GET | `/api/agent/conversations/:id` | Conversa com mensagens |
| DELETE | `/api/agent/conversations/:id` | Remove conversa e mensagens |

`id` de área aceito: `empresarial`, `producao`, `comercial`, `marketing`, `financeiro`, `estoque`.

### Exemplo

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@erp.com","password":"admin123"}' | jq -r .token)

# diagnóstico completo
curl -s http://localhost:3000/api/agent/diagnostic -H "Authorization: Bearer $TOKEN" | jq '.company'

# perguntar ao agente
curl -s -X POST http://localhost:3000/api/agent/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"quais produtos estão em ruptura?"}' | jq '.reply.text'

# baixar o relatório executivo
curl -s "http://localhost:3000/api/agent/report?download=1" \
  -H "Authorization: Bearer $TOKEN" -o diagnostico.md
```

### Demonstração no terminal

```bash
npm run agent:demo                                    # diagnóstico das 6 áreas no console
npm run agent:demo -- "onde está o gargalo da operação?"   # pergunta direta
npm run agent:demo -- --area financeiro               # relatório de uma área
npm run agent:demo -- --report                        # relatório executivo completo
```

---

## 8. Conectar um modelo de linguagem (opcional)

Sem nenhuma configuração o agente usa o **motor local**. Para enriquecer a redação com um LLM,
defina as variáveis de ambiente — os números continuam sendo calculados localmente e enviados ao
modelo como contexto, com instrução explícita de não inventar dados.

| Provedor | Variáveis | Modelo padrão |
|----------|-----------|---------------|
| OpenAI | `OPENAI_API_KEY`, opcionais `OPENAI_BASE_URL`, `OPENAI_MODEL` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY`, opcional `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` |
| Google Gemini | `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`), opcional `GEMINI_MODEL` | `gemini-1.5-flash` |
| Ollama (local) | `OLLAMA_BASE_URL` (padrão `http://localhost:11434`), opcional `OLLAMA_MODEL` | `llama3.1` |

Controles gerais:

```bash
AGENT_LLM_PROVIDER=auto      # auto | openai | anthropic | gemini | ollama | none
AGENT_LLM_MODEL=gpt-4o-mini  # sobrepõe o modelo do provedor
AGENT_LLM_TIMEOUT_MS=45000   # timeout da chamada
```

Comportamento:

- `auto` escolhe o primeiro provedor com chave configurada (ordem: OpenAI → Anthropic → Gemini → Ollama).
- Se a chamada falhar (rede, quota, timeout), o agente **responde com o motor local** e avisa o
  usuário na própria mensagem — a experiência nunca quebra.
- `AGENT_LLM_PROVIDER=none` desliga o LLM mesmo com chave presente (útil em testes e ambientes
  restritos).
- `/api/agent/config` informa apenas `enabled`, `provider` e `model`. **Chaves nunca são
  enviadas ao navegador** e não aparecem em logs de resposta.
- O botão de status no topo da página mostra `🧠 LLM ativo: <provedor>` ou `⚙️ Motor local (offline)`.

Exemplo com Ollama rodando na mesma máquina:

```bash
export AGENT_LLM_PROVIDER=ollama
export OLLAMA_MODEL=llama3.1
npm start
```

---

## 9. Base de conhecimento

Cada área tem conteúdo técnico próprio (`src/agent/knowledge.js`), usado nas respostas de
orientação, nos relatórios e como contexto do LLM:

- **Conceitos e fórmulas** com faixa de referência: DRE, ponto de equilíbrio, margem de
  contribuição, ciclo PDCA, Teoria das Restrições, OEE, lead time, estoque de segurança, curva ABC,
  ticket médio, recompra, share of wallet, CAC, LTV, sazonalidade, matriz BCG, fluxo de caixa,
  inadimplência, DSO/DPO, capital de giro, giro e cobertura de estoque, ponto de pedido, acurácia
  de inventário e OTIF.
- **Playbooks** com passo a passo e indicador de acompanhamento: fechamento gerencial mensal,
  metas, mapa de riscos, ataque ao gargalo, padronização de processo (BPMN + POP), rotina de
  compras, reativação de clientes, aumento de ticket médio, funil previsível, medição de retorno de
  marketing, calendário sazonal, limpeza de portfólio, régua de cobrança, corte inteligente de
  despesas, projeção de caixa 90 dias, zerar rupturas, liberar capital parado e rotina diária de
  expedição.
- **Check-up** de cada área (perguntas de verificação rápida) e **rotinas de gestão** com cadência
  (diária, semanal, mensal, trimestral).
- **"Como fazer" no ERP**: onde registrar venda, compra, despesa, cobrança, baixa de estoque e
  como usar o DRE, o fluxo de caixa e a Academia ERP.

---

## 10. Estrutura de arquivos

```
src/agent/
├── index.js       # orquestrador (chat, diagnóstico, relatórios, conversas)
├── domains.js     # definição das 6 áreas + vocabulário por área
├── metrics.js     # camada de dados: ~40 consultas SQL → retrato do negócio
├── engine.js      # motor de regras: notas, alertas, recomendações, plano
├── knowledge.js   # conceitos, fórmulas, playbooks e check-ups
├── nlu.js         # intenção, domínio e entidades em português
├── compose.js     # redação das respostas (local) + contexto para o LLM
├── prompts.js     # prompts de sistema por área (modo LLM)
├── llm.js         # adaptador OpenAI / Anthropic / Gemini / Ollama
├── report.js      # relatório executivo em Markdown
└── store.js       # histórico de conversas e mensagens

src/routes/agent.js    # API REST /api/agent
public/js/agent.js     # interface (abas, cards, chat, gráficos, exportação)
public/css/agent.css   # estilos do módulo
scripts/agent-demo.js  # demonstração no terminal
test/agent-engine.test.js  # 16 testes do motor, métricas, NLU e relatório
test/agent-api.test.js     # 16 testes de integração da API
```

Tabelas criadas no banco (`database.js`):

```sql
agent_conversations (id, user_id, title, domain, message_count, created_at, updated_at)
agent_messages      (id, conversation_id, user_id, role, content, structured,
                     source, domain, intent, created_at)
```

---

## 11. Como rodar

```bash
npm install
npm run seed      # base demo coerente (vendas com itens, compras, despesas, títulos)
npm start         # http://localhost:3000 — login admin@erp.com / admin123
npm test          # 46 testes (curso + agente)
```

A base demo foi construída para exercitar o agente de propósito: inclui um produto em ruptura,
itens abaixo do mínimo, excesso de estoque, títulos vencidos, cliente inativo, variação de custo de
compra entre cadastro e última compra e um pedido aguardando expedição.

---

## 12. Limitações conhecidas e próximos passos

**Limitações atuais**

- O ERP não tem módulos próprios de produção (ordens de produção, apontamentos, OEE medido) nem de
  marketing (campanhas, canais, leads). O agente deriva esses indicadores do que existe — compras,
  estoque, vendas, despesas — e sinaliza quando falta dado em vez de estimar.
- Projeções usam o ritmo do mês em andamento (ou a média dos meses fechados nos primeiros dias) e
  média móvel + tendência linear para o mês seguinte, sempre com o histórico interno; não incorporam
  sazonalidade externa, campanhas ou cenário macro. Lançamentos com data futura dentro do mês
  corrente entram na base do mês, como no restante do ERP.
- CMV depende do custo cadastrado no produto: itens sem custo subestimam o custo e superestimam a
  margem (o agente alerta quando encontra essa falha de cadastro).
- O histórico de conversas é por usuário e não é compartilhado entre dispositivos além do banco do
  servidor.

**Roadmap sugerido**

1. Módulos de **ordem de produção** e **campanhas de marketing** para alimentar OEE real e CAC por canal.
2. **Metas por área** cadastráveis, com acompanhamento de atingimento automático.
3. **Agendamento**: diagnóstico diário por e-mail/webhook e alertas push.
4. **Ações executáveis pelo agente** (gerar pedido de compra, emitir cobrança) com confirmação do usuário.
5. **Memória de decisões**: registrar o que foi feito com cada recomendação e medir o resultado.
6. **Streaming** das respostas do LLM (SSE) no chat.
