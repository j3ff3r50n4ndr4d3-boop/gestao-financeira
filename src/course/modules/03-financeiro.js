// Módulos 9 a 14 - Contas a Receber, Contas a Pagar, Despesas, Fluxo de Caixa, DRE e Ponto de Equilíbrio
module.exports = [

  // ==========================================================
  // MÓDULO 9 - CONTAS A RECEBER
  // ==========================================================
  {
    id: 'm9',
    title: 'Contas a Receber e Inadimplência',
    icon: '📥',
    theme: 'Financeiro',
    level: 'Intermediário',
    summary: 'Recebíveis, vencimentos, aging, régua de cobrança e política de crédito.',
    lessons: [
      {
        id: 'm9a1',
        title: 'Lançando e controlando recebíveis',
        duration: 10,
        goal: 'Cadastrar contas a receber com cliente, valor e vencimento, e dar baixa corretamente.',
        blocks: [
          { t: 'p', text: 'O módulo Contas a Receber guarda o direito de crédito: cliente, descrição, valor, data de vencimento, status (pendente ou pago), data do pagamento e observações. É a ferramenta que impede que dinheiro vendido desapareça.' },
          { t: 'steps', items: [
            'Abra Contas a Receber e clique em Nova Conta',
            'Selecione o cliente devedor',
            'Descreva o título de forma clara: número da venda ou da nota',
            'Informe o valor e a data de vencimento',
            'Salve — o título aparece ordenado por vencimento',
            'Quando o cliente pagar, use a ação Marcar como pago e confirme a data'
          ] },
          { t: 'h', text: 'Boas práticas de lançamento' },
          { t: 'checklist', items: [
            'Um título por parcela, nunca um título único para 12 parcelas',
            'Vencimento sempre informado: título sem data não é cobrado',
            'Descrição com referência à venda ou nota fiscal',
            'Baixa no mesmo dia do recebimento',
            'Observações registrando promessa de pagamento e histórico de contato'
          ] },
          { t: 'warn', text: 'Recebível baixado sem o dinheiro ter entrado infla o lucro e esconde o problema de caixa. A baixa só acontece com o recurso compensado.' },
          { t: 'tip', text: 'Venda parcelada em 6 vezes gera 6 títulos com 6 vencimentos. Isso permite ver a entrada mês a mês na projeção de caixa.' }
        ],
        quiz: [
          { q: 'Uma venda em 6 parcelas deve gerar:', a: ['1 título com o valor total', '6 títulos, um por vencimento', 'Nenhum título se for cartão', '2 títulos semestrais'], r: 1, e: 'Um título por parcela permite projetar e cobrar cada vencimento.' },
          { q: 'A baixa de uma conta a receber deve ocorrer:', a: ['Na data da venda', 'Quando o recurso estiver efetivamente recebido', 'No fim do mês', 'Quando o cliente prometer pagar'], r: 1, e: 'Baixa antecipada distorce caixa e resultado.' },
          { q: 'Um título sem data de vencimento provoca:', a: ['Melhor controle', 'Ausência de alerta e de cobrança programada', 'Baixa automática', 'Aumento de margem'], r: 1, e: 'Sem vencimento não há alerta de atraso nem gatilho de cobrança.' }
        ]
      },
      {
        id: 'm9a2',
        title: 'Aging e régua de cobrança',
        duration: 11,
        goal: 'Montar um relatório de aging e uma régua de cobrança automatizável.',
        blocks: [
          { t: 'p', text: 'Aging é a separação dos recebíveis por faixa de atraso. É o relatório que mostra onde está o dinheiro parado e qual a probabilidade real de recebê-lo.' },
          { t: 'table', head: ['Faixa', 'Status', 'Probabilidade típica de recebimento', 'Ação'], rows: [
            ['A vencer', 'Normal', 'Alta', 'Lembrete 3 dias antes'],
            ['1 a 15 dias', 'Atraso inicial', 'Alta', 'Contato amigável imediato'],
            ['16 a 30 dias', 'Atraso médio', 'Média', 'Cobrança formal com proposta de acordo'],
            ['31 a 60 dias', 'Atraso grave', 'Baixa', 'Suspensão de novas vendas e negociação'],
            ['Acima de 60 dias', 'Crítico', 'Muito baixa', 'Protesto, negativação ou assessoria de cobrança']
          ] },
          { t: 'h', text: 'Régua de cobrança sugerida' },
          { t: 'steps', items: [
            'D-3: mensagem de lembrete com valor, vencimento e chave PIX',
            'D+1: contato amigável, oferecendo segunda via e opções de pagamento',
            'D+7: cobrança formal por e-mail com prazo de 48 horas',
            'D+15: ligação do responsável comercial e suspensão de novas vendas',
            'D+30: notificação extrajudicial e proposta de parcelamento',
            'D+60: negativação ou envio para assessoria de cobrança'
          ] },
          { t: 'formula', text: 'Índice de inadimplência (%) = (títulos vencidos ÷ total a receber) x 100' },
          { t: 'h', text: 'Exercício no sistema' },
          { t: 'steps', items: [
            'Abra Contas a Receber e liste os títulos com status pendente',
            'Separe por faixa de atraso usando a data de vencimento e a data de hoje',
            'Some o valor de cada faixa e calcule o índice de inadimplência',
            'Escolha os 3 maiores devedores e execute hoje a etapa correspondente da régua'
          ] },
          { t: 'tip', text: 'Cobrança rápida é gentil: 80% dos atrasos curtos são esquecimento, não má-fé. Cobrança tardia é cara e destrói relacionamento.' }
        ],
        quiz: [
          { q: 'O relatório de aging serve para:', a: ['Calcular imposto', 'Separar recebíveis por faixa de atraso e definir a ação de cobrança', 'Emitir nota fiscal', 'Definir preço de venda'], r: 1, e: 'Aging classifica a carteira por idade de atraso e direciona a cobrança.' },
          { q: 'Títulos com mais de 60 dias de atraso exigem:', a: ['Lembrete por WhatsApp', 'Ação formal: notificação, negativação ou assessoria', 'Espera de mais 30 dias', 'Desconto de 20% imediato'], r: 1, e: 'Nessa faixa a probabilidade de recebimento cai muito e exige medida formal.' },
          { q: 'O índice de inadimplência é calculado por:', a: ['Vendas ÷ clientes', 'Títulos vencidos ÷ total a receber x 100', 'Receita ÷ despesas', 'Lucro ÷ receita'], r: 1, e: 'Mede a proporção da carteira que está em atraso.' }
        ]
      },
      {
        id: 'm9a3',
        title: 'Política de crédito e análise de clientes',
        duration: 10,
        goal: 'Definir limites de crédito, prazos e critérios objetivos antes de vender a prazo.',
        blocks: [
          { t: 'p', text: 'Vender a prazo é conceder empréstimo ao cliente com dinheiro próprio. Sem política, a empresa financia quem não paga e perde quem pagaria.' },
          { t: 'h', text: 'Critérios objetivos de concessão' },
          { t: 'table', head: ['Critério', 'Análise', 'Efeito no limite'], rows: [
            ['Tempo de relacionamento', 'Cliente há mais de 12 meses', 'Limite maior'],
            ['Histórico de pagamento', 'Atrasos nos últimos 12 meses', 'Cada atraso reduz o limite'],
            ['Volume comprado', 'Receita anual com o cliente', 'Limite proporcional'],
            ['Garantias', 'Fiador, contrato, caução', 'Permite prazo maior'],
            ['Consulta externa', 'Restrições em bureaus de crédito', 'Bloqueia ou exige à vista']
          ] },
          { t: 'formula', text: 'Limite de crédito sugerido = média de compra mensal x prazo em meses (máximo 2)' },
          { t: 'h', text: 'Modelo de política em três níveis' },
          { t: 'list', items: [
            'Nível 1 — Cliente novo: somente à vista ou cartão, sem exceção',
            'Nível 2 — Cliente com 6 meses e sem atraso: prazo de 28 dias, limite de 1 compra média mensal',
            'Nível 3 — Cliente com 12 meses e sem atraso: prazo de 28/56 dias, limite de 2 compras médias mensais'
          ] },
          { t: 'warn', text: 'Exceção sem registro vira regra. Toda concessão fora da política precisa de aprovação do gestor e justificativa escrita no cadastro do cliente.' },
          { t: 'steps', items: [
            'Escreva a política de crédito em uma página',
            'Classifique os clientes atuais nos três níveis usando o histórico de contas a receber',
            'Registre o limite de cada cliente no campo de observações do cadastro',
            'Revise os limites a cada 6 meses'
          ] }
        ],
        quiz: [
          { q: 'Vender a prazo significa, na prática:', a: ['Aumentar a margem', 'Conceder empréstimo ao cliente com capital próprio', 'Reduzir o custo de venda', 'Eliminar risco'], r: 1, e: 'A empresa financia o cliente até o recebimento.' },
          { q: 'Cliente novo, sem histórico, deve:', a: ['Receber prazo de 60 dias', 'Comprar à vista ou no cartão', 'Ter limite igual ao maior cliente', 'Ter desconto de 10%'], r: 1, e: 'Sem histórico não há base para conceder crédito.' },
          { q: 'Uma exceção à política de crédito deve:', a: ['Ser ignorada', 'Ter aprovação e justificativa registrada', 'Ser aplicada a todos depois', 'Ser decidida pelo cliente'], r: 1, e: 'Exceção registrada e aprovada não contamina a política.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 10 - CONTAS A PAGAR
  // ==========================================================
  {
    id: 'm10',
    title: 'Contas a Pagar e Capital de Giro',
    icon: '📤',
    theme: 'Financeiro',
    level: 'Intermediário',
    summary: 'Obrigações, prazos, custo do atraso e gestão consciente do capital de giro.',
    lessons: [
      {
        id: 'm10a1',
        title: 'Registrando obrigações e priorizando pagamentos',
        duration: 10,
        goal: 'Lançar contas a pagar e definir prioridade de pagamento com critério.',
        blocks: [
          { t: 'p', text: 'O módulo Contas a Pagar registra as obrigações: fornecedor, descrição, valor, vencimento, status, data de pagamento e observações. Sem ele, o caixa é administrado pela ordem em que os boletos chegam à mesa.' },
          { t: 'steps', items: [
            'Abra Contas a Pagar e clique em Nova Conta',
            'Selecione o fornecedor e descreva a obrigação com a referência da nota',
            'Informe valor e vencimento',
            'Salve e confira se a conta aparece ordenada por vencimento',
            'Ao pagar, marque como pago com a data real'
          ] },
          { t: 'h', text: 'Ordem de prioridade de pagamento' },
          { t: 'table', head: ['Prioridade', 'Tipo', 'Motivo'], rows: [
            ['1', 'Folha de pagamento e encargos', 'Risco trabalhista e pessoal'],
            ['2', 'Tributos', 'Multa, juros e risco fiscal'],
            ['3', 'Fornecedores críticos', 'Sem eles a operação para'],
            ['4', 'Aluguel, energia, internet', 'Risco de despejo e paralisação'],
            ['5', 'Empréstimos e financiamentos', 'Custo financeiro e restrição cadastral'],
            ['6', 'Fornecedores não críticos', 'Podem ser renegociados']
          ] },
          { t: 'warn', text: 'Atrasar tributo e folha tem consequência legal. Atrasar fornecedor tem consequência comercial. A ordem das decisões muda conforme o impacto, nunca por conveniência.' },
          { t: 'tip', text: 'Programar todos os pagamentos da semana na segunda-feira reduz erro, evita multa e libera o resto da semana para vender.' }
        ],
        quiz: [
          { q: 'A primeira prioridade de pagamento em cenário de caixa apertado é:', a: ['Fornecedor não crítico', 'Folha de pagamento e encargos', 'Marketing', 'Compra de estoque'], r: 1, e: 'Folha e encargos têm risco trabalhista imediato e impacto pessoal.' },
          { q: 'Atrasar tributos gera:', a: ['Apenas desconforto', 'Multa, juros e risco fiscal', 'Desconto futuro', 'Nada relevante'], r: 1, e: 'Tributo atrasado tem consequência legal e financeira crescente.' },
          { q: 'Programar os pagamentos da semana ajuda a:', a: ['Aumentar vendas', 'Evitar multas e reduzir erro operacional', 'Reduzir estoque', 'Melhorar o SEO'], r: 1, e: 'Rotina de programação elimina esquecimento e retrabalho.' }
        ]
      },
      {
        id: 'm10a2',
        title: 'Ciclo financeiro, necessidade de capital de giro e custo do atraso',
        duration: 12,
        goal: 'Calcular o ciclo financeiro e a necessidade de capital de giro da operação.',
        blocks: [
          { t: 'h', text: 'Os três prazos' },
          { t: 'formula', text: 'PME (prazo médio de estoque) = (estoque médio ÷ custo das vendas) x 365' },
          { t: 'formula', text: 'PMR (prazo médio de recebimento) = (contas a receber ÷ vendas) x 365' },
          { t: 'formula', text: 'PMP (prazo médio de pagamento) = (contas a pagar ÷ compras) x 365' },
          { t: 'formula', text: 'Ciclo operacional = PME + PMR   |   Ciclo financeiro = ciclo operacional - PMP' },
          { t: 'h', text: 'Exemplo' },
          { t: 'table', head: ['Indicador', 'Valor'], rows: [
            ['PME', '45 dias'],
            ['PMR', '38 dias'],
            ['PMP', '30 dias'],
            ['Ciclo operacional', '83 dias'],
            ['Ciclo financeiro', '53 dias']
          ] },
          { t: 'p', text: 'A empresa financia 53 dias de operação com recursos próprios. Cada dia reduzido no PMR ou aumentado no PMP diminui a necessidade de capital de giro sem tocar na margem.' },
          { t: 'formula', text: 'Necessidade de capital de giro = (custo diário da operação) x ciclo financeiro em dias' },
          { t: 'h', text: 'Alavancas para reduzir o ciclo' },
          { t: 'list', items: [
            'Aumentar a participação de vendas à vista e no PIX',
            'Reduzir prazo de recebimento com desconto pontual para antecipação',
            'Negociar prazo maior com os fornecedores principais',
            'Reduzir estoque de produtos classe C',
            'Evitar atraso: multa e juros costumam custar mais que o ganho de caixa'
          ] },
          { t: 'warn', text: 'Custo típico de atraso de fornecedor: multa de 2% mais juros de 1% ao mês, além da perda de condição comercial. Frequentemente é mais caro que um capital de giro bem contratado.' },
          { t: 'steps', items: [
            'Calcule PME, PMR e PMP com os dados dos últimos 12 meses do sistema',
            'Determine o ciclo financeiro em dias',
            'Multiplique pelo custo diário da operação para achar a necessidade de capital de giro',
            'Escolha uma alavanca e defina meta de redução de 5 dias em 90 dias'
          ] }
        ],
        quiz: [
          { q: 'Ciclo financeiro é igual a:', a: ['PME + PMR + PMP', 'Ciclo operacional menos prazo médio de pagamento', 'PMR menos PME', 'PMP menos PMR'], r: 1, e: 'Ciclo financeiro = (PME + PMR) - PMP.' },
          { q: 'PME 45, PMR 38 e PMP 30 resultam em ciclo financeiro de:', a: ['83 dias', '53 dias', '113 dias', '23 dias'], r: 1, e: '(45 + 38) - 30 = 53 dias.' },
          { q: 'Reduzir o ciclo financeiro sem perder margem pode ser feito:', a: ['Aumentando o estoque', 'Aumentando vendas à vista e negociando prazo maior com fornecedores', 'Atrasando tributos', 'Dando mais desconto'], r: 1, e: 'São alavancas que mexem em prazo, não em preço.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 11 - DESPESAS
  // ==========================================================
  {
    id: 'm11',
    title: 'Despesas: categoria, rateio e corte inteligente',
    icon: '💸',
    theme: 'Financeiro',
    level: 'Intermediário',
    summary: 'Fixas e variáveis, categorias do sistema, centro de custo e plano de redução de custos.',
    lessons: [
      {
        id: 'm11a1',
        title: 'Classificando despesas: fixas, variáveis e categorias',
        duration: 10,
        goal: 'Lançar despesas na categoria correta e separar fixas de variáveis.',
        blocks: [
          { t: 'p', text: 'O módulo Despesas registra descrição, categoria, valor, data, forma de pagamento e observações. A categoria é o que transforma uma lista de gastos em informação gerencial: é ela que alimenta o gráfico de pizza do dashboard e a DRE por linha.' },
          { t: 'table', head: ['Tipo', 'Comportamento', 'Exemplos'], rows: [
            ['Fixas', 'Não variam com o volume vendido', 'Aluguel, internet, salários administrativos, sistemas, seguro'],
            ['Variáveis', 'Crescem com a venda', 'Custo da mercadoria, comissão, taxa de cartão, frete de entrega, embalagem'],
            ['Semiafixas', 'Mudam por faixa de volume', 'Energia, telefone, horas extras']
          ] },
          { t: 'h', text: 'Padrão de categorias recomendado' },
          { t: 'list', items: [
            'Pessoal e encargos (salários, pró-labore, férias, FGTS, INSS)',
            'Ocupação (aluguel, condomínio, IPTU, manutenção)',
            'Utilidades (energia, água, internet, telefone)',
            'Comercial (comissões, marketing, publicidade, viagens)',
            'Administrativo (sistemas, contador, material de escritório)',
            'Financeiro (tarifas, juros, IOF, taxas de cartão)',
            'Tributos (impostos e taxas)',
            'Logística (frete, embalagem, entrega)'
          ] },
          { t: 'steps', items: [
            'Abra Despesas e revise os lançamentos do mês',
            'Reclassifique tudo que estiver em categoria genérica',
            'Lance as despesas fixas recorrentes com o mesmo dia do mês',
            'Confira o gráfico de despesas por categoria no dashboard'
          ] },
          { t: 'warn', text: 'Categoria errada distorce a DRE e a análise de corte de custo. Se a categoria não existe, crie uma nova — mas nunca use uma categoria aproximada.' }
        ],
        quiz: [
          { q: 'Aluguel é classificado como despesa:', a: ['Variável', 'Fixa', 'Semiafixa', 'Financeira'], r: 1, e: 'Não varia com o volume de vendas: é despesa fixa.' },
          { q: 'Comissão de venda é despesa:', a: ['Fixa', 'Variável', 'De ocupação', 'Tributo'], r: 1, e: 'Cresce proporcionalmente à venda: variável.' },
          { q: 'A categoria da despesa é importante porque:', a: ['É exigência do banco de dados', 'Alimenta o gráfico por categoria e a DRE por linha', 'Define o imposto', 'Define o preço do produto'], r: 1, e: 'Sem categoria correta não há análise gerencial confiável.' }
        ]
      },
      {
        id: 'm11a2',
        title: 'Centro de custo, rateio e plano de redução',
        duration: 11,
        goal: 'Ratear despesas por área e estruturar um plano de corte com meta e prazo.',
        blocks: [
          { t: 'p', text: 'Centro de custo é a divisão da empresa para onde a despesa é direcionada: loja, oficina, administrativo, comercial, delivery. Ratear permite descobrir qual área consome o lucro.' },
          { t: 'h', text: 'Critérios de rateio' },
          { t: 'table', head: ['Despesa', 'Critério de rateio'], rows: [
            ['Aluguel', 'Área ocupada (m²) por centro'],
            ['Energia', 'Consumo medido ou número de equipamentos'],
            ['Salário administrativo', 'Horas dedicadas a cada centro'],
            ['Marketing', 'Receita gerada por centro'],
            ['Sistemas', 'Número de usuários por centro']
          ] },
          { t: 'h', text: 'Plano de redução de custo em 5 passos' },
          { t: 'steps', items: [
            'Ordene as despesas dos últimos 3 meses por categoria e valor',
            'Identifique as 3 categorias que concentram 80% do gasto',
            'Para cada uma, separe: essencial, negociável e eliminável',
            'Defina meta percentual de redução por categoria e responsável',
            'Acompanhe semanalmente no módulo Despesas até bater a meta'
          ] },
          { t: 'h', text: 'Onde costuma estar a economia' },
          { t: 'list', items: [
            'Contratos recorrentes não revisados há mais de 12 meses (internet, sistemas, seguros)',
            'Tarifas bancárias: migrar de pacote costuma economizar de R$ 100 a R$ 500 por mês',
            'Taxa de cartão: renegociar 0,5 ponto em volume alto é relevante',
            'Assinaturas duplicadas e ferramentas não utilizadas',
            'Frete: consolidar entregas em menos saídas'
          ] },
          { t: 'warn', text: 'Corte cego mata receita. Marketing, manutenção preventiva e treinamento são despesas que geram receita futura: corte primeiro o que não gera resultado nenhum.' },
          { t: 'tip', text: 'Meta realista: reduzir de 8% a 15% das despesas administrativas em 90 dias, sem tocar em estrutura comercial.' }
        ],
        quiz: [
          { q: 'Ratear despesas por centro de custo permite:', a: ['Pagar menos imposto', 'Identificar qual área consome o lucro', 'Aumentar o estoque', 'Definir o SKU'], r: 1, e: 'O rateio revela o custo real de cada área da operação.' },
          { q: 'O critério de rateio mais adequado para aluguel é:', a: ['Número de clientes', 'Área ocupada em m²', 'Faturamento', 'Número de notas fiscais'], r: 1, e: 'Espaço físico ocupado é a base natural do rateio de aluguel.' },
          { q: 'Antes de cortar custos, é preciso separar despesas em:', a: ['Altas e baixas', 'Essenciais, negociáveis e elimináveis', 'Antigas e novas', 'Pagas e não pagas'], r: 1, e: 'Classificação evita cortar o que gera receita.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 12 - FLUXO DE CAIXA
  // ==========================================================
  {
    id: 'm12',
    title: 'Fluxo de Caixa: realizado e projetado',
    icon: '💰',
    theme: 'Financeiro',
    level: 'Intermediário',
    summary: 'Entradas e saídas, saldo em tempo real, projeção de 13 semanas e cenários.',
    lessons: [
      {
        id: 'm12a1',
        title: 'Estrutura do fluxo de caixa no ERP',
        duration: 10,
        goal: 'Registrar movimentações com tipo, categoria e data, e ler o saldo corretamente.',
        blocks: [
          { t: 'p', text: 'A tabela de fluxo de caixa registra tipo (entrada ou saída), descrição, categoria, valor, data e observações. Vendas pagas, recebimentos baixados e despesas pagas alimentam o saldo em tempo real.' },
          { t: 'table', head: ['Campo', 'Boa prática'], rows: [
            ['Tipo', 'entrada ou saída, sem exceção'],
            ['Categoria', 'Mesma taxonomia usada em despesas e receitas'],
            ['Data', 'Data do fato financeiro, não a data do lançamento'],
            ['Descrição', 'Referência à venda, nota ou boleto'],
            ['Observações', 'Conta bancária ou carteira quando houver mais de uma']
          ] },
          { t: 'formula', text: 'Saldo do período = saldo anterior + entradas - saídas' },
          { t: 'h', text: 'Estrutura gerencial recomendada' },
          { t: 'list', items: [
            'Entradas operacionais: vendas à vista, recebimentos de clientes, serviços',
            'Entradas não operacionais: aportes de sócio, empréstimos, venda de ativo',
            'Saídas operacionais: fornecedores, folha, tributos, despesas fixas',
            'Saídas não operacionais: amortização de empréstimo, retirada de sócio, investimento'
          ] },
          { t: 'warn', text: 'Misturar aporte de sócio com receita faz a empresa parecer lucrativa quando não é. Separe sempre operacional de não operacional.' },
          { t: 'steps', items: [
            'Abra Fluxo de Caixa e liste as movimentações do mês',
            'Confira se toda venda paga e despesa paga aparecem na lista',
            'Calcule o saldo do período e compare com o extrato bancário',
            'Ajuste categoria e descrição das movimentações genéricas'
          ] }
        ],
        quiz: [
          { q: 'Um aporte de sócio deve ser classificado como:', a: ['Receita operacional', 'Entrada não operacional', 'Despesa fixa', 'Conta a receber'], r: 1, e: 'Não vem da operação: é entrada não operacional e não pode inflar a receita.' },
          { q: 'O saldo do período é calculado por:', a: ['Entradas - saídas', 'Saldo anterior + entradas - saídas', 'Receita - custo', 'Vendas x margem'], r: 1, e: 'Saldo acumulado considera o saldo anterior mais as movimentações do período.' },
          { q: 'A data de uma movimentação de caixa deve ser:', a: ['A data do lançamento no sistema', 'A data do fato financeiro', 'Sempre hoje', 'O último dia do mês'], r: 1, e: 'A data do fato garante a correta projeção e conciliação.' }
        ]
      },
      {
        id: 'm12a2',
        title: 'Projeção de caixa de 13 semanas',
        duration: 12,
        goal: 'Construir uma projeção de caixa de 13 semanas com recebíveis e obrigações conhecidos.',
        blocks: [
          { t: 'p', text: 'A projeção de 13 semanas é o instrumento padrão de gestão de caixa: cobre um trimestre, é curta o bastante para ser confiável e longa o bastante para agir a tempo.' },
          { t: 'h', text: 'Como montar' },
          { t: 'steps', items: [
            'Coluna 1: semanas (1 a 13)',
            'Linhas de entrada: recebíveis por vencimento (Contas a Receber) + vendas à vista estimadas',
            'Linhas de saída: contas a pagar por vencimento + folha + tributos + despesas fixas',
            'Linha de saldo acumulado: saldo anterior + entradas - saídas de cada semana',
            'Marque em vermelho toda semana com saldo negativo'
          ] },
          { t: 'h', text: 'Exemplo simplificado (valores em R$ mil)' },
          { t: 'table', head: ['Semana', 'Entradas', 'Saídas', 'Saldo acumulado'], rows: [
            ['1', '40', '35', '15'],
            ['2', '30', '48', '-3'],
            ['3', '55', '32', '20'],
            ['4', '25', '40', '5']
          ] },
          { t: 'warn', text: 'Na semana 2 o caixa fica negativo. A decisão precisa ser tomada na semana 1: antecipar recebível, adiar compra não crítica ou contratar capital de giro. Descobrir no dia do pagamento é tarde.' },
          { t: 'h', text: 'Três cenários' },
          { t: 'list', items: [
            'Realista: vendas no patamar médio dos últimos 3 meses',
            'Pessimista: 20% a menos de vendas e 10% de inadimplência adicional',
            'Otimista: 15% a mais de vendas',
            'A decisão de caixa é sempre tomada pelo cenário pessimista'
          ] },
          { t: 'tip', text: 'Atualize a projeção toda sexta-feira com os dados reais da semana. Projeção desatualizada é pior que nenhuma projeção.' }
        ],
        quiz: [
          { q: 'A projeção de 13 semanas é usada porque:', a: ['É o período fiscal', 'Cobre um trimestre, é confiável e permite agir com antecedência', 'É o prazo de vencimento dos boletos', 'É exigência contábil'], r: 1, e: 'Trimestre é o horizonte em que as estimativas ainda são confiáveis.' },
          { q: 'Se a semana 2 apresenta saldo negativo, a ação deve ser tomada:', a: ['Na semana 2', 'Antes, na semana 1', 'No fechamento do mês', 'Quando o banco ligar'], r: 1, e: 'A decisão de caixa se toma com antecedência: antecipação, adiamento ou capital de giro.' },
          { q: 'A decisão de caixa deve se basear no cenário:', a: ['Otimista', 'Realista', 'Pessimista', 'Aleatório'], r: 2, e: 'Planejar pelo pessimista evita surpresa; o otimista serve para dimensionar oportunidade.' }
        ]
      },
      {
        id: 'm12a3',
        title: 'Caixa mínimo, capital de giro e reserva de emergência',
        duration: 10,
        goal: 'Definir o caixa mínimo de segurança e a política de uso do excedente.',
        blocks: [
          { t: 'formula', text: 'Caixa mínimo = despesas fixas mensais x meses de cobertura desejados' },
          { t: 'table', head: ['Perfil da empresa', 'Cobertura recomendada'], rows: [
            ['MEI ou autônomo', '1 a 2 meses de despesas fixas'],
            ['Pequena empresa consolidada', '3 meses'],
            ['Empresa sazonal ou com ciclo longo', '4 a 6 meses'],
            ['Empresa em crescimento acelerado', '3 meses + reserva para investimento']
          ] },
          { t: 'p', text: 'Exemplo: despesas fixas de R$ 30.000 por mês e cobertura de 3 meses exigem R$ 90.000 de caixa mínimo. Abaixo disso, qualquer imprevisto vira empréstimo caro.' },
          { t: 'h', text: 'Política de uso do excedente' },
          { t: 'steps', items: [
            'Defina o valor do caixa mínimo e registre na política financeira da empresa',
            'Todo excedente acima do mínimo vai para aplicação de liquidez diária ou redução de dívida cara',
            'Retirada de sócio acima do pró-labore só com caixa acima do mínimo',
            'Investimento em expansão só com projeção de caixa positiva por 13 semanas'
          ] },
          { t: 'warn', text: 'Crescer quebrado é o erro mais comum: vender mais aumenta estoque, comissão e prazo de recebimento, consumindo caixa antes de gerar lucro. Crescimento exige capital de giro proporcional.' },
          { t: 'tip', text: 'Revise o caixa mínimo a cada 6 meses ou sempre que as despesas fixas mudarem mais de 10%.' }
        ],
        quiz: [
          { q: 'Com despesas fixas de R$ 30.000 e cobertura de 3 meses, o caixa mínimo é:', a: ['R$ 30.000', 'R$ 90.000', 'R$ 60.000', 'R$ 10.000'], r: 1, e: '30.000 x 3 = R$ 90.000.' },
          { q: 'Crescer sem capital de giro proporcional provoca:', a: ['Mais lucro imediato', 'Consumo de caixa antes do lucro chegar', 'Redução de estoque', 'Menor inadimplência'], r: 1, e: 'Estoque, comissão e prazo de recebimento crescem antes da receita virar dinheiro.' },
          { q: 'O excedente acima do caixa mínimo deve ser:', a: ['Distribuído aos sócios', 'Aplicado em liquidez diária ou usado para reduzir dívida cara', 'Guardado em espécie', 'Convertido em estoque'], r: 1, e: 'Excedente parado perde valor; dívida cara consome margem.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 13 - DRE
  // ==========================================================
  {
    id: 'm13',
    title: 'DRE: Demonstrativo de Resultados',
    icon: '📋',
    theme: 'Financeiro',
    level: 'Avançado',
    summary: 'Receita bruta, CMV, lucro bruto, despesas operacionais, lucro líquido e leitura gerencial.',
    lessons: [
      {
        id: 'm13a1',
        title: 'Estrutura da DRE linha por linha',
        duration: 13,
        goal: 'Montar e interpretar uma DRE completa com os dados do sistema.',
        blocks: [
          { t: 'p', text: 'O módulo DRE do ERP monta o demonstrativo a partir de vendas, compras, despesas e estoque. Ele responde à pergunta central: a empresa deu lucro e quanto sobrou de cada real vendido.' },
          { t: 'table', head: ['Linha', 'Significado', 'Origem no sistema'], rows: [
            ['Receita bruta', 'Total vendido no período', 'Módulo Vendas'],
            ['(-) Deduções e impostos', 'Impostos sobre venda, devoluções, descontos', 'Percentual configurado'],
            ['= Receita líquida', 'O que efetivamente fica da venda', 'Cálculo'],
            ['(-) CMV/CPV', 'Custo da mercadoria ou serviço vendido', 'Compras e estoque'],
            ['= Lucro bruto', 'Margem de contribuição da operação', 'Cálculo'],
            ['(-) Despesas operacionais', 'Fixas por categoria', 'Módulo Despesas'],
            ['= Lucro operacional', 'Resultado da atividade fim', 'Cálculo'],
            ['(-) Despesas financeiras', 'Juros, tarifas, taxas', 'Módulo Despesas (categoria financeira)'],
            ['= Lucro líquido', 'O que sobra para o negócio', 'Cálculo']
          ] },
          { t: 'formula', text: 'Lucro bruto = Receita líquida - CMV   |   Margem bruta = Lucro bruto ÷ Receita líquida' },
          { t: 'formula', text: 'Lucro líquido = Lucro operacional - resultado financeiro   |   Margem líquida = Lucro líquido ÷ Receita líquida' },
          { t: 'h', text: 'Exemplo numérico' },
          { t: 'table', head: ['Linha', 'Valor', '% da receita'], rows: [
            ['Receita bruta', 'R$ 200.000', '100,0%'],
            ['Deduções e impostos (12%)', 'R$ 24.000', '12,0%'],
            ['Receita líquida', 'R$ 176.000', '88,0%'],
            ['CMV (55% da líquida)', 'R$ 96.800', '48,4%'],
            ['Lucro bruto', 'R$ 79.200', '39,6%'],
            ['Despesas operacionais', 'R$ 52.000', '26,0%'],
            ['Lucro operacional', 'R$ 27.200', '13,6%'],
            ['Despesas financeiras', 'R$ 3.200', '1,6%'],
            ['Lucro líquido', 'R$ 24.000', '12,0%']
          ] },
          { t: 'steps', items: [
            'Abra o módulo DRE no sistema e selecione o mês',
            'Compare cada linha com a tabela de referência acima',
            'Calcule a margem bruta e a margem líquida',
            'Identifique a linha que mais se desviou do mês anterior'
          ] }
        ],
        quiz: [
          { q: 'Receita líquida de R$ 176.000 com CMV de R$ 96.800 gera lucro bruto de:', a: ['R$ 79.200', 'R$ 96.800', 'R$ 176.000', 'R$ 24.000'], r: 0, e: '176.000 - 96.800 = R$ 79.200.' },
          { q: 'Margem líquida é calculada sobre:', a: ['Receita bruta', 'Receita líquida', 'Lucro bruto', 'Ativo total'], r: 1, e: 'Margem líquida = lucro líquido ÷ receita líquida.' },
          { q: 'Despesas financeiras aparecem na DRE:', a: ['Antes do lucro bruto', 'Depois do lucro operacional', 'Dentro do CMV', 'Não aparecem'], r: 1, e: 'Elas são deduzidas do lucro operacional para chegar ao lucro líquido.' }
        ]
      },
      {
        id: 'm13a2',
        title: 'Análise vertical e horizontal da DRE',
        duration: 12,
        goal: 'Aplicar análise vertical e horizontal para encontrar onde o resultado melhora ou piora.',
        blocks: [
          { t: 'p', text: 'Análise vertical expressa cada linha como percentual da receita. Análise horizontal compara a mesma linha entre períodos. Juntas, elas mostram a origem real da mudança no lucro.' },
          { t: 'formula', text: 'Análise vertical (%) = valor da linha ÷ receita líquida x 100' },
          { t: 'formula', text: 'Análise horizontal (%) = (valor atual - valor anterior) ÷ valor anterior x 100' },
          { t: 'h', text: 'Exemplo comparativo' },
          { t: 'table', head: ['Linha', 'Mês anterior', 'Mês atual', 'Vertical atual', 'Horizontal'], rows: [
            ['Receita líquida', '160.000', '176.000', '100%', '+10,0%'],
            ['CMV', '84.000', '96.800', '55%', '+15,2%'],
            ['Despesas operacionais', '50.000', '52.000', '29,5%', '+4,0%'],
            ['Lucro líquido', '26.000', '24.000', '13,6%', '-7,7%']
          ] },
          { t: 'warn', text: 'Leitura: a receita cresceu 10%, mas o CMV cresceu 15,2%. O lucro caiu mesmo com mais venda. A causa provável é aumento de custo de compra não repassado ao preço, ou mix com mais produto de margem baixa.' },
          { t: 'h', text: 'Roteiro de análise em 6 perguntas' },
          { t: 'list', items: [
            'A receita cresceu por volume ou por preço?',
            'O CMV percentual subiu? Por quê?',
            'As despesas fixas cresceram acima da receita?',
            'Houve despesa não recorrente no mês?',
            'O resultado financeiro piorou por juros ou tarifas?',
            'Qual linha, sozinha, explica mais de 50% da variação do lucro?'
          ] },
          { t: 'steps', items: [
            'Exporte ou copie a DRE de dois meses do sistema',
            'Monte a tabela com vertical e horizontal',
            'Responda as 6 perguntas por escrito',
            'Defina uma ação para a linha que mais impactou o resultado'
          ] }
        ],
        quiz: [
          { q: 'Análise vertical da DRE expressa cada linha como:', a: ['Percentual do lucro', 'Percentual da receita líquida', 'Diferença em reais', 'Percentual do estoque'], r: 1, e: 'Vertical é a participação de cada linha na receita líquida.' },
          { q: 'Receita +10% e CMV +15,2% indicam:', a: ['Melhora de margem', 'Piora de margem por custo crescendo mais que a receita', 'Aumento de lucro', 'Erro de cálculo'], r: 1, e: 'Custo crescendo mais rápido que receita comprime a margem bruta.' },
          { q: 'Análise horizontal compara:', a: ['Linhas do mesmo mês', 'A mesma linha em períodos diferentes', 'Clientes entre si', 'Produtos entre si'], r: 1, e: 'Horizontal mede a evolução de cada linha ao longo do tempo.' }
        ]
      },
      {
        id: 'm13a3',
        title: 'DRE gerencial x contábil e regime de competência na prática',
        duration: 11,
        goal: 'Diferenciar a DRE gerencial da contábil e ajustar o demonstrativo para decisão.',
        blocks: [
          { t: 'table', head: ['Aspecto', 'DRE contábil', 'DRE gerencial'], rows: [
            ['Finalidade', 'Obrigação legal e fiscal', 'Tomada de decisão'],
            ['Periodicidade', 'Mensal/anual formal', 'Semanal, mensal, por produto, por canal'],
            ['Detalhamento', 'Linhas padronizadas', 'Por centro de custo, produto, vendedor'],
            ['Pró-labore', 'Pode não aparecer', 'Sempre destacado como custo'],
            ['Rateio de sócios', 'Conforme norma', 'Conforme a lógica do negócio'],
            ['Público', 'Fisco, bancos, sócios', 'Gestor e equipe']
          ] },
          { t: 'h', text: 'Ajustes gerenciais úteis' },
          { t: 'list', items: [
            'Incluir pró-labore como despesa, mesmo que não pago no mês',
            'Ratear despesas administrativas por centro de custo',
            'Destacar despesas não recorrentes para não contaminar a tendência',
            'Apresentar margem por linha de produto ou serviço',
            'Comparar com o orçamento do mês'
          ] },
          { t: 'h', text: 'Regime de competência na DRE gerencial' },
          { t: 'p', text: 'A DRE reconhece a receita na venda, mesmo que o recebimento seja futuro. Por isso é comum ter DRE positiva e caixa negativo. A leitura correta exige olhar DRE e fluxo de caixa juntos: um diz se o negócio é rentável, o outro diz se ele sobrevive até o próximo mês.' },
          { t: 'warn', text: 'Nunca substitua a DRE contábil pela gerencial para fins fiscais. Elas coexistem: a contábil atende à obrigação, a gerencial orienta a decisão.' },
          { t: 'tip', text: 'Ritual mensal: fechar a DRE gerencial até o dia 5 do mês seguinte, com reunião de 30 minutos para definir as três ações do mês.' }
        ],
        quiz: [
          { q: 'A DRE gerencial serve principalmente para:', a: ['Atender o fisco', 'Apoiar a tomada de decisão do gestor', 'Substituir a contábil', 'Calcular folha'], r: 1, e: 'É instrumento de gestão, com detalhamento por produto, canal e centro de custo.' },
          { q: 'Empresa com DRE positiva e caixa negativo está:', a: ['Impossível de ocorrer', 'Rentável, mas com descasamento de prazos', 'Prejuízo contábil', 'Sem vendas'], r: 1, e: 'Competência reconhece a receita antes do recebimento: rentabilidade e caixa são coisas distintas.' },
          { q: 'No pró-labore, a DRE gerencial deve:', a: ['Ignorar quando não pago', 'Registrar como custo do mês', 'Lançar como receita', 'Lançar como investimento'], r: 1, e: 'O trabalho do sócio é custo da empresa, pago ou não.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 14 - PONTO DE EQUILÍBRIO
  // ==========================================================
  {
    id: 'm14',
    title: 'Ponto de Equilíbrio e Margem de Contribuição',
    icon: '⚖️',
    theme: 'Financeiro',
    level: 'Avançado',
    summary: 'Quanto é preciso vender para não ter prejuízo e quanto cada produto contribui para o lucro.',
    lessons: [
      {
        id: 'm14a1',
        title: 'Margem de contribuição por produto',
        duration: 11,
        goal: 'Calcular a margem de contribuição unitária e identificar os produtos que sustentam o negócio.',
        blocks: [
          { t: 'formula', text: 'Margem de contribuição unitária = preço de venda - custo variável unitário' },
          { t: 'formula', text: 'Margem de contribuição (%) = margem de contribuição ÷ preço de venda x 100' },
          { t: 'p', text: 'Custo variável unitário inclui: custo da mercadoria, embalagem, frete de entrega, comissão, taxa de cartão e imposto sobre a venda. Não inclui aluguel nem salário fixo — esses são custos fixos.' },
          { t: 'h', text: 'Exemplo comparativo entre dois produtos' },
          { t: 'table', head: ['Item', 'Produto A', 'Produto B'], rows: [
            ['Preço de venda', 'R$ 200', 'R$ 90'],
            ['Custo da mercadoria', 'R$ 90', 'R$ 45'],
            ['Imposto (12%)', 'R$ 24', 'R$ 10,80'],
            ['Comissão (5%)', 'R$ 10', 'R$ 4,50'],
            ['Taxa de cartão (3%)', 'R$ 6', 'R$ 2,70'],
            ['Embalagem e entrega', 'R$ 8', 'R$ 5'],
            ['Margem de contribuição', 'R$ 62 (31%)', 'R$ 22 (24,4%)']
          ] },
          { t: 'p', text: 'Conclusão: para gerar o mesmo valor de contribuição, é preciso vender quase três unidades de B para cada unidade de A. Em promoção e em esforço de venda, o produto A merece prioridade.' },
          { t: 'steps', items: [
            'Escolha os 5 produtos mais vendidos no sistema',
            'Monte a tabela de margem de contribuição de cada um',
            'Ordene pela margem percentual e pela margem absoluta',
            'Ajuste preço ou esforço comercial nos produtos de menor contribuição'
          ] },
          { t: 'tip', text: 'Produto de margem baixa tem função: atrair cliente e gerar giro. Mas ele precisa ser conhecido — e não pode dominar o mix sem que você saiba.' }
        ],
        quiz: [
          { q: 'A margem de contribuição unitária é:', a: ['Preço menos custo fixo', 'Preço de venda menos custo variável unitário', 'Lucro líquido dividido pelas unidades', 'Preço vezes a margem alvo'], r: 1, e: 'Ela mede quanto cada unidade contribui para pagar custos fixos e gerar lucro.' },
          { q: 'Aluguel entra no cálculo da margem de contribuição?', a: ['Sim, rateado por unidade', 'Não, é custo fixo', 'Somente em serviços', 'Somente no varejo'], r: 1, e: 'Custos fixos não variam com a unidade vendida e ficam fora do cálculo.' },
          { q: 'Produto A com MC de R$ 62 e produto B com MC de R$ 22 exigem, para a mesma contribuição total:', a: ['Igual quantidade vendida', 'Quase 3 unidades de B para cada unidade de A', 'Mais unidades de A', 'Nenhuma relação'], r: 1, e: '62 ÷ 22 ≈ 2,8 unidades de B para cada unidade de A.' }
        ]
      },
      {
        id: 'm14a2',
        title: 'Ponto de equilíbrio contábil, econômico e financeiro',
        duration: 12,
        goal: 'Calcular o faturamento mínimo de sobrevivência e a meta de vendas do mês.',
        blocks: [
          { t: 'formula', text: 'PE contábil (em receita) = despesas fixas ÷ margem de contribuição percentual' },
          { t: 'formula', text: 'PE em unidades = despesas fixas ÷ margem de contribuição unitária' },
          { t: 'h', text: 'Exemplo' },
          { t: 'table', head: ['Item', 'Valor'], rows: [
            ['Despesas fixas mensais', 'R$ 52.000'],
            ['Margem de contribuição média', '32%'],
            ['Ponto de equilíbrio em receita', 'R$ 162.500'],
            ['Ticket médio', 'R$ 650'],
            ['Vendas necessárias por mês', '250 vendas'],
            ['Vendas necessárias por dia útil', '11,4 vendas']
          ] },
          { t: 'p', text: 'Abaixo de R$ 162.500 de receita, a empresa tem prejuízo. Esse número é a meta mínima de todo mês — e deve ser desdobrado por vendedor, canal e semana.' },
          { t: 'h', text: 'Os três pontos de equilíbrio' },
          { t: 'table', head: ['Tipo', 'Inclui', 'Uso'], rows: [
            ['Contábil', 'Despesas fixas operacionais', 'Meta mínima de sobrevivência'],
            ['Econômico', 'Fixas + retorno mínimo sobre o capital investido', 'Meta de rentabilidade do sócio'],
            ['Financeiro', 'Fixas menos despesas não desembolsáveis (ex.: depreciação)', 'Caixa mínimo a gerar no mês']
          ] },
          { t: 'h', text: 'Como reduzir o ponto de equilíbrio' },
          { t: 'list', items: [
            'Aumentar a margem de contribuição: preço melhor ou custo menor',
            'Reduzir despesas fixas: renegociar contratos e cortar o que não gera receita',
            'Mudar o mix para produtos de maior contribuição',
            'Transformar custo fixo em variável: comissão no lugar de salário fixo, terceirização de picos'
          ] },
          { t: 'warn', text: 'Reduzir o ponto de equilíbrio é mais seguro do que aumentar a meta de vendas: a primeira depende de você, a segunda depende do mercado.' },
          { t: 'steps', items: [
            'Some as despesas fixas do último mês no módulo Despesas',
            'Calcule a margem de contribuição média ponderada pelo mix de vendas',
            'Calcule o ponto de equilíbrio em receita e em número de vendas',
            'Compare com a receita do mês e defina a meta do próximo mês'
          ] }
        ],
        quiz: [
          { q: 'Despesas fixas de R$ 52.000 e margem de contribuição de 32% geram ponto de equilíbrio de:', a: ['R$ 162.500', 'R$ 52.000', 'R$ 320.000', 'R$ 16.640'], r: 0, e: '52.000 ÷ 0,32 = R$ 162.500.' },
          { q: 'O ponto de equilíbrio econômico inclui:', a: ['Somente despesas fixas', 'Despesas fixas mais retorno mínimo sobre o capital investido', 'Somente custos variáveis', 'Somente impostos'], r: 1, e: 'É a meta de rentabilidade do sócio, acima da sobrevivência.' },
          { q: 'Transformar custo fixo em variável ajuda a:', a: ['Aumentar o ponto de equilíbrio', 'Reduzir o ponto de equilíbrio', 'Aumentar despesas fixas', 'Reduzir a margem'], r: 1, e: 'Menos estrutura fixa significa menos receita necessária para empatar.' }
        ]
      }
    ]
  }
];
