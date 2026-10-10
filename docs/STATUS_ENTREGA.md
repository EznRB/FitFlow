# Estado da entrega — 09/10/2026

A meta completa está ativa. O login publicado foi recuperado com Neon; aplicativo e landing têm evidências públicas. Código enviado aos PRs draft [do aplicativo](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1); nenhum merge à branch principal foi realizado.

## Implantação atual

| Aplicação | Revisão e verificação |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app) | `62ff0af`, branch `codex/science-ux-foundation`, deployment `dpl_413ri2Ff698zGmAXGq9gKUY2bmW9`, READY e alias canônico confirmado. URL exata: `https://fit-flow-68pa9eggg-eznrbs-projects.vercel.app`. Quatro scripts alterados com hashes iguais ao checkout; `/api/health` HTTP 200, banco ready e API no-store. Navegador confirmou login de aluno, recarga, sessões e histórico em 375 pixels. |
| [Landing](https://fitflow-lp.vercel.app) | `c6b43ba`, branch `codex/landing-improvements`, deployment `dpl_4VvK5DL5euaArBubytijVTVpSbXD`, READY. URL exata: `https://fitflow-bgdg31gqk-eznrbs-projects.vercel.app`. Gate público HTML/JS/CSS/hero HTTP 200, CTA e copy atuais; navegador confirmou fotografia e estado publicado. |

[CI GitHub da revisão atual 62ff0af](https://github.com/EznRB/FitFlow/actions/runs/38016513262): sucesso. Node 24.x, função `gru1`, Client PostgreSQL Prisma 6.19.3 gerado no Linux. Patch de cliente sem migration; 279 testes locais e revisão independente 41/41 aprovados. Captura 26 registra o histórico publicado após recarga, com 20 kg × 8, RIR 2 e 160 kg·reps. As corridas de timing foram reproduzidas nos testes controlados; a captura comprova o fluxo normal publicado.

Gate HTTPS de gestão/nutrição/presença/renovação e idempotência manual foi aprovado na revisão anterior `4b89e3`, com [CI](https://github.com/EznRB/FitFlow/actions/runs/37993027731) aprovada. Incluiu dois cadastros editados com CPF/nascimento vazios, retorno NULL, rejeição de data inválida e matrícula no dia civil brasileiro. Captura 24 registra Alunos em `4b89e3`; captura 23 registra modal/recarga admin em `24e77b4`, sem submissão; captura 21 registra Fundamentos em `65fb32c`.

## Evidências obtidas

| Frente | Implementação e verificação |
|---|---|
| Banco local | MariaDB 11.8.8 nativo, loopback 3308, cinco migrations MySQL e senhas demonstrativas individuais. Smoke HTTP e concorrência real passaram. Sem Docker e sem alteração do banco antigo. |
| Banco remoto | Neon Free, PostgreSQL 17, São Paulo; baseline preservada e migration aditiva `20261009_manual_payment_idempotency` aplicada nas duas branches e nos bancos nativos. Cinco migrations MySQL e duas PostgreSQL; onze CHECKs PostgreSQL. Três gates reais passaram pelo pooler com TLS; core foi repetido para replay, conflitos e nova constraint. `fitflow_app` recusou DDL, alteração de séries e exclusões protegidas. Cinco contas, três alunos, duas fichas e 798 exercícios demonstrativos. |
| Login publicado | Preview e Production passaram em HTTPS: banco pronto, três perfis, cookie Secure/HttpOnly/Lax, autorização, catálogo, painel, CSRF e logout. Navegador confirmou autenticação após recarga. |
| Inicialização | Espera acessível e login desabilitado durante verificação; AbortController de 15 segundos somente em `/auth/me`, descarte de resposta obsoleta e proteção por geração. Logout pendente tratado em segundo plano, com login aguardando a conclusão necessária. Testes aprovados; restauração real confirmada na revisão publicada. |
| Correções da revisão `4b89e3` | Login/logout/retry coordenam cookie entre abas com Web Locks e marcador opaco; timeout de `/auth/me` inclui espera pelo lock. GET obsoleto recebe 409 antes de processar corpo/401; escritas mantêm sua resposta real. Logout limpa modal, conteúdo, título e rodapé/inert. Treinos descartam respostas de aluno/geração/navegação/DOM anteriores. CPF vazio vira NULL; nascimento omitido preserva, vazio explícito limpa, data inválida recebe 400. Matrícula/troca de plano usa dia civil brasileiro. |
| Correções da revisão `62ff0af` | Sessões capturam conta/papel/geração/epoch/store/tela; leituras e callbacks antigos não atualizam a nova tela nem bloqueiam sua atualização. Epoch observado exige igualdade com o compartilhado antes do cache e de novo fetch autenticado, inclusive escritas ainda não enviadas. Logout aguarda teardown dentro do lock; saída de epoch antigo preserva a fila nova. Guard dentro da transformação IDB impede recriar dados descartados; ACK HTTP conserva resultado real somente em sessão ainda presente. Vinte testes novos, incluindo casos RED → GREEN. |
| Gestão publicada | Gate HTTPS passou com três logins: criação/leitura/edição de plano, matrícula/leitura de alunos, acesso por papel, relatórios, filtros civis de datas e arquivamento lógico. Fluxos usaram a API publicada. |
| Presença publicada | Registro próprio, autoria, duplicidade, bloqueio de outro aluno, restrições de cancelamento e cancelamento administrativo com motivo/ator/data passaram. Cancelamento não permite nova presença duplicada na mesma data. |
| Segurança | Papel/atividade consultados no banco, cadastro somente por administrador, CSRF por origem exata, API no-store e quotas HMAC compartilhadas. CSP restringe scripts à mesma origem; estilos inline legados continuam permitidos. Logout offline impede restauração automática. Owner não foi enviado à Vercel. |
| Exercícios | Importação real wger: 919 avaliados, 795 incorporados, 124 ignorados, dez páginas. Identidade externa, licenças e autoria individuais; três exercícios locais preservados. Catálogo descritivo não comprova prescrição. |
| Treinos | Trabalho/aquecimento, carga/reps/RIR, snapshots e UUIDs idempotentes. Revisão de ficha preserva IDs/histórico anterior. Rejeições preservam séries localmente sem fabricar sincronização/conclusão remota. No navegador publicado, treino finalizado reapareceu com 20 kg × 8, RIR 2 e 160 kg·reps. |
| Ciência | Grupos genéricos como Múltiplos, Outros, Não informado, Cardio e Funcional ficam como não classificados, preservando snapshot e volume. Fundamentos atualizados para os recursos existentes. Fontes, população e hipóteses explícitas; auditoria em [AUDITORIA_CIENTIFICA_FINAL.md](AUDITORIA_CIENTIFICA_FINAL.md). |
| Nutrição publicada | Gate HTTPS: consentimento obrigatório, persistência JSONB, isolamento por conta e exclusão de fixture própria. Mifflin, 80 kg/180 cm/30 anos/homem/fator 1,5: repouso 1780 kcal, estimativa 2670 kcal, proteína 128 g, carboidratos 372,6 g, gordura 74,2 g. Navegador salvou/restaurou cenário fictício; restauração exige nova confirmação de escopo. Captura 20. |
| Mobile/PWA | Viewport emulada 375 × 812 sem overflow horizontal, captura 17. Localmente, série 27 kg × 8 permaneceu pendente offline e sincronizou uma vez, 216 kg·reps. Recarga offline apresenta fallback público. Telefone físico/instalação não testados. |
| Pagamentos | Lançamento manual recebido tem UUID único, hash da intenção e ator, consulta de reconciliação e proteção de sessão/abas. HTTPS após deploy confirmou duas renovações distintas de sete dias, replay sem terceiro registro/renovação, conflito 409 e sessão divergente 403. Não cobra nem valida Pix/cartão. Checkout Pro sandbox tem HMAC, ownership, confirmação canônica e conciliação idempotente com provedor simulado; nenhuma cobrança ao Mercado Pago. |
| IA | Corpus curado, chave somente no servidor, resposta estruturada validada, sem envio de medidas corporais. Provedor simulado nos testes; chave e teste reais pendentes. Alternativa Vercel AI Gateway pesquisada: consulta autenticada com OIDC renovado retornou HTTP 200, saldo 0 e uso total 0; não houve geração nem habilitação de cobrança. |
| Datas | `America/Sao_Paulo`, filtros validados, datas civis DATE e instantes UTC agrupados no calendário brasileiro. TIME legado preservado. Gates publicados de presença e financeiro passaram. |
| Landing | Laranja/navy e Barlow, fotografia ilustrativa nova, autoria e estado real. Build TypeScript e audit aprovados. Gate público e navegador confirmaram a implantação atual. |
| Limpeza | Repositório de pagamentos sem imports removido após busca global. Documentação corrente consolidada; migrations aplicadas preservadas. Papel administrativo não utilizado `fitflow_runtime` removido pelo MCP com autorização explícita; restaram `fitflow_app` e `fitflow_owner`. |

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

Suíte integral atual `62ff0af`: **279 aprovados, zero falhas e zero ignorados**; revisão independente focada 41/41. Vinte testes foram acrescentados ao baseline `4b89e3` de 259. No domínio final, hashes dos quatro scripts alterados coincidiram com o checkout; login de aluno e restauração após recarga preservaram o histórico demonstrativo. Sessões em 375 × 812: documento 369 pixels, dentro da viewport; captura 26. Sem nova gravação de treino neste gate de navegador.

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

1. **Mercado Pago sandbox:** vendedor/comprador de teste, token, segredo de webhook e URL HTTPS; confirmar/rejeitar eventos reais de teste. Segredos não vão ao chat/frontend.
2. **IA real:** chave, quota, limite de gasto e explicação real com referências. IDs válidos de fontes não comprovam cada frase gerada.
3. **Telefone físico:** instalação HTTPS, teclado, sessão, interrupção de rede e retorno. Emulação e fila no navegador não substituem esse gate.
4. **Revisão final:** áreas de gestão publicadas, reconexão na publicação, revisão dos PRs draft e gates de novas mudanças. Nenhum merge à branch principal.

## Roteiro de apresentação

1. Abrir a [landing pública](https://fitflow-lp.vercel.app) e seguir ao [aplicativo](https://fit-flow-indol.vercel.app). Alternativa local: portas 3108 e 3107.
2. Contas do arquivo privado correspondente: `server/.demo-credentials.remote.local.json` ou `.demo-credentials.local.json`.
3. Aluno: ficha, sessão, carga/reps/RIR, sincronização e evolução. Registros demonstrativos são fictícios e identificados.
4. Nutrição: confirmar escopo adulto saudável, conferir equação/unidades e salvar somente por opção. Restaurar exige nova confirmação.
5. Instrutor: criar/revisar ficha própria. Administrador: alunos, planos, presença auditável e relatórios.
6. Sem credenciais externas, IA e checkout mostram indisponibilidade; não apresentar geração ou pagamento efetivos.

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

Capturas registram versões e fluxos descritos; não comprovam automaticamente mudanças posteriores.
