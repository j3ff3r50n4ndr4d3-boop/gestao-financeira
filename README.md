# Eficiência Produtiva — OEE para Confecção

Sistema online para medir a eficiência produtiva de uma fábrica de roupas.
O indicador central é o **OEE** (*Overall Equipment Effectiveness*) aplicado à célula de
costura, decomposto em **Disponibilidade × Desempenho × Qualidade**.

A aplicação já sobe populada com dados de exemplo (6 células de produção, 10 modelos e
45 dias de histórico), para que o painel possa ser explorado imediatamente.

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

## Funcionalidades

| Aba | O que faz |
|---|---|
| **Painel** | Medidores de OEE/A/P/Q, KPIs, evolução diária, Pareto de paradas, composição das perdas, 6 grandes perdas, ranking por linha e desempenho por modelo |
| **Apontamentos** | Registro diário por linha e turno: peças produzidas, refugo, retrabalho e paradas com motivo. Inclui simulador de OEE antes de gravar e exportação em CSV |
| **Linhas e Células** | Cadastro de linhas com setor, número de operadores, custo-hora e meta individual de OEE |
| **Modelos e SAM** | Ficha do tempo padrão (SAM) de cada peça — a referência do desempenho |
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
    oee.js           motor de cálculo — funções puras, sem I/O
    consultas.js     consultas que ligam o banco ao motor
public/
  index.html         interface
  css/estilos.css
  js/graficos.js     gráficos em SVG puro (gauge, linha, Pareto, empilhada)
  js/aplicacao.js    aplicação: estado, renderização e chamadas à API
test/
  oee.test.js        motor de cálculo (18 testes)
  api.test.js        API de ponta a ponta contra SQLite em memória (20 testes)
  frontend.test.js   scripts de navegador executados com dados reais da API (6 testes)
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

Filtros aceitos por `/api/apontamentos` e `/api/dashboard`: `de`, `ate`, `maquinaId`, `setor`
e, nos apontamentos, `limite`.

Exclusões são protegidas: turno, linha ou modelo em uso por apontamentos retornam **409** em
vez de apagar histórico.

---

## Validação

```bash
npm test
```

44 testes cobrem:

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
- **`frontend.test.js`** — executa `graficos.js` e `aplicacao.js` num DOM mínimo alimentado com
  respostas reais da API, verificando o SVG gerado (sem `NaN`), os quatro medidores, KPIs,
  ranking, histórico, montagem do formulário de paradas e o aviso de erro quando a API falha.

---

## Sobre os dados

O banco fica em `data/eficiencia.db` e está no `.gitignore` — é regenerável com `npm run seed`.
O gerador usa um PRNG com semente fixa, então os dados de exemplo são sempre os mesmos e o
histórico mostra melhoria gradual de OEE, como num cenário real de melhoria contínua.

## Módulo vizinho

O arquivo `Qwen_html_20260824_y8j99386e.html`, já presente no repositório, é o módulo
independente de **ficha técnica, precificação e DRE** (página única, dados no `localStorage`).
Ele não é afetado por este sistema e pode ser aberto diretamente no navegador.
