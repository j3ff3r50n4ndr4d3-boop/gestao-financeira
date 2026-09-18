"""
esperado.py — Cálculo "de referência" (em Python) de tudo que as fórmulas da
planilha devem produzir. Serve para conferir, célula a célula, se a planilha
está correta (fluxo de caixa, DRE, margens, contas a pagar/receber, aging,
inadimplência, orçamento, empréstimos e conciliação).

As regras aqui implementadas são EXATAMENTE as mesmas usadas nas fórmulas:
  * Valor Final (caixa)      = Valor Realizado + Juros + Multa - Desconto
  * Saldo em aberto          = Valor Previsto + Juros + Multa - Desconto - Valor Realizado
  * Valor DRE (competência)  = Valor Previsto + Juros + Multa - Desconto
  * Realizado                = lançamento com data de pagamento/recebimento preenchida
  * Em aberto                = sem data de pagamento e status <> Pago/Recebido/Cancelado
  * Vencido                  = em aberto com vencimento < HOJE
"""
import datetime as dt

from . import dados_exemplo as D
from . import plano_contas as PC

HOJE = D.HOJE
ANO = D.ANO
MES = D.MES
LINHAS = PC.LINHAS_DRE

_MAPA = {p[3]: p for p in PC.PLANO}


def linha_dre(subcat):
    p = _MAPA.get(subcat)
    return p[7] if p else "Não Classificado"


def tipo_fluxo(subcat):
    p = _MAPA.get(subcat)
    return p[6] if p else "Operacional"


def grupo(subcat):
    p = _MAPA.get(subcat)
    return p[1] if p else "Não Classificado"


def vfinal(l):
    if not l["pagto"]:
        return 0.0
    return D.r2((l["vreal"] or 0) + l["juros"] + l["multa"] - l["desconto"])


def vdre(l):
    if l["status"] == "Cancelado":
        return 0.0
    return D.r2(l["vprev"] + l["juros"] + l["multa"] - l["desconto"])


def saldo_aberto(l):
    if l["status"] in ("Pago", "Recebido", "Cancelado"):
        return 0.0
    return D.r2(l["vprev"] + l["juros"] + l["multa"] - l["desconto"] - (l["vreal"] or 0))


def realizado(l):
    return bool(l["pagto"])


def em_aberto(l):
    return l["status"] not in ("Pago", "Recebido", "Cancelado") and saldo_aberto(l) > 0.005


def dias_atraso(l):
    if not em_aberto(l) or l["venc"] >= HOJE:
        return 0
    return (HOJE - l["venc"]).days


def calcular(L=None, orcamento=None, contratos=None, conciliacao=None):
    L = D.LANCAMENTOS if L is None else L
    ORC = D.ORCAMENTO_BASE if orcamento is None else orcamento
    CTR = D.CONTRATOS if contratos is None else contratos
    CONC = D.CONCILIACAO if conciliacao is None else conciliacao
    r = {}

    # ------------------------------------------------------------- DRE mensal
    dre = {linha: {m: 0.0 for m in range(1, 13)} for linha in LINHAS}
    for l in L:
        if l["comp"].year != ANO:
            continue
        dre[linha_dre(l["subcat"])][l["comp"].month] += vdre(l)
    tot = {linha: D.r2(sum(v.values())) for linha, v in dre.items()}
    for linha in LINHAS:
        for m in range(1, 13):
            dre[linha][m] = D.r2(dre[linha][m])

    def _pct(a, b):
        return round(a / b, 4) if b else 0.0

    def linha_resultado(m=None):
        def g(linha):
            return dre[linha][m] if m else tot[linha]
        fat = g("Faturamento Bruto") + g("Outras Receitas Operacionais")
        imp = g("Impostos sobre Vendas")
        dev = g("Devoluções")
        rec_liq = D.r2(fat - imp - dev)
        cv = g("Custos Variáveis")
        mc = D.r2(rec_liq - cv)
        desp_fixas = g("Despesas Fixas")
        ebitda = D.r2(mc - desp_fixas)
        desp_fin = g("Despesas Financeiras")
        rec_fin = g("Receitas Financeiras")
        lair = D.r2(ebitda - desp_fin + rec_fin)
        imp_res = g("Impostos sobre o Resultado")
        lucro = D.r2(lair - imp_res)
        dist = g("Distribuição de Lucros")
        retido = D.r2(lucro - dist)
        capex = D.r2(sum(vdre(l) for l in L if l["comp"].year == ANO
                         and (l["comp"].month == m if m else True)
                         and linha_dre(l["subcat"]) == "Investimentos (CAPEX)"
                         and l["tipo"] == "Saída"))
        financ = D.r2(sum((1 if l["tipo"] == "Entrada" else -1) * vdre(l) for l in L
                          if l["comp"].year == ANO and (l["comp"].month == m if m else True)
                          and linha_dre(l["subcat"]) == "Financiamentos e Sócios (Principal)"))
        return dict(fat_bruto=g("Faturamento Bruto"), outras=g("Outras Receitas Operacionais"),
                    faturamento_total=fat, impostos=imp, devolucoes=dev, receita_liquida=rec_liq,
                    custos_variaveis=cv, margem_contribuicao=mc, despesas_fixas=desp_fixas,
                    ebitda=ebitda, despesas_financeiras=desp_fin, receitas_financeiras=rec_fin,
                    lair=lair, impostos_resultado=imp_res, lucro_liquido=lucro,
                    distribuicao=dist, lucro_retido=retido, capex=capex, financiamentos=financ,
                    margem_bruta=_pct(g("Faturamento Bruto") - imp - cv, g("Faturamento Bruto")),
                    margem_contribuicao_pct=_pct(mc, rec_liq),
                    margem_operacional=_pct(ebitda, rec_liq),
                    margem_liquida=_pct(lucro, rec_liq))

    r["dre_mes"] = {m: linha_resultado(m) for m in range(1, 13)}
    r["dre_ano"] = linha_resultado(None)
    r["dre_linhas"] = dre
    r["dre_total_linhas"] = tot

    # ------------------------------------------------------------- caixa
    ent_mes = {m: 0.0 for m in range(1, 13)}
    sai_mes = {m: 0.0 for m in range(1, 13)}
    saldo_contas = {}
    for l in L:
        if realizado(l):
            m = l["pagto"].month
            if l["pagto"].year == ANO:
                if l["tipo"] == "Entrada":
                    ent_mes[m] += vfinal(l)
                else:
                    sai_mes[m] += vfinal(l)
            if l["banco"] in [c["nome"] for c in D.CONTAS]:
                saldo_contas[l["banco"]] = saldo_contas.get(l["banco"], 0.0) + \
                    (vfinal(l) if l["tipo"] == "Entrada" else -vfinal(l))
    r["entradas_mes"] = {m: D.r2(v) for m, v in ent_mes.items()}
    r["saidas_mes"] = {m: D.r2(v) for m, v in sai_mes.items()}
    r["resultado_mes"] = {m: D.r2(ent_mes[m] - sai_mes[m]) for m in range(1, 13)}
    r["entradas_ano"] = D.r2(sum(ent_mes.values()))
    r["saidas_ano"] = D.r2(sum(sai_mes.values()))
    abertura = D.r2(sum(c["saldo_inicial"] for c in D.CONTAS))
    r["saldo_inicial_contas"] = abertura
    r["saldo_atual_contas"] = {c["nome"]: D.r2(c["saldo_inicial"] + saldo_contas.get(c["nome"], 0.0))
                               for c in D.CONTAS}
    r["saldo_atual_total"] = D.r2(abertura + sum(saldo_contas.values()))
    # fluxo por tipo (operacional / investimento / financiamento)
    fluxo = {"Operacional": {"Entrada": 0.0, "Saída": 0.0},
             "Investimento": {"Entrada": 0.0, "Saída": 0.0},
             "Financiamento": {"Entrada": 0.0, "Saída": 0.0}}
    for l in L:
        if realizado(l) and l["pagto"].year == ANO:
            fluxo[tipo_fluxo(l["subcat"])][l["tipo"]] += vfinal(l)
    r["fluxo_tipo"] = {k: {kk: D.r2(vv) for kk, vv in v.items()} for k, v in fluxo.items()}

    # ------------------------------------------------------------- contas a pagar
    ap = [l for l in L if l["tipo"] == "Saída" and em_aberto(l)]
    r["ap_total_aberto"] = D.r2(sum(saldo_aberto(l) for l in ap))
    r["ap_vencido"] = D.r2(sum(saldo_aberto(l) for l in ap if l["venc"] < HOJE))
    r["ap_vence_hoje"] = D.r2(sum(saldo_aberto(l) for l in ap if l["venc"] == HOJE))
    r["ap_7"] = D.r2(sum(saldo_aberto(l) for l in ap if HOJE < l["venc"] <= HOJE + dt.timedelta(days=7)))
    r["ap_30"] = D.r2(sum(saldo_aberto(l) for l in ap if HOJE + dt.timedelta(days=7) < l["venc"] <= HOJE + dt.timedelta(days=30)))
    r["ap_qtd_vencidas"] = sum(1 for l in ap if l["venc"] < HOJE)
    r["ap_previsto_ano"] = D.r2(sum(vdre(l) for l in L if l["tipo"] == "Saída"))
    r["ap_pago_mes"] = D.r2(sum(vfinal(l) for l in L if l["tipo"] == "Saída" and realizado(l)
                               and l["pagto"].month == MES and l["pagto"].year == ANO))
    r["ap_pago_ano"] = D.r2(sum(vfinal(l) for l in L if l["tipo"] == "Saída" and realizado(l)
                               and l["pagto"].year == ANO))
    faixas_ap = [("1 a 7 dias", 1, 7), ("8 a 15 dias", 8, 15), ("16 a 30 dias", 16, 30),
                 ("31 a 60 dias", 31, 60), ("61 a 90 dias", 61, 90), ("Mais de 90 dias", 91, 100000)]
    r["ap_faixas"] = {nome: D.r2(sum(saldo_aberto(l) for l in ap if de <= dias_atraso(l) <= ate))
                      for nome, de, ate in faixas_ap}

    # ----------------------------------------------------------- contas a receber
    ar = [l for l in L if l["tipo"] == "Entrada" and em_aberto(l)
          and linha_dre(l["subcat"]) in ("Faturamento Bruto", "Outras Receitas Operacionais")]
    r["ar_total_aberto"] = D.r2(sum(saldo_aberto(l) for l in ar))
    r["ar_vencido"] = D.r2(sum(saldo_aberto(l) for l in ar if l["venc"] < HOJE))
    r["ar_a_vencer"] = D.r2(sum(saldo_aberto(l) for l in ar if l["venc"] >= HOJE))
    r["ar_vence_hoje"] = D.r2(sum(saldo_aberto(l) for l in ar if l["venc"] == HOJE))
    r["ar_7"] = D.r2(sum(saldo_aberto(l) for l in ar if HOJE < l["venc"] <= HOJE + dt.timedelta(days=7)))
    r["ar_30"] = D.r2(sum(saldo_aberto(l) for l in ar if HOJE + dt.timedelta(days=7) < l["venc"] <= HOJE + dt.timedelta(days=30)))
    r["ar_recebido_ano"] = D.r2(sum(vfinal(l) for l in L if l["tipo"] == "Entrada" and realizado(l)
                                    and l["pagto"].year == ANO
                                    and linha_dre(l["subcat"]) in ("Faturamento Bruto", "Outras Receitas Operacionais")))
    r["ar_recebido_mes"] = D.r2(sum(vfinal(l) for l in L if l["tipo"] == "Entrada" and realizado(l)
                                    and l["pagto"].month == MES and l["pagto"].year == ANO
                                    and linha_dre(l["subcat"]) in ("Faturamento Bruto", "Outras Receitas Operacionais")))
    r["ar_faixas"] = {nome: D.r2(sum(saldo_aberto(l) for l in ar if de <= dias_atraso(l) <= ate))
                      for nome, de, ate in faixas_ap}
    r["ar_qtd_vencidas"] = sum(1 for l in ar if l["venc"] < HOJE)
    clientes_dev = {}
    for l in ar:
        if l["venc"] < HOJE:
            clientes_dev[l["entidade"]] = clientes_dev.get(l["entidade"], 0.0) + saldo_aberto(l)
    r["inad_por_cliente"] = {k: D.r2(v) for k, v in sorted(clientes_dev.items(), key=lambda x: -x[1])}
    r["inad_qtd_clientes"] = len(clientes_dev)
    fat_ano = tot["Faturamento Bruto"]
    carteira = r["ar_total_aberto"] + r["ar_recebido_ano"]
    r["inad_pct_sobre_faturamento"] = D.r2(r["ar_vencido"] / fat_ano) if fat_ano else 0
    r["inad_pct_sobre_carteira"] = D.r2(r["ar_vencido"] / carteira) if carteira else 0

    # ticket médio e quantidade de vendas (cada venda conta uma vez: parcela 1)
    vendas = [l for l in L if l["subcat"] in ("Vendas de Produtos", "Vendas de Serviços") and l["nparc"] == 1]
    r["qtd_vendas_ano"] = len(vendas)
    r["qtd_vendas_mes"] = sum(1 for l in vendas if l["comp"].month == MES)
    r["ticket_medio_ano"] = D.r2(fat_ano / len(vendas)) if vendas else 0
    fat_mes = sum(l["vprev"] for l in L if l["comp"].month == MES
                  and l["subcat"] in ("Vendas de Produtos", "Vendas de Serviços"))
    r["faturamento_mes"] = D.r2(fat_mes)
    r["qtd_vendas_mes_comp"] = sum(1 for l in vendas if l["comp"].month == MES)
    r["ticket_medio_mes"] = D.r2(fat_mes / r["qtd_vendas_mes_comp"]) if r["qtd_vendas_mes_comp"] else 0

    # contas a receber por cliente (carteira e vencido)
    r["cliente_carteira"] = {}
    r["cliente_vencido"] = {}
    r["cliente_total_comprado"] = {}
    r["cliente_qtd_compras"] = {}
    for c in D.CLIENTES:
        nome = c["razao"]
        carteira_c = sum(saldo_aberto(l) for l in ar if l["entidade"] == nome)
        venc_c = sum(saldo_aberto(l) for l in ar if l["entidade"] == nome and l["venc"] < HOJE)
        comprado = sum(l["vprev"] for l in L if l["entidade"] == nome
                       and l["subcat"] in ("Vendas de Produtos", "Vendas de Serviços"))
        qtd = sum(1 for l in L if l["entidade"] == nome and l["nparc"] == 1
                  and l["subcat"] in ("Vendas de Produtos", "Vendas de Serviços"))
        r["cliente_carteira"][nome] = D.r2(carteira_c)
        r["cliente_vencido"][nome] = D.r2(venc_c)
        r["cliente_total_comprado"][nome] = D.r2(comprado)
        r["cliente_qtd_compras"][nome] = qtd
    # fornecedores
    r["fornecedor_total_comprado"] = {}
    r["fornecedor_total_pago"] = {}
    r["fornecedor_aberto"] = {}
    for f in D.FORNECEDORES:
        nome = f["razao"]
        comprado = sum(l["vprev"] for l in L if l["entidade"] == nome and l["tipo"] == "Saída")
        pago = sum(vfinal(l) for l in L if l["entidade"] == nome and l["tipo"] == "Saída" and realizado(l))
        aberto = sum(saldo_aberto(l) for l in L if l["entidade"] == nome and l["tipo"] == "Saída")
        r["fornecedor_total_comprado"][nome] = D.r2(comprado)
        r["fornecedor_total_pago"][nome] = D.r2(pago)
        r["fornecedor_aberto"][nome] = D.r2(aberto)

    # prazos médios (ponderados pelos valores efetivamente liquidados no ano)
    def prazo_medio(tipo):
        num = den = 0.0
        for l in L:
            if l["tipo"] == tipo and realizado(l) and l["vreal"] and l["pagto"].year == ANO:
                num += (l["pagto"] - l["comp"]).days * (l["vreal"] or 0)
                den += (l["vreal"] or 0)
        return D.r2(num / den) if den else 0.0

    r["pmr_real"] = prazo_medio("Entrada")
    r["pmp_real"] = prazo_medio("Saída")
    r["pmr_real_recebimentos"] = 0.0
    num = den = 0.0
    for l in L:
        if l["tipo"] == "Entrada" and realizado(l) and l["vreal"] and l["pagto"].year == ANO \
                and linha_dre(l["subcat"]) == "Faturamento Bruto":
            num += (l["pagto"] - l["comp"]).days * l["vreal"]
            den += l["vreal"]
    r["pmr_real_recebimentos"] = D.r2(num / den) if den else 0.0

    # ------------------------------------------------------- capital de giro
    saldo_disp = r["saldo_atual_total"]
    r["capital_giro_liquido"] = D.r2(saldo_disp + r["ar_total_aberto"] - r["ap_total_aberto"])
    despesas_fixas_mes = r["dre_mes"][MES]["despesas_fixas"] or 0
    r["despesas_fixas_mes_ref"] = D.r2(despesas_fixas_mes)
    r["ncg"] = D.r2(r["ar_total_aberto"] - r["ap_total_aberto"] + despesas_fixas_mes)

    # ------------------------------------------------------------- orçamento
    orc_real = {}
    for m in range(1, 13):
        for subcat, valores in ORC.items():
            orc_real.setdefault(subcat, {"orcado": [0.0] * 12, "realizado": [0.0] * 12})
            orc_real[subcat]["orcado"][m - 1] = valores[m - 1]
            orc_real[subcat]["realizado"][m - 1] = D.r2(sum(
                vdre(l) for l in L if l["subcat"] == subcat and l["comp"].month == m
                and l["comp"].year == ANO))
    r["orcamento"] = orc_real
    r["orc_total_orcado"] = D.r2(sum(v["orcado"][m - 1] for v in orc_real.values() for m in range(1, 13)))
    r["orc_total_realizado"] = D.r2(sum(v["realizado"][m - 1] for v in orc_real.values() for m in range(1, 13)))

    # --------------------------------------------------------- empréstimos
    emp = {}
    tot_juros_pago = tot_amort_pago = tot_juros_fut = tot_amort_fut = 0.0
    for c in CTR:
        rows = D.parcelas_contrato(c)
        pago = [p for p in rows if p["venc"] <= HOJE]
        fut = [p for p in rows if p["venc"] > HOJE]
        juros_pago = D.r2(sum(p["juros"] for p in pago))
        amort_pago = D.r2(sum(p["amort"] for p in pago))
        saldo_dev = D.r2(sum(p["amort"] for p in fut)) if fut else 0.0
        emp[c["contrato"]] = dict(parcela=rows[0]["parcela"], nparc=c["nparc"], valor=c["valor"],
                                  qtd_paga=len(pago), juros_pago=juros_pago, amort_pago=amort_pago,
                                  saldo_devedor=saldo_dev, juros_futuro=D.r2(sum(p["juros"] for p in fut)),
                                  total_juros=D.r2(sum(p["juros"] for p in rows)),
                                  proxima=(fut[0]["venc"] if fut else None),
                                  prox_parcela=(fut[0]["parcela"] if fut else 0.0))
        tot_juros_pago += juros_pago
        tot_amort_pago += amort_pago
        tot_juros_fut += D.r2(sum(p["juros"] for p in fut))
        tot_amort_fut += saldo_dev
    r["emprestimos"] = emp
    r["divida_total"] = D.r2(sum(v["saldo_devedor"] for v in emp.values()))
    r["juros_pagos_total"] = D.r2(tot_juros_pago)
    r["principal_pago_total"] = D.r2(tot_amort_pago)
    r["juros_futuros_total"] = D.r2(tot_juros_fut)

    # parcelas de empréstimo (principal + juros) por mês futuro
    serviço = {m: 0.0 for m in range(1, 13)}
    principal = {m: 0.0 for m in range(1, 13)}
    for c in CTR:
        for p in D.parcelas_contrato(c):
            if p["venc"] > HOJE and p["venc"].year == ANO:
                serviço[p["venc"].month] += p["parcela"]
                principal[p["venc"].month] += p["amort"]
    r["servico_divida_mes"] = {m: D.r2(v) for m, v in serviço.items()}
    r["principal_divida_mes"] = {m: D.r2(v) for m, v in principal.items()}

    # comprometimento mensal (parcela do mês / faturamento do mês)
    parc_mes = D.r2(sum(p["parcela"] for c in CTR for p in D.parcelas_contrato(c)
                        if p["venc"].month == MES and p["venc"].year == ANO))
    r["parcela_divida_mes"] = parc_mes
    r["comprometimento"] = D.r2(parc_mes / fat_mes) if fat_mes else 0

    # ---------------------------------------------------------- conciliação
    tot_extrato = D.r2(sum(x["valor"] for x in CONC))
    tot_conc = D.r2(sum(x["valor"] for x in CONC if x["conciliado"] == "Conciliado"))
    tot_pend = D.r2(sum(x["valor"] for x in CONC if x["conciliado"] == "Pendente"))
    tot_div = D.r2(sum(x["valor"] for x in CONC if x["conciliado"] == "Divergente"))
    r["conc_total_extrato"] = tot_extrato
    r["conc_conciliado"] = tot_conc
    r["conc_pendente"] = tot_pend
    r["conc_divergente"] = tot_div
    r["conc_qtd_pend"] = sum(1 for x in CONC if x["conciliado"] == "Pendente")
    r["conc_qtd_div"] = sum(1 for x in CONC if x["conciliado"] == "Divergente")

    # --------------------------------------------------- despesas por categoria
    desp = {}
    for l in L:
        if l["tipo"] == "Saída" and l["comp"].year == ANO and l["cat"] in (
                "Custos Variáveis", "Despesas Administrativas", "Despesas com Pessoal",
                "Despesas Comerciais", "Despesas Financeiras", "Tributos"):
            desp[l["subcat"]] = desp.get(l["subcat"], 0.0) + vdre(l)
    r["despesas_categoria"] = {k: D.r2(v) for k, v in sorted(desp.items(), key=lambda x: -x[1])}

    # --------------------------------------------- centro de custo / resultado
    cc = {}
    for l in L:
        if l["comp"].year != ANO:
            continue
        d = cc.setdefault(l["cc"], dict(receita=0.0, custos=0.0, despesas=0.0, impostos=0.0))
        linha = linha_dre(l["subcat"])
        if linha in ("Faturamento Bruto", "Outras Receitas Operacionais", "Receitas Financeiras"):
            d["receita"] += vdre(l)
        elif linha == "Custos Variáveis":
            d["custos"] += vdre(l)
        elif linha in ("Despesas Fixas", "Despesas Financeiras"):
            d["despesas"] += vdre(l)
        elif linha in ("Impostos sobre Vendas", "Impostos sobre o Resultado", "Devoluções"):
            d["impostos"] += vdre(l)
    r["centro_custo"] = {k: {kk: D.r2(vv) for kk, vv in v.items()} for k, v in cc.items()}

    # -------------------------------------------------- ponto de equilíbrio
    anual = r["dre_ano"]
    r["pe_receita"] = anual["receita_liquida"]
    r["pe_mc_pct"] = D.r2(anual["margem_contribuicao"] / anual["receita_liquida"]) if anual["receita_liquida"] else 0
    r["pe_fixos_mes"] = D.r2(sum(r["dre_mes"][m]["despesas_fixas"] for m in range(1, MES + 1)) / max(MES, 1))
    if r["pe_mc_pct"]:
        r["pe_ponto_equilibrio_mes"] = D.r2(r["pe_fixos_mes"] / r["pe_mc_pct"])
    else:
        r["pe_ponto_equilibrio_mes"] = 0.0
    r["pe_ticket"] = r["ticket_medio_ano"]
    r["pe_qtd_mes"] = D.r2(r["pe_ponto_equilibrio_mes"] / r["pe_ticket"]) if r["pe_ticket"] else 0

    return r
