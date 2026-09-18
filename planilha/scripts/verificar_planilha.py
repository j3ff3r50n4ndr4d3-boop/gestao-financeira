#!/usr/bin/env python3
"""
verificar_planilha.py — suíte de testes do SISTEMA DE GESTÃO FINANCEIRA EMPRESARIAL.

O que este script faz:
  1. gera a planilha (a partir do gerador em abas/) em um arquivo temporário;
  2. valida a SINTAXE de todas as fórmulas (parser do pacote `formulas`);
  3. confere a ESTRUTURA: 25 abas, nomes definidos, validações de dados,
     formatação condicional, gráficos e proteção de células;
  4. calcula o arquivo com um motor de fórmulas (em uma cópia com as linhas
     vazias de reserva removidas, para o cálculo ser rápido) e verifica se
     alguma célula retorna erro (#VALOR!, #DIV/0!, #REF! etc.);
  5. recalcula em Python, a partir dos dados de exemplo, os números-chave
     (saldos bancários, fluxo de caixa, DRE, lucro, margens, dashboard,
     alertas, orçamento x realizado, empréstimos SAC/PRICE, ponto de
     equilíbrio, contas a pagar/receber) e compara com o que a planilha
     apurou — as 10 verificações de aceite do projeto.

Uso:
    python3 verificar_planilha.py              # tudo (leva ~4 minutos)
    python3 verificar_planilha.py --rapido     # sem o motor de cálculo (segundos)
    python3 verificar_planilha.py --salvar X.xlsx

Requisitos: openpyxl. O motor de cálculo ("formulas") é opcional: sem ele,
as etapas 4 e 5 são puladas com aviso.
"""
import argparse
import datetime as dt
import os
import re
import sys
import time

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

import openpyxl                                        # noqa: E402
from openpyxl.utils import get_column_letter as GL     # noqa: E402
from openpyxl.utils import column_index_from_string    # noqa: E402

from lib import dados_exemplo as D                     # noqa: E402
from lib import parametros as P                        # noqa: E402
from lib import plano_contas as PC                     # noqa: E402
import gerar_planilha as G                             # noqa: E402

ARQ_BRUTO = "/tmp/verif_bruto.xlsx"
ARQ_LEVE = "/tmp/verif_leve.xlsx"

HOJE = dt.date.today()
ANO, MES = HOJE.year, HOJE.month
PLANO = {p[3]: p for p in PC.PLANO}
SALDO_INICIAL_TOTAL = round(sum(c["saldo_inicial"] for c in D.CONTAS
                                if c["tipo"] != "Cartão de crédito"), 2)

OK, FALHAS = [], []


# --------------------------------------------------------------------------
# utilidades de teste
# --------------------------------------------------------------------------
def checar(nome, obtido, esperado, tol=0.05):
    if obtido is None:
        ok = False
    elif isinstance(esperado, (int, float)) and not isinstance(esperado, bool):
        try:
            ok = abs(float(obtido) - float(esperado)) <= tol
        except (TypeError, ValueError):
            ok = False
    else:
        ok = str(obtido).strip() == str(esperado).strip()
    (OK if ok else FALHAS).append((nome, obtido, esperado))
    print(f"  [{'OK  ' if ok else 'FALHA'}] {nome}: planilha={obtido!r} esperado={esperado!r}")
    return ok


def g(sol, aba, cel):
    """Extrai o valor escalar calculado de uma célula do resultado do motor."""
    v = sol.get(f"'[{os.path.basename(ARQ_LEVE)}]{aba}'!{cel}")
    for _ in range(8):
        if v is None or isinstance(v, (int, float, str, bool)):
            return v
        try:
            v = v.value
        except Exception:      # noqa: BLE001
            try:
                v = v[0, 0]
            except Exception:  # noqa: BLE001
                return v
    return v


def achar_cartao(sol, rotulo, aba="DASHBOARD", r_ini=9, r_fim=30):
    """Localiza o cartão pela etiqueta e devolve o primeiro valor numérico à direita."""
    for r in range(r_ini, r_fim + 1):
        for c in range(2, 18):
            v = g(sol, aba, f"{GL(c)}{r}")
            if isinstance(v, str) and rotulo.lower() in v.lower():
                # cartões: etiqueta na linha r e valor na mesma coluna em r+1
                x = g(sol, aba, f"{GL(c)}{r + 1}")
                if isinstance(x, (int, float)):
                    return x
                # resumo executivo: etiqueta e valor na mesma linha (2 colunas à direita)
                for c2 in range(c + 1, 18):
                    x = g(sol, aba, f"{GL(c2)}{r}")
                    if isinstance(x, (int, float)):
                        return x
                return None
    return None


# --------------------------------------------------------------------------
# referências de cálculo (mesmas regras das fórmulas da planilha)
# --------------------------------------------------------------------------
def vfinal(l):
    """Valor realizado de caixa: realizado + juros + multa − desconto."""
    return round((l["vreal"] or 0) + (l["juros"] or 0) + (l["multa"] or 0)
                 - (l["desconto"] or 0), 2)


def vdre(l):
    """Valor para o DRE (regime de competência: previsão + encargos)."""
    if l["status"] == "Cancelado" or l["comp"] is None or l["comp"].year != ANO:
        return 0.0
    return round(l["vprev"] + (l["juros"] or 0) + (l["multa"] or 0) - (l["desconto"] or 0), 2)


def aberto(l):
    """Saldo em aberto de um título."""
    if l["status"] in ("Pago", "Recebido", "Cancelado"):
        return 0.0
    return round(l["vprev"] + (l["juros"] or 0) + (l["multa"] or 0) - (l["desconto"] or 0)
                 - (l["vreal"] or 0), 2)


def soma_linha(linha, mes=None):
    t = 0.0
    for l in D.LANCAMENTOS:
        p = PLANO.get(l["subcat"])
        if not p or p[7] != linha:
            continue
        if mes and (l["comp"] is None or l["comp"].month != mes):
            continue
        t += vdre(l)
    return round(t, 2)


def soma_caixa(tipo, ano=None, mes=None, ate_hoje=False):
    t = 0.0
    for l in D.LANCAMENTOS:
        if l["tipo"] != tipo or not l["pagto"]:
            continue
        if ano and l["pagto"].year != ano:
            continue
        if mes and l["pagto"].month != mes:
            continue
        if ate_hoje and l["pagto"] > HOJE:
            continue
        t += vfinal(l)
    return round(t, 2)


def saldo_bruto(l):
    """Saldo em aberto exatamente como a planilha soma (sem filtrar negativos)."""
    if l["status"] in ("Pago", "Recebido", "Cancelado"):
        return 0.0
    return round(l["vprev"] + (l["juros"] or 0) + (l["multa"] or 0) - (l["desconto"] or 0)
                 - (l["vreal"] or 0), 2)


PERIODICIDADE_MESES = {"Mensal": 1, "Bimestral": 2, "Trimestral": 3, "Semestral": 6, "Anual": 12}


def recorrentes_do_mes(k):
    """Total de despesas recorrentes que caem no mês HOJE+k (só as ainda não lançadas)."""
    total = 0.0
    for rec in D.RECORRENTES:
        if rec.get("ativo", "Sim") != "Sim":
            continue
        n = PERIODICIDADE_MESES.get(rec["periodicidade"], 1)
        if k % n:
            continue
        mes = (HOJE.month - 1 + k) % 12 + 1
        ano = HOJE.year + (HOJE.month - 1 + k) // 12
        ja_lancado = any(l["subcat"] == rec["subcat"] and l["tipo"] == "Saída" and l["comp"]
                         and l["comp"].month == mes and l["comp"].year == ano for l in D.LANCAMENTOS)
        if not ja_lancado:
            total += rec["valor"]
    return round(total, 2)


def soma_venc(tipo, d_ini, d_fim):
    """Soma dos saldos em aberto com vencimento no intervalo (mesmas regras da PROJEÇÃO)."""
    return round(sum(saldo_bruto(l) for l in D.LANCAMENTOS
                     if l["tipo"] == tipo and l["venc"] and d_ini <= l["venc"] <= d_fim), 2)


def primeiro_dia(k):
    return dt.date(HOJE.year + (HOJE.month - 1 + k) // 12, (HOJE.month - 1 + k) % 12 + 1, 1)


def parcela_price(valor, taxa, n):
    return round(valor * taxa * (1 + taxa) ** n / ((1 + taxa) ** n - 1), 2)


def cronograma(c):
    """Cronograma SAC/PRICE idêntico ao calculado na aba EMPRÉSTIMOS."""
    def row(k, parcela, juros, amort, saldo):
        mes = c["primeira"].month - 1 + (k - 1)
        venc = dt.date(c["primeira"].year + mes // 12, mes % 12 + 1, c["primeira"].day)
        return dict(k=k, venc=venc, parcela=parcela, juros=juros, amort=amort, saldo=saldo)

    linhas, prev = [], None
    fixa = parcela_price(c["valor"], c["taxa"], c["nparc"])
    for k in range(1, c["nparc"] + 1):
        if k == 1:
            juros = round(c["valor"] * c["taxa"], 2)
            if c["sistema"] == "SAC":
                amort = round(c["valor"] / c["nparc"], 2)
                parcela = round(amort + juros, 2)
            else:
                parcela = fixa
                amort = round(parcela - juros, 2)
            saldo = round(c["valor"] - amort, 2)
        else:
            juros = round(prev["saldo"] * c["taxa"], 2)
            if c["sistema"] == "SAC":
                amort = round(c["valor"] / c["nparc"], 2)
                parcela = round(amort + juros, 2)
            else:
                amort = round(fixa - juros, 2)
                parcela = fixa
            saldo = max(0.0, round(prev["saldo"] - amort, 2))
        prev = row(k, parcela, juros, amort, saldo)
        linhas.append(prev)
    return linhas


# --------------------------------------------------------------------------
# 1. geração + 2. sintaxe
# --------------------------------------------------------------------------
def etapa_sintaxe(wb):
    print("\n[2/5] Sintaxe das fórmulas")
    from formulas.parser import Parser
    prs = Parser()
    padroes, erros, total = set(), [], 0
    for ws in wb.worksheets:
        for linha in ws.iter_rows():
            for c in linha:
                v = c.value
                if not (isinstance(v, str) and v.startswith("=")):
                    continue
                total += 1
                pat = re.sub(r"(\$?[A-Z]{1,3})\$?\d+", r"\1#", v)
                if pat in padroes:
                    continue
                padroes.add(pat)
                try:
                    prs.ast(v)
                except Exception as ex:                     # noqa: BLE001
                    erros.append((ws.title, c.coordinate, type(ex).__name__, v[:110]))
    print(f"  fórmulas no arquivo: {total:,} | padrões distintos: {len(padroes):,} | "
          f"erros de sintaxe: {len(erros)}")
    for e in erros[:10]:
        print("    ERRO", e)
    checar("nenhuma fórmula com erro de sintaxe", len(erros), 0)
    checar("volume de fórmulas (>= 40.000)", total >= 40000, True)
    return total


# --------------------------------------------------------------------------
# 3. estrutura
# --------------------------------------------------------------------------
ABAS = ["CONFIGURAÇÕES", "CADASTRO DE CLIENTES", "CADASTRO DE FORNECEDORES", "PLANO DE CONTAS",
        "CENTRO DE CUSTOS", "CONTAS BANCÁRIAS", "CARTÕES", "LANÇAMENTOS", "CONTAS A PAGAR",
        "CONTAS A RECEBER", "FLUXO DE CAIXA", "DRE GERENCIAL", "ORÇAMENTO X REALIZADO",
        "EMPRÉSTIMOS E FINANCIAMENTOS", "CONCILIAÇÃO BANCÁRIA", "INADIMPLÊNCIA", "INDICADORES",
        "DESPESAS RECORRENTES", "PROJEÇÃO DE CAIXA", "PONTO DE EQUILÍBRIO", "SIMULADOR DE CENÁRIOS",
        "DASHBOARD", "RELATÓRIOS", "INSTRUÇÕES", "PAINEL DE CONTROLE"]

NOMES = ["TIPO_LANCAMENTO", "SITUACAO", "FORMA_PAGAMENTO", "TIPO_CONTA", "STATUS_CADASTRO",
         "PERIODICIDADE", "SISTEMA_AMORTIZACAO", "TIPO_FLUXO", "BANDEIRA", "STATUS_CONCILIACAO",
         "SIM_NAO", "REGIME", "UF", "MESES", "TIPO_OPERACAO", "SUBGRUPOS", "STATUS_CONTRATO",
         "LINHAS_DRE", "CLIENTES_NOMES", "CLIENTES_FANTASIA", "FORNECEDORES_NOMES",
         "FORNECEDORES_FANTASIA", "CATEGORIAS_PLANO", "SUBGRUPOS_PLANO", "SUBCATEGORIAS_PLANO",
         "LINHAS_DRE_PLANO", "GRUPOS_PLANO", "TIPOS_FLUXO_PLANO", "CENTROS_CUSTO",
         "CONTAS_BANCARIAS", "CARTOES", "CARTAO_LISTA", "LANC_ID",
         "PE_MC_UNIT", "PE_RS", "PE_QTD", "MARGEM_SEGURANCA", "RECORRENTES_MES"]


def etapa_estrutura(wb):
    print("\n[3/5] Estrutura do arquivo")
    for aba in ABAS:
        if aba not in wb.sheetnames:
            checar(f"aba presente: {aba}", "ausente", "presente")
    checar("total de abas", len(wb.sheetnames), len(ABAS))
    faltando = [nm for nm in NOMES if nm not in wb.defined_names]
    checar("nomes definidos (intervalos e listas)", len(faltando), 0)
    for nm in faltando:
        print("    nome ausente:", nm)
    n_dv = sum(len(ws.data_validations.dataValidation) for ws in wb.worksheets)
    n_cf = sum(len(ws.conditional_formatting._cf_rules) for ws in wb.worksheets)
    n_ch = sum(len(ws._charts) for ws in wb.worksheets)
    n_prot = sum(1 for ws in wb.worksheets if ws.protection.sheet)
    freezadas = sum(1 for ws in wb.worksheets if ws.freeze_panes)
    checar("validações de dados (>= 60)", n_dv >= 60, True)
    checar("formatações condicionais (>= 80)", n_cf >= 80, True)
    checar("gráficos (>= 20)", n_ch >= 20, True)
    checar("abas protegidas", n_prot, len(wb.sheetnames))
    checar("abas com painéis congelados (>= 8)", freezadas >= 8, True)
    print(f"  validações={n_dv} | formatação condicional={n_cf} | gráficos={n_ch} | "
          f"abas protegidas={n_prot} | congeladas={freezadas}")
    ruins = []
    for ws in wb.worksheets:
        for linha in ws.iter_rows():
            for c in linha:
                v = c.value
                if isinstance(v, str) and v.startswith("= "):
                    ruins.append((ws.title, c.coordinate, v[:60]))
    checar("nenhum rótulo iniciado por '='", len(ruins), 0)
    for r in ruins[:5]:
        print("    rótulo suspeito:", r)


# --------------------------------------------------------------------------
# 4. cópia leve + cálculo
# --------------------------------------------------------------------------
def preparar_copia_leve():
    print("\n[4/5] Preparando a cópia para cálculo (remove linhas de reserva vazias)")
    wb = openpyxl.load_workbook(ARQ_BRUTO)
    n = 0

    def limpar(aba, r_ini, r_fim):
        nonlocal n
        ws = wb[aba]
        for linha in ws.iter_rows(min_row=r_ini, max_row=r_fim):
            for c in linha:
                if isinstance(c.value, str) and c.value.startswith("="):
                    c.value = None
                    n += 1

    limpar(P.ABA_LANC, P.LANC_INI + len(D.LANCAMENTOS), P.LANC_FIM)
    limpar(P.ABA_CONC, P.CONC_INI + len(D.CONCILIACAO), P.CONC_FIM)
    limpar(P.ABA_REC, 6 + len(D.RECORRENTES), P.RECOR_FIM)
    ws = wb[P.ABA_EMP]
    hdr = None
    for linha in ws.iter_rows(min_col=3, max_col=3):
        for c in linha:
            if c.value == "Parcela nº":
                hdr = c.row
    if hdr:
        limpar(P.ABA_EMP, hdr + 1 + 3 * P.PARCELAS_POR_CONTRATO,
               hdr + 6 * P.PARCELAS_POR_CONTRATO - 1)
    wb.save(ARQ_LEVE)
    print(f"  fórmulas de reserva removidas: {n:,} | arquivo: {os.path.getsize(ARQ_LEVE)/1024:,.0f} KB")
    return wb


def calcular():
    from formulas import ExcelModel
    print("  calculando com o motor de fórmulas (pode levar ~3 minutos)...")
    t = time.time()
    sol = ExcelModel().loads(ARQ_LEVE).finish().calculate()
    print(f"  cálculo concluído em {time.time()-t:.0f}s | células com resultado: {len(sol):,}")
    erros = []
    for k, v in sol.items():
        x = getattr(v, "value", v)
        try:
            x = x[0, 0]
        except Exception:      # noqa: BLE001
            pass
        if isinstance(x, str) and x.startswith("#") and k.startswith("'"):
            erros.append((k, x))
    checar("nenhuma célula com erro (#VALOR!, #DIV/0!, #REF! ...)", len(erros), 0)
    for e in erros[:10]:
        print("    erro:", e)
    return sol, len(erros)


# --------------------------------------------------------------------------
# 5. verificações de aceite
# --------------------------------------------------------------------------
def verificar_valores(sol):
    print("\n[5/5] Conferência dos números (recálculo independente em Python)")
    ref = {}

    # ------- 1) saldo bancário -------------------------------------------------
    print("\n  -- 1. Saldos bancários (aba CONTAS BANCÁRIAS)")
    bancos = [c for c in D.CONTAS if c["tipo"] != "Cartão de crédito"]
    for i, c in enumerate(bancos):
        lin = P.BANCO_INI + i
        ent = round(sum(vfinal(l) for l in D.LANCAMENTOS
                        if l["banco"] == c["nome"] and l["tipo"] == "Entrada"
                        and l["pagto"] and l["pagto"] <= HOJE), 2)
        sai = round(sum(vfinal(l) for l in D.LANCAMENTOS
                        if l["banco"] == c["nome"] and l["tipo"] == "Saída"
                        and l["pagto"] and l["pagto"] <= HOJE), 2)
        checar(f"entradas realizadas — {c['nome'][:26]}", g(sol, P.ABA_BANCOS, f"H{lin}"), ent)
        checar(f"saídas realizadas — {c['nome'][:26]}", g(sol, P.ABA_BANCOS, f"I{lin}"), sai)
        checar(f"saldo atual — {c['nome'][:26]}", g(sol, P.ABA_BANCOS, f"J{lin}"),
               round(c["saldo_inicial"] + ent - sai, 2))
    caixa = round(SALDO_INICIAL_TOTAL + soma_caixa("Entrada", ate_hoje=True)
                  - soma_caixa("Saída", ate_hoje=True), 2)
    checar("total disponível em caixa e bancos", g(sol, P.ABA_BANCOS, f"J{P.BANCO_FIM+1}"), caixa)
    ref["caixa"] = caixa

    # ------- 2) fluxo de caixa -------------------------------------------------
    print("\n  -- 2. Fluxo de caixa (mensal, valores realizados)")
    for m in (1, 2, 6, MES, 12):
        rr = 51 + m
        checar(f"entradas realizadas mês {m:02d}", g(sol, P.ABA_FLUXO, f"C{rr}"),
               soma_caixa("Entrada", ANO, m))
        checar(f"saídas realizadas mês {m:02d}", g(sol, P.ABA_FLUXO, f"D{rr}"),
               soma_caixa("Saída", ANO, m))
        checar(f"resultado do mês {m:02d}", g(sol, P.ABA_FLUXO, f"E{rr}"),
               round(soma_caixa("Entrada", ANO, m) - soma_caixa("Saída", ANO, m), 2))
    checar("total do ano — entradas", g(sol, P.ABA_FLUXO, "C64"), soma_caixa("Entrada", ANO))
    checar("total do ano — saídas", g(sol, P.ABA_FLUXO, "D64"), soma_caixa("Saída", ANO))

    # ------- 3/4) DRE e lucro --------------------------------------------------
    print("\n  -- 3/4. DRE e lucro (total do ano e mês de análise)")
    fat = soma_linha("Faturamento Bruto")
    imp = soma_linha("Impostos sobre Vendas")
    dev = soma_linha("Devoluções")
    cv = soma_linha("Custos Variáveis")
    df = soma_linha("Despesas Fixas")
    dfin = soma_linha("Despesas Financeiras")
    rfin = soma_linha("Receitas Financeiras")
    outra = soma_linha("Outras Receitas Operacionais")
    ir = soma_linha("Impostos sobre o Resultado")
    dist = soma_linha("Distribuição de Lucros")
    rl = round(fat - imp - dev, 2)
    mc = round(rl - cv, 2)
    ebitda = round(mc - df, 2)
    lucro = round(ebitda - dfin + rfin + outra - ir, 2)
    retido = round(lucro - dist, 2)
    for cel, esp in [("N7", fat), ("N10", rl), ("N11", cv), ("N12", mc), ("N14", ebitda),
                     ("N20", lucro), ("N22", retido)]:
        checar(f"DRE total do ano — {cel}", g(sol, P.ABA_DRE, cel), esp)
    for m in (1, MES, 12):
        checar(f"faturamento do mês {m:02d} (DRE)", g(sol, P.ABA_DRE, f"{GL(1+m)}7"),
               soma_linha("Faturamento Bruto", m))
    ref["lucro"], ref["faturamento"], ref["receita_liquida"] = lucro, fat, rl

    # ------- 5) margens --------------------------------------------------------
    print("\n  -- 5. Margens (%)")
    checar("margem bruta (ano)", g(sol, P.ABA_DRE, "N30"),
           round((fat - imp - cv) / fat, 6), tol=1e-4)
    checar("margem de contribuição (ano)", g(sol, P.ABA_DRE, "N31"), round(mc / rl, 6), tol=1e-4)
    checar("margem operacional/EBITDA (ano)", g(sol, P.ABA_DRE, "N32"),
           round(ebitda / rl, 6), tol=1e-4)
    checar("margem líquida (ano)", g(sol, P.ABA_DRE, "N33"), round(lucro / rl, 6), tol=1e-4)
    checar("análise vertical — faturamento sobre receita líquida", g(sol, P.ABA_DRE, "O7"),
           round(fat / rl, 6), tol=1e-4)

    # ------- 6) dashboard ------------------------------------------------------
    print("\n  -- 6. Dashboard (filtros na posição padrão: ano, mês, Todos)")
    fat_mes = soma_linha("Faturamento Bruto", MES)
    rl_mes = round(fat_mes - soma_linha("Impostos sobre Vendas", MES)
                   - soma_linha("Devoluções", MES), 2)
    lucro_mes = round(rl_mes - soma_linha("Custos Variáveis", MES)
                      - soma_linha("Despesas Fixas", MES)
                      - soma_linha("Despesas Financeiras", MES)
                      + soma_linha("Receitas Financeiras", MES)
                      + soma_linha("Outras Receitas Operacionais", MES)
                      - soma_linha("Impostos sobre o Resultado", MES), 2)
    ent_mes, sai_mes = soma_caixa("Entrada", ANO, MES), soma_caixa("Saída", ANO, MES)
    ap = round(sum(aberto(l) for l in D.LANCAMENTOS if l["tipo"] == "Saída" and aberto(l) > 0), 2)
    ar = round(sum(aberto(l) for l in D.LANCAMENTOS if l["tipo"] == "Entrada" and aberto(l) > 0), 2)
    apv = round(sum(aberto(l) for l in D.LANCAMENTOS
                    if l["tipo"] == "Saída" and aberto(l) > 0 and l["venc"] and l["venc"] < HOJE), 2)
    arv = round(sum(aberto(l) for l in D.LANCAMENTOS
                    if l["tipo"] == "Entrada" and aberto(l) > 0 and l["venc"] and l["venc"] < HOJE), 2)
    checar("cartão Faturamento do período", achar_cartao(sol, "Faturamento do período"), fat_mes)
    checar("cartão Lucro líquido do período", achar_cartao(sol, "Lucro líquido do período"), lucro_mes)
    checar("cartão Margem líquida", achar_cartao(sol, "Margem líquida"),
           round(lucro_mes / rl_mes, 6), tol=1e-4)
    checar("cartão Saldo de caixa hoje", achar_cartao(sol, "Saldo de caixa hoje"), caixa)
    checar("cartão A receber em aberto", achar_cartao(sol, "A receber em aberto"), ar)
    checar("cartão A pagar em aberto", achar_cartao(sol, "A pagar em aberto"), ap)
    checar("cartão Vencido a receber", achar_cartao(sol, "Vencido a receber"), arv)
    checar("cartão Vencido a pagar", achar_cartao(sol, "Vencido a pagar"), apv)
    checar("cartão Entradas de caixa do período", achar_cartao(sol, "Entradas de caixa"), ent_mes)
    checar("cartão Saídas de caixa do período", achar_cartao(sol, "Saídas de caixa"), sai_mes)
    checar("cartão Geração de caixa do período", achar_cartao(sol, "Geração de caixa"),
           round(ent_mes - sai_mes, 2))
    checar("cartão Receita líquida (resumo executivo)",
           achar_cartao(sol, "Receita líquida", r_ini=27, r_fim=30), rl_mes)
    ref.update(fat_mes=fat_mes, lucro_mes=lucro_mes, ar=ar, ap=ap, arv=arv, apv=apv,
               ent_mes=ent_mes, sai_mes=sai_mes)

    # ------- 7) contas a pagar / receber / inadimplência -----------------------
    print("\n  -- 7. Contas a pagar, a receber e inadimplência")
    checar("contas a pagar em aberto", g(sol, P.ABA_AP, "A7"), ap)
    checar("contas a pagar vencidas", g(sol, P.ABA_AP, "C7"), apv)
    checar("contas a receber em aberto", g(sol, P.ABA_AR, "A7"), ar)
    checar("contas a receber vencidas", g(sol, P.ABA_AR, "C7"), arv)
    checar("inadimplência — total vencido", g(sol, P.ABA_INAD, "A7"), arv)
    for i, (ini_d, fim_d) in enumerate([(1, 7), (8, 15), (16, 30), (31, 60), (61, 90), (91, 10**6)]):
        esp = round(sum(aberto(l) for l in D.LANCAMENTOS
                        if l["tipo"] == "Entrada" and aberto(l) > 0 and l["venc"]
                        and ini_d <= (HOJE - l["venc"]).days <= fim_d), 2)
        checar(f"inadimplência — faixa {ini_d} a {fim_d if fim_d < 10**6 else 'mais'} dias",
               g(sol, P.ABA_INAD, f"B{12+i}"), esp)

    # ------- 8) alertas --------------------------------------------------------
    print("\n  -- 8. Alertas ATENÇÃO DO GESTOR (aba INDICADORES)")
    ind = P.ABA_IND
    checar("alerta 1 — saldo de caixa acima do mínimo",
           g(sol, ind, "C7"), caixa)
    checar("alerta 2 — geração de caixa do mês", g(sol, ind, "C8"),
           round(ent_mes - sai_mes, 2))
    ico = [g(sol, ind, f"B{r}") for r in range(7, 25)]
    checar("18 alertas avaliados", sum(1 for x in ico if isinstance(x, str) and x), 18)
    checar("alertas com ícone de situação",
           sum(1 for x in ico if isinstance(x, str) and any(k in x for k in ("🔴", "🟡", "🟢"))), 18)
    checar("alerta de saldo mínimo coerente",
           (ico[0] == "🟢 OK") == (caixa >= D.CFG_CIA["saldo_min"]), True)
    checar("alerta de geração de caixa coerente",
           ico[1] != "🟢 OK" if (ent_mes - sai_mes) < 0 else ico[1] == "🟢 OK", True)

    # ------- 9) orçamento x realizado -----------------------------------------
    print("\n  -- 9. Orçamento x realizado")
    orcado = round(sum(sum(v) for v in D.ORCAMENTO_BASE.values()), 2)
    checar("total orçado do ano (aba ORÇAMENTO)", g(sol, P.ABA_ORC, "O45"), orcado)
    orc_mes = round(sum(v[MES - 1] for v in D.ORCAMENTO_BASE.values()), 2)
    realizado = 0.0
    for cat in D.ORCAMENTO_BASE:
        for l in D.LANCAMENTOS:
            if l["subcat"] == cat and l["comp"] and l["comp"].year == ANO and l["comp"].month == MES:
                realizado += vdre(l)
    realizado = round(realizado, 2)
    checar("cartão Orçado no período (dashboard)", achar_cartao(sol, "Orçado no período"), orc_mes)
    checar("cartão Realizado no período (dashboard)",
           achar_cartao(sol, "Realizado no período"), realizado)
    checar("cartão Consumo do orçamento (dashboard)", achar_cartao(sol, "Consumo do orçamento"),
           round(realizado / orc_mes, 6), tol=1e-4)
    checar("status do orçamento coerente com o percentual",
           str(g(sol, P.ABA_ORC, "AE45")).find("Estourou") >= 0
           if realizado > orcado else True, True)

    # ------- 10) empréstimos (SAC e PRICE) ------------------------------------
    print("\n  -- 10a. Empréstimos e financiamentos (cronogramas SAC/PRICE)")
    wb = openpyxl.load_workbook(ARQ_BRUTO)
    hdr = None
    for linha in wb[P.ABA_EMP].iter_rows(min_col=3, max_col=3):
        for c in linha:
            if c.value == "Parcela nº":
                hdr = c.row
    r0 = hdr + 1
    for i, c in enumerate(D.CONTRATOS):
        lin = P.EMPR_INI + i
        cr = cronograma(c)
        chave = f"{c['instituicao'][:20]} ({c['sistema']})"
        checar(f"parcela inicial — {chave}", g(sol, P.ABA_EMP, f"K{lin}"), cr[0]["parcela"])
        checar(f"parcela final — {chave}", g(sol, P.ABA_EMP, f"L{lin}"), cr[-1]["parcela"])
        checar(f"total de juros — {chave}", g(sol, P.ABA_EMP, f"R{lin}"),
               round(sum(x["juros"] for x in cr), 2))
        a_vencer = [x for x in cr if x["venc"] > HOJE]
        checar(f"saldo devedor (amortizações a vencer) — {chave}", g(sol, P.ABA_EMP, f"Q{lin}"),
               round(sum(x["amort"] for x in a_vencer), 2))
        checar(f"parcelas a vencer (qtd.) — {chave}", g(sol, P.ABA_EMP, f"P{lin}"), len(a_vencer))
        checar(f"parcelas vencidas (qtd.) — {chave}", g(sol, P.ABA_EMP, f"O{lin}"),
               len(cr) - len(a_vencer))
        for k in (1, 2, 3, len(cr) // 2 + 1, len(cr) - 1, len(cr)):
            rr = r0 + i * P.PARCELAS_POR_CONTRATO + (k - 1)
            e = cr[k - 1]
            checar(f"{chave} parcela {k:02d} — valor", g(sol, P.ABA_EMP, f"E{rr}"), e["parcela"])
            checar(f"{chave} parcela {k:02d} — juros", g(sol, P.ABA_EMP, f"F{rr}"), e["juros"])
            checar(f"{chave} parcela {k:02d} — amortização", g(sol, P.ABA_EMP, f"G{rr}"), e["amort"])
            checar(f"{chave} parcela {k:02d} — saldo devedor", g(sol, P.ABA_EMP, f"H{rr}"), e["saldo"])
    checar("cartão Saldo devedor total dos contratos", g(sol, P.ABA_EMP, "A19"),
           round(sum(g(sol, P.ABA_EMP, f"Q{P.EMPR_INI+i}") for i in range(len(D.CONTRATOS))), 2),
           tol=0.10)
    checar("cartão Parcelas a vencer (qtd.)", g(sol, P.ABA_EMP, "G19"),
           sum(g(sol, P.ABA_EMP, f"P{P.EMPR_INI+i}") for i in range(len(D.CONTRATOS))))

    # ------- 11) ponto de equilíbrio ------------------------------------------
    print("\n  -- 10b. Ponto de equilíbrio e margem de segurança")
    fixo = round(soma_linha("Despesas Fixas", MES) + soma_linha("Despesas Financeiras", MES), 2)
    mcpct = 1 - (soma_linha("Custos Variáveis", MES) + soma_linha("Impostos sobre Vendas", MES)
                 + soma_linha("Devoluções", MES)) / fat_mes
    pe = round(fixo / mcpct, 2)
    checar("margem de contribuição (%) usada no cálculo", g(sol, P.ABA_PE, "B16"), mcpct, tol=1e-9)
    checar("ponto de equilíbrio em R$", g(sol, P.ABA_PE, "B18"), pe)
    checar("margem de segurança (%)", g(sol, P.ABA_PE, "B21"),
           round((fat_mes - pe) / fat_mes, 6), tol=1e-4)
    checar("conferência — lucro no ponto de equilíbrio = R$ 0,00", g(sol, P.ABA_PE, "B26"), 0.0)
    checar("faturamento para a meta de lucro", g(sol, P.ABA_PE, "B22"),
           round((fixo + D.CFG_CIA["meta_lucro"]) / mcpct, 2))
    return ref


def verificar_projecao(sol, caixa):
    print("\n  -- 10c. Projeção de caixa (7/15/30/60/90/180 dias e 12 meses)")
    hoje, mes_atual = HOJE, dt.date(HOJE.year, HOJE.month, 1)
    fim_mes_atual = dt.date(HOJE.year + (HOJE.month == 12), HOJE.month % 12 + 1, 1) - dt.timedelta(days=1)
    # o cartão é mesclado (A7:B7): o valor fica na primeira célula do intervalo
    checar("saldo disponível hoje (posição atual)", g(sol, P.ABA_PROJ, "A7"), caixa)
    for i, h in enumerate([7, 15, 30, 60, 90, 180]):
        r = 11 + i
        ent = soma_venc("Entrada", hoje, hoje + dt.timedelta(days=h))
        sai = soma_venc("Saída", hoje, hoje + dt.timedelta(days=h))
        rec = round(sum(recorrentes_do_mes(k) for k in range(0, 12)
                        if primeiro_dia(k) <= hoje + dt.timedelta(days=h)
                        and primeiro_dia(k) > fim_mes_atual), 2)
        checar(f"projeção {h:3d} dias — entradas previstas", g(sol, P.ABA_PROJ, f"B{r}"), ent)
        checar(f"projeção {h:3d} dias — saídas previstas", g(sol, P.ABA_PROJ, f"C{r}"), sai)
        checar(f"projeção {h:3d} dias — recorrentes não lançadas", g(sol, P.ABA_PROJ, f"D{r}"), rec)
        checar(f"projeção {h:3d} dias — resultado do período", g(sol, P.ABA_PROJ, f"E{r}"),
               round(ent - sai - rec, 2))
        checar(f"projeção {h:3d} dias — saldo projetado", g(sol, P.ABA_PROJ, f"F{r}"),
               round(caixa + ent - sai - rec, 2))
        checar(f"projeção {h:3d} dias — folga/déficit sobre o saldo mínimo",
               g(sol, P.ABA_PROJ, f"H{r}"), round(caixa + ent - sai - rec - D.CFG_CIA["saldo_min"], 2))
        checar(f"projeção {h:3d} dias — situação coerente com a folga",
               (g(sol, P.ABA_PROJ, f"H{r}") < 0) == ("🔴" in str(g(sol, P.ABA_PROJ, f"I{r}"))), True)
    acumulado = caixa
    for k in (0, 1, 2):
        r = 20 + k
        ini, fim = primeiro_dia(k), primeiro_dia(k + 1) - dt.timedelta(days=1)
        ent = soma_venc("Entrada", ini, fim)
        sai = soma_venc("Saída", ini, fim)
        rec = recorrentes_do_mes(k)
        base = ent if ent else g(sol, P.ABA_PROJ, f"J{r}")
        expected = round((base if isinstance(base, (int, float)) else 0) - sai - rec, 2)
        checar(f"projeção mensal mês {k+1} — entradas (títulos)", g(sol, P.ABA_PROJ, f"B{r}"), ent)
        checar(f"projeção mensal mês {k+1} — saídas (títulos)", g(sol, P.ABA_PROJ, f"C{r}"), sai)
        checar(f"projeção mensal mês {k+1} — recorrentes", g(sol, P.ABA_PROJ, f"D{r}"), rec)
        checar(f"projeção mensal mês {k+1} — resultado", g(sol, P.ABA_PROJ, f"E{r}"), expected)
        acumulado = round(acumulado + expected, 2)
        checar(f"projeção mensal mês {k+1} — saldo acumulado", g(sol, P.ABA_PROJ, f"F{r}"), acumulado)


def verificar_simulador(sol, caixa):
    print("\n  -- 10d. Simulador de cenários (coluna 'Cenário atual')")
    fat = soma_linha("Faturamento Bruto", MES)
    cv = soma_linha("Custos Variáveis", MES)
    imp = soma_linha("Impostos sobre Vendas", MES)
    dev = soma_linha("Devoluções", MES)
    df = soma_linha("Despesas Fixas", MES)
    dfin = soma_linha("Despesas Financeiras", MES)
    arv = round(sum(aberto(l) for l in D.LANCAMENTOS
                              if l["tipo"] == "Entrada" and aberto(l) > 0
                              and l["venc"] and l["venc"] < HOJE), 2)
    for cel, esp in [("B7", fat), ("B8", cv), ("B9", imp), ("B10", dev), ("B11", df), ("B12", dfin),
                     ("B13", caixa), ("B14", round(arv / fat, 6))]:
        checar(f"premissa do simulador {cel}", g(sol, P.ABA_SIM, cel), esp, tol=1e-4)
    fat12 = round(fat * 12, 2)
    mc = round(fat12 - imp * 12 - dev * 12 - cv * 12, 2)
    lucro = round(mc - df * 12 - dfin * 12 - arv, 2)   # provisão = vencido atual
    checar("faturamento projetado (12 meses, cenário atual)", g(sol, P.ABA_SIM, "B26"), fat12)
    checar("margem de contribuição projetada", g(sol, P.ABA_SIM, "B30"), mc)
    checar("lucro líquido projetado", g(sol, P.ABA_SIM, "B34"), lucro)
    checar("margem líquida projetada", g(sol, P.ABA_SIM, "B35"), round(lucro / fat12, 6), tol=1e-4)
    checar("caixa estimado em 12 meses", g(sol, P.ABA_SIM, "B36"), round(caixa + lucro, 2))
    for k, col in enumerate("BCD"):
        cen = {"B": "atual", "C": "otimista", "D": "conservador"}[col]
        f_fat = g(sol, P.ABA_SIM, f"{col}18") or 1
        f_cv = g(sol, P.ABA_SIM, f"{col}19") or 1
        f_df = g(sol, P.ABA_SIM, f"{col}20") or 1
        f_imp = g(sol, P.ABA_SIM, f"{col}21") or 1
        f_inad = g(sol, P.ABA_SIM, f"{col}22") or 1
        esp = round(fat * 12 * f_fat - imp * 12 * f_imp * f_fat - dev * 12 * f_fat
                    - cv * 12 * f_cv - df * 12 * f_df - dfin * 12 * f_df
                    - arv * f_inad, 2)
        checar(f"lucro projetado — cenário {cen}", g(sol, P.ABA_SIM, f"{col}34"), esp)
        checar(f"caixa estimado — cenário {cen}", g(sol, P.ABA_SIM, f"{col}36"),
               round(caixa + esp, 2))


def verificar_graficos(wb, sol):
    print("\n  -- 11. Gráficos realmente alimentados por dados calculados")
    total, com_dados, sem_dados = 0, 0, []
    for ws in wb.worksheets:
        for ch in ws._charts:
            total += 1
            achou = False
            for s in getattr(ch, "series", []):
                try:
                    if s.val is None:
                        continue
                    ref = getattr(s.val, "f", None) or getattr(getattr(s.val, "numRef", None), "f", None)
                except Exception:      # noqa: BLE001
                    ref = None
                if not ref:
                    continue
                m = re.match(r"'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$", ref)
                if not m:
                    continue
                aba, c1, r1, c2, r2 = m.groups()
                try:
                    vals = [g(sol, aba, f"{GL(cc)}{rr}")
                            for cc in range(column_index_from_string(c1),
                                            column_index_from_string(c2 or c1) + 1)
                            for rr in range(int(r1), int(r2 or r1) + 1)]
                except Exception:      # noqa: BLE001
                    continue
                if any(isinstance(v, (int, float)) and v not in (0, None) for v in vals):
                    achou = True
            if achou:
                com_dados += 1
            else:
                sem_dados.append((ws.title, ch.title))
    checar(f"gráficos com dados ({total} gráficos no arquivo)", com_dados, total)
    for s in sem_dados[:12]:
        print("    gráfico sem valores:", s)


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Testes da planilha de gestão financeira.")
    ap.add_argument("--rapido", action="store_true", help="não executa o motor de cálculo")
    ap.add_argument("--salvar", default=None,
                    help="grava também o .xlsx gerado neste caminho (para entrega)")
    args = ap.parse_args()

    print("=" * 78)
    print("SISTEMA DE GESTÃO FINANCEIRA EMPRESARIAL — VERIFICAÇÃO AUTOMÁTICA")
    print(f"referência dos testes: hoje = {HOJE:%d/%m/%Y} | ano de análise = {ANO} | "
          f"mês de análise = {MES}")
    print("=" * 78)

    print("\n[1/5] Geração da planilha")
    t = time.time()
    wb, _ctx, _ = G.construir()
    wb.save(ARQ_BRUTO)
    print(f"  {len(wb.sheetnames)} abas geradas em {time.time()-t:.1f}s "
          f"({os.path.getsize(ARQ_BRUTO)/1024:,.0f} KB)")
    if args.salvar:
        wb.save(args.salvar)
        print(f"  arquivo de entrega salvo em {args.salvar}")

    etapa_sintaxe(wb)
    etapa_estrutura(wb)

    if args.rapido:
        print("\n[!] --rapido: etapas de cálculo e conferência de valores não executadas.")
    else:
        try:
            import formulas      # noqa: F401
        except ImportError:
            print("\n[!] pacote 'formulas' não instalado: etapas de cálculo puladas.")
        else:
            preparar_copia_leve()
            sol, n_erros = calcular()
            if n_erros == 0:
                ref = verificar_valores(sol)
                verificar_projecao(sol, ref["caixa"])
                verificar_simulador(sol, ref["caixa"])
                verificar_graficos(wb, sol)

    print("\n" + "=" * 78)
    print(f"RESULTADO: {len(OK)} verificações OK | {len(FALHAS)} falhas")
    if FALHAS:
        print("\nFalhas encontradas:")
        for nome, obtido, esperado in FALHAS:
            print(f"  - {nome}: planilha={obtido!r} esperado={esperado!r}")
    print("=" * 78)
    return 1 if FALHAS else 0


if __name__ == "__main__":
    sys.exit(main())
