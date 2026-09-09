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
│       └── subscriptions.js# Assinaturas
├── public/
│   ├── index.html          # SPA principal
│   ├── css/style.css       # Estilos modernos
│   └── js/app.js           # Lógica frontend
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

## 📋 Planos de Assinatura

| Plano | Preço | Ideal para |
|-------|-------|------------|
| Starter | R$ 49,90/mês | Microempreendedores |
| Professional | R$ 149,90/mês | Pequenas empresas |
| Enterprise | R$ 349,90/mês | Médias e grandes empresas |

## 📝 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido com ❤️ para empresas brasileiras**
