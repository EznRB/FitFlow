# Revisão visual de todo o FitFlow

Pedido reafirmado em 12/10/2026: dar personalidade, cuidado e variedade às telas, preservando laranja/navy/Barlow. Pequenos ajustes de espaçamento não encerram essa revisão. O objetivo completo permanece aberto; implantação e CI ficam em [Estado da entrega](STATUS_ENTREGA.md).

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
| Matrícula e planos / gestor | Campos por tarefa, controles durante consulta, retry das listas; [84](evidence/84-matricula-vercel.png), estados locais de erro/modal. | Matriz completa de edição/validação/lista vazia e 768 para cada formulário. |
| Biblioteca / gestor e instrutor | Busca/paginação, filtros, leitura de imagem/origem/licença, foco no modal; [95](evidence/95-catalogo-vercel.jpg) / [96 mobile](evidence/96-catalogo-detalhe-mobile-vercel.jpg). | Falha real da fonte/sincronização após alterações; não validar prescrição por imagem. |
| Fichas / instrutor e aluno | Prescrição e execução separadas, último registro com data/ausência; [117](evidence/117-ficha-vercel.jpg), avulso [122](evidence/122-avulso-vercel.jpg). | Jornada completa do instrutor, todos os estados de revisão/sem ficha e teclado do editor. |
| Caderno / aluno | Entrada em etapas, ledger e resumo semanal; [106](evidence/106-caderno-vercel.jpg) / [107 mobile](evidence/107-caderno-mobile-vercel.jpg), fixture nativa exclusiva limpa. | M01–M14 em telefone físico, teclado/rotação e reconexão publicada. |
| Evolução / aluno | Filtros e foco preservados, erro ligado ao campo, tabela rolável por teclado; [119 mobile](evidence/119-evolucao-mobile-vercel.jpg). | Todos os estados de falta/revisão de exercício no navegador; comparação usa ID, sem inferência por nome. |
| Nutrição / usuários permitidos | Inputs com unidades/método, resultado creme de contraste medido, quatro cenários fictícios; [85](evidence/85-nutricao-resultado-vercel.png). | Teclado e erros de cada parâmetro; estimativa para adulto saudável, sem prescrição clínica. |
| Fundamentos/chat / usuários permitidos | Conversa com autoria distinta, consentimento, fontes curadas; [67](evidence/67-chat-volume-workspace-vercel.png), amostra real com reprovação/correção preservadas. | Contradições/correções do contexto e esclarecimentos controlados em revisão; quota/timeout/recusa no navegador. |
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
