"""Abas FLUXO DE CAIXA, DRE GERENCIAL, ORÇAMENTO X REALIZADO e EMPRÉSTIMOS E FINANCIAMENTOS."""
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.comments import Comment

from lib import dados_exemplo as D
from lib import estilos as E
from lib import parametros as P
from lib import plano_contas as PC
from lib import util as U
from lib.util import L, R, nome, put

L_TIPO = P.rng("TIPO")
L_VENC = P.rng("VENC")
L_PAGTO = P.rng("PAGTO")
L_COMP = P.rng("COMP")
L_ENT = P.rng("ENTIDADE")
L_SUBCAT = P.rng("SUBCAT")
L_CAT = P.rng("CAT")
L_VPREV = P.rng("VPREV")
L_VFINAL = P.rng("VFINAL")
L_SALDO = P.rng("SALDO")
L_STATUS = P.rng("STATUS")
L_VDRE = P.rng("VDRE")
L_LINHA = P.rng("LINHADRE")
L_FLUXO = P.rng("FLUXO")
L_MES = P.rng("MES")
L_ANO = P.rng("ANO")
L_CHAVEAP = P.rng("CHAVEAP")
L_BANCO = P.rng("BANCO")
L_JUROS = P.rng("JUROS")

ANO = P.CONFIG_REF["ano"]
MES = P.CONFIG_REF["mes"]
HOJE = "TODAY()"
ABERTURA = f"SUM('{P.ABA_BANCOS}'!$G${P.BANCO_INI}:$G${P.BANCO_FIM})"
DIAS_MES = lambda ref: f"DAY(EOMONTH(DATE({ANO},{ref},1),0))"


def _cards(ws, row, cards, span=2):
    """Cartões de KPI: (rótulo, fórmula, estilo) ou (rótulo, fórmula, estilo, nota)."""
    col = 1
    for item in cards:
        rotulo, formula, estilo = item[0], item[1], item[2]
        nota = item[3] if len(item) > 3 else None
        U.cartao(ws, row, col, span, rotulo, formula, estilo, nota)
        col += span
    return row + 3


# ==========================================================================
# FLUXO DE CAIXA
# ==========================================================================
def fluxo_caixa(wb, ctx):
    ws = wb.create_sheet(P.ABA_FLUXO)
    U.larguras(ws, {"A": 34, "B": 14, "C": 16, "D": 16, "E": 16, "F": 18, "G": 16, "H": 16, "I": 18,
                    "J": 18, "K": 18, "L": 18, "M": 18, "N": 18, "O": 18, "P": 18, "Q": 18})
    U.titulo(ws, 1, "FLUXO DE CAIXA — DIÁRIO, MENSAL E POR TIPO DE OPERAÇÃO",
             "Quanto entrou, quanto saiu, qual o saldo do dia e o saldo acumulado, separando operacional, "
             "investimentos e financiamentos. Alimentado automaticamente pelos lançamentos liquidados.", span=9)
    U.mesclar(ws, "A3:I3", "⚠ Dados de exemplo. As entradas e saídas realizadas vêm da aba LANÇAMENTOS "
                          "(data de pagamento/recebimento preenchida).", "NOTA_WRAP")
    ws.row_dimensions[3].height = 20

    U.secao(ws, 5, "1. POSIÇÃO DE CAIXA (contas correntes e caixa)", span=9)
    cards = [
        ("Saldo inicial das contas", f"={ABERTURA}", "KPI_VALUE"),
        ("Entradas realizadas no ano", f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},">="&'
                                       f'DATE({ANO},1,1),{L_PAGTO},"<="&DATE({ANO},12,31))', "KPI_VALUE"),
        ("Saídas realizadas no ano", f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},">="&'
                                     f'DATE({ANO},1,1),{L_PAGTO},"<="&DATE({ANO},12,31))', "KPI_VALUE"),
        ("Saldo disponível atual", f'={ABERTURA}+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<="&{HOJE})'
                                   f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<="&{HOJE})', "KPI_VALUE"),
    ]
    _cards(ws, 6, cards, span=2)
    cards = [
        ("Geração de caixa no ano", f'=$D$7-$F$7', "KPI_VALUE"),
        ("Saldo mínimo exigido (meta)", f'={P.CONFIG_REF["saldo_min"]}', "KPI_VALUE"),
        ("Folga/déficit vs saldo mínimo", f'=$H$7-{P.CONFIG_REF["saldo_min"]}', "KPI_VALUE"),
        ("Contas vencidas a pagar", f'=SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_VENC},"<"&{HOJE})', "KPI_VALUE"),
    ]
    _cards(ws, 9, cards, span=2)
    U.cf_formula(ws, "F10", '=$F$10<0', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, "F10", '=$F$10>=0', E.GREEN_BG, E.GREEN_TX, True)

    # ---------------------------------------------------------------- diário
    U.secao(ws, 13, "2. FLUXO DE CAIXA DIÁRIO — mês selecionado abaixo", span=9)
    put(ws, 14, 1, "Ano do fluxo diário", "TXT_B")
    put(ws, 14, 2, f"={ANO}", "CALC_INT")
    put(ws, 14, 3, "Mês do fluxo diário (1 a 12)", "TXT_B")
    put(ws, 14, 4, f'={MES}', "CALC_INT")
    put(ws, 14, 6, "Saldo inicial do mês selecionado", "TXT_B")
    put(ws, 14, 8, f'={ABERTURA}+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<"&DATE($B$14,$D$14,1))'
                   f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<"&DATE($B$14,$D$14,1))', "TOTAL_MONEY")
    put(ws, 15, 6, "Saldo ao final do mês (realizado + previsto)", "TXT_B")
    put(ws, 15, 8, "=$H$14+SUM($C$18:$C$48)-SUM($D$18:$D$48)+SUM($G$18:$G$48)-SUM($H$18:$H$48)",
        "TOTAL_MONEY")

    cab = ["Dia", "Data", "Entradas realizadas", "Saídas realizadas", "Resultado do dia",
           "Saldo acumulado (realizado)", "Entradas previstas", "Saídas previstas", "Saldo projetado"]
    U.cabecalho(ws, 17, 1, cab, "TH", 34)
    for i in range(31):
        r = 18 + i
        dia = i + 1
        put(ws, r, 1, f'=IF({dia}<=DAY(EOMONTH(DATE($B$14,$D$14,1),0)),{dia},"")', "CALC_INT")
        put(ws, r, 2, f'=IF($A{r}="","",DATE($B$14,$D$14,$A{r}))', "CALC_DATE")
        put(ws, r, 3, f'=IF($B{r}="","",SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},$B{r}))', "CALC_MONEY")
        put(ws, r, 4, f'=IF($B{r}="","",SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},$B{r}))', "CALC_MONEY")
        put(ws, r, 5, f'=IF($B{r}="","",$C{r}-$D{r})', "CALC_MONEY")
        put(ws, r, 6, f'=IF($B{r}="","",$H$14+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<="&$B{r})'
                      f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<="&$B{r}))', "CALC_MONEY")
        put(ws, r, 7, f'=IF($B{r}="","",SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_VENC},$B{r},{L_SALDO},">0"))',
            "CALC_MONEY")
        put(ws, r, 8, f'=IF($B{r}="","",SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_VENC},$B{r},{L_SALDO},">0"))',
            "CALC_MONEY")
        put(ws, r, 9, f'=IF($B{r}="","",$F{r}+$G{r}-$H{r})', "CALC_MONEY")
    U.cf_formula(ws, "I18:I48", f'=AND($I18<>"",$I18<{P.CONFIG_REF["saldo_min"]})', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, "E18:E48", '=$E18<0', None, E.RED_TX)
    U.cf_barras(ws, "F18:F48", E.BLUE)

    # ---------------------------------------------------------------- mensal
    U.secao(ws, 50, "3. FLUXO DE CAIXA MENSAL — ano de análise", span=9)
    cab = ["Mês", "Saldo inicial", "Entradas realizadas", "Saídas realizadas", "Resultado do mês",
           "Saldo final", "Entradas previstas", "Saídas previstas", "Saldo projetado",
           "Entradas operacionais", "Saídas operacionais", "Resultado operacional",
           "Investimentos (líquido)", "Financiamentos (líquido)"]
    U.cabecalho(ws, 51, 1, cab, "TH", 44)
    for m in range(1, 13):
        r = 51 + m
        ini = f'DATE({ANO},{m},1)'
        fim = f'EOMONTH({ini},0)'
        put(ws, r, 1, f'="Mês {m:02d}"', "CALC_TXT_C")
        put(ws, r, 2, f'={ABERTURA}+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<"&{ini})'
                      f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<"&{ini})', "CALC_MONEY")
        put(ws, r, 3, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},">="&{ini},{L_PAGTO},"<="&{fim})',
            "CALC_MONEY")
        put(ws, r, 4, f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},">="&{ini},{L_PAGTO},"<="&{fim})',
            "CALC_MONEY")
        put(ws, r, 5, f'=$C{r}-$D{r}', "CALC_MONEY")
        put(ws, r, 6, f'=$B{r}+$E{r}', "CALC_MONEY")
        put(ws, r, 7, f'=SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_VENC},">="&{ini},{L_VENC},"<="&{fim},{L_SALDO},">0")',
            "CALC_MONEY")
        put(ws, r, 8, f'=SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_VENC},">="&{ini},{L_VENC},"<="&{fim},{L_SALDO},">0")',
            "CALC_MONEY")
        put(ws, r, 9, f'=$F{r}+$G{r}-$H{r}', "CALC_MONEY")
        put(ws, r, 10, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_FLUXO},"Operacional",{L_PAGTO},">="&{ini},'
                       f'{L_PAGTO},"<="&{fim})', "CALC_MONEY")
        put(ws, r, 11, f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_FLUXO},"Operacional",{L_PAGTO},">="&{ini},'
                       f'{L_PAGTO},"<="&{fim})', "CALC_MONEY")
        put(ws, r, 12, f'=$J{r}-$K{r}', "CALC_MONEY")
        put(ws, r, 13, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_FLUXO},"Investimento",{L_PAGTO},">="&{ini},'
                       f'{L_PAGTO},"<="&{fim})-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_FLUXO},"Investimento",'
                       f'{L_PAGTO},">="&{ini},{L_PAGTO},"<="&{fim})', "CALC_MONEY")
        put(ws, r, 14, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_FLUXO},"Financiamento",{L_PAGTO},">="&{ini},'
                       f'{L_PAGTO},"<="&{fim})-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_FLUXO},"Financiamento",'
                       f'{L_PAGTO},">="&{ini},{L_PAGTO},"<="&{fim})', "CALC_MONEY")
    rt = 64
    put(ws, rt, 1, "TOTAL DO ANO", "TOTAL_TXT")
    for col in (3, 4, 5, 7, 8, 10, 11, 12, 13, 14):
        put(ws, rt, col, f"=SUM({L(col)}52:{L(col)}63)", "TOTAL_MONEY")
    put(ws, rt, 6, '=$B$52+$E$64', "TOTAL_MONEY")
    put(ws, rt, 9, '=$F$64+$G$64-$H$64', "TOTAL_MONEY")
    U.cf_formula(ws, "I52:I63", f'=$I52<{P.CONFIG_REF["saldo_min"]}', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, "I52:I63", f'=AND($I52>={P.CONFIG_REF["saldo_min"]},$I52<{P.CONFIG_REF["saldo_min"]}*1.5)', E.YEL_BG, E.YEL_TX)
    U.cf_formula(ws, "E52:E63", '=$E52<0', None, E.RED_TX)
    U.cf_barras(ws, "F52:F63", E.BLUE)

    # ------------------------------------------------- resumo por tipo de fluxo
    U.secao(ws, 66, "4. RESUMO POR TIPO DE OPERAÇÃO (ano de análise)", span=9)
    U.cabecalho(ws, 67, 1, ["Tipo de fluxo", "Entradas", "Saídas", "Líquido", "% das entradas",
                            "O que entra aqui", "Linha do DRE correspondente"], "TH2", 32)
    tipos = [("Operacional", "Receitas, custos e despesas do dia a dia",
              "Receita líquida, custos variáveis e despesas"),
             ("Investimento", "Compra de máquinas, veículos, tecnologia, reformas",
              "Investimentos (CAPEX) — não afeta o resultado"),
             ("Financiamento", "Empréstimos, financiamentos, aportes e distribuição de lucros",
              "Não afeta o resultado operacional")]
    for i, (tipo, oque, linha_dre) in enumerate(tipos):
        r = 68 + i
        put(ws, r, 1, tipo, "CALC_TXT")
        put(ws, r, 2, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_FLUXO},$A{r},{L_PAGTO},">="&DATE({ANO},1,1),'
                      f'{L_PAGTO},"<="&DATE({ANO},12,31))', "CALC_MONEY")
        put(ws, r, 3, f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_FLUXO},$A{r},{L_PAGTO},">="&DATE({ANO},1,1),'
                      f'{L_PAGTO},"<="&DATE({ANO},12,31))', "CALC_MONEY")
        put(ws, r, 4, f'=$B{r}-$C{r}', "CALC_MONEY")
        put(ws, r, 5, f'=IF($B$71=0,"",$B{r}/$B$71)', "CALC_PCT")
        put(ws, r, 6, oque, "NOTA")
        put(ws, r, 7, linha_dre, "NOTA")
    put(ws, 71, 1, "TOTAL", "TOTAL_TXT")
    for col in (2, 3, 4):
        put(ws, 71, col, f"=SUM({L(col)}68:{L(col)}70)", "TOTAL_MONEY")
    put(ws, 71, 5, '=IF($B$71=0,"",1)', "TOTAL_PCT")
    U.cf_formula(ws, "D68:D70", "=$D68<0", None, E.RED_TX)

    U.mesclar(ws, "A73:I74",
              "COMO LER: 'Entradas/Saídas realizadas' usam a data de pagamento/recebimento. "
              "'Entradas/Saídas previstas' usam os títulos ainda em aberto na data de vencimento — é a sua "
              "agenda de compromissos. O saldo projetado mostra como o caixa ficará se tudo for liquidado nas datas.",
              "NOTA_WRAP")

    ch = BarChart()
    ch.type = "col"
    ch.grouping = "clustered"
    ch.title = "Entradas x Saídas realizadas por mês"
    ch.style = 2
    data = Reference(ws, min_col=3, max_col=4, min_row=51, max_row=63)
    ch.add_data(data, titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=52, max_row=63))
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 8, 16
    ws.add_chart(ch, "K14")
    ctx.chart_ent_sai = ch

    lc = LineChart()
    lc.title = "Evolução do saldo de caixa (mensal)"
    lc.style = 2
    d1 = Reference(ws, min_col=6, min_row=51, max_row=63)
    lc.add_data(d1, titles_from_data=True)
    lc.set_categories(Reference(ws, min_col=1, min_row=52, max_row=63))
    lc.y_axis.numFmt = 'R$ #,##0'
    lc.height, lc.width = 8, 16
    ws.add_chart(lc, "K32")
    ctx.chart_saldo = lc

    U.preparar(ws, freeze="A18", tab_cor=E.TEAL, area_impressao=f"A1:I{rt+4}")
    ctx.fluxo = ws
    return ws


# ==========================================================================
# DRE GERENCIAL
# ==========================================================================
DRE_LINHAS = [
    ("FATURAMENTO BRUTO", "Faturamento Bruto", "titulo"),
    ("(-) Impostos sobre vendas", "Impostos sobre Vendas", "sub"),
    ("(-) Devoluções e cancelamentos", "Devoluções", "sub"),
    ("▶ RECEITA LÍQUIDA", None, "total"),
    ("(-) Custos variáveis (CMV, fretes, taxas, comissões)", "Custos Variáveis", "sub"),
    ("▶ MARGEM DE CONTRIBUIÇÃO", None, "total"),
    ("(-) Despesas fixas (administrativas, pessoal e comercial)", "Despesas Fixas", "sub"),
    ("▶ EBITDA / RESULTADO OPERACIONAL", None, "total"),
    ("(-) Despesas financeiras (juros, tarifas, IOF)", "Despesas Financeiras", "sub"),
    ("(+) Receitas financeiras", "Receitas Financeiras", "sub_mais"),
    ("(+) Outras receitas operacionais", "Outras Receitas Operacionais", "sub_mais"),
    ("▶ LUCRO ANTES DOS IMPOSTOS (LAIR)", None, "total"),
    ("(-) Impostos sobre o resultado (IRPJ/CSLL)", "Impostos sobre o Resultado", "sub"),
    ("▶ LUCRO LÍQUIDO DO PERÍODO", None, "total_forte"),
    ("(-) Distribuição de lucros aos sócios", "Distribuição de Lucros", "sub"),
    ("▶ LUCRO RETIDO NA EMPRESA", None, "total"),
]


def dre(wb, ctx):
    ws = wb.create_sheet(P.ABA_DRE)
    U.larguras(ws, {"A": 52, **{L(m): 14 for m in range(2, 16)}, "P": 13})
    U.titulo(ws, 1, "DRE GERENCIAL — DEMONSTRATIVO DE RESULTADO",
             "Resultado por competência (regime de competência), mês a mês, com margens e análise vertical. "
             "Alimentado automaticamente pela aba LANÇAMENTOS.", span=10)
    U.mesclar(ws, "A3:P3",
              "⚠ Dados de exemplo. Os valores usam a DATA DE COMPETÊNCIA dos lançamentos (não o pagamento). "
              "Meses futuros mostram a previsão registrada nos lançamentos.", "NOTA_WRAP")
    ws.row_dimensions[3].height = 20

    U.secao(ws, 5, "1. DRE MENSAL E ANUAL (R$) — ano de análise definido na aba CONFIGURAÇÕES", span=10)
    # linha de apoio (oculta): número do mês, usada nas somas acumuladas
    put(ws, 4, 1, "Mês nº (apoio de cálculo)", "NOTA")
    for m in range(1, 13):
        put(ws, 4, 1 + m, m, "CALC_INT")
    ws.row_dimensions[4].hidden = True
    U.cabecalho(ws, 6, 1, ["Descrição"] + [f"Mês {m}" for m in range(1, 13)] + ["TOTAL DO ANO",
                                                                               "% da receita líquida"], "TH", 34)
    r_ini = 7
    for i, (rotulo, linha_dre, tipo) in enumerate(DRE_LINHAS):
        r = r_ini + i
        est = {"titulo": "BLOCO", "total": "TOTAL_TXT", "total_forte": "TOTAL_TXT"}.get(tipo, "TXT")
        put(ws, r, 1, rotulo, est)
        for m in range(1, 13):
            col = 1 + m
            if linha_dre:
                sinal = "+" if tipo == "sub_mais" else ""
                put(ws, r, col, f'=IF({ANO}=0,0,{sinal}SUMIFS({L_VDRE},{L_LINHA},"{linha_dre}",{L_MES},{m},'
                               f'{L_ANO},{ANO}))',
                "TOTAL_MONEY" if tipo in ("total", "total_forte") else "CALC_MONEY")
            else:
                put(ws, r, col, f"=0", "CALC_MONEY")
        put(ws, r, 14, f"=SUM(B{r}:M{r})", "TOTAL_MONEY" if tipo in ("total", "total_forte") else "CALC_MONEY")
        put(ws, r, 15, f'=IF($N$10=0,"",{"-" if tipo == "sub" else ""}$N{r}/$N$10)',
            "TOTAL_PCT" if tipo in ("total", "total_forte") else "CALC_PCT")
    # linhas calculadas
    r_fat = r_ini
    r_imp, r_dev, r_rec_liq = r_ini + 1, r_ini + 2, r_ini + 3
    r_cv, r_mc = r_ini + 4, r_ini + 5
    r_df, r_ebitda = r_ini + 6, r_ini + 7
    r_dfin, r_rfin, r_outras, r_lair, r_impres, r_lucro, r_dist, r_retido = [r_ini + i for i in range(8, 16)]
    for m in range(1, 13):
        col = L(1 + m)
        put(ws, r_rec_liq, 1 + m, f'={col}{r_fat}-{col}{r_imp}-{col}{r_dev}', "TOTAL_MONEY")
        put(ws, r_mc, 1 + m, f'={col}{r_rec_liq}-{col}{r_cv}', "TOTAL_MONEY")
        put(ws, r_ebitda, 1 + m, f'={col}{r_mc}-{col}{r_df}', "TOTAL_MONEY")
        put(ws, r_lair, 1 + m, f'={col}{r_ebitda}-{col}{r_dfin}+{col}{r_rfin}+{col}{r_outras}', "TOTAL_MONEY")
        put(ws, r_lucro, 1 + m, f'={col}{r_lair}-{col}{r_impres}', "TOTAL_MONEY")
        put(ws, r_retido, 1 + m, f'={col}{r_lucro}-{col}{r_dist}', "TOTAL_MONEY")
    # memo / conciliação com o caixa
    r_memo = r_ini + len(DRE_LINHAS) + 1
    U.secao(ws, r_memo - 1, "2. CONCILIAÇÃO COM O CAIXA (itens que não afetam o resultado)", span=10)
    put(ws, r_memo, 1, "(-) Investimentos (CAPEX) — compra de bens e equipamentos", "BLOCO")
    put(ws, r_memo + 1, 1, "(+/-) Financiamentos e sócios (entrada de crédito − principal pago)", "BLOCO")
    put(ws, r_memo + 2, 1, "GERAÇÃO DE CAIXA DO PERÍODO (lucro líquido − CAPEX + financiamentos)", "TOTAL_TXT")
    for m in range(1, 13):
        col = L(1 + m)
        put(ws, r_memo, 1 + m, f'=-SUMIFS({L_VDRE},{L_LINHA},"Investimentos (CAPEX)",{L_MES},{m},{L_ANO},{ANO})',
            "CALC_MONEY")
        put(ws, r_memo + 1, 1 + m,
            f'=SUMIFS({L_VDRE},{L_TIPO},"Entrada",{L_LINHA},"Financiamentos e Sócios (Principal)",'
            f'{L_MES},{m},{L_ANO},{ANO})-SUMIFS({L_VDRE},{L_TIPO},"Saída",'
            f'{L_LINHA},"Financiamentos e Sócios (Principal)",{L_MES},{m},{L_ANO},{ANO})', "CALC_MONEY")
        put(ws, r_memo + 2, 1 + m, f'={col}{r_lucro}+SUM({col}{r_memo}:{col}{r_memo+1})', "TOTAL_MONEY")
    for r in (r_memo, r_memo + 1, r_memo + 2):
        put(ws, r, 14, f"=SUM(B{r}:M{r})", "TOTAL_MONEY" if r == r_memo + 2 else "CALC_MONEY")

    # ------------------------------------------------- margens
    r_marg = r_memo + 4
    U.secao(ws, r_marg, "3. MARGENS (%) E INDICADORES DE RENTABILIDADE", span=10)
    U.cabecalho(ws, r_marg + 1, 1, ["Indicador"] + [f"Mês {m}" for m in range(1, 13)] + ["TOTAL DO ANO",
                                                                                          "Como é calculado"], "TH2", 34)
    margens = [
        ("Margem bruta (sobre o faturamento bruto)", f'=IF({L(2)}{r_fat}=0,"",({L(2)}{r_fat}-{L(2)}{r_imp}-{L(2)}{r_cv})/{L(2)}{r_fat})',
         "(Faturamento bruto − impostos − custos variáveis) ÷ faturamento bruto"),
        ("Margem de contribuição (sobre a receita líquida)",
         f'=IF({L(2)}{r_rec_liq}=0,"",{L(2)}{r_mc}/{L(2)}{r_rec_liq})',
         "Margem de contribuição ÷ receita líquida"),
        ("Margem operacional / EBITDA (sobre a receita líquida)",
         f'=IF({L(2)}{r_rec_liq}=0,"",{L(2)}{r_ebitda}/{L(2)}{r_rec_liq})',
         "EBITDA ÷ receita líquida"),
        ("Margem líquida (sobre a receita líquida)",
         f'=IF({L(2)}{r_rec_liq}=0,"",{L(2)}{r_lucro}/{L(2)}{r_rec_liq})',
         "Lucro líquido ÷ receita líquida"),
        ("Margem de segurança (folga sobre o ponto de equilíbrio)",
         f'=IF({L(2)}{r_rec_liq}=0,"",({L(2)}{r_rec_liq}-PE_RS)/'
         f'{L(2)}{r_rec_liq})', "(Receita líquida − ponto de equilíbrio) ÷ receita líquida"),
    ]
    for i, (rot, _, explic) in enumerate(margens):
        r = r_marg + 2 + i
        put(ws, r, 1, rot, "CALC_TXT")
        for m in range(1, 13):
            col = L(1 + m)
            put(ws, r, 1 + m, margens[i][1].replace(L(2), col), "CALC_PCT")
        put(ws, r, 14, f'=IF($N$10=0,"",{margens[i][1][1:].replace(L(2), "$N")})', "TOTAL_PCT")
        put(ws, r, 15, explic, "NOTA")
    U.cf_escala(ws, f"B{r_marg+2}:N{r_marg+5}")
    U.cf_formula(ws, f"B{r_marg+4}:N{r_marg+4}", f'=AND(B{r_marg+4}<>"",B{r_marg+4}<{P.CONFIG_REF["margem_min"]})',
                 E.RED_BG, E.RED_TX)

    # ------------------------------------------------- comparação mensal
    r_comp = r_marg + 9
    U.secao(ws, r_comp, "4. COMPARAÇÃO MENSAL E METAS", span=10)
    U.cabecalho(ws, r_comp + 1, 1, ["Indicador", "Mês de análise", "Mês anterior", "Variação % (mês anterior)",
                                    "Acumulado do ano", "Média mensal", "Meta mensal", "% da meta atingida"], "TH2", 34)
    comp = [
        ("Faturamento bruto", f"{L(1+1)}{r_fat}", "=B{0}", P.CONFIG_REF["meta_fat"]),
        ("Receita líquida", None, None, None),
        ("Margem de contribuição", None, None, None),
        ("EBITDA / resultado operacional", None, None, None),
        ("Lucro líquido", None, None, P.CONFIG_REF["meta_lucro"]),
    ]
    for i, (rot, _, _, meta) in enumerate(comp):
        r = r_comp + 2 + i
        linha_dre_ref = [r_fat, r_rec_liq, r_mc, r_ebitda, r_lucro][i]
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, f'=IFERROR(INDEX($B${linha_dre_ref}:$M${linha_dre_ref},MATCH({P.CONFIG_REF["mes"]},'
                      f'{{1,2,3,4,5,6,7,8,9,10,11,12}},0)),0)', "CALC_MONEY")
        put(ws, r, 3, f'=IFERROR(INDEX($B${linha_dre_ref}:$M${linha_dre_ref},MATCH({P.CONFIG_REF["mes"]}-1,'
                      f'{{1,2,3,4,5,6,7,8,9,10,11,12}},0)),0)', "CALC_MONEY")
        put(ws, r, 4, f'=IF($C{r}=0,"",$B{r}/$C{r}-1)', "CALC_PCT")
        put(ws, r, 5, f'=SUMIF($B$4:$M$4,"<="&IF({P.CONFIG_REF["mes"]}=0,12,{P.CONFIG_REF["mes"]}),'
                      f'$B${linha_dre_ref}:$M${linha_dre_ref})', "CALC_MONEY")
        put(ws, r, 6, f'=IFERROR($E{r}/MAX(1,{P.CONFIG_REF["mes"]}),0)', "CALC_MONEY")
        put(ws, r, 7, f"={meta}" if meta else "", "CALC_MONEY" if meta else "CALC_TXT")
        put(ws, r, 8, f'=IF(OR($G{r}="",$G{r}=0),"",$B{r}/$G{r})', "CALC_PCT")
    U.cf_barras(ws, f"H{r_comp+2}:H{r_comp+6}")

    # ------------------------------------------------- por categoria
    r_cat = r_comp + 10
    U.secao(ws, r_cat, "5. RECEITAS E DESPESAS POR CATEGORIA (ano de análise)", span=10)
    U.cabecalho(ws, r_cat + 1, 1, ["Categoria (subcategoria do plano de contas)", "Tipo", "Valor no ano",
                                   "% do total", "Linha do DRE"], "TH2", 30)
    r0 = r_cat + 2
    cat_rec = [p for p in PC.PLANO if p[1] in ("RECEITAS",)]
    cat_desp = [p for p in PC.PLANO if p[1] in ("CUSTOS", "DESPESAS OPERACIONAIS")]
    linhas_cat = cat_rec + cat_desp
    for i, p in enumerate(linhas_cat):
        r = r0 + i
        put(ws, r, 1, p[3], "CALC_TXT")
        put(ws, r, 2, p[1], "CALC_TXT_C")
        put(ws, r, 3, f'=SUMIFS({L_VDRE},{L_SUBCAT},$A{r},{L_ANO},{ANO})', "CALC_MONEY")
        put(ws, r, 4, f'=IF(SUM($C${r0}:$C${r0+len(linhas_cat)-1})=0,"",$C{r}/SUM($C${r0}:$C${r0+len(linhas_cat)-1}))',
            "CALC_PCT")
        put(ws, r, 5, p[7], "NOTA")
    rt = r0 + len(linhas_cat)
    ctx.dre_cat = dict(r0=r0, r1=rt - 1, corte=r0 + len(cat_rec))
    put(ws, rt, 1, "TOTAL DE RECEITAS E DESPESAS", "TOTAL_TXT")
    put(ws, rt, 3, f"=SUM($C${r0}:$C${rt-1})", "TOTAL_MONEY")
    U.cf_barras(ws, f"C{r0}:C{rt-1}")

    ch = BarChart()
    ch.type = "col"
    ch.title = "Faturamento, custos e lucro por mês"
    ch.style = 2
    dados = Reference(ws, min_col=2, max_col=13, min_row=r_fat, max_row=r_fat)
    ch.add_data(dados, from_rows=True, titles_from_data=False)
    dados2 = Reference(ws, min_col=2, max_col=13, min_row=r_lucro, max_row=r_lucro)
    ch.add_data(dados2, from_rows=True, titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=2, max_col=13, min_row=6, max_row=6))
    ch.series[0].tx = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 8, 16
    ws.add_chart(ch, f"Q{r_ini}")
    ctx.chart_fat_lucro = ch

    lc = LineChart()
    lc.title = "Margem de contribuição mensal (%)"
    lc.style = 2
    d = Reference(ws, min_col=2, max_col=13, min_row=r_marg + 3, max_row=r_marg + 3)
    lc.add_data(d, from_rows=True)
    lc.set_categories(Reference(ws, min_col=2, max_col=13, min_row=6, max_row=6))
    lc.y_axis.numFmt = '0%'
    lc.height, lc.width = 8, 16
    ws.add_chart(lc, f"Q{r_ini+18}")
    ctx.chart_mc = lc

    ch2 = BarChart()
    ch2.type = "bar"
    ch2.title = "Despesas por categoria (ano)"
    ch2.style = 2
    ref = Reference(ws, min_col=3, min_row=r0 + len(cat_rec), max_row=r0 + len(linhas_cat) - 1)
    cat = Reference(ws, min_col=1, min_row=r0 + len(cat_rec), max_row=r0 + len(linhas_cat) - 1)
    ch2.add_data(ref, titles_from_data=False)
    ch2.set_categories(cat)
    ch2.legend = None
    ch2.y_axis.numFmt = 'R$ #,##0'
    ch2.height, ch2.width = 10, 16
    ws.add_chart(ch2, f"Q{r_ini+36}")
    ctx.chart_desp_cat = ch2
    U.preparar(ws, freeze="B7", tab_cor=E.NAVY, area_impressao=f"A1:O{rt+2}")
    ctx.dre = ws
    return ws


# ==========================================================================
# ORÇAMENTO X REALIZADO
# ==========================================================================
def orcamento(wb, ctx):
    ws = wb.create_sheet(P.ABA_ORC)
    U.larguras(ws, {"A": 44, "B": 12, **{L(c): 12 for c in range(3, 16)}, "P": 14, "Q": 14,
                    **{L(c): 12 for c in range(18, 31)}, "AE": 14, "AF": 14, "AG": 13, "AH": 26})
    U.titulo(ws, 1, "ORÇAMENTO X REALIZADO — PLANEJAMENTO E CONTROLE",
             "Defina o orçamento mensal de cada categoria (colunas amarelas). O realizado é calculado "
             "automaticamente pela competência dos lançamentos, com alertas de estouro.", span=10)
    U.mesclar(ws, "A3:AH3",
              "Como usar: preencha o orçamento de janeiro a dezembro de cada categoria. O sistema compara com "
              "o realizado, calcula a diferença, o % consumido e emite alertas "
              "(🔴 estourou / 🟡 acima de 90% / 🟢 dentro do orçamento). ⚠ O orçamento preenchido é um exemplo.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 30

    U.secao(ws, 5, "1. ORÇAMENTO ANUAL POR CATEGORIA (R$) — preencha as colunas C a N", span=10)
    cab = (["Categoria", "Grupo"] + [f"Orç {m:02d}" for m in range(1, 13)] + ["Total orçado"] +
           [f"Real {m:02d}" for m in range(1, 13)] + ["Total realizado", "Diferença", "% realizado",
                                                      "Status do orçamento"])
    U.cabecalho(ws, 6, 1, cab, "TH", 40)
    categorias = [c for c in D.ORCAMENTO_BASE.keys()]
    grupos = {p[3]: p[1] for p in PC.PLANO}
    for i, cat in enumerate(categorias):
        r = 7 + i
        put(ws, r, 1, cat, "CALC_TXT")
        put(ws, r, 2, grupos.get(cat, "—"), "CALC_TXT_C")
        for m in range(1, 13):
            put(ws, r, 2 + m, D.ORCAMENTO_BASE[cat][m - 1], "IN_MONEY0")
            put(ws, r, 15 + m, f'=SUMIFS({L_VDRE},{L_SUBCAT},$A{r},{L_MES},{m},{L_ANO},{ANO})', "CALC_MONEY")
        put(ws, r, 15, f"=SUM(C{r}:N{r})", "TOTAL_MONEY")
        put(ws, r, 28, f"=SUM(P{r}:AA{r})", "TOTAL_MONEY")
        put(ws, r, 29, f"=$O{r}-$AB{r}", "TOTAL_MONEY")
        put(ws, r, 30, f'=IF($O{r}=0,"",$AB{r}/$O{r})', "CALC_PCT")
        put(ws, r, 31, f'=IF($O{r}=0,"Sem orçamento",IF($AB{r}>$O{r},"🔴 Estourou",'
                       f'IF($AB{r}>$O{r}*0.9,"🟡 Atenção (>90%)","🟢 Dentro do orçamento")))', "CALC_TXT_C")
    rt = 7 + len(categorias)
    put(ws, rt, 1, "TOTAL GERAL", "TOTAL_TXT")
    for col in list(range(3, 16)) + [15 + m for m in range(1, 13)] + [28, 29]:
        put(ws, rt, col, f"=SUM({L(col)}7:{L(col)}{rt-1})", "TOTAL_MONEY")
    put(ws, rt, 30, f'=IF($O{rt}=0,"",$AB{rt}/$O{rt})', "TOTAL_PCT")
    put(ws, rt, 31, f'=IF($O{rt}=0,"",IF($AB{rt}>$O{rt},"🔴 Estourou",IF($AB{rt}>$O{rt}*0.9,'
                    f'"🟡 Atenção (>90%)","🟢 Dentro do orçamento")))', "TOTAL_TXT")
    U.dv_decimal(ws, f"C7:N{rt-1}", "greaterThanOrEqual", "0", "Valor inválido",
                 "Informe um valor de orçamento maior ou igual a zero.")
    rng_st = f"AE7:AE{rt}"
    U.cf_contem(ws, rng_st, "Estourou", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, rng_st, "Atenção", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, rng_st, "Dentro", E.GREEN_BG, E.GREEN_TX)
    U.cf_formula(ws, f"AB7:AB{rt-1}", "=AND($O7<>0,$AB7>$O7)", None, E.RED_TX, True)
    U.cf_escala(ws, f"AD7:AD{rt-1}")

    # ------------------------------------------------- resumo mensal
    r_res = rt + 2
    U.secao(ws, r_res, "2. RESUMO MENSAL — orçado x realizado", span=10)
    U.cabecalho(ws, r_res + 1, 1, ["Mês"] + [m for m in range(1, 13)] + ["Total"], "TH2", 22)
    for m in range(1, 13):
        ws.cell(row=r_res + 1, column=1 + m).number_format = "00"
    linhas_res = [("Orçado (R$)", "orç", "CALC_MONEY"), ("Realizado (R$)", "real", "CALC_MONEY"),
                  ("Diferença (R$)", "dif", "CALC_MONEY"), ("% consumido", "pct", "CALC_PCT")]
    for i, (rot, tipo, est) in enumerate(linhas_res):
        r = r_res + 2 + i
        put(ws, r, 1, rot, "CALC_TXT")
        for m in range(1, 13):
            col_letra = L(1 + m)

            if tipo == "orç":
                # a coluna de orçamento do mês m é C..N (2+m), enquanto o painel mensal usa B..M
                ref_orc = f"{L(2 + m)}7:{L(2 + m)}{rt-1}"
                put(ws, r, 1 + m, f"=SUM({ref_orc})", "CALC_MONEY")
            elif tipo == "real":
                ref_real = f"{L(15+m)}7:{L(15+m)}{rt-1}"
                put(ws, r, 1 + m, f"=SUM({ref_real})", "CALC_MONEY")
            elif tipo == "dif":
                put(ws, r, 1 + m, f'={col_letra}{r_res+2}-{col_letra}{r_res+3}', "CALC_MONEY")
            else:
                put(ws, r, 1 + m, f'=IF({col_letra}{r_res+2}=0,"",{col_letra}{r_res+3}/{col_letra}{r_res+2})',
                    "CALC_PCT")
        put(ws, r, 14, f'=SUM(B{r}:M{r})' if tipo != "pct" else f'=IF($N{r_res+2}=0,"",$N{r_res+3}/$N{r_res+2})',
            "TOTAL_MONEY" if tipo != "pct" else "TOTAL_PCT")
    r_pct = r_res + 5
    U.cf_formula(ws, f"B{r_pct}:N{r_pct}", f'=B{r_pct}>1', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, f"B{r_pct}:N{r_pct}", f'=AND(B{r_pct}>0.9,B{r_pct}<=1)', E.YEL_BG, E.YEL_TX)
    U.cf_escala(ws, f"B{r_res+3}:N{r_res+3}")

    # ------------------------------------------------- alertas
    r_al = r_pct + 2
    U.secao(ws, r_al, "3. ALERTAS DE ORÇAMENTO — categorias que exigem ação", span=10)
    U.cabecalho(ws, r_al + 1, 1, ["Categoria", "Orçado (ano)", "Realizado (ano)", "Diferença",
                                  "% consumido", "Status"], "TH2", 28)
    r0 = r_al + 2
    for i, cat in enumerate(categorias):
        r = r0 + i
        put(ws, r, 1, f"=$A${7+i}", "CALC_TXT")
        put(ws, r, 2, f"=$O${7+i}", "CALC_MONEY")
        put(ws, r, 3, f"=$AB${7+i}", "CALC_MONEY")
        put(ws, r, 4, f"=$B{r}-$C{r}", "CALC_MONEY")
        put(ws, r, 5, f'=IF($B{r}=0,"",$C{r}/$B{r})', "CALC_PCT")
        put(ws, r, 6, f'=IF($B{r}=0,"Sem orçamento",IF($C{r}>$B{r},"🔴 Estourou o orçamento",'
                      f'IF($C{r}>$B{r}*0.9,"🟡 Consumiu mais de 90%","🟢 Dentro do orçamento")))', "CALC_TXT_C")
    rt2 = r0 + len(categorias)
    U.cf_contem(ws, f"F{r0}:F{rt2-1}", "Estourou", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"F{r0}:F{rt2-1}", "90%", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"F{r0}:F{rt2-1}", "Dentro", E.GREEN_BG, E.GREEN_TX)
    U.cf_barras(ws, f"E{r0}:E{rt2-1}")

    ch = BarChart()
    ch.type = "col"
    ch.grouping = "clustered"
    ch.title = "Orçado x Realizado por mês"
    ch.style = 2
    d = Reference(ws, min_col=2, max_col=13, min_row=r_res + 2, max_row=r_res + 3)
    ch.add_data(d, titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=2, max_col=13, min_row=r_res + 1, max_row=r_res + 1))
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 9, 17
    ws.add_chart(ch, f"A{rt2+2}")
    ctx.chart_orc = ch
    U.preparar(ws, freeze="C7", tab_cor="ED7D31", area_impressao=f"A1:AF{rt+2}")
    ctx.orc_rows = (r_res + 2, r_res + 3)
    ctx.orc_status = f"'{P.ABA_ORC}'!$AE$7:$AE${rt-1}"
    ctx.orc_fim = rt
    ctx.orcamento = ws
    return ws


# ==========================================================================
# EMPRÉSTIMOS E FINANCIAMENTOS
# ==========================================================================
def _price(valor, taxa, nparc):
    """Parcela fixa do sistema PRICE — fórmula algébrica (sem PMT), compatível com Excel e Sheets."""
    return (f'({valor}*{taxa}*(1+{taxa})^{nparc}/((1+{taxa})^{nparc}-1))')


def _ebitda_ano():
    """EBITDA do ano = faturamento - impostos - devoluções - custos variáveis - despesas fixas."""
    def s_(linha):
        return (f'SUMIFS({L_VDRE},{L_LINHA},"{linha}",{L_ANO},{ANO})')
    return f'({s_("Faturamento Bruto")}-{s_("Impostos sobre Vendas")}-{s_("Devoluções")}-'\
           f'{s_("Custos Variáveis")}-{s_("Despesas Fixas")})'


def _cards4(ws, row, cards, span=2):
    """Cartões de KPI com nota: lista de (rótulo, fórmula, estilo, nota)."""
    col = 1
    for rot, f, est, nota in cards:
        U.cartao(ws, row, col, span, rot, f, est, nota, altura_label=28, altura_valor=30)
        col += span
    return row + 3


def emprestimos(wb, ctx):
    ws = wb.create_sheet(P.ABA_EMP)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 10, "B": 28, "C": 20, "D": 20, "E": 16, "F": 16, "G": 12, "H": 11, "I": 11,
                    "J": 13, "K": 15, "L": 15, "M": 26, "N": 16, "O": 13, "P": 13, "Q": 16, "R": 15})
    U.titulo(ws, 1, "EMPRÉSTIMOS E FINANCIAMENTOS — CONTROLE, CRONOGRAMA E SIMULAÇÃO (SAC e PRICE)",
             "Cadastre os contratos e acompanhe parcela, juros, amortização e saldo devedor com cronograma "
             "automático (SAC ou PRICE). Inclui simulador comparativo e indicadores de endividamento.", span=12)
    U.mesclar(ws, "A3:R3",
              "Como usar: 1) cadastre cada contrato nas células amarelas (valor, taxa mensal, nº de parcelas, "
              "sistema SAC ou PRICE e data da 1ª parcela); 2) o cronograma, os indicadores de saldo devedor e "
              "o simulador são calculados automaticamente. ⚠ Os três contratos preenchidos são dados de exemplo.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 26

    ini, fim = P.EMPR_INI, P.EMPR_FIM
    n_parc = P.PARCELAS_POR_CONTRATO
    n_contr = 6                                   # 3 de exemplo + 3 vazios
    fat_bruto = f'SUMIFS({L_VDRE},{L_LINHA},"Faturamento Bruto",{L_ANO},{ANO})'
    rl_ano = (f'{fat_bruto}-SUMIFS({L_VDRE},{L_LINHA},"Impostos sobre Vendas",{L_ANO},{ANO})'
              f'-SUMIFS({L_VDRE},{L_LINHA},"Devoluções",{L_ANO},{ANO})')
    ebitda = _ebitda_ano()

    # --------------------------------------------------------------- âncoras
    r_ind = fim + 2                    # 17
    r_c1 = r_ind + 1                   # 18  (valores na linha 19)
    r_c2 = r_c1 + 3                    # 21
    r_c3 = r_c2 + 3                    # 24
    r_nota = r_c3 + 3                  # 27
    r_sim = r_nota + 2                 # 29
    r_ent = r_sim + 2                  # 31  (3 entradas: 31, 32, 33)
    r_tab = r_sim + 6                  # 35  (cabeçalho; linhas 36 a 40)
    r_cron = r_tab + 8                 # 43
    r_cab_cron = r_cron + 2            # 45
    r0 = r_cab_cron + 1                # 46
    r1 = r0 + n_contr * n_parc - 1     # 405
    r_tot = r1 + 1                     # 406
    r_srv = r_tot + 2                  # 408
    r_srv0 = r_srv + 2                 # 410
    r_srv_fim = r_srv0 + 11            # 421

    CRON_A = f"$A${r0}:$A${r1}"
    CRON_C = f"$C${r0}:$C${r1}"
    CRON_D = f"$D${r0}:$D${r1}"
    CRON_E = f"$E${r0}:$E${r1}"
    CRON_F = f"$F${r0}:$F${r1}"
    CRON_G = f"$G${r0}:$G${r1}"
    CRON_H = f"$H${r0}:$H${r1}"
    CRON_I = f"$I${r0}:$I${r1}"
    CRON_J = f"$J${r0}:$J${r1}"

    # ------------------------------------------------------------------ cadastro
    U.secao(ws, 4, "1. CADASTRO DOS CONTRATOS (preencha as células amarelas)", span=12, altura=20)
    cab = ["Nº", "Instituição / credor", "Contrato", "Modalidade", "Valor contratado",
           "Data da contratação", "Taxa mensal", "Nº parcelas", "Sistema", "1ª parcela",
           "Parcela inicial", "Parcela final", "Garantia", "Status", "Parcelas vencidas",
           "Parcelas a vencer", "Saldo devedor", "Total de juros"]
    U.cabecalho(ws, ini - 1, 1, cab, "TH", 44)
    for r in range(ini, fim + 1):
        for col in range(1, 19):
            ws.cell(row=r, column=col).style = (
                "IN_TXT_C" if col in (1, 4, 9, 14) else
                "IN_TXT" if col in (2, 3, 13) else
                "IN_MONEY" if col == 5 else
                "IN_DATE" if col in (6, 10) else
                "IN_PCT" if col == 7 else
                "IN_INT" if col == 8 else "CALC_MONEY")
    for i, c in enumerate(D.CONTRATOS):
        r = ini + i
        for col, v in [(1, i + 1), (2, c["instituicao"]), (3, c["contrato"]), (4, c["modalidade"]),
                       (5, c["valor"]), (6, c["data"]), (7, c["taxa"]), (8, c["nparc"]),
                       (9, c["sistema"]), (10, c["primeira"]), (13, c["garantia"]),
                       (14, c["status"])]:
            ws.cell(row=r, column=col, value=v)
    for r in range(ini, fim + 1):
        put(ws, r, 11, f'=IF($B{r}="","",ROUND(IF($I{r}="SAC",$E{r}/$H{r}+$E{r}*$G{r},'
                       f'{_price(f"$E{r}", f"$G{r}", f"$H{r}")}),2))', "CALC_MONEY")
        put(ws, r, 12, f'=IF($B{r}="","",ROUND(IF($I{r}="SAC",$E{r}/$H{r}+($E{r}/$H{r})*$G{r},'
                       f'{_price(f"$E{r}", f"$G{r}", f"$H{r}")}),2))', "CALC_MONEY")
        put(ws, r, 15, f'=IF($B{r}="","",COUNTIFS({CRON_A},$A{r},{CRON_D},"<"&{HOJE},{CRON_C},"<="&$H{r}))',
            "CALC_INT")
        put(ws, r, 16, f'=IF($B{r}="","",COUNTIFS({CRON_A},$A{r},{CRON_D},">="&{HOJE},{CRON_C},"<="&$H{r}))',
            "CALC_INT")
        put(ws, r, 17, f'=IF($B{r}="","",SUMIFS({CRON_G},{CRON_A},$A{r},{CRON_I},'
                       f'"A vencer"))', "CALC_MONEY")
        put(ws, r, 18, f'=IF($B{r}="","",SUMIFS({CRON_F},{CRON_A},$A{r}))', "CALC_MONEY")
    U.dv_lista(ws, f"I{ini}:I{fim}", "SISTEMA_AMORTIZACAO", "Sistema inválido", "Escolha SAC ou PRICE.")
    U.dv_lista(ws, f"N{ini}:N{fim}", "STATUS_CONTRATO", "Status inválido", "Escolha um status da lista.")
    U.dv_decimal(ws, f"E{ini}:E{fim}", "greaterThan", "0", "Valor inválido",
                 "Informe o valor contratado (maior que zero).")
    U.dv_decimal(ws, f"G{ini}:G{fim}", "between", "0", "0.2", "Taxa inválida",
                 "Informe a taxa mensal (ex.: 1,4% = 0,014).")
    U.dv_inteiro(ws, f"H{ini}:H{fim}", "between", "1", "360", "Nº de parcelas inválido",
                 "Informe entre 1 e 360 parcelas.")
    U.dv_data(ws, f"F{ini}:F{fim}")
    U.dv_data(ws, f"J{ini}:J{fim}")
    U.cf_contem(ws, f"N{ini}:N{fim}", "Em dia", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, f"N{ini}:N{fim}", "atraso", E.RED_BG, E.RED_TX)

    # --------------------------------------------------------------- indicadores
    U.secao(ws, r_ind, "2. INDICADORES DE ENDIVIDAMENTO", span=12, altura=20)
    div_total = f"SUM($Q${ini}:$Q${fim})"
    _cards4(ws, r_c1, [
        ("Saldo devedor total (dívida atual)", f"={div_total}", "KPI_VALUE",
         "Principal ainda em aberto de todos os contratos"),
        ("Total de juros a pagar (contratos)", f"=SUM($R${ini}:$R${fim})", "KPI_VALUE",
         "Custo total do crédito contratado"),
        ("Parcelas já vencidas (qtd.)", f"=SUM($O${ini}:$O${fim})", "KPI_VALUE0",
         "Confira com os lançamentos de pagamento"),
        ("Parcelas a vencer (qtd.)", f"=SUM($P${ini}:$P${fim})", "KPI_VALUE0",
         "Compromissos futuros já contratados"),
    ])
    _cards4(ws, r_c2, [
        ("Comprometimento da receita (dívida ÷ faturamento anual)",
         f'=IFERROR({div_total}/MAX(1,{fat_bruto}),"")', "KPI_PCT",
         "Acima de 30% exige atenção"),
        ("Dívida ÷ EBITDA (anos de EBITDA para quitar)",
         f'=IFERROR({div_total}/MAX(1,{ebitda}),"")', "KPI_VALUE0",
         "Referência saudável: abaixo de 3x"),
        ("Juros do ano ÷ receita líquida",
         f'=IFERROR(SUMIFS({L_VDRE},{L_LINHA},"Despesas Financeiras",{L_ANO},{ANO})/'
         f'MAX(1,{rl_ano}),"")', "KPI_PCT",
         "Quanto o crédito consome do faturamento"),
        ("Custo médio ponderado da dívida (a.m.)",
         f'=IFERROR(SUMPRODUCT(($B${ini}:$B${fim}<>"")*$E${ini}:$E${fim}*$G${ini}:$G${fim})/'
         f'MAX(0.01,SUM($E${ini}:$E${fim})),"")', "KPI_PCT",
         "Taxa média mensal dos contratos"),
    ])
    _cards4(ws, r_c3, [
        ("Parcelas dos próximos 12 meses (principal + juros)",
         f'=SUMIFS({CRON_E},{CRON_D},">="&{HOJE},{CRON_D},"<="&EDATE({HOJE},12))', "KPI_VALUE",
         "Programe o caixa para estes compromissos"),
        ("Parcela média dos próximos 12 meses",
         f'=IFERROR(SUMIFS({CRON_E},{CRON_D},">="&{HOJE},{CRON_D},"<="&EDATE({HOJE},12))/'
         f'MAX(1,COUNTIFS({CRON_D},">="&{HOJE},{CRON_D},"<="&EDATE({HOJE},12))),"")', "KPI_VALUE",
         "Valor médio mensal do serviço da dívida"),
        ("Contratos ativos", f'=COUNTIF($N${ini}:$N${fim},"Em andamento")', "KPI_VALUE0",
         "Contratos em acompanhamento"),
        ("Contratos em atraso", f'=COUNTIF($N${ini}:$N${fim},"Em atraso")', "KPI_VALUE0",
         "Renegocie antes que virem inadimplência"),
    ])
    U.mesclar(ws, f"A{r_nota}:L{r_nota}",
              "Leitura gerencial: comprometimento da receita acima de 30% e dívida acima de 3x o EBITDA "
              "indicam necessidade de renegociação. O custo médio ponderado mostra quanto a empresa paga, "
              "em média, por mês sobre o capital tomado.", "NOTA_WRAP")
    ws.row_dimensions[r_nota].height = 30

    # ------------------------------------------------------------ simulador
    U.mesclar(ws, f"A{r_sim}:L{r_sim}", "3. SIMULADOR — COMPARATIVO SAC x PRICE PARA UM NOVO CRÉDITO",
              "SECAO")
    ws.row_dimensions[r_sim].height = 20
    U.mesclar(ws, f"A{r_sim+1}:L{r_sim+1}",
              "Preencha as células amarelas (valor, taxa mensal e prazo) e compare os dois sistemas de "
              "amortização. O simulador não lança nada na planilha — é apenas uma análise.", "NOTA_WRAP")
    ws.row_dimensions[r_sim + 1].height = 24
    entradas = [
        ("Valor do crédito simulado (R$)", 50000.0, "IN_MONEY", E.FMT_MONEY),
        ("Taxa de juros mensal", 0.015, "IN_PCT", E.FMT_PCT),
        ("Prazo (nº de parcelas mensais)", 24, "IN_INT", E.FMT_INT),
    ]
    for i, (rot, val, est, fmt) in enumerate(entradas):
        rr = r_ent + i
        put(ws, rr, 1, rot, "CALC_TXT")
        put(ws, rr, 3, val, est, fmt)
    cV = f"$C${r_ent}"
    cI = f"$C${r_ent+1}"
    cP = f"$C${r_ent+2}"
    U.dv_decimal(ws, f"C{r_ent}", "greaterThan", "0", "Valor inválido",
                 "Informe o valor do crédito simulado.")
    U.dv_decimal(ws, f"C{r_ent+1}", "between", "0", "0.2", "Taxa inválida",
                 "Informe a taxa mensal (ex.: 1,5% = 0,015).")
    U.dv_inteiro(ws, f"C{r_ent+2}", "between", "1", "360", "Prazo inválido",
                 "Informe o prazo em meses (1 a 360).")
    U.cabecalho(ws, r_tab, 1, ["Indicador da simulação", "Sistema", "Resultado (SAC)", "Sistema",
                               "Resultado (PRICE)", "Como é calculado"], "TH2", 24)
    r_juros = r_tab + 3
    pr = _price(cV, cI, cP)
    sim = [
        ("1ª parcela (maior parcela)", f"=ROUND({cV}/{cP}+{cV}*{cI},2)",
         f"=ROUND({pr},2)",
         "No SAC a parcela é amortização constante + juros (maior no início). No PRICE a parcela é fixa."),
        ("Última parcela (menor parcela)", f"=ROUND({cV}/{cP}+({cV}/{cP})*{cI},2)",
         f"=ROUND({pr},2)",
         "No SAC a parcela cai mês a mês; no PRICE ela é sempre a mesma."),
        ("Total de juros pagos", f"=ROUND({cV}*{cI}*({cP}+1)/2,2)",
         f"=ROUND({pr}*{cP}-{cV},2)",
         "Soma de todos os juros do contrato — é o custo efetivo do crédito."),
        ("Total pago (principal + juros)", f"=ROUND({cV}+{cV}*{cI}*({cP}+1)/2,2)",
         f"=ROUND({pr}*{cP},2)",
         "Desembolso total até a quitação do contrato."),
    ]
    for i, (rot, fsac, fprice, como) in enumerate(sim):
        rr = r_tab + 1 + i
        put(ws, rr, 1, rot, "CALC_TXT")
        put(ws, rr, 2, "SAC", "CALC_TXT_C")
        put(ws, rr, 3, fsac, "CALC_MONEY")
        put(ws, rr, 4, "PRICE", "CALC_TXT_C")
        put(ws, rr, 5, fprice, "CALC_MONEY")
        put(ws, rr, 6, como, "NOTA")
    rr = r_tab + 5
    put(ws, rr, 1, "Sistema com menor juros total", "CALC_TXT")
    put(ws, rr, 3, f'=IF($C${r_juros}<$E${r_juros},"SAC — economiza "&'
                   f'TEXT($E${r_juros}-$C${r_juros},"#.##0,00")&" em juros",'
                   f'"PRICE — economiza "&TEXT($C${r_juros}-$E${r_juros},"#.##0,00")&" em juros")',
        "CALC_TXT")
    put(ws, rr, 6, "Compara o total de juros: o sistema mais barato economiza o valor indicado.", "NOTA")
    ctx.emp_sim = (r_sim, r_tab)

    # ------------------------------------------------------------- cronograma
    U.mesclar(ws, f"A{r_cron}:R{r_cron}",
              "4. CRONOGRAMA CONSOLIDADO DE PARCELAS (calculado automaticamente — não editar)", "SECAO")
    ws.row_dimensions[r_cron].height = 20
    U.mesclar(ws, f"A{r_cron+1}:R{r_cron+1}",
              "Cada contrato tem 60 linhas de cronograma, calculadas por SAC ou PRICE conforme o cadastro. "
              "As colunas de situação mostram o que já venceu e o que ainda está 'A vencer'.", "NOTA_WRAP")
    ws.row_dimensions[r_cron + 1].height = 22
    U.cabecalho(ws, r_cab_cron, 1,
                ["Nº contrato", "Instituição", "Parcela nº", "Vencimento", "Valor da parcela",
                 "Juros do período", "Amortização do principal", "Saldo devedor após a parcela",
                 "Situação da parcela", "Mês de referência"], "TH", 44)
    for b in range(n_contr):
        ref = ini + b
        for k in range(1, n_parc + 1):
            rr = r0 + b * n_parc + (k - 1)
            g = f'OR($B${ref}="",{k}>$H${ref})'
            ant = rr - 1
            put(ws, rr, 1, f'=IF($B${ref}="","",$A${ref})', "CALC_INT")
            put(ws, rr, 2, f'=IF($B${ref}="","",$B${ref})', "CALC_TXT")
            put(ws, rr, 3, f'=IF($B${ref}="","",{k})', "CALC_INT")
            put(ws, rr, 4, f'=IF({g},"",EDATE($J${ref},{k-1}))', "CALC_DATE")
            put(ws, rr, 5, f'=IF({g},"",IF($I${ref}="SAC",ROUND($E${ref}/$H${ref}+$F{rr},2),'
                           f'ROUND({_price(f"$E${ref}", f"$G${ref}", f"$H${ref}")},2)))', "CALC_MONEY")
            if k == 1:
                put(ws, rr, 6, f'=IF({g},"",ROUND($E${ref}*$G${ref},2))', "CALC_MONEY")
                put(ws, rr, 8, f'=IF({g},"",ROUND($E${ref}-$G{rr},2))', "CALC_MONEY")
            else:
                put(ws, rr, 6, f'=IF({g},"",ROUND($H{ant}*$G${ref},2))', "CALC_MONEY")
                put(ws, rr, 8, f'=IF({g},"",ROUND(MAX(0,$H{ant}-$G{rr}),2))', "CALC_MONEY")
            put(ws, rr, 7, f'=IF({g},"",IF($I${ref}="SAC",ROUND($E${ref}/$H${ref},2),'
                           f'ROUND($E{rr}-$F{rr},2)))', "CALC_MONEY")
            put(ws, rr, 9, f'=IF({g},"",IF($D{rr}<={HOJE},"Vencida","A vencer"))', "CALC_TXT_C")
            put(ws, rr, 10, f'=IF($D{rr}="","",EOMONTH($D{rr},0))', "CALC_DATE")
    put(ws, r_tot, 1, "TOTAIS DOS CRONOGRAMAS", "TOTAL_TXT")
    for col in (5, 6, 7):
        put(ws, r_tot, col, f"=SUM({L(col)}{r0}:{L(col)}{r1})", "TOTAL_MONEY")
    put(ws, r_tot, 8, f"=SUM($Q${ini}:$Q${fim})", "TOTAL_MONEY")
    U.cf_contem(ws, f"I{r0}:I{r1}", "A vencer", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, f"I{r0}:I{r1}", "Vencida", E.YEL_BG, E.YEL_TX)
    U.cf_barras(ws, f"H{r0}:H{r1}", E.BLUE)

    # ------------------------------------------- serviço da dívida por mês (12)
    U.mesclar(ws, f"A{r_srv}:J{r_srv}",
              "5. SERVIÇO DA DÍVIDA NOS PRÓXIMOS 12 MESES — PARCELAS, JUROS E AMORTIZAÇÃO PREVISTOS",
              "SECAO")
    ws.row_dimensions[r_srv].height = 20
    U.cabecalho(ws, r_srv + 1, 1, ["Mês", "Parcelas do mês", "Juros do mês", "Amortização do mês",
                                   "Saldo devedor no fim do mês", "% das parcelas no mês"], "TH2", 26)
    for k in range(12):
        rr = r_srv0 + k
        dm = f"EDATE({HOJE},{k})"
        ini_m = f"DATE(YEAR({dm}),MONTH({dm}),1)"
        fim_m = f"EOMONTH({dm},0)"
        put(ws, rr, 1, f'=TEXT({dm},"MM/AAAA")', "CALC_TXT_C")
        put(ws, rr, 2, f'=SUMIFS({CRON_E},{CRON_J},">="&{ini_m},{CRON_J},"<="&{fim_m})', "CALC_MONEY")
        put(ws, rr, 3, f'=SUMIFS({CRON_F},{CRON_J},">="&{ini_m},{CRON_J},"<="&{fim_m})', "CALC_MONEY")
        put(ws, rr, 4, f'=SUMIFS({CRON_G},{CRON_J},">="&{ini_m},{CRON_J},"<="&{fim_m})', "CALC_MONEY")
        put(ws, rr, 5, f'=SUMIFS({CRON_H},{CRON_J},">="&{ini_m},{CRON_J},"<="&{fim_m})', "CALC_MONEY")
        put(ws, rr, 6, f'=IFERROR($B{rr}/SUM($B${r_srv0}:$B${r_srv_fim}),"")', "CALC_PCT")
    put(ws, r_srv_fim + 1, 1, "TOTAL DOS 12 MESES", "TOTAL_TXT")
    for col in (2, 3, 4, 5):
        put(ws, r_srv_fim + 1, col, f"=SUM({L(col)}{r_srv0}:{L(col)}{r_srv_fim})", "TOTAL_MONEY")
    U.cf_barras(ws, f"B{r_srv0}:B{r_srv_fim}", E.BLUE)

    ch2 = BarChart()
    ch2.type = "bar"
    ch2.title = "Saldo devedor por contrato"
    ch2.style = 2
    ch2.add_data(Reference(ws, min_col=17, min_row=ini - 1, max_row=fim), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=2, min_row=ini, max_row=fim))
    ch2.legend = None
    ch2.y_axis.numFmt = 'R$ #,##0'
    ch2.height, ch2.width = 7, 14
    ws.add_chart(ch2, f"L{r_ind+1}")
    ctx.chart_divida_contrato = ch2

    ch3 = BarChart()
    ch3.type = "col"
    ch3.grouping = "stacked"
    ch3.overlap = 100
    ch3.title = "Serviço da dívida nos próximos 12 meses (juros + amortização)"
    ch3.style = 2
    ch3.add_data(Reference(ws, min_col=3, max_col=4, min_row=r_srv + 1, max_row=r_srv_fim),
                 titles_from_data=True)
    ch3.set_categories(Reference(ws, min_col=1, min_row=r_srv0, max_row=r_srv_fim))
    ch3.y_axis.numFmt = 'R$ #,##0'
    ch3.height, ch3.width = 8, 18
    ws.add_chart(ch3, f"L{r_srv}")

    ctx.emp_rows = (ini, fim)
    ctx.emp_rc = (r0, r1)          # cronograma consolidado (vencimento, parcela, juros, amort, saldo)
    ctx.emprestimos = ws
    U.preparar(ws, freeze=f"A{ini}", filtro=f"A{ini-1}:R{fim}", tab_cor="7030A0",
               area_impressao=f"A1:J{r_srv_fim+2}", paisagem=True)
    return ws
