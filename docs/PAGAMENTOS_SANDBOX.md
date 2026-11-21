# Pagamentos de teste — checkout interno

Revisão: 21 de novembro de 2026. O aluno paga cartão/Pix dentro do FitFlow com Payment Brick. A publicação permanece exclusivamente sandbox; não há cobrança real nem assinatura recorrente.

## Configuração

A aplicação FitFlow CRG foi ajustada no painel para Checkout Transparente / API de Payments. Credenciais TEST da conta real são necessárias para cartão/Pix; as credenciais APP_USR do vendedor fictício usadas pelo checkout hospedado não funcionam nesse fluxo. [Teste de Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-test/test-payment-flow).

As configurações estão separadas para preservar compras hospedadas ainda pagáveis:

| Variável | Uso |
| --- | --- |
| MP_SANDBOX_ENABLED | Habilitação explícita, string true. |
| MP_SANDBOX_PUBLIC_URL | Origem HTTPS canônica do FitFlow. |
| MP_SANDBOX_WEBHOOK_SECRET | Segredo HMAC do simulador/legado, nunca exposto ao cliente. |
| MP_BRICKS_WEBHOOK_SECRET | Segredo HMAC do modo produção exigido pelos eventos automáticos, inclusive pagamentos TEST. Não é um Access Token e não habilita cobrança real. |
| MP_BRICKS_TEST_ACCESS_TOKEN | Token TEST de Payments, somente backend. |
| MP_BRICKS_TEST_PUBLIC_KEY | Chave pública TEST correspondente, entregue ao aluno autenticado sem cache. |
| MP_BRICKS_TEST_SELLER_ID | Conta brasileira titular do token TEST, conferida por /users/me. |
| MP_BRICKS_TEST_BUYER_EMAIL | E-mail sintético distinto do titular e fora de @testuser.com. |
| MP_SANDBOX_ACCESS_TOKEN / MP_SANDBOX_SELLER_ID / MP_SANDBOX_BUYER_EMAIL | Provedor legado, usado para consultar e conciliar preferências anteriores. |
| MP_SANDBOX_PUBLIC_KEY | Compatibilidade com configuração anterior; não habilita o novo provedor Bricks. |

Após alterar variáveis da Vercel, é necessário um novo build. Arquivos privados de credenciais e relatórios ficam ignorados pelo Git e pela publicação.

## Fluxo e proteções

1. Mensalidade → Abrir checkout de teste → selecionar plano → Continuar para pagamento.
2. GET /api/checkout/config retorna somente configuração pública autenticada e sem cache. POST /api/checkout/purchases prepara ou recupera uma compra aberta, sem cobrar.
3. O SDK oficial coleta dados de cartão em campos seguros. POST /api/checkout/intents/:id/payments recebe token efêmero ou Pix; preço, duração, comprador de teste, vendedor e referência são fixados pelo servidor.
4. Cada tentativa tem chave durável e sequência, sem token persistido. Trava transacional do aluno impede duas cobranças concorrentes, inclusive com chaves diferentes. Estado incerto bloqueia nova tentativa até consulta ao provedor.
5. Status Screen mostra aprovação, recusa ou Pix com código/QR. Polling é limitado, com consulta manual. Logout/navegação desmontam os componentes e invalidam callbacks antigos.
6. Só a consulta autenticada à API do Mercado Pago confirma pagamento. O servidor verifica vendedor correspondente ao fluxo, valor, moeda, referência, metadados, ambiente de teste e aprovação integral antes da renovação transacional única.
7. Webhook exige HMAC-SHA256 e timestamp recente. Espaços HTTP e ordem dos componentes são aceitos; duplicatas, assinatura falsa e evento incompatível são recusados. Um retorno do navegador não confirma pagamento.
8. Preferência legada pendente mantém link de continuidade e bloqueia compra concorrente. Sem confirmação externa de encerramento, não se presume cancelamento.

## Evidências de 21/11

| Cenário externo | Resultado observado |
| --- | --- |
| Cartão APRO | Pagamento 1355967011 aprovado, live_mode=false; 1 lançamento e 1 renovação de 30 dias. |
| Cartão OTHE e novas tentativas após recusa | Recusas confirmadas; nenhum lançamento ou renovação. |
| Cartão CONT | Pagamento 1355967043 em processamento; nenhum lançamento ou renovação. |
| Pix | Pagamento 1355969133 pendente com código e abertura do QR no Status Screen; nenhum lançamento ou renovação. |
| Webhook do simulador oficial para pagamento aprovado | HTTP 200; repetição manteve apenas 1 lançamento e 1 renovação. |
| Webhook automático de pagamento | Pix 1355967163 entregue com HTTP 200 em 439 ms após configurar o segredo HMAC correto. |

A causa do 401 era a diferença entre o segredo do simulador (modo teste) e o segredo que assina eventos automáticos (modo produção). Ambos ficam configurados separadamente, com HMAC, timestamp recente, consulta autenticada ao provedor e validação financeira preservados. O histórico contém sete falhas anteriores à correção; a nova entrega automática foi confirmada pelo Mercado Pago. Referência: [Diagnóstico de x-signature](https://www.mercadopago.com.br/ajuda/51017).

O provedor retornou transaction_amount=129,90 no cartão e total_paid_amount=131,19, incluindo processing_fee de 1,29 no sandbox. O lançamento do plano usa o valor validado de 129,90. A eventual apresentação de encargos precisa ser conferida antes de qualquer ativação com dinheiro real.

Suíte completa mais recente: 916 testes aprovados, 1 ignorado, 0 falhas. Integrações de concorrência já aprovadas em MySQL e PostgreSQL; migração aditiva aplicada no banco publicado. Validador oficial de Payment Brick aprovado. Revisão independente cobriu concorrência, recuperação e separação dos provedores; achados corrigidos com regressões.

## Publicação verificada

Publicado em https://fit-flow-indol.vercel.app, deployment dpl_2TGRvA8Ue7R4MLrFrATApJk58NNX. Build isolado preservou modificações de outros trabalhos. Cartões, Pix, webhook automático, consulta repetida e renovação única foram verificados. A integração continua somente para testes; ativar cobranças reais exige outra etapa explícita de configuração e validação.


## Continuidade de 21/11 — recuperação da interface

O checkout publicado foi preservado no GitHub em `3cb9db8`, na branch de desenvolvimento/PR 2. A [CI dessa revisão](https://github.com/EznRB/FitFlow/actions/runs/44961541500) aprovou testes e validação/geração dos clientes Prisma. Isso não integra automaticamente a branch à main nem muda o artefato da Vercel indicado acima.

Uma revisão estática adicional identificou seleção de plano editável durante a preparação e ausência de nova tentativa após falha de carregamento do SDK. A correção bloqueia o seletor durante a requisição, restaura-o se não há compra criada e permite remontar o formulário da mesma compra sem novo POST de preparação. As duas regressões falharam antes (7 aprovadas/2 falhas) e passaram depois (9/9); logs locais `checkout-ui-recovery-red.log` e `checkout-ui-recovery-green.log`, ambos com exit codes preservados na rodada. Revisão independente do diff sem novos achados. São testes de interface em VM, sem SDK remoto, pagamento ou evidência visual nova. A correção passou na [CI de `07b5f74`](https://github.com/EznRB/FitFlow/actions/runs/44961730492) e foi publicada separadamente em `dpl_9Tn4sDYLQEvyYo7SEjiGrsfVokbD`, após READY, saúde/banco e SHA-256 do arquivo servido conferidos. Promoção concluída; o endereço público retornou HTTP 200, banco ready e arquivo idêntico. A fonte foi a cópia isolada anterior com apenas `client/js/views/checkout.js` substituído pela revisão corrigida. O restante das melhorias da PR 2 não foi publicado por essa promoção; a main ainda aguarda integração Git.
