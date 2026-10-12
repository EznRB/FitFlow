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

## Recebimentos financeiros

Lançamento manual usa UUID e fingerprint da intenção; repetir a solicitação original não altera valor nem renova a vigência novamente. A rota legada de edição direta foi removida: `PUT`, `PATCH` e `DELETE /api/pagamentos/:id` retornam 405 para o administrador autenticado, com `Allow: GET`. Consultas, criação e conciliação do provedor permanecem. Isso é uma regra da API, não uma garantia de imutabilidade de toda operação SQL: a rotina de inadimplência ainda marca registros pendentes como vencidos.

Correção administrativa e registro de devolução usam eventos próprios com responsável, motivo, valores anteriores e efeitos explícitos na vigência. O recebimento confirmado é preservado; UUID, fingerprint, valores em centavos e revisão da matrícula coordenam replay/conflitos. Permissões runtime e trigger SQL protegem o recibo original. O fluxo está implementado e teve gates nativos, PostgreSQL, Neon e HTTPS; [contrato de ajustes financeiros](AJUSTES_FINANCEIROS.md). Registrar uma devolução não transfere dinheiro nem executa reembolso no provedor (`providerRefundPerformed=false`). O estado de revisão de reembolso do checkout não executa estorno nem revoga vigência automaticamente.

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

### Origem na ficha e na sessão

`Exercise.catalogExerciseId` é uma referência opcional ao catálogo e `catalogSnapshot` registra a origem usada: versão, nome/grupo originais, fonte/identidade externa, conteúdo, equipamentos e créditos separados de base/texto/mídia. O servidor consulta e captura o catálogo na mesma transação de criação. O cliente envia somente o ID da origem; créditos e snapshots fornecidos pelo cliente são recusados. Metadados `upstream` de conteúdo ainda não incorporado pela curadoria não substituem os créditos utilizados.

Ao revisar uma ficha, `sourceExerciseId` deve pertencer à ficha revisada. A mesma referência conserva o snapshot anterior, incluindo quando o catálogo foi desativado; uma nova seleção exige catálogo ativo. Nome/grupo da prescrição podem ser adaptados, com a origem original apresentada separadamente. Cada revisão mantém novos IDs de Exercise; não reúne automaticamente progressão de exercícios diferentes.

O início da sessão copia a origem da ficha. Snapshot do servidor, replay, cache e fila offline preservam créditos; não consultam catálogo atual para reconstruir sessões antigas. Registros legados e exercícios manuais permanecem sem origem registrada. Não há backfill por nome.

A migration aditiva `20261011_exercise_catalog_origin` adiciona FK restritiva à exclusão, índice e CHECK de par completo/objeto JSON nos dois bancos. MariaDB usa `ON UPDATE RESTRICT` para compatibilidade entre FK e CHECK; PostgreSQL mantém a ação padrão de atualização em cascata. Não há API que renumere identidades. As permissões runtime das tabelas existentes permanecem; nenhuma permissão de edição/exclusão de séries ou DDL é ampliada.

Créditos, links de licença e indicação de adaptações são exibidos com a ficha e a sessão. O código do FitFlow não redefine licenças do catálogo: conteúdo CC-BY/CC-BY-SA/CC0 e mídia conservam seus termos individuais. [Termos CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) e [limitação de FK/CHECK documentada pelo MariaDB](https://jira.mariadb.org/browse/MDEV-31769).

A importação local de 08/10/2026 avaliou 919 entradas em dez páginas: 795 incorporadas e 124 ignoradas pelos critérios do importador. Esse resultado descreve aquela importação, não uma quantidade garantida para consultas futuras.

## Calendário operacional

Presenças, vencimentos, pagamentos e vigência são datas civis. O calendário de negócio é `America/Sao_Paulo`, independente do fuso do processo; `DATE` recebido como meia-noite UTC deve continuar sendo apresentado como data civil. Instantes `createdAt` são armazenados em UTC. Agrupamentos de relatórios usam o calendário brasileiro; algumas telas apresentam o instante no fuso do navegador. Consulte [Datas e fuso](DATAS_E_FUSO.md) para contratos e legado `TIME`.

## Integrações opcionais

Fundamentos usa chat contextual com corpus de referências permitido e inferência GPT-OSS via Groq Free. Mensagens digitadas são enviadas somente após consentimento; perfil, medidas, ficha e histórico do aplicativo não são anexados. O histórico da conversa fica em memória por sessão/conta, sem persistência no banco. Rotinas geradas são rascunhos estruturados; o backend valida dados e calcula contagens antes de renderizar texto. Elas não alteram fichas ou séries. IDs de fontes não certificam cada afirmação ou a adequação individual dos exercícios.

`POST /api/ia/chat` exige sessão, papel permitido e origem válida; quota própria `ia:chat` compartilhada no banco em produção. O deadline de 25 segundos cobre conexão e corpo, com limite do cliente de 30 segundos apenas para esse endpoint. Chave/modelo permanecem no servidor. A rota legada `/explicar` preserva explicações temáticas de nutrição/divisões e glossário fixo de indicadores; cálculos continuam determinísticos.

O chat classifica e esclarece com GPT-OSS 20B por padrão; o rascunho é gerado por 120B em objeto JSON não anulável e validado no servidor; respostas gerais são produzidas separadamente por 120B com a conversa e o corpus completo, sem receber a candidata da primeira etapa. Papéis definidos previamente, sem fallback após quota. A primeira etapa recebe somente títulos/IDs das fontes e compacta rascunhos reconhecidos; mensagens do usuário e validação contra o histórico original são preservadas. A segunda seleciona blocos tipados de evidência, contagens, acompanhamento, progressão, limites e perguntas. O servidor apresenta resumos completos das referências escolhidas, calcula contagens explícitas e usa textos controlados do produto; não apresenta síntese científica livre. A interface identifica essa origem. A seleção por IA e a classificação de exercícios ainda não comprovam adequação individual. Esclarecimentos usam uma chamada; rascunhos e respostas gerais usam duas, e o servidor calcula as contagens do rascunho. Falha de qualquer etapa recusa a resposta, sem retry automático; o prazo inclui todas elas. Logs operacionais contêm somente etapa, status, categoria e código permitido.

Esclarecimentos têm seleção interna estruturada de motivo e campos; o servidor renderiza perguntas em português, sem prosa científica ou referências livres do provedor. A resposta externa mantém `message` string. O rascunho exige citações originais de cada campo e confirmação positiva de adulto saudável; contradições explícitas de objetivo/escopo/dias/equipamentos e declarações posteriores tornam a interpretação insuficiente. Nesses casos retorna esclarecimento controlado, sem aplicar ficha, repetir geração automaticamente ou inferir elegibilidade clínica. O reconhecimento textual é conservador e limitado aos padrões testados, não um interpretador universal. [Contrato e provas](IA_GRATUITA.md#contrato-de-contexto-e-esclarecimentos--12102026).

Respostas gerais têm orçamento de 6.000 caracteres, igual ao limite de histórico da interface. Cada resumo, origem de contagem ou orientação é uma unidade indivisível. O servidor reserva espaço para ressalvas e informa os tópicos que ficaram para outra pergunta; somente fontes efetivamente exibidas aparecem nos links. Seleções repetidas válidas são deduplicadas, mantendo limites brutos e allowlists. Histórico abusivo ou unidade isolada excessiva continua recusado. Diagnósticos de validação registram apenas códigos fixos e etapa, sem conteúdo da conversa.

O adaptador opcional Gemini preserva `gemini-3.5-flash-lite` como seu padrão, configurável por `GEMINI_MODEL`. Isso não descreve o provedor ativo da publicação, que usa Groq Free/GPT-OSS. O adaptador usa `generationConfig.responseFormat.text` com schema JSON; `thinkingLevel: MINIMAL` é aplicado ao seu modelo padrão. Os testes usam provedor controlado. Geração real depende de chave e limites configurados no provedor.

Checkout sandbox cria intenção com preço/duração obtidos do banco, verifica a conta de teste do provedor e concilia o pagamento canônico no servidor. Retorno do navegador, nome de método ou mensagem de webhook sem verificação não liberam plano. Credenciais e endpoint HTTPS são dependências externas para a validação real.
