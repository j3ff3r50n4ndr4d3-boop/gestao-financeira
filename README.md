# 💰 Precifica Fácil — Precificação para Pequenas Empresas

Site completo de precificação para pequenas empresas, 100% front-end (um único arquivo HTML, sem dependências, sem servidor). Os dados são salvos no navegador (localStorage) e podem ser exportados/importados em JSON.

## 🔗 Acesse

- **GitHub Pages:** https://j3ff3r50n4ndr4d3-boop.github.io/gestao-financeira/
- **CDN (acesso imediato):** https://cdn.jsdelivr.net/gh/j3ff3r50n4ndr4d3-boop/gestao-financeira@arena/01a05dd3-gestao-financeira/index.html

## ✨ Funcionalidades

| Área | Descrição |
|---|---|
| 🏠 **Dashboard** | KPIs de faturamento, custo, lucro e margem projetados; mix de receita por produto; destaques e alertas de preço |
| 📋 **Produtos & Custos** | Ficha técnica com insumos (qtd × custo unitário), mão de obra com encargos, custos indiretos, perdas/quebras e rendimento → **custo unitário real** |
| 🏷️ **Precificação** | 4 métodos (markup, margem desejada, preço de mercado, manual); deduções (impostos, cartão/Pix, comissões, despesas, frete); preço mínimo, margem líquida, markup real e **ponto de equilíbrio** |
| 📈 **DRE Gerencial** | Resultado por produto e consolidado (mensal/trimestral/anual), com % da receita; impressão em PDF |
| 📄 **Tabela de Preços** | Relatório completo com status de cada produto; exporta **CSV** (Excel) e **PDF** |
| 🏢 **Empresa** | Dados da empresa, imposto padrão, backup em JSON e dados de exemplo |
| 📚 **Guia de Preços** | Conceitos de markup × margem, fórmulas, erros comuns e dicas práticas |

## 🚀 Como usar

1. Abra o site (o arquivo `index.html` funciona offline).
2. Clique em **✨ Dados de exemplo** para ver a ferramenta preenchida, ou cadastre produtos na aba **Produtos & Custos**.
3. Defina o preço em **Precificação**, informe as quantidades vendidas no **DRE** e exporte a **Tabela de Preços**.

## 🗂️ Estrutura do repositório

```
index.html                      # Precifica Fácil — site de precificação (página publicada)
Qwen_html_20260824_y8j99386e.html  # versão inicial/legado
css/, js/, vendor/              # arquivos legados do FinanceHub (gestão financeira)
```

## 🛠️ Publicação

O site é publicado via **GitHub Pages** (branch de publicação: `arena/01a05dd3-gestao-financeira`).
