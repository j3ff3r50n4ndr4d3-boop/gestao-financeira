"""Aba CONFIGURAÇÕES — identificação da empresa, parâmetros financeiros e listas auxiliares."""
from openpyxl.comments import Comment

from lib import dados_exemplo as D
from lib import estilos as E
from lib import parametros as P
from lib import plano_contas as PC
from lib import util as U
from lib.util import L, R, faixa, nome, put


def construir(wb, ctx):
    ws = wb.create_sheet(P.ABA_CONFIG)
    cfg = {}
    U.larguras(ws, {"A": 44, "B": 20, "C": 22, "D": 2, "E": 2})
    for col in "FGHIJKLMNOPQRSTUVWX":
        ws.column_dimensions[col].width = 15

    U.titulo(ws, 1, "CONFIGURAÇÕES DO SISTEMA FINANCEIRO",
             "Passo 1 do roteiro: informe os dados da empresa, as metas e os parâmetros. "
             "As listas auxiliares (colunas F a X) alimentam todos os menus suspensos da planilha.",
             span=8)

    # ------------------------------------------------------- 1. EMPRESA
    U.secao(ws, 4, "1. IDENTIFICAÇÃO DA EMPRESA", span=8)
    empresa = [
        (5, "Razão social", "razao", D.CFG_CIA["razao"], None, "Empresa demonstrativa (dados fictícios)"),
        (6, "Nome fantasia", "fantasia", D.CFG_CIA["fantasia"], None, None),
        (7, "CNPJ", "cnpj", D.CFG_CIA["cnpj"], None, None),
        (8, "Segmento de atuação", "segmento", D.CFG_CIA["segmento"], None, None),
        (9, "Regime tributário", "regime", D.CFG_CIA["regime"], "REGIME", "Define o tratamento dos tributos"),
        (10, "Responsável financeiro", "responsavel", D.CFG_CIA["responsavel"], None, None),
        (11, "E-mail", "email", D.CFG_CIA["email"], None, None),
        (12, "Telefone", "telefone", D.CFG_CIA["telefone"], None, None),
    ]
    for row, rotulo, chave, valor, lista, obs in empresa:
        put(ws, row, 1, rotulo, "TXT_B")
        U.mesclar(ws, f"B{row}:C{row}", valor, "IN_TXT" if lista != "REGIME" else "IN_TXT")
        if lista:
            U.dv_lista(ws, f"B{row}:C{row}", lista, "Regime inválido",
                       "Escolha um regime tributário da lista.")
        if obs:
            put(ws, row, 5, obs, "NOTA")
        cfg[chave] = f"'{P.ABA_CONFIG}'!$B${row}"

    # ------------------------------------------------------- 2. PERÍODO
    U.secao(ws, 14, "2. PERÍODO DE REFERÊNCIA E FILTROS", span=8)
    put(ws, 15, 1, "Data de referência (HOJE — automática)", "TXT_B")
    U.mesclar(ws, "B15:C15", "=TODAY()", "CALC_DATE")
    put(ws, 15, 5, "Todas as classificações automáticas (vencido, vence hoje, dias em atraso) usam esta data.", "NOTA")
    put(ws, 16, 1, "Ano atual", "TXT_B")
    U.mesclar(ws, "B16:C16", "=YEAR($B$15)", "CALC_INT")
    put(ws, 17, 1, "Mês atual", "TXT_B")
    U.mesclar(ws, "B17:C17", "=MONTH($B$15)", "CALC_INT")
    put(ws, 18, 1, "Ano de análise (usado no Dashboard, DRE e relatórios)", "TXT_B")
    U.mesclar(ws, "B18:C18", D.ANO, "IN_INT")
    U.dv_inteiro(ws, "B18:C18", "between", "2000", "2100", "Ano inválido", "Informe um ano entre 2000 e 2100.")
    put(ws, 19, 1, "Mês de análise (1 a 12 — 0 = todos os meses)", "TXT_B")
    U.mesclar(ws, "B19:C19", D.MES, "IN_INT")
    U.dv_inteiro(ws, "B19:C19", "between", "0", "12", "Mês inválido", "Informe 0 (todos) ou um mês de 1 a 12.")
    put(ws, 15, 7, "Ano/mês de análise", "NOTA")
    put(ws, 16, 7, "B18 e B19 são os parâmetros usados pelo Dashboard e pelas análises.", "NOTA")

    # ------------------------------------------------------- 3. METAS
    U.secao(ws, 21, "3. METAS E PARÂMETROS FINANCEIROS", span=8)
    metas = [
        (22, "Meta de faturamento mensal", "meta_fat", D.CFG_CIA["meta_fat"], "IN_MONEY0",
         "Usada nos alertas de meta de faturamento e no orçamento."),
        (23, "Meta de lucro líquido mensal", "meta_lucro", D.CFG_CIA["meta_lucro"], "IN_MONEY0",
         "Base do alerta de meta de lucro."),
        (24, "Margem líquida mínima desejada", "margem_min", D.CFG_CIA["margem_min"], "IN_PCT",
         "Margem abaixo deste valor gera alerta amarelo/vermelho."),
        (25, "Saldo mínimo de caixa", "saldo_min", D.CFG_CIA["saldo_min"], "IN_MONEY0",
         "Alerta vermelho quando o saldo disponível ficar abaixo deste valor."),
        (26, "Percentual máximo de inadimplência", "inad_max", D.CFG_CIA["inad_max"], "IN_PCT",
         "Alerta quando o vencido a receber superar este percentual."),
        (27, "Prazo médio de recebimento — alvo (dias)", "pmr_alvo", D.CFG_CIA["pmr_alvo"], "IN_INT",
         "Compare com o prazo médio real apurado na aba CONTAS A RECEBER."),
        (28, "Prazo médio de pagamento — alvo (dias)", "pmp_alvo", D.CFG_CIA["pmp_alvo"], "IN_INT",
         "Compare com o prazo médio real apurado na aba CONTAS A PAGAR."),
        (29, "Alíquota efetiva de impostos sobre vendas", "aliquota", D.CFG_CIA["aliquota"], "IN_PCT",
         "Usada no Simples Nacional, no ponto de equilíbrio e no simulador de cenários."),
        (30, "Taxa de juros mensal padrão (empréstimos)", "taxa_padrao", D.CFG_CIA["taxa_padrao"], "IN_PCT",
         "Sugestão para novos contratos de crédito."),
        (31, "Meta de crescimento mensal do faturamento", "meta_cresc", D.CFG_CIA["meta_cresc"], "IN_PCT",
         "Usada na projeção de cenários."),
        (32, "Reserva mínima de capital de giro (meses de despesa fixa)", "reserva_giro", D.CFG_CIA["reserva_giro"], "IN_INT",
         "Saldo recomendado = reserva × despesas fixas mensais."),
    ]
    for row, rotulo, chave, valor, estilo, obs in metas:
        put(ws, row, 1, rotulo, "TXT_B")
        U.mesclar(ws, f"B{row}:C{row}", valor, estilo)
        put(ws, row, 5, obs, "NOTA")
        cfg[chave] = f"'{P.ABA_CONFIG}'!$B${row}"
    # ------------------------------------------------------- 4. LISTAS
    U.secao(ws, 33, "4. LISTAS AUXILIARES — ALIMENTAM OS MENUS SUSPENSOS "
                    "(para incluir um item, insira uma linha dentro da lista)", span=8)
    listas = [
        ("TIPO_LANCAMENTO", "Tipo de lançamento", ["Entrada", "Saída"]),
        ("SITUACAO", "Situação", ["Previsto", "Pago", "Recebido", "Vencido", "Cancelado", "Parcial"]),
        ("FORMA_PAGAMENTO", "Forma de pagamento",
         ["Dinheiro", "PIX", "Transferência", "Boleto", "Cartão de débito", "Cartão de crédito",
          "Crédito parcelado", "Débito automático", "Outros"]),
        ("TIPO_CONTA", "Tipo de conta",
         ["Receita", "Custo", "Despesa", "Imposto", "Investimento", "Pró-labore", "Empréstimo",
          "Devolução", "Aporte de Capital", "Distribuição de lucros"]),
        ("STATUS_CADASTRO", "Status (cliente/fornecedor)", ["Ativo", "Inativo", "Bloqueado"]),
        ("PERIODICIDADE", "Periodicidade", ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"]),
        ("SISTEMA_AMORTIZACAO", "Sistema de amortização", ["PRICE", "SAC"]),
        ("TIPO_FLUXO", "Tipo de fluxo", ["Operacional", "Investimento", "Financiamento"]),
        ("BANDEIRA", "Bandeira do cartão",
         ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outros"]),
        ("STATUS_CONCILIACAO", "Conciliação bancária", ["Conciliado", "Pendente", "Divergente"]),
        ("SIM_NAO", "Sim / Não", ["Sim", "Não"]),
        ("REGIME", "Regime tributário", ["Simples Nacional", "MEI", "Lucro Presumido", "Lucro Real"]),
        ("UF", "UF", ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
                      "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]),
        ("MESES", "Meses", ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
                            "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]),
        ("TIPO_OPERACAO", "Tipo de operação", ["Todos", "Entrada", "Saída"]),
        ("SUBGRUPOS", "Categoria (grupo do plano de contas)", PC.SUBGRUPOS),
        ("STATUS_CONTRATO", "Status do contrato", ["Em andamento", "Quitado", "Renegociado", "Em atraso"]),
        ("LINHAS_DRE", "Linhas do DRE", PC.LINHAS_DRE),
    ]
    col = 6   # F
    for chave, titulo, valores in listas:
        c = L(col)
        U.mesclar(ws, f"{c}34:{c}35", titulo, "TH2")
        ws.row_dimensions[34].height = 30
        for i, v in enumerate(valores):
            put(ws, 36 + i, col, v, "TXT_C")
        # intervalo nomeado com exatamente os valores (menu limpo)
        nome(wb, chave, f"'{P.ABA_CONFIG}'!${c}${36}:${c}${36 + len(valores) - 1}")
        col += 1

    put(ws, 68, 6, "OBS.: os menus suspensos apontam para os intervalos nomeados acima. "
                   "Para acrescentar uma opção, insira uma linha dentro da lista (a última linha) "
                   "— o intervalo nomeado se expande automaticamente.", "NOTA_WRAP")
    U.mesclar(ws, "F68:X70")

    # validações dos parâmetros
    for ref, estilo in [("B24:C24", "pct"), ("B26:C26", "pct"), ("B29:C29", "pct"), ("B31:C31", "pct")]:
        U.dv_decimal(ws, ref, "between", "0", "1", "Percentual inválido",
                     "Informe um percentual entre 0% e 100% (ex.: 8% = 0,08).")
    for ref in ["B22:C22", "B23:C23", "B25:C25"]:
        U.dv_decimal(ws, ref, "greaterThanOrEqual", "0", "Valor inválido",
                     "Informe um valor em reais maior ou igual a zero.")
    U.dv_inteiro(ws, "B27:C27", "between", "0", "365", "Prazo inválido", "Informe um prazo em dias (0 a 365).")
    U.dv_inteiro(ws, "B28:C28", "between", "0", "365", "Prazo inválido", "Informe um prazo em dias (0 a 365).")
    U.dv_inteiro(ws, "B32:C32", "between", "0", "24", "Valor inválido", "Informe a quantidade de meses (0 a 24).")

    # comentários explicativos
    ws["B24"].comment = Comment("Margem líquida = Lucro líquido ÷ Receita líquida.", "Planilha")
    ws["B25"].comment = Comment("Saldo disponível = saldo das contas correntes (não inclui cartões).", "Planilha")
    ws["B26"].comment = Comment("Percentual de inadimplência = vencido a receber ÷ faturamento do período.", "Planilha")

    U.preparar(ws, freeze="A4", tab_cor=E.NAVY, paisagem=False, area_impressao="A1:C32", zoom=100)
    ctx.cfg = cfg
    return ws
