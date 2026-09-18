"""
dados_exemplo.py — Cenário de teste completo (100% fictício e determinístico).

Empresa: AURORA COMÉRCIO DE ALIMENTOS LTDA (distribuidora de alimentos),
Simples Nacional, São Paulo/SP — 5 clientes, ~24 fornecedores, 6 contas/cartões,
3 contratos de crédito, ~430 lançamentos (vendas à vista, a prazo, parceladas,
pagas, pendentes e vencidas), orçamento anual, despesas recorrentes e extrato
bancário para conciliação.

Tudo é gerado em torno da data de referência (HOJE) com semente fixa, portanto
o resultado é sempre o mesmo. A função `resumo()` calcula em Python os valores
que as fórmulas da planilha devem produzir (usada pelo script de verificação).
"""
import calendar
import datetime as dt
import random

HOJE = dt.date.today()
ANO = HOJE.year
MES = HOJE.month
_rnd = random.Random(f"{ANO}-{MES:02d}-aurora-financeira")


# ----------------------------------------------------------------- utilidades
def mais_meses(d, m):
    y = d.year + (d.month - 1 + m) // 12
    mo = (d.month - 1 + m) % 12 + 1
    dia = min(d.day, calendar.monthrange(y, mo)[1])
    return dt.date(y, mo, dia)


def inc(d, dias):
    return d + dt.timedelta(days=dias)


def r2(v):
    return round(v + 1e-9, 2)


def pmt(taxa, n, vp):
    return vp * taxa / (1 - (1 + taxa) ** (-n))


def dia_mes(m, dia):
    """Data no mês m do ano-base com dia ajustado ao último dia do mês."""
    if m > 12:
        m -= 12
    return dt.date(ANO, m, min(dia, calendar.monthrange(ANO, m)[1]))


def var(base, pct=0.0):
    if not pct:
        return r2(base)
    return r2(base * (1 + _rnd.uniform(-pct, pct)))


# ------------------------------------------------------- PARÂMETROS DA EMPRESA
CFG_CIA = dict(
    razao="AURORA COMÉRCIO DE ALIMENTOS LTDA", fantasia="Aurora Distribuidora",
    cnpj="12.345.678/0001-90", segmento="Distribuição de alimentos e bebidas para revenda",
    regime="Simples Nacional", responsavel="Jefferson Andrade",
    email="financeiro@auroradistribuidora.com.br", telefone="(11) 4002-8922",
    meta_fat=230000.0, meta_lucro=20000.0, margem_min=0.10, saldo_min=30000.0,
    inad_max=0.05, pmr_alvo=30, pmp_alvo=30, aliquota=0.085, taxa_padrao=0.014,
    meta_cresc=0.02, reserva_giro=2,
)

# ----------------------------------------------------------------- CADASTROS
CLI = {
    "CLI001": dict(cod="CLI001", razao="MERCADO BOA COMPRA LTDA", fantasia="Boa Compra Supermercados",
                   doc="12.345.678/0001-11", tel="(11) 3456-7890", whats="(11) 99876-5432",
                   email="compras@boacompra.com.br", cidade="São Paulo", uf="SP", segmento="Supermercados",
                   vendedor="Carlos Menezes", limite=90000.0, cadastro=dt.date(2023, 3, 12), status="Ativo",
                   obs="Cliente âncora — pedidos semanais, boleto 30 dias"),
    "CLI002": dict(cod="CLI002", razao="PADARIA PÃO DOURADO ME", fantasia="Pão Dourado",
                   doc="22.456.789/0001-22", tel="(11) 2765-4321", whats="(11) 99765-1122",
                   email="financeiro@paodourado.com.br", cidade="Santo André", uf="SP", segmento="Padarias",
                   vendedor="Ana Paula Souza", limite=30000.0, cadastro=dt.date(2024, 6, 3), status="Ativo",
                   obs="Pagamento à vista (PIX) na entrega"),
    "CLI003": dict(cod="CLI003", razao="RESTAURANTE SABOR CASEIRO LTDA", fantasia="Sabor Caseiro",
                   doc="33.567.890/0001-33", tel="(11) 3322-1100", whats="(11) 99654-7788",
                   email="contato@saborcaseiro.com.br", cidade="São Paulo", uf="SP", segmento="Restaurantes",
                   vendedor="Carlos Menezes", limite=45000.0, cadastro=dt.date(2023, 11, 20), status="Ativo",
                   obs="Entrega 2x por semana, boleto 15 dias"),
    "CLI004": dict(cod="CLI004", razao="HOTEL VISTA ALEGRE LTDA", fantasia="Hotel Vista Alegre",
                   doc="44.678.901/0001-44", tel="(11) 2222-3344", whats="(11) 99555-2211",
                   email="compras@vistaalegrehotel.com.br", cidade="Guarulhos", uf="SP", segmento="Hotelaria",
                   vendedor="Ana Paula Souza", limite=50000.0, cadastro=dt.date(2024, 1, 15), status="Bloqueado",
                   obs="INADIMPLENTE — 3 faturas vencidas; bloqueado para novas vendas a prazo"),
    "CLI005": dict(cod="CLI005", razao="EMPÓRIO NATURAL COMÉRCIO LTDA", fantasia="Empório Natural",
                   doc="55.789.012/0001-55", tel="(11) 4002-7788", whats="(11) 99444-3322",
                   email="suprimentos@emporionatural.com.br", cidade="Osasco", uf="SP", segmento="Varejo de Alimentos",
                   vendedor="Carlos Menezes", limite=60000.0, cadastro=dt.date(2024, 9, 8), status="Ativo",
                   obs="Compras parceladas em 2x/3x — acompanhar limite"),
}

CLIENTES = list(CLI.values())

# fornecedores: chave curta -> dados completos (a razão social é usada nos lançamentos)
SUP = {
    "central": dict(razao="DISTRIBUIDORA CENTRAL DE ALIMENTOS S/A", fantasia="Central Foods",
                    doc="61.890.123/0001-66", contato="Roberto Lima", tel="(11) 3701-2200",
                    email="vendas@centralfoods.com.br", cidade="São Paulo", uf="SP",
                    categoria="Mercadorias para Revenda", condicao="Boleto 30 dias", prazo=30,
                    limite=250000.0, status="Ativo", obs="Principal fornecedor de mercadorias"),
    "embalagens": dict(razao="EMBALAGENS PAULISTA LTDA", fantasia="Embalagens Paulista",
                       doc="72.901.234/0001-77", contato="Fernanda Dias", tel="(11) 2933-4455",
                       email="comercial@embalagenspaulista.com.br", cidade="São Bernardo do Campo", uf="SP",
                       categoria="Embalagens", condicao="Boleto 15 dias", prazo=15, limite=40000.0,
                       status="Ativo", obs=""),
    "rapidalog": dict(razao="TRANSPORTADORA RÁPIDA LOG LTDA", fantasia="Rápida Log",
                      doc="83.012.345/0001-88", contato="José Almeida", tel="(11) 3011-9090",
                      email="faturamento@rapidalog.com.br", cidade="Guarulhos", uf="SP",
                      categoria="Fretes e Entregas sobre Vendas", condicao="Boleto 15 dias", prazo=15,
                      limite=60000.0, status="Ativo", obs="Frete faturado por nota fiscal"),
    "abcsistemas": dict(razao="TECNOLOGIA E SISTEMAS ABC LTDA", fantasia="ABC Sistemas",
                        doc="94.123.456/0001-99", contato="Marcelo Prado", tel="(11) 4063-1122",
                        email="suporte@abcsistemas.com.br", cidade="São Paulo", uf="SP",
                        categoria="Sistemas e Softwares", condicao="Cartão de crédito", prazo=0,
                        limite=15000.0, status="Ativo", obs="ERP, emissão de NF-e e BI"),
    "pinheiros": dict(razao="IMÓVEIS E LOCAÇÕES PINHEIROS LTDA", fantasia="Locadora Pinheiros",
                      doc="15.234.567/0001-10", contato="Cláudia Rossi", tel="(11) 3812-7777",
                      email="locacao@pinheirosimoveis.com.br", cidade="São Paulo", uf="SP",
                      categoria="Aluguel", condicao="Boleto 5 dias", prazo=5, limite=0.0,
                      status="Ativo", obs="Contrato de locação do galpão — reajuste anual em janeiro"),
    "enel": dict(razao="ENEL DISTRIBUIÇÃO SÃO PAULO", fantasia="Enel SP", doc="61.695.227/0001-93",
                 contato="Central de Atendimento", tel="0800 727 2116", email="atendimento@enel.com",
                 cidade="São Paulo", uf="SP", categoria="Energia Elétrica", condicao="Débito automático",
                 prazo=10, limite=0.0, status="Ativo", obs="Concessionária de energia elétrica"),
    "sabesp": dict(razao="SABESP — SANEAMENTO BÁSICO DO ESTADO DE SÃO PAULO", fantasia="Sabesp",
                   doc="43.776.517/0001-80", contato="Central de Atendimento", tel="0800 055 0195",
                   email="atendimento@sabesp.com.br", cidade="São Paulo", uf="SP", categoria="Água e Saneamento",
                   condicao="Débito automático", prazo=12, limite=0.0, status="Ativo", obs="Concessionária de água"),
    "vivo": dict(razao="TELEFÔNICA BRASIL S.A. (VIVO EMPRESAS)", fantasia="Vivo Empresas",
                 doc="02.558.157/0001-62", contato="Gestor de Contas", tel="1058",
                 email="empresas@vivo.com.br", cidade="São Paulo", uf="SP", categoria="Internet e Telefonia",
                 condicao="Cartão de crédito", prazo=0, limite=0.0, status="Ativo", obs="Link dedicado e telefonia móvel"),
    "contabil": dict(razao="CONTABILIDADE AURORA ASSESSORIA CONTÁBIL LTDA", fantasia="Contabilidade Aurora",
                     doc="18.447.902/0001-34", contato="Sérgio Tavares", tel="(11) 3151-8080",
                     email="contato@contabilaurora.com.br", cidade="São Paulo", uf="SP", categoria="Contabilidade",
                     condicao="PIX mensal", prazo=0, limite=0.0, status="Ativo", obs="Assessoria contábil e fiscal"),
    "pulso": dict(razao="AGÊNCIA PULSO DIGITAL LTDA", fantasia="Pulso Digital",
                  doc="29.334.556/0001-71", contato="Renata Campos", tel="(11) 99123-4567",
                  email="contato@pulsodigital.com.br", cidade="São Paulo", uf="SP", categoria="Marketing Digital",
                  condicao="Cartão de crédito", prazo=0, limite=20000.0, status="Ativo", obs="Gestão de mídia paga"),
    "google": dict(razao="GOOGLE BRASIL INTERNET LTDA", fantasia="Google Ads", doc="06.990.590/0001-23",
                   contato="Suporte", tel="—", email="ads@google.com", cidade="São Paulo", uf="SP",
                   categoria="Publicidade e Anúncios", condicao="Cartão de crédito", prazo=0, limite=0.0,
                   status="Ativo", obs="Anúncios e campanhas digitais"),
    "beneficios": dict(razao="BENEFÍCIOS BRASIL ADMINISTRADORA LTDA", fantasia="Benefícios Brasil",
                       doc="09.876.543/0001-21", contato="Time de Atendimento", tel="(11) 4004-1010",
                       email="empresas@beneficiosbrasil.com.br", cidade="São Paulo", uf="SP",
                       categoria="Benefícios (VT/VA/Plano de Saúde)", condicao="Transferência", prazo=5,
                       limite=0.0, status="Ativo", obs="Vale-transporte, alimentação e plano de saúde"),
    "rfb": dict(razao="RECEITA FEDERAL DO BRASIL", fantasia="Receita Federal", doc="00.394.460/0001-85",
                contato="—", tel="—", email="—", cidade="Brasília", uf="DF", categoria="Tributos",
                condicao="DAS/débito automático", prazo=20, limite=0.0, status="Ativo",
                obs="Tributos federais — Simples Nacional"),
    "prefeitura": dict(razao="PREFEITURA DE SÃO PAULO", fantasia="Prefeitura SP", doc="46.395.000/0001-39",
                       contato="—", tel="156", email="—", cidade="São Paulo", uf="SP", categoria="Tributos",
                       condicao="Guia municipal", prazo=10, limite=0.0, status="Ativo",
                       obs="Taxas municipais, ISS e alvará"),
    "comissoes": dict(razao="EQUIPE COMERCIAL — COMISSÕES", fantasia="Comissões da equipe",
                      doc="—", contato="Carlos Menezes", tel="(11) 99876-0001", email="comercial@aurora.com.br",
                      cidade="São Paulo", uf="SP", categoria="Comissões sobre Vendas",
                      condicao="Transferência mensal", prazo=5, limite=0.0, status="Ativo",
                      obs="Comissões sobre vendas — pagas no 5º dia útil"),
    "marketplace": dict(razao="MARKETPLACE FOODB2B LTDA", fantasia="FoodB2B", doc="31.222.333/0001-44",
                        contato="Suporte Vendedor", tel="(11) 4004-2222", email="vendedores@foodb2b.com.br",
                        cidade="São Paulo", uf="SP", categoria="Taxas de Marketplace",
                        condicao="Desconto em repasse", prazo=10, limite=0.0, status="Ativo",
                        obs="Taxas de intermediação do marketplace"),
    "cielo": dict(razao="CIELO S.A. — INSTITUIÇÃO DE PAGAMENTO", fantasia="Cielo", doc="01.027.058/0001-91",
                  contato="Central", tel="4002 6601", email="atendimento@cielo.com.br", cidade="Barueri", uf="SP",
                  categoria="Taxas de Cartão e Maquininha", condicao="Débito automático", prazo=5,
                  limite=0.0, status="Ativo", obs="Taxas de cartão e antecipação"),
    "porto": dict(razao="PORTO SEGURO COMPANHIA DE SEGUROS GERAIS", fantasia="Porto Seguro",
                  doc="61.198.164/0001-60", contato="Corretora Rossi", tel="(11) 3366-9000",
                  email="atendimento@portoseguro.com.br", cidade="São Paulo", uf="SP", categoria="Seguros",
                  condicao="Boleto trimestral", prazo=20, limite=0.0, status="Ativo",
                  obs="Seguro do galpão, frota e responsabilidade civil"),
    "papelaria": dict(razao="PAPELARIA CENTRAL LTDA", fantasia="Papelaria Central", doc="54.332.110/0001-09",
                      contato="Balcão", tel="(11) 3222-4455", email="vendas@papelariacentral.com.br",
                      cidade="São Paulo", uf="SP", categoria="Material de Escritório", condicao="Cartão de crédito",
                      prazo=0, limite=0.0, status="Ativo", obs="Material de escritório e consumo"),
    "manutencao": dict(razao="MANUTENÇÃO PREDIAL EXPRESSA LTDA", fantasia="Expressa Manutenção",
                       doc="27.665.443/0001-88", contato="Alexandre", tel="(11) 2675-1234",
                       email="contato@expressamanutencao.com.br", cidade="São Paulo", uf="SP",
                       categoria="Manutenção e Conservação", condicao="PIX após serviço", prazo=10,
                       limite=0.0, status="Ativo", obs="Manutenção predial, empilhadeira e frota"),
    "apoio": dict(razao="APOIO OPERACIONAL SERVIÇOS LTDA", fantasia="Apoio Operacional", doc="35.998.776/0001-55",
                  contato="Vanessa Souza", tel="(11) 2500-3300", email="contato@apoiooperacional.com.br",
                  cidade="Osasco", uf="SP", categoria="Serviços Terceirizados (PJ)",
                  condicao="PIX mensal", prazo=10, limite=0.0, status="Ativo",
                  obs="Equipe terceirizada de separação e expedição"),
    "alfa": dict(razao="MÁQUINAS E EQUIPAMENTOS ALFA LTDA", fantasia="Alfa Máquinas", doc="41.223.344/0001-77",
                 contato="Eduardo Pires", tel="(11) 2099-8080", email="vendas@alfamaquinas.com.br",
                 cidade="São Paulo", uf="SP", categoria="Máquinas e Equipamentos", condicao="28 dias", prazo=28,
                 limite=200000.0, status="Ativo", obs="Equipamentos e seladoras"),
    "beta": dict(razao="MÓVEIS CORPORATIVOS BETA LTDA", fantasia="Beta Móveis", doc="19.887.766/0001-22",
                 contato="Camila Nunes", tel="(11) 3311-7788", email="vendas@betamoveis.com.br",
                 cidade="São Paulo", uf="SP", categoria="Móveis e Utensílios", condicao="Boleto 30 dias",
                 prazo=30, limite=50000.0, status="Ativo", obs="Mobiliário corporativo"),
    "gama": dict(razao="CONSTRUTORA E REFORMAS GAMA LTDA", fantasia="Gama Reformas", doc="23.445.667/0001-11",
                 contato="Ricardo Gama", tel="(11) 2611-2030", email="obras@gamareformas.com.br",
                 cidade="Guarulhos", uf="SP", categoria="Reformas e Benfeitorias", condicao="Medição mensal",
                 prazo=30, limite=120000.0, status="Ativo", obs="Obras e benfeitorias"),
    "bbanco": dict(razao="BANCO DO BRASIL S.A.", fantasia="Banco do Brasil", doc="00.000.000/0001-91",
                   contato="Gerente PJ", tel="(11) 3499-1000", email="pj@bb.com.br", cidade="Brasília",
                   uf="DF", categoria="Empréstimos e Financiamentos", condicao="Débito automático",
                   prazo=10, limite=0.0, status="Ativo", obs="Instituição financeira — capital de giro e financiamentos"),
    "santander": dict(razao="BANCO SANTANDER (BRASIL) S.A.", fantasia="Santander", doc="90.400.888/0001-42",
                      contato="Gerente PJ", tel="(11) 4004-3535", email="pj@santander.com.br", cidade="São Paulo",
                      uf="SP", categoria="Empréstimos e Financiamentos", condicao="Débito automático",
                      prazo=10, limite=0.0, status="Ativo", obs="Financiamento de veículo"),
    "bndes": dict(razao="BNDES / BANCO DO BRASIL", fantasia="BNDES", doc="33.657.248/0001-89",
                  contato="Agente financeiro", tel="(11) 3499-1000", email="bndes@bb.com.br", cidade="Rio de Janeiro",
                  uf="RJ", categoria="Empréstimos e Financiamentos", condicao="Débito automático", prazo=10,
                  limite=0.0, status="Ativo", obs="Financiamento de máquinas e equipamentos"),
    "itau": dict(razao="ITAÚ UNIBANCO S.A.", fantasia="Itaú Unibanco", doc="60.701.190/0001-04",
                 contato="Gerente PJ", tel="(11) 3003-4828", email="pj@itau.com.br", cidade="São Paulo",
                 uf="SP", categoria="Receitas Financeiras", condicao="Crédito em conta", prazo=0,
                 limite=0.0, status="Ativo", obs="Aplicações financeiras e rendimentos"),
    "folha": dict(razao="COLABORADORES — FOLHA DE PAGAMENTO", fantasia="Folha de Pagamento", doc="—",
                  contato="Marina Alves", tel="(11) 3151-8080", email="rh@aurora.com.br", cidade="São Paulo",
                  uf="SP", categoria="Salários", condicao="Transferência no 5º dia útil", prazo=5,
                  limite=0.0, status="Ativo", obs="Folha de pagamento dos colaboradores CLT"),
    "socios": dict(razao="SÓCIOS — PRÓ-LABORE E DISTRIBUIÇÕES", fantasia="Sócios administradores", doc="—",
                   contato="Jefferson Andrade", tel="(11) 99999-0000", email="socios@aurora.com.br",
                   cidade="São Paulo", uf="SP", categoria="Pró-labore", condicao="Transferência mensal",
                   prazo=5, limite=0.0, status="Ativo", obs="Pró-labore e retiradas dos sócios"),
}
FORNECEDORES = [dict(cod=f"FOR{i:03d}", **v) for i, v in enumerate(SUP.values(), start=1)]


def S(k):
    return SUP[k]["razao"]


# bancos e cartões (registro único de contas)
CONTAS = [
    dict(nome="Banco do Brasil — C/C 12345-6", banco="Banco do Brasil", agencia="1234-5", conta="12345-6",
         tipo="Conta Corrente", saldo_inicial=45000.0, limite=20000.0, gerente="(11) 3499-1000",
         status="Ativa", obs="Conta principal — recebimentos e folha"),
    dict(nome="Itaú Unibanco — C/C 45678-9", banco="Itaú Unibanco", agencia="0987", conta="45678-9",
         tipo="Conta Corrente", saldo_inicial=32000.0, limite=15000.0, gerente="(11) 3003-4828",
         status="Ativa", obs="Pagamentos, tributos e fornecedores"),
    dict(nome="Nubank PJ — C/C 9876543-2", banco="Nubank", agencia="0001", conta="9876543-2",
         tipo="Conta Corrente", saldo_inicial=8500.0, limite=0.0, gerente="0800 591 2117",
         status="Ativa", obs="Conta digital — despesas pequenas e PIX"),
    dict(nome="Cartão Visa Itaú Business", banco="Itaú Unibanco", agencia="—", conta="**** 4417",
         tipo="Cartão de crédito", saldo_inicial=0.0, limite=25000.0, gerente="(11) 3003-4828",
         status="Ativa", obs="Compras de fornecedores e viagens"),
    dict(nome="Cartão Mastercard Nubank PJ", banco="Nubank", agencia="—", conta="**** 8823",
         tipo="Cartão de crédito", saldo_inicial=0.0, limite=10000.0, gerente="0800 591 2117",
         status="Ativa", obs="Assinaturas, marketing e serviços digitais"),
    dict(nome="Cartão Elo Banco do Brasil PJ", banco="Banco do Brasil", agencia="—", conta="**** 7751",
         tipo="Cartão de crédito", saldo_inicial=0.0, limite=15000.0, gerente="(11) 3499-1000",
         status="Ativa", obs="Combustível e manutenção da frota"),
]
BANCO_NOMES = [c["nome"] for c in CONTAS]
BB = "Banco do Brasil — C/C 12345-6"
ITAU = "Itaú Unibanco — C/C 45678-9"
NU = "Nubank PJ — C/C 9876543-2"
VISA = "Cartão Visa Itaú Business"
MASTER = "Cartão Mastercard Nubank PJ"
ELO = "Cartão Elo Banco do Brasil PJ"

CARTOES = [
    dict(nome=VISA, bandeira="Visa", banco="Itaú Unibanco", final="4417", limite=25000.0,
         fechamento=25, vencimento=5, conta_pagamento=ITAU, status="Ativo",
         obs="Compras de fornecedores e viagens comerciais"),
    dict(nome=MASTER, bandeira="Mastercard", banco="Nubank", final="8823", limite=10000.0,
         fechamento=20, vencimento=28, conta_pagamento=NU, status="Ativo",
         obs="Assinaturas de software, marketing e serviços digitais"),
    dict(nome=ELO, bandeira="Elo", banco="Banco do Brasil", final="7751", limite=15000.0,
         fechamento=15, vencimento=25, conta_pagamento=BB, status="Ativo",
         obs="Combustível e manutenção da frota"),
]

CENTROS = [
    ("CC01", "Administrativo", "Marina Alves", "Aluguel, utilidades, escritório e pessoal administrativo"),
    ("CC02", "Comercial", "Carlos Menezes", "Equipe de vendas, comissões e prospecção"),
    ("CC03", "Produção", "Roberto Nunes", "Beneficiamento e preparação de pedidos"),
    ("CC04", "Logística", "Paulo Ricardo", "Estoque, expedição, fretes e entregas"),
    ("CC05", "Marketing", "Ana Paula Souza", "Marketing digital, publicidade e eventos"),
    ("CC06", "Financeiro", "Marina Alves", "Tesouraria, cobrança, contabilidade e tributos"),
    ("CC07", "Diretoria", "Jefferson Andrade", "Pró-labore, estratégia e investimentos"),
    ("CC08", "Não alocado", "—", "Lançamentos ainda sem centro de custo definido"),
]

CONTRATOS = [
    dict(instituicao="Banco do Brasil", contrato="CG-2026-0417", modalidade="Capital de Giro",
         valor=60000.0, data=dt.date(ANO, 1, 10), taxa=0.015, nparc=24, sistema="PRICE",
         primeira=dt.date(ANO, 2, 10), garantia="Aval dos sócios", status="Em andamento"),
    dict(instituicao="BNDES / Banco do Brasil", contrato="FIN-2026-1198",
         modalidade="Financiamento de Máquinas", valor=120000.0, data=dt.date(ANO, 2, 20),
         taxa=0.011, nparc=36, sistema="SAC", primeira=dt.date(ANO, 3, 15),
         garantia="Alienação fiduciária do equipamento", status="Em andamento"),
    dict(instituicao="Banco Santander", contrato="VEI-2026-0088", modalidade="Financiamento de Veículo",
         valor=80000.0, data=dt.date(ANO, 1, 25), taxa=0.0125, nparc=48, sistema="PRICE",
         primeira=dt.date(ANO, 2, 20), garantia="Alienação fiduciária do veículo", status="Em andamento"),
]


def parcelas_contrato(c):
    """Cronograma SAC/PRICE — mesma lógica implementada nas fórmulas da planilha."""
    out, saldo = [], c["valor"]
    amort_sac = r2(c["valor"] / c["nparc"])
    parc_price = r2(pmt(c["taxa"], c["nparc"], c["valor"]))
    for k in range(1, c["nparc"] + 1):
        juros = r2(saldo * c["taxa"])
        if c["sistema"] == "SAC":
            amort = amort_sac if k < c["nparc"] else r2(saldo)
            parcela = r2(amort + juros)
        else:
            parcela = parc_price if k < c["nparc"] else r2(saldo + juros)
            amort = r2(parcela - juros)
        venc = mais_meses(c["primeira"], k - 1)
        saldo = r2(saldo - amort)
        out.append(dict(n=k, venc=venc, parcela=parcela, juros=juros, amort=amort,
                        saldo=max(saldo, 0.0), contrato=c))
    return out


RECORRENTES = [
    dict(desc="Aluguel do galpão", subcat="Aluguel", valor=7500.00, periodicidade="Mensal", dia=5,
         cc="Administrativo", banco=BB, forma="Boleto", entidade=S("pinheiros"), ativo="Sim"),
    dict(desc="Energia elétrica", subcat="Energia Elétrica", valor=2300.00, periodicidade="Mensal", dia=12,
         cc="Administrativo", banco=ITAU, forma="Débito automático", entidade=S("enel"), ativo="Sim"),
    dict(desc="Água e saneamento", subcat="Água e Saneamento", valor=440.00, periodicidade="Mensal", dia=15,
         cc="Administrativo", banco=ITAU, forma="Débito automático", entidade=S("sabesp"), ativo="Sim"),
    dict(desc="Internet, telefonia e link dedicado", subcat="Internet e Telefonia", valor=780.00,
         periodicidade="Mensal", dia=10, cc="Administrativo", banco=MASTER, forma="Cartão de crédito",
         entidade=S("vivo"), ativo="Sim"),
    dict(desc="Honorários contábeis", subcat="Contabilidade", valor=1250.00, periodicidade="Mensal", dia=10,
         cc="Financeiro", banco=ITAU, forma="PIX", entidade=S("contabil"), ativo="Sim"),
    dict(desc="ERP, NF-e e BI (assinatura)", subcat="Sistemas e Softwares", valor=850.00,
         periodicidade="Mensal", dia=8, cc="Administrativo", banco=MASTER, forma="Cartão de crédito",
         entidade=S("abcsistemas"), ativo="Sim"),
    dict(desc="Folha de pagamento — salários", subcat="Salários", valor=16000.00, periodicidade="Mensal",
         dia=5, cc="Administrativo", banco=BB, forma="Transferência", entidade=S("folha"), ativo="Sim"),
    dict(desc="Encargos sociais (FGTS/INSS)", subcat="Encargos Sociais (FGTS/INSS)", valor=5600.00,
         periodicidade="Mensal", dia=7, cc="Administrativo", banco=ITAU, forma="Transferência",
         entidade=S("rfb"), ativo="Sim"),
    dict(desc="Benefícios (VT, VA e plano de saúde)", subcat="Benefícios (VT/VA/Plano de Saúde)",
         valor=1900.00, periodicidade="Mensal", dia=5, cc="Administrativo", banco=BB,
         forma="Transferência", entidade=S("beneficios"), ativo="Sim"),
    dict(desc="Pró-labore dos sócios", subcat="Pró-labore", valor=9500.00, periodicidade="Mensal", dia=5,
         cc="Diretoria", banco=BB, forma="Transferência", entidade=S("socios"), ativo="Sim"),
    dict(desc="Marketing digital (agência)", subcat="Marketing Digital", valor=3200.00,
         periodicidade="Mensal", dia=10, cc="Marketing", banco=MASTER, forma="Cartão de crédito",
         entidade=S("pulso"), ativo="Sim"),
    dict(desc="Seguro do galpão, frota e RC", subcat="Seguros", valor=780.00, periodicidade="Trimestral",
         dia=20, cc="Administrativo", banco=BB, forma="Boleto", entidade=S("porto"), ativo="Sim"),
]

# orçamento anual por categoria (elaborado em jan/ANO)
ORCAMENTO_BASE = {
    "Vendas de Produtos":              [192000, 184000, 198000, 192000, 204000, 198000, 210000, 218000, 212000, 216000, 222000, 234000],
    "Vendas de Serviços":              [40000, 38000, 42000, 40000, 43000, 41000, 44000, 46000, 45000, 46000, 48000, 50000],
    "Mercadorias para Revenda":        [116000, 110000, 120000, 116000, 124000, 120000, 126000, 132000, 128000, 130000, 134000, 140000],
    "Matéria-prima":                   [9000, 8800, 9200, 9000, 9400, 9200, 9600, 9800, 9600, 9800, 10000, 10400],
    "Embalagens":                      [2600, 2500, 2700, 2600, 2800, 2700, 2900, 3000, 2900, 3000, 3100, 3200],
    "Fretes e Entregas sobre Vendas":  [4200, 4000, 4300, 4200, 4400, 4300, 4500, 4700, 4600, 4700, 4800, 5000],
    "Comissões sobre Vendas":          [3200, 3000, 3300, 3200, 3400, 3300, 3500, 3600, 3500, 3600, 3700, 3900],
    "Taxas de Marketplace":            [1700, 1600, 1800, 1700, 1800, 1700, 1900, 1900, 1900, 1900, 2000, 2100],
    "Taxas de Cartão e Maquininha":    [2500, 2400, 2600, 2500, 2700, 2600, 2700, 2800, 2800, 2800, 2900, 3000],
    "Outros Custos Diretos":           [900, 900, 900, 900, 950, 950, 950, 950, 950, 950, 1000, 1000],
    "Aluguel":                         [7500] * 12,
    "Energia Elétrica":                [2100, 2200, 2300, 2300, 2400, 2400, 2500, 2500, 2600, 2600, 2600, 2600],
    "Água e Saneamento":               [420] * 12,
    "Internet e Telefonia":            [760] * 12,
    "Contabilidade":                   [1250] * 12,
    "Sistemas e Softwares":            [850] * 12,
    "Material de Escritório":          [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
    "Manutenção e Conservação":        [1750, 600, 1800, 700, 1850, 700, 1850, 900, 1900, 900, 950, 1000],
    "Seguros":                         [260, 260, 780, 260, 260, 780, 260, 260, 780, 260, 260, 780],
    "Salários":                        [16000] * 12,
    "Encargos Sociais (FGTS/INSS)":    [5600] * 12,
    "Benefícios (VT/VA/Plano de Saúde)": [1900] * 12,
    "Pró-labore":                      [9500] * 12,
    "Serviços Terceirizados (PJ)":     [1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800],
    "Marketing Digital":               [3200] * 12,
    "Publicidade e Anúncios":          [1200, 1000, 1400, 1200, 1500, 1200, 1600, 1600, 1600, 1600, 1700, 1800],
    "Viagens Comerciais":              [1200, 900, 1500, 1200, 1400, 1100, 1500, 1600, 1500, 1500, 1600, 1700],
    "Brindes e Material de Divulgação": [300] * 12,
    "Outras Despesas Administrativas": [500] * 12,
    "Tarifas Bancárias":               [180] * 12,
    "Simples Nacional":                [18400, 17600, 19000, 18400, 19600, 19000, 20200, 20800, 20400, 20800, 21400, 22400],
    "Outros Impostos e Taxas":         [300] * 12,
    "Juros de Empréstimos e Financiamentos": [4600] * 12,
    "Tecnologia e Informática":        [0, 0, 12000, 0, 0, 0, 0, 6000, 0, 0, 0, 0],
    "Máquinas e Equipamentos":         [0, 0, 0, 28000, 0, 0, 0, 0, 0, 0, 0, 0],
    "Móveis e Utensílios":             [0, 0, 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0],
    "Reformas e Benfeitorias":         [0, 16000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Distribuição de Lucros aos Sócios": [12000, 0, 0, 12000, 0, 0, 12000, 0, 0, 12000, 0, 0],
}


# ------------------------------------------------------- GERAÇÃO DE LANÇAMENTOS
def venc_cartao(comp, fechamento, vencimento):
    """Data de vencimento da fatura do cartão para uma compra em `comp`."""
    mes_fech = comp.month if comp.day <= fechamento else comp.month + 1
    ano_fech = comp.year + (1 if mes_fech > 12 else 0)
    mes_fech = ((mes_fech - 1) % 12) + 1
    if vencimento > fechamento:
        m_venc, a_venc = mes_fech, ano_fech
    else:
        m_venc = mes_fech + 1
        a_venc = ano_fech + (1 if m_venc > 12 else 0)
        m_venc = ((m_venc - 1) % 12) + 1
    return dt.date(a_venc, m_venc, min(vencimento, calendar.monthrange(a_venc, m_venc)[1]))


_CARDS = {c["nome"]: c for c in CARTOES}


def pagamento_cartao(comp, nome_cartao):
    """Retorna (banco, data_prevista_fatura) para uma compra no cartão."""
    c = _CARDS[nome_cartao]
    return c["conta_pagamento"], venc_cartao(comp, c["fechamento"], c["vencimento"])


def gerar_lancamentos():
    L, seq = [], [0]

    def E(comp, venc, tipo, cat, subcat, cc, entidade, desc, valor, **kw):
        seq[0] += 1
        pg, vr = kw.get("pagto"), kw.get("vreal")
        cartao = kw.get("cartao", "")
        banco = kw.get("banco", BB)
        venc_real = kw.get("venc", venc)
        if cartao:
            banco, venc_cart = pagamento_cartao(comp, cartao)
            venc_real = kw.get("venc_manual", venc_cart)
            if pg is None and venc_real <= HOJE:
                pg = inc(venc_real, _rnd.randint(0, 2))
                if pg > HOJE:
                    pg = HOJE
                vr = valor
        L.append(dict(
            id=f"L{seq[0]:04d}", comp=comp, venc=venc_real, pagto=pg, tipo=tipo, cat=cat, subcat=subcat,
            cc=cc, entidade=entidade, desc=desc, doc=kw.get("doc", ""), banco=banco,
            forma=kw.get("forma", "PIX"), cartao=cartao, flex=kw.get("flex", False),
            nparc=kw.get("nparc", 1), tparc=kw.get("tparc", 1), vprev=r2(valor),
            vreal=None if vr is None else r2(vr), juros=r2(kw.get("juros", 0)),
            multa=r2(kw.get("multa", 0)), desconto=r2(kw.get("desconto", 0)),
            status=("Pago" if (vr is not None and kw.get("status", "Previsto") == "Previsto") else kw.get("status", "Previsto"))
            if not kw.get("status") else kw.get("status", "Previsto"),
            obs=kw.get("obs", ""),
        ))

    def liquida(venc, atraso_min=0, atraso_max=3):
        if venc > HOJE:
            return None, "Previsto"
        d = inc(venc, _rnd.randint(atraso_min, atraso_max))
        if d > HOJE:
            d = HOJE
        return d, "Pago"

    def pagar(venc, atraso_min=0, atraso_max=3):
        """(data_pagamento, status, valor_realizado) para despesas previstas."""
        pg, st = liquida(venc, atraso_min, atraso_max)
        return pg, st

    fator = {1: 1.00, 2: 0.96, 3: 1.04, 4: 1.02, 5: 1.08, 6: 1.05, 7: 1.12, 8: 1.16, 9: 1.12,
             10: 1.15, 11: 1.18, 12: 1.22}
    meses = list(range(1, 13))

    # ------------------------------------------------------------- 1) VENDAS
    perfil = {
        "CLI001": dict(prod=[(38000, 30, "Boleto", BB), (26000, 30, "Boleto", BB)],
                       serv=11000, prazo_serv=30, banco_serv=BB, forma_serv="Boleto",
                       parcela_meses=[3, 6, 9], parcelas=2),
        "CLI002": dict(prod=[(24000, 0, "PIX", NU)], serv=0, prazo_serv=0, banco_serv=NU,
                       forma_serv="PIX", parcela_meses=[], parcelas=1),
        "CLI003": dict(prod=[(18000, 15, "Boleto", ITAU), (12000, 15, "Boleto", ITAU)],
                       serv=7000, prazo_serv=15, banco_serv=ITAU, forma_serv="Boleto",
                       parcela_meses=[], parcelas=1),
        "CLI004": dict(prod=[(34000, 30, "Boleto", ITAU)], serv=0, prazo_serv=30, banco_serv=ITAU,
                       forma_serv="Boleto", parcela_meses=[], parcelas=1),
        "CLI005": dict(prod=[(24000, 21, "Boleto", ITAU), (17000, 21, "Boleto", ITAU)],
                       serv=14000, prazo_serv=21, banco_serv=ITAU, forma_serv="Boleto",
                       parcela_meses=[2, 5, 8], parcelas=3),
    }
    nao_pagos = {("CLI004", 6), ("CLI004", 7), ("CLI004", 8), ("CLI003", 8)}
    parcial = ("CLI004", 7)

    for m in meses:
        f = fator[m]
        for cod, p in perfil.items():
            razao = CLI[cod]["razao"]
            dia = 3
            for idx, (base, prazo, forma, banco) in enumerate(p["prod"]):
                dia = min(dia + 8, 27)
                valor = var(base * f, 0.04)
                comp = dia_mes(m, dia)
                venc = inc(comp, prazo)
                if venc.weekday() >= 5:
                    venc = inc(venc, 7 - venc.weekday())
                if idx == 0 and m in p["parcela_meses"]:
                    n = p["parcelas"]
                    for k in range(1, n + 1):
                        vk = inc(venc, 30 * (k - 1))
                        if vk <= HOJE and (cod, m) not in nao_pagos:
                            pg, st = liquida(vk)
                            vr = r2(valor / n)
                        else:
                            pg, st, vr = None, "Previsto", None
                        E(comp, vk, "Entrada", "Vendas", "Vendas de Produtos", "Comercial", razao,
                          f"Venda de mercadorias (parcela {k}/{n})", r2(valor / n), pagto=pg,
                          status=st, vreal=vr, doc=f"NF-e {2000 + seq[0]}", banco=banco,
                          forma="Crédito parcelado", nparc=k, tparc=n,
                          obs="Venda parcelada — cartão/boleto parcelado")
                    continue
                pg, st, vr = None, "Previsto", None
                if (cod, m) in nao_pagos:
                    if parcial == (cod, m):
                        pg, st, vr = inc(venc, 15), "Parcial", r2(valor * 0.35)
                    else:
                        pg, st, vr = None, "Previsto", None
                elif venc <= HOJE:
                    pg, st = liquida(venc)
                    vr = valor
                E(comp, venc, "Entrada", "Vendas", "Vendas de Produtos", "Comercial", razao,
                  "Venda de mercadorias para revenda", valor, pagto=pg, status=st, vreal=vr,
                  doc=f"NF-e {2000 + seq[0]}", banco=banco, forma=forma,
                  obs="Fatura em atraso — em cobrança" if (cod, m) in nao_pagos else "")
            if p["serv"]:
                comp = dia_mes(m, 22)
                venc = inc(comp, p["prazo_serv"])
                if venc.weekday() >= 5:
                    venc = inc(venc, 7 - venc.weekday())
                valor = var(p["serv"] * f, 0.05)
                pg, st, vr = None, "Previsto", None
                if venc <= HOJE:
                    pg, st = liquida(venc)
                    vr = valor
                E(comp, venc, "Entrada", "Vendas", "Vendas de Serviços", "Comercial", razao,
                  "Serviços de logística, montagem e reposição", valor, pagto=pg, status=st,
                  vreal=vr, doc=f"RPS {3000 + seq[0]}", banco=p["banco_serv"], forma=p["forma_serv"])

    # ------------------------------------------------- 2) RECEITAS FINANCEIRAS
    for m in meses:
        comp = HOJE if m == MES else dia_mes(m, 28)
        v = var(680 * fator[m], 0.15)
        E(comp, comp, "Entrada", "Receitas Financeiras", "Rendimentos de Aplicações Financeiras",
          "Financeiro", "Itaú Unibanco", f"Rendimento de aplicação financeira — {m:02d}/{ANO}", v,
          pagto=comp, status="Recebido", vreal=v, banco=ITAU, forma="Transferência", doc="REND-APL")
    for m, valor in [(4, 850.0), (7, 1240.0)]:
        comp = dia_mes(m, 18)
        E(comp, comp, "Entrada", "Receitas Financeiras", "Juros Recebidos de Clientes", "Financeiro",
          CLI["CLI003"]["razao"], "Juros e multa por atraso no pagamento do cliente", valor,
          pagto=comp, status="Recebido", vreal=valor, banco=ITAU, forma="PIX",
          obs="Cobrança de encargos de mora")

    # ------------------------------------------------------------ 3) DEVOLUÇÕES
    for m, valor, cod in [(4, 1850.0, "CLI002"), (7, 2340.0, "CLI003")]:
        comp = dia_mes(m, 14)
        E(comp, comp, "Saída", "Devoluções e Cancelamentos", "Devoluções e Cancelamentos de Vendas",
          "Comercial", CLI[cod]["razao"], "Devolução de mercadorias — avaria no transporte", valor,
          pagto=comp, status="Pago", vreal=valor, banco=BB, forma="PIX", doc=f"DEV-{m:02d}",
          flex=True)

    # -------------------------------------------- 4) COMPRAS E CUSTOS VARIÁVEIS
    for m in meses:
        f = fator[m]
        v1 = var(58000 * f, 0.06)
        v2 = var(52000 * f, 0.06)
        for (comp, val, doc) in [(dia_mes(m, 4), v1, f"NF {5000 + m * 10}"),
                                 (dia_mes(m, 16), v2, f"NF {5000 + m * 10 + 1}")]:
            venc = inc(comp, 30)
            pg, st = liquida(venc, 0, 2)
            E(comp, venc, "Saída", "Custos Variáveis", "Mercadorias para Revenda", "Logística",
              S("central"), f"Compra de mercadorias para revenda — {doc}", val, pagto=pg, status=st,
              vreal=val if pg else None, doc=doc, banco=BB, forma="Boleto", flex=True)
        comp3 = dia_mes(m, 9)
        venc3 = inc(comp3, 15)
        v3 = var(9000 * f, 0.06)
        pg, st = liquida(venc3)
        E(comp3, venc3, "Saída", "Custos Variáveis", "Matéria-prima", "Produção", S("central"),
          "Insumos e matéria-prima para beneficiamento", v3, pagto=pg, status=st,
          vreal=v3 if pg else None, doc=f"NF {5900 + m}", banco=ITAU, forma="Boleto", flex=True)
        itens = [
            ("Embalagens", "embalagens", "Compra de embalagens e etiquetas", 2500, 12, 15, "Logística", ITAU, "Boleto", 0.05, "", True),
            ("Fretes e Entregas sobre Vendas", "rapidalog", "Fretes de entrega — notas do período", 4100, 25, 15, "Logística", ITAU, "Boleto", 0.05, "", True),
            ("Comissões sobre Vendas", "comissoes", "Comissões sobre vendas do período", 3100, 28, 5, "Comercial", BB, "Transferência", 0.05, "", True),
            ("Taxas de Marketplace", "marketplace", "Taxas de intermediação do marketplace", 1650, 28, 10, "Comercial", NU, "PIX", 0.05, "", True),
            ("Taxas de Cartão e Maquininha", "cielo", "Taxas de cartão e antecipação de recebíveis", 2400, 28, 5, "Financeiro", ITAU, "Transferência", 0.05, "", True),
            ("Outros Custos Diretos", "apoio", "Serviços de apoio à operação e expedição", 900, 20, 10, "Produção", NU, "PIX", 0.05, "", True),
        ]
        for subcat, key, desc, base, dia, prazo, cc, banco, forma, volat, cartao, flex in itens:
            comp = dia_mes(m, dia)
            venc = inc(comp, prazo)
            val = var(base * f, volat)
            pg, st = liquida(venc)
            E(comp, venc, "Saída", "Custos Variáveis", subcat, cc, S(key), desc, val, pagto=pg,
              status=st, vreal=val if pg else None, doc=f"DOC {7000 + seq[0] % 900}",
              banco=banco, forma=forma, cartao=cartao, flex=flex)

    # ------------------------------------------------------- 5) DESPESAS FIXAS
    # (subcat, fornecedor, descrição, base, dia, prazo, centro de custo, banco, forma,
    #  volatilidade, categoria, cartão, flexível)
    fixas = [
        ("Aluguel", "pinheiros", "Aluguel do galpão — competência {mes}", 7500, 5, 5, "Administrativo", BB, "Boleto", 0.0, "Despesas Administrativas", "", False),
        ("Energia Elétrica", "enel", "Energia elétrica — fatura {mes}", 2250, 12, 10, "Administrativo", ITAU, "Débito automático", 0.10, "Despesas Administrativas", "", False),
        ("Água e Saneamento", "sabesp", "Água e saneamento — fatura {mes}", 435, 15, 12, "Administrativo", ITAU, "Débito automático", 0.05, "Despesas Administrativas", "", False),
        ("Internet e Telefonia", "vivo", "Internet, telefonia e link dedicado", 780, 10, 0, "Administrativo", MASTER, "Cartão de crédito", 0.0, "Despesas Administrativas", MASTER, False),
        ("Contabilidade", "contabil", "Honorários contábeis — competência {mes}", 1250, 10, 0, "Financeiro", ITAU, "PIX", 0.0, "Despesas Administrativas", "", False),
        ("Sistemas e Softwares", "abcsistemas", "Assinatura ERP, NF-e e BI", 850, 8, 0, "Administrativo", MASTER, "Cartão de crédito", 0.0, "Despesas Administrativas", MASTER, False),
        ("Salários", "folha", "Folha de pagamento — {mes}", 16000, 5, 5, "Administrativo", BB, "Transferência", 0.0, "Despesas com Pessoal", "", False),
        ("Encargos Sociais (FGTS/INSS)", "rfb", "FGTS e INSS — competência {mes}", 5600, 7, 7, "Administrativo", ITAU, "Transferência", 0.0, "Despesas com Pessoal", "", False),
        ("Benefícios (VT/VA/Plano de Saúde)", "beneficios", "Vale-transporte, alimentação e saúde", 1900, 5, 5, "Administrativo", BB, "Transferência", 0.0, "Despesas com Pessoal", "", False),
        ("Pró-labore", "socios", "Pró-labore dos sócios — {mes}", 9500, 5, 5, "Diretoria", BB, "Transferência", 0.0, "Despesas com Pessoal", "", False),
        ("Marketing Digital", "pulso", "Gestão de tráfego pago e produção de conteúdo", 3800, 10, 0, "Marketing", MASTER, "Cartão de crédito", 0.12, "Despesas Comerciais", MASTER, False),
        ("Publicidade e Anúncios", "google", "Anúncios e campanhas digitais", 1300, 18, 0, "Marketing", MASTER, "Cartão de crédito", 0.15, "Despesas Comerciais", MASTER, False),
        ("Manutenção e Conservação", "manutencao", "Manutenção predial, empilhadeira e frota", 700, 22, 10, "Administrativo", NU, "PIX", 0.10, "Despesas Administrativas", "", True),
        ("Material de Escritório", "papelaria", "Material de escritório e itens de consumo", 420, 16, 0, "Administrativo", VISA, "Cartão de crédito", 0.20, "Despesas Administrativas", VISA, False),
        ("Serviços Terceirizados (PJ)", "apoio", "Equipe terceirizada de separação e expedição", 1800, 15, 10, "Produção", NU, "PIX", 0.0, "Despesas com Pessoal", "", True),
        ("Viagens Comerciais", "pulso", "Viagens comerciais e visitas a clientes", 1400, 24, 0, "Comercial", VISA, "Cartão de crédito", 0.25, "Despesas Comerciais", VISA, False),
        ("Outras Despesas Administrativas", "manutencao", "Despesas administrativas diversas", 520, 26, 0, "Administrativo", NU, "PIX", 0.15, "Despesas Administrativas", "", True),
        ("Tarifas Bancárias", "contabil", "Tarifas e pacote de serviços bancários", 190, 28, 0, "Financeiro", ITAU, "Transferência", 0.0, "Despesas Financeiras", "", False),
    ]
    for m in meses:
        for (subcat, key, desc, base, dia, prazo, cc, banco, forma, volat, cat, cartao, flex) in fixas:
            if subcat == "Manutenção e Conservação" and m % 2 == 1:
                continue
            if subcat == "Material de Escritório" and m % 3 != 0:
                continue
            if subcat == "Serviços Terceirizados (PJ)" and m < 3:
                continue
            val = var(base * fator[m], volat) if volat else r2(base)
            if cartao:
                # compra no cartão: competência = data da compra; caixa = vencimento da fatura
                comp = dia_mes(m, dia)
                E(comp, comp, "Saída", cat, subcat, cc, S(key), desc.format(mes=f"{m:02d}/{ANO}"), val,
                  doc=f"DOC {8000 + seq[0] % 900}", banco=banco, forma=forma, cartao=cartao,
                  obs=f"Compra no cartão — fatura com vencimento em {venc_cartao(comp, _CARDS[cartao]['fechamento'], _CARDS[cartao]['vencimento']).strftime('%d/%m/%Y')}")
            else:
                comp = dia_mes(m, dia)
                venc = inc(comp, prazo)
                pg, st = liquida(venc)
                E(comp, venc, "Saída", cat, subcat, cc, S(key), desc.format(mes=f"{m:02d}/{ANO}"), val,
                  pagto=pg, status=st, vreal=val if pg else None, doc=f"DOC {8000 + seq[0] % 900}",
                  banco=banco, forma=forma, flex=flex)

    # combustível e manutenção da frota no cartão Elo (meses ímpares)
    for m in [x for x in meses if x % 2 == 1]:
        comp = dia_mes(m, 18)
        val = var(980.0, 0.12)
        E(comp, comp, "Saída", "Despesas Administrativas", "Manutenção e Conservação", "Logística",
          "Posto e oficina credenciados", "Combustível e manutenção da frota", val,
          doc=f"FROTA {m:02d}", banco=ELO, forma="Cartão de crédito", cartao=ELO,
          obs="Abastecimento e manutenção preventiva da frota")

    # contas vencidas em aberto (demonstram o controle de atrasados)
    E(dia_mes(MES, 1), inc(dia_mes(MES, 1), 12), "Saída", "Custos Variáveis", "Embalagens",
      "Logística", S("embalagens"), "Compra de embalagens — NF 6210 (VENCIDA, em aberto)", 3180.00,
      status="Previsto", doc="NF 6210", banco=ITAU, forma="Boleto", flex=True,
      obs="Boleto vencido aguardando pagamento — priorizar")
    E(dia_mes(MES, 2), inc(dia_mes(MES, 2), 8), "Saída", "Despesas Administrativas", "Energia Elétrica",
      "Administrativo", S("enel"), "Energia elétrica — fatura vencida em aberto", 2488.75,
      status="Previsto", doc="FAT 884512", banco=ITAU, forma="Débito automático",
      obs="Fatura em atraso confirmada com a concessionária")

    # ------------------------------------------------------------- 6) TRIBUTOS
    for m in meses:
        base = sum(l["vprev"] for l in L
                   if l["subcat"] in ("Vendas de Produtos", "Vendas de Serviços") and l["comp"].month == m)
        val = r2(base * 0.085)
        comp = dia_mes(m, 20)
        venc = mais_meses(comp, 1)
        pg, st = liquida(venc, 0, 1)
        E(comp, venc, "Saída", "Tributos", "Simples Nacional", "Financeiro", S("rfb"),
          f"Simples Nacional — competência {m:02d}/{ANO}", val, pagto=pg, status=st,
          vreal=val if pg else None, doc=f"DAS {m:02d}/{ANO}", banco=ITAU, forma="Transferência",
          flex=True, obs="Guia DAS recolhida por débito automático")
    for m in [3, 6, 9]:
        comp = dia_mes(m, 25)
        venc = inc(comp, 10)
        val = var(320, 0.2)
        pg, st = liquida(venc)
        E(comp, venc, "Saída", "Tributos", "Outros Impostos e Taxas", "Financeiro", S("prefeitura"),
          f"Taxas municipais e alvará — {m:02d}/{ANO}", val, pagto=pg, status=st,
          vreal=val if pg else None, banco=ITAU, forma="Transferência", flex=True)

    # ------------------------------------------------ 7) CRÉDITO E FINANCIAMENTOS
    for c in CONTRATOS:
        cc = "Diretoria" if "Veículo" in c["modalidade"] else "Financeiro"
        banco = BB if ("Banco do Brasil" in c["instituicao"] or "BNDES" in c["instituicao"]) else ITAU
        E(c["data"], c["data"], "Entrada", "Empréstimos e Financiamentos",
          "Empréstimos e Financiamentos Recebidos", cc, c["instituicao"],
          f"Liberação do {c['modalidade']} — contrato {c['contrato']}", c["valor"], pagto=c["data"],
          status="Recebido", vreal=c["valor"], doc=c["contrato"], banco=banco,
          forma="Transferência", obs="Crédito contratado para capital de giro e investimentos")
        for p in parcelas_contrato(c):
            pg, st = (p["venc"], "Pago") if p["venc"] <= HOJE else (None, "Previsto")
            E(p["venc"], p["venc"], "Saída", "Empréstimos e Financiamentos",
              "Pagamento de Principal de Empréstimos", cc, c["instituicao"],
              f"{c['modalidade']} — parcela {p['n']}/{c['nparc']} (principal)", p["amort"],
              pagto=pg, status=st, vreal=p["amort"] if pg else None, doc=f"{c['contrato']}-P{p['n']:02d}",
              banco=banco, forma="Débito automático", nparc=p["n"], tparc=c["nparc"],
              obs="Amortização do principal")
            E(p["venc"], p["venc"], "Saída", "Despesas Financeiras",
              "Juros de Empréstimos e Financiamentos", cc, c["instituicao"],
              f"{c['modalidade']} — parcela {p['n']}/{c['nparc']} (juros)", p["juros"],
              pagto=pg, status=st, vreal=p["juros"] if pg else None, doc=f"{c['contrato']}-P{p['n']:02d}",
              banco=banco, forma="Débito automático", nparc=p["n"], tparc=c["nparc"],
              obs="Encargos financeiros do período")
    comp = dia_mes(5, 12)
    for k in range(1, 7):
        venc = mais_meses(comp, k - 1)
        pg, st = liquida(venc, 0, 1)
        E(comp, venc, "Saída", "Empréstimos e Financiamentos", "Parcelamento de Dívidas e Tributos",
          "Financeiro", S("rfb"), f"Parcelamento de tributos — parcela {k}/6", 1480.00, pagto=pg,
          status=st, vreal=1480.00 if pg else None, doc=f"PAR-{k:02d}", banco=ITAU,
          forma="Transferência", nparc=k, tparc=6, flex=True,
          obs="Parcelamento de débitos em atraso")

    # ---------------------------------------------------------- 8) INVESTIMENTOS
    invest = [
        (2, 18, "Reformas e Benfeitorias", "gama", "Reforma do galpão — área de expedição", 15800.0, "Produção", 30),
        (3, 6, "Tecnologia e Informática", "abcsistemas", "Notebooks para a equipe comercial (3 un.)", 12400.0, "Diretoria", 30),
        (4, 10, "Máquinas e Equipamentos", "alfa", "Seladora automática e esteira de separação", 27800.0, "Produção", 28),
        (6, 8, "Móveis e Utensílios", "beta", "Mobiliário do escritório e vestiário", 4600.0, "Administrativo", 30),
        (8, 5, "Tecnologia e Informática", "abcsistemas", "Módulo de BI e leitores de código de barras", 6800.0, "Administrativo", 30),
        (11, 12, "Máquinas e Equipamentos", "alfa", "Empilhadeira elétrica (previsto — CAPEX 4º tri)", 46000.0, "Logística", 30),
    ]
    for m, dia, subcat, key, desc, val, cc, prazo in invest:
        comp = dia_mes(m, dia)
        venc = inc(comp, prazo)
        pg, st = liquida(venc, 0, 2)
        E(comp, venc, "Saída", "Investimentos", subcat, cc, S(key), desc, val, pagto=pg, status=st,
          vreal=val if pg else None, doc=f"INV-{m:02d}{dia:02d}", banco=BB, forma="Transferência",
          flex=True, obs="Investimento (CAPEX) — não afeta o resultado do período")

    # ------------------------------------------------- 9) DISTRIBUIÇÃO DE LUCROS
    for m in [3, 6, MES, 12]:
        comp = HOJE if m == MES else dia_mes(m, 28)
        pg, st = liquida(comp, 0, 0)
        E(comp, comp, "Saída", "Patrimônio Líquido", "Distribuição de Lucros aos Sócios", "Diretoria",
          S("socios"), f"Distribuição de lucros do trimestre — {m:02d}/{ANO}", 12000.0, pagto=pg,
          status=st if pg else "Previsto", vreal=12000.0 if pg else None, doc=f"DIST-{m:02d}",
          banco=BB, forma="Transferência", flex=True, obs="Distribuição aprovada em ata")

    equilibrar_contas(L)
    L.sort(key=lambda x: (x["comp"], x["id"]))
    for i, reg in enumerate(L, start=1):
        reg["id"] = f"L{i:04d}"
    return L


def equilibrar_contas(L):
    """Distribui os pagamentos flexíveis entre as contas correntes, mantendo saldos
    positivos (simula o que um gestor faz na prática: paga pela conta com caixa)."""
    contas = [c["nome"] for c in CONTAS if c["tipo"] == "Conta Corrente"]
    saldo = {c["nome"]: c["saldo_inicial"] for c in CONTAS}
    L.sort(key=lambda x: (x["pagto"] or x["venc"], x["id"]))
    for l in L:
        if l["flex"] and l["tipo"] == "Saída":
            l["banco"] = max(contas, key=lambda c: saldo[c])
        if l["pagto"]:
            delta = l["vreal"] + l["juros"] + l["multa"] - l["desconto"]
            saldo[l["banco"]] = saldo.get(l["banco"], 0.0) + (delta if l["tipo"] == "Entrada" else -delta)


LANCAMENTOS = gerar_lancamentos()


# ------------------------------------------------------------- CONCILIAÇÃO
def gerar_conciliacao():
    linhas = []
    base = [l for l in LANCAMENTOS if l["pagto"] and l["banco"] in (BB, ITAU, NU)
            and l["pagto"] <= HOJE]
    amostra = base[-40:] if len(base) > 40 else base
    escolhidos = amostra[::2][:22]
    for i, l in enumerate(escolhidos):
        credito = l["tipo"] == "Entrada"
        linhas.append(dict(
            data=l["pagto"], historico=l["desc"][:70], doc=l["doc"] or f"DOC{i:03d}",
            valor=r2(l["vreal"] if credito else -l["vreal"]),
            tipo="Crédito" if credito else "Débito", conta=l["banco"], conciliado="Conciliado",
            categoria=l["subcat"], cc=l["cc"], obs="Conferido com o comprovante",
        ))
    if len(base) >= 6:
        for l, obs, fator_v, tipo_dif in [
                (base[-6], "Diferença de tarifa bancária não lançada", 1.0, -89.90),
                (base[-4], "Valor do extrato 2% maior que o registrado na planilha", 1.02, 0.0),
                (base[-2], "Lançamento não encontrado — verificar comprovante", 1.0, 0.0)]:
            credito = l["tipo"] == "Entrada"
            v = r2(l["vreal"] * fator_v + tipo_dif)
            linhas.append(dict(data=l["pagto"], historico=l["desc"][:70],
                               doc=f"EXTRATO-{abs(tipo_dif) or len(linhas):03.0f}",
                               valor=r2(v if credito else -v),
                               tipo="Crédito" if credito else "Débito", conta=l["banco"],
                               conciliado="Divergente" if tipo_dif != 0 or fator_v != 1 else "Pendente",
                               categoria=l["subcat"], cc=l["cc"], obs=obs))
    linhas.append(dict(data=inc(HOJE, -4), historico="DEPOSITO EM DINHEIRO NAO IDENTIFICADO",
                       doc="DEP-4451", valor=2950.00, tipo="Crédito", conta=NU,
                       conciliado="Pendente", categoria="", cc="",
                       obs="Identificar a origem do depósito antes de classificar"))
    linhas.append(dict(data=inc(HOJE, -2), historico="TARIFA PACOTE SERVICOS PJ",
                       doc="TAR-2291", valor=-79.90, tipo="Débito", conta=ITAU,
                       conciliado="Pendente", categoria="Tarifas Bancárias", cc="Financeiro",
                       obs="Classificar como tarifa bancária e lançar na planilha"))
    linhas.sort(key=lambda x: x["data"])
    return linhas


CONCILIACAO = gerar_conciliacao()
