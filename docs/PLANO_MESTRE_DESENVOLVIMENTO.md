# Desenvolvimento completo do FitFlow

Meta ativa criada em 07/10/2026 a pedido do usuário. A conclusão exige todos os critérios abaixo; a conclusão de uma etapa não encerra a meta.

## Direção e ordem

Manter a identidade laranja/navy e Barlow. O usuário rejeitou o aspecto genérico da primeira entrega: reduzir cartões repetitivos, excesso de caixa alta e efeitos decorativos; priorizar hierarquia, leitura, organização e acabamento das interações. A landing apresenta o produto e a autoria acadêmica; o sistema serve jornadas reais de gestor/instrutor/aluno. Conteúdo científico deve mostrar fonte, população e limites.

1. **UX/UI:** auditar capturas atuais, definir regras de componentes e refinar landing, login, navegação, nutrição, treinos, registros e gestão. Verificar teclado, estados, 375/768/desktop e tema consistente.
2. **Banco/login:** manter a demonstração nativa funcional e recuperar Aiven ou configurar um novo banco remoto próprio para publicação; preservar dados existentes, conciliar migrations e validar contas admin/instrutor/aluno. Não mascarar indisponibilidade com login fictício.
3. **Segurança:** impedir criação pública de administradores; revogar acesso de usuários desativados; eliminar segredo JWT padrão e senha compartilhada; corrigir IDOR/check-in e XSS/pagamentos; testar autorização de todas as rotas.
4. **Fluxos de academia:** validar CRUD, plano/renovação, presença e cancelamento, relatórios e dashboards com banco. Corrigir decisões de datas e relações inconsistentes.
5. **Treino científico:** catálogo curado e identificável, planejamento compatível com objetivo/disponibilidade, registros reais de sessão/série/repetições/carga/RIR, progressão comparável e volume sem preencher dados ausentes. Sem prescrição universal automática.
6. **Nutrição:** manter equações determinísticas, referências e hipóteses; persistência optativa e por usuário, exclusão e sincronização. Diário alimentar somente com unidades e fontes rastreáveis.
7. **IA:** explicações de temas com corpus curado, sem enviar dados pessoais; cálculos continuam determinísticos e separados da IA. Validar formato/fontes e limites distribuídos; testes reais somente com chave configurada e quota definida.
8. **Mobile:** interface completa e persistência de sessão; PWA, cache público e fila de registros com idempotência/isolamento por conta. Validar offline e reconexão; embalagem nativa apenas se necessária.
9. **Pagamentos:** Pix/cartão em sandbox, cobrança criada no backend, assinatura de webhook, idempotência e confirmação pelo provedor. Nunca considerar retorno do navegador como pagamento aprovado.
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

Em desenvolvimento, com frentes paralelas e integração local/remota em 08/10/2026. MariaDB nativo funciona sem Docker; quatro migrations aplicadas e contas demonstrativas isoladas. Neon PostgreSQL 17 Free em São Paulo tem baseline e demonstração próprias; login no domínio público foi recuperado com credenciais novas, sem recuperação dos dados Aiven. Gestão, catálogo wger, sessões/séries, progressão e nutrição optativa implementados. Checkout sandbox e IA educativa possuem adaptadores, autorização e validação; suas credenciais externas ainda não estão configuradas.

Suíte local: 195 testes aprovados. Gates PostgreSQL reais passaram no cluster nativo e na branch Neon de verificação; runtime limitado recusou operações protegidas. Preview e Production Vercel passaram no gate HTTPS dos três perfis. No navegador publicado, sessão autenticada sobreviveu à recarga e um treino finalizado reapareceu com uma série 20 kg × 8, RIR 2, volume 160 kg·reps. Localmente, fila offline sincronizou uma série exatamente uma vez; recarga offline retornou fallback público.

Landing pública está READY, com hero novo, recursos HTTP 200 e CTA para o aplicativo. Produção do aplicativo passou na viewport emulada 375 × 812 sem overflow; isso não comprova telefone físico ou instalação. IA real, conciliação com provedor de teste, telefone físico e demais fluxos finais continuam pendentes. Aplicativo enviado em `dad6d9c`, [PR draft #1](https://github.com/EznRB/FitFlow/pull/1), com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/37873364828); landing enviada em `c6b43ba`, [PR draft #1](https://github.com/EznRB/fitflow-LP/pull/1). Revisão e merge permanecem pendentes; nenhum merge à branch principal foi feito. O papel Neon administrativo não usado foi removido com autorização do usuário. Consulte [STATUS_ENTREGA.md](STATUS_ENTREGA.md) para evidências e próximos passos.

Planos detalhados anteriores: `superpowers/plans/2026-10-07-landing.md`, `2026-10-07-sistema-ux-arquitetura.md` e `2026-10-07-ciencia-ia-mobile.md`. Estado atual em `STATUS_ENTREGA.md`; planos datados registram decisões anteriores.
