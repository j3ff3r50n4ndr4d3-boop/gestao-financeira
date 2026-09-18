"""
plano_contas.py — Plano de contas gerencial (hierárquico) que alimenta toda a
planilha. Colunas: código, grupo, subgrupo, categoria, tipo de conta,
natureza (Entrada/Saída), tipo de fluxo e linha do DRE.
"""

# (codigo, grupo, subgrupo, categoria, tipo_conta, natureza, tipo_fluxo, linha_dre)
PLANO = [
    # ------------------------------------------------------------- RECEITAS
    ("1.1.01", "RECEITAS", "Vendas", "Vendas de Produtos", "Receita", "Entrada", "Operacional", "Faturamento Bruto"),
    ("1.1.02", "RECEITAS", "Vendas", "Vendas de Serviços", "Receita", "Entrada", "Operacional", "Faturamento Bruto"),
    ("1.2.01", "RECEITAS", "Outras Receitas", "Outras Receitas Operacionais", "Receita", "Entrada", "Operacional", "Outras Receitas Operacionais"),
    ("1.3.01", "RECEITAS", "Receitas Financeiras", "Rendimentos de Aplicações Financeiras", "Receita", "Entrada", "Operacional", "Receitas Financeiras"),
    ("1.3.02", "RECEITAS", "Receitas Financeiras", "Juros Recebidos de Clientes", "Receita", "Entrada", "Operacional", "Receitas Financeiras"),
    ("1.3.03", "RECEITAS", "Receitas Financeiras", "Descontos Obtidos de Fornecedores", "Receita", "Entrada", "Operacional", "Receitas Financeiras"),
    ("1.4.01", "RECEITAS", "Devoluções e Cancelamentos", "Devoluções e Cancelamentos de Vendas", "Devolução", "Saída", "Operacional", "Devoluções"),

    # ---------------------------------------------------------------- CUSTOS
    ("2.1.01", "CUSTOS", "Custos Variáveis", "Matéria-prima", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.02", "CUSTOS", "Custos Variáveis", "Mercadorias para Revenda", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.03", "CUSTOS", "Custos Variáveis", "Embalagens", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.04", "CUSTOS", "Custos Variáveis", "Fretes e Entregas sobre Vendas", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.05", "CUSTOS", "Custos Variáveis", "Comissões sobre Vendas", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.06", "CUSTOS", "Custos Variáveis", "Taxas de Marketplace", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.07", "CUSTOS", "Custos Variáveis", "Taxas de Cartão e Maquininha", "Custo", "Saída", "Operacional", "Custos Variáveis"),
    ("2.1.08", "CUSTOS", "Custos Variáveis", "Outros Custos Diretos", "Custo", "Saída", "Operacional", "Custos Variáveis"),

    # ------------------------------------------------------------- DESPESAS
    ("3.1.01", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Aluguel", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.02", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Energia Elétrica", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.03", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Água e Saneamento", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.04", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Internet e Telefonia", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.05", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Contabilidade", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.06", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Sistemas e Softwares", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.07", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Material de Escritório", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.08", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Manutenção e Conservação", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.09", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Seguros", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.10", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Despesas Legais e Jurídicas", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.1.11", "DESPESAS OPERACIONAIS", "Despesas Administrativas", "Outras Despesas Administrativas", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.01", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Salários", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.02", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Encargos Sociais (FGTS/INSS)", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.03", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Benefícios (VT/VA/Plano de Saúde)", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.04", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Pró-labore", "Pró-labore", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.05", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Treinamentos e Capacitação", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.2.06", "DESPESAS OPERACIONAIS", "Despesas com Pessoal", "Serviços Terceirizados (PJ)", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.3.01", "DESPESAS OPERACIONAIS", "Despesas Comerciais", "Marketing Digital", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.3.02", "DESPESAS OPERACIONAIS", "Despesas Comerciais", "Publicidade e Anúncios", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.3.03", "DESPESAS OPERACIONAIS", "Despesas Comerciais", "Eventos e Feiras", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.3.04", "DESPESAS OPERACIONAIS", "Despesas Comerciais", "Viagens Comerciais", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.3.05", "DESPESAS OPERACIONAIS", "Despesas Comerciais", "Brindes e Material de Divulgação", "Despesa", "Saída", "Operacional", "Despesas Fixas"),
    ("3.4.01", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "Juros de Empréstimos e Financiamentos", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.4.02", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "Tarifas Bancárias", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.4.03", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "IOF", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.4.04", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "Multas e Penalidades", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.4.05", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "Encargos por Atraso", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.4.06", "DESPESAS OPERACIONAIS", "Despesas Financeiras", "Juros de Antecipação de Recebíveis", "Despesa", "Saída", "Operacional", "Despesas Financeiras"),
    ("3.5.01", "DESPESAS OPERACIONAIS", "Tributos", "Simples Nacional", "Imposto", "Saída", "Operacional", "Impostos sobre Vendas"),
    ("3.5.02", "DESPESAS OPERACIONAIS", "Tributos", "ICMS", "Imposto", "Saída", "Operacional", "Impostos sobre Vendas"),
    ("3.5.03", "DESPESAS OPERACIONAIS", "Tributos", "ISS", "Imposto", "Saída", "Operacional", "Impostos sobre Vendas"),
    ("3.5.04", "DESPESAS OPERACIONAIS", "Tributos", "PIS/COFINS", "Imposto", "Saída", "Operacional", "Impostos sobre Vendas"),
    ("3.5.05", "DESPESAS OPERACIONAIS", "Tributos", "Outros Impostos e Taxas", "Imposto", "Saída", "Operacional", "Impostos sobre Vendas"),
    ("3.5.06", "DESPESAS OPERACIONAIS", "Tributos", "IRPJ e CSLL", "Imposto", "Saída", "Operacional", "Impostos sobre o Resultado"),

    # ---------------------------------------------------------- INVESTIMENTOS
    ("4.1.01", "INVESTIMENTOS", "Investimentos", "Máquinas e Equipamentos", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),
    ("4.1.02", "INVESTIMENTOS", "Investimentos", "Veículos", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),
    ("4.1.03", "INVESTIMENTOS", "Investimentos", "Móveis e Utensílios", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),
    ("4.1.04", "INVESTIMENTOS", "Investimentos", "Tecnologia e Informática", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),
    ("4.1.05", "INVESTIMENTOS", "Investimentos", "Reformas e Benfeitorias", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),
    ("4.1.06", "INVESTIMENTOS", "Investimentos", "Outros Investimentos", "Investimento", "Saída", "Investimento", "Investimentos (CAPEX)"),

    # ------------------------------------------------- FINANCIAMENTOS / SÓCIOS
    ("5.1.01", "FINANCIAMENTOS", "Empréstimos e Financiamentos", "Empréstimos e Financiamentos Recebidos", "Empréstimo", "Entrada", "Financiamento", "Financiamentos e Sócios (Principal)"),
    ("5.1.02", "FINANCIAMENTOS", "Empréstimos e Financiamentos", "Pagamento de Principal de Empréstimos", "Empréstimo", "Saída", "Financiamento", "Financiamentos e Sócios (Principal)"),
    ("5.1.03", "FINANCIAMENTOS", "Empréstimos e Financiamentos", "Parcelamento de Dívidas e Tributos", "Empréstimo", "Saída", "Financiamento", "Financiamentos e Sócios (Principal)"),
    ("6.1.01", "PATRIMÔNIO LÍQUIDO", "Patrimônio Líquido", "Distribuição de Lucros aos Sócios", "Distribuição de lucros", "Saída", "Financiamento", "Distribuição de Lucros"),
    ("6.1.02", "PATRIMÔNIO LÍQUIDO", "Patrimônio Líquido", "Aporte de Capital dos Sócios", "Aporte de Capital", "Entrada", "Financiamento", "Financiamentos e Sócios (Principal)"),
]

SUBGRUPOS = sorted({p[2] for p in PLANO}, key=lambda s: [p[2] for p in PLANO].index(s))
GRUPOS = ["RECEITAS", "CUSTOS", "DESPESAS OPERACIONAIS", "INVESTIMENTOS", "FINANCIAMENTOS", "PATRIMÔNIO LÍQUIDO"]
LINHAS_DRE = [
    "Faturamento Bruto",
    "Impostos sobre Vendas",
    "Devoluções",
    "Custos Variáveis",
    "Despesas Fixas",
    "Despesas Financeiras",
    "Receitas Financeiras",
    "Outras Receitas Operacionais",
    "Impostos sobre o Resultado",
    "Distribuição de Lucros",
    "Investimentos (CAPEX)",
    "Financiamentos e Sócios (Principal)",
]
TIPOS_CONTA = ["Receita", "Custo", "Despesa", "Imposto", "Investimento", "Pró-labore",
               "Empréstimo", "Devolução", "Aporte de Capital", "Distribuição de lucros"]
TIPOS_FLUXO = ["Operacional", "Investimento", "Financiamento"]


def categorias():
    return [p[3] for p in PLANO]


def lookup_categoria(nome):
    for p in PLANO:
        if p[3] == nome:
            return p
    return None
