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

O [aplicativo publicado](https://fit-flow-indol.vercel.app) usa Neon PostgreSQL 17 Free em São Paulo, com schema/migrations separados e conexão pooled. Login dos três perfis, cookie seguro, autorização, CSRF e logout passaram no gate HTTPS de Production. O navegador confirmou sessão autenticada após recarga e persistência de uma sessão de treino finalizada. [Banco, implantação e verificações](docs/BANCO_REMOTO_VERCEL.md).

## Recursos implementados

- Gestão de alunos, planos, fichas, presença, pagamentos manuais e relatórios.
- Autenticação em cookie httpOnly; autorização considera o usuário ativo e seu papel atual no banco. Escritas protegidas por origem, API sem cache e quotas de login/IA compartilhadas no banco em produção.
- Catálogo local e importador wger com paginação, identidade externa, idioma, licenças e autoria. Importação local de 08/10: 795 entradas incorporadas e 124 ignoradas. Um catálogo descritivo não valida uma prescrição.
- Registro de sessões e séries com carga externa, repetições, RIR opcional, aquecimento/trabalho, snapshot da ficha e IDs idempotentes.
- Fila de séries por conta em IndexedDB, com estado de sincronização e conflitos visíveis.
- Recuperação de sessão rejeitada com confirmação e preservação local dos registros. Logout sem conexão não restaura automaticamente a conta ao reconectar.
- Nutrição com Mifflin–St Jeor ou Harris–Benedict revisada, hipóteses explícitas e parâmetros salvos/restaurados por consentimento.
- Fundamentos científicos com referências; IA educativa opcional no servidor, sem envio de medidas corporais.
- PWA com manifesto e fallback público offline. Novas abas offline exigem reconexão para validar autenticação.

## Verificação

```powershell
cd server
npm test
npm audit
node scripts/with-local-env.cjs node scripts/smoke-local.cjs
node scripts/with-local-env.cjs node --test tests/sessoes-concurrency.test.cjs
```

Os dois últimos comandos são testes integrados optativos e gravam apenas na demonstração local. Mantêm o histórico criado. A suíte comum usa doubles e não requer credenciais de serviços externos.

## Publicação e limites atuais

O login antigo da Vercel falhava porque o host Aiven configurado não resolvia no DNS; a tentativa retornou 500. **O login no domínio final foi recuperado com o novo banco Neon.** A demonstração remota tem cinco contas com senhas novas em `server/.demo-credentials.remote.local.json`, ignorado pelo Git, três alunos, duas fichas e 798 exercícios. As credenciais antigas do GitHub não foram restauradas, e os dados antigos do Aiven não foram recuperados. O deploy foi realizado pela CLI a partir das alterações locais; ainda não houve push dos repositórios.

Checkout Pix/cartão está implementado exclusivamente em sandbox, com conciliação idempotente e renovação preservando vigência existente. A antiga simulação de pagamento pelo aluno foi desativada: o retorno do navegador não comprova pagamento. IA real depende de chave e quota; pagamentos dependem de credenciais e webhook do provedor. O aplicativo publicado passou na viewport emulada 375 × 812 sem overflow; telefone físico e instalação não foram testados. Demais fluxos e persistência das alterações no GitHub continuam pendentes. Consulte a [meta completa](docs/PLANO_MESTRE_DESENVOLVIMENTO.md).

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
