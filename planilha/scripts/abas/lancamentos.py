"""Aba LANÇAMENTOS — base central de entradas, saídas, contas a pagar e a receber."""
from openpyxl.comments import Comment

from lib import dados_exemplo as D
from lib import estilos as E
from lib import parametros as P
from lib import util as U
from lib.util import L, R, nome, put

C = P.LANC_COL
INI, FIM = P.LANC_INI, P.LANC_FIM
GUARD = 'COUNTA($B{r}:$R{r})=0'


def _c(nome_col, linha):
    return f"${L(C[nome_col])}{linha}"


def construir(wb, ctx):
    ws = wb.create_sheet(P.ABA_LANC)
    larg = {"A": 9, "B": 12, "C": 12, "D": 13, "E": 10, "F": 24, "G": 34, "H": 16, "I": 40, "J": 46,
            "K": 14, "L": 30, "M": 18, "N": 30, "O": 8, "P": 8, "Q": 14, "R": 14, "S": 11, "T": 11,
            "U": 12, "V": 14, "W": 14, "X": 12, "Y": 16, "Z": 7, "AA": 7, "AB": 8, "AC": 12, "AD": 12,
            "AE": 14, "AF": 26, "AG": 16, "AH": 22, "AI": 10, "AJ": 10, "AK": 10, "AL": 13, "AM": 12,
            "AN": 12, "AO": 34}
    U.larguras(ws, larg)

    U.titulo(ws, 1, "LANÇAMENTOS — BASE CENTRAL DE ENTRADAS E SAÍDAS",
             "Cada linha é um lançamento. Colunas amarelas = você digita • Colunas cinzas = cálculo "
             "automático (não editar). Contas a pagar e a receber saem desta base.", span=12)
    U.mesclar(ws, "A3:AO3",
              "COMO USAR: 1) informe as datas e escolha tipo, categoria, subcategoria, centro de custo e "
              "cliente/fornecedor nas listas; 2) preencha o valor previsto; 3) ao pagar/receber, informe a data e o "
              "valor realizado e mude o status para Pago/Recebido. O sistema classifica vencimentos, atrasos, DRE e fluxo de caixa.",
              "NOTA_WRAP")
    ws.row_dimensions[3].height = 26
    U.mesclar(ws, "A4:AO4",
              "⚠ DADOS DE EXEMPLO: as linhas já preenchidas são fictícias (demonstração). Para começar do zero, "
              "selecione as linhas de dados nas colunas A a X e pressione Delete — as fórmulas das colunas Y a AO "
              "permanecem e continuam funcionando.", "NOTA_WRAP")
    ws.row_dimensions[4].height = 26

    headers = ["ID", "Data de competência", "Data de vencimento", "Data de pagamento/recebimento", "Tipo",
               "Categoria", "Subcategoria", "Centro de custo", "Cliente / Fornecedor", "Descrição",
               "Documento", "Banco / Conta", "Forma de pagamento", "Cartão", "Nº parcela", "Total parcelas",
               "Valor previsto", "Valor realizado", "Juros", "Multa", "Desconto", "Valor final (caixa)",
               "Saldo em aberto", "Status", "Situação automática", "Mês", "Ano", "Semana", "Dia da semana",
               "Competência", "Valor DRE", "Linha do DRE", "Tipo de fluxo", "Grupo", "Dias p/ vencimento",
               "Dias em atraso", "Dias até pagamento", "Valor × dias", "Chave AP (ordem)",
               "Chave AR (ordem)", "Validação automática"]
    U.cabecalho(ws, 5, 1, headers, "TH", 44)

    # ---------------------------------------------------------- estilos das colunas
    entrada = {"A": "IN_TXT_C", "B": "IN_DATE", "C": "IN_DATE", "D": "IN_DATE", "E": "IN_TXT_C",
               "F": "IN_TXT", "G": "IN_TXT", "H": "IN_TXT", "I": "IN_TXT", "J": "IN_TXT",
               "K": "IN_TXT_C", "L": "IN_TXT", "M": "IN_TXT_C", "N": "IN_TXT", "O": "IN_INT",
               "P": "IN_INT", "Q": "IN_MONEY", "R": "IN_MONEY", "S": "IN_MONEY", "T": "IN_MONEY",
               "U": "IN_MONEY", "X": "IN_TXT_C"}
    calculo = {"V": "CALC_MONEY", "W": "CALC_MONEY", "Y": "CALC_TXT_C", "Z": "CALC_INT", "AA": "CALC_INT",
               "AB": "CALC_INT", "AC": "CALC_TXT_C", "AD": "CALC_TXT_C", "AE": "CALC_MONEY",
               "AF": "CALC_TXT", "AG": "CALC_TXT_C", "AH": "CALC_TXT", "AI": "CALC_INT", "AJ": "CALC_INT",
               "AK": "CALC_INT", "AL": "CALC_MONEY", "AM": "CALC_TXT_C", "AN": "CALC_TXT_C",
               "AO": "CALC_TXT"}
    for col, est in entrada.items():
        for r in range(INI, FIM + 1):
            ws[f"{col}{r}"].style = est
    for col, est in calculo.items():
        for r in range(INI, FIM + 1):
            ws[f"{col}{r}"].style = est

    # ---------------------------------------------------------- dados de exemplo
    for i, l in enumerate(D.LANCAMENTOS):
        r = INI + i
        val = {1: l["id"], 2: l["comp"], 3: l["venc"], 4: l["pagto"], 5: l["tipo"], 6: l["cat"],
               7: l["subcat"], 8: l["cc"], 9: l["entidade"], 10: l["desc"], 11: l["doc"],
               12: l["banco"], 13: l["forma"], 14: l["cartao"] or None, 15: l["nparc"], 16: l["tparc"],
               17: l["vprev"], 18: l["vreal"], 19: l["juros"] if l["juros"] else None,
               20: l["multa"] if l["multa"] else None, 21: l["desconto"] if l["desconto"] else None,
               24: l["status"]}
        for col, v in val.items():
            if v is not None:
                ws.cell(row=r, column=col, value=v)

    # ---------------------------------------------------------- fórmulas automáticas
    for r in range(INI, FIM + 1):
        guard = GUARD.format(r=r)
        # Valor final de caixa
        put(ws, r, C["VFINAL"],
            f'=IF({guard},"",ROUND(N({_c("VREAL",r)})+N({_c("JUROS",r)})+N({_c("MULTA",r)})'
            f'-N({_c("DESCONTO",r)}),2))')
        # Saldo em aberto
        put(ws, r, C["SALDO"],
            f'=IF({guard},"",IF(OR({_c("STATUS",r)}="Pago",{_c("STATUS",r)}="Recebido",'
            f'{_c("STATUS",r)}="Cancelado"),0,ROUND(N({_c("VPREV",r)})+N({_c("JUROS",r)})'
            f'+N({_c("MULTA",r)})-N({_c("DESCONTO",r)})-N({_c("VREAL",r)}),2)))')
        # Situação automática
        put(ws, r, C["SITUACAO"],
            f'=IF({guard},"",'
            f'IF({_c("STATUS",r)}="Cancelado","Cancelado",'
            f'IF(OR({_c("STATUS",r)}="Pago",{_c("STATUS",r)}="Recebido"),{_c("STATUS",r)},'
            f'IF(OR({_c("STATUS",r)}="Parcial",N({_c("VREAL",r)})>0),"Parcial",'
            f'IF({_c("VENC",r)}="","Sem vencimento",'
            f'IF({_c("VENC",r)}<TODAY(),"Vencido",'
            f'IF({_c("VENC",r)}=TODAY(),"Vence hoje",'
            f'IF({_c("VENC",r)}<=TODAY()+7,"Vence em 7 dias",'
            f'IF({_c("VENC",r)}<=TODAY()+30,"Vence em 30 dias","Futuro")))))))))')
        put(ws, r, C["MES"], f'=IF({_c("COMP",r)}="","",MONTH({_c("COMP",r)}))')
        put(ws, r, C["ANO"], f'=IF({_c("COMP",r)}="","",YEAR({_c("COMP",r)}))')
        put(ws, r, C["SEMANA"], f'=IF({_c("COMP",r)}="","",ISOWEEKNUM({_c("COMP",r)}))')
        put(ws, r, C["DIASEM"],
            f'=IF({_c("COMP",r)}="","",CHOOSE(WEEKDAY({_c("COMP",r)},2),"Segunda","Terça","Quarta",'
            f'"Quinta","Sexta","Sábado","Domingo"))')
        put(ws, r, C["COMPET"], f'=IF({_c("COMP",r)}="","",TEXT({_c("COMP",r)},"MM/AAAA"))')
        put(ws, r, C["VDRE"],
            f'=IF({guard},"",IF({_c("STATUS",r)}="Cancelado",0,ROUND(N({_c("VPREV",r)})'
            f'+N({_c("JUROS",r)})+N({_c("MULTA",r)})-N({_c("DESCONTO",r)}),2)))')
        put(ws, r, C["LINHADRE"],
            f'=IF({_c("SUBCAT",r)}="","",IFERROR(INDEX(LINHAS_DRE_PLANO,MATCH({_c("SUBCAT",r)},'
            f'SUBCATEGORIAS_PLANO,0)),"Não classificado"))')
        put(ws, r, C["FLUXO"],
            f'=IF({_c("SUBCAT",r)}="","",IFERROR(INDEX(TIPOS_FLUXO_PLANO,MATCH({_c("SUBCAT",r)},'
            f'SUBCATEGORIAS_PLANO,0)),"Não classificado"))')
        put(ws, r, C["GRUPO"],
            f'=IF({_c("SUBCAT",r)}="","",IFERROR(INDEX(GRUPOS_PLANO,MATCH({_c("SUBCAT",r)},'
            f'SUBCATEGORIAS_PLANO,0)),"Não classificado"))')
        put(ws, r, C["DIASVENC"],
            f'=IF(OR({_c("VENC",r)}="",{_c("STATUS",r)}="Pago",{_c("STATUS",r)}="Recebido",'
            f'{_c("STATUS",r)}="Cancelado"),"",{_c("VENC",r)}-TODAY())')
        put(ws, r, C["DIASATR"],
            f'=IF(OR({_c("VENC",r)}="",{_c("STATUS",r)}="Pago",{_c("STATUS",r)}="Recebido",'
            f'{_c("STATUS",r)}="Cancelado"),0,MAX(0,TODAY()-{_c("VENC",r)}))')
        put(ws, r, C["DIASPAG"], f'=IF({_c("PAGTO",r)}="","",{_c("PAGTO",r)}-{_c("COMP",r)})')
        put(ws, r, C["VALXDIAS"],
            f'=IF(OR({_c("PAGTO",r)}="",{_c("COMP",r)}=""),"",ROUND(N({_c("VREAL",r)})'
            f'*({_c("PAGTO",r)}-{_c("COMP",r)}),2))')
        put(ws, r, C["CHAVEAP"],
            f'=IF(AND({_c("TIPO",r)}="Saída",{_c("SALDO",r)}>0,{_c("VENC",r)}<>""),'
            f'{_c("VENC",r)}+ROW()/1000000,"")')
        put(ws, r, C["CHAVEAR"],
            f'=IF(AND({_c("TIPO",r)}="Entrada",{_c("SALDO",r)}>0,{_c("VENC",r)}<>""),'
            f'{_c("VENC",r)}+ROW()/1000000,"")')
        put(ws, r, C["VALIDA"],
            f'=IF({guard},"",'
            f'IF(AND({_c("ENTIDADE",r)}<>"",COUNTIF(CLIENTES_NOMES,{_c("ENTIDADE",r)})'
            f'+COUNTIF(CLIENTES_FANTASIA,{_c("ENTIDADE",r)})'
            f'+COUNTIF(FORNECEDORES_NOMES,{_c("ENTIDADE",r)})'
            f'+COUNTIF(FORNECEDORES_FANTASIA,{_c("ENTIDADE",r)})=0),"⚠ Cliente/Fornecedor não cadastrado",'
            f'IF(AND({_c("SUBCAT",r)}<>"",COUNTIF(SUBCATEGORIAS_PLANO,{_c("SUBCAT",r)})=0),'
            f'"⚠ Subcategoria fora do plano de contas",'
            f'IF(OR({_c("VPREV",r)}="",N({_c("VPREV",r)})=0),"⚠ Valor previsto não informado",'
            f'IF(AND(OR({_c("STATUS",r)}="Pago",{_c("STATUS",r)}="Recebido"),{_c("PAGTO",r)}=""),'
            f'"⚠ Status pago/recebido sem data",'
            f'IF(AND({_c("PAGTO",r)}<>"",N({_c("VREAL",r)})=0),"⚠ Data de pagamento sem valor realizado",'
            f'IF(AND(N({_c("TPARC",r)})>1,N({_c("NPARC",r)})>N({_c("TPARC",r)})),'
            f'"⚠ Nº da parcela maior que o total",'
            f'IF(AND({_c("VENC",r)}<>"",{_c("COMP",r)}<>"",{_c("VENC",r)}<{_c("COMP",r)}),'
            f'"⚠ Vencimento anterior à competência","OK"))))))))')

    # ---------------------------------------------------------- validações de dados
    U.dv_lista(ws, f"E{INI}:E{FIM}", "TIPO_LANCAMENTO", "Tipo inválido", "Escolha Entrada ou Saída.")
    U.dv_lista(ws, f"F{INI}:F{FIM}", "SUBGRUPOS", "Categoria inválida",
               "Escolha uma categoria da lista (aba CONFIGURAÇÕES).")
    U.dv_lista(ws, f"G{INI}:G{FIM}", "SUBCATEGORIAS_PLANO", "Subcategoria inválida",
               "Escolha uma subcategoria cadastrada no PLANO DE CONTAS.")
    U.dv_lista(ws, f"H{INI}:H{FIM}", "CENTROS_CUSTO", "Centro de custo inválido",
               "Escolha um centro de custo cadastrado.")
    U.dv_lista(ws, f"I{INI}:I{FIM}", "CLIENTES_NOMES", "Cliente/Fornecedor",
               "Dica: escolha um nome cadastrado ou digite exatamente como está no cadastro.",
               estilo="warning")
    U.dv_lista(ws, f"L{INI}:L{FIM}", "CONTAS_BANCARIAS", "Conta inválida",
               "Escolha uma conta bancária cadastrada (aba CONTAS BANCÁRIAS).")
    U.dv_lista(ws, f"M{INI}:M{FIM}", "FORMA_PAGAMENTO", "Forma inválida",
               "Escolha uma forma de pagamento da lista.")
    U.dv_lista(ws, f"N{INI}:N{FIM}", "CARTOES", "Cartão inválido",
               "Escolha um cartão cadastrado (aba CARTÕES) ou deixe em branco.")
    U.dv_lista(ws, f"X{INI}:X{FIM}", "SITUACAO", "Status inválido",
               "Escolha: Previsto, Pago, Recebido, Cancelado ou Parcial (Vencido é automático).")
    U.dv_data(ws, f"B{INI}:D{FIM}")
    U.dv_decimal(ws, f"Q{INI}:U{FIM}", "greaterThanOrEqual", "0", "Valor inválido",
                 "Informe um valor maior ou igual a zero.")
    U.dv_inteiro(ws, f"O{INI}:P{FIM}", "between", "1", "360", "Parcela inválida",
                 "Informe um número de parcela entre 1 e 360.")

    # ---------------------------------------------------------- formatação condicional
    rng_sit = f"{L(C['SITUACAO'])}{INI}:{L(C['SITUACAO'])}{FIM}"
    U.cf_contem(ws, rng_sit, "Vencido", E.RED_BG, E.RED_TX)
    U.cf_contem(ws, rng_sit, "Vence hoje", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, rng_sit, "Vence em 7 dias", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, rng_sit, "Pago", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, rng_sit, "Recebido", E.GREEN_BG, E.GREEN_TX)
    U.cf_contem(ws, rng_sit, "Parcial", E.YEL_BG, E.YEL_TX)
    U.cf_contem(ws, rng_sit, "Cancelado", E.NEUTRAL_BG, E.GRAY_TEXT)
    rng_val = f"{L(C['VALIDA'])}{INI}:{L(C['VALIDA'])}{FIM}"
    U.cf_sem_erro(ws, rng_val)
    U.cf_contem(ws, rng_val, "OK", E.GREEN_BG, E.GREEN_TX)
    rng_saldo = f"{L(C['SALDO'])}{INI}:{L(C['SALDO'])}{FIM}"
    U.cf_maior(ws, rng_saldo, 0, None)
    U.cf_formula(ws, rng_saldo, f"AND({L(C['SALDO'])}{INI}>0,{L(C['TIPO'])}{INI}=\"Saída\")", None, E.RED_TX)
    U.cf_formula(ws, rng_saldo, f"AND({L(C['SALDO'])}{INI}>0,{L(C['TIPO'])}{INI}=\"Entrada\")", None, "1F6F3F")
    U.cf_barras(ws, f"{L(C['VPREV'])}{INI}:{L(C['VPREV'])}{FIM}", E.BLUE)
    U.cf_escala(ws, f"{L(C['DIASATR'])}{INI}:{L(C['DIASATR'])}{FIM}")

    # comentários nas colunas de cálculo
    ws[f"{L(C['VFINAL'])}5"].comment = Comment(
        "Valor final = valor realizado + juros + multa − desconto (movimento efetivo de caixa).", "Planilha")
    ws[f"{L(C['SALDO'])}5"].comment = Comment(
        "Quanto ainda falta pagar/receber: previsto + juros + multa − desconto − realizado.", "Planilha")
    ws[f"{L(C['SITUACAO'])}5"].comment = Comment(
        "Classificação automática: Vencido, Vence hoje, Vence em 7/30 dias, Futuro, Pago, Recebido, Parcial.", "Planilha")
    ws[f"{L(C['VALIDA'])}5"].comment = Comment(
        "Verifica cliente/fornecedor cadastrado, subcategoria do plano de contas, valores e parcelas.", "Planilha")

    # colunas de apoio ocultas
    for col in ("AL", "AM", "AN"):
        ws.column_dimensions[col].hidden = True

    nome(wb, "LANC_ID", P.rng("ID"))
    U.preparar(ws, freeze="F6", filtro=f"A5:AO{FIM}", repetir_linhas="5:5", tab_cor=E.NAVY,
               area_impressao=f"A5:AO{FIM}")
    ctx.lancamentos = ws
    return ws
