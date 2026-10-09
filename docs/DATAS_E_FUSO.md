# Datas civis e horários

O calendário operacional da academia é `America/Sao_Paulo`. A API não depende do fuso configurado no computador ou na função Vercel.

## Contratos

- `checkinDate`, `paymentDate`, `dueDate` e datas de vigência são colunas MySQL `DATE`. O Prisma as representa como `Date` em meia-noite UTC. Por exemplo, a presença de **30/09** retorna `2026-09-30T00:00:00.000Z`. Esse valor deve ser exibido como data civil, com fuso UTC; converter esse valor para o horário brasileiro mudaria indevidamente a data para 29/09.
- `createdAt` é um instante UTC. O agrupamento operacional e as mensagens de horário no backend usam `America/Sao_Paulo`. Um registro às `2026-10-01T00:30:00Z` pertence a **30/09, 21:30** no Brasil. Algumas telas, incluindo o painel do aluno, apresentam instantes no fuso do navegador; isso não altera a data civil da presença nem a contagem operacional.
- `checkinTime` é uma coluna legada `TIME(0)`, sem dia ou fuso. Ela não é um instante. Registros antigos misturavam horário civil e fuso do servidor. Os novos registros recebem o componente UTC do instante real; relatórios, resumo e painel usam `createdAt` para horário. Nenhum registro histórico foi reescrito nem pode ser reconstruído com certeza só pelo `TIME` antigo.
- A data diária e o instante de criação de uma nova presença são derivados da mesma leitura do relógio do servidor. A constraint de aluno/dia continua impedindo duplicidade inclusive depois do cancelamento.

## Filtros e contagens

Datas HTTP aceitam somente `AAAA-MM-DD` existente no calendário; arrays, strings vazias e períodos invertidos retornam 400 antes de ler o banco. Limites inicial/final podem ser enviados separadamente. Uma data específica não pode ser combinada com período. `incluirCancelados=false` não é interpretado como verdadeiro por ser uma string.

Os últimos N dias incluem hoje e N−1 dias anteriores. Resumo e contagem do dia excluem presenças canceladas. O histórico do próprio aluno inclui cancelamentos e seu total acompanha esse mesmo conjunto; `totalMes` conta somente presenças válidas. A paginação aceita limite de 1–100 e offset inteiro de 0–1.000.000. Ranking aceita de 1–366 dias.

Receita mensal e séries de pagamentos/presenças usam as datas civis. Matrículas usam seus instantes, agrupados por calendário brasileiro. O início da consulta de matrículas é um instante convertido pelas regras IANA de São Paulo, não meia-noite UTC. Dias restantes de plano e carência de cinco dias são diferenças entre datas civis: o quinto dia é válido até sua virada no Brasil.

## Verificação

`cd server` e `node --test tests/civil-dates-reports.test.cjs` exercitam mudança de dia/mês entre 00–03 UTC, hosts UTC/Brasil/Tóquio, um período com horário de verão brasileiro, datas inválidas antes de consultas, cancelamentos, ownership e carência.

O teste nativo opcional `node scripts/with-local-env.cjs node tests/checkins-dates-local.integration.cjs` exige o banco local gerenciado. Ele cria apenas uma conta temporária própria, verifica as representações MySQL `DATE`/`TIME`, os limites de dia, duplicidade e cancelamento; remove somente a fixture criada pelo teste. Não executa contra bancos remotos.
