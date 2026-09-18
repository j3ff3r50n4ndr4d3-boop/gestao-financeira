"""
parametros.py — Nomes das abas, capacidades das tabelas, mapa de colunas da
aba LANÇAMENTOS e âncoras de referência usadas pelas fórmulas.
"""
from openpyxl.utils import get_column_letter

# --------------------------------------------------------------------- ABAS
ABA_PAINEL  = "PAINEL DE CONTROLE"
ABA_INSTR   = "INSTRUÇÕES"
ABA_DASH    = "DASHBOARD"
ABA_CONFIG  = "CONFIGURAÇÕES"
ABA_CLI     = "CADASTRO DE CLIENTES"
ABA_FORN    = "CADASTRO DE FORNECEDORES"
ABA_PLANO   = "PLANO DE CONTAS"
ABA_CC      = "CENTRO DE CUSTOS"
ABA_BANCOS  = "CONTAS BANCÁRIAS"
ABA_CARTOES = "CARTÕES"
ABA_LANC    = "LANÇAMENTOS"
ABA_AP      = "CONTAS A PAGAR"
ABA_AR      = "CONTAS A RECEBER"
ABA_FLUXO   = "FLUXO DE CAIXA"
ABA_DRE     = "DRE GERENCIAL"
ABA_ORC     = "ORÇAMENTO X REALIZADO"
ABA_EMP     = "EMPRÉSTIMOS E FINANCIAMENTOS"
ABA_CONC    = "CONCILIAÇÃO BANCÁRIA"
ABA_INAD    = "INADIMPLÊNCIA"
ABA_IND     = "INDICADORES"
ABA_REL     = "RELATÓRIOS"
ABA_REC     = "DESPESAS RECORRENTES"
ABA_PROJ    = "PROJEÇÃO DE CAIXA"
ABA_PE      = "PONTO DE EQUILÍBRIO"
ABA_SIM     = "SIMULADOR DE CENÁRIOS"

ORDEM_ABAS = [ABA_PAINEL, ABA_DASH, ABA_CONFIG, ABA_CLI, ABA_FORN, ABA_PLANO, ABA_CC,
              ABA_BANCOS, ABA_CARTOES, ABA_LANC, ABA_AP, ABA_AR, ABA_FLUXO, ABA_DRE,
              ABA_ORC, ABA_EMP, ABA_CONC, ABA_INAD, ABA_IND, ABA_REC, ABA_PROJ,
              ABA_PE, ABA_SIM, ABA_REL, ABA_INSTR]

# --------------------------------------------------------------- CAPACIDADES
LANC_INI, LANC_FIM = 6, 2005          # 2.000 lançamentos
CLI_INI, CLI_FIM = 6, 65              # 60 clientes
FORN_INI, FORN_FIM = 6, 65            # 60 fornecedores
PLANO_INI, PLANO_FIM = 6, 85          # 80 contas
CC_INI, CC_FIM = 6, 25                # 20 centros de custo
BANCO_INI, BANCO_FIM = 6, 13          # 8 contas bancárias
CARTAO_INI, CARTAO_FIM = 6, 15        # 10 cartões
CONC_INI, CONC_FIM = 17, 516          # 500 linhas de extrato
ORC_INI, ORC_FIM = 6, 85              # 80 linhas de orçamento
RECOR_INI, RECOR_FIM = 6, 45          # 40 despesas recorrentes
EMPR_INI, EMPR_FIM = 6, 15            # 10 contratos de crédito
PARCELAS_POR_CONTRATO = 60            # 60 parcelas por contrato no cronograma

# ------------------------------------------------- MAPA DE COLUNAS - LANÇAMENTOS
LANC_COL = {
    "ID": 1, "COMP": 2, "VENC": 3, "PAGTO": 4, "TIPO": 5, "CAT": 6, "SUBCAT": 7,
    "CC": 8, "ENTIDADE": 9, "DESCRICAO": 10, "DOC": 11, "BANCO": 12, "FORMA": 13,
    "CARTAO": 14, "NPARC": 15, "TPARC": 16, "VPREV": 17, "VREAL": 18, "JUROS": 19,
    "MULTA": 20, "DESCONTO": 21, "VFINAL": 22, "SALDO": 23, "STATUS": 24, "SITUACAO": 25,
    "MES": 26, "ANO": 27, "SEMANA": 28, "DIASEM": 29, "COMPET": 30, "VDRE": 31,
    "LINHADRE": 32, "FLUXO": 33, "GRUPO": 34, "DIASVENC": 35, "DIASATR": 36,
    "DIASPAG": 37, "VALXDIAS": 38, "CHAVEAP": 39, "CHAVEAR": 40, "VALIDA": 41,
}
# primeira coluna de cálculo (a partir daqui o usuário não deve editar)
LANC_PRIMEIRA_CALC = LANC_COL["VFINAL"]


def col(nome):
    return LANC_COL[nome]


def letra(nome):
    return get_column_letter(LANC_COL[nome])


def rng(nome, ini=LANC_INI, fim=LANC_FIM, absoluto=True, com_aba=True):
    """'LANÇAMENTOS'!$C$6:$C$2005"""
    c = letra(nome)
    if absoluto:
        ref = f"${c}${ini}:${c}${fim}"
    else:
        ref = f"{c}{ini}:{c}{fim}"
    return f"'{ABA_LANC}'!{ref}" if com_aba else ref


def cel(nome, linha):
    """'LANÇAMENTOS'!C7 (relativo em linha, absoluto em coluna)"""
    return f"'{ABA_LANC}'!{letra(nome)}{linha}"


def branco(nome):   # string vazia usada nas fórmulas
    return '""'


# --------------------------------------------------------- ÂNCORAS DE REFERÊNCIA
def cfg(celula):
    return f"'{ABA_CONFIG}'!{celula}"


CONFIG_REF = {
    "razao":      cfg("$B$5"),
    "fantasia":   cfg("$B$6"),
    "cnpj":       cfg("$B$7"),
    "hoje":       cfg("$B$15"),
    "ano_atual":  cfg("$B$16"),
    "mes_atual":  cfg("$B$17"),
    "ano":        cfg("$B$18"),
    "mes":        cfg("$B$19"),
    "meta_fat":   cfg("$B$22"),
    "meta_lucro": cfg("$B$23"),
    "margem_min": cfg("$B$24"),
    "saldo_min":  cfg("$B$25"),
    "inad_max":   cfg("$B$26"),
    "pmr_alvo":   cfg("$B$27"),
    "pmp_alvo":   cfg("$B$28"),
    "aliquota":   cfg("$B$29"),
    "taxa_padrao": cfg("$B$30"),
    "meta_cresc": cfg("$B$31"),
    "reserva_giro": cfg("$B$32"),
}

# listas auxiliares (coluna D em diante, a partir da linha 36)
CONFIG_LINHA_CAB_LISTAS = 34
CONFIG_LINHA_LISTAS = 36
CONFIG_COL_LISTAS = 4          # D
CONFIG_LISTA_TAM = 30          # capacidade de cada lista estática
CONFIG_LISTA_EXTRA = 5         # linhas de folga visíveis no menu suspenso
