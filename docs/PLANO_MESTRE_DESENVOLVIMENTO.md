# Desenvolvimento completo do FitFlow

Meta ativa criada em 07/10/2026 a pedido do usuário. A conclusão exige todos os critérios abaixo; a conclusão de uma etapa não encerra a meta.

## Direção e ordem

Manter a identidade laranja/navy e Barlow. O usuário rejeitou o aspecto genérico da primeira entrega: reduzir cartões repetitivos, excesso de caixa alta e efeitos decorativos; priorizar hierarquia, leitura, organização e acabamento das interações. A landing apresenta o produto e a autoria acadêmica; o sistema serve jornadas reais de gestor/instrutor/aluno. Conteúdo científico deve mostrar fonte, população e limites.

1. **UX/UI:** auditar capturas atuais, definir regras de componentes e refinar landing, login, navegação, nutrição, treinos, registros e gestão. Verificar teclado, estados, 375/768/desktop e tema consistente.

   Pedido reafirmado em 12/10: concluir a validação financeira e do chat de IA, depois revisar a UX/UI de **todas** as telas com referências primárias de concorrentes e uma direção própria, preservando o tema. A revisão completa de design ainda não está concluída. [Brief e critérios por tela](REVISAO_VISUAL_SISTEMA.md).
2. **Banco/login:** manter a demonstração nativa e o Neon publicado funcionais, preservar históricos e migrations e validar contas admin/instrutor/aluno. O Aiven ficou inacessível; seus dados não foram recuperados.
3. **Segurança:** impedir criação pública de administradores; revogar acesso de usuários desativados; eliminar segredo JWT padrão e senha compartilhada; corrigir IDOR/check-in e XSS/pagamentos; testar autorização de todas as rotas.
4. **Fluxos de academia:** validar CRUD, plano/renovação, presença e cancelamento, relatórios e dashboards com banco. Corrigir decisões de datas e relações inconsistentes.
5. **Treino científico:** catálogo curado e identificável, planejamento compatível com objetivo/disponibilidade, registros reais de sessão/série/repetições/carga/RIR, progressão comparável e volume sem preencher dados ausentes. Sem prescrição universal automática.
6. **Nutrição:** manter equações determinísticas, referências e hipóteses; persistência optativa e por usuário, exclusão e sincronização. Diário alimentar somente com unidades e fontes rastreáveis.
7. **IA:** chat contínuo sobre treinamento, hipertrofia e exercícios, com proposta de divisão baseada na rotina informada. Pedir contexto faltante e enviar somente mensagens digitadas após consentimento; não anexar dados do perfil. Corpus curado, cálculos determinísticos, proposta estruturada validada e contagens calculadas no servidor. Validar formato/fontes, isolamento, erros e limites distribuídos; conferir amostras reais sem tratar JSON como certificação científica.
8. **Mobile:** interface completa e persistência de sessão; PWA, cache público e fila de registros com idempotência/isolamento por conta. Validar offline e reconexão; embalagem nativa apenas se necessária.
9. **Pagamentos:** Pix/cartão em sandbox, cobrança criada no backend, assinatura de webhook e idempotência. Validar cartão aprovado/rejeitado/pendente; Pix QR/pendente sem renovação, respeitando que sandbox não simula liquidação Pix. Conciliação Pix `approved` fica nos testes com doubles. Lançamento manual tem idempotência própria e não comprova Pix/cartão; retorno do navegador não confirma pagamento. [Roteiro e fontes](PAGAMENTOS_SANDBOX.md).
10. **Entrega:** testes de integração por papel, migração reproduzível, documentação acadêmica e demonstração. Publicação após validação; nenhuma transação real necessária.

## Critérios finais

- Login publicado funciona e banco/migrations/dados de demonstração estão confirmados.
- Fluxos pessoais e administrativos usam dados persistentes e autorização testada.
- Todas as recomendações de treino/nutrição são rastreáveis; hipóteses e dados faltantes aparecem na interface.
- UI coerente, legível e revisada visualmente, sem ações quebradas ou promessa de recurso ausente.
- Sessões/séries e sincronização mobile têm testes de duplicidade e isolamento por usuário.
- Sandbox de cartão confirma/rejeita/mantém pendente adequadamente; Pix gera QR/pendente sem renovar vigência, sem exigir liquidação indisponível nesse ambiente. Chaves não vão ao frontend.
- Limitações e pendências estão documentadas; testes obrigatórios passam.

## Estado

Em desenvolvimento, com integração local/remota em 12/10/2026. MariaDB nativo funciona sem Docker; oito migrations MySQL e contas demonstrativas isoladas. Neon PostgreSQL 17 Free em São Paulo tem cinco migrations próprias aplicadas nas duas branches, incluindo idempotência manual, origem, ajustes financeiros e versão de credencial. Login público recuperado com credenciais novas, sem recuperação dos dados Aiven. Gestão, catálogo wger, sessões/séries, progressão e nutrição optativa implementados. Credenciais Mercado Pago continuam pendentes. Groq Free foi confirmado no console; chave e flag Free estão configuradas privadamente em Production/Preview.

Na revisão `bb68606`, Planos agora protege requisições e formulários de contextos anteriores. Campos mobile de 16 pixels e duração personalizada condicional foram conferidos em HTTPS. [Captura 39](evidence/39-plano-vigencia-mobile-vercel.png). Gestão HTTPS e capturas 37/38 registram `16b09b6`; conversa real e capturas 35/36 registram `943d495`.

Chat contextual homologado em `943d495` (401/401), capturas 35/36: rotina inicial em `5e4ec38` e repetição manual da continuação em `943d495`. Histórico em memória e conteúdo curado são escolhas explícitas; resultados iniciais reprovados permanecem registrados. A amostra final não certifica futuras gerações nem adequação individual.

Gates anteriores: PostgreSQL nativo/Neon isolado, runtime limitado, HTTPS de perfis e gestão, nutrição consentida, presença, renovação/replay e fixtures próprias limpas. No navegador publicado, treino persistiu com 20 kg × 8/RIR 2/160 kg·reps e nutrição foi salva/restaurada exigindo nova confirmação. Fila local sincronizou série uma vez e recarga offline retornou fallback público.

Revisão anterior `62ff0af`: guardas de sessões/IDB/epoch e limpeza aguardada entre abas, sem migration. Hashes publicados conferidos, sessão do aluno restaurada e histórico 20 kg × 8/RIR 2/160 kg·reps verificado em 375 × 812, captura 26. As corridas foram reproduzidas nos harnesses controlados; a captura comprova o fluxo normal. Gestão HTTPS anterior `4b89e3` e captura 24 permanecem evidências datadas. Landing `c6b43ba` READY. Papel `fitflow_runtime` removido com autorização e ausência reconfirmada pelo MCP.

Revisão de gestão/login `3adf5c1`: publicada em READY com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38054589595). HTML/login.css/WEBP/alunos.js coincidiram com o checkout; saúde HTTP 200 e banco ready. Gate HTTPS de gestão aprovado, com três logins e fixtures próprias removidas, sem reset de quotas. Login editorial conferido localmente em 1280 e 375 pixels com teclado e controles; quatorze testes novos protegem lista/formulário/modal de alunos e três backend cobrem edição parcial/cancelamento/presença inativa.

Groq Free a US$ 0 foi confirmado. A explicação real local de divisões levou aproximadamente 1,2 segundo e foi inspecionada contra Ramos-Campo (2024)/ACSM (2026); divisões reais em HTTPS também foram conferidas. Nutrição real publicada foi inspecionada com limitação terminológica basal/repouso, sem certificação factual integral. Captura 27 e geração desativada pertencem à revisão anterior `7b856e0`; capturas 28/29/31 registram o novo login e captura 30 registra nutrição. Não há fallback pago. [Receita e evidências](IA_GRATUITA.md).

A revisão anterior `9e1b5c5` acrescentou fatos operacionais ao contexto, mas a segunda amostra real de volume confundiu séries previstas com repetições e foi reprovada. As duas reprovações motivaram substituir inferência nesse tema por glossário revisado determinístico, sem provedor externo.

A baseline `f9ac83d`, preservada na revisão publicada, implementa essa decisão: glossário fixo, `generatedByAI: false`, botão **Entender indicadores**, sem chamada externa/quota de inferência e com autenticação/autorização/CSRF/proteção global mantidas. Prompt nutricional distingue repouso e basal. Naquela revisão, deployment `dpl_AhGq8iVB9UYq55ZjDmP51zpDPZGq` READY, alias e [CI aprovados](https://github.com/EznRB/FitFlow/actions/runs/38055351767). Saúde/banco e hashes conferidos; navegador confirmou o glossário, captura 32. Implantação atual e verificações posteriores em [Estado da entrega](STATUS_ENTREGA.md).

Mercado Pago real de teste, telefone físico/instalação, reconexão publicada e revisão/merge dos PRs continuam pendentes. A conta Mercado Pago ainda precisa ser criada/configurada. Troca de senha pelo titular e revogação passaram nos bancos nativos, Neon de verificação e HTTPS publicado em `3f48109`; [contrato e limites](TROCA_SENHA.md). A primeira revisão visual amplia a composição das telas, com 503/503 testes locais e publicação verificada em `460e7b0`; a revisão completa permanece em andamento. Ajustes financeiros administrativos estão implementados em `9d0361e`; não executam devoluções no provedor. Proveniência do catálogo implementada em `8c35628`, sem reclassificar o histórico existente. Corridas da tela de Planos foram corrigidas e verificadas em `bb68606`. A entrega completa depende desses itens; o trabalho independente continua conforme solicitado. [Estado completo](STATUS_ENTREGA.md) e [revisão atual](REVISAO_FINAL.md).

Planos detalhados anteriores: `superpowers/plans/2026-10-07-landing.md`, `2026-10-07-sistema-ux-arquitetura.md` e `2026-10-07-ciencia-ia-mobile.md`. Estado atual em `STATUS_ENTREGA.md`; planos datados registram decisões anteriores.

### Integração do catálogo — implementada

`catalogExerciseId` opcional e `catalogSnapshot` versionado são capturados pelo servidor na transação da ficha. A origem original é separada da adaptação do instrutor, com créditos de base/texto/imagem; a sessão copia essa origem ao iniciar. Migrations aditivas e gates reais antecederam a publicação. Exercícios manuais e legados permanecem sem referência, sem reconstrução por nome. A progressão continua separada por ID do exercício da ficha, mesmo quando duas fichas usam o mesmo catálogo.

## Marco de formulários — 12/10/2026

`b5d4288` (`b5d42889d8a1f642bc591bbbf27cdb832863b6a4`), Production READY `dpl_3Rq7d7WRpNTzsEgWyrK1uEhhRBsB`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-4onrza31i-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38209366822) e Preview Git aprovado. Suíte integral **507/507**, zero falhas e ignorados. Saúde HTTP 200, banco ready e API no-store; 16 hashes de interface/autenticação/financeiro conferidos.

Em `b5d4288`, matrícula, edição e planos têm campos agrupados por tarefa e controles de 16 px; ações de criar funcionam durante o carregamento. Falhas nas listas oferecem recuperação sem duplicar notificações. Resultado nutricional preenchido ganhou contraste correto; editor de treino mobile evita rolagem sobreposta e tem ações de 44 × 44 px. Quatro novos casos estão incluídos em 507/507. Navegador público confirmou matrícula e cenário fictício Mifflin (2.670 kcal/dia, 128 g de proteína, 372,6 g de carboidrato e 74,2 g de gordura), sem cadastro ou salvamento. [Matrícula publicada](evidence/84-matricula-vercel.png) e [resultado publicado](evidence/85-nutricao-resultado-vercel.png). Recuperação com interrupção intencional do Node e as verificações mobile adicionais são locais; não comprovam aparelho físico.

## Marco financeiro — 11/10/2026

Correções de recebimentos manuais e devoluções informadas são eventos permanentes com UUID, motivo, responsável, saldo em centavos e efeito explícito de vigência. O recibo pago é protegido por trigger; não há operação de reembolso no provedor por esse formulário. Novos recebimentos capturam concessão real; registros legados não permitem reversão automática. Alteração de plano/status exige revisão atual e todos os escritores de matrícula compartilham o lock. Relatórios separam bruto, correções, devoluções informadas e líquido pela data efetiva do evento. [Contrato e testes](AJUSTES_FINANCEIROS.md).

Gates reais aprovados nos dois bancos nativos, branch Neon de verificação e API HTTPS publicada. Foram aplicadas sete migrations MySQL e quatro PostgreSQL, incluindo a de ajustes nas duas branches Neon. Runtime confirmou SELECT/INSERT de ajustes e negou UPDATE/DELETE, com probe revertido. API pública verificou saldo parcial/integral, replay, forjados/auth/405, CAS após renovação, alteração explícita de vencimento, mensalidade e relatórios; dois logins e somente fixtures UUID próprias removidas, sem chamadas ao PSP. Capturas 41/42 são locais; captura 43 mostra dashboard publicado após a limpeza. Emulação não comprova telefone físico.

## Publicação da biblioteca — d60d072

`d60d072` (`d60d0722b858881319810d1233e492fcd951ee02`), Production READY `dpl_9jnWh8FRjp4hXFiZ1gQE1Z56cj35`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-q46jbzn61-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38279551464). Suíte integral **520/520**, zero falhas e ignorados. Saúde HTTP 200, banco ready e API no-store; 17 hashes de interface/autenticação/financeiro conferidos. A consulta de checks desta revisão não apresentou status do Preview Git; a publicação Production pelo CLI foi confirmada.

Biblioteca de movimento publicada em `d60d072`: busca sem distinção de acentos, filtros, páginas de 24 e leitura dedicada com imagem/descrição/créditos. Paginação de apresentação no cliente, sem nova API ou migration. Treze novos casos protegem lista/grupos/edição/envio/sincronização por contexto e descartam leitura antiga após qualquer diálogo abrir/fechar. **520/520** locais; [biblioteca publicada](evidence/95-catalogo-vercel.jpg) e [leitura mobile publicada](evidence/96-catalogo-detalhe-mobile-vercel.jpg). Busca `supino`/português da fonte encontrou dois registros; modal em 375 × 812 ficou em 375 pixels, fechar com 44 px. Medição imediata após mudar o viewport ainda não refletia o layout final; a medição e captura posteriores confirmaram 375 pixels. Não houve escrita de exercício, ficha ou série nem sincronização externa no navegador. Créditos/limites das descrições em [Revisão visual](REVISAO_VISUAL_SISTEMA.md).

A captura 95 inclui a imagem #105, [Incline-press-1.png](https://wger.de/media/exercise-images/16/Incline-press-1.png), de Everkinetic, CC-BY-SA-3.0, da [referência wger #537](https://wger.de/api/v2/exerciseinfo/537/); texto de Jhonatan, CC-BY-SA-4.0. A captura 96 inclui a imagem #113 de Everkinetic, CC-BY-SA-3.0, e o texto de Jhonatan, CC-BY-SA-4.0, da referência #75 documentada na revisão visual. Capturas guardadas como JPEG, conforme os bytes retornados pelo navegador.

## Continuidade da landing — publicação 754b27f

Landing `754b27f` publicada em READY `dpl_G157NAMK6HzXawYqQi1ZHBry48DS`: títulos Barlow Condensed, fundamentos creme/navy, captura real do painel com identificação demonstrativa e CTA no menu mobile. Textos distinguem parâmetros locais da calculadora de mensagens compartilhadas com a Groq por consentimento; IA configurada e checkout Mercado Pago indisponível estão descritos. Browser público: documento 360 pixels em 375 × 812, Escape fechando menu/foco no botão, destino canônico e captura carregada. Build/typecheck e gate de hashes passaram; auditoria npm atual retornou zero vulnerabilidades conhecidas. [Hero publicado](evidence/98-landing-vercel.jpg), [ciência publicada](evidence/100-landing-fundamentos-vercel.jpg) e [produto em mobile](evidence/101-landing-produto-mobile-vercel.jpg). Sem certificação de toda acessibilidade ou aparelho físico. A captura do painel reaproveita a prova pública 66 de 12/10, não representa resultados comerciais.

A revisão por subagente foi feita no código/asset, sem navegador compartilhado; a validação visual e teclado foi feita pelo agente principal. O primeiro teste revelou ausência de fechamento por Escape; após a correção, repetição local e pública confirmaram fechamento e foco. Amostra tablet local: 768 × 1024, documento 753 pixels. Prova 93 local não mostrava a seção da captura real e não foi publicada como evidência dessa seção; prova 101 mostra a seção na publicação.

## Avanço do caderno de treino — 12/10/2026

`4f4a7ee` publicado e CI aprovada; 527/527 locais. Registro em duas etapas, números e recibos legíveis, resumo semanal com trabalho/aquecimento separados; reconciliação da ficha por ID preserva rascunhos e exige escolha explícita de exercício removido. Fixture nativa própria removida, históricos existentes preservados. [Evidências e limites](REVISAO_VISUAL_SISTEMA.md). Próximas revisões: ficha/evolução/presença/mensalidade, estados e teclado das jornadas restantes; gates de provedor/aparelho físico continuam dependentes de ação humana.

## Avanço da ficha/Evolução/mensalidade — 12/10/2026

`d5b90d5` publicado e CI/Preview Git aprovados; **555/555** locais e **23 arquivos** conferidos. Ficha recebe origem persistida/data do registro, Evolução mantém filtros com identidade explícita e mensalidade declara disponibilidade sem criar cobrança. [Provas e limites](REVISAO_VISUAL_SISTEMA.md). Próxima ação disponível: reproduzir/corrigir o formulário avulso (callbacks antigos, envio compartilhado, rascunho e submit), depois continuidade das jornadas/estados e revisão final documental. PSP, telefone físico, rotação da chave pelo titular e revisão/merge ainda pendentes.

## Correção do formulário avulso — 12/10/2026

`024a7f0` publicado e CI/Preview Git aprovados; **564/564** locais. Contextos/payloads/envios próprios, Enter sem navegação e rascunho preservado. Teste nativo exclusivo confirmou um registro e limpou somente IDs próprios, com 134 sessões/168 séries/0 avulsos anteriores preservados. [Provas](REVISAO_VISUAL_SISTEMA.md). Próximas ações disponíveis: consolidar a revisão de jornadas/estados e a documentação atual, conferir lacunas de entrega; gates de PSP/aparelho físico/rotação pelo titular e revisão dos PRs continuam abertos.
