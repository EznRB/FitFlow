# Revisão visual de todo o FitFlow

Pedido reafirmado em 12/10/2026: dar personalidade, cuidado e variedade às telas, preservando laranja/navy/Barlow. Pequenos ajustes de espaçamento não encerram essa revisão. O objetivo completo permanece aberto; implantação e CI ficam em [Estado da entrega](STATUS_ENTREGA.md).

Pedido reafirmado em 14/10: [rodada de relatórios e editor](RODADA_2026_10_14.md#ux-editor-e-relatórios), com hierarquia financeira, estado vazio confirmado, ações de ficha e inspeção responsiva local. A auditoria integral abaixo continua aberta.

Em 15/10, [chat e planos](RODADA_UX_CHAT_PLANOS_2026_10_14.md) receberam composição própria, recuperação de rascunho e correções de leitura/contexto. Publicação, CI, 28 assets e amostras reais conferidas; a revisão integral continua aberta.

Em 17/10, nutrição, histórico avulso e presença do aluno receberam recuperação de erros e confirmação mais clara dos dados enviados. [Verificação desta rodada](#17102026--nutrição-e-área-do-aluno). A revisão completa das demais jornadas continua aberta.

## Ordem e direção

Concluir os gates técnicos disponíveis do financeiro e chat antes de publicar os próximos refinamentos visuais. Conta/credenciais de pagamento e telefone físico dependem do proprietário; perguntas ficam guardadas enquanto ele trabalha. Testes simulados não transformam esses gates em aprovação externa.

Usar composições diferentes para funções diferentes: painel organiza próximas ações; ficha mostra prescrição; caderno favorece execução; Evolução explicita comparações; gestão permite consulta/edição; recibo conserva origem e efeito financeiro. Fotografia tem função na apresentação e acesso, sem adicionar imagens decorativas a todas as tarefas. [Tokens e componentes](../design-system/fitflow/MASTER.md).

## Referências primárias

| Referência | Inspiração aplicada ao FitFlow e limite |
|---|---|
| [Strong](https://www.strong.app/) | Caderno de treino, séries perto dos controles, hierarquia de execução. Página/captura oficial inspecionada na rodada registrada no histórico. Não se copiam assets. |
| [Hevy — progresso](https://www.hevyapp.com/features/gym-progress/) | Unidades e contexto de carga/volume próximos à métrica. Referência visual; tonelagem não se torna estimativa de estímulo. |
| [Trainerize — Insights](https://help.trainerize.com/hc/en-us/articles/46648417703956-Using-the-Client-Insights-Dashboard) | Densidade por tarefa/perfil e diferenças web/mobile. Pesquisa da documentação; nenhuma conta concorrente foi auditada. |

As decisões são interpretações para este produto. Fontes não provam implementação. As pesquisas, capturas rejeitadas e relatos integrais ficam no [histórico visual](HISTORICO_VISUAL.md).

## Matriz de jornadas e estados

A coluna de evidência resume provas de versões identificadas no histórico. Não é uma nova execução de todos os cenários nem uma certificação completa de acessibilidade. Cada rodada precisa capturar e inspecionar o estado atual antes de aprová-lo.

| Jornada / perfil | Composição e evidência já registrada | Estados e gates ainda necessários |
|---|---|---|
| Acesso / todos | Fotografia editorial, labels, ajuda, mostrar senha; login/restauração real, desktop/768/375 e teclado, capturas 28/29/31. | Reavaliar identidade/expiração após mudanças relevantes; não há recuperação por e-mail prometida. |
| Dashboard / gestor e aluno | Ações reais, métricas agrupadas, barras diárias, foto ilustrativa; captura pública [66](evidence/66-dashboard-workspace-vercel.png), atalhos locais. | Falha/zero/dados incompletos por papel; teclado/contraste de cada ação e relatório gráfico. |
| Matrícula e planos / gestor | Campos por tarefa, planos com preço total/vigência, consulta/detalhe/edição/cancelamento publicados; [155](evidence/155-plan-detail-vercel-20261015.jpg), editor local 375/768 e confirmação sem descarte de rascunho testada. | Matriz completa de edição/validação/lista vazia por formulário; timeout real de rede não provocado na publicação. |
| Biblioteca / gestor e instrutor | Busca/paginação, filtros, leitura de imagem/origem/licença, foco no modal; [95](evidence/95-catalogo-vercel.jpg) / [96 mobile](evidence/96-catalogo-detalhe-mobile-vercel.jpg). | Falha real da fonte/sincronização após alterações; não validar prescrição por imagem. |
| Fichas / instrutor e aluno | Prescrição e execução separadas, último registro com data/ausência; [117](evidence/117-ficha-vercel.jpg), avulso [122](evidence/122-avulso-vercel.jpg). | Jornada completa do instrutor, todos os estados de revisão/sem ficha e teclado do editor. |
| Caderno / aluno | Entrada em etapas, ledger e resumo semanal; [106](evidence/106-caderno-vercel.jpg) / [107 mobile](evidence/107-caderno-mobile-vercel.jpg), fixture nativa exclusiva limpa. | M01–M14 em telefone físico, teclado/rotação e reconexão publicada. |
| Evolução / aluno | Filtros e foco preservados, erro ligado ao campo, tabela rolável por teclado; [119 mobile](evidence/119-evolucao-mobile-vercel.jpg). | Todos os estados de falta/revisão de exercício no navegador; comparação usa ID, sem inferência por nome. |
| Nutrição / usuários permitidos | Inputs com unidades/método, resultado creme de contraste medido, quatro cenários fictícios; [85](evidence/85-nutricao-resultado-vercel.png). | Teclado e erros de cada parâmetro; estimativa para adulto saudável, sem prescrição clínica. |
| Fundamentos/chat / usuários permitidos | Conversa com consentimento, rascunho como documento, fontes e limites; [154 publicado](evidence/154-chat-exercises-vercel-20261015.jpg), [150 mobile local](evidence/150-chat-exercises-mobile-20261015.jpg). Falso conflito de equipamento reproduzido e corrigido, amostra real publicada aprovada. | Quota/timeout/recusa no navegador e matriz ampliada de contexto; linguagem conservadora não cobre interpretação universal nem certifica doses individuais. |
| Recebimentos, ajustes e mensalidade / gestor e aluno | Recibo/ajuste separados, disponibilidade visível antes do checkout; [118](evidence/118-mensalidade-vercel.jpg), gates reais de ajuste e contextos obsoletos. | Cartão/Pix externo, estados do provedor e leitura dos ajustes em todas as larguras. Nenhuma cobrança/devolução real. |
| Presenças / gestor e aluno | Livro diário e resumo de hoje em revisão; os três bugs de callbacks/consultas foram reproduzidos em memória. | Capturar desktop/768/375, lista/modal/frequência/vazio/erro, foco e envio exclusivo por identidade. Não confundir presença com execução. |
| Relatórios / gestor | Filtros por período, região rolável e totais financeiros conciliáveis; primeiras capturas locais no histórico. | Matriz inteira de falha/zero/resultados/mobile/teclado por tipo de relatório. |
| Segurança da conta / todos | Senha atual e revogação com gates nativos/PG/Neon/HTTPS, diálogos com foco. | Jornada de teclado/erro em todas as larguras após mudanças; não alterar senha da demonstração pelo navegador. |
| Landing / público | Hero fotográfico ilustrativo, captura real identificada, ciência e autoria, menu/CTA/Escape; [98](evidence/98-landing-vercel.jpg) / [101 mobile](evidence/101-landing-produto-mobile-vercel.jpg). | Revisão de toda acessibilidade, teclado em todos os links e estados; aparelho físico. |

## Critérios de aprovação por rodada

1. Capturar o fluxo real e salvar exatamente a imagem inspecionada; distinguir local/publicado e rejeitar transições/carregamento como prova do estado final.
2. Conferir desktop, 768 e 375, overflow, inputs 16 px, ações pelo menos 44 px, labels/erros, contraste das cores computadas e foco/restauração pelo teclado.
3. Reproduzir corridas e estados funcionais com testes significativos; não criar testes que apenas repitam CSS. Escritas somente em fixture própria com destino e limpeza conferidos.
4. Após deploy, conferir implantação/saúde/assets e o fluxo servido. Screenshots, testes e build têm escopos diferentes; emulação não substitui telefone físico.
5. Atualizar [auditoria da entrega](REVISAO_FINAL.md) e histórico com evidência e limite, mantendo reprovações e sem declarar a meta concluída.

## Rodada em andamento — 12/10/2026

Presenças: captura local 123 mostrou ações secundárias competitivas (Ranking), KPIs em cards iguais e filtro de aluno sem label visível. O refinamento usa resumo diário em superfície creme, livro de registros navy, labels, ação de presença prioritária e Frequência em 30 dias. Implementação e gates desta rodada serão registrados após verificação; não estão aprovados por este parágrafo.

Correções do contrato IA concluídas localmente: escopo/objetivo contraditórios, correções posteriores ignoradas e texto científico livre no esclarecimento. Essas falhas foram reproduzidas com provedor simulado; não são relatos de resposta incorreta observada ao vivo. Duas amostras reais do serviço local passaram; [provas e limites](IA_GRATUITA.md#contrato-de-contexto-e-esclarecimentos--12102026).

### Gates locais desta rodada

Suíte integral **603/603**, sem falhas/ignorados: 21 casos novos de presenças, dois de `API.put` com prazo/signal reais e 16 de contrato IA estão incluídos no total. Revisão independente reproduziu intervalo inválido com loading preso, resumo sem recuperação e perda de foco no botão de frequência; todos corrigidos antes da publicação. Não há migration, dependência, reembolso ou PSP real novo.

Navegador nativo local confirmou estado vazio, período inválido e recuperação, Atualizar resumo, seleção obrigatória vazia sem POST e retry oculto após sucesso. Frequência vazia abriu corretamente; Fechar e Escape devolveram foco ao botão Frequência. Em 375 × 812, documento 369 px, filtros 16 px/48 px, ações 48 px e Atualizar resumo 44 px; tabela focável rolou horizontalmente por ArrowRight. Em 768 × 1024, documento 762 px, resumo/filtros 730 px. Superfície creme com texto `rgb(23,35,52)` sobre `rgb(238,232,220)`. Capturas locais 124/125 inspecionadas; uma captura imediatamente após restaurar o período ainda mostrava estado anterior e foi rejeitada/substituída. Nenhuma presença, cadastro, ficha, série ou pagamento foi gravado no navegador. Emulação não prova telefone físico, erro/retry real de rede nem acessibilidade integral.

## 17/10/2026 — nutrição e área do aluno

### Mudanças e referências

Nutrição distingue o cálculo local dos parâmetros confirmados pelo servidor. A confirmação identifica o snapshot enviado; recalcular durante o salvamento não faz o novo cenário parecer salvo. Os resumos usam números em português. Um erro em campo básico mantém os ajustes opcionais fechados e leva o foco ao campo inválido.

Leituras e escritas da conta têm prazo de 15 segundos. Uma escrita sem confirmação mantém o cálculo e bloqueia outra escrita nesta aba até consulta válida e revisão explícita. Essa consulta não comprova que a operação anterior terminou: o aviso informa que ela ainda pode concluir e alterar os dados. O bloqueio é em memória, não é idempotência do servidor e não sobrevive à recarga.

O registro avulso conserva o rascunho ao fechar/reabrir o diálogo durante a sessão. Um envio incerto exige conferir o histórico do exercício e confirmar a revisão antes de outro envio. Respostas incompletas de carga/presença e handlers de sessão anterior não autorizam repetição. As séries do caderno permanecem um fluxo separado, com seu contrato de idempotência próprio.

O histórico mostra oito registros inicialmente, a quantidade restante e uma expansão nativa acessível por teclado. Datas incluem hora e observações são escapadas. Todos os registros usados no resumo ficam consultáveis, dentro do limite de 100 retornados pela API. A métrica continua sendo carga externa × repetições, sem inferir hipertrofia.

Referências oficiais reconferidas: [Hevy — valores anteriores e histórico](https://www.hevyapp.com/features/track-exercises/) e [Trainerize — acompanhamento de progresso](https://help.trainerize.com/hc/en-us/articles/360033938972-Tracking-and-Measuring-Client-Progress). Aplicação ao FitFlow: comparação perto do exercício, informação numérica com unidade e confirmação ligada à ação. É interpretação para o produto; não houve auditoria de contas concorrentes nem cópia de seus assets.

### Fluxo local verificado

| Passo | Evidência e resultado | Limite |
|---|---|---|
| 1. Histórico avulso | Fixture exclusiva com 12 registros fictícios; expansão por Enter revelou os quatro restantes. Total de 2.200 kg·repetições, 11 completos e um sem repetições. [Desktop com foco](evidence/160-student-history-tail-20261017.jpg), [375 px](evidence/161-student-history-mobile-20261017.jpg). | Não mistura sessões com avulsos; máximo da consulta continua 100. |
| 2. Nutrição | Cenário fictício 80 kg/180 cm/30 anos: repouso 1.780, cenário 2.670 kcal, proteína 128 g, carboidrato 372,6 g, gordura 74,2 g. Salvar confirmou 80 kg; cálculo posterior de 90 kg permaneceu local. Após recarga, Recuperar trouxe 80 kg com escopo desmarcado, sem cálculo automático. [Composição desktop](evidence/165-nutrition-result-desktop-20261017.jpg). | Corpo fictício, apenas na conta exclusiva local; estimativa educativa, sem prescrição. Corridas e timeout foram reproduzidos em testes controlados, não por falha forçada de produção. |
| 3. Presença | Consulta real de perfil/lista vazia foi aceita pelo contrato validado. A captura inicial revelou botões com `hidden` sobrescrito pelo CSS; regra corrigida e inspeção confirmou `display:none`, altura zero. [Estado corrigido](evidence/168-student-presence-corrected-20261017.jpg). | Nenhuma entrada foi registrada pelo navegador. Casos de resposta inválida/troca de conta foram testados no harness. |
| 4. Diálogo avulso | Valores fictícios 22 kg/8 reps e observação voltaram ao reabrir. Em 375 px, diálogo 311 px, sem overflow horizontal; recuperação permaneceu oculta. Escape fechou e devolveu foco ao botão de origem. [Rascunho mobile](evidence/169-student-draft-mobile-20261017.jpg). | Nenhum registro avulso foi enviado; RAM é encerrada no logout/recarga. |

Em 1280/768/375 px, os estados inspecionados não apresentaram overflow horizontal após estabilização. Na nutrição, inputs medidos em 16 px/46 px; ações da conta em 768 px tinham 46 px de altura. A primeira leitura imediatamente após redimensionamento foi transitória e rejeitada; as medições estáveis orientaram a aprovação. Capturas 162/164 cortavam o bloco pretendido e não foram aceitas como prova completa. Emulação e screenshots não certificam acessibilidade integral nem substituem aparelho físico.

### Gates técnicos e limpeza

Suíte nativa integral **790/790**, zero falhas/ignorados; 49 testes adicionais em relação à revisão anterior, incluindo identidade de render, ambas as epochs, prazo, snapshot salvo, consulta/revisão e navegação. Falhas foram reproduzidas antes da correção. Sintaxe e gate de arquivos privados aprovados. O gate cobre segredos locais conhecidos e arquivos publicáveis, não todo o histórico Git.

A fixture exclusiva e sua simulação nutricional foram removidas por IDs e ownership conferidos; as contagens anteriores de usuários, alunos, fichas, exercícios, logs e nutrição foram restauradas. O teste integrado de checkout voltou a passar no MariaDB nativo: conciliação concorrente gerou um lançamento para a intenção, ownership foi respeitado, reembolso ficou em revisão e conta inativa foi recusada. Provedor controlado, sem chamada ao Mercado Pago ou estorno real. Aprovação externa de Pix/cartão continua pendente.

Código funcional enviado em `b84c5b520ba6267a656cccd21f682dbb46f8acb4`. O estado da publicação e seus gates são registrados em [Estado da entrega](STATUS_ENTREGA.md); teste local não é evidência de deploy.

CI e Git/Vercel concluíram com sucesso; o alias canônico respondeu saúde 200/banco ready/API no-store e **30 assets** foram comparados aos blobs Git por SHA-256. No browser HTTPS, login e consulta de presenças demonstrativas confirmaram o estado publicado, com recuperação oculta e sem registrar nova entrada. [Captura publicada](evidence/170-student-presence-vercel-20261017.jpg). O gate local de 12 logs não foi repetido gravando dados no banco remoto.

Uma nova geração real de treino respeitou contexto/equipamentos, mas revelou distribuição corporal insuficientemente explicada; [amostra reprovada e próxima correção](IA_GRATUITA.md#revisão-de-cobertura-do-rascunho--17102026). Esse achado mantém o gate científico do chat aberto, mesmo com CI e deploy aprovados.
