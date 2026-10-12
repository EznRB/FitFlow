# Revisão visual de todo o FitFlow

Pedido reafirmado em 12/10/2026: as telas precisam ter mais personalidade, cuidado e variedade visual. Pequenos ajustes de espaçamento não encerram essa revisão.

## Ordem de execução

Concluir a validação independente da parte financeira e do chat de IA antes da implementação visual. Credenciais, aceite de termos e teste físico que dependem do proprietário ficam identificados separadamente; a preparação do design pode avançar enquanto essas etapas externas aguardam.

## Direção

Preservar laranja/navy e a identidade tipográfica do FitFlow. Pesquisar referências primárias dos concorrentes de treinamento e gestão, comparar telas reais e documentar decisões próprias. Não copiar uma interface nem aplicar a mesma grade de cards a todas as tarefas.

- Painel: composição com foco nas próximas ações, progresso e situação real; hierarquia e densidade adequadas à função de gestor ou aluno.
- Treinos, sessões e progressão: apresentação própria para prescrição, execução e histórico, com distinção visual das métricas; números e gráficos devem manter seu significado científico.
- Fundamentos e chat: leitura confortável, referências acessíveis, conversa bem organizada e controles úteis, sem transformar indicadores fixos em respostas simuladas de IA.
- Nutrição: fluxo de cálculo claro, fórmulas e estimativas identificadas, resultado que facilite acompanhar o cenário escolhido.
- Alunos, planos e catálogo: busca e edição eficientes, tabela/lista adaptadas à informação e ao tamanho da tela; imagens com origem e função útil.
- Financeiro: recibos, ajustes e situação do checkout visualmente distintos; manter histórico, saldo, idempotência e regras de vigência.
- Conta/login e landing: composição editorial e fotografia coerentes com o tema, continuidade visual entre produto e apresentação.

## Ferramentas e prova

Usar pesquisa de concorrentes, habilidades de Product Design, ferramentas de imagem quando necessárias e inspeção real no navegador. Comparar composição desktop e mobile, estados vazios/carregamento/erro, teclado, contraste e foco. Guardar capturas das telas implementadas; imagens conceituais não provam implementação.

## Referências pesquisadas em 12/10/2026

| Fonte primária | Observação | Decisão de design do FitFlow |
|---|---|---|
| [Strong](https://www.strong.app/) | Apresenta o registro como um caderno de treino; sua página oficial mostra séries próximas dos controles de execução. Screenshot oficial inspecionada no navegador. | Hierarquia de prescrição e execução, controles de toque claros e números fáceis de ler. |
| [Hevy — progresso](https://www.hevyapp.com/features/gym-progress/) | Separa carga, volume da série e volume da sessão em visualizações identificadas. Screenshot oficial inspecionada no navegador. | Manter unidade e contexto ao lado da métrica; não usar tonelagem como estimativa de estímulo. |
| [Trainerize — Insights](https://help.trainerize.com/hc/en-us/articles/46648417703956-Using-the-Client-Insights-Dashboard) | Documenta organização por atividade, acompanhamento e indicadores, com diferenças entre web e mobile. Pesquisa de documentação; não foi auditada uma conta do concorrente. | Dar composição própria às tarefas e manter navegação adequada a cada perfil. |

As decisões da terceira coluna são interpretações para este produto. Referências não foram copiadas nem incorporadas como assets do FitFlow.

## Primeira implementação e diagnóstico

Capturas atuais do diagnóstico: dashboard, nutrição e fundamentos antes da revisão, `server/tmp/47–49`; imagens inspecionadas nesta rodada. As três áreas usavam superfícies e densidade semelhantes. O dashboard repetia o título do cabeçalho; a apresentação de frequência suavizava contagens diárias como uma curva. São constatações da interface capturada, não uma certificação de acessibilidade.

`client/css/workspace.css` dá continuidade a Barlow, laranja e navy, com superfície editorial clara para foco. Dashboard recebeu fotografia existente identificada como ilustrativa, título próprio, dois atalhos funcionais e métricas agrupadas. Presença usa barras diárias. Planos destacam valor total e vigência; seleção de alunos para treino tem ação legível; tabelas e financeiro preservam seus controles e conceitos.

Nutrição destaca o resultado e o método em superfícies diferentes. Chat tem abertura e mensagens mais distintas; conteúdo, consentimento e chamada à Groq permanecem. Área do aluno apresenta resumo compacto no celular; treino, sessões e evolução reforçam a hierarquia dos registros. As regras são restritas à aplicação autenticada: login e landing têm seus próprios layouts.

### Provas locais

- 501/501 testes, zero falhas/ignorados. Caso novo de troca de conta reproduziu menu mobile aberto (RED) e passou com inicialização fechada (GREEN).
- Um gate antigo gravava em fichas demonstrativas e acumulava dados. Agora usa aluno/instrutor/plano/ficha/sessões UUID próprios, alvo MariaDB nativo estrito e limpeza restrita aos IDs criados. A suíte completa manteve as contagens existentes: 134 sessões e 168 séries antes e depois. Os registros antigos não foram excluídos por semelhança; a demonstração local ainda contém esse histórico sintético excessivo.
- Capturas inspecionadas 50–65 em `server/tmp`: painel, nutrição/chat, planos/treinos, alunos, financeiro, check-ins, relatórios, painel do aluno, sessões, ficha e evolução. São locais. Capturas feitas durante carregamento ou movimento do menu foram substituídas.
- Emulação 375 × 812: documento de 369 ou 375 pixels nas telas administrativas verificadas e no painel/evolução do aluno. A evolução inicialmente transbordou para 492 pixels; limites de grid corrigidos e nova captura confirmou 369 pixels. Tabelas largas rolam dentro da própria região.
- Atalho de alunos do dashboard e atalho de sessões do aluno verificados pelo navegador. Inspeção sem alteração de ficha, lançamento, série, senha ou contratação.

## Trabalho restante

A primeira publicação visual não encerra a revisão completa. Ainda faltam conferir resultados nutricionais preenchidos e seus estados, conversa real com a nova composição, modais de gestão e de treino, estados de falha/vazio, teclado/contraste por controle, mais larguras, aparelho físico e continuidade com a landing. A publicação e suas capturas serão registradas após o deploy.

## Rodada de resultados e formulários — 12/10/2026

O resultado preenchido mostrou um defeito não visível no estado vazio: os macros herdavam texto claro sobre a superfície clara. A cor foi corrigida no contêiner do resultado; o par medido passou para `rgb(23,35,52)` sobre `rgb(238,232,220)`, contraste calculado de 12,98:1 para esses valores. Isso não certifica o contraste de toda a aplicação.

No navegador local, com parâmetros fictícios de 80 kg, 180 cm, 30 anos, atividade 1,5, ajuste 0%, proteína 1,6 g/kg e gordura 25%, Mifflin e Harris revisada foram conferidos nos dois coeficientes. Repouso, energia e macros exibidos coincidiram com as contas independentes e o arredondamento da apresentação. A primeira comparação de três valores de carboidrato usou números esperados calculados incorretamente; corrigida a conta independente, os resultados da aplicação conferiram. Nenhuma fórmula foi alterada para ajustar a comparação. Edição invalidou resultado/salvamento; campo obrigatório recebeu foco; cenário com energia insuficiente foi recusado sem manter resultado antigo; limpar não excluiu dados previamente salvos. Não houve salvamento ou envio de medidas à IA.

Matrícula e edição cadastral passaram a agrupar identificação, contato, acesso e plano conforme o fluxo. Plano separa nome/vigência de valor/condições e distingue total da equivalência por 30 dias. Campos de modal usam 16 px; controles nativos respeitam o tema escuro. Na emulação 375 × 812, matrícula e plano ficaram em 375 pixels sem transbordamento. Comparação de R$ 129,90 por 45 dias exibiu R$ 86,60 por 30 dias; formulário cancelado sem gravar. Tab/Shift+Tab ficaram no modal e Escape devolveu foco ao botão de origem.

Os botões de criar aluno/plano antes não tinham handler enquanto a lista carregava. Agora abrem o formulário imediatamente com proteção de contexto. Dois casos RED → GREEN conferiram a abertura durante consulta pendente e a preservação do formulário ao receber a lista. Dois outros casos verificam retry após falha, duplo clique antigo recusado, erro escapado e ausência de notificação duplicada. Estão incluídos em 507/507 testes locais, zero falhas/ignorados.

Interrupção intencional do servidor Node local, após confirmar processo e wrapper desta tarefa: alunos/planos mostraram falha e ação de recuperação. Após restaurar o servidor, o botão recuperou planos; a rodada atual de alunos recuperou três registros e reabilitou a busca sem recarregar a página. Aviso da lista atual não duplica toast nem presume que a internet seja a causa. Bancos nativos permaneceram em execução; nenhuma interrupção da Vercel. Capturas locais inspecionadas: `server/tmp/70–83`.

No editor de treino, o catálogo tinha uma segunda região de rolagem que cortava a ação manual; em mobile, seu contêiner agora cresce e a lista conserva o limite de rolagem. Botões de mover/remover passaram de 30/42 para 44 × 44 px, com cabeçalho que acomoda as ações. Documento em 375 pixels; exercício manual foi adicionado somente à tela e cancelado, sem salvar ficha ou doses. Cadastro, plano, perfil e treino foram inspecionados sem criar conta, alterar senha ou realizar lançamento pelo navegador.

Permanecem em aberto a auditoria dos demais estados/controles, outras larguras, apresentação da landing, aparelho físico e os gates externos documentados. As evidências desta seção são locais até a conferência da publicação.

## Publicação confirmada — 12/10/2026

`460e7b0` (`460e7b064d114ccdb1db26756d7cfce5673c45f6`), Production READY `dpl_AZVoNNQS84Cg6jJ8YUn46fE6n51F`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-6znii0d3v-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38204618039) e Preview Git aprovado. Suíte integral **503/503**, zero falhas e ignorados; gate privado aprovado. Saúde HTTP 200, banco ready e API no-store; 14 hashes de interface/autenticação/financeiro conferidos. [Captura do painel publicado](evidence/66-dashboard-workspace-vercel.png).

Conversa real da nova composição foi conferida: a primeira resposta de volume não atendia à pergunta e foi reprovada. Após a correção em `460e7b0`, a repetição manual respondeu com a diferença entre séries e kg·reps, exemplo aritmético e resumo curado ACSM. [Captura da resposta](evidence/67-chat-volume-workspace-vercel.png). A seleção e os limites têm dois novos casos incluídos em 503/503; não comprova pertinência de toda resposta futura. Nenhuma ficha foi alterada. As outras etapas restantes acima continuam abertas.

## Publicação dos formulários e resultados — b5d4288

`b5d4288` (`b5d42889d8a1f642bc591bbbf27cdb832863b6a4`), Production READY `dpl_3Rq7d7WRpNTzsEgWyrK1uEhhRBsB`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-4onrza31i-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38209366822) e Preview Git aprovado. Suíte integral **507/507**, zero falhas e ignorados. Saúde HTTP 200, banco ready e API no-store; 16 hashes de interface/autenticação/financeiro conferidos.

Em `b5d4288`, matrícula, edição e planos têm campos agrupados por tarefa e controles de 16 px; ações de criar funcionam durante o carregamento. Falhas nas listas oferecem recuperação sem duplicar notificações. Resultado nutricional preenchido ganhou contraste correto; editor de treino mobile evita rolagem sobreposta e tem ações de 44 × 44 px. Quatro novos casos estão incluídos em 507/507. Navegador público confirmou matrícula e cenário fictício Mifflin (2.670 kcal/dia, 128 g de proteína, 372,6 g de carboidrato e 74,2 g de gordura), sem cadastro ou salvamento. [Matrícula publicada](evidence/84-matricula-vercel.png) e [resultado publicado](evidence/85-nutricao-resultado-vercel.png). Recuperação com interrupção intencional do Node e as verificações mobile adicionais são locais; não comprovam aparelho físico.

As capturas 84/85 foram inspecionadas na publicação. A seção anterior registra o marco de chat em 460e7b0; os 507 casos incluem os 503 anteriores e quatro novos. O navegador verificou apenas dados fictícios, sem salvar simulação ou criar conta.

## Biblioteca de movimento — implementação local, 12/10/2026

O catálogo antes renderizava 798 entradas em uma única tabela e não oferecia busca por nome. A biblioteca agora exibe 24 resultados por página, busca sem distinção de acentos e filtros de grupo, idioma/origem e disponibilidade. A paginação é de apresentação no cliente: a API ainda retorna os registros da consulta, sem paginação no servidor. A busca e o idioma refinam essa consulta; o contador explicita ambos os totais. Filtro de português da fonte exclui cadastros locais, que têm opção própria. Em mobile, cada linha acomoda imagem, nome, grupo, status e ações; no desktop/tablet conserva a tabela.

Nome abre leitura dedicada com descrição completa, imagem existente, idioma, autoria e licenças de texto/base/mídia. Conteúdo importado e edição local não recebem certificação científica automática. A leitura declara esse limite e encaminha evidências revisadas para Fundamentos. Imagens são da fonte/cadastro, sem geração ou substituição neste trabalho; origens e créditos continuam disponíveis. Metadados preservados na amostra wger #75: texto de Jhonatan, CC-BY-SA-4.0; base wger.de e imagens #113/#114 de Everkinetic, CC-BY-SA-3.0. Links conferidos no diálogo: [fonte do exercício](https://wger.de/api/v2/exerciseinfo/75/), [imagem #113](https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png), [imagem #114](https://wger.de/media/exercise-images/97/Dumbbell-bench-press-2.png), [licença de texto](https://creativecommons.org/licenses/by-sa/4.0/) e [licença de base/imagens](https://creativecommons.org/licenses/by-sa/3.0/).

Listas, grupos, edição, salvamento, confirmação e sincronização têm guards de conta/papel/generation/epoch, tela e âncora. Edição também respeita a revisão global de abertura/fechamento do Modal: revisão independente reproduziu uma consulta antiga substituindo Segurança da conta, e o novo caso RED → GREEN cobre diálogo de outro módulo, inclusive aberto/fechado e erro tardio. Enter e botão compartilham o envio pendente; uma escrita concluída conserva sua resposta sem fechar um formulário posterior. Retry da lista não duplica consultas e escapa erro. Treze casos novos estão incluídos em **520/520 testes locais**, zero falhas/ignorados; os dois casos anteriores de escape/proveniência continuam aprovados.

Navegador local: busca `elevacao` encontrou nomes acentuados; `supino`/português da fonte retornou dois registros. Próxima mostrou 25–48 de 798; filtro sem correspondência e inativos exibiram vazio explícito, sem alterar registros. Descrição/imagem/créditos foram inspecionados, Escape devolveu foco ao nome, Tab/Shift+Tab ficaram no modal. Em 375 × 812, documento 369 pixels na lista e 375 no modal; campos 16 px, ações e fechar 44 × 44 px. Em 768 × 1024, documento 762 pixels e tabela 693 pixels. Capturas locais 86–90 foram inspecionadas; a primeira captura 86 após recarga mostrou dashboard transitório e foi substituída pela biblioteca estável. Nenhum exercício, ficha, sessão ou dado cadastral foi gravado; sincronização externa não foi acionada no navegador. Emulação não comprova aparelho físico.

A publicação desta biblioteca será registrada após conferência do deploy; o marco público de formulários acima permanece a última evidência confirmada até então.
