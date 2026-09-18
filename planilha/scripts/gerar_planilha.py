"""
gerar_planilha.py — gera o arquivo final do Sistema de Gestão Financeira Empresarial.

Uso:
    python3 gerar_planilha.py [caminho_saida.xlsx]

O arquivo é criado com dados de exemplo, fórmulas, validações, formatação condicional,
gráficos, áreas de impressão e proteção das células de fórmula.
"""
import datetime as dt
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import openpyxl
from openpyxl.workbook.properties import CalcProperties

from lib import dados_exemplo as D
from lib import estilos as E
from lib import parametros as P
from lib import util as U
from abas import (cadastros, configuracoes, contas, executivo, financeiro, indicadores,
                  lancamentos, planejamento)

SAIDA = os.environ.get(
    "SAIDA_XLSX",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "GESTAO_FINANCEIRA_EMPRESARIAL.xlsx"))


class Ctx:
    """Contexto compartilhado entre os construtores das abas."""
    pass


def proteger(ws, senha=None):
    """Protege a aba permitindo usar filtros, ordenar e formatar (sem travar o usuário)."""
    ws.protection.sheet = True
    if senha:
        ws.protection.password = senha
    ws.protection.selectLockedCells = False
    ws.protection.selectUnlockedCells = False
    ws.protection.formatCells = False
    ws.protection.formatColumns = False
    ws.protection.formatRows = False
    ws.protection.insertRows = False
    ws.protection.deleteRows = False
    ws.protection.sort = False
    ws.protection.autoFilter = False
    ws.protection.pivotTables = True


def construir():
    t0 = time.time()
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    E.registrar_estilos(wb)
    wb.properties.title = "Sistema de Gestão Financeira Empresarial"
    wb.properties.subject = "Gestão financeira para pequenas e médias empresas"
    wb.properties.creator = D.CFG_CIA["responsavel"]
    wb.properties.company = D.CFG_CIA["razao"]
    wb.properties.keywords = "financeiro, DRE, fluxo de caixa, orçamento, indicadores, dashboard"
    wb.properties.description = ("Planilha completa de gestão financeira: lançamentos, contas a pagar e "
                                 "a receber, fluxo de caixa, DRE gerencial, orçamento, empréstimos, "
                                 "conciliação bancária, inadimplência, indicadores, projeções e dashboard.")

    ctx = Ctx()
    ordem_construcao = [
        ("CONFIGURAÇÕES", configuracoes.construir),
        ("CADASTRO DE CLIENTES", cadastros.clientes),
        ("CADASTRO DE FORNECEDORES", cadastros.fornecedores),
        ("PLANO DE CONTAS", cadastros.plano_contas),
        ("CENTRO DE CUSTOS", cadastros.centro_custos),
        ("CONTAS BANCÁRIAS", cadastros.contas_bancarias),
        ("CARTÕES", cadastros.cartoes),
        ("LANÇAMENTOS", lancamentos.construir),
        ("CONTAS A PAGAR", contas.contas_pagar),
        ("CONTAS A RECEBER", contas.contas_receber),
        ("INADIMPLÊNCIA", contas.inadimplencia),
        ("CONCILIAÇÃO BANCÁRIA", contas.conciliacao),
        ("FLUXO DE CAIXA", financeiro.fluxo_caixa),
        ("DRE GERENCIAL", financeiro.dre),
        ("ORÇAMENTO X REALIZADO", financeiro.orcamento),
        ("EMPRÉSTIMOS E FINANCIAMENTOS", financeiro.emprestimos),
        ("PONTO DE EQUILÍBRIO", indicadores.ponto_equilibrio),
        ("SIMULADOR DE CENÁRIOS", indicadores.simulador),
        ("INDICADORES", indicadores.indicadores),
        ("DESPESAS RECORRENTES", planejamento.despesas_recorrentes),
        ("PROJEÇÃO DE CAIXA", planejamento.projecao_caixa),
        ("DASHBOARD", executivo.dashboard),
        ("PAINEL DE CONTROLE", executivo.painel_controle),
        ("RELATÓRIOS", executivo.relatorios),
        ("INSTRUÇÕES", executivo.instrucoes),
    ]
    for rotulo, func in ordem_construcao:
        ws = func(wb, ctx)
        assert ws.title == rotulo, f"{ws.title} != {rotulo}"
        print(f"  ok  {rotulo:<32} ({time.time() - t0:5.1f}s)")

    # ordem final das abas (menu, instruções, dashboard, bases, análises, relatórios)
    wb._sheets = [wb[nome] for nome in P.ORDEM_ABAS]

    # proteção das abas (dados de exemplo continuam editáveis nas células amarelas)
    for ws in wb.worksheets:
        proteger(ws)

    # recálculo completo ao abrir (Excel e Google Sheets)
    wb.calculation = CalcProperties(fullCalcOnLoad=True)
    wb.active = 0
    wb.worksheets[0].sheet_view.tabSelected = True
    for ws in wb.worksheets[1:]:
        ws.sheet_view.tabSelected = False
    return wb, ctx, t0


def main():
    saida = sys.argv[1] if len(sys.argv) > 1 else SAIDA
    print("Gerando o Sistema de Gestão Financeira Empresarial...")
    wb, ctx, t0 = construir()
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    wb.save(saida)
    tam = os.path.getsize(saida) / 1024
    n_form = sum(1 for ws in wb.worksheets for row in ws.iter_rows()
                 for c in row if isinstance(c.value, str) and c.value.startswith("="))
    n_val = sum(len(ws.data_validations.dataValidation) for ws in wb.worksheets)
    n_cf = sum(len(ws.conditional_formatting._cf_rules) for ws in wb.worksheets)
    print("-" * 60)
    print(f"arquivo .......... {saida}")
    print(f"tamanho .......... {tam:,.0f} KB")
    print(f"abas ............. {len(wb.worksheets)}")
    print(f"fórmulas ......... {n_form:,}")
    print(f"regras de validação {n_val}")
    print(f"regras de formatação condicional {n_cf}")
    print(f"lançamentos de exemplo: {len(D.LANCAMENTOS)}")
    print(f"tempo total ...... {time.time() - t0:5.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
