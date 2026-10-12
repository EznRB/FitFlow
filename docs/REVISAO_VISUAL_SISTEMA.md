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
