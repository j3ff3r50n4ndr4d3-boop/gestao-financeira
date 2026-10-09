// ============================================================
// AGENTE IA ERP - Definição dos domínios de atuação
// Cada domínio = uma área da empresa com escopo, KPIs, perguntas
// típicas, persona e links para os módulos do sistema.
// ============================================================

const DOMAINS = [
  {
    id: 'empresarial',
    name: 'Gestão Empresarial',
    shortName: 'Empresarial',
    icon: '🏢',
    color: '#6366f1',
    persona: 'CEO / Diretor Geral',
    mission:
      'Garantir que a empresa cresça com lucro, caixa saudável e risco controlado, alinhando metas, indicadores e decisões estratégicas.',
    scope: [
      'Visão consolidada do negócio (receita, lucro, caixa e risco)',
      'DRE gerencial e ponto de equilíbrio',
      'Definição e acompanhamento de metas',
      'Planejamento estratégico e governança de dados',
      'Análise de riscos e dependências (clientes, fornecedores, produtos)'
    ],
    kpis: [
      'Receita mensal e crescimento',
      'Margem líquida',
      'Lucro operacional',
      'Ponto de equilíbrio',
      'Índice de saúde do negócio',
      'Concentração de receita'
    ],
    typicalQuestions: [
      'Como está a saúde geral da empresa?',
      'Qual é o ponto de equilíbrio?',
      'Quais são os maiores riscos do negócio hoje?',
      'Estamos crescendo ou encolhendo?',
      'Monte o DRE gerencial do mês'
    ],
    routines: [
      { name: 'Reunião de resultados', cadence: 'Semanal', focus: 'Receita x meta, caixa, alertas críticos' },
      { name: 'Fechamento gerencial', cadence: 'Mensal', focus: 'DRE, margens, ponto de equilíbrio, plano de ação' },
      { name: 'Revisão estratégica', cadence: 'Trimestral', focus: 'Metas, portfólio, preços, capacidade e riscos' }
    ],
    links: [
      { page: 'dashboard', label: 'Dashboard' },
      { page: 'dre', label: 'DRE' }
    ]
  },
  {
    id: 'producao',
    name: 'Gestão de Produção e Processos',
    shortName: 'Produção e Processos',
    icon: '🏭',
    color: '#f59e0b',
    persona: 'Gerente de Operações / PCP',
    mission:
      'Assegurar que a operação entregue a demanda com o menor custo, sem gargalos e com processos padronizados, medidos e melhorados continuamente.',
    scope: [
      'Capacidade de atendimento da demanda',
      'Identificação de gargalos (Teoria das Restrições)',
      'Eficiência e qualidade cadastral dos processos',
      'Ciclo de suprimentos e reposição',
      'Custos operacionais e produtividade',
      'Melhoria contínua (PDCA, 5S, BPMN, indicadores de processo)'
    ],
    kpis: [
      'Capacidade de atendimento',
      'Gargalos por produto',
      'Ciclo operacional (dias)',
      'Produtividade (receita por SKU ativo)',
      'Variação de custo de insumo',
      'Itens com margem negativa'
    ],
    typicalQuestions: [
      'Onde está o gargalo da operação?',
      'Consigo atender a demanda do próximo mês?',
      'Quais processos precisam de padronização?',
      'Qual é o ciclo operacional da empresa?',
      'Meu custo de compra está subindo?'
    ],
    routines: [
      { name: 'Reunião de PCP / capacity', cadence: 'Diária (15 min)', focus: 'Rupturas, pedidos do dia, gargalos' },
      { name: 'Revisão de processos', cadence: 'Semanal', focus: 'Tempo de ciclo, retrabalho, exceções' },
      { name: 'Ciclo PDCA', cadence: 'Mensal', focus: 'Um indicador de processo por mês com plano de melhoria' }
    ],
    links: [
      { page: 'purchases', label: 'Compras' },
      { page: 'products', label: 'Produtos' }
    ]
  },
  {
    id: 'comercial',
    name: 'Gestão Comercial e Vendas',
    shortName: 'Comercial e Vendas',
    icon: '🤝',
    color: '#10b981',
    persona: 'Gerente Comercial',
    mission:
      'Aumentar receita com margem, ampliando a carteira, elevando o ticket médio e recuperando clientes inativos por meio de um funil previsível.',
    scope: [
      'Receita, ticket médio e volume de vendas',
      'Curva ABC de clientes e produtos',
      'Carteira ativa, inativa e novos clientes',
      'Recompra, retenção e share of wallet',
      'Política de descontos e metas de vendas',
      'Mix de vendas e desempenho por categoria'
    ],
    kpis: [
      'Receita do mês',
      'Ticket médio',
      'Clientes ativos',
      'Taxa de recompra',
      'Desconto médio concedido',
      'Concentração (top 5 clientes)'
    ],
    typicalQuestions: [
      'Quais clientes estão inativos e devo reativar?',
      'Quem são meus melhores clientes (curva ABC)?',
      'Qual é o ticket médio e como aumentá-lo?',
      'Estou dando desconto demais?',
      'Quais produtos vendem mais?'
    ],
    routines: [
      { name: 'Pipeline review', cadence: 'Semanal', focus: 'Vendas x meta, clientes inativos, oportunidades' },
      { name: 'Blitz de reativação', cadence: 'Mensal', focus: 'Clientes sem compra há mais de 90 dias' },
      { name: 'Análise de mix e preço', cadence: 'Mensal', focus: 'Produtos A/B/C, margem, descontos' }
    ],
    links: [
      { page: 'sales', label: 'Vendas' },
      { page: 'customers', label: 'Clientes' }
    ]
  },
  {
    id: 'marketing',
    name: 'Gestão de Marketing',
    shortName: 'Marketing',
    icon: '📣',
    color: '#ec4899',
    persona: 'Gerente de Marketing',
    mission:
      'Gerar demanda qualificada de forma previsível, medindo custo de aquisição, retenção e valor do cliente para decidir onde investir cada real de marketing.',
    scope: [
      'Aquisição de clientes e CAC',
      'LTV e relação LTV/CAC',
      'Sazonalidade e previsão de demanda',
      'Posicionamento de preço e margem por linha',
      'Matriz BCG do portfólio (estrelas, vacas, interrogações, abacaxis)',
      'Investimento em marketing x retorno'
    ],
    kpis: [
      'Novos clientes por mês',
      'CAC (custo de aquisição)',
      'LTV estimado',
      'LTV/CAC',
      'Investimento em marketing',
      'Coeficiente de sazonalidade'
    ],
    typicalQuestions: [
      'Quanto custa adquirir um cliente?',
      'Qual é o LTV da minha carteira?',
      'Em quais produtos devo investir em divulgação?',
      'Meu marketing está pagando a conta?',
      'Qual mês é o pico de vendas?'
    ],
    routines: [
      { name: 'Revisão de campanhas', cadence: 'Semanal', focus: 'Investimento, novos clientes, CAC' },
      { name: 'Análise de portfólio', cadence: 'Mensal', focus: 'Matriz BCG, produtos estrela e abacaxi' },
      { name: 'Planejamento sazonal', cadence: 'Trimestral', focus: 'Calendário promocional e estoque para picos' }
    ],
    links: [
      { page: 'expenses', label: 'Despesas' },
      { page: 'customers', label: 'Clientes' }
    ]
  },
  {
    id: 'financeiro',
    name: 'Gestão Financeira',
    shortName: 'Financeiro',
    icon: '💰',
    color: '#0ea5e9',
    persona: 'Controller / Gerente Financeiro',
    mission:
      'Proteger o caixa: garantir liquidez, reduzir inadimplência, controlar despesas e manter margem e capital de giro em níveis seguros.',
    scope: [
      'Fluxo de caixa e saldo projetado',
      'Contas a receber, inadimplência e aging',
      'Contas a pagar e prazo médio de fornecedor',
      'Despesas por categoria e controle orçamentário',
      'Margem bruta, operacional e líquida',
      'Capital de giro e ciclo financeiro'
    ],
    kpis: [
      'Saldo de caixa',
      'Inadimplência (R$ e %)',
      'DSO / DPO',
      'Margem líquida',
      'Capital de giro',
      'Despesas do mês'
    ],
    typicalQuestions: [
      'Quanto tenho a receber vencido?',
      'Meu caixa aguenta o próximo mês?',
      'Onde estou gastando demais?',
      'Qual é a margem real dos meus produtos?',
      'Quais contas preciso pagar esta semana?'
    ],
    routines: [
      { name: 'Conciliação de caixa', cadence: 'Diária', focus: 'Entradas, saídas e saldo do dia' },
      { name: 'Régua de cobrança', cadence: 'Semanal', focus: 'Títulos vencidos por faixa de atraso' },
      { name: 'Fechamento financeiro', cadence: 'Mensal', focus: 'DRE, margens, despesas x orçamento' }
    ],
    links: [
      { page: 'cashflow', label: 'Fluxo de Caixa' },
      { page: 'receivable', label: 'Contas a Receber' },
      { page: 'payable', label: 'Contas a Pagar' }
    ]
  },
  {
    id: 'estoque',
    name: 'Gestão de Estoque e Expedição',
    shortName: 'Estoque e Expedição',
    icon: '📦',
    color: '#8b5cf6',
    persona: 'Supervisor de Logística / Almoxarifado',
    mission:
      'Ter o produto certo, na quantidade certa, no momento certo: eliminar ruptura e excesso, acelerar a expedição e reduzir o capital parado.',
    scope: [
      'Giro e cobertura de estoque',
      'Rupturas e itens abaixo do mínimo',
      'Excesso de estoque e capital parado',
      'Curva ABC de estoque e política de reposição',
      'Obsolescência (itens sem venda)',
      'Fila de expedição (pedidos pendentes) e acurácia'
    ],
    kpis: [
      'Valor do estoque',
      'Giro de estoque',
      'Cobertura (dias)',
      'Itens em ruptura',
      'Itens abaixo do mínimo',
      'Pedidos a expedir'
    ],
    typicalQuestions: [
      'O que precisa de reposição urgente?',
      'Quanto dinheiro está parado em estoque?',
      'Quais produtos estão em ruptura?',
      'Qual é o giro do meu estoque?',
      'Quantos pedidos estão aguardando expedição?'
    ],
    routines: [
      { name: 'Check de ruptura', cadence: 'Diária', focus: 'Itens zerados e abaixo do mínimo' },
      { name: 'Fila de expedição', cadence: 'Diária', focus: 'Pedidos pendentes x capacidade de separação' },
      { name: 'Inventário rotativo', cadence: 'Mensal', focus: 'Contagem dos itens A, ajuste de acurácia' },
      { name: 'Revisão de reposição', cadence: 'Mensal', focus: 'Estoque mínimo, lead time e lote de compra' }
    ],
    links: [
      { page: 'products', label: 'Produtos/Estoque' },
      { page: 'purchases', label: 'Compras' }
    ]
  }
];

const DOMAIN_BY_ID = new Map(DOMAINS.map((d) => [d.id, d]));

// Palavras-chave usadas pelo NLU para reconhecer o domínio na mensagem do usuário
const DOMAIN_KEYWORDS = {
  empresarial: ['empresa', 'negócio', 'negocio', 'estratégia', 'estrategia', 'geral', 'global', 'diretor', 'ceo', 'sócios', 'socios', 'dre', 'ponto de equilíbrio', 'equilibrio', 'meta', 'risco', 'riscos', 'saúde', 'saude', 'resumo', 'diagnóstico', 'diagnostico', 'visão geral', 'planejamento'],
  producao: ['produção', 'producao', 'processo', 'processos', 'gargalo', 'gargalos', 'capacidade', 'pcp', 'operação', 'operacao', 'operacional', 'produtividade', 'eficiência', 'eficiencia', 'lead time', 'ciclo', 'pdca', 'bpmn', 'padroniza', 'retrabalho', 'perda', 'perdas', 'fabricação', 'fabricacao', 'linha de produção', 'chão de fábrica', 'oee'],
  comercial: ['venda', 'vendas', 'comercial', 'cliente', 'clientes', 'vendedor', 'ticket', 'ticket médio', 'carteira', 'funil', 'prospecção', 'prospeccao', 'negociação', 'negociacao', 'desconto', 'comissão', 'comissao', 'reativar', 'inadimplente comercial', 'pedidos de venda', 'abc de clientes', 'recompra', 'fideliza'],
  marketing: ['marketing', 'campanha', 'campanhas', 'divulgação', 'divulgacao', 'publicidade', 'propaganda', 'marca', 'tráfego', 'trafego', 'leads', 'lead', 'cac', 'ltv', 'custo de aquisição', 'aquisição', 'aquisicao', 'redes sociais', 'instagram', 'facebook', 'google ads', 'seo', 'sazonalidade', 'promocional', 'promoção', 'promocao', 'posicionamento', 'bcg', 'lançamento', 'lancamento'],
  financeiro: ['financeiro', 'finanças', 'financas', 'caixa', 'fluxo de caixa', 'contas a receber', 'contas a pagar', 'recebível', 'recebiveis', 'inadimplência', 'inadimplencia', 'vencido', 'vencimento', 'cobrança', 'cobranca', 'despesa', 'despesas', 'custo', 'margem', 'lucro', 'lucratividade', 'rentabilidade', 'capital de giro', 'dso', 'dpo', 'imposto', 'tributo', 'boleto', 'pagamento', 'orçamento', 'orcamento', 'saldo'],
  estoque: ['estoque', 'almoxarifado', 'expedição', 'expedicao', 'logística', 'logistica', 'armazen', 'inventário', 'inventario', 'reposição', 'reposicao', 'ruptura', 'falta de produto', 'cobertura', 'giro de estoque', 'curva abc', 'separação', 'separacao', 'envio', 'entrega', 'frete', 'transportadora', 'produto parado', 'obsoleto', 'contagem', 'min_stock', 'estoque mínimo', 'wms']
};

function getDomain(id) {
  return DOMAIN_BY_ID.get(id) || null;
}

function getAllDomains() {
  return DOMAINS;
}

module.exports = { DOMAINS, DOMAIN_BY_ID, DOMAIN_KEYWORDS, getDomain, getAllDomains };
