# Sistema de Gestão Financeira Empresarial (planilha)

Planilha profissional de gestão financeira para pequenas e médias empresas brasileiras, pronta para
usar no **Microsoft Excel** e no **Google Sheets**.

📄 **Arquivo final:** [`GESTAO_FINANCEIRA_EMPRESARIAL.xlsx`](GESTAO_FINANCEIRA_EMPRESARIAL.xlsx)
(25 abas, ~49.600 fórmulas, 12 gráficos no dashboard, 35 no total, 79 validações de dados e
95 regras de formatação condicional — já vem com dados de exemplo preenchidos).

---

## 1. O que a planilha entrega

| Bloco | Abas |
|---|---|
| **Navegação** | PAINEL DE CONTROLE (atalhos para todas as áreas) |
| **Configurações** | CONFIGURAÇÕES (ano/mês de análise, metas, margem mínima, saldo mínimo, % de inadimplência máxima, prazos médios, listas de apoio) |
| **Cadastros** | CADASTRO DE CLIENTES, CADASTRO DE FORNECEDORES, PLANO DE CONTAS (hierárquico e extensível), CENTRO DE CUSTOS, CONTAS BANCÁRIAS, CARTÕES |
| **Operação** | LANÇAMENTOS (base central), CONTAS A PAGAR, CONTAS A RECEBER, CONCILIAÇÃO BANCÁRIA, DESPESAS RECORRENTES |
| **Gestão** | FLUXO DE CAIXA, DRE GERENCIAL, ORÇAMENTO X REALIZADO, EMPRÉSTIMOS E FINANCIAMENTOS (SAC e PRICE), INADIMPLÊNCIA, INDICADORES, PROJEÇÃO DE CAIXA |
| **Análises** | PONTO DE EQUILÍBRIO, SIMULADOR DE CENÁRIOS, DASHBOARD, RELATÓRIOS (11 relatórios imprimíveis), INSTRUÇÕES |

Destaques: DRE completo (faturamento → lucro líquido) com margens bruta, de contribuição, operacional
e líquida; fluxo de caixa diário e mensal com separação operacional/investimento/financiamento;
aging de inadimplência em 6 faixas e ranking de clientes; ponto de equilíbrio em R$ e em quantidade
com margem de segurança; projeção de caixa em 7/15/30/60/90/180 dias com alerta de déficit;
dashboard executivo com 16 cartões de KPI, 6 filtros e 12 gráficos; 18 verificações automáticas na
área **ATENÇÃO DO GESTOR**.

## 2. Como usar

1. Abra o arquivo no Excel ou importe no Google Sheets (as fórmulas são compatíveis: SOMASES,
   CONT.SES, SEERRO, ÍNDICE+CORRESP, SOMARPRODUTO, MÊS, ANO, HOJE).
2. Comece pela aba **CONFIGURAÇÕES** (ano/mês de análise, metas e listas).
3. Cadastre clientes, fornecedores, plano de contas, centros de custo e contas bancárias.
4. Lance a operação na aba **LANÇAMENTOS** (é a única aba em que os movimentos são digitados; todas
   as demais são alimentadas automaticamente).
5. Acompanhe o resultado no **DASHBOARD**, em **INDICADORES** e nos **RELATÓRIOS**.

**Células amarelas** = você digita · **células cinza** = calculadas automaticamente (protegidas).
Para liberar a edição das fórmulas: *Revisão → Desproteger Planilha* (não há senha).

### Dados de exemplo

A planilha vem preenchida com uma empresa fictícia ("Aurora Comércio de Alimentos Ltda") para você
ver o sistema funcionando: 723 lançamentos (158 receitas e 565 despesas), 283 títulos a pagar e 52 a
receber em aberto, 5 clientes, 30 fornecedores, 3 contas bancárias, 3 cartões, 3 empréstimos
(SAC e PRICE), 12 despesas recorrentes, 25 linhas de conciliação bancária e vendas parceladas.

Para começar do zero: apague os lançamentos de exemplo (aba LANÇAMENTOS, linhas 6 em diante) e os
cadastros, mantendo as fórmulas. Todas as abas trazem aviso em vermelho quando o conteúdo é de
exemplo.

## 3. Regenerar a planilha

```bash
cd planilha/scripts
python3 gerar_planilha.py                    # gera ./GESTAO_FINANCEIRA_EMPRESARIAL.xlsx
python3 gerar_planilha.py /tmp/minha.xlsx    # ou em outro caminho
```

O gerador (`scripts/abas/*`, `scripts/lib/*`) reconstrói o arquivo inteiro em ~3 segundos.
Requisitos: Python 3.11 e `openpyxl`.

## 4. Testes

```bash
cd planilha/scripts
python3 verificar_planilha.py            # suíte completa (~4 min)
python3 verificar_planilha.py --rapido   # só estrutura e sintaxe (segundos)
```

A suíte: gera a planilha, valida a **sintaxe** de todas as fórmulas, confere a **estrutura**
(25 abas, nomes definidos, validações, formatação condicional, gráficos, proteção), **calcula** o
arquivo com um motor de fórmulas independente (nenhuma célula pode retornar erro) e **recalcula em
Python** os números-chave — saldos bancários, fluxo de caixa, DRE, lucro, margens, cartões do
dashboard, alertas, orçamento x realizado, cronogramas SAC/PRICE, ponto de equilíbrio, projeção de
caixa e simulador de cenários — comparando com o resultado da planilha.

Resultado da última execução: **262 verificações OK, 0 falhas, 0 células com erro de fórmula**.

Opcional para a suíte completa: `pip install --break-system-packages formulas==1.3.4`.
