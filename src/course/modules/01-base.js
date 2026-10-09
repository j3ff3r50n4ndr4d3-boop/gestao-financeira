// Módulos 0 a 4 - Boas-vindas, Fundamentos, KPIs, Clientes e Fornecedores
module.exports = [


    // ==========================================================
    // MÓDULO 0 - BOAS-VINDAS
    // ==========================================================
    {
      id: 'm0',
      title: 'Boas-vindas e Trilha de Aprendizagem',
      icon: '🎓',
      theme: 'Introdução',
      level: 'Iniciante',
      summary: 'Como a academia funciona, o que você vai dominar e como usar o progresso e o certificado.',
      lessons: [
        {
          id: 'm0a1',
          title: 'Bem-vindo à Academia ERP',
          duration: 6,
          goal: 'Entender o formato do curso, o que será aprendido e como o progresso é registrado.',
          blocks: [
            { t: 'p', text: 'Este curso transforma o ERP Gestão Financeira em sala de aula. Em vez de assistir a vídeos genéricos, você aprende cada conceito e aplica na hora, no mesmo sistema que usa no dia a dia da empresa. Todos os dados usados nos exercícios já existem no banco demo: 8 clientes, 3 fornecedores, 10 produtos, mais de 25 vendas e 6 meses de despesas.' },
            { t: 'h', text: 'O que você vai dominar' },
            { t: 'list', items: [
              'Fundamentos de gestão financeira: regime de caixa, competência e ciclo do dinheiro',
              'Cadastros: clientes e fornecedores como base de todo o resto',
              'Produtos, precificação, margem e controle de estoque',
              'Operação: vendas, compras e despesas',
              'Financeiro: contas a receber, contas a pagar, fluxo de caixa e DRE',
              'Análise: indicadores, ponto de equilíbrio e rotina de dashboard',
              'Negócio: plano de negócios, modelo SaaS, assinaturas e precificação do produto',
              'Técnico: segurança, LGPD, deploy e integrações via API'
            ] },
            { t: 'h', text: 'Como a trilha está organizada' },
            { t: 'p', text: 'São 23 módulos e 58 aulas (174 questões de quiz), organizados em 4 grandes blocos: Fundamentos (módulos 0 a 4), Operação (5 a 8), Financeiro e Análise (9 a 16) e Negócio e Tecnologia (17 a 22). Você pode seguir a ordem sugerida, que é progressiva, ou pular direto para um tema específico usando o menu de módulos.' },
            { t: 'tip', text: 'Reserve 30 minutos por dia. Em cerca de três semanas você conclui a trilha inteira, com prática real em cada aula.' },
            { t: 'h', text: 'Certificado' },
            { t: 'p', text: 'Ao concluir 100% das aulas e atingir média mínima de 70% nos quizzes, o certificado de Especialista em Gestão Financeira com ERP (18 horas) fica disponível na própria página do curso, com código de verificação e data de emissão.' }
          ],
          quiz: [
            { q: 'Qual é a principal diferença desta academia para um curso tradicional em vídeo?', a: ['As aulas são mais curtas', 'Cada conceito é aplicado dentro do próprio sistema, com dados reais do ERP', 'Não há quizzes', 'Só pode ser acessada por administradores'], r: 1, e: 'A trilha é integrada ao ERP: você aprende o conceito e executa na hora no mesmo ambiente.' },
            { q: 'Quais são os requisitos para obter o certificado?', a: ['Concluir 50% das aulas', 'Pagar uma taxa extra', 'Concluir 100% das aulas e ter média mínima de 70% nos quizzes', 'Apenas assistir à aula final'], r: 2, e: 'A regra está no bloco de certificação: 100% de conclusão e média mínima de 70%.' },
            { q: 'Sobre os dados usados nos exercícios práticos:', a: ['Precisam ser criados do zero', 'Já existem no banco demo do sistema', 'Só existem no plano Enterprise', 'São fictícios e não podem ser alterados'], r: 1, e: 'O banco demo já vem populado com clientes, produtos, vendas, despesas e contas.' }
          ]
        },
        {
          id: 'm0a2',
          title: 'Preparando o ambiente: acesso, dados demo e rotina de estudo',
          duration: 8,
          goal: 'Entrar no sistema, reconhecer a interface e organizar uma rotina de estudo que caiba no seu dia.',
          blocks: [
            { t: 'h', text: 'Passo a passo do primeiro acesso' },
            { t: 'steps', items: [
              'Abra o ERP no navegador (local: http://localhost:3000, ou a URL do seu deploy)',
              'Faça login com admin@erp.com e senha admin123 (usuário demo administrador)',
              'Observe a barra lateral: ela está dividida em Principal, Vendas, Operações, Financeiro, Sistema e Aprendizado',
              'Clique em Dashboard e identifique os cartões de KPI no topo da tela',
              'Abra o módulo Curso na seção Aprendizado: é aqui que o progresso fica salvo'
            ] },
            { t: 'h', text: 'Mapa da interface' },
            { t: 'table', head: ['Área', 'O que faz', 'Módulo do curso'], rows: [
              ['Dashboard', 'KPIs, gráficos e alertas', 'Módulo 16'],
              ['Vendas / Clientes', 'Registro de vendas e base de clientes', 'Módulos 3 e 8'],
              ['Produtos / Compras / Fornecedores', 'Estoque e suprimentos', 'Módulos 4, 5, 6 e 7'],
              ['Despesas', 'Custos operacionais por categoria', 'Módulo 11'],
              ['Contas a Receber / a Pagar', 'Recebíveis e obrigações', 'Módulos 9 e 10'],
              ['Fluxo de Caixa', 'Entradas e saídas realizadas', 'Módulo 12'],
              ['DRE', 'Demonstrativo de resultados', 'Módulo 13'],
              ['Assinaturas', 'Planos e MRR do SaaS', 'Módulo 18']
            ] },
            { t: 'h', text: 'Rotina de estudo recomendada' },
            { t: 'checklist', items: [
              'Escolha um horário fixo de 30 minutos por dia',
              'Leia a aula e faça as anotações em um caderno ou documento próprio',
              'Execute o exercício no sistema antes de responder o quiz',
              'Responda o quiz sem consultar: o erro com explicação ensina mais',
              'Marque a aula como concluída e siga para a próxima'
            ] },
            { t: 'warn', text: 'Os dados demo podem ser alterados livremente durante o curso. Se quiser começar do zero, apague a pasta data/ e rode node seed.js novamente para recriar o banco com os dados de exemplo.' },
            { t: 'tip', text: 'Anote três números da sua própria empresa em cada módulo: receita do mês, despesas do mês e quanto você tem a receber. No final do curso você terá um diagnóstico completo.' }
          ],
          quiz: [
            { q: 'Onde fica o acesso ao curso dentro do sistema?', a: ['No rodapé do dashboard', 'Na seção Aprendizado da barra lateral', 'Apenas por URL externa', 'No menu de configurações do usuário'], r: 1, e: 'O curso é um módulo nativo da barra lateral, na seção Aprendizado.' },
            { q: 'Qual a ordem correta de estudo sugerida pela trilha?', a: ['Deploy primeiro, finanças por último', 'Fundamentos, Operação, Financeiro e Análise, Negócio e Tecnologia', 'Qualquer ordem, sem progressão', 'Somente os módulos financeiros'], r: 1, e: 'A trilha é progressiva: fundamentos antes de operação, operação antes de análise, análise antes de negócio.' },
            { q: 'Se você quiser reiniciar os dados demo do sistema:', a: ['É preciso reinstalar o Node', 'Basta apagar a pasta data/ e rodar o seed novamente', 'Não é possível', 'É necessário excluir o usuário admin'], r: 1, e: 'O banco fica em data/erp.db; apagar e recriar com o seed restaura os dados de exemplo.' }
          ]
        }
      ]
    },

    // ==========================================================
    // MÓDULO 1 - FUNDAMENTOS
    // ==========================================================
    {
      id: 'm1',
      title: 'Fundamentos de Gestão Financeira',
      icon: '🧭',
      theme: 'Fundamentos',
      level: 'Iniciante',
      summary: 'Regime de caixa e competência, separação de contas, ciclo do dinheiro e por que registrar tudo.',
      lessons: [
        {
          id: 'm1a1',
          title: 'Por que a maioria das PMEs quebra: falta de controle, não de vendas',
          duration: 9,
          goal: 'Reconhecer os cinco erros financeiros mais comuns e o que o registro sistemático evita.',
          blocks: [
            { t: 'p', text: 'A pesquisa do Sebrae sobre mortalidade de empresas mostra que a maior parte dos negócios que fecham nos primeiros anos não morreu por falta de cliente, e sim por falta de controle: o dono não sabia a margem, não separava o dinheiro da empresa do dinheiro pessoal e descobria o rombo quando o caixa já estava negativo.' },
            { t: 'h', text: 'Os cinco erros clássicos' },
            { t: 'list', items: [
              'Misturar conta pessoal com conta da empresa (pró-labore virou "pegar quando precisa")',
              'Vender sem conhecer o custo real do produto ou serviço',
              'Tratar faturamento como lucro disponível',
              'Não acompanhar contas a receber: o dinheiro vendido nunca entra',
              'Decidir sem indicador: preço, compra e contratação no "achismo"'
            ] },
            { t: 'h', text: 'O que muda quando existe registro' },
            { t: 'table', head: ['Sem controle', 'Com controle (ERP)'], rows: [
              ['Lucro percebido no fim do mês', 'Lucro apurado a cada venda (DRE)'],
              ['Estoque descoberto na hora da venda', 'Alerta de estoque mínimo no dashboard'],
              ['Cobrança esquecida', 'Contas a receber com vencimento e alerta de atraso'],
              ['Preço definido pelo concorrente', 'Preço definido por custo + margem alvo'],
              ['Decisão baseada em sensação', 'Decisão baseada em KPI e histórico']
            ] },
            { t: 'tip', text: 'Meta prática deste módulo: em 7 dias, registrar 100% das vendas e 100% das despesas no sistema. Só isso já muda a qualidade das suas decisões.' },
            { t: 'p', text: 'Gestão financeira não é contabilidade burocrática: é o painel de instrumentos do negócio. Um piloto não pilota olhando para fora da janela, ele olha os instrumentos. Você vai aprender a ler cada um deles.' }
          ],
          quiz: [
            { q: 'Segundo o conteúdo, a principal causa de fechamento de PMEs é:', a: ['Falta de clientes', 'Falta de controle financeiro', 'Excesso de funcionários', 'Concorrência internacional'], r: 1, e: 'A mortalidade está ligada à ausência de controle: margem desconhecida, mistura de contas e caixa não acompanhado.' },
            { q: 'Tratar faturamento como lucro disponível é um erro porque:', a: ['Faturamento nunca entra no caixa', 'Faturamento ainda contém custos, despesas e impostos a pagar', 'Lucro não existe em PME', 'Impostos não incidem sobre faturamento'], r: 1, e: 'Receita bruta ainda precisa pagar custo do produto, despesas operacionais e tributos antes de virar lucro.' },
            { q: 'Qual alerta do ERP ajuda a evitar a venda sem produto disponível?', a: ['Alerta de contas vencidas', 'Alerta de estoque baixo no dashboard', 'Alerta de assinatura', 'Alerta de token expirado'], r: 1, e: 'O dashboard exibe alertas de estoque baixo com base no estoque mínimo cadastrado no produto.' }
          ]
        },
        {
          id: 'm1a2',
          title: 'Regime de caixa x regime de competência',
          duration: 11,
          goal: 'Diferenciar os dois regimes e saber em que momento cada lançamento entra no caixa e no resultado.',
          blocks: [
            { t: 'p', text: 'Este é o conceito mais importante do curso. Quase toda confusão financeira nasce de misturar dinheiro que entrou com venda que aconteceu.' },
            { t: 'table', head: ['Aspecto', 'Regime de caixa', 'Regime de competência'], rows: [
              ['Pergunta central', 'Quando o dinheiro entrou ou saiu?', 'Quando o fato aconteceu?'],
              ['Venda a prazo de R$ 10.000 em 12x', 'Entra R$ 833 por mês', 'Entra R$ 10.000 no mês da venda'],
              ['Relatório típico', 'Fluxo de caixa', 'DRE'],
              ['Usado para', 'Sobrevivência: pagar contas', 'Rentabilidade: medir desempenho'],
              ['No ERP', 'Módulo Fluxo de Caixa', 'Módulo DRE e Vendas']
            ] },
            { t: 'h', text: 'Exemplo numérico' },
            { t: 'p', text: 'Em março você vende R$ 30.000, sendo R$ 10.000 à vista e R$ 20.000 em 4 parcelas mensais. Comprou R$ 12.000 em mercadoria à vista e pagou R$ 6.000 de despesas.' },
            { t: 'formula', text: 'Resultado por competência (março) = 30.000 - 12.000 - 6.000 = R$ 12.000 de lucro' },
            { t: 'formula', text: 'Caixa de março = 10.000 (entrada) - 12.000 - 6.000 = -R$ 8.000 (negativo)' },
            { t: 'warn', text: 'A empresa deu lucro e ficou sem caixa. É exatamente assim que negócio lucrativo quebra: por descasamento de prazo. A solução é projetar o caixa (módulo 12) e negociar prazo com fornecedores (módulo 10).' },
            { t: 'h', text: 'Como o ERP trata os dois regimes' },
            { t: 'steps', items: [
              'A venda é registrada em Vendas na data da operação: alimenta receita, DRE e ticket médio',
              'A parcela correspondente vai para Contas a Receber com vencimento: alimenta o direito',
              'Quando o cliente paga, você marca como pago: o valor entra no Fluxo de Caixa',
              'O mesmo vale para compras: a nota vai em Compras, a obrigação em Contas a Pagar e a saída no caixa quando paga'
            ] }
          ],
          quiz: [
            { q: 'Uma venda de R$ 10.000 em 10 parcelas, feita em janeiro, entra no DRE de janeiro como:', a: ['R$ 1.000', 'R$ 10.000', 'Zero até a última parcela', 'R$ 5.000'], r: 1, e: 'Pelo regime de competência, a receita é reconhecida integralmente na data da venda.' },
            { q: 'O mesmo valor, no fluxo de caixa de janeiro:', a: ['R$ 10.000', 'R$ 1.000 (primeira parcela)', 'Zero', 'R$ 9.000'], r: 1, e: 'O caixa só registra o que efetivamente entrou: a primeira parcela de R$ 1.000.' },
            { q: 'Empresa com lucro e caixa negativo significa que:', a: ['O lucro é falso', 'Há descasamento entre prazo de recebimento e prazo de pagamento', 'A DRE está errada', 'Não há o que fazer'], r: 1, e: 'É descasamento de prazo: recebe em muitos dias e paga em poucos. Resolve-se com projeção de caixa e renegociação de prazos.' }
          ]
        },
        {
          id: 'm1a3',
          title: 'O ciclo do dinheiro e a separação das contas',
          duration: 10,
          goal: 'Mapear o ciclo operacional e financeiro da sua empresa e definir pró-labore.',
          blocks: [
            { t: 'h', text: 'O ciclo do dinheiro em 4 etapas' },
            { t: 'steps', items: [
              'Compra: você paga o fornecedor (saída de caixa ou conta a pagar)',
              'Estoque: o dinheiro fica parado em mercadoria',
              'Venda: o produto sai e vira conta a receber ou caixa imediato',
              'Recebimento: o dinheiro finalmente entra'
            ] },
            { t: 'formula', text: 'Ciclo financeiro = prazo médio de recebimento - prazo médio de pagamento dos fornecedores' },
            { t: 'p', text: 'Se você paga o fornecedor em 30 dias e recebe do cliente em 60, precisa financiar 30 dias de operação com capital próprio ou capital de giro. Cada dia encurtado no recebimento é dinheiro liberado sem custo.' },
            { t: 'h', text: 'Separação obrigatória' },
            { t: 'list', items: [
              'Conta bancária da empresa separada da conta pessoal, sempre',
              'Pró-labore fixo e mensal: um valor definido, lançado como despesa no sistema',
              'Retiradas extras registradas como distribuição de lucro, não como "peguei do caixa"',
              'Cartão da empresa separado do cartão pessoal'
            ] },
            { t: 'h', text: 'Exercício no sistema' },
            { t: 'steps', items: [
              'Vá em Despesas e crie uma despesa com categoria Salários/Pró-labore no valor que você definiu',
              'Repita esse lançamento todo mês, no mesmo dia',
              'Ao final de 3 meses, compare o pró-labore com o lucro líquido da DRE: ele deve caber no lucro'
            ] },
            { t: 'tip', text: 'Regra prática para começar: pró-labore de até 30% do lucro líquido apurado, ajustado trimestralmente conforme a DRE.' }
          ],
          quiz: [
            { q: 'O ciclo financeiro de uma empresa é definido como:', a: ['Tempo entre a compra e a venda', 'Prazo médio de recebimento menos prazo médio de pagamento', 'Soma de todos os prazos', 'Tempo de estoque dividido por 30'], r: 1, e: 'Ciclo financeiro é a diferença entre quanto você demora a receber e quanto demora a pagar.' },
            { q: 'Pró-labore deve ser lançado no ERP como:', a: ['Receita', 'Despesa da empresa', 'Conta a receber', 'Compra'], r: 1, e: 'Pró-labore é custo da empresa: entra em Despesas, preferencialmente na categoria Salários/Pró-labore.' },
            { q: 'Pagar fornecedor em 30 dias e receber do cliente em 60 dias gera:', a: ['Sobra de caixa automática', 'Necessidade de financiar 30 dias de operação', 'Lucro maior', 'Redução de estoque'], r: 1, e: 'Você financia a diferença com capital próprio ou capital de giro.' }
          ]
        }
      ]
    },

    // ==========================================================
    // MÓDULO 2 - DIAGNÓSTICO / KPIs
    // ==========================================================
    {
      id: 'm2',
      title: 'Diagnóstico Financeiro e KPIs',
      icon: '📊',
      theme: 'Fundamentos',
      level: 'Iniciante',
      summary: 'Leia receita, despesa, lucro, ticket médio, margem e fluxo de caixa como um gestor.',
      lessons: [
        {
          id: 'm2a1',
          title: 'Os 8 números que dizem a verdade sobre o seu negócio',
          duration: 12,
          goal: 'Interpretar cada KPI exibido no dashboard e calcular os principais à mão.',
          blocks: [
            { t: 'p', text: 'O dashboard do ERP exibe oito indicadores calculados a partir das vendas, despesas, compras e contas. Entender o que cada um significa é o primeiro passo para deixar de "sentir" e passar a medir.' },
            { t: 'table', head: ['KPI', 'Como é calculado', 'O que revela'], rows: [
              ['Receita do mês', 'Soma das vendas do mês', 'Capacidade de gerar vendas'],
              ['Despesas do mês', 'Soma das despesas do mês', 'Peso da estrutura'],
              ['Lucro do mês', 'Receita - Despesas', 'Resultado final do período'],
              ['Margem de lucro', 'Lucro ÷ Receita × 100', 'Eficiência da operação'],
              ['Ticket médio', 'Receita ÷ número de vendas', 'Valor médio por pedido'],
              ['Fluxo de caixa', 'Entradas - Saídas', 'Disponibilidade de dinheiro'],
              ['Contas a receber', 'Soma dos recebíveis pendentes', 'Dinheiro já vendido, ainda não recebido'],
              ['Contas a pagar', 'Soma das obrigações pendentes', 'Compromissos futuros']
            ] },
            { t: 'formula', text: 'Margem de lucro (%) = (Lucro ÷ Receita) × 100   |   Ticket médio = Receita ÷ Quantidade de vendas' },
            { t: 'h', text: 'Faixas de referência (serviços e comércio)' },
            { t: 'table', head: ['Margem líquida', 'Leitura'], rows: [
              ['Abaixo de 5%', 'Zona de risco: qualquer imprevisto gera prejuízo'],
              ['5% a 10%', 'Apertado: exige controle rígido de despesas'],
              ['10% a 20%', 'Saudável para comércio'],
              ['Acima de 20%', 'Bom para serviços; em comércio indica forte diferenciação']
            ] },
            { t: 'warn', text: 'KPI isolado não decide nada. Receita crescendo com margem caindo é sinal de desconto excessivo ou custo mal calculado — os dois indicadores precisam ser lidos juntos.' }
          ],
          quiz: [
            { q: 'Receita de R$ 200.000 e lucro de R$ 24.000 resultam em margem de:', a: ['12%', '24%', '8,3%', '20%'], r: 0, e: '24.000 ÷ 200.000 = 0,12 → 12% de margem.' },
            { q: 'Ticket médio é calculado por:', a: ['Receita ÷ número de clientes', 'Receita ÷ número de vendas', 'Lucro ÷ número de vendas', 'Receita ÷ estoque'], r: 1, e: 'Ticket médio = receita do período dividida pela quantidade de vendas do período.' },
            { q: 'Uma margem líquida abaixo de 5% indica:', a: ['Empresa muito lucrativa', 'Zona de risco, sem folga para imprevistos', 'Erro de cálculo sempre', 'Preços altos demais'], r: 1, e: 'Abaixo de 5% qualquer variação de custo ou inadimplência vira prejuízo.' }
          ]
        },
        {
          id: 'm2a2',
          title: 'Variação mês a mês: comparando períodos do jeito certo',
          duration: 10,
          goal: 'Analisar variação percentual, sazonalidade e tendência usando os gráficos do dashboard.',
          blocks: [
            { t: 'p', text: 'O dashboard mostra a variação percentual da receita e das despesas em relação ao mês anterior, além de gráficos de evolução mensal de receita x despesas e pizza de despesas por categoria. Comparação exige método, senão vira ruído.' },
            { t: 'formula', text: 'Variação (%) = ((Valor atual - Valor anterior) ÷ Valor anterior) × 100' },
            { t: 'h', text: 'Três regras para não errar a leitura' },
            { t: 'list', items: [
              'Compare sempre o mesmo período: mês cheio com mês cheio, nunca 10 dias com 30 dias',
              'Compare com o mesmo mês do ano anterior para neutralizar sazonalidade (varejo em dezembro x fevereiro)',
              'Separe efeito de preço e efeito de volume: vendeu mais unidades ou vendeu mais caro?'
            ] },
            { t: 'h', text: 'Exemplo' },
            { t: 'p', text: 'Receita de fevereiro: R$ 80.000. Março: R$ 96.000. Variação = (96.000 - 80.000) ÷ 80.000 = +20%. Se as despesas subiram 25% no mesmo período, o crescimento veio com piora de margem: a análise completa exige olhar os dois lados.' },
            { t: 'steps', items: [
              'Abra o Dashboard e anote receita, despesa e variação do mês atual',
              'Observe o gráfico de barras receita x despesas dos últimos meses',
              'Abra a pizza de despesas por categoria e identifique as 3 categorias que concentram o maior valor',
              'Escreva em uma linha a conclusão: onde estou ganhando e onde estou perdendo'
            ] },
            { t: 'tip', text: 'Regra 80/20: em quase toda PME, 3 categorias de despesa respondem por 80% do gasto total. É nelas que a negociação rende.' }
          ],
          quiz: [
            { q: 'Receita de R$ 80.000 que passa a R$ 96.000 representa variação de:', a: ['+16%', '+20%', '+25%', '+12%'], r: 1, e: '(96.000 - 80.000) ÷ 80.000 = 0,20 → +20%.' },
            { q: 'Comparar com o mesmo mês do ano anterior serve para:', a: ['Aumentar a receita', 'Neutralizar efeitos de sazonalidade', 'Reduzir despesas', 'Calcular imposto'], r: 1, e: 'Elimina a distorção de meses sazonalmente fortes ou fracos.' },
            { q: 'Se a receita sobe 20% e as despesas sobem 25%, a margem:', a: ['Melhora', 'Piora', 'Fica igual', 'Não é possível saber'], r: 1, e: 'Custo crescendo mais rápido que receita reduz a margem percentual.' }
          ]
        },
        {
          id: 'm2a3',
          title: 'Alertas do sistema: estoque baixo e contas vencidas',
          duration: 8,
          goal: 'Usar os alertas automáticos do dashboard como gatilho de ação diária.',
          blocks: [
            { t: 'p', text: 'O dashboard calcula dois conjuntos de alertas: produtos com estoque atual abaixo do estoque mínimo cadastrado e contas (a receber e a pagar) com vencimento anterior à data de hoje ainda em aberto.' },
            { t: 'h', text: 'O que fazer com cada alerta' },
            { t: 'table', head: ['Alerta', 'Ação imediata', 'Ação estrutural'], rows: [
              ['Estoque baixo', 'Verificar o produto e abrir uma compra', 'Revisar estoque mínimo e prazo do fornecedor'],
              ['Conta a receber vencida', 'Cobrar o cliente hoje', 'Aplicar régua de cobrança (módulo 9)'],
              ['Conta a pagar vencida', 'Negociar ou programar pagamento', 'Rever prazo contratado com o fornecedor'],
              ['Margem caindo', 'Conferir preço de custo atualizado', 'Reprecificar a linha de produtos (módulo 5)']
            ] },
            { t: 'steps', items: [
              'No dashboard, localize o bloco de alertas',
              'Clique em um produto com estoque baixo e confira o estoque atual e o mínimo',
              'Abra Contas a Receber e ordene por vencimento: as vencidas aparecem primeiro',
              'Marque como pago aquilo que já foi recebido — alerta só é útil se o dado estiver atualizado'
            ] },
            { t: 'warn', text: 'Alerta ignorado perde valor. Estabeleça o hábito de zerar a lista de alertas todo dia útil antes de fechar o expediente.' }
          ],
          quiz: [
            { q: 'O alerta de estoque baixo é disparado quando:', a: ['O produto é vendido', 'O estoque atual fica abaixo do estoque mínimo cadastrado', 'A compra é registrada', 'O preço muda'], r: 1, e: 'A comparação é entre stock_quantity e min_stock do cadastro do produto.' },
            { q: 'Uma conta a receber vencida deve gerar:', a: ['Espera de 30 dias', 'Cobrança imediata e revisão da régua de cobrança', 'Cancelamento da venda', 'Aumento do preço'], r: 1, e: 'Cobrança imediata mais processo estruturado de cobrança.' },
            { q: 'Alertas só são úteis se:', a: ['Forem muitos', 'Os dados estiverem atualizados no sistema', 'Forem enviados por e-mail', 'Aparecerem apenas no fim do mês'], r: 1, e: 'Dado desatualizado gera alerta falso e destrói a confiança no painel.' }
          ]
        }
      ]
    },

    // ==========================================================
    // MÓDULO 3 - CLIENTES
    // ==========================================================
    {
      id: 'm3',
      title: 'Cadastro de Clientes: a base de tudo',
      icon: '👥',
      theme: 'Cadastros',
      level: 'Iniciante',
      summary: 'Dados completos, documento, histórico de compras e como o cadastro alimenta os demais módulos.',
      lessons: [
        {
          id: 'm3a1',
          title: 'Estrutura do cadastro e campos obrigatórios',
          duration: 9,
          goal: 'Cadastrar clientes com padrão de qualidade que permita cobrança, análise e fiscalização.',
          blocks: [
            { t: 'p', text: 'A tabela de clientes do sistema guarda: nome, e-mail, telefone, documento (CPF/CNPJ), endereço, cidade, estado, CEP e observações. Cada cliente pertence a um usuário (empresa), o que garante isolamento dos dados entre contas.' },
            { t: 'h', text: 'Padrão mínimo de qualidade' },
            { t: 'checklist', items: [
              'Nome completo ou razão social exatamente como no documento',
              'Documento sem pontos nem traços, para evitar duplicidade',
              'Telefone com DDD e indicação de WhatsApp quando houver',
              'E-mail válido (é por ele que a cobrança será enviada)',
              'Cidade e UF preenchidas (permitem análise por região)',
              'Observações com histórico relevante: condição de pagamento habitual, restrições'
            ] },
            { t: 'h', text: 'Como o cadastro é usado em outros módulos' },
            { t: 'table', head: ['Módulo', 'Uso do cadastro de clientes'], rows: [
              ['Vendas', 'Seleção do cliente na venda e vínculo do histórico'],
              ['Contas a Receber', 'Identificação do devedor na cobrança'],
              ['Dashboard', 'Contagem de clientes ativos como KPI'],
              ['Relatórios', 'Análise de receita por cliente e por região']
            ] },
            { t: 'steps', items: [
              'Abra Clientes na barra lateral e clique em Novo Cliente',
              'Preencha os campos do padrão mínimo e salve',
              'Use o campo de busca para validar se o cliente não foi cadastrado duas vezes',
              'Edite um cliente existente e adicione uma observação sobre a condição de pagamento'
            ] },
            { t: 'warn', text: 'Cliente duplicado distorce receita por cliente, permite duas cobranças diferentes e polui relatórios. Prefira sempre buscar antes de cadastrar.' }
          ],
          quiz: [
            { q: 'Qual campo é mais crítico para evitar cliente duplicado?', a: ['Observações', 'Documento (CPF/CNPJ) padronizado', 'CEP', 'Cidade'], r: 1, e: 'Documento padronizado é a chave natural que identifica unicamente a pessoa ou empresa.' },
            { q: 'O cadastro de clientes é usado diretamente em:', a: ['Somente em Vendas', 'Vendas, Contas a Receber, Dashboard e relatórios', 'Somente no DRE', 'Somente em Compras'], r: 1, e: 'Ele alimenta venda, cobrança, KPI de clientes e análises por cliente/região.' },
            { q: 'Antes de cadastrar um novo cliente, a boa prática é:', a: ['Cadastrar e depois conferir', 'Buscar pelo nome ou documento para evitar duplicidade', 'Cadastrar em outro módulo', 'Pedir ao contador'], r: 1, e: 'Buscar antes de cadastrar é a regra básica de qualidade de cadastro.' }
          ]
        },
        {
          id: 'm3a2',
          title: 'Histórico, segmentação e LGPD no cadastro de clientes',
          duration: 10,
          goal: 'Segmentar clientes por valor e tratar os dados pessoais conforme a LGPD.',
          blocks: [
            { t: 'h', text: 'Segmentação ABC de clientes' },
            { t: 'p', text: 'Ordene os clientes pela receita gerada nos últimos 12 meses e divida: A são os 20% que representam cerca de 80% da receita, B os seguintes 15% do total e C o restante. Clientes A merecem condição especial e contato próximo; clientes C podem ser atendidos por processo automatizado.' },
            { t: 'table', head: ['Classe', 'Participação típica na receita', 'Tratamento'], rows: [
              ['A', '~80% (20% dos clientes)', 'Atendimento dedicado, prazo negociado, visita periódica'],
              ['B', '~15%', 'Contato programado, oferta de novos produtos'],
              ['C', '~5%', 'Autoatendimento, cobrança automatizada']
            ] },
            { t: 'h', text: 'LGPD na prática' },
            { t: 'list', items: [
              'Colete apenas dados necessários para venda, cobrança e entrega (minimização)',
              'Tenha base legal clara: execução de contrato para clientes, consentimento para marketing',
              'Restrinja o acesso interno: só quem precisa ver os dados deve ver',
              'Nunca compartilhe a base com terceiros sem contrato e finalidade definida',
              'Permita a exclusão e a portabilidade dos dados quando o titular pedir',
              'Mantenha backup seguro: vazamento é incidente e deve ser comunicado à ANPD quando houver risco'
            ] },
            { t: 'steps', items: [
              'Liste os clientes do sistema e identifique os 3 maiores por receita (módulo 15 ensina a calcular)',
              'Classifique-os como A, B ou C no campo de observações do cadastro',
              'Revise os campos coletados e remova dados que a empresa não usa para nada'
            ] },
            { t: 'tip', text: 'Cadastro enxuto é mais rápido de preencher, mais barato de manter e mais seguro juridicamente. Se um campo não gera decisão, ele não deveria existir.' }
          ],
          quiz: [
            { q: 'Na curva ABC de clientes, a classe A normalmente representa:', a: ['80% dos clientes', 'Cerca de 20% dos clientes que geram ~80% da receita', 'Os clientes inadimplentes', 'Os clientes mais recentes'], r: 1, e: 'É o princípio de Pareto aplicado à base de clientes.' },
            { q: 'O princípio da minimização na LGPD significa:', a: ['Coletar o máximo de dados possível', 'Coletar apenas os dados necessários para a finalidade', 'Apagar todos os dados em 30 dias', 'Não coletar nenhum dado'], r: 1, e: 'Minimização é coletar o mínimo necessário para a finalidade declarada.' },
            { q: 'Um cliente solicita a exclusão dos dados. A empresa deve:', a: ['Ignorar o pedido', 'Avaliar e atender, ressalvadas as obrigações legais de guarda', 'Excluir somente o e-mail', 'Cobrar pela exclusão'], r: 1, e: 'O titular tem direito à exclusão, mas documentos fiscais e contábeis têm guarda obrigatória por lei.' }
          ]
        }
      ]
    },

    // ==========================================================
    // MÓDULO 4 - FORNECEDORES
    // ==========================================================
    {
      id: 'm4',
      title: 'Fornecedores: quem define o seu custo',
      icon: '🏢',
      theme: 'Cadastros',
      level: 'Iniciante',
      summary: 'Cadastro de fornecedores, pessoa de contato, prazo negociado e avaliação de desempenho.',
      lessons: [
        {
          id: 'm4a1',
          title: 'Cadastro de fornecedores e dados de negociação',
          duration: 8,
          goal: 'Cadastrar fornecedores com as informações que sustentam negociação de preço e prazo.',
          blocks: [
            { t: 'p', text: 'A tabela de fornecedores guarda nome, e-mail, telefone, CNPJ, endereço, cidade e a pessoa de contato. O campo pessoa de contato é o mais subestimado: é ele que acelera a negociação quando o prazo aperta.' },
            { t: 'checklist', items: [
              'Razão social e CNPJ corretos (necessários para nota fiscal e contas a pagar)',
              'Telefone comercial e celular do vendedor responsável',
              'Nome da pessoa de contato com cargo',
              'Endereço completo (frete e devolução dependem dele)',
              'No campo de observações, registre: prazo de pagamento padrão, prazo de entrega, pedido mínimo e política de troca'
            ] },
            { t: 'h', text: 'Ficha de negociação sugerida (campo observações)' },
            { t: 'table', head: ['Item', 'Exemplo de registro'], rows: [
              ['Prazo de pagamento', '28/56/84 dias ou 5% de desconto à vista'],
              ['Prazo de entrega', '7 dias úteis para capital, 12 para interior'],
              ['Pedido mínimo', 'R$ 2.000 ou 30 unidades'],
              ['Frete', 'CIF acima de R$ 3.000, FOB abaixo'],
              ['Troca/devolução', '7 dias com nota fiscal']
            ] },
            { t: 'steps', items: [
              'Abra Fornecedores e clique em Novo Fornecedor',
              'Preencha a ficha completa incluindo a pessoa de contato',
              'Registre no campo de observações as condições de negociação atuais',
              'Repita para todos os fornecedores com compra nos últimos 12 meses'
            ] }
          ],
          quiz: [
            { q: 'O campo pessoa de contato serve principalmente para:', a: ['Cumprir uma exigência legal', 'Acelerar negociação e resolver pendências com o fornecedor', 'Enviar nota fiscal', 'Calcular frete'], r: 1, e: 'Ter o contato certo encurta o ciclo de negociação e de solução de problemas.' },
            { q: 'As condições de prazo, pedido mínimo e frete devem ficar registradas:', a: ['Na cabeça do comprador', 'No campo de observações do cadastro do fornecedor', 'Na nota fiscal', 'No cadastro do produto'], r: 1, e: 'Registro no sistema sobrevive à saída do funcionário e padroniza a negociação.' },
            { q: 'CNPJ do fornecedor é essencial para:', a: ['Calcular ticket médio', 'Emissão de nota fiscal e conciliação de contas a pagar', 'Definir o estoque mínimo', 'Emitir boleto de cliente'], r: 1, e: 'Sem documento correto não há nota fiscal válida nem conciliação confiável da obrigação.' }
          ]
        },
        {
          id: 'm4a2',
          title: 'Avaliação de fornecedores e poder de barganha',
          duration: 10,
          goal: 'Medir desempenho de fornecedores e estruturar uma renegociação anual.',
          blocks: [
            { t: 'h', text: 'Quatro critérios de avaliação' },
            { t: 'table', head: ['Critério', 'Como medir', 'Meta'], rows: [
              ['Prazo de entrega', '% de entregas no prazo nos últimos 12 meses', '≥ 95%'],
              ['Qualidade', '% de devoluções por defeito', '≤ 2%'],
              ['Preço', 'Variação do preço de custo x inflação do período', '≤ IPCA'],
              ['Prazo de pagamento', 'Dias médios concedidos', 'Maior que o prazo de recebimento do cliente']
            ] },
            { t: 'formula', text: 'Índice do fornecedor = (40% prazo) + (30% qualidade) + (20% preço) + (10% condições)' },
            { t: 'h', text: 'Como criar poder de barganha' },
            { t: 'list', items: [
              'Concentre volume: 3 fornecedores fortes valem mais que 15 fracos',
              'Chegue com dados: mostre o volume comprado no ano e o potencial de crescimento',
              'Peça prazo antes de pedir desconto: prazo vale mais para o caixa',
              'Tenha sempre um segundo fornecedor homologado como alternativa real',
              'Negocie uma vez por ano, com histórico em mãos, e não em cada pedido'
            ] },
            { t: 'steps', items: [
              'Abra Compras e liste as compras por fornecedor dos últimos 12 meses',
              'Some o volume de cada um e calcule a participação percentual',
              'Marque na ficha do fornecedor o volume anual e a data da última renegociação',
              'Escolha o fornecedor com maior volume e agende a renegociação com a ficha pronta'
            ] },
            { t: 'tip', text: 'Ganhar 15 dias de prazo com o fornecedor principal costuma liberar mais caixa do que 2% de desconto — e sem reduzir a margem.' }
          ],
          quiz: [
            { q: 'Qual critério costuma ter maior peso na avaliação de fornecedores?', a: ['Preço', 'Prazo de entrega', 'Localização', 'Tamanho da empresa'], r: 1, e: 'No índice sugerido, prazo de entrega tem peso de 40%, o maior entre os critérios.' },
            { q: 'Em uma renegociação, o que normalmente vale mais para o caixa?', a: ['1% de desconto', '15 dias a mais de prazo de pagamento', 'Frete grátis em um pedido', 'Brindes'], r: 1, e: 'Prazo financia o capital de giro sem reduzir a margem de venda.' },
            { q: 'Ter um segundo fornecedor homologado serve para:', a: ['Aumentar o estoque', 'Criar alternativa real de negociação e reduzir risco de desabastecimento', 'Reduzir impostos', 'Cumprir exigência do ERP'], r: 1, e: 'Alternativa real é o que dá força na mesa e protege contra ruptura de suprimento.' }
          ]
        }
      ]
    }
];
