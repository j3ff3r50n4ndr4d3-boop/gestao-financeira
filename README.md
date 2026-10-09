# 📊 ERP Gestão Financeira - Sistema Completo

Sistema ERP completo e moderno com dashboard de indicadores financeiros, **Agente IA de gestão em 6 áreas** e academia integrada, pronto para uso empresarial.

![Versão](https://img.shields.io/badge/versão-2.0.0-blue)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![Licença](https://img.shields.io/badge/licença-MIT-yellow)

## 🚀 Funcionalidades

### 📈 Dashboard Inteligente
- Receita, Despesas e Lucro em tempo real
- Gráficos de evolução mensal
- KPIs: Ticket médio, Margem de lucro, Fluxo de caixa
- Alertas de estoque baixo e contas vencidas
- Gráfico de despesas por categoria

### 🤖 Agente IA de Gestão (6 áreas)
Consultor de gestão embutido no ERP, disponível no menu **Inteligência → Agente IA** e em uma faixa no Dashboard:

- **6 especialistas em um só agente:** 🏢 Gestão Empresarial, 🏭 Produção e Processos, 🤝 Comercial e Vendas, 📣 Marketing, 💰 Financeiro e 📦 Estoque e Expedição
- **Índice de saúde do negócio (0-100)** e nota por área, com os componentes e pesos expostos
- **Leitura em linguagem natural** dos dados reais: DRE com CMV, ponto de equilíbrio, giro e cobertura de estoque, curva ABC, CAC/LTV, DSO/DPO, ciclo financeiro, gargalos e capacidade
- **Alertas priorizados** (crítica, alta, média, baixa) com impacto estimado em reais e atalho para o módulo onde resolver
- **Plano de ação 7/30/90 dias** com passo a passo, esforço e resultado esperado
- **Chat** com intenção, área e entidades reconhecidas em português + histórico de conversas por usuário
- **Base de conhecimento** com conceitos, fórmulas, faixas de referência de mercado, playbooks e check-ups
- **Relatório executivo em Markdown** exportável (completo ou por área)
- **Funciona offline**: motor de regras local; opcionalmente conecta OpenAI, Anthropic, Gemini ou Ollama para enriquecer a redação (os números continuam locais)

📘 Documentação completa: [AGENTE_IA.md](AGENTE_IA.md)

### 💰 Módulos Financeiros
- **Contas a Receber** - Gerenciamento de recebíveis
- **Contas a Pagar** - Controle de obrigações
- **Fluxo de Caixa** - Movimentações em tempo real
- **DRE** - Demonstrativo de Resultados do Exercício
- **Despesas** - Controle de despesas operacionais

### 🛒 Vendas e Operações
- **Gestão de Vendas** - Registro completo com múltiplos itens
- **Cadastro de Clientes** - Base de dados completa
- **Controle de Estoque** - Produtos com alertas de estoque mínimo
- **Compras** - Registro de compras com entrada automática no estoque
- **Fornecedores** - Gestão completa de fornecedores

### 💼 Sistema de Assinaturas
- 3 planos: Starter, Professional, Enterprise
- Painel administrativo com MRR e métricas
- Gestão de assinaturas por cliente

### 🎓 Academia ERP (Curso integrado)
- Curso **Gestão Financeira na Prática com ERP**: 23 módulos, 58 aulas e 174 questões
- Cobre todos os temas do sistema: fundamentos, cadastros, precificação, estoque, vendas, compras, despesas, contas a receber/pagar, fluxo de caixa, DRE, ponto de equilíbrio, indicadores, rotina de dashboard, plano de negócios SaaS, assinaturas, segurança e LGPD, deploy e integrações via API
- Aulas com objetivo, fórmulas, passo a passo dentro do sistema e exercício prático
- Quiz corrigido no servidor, com explicação por questão (o gabarito não vai para o navegador)
- Progresso salvo por usuário, média de notas e certificado com código de verificação
- Versão impressa gerada automaticamente em [CURSO.md](CURSO.md) via `npm run course:doc`

## 🔐 Acesso Demo

```
Email: admin@erp.com
Senha: admin123
```

## ⚡ Instalação Rápida

```bash
# Clonar repositório
git clone <repo-url>
cd gestao-financeira

# Instalar dependências
npm install

# Popular a base de demonstração (recomendado para ver o Agente IA em ação)
npm run seed

# Iniciar servidor
npm start
```

Acesse: http://localhost:3000

Outros comandos úteis:

```bash
npm test                                              # 46 testes automatizados
npm run agent:demo                                    # diagnóstico do agente no terminal
npm run agent:demo -- "quais produtos estão em ruptura?"   # pergunta direta ao agente
npm run agent:demo -- --report                        # relatório executivo em Markdown
npm run course:doc                                    # regenera o CURSO.md
```

### Conectar um modelo de linguagem ao Agente IA (opcional)

O agente funciona sem nenhuma chave. Para enriquecer a redação com um LLM:

```bash
export OPENAI_API_KEY=sk-...          # ou ANTHROPIC_API_KEY / GEMINI_API_KEY
export AGENT_LLM_PROVIDER=auto        # auto | openai | anthropic | gemini | ollama | none
npm start
```

Para rodar 100% local com [Ollama](https://ollama.com):

```bash
export AGENT_LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1
```

Se a chamada ao provedor falhar, o agente responde com o motor local e avisa na tela. As chaves
nunca são expostas ao navegador.

## 📦 Tecnologias

- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (sql.js)
- **Autenticação:** JWT + bcrypt
- **Frontend:** HTML5 + CSS3 + JavaScript (Vanilla)
- **Gráficos:** Chart.js
- **Segurança:** Helmet + Rate Limiting

## 📁 Estrutura do Projeto

```
gestao-financeira/
├── server.js              # Servidor Express principal
├── database.js            # Inicialização SQLite
├── package.json           # Dependências
├── src/
│   ├── middleware/
│   │   └── auth.js        # Autenticação JWT
│   ├── routes/
│   │   ├── auth.js          # Login/Registro
│   │   ├── dashboard.js     # KPIs e gráficos
│   │   ├── customers.js     # Clientes
│   │   ├── products.js      # Produtos/Estoque
│   │   ├── sales.js         # Vendas
│   │   ├── purchases.js     # Compras
│   │   ├── suppliers.js     # Fornecedores
│   │   ├── expenses.js      # Despesas
│   │   ├── financial.js     # Financeiro (AR/AP/DRE)
│   │   ├── subscriptions.js # Assinaturas
│   │   ├── course.js        # API do curso (ementa, quiz, progresso, certificado)
│   │   └── agent.js         # API do Agente IA (/api/agent)
│   ├── course/
│   │   ├── curriculum.js    # Montagem do currículo e correção dos quizzes
│   │   └── modules/         # Conteúdo das 58 aulas (fonte única de verdade)
│   └── agent/               # 🤖 Agente IA de gestão
│       ├── index.js         # Orquestrador (chat, diagnóstico, relatórios)
│       ├── domains.js       # As 6 áreas e o vocabulário de cada uma
│       ├── metrics.js       # Camada de dados (SQL -> retrato do negócio)
│       ├── engine.js        # Motor de regras: notas, alertas e recomendações
│       ├── knowledge.js     # Conceitos, fórmulas, playbooks e check-ups
│       ├── nlu.js           # Intenção, domínio e entidades em português
│       ├── compose.js       # Redação das respostas e contexto para o LLM
│       ├── prompts.js       # Prompts de sistema por área
│       ├── llm.js           # Adaptador OpenAI / Anthropic / Gemini / Ollama
│       ├── report.js        # Relatório executivo em Markdown
│       └── store.js         # Histórico de conversas
├── public/
│   ├── index.html          # SPA principal
│   ├── css/style.css       # Estilos modernos
│   ├── css/agent.css       # Estilos do Agente IA
│   ├── js/app.js           # Lógica frontend
│   ├── js/course.js        # Frontend do módulo Curso
│   └── js/agent.js         # Frontend do Agente IA (abas, chat, gráficos)
├── scripts/
│   ├── generate-curso-md.js # Gera o CURSO.md a partir do currículo
│   └── agent-demo.js        # Demonstração do agente no terminal
├── test/                   # Testes automatizados (npm test)
├── CURSO.md                # Versão impressa do curso
├── AGENTE_IA.md            # Documentação completa do Agente IA
├── BUSINESS_PLAN.md        # Plano de Negócios
└── README.md               # Este arquivo
```

## 📊 API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro

### Dashboard
- `GET /api/dashboard/kpis` - Indicadores
- `GET /api/dashboard/chart/revenue` - Receita mensal
- `GET /api/dashboard/chart/expenses` - Despesas mensais
- `GET /api/dashboard/chart/categories` - Por categoria

### Módulos (CRUD)
- `/api/customers` - Clientes
- `/api/products` - Produtos
- `/api/sales` - Vendas
- `/api/purchases` - Compras
- `/api/suppliers` - Fornecedores
- `/api/expenses` - Despesas
- `/api/financial/receivable` - Contas a receber
- `/api/financial/payable` - Contas a pagar
- `/api/financial/cashflow` - Fluxo de caixa
- `/api/financial/dre` - DRE

### Assinaturas
- `GET /api/subscriptions/plans` - Planos disponíveis
- `GET /api/subscriptions/my` - Minha assinatura
- `POST /api/subscriptions` - Criar assinatura

### Agente IA
- `GET /api/agent/config` - Motor e provedor LLM (não expõe chaves)
- `GET /api/agent/domains` - As 6 áreas com nota de saúde
- `GET /api/agent/diagnostic` - Diagnóstico completo (alertas, recomendações, plano)
- `GET /api/agent/domains/:id` - Aprofundamento de uma área
- `GET /api/agent/alerts?domain=&severity=` - Alertas filtrados
- `GET /api/agent/plan` - Plano de ação 7/30/90 dias
- `GET /api/agent/report?download=1` - Relatório executivo em Markdown
- `GET /api/agent/knowledge[/:domain]` - Base de conhecimento
- `POST /api/agent/chat` - Conversa com o agente
- `GET|DELETE /api/agent/conversations[/:id]` - Histórico de conversas

### Curso (Academia ERP)
- `GET /api/course` - Ementa completa + progresso do usuário
- `GET /api/course/lesson/:id` - Conteúdo e quiz de uma aula (sem gabarito)
- `POST /api/course/quiz/:id` - Correção do quiz (body: `{ "answers": [0, 2, 1] }`)
- `POST /api/course/progress` - Conclusão de aula (body: `{ "lesson_id": "m1a1", "completed": true }`)
- `GET /api/course/certificate` - Elegibilidade e dados do certificado

## 📋 Planos de Assinatura

| Plano | Preço | Ideal para |
|-------|-------|------------|
| Starter | R$ 49,90/mês | Microempreendedores |
| Professional | R$ 149,90/mês | Pequenas empresas |
| Enterprise | R$ 349,90/mês | Médias e grandes empresas |

## 🤖 Agente IA integrado

O agente lê os dados reais da empresa e devolve diagnóstico, alertas com impacto em reais e plano de
ação — sem depender de serviço externo. Exemplo de saída do motor:

```text
Índice de saúde do negócio: 64,6/100 (Bom)
Receita de R$ 9.779 nos primeiros 9 de 31 dias do mês — projeção de R$ 33.685
(+34,3% vs. mês anterior) pelo ritmo do mês, com resultado projetado de R$ 2.278.

🏢 Gestão Empresarial              70,6  Bom
🏭 Gestão de Produção e Processos  52,4  Atenção
🤝 Gestão Comercial e Vendas       66,3  Bom
📣 Gestão de Marketing             77,9  Bom
💰 Gestão Financeira               72,5  Bom
📦 Gestão de Estoque e Expedição   47,6  Atenção

🔴 [estoque] 1 produto em ruptura — impacto R$ 5.148
🔴 [financeiro] Recebíveis vencidos — impacto R$ 5.083
🟠 [estoque] Fila de expedição acumulada — impacto R$ 4.000
🟠 [empresarial] Receita concentrada em poucos clientes

🔥 7 dias: 1. Atacar o gargalo principal   2. Blitz de reativação da carteira
           3. Ativar a régua de cobrança   4. Emitir pedido de reposição
```

O agente entende que **o mês pode estar em andamento**: até o 4º dia projeta pela média dos meses
fechados e, do 5º dia em diante, pelo ritmo dos dias vividos — assim ele não grita "a receita caiu
60%" todo começo de mês. O ponto de equilíbrio usa margem de contribuição real (CMV + despesas
variáveis) e a projeção usa a mesma decomposição, então os números nunca se contradizem.

Veja arquitetura, regras, faixas de referência e API em [AGENTE_IA.md](AGENTE_IA.md).

## 🎓 Curso integrado (Academia ERP)

O módulo **Curso** fica na barra lateral, na seção **Aprendizado**, e transforma o sistema em sala de aula: cada conceito é ensinado e aplicado no próprio ERP, com os dados demo já carregados.

| Bloco | Módulos | Conteúdo |
| --- | --- | --- |
| Fundamentos | 0 a 4 | Boas-vindas, caixa x competência, KPIs, clientes e fornecedores |
| Operação | 5 a 8 | Precificação, estoque, compras e vendas |
| Financeiro e Análise | 9 a 16 | Contas a receber/pagar, despesas, fluxo de caixa, DRE, ponto de equilíbrio, indicadores e rotina do gestor |
| Negócio e Tecnologia | 17 a 22 | Plano de negócios SaaS, assinaturas, segurança e LGPD, deploy, API e projeto final |

```bash
# Testes automatizados (currículo + API do curso, com servidor em porta e banco temporários)
npm test

# Regenera o documento CURSO.md a partir de src/course/modules/
npm run course:doc
```

Certificado **Especialista em Gestão Financeira com ERP** (18 horas) liberado com 100% das aulas concluídas e média mínima de 70% nos quizzes.

## 📝 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido com ❤️ para empresas brasileiras**
