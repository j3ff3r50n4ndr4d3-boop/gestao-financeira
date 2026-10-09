// Módulos 19 a 22 - Segurança e LGPD, Deploy, API e Projeto Final
module.exports = [

  // ==========================================================
  // MÓDULO 19 - SEGURANÇA E LGPD
  // ==========================================================
  {
    id: 'm19',
    title: 'Segurança da Informação e LGPD',
    icon: '🔐',
    theme: 'Tecnologia',
    level: 'Avançado',
    summary: 'Autenticação JWT, hash de senha, rate limiting, headers de segurança, backup e privacidade.',
    lessons: [
      {
        id: 'm19a1',
        title: 'Como o sistema protege o acesso: JWT, bcrypt e rate limiting',
        duration: 12,
        goal: 'Entender o fluxo de autenticação e as camadas de proteção já implementadas.',
        blocks: [
          { t: 'p', text: 'O ERP usa autenticação por token JWT com senha armazenada como hash bcrypt. O fluxo é o padrão usado por sistemas SaaS profissionais.' },
          { t: 'h', text: 'Fluxo de login' },
          { t: 'steps', items: [
            'O usuário envia e-mail e senha para POST /api/auth/login',
            'O servidor busca o usuário e compara a senha com o hash bcrypt (10 rounds)',
            'Se válida, gera um token JWT com validade de 7 dias',
            'O navegador guarda o token e envia no header Authorization: Bearer em cada chamada',
            'O middleware valida o token em todas as rotas protegidas'
          ] },
          { t: 'h', text: 'Camadas de proteção implementadas' },
          { t: 'table', head: ['Camada', 'Tecnologia', 'O que evita'], rows: [
            ['Hash de senha', 'bcryptjs com 10 rounds', 'Vazamento de senha em texto puro'],
            ['Token de sessão', 'jsonwebtoken com expiração de 7 dias', 'Sessão eterna se o token for copiado'],
            ['Headers de segurança', 'helmet', 'Clickjacking, MIME sniffing e outros vetores'],
            ['Limite de requisições', 'express-rate-limit (1000 req / 15 min)', 'Força bruta e abuso da API'],
            ['Origem permitida', 'cors', 'Chamadas de origens não autorizadas'],
            ['Compressão', 'compression', 'Tráfego excessivo e lentidão']
          ] },
          { t: 'warn', text: 'A senha demo admin123 existe apenas para avaliação. Antes de colocar o sistema em produção com dados reais, crie usuário próprio com senha forte e troque o segredo do JWT pela variável de ambiente JWT_SECRET.' },
          { t: 'h', text: 'Boas práticas de senha' },
          { t: 'checklist', items: [
            'Mínimo de 12 caracteres, com maiúsculas, minúsculas, números e símbolos',
            'Nunca reutilizar senha de outro serviço',
            'Usar gerenciador de senhas',
            'Ativar verificação em duas etapas quando disponível',
            'Trocar imediatamente ao suspeitar de acesso indevido'
          ] },
          { t: 'tip', text: 'Nunca compartilhe login. Cada pessoa da equipe deve ter usuário próprio: sem isso não há rastreabilidade nem responsabilidade.' }
        ],
        quiz: [
          { q: 'A senha do usuário é armazenada no banco como:', a: ['Texto puro', 'Hash bcrypt', 'Base64', 'Criptografia reversível'], r: 1, e: 'bcrypt é um hash unidirecional com salt: não dá para recuperar a senha original.' },
          { q: 'O token JWT gerado no login tem validade de:', a: ['30 minutos', '7 dias', '1 ano', 'Sessão do navegador apenas'], r: 1, e: 'O middleware assina o token com expiresIn de 7 dias.' },
          { q: 'O rate limiting de 1000 requisições por 15 minutos serve para:', a: ['Acelerar o sistema', 'Reduzir força bruta e abuso da API', 'Comprimir respostas', 'Guardar cache'], r: 1, e: 'Limita tentativas repetidas e uso abusivo dos endpoints.' }
        ]
      },
      {
        id: 'm19a2',
        title: 'LGPD aplicada ao ERP',
        duration: 12,
        goal: 'Aplicar os princípios da LGPD ao tratamento de dados de clientes, fornecedores e usuários.',
        blocks: [
          { t: 'p', text: 'A Lei Geral de Proteção de Dados (Lei 13.709/2018) se aplica a qualquer empresa que trate dados pessoais, inclusive pequenas. No ERP, dados pessoais estão em clientes, fornecedores e usuários do sistema.' },
          { t: 'h', text: 'Os princípios na prática' },
          { t: 'table', head: ['Princípio', 'Aplicação no ERP'], rows: [
            ['Finalidade', 'Coletar dados apenas para venda, cobrança e entrega'],
            ['Minimização', 'Não exigir campos que não geram decisão'],
            ['Necessidade', 'Revisar o cadastro e remover campos supérfluos'],
            ['Segurança', 'Acesso restrito, hash de senha e backup protegido'],
            ['Transparência', 'Avisar o cliente sobre o uso dos dados na política de privacidade'],
            ['Prestação de contas', 'Registrar incidentes e manter evidências de conformidade']
          ] },
          { t: 'h', text: 'Direitos do titular que você precisa atender' },
          { t: 'list', items: [
            'Confirmação de que há tratamento e acesso aos dados',
            'Correção de dados incompletos ou incorretos',
            'Anonimização, bloqueio ou eliminação de dados desnecessários',
            'Portabilidade para outro fornecedor de serviço',
            'Eliminação dos dados tratados com consentimento, respeitadas as obrigações legais de guarda',
            'Informação sobre compartilhamento com terceiros'
          ] },
          { t: 'h', text: 'Checklist mínimo de conformidade' },
          { t: 'checklist', items: [
            'Política de privacidade publicada e acessível',
            'Base legal identificada para cada dado coletado',
            'Controle de acesso por perfil de usuário',
            'Backup com acesso restrito e criptografia em trânsito (HTTPS)',
            'Contrato com operadores (contabilidade, cobrança, nuvem) prevendo proteção de dados',
            'Plano de resposta a incidente com comunicação à ANPD quando houver risco relevante'
          ] },
          { t: 'warn', text: 'Vazamento de dados pode gerar multa de até 2% do faturamento no Brasil, limitada a R$ 50 milhões por infração, além de dano reputacional. Segurança não é item opcional.' },
          { t: 'steps', items: [
            'Revise os campos dos cadastros de clientes e fornecedores e elimine o que não é necessário',
            'Publique uma política de privacidade simples e clara',
            'Restrinja o acesso ao sistema por usuário individual, nunca compartilhado',
            'Documente onde os dados estão armazenados e quem tem acesso'
          ] }
        ],
        quiz: [
          { q: 'O princípio da finalidade exige:', a: ['Coletar o máximo de dados', 'Coletar dados apenas para uma finalidade determinada', 'Apagar tudo em 6 meses', 'Publicar os dados'], r: 1, e: 'Cada dado precisa de finalidade específica e informada ao titular.' },
          { q: 'A multa máxima por infração à LGPD é de:', a: ['R$ 10 mil fixos', 'Até 2% do faturamento no Brasil, limitada a R$ 50 milhões por infração', '1% do lucro', 'Não há multa prevista'], r: 1, e: 'É a sanção administrativa prevista na lei, além de outras medidas.' },
          { q: 'O pedido de eliminação de dados de um cliente deve ser atendido:', a: ['Sempre, sem exceção', 'Sim, ressalvadas as obrigações legais de guarda fiscal e contábil', 'Nunca', 'Somente com ordem judicial'], r: 1, e: 'O direito existe, mas documentos fiscais têm prazo legal de guarda.' }
        ]
      },
      {
        id: 'm19a3',
        title: 'Backup, recuperação e plano de continuidade',
        duration: 10,
        goal: 'Definir rotina de backup, testar a restauração e montar um plano mínimo de continuidade.',
        blocks: [
          { t: 'p', text: 'O banco de dados SQLite do sistema fica em um arquivo na pasta data/. Backup é copiar esse arquivo com regularidade e, principalmente, testar a restauração.' },
          { t: 'h', text: 'Regra 3-2-1 de backup' },
          { t: 'list', items: [
            '3 cópias dos dados',
            '2 meios diferentes de armazenamento (servidor e nuvem, por exemplo)',
            '1 cópia fora do local (nuvem ou mídia externa)'
          ] },
          { t: 'table', head: ['Rotina', 'Frequência', 'Retenção'], rows: [
            ['Backup diário automático', 'Todo dia, fora do horário comercial', '30 dias'],
            ['Backup semanal completo', 'Semanal', '12 semanas'],
            ['Backup mensal arquivado', 'Mensal', '12 meses'],
            ['Teste de restauração', 'Trimestral', 'Registrado em ata']
          ] },
          { t: 'h', text: 'Plano mínimo de continuidade' },
          { t: 'steps', items: [
            'Documente onde o sistema está hospedado e quem tem acesso',
            'Defina o responsável pelo backup e o responsável substituto',
            'Estabeleça o tempo máximo aceitável sem sistema (por exemplo 4 horas)',
            'Mantenha uma forma manual de registrar vendas durante a indisponibilidade',
            'Teste a restauração a cada trimestre e registre o resultado'
          ] },
          { t: 'warn', text: 'Backup nunca testado é uma promessa, não um backup. A restauração precisa ser exercitada antes de ser necessária.' },
          { t: 'tip', text: 'Automatize o backup com um agendador do sistema operacional ou do provedor de hospedagem. Backup manual é backup esquecido.' }
        ],
        quiz: [
          { q: 'A regra 3-2-1 de backup significa:', a: ['3 servidores, 2 senhas, 1 acesso', '3 cópias, 2 meios diferentes, 1 fora do local', '3 dias, 2 horas, 1 minuto', '3 usuários, 2 sistemas, 1 banco'], r: 1, e: 'É o padrão consagrado de redundância de cópias.' },
          { q: 'Um backup que nunca foi restaurado em teste:', a: ['É garantia suficiente', 'É apenas uma promessa, precisa ser testado', 'Dispensa cópias extras', 'Deve ser feito mensalmente'], r: 1, e: 'Somente o teste comprova que a recuperação funciona.' },
          { q: 'O plano de continuidade deve definir:', a: ['Apenas quem faz o backup', 'Tempo máximo sem sistema, responsáveis e processo manual de contingência', 'Somente o custo da nuvem', 'O preço do plano'], r: 1, e: 'Continuidade é manter a operação funcionando durante a indisponibilidade.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 20 - DEPLOY
  // ==========================================================
  {
    id: 'm20',
    title: 'Publicação e Operação do Sistema',
    icon: '🚀',
    theme: 'Tecnologia',
    level: 'Avançado',
    summary: 'Railway, Render, Vercel, Heroku, DigitalOcean e VPS: escolha, configuração e manutenção.',
    lessons: [
      {
        id: 'm20a1',
        title: 'Escolhendo onde hospedar o ERP',
        duration: 11,
        goal: 'Comparar as opções de hospedagem e escolher a adequada ao porte e ao orçamento.',
        blocks: [
          { t: 'table', head: ['Opção', 'Custo', 'Pontos fortes', 'Atenção'], rows: [
            ['Railway', 'Crédito mensal grátis e planos pagos', 'Suporta SQLite nativamente, deploy direto do GitHub', 'Recursos limitados no plano inicial'],
            ['Render', 'Plano grátis', 'Simples, build e start automáticos', 'Instância grátis pode dormir por inatividade'],
            ['Vercel', 'Grátis para projetos pessoais', 'Rápido e ótimo para frontend', 'Não suporta SQLite persistente: migrar para PostgreSQL'],
            ['Heroku', 'Pago', 'Ecossistema maduro', 'Custo maior para escalar'],
            ['DigitalOcean / VPS', 'A partir de poucos dólares', 'Controle total e custo previsível', 'Exige administração de servidor']
          ] },
          { t: 'h', text: 'Critérios de escolha' },
          { t: 'list', items: [
            'Persistência de dados: o SQLite precisa de disco persistente',
            'Facilidade de deploy: integração direta com o repositório GitHub',
            'Variáveis de ambiente: PORT, NODE_ENV, JWT_SECRET e DATABASE_URL',
            'Escala prevista: número de usuários simultâneos',
            'Custo mensal e previsibilidade da fatura',
            'Suporte a HTTPS automático'
          ] },
          { t: 'warn', text: 'Servidor sem disco persistente apaga o banco a cada deploy. Confirme antes: se o provedor não persiste arquivo local, migre para PostgreSQL.' },
          { t: 'steps', items: [
            'Liste as opções com custo mensal estimado',
            'Verifique se há disco persistente para o arquivo do banco',
            'Confirme a configuração de variáveis de ambiente',
            'Teste o deploy com os dados demo antes de migrar dados reais'
          ] }
        ],
        quiz: [
          { q: 'O ponto mais crítico ao escolher hospedagem para este ERP é:', a: ['A cor do painel', 'A persistência de disco para o banco SQLite', 'O número de estrelas no GitHub', 'A linguagem do site'], r: 1, e: 'Sem disco persistente, o arquivo do banco é perdido a cada reinício.' },
          { q: 'Na Vercel, para usar banco em produção, o recomendado é:', a: ['Usar SQLite normalmente', 'Migrar para PostgreSQL', 'Desativar o banco', 'Usar planilha'], r: 1, e: 'A plataforma não mantém SQLite persistente em produção.' },
          { q: 'Antes de migrar dados reais, você deve:', a: ['Publicar direto', 'Testar o deploy com dados demo', 'Desativar o login', 'Aumentar o preço'], r: 1, e: 'Teste com dados demo reduz risco de perda e erro de configuração.' }
        ]
      },
      {
        id: 'm20a2',
        title: 'Deploy passo a passo e configuração de produção',
        duration: 12,
        goal: 'Executar o deploy, configurar variáveis, domínio e HTTPS.',
        blocks: [
          { t: 'h', text: 'Passo a passo (plataforma com integração GitHub)' },
          { t: 'steps', items: [
            'Faça login na plataforma com sua conta GitHub',
            'Crie um novo projeto a partir do repositório gestao-financeira',
            'Configure Build Command: npm install',
            'Configure Start Command: npm start',
            'Adicione as variáveis: PORT=3000, NODE_ENV=production e JWT_SECRET com valor forte e aleatório',
            'Faça o deploy e aguarde a URL ser gerada',
            'Acesse a URL, faça login e teste uma venda de ponta a ponta'
          ] },
          { t: 'h', text: 'Checklist de produção' },
          { t: 'checklist', items: [
            'JWT_SECRET definido como variável de ambiente, nunca no código',
            'Usuário admin demo trocado por usuário real com senha forte',
            'HTTPS ativo com certificado válido',
            'Domínio próprio apontando para o serviço',
            'Backup automático do arquivo de banco configurado',
            'Monitoramento de disponibilidade configurado',
            'Rate limiting ativo',
            'Teste de venda, recebimento e despesa executado com sucesso'
          ] },
          { t: 'h', text: 'Domínio e HTTPS' },
          { t: 'list', items: [
            'Registre um domínio .com.br ou .com em registrador oficial',
            'Aponte o registro DNS para o endereço informado pela plataforma',
            'Ative o certificado SSL automático da plataforma',
            'Force redirecionamento de HTTP para HTTPS',
            'Aguarde a propagação do DNS, que pode levar algumas horas'
          ] },
          { t: 'warn', text: 'Nunca publique o sistema com a senha demo ativa e sem JWT_SECRET próprio. Isso equivale a deixar a porta da empresa aberta.' },
          { t: 'tip', text: 'Anote as credenciais da hospedagem em um gerenciador de senhas, com acesso do responsável e de um substituto.' }
        ],
        quiz: [
          { q: 'O JWT_SECRET em produção deve:', a: ['Ficar fixo no código', 'Ser definido como variável de ambiente com valor forte', 'Ser igual ao da demo', 'Ser removido'], r: 1, e: 'Segredo no código é segredo público: quem tem o repositório pode forjar tokens.' },
          { q: 'O Start Command do projeto é:', a: ['npm run dev', 'npm start', 'node index.js', 'npm build'], r: 1, e: 'O package.json define start como node server.js.' },
          { q: 'Após o deploy, o teste obrigatório é:', a: ['Apenas abrir a página', 'Executar uma venda de ponta a ponta e conferir os relatórios', 'Trocar a cor do tema', 'Reiniciar o servidor'], r: 1, e: 'O teste de ponta a ponta comprova que banco, API e interface funcionam juntos.' }
        ]
      },
      {
        id: 'm20a3',
        title: 'Monitoramento, atualização e suporte',
        duration: 10,
        goal: 'Estabelecer rotina de monitoramento, atualização e atendimento ao usuário.',
        blocks: [
          { t: 'h', text: 'O que monitorar' },
          { t: 'table', head: ['Item', 'Como', 'Alerta'], rows: [
            ['Disponibilidade', 'Verificação externa a cada 5 minutos', 'Indisponibilidade por mais de 2 minutos'],
            ['Tempo de resposta', 'Medição da página inicial e de uma API', 'Acima de 2 segundos'],
            ['Espaço em disco', 'Painel do provedor', 'Acima de 80% de uso'],
            ['Erro de aplicação', 'Logs do servidor', 'Erros repetidos no mesmo endpoint'],
            ['Backup', 'Confirmação diária de execução', 'Backup não executado']
          ] },
          { t: 'h', text: 'Rotina de atualização' },
          { t: 'steps', items: [
            'Atualize as dependências em ambiente de teste antes de produção',
            'Rode a aplicação localmente e execute os testes de fluxo',
            'Faça backup do banco antes do deploy',
            'Publique fora do horário comercial',
            'Confira os logs após o deploy e mantenha o plano de reversão pronto'
          ] },
          { t: 'h', text: 'Estrutura de suporte por plano' },
          { t: 'table', head: ['Plano', 'Canal', 'Prazo de resposta'], rows: [
            ['Starter', 'E-mail', 'Até 48 horas úteis'],
            ['Professional', 'E-mail prioritário', 'Até 12 horas úteis'],
            ['Enterprise', 'Canal dedicado 24/7', 'Até 2 horas']
          ] },
          { t: 'warn', text: 'Deploy sem backup prévio é roleta russa com dados de clientes. O backup é o único plano de reversão que realmente funciona.' },
          { t: 'tip', text: 'Mantenha um registro de mudanças (changelog) visível para o cliente: transparência reduz chamados e aumenta a confiança.' }
        ],
        quiz: [
          { q: 'Antes de qualquer deploy em produção é obrigatório:', a: ['Avisar o cliente', 'Fazer backup do banco', 'Trocar o domínio', 'Aumentar o rate limit'], r: 1, e: 'Backup é o plano de reversão real em caso de falha.' },
          { q: 'O alerta de espaço em disco deve disparar quando o uso passa de:', a: ['50%', '80%', '100%', '20%'], r: 1, e: 'Abaixo de 100% ainda há tempo de agir.' },
          { q: 'As atualizações de dependências devem ser testadas:', a: ['Direto em produção', 'Em ambiente de teste antes de produção', 'Somente uma vez por ano', 'Nunca'], r: 1, e: 'Teste prévio evita quebra de funcionalidade em ambiente real.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 21 - API
  // ==========================================================
  {
    id: 'm21',
    title: 'API e Integrações',
    icon: '🔌',
    theme: 'Tecnologia',
    level: 'Avançado',
    summary: 'Endpoints REST, autenticação por token, exemplos de chamada e automações úteis.',
    lessons: [
      {
        id: 'm21a1',
        title: 'Consumindo a API do ERP',
        duration: 12,
        goal: 'Autenticar e consultar os principais endpoints da API REST.',
        blocks: [
          { t: 'p', text: 'O ERP expõe uma API REST em JSON. Todas as rotas de negócio exigem token de autenticação no header Authorization.' },
          { t: 'h', text: 'Autenticação' },
          { t: 'steps', items: [
            'Faça POST em /api/auth/login com JSON contendo email e password',
            'Guarde o campo token da resposta',
            'Envie em todas as chamadas o header Authorization: Bearer SEU_TOKEN',
            'Se receber 401 ou 403, refaça o login: o token expirou'
          ] },
          { t: 'h', text: 'Principais endpoints' },
          { t: 'table', head: ['Método e rota', 'Função'], rows: [
            ['POST /api/auth/login', 'Autentica e retorna o token'],
            ['POST /api/auth/register', 'Cria novo usuário'],
            ['GET /api/dashboard/kpis', 'Indicadores do período'],
            ['GET /api/dashboard/chart/revenue', 'Receita mensal para gráficos'],
            ['GET /api/customers', 'Lista clientes'],
            ['POST /api/customers', 'Cria cliente'],
            ['GET /api/products', 'Lista produtos e estoque'],
            ['GET /api/sales / POST /api/sales', 'Lista e cria vendas'],
            ['GET /api/financial/receivable', 'Contas a receber'],
            ['GET /api/financial/payable', 'Contas a pagar'],
            ['GET /api/financial/cashflow', 'Fluxo de caixa'],
            ['GET /api/financial/dre', 'DRE do período'],
            ['GET /api/subscriptions/plans', 'Planos disponíveis (rota pública)']
          ] },
          { t: 'h', text: 'Exemplo de chamada autenticada' },
          { t: 'p', text: 'Com o token em mãos, uma consulta de clientes é uma requisição GET para /api/customers com o header Authorization: Bearer e o valor do token. A resposta é uma lista JSON com id, nome, e-mail, telefone e documento de cada cliente.' },
          { t: 'warn', text: 'O token equivale à senha do usuário enquanto é válido. Nunca coloque token em URL, em log público ou em código publicado em repositório aberto.' },
          { t: 'steps', items: [
            'Faça login pela interface e copie o token salvo no navegador',
            'Consulte /api/dashboard/kpis usando uma ferramenta de API',
            'Consulte /api/financial/dre e compare com a tela do sistema',
            'Registre em documentação interna quais integrações consomem a API'
          ] }
        ],
        quiz: [
          { q: 'A rota /api/subscriptions/plans é pública porque:', a: ['É um erro de segurança', 'Permite exibir os planos antes do login', 'Não tem dados relevantes e é usada na página de venda', 'As respostas são vazias'], r: 1, e: 'Ela é montada antes do middleware de autenticação justamente para exibir planos a visitantes.' },
          { q: 'Um retorno 401 em uma chamada autenticada indica:', a: ['Servidor fora do ar', 'Token ausente, inválido ou expirado', 'Rota inexistente', 'Banco vazio'], r: 1, e: '401 é erro de autenticação: é preciso refazer o login.' },
          { q: 'O token de acesso deve ser enviado:', a: ['Na URL', 'No header Authorization com o prefixo Bearer', 'No corpo da requisição sempre', 'Em cookie sem proteção'], r: 1, e: 'É o padrão usado pelo middleware de autenticação do sistema.' }
        ]
      },
      {
        id: 'm21a2',
        title: 'Automações e integrações que geram valor',
        duration: 11,
        goal: 'Planejar automações de cobrança, alerta e relatório a partir da API.',
        blocks: [
          { t: 'h', text: 'Automações de alto retorno' },
          { t: 'table', head: ['Automação', 'Gatilho', 'Benefício'], rows: [
            ['Lembrete de vencimento', '3 dias antes do vencimento de conta a receber', 'Reduz atraso por esquecimento'],
            ['Cobrança automática', 'D+1, D+7 e D+15 de atraso', 'Padroniza e acelera a régua de cobrança'],
            ['Alerta de estoque baixo', 'Estoque atual abaixo do mínimo', 'Evita ruptura de venda'],
            ['Relatório semanal por e-mail', 'Toda sexta-feira', 'Mantém sócios e gestores alinhados'],
            ['Alerta de caixa negativo previsto', 'Projeção de caixa negativa', 'Permite agir antes do vencimento'],
            ['Backup diário do banco', 'Todo dia fora do horário comercial', 'Proteção contra perda de dados']
          ] },
          { t: 'h', text: 'Integrações típicas' },
          { t: 'list', items: [
            'Contabilidade: exportação de vendas e despesas para o escritório contábil',
            'Gateway de pagamento: conciliação automática de recebimentos',
            'Emissão de nota fiscal: envio dos dados da venda para o emissor de NF-e',
            'CRM: sincronização de clientes e oportunidades',
            'E-commerce: importação de pedidos e atualização de estoque'
          ] },
          { t: 'h', text: 'Boas práticas de integração' },
          { t: 'checklist', items: [
            'Usar usuário de sistema dedicado para cada integração, não o usuário pessoal',
            'Registrar em log cada chamada automática com data e resultado',
            'Tratar falha com nova tentativa e alerta ao responsável',
            'Nunca armazenar token em texto puro',
            'Testar a integração em ambiente separado antes de ativar em produção'
          ] },
          { t: 'warn', text: 'Automação sem tratamento de erro silencia problemas. Toda integração precisa de log e de alerta quando falha.' },
          { t: 'tip', text: 'Comece pela automação de lembrete de vencimento: é a que dá retorno financeiro mais rápido e mais fácil de medir.' }
        ],
        quiz: [
          { q: 'A automação com retorno financeiro mais rápido costuma ser:', a: ['Backup diário', 'Lembrete de vencimento de contas a receber', 'Relatório semanal', 'Alerta de estoque'], r: 1, e: 'Reduz atraso por esquecimento e antecipa a entrada de caixa.' },
          { q: 'Integrações automáticas devem usar:', a: ['O login do gestor', 'Usuário de sistema dedicado com token protegido', 'Token público', 'Nenhuma autenticação'], r: 1, e: 'Usuário dedicado permite rastreabilidade e revogação independente.' },
          { q: 'Quando uma integração falha, o sistema deve:', a: ['Ignorar silenciosamente', 'Registrar em log, tentar novamente e alertar o responsável', 'Desativar a integração', 'Reiniciar o servidor'], r: 1, e: 'Falha silenciosa é a forma mais comum de problema não detectado.' }
        ]
      }
    ]
  },

  // ==========================================================
  // MÓDULO 22 - PROJETO FINAL
  // ==========================================================
  {
    id: 'm22',
    title: 'Projeto Final e Certificação',
    icon: '🏆',
    theme: 'Conclusão',
    level: 'Avançado',
    summary: 'Diagnóstico completo da empresa, plano de ação de 90 dias e emissão do certificado.',
    lessons: [
      {
        id: 'm22a1',
        title: 'Projeto final: diagnóstico e plano de ação de 90 dias',
        duration: 15,
        goal: 'Aplicar todo o curso em um diagnóstico real e um plano executável de 90 dias.',
        blocks: [
          { t: 'p', text: 'O projeto final consolida o curso em um entregável único: o diagnóstico financeiro da sua empresa com um plano de ação de 90 dias, construído inteiramente com os dados do ERP.' },
          { t: 'h', text: 'Parte 1 - Diagnóstico (use os módulos indicados)' },
          { t: 'table', head: ['Item do diagnóstico', 'Onde obter', 'Módulo'], rows: [
            ['Receita, despesa e lucro do mês', 'Dashboard e DRE', '2 e 13'],
            ['Margem bruta e líquida', 'DRE', '13'],
            ['Ticket médio e número de vendas', 'Dashboard', '2'],
            ['Ponto de equilíbrio em receita', 'Despesas fixas e margem de contribuição', '14'],
            ['Índice de inadimplência', 'Contas a Receber', '9'],
            ['Ciclo financeiro em dias', 'PME, PMR e PMP', '10'],
            ['Giro e cobertura de estoque', 'Produtos e Vendas', '6'],
            ['Produtos de maior e menor contribuição', 'Produtos e Itens de venda', '14'],
            ['Projeção de caixa de 13 semanas', 'Contas a pagar, a receber e despesas', '12']
          ] },
          { t: 'h', text: 'Parte 2 - Plano de ação de 90 dias' },
          { t: 'steps', items: [
            'Escolha 3 problemas prioritários identificados no diagnóstico',
            'Para cada um, defina a ação, o responsável, o prazo e o indicador de sucesso',
            'Estabeleça a meta de cada indicador ao final dos 90 dias',
            'Defina a rotina de acompanhamento: diário, semanal e mensal',
            'Registre tudo em um documento de uma página e revise semanalmente'
          ] },
          { t: 'h', text: 'Modelo de plano (exemplo)' },
          { t: 'table', head: ['Problema', 'Ação', 'Responsável', 'Prazo', 'Indicador de sucesso'], rows: [
            ['Inadimplência de 18%', 'Implantar régua de cobrança D-3, D+1, D+7 e D+15', 'Financeiro', '30 dias', 'Inadimplência abaixo de 10%'],
            ['Margem bruta de 28%', 'Reprecificar os 10 produtos de maior giro com markup divisor', 'Comercial', '45 dias', 'Margem bruta acima de 34%'],
            ['Caixa negativo previsto na semana 6', 'Renegociar prazo com 2 fornecedores principais', 'Diretoria', '15 dias', 'Projeção positiva nas 13 semanas']
          ] },
          { t: 'warn', text: 'Diagnóstico sem plano de ação é apenas um retrato do problema. Cada número do diagnóstico precisa virar uma linha do plano com dono e prazo.' },
          { t: 'tip', text: 'Apresente o plano para alguém de fora da operação: perguntas ingênuas revelam premissas fracas.' }
        ],
        quiz: [
          { q: 'O projeto final do curso exige:', a: ['Apenas responder quizzes', 'Diagnóstico financeiro da empresa e plano de ação de 90 dias', 'Escrever código', 'Contratar consultoria'], r: 1, e: 'O entregável é o diagnóstico com plano executável, feito com os dados do ERP.' },
          { q: 'Cada problema prioritário do plano deve ter:', a: ['Somente a descrição', 'Ação, responsável, prazo e indicador de sucesso', 'Apenas o prazo', 'Somente o responsável'], r: 1, e: 'Sem esses quatro elementos, o plano não é executável nem mensurável.' },
          { q: 'A projeção de caixa do diagnóstico deve cobrir:', a: ['4 semanas', '13 semanas', '12 meses', '1 semana'], r: 1, e: '13 semanas é o horizonte definido no módulo de fluxo de caixa.' }
        ]
      },
      {
        id: 'm22a2',
        title: 'Certificação, próximos passos e educação continuada',
        duration: 9,
        goal: 'Emitir o certificado e organizar a rotina de atualização contínua.',
        blocks: [
          { t: 'p', text: 'Com 100% das aulas concluídas e média mínima de 70% nos quizzes, o certificado de Especialista em Gestão Financeira com ERP, com carga de 18 horas, é liberado automaticamente na página do curso, com código de verificação e data de emissão.' },
          { t: 'h', text: 'Como emitir' },
          { t: 'steps', items: [
            'Abra o módulo Curso na barra lateral',
            'Confira a barra de progresso e a média dos quizzes no topo da página',
            'Ao atingir os requisitos, o cartão do certificado é exibido',
            'Use o botão de impressão para salvar em PDF',
            'Guarde o código de verificação para consulta futura'
          ] },
          { t: 'h', text: 'Plano de educação continuada' },
          { t: 'table', head: ['Periodicidade', 'Ação'], rows: [
            ['Diária', 'Ritual de 15 minutos no dashboard'],
            ['Semanal', 'Painel de metas e revisão da projeção de caixa'],
            ['Mensal', 'Fechamento de DRE e definição de prioridades'],
            ['Trimestral', 'Revisão de preços, limites de crédito e teste de restauração de backup'],
            ['Semestral', 'Revisão de política de crédito, caixa mínimo e contratos'],
            ['Anual', 'Revisão do plano de negócios, metas e projeção de 12 meses']
          ] },
          { t: 'h', text: 'Próximos temas sugeridos' },
          { t: 'list', items: [
            'Emissão de notas fiscais e obrigações acessórias',
            'Integração bancária e conciliação automática',
            'Precificação avançada por elasticidade de demanda',
            'Valuation e captação de investimento',
            'Gestão de pessoas e remuneração variável'
          ] },
          { t: 'tip', text: 'O certificado é o começo. O que diferencia o gestor é a disciplina de fechar o mês todo mês e decidir com base no que os números mostram.' }
        ],
        quiz: [
          { q: 'O certificado é liberado quando:', a: ['O curso é comprado', 'Há 100% das aulas concluídas e média mínima de 70% nos quizzes', 'O usuário é administrador', 'Após 30 dias de acesso'], r: 1, e: 'São as duas condições definidas na regra de certificação.' },
          { q: 'A revisão de preços e limites de crédito deve ocorrer:', a: ['Diariamente', 'Trimestralmente', 'Nunca', 'Somente no fim do ano'], r: 1, e: 'Trimestre é o ciclo adequado para rever preço e crédito.' },
          { q: 'O fechamento mensal serve para:', a: ['Cumprir burocracia', 'Definir prioridades e ações do mês seguinte', 'Trocar o plano do sistema', 'Atualizar o domínio'], r: 1, e: 'O fechamento só vale se terminar em decisão e ação.' }
        ]
      }
    ]
  }
];
