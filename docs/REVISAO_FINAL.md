# Revisão de entrega — 12/10/2026

Código publicado `460e7b0` (`460e7b064d114ccdb1db26756d7cfce5673c45f6`), Production READY `dpl_AZVoNNQS84Cg6jJ8YUn46fE6n51F`, [domínio final](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-6znii0d3v-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38204618039) e Preview Git aprovado. Suíte integral **503/503**, zero falhas e ignorados; gate privado aprovado. Saúde HTTP 200, banco ready e API no-store; 14 hashes de interface/autenticação/financeiro conferidos. Este marco não conclui a meta completa.

## Revisão de 12/10 — conta, interface e pertinência do chat

Troca de senha própria publicada em `3f48109` e validada por HTTPS: senha atual, titular, CSRF, revogação de sessões anteriores e outra conta preservada; somente fixtures UUID removidas. Oito migrations MySQL e cinco PostgreSQL aplicadas nos bancos nativos e nas duas branches Neon. [Contrato](TROCA_SENHA.md).

Primeira revisão visual em `22e2f99`: composição editorial/fotografia no dashboard, métricas agrupadas, barras de presença, hierarquia de planos/tabelas, resultado nutricional destacado e conversa com autoria distinta. Aluno recebe resumo compacto; evolução mobile deixou de transbordar. Menu inicia fechado após troca de conta. [Plano, referências e limites](REVISAO_VISUAL_SISTEMA.md).

O teste real de volume em `22e2f99` foi reprovado: listava músculos sem rotina. Em `460e7b0`, novo bloco de definição e orientação de seleção responderam à mesma pergunta com unidades/exemplo e fonte, sem inventar contagens. A ciência continua sendo texto curado; IA seleciona e organiza. Uma amostra não valida todas as perguntas futuras. [Painel publicado](evidence/66-dashboard-workspace-vercel.png) e [resposta real corrigida](evidence/67-chat-volume-workspace-vercel.png).

O teste de concorrência MariaDB deixou de escrever nas fichas demonstrativas: cria e limpa suas próprias contas/ficha/sessões. Contagens locais permaneceram 134 sessões/168 séries durante a suíte de 501 testes; os dados antigos acumulados foram preservados. A suíte final com dois casos de IA adicionais passou em 503/503.

Pagamento externo continua sem conta/credenciais/webhook configurados; ajustes administrativos não executam devolução no provedor. Revisão completa da UX/UI, aparelho físico, rotação da chave Groq e revisão/merge dos PRs permanecem pendentes.

## Revisão financeira anterior — 9d0361e

Correções de recebimentos manuais e devoluções informadas são eventos permanentes com UUID, motivo, responsável, saldo em centavos e efeito explícito de vigência. O recibo pago é protegido por trigger; não há operação de reembolso no provedor por esse formulário. Novos recebimentos capturam concessão real; registros legados não permitem reversão automática. Alteração de plano/status exige revisão atual e todos os escritores de matrícula compartilham o lock. Relatórios separam bruto, correções, devoluções informadas e líquido pela data efetiva do evento. [Contrato e testes](AJUSTES_FINANCEIROS.md).

Gates reais aprovados nos dois bancos nativos, branch Neon de verificação e API HTTPS publicada. Foram aplicadas sete migrations MySQL e quatro PostgreSQL, incluindo a de ajustes nas duas branches Neon. Runtime confirmou SELECT/INSERT de ajustes e negou UPDATE/DELETE, com probe revertido. API pública verificou saldo parcial/integral, replay, forjados/auth/405, CAS após renovação, alteração explícita de vencimento, mensalidade e relatórios; dois logins e somente fixtures UUID próprias removidas, sem chamadas ao PSP. Capturas 41/42 são locais; captura 43 mostra dashboard publicado após a limpeza. Emulação não comprova telefone físico.

### Catálogo na revisão anterior

Origem do catálogo e créditos separados de base/texto/mídia preservados na ficha, na revisão, na sessão e no cache offline. Captura transacional no servidor; metadados fornecidos pelo cliente são recusados. Exercícios manuais/legados ficam sem origem, sem inferência por nome. Revisões preservam créditos anteriores e continuam com IDs de Exercise distintos; cliente antigo não pode apagar a origem silenciosamente. Gates nativos MariaDB/PostgreSQL e Neon de verificação aprovados; migration aplicada nas duas branches antes do deploy. HTTPS validou catálogo real, revisão e sessão/replay. Captura local [40](evidence/40-catalogo-origem-local.png); nenhuma confirmação de telefone físico.

## Planos anterior — bb68606

Planos protege lista, cache, formulário e confirmação por conta/epoch/tela/âncora; onze testes controlados cobrem respostas antigas, modais substituídos, duplo envio e falhas. Uma gravação enviada conserva o resultado real, sem efeitos na tela substituta. Campos mobile usam 16 pixels e a duração personalizada fica oculta nas vigências padrão. O navegador publicado confirmou sessão restaurada, edição, vigência personalizada de 45 dias e equivalência aritmética de R$ 86,60 para R$ 129,90; cenário cancelado sem gravação. Viewport 375 × 812, clientWidth = scrollWidth = 375, captura 39. Não comprova telefone físico nem timing artificial no navegador. [Captura 39](evidence/39-plano-vigencia-mobile-vercel.png).

## Gestão anterior — 16b09b6

- Dashboard e pagamentos/relatórios descartam respostas e erros de conta, geração, epoch, navegação, requisição ou elemento de origem anteriores. Chart é criado após resposta válida, sem temporizador de desenho. Quatro casos de dashboard e dez de pagamentos/relatórios passaram por RED → GREEN em testes controlados.
- Edição financeira legada sem chamador no cliente removida da rota/controller/service. PUT/PATCH/DELETE de `/api/pagamentos/:id` recebem 405 para administrador autenticado, com `Allow: GET`; GET e POST permanecem. Valor, status, data e vigência foram conferidos após essas recusas. Conciliação do checkout permanece separada.
- Não foi implementada correção/estorno administrativo auditado. A recusa HTTP não promete imutabilidade de todo o banco: atualização operacional de pendente para vencido permanece.
- Scripts integrados passaram a conferir o recebimento original e o replay sem depender da edição removida. Nenhuma migration ou dependência nova.

## Gates da revisão financeira anterior

| Gate | Evidência |
|---|---|
| Suíte integral local | 470/470 em `9d0361e`; zero falhas e ignorados. 32 casos novos incluídos no total. |
| Gate privado | 338 arquivos; sem segredo local conhecido. Não certifica segredos desconhecidos nem todo o histórico Git. |
| Publicação | Deployment READY, CI e status Preview Git aprovados; saúde HTTP 200, banco ready e API no-store. |
| Assets publicados | Oito hashes conferidos: index.html, payment-adjustments.js, pagamentos.js, relatorios.js, app.js, aluno-painel.js, components/modal.js e professional.css. |
| Ajustes HTTPS em 9d0361e | API publicada confirmou saldo/replay/405/CAS, mensalidade e eventos no relatório; fixtures exclusivas removidas, dois logins, nenhuma chamada ao PSP. |
| Gestão HTTPS histórica em 16b09b6 | Três logins, CRUD/perfis, nutrição JSONB consentida/isolada, presença/auditoria, filtros e duas renovações concorrentes; replay sem terceiro registro, conflito 409 e conta divergente 403. PUT/PATCH/DELETE 405 com Allow GET; recebimento e vigência preservados por GET. Somente quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins UUID próprios removidos; quotas preservadas. |
| MariaDB nativo | Lançamento manual e checkout aprovados após remoção da edição legada, com fixtures próprias limpas. |
| Origem nos bancos/HTTPS | Gates específicos aprovados nos dois bancos nativos, Neon de verificação e API publicada; fixtures próprias removidas. Migration de origem aplicada nas duas branches. |
| Navegador em 16b09b6 | Dashboard com Chart real; pagamentos vazio e inadimplência normal de 13 dias; relatório por período com um check-in de 08/10/2026 às 23:46 em São Paulo. Sem lançamento financeiro ou atraso artificial. |
| Capturas atuais | [37: dashboard desktop](evidence/37-gestao-dashboard-publicado.png) e [38: relatório em 375 × 812](evidence/38-relatorios-publicados-mobile.png). No relatório, clientWidth = scrollWidth = 369 pixels. Campos de data tinham 14 pixels; emulação não comprova telefone ou teclado físico. |

## Funcionalidades e evidências preservadas

Login editorial, ajuda e contraste foram conferidos localmente com teclado e publicados em `3adf5c1`; capturas 28/29/31 registram 1280, 768 e 375 pixels. Gestão de alunos protege lista/formulário/modal contra respostas obsoletas; edição parcial preserva campos omitidos. Cancelamento de presença é atômico e aluno inativo não registra presença.

Treinos e consultas têm estados de carregamento, cache, falha e ausência confirmada, UUIDs preservados e prazo de 15 segundos por requisição idempotente, incluindo corpo. Respostas tardias não confirmam fila nem encerram sessão. Consultas de sessões tiveram 12 casos controlados; revisão do prazo teve 12 focados. Esses gates não comprovam transporte real interrompido em telefone.

A IA educativa usa GPT-OSS 120B via Groq Free, chave privada e sem fallback pago. Indicadores usam glossário revisado determinístico publicado em `f9ac83d`, sem inferência/quota externa, captura 32. Nutrição real em `9e1b5c5` foi inspecionada com limitação basal/repouso registrada, captura 30; prompt ajustado. Fórmulas locais e consentimento permanecem separados das explicações.

### Limite factual e histórico do chat

As capturas [35: conversa desktop](evidence/35-chat-treinamento-vercel.png) e [36: viewport emulada](evidence/36-chat-treinamento-mobile.png) pertencem a `943d495`, não ao novo gate de gestão. A rotina inicial foi gerada em `5e4ec38`; a primeira continuação foi recusada e a repetição manual em `943d495` respondeu usando contexto/referências. Assets de interface idênticos; causa específica da recusa não comprovada. Limites agregados/diagnósticos foram corrigidos.

Amostras iniciais foram reprovadas por contagens e justificativas inventadas. A amostra final foi inspecionada contra o rascunho/corpus, sem generalizar correção para futuras respostas ou adequação individual. A IA seleciona e ordena blocos; resumos científicos curados são renderizados integralmente pelo servidor. A origem curada está identificada. Conversa somente em memória; recarga/logout/troca de sessão a remove. Perfil e ficha não são anexados automaticamente, e o gate não aplicou fichas ou séries.

## Etapas em aberto

1. Configurar Mercado Pago sandbox, contas de teste, credenciais e webhook HTTPS; cartão APRO/rejeitado/CONT, Pix QR/pendente sem renovar plano. O sandbox não simula liquidação Pix; approved de Pix permanece nos testes com doubles. [Roteiro e fontes oficiais](PAGAMENTOS_SANDBOX.md).
2. Telefone físico: instalação PWA, teclado, interrupção/retorno de rede e reconexão publicada. [Matriz M01–M14](VALIDACAO_MOBILE.md), execução pendente.
3. Rotação da chave Groq exposta anteriormente, quando o proprietário retornar. O segredo não está no Git; a rotação não é a troca de senha do FitFlow.
4. Revisão completa de UX/UI por tela, estado, teclado e contraste; primeira composição publicada com trabalho restante descrito no plano visual.
5. Revisão dos PRs draft do aplicativo e da landing e gates das próximas mudanças; nenhum merge realizado.

O Preview Git teve falhas históricas antes do build (git_info_fail em 7cf0d2b/143c228) e recuperações observadas sem mudar permissões/proteção. A causa da intermitência não foi comprovada; o status atual está aprovado. [Histórico](STATUS_ENTREGA.md#publicação-automática-pelo-github).

Fontes, limitações, revisões anteriores e capturas em [Estado da entrega](STATUS_ENTREGA.md); configuração da IA em [IA gratuita](IA_GRATUITA.md). Aiven não foi recuperado; a demonstração publicada usa banco e contas novos.
