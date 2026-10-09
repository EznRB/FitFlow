# Banco remoto do FitFlow na Vercel

Pesquisa e decisão: **08/10/2026**; estado atualizado em **09/10/2026**. Este documento registra a implantação, as verificações obtidas e os critérios restantes. Uma migração preparada ou um teste local não comprova o funcionamento publicado.

## Decisão

Usar **Neon Postgres, plano Free**, em **São Paulo**, com credencial de execução destinada à Vercel. O recurso já foi criado na conta autenticada pelo MCP oficial Neon. O backend continua Node.js, com Prisma **6.19.3** e a autenticação atual do FitFlow. Neon Auth não foi configurado; permanecem os contratos de usuários, hashes de senha, papéis e controles de acesso existentes.

A escolha combina Postgres com transações e constraints, pooling para funções Vercel, gerenciamento por API/CLI/MCP e região próxima do público brasileiro. É uma decisão para a arquitetura e o estágio atual do FitFlow, não uma afirmação de que um fornecedor seja superior em qualquer projeto. O histórico MySQL requer conversão explícita antes de usar Postgres. [Engine oficial do Neon](https://github.com/neondatabase/neon), [pooling](https://neon.com/docs/connect/connection-pooling), [regiões oficiais](https://github.com/neondatabase/website/blob/main/content/docs/introduction/regions.md).

O código do engine Neon é Apache 2.0. **Open source não significa hospedagem sem limites**: o serviço Free tem quotas e condições próprias; hospedar o engine por conta própria exigiria outra infraestrutura. Não se instala um servidor de banco dentro de uma função Vercel. [Repositório e licença](https://github.com/neondatabase/neon), [preços do serviço](https://neon.com/pricing).

## Estado verificado em 09/10/2026

- Vercel CLI **63.1.0** autenticado como `eznrb`, com destino `eznrbs-projects`; checkout vinculado ao projeto existente `fit-flow`.
- O diagnóstico da publicação antiga identificou MySQL Aiven com host `ENOTFOUND` e login HTTP 500. A resposta 200 do health check antigo não verificava a conexão com o banco. A publicação foi substituída pela implantação Neon e o login no domínio final foi validado.
- O MCP oficial Neon passou a responder com autenticação. Foi criado o projeto **FitFlow**, ID `mute-night-99440749`, PostgreSQL **17**, região **`aws-sa-east-1` (São Paulo)**. A descrição do recurso confirmou a assinatura **`free_v3`**, limite lógico de 1 GB e compute mínimo/máximo de 0,25 CU.
- Branch principal **`production`**, ID `br-tiny-king-b6carztp`: baseline PostgreSQL aplicada. Demonstração preparada com cinco contas, três alunos, duas fichas e 798 exercícios. Senhas remotas novas e individuais ficam em `server/.demo-credentials.remote.local.json`, ignorado; não foram copiados históricos de QA. Não houve recuperação dos dados Aiven.
- Branch isolada **`verification`**, ID `br-restless-cell-b61mst0r`: baseline aplicada e três gates reais aprovados usando **TLS e URL pooled**: autenticação, contratos centrais e quota concorrente. Fixtures próprias foram removidas pelos testes.
- Criado o papel SQL **`fitflow_app`**, sem `CREATEDB`, `CREATEROLE`, `BYPASSRLS` ou associação a `neon_superuser`. As permissões estão versionadas em `server/prisma/postgresql/runtime-privileges.sql`; logs e séries recebem somente `SELECT`/`INSERT`. O teste real `check-neon-runtime.cjs` passou: leitura, inserção e atualização em transação revertida; DDL, atualização de séries e exclusão de logs, pagamentos e usuários foram negados com SQLSTATE `42501`.
- Arquivos privados ignorados: `server/.env.remote.local` para administração, `server/.env.remote.verify.local` para verificação e `server/.env.remote.runtime.local` para execução. Preview e Production receberam somente a credencial runtime, com variáveis sensíveis do tipo Secret; JWT de produção é independente do Preview. Valores não são publicados neste documento.
- [Preview HTTPS](https://fit-flow-aii93048s-eznrbs-projects.vercel.app) em estado READY, função em `gru1`, Node **24.x** e Client PostgreSQL Prisma 6.19.3 gerado no build Linux. O gate HTTPS passou para health com banco pronto, login/me dos três perfis, cookie Secure/HttpOnly/SameSite=Lax, autorização, catálogo, painel do aluno, CSRF e logout. O Preview tem proteção de acesso; o gate usa autenticação autorizada sem divulgar token.
- [Production](https://fit-flow-indol.vercel.app): alias final aponta ao deployment READY `dpl_9TiPE1WdMZaCyhy1WtsX6H93rPiy`, revisão `24e77b4`, Node 24.x, função `gru1` e Client PostgreSQL Prisma 6.19.3 gerado no Linux. Gestão HTTPS passou após o deploy, incluindo replay manual sem duplicação, conflito 409 e sessão divergente 403. Navegador restaurou conta admin e confirmou modal com data brasileira correta e distinção de cobrança, captura 23; formulário não submetido. [CI da revisão](https://github.com/EznRB/FitFlow/actions/runs/37991180996) aprovada. [PR draft](https://github.com/EznRB/FitFlow/pull/1); nenhum merge.
- No navegador do domínio final, aluno entrou com cookie HttpOnly real e permaneceu autenticado após recarga. Uma sessão demonstrativa, identificada como teste acadêmico de persistência, recebeu uma série de trabalho **20 kg × 8, RIR 2**, foi finalizada e reapareceu após recarga/reabertura do histórico, com **uma série e 160 kg·reps**.
- Gate HTTPS de gestão repetido após `24e77b4`: três logins, CRUD de planos/matrículas, permissões, nutrição com consentimento/JSONB/isolamento/exclusão própria, presença com duplicidade/ownership/cancelamento auditado, duas renovações manuais concorrentes de sete dias e replay sem terceiro registro. Fixtures UUID próprias removidas: quatro usuários, dois alunos, um plano, dois pagamentos e dois check-ins. Quotas reais preservadas. Navegador salvou/restaurou nutrição fictícia em revisão anterior, exigindo nova confirmação de escopo; captura 20.
- Migration aditiva `20261009_manual_payment_idempotency` aplicada em ambas as branches Neon e nos bancos nativos, preservando baseline e registros anteriores. UUID único, hash da intenção e ator permitem replay sem nova renovação; CHECK garante par completo e ator. Totais: cinco migrations MySQL, duas PostgreSQL e onze CHECKs PostgreSQL. Gates manuais nativos e core da branch Neon de verificação passaram.
- Um papel criado pela API, `fitflow_runtime`, revelou permissões administrativas e não foi usado no deploy. **Foi removido pelo MCP Neon após autorização explícita do usuário.** A listagem da branch principal confirmou somente `fitflow_app` e `fitflow_owner`; não há pendência de remoção desse papel.
- A tentativa pela integração Marketplace ainda retornou `integration_terms_acceptance_required`. O acesso direto autorizado pelo MCP permitiu criar o recurso sem depender desse fluxo; **não é necessário repetir o aceite para continuar a configuração atual**.
- Instalações Supabase/Stripe de outros projetos permanecem separadas.

**Login, treino e nutrição persistidos foram verificados no domínio final com Neon.** Usar credenciais novas do arquivo privado; as antigas do GitHub e os dados Aiven não foram recuperados. Suíte integral `24e77b4`: 233 aprovados, zero falhas/ignorados; revisão final focada 26/26. Lançamento manual idempotente publicado e validado em HTTPS registra recebimento informado pelo administrador; não cobra nem valida Pix/cartão. IA, provedor sandbox, telefone físico, reconexão publicada e revisão final têm gates pendentes. Credenciais não devem ser enviadas no chat.

## Comparação atual dos fornecedores

| Fornecedor | Plano e limites relevantes | Região e operação | Decisão para este projeto |
|---|---|---|---|
| **Neon Postgres** | Free permanente, sem cartão: 1 GB de banco por projeto, 100 CU-h de compute por projeto/mês, 5 GB de transferência por projeto; limite de 20 GB de banco agregado na conta. | São Paulo disponível. Pooler, API, CLI e MCP oficiais. | Escolhido para banco novo e integração Vercel. |
| **Supabase Postgres** | Free: 500 MB de banco por projeto, até dois projetos ativos e pausa após uma semana sem atividade. | São Paulo, pooler e ecossistema Auth/Storage/API/MCP. | Alternativa válida; o pacote de serviços não é necessário para restaurar a autenticação atual. Recursos de outras aplicações permanecem separados. |
| **Aiven MySQL** | Free sem prazo e sem cartão: 1 CPU, 1 GB RAM, 1 GB disco e 76 conexões. | Free não permite escolher nuvem/região nem oferece pooling gerenciado. Pode suspender por inatividade. API e CLI disponíveis. | Menor alteração de engine, porém menos adequado à opção escolhida de pooling e região. |
| **TiDB Cloud Starter** | Até cinco instâncias gratuitas, cada uma com 5 GiB row storage, 5 GiB columnar storage e 50 milhões RUs/mês. | MySQL compatível; regiões Starter documentadas nos EUA, Europa e Ásia. Driver HTTP Preview, transações interativas experimentais. | Não substituir diretamente o banco atual: `SERIALIZABLE` não é suportado e CHECK está desabilitado por padrão. |
| **PlanetScale Postgres** | Página atual oferece single node a partir de US$ 5/mês, sem Free listado. | São Paulo consta na plataforma; API, CLI e MCP hospedado. Disponibilidade do SKU deve ser confirmada. | Alternativa paga; não necessária para esta entrega. |

Fontes primárias dos planos: [Neon](https://neon.com/pricing), [Supabase](https://supabase.com/pricing), [Aiven Free](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [Aiven preços](https://aiven.io/pricing/mysql), [TiDB planos](https://docs.pingcap.com/tidbcloud/select-cluster-tier/), [PlanetScale](https://planetscale.com/pricing). Regiões: [Neon](https://github.com/neondatabase/website/blob/main/content/docs/introduction/regions.md), [Supabase](https://supabase.com/docs/guides/platform/regions), [TiDB CLI oficial](https://github.com/tidbcloud/ti-cli), [PlanetScale](https://planetscale.com/docs/plans/regions).

O anúncio Neon de **02/10/2026** aumentou o armazenamento Free de 0,5 GB para 1 GB por projeto. Fontes antigas não representam esse limite atual. O site comercial TiDB soma a quota dos cinco recursos na organização; não interpretar 25 GiB/250 milhões RUs como benefício de cada instância. [Anúncio Neon](https://neon.com/blog/neon-free-plan-1-gb-per-project), [limites TiDB por instância](https://docs.pingcap.com/tidbcloud/serverless-faqs/?plan=starter).

As diferenças TiDB afetam o código concreto: os repositórios de fichas e sessões usam transações `Serializable`, e as migrations aplicam CHECK para séries, quotas e intenções de pagamento. Não reduzir essas garantias apenas para trocar o fornecedor. [Isolamento TiDB](https://github.com/pingcap/docs/blob/master/sql-statements/sql-statement-set-transaction.md), [CHECK TiDB](https://docs.pingcap.com/tidb/stable/constraints/), [driver TiDB](https://docs.pingcap.com/developer/serverless-driver/).

## Arquitetura de conexão

```text
Navegador / PWA
       │ HTTPS, cookie de sessão
       ▼
API FitFlow na Vercel — Node.js 24.x, região São Paulo
       │ Prisma 6.19.3 / TCP + TLS / DATABASE_URL pooled
       ▼
Pooler Neon — Postgres São Paulo

Migrações e administração controlada
       │ DIRECT_URL sem pooler, TCP + TLS
       ▼
Postgres Neon — baseline própria
```

O runtime usa `DATABASE_URL` com hostname `-pooler`; migrations usam `DIRECT_URL`, sem esse sufixo. Os nomes de variáveis produzidos pela integração devem ser conferidos e mapeados sem imprimir os valores. No Prisma 6, a configuração esperada é:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Essa configuração foi aplicada ao schema separado, validada no Neon e publicada no Preview e em Production Vercel. O build Linux gerou o Client PostgreSQL correto. Manter CLI e Client na mesma versão 6.19.3 durante a migração; não atualizar a versão major do ORM simultaneamente. [Guia Prisma/Neon, incluindo Prisma 6](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md).

Reutilizar o PrismaClient por instância aquecida, limitar seu pool inicialmente e configurar timeouts finitos que tolerem a ativação do compute. As transações devem terminar rapidamente. O limite anunciado de 10.000 conexões do PgBouncer é de clientes aceitos, não de 10.000 transações em execução. [Conexões Neon](https://neon.com/docs/connect/connection-pooling).

Usar TLS com validação do servidor; não desabilitar verificação de certificado para contornar erros. A URL pooled é destinada ao tráfego da API; a direta atende migrations, exportação e operações que dependem de sessão persistente. Uma versão futura com driver Neon HTTP exigiria cuidado adicional: `neon()` cobre consultas/transações não interativas; transações interativas precisam de TCP ou WebSocket/adapter apropriado. A decisão atual conserva TCP. [Driver oficial](https://neon.com/docs/serverless/serverless-driver).

## Migração de dados e integridade

### Baseline PostgreSQL separada

Preservar as migrations MySQL como histórico do ambiente antigo. Preparar schema e baseline PostgreSQL em localização separada, com comandos e configuração explícitos. Não modificar uma migration MySQL aplicada, não executá-la no Postgres e não reutilizar `_prisma_migrations` do MySQL como histórico do novo provider.

Antes da importação, identificar a origem acessível, exportar uma cópia e registrar contagem por tabela. O banco Aiven antigo não está disponível; importar dados locais demonstrativos, se escolhido, não recupera dados daquele serviço. A aplicação publicada deve informar quando usar dados demonstrativos.

### Contratos que precisam sobreviver

- **IDs e relacionamentos:** preservar IDs inteiros e IDs de sessões/séries/intentos. Depois de importar IDs explícitos, ajustar sequences para que o próximo registro não colida. Não recriar IDs e quebrar a fila mobile pendente.
- **Credenciais:** preservar exatamente `password_hash`, papéis e atividade das contas importadas. Não substituir hashes por senhas padrão. O primeiro administrador de uma base vazia deve vir do bootstrap controlado.
- **Datas civis:** nascimento, presença, pagamento, vencimento e vigência continuam `DATE`, sem conversão para o dia anterior no Brasil. O Prisma representa essas datas em meia-noite UTC; a semântica continua de calendário.
- **Instantes:** criação, atualização, execução de série, conclusão e conciliação preservam o instante UTC. Mapear o tipo Postgres e testar a serialização do Prisma; agrupamento operacional permanece `America/Sao_Paulo`. Não atribuir novamente UTC a um valor já convertido.
- **TIME legado:** preservar o valor, sem inferir um instante histórico. O horário confiável continua derivado de `createdAt`. Ver [contrato de datas do projeto](DATAS_E_FUSO.md).
- **Decimais e JSON:** manter precisão decimal de dinheiro e carga. JSON vira JSONB sem trocar número por string, `null` por ausência ou alterar payloads usados em idempotência. Comparar o conteúdo sem depender da ordem das chaves JSONB.
- **Unicidade:** conferir email normalizado, CPF, aluno/data, identidade de catálogo, UUIDs e identificadores do provedor. A collation MySQL e a comparação Postgres não têm automaticamente a mesma semântica de maiúsculas/minúsculas.
- **Histórico:** preservar fichas arquivadas, snapshots, séries, pagamentos, cancelamentos e vínculos. Dados antigos não devem desaparecer porque não fazem mais parte da ficha ativa.

### Onze CHECK constraints obrigatórias

Confirmar os onze contratos abaixo no catálogo Postgres e testar que valores inválidos são rejeitados pelo banco, inclusive fora da API:

| Tabela | Constraint / contrato |
|---|---|
| `workout_sessions` | `status` em `active`, `completed`. |
| `workout_sets` | `kind` em `working`, `warmup`. |
| `workout_sets` | `weight_kg` entre 0 e 2000. |
| `workout_sets` | `reps` entre 1 e 1000. |
| `workout_sets` | `rir` nulo ou entre 0 e 10. |
| `rate_limit_buckets` | `hits` maior ou igual a zero. |
| `payment_intents` | `state` em `created`, `creating`, `pending`, `uncertain`, `paid`, `review`. |
| `payment_intents` | `amount` maior que zero. |
| `payment_intents` | `duration_days` entre 1 e 3650. |
| `payment_intents` | `currency` igual a `BRL`. |
| `payments` | `manual_request_id` e `manual_request_hash` ambos nulos (legado) ou ambos preenchidos com `registered_by` presente. |

### SQL e concorrência

Portar quotas de `ON DUPLICATE KEY UPDATE`, `IF`, `UTC_TIMESTAMP`, `TIMESTAMPADD` e `TIMESTAMPDIFF` para uma operação Postgres atômica, com `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`. Calcular a janela com relógio do banco, preservar chave HMAC, saturação do contador e limpeza controlada. Não fazer leitura e incremento separados que percam atualizações em duas funções Vercel concorrentes.

Preservar o lock da linha do aluno na renovação financeira e o lock da sessão ao registrar/concluir séries. Manter a mesma ordem de locks, constraints únicas e transações `Serializable` onde aplicáveis. Adaptar o reconhecimento de conflito/serialização e retries limitados às respostas reais Postgres/Prisma. Não repetir chamadas externas de cobrança só porque uma transação SQL foi repetida.

## Segredos e ferramentas autônomas

`DATABASE_URL`, `DIRECT_URL`, segredo JWT, chaves dos provedores e tokens de gerenciamento ficam somente no servidor/armazenamento de segredos autorizado. O frontend chama `/api`; não recebe usuário SQL, URL com senha ou chave administrativa. Evitar segredos em logs, capturas, fixtures versionadas e descrições de PR.

Separar usuário SQL de execução, com permissões necessárias à API, do usuário responsável por migrations. Tokens de gerenciamento não são a credencial de runtime. O MCP é ferramenta de desenvolvimento/inspeção, não dependência da API publicada. [API Neon](https://neon.com/docs/reference/api-reference), [MCP oficial](https://github.com/neondatabase/mcp-server-neon), [conexão e autenticação MCP](https://neon.com/docs/ai/connect-mcp-clients-to-neon).

Uma conta autorizada permite automatizar criação, branches, schema, consultas e configuração. O recurso deve pertencer à conta do usuário. Não usar **Claimable Neon** como banco definitivo: sem reivindicação ele expira em 72 horas e a transferência revoga credenciais anteriores. [Referência Claimable](https://neon.com/docs/reference/claimable-neon).

## Etapas e critérios de liberação

1. **Autorizar o acesso:** concluído pelo MCP oficial autenticado; recurso dedicado FitFlow, plano Free e região São Paulo confirmados. Neon Auth não foi configurado. A integração Marketplace é opcional para o caminho atual.
2. **Preparar Postgres:** baseline e SQL portado concluídos; onze CHECKs, FKs, índices, unicidade e permissões conferidos. Migrations futuras precisam de revisão independente, sem editar baseline aplicada.
3. **Provisionar e conectar:** concluído com DNS/TLS, pooled/direta, região e plano conferidos. Somente recurso FitFlow associado ao aplicativo.
4. **Aplicar e preparar dados:** baseline nas duas branches; demonstração nova sem importação do Aiven indisponível. IDs, hashes, datas, JSONB e contagens verificados por gates e seed restrito.
5. **Executar testes de banco real:** gates aprovados para séries/conclusão, renovação, conciliação com provedor simulado, quotas, presença e datas. Fixtures próprias/branch isolada; nenhuma limpeza de tabela inteira.
6. **Configurar Vercel:** concluído em Preview/Production, Node 24.x/`gru1`, runtime SQL limitado, JWT independente, CORS exato/cookie HTTPS e Client PostgreSQL gerado no Linux.
7. **Validar publicação:** Preview aprovado em login/papéis/catálogo/painel/CSRF/logout. Production também passou em gestão, nutrição, presença e persistência. Reconexão da fila no domínio publicado permanece pendente.
8. **Validar disponibilidade:** primeira conexão após suspensão do compute, erro de banco tratado sem detalhes internos, nova chamada em instância aquecida e contagem de conexões. Registrar resultados e duração medida, sem prometer ausência de latência.
9. **Publicar e conferir Production:** `24e77b4` READY, gestão/nutrição/presença/replay manual aprovados após deploy; navegador restaurou admin e confirmou modal. Somente migrations revisadas devem ser aplicadas. Provedor sandbox/IA reais e telefone físico continuam pendentes.
10. **Registrar e acompanhar:** evidências e versões em STATUS_ENTREGA. Login recuperado com prova publicada; manter recuperação compatível com o mesmo schema Postgres. Aiven indisponível não é rollback funcional.

## Limites operacionais do Free

O serviço prevê suspensão do compute e ativação por conexão, além de limites de compute, transferência e armazenamento. No recurso criado, a API reportou `suspend_timeout_seconds: 0`; a tentativa de configurar 300 segundos foi recusada pelo plano. **Não foi comprovado o intervalo efetivo de suspensão deste endpoint.** Exceder quotas pode restringir o serviço, exigindo timeouts e observabilidade, sem jobs artificiais para tentar evitar limites. Upgrade para plano pago seria outra decisão do usuário. [Condições e limites Neon](https://neon.com/pricing).

## Implementação e gates de banco real

Schema e migrations próprios em `server/prisma/postgresql/`, com 14 models, 4 enums e onze CHECKs. Baseline original com dez CHECKs preservada; a migration aditiva de 09/10 introduziu a constraint de recebimento manual. `prisma.config.ts` seleciona schema/migrations pelo protocolo e provider; `DIRECT_URL` aceita o alias `DATABASE_URL_UNPOOLED` da integração. Runtime usa Client gerado separado. CLI e Client 6.19.3. Bootstrap PostgreSQL exige confirmação de host/nome e arquivo privado.

Busca por aluno mantém comparação sem diferenciação de caixa no Postgres. Quota portável mantém UPSERT atômico e relógio compartilhado. Comparação de JSON ignora ordem de chaves; conflitos PostgreSQL de serialização/deadlock reconhecidos com no máximo três tentativas da transação inteira. Falhas de SQL, permissão e CHECK não recebem retry indiscriminado.

Para repetir os gates com os binários PostgreSQL Windows instalados, no diretório `server`:

```powershell
# init cria somente um destino novo; não sobrescreve um cluster existente.
node scripts/local-postgresql.cjs init
# Nas execuções seguintes:
node scripts/local-postgresql.cjs start
node scripts/with-postgresql-test-env.cjs node node_modules/prisma/build/index.js generate
node scripts/with-postgresql-test-env.cjs node node_modules/prisma/build/index.js migrate deploy
node scripts/with-postgresql-test-env.cjs node tests/quota-postgresql-local.integration.cjs
node scripts/with-postgresql-test-env.cjs node tests/postgresql-core-local.integration.cjs
node scripts/with-postgresql-test-env.cjs node tests/auth-postgresql-local.integration.cjs
```

O wrapper exige marker próprio e `127.0.0.1:5448/fitflow_pg_test`, substitui variáveis herdadas e não acessa bancos de outras aplicações. Os gates criam fixtures identificados por UUID e removem somente esses registros. Não usam o banco antigo nem credenciais de provedores. Os três gates passaram no cluster nativo PostgreSQL 17.10 e na branch remota de verificação.

Para repetir os gates remotos, somente com o arquivo privado de verificação disponível, no diretório `server`:

```powershell
node scripts/with-neon-verification-env.cjs node tests/postgresql-core-local.integration.cjs
node scripts/with-neon-verification-env.cjs node tests/auth-postgresql-local.integration.cjs
node scripts/with-neon-verification-env.cjs node tests/quota-postgresql-local.integration.cjs
```

Apesar do nome histórico `local` dos testes, o wrapper e o guard compartilhado aceitam exclusivamente a branch Neon de verificação identificada, com hostname, projeto, banco e TLS conferidos. Recusam a branch principal e URLs arbitrárias. A URL de banco herdada pelo sistema operacional não deve ser usada.

Verificações remotas cobriram JSONB/idempotência, concorrência de séries/conclusão, DATE/TIME/TIMESTAMPTZ, renovação, conciliação única com provedor simulado, onze CHECKs, bootstrap sem reset, perfis, bloqueio e quota compartilhada. Core atualizado passou na branch de verificação para replay manual, ator divergente 409 e consulta não autorizada 404. Testes HTTP de banco enviam cookie manualmente; gate HTTPS de gestão e navegador publicados complementam essa prova. Telefone físico não testado.

No diretório `server`, os gates adicionais utilizam somente arquivos privados ignorados:

```powershell
node scripts/check-neon-runtime.cjs
node scripts/check-hosted-fitflow.cjs https://fit-flow-aii93048s-eznrbs-projects.vercel.app/
node scripts/check-hosted-fitflow.cjs https://fit-flow-indol.vercel.app/
```

O teste runtime usa transações revertidas para suas operações sintéticas. O gate hospedado realiza login/logout e leituras com contas demonstrativas. `.vercelignore` exclui segredos, bancos nativos, testes e documentação do pacote de deploy.

`server/scripts/check-private-files.cjs` passou para os candidatos de publicação contra segredos locais conhecidos. Não cobre todo o histórico Git nem segredos desconhecidos; não representa auditoria completa de vazamentos.

Migrations e administração usam `with-neon-owner-env.cjs`, restrito ao projeto/branch principal conhecidos e a `fitflow_owner`. Não usar owner no runtime. Gates PostgreSQL gerais recusam a produção. Existe somente a exceção explícita `node tests/hosted-management.integration.cjs --execute-hosted-fixtures`: constructor privado guardado, colisões verificadas antes da escrita, owner prepara/limpa UUIDs próprios e fluxos usam HTTPS; três logins, sem reset de quotas. Não permite destino arbitrário nem limpeza abrangente. [Receita e limites](DESENVOLVIMENTO.md).

As evidências estão em [STATUS_ENTREGA.md](STATUS_ENTREGA.md). Preview e fluxos publicados registrados passaram; dados antigos não foram recuperados. A meta completa continua ativa.
