# Pagamentos de teste — Mercado Pago e Vercel

Revisão: 10 de outubro de 2026. Este roteiro corresponde ao checkout **Preferences API** implementado no FitFlow. A configuração da conta ainda depende do proprietário; compras e notificações reais do sandbox não foram verificadas nesta etapa.

## Estado e critério de entrega

O projeto contém checkout hospedado, verificação de assinatura, conciliação no servidor e renovação idempotente. Os testes automatizados usam respostas controladas do provedor; o teste local do repositório utiliza banco real e respostas simuladas do Mercado Pago. Eles verificam a lógica do FitFlow, sem comprovar que a conta externa está configurada.

Para concluir a validação externa, obter evidências de cartão aprovado, cartão recusado, cartão pendente, entrega assinada de webhook e repetição sem duplicar renovação. Para Pix, o critério do sandbox de Checkout Pro é **geração das instruções/QR e estado pendente, sem liberar plano**: a documentação considera esse resultado esperado para meios offline. Uma simulação de Pix aprovado nos testes do FitFlow não comprova liquidação pelo Mercado Pago. [Compras de teste — Preferences API](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases).

## 1. Etapa do proprietário da conta

Concluir esta etapa quando o proprietário estiver disponível. Login, verificações de identidade, consentimentos e aceite de termos pertencem a ele.

1. Acessar [Mercado Pago Developers](https://www.mercadopago.com.br/developers/pt) e criar/configurar a aplicação para Checkout Pro.
2. Em **Suas integrações → aplicação → Contas de teste**, localizar o comprador e o vendedor de teste para Brasil. A documentação atual informa que a aplicação pode disponibilizar automaticamente o comprador; quando necessário, criar os dois tipos para o país correto. Guardar usuário, senha e códigos de verificação no armazenamento privado. [Introdução aos testes](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/introduction).
3. Obter o Access Token **de teste** e identificar o User ID do vendedor associado. A documentação atual da Preferences API usa também o prefixo `APP_USR` para token de teste; o prefixo sozinho não determina que uma credencial pode movimentar dinheiro real. [Configurar ambiente de desenvolvimento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-development-enviroment).
4. Configurar a notificação da mesma aplicação/conta usada pelo token. Selecionar o tópico **Pagamentos (`payment`)** e guardar a chave secreta do webhook. A URL criada na preferência tem prioridade sobre a URL do painel; as duas devem apontar para o destino previsto. Escolher o modo do painel correspondente à origem da credencial, conferindo a documentação e a conta de teste. [Configuração de Webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

Depois dessa preparação, informar apenas que a configuração privada está pronta. Não colocar tokens, senha do comprador ou chave secreta em mensagens, screenshots, README ou commits.

## 2. Variáveis usadas pelo código

Os nomes abaixo existem em `server/.env.example`. Valores privados devem entrar nas variáveis de ambiente do projeto FitFlow na Vercel; manter o checkout desativado até preencher e conferir todos os campos.

| Variável | Valor a configurar | Validação atual do FitFlow |
| --- | --- | --- |
| `MP_SANDBOX_ENABLED` | `true` após conferência | Somente a string exata `true` habilita a configuração. |
| `MP_SANDBOX_ACCESS_TOKEN` | Access Token da integração de teste | Aceita formato `APP_USR-…` ou `TEST-…`; consulta o titular antes de criar preferência. |
| `MP_SANDBOX_WEBHOOK_SECRET` | Chave da mesma aplicação que envia os eventos | Exige pelo menos 32 caracteres; usada somente no backend. |
| `MP_SANDBOX_SELLER_ID` | User ID numérico do vendedor de teste | Deve coincidir com `/users/me`, `collector_id` da preferência e do pagamento. |
| `MP_SANDBOX_BUYER_EMAIL` | E-mail do comprador de teste | Formato aceito: `test_user_…@testuser.com`; não usar e-mail de aluno real. |
| `MP_SANDBOX_PUBLIC_URL` | `https://fit-flow-indol.vercel.app` | HTTPS, sem usuário/senha, query ou fragmento. Usar a origem canônica, sem caminho. |

Configurar somente os ambientes da Vercel em que o teste será realizado. Um Preview protegido não é um endpoint público de webhook; o destino precisa estar acessível ao Mercado Pago sem tela de login da Vercel. Após mudar variáveis, publicar um novo deployment e verificar o alias correspondente.

Para um teste local futuro, usar um arquivo `.env` privado explicitamente carregado pelo processo. `scripts/with-local-env.cjs` carrega apenas `server/.env.development.local`; criar outro `.env` não faz o script carregá-lo automaticamente. Não substituir a conexão do banco nem utilizar o `DATABASE_URL` herdado do computador.

### Conferência antes de habilitar

- A conta retornada por `/users/me` é Brasil (`BR` ou `MLB`) e corresponde ao vendedor configurado.
- Para token `APP_USR`, o FitFlow exige `tags` contendo `test_user`. Se a API devolver um formato diferente, registrar a resposta com segredos removidos e analisar o contrato; preservar o bloqueio até resolver.
- O e-mail de teste possui o formato aceito. Se o painel fornecer outro formato, tratar a incompatibilidade explicitamente antes de habilitar.
- A variável pública é a origem correta e gera `https://fit-flow-indol.vercel.app/api/checkout/webhook`.
- O banco publicado contém a tabela de intenções de pagamento e o usuário runtime pode executar as operações necessárias.

`GET /api/checkout/status` exige sessão de **aluno**. `enabled: true` indica configuração sintaticamente válida e modelo de banco disponível; não faz chamada ao Mercado Pago e não comprova credencial válida. A verificação externa ocorre ao iniciar ou consultar o checkout.

## 3. Fluxo implementado

1. O aluno abre **Checkout sandbox — Mercado Pago**, seleciona um plano ativo e confirma a abertura.
2. O navegador envia somente `planId` e `idempotencyKey` para `POST /api/checkout/intents`. Preço, duração e titular do plano vêm do banco.
3. O servidor cria uma intenção UUID, captura preço/duração e solicita a preferência a `/checkout/preferences`. Envia `external_reference`, `metadata.fitflow_intent_id`, comprador de teste e URLs de retorno/notificação.
4. O navegador é redirecionado ao checkout permitido. Número de cartão e CVV são preenchidos no Mercado Pago; o FitFlow não recebe esses campos.
5. A URL de retorno inclui `checkout_intent`. Após autenticar o aluno, `GET /api/checkout/intents/:id` consulta o provedor e faz conciliação. Esse aluno só pode consultar sua própria intenção.
6. O webhook também consulta `/v1/payments/:id`. Só um pagamento integralmente aprovado e correspondente à intenção permite criar o lançamento e renovar a vigência.

O retorno do navegador ou um campo `approved` enviado pelo cliente não é confirmação financeira. `pending`, `rejected` e outros estados sem aprovação não renovam o plano. No estado público, algumas recusas permanecem `pending`; o status específico do provedor é armazenado em `lastProviderStatus`, sem confundir essa pendência com quitação.

### Proteções verificáveis no código

- APIs externas fixas em `api.mercadopago.com`, timeout e redirecionamentos recusados.
- URLs de checkout HTTPS limitadas a hosts específicos do Mercado Pago, sem credenciais ou porta personalizada. Token `TEST-` exige `sandbox_init_point` no host sandbox; token `APP_USR` usa `init_point` após conferir conta de teste.
- Conciliação exige `live_mode === false`, vendedor, BRL, valor em centavos, referência e metadados corretos; rejeita aprovação não capturada, reembolso parcial e data inválida.
- Somente Pix, cartão de crédito e cartão de débito permitem a renovação. A preferência exclui boleto/ATM, mas isso não garante que o provedor esconderá todos os demais métodos; não escolher saldo/carteira ou outros métodos no roteiro.
- Intenção única por aluno/chave; criação de preferência protegida por transição atômica. Um timeout deixa estado `uncertain` e não recria a preferência automaticamente com a mesma chave.
- Renovação usa transação e trava do aluno. Repetir a mesma confirmação não cria outro lançamento. Um pagamento diferente para intenção já conciliada exige conferência.
- Estorno/chargeback ou aprovação de conta inativa entram em `review`. O sistema preserva o histórico; não subtrai vigência automaticamente nem reativa conta inativa.

Arquivos de referência: `server/src/services/mercado-pago.adapter.js`, `server/src/services/checkout.service.js`, `server/src/repositories/checkout.repository.js`, `server/src/routes/checkout.routes.js` e `client/js/mercado-pago-checkout.js`.

## 4. Webhook, assinatura e repetição

Endpoint: `POST /api/checkout/webhook`. A rota não exige cookie de aluno; exige configuração, HMAC e formato de evento. A exceção de CSRF vale para essa rota JSON e não autentica a notificação.

O código confere `x-signature`, `x-request-id` e `data.id` da query. Usa HMAC-SHA256 com comparação constante e o manifesto `id:<id>;request-id:<request-id>;ts:<ts>;`. Aceita timestamp em segundos ou milissegundos e exige diferença máxima de cinco minutos. Também exige `type=payment` na query e no corpo, `body.data.id` string igual ao ID assinado e `body.live_mode === false`.

Após validar, consulta o recurso na API antes da conciliação. A documentação pede resposta 200/201 e informa prazo de 22 segundos com novas tentativas quando não há confirmação. O FitFlow retorna 200 **depois** da consulta e transação; conferir a latência desse caminho no primeiro teste publicado. [Webhooks e ações após recebimento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

Não usar um POST inventado com `approved` como prova de integração. A simulação do painel pode apontar para um ID inexistente, ambiente diferente ou corpo incompatível com os guards: registrar isso separadamente da entrega de um evento de compra de teste verdadeira. Se houver 401/400, comparar formato e timestamp com o evento real; se houver 502, verificar a consulta ao recurso. Não retirar HMAC, `live_mode` ou validação do vendedor para fazer o teste passar.

## 5. Roteiro de validação externa

Executar com aluno e plano descartáveis previamente identificados. Registrar vigência e quantidade de lançamentos antes de cada cenário. Usar janela de teste isolada, comprador correto e dados de cartão da página oficial atual. O Mercado Pago documenta titulares `APRO` para aprovação, `OTHE` para recusa e `CONT` para pendência. [Cartões e cenários de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases).

| Cenário | Procedimento | Resultado exigido no FitFlow |
| --- | --- | --- |
| Cartão aprovado | Nova intenção, cartão de teste e titular `APRO` | Provedor `approved`, `live_mode: false`; exatamente um lançamento marcado sandbox e uma renovação calculada pelo servidor. |
| Recusa | Outra intenção e titular `OTHE` | Nenhum lançamento pago ou extensão de vigência. Verificar status específico no provedor e pendência no FitFlow. |
| Pendência de cartão | Outra intenção e titular `CONT` | Intenção sem quitação e vigência preservada. |
| Pix | Outra intenção, selecionar Pix e gerar instruções | QR/instruções visíveis, provedor pendente, nenhuma renovação. Não efetuar transferência em aplicativo bancário. |
| Webhook | Inspecionar evento `payment` da compra no painel | Assinatura aceita, endpoint público responde 200; recurso corresponde à intenção. |
| Repetição | Reconsultar a intenção conciliada e observar reentrega válida do evento | Mesmo lançamento e mesma vigência; sem segunda renovação. Não esperar que assinatura expirada seja aceita. |
| Isolamento | Outro aluno tenta consultar UUID da intenção | 404 e nenhum dado da compra alheia. |
| Mobile | Abrir checkout e voltar ao FitFlow pelo navegador do telefone | Sessão restaurada, status confirmado pelo servidor; retorno/back não cria nova compra sozinho. |

Se a primeira tentativa não criar preferência, analisar configuração e `/users/me` antes de repetir. Se a resposta externa ficar incerta, consultar a intenção e o painel, preservando a chave original; não alterar o banco para forçar `paid` nem iniciar várias compras para contornar uma falha.

### Evidências a obter e registrar

- Commit e deployment exatos, URL pública, data/hora e ambiente da credencial.
- Capturas sem segredos do checkout, resultado de cartão e instruções Pix; QR deve pertencer somente ao teste.
- Estado da intenção, `live_mode`, método, valor/BRL e correlação com o pagamento; manter IDs de conta e payloads completos no relatório privado.
- Entrega de webhook e código HTTP no painel, sem expor assinatura ou chave secreta.
- Comparação da vigência e contagem de lançamentos antes/depois, incluindo repetição.
- Limpeza limitada às fixtures criadas para o teste, preservando demonstração e histórico existentes.

Atualizar o relatório de entrega com cada resultado observado. Enquanto esse roteiro não for executado, registrar **integração preparada; validação externa pendente**.

## 6. Testes existentes e ferramenta oficial

No diretório `server`, os testes de contrato podem ser executados sem acesso ao Mercado Pago:

```powershell
node --test tests/checkout.test.cjs tests/checkout-client.test.cjs
```

O teste de concorrência/renovação local exige o banco MariaDB gerenciado e tem guards de host, porta `3308` e base `fitflow_dev`; cria e remove somente fixtures próprias:

```powershell
node scripts/with-local-env.cjs node tests/checkout-local.integration.cjs
```

Esses comandos não fazem compras no provedor. O teste local não deve ser apontado para Neon ou para uma base herdada do sistema.

O Mercado Pago possui um [MCP oficial](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/mcp-server/connection) remoto em `https://mcp.mercadopago.com/mcp` e documenta a ferramenta [`search-documentation`](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/mcp-server/tools), útil para consultar contratos atuais. Nesta revisão ele foi pesquisado, sem instalação ou conexão. Seu uso não substitui o login do proprietário, a configuração privada nem a prova de uma compra sandbox.

## Pendência guardada para o retorno do proprietário

Concluir a conta/aplicação, localizar comprador/vendedor de teste, disponibilizar a configuração privada e conferir o modo do webhook. Depois disso, executar o roteiro na Vercel. O trabalho independente de login, UX, treinamento, documentação e testes pode continuar antes dessa etapa.
