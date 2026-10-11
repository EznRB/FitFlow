# Revisão de entrega — 11/10/2026

Código publicado **16b09b6** (`16b09b63fca441243907e0d713e5592fc0664984`), deployment `dpl_4nh2HxowzwdhEfoMi2yaiTv6v2Vd`, READY em Production: [alias canônico](https://fit-flow-indol.vercel.app/) e [URL exata](https://fit-flow-hndm88opa-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38148855631) e status do Preview Git aprovado. Este marco não declara conclusão da meta; há gates externos e melhorias funcionais em aberto.

## Alterações desta revisão

- Dashboard e pagamentos/relatórios descartam respostas e erros de conta, geração, epoch, navegação, requisição ou elemento de origem anteriores. Chart é criado após resposta válida, sem temporizador de desenho. Quatro casos de dashboard e dez de pagamentos/relatórios passaram por RED → GREEN em testes controlados.
- Edição financeira legada sem chamador no cliente removida da rota/controller/service. PUT/PATCH/DELETE de `/api/pagamentos/:id` recebem 405 para administrador autenticado, com `Allow: GET`; GET e POST permanecem. Valor, status, data e vigência foram conferidos após essas recusas. Conciliação do checkout permanece separada.
- Não foi implementada correção/estorno administrativo auditado. A recusa HTTP não promete imutabilidade de todo o banco: atualização operacional de pendente para vencido permanece.
- Scripts integrados passaram a conferir o recebimento original e o replay sem depender da edição removida. Nenhuma migration ou dependência nova.

## Gates confirmados

| Gate | Evidência |
|---|---|
| Suíte integral local | 415/415 em `16b09b6`; zero falhas e ignorados. Os 14 casos de timing estão incluídos, sem somar subconjuntos. |
| Gate privado | 310 arquivos antes das capturas 37/38; sem segredo local conhecido. Não certifica segredos desconhecidos nem todo o histórico Git. |
| Publicação | Deployment READY, CI e status Preview Git aprovados; saúde HTTP 200, banco ready e API no-store. |
| Assets publicados | Hashes de index.html, app.js, pagamentos.js, relatorios.js, api.js, evidencias.js, science.js e ia-chat.css coincidem com o checkout. |
| Gestão HTTPS após deploy | Três logins, CRUD/perfis, nutrição JSONB consentida/isolada, presença/auditoria, filtros e duas renovações concorrentes; replay sem terceiro registro, conflito 409 e conta divergente 403. PUT/PATCH/DELETE 405 com Allow GET; recebimento e vigência preservados por GET. Somente quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins UUID próprios removidos; quotas preservadas. |
| MariaDB nativo | Lançamento manual e checkout aprovados após remoção da edição legada, com fixtures próprias limpas. |
| PostgreSQL | Core adaptado para a remoção; não reexecutado nesta etapa. Gates PostgreSQL/Neon anteriores preservados no histórico, sem nova migration. |
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
3. Preservar proveniência do exercício escolhido no catálogo até a ficha e snapshot da sessão; não inferir identidades retrospectivamente no histórico. Contrato recomendado para nova implementação: `catalogExerciseId` nullable e snapshot de proveniência validado pelo servidor a partir do catálogo, preservando separadamente fontes/licenças/autoria da base, texto e imagem. Sem backfill por nome ou alteração retrospectiva do histórico.
4. Troca de senha autenticada pelo titular e revogação de sessões anteriores.
5. Correção/estorno financeiro administrativo com motivo, ator, histórico e tratamento explícito da vigência. A recusa 405 elimina edição direta, sem entregar esse recurso.
6. Corridas da tela de Planos: correção em frente posterior, ainda não integrante deste marco publicado.
7. Revisão dos PRs draft do aplicativo e da landing e gates das próximas mudanças; nenhum merge realizado.

O Preview Git teve falhas históricas antes do build (git_info_fail em 7cf0d2b/143c228) e recuperações observadas sem mudar permissões/proteção. A causa da intermitência não foi comprovada; o status atual está aprovado. [Histórico](STATUS_ENTREGA.md#publicação-automática-pelo-github).

Fontes, limitações, revisões anteriores e capturas em [Estado da entrega](STATUS_ENTREGA.md); configuração da IA em [IA gratuita](IA_GRATUITA.md). Aiven não foi recuperado; a demonstração publicada usa banco e contas novos.
