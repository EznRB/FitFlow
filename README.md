# FitFlow Caraguá

Projeto acadêmico de gestão de academia, com áreas de administrador, instrutor e aluno. Interface em português, identidade laranja e azul escuro. A [landing publicada](https://fitflow-lp.vercel.app) apresenta o sistema e aponta ao aplicativo; seu código fica no repositório [fitflow-LP](https://github.com/EznRB/fitflow-LP).

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

Para configurar outro computador ou banco, consulte [Desenvolvimento](docs/DESENVOLVIMENTO.md). Não execute seed demonstrativo em produção.

O [aplicativo publicado](https://fit-flow-indol.vercel.app) usa Neon PostgreSQL 17 Free em São Paulo, com schema/migrations separados e conexão pooled. Gates HTTPS confirmaram os três perfis, autorização, gestão, nutrição optativa, presença e renovação manual concorrente. O navegador confirmou autenticação após recarga, treino finalizado persistido e cenário nutricional salvo/restaurado. [Banco, implantação e verificações](docs/BANCO_REMOTO_VERCEL.md).

## Recursos implementados

- Gestão de alunos, planos, fichas, presença, pagamentos manuais e relatórios.
- Lançamento manual de recebimento com UUID idempotente, hash da intenção e vínculo ao administrador; replay não duplica pagamento nem renovação. Esse registro não cobra nem comprova Pix/cartão.
- Autenticação em cookie httpOnly; autorização considera o usuário ativo e seu papel atual no banco. Escritas protegidas por origem, API sem cache e quotas de login/IA compartilhadas no banco em produção.
- A inicialização mostra verificação acessível da sessão e impede envio prematuro do login; `/auth/me` tem timeout de 15 segundos, incluindo espera pelo lock. Login/logout/retry coordenam o cookie entre abas com Web Locks e marcador de sessão opaco.
- Catálogo local e importador wger com paginação, identidade externa, idioma, licenças e autoria. Importação local de 08/10: 795 entradas incorporadas e 124 ignoradas. Um catálogo descritivo não valida uma prescrição.
- Registro de sessões e séries com carga externa, repetições, RIR opcional, aquecimento/trabalho, snapshot da ficha e IDs idempotentes.
- Fila de séries por conta em IndexedDB, com estado de sincronização e conflitos visíveis. Leituras e callbacks tardios verificam identidade e tela de origem; logout aguarda limpeza antes de liberar outro login.
- Recuperação de sessão rejeitada com confirmação e preservação local dos registros. Logout sem conexão não restaura automaticamente a conta ao reconectar.
- Nutrição com Mifflin–St Jeor ou Harris–Benedict revisada, hipóteses explícitas e parâmetros salvos/restaurados por consentimento.
- Fundamentos científicos com referências; IA educativa opcional no servidor, sem envio de medidas corporais.
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

O terceiro comando executa a suíte com o ambiente MariaDB isolado, incluindo concorrência real: **279 testes aprovados, zero falhas e zero ignorados** na revisão `62ff0af`. No Windows, passe `node` ao wrapper; `node scripts/with-local-env.cjs npm test` não é a receita validada, pois `npm` depende de `npm.cmd`. Os dois últimos comandos são testes integrados optativos e gravam apenas na demonstração local. Mantêm o histórico criado. Os testes com doubles não requerem credenciais de serviços externos.

## Publicação e limites atuais

O login antigo da Vercel falhava porque o host Aiven configurado não resolvia no DNS; a tentativa retornou 500. **O login no domínio final foi recuperado com o novo banco Neon.** A demonstração remota tem cinco contas com senhas novas em `server/.demo-credentials.remote.local.json`, ignorado pelo Git, três alunos, duas fichas e 798 exercícios. As credenciais antigas do GitHub não foram restauradas, e os dados antigos do Aiven não foram recuperados. Código enviado às branches e disponível nos PRs draft [do aplicativo](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1); nenhum foi mesclado à branch principal.

Checkout Pix/cartão está implementado exclusivamente em sandbox, com conciliação idempotente e renovação preservando vigência existente. Retorno do navegador não comprova pagamento. Lançamento manual idempotente está publicado; o gate HTTPS da revisão `4b89e3` confirmou replay sem terceiro registro, conflito 409 e sessão divergente 403, além de gestão/cadastro/data civil. IA real depende de acesso ao provedor e quota; a alternativa Vercel AI Gateway foi consultada com OIDC válido e retornou saldo zero. Checkout depende de credenciais e webhook do provedor. Revisão atual `62ff0af` em READY, com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38016513262) e **279 testes aprovados**. Os quatro scripts alterados foram conferidos por hash no domínio final; login de aluno, restauração após recarga e histórico persistido foram verificados no navegador. Sessões em viewport emulada 375 × 812 ficaram dentro da largura disponível; telefone físico e instalação não foram testados. Estado e gates em [STATUS_ENTREGA.md](docs/STATUS_ENTREGA.md). Revisão/merge dos PRs e gates restantes continuam pendentes. Consulte a [meta completa](docs/PLANO_MESTRE_DESENVOLVIMENTO.md).

## Documentação

- [Estado da entrega e evidências](docs/STATUS_ENTREGA.md)
- [Desenvolvimento e banco nativo](docs/DESENVOLVIMENTO.md)
- [Arquitetura e contratos](docs/ARQUITETURA.md)
- [Datas civis e calendário operacional](docs/DATAS_E_FUSO.md)
- [Ciência, fontes e limites](docs/CIENCIA.md)
- [Ferramentas e integrações pesquisadas](docs/FERRAMENTAS_E_INTEGRACOES.md)
- [Plano completo de desenvolvimento](docs/PLANO_MESTRE_DESENVOLVIMENTO.md)
- [Direção visual](design-system/fitflow/MASTER.md)

Documentos datados de análise e planejamento registram o estado daquele momento. Não representam automaticamente o estado atual nem a conclusão do projeto.

Autoria: Enzo Marcelo Ribeiro Fermiano — Análise e Desenvolvimento de Sistemas, 2026.
