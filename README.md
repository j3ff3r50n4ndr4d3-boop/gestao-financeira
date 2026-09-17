# 📊 ERP Gestão Financeira - Sistema Completo

Sistema ERP completo e moderno com dashboard de indicadores financeiros, pronto para uso empresarial.

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

# Iniciar servidor
npm start
```

Acesse: http://localhost:3000

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
│   └── routes/
│       ├── auth.js         # Login/Registro
│       ├── dashboard.js    # KPIs e gráficos
│       ├── customers.js    # Clientes
│       ├── products.js     # Produtos/Estoque
│       ├── sales.js        # Vendas
│       ├── purchases.js    # Compras
│       ├── suppliers.js    # Fornecedores
│       ├── expenses.js     # Despesas
│       ├── financial.js    # Financeiro (AR/AP/DRE)
│       ├── subscriptions.js # Assinaturas
│       └── course.js        # API do curso (ementa, quiz, progresso, certificado)
│   └── course/
│       ├── curriculum.js    # Montagem do currículo e correção dos quizzes
│       └── modules/         # Conteúdo das 58 aulas (fonte única de verdade)
├── public/
│   ├── index.html          # SPA principal
│   ├── css/style.css       # Estilos modernos
│   ├── js/app.js           # Lógica frontend
│   └── js/course.js        # Frontend do módulo Curso
├── scripts/
│   └── generate-curso-md.js # Gera o CURSO.md a partir do currículo
├── test/                   # Testes automatizados (npm test)
├── CURSO.md                # Versão impressa do curso
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
