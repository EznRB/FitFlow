# Histórico do plano e da apresentação do repositório

Snapshots preservados em 12/10/2026 antes da consolidação do README e do plano mestre. Os relatos, reprovações, contagens, revisões e capturas abaixo pertencem às versões descritas. “Atual” nos snapshots não identifica a implantação vigente; consulte [Estado da entrega](STATUS_ENTREGA.md).

O texto integral foi preservado. Apenas os destinos relativos do README foram ajustados por este arquivo estar em docs. A repetição histórica é intencional para não perder contratos ou evidências; não é uma segunda fonte de acompanhamento.

[Plano mestre ativo](PLANO_MESTRE_DESENVOLVIMENTO.md) · [Auditoria de requisitos](REVISAO_FINAL.md) · [README consolidado](../README.md) · [Histórico de status/revisão](HISTORICO_ENTREGA.md).

## Snapshot de README.md

# FitFlow Caraguá

Projeto acadêmico de gestão de academia, com áreas de administrador, instrutor e aluno. Interface em português, identidade laranja e azul escuro. A [landing publicada](https://fitflow-lp.vercel.app) apresenta o sistema e aponta ao aplicativo; seu código fica no repositório [fitflow-LP](https://github.com/EznRB/fitflow-LP).

[Abrir o aplicativo](https://fit-flow-indol.vercel.app) · [Estado da entrega](STATUS_ENTREGA.md) · [Guia de desenvolvimento](DESENVOLVIMENTO.md) · [Ciência e limites](CIENCIA.md)

![Tela de acesso publicada do FitFlow em desktop](evidence/28-login-desktop-vercel.png)

Login editorial publicado na revisão `3adf5c1`. Captura de desktop; versões mobile e tablet verificadas em [Estado da entrega](STATUS_ENTREGA.md). As contas demonstrativas são fornecidas por arquivo privado, sem senha universal publicada.

## Revisão atual

Primeira revisão visual publicada: painel editorial com fotografia, identidade laranja/navy e apresentações próprias para gestão, treino, nutrição e conversa. [Direção, referências e trabalho restante](REVISAO_VISUAL_SISTEMA.md). Troca de senha com revogação de sessões validada localmente e na Vercel. Suíte atual: 564/564; Pix/cartão reais em sandbox ainda dependem da configuração do provedor.

![Painel do FitFlow publicado em 12/10/2026](evidence/66-dashboard-workspace-vercel.png)

O caderno de treino também recebeu etapas de registro, números legíveis, séries organizadas e resumo semanal distinto. Foram corrigidas seleção de ficha e preservação do rascunho durante sincronização, além do rótulo de vencimento no dia. [Captura publicada](evidence/106-caderno-vercel.jpg); [registro mobile local](evidence/105-sessao-registro-mobile-local.jpg). A revisão completa de todas as jornadas continua em andamento.

Ficha, Evolução e mensalidade também foram refinadas: prescrição/último registro distintos, créditos persistidos na ficha do aluno, filtros preservados e disponibilidade do checkout explícita. [Ficha publicada](evidence/117-ficha-vercel.jpg) e [mensalidade publicada](evidence/118-mensalidade-vercel.jpg). O formulário avulso foi corrigido: Enter, contexto por modal e rascunho preservado, com prova nativa isolada. A meta completa permanece aberta.

## Desenvolvimento

Node.js **24.x**; MySQL/MariaDB acessível para a demonstração local. **Docker não é necessário.** O ambiente preparado neste computador usa MariaDB nativo em `127.0.0.1:3308`, isolado em `.local-db/`.

```powershell
cd server
npm ci
npm run db:local:start
npm run db:local:migrate
npm run db:local:seed
npm run dev:local
```

Aplicativo: `http://127.0.0.1:3107/`. As contas demonstrativas têm senhas individuais em `server/.demo-credentials.local.json`, ignorado pelo Git. O seed só opera no banco local identificado, é repetível e preserva registros. Não há senha universal publicada.

Para configurar outro computador ou banco, consulte [Desenvolvimento](DESENVOLVIMENTO.md). Não execute seed demonstrativo em produção.

O [aplicativo publicado](https://fit-flow-indol.vercel.app) usa Neon PostgreSQL 17 Free em São Paulo, com schema/migrations separados e conexão pooled. Gates HTTPS confirmaram os três perfis, autorização, gestão, nutrição optativa, presença e renovação manual concorrente. O navegador confirmou autenticação após recarga, treino finalizado persistido e cenário nutricional salvo/restaurado. [Banco, implantação e verificações](BANCO_REMOTO_VERCEL.md).

## Recursos implementados

- Gestão de alunos, planos, fichas, presença, pagamentos manuais e relatórios.
- Lançamento manual de recebimento com UUID idempotente, hash da intenção e vínculo ao administrador; replay não duplica pagamento nem renovação. Esse registro não cobra nem comprova Pix/cartão. A API recusa PUT/PATCH/DELETE do recebimento com 405; correções e devoluções informadas usam eventos auditados, sem executar reembolso no provedor.
- Autenticação em cookie httpOnly; autorização considera o usuário ativo e seu papel atual no banco. Escritas protegidas por origem, API sem cache e quotas de login/IA compartilhadas no banco em produção.
- A inicialização mostra verificação acessível da sessão e impede envio prematuro do login; `/auth/me` tem timeout de 15 segundos, incluindo espera pelo lock. Login/logout/retry coordenam o cookie entre abas com Web Locks e marcador de sessão opaco.
- Catálogo local e importador wger com paginação, identidade externa, idioma, licenças e autoria. Importação local de 08/10: 795 entradas incorporadas e 124 ignoradas. Um catálogo descritivo não valida uma prescrição.
- Registro de sessões e séries com carga externa, repetições, RIR opcional, aquecimento/trabalho, snapshot da ficha e IDs idempotentes.
- Fila de séries por conta em IndexedDB, com estado de sincronização e conflitos visíveis. Leituras e callbacks tardios verificam identidade e tela de origem; logout aguarda limpeza antes de liberar outro login.
- Operações idempotentes de treino e consultas de atualização têm prazo de resposta de 15 segundos por requisição, incluindo leitura do corpo. Um timeout preserva a fila e o UUID para nova tentativa; não confirma nem desfaz uma gravação no servidor.
- Consultas de fichas e histórico distinguem carregamento, confirmação e indisponibilidade. O cache continua disponível; falha de consulta não é apresentada como ausência de dados. A atualização preserva o formulário em preenchimento.
- Recuperação de sessão rejeitada com confirmação e preservação local dos registros. Logout sem conexão não restaura automaticamente a conta ao reconectar.
- Nutrição com Mifflin–St Jeor ou Harris–Benedict revisada, hipóteses explícitas e parâmetros salvos/restaurados por consentimento.
- Chat de IA em Fundamentos: conversa sobre hipertrofia, exercícios e progressão, com rascunhos de divisão a partir da rotina informada e referências curadas. Mensagens são enviadas à Groq após consentimento; dados do perfil não são anexados. Indicadores usam glossário revisado determinístico e nutrição mantém cálculos locais.
- Séries com grupos genéricos ou desconhecidos ficam como não classificadas; não são atribuídas artificialmente a um músculo.
- PWA com manifesto e fallback público offline. Novas abas offline exigem reconexão para validar autenticação.
- Gestão responsiva com filtros/ações ajustados a 375 pixels, tabelas em regiões roláveis por teclado e campos com labels. Respostas obsoletas não repovoam a tela de treinos nem encerram a nova sessão.

## Verificação

```powershell
cd server
npm test
npm audit
node scripts/with-local-env.cjs node --test tests/*.test.cjs
node scripts/with-local-env.cjs node scripts/smoke-local.cjs
node scripts/with-local-env.cjs node --test tests/sessoes-concurrency.test.cjs
```

O terceiro comando executa a suíte com o ambiente MariaDB isolado: **520 testes aprovados, zero falhas e zero ignorados** na revisão `d60d072`. No Windows, passe `node` ao wrapper; os testes com doubles não requerem credenciais de serviços externos. Os testes integrados optativos gravam somente na demonstração local.

## Publicação e limites atuais

O login antigo da Vercel falhava porque o host Aiven configurado não resolvia no DNS; a tentativa retornou 500. **O login no domínio final foi recuperado com o novo banco Neon.** A demonstração remota tem cinco contas com senhas novas em `server/.demo-credentials.remote.local.json`, ignorado pelo Git, três alunos, duas fichas e 798 exercícios. As credenciais antigas do GitHub não foram restauradas, e os dados antigos do Aiven não foram recuperados. Código enviado às branches e disponível nos PRs draft [do aplicativo](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1); nenhum foi mesclado à branch principal.

Checkout Pix/cartão está implementado exclusivamente em sandbox, com conciliação idempotente e renovação preservando vigência existente. Sua validação real depende de conta, credenciais e webhook do Mercado Pago: cartão aprovado/rejeitado/pendente; Pix com QR e estado pendente sem renovação. Não exigir liquidação Pix em sandbox, nem considerar retorno do navegador como confirmação. O lançamento manual já foi verificado em HTTPS e registra recebimento informado, sem cobrar ou validar Pix/cartão. [Roteiro de configuração e testes](PAGAMENTOS_SANDBOX.md).

A IA educativa usa GPT-OSS 120B via Groq Free, com plano US$ 0 confirmado e chave somente no backend. Divisões tiveram amostras reais conferidas; nutrição foi gerada e inspecionada com limitação terminológica registrada. Indicadores usam glossário revisado determinístico, confirmado no navegador publicado como conteúdo não gerado por IA, após duas respostas imprecisas do modelo. [Configuração, evidências e limites](IA_GRATUITA.md).

A revisão atual `d60d072` (`d60d0722b858881319810d1233e492fcd951ee02`), Production READY `dpl_9jnWh8FRjp4hXFiZ1gQE1Z56cj35`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-q46jbzn61-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38279551464). Suíte integral **520/520**, zero falhas e ignorados. Saúde HTTP 200, banco ready e API no-store; 17 hashes de interface/autenticação/financeiro conferidos. A consulta de checks desta revisão não apresentou status do Preview Git; a publicação Production pelo CLI foi confirmada. Gate privado aprovado. Ajustes administrativos publicados e verificados por HTTPS; [contrato e evidências](AJUSTES_FINANCEIROS.md). Proveniência do catálogo preservada. [Estado e limites](STATUS_ENTREGA.md).

A revisão de gestão/login `3adf5c1`, preservada na atual, refinou o acesso, corrigiu contraste, corridas nas telas de alunos, edição parcial e cancelamento de presença. Login por teclado e controles foram conferidos localmente; capturas públicas documentam 1280, 768 e 375 pixels. Login real do aluno, restauração após recarga e gate HTTPS de gestão foram aprovados, com limpeza das fixtures próprias.

Mercado Pago real de teste, telefone físico/instalação, reconexão publicada, revisão completa da UX/UI e revisão/merge dos PRs continuam pendentes. Troca de senha e revogação estão publicadas e validadas em `3f48109`. A primeira revisão visual e a correção de pertinência do chat estão publicadas em `460e7b0`. Ajustes financeiros administrativos não executam devoluções no provedor. A meta completa permanece ativa. Consulte o [estado e evidências](STATUS_ENTREGA.md) e a [meta de desenvolvimento](PLANO_MESTRE_DESENVOLVIMENTO.md).

Formulários e resultados refinados em `b5d4288`: matrícula e planos agrupados por tarefa, recuperação das listas, contraste nutricional e controles de treino mobile. [Revisão visual e evidências](REVISAO_VISUAL_SISTEMA.md).

Biblioteca de movimento com busca, filtros e leitura de origem, publicada em `d60d072`; [capturas e verificações](REVISAO_VISUAL_SISTEMA.md).

Landing atualizada em `754b27f`: captura real do produto, continuidade tipográfica/cromática e menu mobile por teclado, publicados e verificados. [Provas e limites](REVISAO_VISUAL_SISTEMA.md).

## Documentação

- [Estado da entrega e evidências](STATUS_ENTREGA.md)
- [Revisão atual e gates de entrega](REVISAO_FINAL.md)
- [Mercado Pago sandbox: configuração e limites](PAGAMENTOS_SANDBOX.md)
- [Telefone físico: instalação, fila e reconexão](VALIDACAO_MOBILE.md)
- [Desenvolvimento e banco nativo](DESENVOLVIMENTO.md)
- [Arquitetura e contratos](ARQUITETURA.md)
- [Datas civis e calendário operacional](DATAS_E_FUSO.md)
- [Ciência, fontes e limites](CIENCIA.md)
- [Ferramentas e integrações pesquisadas](FERRAMENTAS_E_INTEGRACOES.md)
- [Plano completo de desenvolvimento](PLANO_MESTRE_DESENVOLVIMENTO.md)
- [Direção visual](../design-system/fitflow/MASTER.md)

Documentos datados de análise e planejamento registram o estado daquele momento. Não representam automaticamente o estado atual nem a conclusão do projeto.

Autoria: Enzo Marcelo Ribeiro Fermiano — Análise e Desenvolvimento de Sistemas, 2026.

## Snapshot do plano mestre

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
