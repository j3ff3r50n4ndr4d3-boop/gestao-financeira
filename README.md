# 💰 FinanceHub — Gestão Financeira

Sistema completo de gestão financeira, 100% front-end (HTML + CSS + JavaScript puro), sem necessidade de backend. Os dados são salvos no navegador (localStorage) e podem ser exportados/importados em JSON.

## Funcionalidades

- **Dashboard moderno** — receitas, despesas, lucro, margem de lucro, saldo em contas, faturas de cartões, gráfico de receitas × despesas (6 meses), despesas por categoria e listas de próximos vencimentos/recebimentos.
- **Contas a Pagar** — cadastro, edição, exclusão, filtros e busca; status automático (pendente / vencido / pago); pagamento debita o saldo da conta bancária vinculada (com opção de desfazer).
- **Contas a Receber** — mesmo fluxo, creditando a conta destino ao receber.
- **Fluxo de Caixa** — visão **diária** (por mês) e **mensal** (por ano), com realizado + previsto, gráfico com acumulado e tabela com totais.
- **Contas Bancárias** — cartões visuais com saldo, cor personalizada e ajuste manual.
- **Cartões de Crédito** — limite, fatura do mês, uso do limite, dias de fechamento e vencimento.
- **Backup** — exportar/importar dados em JSON e restaurar dados de demonstração.
- **Responsivo** — funciona em desktop e mobile (menu lateral recolhível).

## Como executar

Qualquer servidor estático serve. Exemplos:

```bash
python3 -m http.server 8000
# ou
npx serve .
```

Abra `http://localhost:8000` no navegador.

## Estrutura

```
index.html          # estrutura da aplicação
css/style.css       # estilos
js/app.js           # lógica (estado, persistência, gráficos, formulários)
vendor/chart.umd.min.js  # Chart.js v4 (local, funciona offline)
```
