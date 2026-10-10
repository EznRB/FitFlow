# Arquitetura e contratos

## Aplicações

`client/` é a SPA em JavaScript/CSS servida pelo Express. `server/` contém API, autenticação, Prisma e migrations. A landing React/Vite é um repositório separado e não contém credenciais nem telas administrativas simuladas.

Controllers tratam HTTP; services validam regras; repositories usam o singleton Prisma. Módulos novos expõem fábricas para testar dependências sem bancos externos. O antigo pool mysql2 e scripts de manipulação direta de tabelas foram removidos.

## Identidade e autorização

JWT HS256 em cookie httpOnly. O middleware consulta usuário ativo e função atual no banco; o papel declarado no token não concede acesso. Registro de conta exige administrador. Alunos usam apenas o perfil ligado à própria identidade. Instrutores gerenciam suas fichas e recebem listas mínimas para seleção de alunos; não recebem acesso financeiro.

Falha de banco retorna indisponibilidade, não expiração fictícia. Segredo fraco impede iniciar produção. Login e IA têm limite de dez solicitações por janela de quinze minutos: identidade de IP no login e conta autenticada na IA. Produção usa `RateLimitBucket` no banco, com chave HMAC e incremento atômico; a publicação atual usa PostgreSQL e a demonstração nativa usa MariaDB. Desenvolvimento usa memória. Falha ao confirmar a quota compartilhada retorna 503 antes da operação. O limitador global de tráfego permanece por processo e não é um teto financeiro do provedor.

Na Vercel, a identidade de IP usa exclusivamente seu cabeçalho canônico `x-vercel-forwarded-for`; fora dela, usa `req.ip`. IPv6 é agrupado por /64. Não se aceita `trust proxy=true` irrestrito.

Solicitações de escrita com cookie exigem `Origin` presente na lista exata de `CORS_ORIGIN`. A exceção JSON de `POST /api/checkout/webhook` apenas encaminha à verificação HMAC do provedor. Clientes sem cookie ou metadados de navegador podem usar Bearer; login JSON sem cookie também é permitido nesse contexto. Respostas da API usam `Cache-Control: no-store`, e corpos HTTP têm limite de 256 KB. A CSP permite scripts somente da mesma origem, sem inline/eval, tanto no Helmet quanto nas rotas estáticas da Vercel; estilos inline legados continuam permitidos. Em 09/10/2026, os headers reais do domínio final confirmaram CSP no HTML e em `/api/health`, com API `no-store`; `frame-ancestors 'none'` está presente em ambos.

Logout cujo POST não é confirmado persiste uma intenção de saída e não restaura a conta a partir do cookie ao reconectar/recarregar. A limpeza é repetida antes de um novo login. Isso impede restauração automática no navegador; não é uma lista de revogação de JWTs copiados.

O cliente compara o epoch observado pelo Auth com o marcador compartilhado antes de enviar uma nova consulta ou escrita autenticada. Isso cobre o intervalo anterior à entrega do evento entre abas. Respostas de escritas já enviadas conservam o resultado HTTP real. Logout explícito aguarda as promises de limpeza registradas pelos listeners ainda dentro do Web Lock de cookie; uma saída iniciada por tela com epoch antigo sinaliza expiração, preservando a fila da sessão nova.

## Planejamento e execução

`Workout`/`Exercise` descrevem a ficha. `WorkoutSession` salva um snapshot imutável para a execução; `WorkoutSet` guarda UUID, exercício do snapshot, carga externa, repetições, RIR opcional, tipo e horário. Não há ligação destrutiva de série executada com exercício editável.

Toda edição de ficha cria uma nova revisão e arquiva a original, mesmo sem registros já enviados ao servidor. Os IDs da ficha anterior são preservados porque um dispositivo offline pode manter registros ainda não sincronizados. Arquivar a ficha não finaliza uma sessão em andamento nem fabrica séries.

Sessões com envios bloqueados podem ter seus envios arquivados após confirmação. Séries, snapshot original e motivos permanecem no IndexedDB daquela conta até logout explícito/limpeza dos dados; não são apresentados como séries confirmadas. Somente as operações da sessão selecionada são retiradas da fila, liberando outra partida. Uma sessão já iniciada no servidor poderá permanecer incompleta.

- `POST /api/sessoes/start`: UUID, ficha e horário; ownership e elegibilidade validados.
- `POST /api/sessoes/:id/sets`: UUID idempotente e dados da série; mudança de payload para o mesmo UUID retorna conflito.
- `POST /api/sessoes/:id/complete`: manifesto completo de IDs de séries recebidas. Impede finalizar antes de registros em trânsito.
- `GET /api/sessoes/mine`: histórico limitado explicitamente e resumo dos últimos sete dias com consulta independente desse limite.

Transações serializáveis e locks de linha coordenam série/finalização. Conflitos conhecidos do Prisma e MariaDB são repetidos com limite; não se ignora qualquer erro. CHECKs no banco restringem tipo de série, status, carga, repetições e RIR.

Volume: soma de carga externa × repetições dos registros. Aquecimento é separado. Série ausente não é preenchida. Volume não mede estímulo, trabalho mecânico total ou prescrição ideal. Grupo muscular direto vem da ficha; músculos secundários não são estimados.

## Persistência mobile

IndexedDB tem uma fila separada por conta. Ordem: início, séries, finalização. Erros transitórios preservam envios; erro de validação cria conflito visível. Cache de ficha elimina pessoas e histórico legado da resposta original.

A instância encerrada não pode devolver uma leitura que terminou depois do logout, nem executar a transformação de uma gravação ainda pendente. O guard de escrita é conferido dentro do callback da transação IndexedDB, incluindo a identidade corrente antes das gravações locais; isso impede recriar uma fila depois da limpeza explícita, mesmo com evento entre abas atrasado. A confirmação HTTP real de uma escrita já enviada pode atualizar somente uma sessão ainda presente; não recria uma sessão apagada. Expiração encerra a instância, preservando registros já gravados para autenticação posterior na mesma conta. Uma escrita já executada não recebe confirmação fictícia nem sofre cancelamento retroativo.

A tela de sessões captura conta, papel, geração do Auth, epoch observado, store, container e geração da tela antes de aguardar operações. Leituras, erros e callbacks visuais tardios não atualizam a conta ou navegação nova. A criação de uma fila aguarda a limpeza anterior da mesma conta; outra conta não aguarda essa limpeza. Leituras obsoletas também deixam de bloquear a atualização da tela corrente.

Logout avisa se existem registros pendentes. O aluno pode continuar, tentar sincronizar ou confirmar descarte. Expiração mantém a fila da conta para retomada após autenticação. Trocar de conta não concede acesso à fila anterior.

O service worker possui allowlist de recursos públicos do fallback offline, manifesto e ícones. Não guarda APIs, cookies, respostas privadas ou URLs com query. Não força reload durante uma sessão. Em uma nova aba offline, a identidade precisa ser validada online antes de voltar aos dados privados.

## Catálogo externo

wger é conteúdo descritivo. Identidade é `source + externalId`; nome parecido não mistura exercícios. O adaptador pagina, aplica limites, timeout e licenças/autoria. Tradução portuguesa elegível é preferida; fallback inglês é informado. Curadoria local preserva edição/desativação e seus créditos; atualização externa é armazenada separadamente.

A importação local de 08/10/2026 avaliou 919 entradas em dez páginas: 795 incorporadas e 124 ignoradas pelos critérios do importador. Esse resultado descreve aquela importação, não uma quantidade garantida para consultas futuras.

## Calendário operacional

Presenças, vencimentos, pagamentos e vigência são datas civis. O calendário de negócio é `America/Sao_Paulo`, independente do fuso do processo; `DATE` recebido como meia-noite UTC deve continuar sendo apresentado como data civil. Instantes `createdAt` são armazenados em UTC. Agrupamentos de relatórios usam o calendário brasileiro; algumas telas apresentam o instante no fuso do navegador. Consulte [Datas e fuso](DATAS_E_FUSO.md) para contratos e legado `TIME`.

## Integrações opcionais

IA educativa usa temas fechados e corpus com referências permitidas, chave somente no servidor e timeout. Não recebe medidas, prontuários, dietas ou fichas pessoais. IDs de fontes permitidos não provam a correção de toda frase gerada; revisar o resultado e manter cálculos determinísticos.

O modelo padrão é `gemini-3.5-flash-lite`, configurável por `GEMINI_MODEL`. O adaptador usa `generationConfig.responseFormat.text` com schema JSON; `thinkingLevel: MINIMAL` é aplicado ao modelo padrão. Os testes usam provedor controlado. Geração real depende de chave e limites configurados no provedor.

Checkout sandbox cria intenção com preço/duração obtidos do banco, verifica a conta de teste do provedor e concilia o pagamento canônico no servidor. Retorno do navegador, nome de método ou mensagem de webhook sem verificação não liberam plano. Credenciais e endpoint HTTPS são dependências externas para a validação real.
