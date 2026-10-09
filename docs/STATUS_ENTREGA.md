# Estado da entrega — 08/10/2026

A meta completa está ativa. Aplicativo e landing foram publicados pela CLI. Login e persistência de treino no domínio final passaram com Neon; a landing está publicamente acessível. Código enviado às branches, com PRs draft criados e anexados; nada foi mesclado à branch principal. Este documento diferencia implementação, verificação e dependências externas.

## Evidências obtidas

| Frente | Implementação e verificação |
|---|---|
| Banco e login local | MariaDB 11.8.8 nativo em loopback, quatro migrations, contas fictícias com senhas individuais. Smoke HTTP confirmou login e permissões. Sem Docker ou alteração do banco antigo. |
| Banco remoto | Neon Free confirmado, PostgreSQL 17 em São Paulo; baseline aplicada nas branches principal e de verificação. Três gates reais passaram pelo pooler com TLS. Papel runtime separado passou em operações reais e recusou DDL/alteração de séries/exclusões protegidas. Demonstração remota: cinco contas, três alunos, duas fichas, 798 exercícios e senhas novas. |
| Vercel publicada | Preview e Production READY, Node 24.x, função São Paulo (`gru1`), Prisma PostgreSQL 6.19.3 gerado no Linux. Gate HTTPS aprovado nos dois ambientes: banco pronto, três perfis, cookie Secure/HttpOnly/Lax, autorização, catálogo, painel, CSRF e logout. No navegador remoto, aluno permaneceu autenticado após recarga e reencontrou sessão finalizada com uma série 20 kg × 8, RIR 2, volume 160 kg·reps. |
| Segurança | Papel/atividade consultados no banco, cadastro somente por administrador, CSRF por origens exatas, API no-store, quotas HMAC compartilhadas. Scripts restritos à mesma origem, handlers HTML inline removidos; estilos inline legados continuam permitidos. Logout sem servidor mantém intenção persistente e bloqueia restauração automática; navegador confirmou permanência no login após reconexão. Bootstrap testado sem reset na branch remota isolada. Credenciais runtime na Vercel como Secret; JWT de produção independente do Preview. |
| Gestão | Planos, cancelamento auditável de presença, edição de fichas com revisão preservando histórico, relatórios com escape e soma de decimais. Testes de instrutor/aluno sem acesso à gestão financeira. |
| Exercícios | Importação real local completa: 919 avaliados, 795 incorporados, 124 ignorados, 10 páginas. Identidade externa única, licenças/autoria por conteúdo e mídia; curadoria local preservada. Catálogo descritivo não é prescrição. |
| Treinos | Séries de trabalho/aquecimento, carga externa/reps/RIR, snapshots e UUIDs idempotentes. Toda edição cria revisão sem substituir IDs da ficha anterior, inclusive sem logs no servidor. Sessões com envios rejeitados têm arquivamento local confirmado, preservando evidência e liberando nova sessão; isso não conclui a sessão remota. Catálogo no editor tem páginas de 30. |
| Nutrição | Equações determinísticas e hipóteses explícitas. Navegador confirmou cálculo, salvamento optativo e restauração exigindo nova confirmação de escopo. |
| Mobile/PWA | Produção em viewport emulada 375 × 812: largura do documento 369, menor que largura interna 375, sem overflow horizontal; captura 17. Não é telefone físico nem teste de instalação. Localmente, com servidor desligado, série 27 kg × 8 permaneceu pendente; após reconexão, banco confirmou exatamente uma série, volume 216 kg·reps. Recarregamento offline exibiu somente fallback público. |
| Pagamento | Adaptador Checkout Pro sandbox, assinatura HMAC, confirmação canônica, ownership e renovação preservando vigência. Testes com banco real e provedor simulado confirmaram conciliação única; não houve chamada de cobrança ao Mercado Pago. |
| IA | Temas/fontes curados, chave exclusivamente no servidor, resposta estruturada validada. Modelo padrão e contrato atualizados pela documentação oficial; provedor simulado nos testes. |
| Datas | Calendário operacional `America/Sao_Paulo`, validação de filtros antes da consulta, colunas DATE preservadas como datas civis e agrupamento de instantes em UTC convertido ao calendário brasileiro. Coluna TIME legada não foi reescrita. |
| Landing | React/Vite, laranja/navy e Barlow preservados, fotografia ilustrativa nova, autoria e estado real. Dependências/páginas obsoletas removidas. Build com TypeScript. Produção pública READY, HTML/JS/CSS/hero com HTTP 200 sem bypass e CTA para o aplicativo confirmado. Hero conferido no navegador, captura 18. |

## Reproduzir os testes

No diretório `server`, com o banco demonstrativo em execução:

```powershell
npm test
npm audit
node scripts/with-local-env.cjs node scripts/smoke-local.cjs
node scripts/with-local-env.cjs node --test tests/sessoes-concurrency.test.cjs
node scripts/with-local-env.cjs node tests/checkout-local.integration.cjs
node scripts/with-local-env.cjs node tests/quota-local.integration.cjs
node scripts/with-local-env.cjs node tests/checkins-dates-local.integration.cjs
```

O smoke/sessões mantém registros demonstrativos para inspeção. Fixtures temporárias dos testes financeiros, quotas e datas são removidas pelos próprios testes. Não execute em produção. Os resultados devem ser novamente conferidos após mudanças relevantes.

Na landing: `npm run build` e `npm audit`. `lint` atualmente verifica tipos; não representa análise ESLint.

Verificação integrada de 08/10: suíte com wrapper MariaDB local **195 testes aprovados, zero falhas, zero ignorados**, executada com `node scripts/with-local-env.cjs npm test`, incluindo concorrência real, retries PostgreSQL e guards de destino/origem. Smoke HTTP, financeiro, quotas compartilhadas e DATE/TIME também passaram no banco local. Login de admin/instrutor/aluno, salvamento de revisão, catálogo, relatórios, evolução e navegação para registros avulsos foram conferidos no navegador. Credenciais de provedores não foram simuladas como integração real. Runtime e CI estão fixados em Node 24.x.

PostgreSQL: baseline aplicada ao cluster dedicado `127.0.0.1:5448/fitflow_pg_test`, com binários 17.10 já instalados, e às branches principal e de verificação do Neon. Os três gates reais passaram também na branch remota isolada usando pooler e TLS: login HTTP dos três perfis, cookie Secure/HttpOnly, autorização e bloqueio, bootstrap sem reset, quota compartilhada com 20 incrementos concorrentes, sessões idempotentes após normalização JSONB, concorrência de séries/finalização, datas civis, duas renovações concorrentes, conciliação única com provedor simulado e rejeição das dez CHECK constraints. Os gates usaram dados sintéticos e removeram suas fixtures. O teste HTTP envia cookie manualmente; não comprova o navegador HTTPS nem o domínio publicado. A versão nativa é usada somente para testes; o recurso cloud confirmou PostgreSQL 17, sem comprovação aqui da versão minor do servidor.

O papel runtime `fitflow_app` teve os atributos administrativos conferidos como ausentes. Logs e séries recebem `SELECT`/`INSERT`, sem `UPDATE`/`DELETE`. O teste real `check-neon-runtime.cjs` aprovou leitura/inserção/atualização em transação revertida e confirmou SQLSTATE `42501` para DDL, atualização de séries e exclusão de logs, pagamentos e usuários. Credenciais owner, verificação e runtime ficam em arquivos privados ignorados, separados; somente runtime foi enviado à Vercel.

O papel API administrativo não utilizado `fitflow_runtime` foi removido pelo MCP Neon após autorização explícita do usuário. A listagem da branch principal confirmou apenas `fitflow_app` e `fitflow_owner`. `check-private-files.cjs` passou para 256 arquivos candidatos e segredos locais conhecidos; não examinou todo o histórico Git nem segredos desconhecidos.

[Preview validado](https://fit-flow-aii93048s-eznrbs-projects.vercel.app): o script `check-hosted-fitflow.cjs` passou via HTTPS nos três perfis, com autorização, catálogo, painel, CSRF e logout. A implantação tem proteção de acesso. O gate confere respostas e atributos dos cookies; não substitui os testes finais no navegador/telefone. Credenciais demonstrativas remotas novas estão em `server/.demo-credentials.remote.local.json`; não há histórico de QA copiado do banco local.

[Production validada](https://fit-flow-indol.vercel.app): deployment `dpl_6EYbxgErP4HK7QBtWevwkgMn2j5V`, READY, função `gru1`, Node 24.x e pacote de 9,68 MB. O mesmo gate HTTPS passou. No navegador, login do aluno usou cookie HttpOnly real; recarga manteve autenticação. A sessão demonstrativa com nota explícita de teste acadêmico recebeu uma série de trabalho 20 kg × 8, RIR 2; foi finalizada e reapareceu após recarga/reabertura/expansão do histórico, com uma série e 160 kg·reps. A captura 16 registra essa verificação.

O alias canônico agora aponta ao deployment READY `dpl_5keW3LmJW9PX16PzaNnUs4rngMD1`, revisão `dad6d9c`, com o ajuste de texto plural. Na revisão atual, o navegador também restaurou a autenticação após recarga e mostrou a sessão já finalizada, a série 20 kg × 8, RIR 2 e o volume 160 kg·reps; captura `evidence/19-vercel-revisao-atual-historico.png`. As capturas 16–18 preservam as verificações anteriores.

**Login recuperado no domínio final com banco e credenciais novos.** Credenciais antigas do GitHub não foram restauradas; registros do Aiven não foram recuperados. A prova obtida abrange os fluxos registrados, sem declarar toda a entrega concluída.

[Landing publicada](https://fitflow-lp.vercel.app): deployment `dpl_GgjuMMHUXcdYXLL3ZfjWHAUTVzc9`, READY. Gate público sem bypass confirmou HTML, JavaScript, CSS e imagem hero com HTTP 200, além do CTA para `https://fit-flow-indol.vercel.app`. O navegador confirmou a imagem nova e a composição publicada.

GitHub: aplicativo commit `dad6d9c` em `codex/science-ux-foundation`, [PR draft #1](https://github.com/EznRB/FitFlow/pull/1); landing commit `c6b43ba` em `codex/landing-improvements`, [PR draft #1](https://github.com/EznRB/fitflow-LP/pull/1). Ambos foram enviados e anexados à tarefa. Revisão e merge permanecem pendentes; nenhum merge à branch principal foi realizado.

[CI GitHub — FitFlow verification #12](https://github.com/EznRB/FitFlow/actions/runs/37873364828), ID `37873364828`, concluída com sucesso para `dad6d9c`. Após remover o papel não utilizado, o teste runtime passou novamente; no domínio final, health retornou HTTP 200 com banco pronto e `js/sessoes` retornou 200 com o texto atualizado. Essas verificações específicas não representam repetição de toda a suíte ou do fluxo de navegador.

## Pendências obrigatórias

1. **Demais fluxos publicados:** login e persistência essenciais passaram em Production; ampliar a verificação aos fluxos de gestão, nutrição e reconexão no domínio final. Diagnóstico antigo Aiven `ENOTFOUND`/login 500 preservado; dados demonstrativos novos não recuperam registros antigos. Ver [pesquisa e critérios](BANCO_REMOTO_VERCEL.md).
2. **Mercado Pago de teste:** configurar vendedor/comprador sandbox, token, segredo de webhook e URL HTTPS. Confirmar/rejeitar eventos reais de teste antes de declarar integração operacional. Nenhuma credencial deve ser enviada no chat ou ao frontend.
3. **IA:** configurar chave e quota/limite de gasto no provedor e realizar teste real de explicação. Validação de IDs de fontes não comprova a veracidade de cada frase gerada.
4. **Telefone físico:** testar instalação HTTPS, teclado, sessão, interrupção de rede e retorno. Tela responsiva e testes de fila no navegador não substituem esse teste.
5. **Validação final e revisão:** concluir os demais fluxos de publicação, conferir headers e reconexão e revisar visualmente as áreas de gestão. Modais e revisão visual por papel passaram localmente; aluno/persistência e landing foram conferidos no navegador publicado. Código já enviado aos PRs draft; revisão e merge à branch principal estão pendentes.

## Roteiro de apresentação local

1. Abrir landing em `http://127.0.0.1:3108/` e seguir ao app em `http://127.0.0.1:3107/`.
2. Usar as contas demonstrativas do arquivo privado `server/.demo-credentials.local.json`.
3. Aluno: consultar ficha, iniciar sessão, registrar carga/reps/RIR, sincronizar e consultar evolução. Dados de teste estão identificados como demonstração.
4. Nutrição: confirmar escopo adulto saudável, informar parâmetros, conferir fórmula/unidades, salvar somente se desejar e restaurar com nova confirmação.
5. Instrutor: criar/editar ficha própria sem dose automática do catálogo. Administrador: alunos/planos/presença/relatórios.
6. Pagamentos e IA sem credenciais mostram sua indisponibilidade; não apresentar essa condição como pagamento aprovado ou geração real.

## Capturas

- `evidence/09-serie-mobile-pendente.png`: registro no dispositivo, antes da reconexão.
- `evidence/10-pwa-fallback-mobile.png`: abertura offline pública.
- `evidence/11-painel-aluno-refinado.png`: painel do aluno em tela de 375 pixels após refinamento.
- `evidence/12-landing-refinada-final.png`: landing em desktop com a nova fotografia ilustrativa.
- `evidence/13-fichas-revisao-preservada.png`: ficha revisada e anterior arquivada, após gravação no navegador.
- `evidence/14-logout-sem-servidor.png`: aviso explícito de saída pendente, sem restauração automática.
- `evidence/15-sessao-arquivada-preservada.png`: série rejeitada preservada no dispositivo, com nova sessão disponível e sem volume sincronizado fabricado.
- `evidence/16-vercel-neon-sessao-persistida.png`: histórico remoto expandido após recarga, com uma série demonstrativa 20 kg × 8, RIR 2, nota de teste e 160 kg·reps.
- `evidence/17-vercel-mobile-375.png`: aplicativo publicado em viewport emulada 375 × 812, sem overflow horizontal; não comprova teste em telefone físico.
- `evidence/18-landing-vercel-publicada.png`: hero e composição da landing pública implantada na Vercel.
- Capturas anteriores registram fases intermediárias; não comprovam automaticamente a interface final.
