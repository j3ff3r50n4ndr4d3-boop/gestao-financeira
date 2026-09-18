"""
Abas INDICADORES, PONTO DE EQUILÍBRIO e SIMULADOR DE CENÁRIOS.

Todas as fórmulas são compatíveis com Excel 2016+ e Google Sheets
(SOMASES/SUMIFS, CONT.SES/COUNTIFS, SOMARPRODUTO/SUMPRODUCT, SEERRO/IFERROR).
"""
from openpyxl.chart import BarChart, LineChart, Reference

from lib import estilos as E
from lib import parametros as P
from lib import util as U
from lib.util import L, nome, put

L_TIPO = P.rng("TIPO")
L_VENC = P.rng("VENC")
L_PAGTO = P.rng("PAGTO")
L_ENT = P.rng("ENTIDADE")
L_VFINAL = P.rng("VFINAL")
L_SALDO = P.rng("SALDO")
L_VDRE = P.rng("VDRE")
L_LINHA = P.rng("LINHADRE")
L_NPARC = P.rng("NPARC")
L_VALXDIAS = P.rng("VALXDIAS")
L_VALIDA = P.rng("VALIDA")
L_MES = P.rng("MES")
L_ANO = P.rng("ANO")

ANO = P.CONFIG_REF["ano"]
MES = P.CONFIG_REF["mes"]
HOJE = "TODAY()"
SALDO_MIN = P.CONFIG_REF["saldo_min"]
META_FAT = P.CONFIG_REF["meta_fat"]
META_LUCRO = P.CONFIG_REF["meta_lucro"]
MARGEM_MIN = P.CONFIG_REF["margem_min"]
INAD_MAX = P.CONFIG_REF["inad_max"]
PMR_ALVO = P.CONFIG_REF["pmr_alvo"]
PMP_ALVO = P.CONFIG_REF["pmp_alvo"]
TAXA_PADRAO = P.CONFIG_REF["taxa_padrao"]
META_CRESC = P.CONFIG_REF["meta_cresc"]
RESERVA_GIRO = P.CONFIG_REF["reserva_giro"]
DISPONIVEL = f"SUM('{P.ABA_BANCOS}'!$G${P.BANCO_INI}:$G${P.BANCO_FIM})"

F_MES = f'IF({MES}=0,">0",{MES})'          # critério de mês (0 = ano todo)
MONEY, PCT, INT, MONEY0 = "CALC_MONEY", "CALC_PCT", "CALC_INT", "CALC_MONEY0"


def sf(linha, col=L_VDRE, ano=None, mes=False, conds=(), sem_igual=False):
    """SUMIFS já formatada para uma linha do DRE (mes=True restringe ao mês de análise)."""
    p = [f'{L_LINHA},"{linha}"', f'{L_ANO},{ano or ANO}']
    if mes:
        p.append(f'{L_MES},{F_MES}')
    p.extend(conds)
    return f'SUMIFS({col},{",".join(p)})'


def mes_de(m):
    return (f'SUMIFS({{col}},{L_LINHA},"{{linha}}",{L_ANO},{ANO},{L_MES},{m})')


def soma_mes(linha, m, col=L_VDRE):
    return f'SUMIFS({col},{L_LINHA},"{linha}",{L_ANO},{ANO},{L_MES},{m})'


# ==========================================================================
# INDICADORES
# ==========================================================================
def indicadores(wb, ctx):
    ws = wb.create_sheet(P.ABA_IND)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 48, "B": 20, "C": 18, "D": 21, "E": 60})
    U.titulo(ws, 1, "INDICADORES DE DESEMPENHO E PAINEL DE ALERTAS",
             "KPIs de vendas, rentabilidade, caixa, recebimentos, pagamentos, endividamento e capital de "
             "giro — todos calculados a partir da aba LANÇAMENTOS. O bloco ATENÇÃO DO GESTOR verifica "
             "automaticamente as situações que exigem decisão.", span=5)
    U.mesclar(ws, "A3:E3",
              "Como ler: as colunas B (valor) e D (status) são calculadas. As metas vêm da aba "
              "CONFIGURAÇÕES. 🔴 Crítico = aja agora | 🟡 Atenção = acompanhe | 🟢 OK = dentro do esperado.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 22

    rc0, rcf = ctx.emp_rc
    vendas_12m = (f'SUMIFS(\'{P.ABA_EMP}\'!$E${rc0}:$E${rcf},\'{P.ABA_EMP}\'!$D${rc0}:$D${rcf},">="&{HOJE},'
                  f'\'{P.ABA_EMP}\'!$D${rc0}:$D${rcf},"<="&EDATE({HOJE},12))')
    divida = (f'SUMIFS(\'{P.ABA_EMP}\'!$H${rc0}:$H${rcf},\'{P.ABA_EMP}\'!$I${rc0}:$I${rcf},"A vencer")'
              f'+SUMIFS(\'{P.ABA_EMP}\'!$G${rc0}:$G${rcf},\'{P.ABA_EMP}\'!$I${rc0}:$I${rcf},"A vencer")')
    saldo_atual = (f'{DISPONIVEL}+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<="&{HOJE})'
                   f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<="&{HOJE})')
    ent_mes = (f'SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},">="&DATE({ANO},{F_MES},1),'
               f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{F_MES},1),0))')
    sai_mes = (f'SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},">="&DATE({ANO},{F_MES},1),'
               f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{F_MES},1),0))')
    ar_aberto = f'SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0")'
    ap_aberto = f'SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_SALDO},">0")'
    ar_atraso = f'SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0",{L_VENC},"<"&{HOJE})'
    ap_atraso = f'SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_SALDO},">0",{L_VENC},"<"&{HOJE})'
    fat_ano = sf("Faturamento Bruto")
    fat_mes = sf("Faturamento Bruto", mes=True)
    imp_ano = sf("Impostos sobre Vendas")
    dev_ano = sf("Devoluções")
    cv_ano = sf("Custos Variáveis")
    df_ano = sf("Despesas Fixas")
    dfin_ano = sf("Despesas Financeiras")
    rfin_ano = sf("Receitas Financeiras")
    out_ano = sf("Outras Receitas Operacionais")
    ir_ano = sf("Impostos sobre o Resultado")
    rl_ano = f'{fat_ano}-{imp_ano}-{dev_ano}'
    lucro_ano = f'({rl_ano})-{cv_ano}-{df_ano}-{dfin_ano}+{rfin_ano}+{out_ano}-{ir_ano}'
    lucro_mes = (f'({sf("Faturamento Bruto", mes=True)}-{sf("Impostos sobre Vendas", mes=True)}'
                 f'-{sf("Devoluções", mes=True)}-{sf("Custos Variáveis", mes=True)}'
                 f'-{sf("Despesas Fixas", mes=True)}-{sf("Despesas Financeiras", mes=True)}'
                 f'+{sf("Receitas Financeiras", mes=True)}+{sf("Outras Receitas Operacionais", mes=True)}'
                 f'-{sf("Impostos sobre o Resultado", mes=True)})')
    ebitda_ano = f'({rl_ano})-{cv_ano}-{df_ano}'

    # ------------------------------------------------------------ 1. alertas
    U.secao(ws, 5, "1. ATENÇÃO DO GESTOR — 18 VERIFICAÇÕES AUTOMÁTICAS", span=5, altura=22)
    U.cabecalho(ws, 6, 1, ["Verificação automática", "Situação", "Valor atual",
                           "Meta / referência", "Ação recomendada"], "TH", 32)
    fim_7d = f'{HOJE}+7'
    fim_30d = f'{HOJE}+30'
    prox7_ar = (f'SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0",{L_VENC},">="&{HOJE},'
                f'{L_VENC},"<="&{fim_7d})')
    prox7_ap = (f'SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_SALDO},">0",{L_VENC},">="&{HOJE},'
                f'{L_VENC},"<="&{fim_7d})')
    prox30 = (f'{saldo_atual}+SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0",{L_VENC},">="&{HOJE},'
              f'{L_VENC},"<="&{fim_30d})-SUMIFS({L_SALDO},{L_TIPO},"Saída",{L_SALDO},">0",'
              f'{L_VENC},">="&{HOJE},{L_VENC},"<="&{fim_30d})')
    pmr = f'SUMIFS({L_VALXDIAS},{L_TIPO},"Entrada")/SUMIFS({L_VFINAL},{L_TIPO},"Entrada")'
    pmp = f'SUMIFS({L_VALXDIAS},{L_TIPO},"Saída")/SUMIFS({L_VFINAL},{L_TIPO},"Saída")'
    conc = (f'SUMPRODUCT(MAX(SUMIFS({L_VDRE},{L_ENT},{ctx.clientes_nomes},{L_ANO},{ANO})))/'
            f'SUMIFS({L_VDRE},{L_TIPO},"Entrada",{L_LINHA},"Faturamento Bruto",{L_ANO},{ANO})')

    # (condição crítica, condição de atenção, valor, meta, mensagem crítica, atenção, ok, ação, formato)
    alertas = [
        (f'$C{{r}}<{SALDO_MIN}', f'$C{{r}}<{SALDO_MIN}*1.5', f'={saldo_atual}', f'={SALDO_MIN}',
         "Saldo de caixa abaixo do mínimo exigido", "Saldo de caixa próximo do mínimo",
         "Saldo de caixa acima do mínimo exigido",
         "Reforce o recebimento de títulos em aberto ou renegocie prazos de fornecedores.", MONEY),
        ('$C{r}<0', f'$C{{r}}<{META_LUCRO}*0.5', f'={ent_mes}-({sai_mes})', "=0",
         "Geração de caixa negativa no período de análise", "Geração de caixa fraca no período",
         "Geração de caixa positiva no período",
         "Revise despesas e antecipe recebíveis para recompor o caixa.", MONEY),
        (f'$C{{r}}<{MARGEM_MIN}*0.5', f'$C{{r}}<{MARGEM_MIN}', f'=IFERROR(({lucro_ano})/({rl_ano}),"")',
         f'={MARGEM_MIN}',
         "Margem líquida muito abaixo do mínimo desejado", "Margem líquida abaixo do mínimo desejado",
         "Margem líquida dentro do mínimo desejado",
         "Revise preços, corte despesas fixas e renegocie custos variáveis.", PCT),
        (f'$C{{r}}<{META_FAT}*0.8', f'$C{{r}}<{META_FAT}', f'={fat_mes}', f'={META_FAT}',
         "Faturamento do mês muito abaixo da meta", "Faturamento do mês abaixo da meta",
         "Faturamento do mês atingiu a meta",
         "Ative a carteira de clientes inativos e o time comercial.", MONEY),
        (f'$C{{r}}<{META_LUCRO}*0.5', f'$C{{r}}<{META_LUCRO}', f'=IFERROR({lucro_mes},"")',
         f'={META_LUCRO}',
         "Lucro do mês muito abaixo da meta", "Lucro do mês abaixo da meta",
         "Lucro do mês atingiu a meta",
         "Reveja a estrutura de custos e priorize produtos com melhor margem.", MONEY),
        (f'$C{{r}}>{INAD_MAX}*2', f'$C{{r}}>{INAD_MAX}', f'=IFERROR({ar_atraso}/{fat_ano},"")',
         f'={INAD_MAX}',
         "Inadimplência muito acima do limite aceitável", "Inadimplência acima do limite aceitável",
         "Inadimplência sob controle",
         "Suspenda novos prazos para clientes em atraso e acione a cobrança.", PCT),
        (f'$C{{r}}>{META_FAT}*0.1', '$C{r}>0', f'={ar_atraso}', "=0",
         "Títulos a receber vencidos de valor relevante", "Títulos a receber vencidos de baixo valor",
         "Nenhum título a receber vencido",
         "Envie a régua de cobrança e avalie protesto ou negociação.", MONEY),
        (f'$C{{r}}>{SALDO_MIN}*0.3', '$C{r}>0', f'={ap_atraso}', "=0",
         "Títulos a pagar vencidos de valor relevante", "Títulos a pagar vencidos de baixo valor",
         "Nenhum título a pagar vencido",
         "Liquide os vencidos para evitar juros e negativação.", MONEY),
        ('$C{r}>0.3', '$C{r}>0.2', f'=IFERROR({vendas_12m}/{fat_ano},"")', "=0.2",
         "Comprometimento da receita com dívidas acima de 30%",
         "Comprometimento da receita com dívidas acima de 20%",
         "Comprometimento da receita com dívidas sob controle",
         "Evite novos financiamentos e priorize a dívida mais cara.", PCT),
        ('$C{r}<$D{r}', f'$C{{r}}<$D{{r}}*1.2', f'={prox7_ar}', f'={prox7_ap}',
         "Recebimentos dos próximos 7 dias insuficientes para os pagamentos",
         "Recebimentos dos próximos 7 dias no limite",
         "Recebimentos dos próximos 7 dias cobrem os pagamentos",
         "Antecipe recebíveis ou reprograme os pagamentos da semana.", MONEY),
        ('$C{r}>5', '$C{r}>0', f'=COUNTIF({L_VALIDA},"*⚠*")', "=0",
         "Lançamentos com erro de preenchimento", "Poucos lançamentos com aviso de preenchimento",
         "Nenhum lançamento com erro de preenchimento",
         "Corrija as linhas sinalizadas na coluna VALIDAÇÃO da aba LANÇAMENTOS.", INT),
        ('$C{r}>2', '$C{r}>0', f'=COUNTIF({ctx.orc_status},"🔴*")', "=0",
         "Categorias de despesa acima do orçamento", "Poucas categorias acima do orçamento",
         "Nenhuma categoria acima do orçamento",
         "Veja o bloco de alertas da aba ORÇAMENTO X REALIZADO e bloqueie gastos excedentes.", INT),
        ('$C{r}>3', '$C{r}>0', f'=COUNTIF({ctx.orc_status},"🟡*")', "=0",
         "Muitas categorias com mais de 90% do orçamento consumido",
         "Categorias com consumo entre 90% e 100% do orçamento",
         "Nenhuma categoria acima de 90% do orçamento",
         "Antecipe o estouro: renegocie contratos ou remaneje verbas.", INT),
        (f'$C{{r}}>{PMR_ALVO}*1.5', f'$C{{r}}>{PMR_ALVO}', f'=IFERROR({pmr},"")', f'={PMR_ALVO}',
         "Prazo médio de recebimento muito acima do alvo", "Prazo médio de recebimento acima do alvo",
         "Prazo médio de recebimento dentro do alvo",
         "Renegocie prazos, ofereça desconto para pagamento à vista ou antecipe recebíveis.", INT),
        (f'$C{{r}}>{PMP_ALVO}*1.5', f'$C{{r}}>{PMP_ALVO}', f'=IFERROR({pmp},"")', f'={PMP_ALVO}',
         "Prazo médio de pagamento muito acima do alvo", "Prazo médio de pagamento acima do alvo",
         "Prazo médio de pagamento dentro do alvo",
         "Negocie prazos maiores com fornecedores e evite pagamentos antecipados.", INT),
        ('$C{r}>0.4', '$C{r}>0.3', f'=IFERROR({conc},"")', "=0.3",
         "Faturamento concentrado em poucos clientes", "Concentração de faturamento em atenção",
         "Faturamento distribuído entre os clientes",
         "Nenhum cliente deve passar de 30% do faturamento: diversifique a carteira.", PCT),
        ('$C{r}<0', f'$C{{r}}<{SALDO_MIN}', f'={prox30}', f'={SALDO_MIN}',
         "Projeção de caixa em 30 dias com risco de déficit",
         "Projeção de caixa em 30 dias abaixo do mínimo",
         "Projeção de caixa em 30 dias acima do mínimo",
         "Programe aporte, antecipação de recebíveis ou corte de despesas.", MONEY),
        ('$C{r}>0.6', '$C{r}>0.5', f'=IFERROR({sf("Despesas Fixas", mes=True)}/{fat_mes},"")', "=0.6",
         "Despesas fixas acima de 60% da receita", "Despesas fixas acima de 50% da receita",
         "Despesas fixas em nível saudável",
         "Estrutura fixa alta exige receita previsível: revise contratos e equipe.", PCT),
    ]
    r0 = 7
    for i, (crit, aten, valor, meta, msg_c, msg_a, msg_ok, acao, fmt) in enumerate(alertas):
        r = r0 + i
        c = crit.replace("{r}", str(r))
        a = aten.replace("{r}", str(r))
        put(ws, r, 1, f'=IF({c},"{msg_c}",IF({a},"{msg_a}","{msg_ok}"))', "CALC_TXT")
        put(ws, r, 2, f'=IF({c},"🔴 Crítico",IF({a},"🟡 Atenção","🟢 OK"))', "CALC_TXT_C")
        put(ws, r, 3, valor, fmt)
        put(ws, r, 4, meta, "CALC_PCT" if fmt == PCT else ("CALC_INT" if fmt == INT else "CALC_MONEY"))
        put(ws, r, 5, acao, "NOTA")
        ws.row_dimensions[r].height = 15
    r_al_fim = r0 + len(alertas) - 1
    U.cf_contem(ws, f"B{r0}:B{r_al_fim}", "🔴", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"B{r0}:B{r_al_fim}", "🟡", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"B{r0}:B{r_al_fim}", "🟢", E.GREEN_BG, E.GREEN_TX)
    U.cf_formula(ws, f"A{r0}:A{r_al_fim}", f'=$B{r0}="🔴 Crítico"', None, E.RED_TX, True)
    U.cf_formula(ws, f"A{r0}:A{r_al_fim}", f'=$B{r0}="🟡 Atenção"', None, E.YEL_TX)
    U.mesclar(ws, f"A{r_al_fim+1}:E{r_al_fim+1}",
              "Estas 18 verificações aparecem resumidas no topo do DASHBOARD. Os valores usam a data de "
              "referência (HOJE) e o ano/mês de análise definidos na aba CONFIGURAÇÕES.", "NOTA_WRAP")
    ws.row_dimensions[r_al_fim + 1].height = 20

    # ------------------------------------------------------------- 2. blocos
    def bloco(titulo, kpis, linha):
        U.secao(ws, linha, titulo, span=5, altura=20)
        U.cabecalho(ws, linha + 1, 1, ["Indicador", "Valor", "Meta / referência", "Status",
                                       "Como é calculado"], "TH2", 22)
        r = linha + 2
        for rot, formula, fmt, meta, st, como in kpis:
            put(ws, r, 1, rot, "CALC_TXT")
            put(ws, r, 2, formula, fmt)
            put(ws, r, 3, meta if meta else "—", "CALC_PCT" if fmt == PCT else
                ("CALC_INT" if fmt == INT else "CALC_MONEY"))
            put(ws, r, 4, ("=" + st.replace("{r}", str(r))) if st else "—", "CALC_TXT_C")
            put(ws, r, 5, como, "NOTA")
            r += 1
        U.cf_contem(ws, f"D{linha+2}:D{r-1}", "🔴", E.RED_BG, E.RED_TX)
        U.cf_contem(ws, f"D{linha+2}:D{r-1}", "🟡", E.YEL_BG, E.YEL_TX)
        U.cf_contem(ws, f"D{linha+2}:D{r-1}", "🟢", E.GREEN_BG, E.GREEN_TX)
        ws.row_dimensions[r].height = 8
        return r + 2


    def st_maior(ref, ok="🟢 Meta atingida", med="🟡 Próximo da meta", ruim="🔴 Abaixo da meta", fator=0.9):
        return (f'IF($B{{r}}>={ref},"{ok}",IF($B{{r}}>={ref}*{fator},"{med}","{ruim}"))')

    r = r_al_fim + 3

    # ---------------------------------------------------------------- vendas
    vendas = [
        ("Faturamento bruto do mês de análise", f'={fat_mes}', MONEY, f'={META_FAT}',
         st_maior(META_FAT), "Soma dos lançamentos de Faturamento Bruto na competência do mês."),
        ("Faturamento bruto acumulado no ano", f'={fat_ano}', MONEY, f'={META_FAT}*12',
         st_maior(f'{META_FAT}*12'), "Soma do Faturamento Bruto no ano de análise."),
        ("Faturamento do mês anterior", None, MONEY, "—", None,
         "Faturamento do mês imediatamente anterior (ou do ano anterior, se o mês = 0)."),
        ("Crescimento vs mês anterior", None, PCT, "=0",
         'IF(OR($B{r}="",$B{r}=0),"🟢 Sem base anterior",IF($B{r}>0,"🟢 Crescendo","🔴 Em queda"))',
         "Variação percentual do mês de análise sobre o mês anterior."),
        ("Crescimento vs mesmo mês do ano anterior", None, PCT, f'={META_CRESC}',
         'IF(OR($B{r}="",$B{r}=0),"🟡 Sem base de comparação",IF($B{r}>0,"🟢 Crescendo","🔴 Em queda"))',
         "Compara o mês de análise com o mesmo mês do ano anterior."),
        ("Ticket médio por venda", None, MONEY, "—", None,
         "Faturamento bruto do ano dividido pelo número de vendas (lançamentos com nº parcela = 1)."),
        ("Quantidade de vendas no ano", None, INT, "—", None,
         "Conta as vendas iniciadas no ano (lançamentos com nº parcela = 1)."),
        ("Clientes que compraram no ano", None, INT, "—", None,
         "Conta quantos clientes do cadastro têm faturamento no ano de análise."),
    ]
    rv = r + 2
    vendas[2] = ("Faturamento do mês anterior",
                 f'=IF({MES}=0,{sf("Faturamento Bruto", ano=f"{ANO}-1")},'
                 f'IF({MES}=1,{sf("Faturamento Bruto", ano=f"{ANO}-1", conds=(f"{L_MES},12",))},'
                 f'{sf("Faturamento Bruto", conds=(f"{L_MES},{MES}-1",))}))', MONEY, "—", None,
                 "Faturamento do mês imediatamente anterior (ou do ano anterior, se o mês = 0).")
    vendas[3] = ("Crescimento vs mês anterior",
                 f'=IFERROR(IF($B${rv+2}=0,"",$B{rv}/$B${rv+2}-1),"")', PCT, "=0",
                 'IF(OR($B{r}="",$B{r}=0),"🟢 Sem base anterior",IF($B{r}>0,"🟢 Crescendo","🔴 Em queda"))',
                 "Variação percentual do mês de análise sobre o mês anterior.")
    vendas[4] = ("Crescimento vs mesmo mês do ano anterior",
                 f'=IFERROR(IF({sf("Faturamento Bruto", ano=f"{ANO}-1", mes=True)}=0,"",'
                 f'$B{rv}/{sf("Faturamento Bruto", ano=f"{ANO}-1", mes=True)}-1),"")', PCT,
                 f'={META_CRESC}',
                 'IF(OR($B{r}="",$B{r}=0),"🟡 Sem base de comparação",IF($B{r}>0,"🟢 Crescendo","🔴 Em queda"))',
                 "Compara o mês de análise com o mesmo mês do ano anterior.")
    vendas[5] = ("Ticket médio por venda",
                 f'=IFERROR($B${rv+1}/COUNTIFS({L_LINHA},"Faturamento Bruto",{L_ANO},{ANO},{L_NPARC},1),"")',
                 MONEY, "—", None,
                 "Faturamento bruto do ano dividido pelo número de vendas (lançamentos com nº parcela = 1).")
    vendas[6] = ("Quantidade de vendas no ano",
                 f'=COUNTIFS({L_LINHA},"Faturamento Bruto",{L_ANO},{ANO},{L_NPARC},1)', INT, "—", None,
                 "Conta as vendas iniciadas no ano (lançamentos com nº parcela = 1).")
    vendas[7] = ("Clientes que compraram no ano",
                 f'=SUMPRODUCT((COUNTIFS({L_ENT},{ctx.clientes_nomes},{L_ANO},{ANO})>0)*1)', INT, "—", None,
                 "Conta quantos clientes do cadastro têm faturamento no ano de análise.")
    r = bloco("2. INDICADORES DE VENDAS", vendas, r)
    r_fat_mes_row, r_fat_ano_row = rv, rv + 1

    # ----------------------------------------------------------- rentabilidade
    rr = r + 2
    rent = [
        ("Receita líquida do ano", f'={rl_ano}', MONEY, "—", None,
         "Faturamento bruto menos impostos sobre vendas e devoluções."),
        ("Lucro líquido do ano", f'={lucro_ano}', MONEY, f'={META_LUCRO}*12',
         st_maior(f'{META_LUCRO}*12'), "Resultado após custos, despesas, receitas financeiras e impostos."),
        ("Lucro líquido do mês de análise", f'=IFERROR({lucro_mes},"")', MONEY, f'={META_LUCRO}',
         st_maior(META_LUCRO), "Mesmo cálculo do lucro, restrito ao mês de análise."),
        ("EBITDA / resultado operacional do ano", f'={ebitda_ano}', MONEY, "—", None,
         "Receita líquida menos custos variáveis e despesas fixas (antes de juros e impostos)."),
        ("Margem bruta %", f'=IFERROR(($B${rr}-{imp_ano}-{cv_ano})/$B${r_fat_ano_row},"")', PCT, "—", None,
         "(Faturamento − impostos − devoluções − custos variáveis) ÷ faturamento bruto."),
        ("Margem de contribuição %", f'=IFERROR(($B${rr}-{cv_ano})/$B${rr},"")', PCT, "—", None,
         "(Receita líquida − custos variáveis) ÷ receita líquida."),
        ("Margem operacional (EBITDA) %", f'=IFERROR($B${rr+3}/$B${rr},"")', PCT, "—", None,
         "EBITDA ÷ receita líquida."),
        ("Margem líquida %", f'=IFERROR($B${rr+1}/$B${rr},"")', PCT, f'={MARGEM_MIN}',
         st_maior(MARGEM_MIN, "🟢 Acima do mínimo", "🟡 Próxima do mínimo", "🔴 Abaixo do mínimo", 1),
         "Lucro líquido ÷ receita líquida. Meta definida na aba CONFIGURAÇÕES."),
    ]
    r = bloco("3. INDICADORES DE RENTABILIDADE", rent, r)
    r_rl_row, r_lucro_row = rr, rr + 1

    # ------------------------------------------------------------------ caixa
    rc = r + 2
    caixa = [
        ("Saldo de caixa disponível", f'={saldo_atual}', MONEY, f'={SALDO_MIN}',
         f'IF($B{{r}}<{SALDO_MIN},"🔴 Abaixo do mínimo","🟢 Acima do mínimo")',
         "Saldo inicial das contas + entradas − saídas já liquidadas até hoje."),
        ("Entradas de caixa no mês", f'={ent_mes}', MONEY, "—", None,
         "Lançamentos de entrada com data de pagamento/recebimento no mês de análise."),
        ("Saídas de caixa no mês", f'={sai_mes}', MONEY, "—", None,
         "Lançamentos de saída com data de pagamento no mês de análise."),
        ("Geração de caixa no mês", f'=$B${rc+1}-$B${rc+2}', MONEY, "=0",
         'IF($B{r}=0,"🟡 Sem geração de caixa",IF($B{r}>0,"🟢 Geração positiva","🔴 Geração negativa"))',
         "Entradas menos saídas realizadas no mês de análise."),
        ("Geração de caixa acumulada no ano",
         f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_ANO},{ANO})-'
         f'SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_ANO},{ANO})', MONEY, "=0",
         'IF($B{r}>0,"🟢 Geração positiva no ano","🔴 Geração negativa no ano")',
         "Entradas menos saídas realizadas no ano de análise."),
        ("Saldo projetado em 30 dias", f'=IFERROR({prox30},"")', MONEY, f'={SALDO_MIN}',
         'IF($B{r}<0,"🔴 Risco de déficit","🟢 Sem risco de déficit")',
         "Saldo atual + títulos a receber − títulos a pagar com vencimento em até 30 dias."),
        ("Meses de caixa (cobertura das saídas)",
         f'=IFERROR($B${rc}/(SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_ANO},{ANO})/12),"")', INT, "=3",
         'IF($B{r}>=3,"🟢 Reserva adequada",IF($B{r}>=1,"🟡 Reserva curta","🔴 Reserva crítica"))',
         "Saldo disponível dividido pela média mensal de saídas realizadas no ano."),
    ]
    r = bloco("4. INDICADORES DE CAIXA", caixa, r)

    # -------------------------------------------------- recebimentos/pagamentos
    rp = r + 2
    rec = [
        ("Total a receber em aberto", f'={ar_aberto}', MONEY, "—", None,
         "Soma do saldo em aberto dos lançamentos de entrada ainda não recebidos."),
        ("Recebido no ano", f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},">="&DATE({ANO},1,1),'
                            f'{L_PAGTO},"<="&DATE({ANO},12,31))', MONEY, "—", None,
         "Entradas de caixa com data de recebimento no ano de análise."),
        ("Vencido a receber", f'={ar_atraso}', MONEY, "=0",
         'IF($B{r}>0,"🔴 Existe valor vencido a receber","🟢 Nada vencido")',
         "Títulos de entrada em aberto com vencimento anterior a hoje."),
        ("Recebimentos nos próximos 7 dias", f'={prox7_ar}', MONEY, "—", None,
         "Títulos a receber com vencimento nos próximos 7 dias."),
        ("Prazo médio de recebimento (dias)", f'=IFERROR({pmr},"")', INT, f'={PMR_ALVO}',
         f'IF($B{{r}}>{PMR_ALVO},"🔴 Acima do alvo","🟢 Dentro do alvo")',
         "Média ponderada dos dias entre a competência e o recebimento de fato."),
        ("Total a pagar em aberto", f'={ap_aberto}', MONEY, "—", None,
         "Soma do saldo em aberto dos lançamentos de saída ainda não pagos."),
        ("Pago no ano", f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},">="&DATE({ANO},1,1),'
                        f'{L_PAGTO},"<="&DATE({ANO},12,31))', MONEY, "—", None,
         "Saídas de caixa com data de pagamento no ano de análise."),
        ("Vencido a pagar", f'={ap_atraso}', MONEY, "=0",
         'IF($B{r}>0,"🔴 Existe valor vencido a pagar","🟢 Nada vencido")',
         "Títulos de saída em aberto com vencimento anterior a hoje."),
        ("Pagamentos nos próximos 7 dias", f'={prox7_ap}', MONEY, "—", None,
         "Títulos a pagar com vencimento nos próximos 7 dias."),
        ("Prazo médio de pagamento (dias)", f'=IFERROR({pmp},"")', INT, f'={PMP_ALVO}',
         f'IF($B{{r}}>{PMP_ALVO},"🟡 Acima do alvo","🟢 Dentro do alvo")',
         "Média ponderada dos dias entre a competência e o pagamento de fato."),
    ]
    r = bloco("5. RECEBIMENTOS E PAGAMENTOS", rec, r)

    # -------------------------------------------- endividamento/capital de giro
    re_ = r + 2
    endiv = [
        ("Saldo devedor total (dívida atual)", f'={divida}', MONEY, "—", None,
         "Soma das parcelas a vencer e das amortizações futuras dos contratos cadastrados."),
        ("Parcelas dos próximos 12 meses", f'={vendas_12m}', MONEY, "—", None,
         "Total de parcelas de empréstimos com vencimento nos próximos 12 meses."),
        ("Comprometimento da receita (12 meses)", f'=IFERROR({vendas_12m}/{fat_ano},"")', PCT, "=0.2",
         'IF($B{r}>0.2,"🔴 Acima de 20%","🟢 Dentro de 20%")',
         "Parcelas dos próximos 12 meses divididas pelo faturamento do ano."),
        ("Dívida total ÷ faturamento anual", f'=IFERROR({divida}/{fat_ano},"")', PCT, "—", None,
         "Endividamento total comparado ao faturamento do ano."),
        ("Custo médio da dívida (% ao mês)",
         f'=IFERROR(SUMPRODUCT((\'{P.ABA_EMP}\'!$E${P.EMPR_INI}:$E${P.EMPR_FIM}<>"")*'
         f'\'{P.ABA_EMP}\'!$E${P.EMPR_INI}:$E${P.EMPR_FIM}*'
         f'\'{P.ABA_EMP}\'!$G${P.EMPR_INI}:$G${P.EMPR_FIM})/'
         f'SUM(\'{P.ABA_EMP}\'!$E${P.EMPR_INI}:$E${P.EMPR_FIM}),"")', PCT, f'={TAXA_PADRAO}', None,
         "Média ponderada das taxas mensais dos contratos cadastrados."),
        ("Capital de giro líquido", f'=($B${rc}+{ar_aberto})-({ap_aberto}+{vendas_12m})', MONEY, "=0",
         'IF($B{r}>0,"🟢 Positivo","🔴 Negativo")',
         "(Caixa disponível + a receber) − (a pagar + parcelas de empréstimos dos próximos 12 meses)."),
        ("Necessidade de capital de giro (operacional)",
         f'=SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0",{L_VENC},">="&{HOJE})'
         f'+{sf("Despesas Fixas", mes=True)}-{ap_aberto}', MONEY, "=0",
         f'IF($B{{r}}>$B{rc},"🔴 Precisa de capital","🟢 Coberto pelo caixa")',
         "A receber a vencer + despesas fixas do mês − a pagar total em aberto."),
        ("Ciclo financeiro (dias)", f'=IFERROR({pmr}-{pmp},"")', INT, "—", None,
         "Prazo médio de recebimento menos prazo médio de pagamento."),
        ("Reserva de capital de giro recomendada", f'={RESERVA_GIRO}*{sf("Despesas Fixas", mes=True)}',
         MONEY, "—", None,
         "Meses de despesa fixa definidos na CONFIGURAÇÕES × despesas fixas do período."),
    ]
    r = bloco("6. ENDIVIDAMENTO E CAPITAL DE GIRO", endiv, r)

    # --------------------------------------------------------- evolução mensal
    trend_tit = r
    U.secao(ws, trend_tit, "7. EVOLUÇÃO MENSAL — BASE DOS GRÁFICOS DO DASHBOARD", span=5, altura=22)
    trend_ini = trend_tit + 1
    cab = ["Mês", "Faturamento", "Impostos e devoluções", "Custos variáveis", "Despesas fixas",
           "Despesas financeiras", "Receitas financeiras", "Margem contrib. %", "Lucro líquido",
           "Margem líquida %", "Entradas de caixa", "Saídas de caixa", "Saldo final de caixa",
           "Orçado", "Realizado", "% consumido"]
    U.cabecalho(ws, trend_ini, 1, cab, "TH2", 34)
    meses_pt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto",
                "Setembro", "Outubro", "Novembro", "Dezembro"]
    orc_r0, orc_real_r = ctx.orc_rows
    for m in range(1, 13):
        rr_ = trend_ini + m
        put(ws, rr_, 1, f'=IF({MES}={m},"▶ {meses_pt[m-1]}","{meses_pt[m-1]}")', "CALC_TXT")
        put(ws, rr_, 2, f'={soma_mes("Faturamento Bruto", m)}', MONEY)
        put(ws, rr_, 3, f'={soma_mes("Impostos sobre Vendas", m)}+{soma_mes("Devoluções", m)}', MONEY)
        put(ws, rr_, 4, f'={soma_mes("Custos Variáveis", m)}', MONEY)
        put(ws, rr_, 5, f'={soma_mes("Despesas Fixas", m)}', MONEY)
        put(ws, rr_, 6, f'={soma_mes("Despesas Financeiras", m)}', MONEY)
        put(ws, rr_, 7, f'={soma_mes("Receitas Financeiras", m)}+{soma_mes("Outras Receitas Operacionais", m)}',
            MONEY)
        put(ws, rr_, 8, f'=IFERROR(($B{rr_}-$C{rr_}-$D{rr_})/($B{rr_}-$C{rr_}),"")', PCT)
        put(ws, rr_, 9, f'=$B{rr_}-$C{rr_}-$D{rr_}-$E{rr_}-$F{rr_}+$G{rr_}-{soma_mes("Impostos sobre o Resultado", m)}',
            MONEY)
        put(ws, rr_, 10, f'=IFERROR($I{rr_}/($B{rr_}-$C{rr_}),"")', PCT)
        put(ws, rr_, 11, f'=SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},">="&DATE({ANO},{m},1),'
                         f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{m},1),0))', MONEY)
        put(ws, rr_, 12, f'=SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},">="&DATE({ANO},{m},1),'
                         f'{L_PAGTO},"<="&EOMONTH(DATE({ANO},{m},1),0))', MONEY)
        put(ws, rr_, 13, f'={DISPONIVEL}+SUM($K${trend_ini+1}:$K{rr_})-SUM($L${trend_ini+1}:$L{rr_})',
            MONEY)
        put(ws, rr_, 14, f"='{P.ABA_ORC}'!{L(m+1)}{orc_r0}", MONEY)
        put(ws, rr_, 15, f"='{P.ABA_ORC}'!{L(m+1)}{orc_real_r}", MONEY)
        put(ws, rr_, 16, f'=IFERROR($O{rr_}/$N{rr_},"")', PCT)
    trend_fim = trend_ini + 12
    put(ws, trend_fim, 1, "TOTAL DO ANO", "TOTAL_TXT")
    for col in (2, 3, 4, 5, 6, 7, 9, 11, 12, 14, 15):
        put(ws, trend_fim, col, f"=SUM({L(col)}{trend_ini+1}:{L(col)}{trend_fim-1})", "TOTAL_MONEY")
    put(ws, trend_fim, 8, f'=IFERROR(($B{trend_fim}-$C{trend_fim}-$D{trend_fim})/'
                          f'($B{trend_fim}-$C{trend_fim}),"")', "TOTAL_PCT")
    put(ws, trend_fim, 10, f'=IFERROR($I{trend_fim}/($B{trend_fim}-$C{trend_fim}),"")', "TOTAL_PCT")
    put(ws, trend_fim, 13, f'=$M{trend_fim-1}', "TOTAL_MONEY")
    put(ws, trend_fim, 16, f'=IFERROR($O{trend_fim}/$N{trend_fim},"")', "TOTAL_PCT")
    U.cf_contem(ws, f"A{trend_ini+1}:A{trend_fim-1}", "▶", E.BLUE_LIGHT, E.NAVY)
    U.cf_barras(ws, f"B{trend_ini+1}:B{trend_fim-1}", E.BLUE)
    U.cf_escala(ws, f"J{trend_ini+1}:J{trend_fim-1}")
    ctx.ind_trend = (trend_ini + 1, trend_fim - 1)

    ch = BarChart()
    ch.type = "col"
    ch.grouping = "clustered"
    ch.title = "Faturamento x Lucro líquido por mês"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=2, max_col=2, min_row=trend_ini, max_row=trend_fim - 1),
                titles_from_data=True)
    ch.add_data(Reference(ws, min_col=9, max_col=9, min_row=trend_ini, max_row=trend_fim - 1),
                titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=trend_ini + 1, max_row=trend_fim - 1))
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.majorGridlines = None
    ch.height, ch.width = 8, 16
    ws.add_chart(ch, "G5")
    ctx.chart_ind = ch

    U.preparar(ws, freeze="A7", tab_cor=E.NAVY, area_impressao=f"A1:E{trend_fim}")
    ctx.indicadores = ws
    ctx.ind_alertas = (r0, r_al_fim)
    ctx.ind_rows = dict(fat_mes=r_fat_mes_row, rl=r_rl_row, lucro=r_lucro_row, caixa=rc, trend=ctx.ind_trend)
    return ws


# ==========================================================================
# PONTO DE EQUILÍBRIO
# ==========================================================================
def ponto_equilibrio(wb, ctx):
    ws = wb.create_sheet(P.ABA_PE)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 46, "B": 18, "C": 18, "D": 60})
    U.titulo(ws, 1, "PONTO DE EQUILÍBRIO E MARGEM DE SEGURANÇA",
             "Quanto a empresa precisa faturar para não ter prejuízo (em reais e em quantidade de vendas), "
             "a margem de segurança e o faturamento necessário para atingir a meta de lucro.", span=4)
    U.mesclar(ws, "A3:D3",
              "As células amarelas (linhas 8 a 12) são premissas editáveis — já vêm preenchidas com os "
              "números reais apurados na aba LANÇAMENTOS. Os cálculos abaixo se ajustam automaticamente.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 22

    fat_mes = sf("Faturamento Bruto", mes=True)
    imp_mes = sf("Impostos sobre Vendas", mes=True)
    dev_mes = sf("Devoluções", mes=True)
    cv_mes = sf("Custos Variáveis", mes=True)
    df_mes = sf("Despesas Fixas", mes=True)
    dfin_mes = sf("Despesas Financeiras", mes=True)
    qtd = (f'IF({MES}=0,COUNTIFS({L_LINHA},"Faturamento Bruto",{L_ANO},{ANO},{L_NPARC},1),'
           f'COUNTIFS({L_LINHA},"Faturamento Bruto",{L_ANO},{ANO},{L_MES},{F_MES},{L_NPARC},1))')

    U.secao(ws, 6, "1. PREMISSAS DO CÁLCULO (editáveis)", span=4, altura=22)
    U.cabecalho(ws, 7, 1, ["Premissa", "Valor", "Como o sistema chega neste número"], "TH2", 22)
    B = {}
    premissas = [
        ("fat", "Faturamento bruto do período de análise", f'={fat_mes}', "IN_MONEY",
         "Soma dos lançamentos de Faturamento Bruto no mês (ou ano) de análise."),
        ("cvu", "Percentual de custos variáveis e impostos", f'=IFERROR(({cv_mes}+{imp_mes}+{dev_mes})/'
                                                              f'({fat_mes}),"")', "IN_PCT",
         "Custos variáveis + impostos sobre vendas + devoluções, divididos pelo faturamento."),
        ("fix", "Custos e despesas fixas do período", f'={df_mes}+{dfin_mes}', "IN_MONEY",
         "Despesas fixas + despesas financeiras: não variam com o volume de vendas."),
        ("tkt", "Ticket médio por venda", f'=IFERROR({fat_mes}/{qtd},"")', "IN_MONEY",
         "Faturamento dividido pela quantidade de vendas iniciadas no período."),
        ("meta", "Meta de lucro do período (vem da CONFIGURAÇÕES)", f'={META_LUCRO}', "IN_MONEY",
         "Lucro que a empresa quer atingir no período de análise."),
    ]
    for i, (chave, rot, f, est, como) in enumerate(premissas):
        r = 8 + i
        B[chave] = r
        put(ws, r, 1, rot, "TXT_B")
        put(ws, r, 2, f, est)
        U.mesclar(ws, f"C{r}:D{r}", como, "NOTA")
    U.dv_decimal(ws, f"B{B['fat']}", "greaterThanOrEqual", "0", "Valor inválido",
                 "Informe um valor maior ou igual a zero.")
    U.dv_decimal(ws, f"B{B['cvu']}", "between", "0", "0.95", "Percentual inválido",
                 "Informe entre 0% e 95% (ex.: 55% = 0,55).")
    U.dv_decimal(ws, f"B{B['fix']}", "greaterThanOrEqual", "0", "Valor inválido",
                 "Informe um valor maior ou igual a zero.")
    U.dv_decimal(ws, f"B{B['tkt']}", "greaterThan", "0", "Valor inválido",
                 "Informe um valor maior que zero.")

    U.secao(ws, 14, "2. CÁLCULOS DO PONTO DE EQUILÍBRIO", span=4, altura=22)
    U.cabecalho(ws, 15, 1, ["Resultado", "Valor", "Unidade", "Interpretação"], "TH2", 22)
    CHAVES = ["mc", "mcu", "pe_rs", "pe_qtd", "fat_at", "seg", "meta_rs", "lucro_at", "pe_pct",
              "dias", "conf"]
    C = {ch: 16 + i for i, ch in enumerate(CHAVES)}
    R_MC, R_MCU, R_PE, R_PEQ = C["mc"], C["mcu"], C["pe_rs"], C["pe_qtd"]
    R_FAT, R_SEG, R_META = C["fat_at"], C["seg"], C["meta_rs"]
    B_FAT, B_CVU, B_FIX, B_TKT, B_META = B["fat"], B["cvu"], B["fix"], B["tkt"], B["meta"]
    defs = [
        ("mc", "Margem de contribuição (%)", f'=1-$B${B_CVU}', "CALC_PCT", "%",
         "Quanto sobra de cada R$ vendido para pagar a estrutura fixa."),
        ("mcu", "Margem de contribuição unitária (MC unit.)", f'=$B${B_TKT}*$B${R_MC}', "CALC_MONEY",
         "R$/venda", "Quanto cada venda contribui para pagar a estrutura fixa."),
        ("pe_rs", "PONTO DE EQUILÍBRIO (R$ no período)", f'=IFERROR($B${B_FIX}/$B${R_MC},"")',
         "TOTAL_MONEY", "R$", "Faturamento mínimo para o lucro ser igual a zero."),
        ("pe_qtd", "PONTO DE EQUILÍBRIO (quantidade de vendas)",
         f'=IFERROR($B${R_PE}/$B${B_TKT},"")', "TOTAL_INT", "vendas",
         "Quantas vendas são necessárias para cobrir todos os custos."),
        ("fat_at", "Faturamento atual", f'=$B${B_FAT}', "CALC_MONEY", "R$",
         "Faturamento apurado no período de análise."),
        ("seg", "MARGEM DE SEGURANÇA (%)",
         f'=IFERROR(($B${R_FAT}-$B${R_PE})/$B${R_FAT},"")', "TOTAL_PCT", "%",
         "Quanto o faturamento pode cair antes de a empresa entrar no prejuízo."),
        ("meta_rs", "Faturamento necessário para a meta de lucro",
         f'=IFERROR(($B${B_FIX}+$B${B_META})/$B${R_MC},"")', "TOTAL_MONEY", "R$",
         "Faturamento que produz exatamente a meta de lucro definida."),
        ("lucro_at", "Lucro estimado mantendo o faturamento atual",
         f'=IFERROR($B${R_FAT}*$B${R_MC}-$B${B_FIX},"")', "CALC_MONEY", "R$",
         "Resultado esperado se o faturamento atual se repetir."),
        ("pe_pct", "Ponto de equilíbrio como % do faturamento atual",
         f'=IFERROR($B${R_PE}/$B${R_FAT},"")', "CALC_PCT", "%",
         "Distância entre o ponto de equilíbrio e o faturamento atual."),
        ("dias", "Dias úteis de venda para atingir o equilíbrio",
         f'=IFERROR(ROUND($B${R_PE}/($B${B_FAT}/22),1),"")', "CALC_INT", "dias",
         "Considerando 22 dias úteis no período de análise."),
        ("conf", "Conferência — lucro no ponto de equilíbrio (deve ser R$ 0,00)",
         f'=IFERROR($B${R_PE}*$B${R_MC}-$B${B_FIX},"")', "CALC_MONEY", "R$",
         "Teste do cálculo: no ponto de equilíbrio o lucro é zero."),
    ]
    for chave, rot, f, est, un, interp in defs:
        r = C[chave]
        destaque = chave in ("pe_rs", "pe_qtd", "seg", "meta_rs")
        put(ws, r, 1, rot, "TOTAL_TXT" if destaque else "CALC_TXT")
        put(ws, r, 2, f, est)
        put(ws, r, 3, un, "CALC_TXT_C")
        put(ws, r, 4, interp, "NOTA")
    rseg = C["seg"]
    U.cf_formula(ws, f"B{rseg}", f'=$B${rseg}<0.2', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, f"B{rseg}", f'=AND($B${rseg}>=0.2,$B${rseg}<0.4)', E.YEL_BG, E.YEL_TX, True)
    U.cf_formula(ws, f"B{rseg}", f'=$B${rseg}>=0.4', E.GREEN_BG, E.GREEN_TX, True)

    nome(wb, "PE_MC_UNIT", f"'{P.ABA_PE}'!$B${C['mcu']}")
    nome(wb, "PE_RS", f"'{P.ABA_PE}'!$B${C['pe_rs']}")
    nome(wb, "PE_QTD", f"'{P.ABA_PE}'!$B${C['pe_qtd']}")
    nome(wb, "MARGEM_SEGURANCA", f"'{P.ABA_PE}'!$B${C['seg']}")
    ctx.pe = dict(mc=C["mc"], rs=C["pe_rs"], qtd=C["pe_qtd"], seg=C["seg"], meta=C["meta_rs"])

    r_sim = C["conf"] + 3
    U.secao(ws, r_sim, "3. SIMULAÇÃO — RESULTADO EM DIFERENTES NÍVEIS DE FATURAMENTO", span=4, altura=22)
    U.cabecalho(ws, r_sim + 1, 1, ["Cenário de faturamento", "% do ponto de equilíbrio",
                                   "Faturamento simulado", "Vendas necessárias",
                                   "Custos variáveis e impostos", "Custos e despesas fixas",
                                   "Resultado", "Margem", "Status"], "TH2", 34)
    for i, pct in enumerate([0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5, 1.8, 2.0]):
        r = r_sim + 2 + i
        put(ws, r, 1, f'="Cenário {i+1}"', "CALC_TXT_C")
        put(ws, r, 2, pct, "CALC_PCT")
        put(ws, r, 3, f'=$B${R_PE}*$B{r}', "CALC_MONEY")
        put(ws, r, 4, f'=IFERROR($C{r}/$B${B_TKT},"")', "CALC_INT")
        put(ws, r, 5, f'=$C{r}*$B${B_CVU}', "CALC_MONEY")
        put(ws, r, 6, f'=$B${B_FIX}', "CALC_MONEY")
        put(ws, r, 7, f'=$C{r}-$E{r}-$F{r}', "TOTAL_MONEY" if pct == 1.0 else "CALC_MONEY")
        put(ws, r, 8, f'=IFERROR($G{r}/$C{r},"")', "CALC_PCT")
        put(ws, r, 9, f'=IF($G{r}<0,"🔴 Prejuízo",IF($G{r}=0,"🟡 Equilíbrio","🟢 Lucro"))', "CALC_TXT_C")
    U.cf_contem(ws, f"I{r_sim+2}:I{r_sim+10}", "Prejuízo", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, f"I{r_sim+2}:I{r_sim+10}", "Equilíbrio", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, f"I{r_sim+2}:I{r_sim+10}", "Lucro", E.GREEN_BG, E.GREEN_TX)
    U.cf_barras(ws, f"C{r_sim+2}:C{r_sim+10}", E.BLUE)

    ch = BarChart()
    ch.type = "col"
    ch.title = "Resultado por nível de faturamento (ponto de equilíbrio = 100%)"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=7, min_row=r_sim + 1, max_row=r_sim + 10), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=2, min_row=r_sim + 2, max_row=r_sim + 10))
    ch.legend = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 9, 18
    ws.add_chart(ch, f"F{r_sim}")
    ctx.chart_pe = ch
    U.preparar(ws, freeze="A8", tab_cor=E.TEAL, area_impressao=f"A1:D{r_sim+11}")
    ctx.ponto_equilibrio = ws
    return ws


# ==========================================================================
# SIMULADOR DE CENÁRIOS
# ==========================================================================
def simulador(wb, ctx):
    ws = wb.create_sheet(P.ABA_SIM)
    ws.sheet_view.showGridLines = False
    U.larguras(ws, {"A": 44, "B": 18, "C": 18, "D": 18, "E": 18, "F": 18, "G": 46})
    U.titulo(ws, 1, "SIMULADOR DE CENÁRIOS — ATUAL, OTIMISTA E CONSERVADOR",
             "Compare o efeito de variações no faturamento, nos custos, nas despesas fixas, nos impostos e "
             "na inadimplência sobre o lucro e o caixa dos próximos 12 meses.", span=6)
    U.mesclar(ws, "A3:G3",
              "As premissas do bloco 1 vêm dos números reais apurados na planilha. Os fatores do bloco 2 são "
              "editáveis: 1,00 = mantém o cenário atual, 1,10 = aumenta 10%, 0,90 = reduz 10%.", "NOTA_WRAP")
    ws.row_dimensions[3].height = 22

    fat_mes = sf("Faturamento Bruto", mes=True)
    cv_mes = sf("Custos Variáveis", mes=True)
    imp_mes = sf("Impostos sobre Vendas", mes=True)
    dev_mes = sf("Devoluções", mes=True)
    df_mes = sf("Despesas Fixas", mes=True)
    dfin_mes = sf("Despesas Financeiras", mes=True)
    ar_atraso = f'SUMIFS({L_SALDO},{L_TIPO},"Entrada",{L_SALDO},">0",{L_VENC},"<"&{HOJE})'
    saldo_atual = (f'{DISPONIVEL}+SUMIFS({L_VFINAL},{L_TIPO},"Entrada",{L_PAGTO},"<="&{HOJE})'
                   f'-SUMIFS({L_VFINAL},{L_TIPO},"Saída",{L_PAGTO},"<="&{HOJE})')

    U.secao(ws, 5, "1. PREMISSAS BASE (calculadas automaticamente no período de análise)", span=6, altura=22)
    U.cabecalho(ws, 6, 1, ["Premissa", "Valor", "Como é calculado"], "TH2", 22)
    B = {}
    base = [
        ("fat", "Faturamento bruto do período", f'={fat_mes}',
         "Soma do Faturamento Bruto na competência do mês (ou ano) de análise."),
        ("cv", "Custos variáveis do período", f'={cv_mes}', "Custos que acompanham o volume de vendas."),
        ("imp", "Impostos sobre vendas do período", f'={imp_mes}', "Tributos incidentes sobre as vendas."),
        ("dev", "Devoluções do período", f'={dev_mes}', "Vendas canceladas ou devolvidas."),
        ("df", "Despesas fixas do período", f'={df_mes}', "Estrutura administrativa, pessoal e comercial."),
        ("dfin", "Despesas financeiras do período", f'={dfin_mes}', "Juros, tarifas e encargos bancários."),
        ("caixa", "Saldo de caixa disponível hoje", f'={saldo_atual}',
         "Posição de caixa atual das contas bancárias mais as realizações."),
        ("inad", "Inadimplência do período", f'=IFERROR({ar_atraso}/{fat_mes},"")',
         "Vencido a receber dividido pelo faturamento do período."),
    ]
    for i, (chave, rot, f, como) in enumerate(base):
        r = 7 + i
        B[chave] = r
        put(ws, r, 1, rot, "TXT_B")
        put(ws, r, 2, f, "IN_PCT" if chave == "inad" else "IN_MONEY")
        U.mesclar(ws, f"C{r}:G{r}", como, "NOTA")

    U.secao(ws, 16, "2. FATORES DOS CENÁRIOS (editáveis)", span=6, altura=22)
    U.cabecalho(ws, 17, 1, ["Premissa", "Cenário atual", "Cenário otimista", "Cenário conservador",
                            "Comentário"], "TH2", 30)
    F = {}
    fatores = [
        ("fat", "Fator sobre o faturamento", 1.0, 1.1, 0.9, "Otimista: +10% de vendas; conservador: −10%."),
        ("cv", "Fator sobre os custos variáveis", 1.0, 1.05, 0.92, "Os custos acompanham as vendas."),
        ("df", "Fator sobre as despesas fixas", 1.0, 1.0, 1.0, "Mantenha 1,00 para não alterar a estrutura."),
        ("imp", "Fator sobre os impostos", 1.0, 1.0, 1.05, "Conservador: carga tributária 5% maior."),
        ("inad", "Fator sobre a inadimplência", 1.0, 0.8, 1.5, "Conservador: 50% mais clientes em atraso."),
    ]
    for i, (chave, rot, atual, otim, cons, com) in enumerate(fatores):
        r = 18 + i
        F[chave] = r
        put(ws, r, 1, rot, "TXT_B")
        put(ws, r, 2, atual, "IN_PCT")
        put(ws, r, 3, otim, "IN_PCT")
        put(ws, r, 4, cons, "IN_PCT")
        U.mesclar(ws, f"E{r}:G{r}", com, "NOTA")
    U.dv_decimal(ws, "B18:D22", "between", "0.5", "2", "Fator inválido",
                 "Informe um fator entre 0,50 e 2,00 (ex.: 1,10 = +10%).")

    U.secao(ws, 24, "3. RESULTADO PROJETADO PARA OS PRÓXIMOS 12 MESES", span=6, altura=22)
    U.cabecalho(ws, 25, 1, ["Linha projetada", "Cenário atual", "Cenário otimista",
                            "Cenário conservador", "Diferença (otimista − atual)",
                            "Como é calculado"], "TH2", 30)
    r_ini = 26
    fat = f'$B${B["fat"]}*12'
    imp = f'$B${B["imp"]}*12'
    dev = f'$B${B["dev"]}*12'
    cv = f'$B${B["cv"]}*12'
    dfx = f'$B${B["df"]}*12'
    dfin = f'$B${B["dfin"]}*12'
    # provisão de perdas: o vencido a receber atual (estoque), não a taxa mensal repetida 12 vezes
    inadp = f'$B${B["inad"]}*$B${B["fat"]}'
    cenarios = "BCD"
    linhas = [
        ("Faturamento bruto projetado",
         lambda c: f'={fat}*{c}${F["fat"]}', MONEY),
        ("(−) Impostos sobre as vendas",
         lambda c: f'=-{imp}*{c}${F["imp"]}*{c}${F["fat"]}', MONEY),
        ("(−) Devoluções",
         lambda c: f'=-{dev}*{c}${F["fat"]}', MONEY),
        ("(−) Custos variáveis",
         lambda c: f'=-{cv}*{c}${F["cv"]}', MONEY),
        ("▶ Margem de contribuição", None, "TOTAL"),
        ("(−) Despesas fixas",
         lambda c: f'=-{dfx}*{c}${F["df"]}', MONEY),
        ("(−) Despesas financeiras",
         lambda c: f'=-{dfin}*{c}${F["df"]}', MONEY),
        ("(−) Perdas por inadimplência (provisão do vencido atual)",
         lambda c: f'=-{inadp}*{c}${F["inad"]}', MONEY),
        ("▶ Lucro líquido projetado", None, "TOTAL"),
        ("Margem líquida projetada", None, "PCT"),
        ("▶ Caixa estimado em 12 meses (saldo atual + lucro projetado)", None, "TOTAL"),
    ]
    for i, (rot, f, est) in enumerate(linhas):
        r = r_ini + i
        put(ws, r, 1, rot, "TOTAL_TXT" if est == "TOTAL" else "CALC_TXT")
        for j, c in enumerate(cenarios):
            if f:
                put(ws, r, 2 + j, f(c), "TOTAL_MONEY" if est == "TOTAL" else "CALC_MONEY")
            elif est == "PCT":
                put(ws, r, 2 + j, f'=IFERROR({c}{r-1}/{c}{r_ini},"")', "TOTAL_PCT")
            elif i == 4:
                put(ws, r, 2 + j, f'={c}{r_ini}+{c}{r_ini+1}+{c}{r_ini+2}+{c}{r_ini+3}', "TOTAL_MONEY")
            elif i == 8:
                put(ws, r, 2 + j, f'={c}{r_ini+4}+{c}{r_ini+5}+{c}{r_ini+6}+{c}{r_ini+7}', "TOTAL_MONEY")
            else:
                put(ws, r, 2 + j, f'=$B${B["caixa"]}+{c}{r_ini+8}', "TOTAL_MONEY")
        put(ws, r, 5, f'=C{r}-B{r}', "CALC_PCT" if est == "PCT" else "CALC_MONEY")
        put(ws, r, 6, "Premissas do bloco 1 × fatores da coluna × 12 meses.", "NOTA")
    put(ws, r_ini + 7, 6,
        "Provisão calculada sobre o valor vencido a receber atual (estoque), ajustada pelo fator do "
        "cenário — não é a taxa mensal repetida 12 vezes.", "NOTA")
    ws.row_dimensions[r_ini + 7].height = 26
    r_lucro = r_ini + 8
    r_caixa = r_ini + 10
    U.cf_formula(ws, f"B{r_lucro}:D{r_lucro}", f'=B{r_lucro}<0', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, f"B{r_lucro}:D{r_lucro}", f'=B{r_lucro}>=0', E.GREEN_BG, E.GREEN_TX, True)
    U.cf_formula(ws, f"B{r_caixa}:D{r_caixa}", f'=B{r_caixa}<{SALDO_MIN}', E.RED_BG, E.RED_TX, True)
    U.cf_barras(ws, f"E{r_ini}:E{r_ini+3}", E.BLUE)

    r_mes = r_caixa + 3
    U.secao(ws, r_mes, "4. PROJEÇÃO MENSAL DE CAIXA POR CENÁRIO", span=6, altura=22)
    U.cabecalho(ws, r_mes + 1, 1, ["Mês", "Saldo inicial", "Entradas (cenário atual)",
                                   "Saídas (cenário atual)", "Saldo final (atual)",
                                   "Saldo final (otimista)", "Saldo final (conservador)"], "TH2", 30)

    def fluxo(c, m):
        g = f'(1+{META_CRESC})^{m-1}'
        ent = (f'$B${B["fat"]}*{g}*{c}${F["fat"]}*(1-$B${B["inad"]}*{c}${F["inad"]})')
        sai = (f'($B${B["cv"]}*{g}*{c}${F["cv"]}+$B${B["df"]}*{c}${F["df"]}+$B${B["dfin"]}*{c}${F["df"]}'
               f'+$B${B["imp"]}*{g}*{c}${F["imp"]}+$B${B["dev"]}*{g})')
        return ent, sai
    for m in range(1, 13):
        r = r_mes + 1 + m
        put(ws, r, 1, f'=TEXT(EDATE(DATE({ANO},{F_MES},1),{m-1}),"MM/AAAA")', "CALC_TXT_C")
        put(ws, r, 2, f'=$B${B["caixa"]}' if m == 1 else f'=$E{r-1}', "CALC_MONEY")
        e_a, s_a = fluxo("B", m)
        put(ws, r, 3, f'={e_a}', "CALC_MONEY")
        put(ws, r, 4, f'={s_a}', "CALC_MONEY")
        put(ws, r, 5, f'=$B{r}+$C{r}-$D{r}', "TOTAL_MONEY")
        e_o, s_o = fluxo("C", m)
        e_c, s_c = fluxo("D", m)
        base_prev = f'$B${B["caixa"]}' if m == 1 else f'$F{r-1}'
        base_prev_c = f'$B${B["caixa"]}' if m == 1 else f'$G{r-1}'
        put(ws, r, 6, f'={base_prev}+({e_o})-({s_o})', "CALC_MONEY")
        put(ws, r, 7, f'={base_prev_c}+({e_c})-({s_c})', "CALC_MONEY")
    r_ult = r_mes + 13
    U.cf_formula(ws, f"E{r_mes+2}:E{r_ult}", f'=E{r_mes+2}<{SALDO_MIN}', E.RED_BG, E.RED_TX, True)
    U.cf_formula(ws, f"F{r_mes+2}:F{r_ult}", f'=F{r_mes+2}<{SALDO_MIN}', E.YEL_BG, E.YEL_TX, True)
    U.cf_formula(ws, f"G{r_mes+2}:G{r_ult}", f'=G{r_mes+2}<{SALDO_MIN}', E.RED_BG, E.RED_TX, True)
    U.mesclar(ws, f"A{r_ult+2}:G{r_ult+2}",
              "Como usar: ajuste os fatores do bloco 2 e observe o lucro (bloco 3) e o caixa (bloco 4). "
              "O cenário conservador mostra o que acontece se as vendas caírem e a inadimplência aumentar: "
              "use-o para dimensionar reservas e cortes preventivos.", "NOTA_WRAP")
    ws.row_dimensions[r_ult + 2].height = 30

    ch = BarChart()
    ch.type = "col"
    ch.grouping = "clustered"
    ch.title = "Lucro líquido projetado por cenário (12 meses)"
    ch.style = 2
    ch.add_data(Reference(ws, min_col=2, max_col=4, min_row=r_lucro, max_row=r_lucro),
                from_rows=True, titles_from_data=False)
    ch.set_categories(Reference(ws, min_col=2, max_col=4, min_row=25, max_row=25))
    ch.legend = None
    ch.y_axis.numFmt = 'R$ #,##0'
    ch.height, ch.width = 8, 16
    ws.add_chart(ch, f"I{r_ini}")
    ctx.chart_sim = ch

    lc = LineChart()
    lc.title = "Evolução do caixa projetado por cenário"
    lc.style = 2
    lc.add_data(Reference(ws, min_col=5, max_col=7, min_row=r_mes + 1, max_row=r_ult), titles_from_data=True)
    lc.set_categories(Reference(ws, min_col=1, min_row=r_mes + 2, max_row=r_ult))
    lc.y_axis.numFmt = 'R$ #,##0'
    lc.height, lc.width = 8, 16
    ws.add_chart(lc, f"I{r_mes}")
    ctx.chart_sim_caixa = lc

    U.preparar(ws, freeze="A7", tab_cor="ED7D31", area_impressao=f"A1:G{r_ult+3}")
    ctx.simulador = ws
    return ws
