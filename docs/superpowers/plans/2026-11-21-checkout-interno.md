# Checkout interno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Aluno autenticado paga cartão/Pix no FitFlow com Payment Brick e renovação confirmada pelo servidor.
**Architecture:** Preservar intenções e conciliação existentes, separar preparação de compra e envio do pagamento. Recuperar intenção aberta por aluno sob trava transacional; persistir tentativas de cobrança com idempotência própria e impedir competição com preferências legadas.
**Tech Stack:** Express CommonJS, Prisma MySQL/PostgreSQL, JavaScript vanilla, MercadoPago.js v2, node:test.
**Spec:** docs/superpowers/specs/2026-11-21-checkout-interno-design.md (aprovada).

## Global Constraints

- Payment Brick `payment`, Payments API `/v1/payments`, cartão e Pix; testes somente.
- Credenciais privadas no backend, configuração pública autenticada sem cache, nenhuma persistência/log de token de cartão.
- Valor, duração, vendedor, referência e metadados controlados pelo servidor; manter HMAC e renovação transacional única.
- Intenções pendentes/incertas recuperadas após reload; preferências legadas ainda pagáveis bloqueiam outra cobrança.
- Preservar alterações de outros trabalhos e publicar somente escopo do checkout.

## Review Focus

- Dois envios simultâneos com novas chaves: apenas uma tentativa alcança o provedor (Task 2).
- Timeout após criação remota: tentativa permanece incerta e bloqueia nova cobrança (Task 2).
- Link legado aberto: não iniciar pagamento interno sem resolução confirmada (Task 2).
- Logout/navegação durante SDK/callback: desmontar e impedir envio na nova sessão (Task 3).
- Chave/SDK ausente ou CSP bloqueada: orientação visível, sem formulário inoperante (Task 3).

### Task 1: Contrato Payments API

Files: criar `server/src/services/mercado-pago-payment.js`, `server/tests/mercado-pago-payment.test.cjs`; modificar adaptador e configuração de checkout.
Interfaces: `validateBrickSubmission(data)` retorna payload estrito cartão/Pix; `createPayment(intent, submission, attemptId)` retorna recurso confirmado pelo provedor. `publicConfig()` fornece somente chave pública e ambiente. Adaptador mantém consultas de pagamentos e preferências legadas.

- [x] Testes que recusam preço/vendedor/referência adulterados, dados crus de cartão, métodos fora de Pix/cartão, parcelas inválidas e payload incompleto; testar request com valor do intent, idempotência e headers privados, sem logs.
- [x] Executar testes e observar falha por contrato ausente.
- [x] Implementar validador e mapeamento mínimo da Payments API com token efêmero e referência/metadados do intent.
- [x] Verificar testes; nenhuma chamada remota de cobrança nesta etapa. Suíte: 900 aprovados, 1 ignorado em 21/11. Configuração pública retorna somente chave pública, e-mail de teste e ambiente; não altera habilitação do legado.

### Task 2: Persistência e rotas de checkout interno

Files: schemas/migrações MySQL e PostgreSQL, repositório/service/rotas de checkout, contrato provider e testes focados/integrados.
Interfaces: `prepare(userId,{planId})` recupera/cria intenção sob trava de aluno; `submit(userId,intentId,{attemptKey,brick})` obtém tentativa única e cria pagamento; `get` retorna estado reconciliado e dados seguros para Status Screen. `GET /checkout/config`, `POST /checkout/purchases`, `POST /checkout/intents/:id/payments` autenticados.

- [x] Testes falhando para ownership, concorrência/chaves diferentes, timeout, reenvio, recusa terminal com nova tentativa, legado pendente e webhook repetido.
- [x] Modelo de tentativa durável, chave/ID de pagamento únicos, estado sem token; migrações em ambos provedores. Guarda de compra aberta no servidor, não só no navegador.
- [x] Implementar serviço e rotas com amount do snapshot e conciliação existente, sem criar preferência na preparação. Legados permanecem consultáveis e bloqueiam nova cobrança quando não resolvidos.
- [x] Verificar contrato oficial de expiração/consulta de preferências; sem confirmação externa, nunca supor cancelamento. Suporte de continuidade do legado na interface.
- [x] Executar testes focados e integração de concorrência em banco gerenciado.

### Task 3: Tela dedicada e SDK

Files: novo `client/js/views/checkout.js`, ligação de navegação em app e mensalidade, código legado de checkout, CSS, index, CSP Express/Vercel, testes de UI.
Interfaces: `CheckoutView.render(container)` monta preparação/plano/total e Payment Brick; `destroy()` desmonta ambos Bricks, cancela polling e invalida callbacks. `onSubmit({selectedPaymentMethod,formData})` aguarda rota de Task 2. Status Screen usa paymentId; Pix mantém QR/copia e cola.

- [x] Testes falhando para navegação, cleanup, callbacks obsoletos, total servidor, falha SDK/chave e envio duplicado.
- [x] Tela dedicada autenticada na navegação existente, sem modal de cobrança; estados loading/processing/success/error/pending e resumo BRL.
- [x] Carregar SDK oficial e chave via config; restringir métodos a cartão/Pix e uma parcela. Usar Status Screen para resultado/3DS, polling limitado e consulta manual.
- [x] Ajustar CSP somente origens oficiais verificadas; executar testes UI e validador oficial `validate-bricks-integration.mjs . payment`.

### Task 4: Verificação e publicação

Files: documentação de pagamentos, env example, relatórios privados de execução.
- [x] Confirmar par de chave pública/token de teste, preservando credenciais existentes; preparar configuração privada sem expor valores.
- [x] Executar suíte completa uma vez após mudanças e checks de migração, validador oficial e revisão de diff.
- [x] Revisão independente de segurança/concorrência; corrigir achados e repetir somente checks afetados.
- [x] Publicação isolada do escopo aprovado e verificação autenticada do app/config/preparação. Testes visuais desktop/mobile.
- [x] Executar testes de cartão/Pix somente no ambiente de teste com autorização aplicável, distinguir simulação de compra externa; comprovar webhook e renovação única ou relatar gate específico pendente.

## Checkpoint 21/11 — publicação e teste externo

- Publicado artefato isolado em `https://fit-flow-indol.vercel.app`, deployment `dpl_32PBYwU5hkvpMsCZkJtETnpgHvjX`. Preservadas alterações locais alheias ao checkout e versão publicada do dashboard.
- Login e configuração autenticados aprovados no deployment de preparação. Navegação e preparação interna verificadas no domínio público.
- Teste no navegador detectou `paymentType` adicional no callback do SDK; adaptação explícita corrigida com regressão RED→GREEN. Cartão Mastercard atualizado na documentação oficial: guia instalado tinha número antigo.
- Pix externo executado com idempotência durável: provedor retornou HTTP 401, causa 7, `Unauthorized use of live credentials`. Nenhum pagamento criado/nenhum plano renovado. Tentativa incerta preservada, sem liberar outra cobrança.
- MCP fornece apenas APP_USR do vendedor automático, incompatível com teste de cartão/Pix no Bricks segundo documentação específica. Painel requer verificação pessoal por SMS/WhatsApp; solicitada ao proprietário. Não considerar gate externo concluído.
- Próximo passo: após login, obter par de credenciais de teste próprio do Bricks e adaptar identificação de vendedor/e-mail à documentação desse produto, mantendo compatibilidade com preferências legadas e bloqueio de cobrança real. Reexecutar cartão/Pix e confirmar webhook/renovação única.

## Checkpoint atualizado — credenciais e pagamentos externos

- Aplicação existente alterada via painel de CheckoutPro/Orders para CheckoutTransparente/Payments. Par TEST correto importado pelo proprietário e validado; novo provedor separado preserva credenciais e collector legados.
- Último deployment: dpl_8DZUtGJBRE55Wf6W4ZS3WhPfFaVU.
- Cartões APRO/OTHE/CONT e Pix executados externamente em sandbox. APRO gerou exatamente 1 lançamento/1 renovação; os demais 0/0. Nova tentativa após recusa comprovada.
- Suíte: 913 aprovados,1 ignorado,0 falhas. Validador oficial aprovado.
- Simulador oficial e POST autoassinado retornam200, sem duplicar renovação. Eventos automáticos continuam401 por HMAC divergente apesar de layout válido e segredo do modo teste confirmado. Probe sem notification_url também falhou; não alterar payload com base nessa hipótese.
- FAQ oficial51017 orienta usar segredo de produção; próximo passo conferir segredo do modo produção no painel. Sessão expirou, proprietário solicitado a validar novamente. Não enfraquecer HMAC, não marcar objetivo concluído.

## Conclusão verificada — 21/11

- Segredos de assinatura teste/produção comprovadamente distintos. MP_BRICKS_WEBHOOK_SECRET usa o segredo indicado pela FAQ oficial51017; tokens de pagamento permanecem TEST. Simulador/legado conserva segredo anterior. Revisão pontual não encontrou falha no fallback HMAC/ownership.
- Nova entrega automática Pix1355967163 retornou200 em439ms no histórico oficial. Falhas anteriores permanecem como evidência histórica.
- Deployment final dpl_2TGRvA8Ue7R4MLrFrATApJk58NNX publicado no domínio canônico. Suíte final916 aprovados,1 ignorado,0 falhas; validador oficial e diff check aprovados.
- Ledger conferido após notificações repetidas: aluno APRO com1 lançamento/1 renovação; recusas, cartões em processamento e Pixpendentes com0/0. Fluxos de cartão e QR/Copia e Cola Pix vistos no navegador; versão responsiva verificada.
- Não houve ativação de cobrança real. Valor do plano129,90 foi validado contra transaction_amount; diferença de taxa sandbox exibida pelo Status Screen registrada na documentação como observação para futura ativação real.
