// Módulos 15 a 18 - Indicadores, Rotina do Gestor, Plano de Negócios SaaS e Assinaturas
module.exports = [

  // ==========================================================
  // MÓDULO 15 - INDICADORES
  // ==========================================================
  {
    id: 'm15',
    title: 'Indicadores de Desempenho e Análise',
    icon: '📈',
    theme: 'Análise',
    level: 'Avançado',
    summary: 'Receita por cliente, mix, rentabilidade por canal e o painel mínimo de decisão.',
    lessons: [
      {
        id: 'm15a1',
        title: 'Construindo indicadores a partir dos dados do ERP',
        duration: 12,
        goal: 'Derivar indicadores gerenciais dos dados já registrados no sistema.',
        blocks: [
          { t: 'p', text: 'Todo indicador nasce de dados brutos que o ERP já guarda: vendas, itens vendidos, clientes, produtos, despesas, recebíveis e pagamentos. Aprender a derivar indicadores é o que separa quem tem sistema de quem tem planilha.' },
          { t: 'table', head: ['Indicador', 'Fórmula', 'Dados necessários'], rows: [
            ['Receita por cliente', 'Soma das vendas ÷ número de clientes ativos', 'Vendas + Clientes'],
            ['Receita por vendedor', 'Soma das vendas por responsável', 'Vendas + observações'],
            ['Margem por produto', '(preço - custo) ÷ preço', 'Produtos + Itens de venda'],
            ['Participação por categoria', 'Receita da categoria ÷ receita total', 'Produtos (categoria) + Vendas'],
            ['Clientes ativos', 'Clientes com compra nos últimos 90 dias', 'Vendas + Clientes'],
            ['Prazo médio de recebimento', 'Soma dos dias entre venda e recebimento ÷ número de títulos', 'Vendas + Contas a Receber'],
            ['Custo por venda', 'Despesas comerciais ÷ número de vendas', 'Despesas + Vendas']
          ] },
          { t: 'h', text: 'Cuidados na construção' },
          { t: 'list', items: [
            'Defina o período antes de calcular: mês, trimestre ou 12 meses',
            'Defina o que entra no denominador (clientes ativos não é igual a clientes cadastrados)',
            'Mantenha a fórmula documentada: indicador sem fórmula vira opinião',
            'Compare sempre com período equivalente anterior'
          ] },
          { t: 'warn', text: 'Indicador que ninguém usa para decidir é custo, não gestão. Limite o painel a no máximo 10 indicadores com dono e ação definida.' },
          { t: 'steps', items: [
            'Escolha 3 indicadores da tabela acima que fazem falta na sua gestão',
            'Calcule-os manualmente com os dados dos últimos 90 dias',
            'Documente a fórmula e a frequência de apuração',
            'Inclua-os na sua reunião semanal'
          ] }
        ],
        quiz: [
          { q: 'Clientes ativos normalmente são definidos como:', a: ['Todos os cadastrados', 'Clientes com compra nos últimos 90 dias', 'Clientes que pagaram à vista', 'Clientes com crédito liberado'], r: 1, e: 'Atividade é medida por compra recente, não por cadastro.' },
          { q: 'Um indicador sem fórmula documentada tende a:', a: ['Ser mais confiável', 'Virar opinião e gerar discussão improdutiva', 'Ser mais rápido', 'Não ter impacto'], r: 1, e: 'Sem definição clara, cada pessoa calcula de um jeito e a comparação perde sentido.' },
          { q: 'O tamanho ideal de um painel de indicadores é:', a: ['O maior possível', 'Até 10 indicadores com dono e ação definida', 'Apenas 1 indicador', 'Todos os que o sistema oferece'], r: 1, e: 'Painel extenso dilui a atenção e não gera decisão.' }
        ]
      },
      {
        id: 'm15a2',
        title: 'Rentabilidade por canal e por linha de produto',
        duration: 11,
        goal: 'Descobrir onde o lucro realmente é gerado: canal, produto e tipo de cliente.',
        blocks: [
          { t: 'p', text: 'Receita total esconde diferenças brutais de rentabilidade. Loja física, marketplace, delivery e venda direta têm custos variáveis e taxas muito diferentes.' },
          { t: 'table', head: ['Canal', 'Custos típicos', 'Margem esperada'], rows: [
            ['Loja física', 'Aluguel, equipe, ocupação', 'Média'],
            ['Marketplace', 'Comissão de 11% a 20% + frete subsidiado', 'Baixa a média'],
            ['Site próprio', 'Taxa de cartão + frete + mídia', 'Média a alta'],
            ['Venda direta/B2B', 'Comissão + prazo de recebimento longo', 'Média, com risco de capital'],
            ['Delivery', 'Taxa da plataforma + embalagem + entrega', 'Baixa']
          ] },
          { t: 'formula', text: 'Margem por canal = (receita do canal - custos variáveis do canal - custos diretos do canal) ÷ receita do canal' },
          { t: 'h', text: 'Como calcular no sistema' },
          { t: 'steps', items: [
            'Use a categoria do produto e a descrição da venda para identificar o canal',
            'Some a receita de cada canal no período',
            'Subtraia os custos variáveis e diretos de cada canal',
            'Calcule a margem percentual e compare entre canais',
            'Realoque esforço e investimento para os canais de maior margem, sem abandonar os que trazem cliente novo'
          ] },
          { t: 'warn', text: 'Canal de margem baixa pode ter função estratégica: volume, giro de estoque e aquisição de cliente. A decisão exige olhar margem e função juntos.' },
          { t: 'tip', text: 'Regra prática: nenhum canal deve operar com margem de contribuição negativa por mais de dois meses seguidos.' }
        ],
        quiz: [
          { q: 'Marketplaces normalmente apresentam margem menor por causa de:', a: ['Aluguel alto', 'Comissão da plataforma e custo de frete', 'Imposto maior', 'Estoque parado'], r: 1, e: 'Comissão de 11% a 20% mais custos de entrega comprimem a margem.' },
          { q: 'Um canal com margem de contribuição negativa deve:', a: ['Ser mantido indefinidamente', 'Ser revisto e corrigido em até dois meses', 'Ser expandido', 'Ter o preço reduzido'], r: 1, e: 'Cada venda adicional aumenta o prejuízo: exige correção rápida.' },
          { q: 'Canal de margem baixa pode ser mantido quando:', a: ['Nunca', 'Cumpre função estratégica como aquisição de cliente ou giro', 'Quando o concorrente usa', 'Quando não há alternativa'], r: 1, e: 'A decisão combina margem com função estratégica.' }
        ]
      },
      {
        id: 'm15a3',
        title: 'Metas, orçamento e acompanhamento semanal',
        duration: 10,
        goal: 'Transformar indicadores em metas mensais e acompanhar por semana.',
        blocks: [
          { t: 'h', text: 'Do indicador à meta' },
          { t: 'steps', items: [
            'Pegue o resultado dos últimos 12 meses como base',
            'Aplique a correção de inflação do período',
            'Defina a meta de crescimento realista (por exemplo 10% acima da inflação)',
            'Distribua a meta anual em 12 meses considerando a sazonalidade',
            'Quebre a meta mensal em semanas e em responsáveis'
          ] },
          { t: 'h', text: 'Painel semanal mínimo' },
          { t: 'table', head: ['Indicador', 'Meta', 'Realizado', 'Ação se abaixo da meta'], rows: [
            ['Receita da semana', 'R$ 45.000', '-', 'Campanha relâmpago e prospecção ativa'],
            ['Ticket médio', 'R$ 650', '-', 'Oferta combinada e upsell'],
            ['Recebimentos da semana', 'R$ 38.000', '-', 'Intensificar cobrança da carteira vencida'],
            ['Despesas da semana', 'R$ 12.000', '-', 'Congelar compras não críticas'],
            ['Novos clientes', '4', '-', 'Ação de indicação e parceria']
          ] },
          { t: 'formula', text: 'Atingimento (%) = realizado ÷ meta x 100   |   Desvio = realizado - meta' },
          { t: 'warn', text: 'Meta sem dono não acontece. Cada linha do painel precisa de uma pessoa responsável e uma ação definida para quando o resultado ficar abaixo do esperado.' },
          { t: 'tip', text: 'Reunião de 30 minutos toda segunda-feira, com o painel aberto no dashboard do ERP, vale mais que relatório mensal de 20 páginas.' }
        ],
        quiz: [
          { q: 'A meta anual deve ser distribuída nos meses considerando:', a: ['Divisão igual em 12 partes sempre', 'A sazonalidade do negócio', 'O número de funcionários', 'O valor do aluguel'], r: 1, e: 'Meses fortes e fracos exigem metas diferentes para serem realistas.' },
          { q: 'Cada indicador do painel semanal deve ter:', a: ['Somente o valor realizado', 'Responsável e ação definida para desvio', 'Duas casas decimais', 'Gráfico obrigatório'], r: 1, e: 'Sem dono e sem ação, o painel vira decoração.' },
          { q: 'Atingimento de 80% de uma meta significa:', a: ['Meta superada', 'Realizado abaixo da meta em 20%', 'Erro de cálculo', 'Meta alcançada'], r: 1, e: 'Atingimento = realizado ÷ meta; 80% indica desvio negativo de 20%.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 16 - ROTINA DO GESTOR
  // ==========================================================
  {
    id: 'm16',
    title: 'Rotina do Gestor Financeiro com o Dashboard',
    icon: '🗓️',
    theme: 'Análise',
    level: 'Intermediário',
    summary: 'Ritual diário, semanal e mensal usando o dashboard, alertas e relatórios do ERP.',
    lessons: [
      {
        id: 'm16a1',
        title: 'Ritual diário de 15 minutos',
        duration: 9,
        goal: 'Executar a rotina diária de conferência e decisão usando o dashboard.',
        blocks: [
          { t: 'h', text: 'Sequência diária' },
          { t: 'steps', items: [
            'Abra o Dashboard e leia os KPIs: receita, despesa, lucro e variação',
            'Verifique a lista de alertas: estoque baixo e contas vencidas',
            'Abra Contas a Receber e execute a cobrança dos títulos vencidos',
            'Abra Contas a Pagar e confira os vencimentos dos próximos 3 dias',
            'Registre as despesas pagas no dia',
            'Confirme se todas as vendas do dia anterior estão lançadas'
          ] },
          { t: 'table', head: ['Horário', 'Tarefa', 'Tempo'], rows: [
            ['Abertura', 'Leitura do dashboard e alertas', '3 min'],
            ['Manhã', 'Cobrança de vencidos', '5 min'],
            ['Tarde', 'Programação de pagamentos', '3 min'],
            ['Fechamento', 'Lançamento de vendas e despesas do dia', '4 min']
          ] },
          { t: 'warn', text: 'O ritual diário só funciona se for feito todos os dias. Pular um dia gera retrabalho no dia seguinte e perda de confiança nos dados.' },
          { t: 'tip', text: 'Deixe o dashboard aberto como página inicial do navegador. O indicador que você vê todo dia é o que você gerencia.' }
        ],
        quiz: [
          { q: 'O ritual diário começa por:', a: ['Emitir relatório mensal', 'Ler o dashboard e os alertas', 'Cobrar clientes antigos', 'Revisar o plano de negócios'], r: 1, e: 'A leitura dos KPIs e alertas define as prioridades do dia.' },
          { q: 'A programação de pagamentos deve cobrir:', a: ['Somente o dia atual', 'Os próximos 3 dias', 'O ano inteiro', 'Apenas o mês seguinte'], r: 1, e: 'Três dias é o horizonte que evita esquecimento sem sobrecarregar a rotina.' },
          { q: 'Pular o ritual diário gera:', a: ['Economia de tempo real', 'Retrabalho e perda de confiança nos dados', 'Aumento de margem', 'Melhora no caixa'], r: 1, e: 'Acúmulo de lançamentos gera divergência e descrédito no sistema.' }
        ]
      },
      {
        id: 'm16a2',
        title: 'Fechamento semanal e mensal',
        duration: 12,
        goal: 'Executar o fechamento da semana e do mês com checklist e decisão registrada.',
        blocks: [
          { t: 'h', text: 'Checklist semanal (sexta-feira, 30 minutos)' },
          { t: 'checklist', items: [
            'Comparar receita realizada x meta da semana',
            'Conferir inadimplência: valor vencido e índice',
            'Revisar a projeção de caixa das próximas 4 semanas',
            'Revisar alertas de estoque e abrir pedidos de compra',
            'Registrar decisões e pendências da semana'
          ] },
          { t: 'h', text: 'Checklist mensal (até o dia 5, 90 minutos)' },
          { t: 'checklist', items: [
            'Fechar a DRE do mês e calcular margem bruta e líquida',
            'Comparar com o mês anterior e com o mesmo mês do ano passado',
            'Fazer análise vertical e horizontal e identificar a linha crítica',
            'Apurar o ponto de equilíbrio e comparar com a receita realizada',
            'Atualizar a projeção de caixa de 13 semanas',
            'Definir as três prioridades do mês seguinte com responsáveis',
            'Registrar as decisões em ata curta'
          ] },
          { t: 'table', head: ['Pergunta do fechamento', 'Fonte no ERP'], rows: [
            ['Quanto vendemos e quanto sobrou?', 'DRE'],
            ['Onde gastamos mais que o previsto?', 'Despesas por categoria'],
            ['Quanto temos a receber e quanto está vencido?', 'Contas a Receber'],
            ['O caixa aguenta os próximos 90 dias?', 'Fluxo de Caixa + projeção'],
            ['Qual produto ou canal puxou o resultado?', 'Vendas + Produtos']
          ] },
          { t: 'warn', text: 'Fechamento sem decisão registrada vira reunião de lamentação. Cada item do checklist precisa terminar com uma ação, um responsável e uma data.' },
          { t: 'tip', text: 'Guarde as atas de fechamento em ordem: elas viram o histórico que permite comparar decisões e resultados um ano depois.' }
        ],
        quiz: [
          { q: 'O fechamento mensal deve ocorrer idealmente:', a: ['Até o dia 20 do mês seguinte', 'Até o dia 5 do mês seguinte', 'No fim do trimestre', 'Quando sobrar tempo'], r: 1, e: 'Quanto mais próximo do mês, mais útil para corrigir a rota.' },
          { q: 'Toda item do checklist de fechamento deve terminar com:', a: ['Um comentário', 'Ação, responsável e data', 'Um gráfico', 'Uma meta anual'], r: 1, e: 'Sem ação definida, a análise não produz mudança.' },
          { q: 'A projeção de caixa revisada no fechamento mensal cobre:', a: ['4 semanas', '13 semanas', '12 meses', '3 anos'], r: 1, e: '13 semanas é o horizonte padrão da projeção de caixa.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 17 - PLANO DE NEGÓCIOS E SaaS
  // ==========================================================
  {
    id: 'm17',
    title: 'Plano de Negócios e Modelo SaaS',
    icon: '💼',
    theme: 'Negócio',
    level: 'Avançado',
    summary: 'TAM/SAM/SOM, precificação, MRR, ARR, churn, CAC, LTV e projeção financeira.',
    lessons: [
      {
        id: 'm17a1',
        title: 'Análise de mercado: TAM, SAM e SOM',
        duration: 11,
        goal: 'Dimensionar o mercado e definir uma meta de participação realista.',
        blocks: [
          { t: 'table', head: ['Sigla', 'Significado', 'Exemplo do ERP'], rows: [
            ['TAM', 'Mercado total endereçável', '12 milhões de empresas ativas no Brasil'],
            ['SAM', 'Mercado servível: quem pode usar o produto', '3 milhões de empresas em processo de digitalização'],
            ['SOM', 'Mercado obtenível: meta realista em prazo definido', '1% em 3 anos = 30.000 clientes']
          ] },
          { t: 'formula', text: 'SOM = SAM x participação alvo   |   Receita potencial = SOM x preço médio do plano' },
          { t: 'h', text: 'Concorrência e posicionamento' },
          { t: 'table', head: ['Concorrente', 'Faixa de preço', 'Diferencial a destacar'], rows: [
            ['Bling', 'R$ 57 a 283/mês', 'Dashboard mais moderno e intuitivo'],
            ['Conta Azul', 'R$ 59 a 279/mês', 'Melhor custo-benefício por plano'],
            ['Tiny', 'R$ 49 a 299/mês', 'Interface mais simples e objetiva'],
            ['SAP Business One', 'acima de R$ 2.000/mês', 'Preço muito menor com escopo similar para PME']
          ] },
          { t: 'h', text: 'Público-alvo' },
          { t: 'list', items: [
            'MEI e autônomos que saíram do caderno e da planilha',
            'Pequenas empresas com faturamento até R$ 360 mil/ano',
            'Médias empresas com faturamento até R$ 4,8 milhões/ano',
            'E-commerces e lojas físicas com controle de estoque',
            'Contadores que atendem várias PMEs e podem revender'
          ] },
          { t: 'steps', items: [
            'Estime o TAM do seu mercado a partir de dados públicos (Sebrae, IBGE, associações)',
            'Aplique filtros de perfil para chegar ao SAM',
            'Defina a participação alvo em 3 anos para obter o SOM',
            'Multiplique pelo preço médio dos planos para projetar a receita potencial'
          ] },
          { t: 'warn', text: 'SOM maior que 5% do SAM em 3 anos normalmente é fantasia. Crescimento exige capacidade de venda, suporte e infraestrutura.' }
        ],
        quiz: [
          { q: 'SAM representa:', a: ['Todas as empresas do país', 'O mercado que pode ser servido pelo produto', 'A meta de clientes', 'O número de concorrentes'], r: 1, e: 'SAM é o recorte do TAM que o produto efetivamente atende.' },
          { q: 'SOM é obtido por:', a: ['TAM x preço', 'SAM x participação alvo no prazo', 'Número de funcionários x ticket', 'Receita ÷ clientes'], r: 1, e: 'É a fatia realista que a empresa pretende capturar.' },
          { q: 'Um SOM acima de 5% do SAM em 3 anos normalmente indica:', a: ['Planejamento conservador', 'Projeção pouco realista', 'Mercado pequeno', 'Preço alto'], r: 1, e: 'Capturar mais de 5% em 3 anos exige capacidade comercial e de suporte rara.' }
        ]
      },
      {
        id: 'm17a2',
        title: 'Métricas de assinatura: MRR, ARR, churn, CAC e LTV',
        duration: 13,
        goal: 'Calcular e interpretar as métricas que definem a saúde de um negócio recorrente.',
        blocks: [
          { t: 'table', head: ['Métrica', 'Fórmula', 'Leitura saudável'], rows: [
            ['MRR', 'Soma das assinaturas ativas no mês', 'Crescimento consistente'],
            ['ARR', 'MRR x 12', 'Visão anualizada'],
            ['Churn rate', 'Clientes cancelados ÷ clientes no início do mês', 'Abaixo de 5% ao mês'],
            ['CAC', 'Custo total de marketing e vendas ÷ novos clientes', 'Menor que LTV ÷ 3'],
            ['LTV', 'Ticket médio mensal x margem x vida média em meses', 'Maior que 3x CAC'],
            ['Payback de CAC', 'CAC ÷ (ticket x margem mensal)', 'Menor que 12 meses'],
            ['NPS', '% promotores - % detratores', 'Acima de 60']
          ] },
          { t: 'h', text: 'Exemplo numérico' },
          { t: 'table', head: ['Item', 'Valor'], rows: [
            ['Clientes no início do mês', '120'],
            ['Cancelamentos no mês', '5'],
            ['Churn', '4,2%'],
            ['Ticket médio mensal', 'R$ 149,90'],
            ['Margem do serviço', '75%'],
            ['Vida média do cliente (1 ÷ churn)', '23,8 meses'],
            ['LTV', '149,90 x 0,75 x 23,8 = R$ 2.675'],
            ['CAC praticado', 'R$ 150'],
            ['Relação LTV ÷ CAC', '17,8x']
          ] },
          { t: 'formula', text: 'Vida média do cliente (meses) = 1 ÷ churn mensal' },
          { t: 'warn', text: 'Churn é a métrica mais subestimada. Reduzir o churn de 6% para 4% ao mês aumenta a vida média do cliente de 16 para 25 meses e eleva o LTV em mais de 50% sem gastar mais em aquisição.' },
          { t: 'steps', items: [
            'Calcule o MRR somando os valores das assinaturas ativas do módulo Assinaturas',
            'Calcule o churn do último mês a partir dos cancelamentos',
            'Levante o gasto de marketing e vendas e divida pelos novos clientes para obter o CAC',
            'Compare LTV com CAC e defina se faz sentido aumentar o investimento em aquisição'
          ] },
          { t: 'tip', text: 'Antes de gastar mais em aquisição, reduza o churn. É mais barato reter do que conquistar.' }
        ],
        quiz: [
          { q: 'Churn mensal de 4% implica vida média do cliente de aproximadamente:', a: ['4 meses', '25 meses', '40 meses', '12 meses'], r: 1, e: '1 ÷ 0,04 = 25 meses.' },
          { q: 'A relação saudável entre LTV e CAC é:', a: ['LTV igual a CAC', 'LTV maior que 3 vezes o CAC', 'CAC maior que LTV', 'LTV menor que CAC ÷ 3'], r: 1, e: 'A regra de mercado é LTV mínimo de 3x o CAC.' },
          { q: 'ARR é calculado por:', a: ['MRR x 12', 'MRR ÷ 12', 'Receita anual ÷ clientes', 'Churn x MRR'], r: 0, e: 'ARR é a versão anualizada do MRR.' }
        ]
      },
      {
        id: 'm17a3',
        title: 'Projeção financeira de 12 meses e estrutura de custos',
        duration: 12,
        goal: 'Montar a projeção de clientes, MRR, custos e lucro do primeiro ano.',
        blocks: [
          { t: 'h', text: 'Cenário conservador de referência' },
          { t: 'table', head: ['Mês', 'Clientes', 'MRR'], rows: [
            ['1', '10', 'R$ 999'],
            ['3', '50', 'R$ 4.995'],
            ['6', '170', 'R$ 16.983'],
            ['9', '380', 'R$ 37.962'],
            ['12', '700', 'R$ 69.930']
          ] },
          { t: 'formula', text: 'ARR no mês 12 = MRR x 12   |   Lucro = MRR - (custos fixos + custos variáveis + marketing)' },
          { t: 'h', text: 'Estrutura de custos típica' },
          { t: 'table', head: ['Item', 'Valor mensal'], rows: [
            ['Servidor cloud', 'R$ 500 a 2.000'],
            ['Domínio e SSL', 'R$ 50'],
            ['Ferramentas de e-mail', 'R$ 200'],
            ['CRM e marketing', 'R$ 300'],
            ['Suporte', 'R$ 3.000 a 8.000'],
            ['Marketing digital', 'R$ 3.000 a 10.000'],
            ['Desenvolvimento', 'R$ 5.000 a 15.000'],
            ['Administrativo', 'R$ 2.000 a 5.000']
          ] },
          { t: 'h', text: 'Canais de aquisição' },
          { t: 'list', items: [
            'Google Ads em palavras como sistema de gestão e ERP online',
            'Instagram e Facebook segmentados por PME local',
            'Conteúdo e SEO com tutoriais de gestão financeira',
            'Parceria com contadores: 20% de comissão recorrente',
            'Programa de indicação: 1 mês grátis para quem indica, 15% de desconto para o indicado'
          ] },
          { t: 'warn', text: 'Projeção sem premissa de churn não fecha. Todo mês entram clientes novos e saem antigos: modele os dois lados, não apenas o crescimento.' },
          { t: 'steps', items: [
            'Defina a meta de clientes mês a mês para 12 meses',
            'Multiplique pelo ticket médio de cada plano para obter o MRR',
            'Some os custos fixos e variáveis previstos',
            'Calcule o lucro mês a mês e identifique o mês de equilíbrio do negócio',
            'Ajuste as premissas até o cenário se tornar executável com o caixa disponível'
          ] }
        ],
        quiz: [
          { q: 'MRR de R$ 69.930 no mês 12 corresponde a ARR de:', a: ['R$ 69.930', 'R$ 839.160', 'R$ 5.827', 'R$ 139.860'], r: 1, e: '69.930 x 12 = R$ 839.160 anualizados.' },
          { q: 'Uma projeção de assinaturas realista precisa modelar:', a: ['Somente novos clientes', 'Entradas e cancelamentos (churn)', 'Somente custos fixos', 'Apenas o preço dos planos'], r: 1, e: 'Sem churn, o crescimento projetado não se sustenta.' },
          { q: 'O programa de indicação com contador normalmente usa:', a: ['Pagamento único de R$ 50', 'Comissão recorrente de cerca de 20%', 'Troca de serviços', 'Desconto vitalício'], r: 1, e: 'Comissão recorrente alinha o incentivo à permanência do cliente.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 18 - ASSINATURAS
  // ==========================================================
  {
    id: 'm18',
    title: 'Assinaturas e Planos do Sistema',
    icon: '🔑',
    theme: 'Negócio',
    level: 'Intermediário',
    summary: 'Planos Starter, Professional e Enterprise, limites por plano e painel de MRR.',
    lessons: [
      {
        id: 'm18a1',
        title: 'Os três planos e como escolher',
        duration: 9,
        goal: 'Comparar os planos disponíveis e escolher o adequado ao porte da empresa.',
        blocks: [
          { t: 'table', head: ['Recurso', 'Starter R$ 49,90', 'Professional R$ 149,90', 'Enterprise R$ 349,90'], rows: [
            ['Usuários', '1', 'Até 5', 'Ilimitados'],
            ['Produtos', 'Até 100', 'Até 1.000', 'Ilimitados'],
            ['Clientes', 'Até 50', 'Até 500', 'Ilimitados'],
            ['Armazenamento', '500MB', '5GB', '50GB'],
            ['Dashboard com KPIs', 'Básico', 'Completo', 'Completo'],
            ['Contas a pagar e receber', '-', 'Sim', 'Sim'],
            ['Fluxo de caixa e DRE', '-', 'Sim', 'Sim'],
            ['Multi-empresas', '-', '-', 'Sim'],
            ['API de integração', '-', '-', 'Sim'],
            ['Suporte', 'E-mail', 'Prioritário', '24/7 com consultoria']
          ] },
          { t: 'h', text: 'Como escolher' },
          { t: 'list', items: [
            'MEI ou autônomo com até 50 clientes e 100 produtos: Starter',
            'Pequena empresa com equipe de até 5 pessoas e necessidade de DRE e fluxo de caixa: Professional',
            'Empresa com múltiplas unidades, integrações ou equipe grande: Enterprise'
          ] },
          { t: 'h', text: 'Assinando no sistema' },
          { t: 'steps', items: [
            'Abra o módulo Assinaturas na barra lateral',
            'Compare os planos exibidos na tela',
            'Selecione o plano e informe a forma de pagamento',
            'Confirme a ativação e verifique o status como ativo',
            'Registre a data de renovação no seu calendário financeiro'
          ] },
          { t: 'warn', text: 'Ultrapassar o limite de clientes ou produtos do plano não é erro técnico: é sinal de que a empresa cresceu. Avalie o upgrade antes de atingir 90% do limite.' }
        ],
        quiz: [
          { q: 'Uma pequena empresa com 5 usuários que precisa de DRE e fluxo de caixa deve contratar:', a: ['Starter', 'Professional', 'Enterprise obrigatoriamente', 'Nenhum'], r: 1, e: 'O Professional contempla até 5 usuários e todos os módulos financeiros.' },
          { q: 'O plano que oferece multi-empresas e API de integração é o:', a: ['Starter', 'Professional', 'Enterprise', 'Todos'], r: 2, e: 'Esses recursos são exclusivos do plano Enterprise.' },
          { q: 'A avaliação de upgrade deve ocorrer:', a: ['Somente quando o sistema bloquear', 'Antes de atingir 90% dos limites do plano', 'Nunca', 'A cada 5 anos'], r: 1, e: 'Antecipar o upgrade evita interrupção da operação.' }
        ]
      },
      {
        id: 'm18a2',
        title: 'Painel administrativo de assinaturas e MRR',
        duration: 10,
        goal: 'Ler o painel de assinaturas, distribuir por plano e acompanhar o MRR.',
        blocks: [
          { t: 'p', text: 'O painel de assinaturas mostra o MRR, o total de assinaturas ativas e a distribuição por plano. É a visão de negócio do produto, não apenas a lista de clientes.' },
          { t: 'formula', text: 'MRR = soma dos valores dos planos ativos   |   Ticket médio = MRR ÷ número de assinaturas ativas' },
          { t: 'h', text: 'Exemplo de leitura' },
          { t: 'table', head: ['Plano', 'Assinaturas', 'MRR'], rows: [
            ['Starter', '40', 'R$ 1.996'],
            ['Professional', '55', 'R$ 8.244,50'],
            ['Enterprise', '12', 'R$ 4.198,80'],
            ['Total', '107', 'R$ 14.439,30']
          ] },
          { t: 'p', text: 'Leitura: o plano Professional concentra 57% do MRR com 51% das assinaturas — é o plano que sustenta o negócio e merece prioridade em produto, suporte e marketing.' },
          { t: 'steps', items: [
            'Abra Assinaturas e confira o MRR total e o ticket médio',
            'Calcule a participação de cada plano no MRR',
            'Identifique o plano com maior participação e priorize melhorias nele',
            'Liste as assinaturas com renovação nos próximos 30 dias e antecipe o contato',
            'Calcule o churn do mês a partir das assinaturas canceladas'
          ] },
          { t: 'tip', text: 'Renovação não é automática na percepção do cliente. Contato 15 dias antes do vencimento reduz cancelamento por esquecimento e por insatisfação não comunicada.' },
          { t: 'warn', text: 'MRR crescendo com churn acima de 6% ao mês é crescimento caro: você está comprando clientes para repor os que saem.' }
        ],
        quiz: [
          { q: 'MRR de R$ 14.439,30 com 107 assinaturas gera ticket médio de:', a: ['R$ 149,90', 'R$ 134,94', 'R$ 107,00', 'R$ 1.443,93'], r: 1, e: '14.439,30 ÷ 107 = R$ 134,94.' },
          { q: 'Se o plano Professional concentra 57% do MRR, a prioridade de investimento deve ser:', a: ['No plano Starter', 'No plano Professional', 'No plano Enterprise', 'Igual entre todos'], r: 1, e: 'O plano que sustenta a receita merece prioridade em produto e suporte.' },
          { q: 'MRR crescendo com churn acima de 6% indica:', a: ['Negócio saudável', 'Crescimento caro, comprando reposição de clientes', 'Alta margem', 'Baixo CAC'], r: 1, e: 'Churn alto consome o esforço de aquisição e encarece o crescimento.' }
        ]
      }
    ]
  }
];
