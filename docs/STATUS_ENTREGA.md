# Estado da entrega — 10/10/2026

A meta completa está ativa. O login publicado foi recuperado com Neon; aplicativo e landing têm evidências públicas. Código enviado aos PRs draft [do aplicativo](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1); nenhum merge à branch principal foi realizado.

## Implantação atual

| Aplicação | Revisão e verificação |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app) | `f9ac83d`, branch `codex/science-ux-foundation`, deployment `dpl_AhGq8iVB9UYq55ZjDmP51zpDPZGq`, READY e alias canônico confirmado. URL exata: `https://fit-flow-j514jrlsa-eznrbs-projects.vercel.app`. `/api/health` HTTP 200, banco ready e API no-store. HTML/login.css/WEBP/evidencias.js com hashes iguais ao checkout. Navegador autenticado confirmou **Entender indicadores**, texto revisado sem IA, captura 32. Login/gestão preservados; gate HTTPS aprovado em `3adf5c1`. |
| [Landing](https://fitflow-lp.vercel.app) | `c6b43ba`, branch `codex/landing-improvements`, deployment `dpl_4VvK5DL5euaArBubytijVTVpSbXD`, READY. URL exata: `https://fitflow-bgdg31gqk-eznrbs-projects.vercel.app`. Gate público HTML/JS/CSS/hero HTTP 200, CTA e copy atuais; navegador confirmou fotografia e estado publicado. |

[CI GitHub da revisão atual f9ac83d](https://github.com/EznRB/FitFlow/actions/runs/38055351767): sucesso. Node 24.x, função `gru1`, Client PostgreSQL Prisma 6.19.3. Suíte integral local **309/309**, zero falhas e zero ignorados; revisão IA 19/19 e gate privado em 293 arquivos. Glossário determinístico e ajuste do prompt nutricional, sem nova migration.

Revisão de gestão/login `3adf5c1`: [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38054589595), 304/304, revisão independente focada 29/29 e backend focado 48/48. Os subconjuntos não são contagens adicionais à suíte. Login editorial, correção de contraste, corridas de alunos, edição parcial e cancelamento atômico de presença não exigiram nova migration.

Groq Free foi confirmado no console com preço US$ 0. Uma explicação real local de divisões, usando GPT-OSS 120B, levou aproximadamente 1,2 segundo e foi conferida contra Ramos-Campo (2024) e ACSM (2026). Chave e flag Free configuradas privadamente em Production/Preview. Explicação pública real de divisões também foi conferida. Duas amostras de volume **não passaram na validação factual**: `3adf5c1` confundiu séries com tonelagem; `9e1b5c5` confundiu séries previstas com repetições. Por isso, `f9ac83d` entrega glossário revisado determinístico, com rótulo de conteúdo não gerado por IA; publicação e navegador confirmados.

Revisão anterior `7b856e0`: [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38017533596), 287/287 e revisão independente IA 9/9. Captura 27 registra Fundamentos com geração desativada naquela revisão. Essa captura não descreve a configuração atual.

### Indicadores revisados na implantação atual

Código `f9ac83d`, suíte local **309/309**, zero falhas/ignorados, revisão IA 19/19, gate privado em 293 arquivos e `npm audit --omit=dev` sem vulnerabilidades conhecidas. Volume agora retorna glossário revisado fixo, `generatedByAI: false`, sem chamada externa e sem quota de inferência. Autenticação, autorização, CSRF e proteção global da API permanecem. A UI usa **Entender indicadores** e distingue definições do produto da referência científica. O prompt nutricional explicita gasto em repouso, sem equipará-lo ao basal.

Deployment `dpl_AhGq8iVB9UYq55ZjDmP51zpDPZGq`, URL exata `https://fit-flow-j514jrlsa-eznrbs-projects.vercel.app`, READY com CI e alias confirmados. O navegador autenticado apresentou o glossário, rótulo de texto revisado sem IA e separação entre definições operacionais e contexto científico, captura 32. Nutrição gerada na revisão anterior está documentada na captura 30; o prompt atual distingue repouso/basal, sem prometer correção factual de toda resposta futura.

Revisão anterior `62ff0af`: [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38016513262), 279 testes e revisão independente 41/41. Captura 26 registra o histórico publicado após recarga, com 20 kg × 8, RIR 2 e 160 kg·reps. As corridas de timing foram reproduzidas nos testes controlados; a captura comprova o fluxo normal publicado.

Gate HTTPS de gestão/nutrição/presença/renovação e idempotência manual foi aprovado na revisão anterior `4b89e3`, com [CI](https://github.com/EznRB/FitFlow/actions/runs/37993027731) aprovada. Incluiu dois cadastros editados com CPF/nascimento vazios, retorno NULL, rejeição de data inválida e matrícula no dia civil brasileiro. Captura 24 registra Alunos em `4b89e3`; captura 23 registra modal/recarga admin em `24e77b4`, sem submissão; captura 21 registra Fundamentos em `65fb32c`.

## Evidências obtidas

| Frente | Implementação e verificação |
|---|---|
| Banco local | MariaDB 11.8.8 nativo, loopback 3308, cinco migrations MySQL e senhas demonstrativas individuais. Smoke HTTP e concorrência real passaram. Sem Docker e sem alteração do banco antigo. |
| Banco remoto | Neon Free, PostgreSQL 17, São Paulo; baseline preservada e migration aditiva `20261009_manual_payment_idempotency` aplicada nas duas branches e nos bancos nativos. Cinco migrations MySQL e duas PostgreSQL; onze CHECKs PostgreSQL. Três gates reais passaram pelo pooler com TLS; core foi repetido para replay, conflitos e nova constraint. `fitflow_app` recusou DDL, alteração de séries e exclusões protegidas. Cinco contas, três alunos, duas fichas e 798 exercícios demonstrativos. |
| Login publicado | Preview e Production passaram em HTTPS: banco pronto, três perfis, cookie Secure/HttpOnly/Lax, autorização, catálogo, painel, CSRF e logout. Navegador confirmou autenticação após recarga. |
| Login editorial | Fotografia ilustrativa da landing reutilizada como WEBP de aproximadamente 199 KB; composição de acesso, tipografia, ajuda e contraste refinados. Navegador local confirmou 1280 e 375 pixels, teclado, mostrar/ocultar senha e campos obrigatórios. Assets publicados conferidos por hash; capturas 28/29/31 documentam 1280 × 720, 375 × 812 e 768 × 1024, sem overflow horizontal. Login real do aluno aprovado em 375 pixels e sessão restaurada após recarga. |
| Inicialização | Espera acessível e login desabilitado durante verificação; AbortController de 15 segundos somente em `/auth/me`, descarte de resposta obsoleta e proteção por geração. Logout pendente tratado em segundo plano, com login aguardando a conclusão necessária. Testes aprovados; restauração real confirmada na revisão publicada. |
| Correções da revisão `4b89e3` | Login/logout/retry coordenam cookie entre abas com Web Locks e marcador opaco; timeout de `/auth/me` inclui espera pelo lock. GET obsoleto recebe 409 antes de processar corpo/401; escritas mantêm sua resposta real. Logout limpa modal, conteúdo, título e rodapé/inert. Treinos descartam respostas de aluno/geração/navegação/DOM anteriores. CPF vazio vira NULL; nascimento omitido preserva, vazio explícito limpa, data inválida recebe 400. Matrícula/troca de plano usa dia civil brasileiro. |
| Correções da revisão `62ff0af` | Sessões capturam conta/papel/geração/epoch/store/tela; leituras e callbacks antigos não atualizam a nova tela nem bloqueiam sua atualização. Epoch observado exige igualdade com o compartilhado antes do cache e de novo fetch autenticado, inclusive escritas ainda não enviadas. Logout aguarda teardown dentro do lock; saída de epoch antigo preserva a fila nova. Guard dentro da transformação IDB impede recriar dados descartados; ACK HTTP conserva resultado real somente em sessão ainda presente. Vinte testes novos, incluindo casos RED → GREEN. |
| Correções da revisão `3adf5c1` | Quatorze testes novos de alunos cobrem corridas em lista, formulário e modal; três testes backend cobrem edições parciais, cancelamento atômico e presença de aluno inativo. Gate nativo guardado de datas/presenças passou e limpou sua fixture. Gestão HTTPS repetida após publicação, aprovada e limpa. |
| Gestão publicada | Gate HTTPS passou com três logins: criação/leitura/edição de plano, matrícula/leitura de alunos, acesso por papel, relatórios, filtros civis de datas e arquivamento lógico. Fluxos usaram a API publicada. |
| Presença publicada | Registro próprio, autoria, duplicidade, bloqueio de outro aluno, restrições de cancelamento e cancelamento administrativo com motivo/ator/data passaram. Cancelamento não permite nova presença duplicada na mesma data. |
| Segurança | Papel/atividade consultados no banco, cadastro somente por administrador, CSRF por origem exata, API no-store e quotas HMAC compartilhadas. CSP restringe scripts à mesma origem; estilos inline legados continuam permitidos. Logout offline impede restauração automática. Owner não foi enviado à Vercel. |
| Exercícios | Importação real wger: 919 avaliados, 795 incorporados, 124 ignorados, dez páginas. Identidade externa, licenças e autoria individuais; três exercícios locais preservados. Catálogo descritivo não comprova prescrição. |
| Treinos | Trabalho/aquecimento, carga/reps/RIR, snapshots e UUIDs idempotentes. Revisão de ficha preserva IDs/histórico anterior. Rejeições preservam séries localmente sem fabricar sincronização/conclusão remota. No navegador publicado, treino finalizado reapareceu com 20 kg × 8, RIR 2 e 160 kg·reps. |
| Ciência | Grupos genéricos como Múltiplos, Outros, Não informado, Cardio e Funcional ficam como não classificados, preservando snapshot e volume. Fundamentos atualizados para os recursos existentes. Fontes, população e hipóteses explícitas; auditoria em [AUDITORIA_CIENTIFICA_FINAL.md](AUDITORIA_CIENTIFICA_FINAL.md). |
| Nutrição publicada | Gate HTTPS: consentimento obrigatório, persistência JSONB, isolamento por conta e exclusão de fixture própria. Mifflin, 80 kg/180 cm/30 anos/homem/fator 1,5: repouso 1780 kcal, estimativa 2670 kcal, proteína 128 g, carboidratos 372,6 g, gordura 74,2 g. Navegador salvou/restaurou cenário fictício; restauração exige nova confirmação de escopo. Captura 20. |
| Mobile/PWA | Viewport emulada 375 × 812 sem overflow horizontal, captura 17. Localmente, série 27 kg × 8 permaneceu pendente offline e sincronizou uma vez, 216 kg·reps. Recarga offline apresenta fallback público. Telefone físico/instalação não testados. |
| Pagamentos | Lançamento manual recebido tem UUID único, hash da intenção e ator, consulta de reconciliação e proteção de sessão/abas. HTTPS após deploy confirmou duas renovações distintas de sete dias, replay sem terceiro registro/renovação, conflito 409 e sessão divergente 403. Não cobra nem valida Pix/cartão. Checkout Pro sandbox tem HMAC, ownership, confirmação canônica e conciliação idempotente com provedor simulado; nenhuma cobrança ao Mercado Pago. |
| IA | GPT-OSS 120B via Groq Free: plano US$ 0 confirmado; divisões reais local/HTTPS conferidas. Nutrição real em `9e1b5c5` inspecionada, sem prescrição/cálculo individual; limitação basal/repouso registrada e prompt atual ajustado. Corpus curado, chave no servidor, JSON/IDs validados, sem medidas corporais. Indicadores usam glossário revisado publicado, não inferência; testes e navegador confirmados. Quota/erro não acionam outro provedor. [Configuração e limites](IA_GRATUITA.md). |
| Datas | `America/Sao_Paulo`, filtros validados, datas civis DATE e instantes UTC agrupados no calendário brasileiro. TIME legado preservado. Gates publicados de presença e financeiro passaram. |
| Landing | Laranja/navy e Barlow, fotografia ilustrativa nova, autoria e estado real. Build TypeScript e audit aprovados. Gate público e navegador confirmaram a implantação atual. |
| Limpeza | Repositório de pagamentos e classe vazia `relatorios.service.js`, ambos sem referências, removidos após busca global; relatórios reais permanecem no controller. Documentação corrente consolidada; migrations aplicadas preservadas. Papel administrativo não utilizado `fitflow_runtime` removido pelo MCP com autorização explícita; restaram `fitflow_app` e `fitflow_owner`. |

O gate `hosted-management.integration.cjs` criou e removeu exclusivamente quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins identificados por UUID. O owner preparou credenciais sintéticas e limpou seus IDs; fluxos funcionais usaram HTTPS com os papéis da API. Quotas reais e contas demonstrativas foram preservadas.

**Banco e credenciais novos recuperaram o login publicado.** Diagnóstico antigo: Aiven `ENOTFOUND` e login HTTP 500. Credenciais do GitHub não foram restauradas; dados antigos não foram recuperados.

## Reproduzir os testes

No diretório `server`, com MariaDB demonstrativo em execução:

```powershell
node scripts/with-local-env.cjs node --test tests/*.test.cjs
npm audit
node scripts/with-local-env.cjs node scripts/smoke-local.cjs
node scripts/with-local-env.cjs node tests/checkout-local.integration.cjs
node scripts/with-local-env.cjs node tests/quota-local.integration.cjs
node scripts/with-local-env.cjs node tests/checkins-dates-local.integration.cjs
```

Suíte integral atual do código `f9ac83d`: **309 aprovados, zero falhas e zero ignorados**; revisão IA focada 19/19, sem somar ao total. Gate privado em 293 arquivos e audit de dependências de produção sem vulnerabilidades conhecidas. Os testes HTTP conferem glossário sem inferência/quota de IA, autenticação 401, autorização 403 e quota dos temas gerados.

Revisão anterior `9e1b5c5`: 307/307 e revisão IA 15/15. Reforçar o contexto não evitou a segunda imprecisão pública de volume; o resultado factual reprovado motivou substituir inferência por texto revisado.

Revisão publicada `3adf5c1`: 304/304, incluindo quatorze testes novos de alunos e três backend. Revisão independente focada 29/29; backend focado 48/48. Gate nativo guardado `checkins-dates-local.integration.cjs` aprovado e limpo. Gate de gestão HTTPS aprovado nessa implantação, com três logins e remoção exclusiva de quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins sintéticos; quotas não foram resetadas.

Revisão anterior `7b856e0`: 287/287, oito testes novos de Groq/rota/UI e revisão independente IA 9/9. Status autenticado confirmou geração desativada/groq naquela versão; captura 27 documenta esse estado histórico.

Revisão anterior `62ff0af`: 279 testes, revisão independente focada 41/41 e vinte testes novos sobre o baseline `4b89e3` de 259. Hashes dos quatro scripts alterados coincidiram com o checkout; login de aluno e restauração após recarga preservaram o histórico demonstrativo. Sessões em 375 × 812: documento 369 pixels, dentro da viewport; captura 26. Sem nova gravação de treino nesse gate de navegador.

Na revisão anterior, a revisão independente passou em 30/30; telas administrativas foram conferidas em 375 pixels e seis telas locais em 768/1280. Relatório respondeu ao teclado com deslocamento horizontal 0 → 38. Duas abas reais confirmaram fechamento do modal/limpeza de conteúdo após logout na outra aba, login interativo e nova sessão de aluno persistida após recarga, captura 25. As novas corridas de identidade/IDB foram testadas em harness controlado, sem afirmar injeção desse timing no navegador público.

Gates anteriores: manual em MariaDB/PostgreSQL nativos; core na branch Neon isolada para replay, ator divergente 409, consulta não autorizada 404 e 11ª CHECK. No Windows, chamar `npm` dentro do wrapper falha porque o executável é `npm.cmd`; receita validada chama `node --test`. Smoke/sessões preservam histórico demonstrativo; financeiro/quotas/datas removem somente suas fixtures. Não use produção nesses gates locais.

Três gates PostgreSQL passaram no cluster nativo isolado 17.10 (`127.0.0.1:5448/fitflow_pg_test`) e na branch Neon de verificação, pelo pooler com TLS. Cobertura: três perfis, bloqueio, bootstrap sem reset, quota compartilhada, idempotência JSONB, concorrência de séries/conclusão, DATE/TIME, duas renovações, conciliação única com provedor simulado e constraints. Core atualizado validou onze CHECKs. Fixtures próprias removidas. [Comandos e destinos](DESENVOLVIMENTO.md).

Gates adicionais, somente com arquivos privados ignorados e destinos guardados:

```powershell
node scripts/check-neon-runtime.cjs
node scripts/check-hosted-fitflow.cjs https://fit-flow-indol.vercel.app/
# Exceção explícita: fixtures UUID no FitFlow HTTPS; três logins por execução.
node tests/hosted-management.integration.cjs --execute-hosted-fixtures
```

Executar o gate de gestão uma vez por verificação necessária, sem repetir logins para contornar quotas. Recusa destinos arbitrários, confirma ausência de colisões antes de escrever e remove somente dados próprios. Runtime usa transações revertidas e comprovou recusas SQLSTATE `42501`. Segredos owner/verificação/runtime separados; somente runtime na Vercel. O guard de arquivos privados cobre candidatos atuais e segredos locais conhecidos, sem afirmar auditoria de todo o histórico Git ou de segredos desconhecidos.

Na landing: `npm run build` e `npm audit`; `lint` verifica tipos, sem representar ESLint.

## Pendências obrigatórias

1. **Mercado Pago sandbox:** criar/configurar conta, contas de teste, token, segredo de webhook e URL HTTPS. Gate de cartão: aprovado `APRO`, rejeitado e pendente `CONT`; Pix: QR/pendente **sem renovação**. O sandbox não simula liquidação Pix; conciliação `approved` de Pix permanece coberta por doubles. Segredos ficam no backend. [Roteiro e documentação oficial](PAGAMENTOS_SANDBOX.md).
2. **Telefone físico:** instalação HTTPS, teclado, sessão, interrupção de rede e retorno. Emulação e fila no navegador não substituem esse gate.
3. **Entrega e PRs:** reconexão na publicação, revisão dos PRs draft e gates de novas mudanças. Nenhum merge à branch principal. Manter fontes/limites da IA explícitos e verificar amostras relevantes sem tratar formato JSON como certificação factual.

## Roteiro de apresentação

1. Abrir a [landing pública](https://fitflow-lp.vercel.app) e seguir ao [aplicativo](https://fit-flow-indol.vercel.app). Alternativa local: portas 3108 e 3107.
2. Contas do arquivo privado correspondente: `server/.demo-credentials.remote.local.json` ou `.demo-credentials.local.json`.
3. Aluno: ficha, sessão, carga/reps/RIR, sincronização e evolução. Registros demonstrativos são fictícios e identificados.
4. Nutrição: confirmar escopo adulto saudável, conferir equação/unidades e salvar somente por opção. Restaurar exige nova confirmação.
5. Instrutor: criar/revisar ficha própria. Administrador: alunos, planos, presença auditável e relatórios.
6. Fundamentos: consultar as referências e, quando disponível, gerar explicação educativa, identificada como IA. Pagamento sandbox do Mercado Pago continua indisponível sem credenciais; lançamento manual não comprova Pix/cartão.

## Capturas

- `evidence/09-serie-mobile-pendente.png`: série offline antes da reconexão.
- `evidence/10-pwa-fallback-mobile.png`: abertura offline pública.
- `evidence/11-painel-aluno-refinado.png`: painel em 375 pixels.
- `evidence/12-landing-refinada-final.png`: landing com fotografia nova.
- `evidence/13-fichas-revisao-preservada.png`: revisão e ficha anterior arquivada.
- `evidence/14-logout-sem-servidor.png`: saída pendente sem restauração automática.
- `evidence/15-sessao-arquivada-preservada.png`: série rejeitada preservada localmente.
- `evidence/16-vercel-neon-sessao-persistida.png`: treino remoto 20 kg × 8, RIR 2, 160 kg·reps.
- `evidence/17-vercel-mobile-375.png`: viewport emulada, sem comprovar telefone físico.
- `evidence/18-landing-vercel-publicada.png`: composição pública anterior.
- `evidence/19-vercel-revisao-atual-historico.png`: histórico na revisão `dad6d9c`.
- `evidence/20-nutricao-vercel-restaurada.png`: cálculo do cenário fictício restaurado no domínio final.
- `evidence/21-fundamentos-vercel-atualizados.png`: fundamentos corrigidos na revisão `65fb32c`.
- `evidence/22-landing-estado-publicado.png`: recarga e seção O projeto confirmando arquitetura Neon e estado publicado na landing atual; fotografia registrada na captura 18.
- `evidence/23-recebimento-manual-vercel.png`: modal publicado, data civil brasileira e orientação de que registro manual não cobra nem verifica Pix/cartão; captura sem submissão do formulário.
- `evidence/24-gestao-alunos-mobile-vercel.png`: Alunos em 375 pixels na revisão publicada `4b89e3`; busca e matrícula dentro da tela, tabela com rolagem interna.
- `evidence/25-sessao-outra-aba-login-local.png`: navegador local após mudança de sessão em outra aba; conteúdo/modal anteriores removidos e login disponível. Não é prova de publicação.
- `evidence/26-sessoes-vercel-isolamento-mobile.png`: histórico normal após login/recarga na revisão `62ff0af`, viewport emulada 375 × 812; registro anterior 20 kg × 8, RIR 2 e 160 kg·reps. Não reproduz os timings das corridas nem comprova telefone físico.
- `evidence/27-groq-fundamentos-vercel.png`: Fundamentos em `7b856e0` após recarga da sessão; fontes acessíveis e botão IA desativado. Complementa o gate HTTP que confirmou `provider: groq`; não comprova geração real.
- `evidence/28-login-desktop-vercel.png`: login editorial publicado em desktop na revisão `3adf5c1`.
- `evidence/29-login-mobile-vercel.png`: login publicado em 375 pixels na revisão `3adf5c1`; login real de aluno aprovado nesse fluxo.
- `evidence/30-groq-explicacao-vercel.png`: geração real de nutrição publicada em `9e1b5c5`. Amostra inspecionada contra referências; uso impreciso de basal/repouso registrado. Não comprova validação factual integral nem a antiga amostra reprovada de volume.
- `evidence/31-login-tablet-vercel.png`: login publicado em 768 × 1024 na revisão `3adf5c1`, sem overflow horizontal.
- `evidence/32-indicadores-revisados-vercel.png`: glossário publicado em `f9ac83d`, identificado como texto revisado do FitFlow, não gerado por IA; definições do produto separadas do contexto científico.

Capturas registram versões e fluxos descritos; não comprovam automaticamente mudanças posteriores.
