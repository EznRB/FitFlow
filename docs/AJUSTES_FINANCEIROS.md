# Correções e devoluções de recebimentos

Implementado e publicado em `9d0361e`, em 11/10/2026. A validação administrativa não substitui o teste do checkout do provedor.

## Finalidade

O administrador registra uma correção de recebimento manual ou uma devolução já realizada fora do FitFlow. Cada ajuste é um evento permanente associado ao recibo original, com valor, data civil brasileira, motivo e responsável. O FitFlow não executa uma transferência nem solicita um reembolso ao provedor por este formulário.

O recibo original permanece intacto. Seu saldo é o valor original menos todos os ajustes. Valores são calculados em centavos, com limite transacional: a soma de ajustes não pode ultrapassar o recebimento. Correções são permitidas somente em recebimentos manuais; recebimentos de checkout admitem devolução informada, identificada separadamente de uma confirmação do provedor.

## Vigência

O padrão é preservar o acesso. Quando necessário, o administrador informa explicitamente um novo vencimento, sem alterar o plano, início da vigência ou status. O vencimento não pode anteceder o início atual. Contas desativadas não recebem alterações de vigência por este fluxo. A API de edição de matrícula também exige `expectedMembershipRevision` atual quando o plano, as datas ou o status serão alterados; edições só de perfil preservam a vigência sem essa exigência.

Não há desconto proporcional de dias nem reconstrução automática de direitos anteriores. Recibos legados não contêm os dados necessários; os novos registrarão o efeito real de concessão como snapshot. Todos os escritores de vigência bloqueiam a mesma linha do aluno; uma revisão monotônica impede que um formulário antigo sobrescreva uma renovação posterior.

## API e repetição

- `POST /api/pagamentos/:id/ajustes`: administrador autenticado; UUID de solicitação, valor positivo, tipo, motivo, data e efeito de vigência. Campos de auditoria são produzidos pelo servidor.
- `GET /api/pagamentos/:id/ajustes`: histórico do recibo.
- `GET /api/pagamentos/ajustes/solicitacoes/:requestId`: reconciliação restrita ao responsável original.
- Alteração e exclusão direta de recibos e eventos continuam proibidas.

O servidor bloqueia o aluno antes de reler os dados, verifica a autoridade do administrador, procura a solicitação existente antes de conferir o saldo e grava ajuste e alteração explícita de vencimento na mesma transação. Mesmo UUID com dados diferentes retorna conflito. Replay devolve o evento original sem repetir seus efeitos.

Em caso de resposta incerta, o navegador preserva UUID e hash por conta e consulta a solicitação antes de reenviar. Não cria outro pedido automaticamente e não armazena motivo, nome ou dados do aluno no armazenamento de reconciliação.

## Relatórios

Recebimentos entram por `paymentDate`; ajustes entram por `effectiveDate`. Uma devolução deste mês de um recibo antigo aparece neste mês. Os relatórios separam bruto, correções, devoluções informadas e líquido registrado, mantendo os recibos e os eventos visíveis. Líquido registrado pode ser negativo num período; não é saldo bancário nem prova de liquidação.

Eventos de estorno/chargeback do checkout que aguardam conferência são mostrados separadamente. Não produzem abatimento automático enquanto não houver conciliação financeira apropriada. Um ajuste informado pelo administrador não confirma uma operação no Mercado Pago.

## Implementação e gates

1. Migrações aditivas MySQL e PostgreSQL: revisão da matrícula, snapshot de concessão e tabela de ajustes com FKs, tipos e CHECKs.
2. Serviço com autenticação, saldo em centavos, idempotência, bloqueio e comparação da revisão.
3. Captura de concessões reais e bloqueio de edição/desativação da matrícula.
4. Histórico e formulário acessíveis, isolamento de conta, recuperação de resposta incerta; relatórios bruto/ajustes/líquido.
5. Testes de contrato, concorrência em banco real, rollback, legado, troca de plano e permissões de runtime; validação publicada após deploy.

O usuário de runtime recebe SELECT/INSERT na tabela de ajustes. UPDATE/DELETE ficam negados. O owner executa as migrações; nenhuma migração roda durante o build da Vercel.

## Evidências locais e de banco — 11/10/2026

A suíte integral passou em **470/470**, sem falhas ou ignorados. Os 32 casos novos de serviço, UI, revisão de matrícula e relatórios estão incluídos nesse total. O gate `tests/payment-adjustments-db.integration.cjs` passou nos bancos nativos MariaDB e PostgreSQL e na branch isolada Neon de verificação: concorrência com duas conexões, saldo exato, replay, rollback, legado, revisão de vigência, troca/desativação de matrícula e relatórios entre meses. As fixtures próprias foram removidas.

Migration `20261011_payment_adjustments` aplicada também no Neon principal. Há sete migrations MySQL e quatro PostgreSQL. O trigger `payments_paid_immutable` recusa UPDATE de recibos pagos. O probe de runtime confirmou SELECT/INSERT de ajustes em transação revertida e negou UPDATE/DELETE, além das proteções de DDL e histórico existentes.

No navegador local, um recibo sintético de R$ 100,01 recebeu correção de R$ 25,01 e passou a ter saldo de R$ 75,00, preservando a vigência e o recibo. [Histórico local](evidence/41-ajuste-financeiro-local.png). O formulário foi conferido em viewport emulada 375 × 812, documento sem overflow (375/375), inputs de 16 pixels e abertura no início, com instruções visíveis e sem foco automático em campo fora da tela. [Formulário mobile local](evidence/42-ajuste-mobile-local.png). As duas fixtures locais foram removidas; não houve cobrança nem devolução no provedor. Emulação não comprova telefone físico.

O gate HTTPS `tests/hosted-payment-adjustments.integration.cjs --execute-hosted-fixtures` passou no domínio Production: saldo parcial/integral, replay, autenticação/autorização e imutabilidade, CAS após renovação, vigência explícita, mensalidade e relatório de eventos. Foram dois logins, com quotas preservadas e somente fixtures UUID próprias removidas. Sua execução não testa o checkout do provedor. [Dashboard publicado](evidence/43-financeiro-dashboard-vercel.png). [Estado da implantação](STATUS_ENTREGA.md).
