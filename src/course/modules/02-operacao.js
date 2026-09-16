// Módulos 5 a 8 - Precificação, Estoque, Compras e Vendas
module.exports = [

  // ==========================================================
  // MÓDULO 5 - PRODUTOS E PRECIFICAÇÃO
  // ==========================================================
  {
    id: 'm5',
    title: 'Produtos e Precificação',
    icon: '🏷️',
    theme: 'Operação',
    level: 'Intermediário',
    summary: 'Custo real, markup, margem, preço de venda e formação de preço por produto e por serviço.',
    lessons: [
      {
        id: 'm5a1',
        title: 'O custo real do produto: muito além da nota do fornecedor',
        duration: 11,
        goal: 'Calcular o custo unitário completo de um produto, incluindo frete, embalagem e perdas.',
        blocks: [
          { t: 'p', text: 'O cadastro de produtos do ERP guarda preço de custo e preço de venda por unidade, além de SKU, categoria, estoque atual, estoque mínimo e unidade de medida. A qualidade do preço de venda começa na qualidade do preço de custo — e o erro mais comum é usar apenas o valor da nota do fornecedor.' },
          { t: 'h', text: 'Componentes do custo unitário' },
          { t: 'table', head: ['Componente', 'Descrição', 'Exemplo (camiseta)'], rows: [
            ['Custo da mercadoria', 'Valor unitário na nota do fornecedor', 'R$ 22,00'],
            ['Frete de entrada', 'Frete rateado pela quantidade comprada', 'R$ 1,20'],
            ['Embalagem', 'Saco, etiqueta, sacola, fita', 'R$ 1,50'],
            ['Perda prevista', '% de quebra, defeito ou obsolescência', 'R$ 0,70 (3%)'],
            ['Custo unitário total', 'Soma dos componentes', 'R$ 25,40']
          ] },
          { t: 'formula', text: 'Frete rateado por unidade = Frete total da compra ÷ quantidade total de unidades' },
          { t: 'formula', text: 'Custo unitário = Mercadoria + Frete rateado + Embalagem + Perda prevista' },
          { t: 'warn', text: 'Frete e embalagem esquecidos podem consumir de 5 a 15 pontos de margem. Em produtos de baixo valor, isso costuma ser a diferença entre lucro e prejuízo.' },
          { t: 'h', text: 'Custo médio ponderado' },
          { t: 'p', text: 'Quando você compra o mesmo produto em lotes com preços diferentes, o custo válido é a média ponderada dos lotes em estoque, não o preço do último lote. O ERP calcula essa média quando as compras dão entrada automática no estoque.' },
          { t: 'formula', text: 'Custo médio = (Saldo em unidades x custo anterior + Novo lote x custo do lote) ÷ Saldo total em unidades' },
          { t: 'steps', items: [
            'Abra Produtos e escolha o item mais vendido da sua empresa',
            'Confira o preço de custo cadastrado e compare com a última nota do fornecedor',
            'Some frete rateado e embalagem e atualize o campo de custo',
            'Registre no cadastro a data da última atualização de custo'
          ] }
        ],
        quiz: [
          { q: 'O custo unitário real de um produto inclui:', a: ['Apenas o valor da nota do fornecedor', 'Mercadoria, frete de entrada, embalagem e perdas previstas', 'Somente mercadoria e embalagem', 'Apenas mercadoria e frete de saída'], r: 1, e: 'Todos os gastos para colocar o produto em condição de venda compõem o custo.' },
          { q: 'Compra de 500 unidades com frete de R$ 600 gera frete rateado de:', a: ['R$ 6,00 por unidade', 'R$ 1,20 por unidade', 'R$ 0,60 por unidade', 'R$ 12,00 por unidade'], r: 1, e: '600 ÷ 500 = R$ 1,20 por unidade.' },
          { q: 'Ao comprar um novo lote por preço maior, o custo de referência do estoque passa a ser:', a: ['O preço do último lote', 'O custo médio ponderado dos lotes', 'O preço do primeiro lote', 'O preço de venda'], r: 1, e: 'O custo médio ponderado é o critério contábil e gerencial correto para estoques.' }
        ]
      },
      {
        id: 'm5a2',
        title: 'Markup e margem: a diferença que destrói preços',
        duration: 12,
        goal: 'Calcular preço a partir de markup e a partir de margem alvo, entendendo por que os dois não são a mesma coisa.',
        blocks: [
          { t: 'p', text: 'Markup é um multiplicador aplicado sobre o custo. Margem é o percentual do preço de venda que sobra. Confundir os dois é a causa mais comum de preço errado em PME.' },
          { t: 'table', head: ['Conceito', 'Base de cálculo', 'Fórmula'], rows: [
            ['Markup', 'Custo', 'Preço = Custo x Markup'],
            ['Margem bruta', 'Preço de venda', 'Margem = (Preço - Custo) ÷ Preço x 100']
          ] },
          { t: 'h', text: 'Exemplo que prova a diferença' },
          { t: 'p', text: 'Produto com custo de R$ 100. Aplicando markup de 1,8, o preço fica R$ 180 e a margem bruta é de 44,4%. Agora suponha que você queira 80% de margem: o preço correto não é R$ 180, e sim R$ 500 (100 ÷ 0,20). Um erro de leitura aqui custa centenas de reais por venda.' },
          { t: 'formula', text: 'Preço por margem alvo = Custo ÷ (1 - margem desejada)' },
          { t: 'h', text: 'Markup divisor: a fórmula que considera impostos, comissão e despesa' },
          { t: 'p', text: 'Para formar preço de verdade é preciso descontar do preço tudo que sai percentualmente da venda: imposto, comissão, taxa do cartão e percentual de despesas fixas. Isso é feito com o markup divisor.' },
          { t: 'formula', text: 'Markup divisor = 100 ÷ (100 - imposto% - comissão% - taxa cartão% - despesa fixa% - margem alvo%)' },
          { t: 'p', text: 'Exemplo: imposto 12%, comissão 5%, taxa de cartão 3%, rateio de despesa fixa 15%, margem alvo 20%. Soma dos percentuais = 55%. Markup divisor = 100 ÷ 45 = 2,222. Um produto com custo de R$ 100 deve ser vendido por R$ 222,20.' },
          { t: 'warn', text: 'Nunca forme preço copiando o concorrente sem conhecer o próprio custo. O concorrente pode ter escala, estoque velho ou estar operando no prejuízo.' },
          { t: 'steps', items: [
            'Escolha 5 produtos do sistema e anote custo e preço de venda',
            'Calcule a margem bruta atual de cada um: (preço - custo) ÷ preço',
            'Defina a margem alvo do negócio (por exemplo 30%)',
            'Recalcule o preço com o markup divisor usando seus percentuais reais',
            'Atualize o preço de venda no cadastro dos produtos'
          ] }
        ],
        quiz: [
          { q: 'Custo R$ 100 e markup 1,8 resultam em preço e margem de:', a: ['R$ 180 e 44,4%', 'R$ 180 e 80%', 'R$ 280 e 64%', 'R$ 180 e 18%'], r: 0, e: 'Preço 180; margem = (180-100)/180 = 44,4%.' },
          { q: 'Para ter 80% de margem sobre custo de R$ 100, o preço deve ser:', a: ['R$ 180', 'R$ 500', 'R$ 800', 'R$ 200'], r: 1, e: '100 ÷ (1 - 0,80) = R$ 500.' },
          { q: 'Com imposto 12%, comissão 5%, taxa 3%, despesa fixa 15% e margem alvo 20%, o markup divisor é:', a: ['1,55', '2,222', '0,45', '5,5'], r: 1, e: '100 ÷ (100 - 55) = 2,222.' }
        ]
      },
      {
        id: 'm5a3',
        title: 'Preço de serviço, hora produtiva e capacidade',
        duration: 10,
        goal: 'Precificar serviços por hora produtiva, considerando capacidade real e taxa de ocupação.',
        blocks: [
          { t: 'p', text: 'Serviço não tem nota de fornecedor, mas tem custo: a hora do profissional. Precificar serviço exige calcular quanto custa a hora disponível e quantas horas do mês são realmente vendáveis.' },
          { t: 'formula', text: 'Custo da hora disponível = (Custo mensal total da estrutura) ÷ (horas disponíveis no mês)' },
          { t: 'formula', text: 'Preço da hora = Custo da hora ÷ taxa de ocupação alvo + margem' },
          { t: 'h', text: 'Exemplo para uma equipe de 2 profissionais' },
          { t: 'table', head: ['Item', 'Valor'], rows: [
            ['Custo mensal (salários + encargos + aluguel + sistemas)', 'R$ 25.000'],
            ['Horas disponíveis (2 x 8h x 22 dias)', '352 horas'],
            ['Custo da hora disponível', 'R$ 71,02'],
            ['Taxa de ocupação alvo', '70% (246 horas vendáveis)'],
            ['Custo da hora vendável', 'R$ 101,46'],
            ['Margem alvo de 40%', 'Preço da hora = R$ 169,10']
          ] },
          { t: 'warn', text: 'Taxa de ocupação acima de 85% de forma sustentada é sinal de falta de capacidade: você perde prazo, qualidade e clientes. Ajuste preço antes de contratar.' },
          { t: 'list', items: [
            'Separe hora produtiva de hora administrativa: reunião e treinamento não são vendáveis',
            'Cobre deslocamento e material à parte, ou inclua no preço com percentual claro',
            'Use o campo de observações do cadastro de clientes para registrar o valor da hora contratada',
            'Registre cada serviço como produto no ERP, com custo e preço, para manter margem visível na DRE'
          ] },
          { t: 'steps', items: [
            'Cadastre seus serviços como produtos no módulo Produtos (unidade = hora ou serviço)',
            'Informe o custo calculado da hora e o preço praticado',
            'Ao vender, registre o serviço em Vendas normalmente, com cliente e forma de pagamento'
          ] }
        ],
        quiz: [
          { q: 'Custo mensal de R$ 25.000 com 352 horas disponíveis gera custo da hora de:', a: ['R$ 71,02', 'R$ 25,00', 'R$ 101,46', 'R$ 169,10'], r: 0, e: '25.000 ÷ 352 = R$ 71,02 por hora disponível.' },
          { q: 'A taxa de ocupação existe para:', a: ['Medir satisfação do cliente', 'Descontar as horas que não são vendáveis do custo da hora', 'Calcular imposto', 'Definir a jornada de trabalho'], r: 1, e: 'Ela distribui o custo total apenas sobre as horas que geram receita.' },
          { q: 'Ocupação sustentada acima de 85% indica:', a: ['Excesso de capacidade', 'Falta de capacidade e risco de perda de qualidade', 'Preço baixo', 'Alta margem'], r: 1, e: 'Acima desse patamar a operação perde fôlego e a qualidade cai.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 6 - ESTOQUE
  // ==========================================================
  {
    id: 'm6',
    title: 'Controle de Estoque',
    icon: '📦',
    theme: 'Operação',
    level: 'Intermediário',
    summary: 'SKU, estoque mínimo, giro, curva ABC e o custo de manter mercadoria parada.',
    lessons: [
      {
        id: 'm6a1',
        title: 'SKU e organização do cadastro de produtos',
        duration: 9,
        goal: 'Criar um padrão de SKU que evita erro de separação e facilita a contagem.',
        blocks: [
          { t: 'p', text: 'O campo SKU é único no sistema e é a chave de identificação do produto em vendas, compras e contagens. SKU bem construído é lido pelo humano e evita a venda do item errado.' },
          { t: 'h', text: 'Estrutura recomendada de SKU' },
          { t: 'formula', text: 'SKU = CATEGORIA + SUBGRUPO + ATRIBUTO + TAMANHO/COR' },
          { t: 'table', head: ['Produto', 'SKU sugerido'], rows: [
            ['Camiseta preta P', 'CAM-PRE-P'],
            ['Notebook 15 polegadas i7', 'ELE-NOT-15-I7'],
            ['Cadeira de escritório preta', 'MOV-CAD-PRE']
          ] },
          { t: 'list', items: [
            'Use letras maiúsculas, números e hífen; evite espaços e acentos',
            'Mantenha tamanho fixo por categoria para facilitar leitura',
            'Nunca reaproveite SKU de produto descontinuado',
            'Não coloque preço nem fornecedor no SKU: isso muda e o código fica obsoleto',
            'Cadastre a categoria: ela alimenta a análise de despesas e de mix de produtos'
          ] },
          { t: 'h', text: 'Unidade de medida' },
          { t: 'p', text: 'O campo unidade (UN, CX, KG, M, HORA) define como o estoque é contado e como a venda é lançada. Vender caixa e contar unidade é a causa clássica de diferença de inventário.' },
          { t: 'steps', items: [
            'Abra Produtos e revise os SKUs existentes',
            'Padronize os 10 produtos mais vendidos no formato sugerido',
            'Confirme a unidade de medida de cada um',
            'Preencha a categoria em todos os produtos: relatórios dependem dela'
          ] }
        ],
        quiz: [
          { q: 'Uma boa prática de SKU é:', a: ['Incluir o preço de venda', 'Incluir categoria, subgrupo e atributos, em tamanho fixo', 'Usar o nome do fornecedor', 'Reaproveitar códigos antigos'], r: 1, e: 'SKU deve ser estável: preço e fornecedor mudam, código não pode mudar.' },
          { q: 'O campo unidade de medida serve para:', a: ['Calcular imposto', 'Definir como o estoque é contado e como a venda é lançada', 'Definir o SKU', 'Definir a margem'], r: 1, e: 'Unidade coerente entre venda, compra e contagem evita divergência de inventário.' },
          { q: 'SKU é um campo:', a: ['Opcional e duplicável', 'Único no sistema', 'Numérico obrigatório', 'Gerado automaticamente sempre'], r: 1, e: 'No banco, o campo sku é declarado como UNIQUE.' }
        ]
      },
      {
        id: 'm6a2',
        title: 'Estoque mínimo, ponto de pedido e lead time',
        duration: 11,
        goal: 'Calcular estoque mínimo e ponto de pedido com base em consumo e prazo do fornecedor.',
        blocks: [
          { t: 'p', text: 'O campo min_stock do produto dispara o alerta de estoque baixo no dashboard. O valor não pode ser um chute: ele precisa cobrir o consumo durante o prazo de entrega do fornecedor mais uma folga de segurança.' },
          { t: 'formula', text: 'Consumo diário = vendas médias mensais ÷ 30' },
          { t: 'formula', text: 'Estoque de segurança = consumo diário x dias de folga' },
          { t: 'formula', text: 'Ponto de pedido = (consumo diário x lead time em dias) + estoque de segurança' },
          { t: 'h', text: 'Exemplo' },
          { t: 'table', head: ['Item', 'Valor'], rows: [
            ['Venda média mensal', '300 unidades'],
            ['Consumo diário', '10 unidades/dia'],
            ['Lead time do fornecedor', '12 dias'],
            ['Folga de segurança', '5 dias'],
            ['Estoque de segurança', '50 unidades'],
            ['Ponto de pedido', '(10 x 12) + 50 = 170 unidades'],
            ['Estoque mínimo cadastrado no ERP', '50 unidades (segurança)']
          ] },
          { t: 'warn', text: 'Cadastrar como estoque mínimo o ponto de pedido inteiro gera compra excessiva e dinheiro parado. Cadastre a segurança no campo min_stock e trate o ponto de pedido como gatilho de compra.' },
          { t: 'steps', items: [
            'Liste os 10 produtos mais vendidos e calcule o consumo diário de cada um',
            'Levante o lead time de cada fornecedor no cadastro de fornecedores',
            'Calcule estoque de segurança e ponto de pedido',
            'Atualize o campo de estoque mínimo no cadastro dos produtos',
            'Acompanhe por 30 dias se os alertas do dashboard aparecem no momento certo'
          ] },
          { t: 'tip', text: 'Fornecedor com lead time instável exige folga maior. Estabilidade de prazo vale mais que preço baixo quando o assunto é ruptura de estoque.' }
        ],
        quiz: [
          { q: 'Venda média de 300 unidades/mês gera consumo diário de:', a: ['30 unidades', '10 unidades', '100 unidades', '3 unidades'], r: 1, e: '300 ÷ 30 = 10 unidades por dia.' },
          { q: 'Com consumo de 10/dia, lead time de 12 dias e segurança de 50 unidades, o ponto de pedido é:', a: ['120', '170', '50', '220'], r: 1, e: '(10 x 12) + 50 = 170 unidades.' },
          { q: 'O campo estoque mínimo do ERP deve receber:', a: ['O ponto de pedido', 'O estoque de segurança', 'O estoque máximo', 'A venda média mensal'], r: 1, e: 'O campo dispara alerta de reposição; o gatilho de compra é o ponto de pedido.' }
        ]
      },
      {
        id: 'm6a3',
        title: 'Giro de estoque, curva ABC e dinheiro parado',
        duration: 11,
        goal: 'Medir giro e cobertura, identificar produtos encalhados e liberar caixa.',
        blocks: [
          { t: 'formula', text: 'Giro de estoque = Custo das mercadorias vendidas ÷ Estoque médio a custo' },
          { t: 'formula', text: 'Cobertura (dias) = 365 ÷ giro' },
          { t: 'p', text: 'Giro 6 significa que o estoque se renova 6 vezes por ano, ou seja, cobertura de cerca de 61 dias. Quanto maior o giro, menos capital imobilizado e menor o risco de obsolescência.' },
          { t: 'h', text: 'Curva ABC de produtos' },
          { t: 'table', head: ['Classe', 'Participação na receita', 'Gestão'], rows: [
            ['A', '~80%', 'Reposição frequente, nunca pode faltar, negociação agressiva'],
            ['B', '~15%', 'Reposição programada, revisão trimestral'],
            ['C', '~5%', 'Compra sob demanda, avaliar descontinuação']
          ] },
          { t: 'h', text: 'O custo de manter estoque' },
          { t: 'list', items: [
            'Custo do capital empatado (o dinheiro parado deixa de render ou custa juros)',
            'Espaço físico, prateleira e climatização',
            'Perda por validade, quebra e obsolescência',
            'Custo administrativo de contagem e controle',
            'Referência de mercado: manter estoque custa de 20% a 30% do valor do estoque por ano'
          ] },
          { t: 'h', text: 'Plano para produtos encalhados' },
          { t: 'steps', items: [
            'Liste produtos sem venda nos últimos 90 dias (histórico de Vendas)',
            'Calcule o valor parado: quantidade x custo',
            'Classifique: promoção, kit com produto A, venda em lote para outro lojista ou baixa contábil',
            'Defina data limite e execute — dinheiro parado vale menos que margem perdida'
          ] },
          { t: 'tip', text: 'Meta saudável para comércio varejista: giro entre 6 e 12 por ano. Abaixo de 4, há capital excessivo em mercadoria.' }
        ],
        quiz: [
          { q: 'Giro de estoque igual a 6 por ano representa cobertura aproximada de:', a: ['61 dias', '6 dias', '365 dias', '180 dias'], r: 0, e: '365 ÷ 6 ≈ 61 dias de cobertura.' },
          { q: 'Produtos classe C da curva ABC normalmente devem ser:', a: ['Comprados em grande volume', 'Comprados sob demanda ou descontinuados', 'Priorizados na reposição', 'Excluídos do cadastro sem análise'], r: 1, e: 'Classe C tem baixa participação na receita e não justifica estoque permanente.' },
          { q: 'Manter estoque custa, em média por ano:', a: ['2% a 5% do valor do estoque', '20% a 30% do valor do estoque', 'Nada, é ativo', '50% a 60%'], r: 1, e: 'Capital, espaço, perdas e administração consomem de 20% a 30% ao ano.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 7 - COMPRAS
  // ==========================================================
  {
    id: 'm7',
    title: 'Compras e Suprimentos',
    icon: '🛍️',
    theme: 'Operação',
    level: 'Intermediário',
    summary: 'Registro de compras multi-itens, entrada automática no estoque e contas a pagar de fornecedor.',
    lessons: [
      {
        id: 'm7a1',
        title: 'Registrando uma compra no ERP',
        duration: 10,
        goal: 'Lançar uma compra com múltiplos itens, fornecedor, forma de pagamento e entrada no estoque.',
        blocks: [
          { t: 'p', text: 'O módulo de Compras registra a operação de aquisição: fornecedor, número, data, itens com quantidade e preço unitário, total, forma de pagamento e status. Ao salvar, os itens dão entrada automática no estoque dos produtos cadastrados.' },
          { t: 'h', text: 'Passo a passo' },
          { t: 'steps', items: [
            'Abra Compras e clique em Nova Compra',
            'Selecione o fornecedor cadastrado',
            'Adicione os itens: escolha o produto, informe quantidade e preço unitário de custo',
            'Confira o total calculado automaticamente',
            'Informe a forma de pagamento (PIX, boleto, cartão ou dinheiro) e o status',
            'Salve e confirme no módulo Produtos se o estoque aumentou na quantidade certa'
          ] },
          { t: 'table', head: ['Campo', 'Boa prática'], rows: [
            ['Número da compra', 'Use o número da nota fiscal do fornecedor'],
            ['Data', 'Data de emissão da nota, não a data do pagamento'],
            ['Preço unitário', 'Custo líquido sem IPI não recuperável, se aplicável'],
            ['Status', 'pending até a mercadoria chegar; paid quando liquidado'],
            ['Observações', 'Condição de pagamento e prazo combinado']
          ] },
          { t: 'warn', text: 'Compra não registrada significa estoque errado, custo de venda errado e DRE errada. Lançamento no mesmo dia é regra, não exceção.' },
          { t: 'tip', text: 'Confira sempre a nota física contra os itens lançados. Erro de quantidade na compra vira diferença de inventário que ninguém explica meses depois.' }
        ],
        quiz: [
          { q: 'Ao salvar uma compra no ERP, o que acontece com o estoque?', a: ['Nada, é preciso lançar manualmente', 'Os itens dão entrada automática nos produtos', 'O estoque é zerado', 'Apenas o produto principal é atualizado'], r: 1, e: 'O módulo de compras dá entrada automática dos itens no estoque.' },
          { q: 'No campo número da compra, o ideal é usar:', a: ['Um número sequencial interno aleatório', 'O número da nota fiscal do fornecedor', 'O CPF do comprador', 'O código do produto'], r: 1, e: 'Vincular à nota fiscal facilita conferência e conciliação fiscal.' },
          { q: 'Uma compra não lançada no sistema provoca:', a: ['Somente atraso de relatório', 'Estoque, custo e DRE incorretos', 'Aumento de margem', 'Nenhum efeito'], r: 1, e: 'Todos os indicadores derivados de estoque e custo ficam distorcidos.' }
        ]
      },
      {
        id: 'm7a2',
        title: 'Planejamento de compras e ciclo de reposição',
        duration: 10,
        goal: 'Montar uma rotina de reposição baseada em ponto de pedido e capacidade de pagamento.',
        blocks: [
          { t: 'p', text: 'Comprar bem não é comprar barato: é comprar a quantidade certa, no momento certo, com prazo que caiba no caixa. O planejamento de compras liga o alerta de estoque ao fluxo de caixa previsto.' },
          { t: 'h', text: 'Rotina semanal de compras' },
          { t: 'steps', items: [
            'Segunda: abra o dashboard e liste os produtos em alerta de estoque baixo',
            'Calcule a quantidade a comprar: consumo dos próximos 30 dias + segurança - estoque atual',
            'Confira no módulo Financeiro (Contas a Pagar) se há caixa previsto para a compra',
            'Peça cotação a pelo menos dois fornecedores homologados',
            'Registre a compra no sistema assim que o pedido for confirmado',
            'Sexta: revise as entregas pendentes e cobre os atrasos'
          ] },
          { t: 'formula', text: 'Quantidade a comprar = (consumo diário x dias de cobertura desejados) + segurança - estoque atual' },
          { t: 'h', text: 'Erros que custam caro' },
          { t: 'list', items: [
            'Comprar por impulso de desconto e travar caixa por meses',
            'Comprar sem conferir contas a pagar com vencimento na mesma semana',
            'Concentrar tudo em um fornecedor sem homologar alternativa',
            'Não registrar a compra no mesmo dia'
          ] },
          { t: 'tip', text: 'Desconto de 5% à vista só compensa se você tiver o caixa sobrando. Se precisar de capital de giro a 3% ao mês, o desconto de 5% em uma compra que trava 60 dias pode ser pior que o prazo.' }
        ],
        quiz: [
          { q: 'A quantidade a comprar é calculada por:', a: ['Estoque máximo menos estoque atual', 'Consumo do período mais segurança menos estoque atual', 'Venda do mês anterior', 'Metade do estoque atual'], r: 1, e: 'A fórmula cobre a demanda futura, mantém segurança e desconta o que já existe.' },
          { q: 'Antes de fechar uma compra, é obrigatório conferir:', a: ['O preço do concorrente', 'As contas a pagar com vencimento no período', 'O cadastro de clientes', 'O contrato de aluguel'], r: 1, e: 'Compra sem olhar o caixa previsto é a principal causa de aperto financeiro.' },
          { q: 'Comprar com 5% de desconto à vista sempre compensa?', a: ['Sim, sempre', 'Não: depende do custo do capital de giro que seria usado', 'Só em dezembro', 'Somente acima de R$ 10.000'], r: 1, e: 'Se o dinheiro vier de capital de giro caro, o desconto pode não compensar a perda de prazo.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 8 - VENDAS
  // ==========================================================
  {
    id: 'm8',
    title: 'Vendas na Prática',
    icon: '🛒',
    theme: 'Operação',
    level: 'Intermediário',
    summary: 'Venda multi-itens, descontos, formas de pagamento, baixa de estoque e vínculo com o financeiro.',
    lessons: [
      {
        id: 'm8a1',
        title: 'Registrando uma venda completa',
        duration: 11,
        goal: 'Lançar vendas com cliente, múltiplos itens, desconto e forma de pagamento.',
        blocks: [
          { t: 'p', text: 'O módulo de Vendas é o coração do sistema: é dele que saem a receita do dashboard, o ticket médio, a baixa de estoque e a origem das contas a receber.' },
          { t: 'steps', items: [
            'Abra Vendas e clique em Nova Venda',
            'Selecione o cliente (se for venda avulsa, deixe sem cliente, mas prefira sempre identificar)',
            'Adicione os itens: produto, quantidade e preço unitário',
            'Aplique desconto se houver, em valor absoluto',
            'Escolha a forma de pagamento: PIX, cartão, dinheiro ou boleto',
            'Defina o status: pendente ou paga',
            'Salve e confira o número da venda gerado'
          ] },
          { t: 'table', head: ['Forma de pagamento', 'Impacto financeiro'], rows: [
            ['PIX / Dinheiro', 'Entra no caixa imediatamente, sem taxa relevante'],
            ['Cartão de crédito à vista', 'Recebimento em D+30 com taxa de 2% a 5%'],
            ['Cartão parcelado', 'Recebimento em parcelas mensais, taxa maior'],
            ['Boleto', 'Recebimento na data de vencimento, exige controle de contas a receber']
          ] },
          { t: 'h', text: 'O que o sistema faz automaticamente' },
          { t: 'list', items: [
            'Calcula o total dos itens e aplica o desconto',
            'Dá baixa na quantidade vendida no estoque dos produtos',
            'Alimenta receita do mês, ticket médio e margem no dashboard',
            'Registra o histórico de compras do cliente'
          ] },
          { t: 'warn', text: 'Venda a prazo sem gerar conta a receber é dinheiro perdido. Toda venda com pagamento futuro precisa ter o título correspondente em Contas a Receber (módulo 9).' }
        ],
        quiz: [
          { q: 'Ao salvar uma venda, o sistema automaticamente:', a: ['Emite nota fiscal', 'Calcula total, aplica desconto e dá baixa no estoque', 'Gera boleto bancário', 'Envia e-mail ao contador'], r: 1, e: 'Cálculo, desconto e baixa de estoque são automáticos no lançamento da venda.' },
          { q: 'Venda no cartão de crédito à vista normalmente:', a: ['Entra no caixa no mesmo dia sem taxa', 'É recebida em D+30 com taxa de 2% a 5%', 'Entra em 12 parcelas', 'Não tem custo'], r: 1, e: 'Cartão tem prazo de liquidação e taxa de antecipação/desconto.' },
          { q: 'Venda a prazo deve gerar obrigatoriamente:', a: ['Uma despesa', 'Uma conta a receber com vencimento', 'Uma compra', 'Uma nota de fornecedor'], r: 1, e: 'Sem o título em contas a receber, o recebível não é controlado nem cobrado.' }
        ]
      },
      {
        id: 'm8a2',
        title: 'Política de desconto sem destruir a margem',
        duration: 11,
        goal: 'Definir limites de desconto por margem e treinar a troca de desconto por condição de pagamento.',
        blocks: [
          { t: 'p', text: 'Desconto é a decisão mais rápida e mais destrutiva da operação. Um desconto de 5% sobre o preço, em um produto com margem de 25%, consome 20% do lucro daquela venda.' },
          { t: 'formula', text: 'Impacto do desconto no lucro = desconto % ÷ margem % ' },
          { t: 'h', text: 'Exemplo' },
          { t: 'table', head: ['Margem do produto', 'Desconto dado', 'Redução do lucro da venda'], rows: [
            ['40%', '5%', '12,5%'],
            ['25%', '5%', '20%'],
            ['15%', '5%', '33,3%'],
            ['10%', '5%', '50%']
          ] },
          { t: 'h', text: 'Política de desconto recomendada' },
          { t: 'checklist', items: [
            'Faixa 1: até 3% liberado para o vendedor, sem aprovação',
            'Faixa 2: de 3% a 7% com aprovação do gestor',
            'Faixa 3: acima de 7% somente para pedido acima do ticket médio dobrado ou pagamento à vista',
            'Proibido: desconto em produto classe A com estoque baixo',
            'Registrar sempre o motivo do desconto no campo de observações da venda'
          ] },
          { t: 'h', text: 'Troque desconto por condição' },
          { t: 'list', items: [
            'Pagamento à vista em PIX no lugar de desconto no boleto',
            'Volume maior no mesmo pedido no lugar de desconto unitário',
            'Prazo de retirada maior no lugar de redução de preço',
            'Brinde ou serviço agregado de custo baixo no lugar de desconto direto'
          ] },
          { t: 'steps', items: [
            'Abra Vendas e liste as vendas dos últimos 30 dias com desconto',
            'Calcule a margem de cada uma e identifique as que ficaram abaixo da margem alvo',
            'Escreva a política de desconto em três faixas e comunique a equipe',
            'Registre o motivo do desconto nas próximas vendas e revise no fim do mês'
          ] },
          { t: 'tip', text: 'Vendedor que precisa de desconto para vender não tem problema de preço: tem problema de argumento de valor. Desconto deve ser exceção registrada, não regra invisível.' }
        ],
        quiz: [
          { q: 'Em um produto com margem de 25%, um desconto de 5% no preço reduz o lucro da venda em:', a: ['5%', '20%', '25%', '12,5%'], r: 1, e: '5 ÷ 25 = 20% do lucro da venda é consumido pelo desconto.' },
          { q: 'Na política de três faixas, descontos acima de 7% devem:', a: ['Ser liberados a qualquer vendedor', 'Exigir condição especial e aprovação', 'Ser proibidos sempre', 'Ser aplicados apenas em janeiro'], r: 1, e: 'A faixa 3 exige contrapartida clara e aprovação do gestor.' },
          { q: 'A melhor alternativa ao desconto direto costuma ser:', a: ['Aumentar o preço depois', 'Trocar por condição de pagamento, volume ou agregado de baixo custo', 'Reduzir o custo do produto', 'Deixar de vender'], r: 1, e: 'Preserva a margem e ainda melhora caixa, volume ou relacionamento.' }
        ]
      },
      {
        id: 'm8a3',
        title: 'Venda, emissão fiscal e conciliação diária',
        duration: 10,
        goal: 'Fechar o dia com vendas, caixa e estoque conciliados.',
        blocks: [
          { t: 'h', text: 'Fechamento diário em 7 passos' },
          { t: 'steps', items: [
            'Confira se todas as vendas do dia foram lançadas no sistema',
            'Compare o total vendido com o total recebido em cada forma de pagamento',
            'Verifique se houve desconto não autorizado',
            'Confirme a baixa de estoque dos produtos vendidos',
            'Gere as contas a receber das vendas a prazo do dia',
            'Lance as despesas pagas no dia (módulo 11)',
            'Anote o saldo final do caixa e compare com o fluxo de caixa do sistema'
          ] },
          { t: 'table', head: ['Divergência comum', 'Causa provável', 'Correção'], rows: [
            ['Caixa maior que o sistema', 'Venda não lançada', 'Lançar a venda com data correta'],
            ['Caixa menor que o sistema', 'Despesa não registrada ou desconto não lançado', 'Lançar despesa/ajustar venda'],
            ['Estoque maior que o físico', 'Baixa não efetuada ou venda cancelada', 'Ajustar por inventário'],
            ['Cliente cobrado duas vezes', 'Título duplicado em contas a receber', 'Excluir o título duplicado']
          ] },
          { t: 'warn', text: 'Divergência não resolvida no dia vira bola de neve. Cinco minutos de conferência diária evitam horas de auditoria no fim do mês.' },
          { t: 'tip', text: 'Mantenha um responsável nomeado pelo fechamento diário. Sem dono, o processo não acontece.' }
        ],
        quiz: [
          { q: 'Se o caixa físico está maior que o valor do sistema, a causa mais provável é:', a: ['Despesa não registrada', 'Venda não lançada', 'Estoque inflado', 'Cliente duplicado'], r: 1, e: 'Dinheiro entrou e não foi registrado como venda.' },
          { q: 'O fechamento diário deve incluir:', a: ['Apenas o total de vendas', 'Vendas, recebimentos, descontos, estoque, contas a receber e despesas', 'Somente o saldo do caixa', 'Somente o DRE mensal'], r: 1, e: 'A conciliação completa é o que garante confiabilidade dos indicadores.' },
          { q: 'Divergências devem ser tratadas:', a: ['No fechamento mensal', 'No mesmo dia, pelo responsável nomeado', 'Somente na auditoria anual', 'Nunca, são normais'], r: 1, e: 'Quanto mais cedo a correção, menor o retrabalho e o erro acumulado.' }
        ]
      }
    ]
  }
];
