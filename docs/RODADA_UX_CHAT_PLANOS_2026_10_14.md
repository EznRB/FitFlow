# Chat, planos e configuração de pagamentos — 14/10/2026

Continuação da [revisão integral](REVISAO_VISUAL_SISTEMA.md). A meta completa permanece aberta. Esta rodada melhora a leitura e a recuperação de erros; não altera o tema laranja/navy/Barlow nem transforma rascunhos da IA em fichas aprovadas.

## Referências e decisões

[Hevy](https://www.hevyapp.com/) organiza rotinas e registros de execução; [Trainerize](https://www.trainerize.com/features/) distingue programação, acompanhamento e gestão. A aplicação ao FitFlow é uma decisão de design: exercícios e doses recebem hierarquia própria, enquanto preço, vigência e disponibilidade aparecem separados na gestão. Não foram copiados componentes, imagens ou código dos concorrentes; pesquisa pública não equivale a auditoria das contas desses produtos.

## Chat

- Um rascunho estruturado e consistente com a mensagem canônica recebe contexto, sessões, exercícios, séries, repetições, RIR, pausa e contagem direta planejada. Respostas comuns continuam como conversa.
- As estimativas e contagens vêm do servidor. O cliente não recalcula uma segunda prescrição. Dados incompletos ou divergentes voltam ao texto original seguro; conteúdo é inserido por `textContent` e referências são resolvidas por IDs locais.
- Participação indireta, hipóteses de tempo e ausência de justificativa individual de cada dose continuam visíveis. Orientações complementares ficam em “Como interpretar este rascunho”. Nenhuma ficha ou sessão é salva por essa apresentação.
- Histórico enviado ao provedor conserva o texto original. O programa estruturado permanece somente em memória na sessão; logout remove o contexto. Não se enviam automaticamente ficha, nutrição ou histórico de execução.
- A inspeção encontrou dois saltos de leitura: a rolagem interna mostrava o final da resposta; depois da primeira correção, a página externa ainda encobria o início pelo cabeçalho. A correção acompanha somente uma nova resposta recebida, enquanto a conversa está visível e a pessoa está no fim do histórico, sem mover foco. Redraw e leitura anterior conservam posição e detalhes abertos.

## Planos

Valor total, dias de vigência e equivalência aritmética por 30 dias têm hierarquias distintas. A equivalência não configura cobrança recorrente. Formulários têm labels, unidades, erros próximos aos campos, duração personalizada condicional e confirmação junto às ações.

Consultas e escritas têm prazo de 15 segundos. Falha sem confirmação não autoriza repetir silenciosamente uma operação. A revisão independente reproduziu descarte do rascunho em “Conferir planos” e reenvio após fechar/reabrir; a correção conserva os campos, mostra a lista consultada no corpo e exige revisão explícita. Uma leitura da lista não prova que um envio anterior falhou. Essas rotas legadas não ganharam idempotência no servidor.

## Pagamentos

Foi reproduzida configuração indevidamente habilitada com `/?`, `/#`, caminho ou porta personalizada. O adaptador agora exige origem HTTPS, normaliza a origem válida e rejeita essas configurações antes de consultar o provedor. Testes usam valores fictícios, sem publicar credenciais.

35 testes de checkout/interface/contrato/adaptador passaram após dois casos RED de configuração. A integração MariaDB nativa confirmou concorrência, isolamento, quatro conciliações para um lançamento, estorno em revisão e conta inativa; suas fixtures foram removidas. O provedor era controlado: não houve compra, Pix liquidado, chamada externa ao PSP ou alteração de conta.

[Hyperswitch](https://docs.hyperswitch.io/learn-more/frequently-asked-questions), [Kill Bill test plugin](https://github.com/killbill/killbill-payment-test-plugin) e [Asaas Sandbox](https://docs.asaas.com/docs/sandbox) foram reconferidos. Orquestração aberta e simulação não dispensam conta/chave de um processador para transações externas. A integração preparada permanece Mercado Pago; [gates de cartão, Pix pendente e webhook](PAGAMENTOS_SANDBOX.md) continuam abertos.

## Evidência visual local e limites

Capturas numeradas desta rodada ficam no diretório local ignorado `server/tmp/`. A 139 registra o problema de início encoberto, não uma aprovação. As capturas 140/141 mostram plano/editor desktop; 142 mostra editor em 375 × 812, sem overflow, campos de 16 px/45 px; 143 mostra criação em 768 × 1024. Duração fictícia de 45 dias com valor 129,90 mostrou equivalência 86,60. Nome vazio exibiu erro próximo ao campo e recebeu foco; Cancelar devolveu foco a Editar plano. Nenhum cadastro, plano, pagamento ou série foi gravado por essas ações de navegador.

A primeira conversa após a correção externa pediu confirmação explícita de escopo saudável; esse esclarecimento foi preservado como resultado real, sem tratá-lo como rascunho completo. Testes, publicação e capturas finais serão registrados somente após execução. Emulação não prova telefone físico; referências associadas não validam automaticamente toda resposta futura da IA.

## Fechamento local — 15/10/2026

A continuação da conversa revelou falso conflito: “apenas com halteres e chão. Sem banco ou barra.” não tinha nenhuma prova de equipamento selecionável que o próprio servidor aceitasse. Os recortes positivos eram tratados como obsoletos pela frase negativa posterior, enquanto o recorte negativo sozinho não comprovava halteres. A reprodução determinística está em `ia-equipment-proof.test.cjs`.

O schema oferece o turno original completo quando ele tem até 300 caracteres e as declarações de equipamento estão divididas dessa forma. Não concatena mensagens, não normaliza citações, não amplia o limite e não remove as verificações de negação ou correção. Seis casos novos cobrem a conversa, a correção real para máquinas, retirada posterior de halteres, banco inexistente, citação alterada e limite de tamanho.

Após reiniciar somente os processos locais que estavam confirmadamente encerrados, a mesma conversa real Groq passou: esclarecimento saudável seguido da confirmação produziu rascunho para terça, 35 minutos disponíveis, halteres/peso corporal e nenhum banco/barra. A amostra teve flexão, supino no chão, remada e agachamento goblet, três séries cada; contagem direta 6/3/3 e logística estimada de 30 minutos. Isso comprova o cenário observado, sem certificar adequação individual da dose ou todas as respostas futuras. Nenhuma ficha ou sessão foi gravada.

Suíte integral nativa **741/741**, zero falhas/ignorados/cancelados. A execução incluiu concorrência real de séries em fixture exclusiva MariaDB e os testes de apresentação, autoria, negação, isolamento de conta e resultados incertos. Log local: `server/tmp/full-tests-ux-native-20261015.log`. A revisão independente do chat não encontrou P1/P2 no escopo examinado; os dois P2 de planos foram corrigidos com casos RED/GREEN.

No navegador, o início da nova resposta ficou abaixo do cabeçalho. [Exercícios desktop](evidence/147-chat-exercises-local-20261015.jpg), [exercícios em 375 × 812](evidence/150-chat-exercises-mobile-20261015.jpg) e [editor de plano mobile](evidence/142-plan-editor-local-mobile-20261014.jpg) são imagens inspecionadas, com bytes JPEG preservados. Em 375, documento de 369 pixels, exercício com 273 pixels e campo de mensagem 16 px, sem overflow após estabilizar o layout. A captura 148, tomada durante a transição do breakpoint, mostrou largura incorreta e foi rejeitada; 149/150 registram o estado estável. Não foi alterado CSS para esconder essa transição.

Em 768 × 1024, documento de 762 pixels e exercício de 666 pixels também foram inspecionados. O fluxo lista → detalhe → editar → cancelar preservou o plano e devolveu foco ao botão Editar plano, sem escrita. O detalhe recebeu hierarquia de preço total, vigência, equivalência e condições; não representa uma assinatura recorrente.

Publicação do aplicativo ainda precisa de confirmação Git/CI, assets e fluxo servido; os resultados acima são locais. A meta integral e os gates externos permanecem abertos.
