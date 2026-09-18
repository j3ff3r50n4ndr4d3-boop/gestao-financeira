"""Abas CONTAS A PAGAR, CONTAS A RECEBER, INADIMPLÊNCIA e CONCILIAÇÃO BANCÁRIA."""
from openpyxl.chart import BarChart, LineChart, Reference

from lib import dados_exemplo as D
from lib import estilos as E
from lib import parametros as P
from lib import util as U
from lib.util import L, nome, put

L_TIPO = P.rng("TIPO")
L_VENC = P.rng("VENC")
L_COMP = P.rng("COMP")
L_PAGTO = P.rng("PAGTO")
L_ENT = P.rng("ENTIDADE")
L_SUBCAT = P.rng("SUBCAT")
L_CAT = P.rng("CAT")
L_CC = P.rng("CC")
L_BANCO = P.rng("BANCO")
L_DESC = P.rng("DESCRICAO")
L_VFINAL = P.rng("VFINAL")
L_SALDO = P.rng("SALDO")
L_STATUS = P.rng("STATUS")
L_VDRE = P.rng("VDRE")
L_LINHA = P.rng("LINHADRE")
L_DIASATR = P.rng("DIASATR")
L_VALXDIAS = P.rng("VALXDIAS")
L_CHAVEAP = P.rng("CHAVEAP")
L_CHAVEAR = P.rng("CHAVEAR")
L_MES = P.rng("MES")
L_ANO = P.rng("ANO")

ANO = P.CONFIG_REF["ano"]
MES = P.CONFIG_REF["mes"]
HOJE = "TODAY()"
SALDO_MIN = P.CONFIG_REF["saldo_min"]
META_FAT = P.CONFIG_REF["meta_fat"]
INAD_MAX = P.CONFIG_REF["inad_max"]
PMR_ALVO = P.CONFIG_REF["pmr_alvo"]
PMP_ALVO = P.CONFIG_REF["pmp_alvo"]
F_MES = f'IF({MES}=0,">0",{MES})'

SAIDA = f'{L_TIPO},"Saída"'
ENTRADA = f'{L_TIPO},"Entrada"'
FAIXAS_ATRASO = [("1 a 7 dias", 1, 7), ("8 a 15 dias", 8, 15), ("16 a 30 dias", 16, 30),
                 ("31 a 60 dias", 31, 60), ("61 a 90 dias", 61, 90), ("Mais de 90 dias", 91, 99999)]


def _cards(ws, linha, cards, span=2, altura=(26, 30, 16)):
    col = 1
    for rot, f, est, nota in cards:
        U.cartao(ws, linha, col, span, rot, f, est, nota,
                 altura_label=altura[0], altura_valor=altura[1])
        col += span
    ws.row_dimensions[linha + 2].height = altura[2]
    return linha + 3


def _cab(ws, linha, cols, altura=30):
    U.cabecalho(ws, linha, 1, cols, "TH", altura)


# ==========================================================================
# CONTAS A PAGAR
# ==========================================================================
def contas_pagar(wb, ctx):
    ws = wb.create_sheet(P.ABA_AP)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 12, "B": 34, "C": 42, "D": 24, "E": 24, "F": 16, "G": 16, "H": 13, "I": 14,
                    "J": 16, "K": 14, "L": 14, "M": 14, "N": 14, "O": 34})
    U.titulo(ws, 1, "CONTAS A PAGAR (FORNECEDORES) — O QUE A EMPRESA DEVE",
             "Visão gerencial das saídas em aberto, com classificação automática por vencimento, aging de "
             "atrasos e priorização de pagamentos. Alimentada pela aba LANÇAMENTOS.", span=10)
    U.mesclar(ws, "A3:O3",
              "⚠ DADOS DE EXEMPLO. Cada título é um lançamento de saída na aba LANÇAMENTOS; esta aba apenas "
              "organiza, classifica e prioriza automaticamente. As classificações usam a data de hoje (HOJE).",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 24

    # ------------------------------------------------------------ indicadores
    U.secao(ws, 5, "1. INDICADORES DE CONTAS A PAGAR", span=10, altura=20)
    cards = [
        ("Total em aberto", f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0")', "KPI_VALUE",
         "Soma dos títulos ainda não pagos"),
        ("Total vencido", f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})', "KPI_VALUE",
         "Prioridade máxima de pagamento"),
        ("Vence hoje", f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},"="&{HOJE})', "KPI_VALUE",
         "Precisa ser pago hoje"),
        ("Próximos 7 dias", f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},">"&{HOJE},'
                            f'{L_VENC},"<="&{HOJE}+7)', "KPI_VALUE", "Compromissos da semana"),
    ]
    _cards(ws, 6, cards, span=2)
    cards = [
        ("Próximos 30 dias", f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},">"&{HOJE}+7,'
                             f'{L_VENC},"<="&{HOJE}+30)', "KPI_VALUE", "Compromissos do mês"),
        ("Pago no mês de análise", f'=SUMIFS({L_VFINAL},{SAIDA},{L_PAGTO},">="&DATE({ANO},{F_MES},1),'
                                   f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{F_MES},1),0))', "KPI_VALUE",
         "Saídas liquidadas no mês"),
        ("Total pago no ano", f'=SUMIFS({L_VFINAL},{SAIDA},{L_PAGTO},">="&DATE({ANO},1,1),'
                              f'{L_PAGTO},"<="&DATE({ANO},12,31))', "KPI_VALUE", "Ano de análise"),
        ("Títulos vencidos (qtd.)", f'=COUNTIFS({SAIDA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})',
         "KPI_VALUE0", "Quantidade em atraso"),
    ]
    _cards(ws, 9, cards, span=2)

    # ------------------------------------------------- classificação por vencimento
    r0 = 13
    U.secao(ws, r0, "2. CLASSIFICAÇÃO AUTOMÁTICA POR VENCIMENTO (situação de cada título)", span=8, altura=20)
    _cab(ws, r0 + 1, ["Situação", "Valor", "Qtd. títulos", "% do total em aberto",
                      "Como o sistema classifica"])
    situacoes = [
        ("Vencido", f'{L_SALDO},">0",{L_VENC},"<"&{HOJE}', "Vencimento anterior a hoje e ainda em aberto"),
        ("Vence hoje", f'{L_SALDO},">0",{L_VENC},"="&{HOJE}', "Vencimento igual à data de hoje"),
        ("Vence em 7 dias", f'{L_SALDO},">0",{L_VENC},">"&{HOJE},{L_VENC},"<="&{HOJE}+7',
         "Vence nos próximos 7 dias"),
        ("Vence em 30 dias", f'{L_SALDO},">0",{L_VENC},">"&{HOJE}+7,{L_VENC},"<="&{HOJE}+30',
         "Vence entre 8 e 30 dias"),
        ("Futuro (mais de 30 dias)", f'{L_SALDO},">0",{L_VENC},">"&{HOJE}+30', "Vence em mais de 30 dias"),
        ("Pago / liquidado", f'{L_SALDO},"=0",{L_STATUS},"Pago"', "Já pago (valor realizado informado)"),
        ("Cancelado", f'{L_STATUS},"Cancelado"', "Lançamento cancelado — não afeta o caixa"),
    ]
    r_sit = r0 + 2
    for i, (rot, crit, explic) in enumerate(situacoes):
        r = r_sit + i
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, f'=SUMIFS({L_SALDO},{SAIDA},{crit})', "CALC_MONEY")
        put(ws, r, 3, f'=COUNTIFS({SAIDA},{crit})', "CALC_INT")
        put(ws, r, 4, f'=IF(SUM($B${r_sit}:$B${r_sit+4})=0,"",$B{r}/SUM($B${r_sit}:$B${r_sit+4}))', "CALC_PCT")
        put(ws, r, 5, explic, "NOTA")
    r_sit_fim = r_sit + len(situacoes) - 1
    put(ws, r_sit_fim + 1, 1, "TOTAL EM ABERTO (vencido + a vencer)", "TOTAL_TXT")
    put(ws, r_sit_fim + 1, 2, f"=SUM($B${r_sit}:$B${r_sit+4})", "TOTAL_MONEY")
    put(ws, r_sit_fim + 1, 3, f"=SUM($C${r_sit}:$C${r_sit+4})", "TOTAL_INT")
    put(ws, r_sit_fim + 1, 4, '=IF($B{0}=0,"",1)'.format(r_sit_fim + 1), "TOTAL_PCT")
    ctx.ap_faixa = (r_sit, r_sit + 4)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Vencido", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Vence", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Pago", E.GREEN_BG, E.GREEN_TX)

    # ------------------------------------------------------------------- aging
    r_ag = r_sit_fim + 3
    U.secao(ws, r_ag, "3. AGING — TÍTULOS ATRASADOS POR FAIXA DE DIAS", span=8, altura=20)
    _cab(ws, r_ag + 1, ["Faixa de atraso", "Valor em aberto", "Qtd. títulos", "% do vencido",
                        "Menor atraso", "Maior atraso", "Prioridade de pagamento"])
    r_ag0 = r_ag + 2
    acoes = ["Pagar imediatamente (já com juros)",
             "Pagar nesta semana",
             "Programar para a próxima semana",
             "Negociar prazo ou parcelar",
             "Renegociar/rever contrato",
             "Risco de negativação — ação urgente"]
    for i, (faixa, de, ate) in enumerate(FAIXAS_ATRASO):
        r = r_ag0 + i
        crit = f'{L_DIASATR},">="&{de},{L_DIASATR},"<="&{ate}'
        put(ws, r, 1, faixa, "CALC_TXT")
        put(ws, r, 2, f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{crit})', "CALC_MONEY")
        put(ws, r, 3, f'=COUNTIFS({SAIDA},{L_SALDO},">0",{crit})', "CALC_INT")
        put(ws, r, 4, f'=IF(SUM($B${r_ag0}:$B${r_ag0+5})=0,"",$B{r}/SUM($B${r_ag0}:$B${r_ag0+5}))', "CALC_PCT")
        put(ws, r, 5, de, "CALC_INT")
        put(ws, r, 6, "90+" if ate > 9999 else ate, "CALC_TXT_C")
        put(ws, r, 7, acoes[i], "NOTA")
    r_ag_fim = r_ag0 + len(FAIXAS_ATRASO)
    put(ws, r_ag_fim, 1, "TOTAL VENCIDO", "TOTAL_TXT")
    put(ws, r_ag_fim, 2, f"=SUM($B${r_ag0}:$B${r_ag_fim-1})", "TOTAL_MONEY")
    put(ws, r_ag_fim, 3, f"=SUM($C${r_ag0}:$C${r_ag_fim-1})", "TOTAL_INT")
    U.cf_barras(ws, f"B{r_ag0}:B{r_ag_fim-1}", E.BLUE)
    U.cf_contem(ws, f"G{r_ag0}:G{r_ag_fim-1}", "imediatamente", E.RED_BG, E.RED_TX)

    # -------------------------------------------------- próximos vencimentos
    r_px = r_ag_fim + 2
    U.secao(ws, r_px, "4. PRÓXIMOS VENCIMENTOS — 20 TÍTULOS MAIS URGENTES (ordem cronológica)", span=9,
            altura=20)
    _cab(ws, r_px + 1, ["Vencimento", "Fornecedor", "Descrição", "Categoria", "Subcategoria", "Situação",
                        "Valor em aberto", "Dias p/ vencer", "Chave (ordem)"])
    r_px0 = r_px + 2
    N = 20
    for i in range(N):
        r = r_px0 + i
        ch = f'$I{r}'
        put(ws, r, 9, f'=IFERROR(SMALL({L_CHAVEAP},{i+1}),"")', "CALC_TXT_C")
        campos = [(1, "VENC", "CALC_DATE"), (2, "ENTIDADE", "CALC_TXT"), (3, "DESCRICAO", "CALC_TXT"),
                  (4, "CAT", "CALC_TXT_C"), (5, "SUBCAT", "CALC_TXT"), (6, "SITUACAO", "CALC_TXT_C"),
                  (7, "SALDO", "CALC_MONEY"), (8, "DIASVENC", "CALC_INT")]
        for col, nome_col, est in campos:
            put(ws, r, col, f'=IF({ch}="","",INDEX({P.rng(nome_col)},MATCH({ch},{L_CHAVEAP},0)))', est)
    r_px_fim = r_px0 + N - 1
    put(ws, r_px_fim + 1, 1, "TOTAL DOS 20 TÍTULOS", "TOTAL_TXT")
    put(ws, r_px_fim + 1, 7, f"=SUM($G${r_px0}:$G${r_px_fim})", "TOTAL_MONEY")
    ws.column_dimensions["I"].hidden = True
    U.cf_formula(ws, f"F{r_px0}:F{r_px_fim}", f'=$F{r_px0}="Vencido"', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, f"F{r_px0}:F{r_px_fim}", f'=$F{r_px0}="Vence hoje"', E.YEL_BG, E.YEL_TX, True)
    U.mesclar(ws, f"A{r_px_fim+2}:O{r_px_fim+2}",
              "A coluna 'Situação' é classificada automaticamente pela data de vencimento e a coluna "
              "'Dias p/ vencer' mostra quantos dias faltam (negativo = atrasado).", "NOTA_WRAP")

    # -------------------------------------------------------- por fornecedor
    r_fn = r_px_fim + 4
    U.secao(ws, r_fn, "5. CONTAS A PAGAR POR FORNECEDOR (cadastro da aba CADASTRO DE FORNECEDORES)",
            span=8, altura=20)
    _cab(ws, r_fn + 1, ["Fornecedor", "Em aberto", "Vencido", "A vencer", "Pago no ano",
                        "% do total em aberto", "Qtd. títulos em aberto"])
    r_fn0 = r_fn + 2
    for i in range(P.FORN_FIM - P.FORN_INI + 1):
        r = r_fn0 + i
        ref = P.FORN_INI + i
        f = f"'{P.ABA_FORN}'!$B${ref}"
        put(ws, r, 1, f'={f}', "CALC_TXT")
        put(ws, r, 2, f'=IF({f}="","",SUMIFS({L_SALDO},{L_ENT},{f},{SAIDA},{L_SALDO},">0"))',
            "CALC_MONEY")
        put(ws, r, 3, f'=IF({f}="","",SUMIFS({L_SALDO},{L_ENT},{f},{SAIDA},{L_SALDO},">0",'
                      f'{L_VENC},"<"&{HOJE}))', "CALC_MONEY")
        put(ws, r, 4, f'=IF({f}="","",$B{r}-$C{r})', "CALC_MONEY")
        put(ws, r, 5, f'=IF({f}="","",SUMIFS({L_VFINAL},{L_ENT},{f},{SAIDA},{L_PAGTO},">="&'
                      f'DATE({ANO},1,1),{L_PAGTO},"<="&DATE({ANO},12,31)))', "CALC_MONEY")
        put(ws, r, 6, f'=IFERROR($B{r}/SUM($B${r_fn0}:$B${r_fn0+P.FORN_FIM-P.FORN_INI}),"")',
            "CALC_PCT")
        put(ws, r, 7, f'=IF({f}="","",COUNTIFS({L_ENT},{f},{SAIDA},{L_SALDO},">0"))', "CALC_INT")
    r_fn_fim = r_fn0 + (P.FORN_FIM - P.FORN_INI)
    put(ws, r_fn_fim + 1, 1, "TOTAL", "TOTAL_TXT")
    for col in (2, 3, 4, 5, 7):
        put(ws, r_fn_fim + 1, col, f"=SUM({L(col)}{r_fn0}:{L(col)}{r_fn_fim})", "TOTAL_MONEY")
    U.cf_barras(ws, f"B{r_fn0}:B{r_fn_fim}", E.BLUE)

    # ------------------------------------------------------------ indicadores de prazo
    r_pr = r_fn_fim + 3
    U.secao(ws, r_pr, "6. PRAZOS E COMPROMETIMENTO", span=8, altura=20)
    _cab(ws, r_pr + 1, ["Indicador", "Valor", "Meta / referência", "Leitura"], altura=22)
    indicadores = [
        ("Prazo médio de pagamento real (dias)",
         f'=IFERROR(SUMIFS({L_VALXDIAS},{SAIDA})/SUMIFS({L_VFINAL},{SAIDA}),"")', "CALC_INT",
         f'={PMP_ALVO}', "Média ponderada dos dias entre a competência e o pagamento efetivo."),
        ("Prazo médio concedido pelos fornecedores (dias)",
         f'=IFERROR((SUMIFS({L_VENC},{SAIDA},{L_SALDO},">0")-SUMIFS({L_COMP},{SAIDA},{L_SALDO},">0"))/'
         f'MAX(1,COUNTIFS({SAIDA},{L_SALDO},">0")),"")', "CALC_INT",
         "—", "Média de dias entre a competência e o vencimento dos títulos em aberto."),
        ("Saídas previstas para os próximos 7 dias",
         f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},">="&{HOJE},{L_VENC},"<="&{HOJE}+7)',
         "CALC_MONEY", "—", "Comparar com o caixa disponível e com os recebimentos da semana."),
        ("Saídas previstas para os próximos 30 dias",
         f'=SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},">="&{HOJE},{L_VENC},"<="&{HOJE}+30)',
         "CALC_MONEY", "—", "Planeje o fluxo de caixa do mês."),
        ("Saldo de caixa disponível hoje",
         f"=SUM('{P.ABA_BANCOS}'!$G${P.BANCO_INI}:$G${P.BANCO_FIM})+SUMIFS({L_VFINAL},{L_TIPO},"
         f'"Entrada",{L_PAGTO},"<="&{HOJE})-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<="&{HOJE})',
         "CALC_MONEY", "—", "Caixa atual para honrar os compromissos."),
        ("Cobertura do caixa (próximos 30 dias)",
         f'=IFERROR(SUMIFS({L_SALDO},{SAIDA},{L_SALDO},">0",{L_VENC},">="&{HOJE},{L_VENC},"<="&{HOJE}+30)/'
         f'$B${r_pr+6},"")', "CALC_PCT", "—",
         "Quanto das saídas de 30 dias o caixa cobre. Abaixo de 1,0 exige antecipação de recebíveis."),
    ]
    for i, (rot, f, est, meta, leitura) in enumerate(indicadores):
        r = r_pr + 2 + i
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, f, est)
        put(ws, r, 3, meta, "CALC_INT" if est == "CALC_INT" else "CALC_MONEY")
        U.mesclar(ws, f"D{r}:O{r}", leitura, "NOTA")
    U.cf_formula(ws, f"B{r_pr+7}", f'=B{r_pr+7}<1', E.RED_BG, E.RED_TX, True)

    ch = BarChart()
    ch.type = "bar"
    ch.title = "Contas a pagar por fornecedor (em aberto)"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=2, min_row=r_fn0, max_row=r_fn0 + 14), titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=1, min_row=r_fn0, max_row=r_fn0 + 14))
    ch.legend = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 9, 17
    ws.add_chart(ch, f"J{r_ag}")
    ctx.chart_ap_forn = ch

    ch2 = BarChart()
    ch2.type = "col"
    ch2.title = "Título em aberto por faixa (vencido e a vencer)"
    ch2.style = 2
    ch2.add_data(Reference(ws, min_col=2, min_row=r_sit, max_row=r_sit + 4), titles_from_data=False)
    ch2.set_categories(Reference(ws, min_col=1, min_row=r_sit, max_row=r_sit + 4))
    ch2.legend = None
    ch2.y_axis.numFmt = 'R$ #,##0'
    ch2.height, ch2.width = 9, 17
    ws.add_chart(ch2, f"J{r_fn}")
    ctx.chart_ap_situacao = ch2

    U.preparar(ws, freeze="A6", tab_cor="C00000", area_impressao=f"A1:O{r_pr+9}", paisagem=True)
    ctx.pagar = ws
    return ws


# ==========================================================================
# CONTAS A RECEBER
# ==========================================================================
def contas_receber(wb, ctx):
    ws = wb.create_sheet(P.ABA_AR)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 12, "B": 34, "C": 42, "D": 24, "E": 24, "F": 16, "G": 16, "H": 13, "I": 14,
                    "J": 16, "K": 14, "L": 14, "M": 14, "N": 14, "O": 34})
    U.titulo(ws, 1, "CONTAS A RECEBER (CLIENTES) — O QUE A EMPRESA TEM A RECEBER",
             "Carteira de recebíveis com classificação automática por vencimento, prazos médios, "
             "ticket médio e ranking de clientes. Alimentada pela aba LANÇAMENTOS.", span=10)
    U.mesclar(ws, "A3:O3",
              "⚠ DADOS DE EXEMPLO. Cada título é um lançamento de entrada na aba LANÇAMENTOS; esta aba "
              "organiza a carteira e sinaliza os atrasos. Veja a aba INADIMPLÊNCIA para a análise de atrasos.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 24

    U.secao(ws, 5, "1. INDICADORES DA CARTEIRA", span=10, altura=20)
    cards = [
        ("Total a receber em aberto", f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0")', "KPI_VALUE",
         "Carteira total a receber"),
        ("Vencido a receber", f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})',
         "KPI_VALUE", "Cobrança prioritária"),
        ("Vence hoje", f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},"="&{HOJE})', "KPI_VALUE",
         "Recebimento esperado hoje"),
        ("Próximos 7 dias", f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},">"&{HOJE},'
                            f'{L_VENC},"<="&{HOJE}+7)', "KPI_VALUE", "Entradas da semana"),
    ]
    _cards(ws, 6, cards, span=2)
    cards = [
        ("Próximos 30 dias", f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},">"&{HOJE}+7,'
                             f'{L_VENC},"<="&{HOJE}+30)', "KPI_VALUE", "Entradas do mês"),
        ("Recebido no ano", f'=SUMIFS({L_VFINAL},{ENTRADA},{L_PAGTO},">="&DATE({ANO},1,1),'
                            f'{L_PAGTO},"<="&DATE({ANO},12,31))', "KPI_VALUE", "Ano de análise"),
        ("Ticket médio por cliente", f'=IFERROR(SUMIFS({L_VFINAL},{ENTRADA},{L_PAGTO},">="&DATE({ANO},1,1),'
                                     f'{L_PAGTO},"<="&DATE({ANO},12,31))/'
                                     f'SUMPRODUCT((COUNTIFS({L_ENT},{ctx.clientes_nomes},{L_ANO},{ANO})>0)*1),"")',
         "KPI_VALUE", "Recebido ÷ clientes que compraram"),
        ("Títulos vencidos (qtd.)", f'=COUNTIFS({ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})',
         "KPI_VALUE0", "Quantidade em atraso"),
    ]
    _cards(ws, 9, cards, span=2)

    r0 = 13
    U.secao(ws, r0, "2. CLASSIFICAÇÃO AUTOMÁTICA DA CARTEIRA", span=8, altura=20)
    _cab(ws, r0 + 1, ["Situação", "Valor", "Qtd. títulos", "% do total a receber",
                      "Como o sistema classifica"])
    situacoes = [
        ("Vencido", f'{L_SALDO},">0",{L_VENC},"<"&{HOJE}', "Vencimento anterior a hoje e ainda em aberto"),
        ("Vence hoje", f'{L_SALDO},">0",{L_VENC},"="&{HOJE}', "Vencimento igual à data de hoje"),
        ("Vence em 7 dias", f'{L_SALDO},">0",{L_VENC},">"&{HOJE},{L_VENC},"<="&{HOJE}+7',
         "Vence nos próximos 7 dias"),
        ("Vence em 30 dias", f'{L_SALDO},">0",{L_VENC},">"&{HOJE}+7,{L_VENC},"<="&{HOJE}+30',
         "Vence entre 8 e 30 dias"),
        ("Futuro (mais de 30 dias)", f'{L_SALDO},">0",{L_VENC},">"&{HOJE}+30', "Vence em mais de 30 dias"),
        ("Recebido / liquidado", f'{L_SALDO},"=0",{L_STATUS},"Recebido"', "Já recebido"),
        ("Cancelado", f'{L_STATUS},"Cancelado"', "Lançamento cancelado — não afeta o caixa"),
    ]
    r_sit = r0 + 2
    for i, (rot, crit, explic) in enumerate(situacoes):
        r = r_sit + i
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, f'=SUMIFS({L_SALDO},{ENTRADA},{crit})', "CALC_MONEY")
        put(ws, r, 3, f'=COUNTIFS({ENTRADA},{crit})', "CALC_INT")
        put(ws, r, 4, f'=IF(SUM($B${r_sit}:$B${r_sit+4})=0,"",$B{r}/SUM($B${r_sit}:$B${r_sit+4}))', "CALC_PCT")
        put(ws, r, 5, explic, "NOTA")
    r_sit_fim = r_sit + len(situacoes) - 1
    put(ws, r_sit_fim + 1, 1, "TOTAL A RECEBER (vencido + a vencer)", "TOTAL_TXT")
    put(ws, r_sit_fim + 1, 2, f"=SUM($B${r_sit}:$B${r_sit+4})", "TOTAL_MONEY")
    put(ws, r_sit_fim + 1, 3, f"=SUM($C${r_sit}:$C${r_sit+4})", "TOTAL_INT")
    ctx.ar_faixa = (r_sit, r_sit + 4)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Vencido", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Vence", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"A{r_sit}:A{r_sit_fim}", "Recebido", E.GREEN_BG, E.GREEN_TX)

    # ----------------------------------------------------- próximos recebimentos
    r_px = r_sit_fim + 3
    U.secao(ws, r_px, "3. PRÓXIMOS RECEBIMENTOS — 20 TÍTULOS MAIS PRÓXIMOS", span=9, altura=20)
    _cab(ws, r_px + 1, ["Vencimento", "Cliente", "Descrição", "Categoria", "Subcategoria", "Situação",
                        "Valor em aberto", "Dias p/ vencer", "Chave (ordem)"])
    r_px0 = r_px + 2
    N = 20
    for i in range(N):
        r = r_px0 + i
        ch = f'$I{r}'
        put(ws, r, 9, f'=IFERROR(SMALL({L_CHAVEAR},{i+1}),"")', "CALC_TXT_C")
        campos = [(1, "VENC", "CALC_DATE"), (2, "ENTIDADE", "CALC_TXT"), (3, "DESCRICAO", "CALC_TXT"),
                  (4, "CAT", "CALC_TXT_C"), (5, "SUBCAT", "CALC_TXT"), (6, "SITUACAO", "CALC_TXT_C"),
                  (7, "SALDO", "CALC_MONEY"), (8, "DIASVENC", "CALC_INT")]
        for col, nome_col, est in campos:
            put(ws, r, col, f'=IF({ch}="","",INDEX({P.rng(nome_col)},MATCH({ch},{L_CHAVEAR},0)))', est)
    r_px_fim = r_px0 + N - 1
    put(ws, r_px_fim + 1, 1, "TOTAL DOS 20 TÍTULOS", "TOTAL_TXT")
    put(ws, r_px_fim + 1, 7, f"=SUM($G${r_px0}:$G${r_px_fim})", "TOTAL_MONEY")
    ws.column_dimensions["I"].hidden = True
    U.cf_formula(ws, f"F{r_px0}:F{r_px_fim}", f'=$F{r_px0}="Vencido"', E.RED_BG, E.RED_TX, True)

    # ------------------------------------------------------------- por cliente
    r_cl = r_px_fim + 3
    U.secao(ws, r_cl, "4. CARTEIRA POR CLIENTE (cadastro da aba CADASTRO DE CLIENTES)", span=8, altura=20)
    _cab(ws, r_cl + 1, ["Cliente", "Carteira em aberto", "Vencido", "A vencer", "Recebido no ano",
                        "% do total em aberto", "Qtd. títulos em aberto", "Faturamento do ano",
                        "% do faturamento"])
    r_cl0 = r_cl + 2
    for i in range(P.CLI_FIM - P.CLI_INI + 1):
        r = r_cl0 + i
        ref = P.CLI_INI + i
        f = f"'{P.ABA_CLI}'!$B${ref}"
        put(ws, r, 1, f'={f}', "CALC_TXT")
        put(ws, r, 2, f'=IF({f}="","",SUMIFS({L_SALDO},{L_ENT},{f},{ENTRADA},{L_SALDO},">0"))', "CALC_MONEY")
        put(ws, r, 3, f'=IF({f}="","",SUMIFS({L_SALDO},{L_ENT},{f},{ENTRADA},{L_SALDO},">0",'
                      f'{L_VENC},"<"&{HOJE}))', "CALC_MONEY")
        put(ws, r, 4, f'=IF({f}="","",$B{r}-$C{r})', "CALC_MONEY")
        put(ws, r, 5, f'=IF({f}="","",SUMIFS({L_VFINAL},{L_ENT},{f},{ENTRADA},{L_PAGTO},">="&'
                      f'DATE({ANO},1,1),{L_PAGTO},"<="&DATE({ANO},12,31)))', "CALC_MONEY")
        put(ws, r, 6, f'=IFERROR($B{r}/SUM($B${r_cl0}:$B${r_cl0+P.CLI_FIM-P.CLI_INI}),"")', "CALC_PCT")
        put(ws, r, 7, f'=IF({f}="","",COUNTIFS({L_ENT},{f},{ENTRADA},{L_SALDO},">0"))', "CALC_INT")
        put(ws, r, 8, f'=IF({f}="","",SUMIFS({L_VDRE},{L_ENT},{f},{L_ANO},{ANO}))', "CALC_MONEY")
        put(ws, r, 9, f'=IFERROR($H{r}/SUM($H${r_cl0}:$H${r_cl0+P.CLI_FIM-P.CLI_INI}),"")',
            "CALC_PCT")
    r_cl_fim = r_cl0 + (P.CLI_FIM - P.CLI_INI)
    put(ws, r_cl_fim + 1, 1, "TOTAL", "TOTAL_TXT")
    for col in (2, 3, 4, 5, 7):
        put(ws, r_cl_fim + 1, col, f"=SUM({L(col)}{r_cl0}:{L(col)}{r_cl_fim})", "TOTAL_MONEY")
    put(ws, r_cl_fim + 1, 8, f"=SUM($H${r_cl0}:$H${r_cl_fim})", "TOTAL_MONEY")
    U.cf_barras(ws, f"B{r_cl0}:B{r_cl_fim}", E.BLUE)
    U.cf_barras(ws, f"H{r_cl0}:H{r_cl_fim}", E.BLUE)

    # -------------------------------------------------------------- prazos
    r_pr = r_cl_fim + 3
    U.secao(ws, r_pr, "5. PRAZOS, TICKET E CONCENTRAÇÃO", span=8, altura=20)
    _cab(ws, r_pr + 1, ["Indicador", "Valor", "Meta / referência", "Leitura"], altura=22)
    indicadores = [
        ("Prazo médio de recebimento real (dias)",
         f'=IFERROR(SUMIFS({L_VALXDIAS},{ENTRADA})/SUMIFS({L_VFINAL},{ENTRADA}),"")', "CALC_INT",
         f'={PMR_ALVO}', "Média ponderada dos dias entre a competência e o recebimento efetivo."),
        ("Ticket médio por título a receber",
         f'=IFERROR(SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0")/'
         f'COUNTIFS({ENTRADA},{L_SALDO},">0"),"")', "CALC_MONEY", "—",
         "Valor médio dos títulos em aberto na carteira."),
        ("Quantidade de títulos em aberto", f'=COUNTIFS({ENTRADA},{L_SALDO},">0")', "CALC_INT", "—",
         "Número de parcelas/títulos ainda a receber."),
        ("Maior cliente (participação no faturamento do ano)",
         f'=IFERROR(MAX($H${r_cl0}:$H${r_cl_fim})/SUM($H${r_cl0}:$H${r_cl_fim}),"")',
         "CALC_PCT", "=0.3",
         "Concentração: acima de 30% exige atenção comercial."),
        ("Índice de inadimplência da carteira",
         f'=IFERROR(SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})/'
         f'SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0"),"")', "CALC_PCT", f'={INAD_MAX}',
         "Percentual da carteira em aberto que está vencida."),
    ]
    for i, (rot, f, est, meta, leitura) in enumerate(indicadores):
        r = r_pr + 2 + i
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, f, est)
        put(ws, r, 3, meta, "CALC_INT" if est == "CALC_INT" else "CALC_PCT")
        U.mesclar(ws, f"D{r}:O{r}", leitura, "NOTA")
    U.cf_formula(ws, f"B{r_pr+5}", f'=B{r_pr+5}>{INAD_MAX}', E.RED_BG, E.RED_TX, True)

    ch = BarChart()
    ch.type = "bar"
    ch.title = "Carteira a receber por cliente"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=2, min_row=r_cl0, max_row=r_cl0 + 14), titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=1, min_row=r_cl0, max_row=r_cl0 + 14))
    ch.legend = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 9, 17
    ws.add_chart(ch, f"J{r_px}")
    ctx.chart_ar_cliente = ch

    ch2 = LineChart()
    ch2.title = "Recebimentos realizados por mês (ano de análise)"
    ch2.style = 2
    ch2.add_data(Reference(ws, min_col=2, min_row=r_sit, max_row=r_sit + 4), titles_from_data=False)
    ch2.set_categories(Reference(ws, min_col=1, min_row=r_sit, max_row=r_sit + 4))
    ch2.legend = None
    ch2.y_axis.numFmt = 'R$ #,##0'
    ch2.height, ch2.width = 9, 17
    ws.add_chart(ch2, f"J{r_cl}")
    ctx.chart_ar_situacao = ch2

    U.preparar(ws, freeze="A6", tab_cor="1F6F3F", area_impressao=f"A1:O{r_pr+8}", paisagem=True)
    ctx.receber = ws
    return ws


# ==========================================================================
# INADIMPLÊNCIA
# ==========================================================================
def inadimplencia(wb, ctx):
    ws = wb.create_sheet(P.ABA_INAD)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 12, "B": 34, "C": 20, "D": 16, "E": 16, "F": 16, "G": 16, "H": 16, "I": 40,
                    "J": 14, "K": 14, "L": 14, "M": 14, "N": 14, "O": 14})
    U.titulo(ws, 1, "INADIMPLÊNCIA — ANÁLISE DE ATRASOS E RANKING DE CLIENTES",
             "Quanto está vencido, há quantos dias, de quais clientes e qual o impacto no caixa. Faixas de "
             "atraso (aging), ranking de clientes, evolução mensal e ações recomendadas.", span=10)
    U.mesclar(ws, "A3:O3",
              "⚠ DADOS DE EXEMPLO. Considera os títulos de entrada em aberto com vencimento anterior a HOJE. "
              "O percentual de inadimplência compara o valor vencido com o faturamento do ano.", "NOTA_WRAP")
    ws.row_dimensions[3].height = 24

    venc = f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})'
    fat_ano = f'SUMIFS({L_VDRE},{L_LINHA},"Faturamento Bruto",{L_ANO},{ANO})'
    carteira = f'SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0")'
    U.secao(ws, 5, "1. INDICADORES DE INADIMPLÊNCIA", span=10, altura=20)
    cards = [
        ("Total vencido a receber", venc, "KPI_VALUE", "Valores em atraso"),
        ("Índice de inadimplência", f'=IFERROR({venc[1:]}/{fat_ano},"")', "KPI_PCT", "Vencido ÷ faturamento"),
        ("Clientes com atraso", f'=SUMPRODUCT((COUNTIFS({L_ENT},{ctx.clientes_nomes},{ENTRADA},{L_SALDO},'
                                f'">0",{L_VENC},"<"&{HOJE})>0)*1)', "KPI_VALUE0", "Quantos clientes"),
        ("Atraso médio dos títulos vencidos (dias)",
         f'=IFERROR(SUMIFS({L_DIASATR},{ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})/'
         f'MAX(1,COUNTIFS({ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE})),"")', "KPI_VALUE0",
         "Média simples dos dias em atraso"),
    ]
    _cards(ws, 6, cards, span=2)

    # ------------------------------------------------------------------ aging
    r_ag = 10
    U.secao(ws, r_ag, "2. AGING — FAIXAS DE ATRASO (quanto está vencido em cada faixa)", span=10, altura=20)
    _cab(ws, r_ag + 1, ["Faixa de atraso", "Valor vencido", "Qtd. títulos", "% do vencido",
                        "Menor atraso", "Maior atraso", "Ação recomendada"])
    r_ag0 = r_ag + 2
    acoes = ["Cobrança amigável (e-mail/telefone)",
             "Cobrança ativa + juros de mora",
             "Contato telefônico com o responsável",
             "Negociação formal / proposta de parcelamento",
             "Cobrança terceirizada ou protesto",
             "Protesto e avaliação jurídica — suspender crédito"]
    for i, (faixa, de, ate) in enumerate(FAIXAS_ATRASO):
        r = r_ag0 + i
        crit = f'{L_DIASATR},">="&{de},{L_DIASATR},"<="&{ate}'
        put(ws, r, 1, faixa, "CALC_TXT")
        put(ws, r, 2, f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{crit})', "CALC_MONEY")
        put(ws, r, 3, f'=COUNTIFS({ENTRADA},{L_SALDO},">0",{crit})', "CALC_INT")
        put(ws, r, 4, f'=IF(SUM($B${r_ag0}:$B${r_ag0+5})=0,"",$B{r}/SUM($B${r_ag0}:$B${r_ag0+5}))', "CALC_PCT")
        put(ws, r, 5, de, "CALC_INT")
        put(ws, r, 6, "90+" if ate > 9999 else ate, "CALC_TXT_C")
        put(ws, r, 7, acoes[i], "NOTA")
    r_ag_fim = r_ag0 + len(FAIXAS_ATRASO) - 1
    put(ws, r_ag_fim + 1, 1, "TOTAL VENCIDO", "TOTAL_TXT")
    put(ws, r_ag_fim + 1, 2, f"=SUM($B${r_ag0}:$B${r_ag_fim})", "TOTAL_MONEY")
    put(ws, r_ag_fim + 1, 3, f"=SUM($C${r_ag0}:$C${r_ag_fim})", "TOTAL_INT")
    ctx.inad_faixa = (r_ag0, r_ag_fim)
    U.cf_barras(ws, f"B{r_ag0}:B{r_ag_fim}", E.BLUE)
    U.cf_escala(ws, f"E{r_ag0}:F{r_ag_fim}")

    # ---------------------------------------------------------------- ranking
    r_rk = r_ag_fim + 3
    U.secao(ws, r_rk, "3. RANKING DE CLIENTES COM VALORES EM ATRASO (maiores devedores)", span=10,
            altura=20)
    _cab(ws, r_rk + 1, ["Posição", "Cliente", "Valor vencido", "% do total vencido",
                        "Carteira em aberto", "Maior atraso (dias)", "Títulos vencidos", "Status",
                        "Telefone", "E-mail"])
    r_rk0 = r_rk + 2
    NR = 15
    # coluna de apoio (oculta) com o valor vencido por cliente — usada no ranking
    r_apoio = r_rk0 + NR + 2
    U.mesclar(ws, f"A{r_apoio-1}:D{r_apoio-1}", "APOIO DO RANKING — valor vencido por cliente "
                                                "(não editar)", "SECAO_CLARA")
    for i in range(P.CLI_FIM - P.CLI_INI + 1):
        r = r_apoio + i
        ref = P.CLI_INI + i
        f = f"'{P.ABA_CLI}'!$B${ref}"
        put(ws, r, 1, f'={f}', "CALC_TXT")
        put(ws, r, 2, f'=IF({f}="",0,SUMIFS({L_SALDO},{L_ENT},{f},{ENTRADA},{L_SALDO},">0",'
                      f'{L_VENC},"<"&{HOJE}))', "CALC_MONEY")
    r_apoio_fim = r_apoio + (P.CLI_FIM - P.CLI_INI)
    rng_nome = f"$A${r_apoio}:$A${r_apoio_fim}"
    rng_val = f"$B${r_apoio}:$B${r_apoio_fim}"
    for i in range(NR):
        r = r_rk0 + i
        put(ws, r, 1, f'=IFERROR(LARGE({rng_val},{i+1}),"")', "CALC_INT")
        pos = f'$A{r}'
        put(ws, r, 2, f'=IF(OR({pos}="",{pos}<=0),"",IFERROR(INDEX({rng_nome},MATCH({pos},{rng_val},0)),""))',
            "CALC_TXT")
        put(ws, r, 3, f'=IF($B{r}="","",SUMIFS({L_SALDO},{L_ENT},$B{r},{ENTRADA},{L_SALDO},">0",'
                      f'{L_VENC},"<"&{HOJE}))', "CALC_MONEY")
        put(ws, r, 4, f'=IF($C{r}="","",IFERROR($C{r}/{venc[1:]},""))', "CALC_PCT")
        put(ws, r, 5, f'=IF($B{r}="","",SUMIFS({L_SALDO},{L_ENT},$B{r},{ENTRADA},{L_SALDO},">0"))',
            "CALC_MONEY")
        put(ws, r, 6, f'=IF($B{r}="","",IFERROR(MAX(IF({L_ENT}=$B{r},{L_DIASATR})),""))', "CALC_INT")
        put(ws, r, 7, f'=IF($B{r}="","",COUNTIFS({L_ENT},$B{r},{ENTRADA},{L_SALDO},">0",{L_VENC},"<"&{HOJE}))',
            "CALC_INT")
        put(ws, r, 8, f'=IF($B{r}="","",IFERROR(INDEX(\'{P.ABA_CLI}\'!$M${P.CLI_INI}:$M${P.CLI_FIM},'
                      f'MATCH($B{r},\'{P.ABA_CLI}\'!$B${P.CLI_INI}:$B${P.CLI_FIM},0)),""))', "CALC_TXT_C")
        put(ws, r, 9, f'=IF($B{r}="","",IFERROR(INDEX(\'{P.ABA_CLI}\'!$I${P.CLI_INI}:$I${P.CLI_FIM},'
                      f'MATCH($B{r},\'{P.ABA_CLI}\'!$B${P.CLI_INI}:$B${P.CLI_FIM},0)),""))', "CALC_TXT")
        put(ws, r, 10, f'=IF($B{r}="","",IFERROR(INDEX(\'{P.ABA_CLI}\'!$H${P.CLI_INI}:$H${P.CLI_FIM},'
                       f'MATCH($B{r},\'{P.ABA_CLI}\'!$B${P.CLI_INI}:$B${P.CLI_FIM},0)),""))', "CALC_TXT")
    r_rk_fim = r_rk0 + NR - 1
    U.cf_barras(ws, f"C{r_rk0}:C{r_rk_fim}", E.BLUE)
    U.cf_formula(ws, f"A{r_rk0}:J{r_rk_fim}", f'=$A{r_rk0}=1', E.RED_BG, E.RED_TX, True)
    U.mesclar(ws, f"A{r_rk_fim+1}:J{r_rk_fim+1}",
              "O ranking usa as colunas de apoio abaixo (valor vencido por cliente). Confira o cadastro: "
              "nomes iguais aos lançamentos garantem o match automático.", "NOTA_WRAP")

    # ------------------------------------------------------------- evolução 12m
    r_ev = r_rk_fim + 3
    U.secao(ws, r_ev, "4. EVOLUÇÃO MENSAL DA INADIMPLÊNCIA (ano de análise)", span=10, altura=20)
    _cab(ws, r_ev + 1, ["Mês", "Faturamento do mês", "Recebido no mês", "Vencido gerado no mês",
                        "Vencido acumulado", "Índice de inadimplência", "Como ler"], altura=30)
    r_ev0 = r_ev + 2
    for m in range(1, 13):
        r = r_ev0 + m - 1
        put(ws, r, 1, f'=TEXT(DATE({ANO},{m},1),"MM/AAAA")', "CALC_TXT_C")
        put(ws, r, 2, f'=SUMIFS({L_VDRE},{L_LINHA},"Faturamento Bruto",{L_ANO},{ANO},{L_MES},{m})',
            "CALC_MONEY")
        put(ws, r, 3, f'=SUMIFS({L_VFINAL},{ENTRADA},{L_PAGTO},">="&DATE({ANO},{m},1),'
                      f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{m},1),0))', "CALC_MONEY")
        put(ws, r, 4, f'=SUMIFS({L_SALDO},{ENTRADA},{L_SALDO},">0",{L_ANO},{ANO},{L_MES},{m},'
                      f'{L_VENC},"<"&{HOJE})', "CALC_MONEY")
        put(ws, r, 5, f"=SUM($D${r_ev0}:$D{r})", "CALC_MONEY")
        put(ws, r, 6, f'=IF($B{r}=0,"",SUM($D${r_ev0}:$D{r})/SUM($B${r_ev0}:$B{r}))', "CALC_PCT")
        put(ws, r, 7, f'=IF($F{r}="","",IF($F{r}<={INAD_MAX},"🟢 Dentro do limite",'
                      f'"🔴 Acima do limite"))', "CALC_TXT_C")
    r_ev_fim = r_ev0 + 11
    U.cf_contem(ws, f"G{r_ev0}:G{r_ev_fim}", "🔴", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"G{r_ev0}:G{r_ev_fim}", "🟢", E.GREEN_BG, E.GREEN_TX)
    U.mesclar(ws, f"A{r_ev_fim+1}:J{r_ev_fim+1}",
              "O índice de inadimplência acumulado compara o vencido gerado no ano com o faturamento "
              "acumulado — use-o para acompanhar a tendência mês a mês.", "NOTA_WRAP")

    ch = BarChart()
    ch.type = "col"
    ch.title = "Inadimplência por faixa de atraso"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=2, min_row=r_ag0, max_row=r_ag_fim), titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=1, min_row=r_ag0, max_row=r_ag_fim))
    ch.legend = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 8, 16
    ws.add_chart(ch, f"L{r_ag}")
    ctx.chart_inad_faixa = ch

    ch2 = LineChart()
    ch2.title = "Índice de inadimplência acumulado (%)"
    ch2.style = 2
    ch2.add_data(Reference(ws, min_col=6, min_row=r_ev + 1, max_row=r_ev_fim), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=1, min_row=r_ev0, max_row=r_ev_fim))
    ch2.y_axis.numFmt = '0.0%'
    ch2.height, ch2.width = 8, 16
    ws.add_chart(ch2, f"L{r_ev}")
    ctx.chart_inad_evol = ch2

    U.preparar(ws, freeze="A6", tab_cor="C00000", area_impressao=f"A1:J{r_ev_fim+2}", paisagem=True)
    ctx.inadimplencia = ws
    return ws


# ==========================================================================
# CONCILIAÇÃO BANCÁRIA
# ==========================================================================
def conciliacao(wb, ctx):
    ws = wb.create_sheet(P.ABA_CONC)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 12, "B": 46, "C": 14, "D": 15, "E": 12, "F": 26, "G": 16, "H": 24, "I": 16,
                    "J": 40, "K": 16, "L": 22, "M": 16, "N": 16})
    U.titulo(ws, 1, "CONCILIAÇÃO BANCÁRIA — EXTRATO BANCÁRIO x PLANILHA",
             "Compare o extrato do banco com os lançamentos do sistema. O status de cada item é sugerido "
             "automaticamente e as divergências ficam destacadas.", span=10)
    U.mesclar(ws, "A3:N3",
              "Como usar: 1) importe/registre as linhas do extrato nas colunas amarelas; 2) o sistema "
              "procura automaticamente o lançamento correspondente (mesma data, valor e conta); 3) ajuste o "
              "status para Conciliado quando estiver certo. ⚠ As linhas preenchidas são dados de exemplo.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 30

    ini, fim = P.CONC_INI, P.CONC_FIM
    # ------------------------------------------------------------- indicadores
    U.secao(ws, 5, "1. INDICADORES DA CONCILIAÇÃO", span=8, altura=20)
    r_c = ini - 1          # linha 16
    tot_extrato = f'SUMIF($E${ini}:$E${fim},"Crédito",$D${ini}:$D${fim})+' \
                  f'SUMIF($E${ini}:$E${fim},"Débito",$D${ini}:$D${fim})'
    cards = [
        ("Total de créditos no extrato", f'=SUMIF($E${ini}:$E${fim},"Crédito",$D${ini}:$D${fim})',
         "KPI_VALUE", "Entradas registradas no banco"),
        ("Total de débitos no extrato", f'=SUMIF($E${ini}:$E${fim},"Débito",$D${ini}:$D${fim})',
         "KPI_VALUE", "Saídas registradas no banco"),
        ("Saldo líquido do extrato", f'={tot_extrato}', "KPI_VALUE", "Créditos − débitos"),
        ("Itens conciliados", f'=COUNTIF($G${ini}:$G${fim},"Conciliado")', "KPI_VALUE0",
         "Sem pendências"),
    ]
    _cards(ws, 6, cards, span=2)
    cards = [
        ("Itens pendentes", f'=COUNTIF($G${ini}:$G${fim},"Pendente")', "KPI_VALUE0",
         "Precisam de classificação"),
        ("Itens divergentes", f'=COUNTIF($G${ini}:$G${fim},"Divergente")', "KPI_VALUE0",
         "Valor não confere"),
        ("Divergência líquida (pendentes + divergentes)",
         f'=SUMIF($G${ini}:$G${fim},"Divergente",$D${ini}:$D${fim})+'
         f'SUMIF($G${ini}:$G${fim},"Pendente",$D${ini}:$D${fim})', "KPI_VALUE",
         "Ajuste necessário no extrato ou na planilha"),
        ("Itens do extrato não localizados na planilha",
         f'=COUNTIF($L${ini}:$L${fim},"Não localizado")', "KPI_VALUE0",
         "Lançar na aba LANÇAMENTOS"),
    ]
    _cards(ws, 9, cards, span=2)
    U.mesclar(ws, f"A{r_c-1}:N{r_c-1}", "2. EXTRATO BANCÁRIO x LANÇAMENTOS", "SECAO")
    ws.row_dimensions[r_c - 1].height = 20

    # ---------------------------------------------------------------- tabela
    _cab(ws, r_c, ["Data", "Histórico do extrato", "Documento", "Valor", "Tipo", "Conta / banco",
                   "Status", "Categoria", "Centro de custo", "Observação",
                   "Valor com sinal", "Situação automática (busca na planilha)"], altura=34)
    for r in range(ini, fim + 1):
        estilos = {1: "IN_DATE", 2: "IN_TXT", 3: "IN_TXT_C", 4: "IN_MONEY", 5: "IN_TXT_C",
                   6: "IN_TXT", 7: "IN_TXT_C", 8: "IN_TXT", 9: "IN_TXT_C", 10: "IN_TXT"}
        for col, est in estilos.items():
            ws.cell(row=r, column=col).style = est
        put(ws, r, 11,
            f'=IF($D{r}="","",IF($E{r}="Débito",-ABS($D{r}),ABS($D{r})))', "CALC_MONEY")
        put(ws, r, 12,
            f'=IF($A{r}="","",IF(COUNTIFS({L_PAGTO},$A{r},{L_VFINAL},ABS($D{r}),{L_BANCO},$F{r})>0,'
            f'"✔ Encontrado na planilha",'
            f'IF(COUNTIFS({L_PAGTO},$A{r},{L_VFINAL},">="&ABS($D{r})*0.98,{L_VFINAL},"<="&ABS($D{r})*1.02)'
            f'>0,"🟡 Valor próximo de um lançamento","❌ Não localizado")))', "CALC_TXT")
    for i, cx in enumerate(D.CONCILIACAO):
        r = ini + i
        for col, v in [(1, cx["data"]), (2, cx["historico"]), (3, cx["doc"]), (4, abs(cx["valor"])),
                       (5, cx["tipo"]), (6, cx["conta"]), (7, cx["conciliado"]),
                       (8, cx["categoria"] or None), (9, cx["cc"] or None), (10, cx["obs"])]:
            if v is not None:
                ws.cell(row=r, column=col, value=v)
    campos = [("A", "Chave / ordem", "CALC INT"), ]
    U.dv_lista(ws, f"E{ini}:E{fim}", '"Crédito,Débito"', "Tipo inválido",
               "Escolha Crédito (entrada) ou Débito (saída).")
    U.dv_lista(ws, f"G{ini}:G{fim}", "STATUS_CONCILIACAO", "Status inválido",
               "Escolha Conciliado, Pendente ou Divergente.")
    U.dv_lista(ws, f"F{ini}:F{fim}", "CONTAS_BANCARIAS", "Conta inválida",
               "Escolha uma conta cadastrada na aba CONTAS BANCÁRIAS.", estilo="warning")
    U.dv_data(ws, f"A{ini}:A{fim}")
    U.dv_decimal(ws, f"D{ini}:D{fim}", "greaterThanOrEqual", "0", "Valor inválido",
                 "Informe o valor do extrato (sem sinal).")
    U.cf_contem(ws, f"G{ini}:G{fim}", "Conciliado", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, f"G{ini}:G{fim}", "Pendente", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"G{ini}:G{fim}", "Divergente", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"L{ini}:L{fim}", "Não localizado", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"L{ini}:L{fim}", "Encontrado", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, f"L{ini}:L{fim}", "próximo", E.YEL_BG, E.YEL_TX)

    # ---------------------------------------------------------- divergências
    r_dv = fim + 2
    U.secao(ws, r_dv, "3. PENDÊNCIAS E DIVERGÊNCIAS — O QUE PRECISA DE AÇÃO", span=8, altura=20)
    U.cabecalho(ws, r_dv + 1, 1, ["Tipo de pendência", "Valor", "Quantidade", "Ação recomendada"],
                "TH2", 22)
    pends = [
        ("Itens divergentes (valor diferente do sistema)", f'=SUMIF($G${ini}:$G${fim},"Divergente",'
                                                           f'$D${ini}:$D${fim})',
         f'=COUNTIF($G${ini}:$G${fim},"Divergente")',
         "Conferir o comprovante e corrigir o valor na planilha ou no extrato."),
        ("Itens pendentes de classificação", f'=SUMIF($G${ini}:$G${fim},"Pendente",$D${ini}:$D${fim})',
         f'=COUNTIF($G${ini}:$G${fim},"Pendente")',
         "Identificar a origem e classificar (categoria e centro de custo)."),
        ("Itens do extrato sem lançamento na planilha", f'=SUMIF($L${ini}:$L${fim},"Não localizado",'
                                                        f'$D${ini}:$D${fim})',
         f'=COUNTIF($L${ini}:$L${fim},"Não localizado")',
         "Registrar o lançamento na aba LANÇAMENTOS com a mesma data e valor."),
        ("Total de itens do extrato", f'=SUM($D${ini}:$D${fim})', f'=COUNTA($A${ini}:$A${fim})',
         "Meta: 100% dos itens conciliados."),
    ]
    for i, (rot, v, q, acao) in enumerate(pends):
        r = r_dv + 2 + i
        put(ws, r, 1, rot, "CALC_TXT")
        put(ws, r, 2, v, "CALC_MONEY")
        put(ws, r, 3, q, "CALC_INT")
        put(ws, r, 4, acao, "NOTA")
    U.cf_maior(ws, f"B{r_dv+2}", 0, E.RED_BG, E.RED_TX, op="greaterThan")

    ch = BarChart()
    ch.type = "col"
    ch.title = "Conciliação por status"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=3, min_row=r_dv + 2, max_row=r_dv + 4), titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=1, min_row=r_dv + 2, max_row=r_dv + 4))
    ch.legend = None
    ch.y_axis.numFmt = '#,##0'
    ch.height, ch.width = 8, 14
    ws.add_chart(ch, f"F{r_dv + 6}")
    ctx.chart_conc = ch

    U.preparar(ws, freeze="A17", filtro=f"A{r_c}:L{fim}", repetir_linhas=f"{r_c}:{r_c}",
               tab_cor=E.GRAY_TEXT, area_impressao=f"A{r_c}:L{fim}", paisagem=True)
    ctx.conciliacao = ws
    return ws
