# Continuidade: quota da IA e acessibilidade funcional

## Mudanças verificadas

- A IA preserva `Retry-After` numérico válido recebido da Groq em respostas 429. A mensagem informa uma espera mínima, sem prometer recuperação da quota; não há tentativas automáticas adicionais. Cabeçalhos ausentes, inválidos ou superiores a um dia mantêm a mensagem genérica.
- O middleware devolve o cabeçalho somente para erros operacionais 429 com espera inteira validada. A resposta da IA continua sem cache e não expõe o corpo privado do provedor.
- As sugestões de alunos permitem seleção com setas e Enter, fechamento com Escape/Tab e atributos de combobox/listbox.
- Avisos de validação ficam dentro do diálogo ativo, acessíveis enquanto o restante da página permanece inerte. Mensagens são inseridas com `textContent`.

Referência do provedor: [Groq — Rate limits](https://console.groq.com/docs/rate-limits).

## Evidência

Em 11/11/2026, `node scripts/with-local-env.cjs node --test tests/*.test.cjs`, executado em `server`, terminou com código 0: **862 testes aprovados, nenhuma falha e nenhum teste ignorado**. Log completo local ignorado: `server/tmp/full-continuation-20261111.log`.

Os testes incluem respostas 429 nas três etapas da IA, limites do cabeçalho, ausência de repetição automática, resposta HTTP real local, navegação das sugestões e ciclo de vida dos avisos no modal.

Essa verificação é funcional e por código; não certifica aparência, contraste ou leitura por tecnologia assistiva real. A revisão visual da PR 2 permanece pendente. Não houve cobrança, configuração de conta de pagamento ou alteração de credenciais nesta rodada.

## Continuidade

A automação `concluir-desenvolvimento-do-fitflow` foi criada ativa com retomadas a cada 30 minutos neste chat, sujeitas aos limites do aplicativo. Ela mantém o plano completo e a apresentação após estabilização. Isso não altera o estado da meta antiga na ferramenta de goals, que continua pausada.

Na continuação, o menu móvel passou a conter Tab e Shift+Tab nos controles visíveis e habilitados, recuperar foco vindo do conteúdo coberto e respeitar a precedência do diálogo modal e de ancestrais inertes. Escape e mudança para desktop mantêm fechamento/restauração. Quatro regressões novas reproduziram as falhas antes da correção.

A suíte integral após essa mudança terminou com código 0: **866/866 testes**, sem falhas ou ignorados; log local ignorado `server/tmp/full-sidebar-continuation-20261111.log`. A CI de `65c27a0` foi aprovada no [run 43061653288](https://github.com/EznRB/FitFlow/actions/runs/43061653288); esse resultado antecede a mudança do menu.

A conclusão geral continua dependente dos demais gates do plano, incluindo inspeção visual, celular físico e configuração do provedor de pagamentos.

## Paginação e recebimento manual

- O catálogo preserva o foco no controle habilitado ao chegar à primeira ou última página; atualizar filtros não desloca o foco do campo.
- O formulário de recebimento manual aceita submissão por Enter pelo mesmo método de envio e conserva a proteção contra callbacks de um modal substituído. Falhas de aluno/valor ficam vinculadas ao campo, marcam `aria-invalid` e levam o foco até ele. Os erros têm indicação textual e visual. Payload e processamento financeiro foram preservados; não foi executada cobrança.
- Antes das correções, os testes novos reproduziram uma falha da paginação e duas falhas do formulário. Após integração, **870/870 testes locais**, zero falhas e ignorados, código de saída 0. Log integral ignorado: `server/tmp/full-catalog-payment-a11y-20261111.log`.
- A revisão anterior `39205bd` teve [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43061885778) e [preview READY](https://fit-flow-7ngmmz8bx-eznrbs-projects.vercel.app). Saúde HTTP 200/banco ready; sidebar, autocomplete, toast, modal e CSS de componentes retornaram 200 e SHA-256 igual aos blobs Git dessa revisão. Esses resultados antecedem as mudanças desta seção e não constituem inspeção visual.

A ferramenta recusou criar outra meta porque a antiga permanece inacabada e pausada. Nenhuma meta foi marcada como concluída para contornar essa restrição. A automação de continuidade é independente desse estado.

## Formulários de gestão e caderno

Criação e edição de alunos e exercícios agora oferecem submissão por Enter. Os handlers, validações nativas e proteções contra callbacks obsoletos foram preservados. Dois testes novos falharam antes de inserir os controles de submit.

O caderno transfere foco ao seletor de exercício, título de finalização ou próxima ficha quando a ação substitui o controle focado. Atualizações de histórico iguais preservam o DOM; quando o conteúdo muda, expansão e foco são restaurados por ID da sessão. Detalhes aninhados usam posição dentro do snapshot histórico; isso não garante correspondência se o próprio snapshot reordenar seus exercícios. Atualizações não tiram foco das notas digitadas. Duas falhas funcionais foram reproduzidas antes da correção e três regressões cobrem os cenários.

Após integração: **875/875 testes**, nenhuma falha ou ignorado, saída 0, log local ignorado `server/tmp/full-management-sessions-a11y-20261111.log`. A mudança não altera store, fila, propriedade dos dados ou processamento financeiro.

A revisão anterior `20cb718` teve [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43062837248) e [preview READY](https://fit-flow-njiaf9ika-eznrbs-projects.vercel.app); catálogo, pagamentos e CSS alterados retornaram 200 e hashes iguais aos blobs Git. Esses resultados antecedem as mudanças desta seção. O contraste nominal do texto de erro `#ef4444` sobre o fundo do modal `#111827` é 4,71:1; esse cálculo de tokens não substitui inspeção das telas renderizadas.

## Fechamento da revisão funcional

Revisão funcional `88e3fce85a1ae79cf03186328ca078ea12826d49`: [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43063712394) e [preview READY](https://fit-flow-4tow4gv7o-eznrbs-projects.vercel.app). Saúde HTTP 200 com banco ready; alunos, catálogo e caderno responderam 200 e corresponderam por SHA-256 aos blobs dessa revisão. Revisão independente estática do diff `39205bd..88e3fce`, incluindo os cinco arquivos de runtime e quatro testes novos, não encontrou defeitos relevantes; não incluiu inspeção no navegador.

A conferência local de configuração encontrou token sandbox e segredo de webhook ausentes em todos os arquivos privados `.env` existentes, sem imprimir valores ou modificá-los. Esse resultado não comprova a configuração remota nem encerra o gate do provedor externo.

## Retomada automática: presenças e relatórios

A CI da revisão documental `f833b9b` foi [aprovada](https://github.com/EznRB/FitFlow/actions/runs/43064019875). MariaDB nativo conferido em escuta local na porta 3308; não havia servidor de frontend nas portas 3107/3108 durante a consulta.

Em presenças, a atualização da tabela agora transfere o foco de um controle que será removido para o corpo estável da tabela, antes de substituir seu conteúdo. A resposta posterior não recupera foco se o usuário já tiver ido a outro campo. O botão de tentar novamente deixa de ser desabilitado antes dessa transferência; a versão da consulta e a substituição síncrona continuam recusando cliques de callbacks antigos.

O primeiro teste reproduziu uma falha. A revisão independente identificou que desabilitar o botão poderia perder o foco antes da transferência; o cenário ampliado reproduziu a falha residual, corrigida antes do envio. Revisão final sem achados residuais concretos. **877/877 testes locais**, sem falhas ou ignorados, código 0; log completo `server/tmp/full-presence-focus-reviewed-20261111.log` e logs RED/GREEN preservados no mesmo diretório ignorado.

A auditoria estática de relatórios não encontrou defeito concreto nos fluxos examinados de filtros, impressão, respostas obsoletas e loading/erro; não houve alteração nem repetição de seus testes isolados. Inspeção real de teclado/tecnologia assistiva continua pendente. Essa rodada não encerra os demais gates do projeto.

Presenças `25ade18908f240d8a6ca9ffc648ae2c4bff1ec79`: [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43065863617) e [preview READY](https://fit-flow-4dpl0g42d-eznrbs-projects.vercel.app), com SHA da implantação conferido.

## Recuperação do painel administrativo

A consulta do painel agora usa prazo de 15 segundos pelo cliente HTTP existente. O botão de recuperação confere sessão, papel, conta, geração, epoch, versão de consulta e identidade dos elementos antes de navegar; o callback é consumido após um clique. A tela de erro pode recuperar o painel mesmo após remover o layout original, sem permitir que callbacks obsoletos reabram a página de outra jornada.

Os dois testes novos falharam antes da correção. A suíte integral após a mudança aprovou **879/879 testes**, zero falhas ou ignorados, saída 0, log `server/tmp/full-dashboard-recovery-20261111.log`. Revisão independente estática sem regressão concreta. Sem mudanças de permissões de backend, dados financeiros ou credenciais. CI e preview dessa mudança devem ser conferidos por seu próprio SHA antes de atribuir aprovação.
