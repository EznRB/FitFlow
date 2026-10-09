# Desenvolvimento e banco

## Ambiente preparado neste computador

O banco antigo da Vercel está inacessível. A demonstração usa MariaDB **11.8.8 nativo no Windows**, com os arquivos na pasta ignorada `.local-db/`. Não exige Docker, WSL, Hyper-V ou alteração da BIOS. Não foi instalado como serviço nem configurado para iniciar com o Windows.

- Banco: `fitflow_dev`, TCP `127.0.0.1:3308`, acesso restrito ao loopback.
- Servidor: `http://127.0.0.1:3107/`.
- Landing: `http://127.0.0.1:3108/`.
- Ambiente: `server/.env.development.local`, separado do `.env` original.
- Contas: `server/.demo-credentials.local.json`; contém senhas individuais e não deve ser compartilhado no Git.

```powershell
cd server
npm ci
npm run db:local:start
npm run db:local:migrate
npm run db:local:seed
npm run browser:vendor
npm run dev:local
```

Em outro terminal, dentro da landing:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 3108
```

Para desligar somente o banco demonstrativo: `npm run db:local:stop`. Os dados são preservados. O auxiliar recusa reinicializar um diretório existente ou sobrescrever um arquivo de ambiente não identificado como seu.

## Preparar um Windows novo

Instale Node.js **24.x**, a versão fixada para runtime/CI, e obtenha o ZIP Windows x64 MariaDB 11.8.8 da [distribuição oficial](https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/installing-mariadb/binary-packages/installing-mariadb-windows-zip-packages). O arquivo usado neste computador foi `mariadb-11.8.8-winx64.zip`, 96.738.552 bytes, com SHA-256 verificado contra o manifesto oficial:

```
20871a79964e1819ddaad9247b676b9d08c958c345e5e3d4748242b2b2965ff1
```

Extraia a distribuição em `.local-db/runtime/mariadb-11.8.8-winx64/`, onde deve existir `bin/mariadbd.exe`. Na pasta `server`, execute `npm ci` e `npm run db:local:init`. Esse comando inicializa o banco local, gera credenciais aleatórias e configura a escuta somente em `127.0.0.1`. Depois aplique migrations, gere o client (`node scripts/with-local-env.cjs node node_modules/prisma/build/index.js generate`) e rode o seed.

O arquivo `.local-db/` não é um backup nem parte do repositório. Não o apague para resolver uma falha de código.

## Outro MySQL/MariaDB ou hospedagem

Use `server/.env.example` como referência e configure `DATABASE_URL` e um `JWT_SECRET` aleatório forte. O wrapper `with-local-env.cjs` substitui variáveis somente no processo filho; não altera o ambiente global nem o `.env` antigo.

`CORS_ORIGIN` aceita origens completas separadas por vírgula, sem caminhos ou barra final (por exemplo, `https://app.exemplo.com`). Escritas autenticadas por cookie exigem uma dessas origens. Não configure `trust proxy=true` para contornar a proteção. Em produção, a migration de `RateLimitBucket` é necessária para as quotas compartilhadas de login/IA; a API falha com 503 se não conseguir confirmar esse limite.

Com o banco remoto correto configurado, execute `npm run db:deploy`. Nunca use `db:reset` em um banco que contenha dados importantes. O seed demonstrativo recusa hosts remotos e produção.

### Primeiro administrador no banco novo

Crie um arquivo **privado**, fora de pastas compartilhadas, com o nome `.bootstrap-admin.local.json` e os campos `name`, `email` e `password`. Use uma senha individual com pelo menos 16 caracteres e no máximo 72 bytes; não a envie no chat. Esse nome é ignorado pelo Git. Configure `DATABASE_URL` no ambiente local seguro e confirme o host e o nome do banco nos argumentos:

```powershell
npm run auth:bootstrap -- --credentials-file "CAMINHO_PRIVADO/.bootstrap-admin.local.json" --database-host "HOST_DO_BANCO" --database-name "NOME_DO_BANCO"
```

O comando não imprime credenciais, cria somente o primeiro administrador e recusa e-mail já cadastrado ou qualquer administrador existente, inclusive inativo. Não promove usuários nem reseta senhas. Depois, entre pela aplicação e cadastre as demais contas autorizadas. O comando passou também no PostgreSQL real, inclusive na branch remota isolada de verificação; essa fixture foi removida. A branch principal agora contém contas demonstrativas próprias; o bootstrap recusa criar outro primeiro administrador nela.

## PostgreSQL nativo e Neon

O backend seleciona provider, schema e Client pelo protocolo da conexão e por `DATABASE_PROVIDER`; uma combinação incompatível é recusada. MySQL mantém seu histórico de migrations. PostgreSQL usa `server/prisma/postgresql/schema.prisma` e baseline separados, com Prisma 6.19.3. `DIRECT_URL` é a conexão direta para migrations; `DATABASE_URL` usa pooler no runtime Neon. Não reutilizar migrations MySQL em PostgreSQL.

O cluster PostgreSQL local de teste utiliza os binários 17.10 já presentes neste computador, em `C:/Program Files/PostgreSQL/17/bin`, com dados isolados em `.local-db-postgresql/`, loopback `127.0.0.1:5448` e banco `fitflow_pg_test`. Não depende de Docker e não foi instalado como serviço. Em `server`:

```powershell
# Somente para criar destino novo; recusa sobrescrever dados/ambiente existentes.
node scripts/local-postgresql.cjs init
# Para retomar o cluster já criado:
node scripts/local-postgresql.cjs start
node scripts/with-postgresql-test-env.cjs node node_modules/prisma/build/index.js generate
node scripts/with-postgresql-test-env.cjs node node_modules/prisma/build/index.js migrate deploy
node scripts/with-postgresql-test-env.cjs node tests/postgresql-core-local.integration.cjs
node scripts/with-postgresql-test-env.cjs node tests/auth-postgresql-local.integration.cjs
node scripts/with-postgresql-test-env.cjs node tests/quota-postgresql-local.integration.cjs
```

Para parar somente esse cluster: `node scripts/local-postgresql.cjs stop`. Os wrappers substituem variáveis herdadas, exigem destino conhecido e não alteram o ambiente global. Não executar Prisma diretamente com uma `DATABASE_URL` herdada de outra aplicação.

O Neon está criado na conta autenticada: projeto `mute-night-99440749`, Free verificado, PostgreSQL 17, São Paulo (`aws-sa-east-1`). A baseline foi aplicada às branches `production` e `verification`; os mesmos três gates passaram na branch de verificação pelo pooler com TLS. Com a credencial privada de verificação disponível:

```powershell
node scripts/with-neon-verification-env.cjs node tests/postgresql-core-local.integration.cjs
node scripts/with-neon-verification-env.cjs node tests/auth-postgresql-local.integration.cjs
node scripts/with-neon-verification-env.cjs node tests/quota-postgresql-local.integration.cjs
```

O guard compartilhado exige projeto, branch, hostname, banco e validação TLS esperados. A branch principal não é um destino permitido para esses gates. Fixtures próprias recebem UUIDs e somente os registros correspondentes são removidos.

Ambientes privados ignorados, sem valores no Git ou chat:

| Arquivo em `server/` | Finalidade |
|---|---|
| `.env.remote.local` | Papel `fitflow_owner`, conexão administrativa da branch principal. |
| `.env.remote.verify.local` | Branch isolada de verificação. |
| `.env.remote.runtime.local` | Papel `fitflow_app`, conexão pooled e segredo JWT para execução. |

O wrapper `with-neon-owner-env.cjs` restringe administração ao projeto/branch/host conhecidos. As permissões runtime estão em `prisma/postgresql/runtime-privileges.sql`: sem criação de bancos/papéis, bypass RLS ou `neon_superuser`, sem alteração/exclusão de logs e séries. O teste real `check-neon-runtime.cjs` passou para leitura/inserção/atualização revertidas e confirmou recusa `42501` das operações protegidas. Cada migration futura precisa revisar permissões de tabelas novas. **Somente a credencial runtime foi configurada na Vercel**, com segredos do tipo Secret e JWT de produção independente do Preview.

A demonstração remota usa cinco contas com senhas novas em `server/.demo-credentials.remote.local.json`, três alunos, duas fichas e 798 exercícios. Não copia históricos de QA e não recupera os dados do Aiven. O seed local continua restrito ao banco local; a preparação remota usa script próprio com destino explícito.

[Preview HTTPS](https://fit-flow-aii93048s-eznrbs-projects.vercel.app) em READY, Node 24.x, função `gru1` e Client PostgreSQL Prisma 6.19.3 gerado no build Linux. Os gates seguintes passaram, no diretório `server`, utilizando apenas arquivos privados ignorados:

```powershell
node scripts/check-neon-runtime.cjs
node scripts/check-hosted-fitflow.cjs https://fit-flow-aii93048s-eznrbs-projects.vercel.app/
node scripts/check-hosted-fitflow.cjs https://fit-flow-indol.vercel.app/
```

O gate hospedado usa autenticação autorizada para o Preview protegido e confere health/banco, login/me nos três perfis, cookie Secure/HttpOnly/Lax, autorização, catálogo, painel, CSRF e logout. O script não divulga token/senha e não realiza cobrança. `.vercelignore` exclui arquivos privados, bancos nativos, testes e documentação do pacote.

O [domínio Production](https://fit-flow-indol.vercel.app) aponta ao deployment READY `dpl_9TiPE1WdMZaCyhy1WtsX6H93rPiy`, revisão `24e77b4`, Node 24.x, função `gru1` e Client PostgreSQL Prisma 6.19.3 gerado no build Linux. [CI da revisão](https://github.com/EznRB/FitFlow/actions/runs/37991180996) aprovada. Gate HTTPS de gestão passou após o deploy, incluindo replay manual, conflito 409 e sessão divergente 403. Navegador restaurou admin e confirmou modal, data brasileira 09/10/2026 e orientação de registro manual, captura 23; nenhum formulário submetido. Fundamentos conferido na revisão `65fb32c`, captura 21.

Gates no mesmo domínio confirmaram três perfis, autorização, CSRF e logout. Treino demonstrativo finalizado persistiu após recarga: 20 kg × 8, RIR 2, 160 kg·reps. Nutrição fictícia foi salva/restaurada no navegador com escopo desmarcado até nova confirmação, captura 20. Gestão HTTPS foi repetida após `24e77b4`: CRUD, perfis, nutrição consentida/isolada, presença auditável, duas renovações de sete dias concorrentes e replay do mesmo UUID sem terceiro registro/renovação.

O login foi recuperado com Neon e senhas novas; credenciais antigas do GitHub e dados Aiven não foram restaurados. Código nas branches `codex/science-ux-foundation` e `codex/landing-improvements`, PRs draft [do app](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1). Nenhum merge realizado. Estado e pendências em [STATUS_ENTREGA.md](STATUS_ENTREGA.md).

O papel API administrativo não utilizado `fitflow_runtime` foi removido após autorização explícita do usuário. A branch principal contém somente `fitflow_app` e `fitflow_owner`, e o teste runtime passou novamente após a remoção. Para conferir candidatos de publicação contra segredos locais conhecidos: `node scripts/check-private-files.cjs`. Não cobre todo o histórico Git nem segredos desconhecidos.

A [landing publicada](https://fitflow-lp.vercel.app) está READY, revisão `c6b43ba`, deployment `dpl_4VvK5DL5euaArBubytijVTVpSbXD`. Gate público sem bypass confirmou HTML/JS/CSS/hero HTTP 200, CTA e copy atuais; navegador confirmou estado publicado e fotografia nova. Captura 18 registra a implantação anterior.

### Política de conteúdo

Scripts são permitidos somente da mesma origem, sem `unsafe-inline` ou `unsafe-eval`; handlers HTML inline foram removidos. A política é aplicada pelo Helmet local e pelo primeiro `routes` de `vercel.json` para cobrir os arquivos estáticos da Vercel. Estilos inline legados continuam permitidos, assim como Google Fonts e imagens HTTPS. As chamadas de API e o service worker ficam na mesma origem. Conferir os headers da publicação é um gate obrigatório. Referência: [configuração oficial da Vercel](https://vercel.com/docs/project-configuration/vercel-json#headers).

A Vercel precisa alcançar o banco remoto com TLS e ter os valores definidos para o ambiente da implantação. O health check consulta o banco e retorna 503 se ele não responde; um site estático carregando não prova que o login funciona.

## Testes

- `npm test`: lógica, API com doubles, autorização, matemática, catálogo, fila e PWA; sem cobrança de provedor.
- `node scripts/with-local-env.cjs node --test tests/*.test.cjs`: suíte integral com ambiente MariaDB isolado e concorrência real; **233 aprovados, zero falhas e zero ignorados** na revisão `24e77b4`.
- `npm audit`: auditoria de dependências conhecidas. Não equivale a uma auditoria completa de segurança.
- `node scripts/with-local-env.cjs node scripts/smoke-local.cjs`: login e persistência via HTTP no servidor local ativo.
- `node scripts/with-local-env.cjs node --test tests/sessoes-concurrency.test.cjs`: concorrência real de sessões/séries no MariaDB.
- `node scripts/with-local-env.cjs node tests/checkout-local.integration.cjs`: conciliação e renovação no banco local com provedor simulado.
- `node scripts/with-local-env.cjs node tests/quota-local.integration.cjs`: incremento concorrente e limite conjunto de duas instâncias.
- `node scripts/with-local-env.cjs node tests/checkins-dates-local.integration.cjs`: DATE/TIME, calendário brasileiro, duplicidade e cancelamento.
- `node scripts/with-local-env.cjs node tests/manual-payment-local.integration.cjs`: replay/conflitos, ator, sessão, consulta restrita, CHECK e concorrência de lançamentos manuais no MariaDB.
- `node scripts/with-postgresql-test-env.cjs node tests/manual-payment-local.integration.cjs`: o mesmo gate no PostgreSQL nativo isolado; esse teste recusa qualquer host remoto.

Os testes integrados são optativos. Smoke/sessões preservam o histórico demonstrativo gerado; financeiro/quotas/datas removem somente suas fixtures temporárias. Não executá-los com uma URL de produção.

No Windows, não chamar `npm test` pelo wrapper `with-local-env.cjs`: o executável é `npm.cmd` e essa combinação falhou. A receita validada passa `node --test` diretamente. Os wrappers continuam substituindo variáveis herdadas sem mudar o ambiente global.

### Exceção guardada: gestão no FitFlow publicado

O gate abaixo usa exclusivamente o domínio HTTPS canônico e a branch Neon principal já identificada, com execução explícita. Não aceita destinos arbitrários nem `NODE_ENV=production` no processo de teste:

```powershell
node tests/hosted-management.integration.cjs --execute-hosted-fixtures
```

Seu constructor Prisma recebe a URL privada guardada explicitamente, sem usar a URL herdada. O owner prepara dois usuários de teste e limpa somente UUIDs próprios; os fluxos funcionais passam pela API HTTPS com administrador/instrutor/aluno. Antes de qualquer escrita confirma ausência de colisões. A execução aprovada usou três logins e removeu quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins sintéticos; não resetou quotas nem alterou contas demonstrativas. Repetir somente para resolver uma mudança relevante, respeitando a quota real de login.

## Integrações opcionais

Sem `GEMINI_API_KEY`, a IA informa indisponibilidade e fórmulas/fontes continuam acessíveis. O modelo padrão é `gemini-3.5-flash-lite`; a chave fica exclusivamente no servidor. Antes da geração real, configure quotas e limites de gasto no provedor.

Checkout depende dos campos Mercado Pago de `server/.env.example`, conta de teste e webhook HTTPS. O modo implementado é sandbox. Testes com provedor simulado não substituem confirmação canônica de um pagamento real de teste.

### Lançamento manual e migração aditiva

O modal registra **pagamento já recebido**; não cobra, gera Pix nem valida cartão. Cada intenção tem UUID persistido único, hash canônico dos dados e ator autenticado. Retry idêntico retorna o registro existente sem nova renovação; outro ator ou payload divergente recebe 409. Consulta `/api/pagamentos/solicitacoes/:requestId` reconcilia resposta perdida somente para o mesmo ator; caso contrário responde 404. A expectativa de conta divergente é recusada com 403 antes da consulta ao banco.

O frontend mantém a intenção para reconciliação/retry e usa Web Locks entre abas. Essa proteção de interface complementa a constraint única do servidor. Intenções diferentes continuam sendo lançamentos diferentes; o UUID não substitui a conferência administrativa do recebimento.

`20261009_manual_payment_idempotency` adiciona UUID/hash e CHECK de par completo/ator, preservando pagamentos legados com campos nulos e a baseline aplicada. Aplicada nos bancos nativos e nas duas branches Neon; totais: cinco migrations MySQL, duas PostgreSQL e onze CHECKs PostgreSQL. Os Clients precisam ser gerados após atualizar o schema, usando o wrapper correspondente, e a migration deve anteceder a publicação do código. Gates manuais passaram nos dois bancos nativos, core atualizado passou na branch Neon de verificação e gestão HTTPS passou após o deploy `24e77b4`.

Checkout do provedor possui conciliação idempotente separada; suas credenciais e eventos reais de sandbox continuam pendentes.

## Mobile

PWA e service workers precisam de HTTPS, salvo exceções de localhost. Abrir `http://IP-DA-LAN:3107` em um telefone não prova funcionamento de service worker. Validar instalação/offline em uma implantação HTTPS ou em um túnel autorizado, com dados demonstrativos. O fallback offline é público; não mantém uma sessão autenticada após recarregamento sem revalidação.

No aplicativo Production, viewport emulada 375 × 812 apresentou largura do documento 369 diante de largura interna 375, sem overflow horizontal. Captura em `docs/evidence/17-vercel-mobile-375.png`. Essa prova de responsividade não substitui telefone físico, teclado real, instalação de PWA ou embalagem nativa.
