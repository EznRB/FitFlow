# Desenvolvimento completo do FitFlow

Meta ativa criada em 07/10/2026 a pedido do usuário. A conclusão exige todos os critérios abaixo; a conclusão de uma etapa não encerra a meta.

## Direção e ordem

Manter a identidade laranja/navy e Barlow. O usuário rejeitou o aspecto genérico da primeira entrega: reduzir cartões repetitivos, excesso de caixa alta e efeitos decorativos; priorizar hierarquia, leitura, organização e acabamento das interações. A landing apresenta o produto e a autoria acadêmica; o sistema serve jornadas reais de gestor/instrutor/aluno. Conteúdo científico deve mostrar fonte, população e limites.

1. **UX/UI:** auditar capturas atuais, definir regras de componentes e refinar landing, login, navegação, nutrição, treinos, registros e gestão. Verificar teclado, estados, 375/768/desktop e tema consistente.
2. **Banco/login:** manter a demonstração nativa e o Neon publicado funcionais, preservar históricos e migrations e validar contas admin/instrutor/aluno. O Aiven ficou inacessível; seus dados não foram recuperados.
3. **Segurança:** impedir criação pública de administradores; revogar acesso de usuários desativados; eliminar segredo JWT padrão e senha compartilhada; corrigir IDOR/check-in e XSS/pagamentos; testar autorização de todas as rotas.
4. **Fluxos de academia:** validar CRUD, plano/renovação, presença e cancelamento, relatórios e dashboards com banco. Corrigir decisões de datas e relações inconsistentes.
5. **Treino científico:** catálogo curado e identificável, planejamento compatível com objetivo/disponibilidade, registros reais de sessão/série/repetições/carga/RIR, progressão comparável e volume sem preencher dados ausentes. Sem prescrição universal automática.
6. **Nutrição:** manter equações determinísticas, referências e hipóteses; persistência optativa e por usuário, exclusão e sincronização. Diário alimentar somente com unidades e fontes rastreáveis.
7. **IA:** explicações de temas com corpus curado, sem enviar dados pessoais; cálculos continuam determinísticos e separados da IA. Validar formato/fontes e limites distribuídos; testes reais somente com chave configurada e quota definida.
8. **Mobile:** interface completa e persistência de sessão; PWA, cache público e fila de registros com idempotência/isolamento por conta. Validar offline e reconexão; embalagem nativa apenas se necessária.
9. **Pagamentos:** Pix/cartão em sandbox, cobrança criada no backend, assinatura de webhook, idempotência e confirmação pelo provedor. Lançamento manual de recebimento tem idempotência própria e não comprova Pix/cartão. Nunca considerar retorno do navegador como pagamento aprovado.
10. **Entrega:** testes de integração por papel, migração reproduzível, documentação acadêmica e demonstração. Publicação após validação; nenhuma transação real necessária.

## Critérios finais

- Login publicado funciona e banco/migrations/dados de demonstração estão confirmados.
- Fluxos pessoais e administrativos usam dados persistentes e autorização testada.
- Todas as recomendações de treino/nutrição são rastreáveis; hipóteses e dados faltantes aparecem na interface.
- UI coerente, legível e revisada visualmente, sem ações quebradas ou promessa de recurso ausente.
- Sessões/séries e sincronização mobile têm testes de duplicidade e isolamento por usuário.
- Sandbox de pagamento confirma e rejeita eventos adequadamente; chaves não vão ao frontend.
- Limitações e pendências estão documentadas; testes obrigatórios passam.

## Estado

Em desenvolvimento, com frentes paralelas e integração local/remota em 09/10/2026. MariaDB nativo funciona sem Docker; cinco migrations MySQL e contas demonstrativas isoladas. Neon PostgreSQL 17 Free em São Paulo tem duas migrations próprias: baseline preservada e migration aditiva de idempotência manual, aplicadas nas duas branches; onze CHECKs. Login público recuperado com credenciais novas, sem recuperação dos dados Aiven. Gestão, catálogo wger, sessões/séries, progressão e nutrição optativa implementados. Checkout sandbox e IA educativa possuem adaptadores, autorização e validação; credenciais externas ainda não configuradas.

Suíte integral local da revisão `24e77b4`: **233 testes aprovados, zero falhas e zero ignorados**, executada com `node scripts/with-local-env.cjs node --test tests/*.test.cjs`. Gates PostgreSQL reais passaram no cluster nativo e na branch Neon de verificação; runtime limitado recusou operações protegidas. Preview e Production passaram no gate HTTPS dos três perfis. Gestão publicada passou em CRUD por papel, nutrição consentida/isolada, presença auditável e duas renovações concorrentes. Fixtures UUID removidas, quotas preservadas. No navegador publicado, sessão autenticada sobreviveu à recarga, treino finalizado reapareceu com 20 kg × 8/RIR 2/160 kg·reps e nutrição foi salva/restaurada exigindo nova confirmação. Localmente, fila offline sincronizou uma série exatamente uma vez; recarga offline retornou fallback público.

Aplicativo `24e77b4` publicado em READY, com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/37991180996). Gestão HTTPS repetida após deploy: CRUD/perfis, JSONB consentido, presença auditável, duas renovações concorrentes e replay manual sem terceiro registro; conflito 409 e sessão divergente 403. Idempotência manual aprovada nos bancos nativos e no core Neon isolado. Revisão final focada 26/26 aprovada. Navegador restaurou admin e confirmou modal de recebimento sem submissão em `24e77b4`, captura 23; Fundamentos conferidos em `65fb32c`, captura 21. Espera tem timeout e grupos genéricos não recebem contagem artificial. Landing `c6b43ba` READY, recursos HTTP 200 e composição/estado conferidos. Viewport 375 × 812 sem overflow não comprova telefone físico. IA real, provedor sandbox, telefone físico, reconexão publicada e revisão final continuam pendentes. PRs draft [do app](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1) preservados; nenhum merge. Papel Neon administrativo não usado removido com autorização. Evidências em [STATUS_ENTREGA.md](STATUS_ENTREGA.md).

Planos detalhados anteriores: `superpowers/plans/2026-10-07-landing.md`, `2026-10-07-sistema-ux-arquitetura.md` e `2026-10-07-ciencia-ia-mobile.md`. Estado atual em `STATUS_ENTREGA.md`; planos datados registram decisões anteriores.
