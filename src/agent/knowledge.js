// ============================================================
// AGENTE IA ERP - Base de conhecimento
// Conceitos, fórmulas, metas de referência e playbooks por domínio.
// É o "cérebro técnico" do agente: usado nas respostas de
// orientação ("como faço X?"), no contexto enviado ao LLM e nos
// planos de ação gerados pelo motor local.
// ============================================================

const KNOWLEDGE = {
  empresarial: {
    concepts: [
      {
        term: 'DRE gerencial',
        formula: 'Receita Bruta (-) Impostos (=) Receita Líquida (-) CMV (=) Lucro Bruto (-) Despesas Fixas e Variáveis (=) Lucro Operacional',
        explanation: 'Demonstra como a receita se transforma em lucro em camadas. Permite ver se o problema está no preço, no custo ou na despesa.',
        target: 'Revisar mensalmente até o dia 5 do mês seguinte.'
      },
      {
        term: 'Ponto de equilíbrio (break-even)',
        formula: 'PE = Custos e Despesas Fixas ÷ Margem de Contribuição (%)',
        explanation: 'Faturamento mínimo para a empresa não ter prejuízo. Abaixo dele, cada dia de operação queima caixa.',
        target: 'Receita real deve ficar, no mínimo, 20% acima do ponto de equilíbrio.'
      },
      {
        term: 'Margem de contribuição',
        formula: 'MC = (Preço de Venda - Custo Variável) ÷ Preço de Venda × 100',
        explanation: 'Quanto cada venda contribui para pagar as despesas fixas e gerar lucro.',
        target: 'Comércio: 35% a 50% | Serviços: 60% a 80% | Indústria: 40% a 60%.'
      },
      {
        term: 'Índice de saúde do negócio',
        formula: 'Média ponderada de: crescimento, margem, liquidez, inadimplência, estoque e concentração',
        explanation: 'Nota única de 0 a 100 que resume se a empresa está saudável. Usado pelo agente para priorizar áreas.',
        target: 'Acima de 80 = excelente | 60 a 79 = bom | 40 a 59 = atenção | abaixo de 40 = crítico.'
      },
      {
        term: 'Concentração de receita',
        formula: '% da receita vinda dos 5 maiores clientes',
        explanation: 'Dependência excessiva de poucos clientes é risco estratégico: perder um pode quebrar o mês.',
        target: 'Ideal abaixo de 40%. Acima de 60% exige plano de diversificação.'
      },
      {
        term: 'Ciclo PDCA aplicado à gestão',
        formula: 'Plan → Do → Check → Act',
        explanation: 'Rotina de melhoria: definir meta, executar, medir o resultado e padronizar/corrigir. Base da gestão por indicadores.',
        target: 'Um ciclo PDCA por indicador crítico a cada mês.'
      }
    ],
    playbooks: [
      {
        title: 'Fechamento gerencial mensal em 5 passos',
        when: 'Usar nos primeiros 5 dias úteis do mês',
        steps: [
          'Feche o mês: confira se todas as vendas, compras e despesas foram lançadas.',
          'Gere o DRE e compare com o mês anterior e com a meta.',
          'Calcule ponto de equilíbrio e margem de contribuição; identifique a camada que piorou.',
          'Liste os 3 alertas críticos do agente e defina responsável + prazo para cada um.',
          'Registre as decisões na ata de resultados e revise na semana seguinte.'
        ],
        kpi: 'Lucro operacional e % de metas atingidas'
      },
      {
        title: 'Definir metas que funcionam',
        when: 'Início de trimestre ou quando não há meta definida',
        steps: [
          'Comece pelo lucro desejado e faça a engenharia reversa: lucro → margem → receita necessária.',
          'Quebre a meta em receita mensal, ticket médio e número de vendas por vendedor/canal.',
          'Defina um indicador por área (comercial, financeiro, estoque, produção) e não mais que 5 no total.',
          'Publique a meta onde todos veem e revise semanalmente o realizado x previsto.'
        ],
        kpi: '% da meta atingida no mês'
      },
      {
        title: 'Mapa de riscos do negócio',
        when: 'Quando há concentração, inadimplência alta ou dependência de fornecedor único',
        steps: [
          'Liste os riscos: cliente concentrado, fornecedor único, produto sem substituto, caixa curto, inadimplência.',
          'Classifique por probabilidade x impacto (matriz 3x3).',
          'Para cada risco alto, defina uma ação preventiva e uma ação de contingência.',
          'Reavalie o mapa a cada trimestre.'
        ],
        kpi: 'Nº de riscos altos com plano de ação'
      }
    ],
    checkup: [
      'A receita está acima do ponto de equilíbrio?',
      'A margem líquida é positiva e estável nos últimos 3 meses?',
      'Existe reserva de caixa para pelo menos 2 meses de despesas fixas?',
      'Nenhum cliente representa mais de 30% da receita?',
      'As metas do mês estão registradas e acompanhadas semanalmente?'
    ]
  },

  producao: {
    concepts: [
      {
        term: 'Teoria das Restrições (TOC)',
        formula: 'Identificar a restrição → Explorar → Subordinar → Elevar → Repetir',
        explanation: 'O resultado de qualquer operação é limitado pelo gargalo. Melhorar etapas que não são gargalo não aumenta a entrega.',
        target: 'Sempre atuar primeiro no item com maior demanda e menor cobertura.'
      },
      {
        term: 'Capacidade de atendimento',
        formula: 'Capacidade (%) = Itens com estoque suficiente para a demanda média ÷ Itens com demanda × 100',
        explanation: 'Mede se a operação consegue responder à demanda atual sem ruptura.',
        target: 'Acima de 90% para itens classe A.'
      },
      {
        term: 'Ciclo operacional',
        formula: 'Ciclo Operacional = Dias de Estoque + DSO (prazo médio de recebimento)',
        explanation: 'Tempo entre gastar dinheiro (comprar/produzir) e receber do cliente. Quanto menor, menos capital de giro é necessário.',
        target: 'Reduzir continuamente; comparar com o prazo médio de pagamento a fornecedores (DPO).'
      },
      {
        term: 'Ciclo financeiro (ou de caixa)',
        formula: 'Ciclo Financeiro = DSO + Dias de Estoque - DPO',
        explanation: 'Dias em que a empresa financia a operação com recursos próprios. Negativo é o cenário ideal (recebe antes de pagar).',
        target: 'Menor que 30 dias; negativo em modelos de venda antecipada.'
      },
      {
        term: 'OEE (Eficiência Global de Equipamento)',
        formula: 'OEE = Disponibilidade × Performance × Qualidade',
        explanation: 'Indicador padrão da indústria para medir perda de capacidade. Disponibilidade = tempo produzido ÷ tempo planejado; Performance = produção real ÷ produção ideal; Qualidade = peças boas ÷ peças produzidas.',
        target: 'Classe mundial: acima de 85%. Bom: 60% a 85%.'
      },
      {
        term: 'Lead time',
        formula: 'Lead Time = Data de entrega - Data do pedido',
        explanation: 'Tempo total entre a necessidade e a disponibilidade. Define o estoque mínimo: quanto maior o lead time, maior o estoque de segurança.',
        target: 'Medir por fornecedor e usar no cálculo de reposição.'
      },
      {
        term: 'Estoque de segurança',
        formula: 'ES = Demanda média diária × Lead time + Margem de variação da demanda',
        explanation: 'Colchão contra atraso de fornecedor e pico de demanda. Sem ele, qualquer oscilação vira ruptura.',
        target: 'Recalcular mensalmente com a demanda dos últimos 90 dias.'
      }
    ],
    playbooks: [
      {
        title: 'Encontrar e atacar o gargalo em 1 semana',
        when: 'Há ruptura recorrente, atraso de entrega ou pedidos parados',
        steps: [
          'Liste os produtos com maior demanda (unidades vendidas em 90 dias) e menor cobertura em dias.',
          'Verifique o lead time real do fornecedor desses itens nas últimas compras.',
          'Aumente o estoque mínimo somente dos itens gargalo (não de tudo).',
          'Negocie prazo ou segundo fornecedor para os itens críticos.',
          'Meça o resultado após 30 dias: nº de rupturas e pedidos atrasados.'
        ],
        kpi: 'Rupturas/mês e cobertura dos itens A'
      },
      {
        title: 'Padronizar um processo (BPMN + POP)',
        when: 'Erros repetidos, retrabalho ou dependência de uma pessoa específica',
        steps: [
          'Desenhe o processo atual do início ao fim com quem executa (fluxo simples: etapas, responsáveis, entradas, saídas).',
          'Marque as etapas sem valor: espera, retrabalho, dupla digitação, aprovação desnecessária.',
          'Escreva o POP (Procedimento Operacional Padrão) em uma página, com critérios de aceite.',
          'Treine, acompanhe por 2 semanas e meça tempo de ciclo e taxa de erro antes/depois.'
        ],
        kpi: 'Tempo de ciclo e % de retrabalho'
      },
      {
        title: 'Rotina de compras eficiente',
        when: 'Compras reativas, custo subindo ou excesso de itens parados',
        steps: [
          'Separe os itens em A (comprar com planejamento semanal), B (quinzenal) e C (mensal/lote econômico).',
          'Cote no mínimo 3 fornecedores para itens A e registre o histórico de preço.',
          'Compare o custo da última compra com o custo cadastrado no produto; atualize o cadastro.',
          'Programe as compras pelo ponto de pedido: (demanda diária × lead time) + estoque de segurança.'
        ],
        kpi: 'Variação de custo de compra e % de itens com 3 cotações'
      }
    ],
    checkup: [
      'Os processos críticos estão desenhados e documentados (POP)?',
      'O gargalo atual está identificado e tem plano de ação?',
      'O lead time de cada fornecedor relevante é conhecido e medido?',
      'O estoque mínimo foi calculado com base na demanda real?',
      'Existe um indicador de processo revisado semanalmente?'
    ]
  },

  comercial: {
    concepts: [
      {
        term: 'Curva ABC de clientes',
        formula: 'A = 80% da receita | B = 15% | C = 5% (acumulados)',
        explanation: 'Concentra esforço comercial onde está o dinheiro: clientes A recebem atendimento dedicado, C recebem processo automatizado.',
        target: 'Revisar trimestralmente; clientes A nunca podem ficar sem contato por mais de 30 dias.'
      },
      {
        term: 'Ticket médio',
        formula: 'Ticket Médio = Receita do período ÷ Número de vendas',
        explanation: 'Vender mais para o mesmo cliente custa muito menos que conquistar um novo. Aumentar ticket é o caminho mais rápido para crescer receita.',
        target: 'Crescer 5% a 10% ao trimestre com cross-sell e kits.'
      },
      {
        term: 'Taxa de recompra (retenção comercial)',
        formula: 'Recompra (%) = Clientes com 2 ou mais compras ÷ Clientes que já compraram × 100',
        explanation: 'Mede a fidelidade da carteira. Baixa recompra indica problema de produto, atendimento ou falta de relacionamento.',
        target: 'Acima de 30% em distribuição; acima de 50% em consumo recorrente.'
      },
      {
        term: 'Cliente inativo',
        formula: 'Cliente sem compra nos últimos 90 dias (ajuste ao seu ciclo de compra natural)',
        explanation: 'Reativar um inativo custa 5 a 7 vezes menos do que conquistar um cliente novo.',
        target: 'Campanha de reativação mensal com oferta específica.'
      },
      {
        term: 'Share of wallet',
        formula: 'Sua receita no cliente ÷ Potencial de compra do cliente',
        explanation: 'Quanto do orçamento do cliente você já captura. Baixo share = oportunidade de vender mais linhas do portfólio.',
        target: 'Identificar clientes A que compram apenas 1 linha de produto.'
      },
      {
        term: 'Desconto médio e margem de negociação',
        formula: 'Desconto médio (%) = Soma dos descontos ÷ (Receita + Descontos) × 100',
        explanation: 'Desconto mal controlado destrói margem: 5% de desconto exige ~15% a 25% mais volume para manter o lucro.',
        target: 'Definir alçada de desconto por vendedor (ex.: até 5% sem aprovação).'
      }
    ],
    playbooks: [
      {
        title: 'Campanha de reativação de clientes inativos',
        when: 'Existem clientes sem compra há mais de 90 dias',
        steps: [
          'Liste os inativos ordenados por receita histórica (maior primeiro).',
          'Separe por motivo provável: preço, atendimento, produto em falta, sazonalidade.',
          'Crie uma oferta de retorno específica para os top 10 (condição especial ou produto que ele costuma comprar).',
          'Ligue primeiro, envie mensagem depois; registre o resultado no cadastro do cliente.',
          'Meça em 30 dias: quantos voltaram e qual a receita recuperada.'
        ],
        kpi: 'Nº de clientes reativados e receita recuperada'
      },
      {
        title: 'Aumentar o ticket médio',
        when: 'Ticket médio estagnado ou em queda',
        steps: [
          'Identifique os produtos mais vendidos e crie kits com itens complementares de maior margem.',
          'Defina um valor mínimo para frete grátis ou condição especial (âncora de ticket).',
          'Treine a oferta de 1 item adicional em toda venda ("quem leva X costuma levar Y").',
          'Acompanhe o ticket médio por vendedor/canal semanalmente.'
        ],
        kpi: 'Ticket médio e itens por venda'
      },
      {
        title: 'Funil comercial previsível',
        when: 'A receita oscila muito de mês para mês',
        steps: [
          'Defina as etapas: prospecção → qualificação → proposta → negociação → fechamento.',
          'Estabeleça a meta reversa: para vender R$ X com ticket médio Y, são necessárias Z vendas e N propostas.',
          'Registre todas as oportunidades e revise o funil semanalmente.',
          'Meça conversão entre etapas e atue na etapa com maior perda.'
        ],
        kpi: 'Taxa de conversão por etapa e receita prevista'
      }
    ],
    checkup: [
      'Existe meta de vendas mensal por vendedor/canal?',
      'Os clientes A são conhecidos nominalmente e têm plano de relacionamento?',
      'Há uma lista de inativos trabalhada nos últimos 30 dias?',
      'O desconto concedido está dentro da alçada definida?',
      'O ticket médio e os itens por venda são acompanhados semanalmente?'
    ]
  },

  marketing: {
    concepts: [
      {
        term: 'CAC (Custo de Aquisição de Cliente)',
        formula: 'CAC = Investimento em marketing e vendas do período ÷ Novos clientes no período',
        explanation: 'Quanto custa trazer cada cliente novo. Sem medir CAC, toda decisão de mídia é achismo.',
        target: 'CAC deve ser no máximo 1/3 do LTV.'
      },
      {
        term: 'LTV (Lifetime Value)',
        formula: 'LTV = Ticket médio × Compras por ano × Margem × Anos de relacionamento',
        explanation: 'Quanto lucro um cliente gera durante todo o relacionamento com a empresa.',
        target: 'LTV/CAC acima de 3 é saudável; abaixo de 1, o marketing está destruindo valor.'
      },
      {
        term: 'Sazonalidade',
        formula: 'Coeficiente de variação = Desvio padrão da receita mensal ÷ Média mensal × 100',
        explanation: 'Mede o quanto a receita oscila entre meses. Alta sazonalidade exige planejamento de caixa e estoque para o pico.',
        target: 'CV abaixo de 20% indica receita estável; acima de 35% exige plano sazonal.'
      },
      {
        term: 'Matriz BCG do portfólio',
        formula: 'Participação (receita do item ÷ receita total) × Movimento (demanda recente)',
        explanation: 'Estrela: alta participação e alto giro (investir). Vaca: alta participação e giro menor (manter e ordenhar). Interrogação: baixo share e alto giro (testar). Abacaxi: baixo share e baixo giro (descontinuar ou liquidar).',
        target: 'Ter ao menos 20% do portfólio em produtos estrela.'
      },
      {
        term: 'Posicionamento de preço',
        formula: 'Margem (%) = (Preço - Custo) ÷ Preço × 100',
        explanation: 'Define como a marca é percebida. Margens muito baixas em relação ao mercado indicam preço errado ou custo descontrolado.',
        target: 'Consistência de margem entre itens da mesma linha (desvio < 10 p.p.).'
      },
      {
        term: 'Funil de demanda (AIDA)',
        formula: 'Atenção → Interesse → Desejo → Ação',
        explanation: 'Estrutura de campanha: conteúdo de topo gera atenção, oferta gera desejo, chamada clara gera ação.',
        target: 'Toda campanha com um único objetivo e uma única chamada.'
      }
    ],
    playbooks: [
      {
        title: 'Medir o retorno do marketing com os dados do ERP',
        when: 'Não se sabe se o investimento em marketing está pagando',
        steps: [
          'Lance todo gasto de marketing como despesa na categoria "Marketing" (canal na descrição).',
          'Compare novos clientes do mês com o investimento do mês → CAC.',
          'Calcule o LTV da carteira e a relação LTV/CAC.',
          'Corte ou reduza canais com LTV/CAC abaixo de 1 e escale os acima de 3.'
        ],
        kpi: 'CAC, LTV e LTV/CAC'
      },
      {
        title: 'Calendário sazonal de vendas',
        when: 'A receita oscila muito entre os meses',
        steps: [
          'Identifique o mês de pico e o mês mais fraco na série de receita.',
          'Antecipe estoque e capital de giro 60 dias antes do pico.',
          'Crie campanha de estímulo nos meses fracos (oferta de mix, condição de pagamento).',
          'Registre o previsto x realizado de cada campanha para melhorar a previsão do ano seguinte.'
        ],
        kpi: 'Receita do mês x média histórica do mesmo mês'
      },
      {
        title: 'Limpeza e relançamento de portfólio',
        when: 'Há muitos produtos "abacaxi" parados no estoque',
        steps: [
          'Liste produtos sem venda há mais de 90 dias com estoque disponível.',
          'Classifique: preço errado, produto fora de linha ou falta de divulgação.',
          'Aplique liquidação dirigida (kit, cashback, frete grátis) para os sem perspectiva.',
          'Realoque o capital recuperado para produtos estrela.'
        ],
        kpi: 'Capital parado liberado (R$) e giro de estoque'
      }
    ],
    checkup: [
      'Todo gasto de marketing é lançado no ERP com categoria e canal?',
      'CAC e LTV são calculados mensalmente?',
      'Existe calendário de campanhas para os próximos 90 dias?',
      'O portfólio está classificado (BCG) e os abacaxis têm plano de saída?',
      'As campanhas têm meta de novos clientes definida?'
    ]
  },

  financeiro: {
    concepts: [
      {
        term: 'Fluxo de caixa',
        formula: 'Saldo final = Saldo inicial + Entradas - Saídas',
        explanation: 'Regime de caixa é o que paga as contas. Lucro no papel não garante sobrevivência se o caixa não acompanhar.',
        target: 'Projeção de 30 a 90 dias sempre atualizada.'
      },
      {
        term: 'Inadimplência',
        formula: 'Inadimplência (%) = Títulos vencidos não recebidos ÷ Total a receber × 100',
        explanation: 'Dinheiro que já foi reconhecido como receita mas não entrou. Alta inadimplência anula a margem.',
        target: 'Abaixo de 5%. Acima de 10% exige régua de cobrança imediata.'
      },
      {
        term: 'DSO (Prazo Médio de Recebimento)',
        formula: 'DSO = (Contas a receber ÷ Receita do período) × Dias do período',
        explanation: 'Quantos dias a empresa leva para receber depois de vender.',
        target: 'Menor que o DPO; reduzir com antecipação de recebíveis ou desconto à vista.'
      },
      {
        term: 'DPO (Prazo Médio de Pagamento)',
        formula: 'DPO = (Contas a pagar ÷ Compras do período) × Dias do período',
        explanation: 'Quantos dias a empresa leva para pagar fornecedores. Prazo maior financia a operação.',
        target: 'Negociar prazos maiores sem perder desconto relevante.'
      },
      {
        term: 'Capital de giro',
        formula: 'Capital de Giro = Contas a receber + Estoque - Contas a pagar',
        explanation: 'Recursos presos na operação. Quanto maior, mais caixa a empresa precisa para crescer.',
        target: 'Reduzir girando estoque e encurtando o recebimento.'
      },
      {
        term: 'Necessidade de Capital de Giro (NKG) e reserva de segurança',
        formula: 'Reserva mínima = 2 a 3 meses de despesas fixas',
        explanation: 'Colchão de caixa para atravessar meses fracos sem recorrer a empréstimo caro.',
        target: 'Construir gradualmente: 5% a 10% do lucro mensal para a reserva.'
      },
      {
        term: 'Margem líquida',
        formula: 'Margem líquida (%) = Lucro líquido ÷ Receita × 100',
        explanation: 'Quanto sobra de cada real vendido depois de todos os custos e despesas.',
        target: 'Comércio varejista: 8% a 15% | Serviços: 15% a 25% | Distribuição: 5% a 10%.'
      }
    ],
    playbooks: [
      {
        title: 'Régua de cobrança que recupera caixa',
        when: 'Há títulos vencidos ou inadimplência acima de 5%',
        steps: [
          'D-3: lembrete amigável ("seu boleto vence em 3 dias").',
          'D+1: contato direto com nova forma de pagamento (PIX, link de pagamento).',
          'D+15: negociação formal com proposta de parcelamento e multa.',
          'D+30: suspensão de novas vendas até a regularização.',
          'D+60: avaliação de protesto/cobrança terceirizada e provisão de perda.'
        ],
        kpi: 'Inadimplência (%) e prazo médio de recuperação'
      },
      {
        title: 'Corte inteligente de despesas',
        when: 'Despesas crescem mais rápido que a receita',
        steps: [
          'Liste as despesas por categoria do mês e compare com o mês anterior.',
          'Ataque primeiro as 3 categorias de maior valor (regra 80/20).',
          'Renegocie contratos recorrentes (aluguel, internet, software, tarifas bancárias).',
          'Nunca corte o que gera receita diretamente sem medir o impacto (marketing, comissão).'
        ],
        kpi: 'Despesa/receita (%) e economia acumulada'
      },
      {
        title: 'Projeção de caixa para 90 dias',
        when: 'Saldo de caixa cobre menos de 30 dias de despesas',
        steps: [
          'Some os recebíveis previstos por semana (contas a receber + vendas à vista esperadas).',
          'Some as obrigações por semana (contas a pagar, folha, impostos, despesas fixas).',
          'Marque as semanas com saldo negativo e defina a ação: antecipar recebível, postergar pagamento ou cortar despesa.',
          'Atualize a projeção toda segunda-feira.'
        ],
        kpi: 'Saldo mínimo projetado e semanas em vermelho'
      }
    ],
    checkup: [
      'O saldo de caixa cobre pelo menos 30 dias de despesas fixas?',
      'A inadimplência está abaixo de 5% do contas a receber?',
      'Todas as despesas do mês estão lançadas por categoria?',
      'O ciclo financeiro (DSO + estoque - DPO) é conhecido?',
      'Existe projeção de caixa para os próximos 90 dias?'
    ]
  },

  estoque: {
    concepts: [
      {
        term: 'Giro de estoque',
        formula: 'Giro = CMV do período ÷ Estoque médio (a custo)',
        explanation: 'Quantas vezes o estoque foi renovado no período. Giro baixo = capital parado e risco de obsolescência.',
        target: 'Varejo: 6 a 12 vezes/ano | Distribuição: 10 a 20 | Itens A: giro acima da média da casa.'
      },
      {
        term: 'Cobertura de estoque',
        formula: 'Cobertura (dias) = Estoque atual ÷ Demanda média diária',
        explanation: 'Quantos dias de venda o estoque atual garante. É o principal termômetro de ruptura.',
        target: 'Itens A: 15 a 30 dias | B: 30 a 60 | C: 60 a 90.'
      },
      {
        term: 'Ponto de pedido',
        formula: 'Ponto de Pedido = (Demanda média diária × Lead time) + Estoque de segurança',
        explanation: 'Nível de estoque que dispara a compra. Comprar abaixo dele gera ruptura; acima gera excesso.',
        target: 'Recalcular mensalmente com a demanda dos últimos 90 dias.'
      },
      {
        term: 'Ruptura (stockout)',
        formula: 'Ruptura = itens com estoque zerado e demanda ativa',
        explanation: 'Cada ruptura é venda perdida e risco de perda definitiva do cliente para o concorrente.',
        target: 'Zero ruptura em itens classe A.'
      },
      {
        term: 'Curva ABC de estoque',
        formula: 'A = 80% do valor | B = 15% | C = 5%',
        explanation: 'Direciona o esforço de controle: itens A são contados com frequência e têm estoque enxuto; C podem ter lote maior.',
        target: 'Inventário rotativo semanal para A, mensal para B, trimestral para C.'
      },
      {
        term: 'Acurácia de inventário',
        formula: 'Acurácia (%) = Itens com contagem igual ao sistema ÷ Itens contados × 100',
        explanation: 'Sem acurácia, todo cálculo de reposição falha. Erro de inventário é a principal causa de ruptura "fantasma".',
        target: 'Acima de 95% nos itens A.'
      },
      {
        term: 'Expedição (OTIF)',
        formula: 'OTIF = Pedidos entregues no prazo e completos ÷ Total de pedidos × 100',
        explanation: 'On Time In Full: mede a qualidade da expedição. Pedido separado errado gera retrabalho e insatisfação.',
        target: 'Acima de 95%.'
      }
    ],
    playbooks: [
      {
        title: 'Zerar rupturas em 15 dias',
        when: 'Existem itens com estoque zerado ou abaixo do mínimo',
        steps: [
          'Liste os itens em ruptura ordenados por demanda (unidades vendidas em 90 dias).',
          'Calcule a quantidade de reposição: demanda diária × 30 + estoque mínimo - estoque atual.',
          'Emita o pedido de compra dos itens A hoje; dos B e C nesta semana.',
          'Enquanto não chega, bloqueie a venda do item ou ofereça substituto para não perder o cliente.',
          'Revise o estoque mínimo dos itens que romperam 2 vezes no trimestre.'
        ],
        kpi: 'Nº de itens em ruptura e vendas perdidas estimadas'
      },
      {
        title: 'Liberar capital parado em estoque',
        when: 'Há itens com cobertura acima de 90 dias ou sem venda há mais de 90 dias',
        steps: [
          'Liste os itens com maior valor de estoque e menor giro (valor parado).',
          'Separe em: excesso de compra, produto em fim de linha ou erro de cadastro.',
          'Aplique ação por grupo: promoção/kit, devolução ao fornecedor ou baixa contábil.',
          'Ajuste a política de compra (lote mínimo x giro) para não repetir.',
          'Meça o capital liberado em reais no fim do mês.'
        ],
        kpi: 'Capital liberado (R$) e giro de estoque'
      },
      {
        title: 'Rotina diária de expedição',
        when: 'Pedidos acumulados ou erros de separação',
        steps: [
          'Comece o dia listando os pedidos pendentes por data de venda (mais antigos primeiro).',
          'Separe por rota/transportadora e confira cada item com checklist duplo.',
          'Baixe o estoque e atualize o status do pedido no mesmo momento da separação.',
          'Registre ocorrências (item faltante, avaria) e trate no fim do dia.',
          'Meça OTIF e tempo médio de separação semanalmente.'
        ],
        kpi: 'OTIF, pedidos pendentes e tempo médio de expedição'
      }
    ],
    checkup: [
      'Nenhum item classe A está em ruptura?',
      'O estoque mínimo de cada item foi calculado com demanda real?',
      'A acurácia do último inventário foi acima de 95%?',
      'Não há itens com cobertura acima de 90 dias sem justificativa?',
      'Todos os pedidos pendentes foram expedidos dentro do prazo combinado?'
    ]
  }
};

// Respostas rápidas para dúvidas conceituais fora dos domínios (transversais)
const GENERAL = {
  formulas: [
    { q: 'margem', a: 'Margem bruta = (Receita - CMV) ÷ Receita × 100. Margem líquida = Lucro líquido ÷ Receita × 100.' },
    { q: 'markup', a: 'Markup = (Preço de venda - Custo) ÷ Custo × 100. Preço = Custo × (1 + Markup).' },
    { q: 'precificação', a: 'Preço de venda = Custo ÷ (1 - Margem alvo - % impostos - % comissão - % despesas variáveis). Nunca precifique apenas "custo + x%" sem considerar as despesas.' },
    { q: 'ponto de equilíbrio', a: 'PE (R$) = Despesas fixas mensais ÷ Margem de contribuição (%). PE (unidades) = Despesas fixas ÷ (Preço - Custo variável unitário).' },
    { q: 'giro', a: 'Giro de estoque = CMV do período ÷ Estoque médio a custo. Cobertura (dias) = Estoque ÷ Demanda média diária.' },
    { q: 'cac', a: 'CAC = Investimento em marketing e vendas ÷ Novos clientes no período. LTV/CAC saudável é maior que 3.' },
    { q: 'ltv', a: 'LTV = Ticket médio × Compras por ano × Margem × Anos de relacionamento.' },
    { q: 'capital de giro', a: 'Capital de giro = Contas a receber + Estoque - Contas a pagar. Ciclo financeiro = DSO + Dias de estoque - DPO.' },
    { q: 'dsO', a: 'DSO = (Contas a receber ÷ Receita) × Dias. DPO = (Contas a pagar ÷ Compras) × Dias.' },
    { q: 'curva abc', a: 'Ordene por valor (receita ou estoque), acumule e corte: A até 80%, B até 95%, C o restante.' },
    { q: 'dre', a: 'Receita - Impostos = Receita líquida; - CMV = Lucro bruto; - Despesas = Lucro operacional; - Financeiro/IR = Lucro líquido.' }
  ],
  erpHowTo: [
    { intent: 'registrar venda', page: 'sales', text: 'Cadastre a venda em Vendas → Nova Venda, selecione o cliente, adicione os itens (o estoque é baixado automaticamente) e informe a forma de pagamento. Se for a prazo, gere o título em Contas a Receber.' },
    { intent: 'dar baixa em estoque', page: 'products', text: 'A baixa é automática ao registrar a venda. Para ajuste manual (perda, inventário), edite o produto em Produtos/Estoque e corrija a quantidade.' },
    { intent: 'registrar compra', page: 'purchases', text: 'Em Compras → Nova Compra, escolha o fornecedor e os itens: o custo e o estoque dos produtos são atualizados na entrada. Gere o título em Contas a Pagar se for a prazo.' },
    { intent: 'cobrar cliente', page: 'receivable', text: 'Em Contas a Receber filtre pelos títulos vencidos, registre a cobrança no campo de observações e dê baixa ao receber. Use a régua D-3, D+1, D+15, D+30, D+60.' },
    { intent: 'ver resultado', page: 'dre', text: 'O DRE gerencial está em Financeiro → DRE. Combine com o Dashboard para ver receita, despesas, lucro e margem do mês.' },
    { intent: 'controlar caixa', page: 'cashflow', text: 'Em Fluxo de Caixa ficam todas as movimentações (entradas e saídas). O saldo projetado considera contas a receber e a pagar pendentes.' },
    { intent: 'aprender', page: 'course', text: 'A Academia ERP (menu Curso) tem 23 módulos e 58 aulas com exercícios práticos aplicados aos dados desta empresa, quiz corrigido e certificado.' }
  ]
};

function getKnowledge(domainId) {
  return KNOWLEDGE[domainId] || null;
}

function allDomainsKnowledge() {
  return KNOWLEDGE;
}

module.exports = { KNOWLEDGE, GENERAL, getKnowledge, allDomainsKnowledge };
