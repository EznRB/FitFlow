# Sistema — plano de UX/UI, funcionamento e arquitetura

Plano histórico de 07/10/2026. Checklists e escolhas de ferramentas registram essa etapa; não são instruções obrigatórias atuais. Consulte [Estado atual](../../STATUS_ENTREGA.md) e [Plano mestre](../../PLANO_MESTRE_DESENVOLVIMENTO.md) para implementação e pendências posteriores.

> **Para execução:** aplicar `superpowers:executing-plans`, com testes de comportamento e revisão por etapa.

**Objetivo:** entregar jornadas completas, dados consistentes e histórico verificável.
**Arquitetura:** evolução incremental do Express/Prisma/MySQL. Não migrar toda a aplicação para outro framework na semana de entrega. Supabase/PostgreSQL é alternativa futura, exige migração de enum, Decimal, datas, autenticação e relações.
**Stack:** JavaScript SPA, Express, Prisma/MySQL; PWA/IndexedDB em fase posterior.
**Especificação:** `../specs/2026-10-07-fitflow-evolucao.md`.

## Restrições

Preservar tema Barlow/laranja/navy e alterações locais. Histórico append-only; unidades explícitas; banco é fonte canônica. Migrações primeiro em cópia com backup. Não usar mocks como prova de produção.

## Revisão prioritária

Sessão válida sem localStorage; matrícula bloqueada; pagamento antecipado; check-in cancelado e repetido; treino com histórico já registrado.

## Jornadas e aceite

| Jornada | Mudança | Prova de funcionamento |
|---|---|---|
| Login/sessão | /me restaura cookie, 401 encerra sessão, 403 mantém sessão, indisponibilidade tem mensagem correta | Recarga, aba nova, cookie expirado, API 503 |
| Gestor → matrícula | nome/plano/contato → revisão → confirmação; senha temporária individual e troca obrigatória | Dados inválidos, matrícula repetida, aluno inativo |
| Instrutor → ficha | disponibilidade → objetivo → catálogo/equipamentos → volume semanal → revisar/publicar versão | Papel instructor funciona; aluno não publica |
| Aluno → sessão | abrir ficha → registrar cada série → descanso → concluir → evolução | Carga/reps persistem; registros duplicados não duplicam volume |
| Nutrição | fórmula → dados/unidades → parâmetros → cálculo → método/fontes | Casos calculados manualmente; valores impossíveis rejeitados |
| Pagamento | cobrança → pendente → confirmação do provedor → renovar vigência | Webhook duplicado, assinatura inválida, estorno |
| Check-in | confirmar identidade → autorização → presença → cancelamento auditável | Outro aluno não pode ser alvo; reentrada após cancelamento |
| Relatórios | filtros/datas → indicador real → detalhes/exportação | Todos KPIs conferidos com registros; sem percentuais inventados |

## Tarefa 1 — recuperar base de entrega (bloqueante)

**Arquivos:** `server/src/config/env.js`, `server/prisma.config.ts`, `server/prisma/seed.js`, migrações, `server/src/app.js`, `client/js/api.js`, `client/js/auth.js`, README.

- [ ] Recuperar serviço Aiven ou criar banco substituto em ambiente de desenvolvimento; obter URL válida sem expor senha; alinhar `DATABASE_URL` e shadow DB.
- [ ] Inventariar tabelas reais antes de `migrate`; conciliar catálogo e Checkin ausentes na migração inicial. Não usar `db push` como histórico de migração.
- [ ] Separar liveness de readiness (`SELECT 1`): readiness retorna 503 quando banco falha, sem hostname/credenciais na resposta pública.
- [ ] Seed idempotente e credenciais demonstrativas somente no ambiente acadêmico; atualizar README com usuários realmente criados.
- [ ] Corrigir tratamento de HTTP/HTML e 403; configurar trust proxy com topologia verificada, nunca `true` indiscriminadamente.
- [ ] Aceite: login admin/aluno real + matrícula + ficha + carga + pagamento de teste + check-in + relatório sobrevivem à recarga.

## Tarefa 2 — segurança antes de publicar

**Arquivos:** auth routes/service/middleware, alunos.service, checkins.controller, pagamentos views/service.

- [ ] Remover escolha pública de role admin; restringir criação de administradores; testar signup adversarial.
- [ ] Revalidar usuário ativo/role no backend; sem fallback JWT em produção; revogar sessão após desativação.
- [ ] Convite/senha individual, nunca `fitflow123` compartilhada; fluxo de recuperação com token de uso único.
- [ ] StudentId do check-in derivado da sessão; autorização de objeto em cada recurso.
- [ ] Enum de meios de pagamento; escaping/DOM seguro; CSP compatível com scripts externos fixados.
- [ ] Revalidar os seis achados do relatório de segurança existente com testes próprios. Não confundir npm audit com vulnerabilidade explorável demonstrada.

## Tarefa 3 — UX/UI de todas as telas

**Arquivos:** tokens existentes, CSS components/pages, sidebar, views de alunos/planos/exercícios/treinos/pagamentos/checkins/relatórios/aluno.

- [ ] Usar mesmos tokens, espaçamentos, estados de botão e formulários; não reescrever `MASTER.md` automaticamente.
- [ ] Campo com label ligado ao input, erro ao lado do campo, loading sem remover contexto, vazio com próxima ação, falha com tentar novamente.
- [ ] Trocar KPIs percentuais fixos por cálculo documentado ou remover; usar “sem dados” para amostra insuficiente.
- [ ] Sidebar e modais por teclado, foco preservado, retorno de foco; menu aluno com Treino/Evolução/Nutrição/Presença/Mensalidade.
- [ ] Tabelas administrativas com filtros e paginação; cartões/resumo mobile; ações perigosas contextualizadas; busca de catálogo por músculo/equipamento/padrão.
- [ ] Construtor mobile em uma coluna; botões de mover acima/abaixo além de arrastar; mostrar volume semanal sem contar músculos secundários integralmente sem método definido.
- [ ] Aceite visual: 375, 768, 1440px, zoom 200%, teclado, contraste e redução de movimento. Testar com pessoa que não conhece o projeto.

## Tarefa 4 — consistência do domínio/banco

**Arquivos:** Prisma schema/migrations, treinos repository/service, pagamentos service, checkins service, relatorios controller.

- [ ] Treino publicado versionado: `WorkoutVersion` e exercícios imutáveis de cada versão; sessão aponta para versão, exercício aponta para identidade canônica do catálogo.
- [ ] Criar `WorkoutSession` (studentId, versionId, startedAt, endedAt, timezone) e `SetLog` (sessionId, exerciseId, setNumber, loadKg, reps, rir opcional, warmup, clientMutationId UNIQUE). Preservar WorkoutLog como legado; não inventar séries em backfill.
- [ ] Catálogo: `source`, `externalId`, `language`, `license`, `licenseAuthor`, `sourceUrl`, músculos primários/secundários e equipamentos relacionados. UNIQUE(source,externalId). Edição local protegida de overwrite do importador.
- [ ] Nutrição: `NutritionCalculation` com ownerUserId, formula/version, inputs, output, assumptions, timestamp e consentimento; índice owner/data; nenhuma associação por e-mail. Não armazenar perfil corporal sem necessidade.
- [ ] Pagamento: eventos imutáveis, providerPaymentId e idempotencyKey UNIQUE. Renovar a partir de max(vigência atual, data acordada), com regra explícita de troca de plano e estorno. Nunca aceitar confirmação de pagamento do browser.
- [ ] Datas de presença por `America/Sao_Paulo`, testes na meia-noite e virada do mês. Cancelamento e reentrada transacionais sem violar UNIQUE(aluno,dia).
- [ ] Relatório de inadimplência lê Student.phone; soma de receita distingue recebido, previsto e vencido.
- [ ] Migração expandir → preencher dados conhecidos → conferir → trocar leituras → retirar legado em outra release. Testar FK, rollback e dados históricos antes de produção.

## Tarefa 5 — Pix/cartão e mobile persistente

- [ ] Mercado Pago SDK Node oficial em modo teste; Checkout/Brick tokeniza cartão; segredo no servidor; webhook assinado e conferência via API do provedor. Pix pendente tem expiração; QR code não confirma pagamento.
- [ ] PWA com manifest/ícones, fallback offline e cache de arquivos públicos versionados. Nunca cachear login, pagamentos ou respostas autenticadas indiscriminadamente.
- [ ] Dexie/IndexedDB: fila por usuário, idempotência com clientMutationId, estados local/sincronizando/confirmado/falhou e conflitos visíveis. Apagar cache pessoal no logout; sessão inválida suspende envio.
- [ ] Testar treino em modo avião, queda durante envio, repetição, troca de conta e duas abas. Servidor confirma dados; dispositivo não decide acesso/mensalidade offline.
- [ ] Capacitor somente se APK/loja for requisito; não fornece persistência nem resolve API sozinho. Validar cookies/CSRF/CORS/deep links no app nativo.

## Sequência sugerida até a entrega

Dia 1 banco/login/migrações; dia 2 segurança e papéis; dia 3 ficha/logs/relatórios; dia 4 mobile e nutrição; dia 5 demonstração e documentação. Pagamento real, offline com escrita e migração de provedor ficam após a entrega se não forem requisitos do professor. Estimativa condicionada à recuperação do banco; não é promessa de prazo.
