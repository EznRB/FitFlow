# Revisão atual de IA/UX — 22/11/2026

## Escopo e ambiente

Revisão funcional e visual pelo navegador integrado oficial, sem abrir processos de navegador por PowerShell. A rejeição histórica atingia esse lançamento de processo; não equivalia a uma recusa de todas as ações do navegador integrado. O acesso oficial foi consultado e respondeu normalmente, com suas próprias verificações. Nenhuma permissão foi enfraquecida.

Amostra inicial: preview `9febff4`, deployment `dpl_6M6vSbWvdG55vMPGkqHon4XFWT5x`. Correções de quota: `6ad3377`, CI [44992580566](https://github.com/EznRB/FitFlow/actions/runs/44992580566) aprovada. Separação entre acesso restrito e ausência de fichas: preview `da13721`, deployment `dpl_9DQaXYKfSuiqnpPkfsDRsP8psZ7h`. São previews da PR 2; não atribuir a revisão completa à produção.

Correção final dos avisos conferida no [preview `4644b804`](https://fit-flow-b9m5hwubo-eznrbs-projects.vercel.app/), deployment `dpl_9J8tNiDuuZCh6E6QZgApaMFSUUGw`, com CI [44993131983](https://github.com/EznRB/FitFlow/actions/runs/44993131983) aprovada. Essa conferência também permanece restrita ao preview.

Conta demonstrativa de aluno; nenhum dado corporal real, alteração de matrícula, pagamento ou gravação de simulação foi feito nesta rodada. Credenciais permaneceram no arquivo privado ignorado. Larguras verificadas: viewport padrão desktop, 375×812 e 768×1024. Emulação não prova instalação ou teclado de telefone físico.

## Passos e evidências aceitas

| Passo | Observação | Evidência |
|---|---|---|
| 1. Login desktop | Fotografia, formulário rotulado e entrada real da conta demonstrativa. | [Login](evidence/20261122-login-desktop.jpg) |
| 2. Painel inicial | Matrícula vencida e consulta de fichas confundida com ausência. Falha registrada antes da correção. | [Antes](evidence/20261122-aluno-painel-desktop.jpg) |
| 3. Entrada no chat | Consentimento explícito, sugestões e mensagem inicial; nenhuma ficha enviada automaticamente. | [Conversa](evidence/20261122-chat-inicio-desktop.jpg) |
| 4. Rascunho real | Cenário fictício: segunda/quinta, 45 minutos, iniciante, academia completa. Duas sessões estimadas em 43 minutos; 18 séries por sessão, contagens diretas por classificação principal e limites visíveis. Cinco links de referências conferidos no DOM. | [Rascunho](evidence/20261122-chat-rascunho-desktop.jpg) |
| 5. Continuação e quota | Correção fictícia para quinta/35 minutos/halteres sem banco encontrou 429. Texto e consentimento preservados. Não houve insistência nem troca de provedor. A correção semântica dessa continuação ainda não foi comprovada nesta rodada. | [Mobile](evidence/20261122-chat-mobile-current.jpg) |
| 6. Menu móvel | Abertura leva foco a Fechar menu; Shift+Tab retorna ao último controle do menu; Escape fecha e devolve foco ao botão de abertura. | Observação atual pela árvore de acessibilidade; não certifica toda navegação de teclado. |
| 7. Nutrição: validação | Formulário vazio informa erro e foca o primeiro campo obrigatório. | [Entrada mobile](evidence/20261122-nutricao-mobile-inicio.jpg) |
| 8. Nutrição: cenário fictício | Masculino, 80 kg, 180 cm, 30 anos, Mifflin, atividade 1,5, ajuste 0%, proteína 1,6 g/kg e gordura 25%. Resultado: repouso 1.780 kcal; cenário 2.670 kcal; proteína 128 g, carboidrato 372,6 g, gordura 74,2 g. Não foi salvo. | [Resultado](evidence/20261122-nutricao-mobile-resultado.jpg), [768 px](evidence/20261122-nutricao-tablet.jpg) |
| 9. Nutrição: edição | Alterar idade para 31 remove a estimativa anterior e desabilita Salvar até novo cálculo. Cenário restaurado para 30 e recalculado, sem persistir. | Observação atual do resultado e do botão pela árvore de acessibilidade. |
| 10. Caderno | Resposta real diferencia ficha não confirmada por bloqueio de histórico já consultado. Não apagou sessões anteriores. | [Caderno](evidence/20261122-sessoes-tablet-sem-ficha.jpg) |
| 11. Painel com acesso explícito | Preview `da13721` mostra Restrito e orientação de acesso em vez de declarar zero fichas. A captura ainda contém um aviso preventivo redundante, corrigido na revisão seguinte. | [Estado intermediário](evidence/20261122-painel-acesso-restrito-corrigido.jpg) |
| 12. Painel e ficha após correção final | Preview `4644b804` mostra um único aviso de bloqueio, sem aviso contraditório de prevenção nem falso zero. A entrada em Meu treino apresenta orientação de acesso restrito e informa que os registros foram preservados. | [Painel final](evidence/20261122-painel-restrito-final.jpg); navegação de Meu treino conferida pela árvore de acessibilidade. |

Capturas transitórias imediatamente após redimensionar que mostraram bitmap antigo foram rejeitadas. As capturas aceitas foram inspecionadas após atualização do layout. Em 375 px: documento 369 px; em 768 px: documento 762 px, sem overflow horizontal do documento nesses estados.

## Correções resultantes

1. **Quota:** `Retry-After` válido (1–86400 segundos, decimal inteiro) passa da API ao aviso do chat. Prazo mínimo, sem garantia de disponibilidade e sem nova chamada automática. Regressões antes/depois: API 8/8 e interface 11/11 após correção; não somar às suítes integrais. Valores ausentes ou inválidos mantêm orientação genérica.
2. **Consulta das fichas:** contrato `trainingAccess` distingue bloqueio operacional 403 de ausência real. Não consulta fichas bloqueadas; falhas inesperadas ou do banco não são convertidas em vazio. Interface não mostra zero nem exercícios quando a consulta está restrita; motivo escapado e encaminhamento à mensalidade. Backend 7 novos casos + 3 de origem aprovados; UI 3/3, ambos com reprodução anterior da falha.
3. **Avisos contraditórios:** após observar bloqueio junto de “evitar bloqueio”, o aviso preventivo passou a exigir acesso permitido. Duas regressões novas aprovadas: vencido bloqueado e vencido dentro da tolerância. CI 44993131983 aprovada e captura final conferida no preview `4644b804`, com um único aviso de bloqueio e sem falso zero. Meu treino mantém orientação informativa quando o acesso está restrito; históricos foram preservados.

## Limites e próximos passos

### Ampliação da rodada

- **Continuação real da IA:** depois do intervalo, uma única tentativa manual respondeu à correção para quinta-feira, 35 minutos e somente halteres, preservando hipertrofia e iniciante. Propôs uma sessão estimada em 32 minutos, cinco exercícios de três séries, incluindo supino no chão e remada curvada, sem exigir banco. A mensagem saiu do campo após sucesso. [Contexto atualizado](evidence/20261122-chat-continuacao-desktop.jpg). A falha 429 anterior continua registrada; sucesso posterior não garante disponibilidade permanente nem dose individual adequada.
- **Gestão:** login administrativo, painel carregado, busca de aluno com ArrowDown/Enter, resultado único, abertura e cancelamento da edição cadastral. Nenhum cadastro foi alterado.
- **Fichas e catálogo:** a ficha demonstrativa preserva seus três exercícios. O editor carregou 798 entradas; buscar “supino” retornou quatro, distinguindo cadastro local de origem wger. O editor foi cancelado sem salvar revisão. [Editor atual](evidence/20261122-editor-catalogo-desktop.jpg).
- **Instrutor:** login e lista de alunos carregados; navegação visível limitada a fichas, fundamentos e nutrição. Isso comprova a apresentação desses controles, não substitui testes de autorização do servidor.
- **Presenças:** resumo e histórico consultados, ambos sem registros atuais; frequência de 30 dias abriu estado vazio confirmado, e fechar devolveu foco ao botão de frequência. [375 px](evidence/20261122-presencas-mobile.jpg), documento 369 px, sem overflow horizontal nesse estado. Nenhuma presença foi criada ou cancelada; erros de rede não foram artificialmente provocados no ambiente publicado.

A organização editorial, contraste entre superfícies e formulários rotulados foram observados nas capturas, sem conclusão de conformidade WCAG. As contagens do rascunho são planejadas, não treino executado; referências associadas não validam a dose individual. A distribuição gerada sinalizou grupos sem classificação principal, que precisam de revisão do instrutor.

Continuar os estados restantes da matriz visual e integrar a PR 2 após revisão. A continuação descrita acima foi observada no preview inicial `9febff4`; não atribuí-la à produção. O roteiro antigo chama a conta de aluno ativo, mas ela venceu com a passagem do tempo: preparar a demonstração sem adulterar históricos nem registrar pagamento real fictício. Telefone físico M01–M14 e confirmação de revogação da chave Groq continuam pendentes. A apresentação individual de 20–30 minutos será elaborada após estabilização.
