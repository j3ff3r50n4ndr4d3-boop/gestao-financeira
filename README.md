# Eficiência Produtiva — OEE para Confecção

Sistema online para medir a eficiência produtiva de uma fábrica de roupas.
O indicador central é o **OEE** (*Overall Equipment Effectiveness*) aplicado à célula de
costura, decomposto em **Disponibilidade × Desempenho × Qualidade**.

Além do OEE, o sistema cobre a cadeia industrial de tempos e métodos: **cronometragem por
produto**, **sequência operacional**, **balanceamento de linha** e **acompanhamento da
produção** diária, mensal, individual e por equipe.

A aplicação já sobe populada com dados de exemplo (6 células de produção, 10 modelos com
sequência cronometrada, 3 equipes com 36 operadores e 45 dias de histórico), para que o
painel possa ser explorado imediatamente.

---

## Como rodar

Requisito único: **Node.js 22.5 ou superior** (usa o módulo nativo `node:sqlite`).
Não há dependências de terceiros — `npm install` não é necessário.

```bash
npm start          # sobe em http://localhost:3000 (e semeia a base se estiver vazia)
npm run dev        # o mesmo, com recarga automática a cada alteração
npm test           # 44 testes: motor de OEE, API e frontend
npm run seed       # recria a base com dados de exemplo (apaga o que estiver gravado)
```

Variáveis de ambiente opcionais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `EFICIENCIA_DB` | `data/eficiencia.db` | Caminho do banco SQLite |

---

## O que o sistema mede

### Os três fatores

| Fator | Fórmula | Pergunta que responde |
|---|---|---|
| **Disponibilidade** | tempo de operação ÷ tempo planejado | A linha ficou rodando o tempo que deveria? |
| **Desempenho** | peças produzidas ÷ peças teóricas | A linha produziu no ritmo do padrão? |
| **Qualidade** | peças boas ÷ peças produzidas | O que foi produzido pode ser vendido? |

```
OEE = Disponibilidade × Desempenho × Qualidade
```

**Tempo planejado** = duração do turno − pausas planejadas (refeição, intervalos, DDS).
**Tempo de operação** = tempo planejado − paradas não planejadas (quebra, setup, falta de
material, ausência de operador).

Paradas **planejadas** registradas no apontamento saem do tempo planejado e *não* penalizam a
disponibilidade — é o tratamento correto: ninguém perde eficiência por almoçar.

### Tempo ciclo ideal e o papel do SAM

Em confecção o padrão de tempo da peça é o **SAM** (*Standard Allowed Minutes*), a soma dos
tempos padrão de todas as operações de costura. O tempo ciclo ideal da célula é:

```
tempo ciclo ideal = SAM da peça ÷ número de operadores da célula
```

Uma linha balanceada de 12 operadores costurando peça de SAM 18 min entrega
**1 peça a cada 1,5 min**. Em 360 min de operação deveria entregar 240 peças.

> Se o desempenho ficar persistentemente acima de 100%, o SAM cadastrado está defasado.
> O sistema sinaliza esse caso e **limita o desempenho a 100% no cálculo do OEE**, para que
> um padrão errado não infle artificialmente o indicador.

### Exemplo completo

Turno de 480 min com 60 min de refeição → **420 min planejados**.
A linha parou 60 min → **360 min de operação** (disponibilidade 85,7%).
Produziu 216 peças contra 240 teóricas (desempenho 90%) e refugou 6 (qualidade 97,2%).

```
OEE = 0,857 × 0,90 × 0,972 = 75,0%
```

As perdas somam 105 min — 60 de indisponibilidade, 36 de ritmo abaixo do padrão e 9 de
refugo — o que a R$ 240/h representa **R$ 420 perdidos no turno**.

### Consolidação de período

O OEE consolidado de várias linhas ou dias **não é a média dos OEEs**. Cada fator é ponderado
pelo próprio denominador:

- disponibilidade → tempo planejado total
- desempenho → tempo de operação total
- qualidade → total de peças produzidas

Isso evita que uma célula pequena distorça o resultado da fábrica.

> Detalhe matemático: como `OEE = peças boas × tempo ciclo ideal ÷ tempo planejado`
> (quando o desempenho não passa de 100%), se **todas** as sessões tiverem o mesmo tempo
> planejado e o mesmo tempo ciclo ideal, o consolidado ponderado coincide com a média
> aritmética. A diferença só aparece quando há diferença de escala — e é justamente por isso
> que a ponderação é necessária.

### As 6 grandes perdas

O sistema classifica cada parada e quantifica as seis perdas clássicas em minutos e em reais:
quebras e falhas, setup e ajustes, paradas menores, ritmo reduzido, defeitos de produção e
tempo não programado.

### Metas de referência

| Indicador | Crítico | Aceitável | Excelência |
|---|---|---|---|
| OEE | < 65% | 65 – 85% | ≥ 85% |
| Disponibilidade | < 80% | 80 – 90% | ≥ 90% |
| Desempenho | < 80% | 80 – 95% | ≥ 95% |
| Qualidade | < 95% | 95 – 99% | ≥ 99% |

As metas são configuráveis na aba **Como calcular** e valem tanto para o painel quanto para a
classificação de cada linha.

---

## Da cronometragem ao balanceamento

O sistema fecha o ciclo entre o estudo de tempos e o chão de fábrica. Cada etapa alimenta a
seguinte — nada é digitado duas vezes:

```
leituras do cronômetro ──▶ tempo padrão da operação ──▶ SAM do modelo ──▶ postos da linha
      (n leituras)          TO × ritmo × (1+tol)         Σ da sequência      pitch time
```

**1. Cronometragem por produto.** Para cada operação são registradas várias leituras do
cronômetro, junto com o **fator de ritmo** do operador observado e as **tolerâncias**
(fadiga, necessidades pessoais, atrasos inevitáveis). Leituras fora de ±25% da mediana são
excluídas da média e ficam registradas como descartadas.

| Grandeza | Cálculo |
|---|---|
| Tempo Observado (TO) | média das leituras válidas |
| Tempo Normal (TN) | `TO × fator de ritmo` |
| Tempo Padrão (TP) | `TN × (1 + tolerância ÷ 100)` |

O estudo também devolve desvio padrão, amplitude, coeficiente de variação e um selo de
confiabilidade (CV ≤ 15% com pelo menos 5 leituras).

**2. Sequência operacional.** As operações de cada modelo formam uma lista ordenada
(`UNIQUE(modelo_id, sequencia)`), e o **SAM passa a ser a soma dos tempos padrão da
sequência**, não um número digitado à mão. A tela mostra o SAM cadastrado, o SAM calculado e
a divergência entre eles; o botão de recálculo sincroniza os dois.

**3. Balanceamento de linha.** Dada a sequência e uma meta de peças/hora, o sistema calcula o
*pitch time* (`60 ÷ meta`), o número mínimo teórico de postos (`⌈SAM ÷ pitch⌉`) e distribui as
operações entre postos pelo **método do maior candidato** (*Largest Candidate Rule*),
respeitando a ordem da sequência. O resultado traz o tempo de ciclo real, o posto gargalo, a
ociosidade de cada posto, a eficiência do balanceamento (`SAM ÷ (postos × tempo de ciclo)`) e
recomendações objetivas.

**4. Acompanhamento.** Com os postos definidos, o apontamento diário pode ser desdobrado por
operador. A eficiência individual usa `peças × tempo padrão ÷ minutos trabalhados`, com
precedência explícita da base de cálculo: **tempo do posto** > tempo da operação > SAM do
modelo. Cada registro carrega a etiqueta da base usada, para que valores de bases diferentes
nunca sejam somados em silêncio.

---

## Funcionalidades

| Aba | O que faz |
|---|---|
| **Painel** | Medidores de OEE/A/P/Q, KPIs, evolução diária, Pareto de paradas, composição das perdas, 6 grandes perdas, ranking por linha e desempenho por modelo |
| **Acompanhamento** | Produção diária ou mensal, ranking individual, comparação entre equipes e produção por modelo — com filtros de período, equipe e operador |
| **Apontamentos** | Registro diário por linha e turno: peças produzidas, refugo, retrabalho e paradas com motivo. Inclui produção individual por operador, distribuição automática por balanceamento, simulador de OEE e exportação em CSV |
| **Cronometragem** | Sequência operacional do modelo, lançamento de leituras do cronômetro com fator de ritmo e tolerâncias, prévia em tempo real do TO/TN/TP e recálculo do SAM |
| **Balanceamento** | Simulação de pitch time, postos, gargalo, ociosidade e eficiência de balanceamento; cenários podem ser salvos e reabertos |
| **Linhas** | Cadastro de linhas com setor, número de operadores, custo-hora e meta individual de OEE |
| **Modelos** | Ficha do tempo padrão (SAM) de cada peça — a referência do desempenho |
| **Equipes** | Cadastro de equipes e operadores, com matrícula, função, célula e custo-hora |
| **Turnos** | Duração e pausas planejadas; aceita turno que cruza a meia-noite |
| **Como calcular** | Metodologia, exemplo resolvido, tabela de metas e configuração das metas da fábrica |

O custo-hora cadastrado em cada linha permite **monetizar as perdas**: o painel mostra quanto
a indisponibilidade, o ritmo abaixo do padrão e o refugo custaram no período.

---

## Arquitetura

```
server/
  index.js           servidor HTTP, roteador e API REST (node:http)
  db.js              schema SQLite e acesso ao banco (node:sqlite)
  seed.js            gerador determinístico de dados de exemplo
  lib/
    oee.js            motor de cálculo do OEE — funções puras, sem I/O
    tempos.js         cronometragem: TO → TN → TP, SAM da sequência, produção teórica
    sequencia.js      leitura e recálculo da sequência operacional e das cronometragens
    balanceamento.js  distribuição de operações em postos (Largest Candidate Rule)
    producao.js       acompanhamento diário, mensal, individual e por equipe
    backup.js         exportação e restauração do banco inteiro
    consultas.js      consultas que ligam o banco ao motor
public/
  index.html         interface
  css/estilos.css
  js/graficos.js     gráficos em SVG puro (gauge, linha, Pareto, empilhada, colunas)
  js/aplicacao.js    aplicação: estado, renderização e chamadas à API
test/
  oee.test.js         motor de cálculo (18 testes)
  tempos.test.js      cronometragem, sequência e balanceamento (18 testes)
  api.test.js         API de ponta a ponta contra SQLite em memória (20 testes)
  api-producao.test.js  API dos módulos novos (17 testes)
  backup.test.js      cópia de segurança e restauração (9 testes)
  frontend.test.js    scripts de navegador executados com dados reais da API (17 testes)
```

**Sem dependências externas.** O servidor usa `node:http`, o banco usa `node:sqlite` e os
gráficos são SVG gerado à mão — a aplicação roda e abre offline, sem CDN.

### Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `turnos` | nome, horários, duração em minutos e pausas planejadas |
| `setores` | corte, costura, acabamento, passarela… |
| `maquinas` | linhas/células com nº de operadores, custo-hora e meta de OEE |
| `modelos` | peças com código, categoria, SAM e preço de venda |
| `apontamentos` | produção de uma célula em um turno de um dia |
| `paradas` | eventos de parada vinculados ao apontamento |
| `config` | metas da fábrica |
| `equipes` | nome, setor e líder |
| `operadores` | nome, matrícula única, equipe, função, célula e custo-hora |
| `operacoes` | etapa da sequência do modelo: ordem, código, máquina, seção, tempo padrão e dificuldade |
| `cronometragens` | estudo de tempos de uma operação: data, operador, fator de ritmo e tolerâncias |
| `leituras_cronometro` | leituras individuais em segundos de cada cronometragem |
| `producao_operador` | produção de um operador em um apontamento, com a base de tempo padrão usada |
| `balancos` | cenários de balanceamento salvos (alocação e resultado em JSON) |

### API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verificação de disponibilidade |
| GET | `/api/catalogos` | Motivos de parada, 6 perdas, setores e metas |
| GET/PUT | `/api/metas` | Metas da fábrica |
| GET/POST | `/api/turnos` · PUT/DELETE `/api/turnos/:id` | Turnos |
| GET/POST | `/api/maquinas` · PUT/DELETE `/api/maquinas/:id` | Linhas e células |
| GET/POST | `/api/modelos` · PUT/DELETE `/api/modelos/:id` | Modelos e SAM |
| GET/POST | `/api/apontamentos` · GET/PUT/DELETE `/api/apontamentos/:id` | Apontamentos já com indicadores de OEE |
| POST | `/api/simular` | Calcula o OEE sem gravar nada |
| GET | `/api/dashboard` | Painel consolidado do período |
| GET | `/api/export/apontamentos.csv` | Exportação CSV (`;` e BOM, compatível com Excel pt-BR) |
| GET/POST | `/api/equipes` · PUT/DELETE `/api/equipes/:id` | Equipes de produção |
| GET/POST | `/api/operadores` · PUT/DELETE `/api/operadores/:id` | Operadores |
| GET | `/api/modelos/:id/sequencia` | Sequência operacional com SAM cadastrado, calculado e divergência |
| POST | `/api/operacoes` · PUT/DELETE `/api/operacoes/:id` | Operações da sequência |
| POST | `/api/modelos/:id/recalcular-sam` | Grava no modelo o SAM somado da sequência |
| GET/POST | `/api/cronometragens` · DELETE `/api/cronometragens/:id` | Estudos de tempos; gravar atualiza o tempo padrão da operação |
| POST | `/api/balanceamento/simular` | Calcula o balanceamento sem gravar |
| GET/POST | `/api/balancos` · DELETE `/api/balancos/:id` | Cenários de balanceamento salvos |
| GET | `/api/producao` | Produção individual em nível de registro |
| GET | `/api/acompanhamento` | Consolidação diária, mensal, por operador, equipe, linha e modelo |
| GET/PUT | `/api/apontamentos/:id/producao` | Produção individual do apontamento (substitui o conjunto) |
| GET | `/api/backup` | Baixa o banco inteiro em JSON |
| POST | `/api/restore` | Restaura o banco a partir de um backup (transação única) |

Filtros aceitos por `/api/apontamentos` e `/api/dashboard`: `de`, `ate`, `maquinaId`, `setor`
e, nos apontamentos, `limite`. `/api/producao` e `/api/acompanhamento` aceitam ainda
`equipeId`, `operadorId`, `modeloId` e `apontamentoId`.

Exclusões são protegidas: turno, linha, modelo, equipe ou operador em uso retornam **409** em
vez de apagar histórico. Alterações aditivas de esquema são aplicadas por migração
(`server/db.js` → `MIGRACOES`), sem exigir que o banco existente seja recriado.

---

## Publicar online

### O que o GitHub faz e o que ele não faz

O código já está hospedado no GitHub de graça e de forma permanente — repositório público,
sem custo e sem prazo. Mas o **GitHub Pages serve apenas arquivos estáticos**: ele não executa
um servidor Node nem abre um banco SQLite. Como este sistema é uma aplicação com backend,
o Pages não consegue hospedá-lo. Para ter uma URL pública é preciso de um serviço que execute
o processo Node.

### Arquivos de deploy incluídos

| Arquivo | Para quê |
|---|---|
| `Dockerfile` | Imagem portátil — serve para Render, Northflank, Fly.io, Koyeb, Hugging Face Spaces ou qualquer VPS |
| `render.yaml` | Blueprint de um clique no Render (plano gratuito) |
| `Procfile` | Plataformas no estilo Heroku |
| `.dockerignore` | Deixa o banco local e o `.git` fora da imagem |
| `deploy/github-actions-testes.yml` | CI que roda os 99 testes em todo push — grátis e ilimitado em repositório público. Copie para `.github/workflows/testes.yml` para ativar (o GitHub App que publica aqui não tem a permissão `workflows`, por isso o arquivo fica fora desse caminho) |

A aplicação já está pronta para qualquer plataforma: lê `PORT` e `HOST` do ambiente, cria o
diretório de dados sozinho, **semeia o banco automaticamente no primeiro boot** e expõe
`/api/health` como sonda de saúde.

### Opção gratuita sem cartão de crédito: Render

1. Crie uma conta em <https://render.com> (pode entrar com a conta do GitHub).
2. **New → Blueprint** → selecione este repositório. O `render.yaml` configura tudo.
3. Aguarde o build. A URL final fica em `https://eficiencia-produtiva.onrender.com`.

Ou sem o blueprint: **New → Web Service** → selecione o repositório → *Runtime* **Docker** →
*Instance Type* **Free** → *Health Check Path* `/api/health`.

**Limites reais do plano gratuito** (verificados em setembro de 2026):

- o serviço **adormece após 15 minutos** sem requisições e leva ~30–60 s para acordar na
  próxima visita — é o comportamento esperado, não um defeito;
- 750 horas de instância por mês (suficiente para um serviço só);
- **o disco é efêmero**: a cada reinício o SQLite é recriado e a aplicação resemeia os dados de
  exemplo. Dados lançados à mão **não sobrevivem** sozinhos — veja a seção seguinte.

Outras opções: **Northflank** mantém 2 serviços gratuitos sempre acordados, mas pede cartão
para verificação; **Fly.io** e **Railway** não têm mais plano gratuito permanente em 2026
(apenas créditos de teste).

### Preservando os dados em disco efêmero

Por isso existem os endpoints de cópia de segurança:

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/backup` | Baixa o banco inteiro em JSON (todas as 14 tabelas) |
| POST | `/api/restore` | Substitui o conteúdo atual pelo JSON enviado |

A restauração roda em **transação única**: se qualquer linha falhar, tudo é desfeito e o banco
continua exatamente como estava. Backup antigo, sem colunas adicionadas depois, continua
restaurável — a importação usa a interseção entre as colunas do arquivo e as do esquema atual.

Na interface, o botão fica na aba **Como calcular → Cópia de segurança**. O fluxo recomendado
em hospedagem gratuita: baixar o JSON antes de um reinício e restaurá-lo depois.

---

## Validação

```bash
npm test
```

99 testes cobrem:

- **`oee.test.js`** — tempo ciclo ideal, o cenário de referência 85,71% × 90% × 97,22% = 75%,
  separação entre paradas planejadas e não planejadas, a identidade
  `perdas = tempo planejado − tempo produtivo`, truncamento de perda negativa quando a
  produção supera o padrão, guardas de divisão por zero, limitação de paradas à duração do
  turno, refugo acima da produção, agregação ponderada (e o caso em que ela coincide com a
  média) e monetização das perdas.
- **`api.test.js`** — sobe o servidor real contra SQLite em memória e exercita CRUD completo,
  validações com 400/409, turno que cruza a meia-noite, simulação sem gravação, exportação CSV
  em bytes, bloqueio de acesso fora de `public/` e a conferência de que o OEE consolidado do
  painel bate com o recálculo feito a partir dos apontamentos.
- **`tempos.test.js`** — cadeia completa da cronometragem (TO → TN → TP), descarte de leituras
  discrepantes, coeficiente de variação e selo de confiabilidade, SAM como soma da sequência,
  produção teórica, guardas contra divisão por zero e, no balanceamento, pitch time, respeito à
  precedência da sequência, identificação do gargalo, limite flexível de postos, sequência
  vazia, operações de tempo zero, ociosidade e a conservação `Σ tempos dos postos = SAM`.
- **`api-producao.test.js`** — sobe o servidor com o cenário semeado e confere os invariantes
  (SAM cadastrado igual à soma da sequência, tempo padrão coerente com TO × ritmo × tolerância),
  o CRUD de equipes, operadores, operações e cronometragens com seus bloqueios 409, o recálculo
  de SAM, a simulação e a gravação de balanceamentos, e o fechamento cruzado das quatro visões
  do acompanhamento sobre o mesmo total de peças.
- **`backup.test.js`** — exportação das 14 tabelas com conferência de contagem, restauração em
  banco vazio, substituição sem acumular, compatibilidade com backup antigo sem colunas novas,
  **rollback que preserva o banco quando uma linha falha**, rejeição de payload inválido e o
  ciclo completo pelas rotas HTTP.
- **`frontend.test.js`** — executa `graficos.js` e `aplicacao.js` num DOM mínimo alimentado com
  respostas reais da API, verificando o SVG gerado (sem `NaN`), os quatro medidores, KPIs,
  ranking, histórico, montagem do formulário de paradas, o aviso de erro quando a API falha e,
  nos módulos novos, o gráfico de colunas com eixo duplo, a troca de granularidade
  diária/mensal, a prévia da cronometragem, a sequência com a divergência de SAM, os cartões de
  posto com o gargalo destacado, a leitura de volta da produção individual e a regra de escolha
  da equipe na distribuição automática.

---

## Sobre os dados

O banco fica em `data/eficiencia.db` e está no `.gitignore` — é regenerável com `npm run seed`.
O gerador usa um PRNG com semente fixa, então os dados de exemplo são sempre os mesmos e o
histórico mostra melhoria gradual de OEE, como num cenário real de melhoria contínua.

O cenário semeado (45 dias, de 2026-07-15 a 2026-09-04):

| Entidade | Quantidade |
|---|---|
| Turnos / setores / células | 2 / 4 / 6 |
| Modelos | 10 |
| Equipes / operadores | 3 / 36 |
| Operações / cronometragens / leituras | 120 / 120 / 720 |
| Apontamentos / paradas | 373 / 701 |
| Registros de produção individual | 2.864 |

Propriedades verificadas no cenário:

- o **SAM cadastrado é exatamente a soma** dos tempos padrão da sequência nos 10 modelos
  (divergência `0,0000 min`);
- os **2.864 registros individuais usam o tempo padrão do posto** como base — nenhum mistura
  base com outra;
- a eficiência consolidada fica em **81,7%** sobre 624.116 peças, com equipes em 81,2% / 81,7% /
  82,1% e ranking individual entre **68,8% e 91,4%** (mediana 83,0%) — dispersão plausível, em
  vez de um operador sempre no topo e outro sempre no fim;
- o refugo do período é de **0,72%**.

## Módulo vizinho

O arquivo `Qwen_html_20260824_y8j99386e.html`, já presente no repositório, é o módulo
independente de **ficha técnica, precificação e DRE** (página única, dados no `localStorage`).
Ele não é afetado por este sistema e pode ser aberto diretamente no navegador.
