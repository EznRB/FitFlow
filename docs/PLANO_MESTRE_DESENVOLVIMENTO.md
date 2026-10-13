# Desenvolvimento completo do FitFlow

Meta ativa criada em 07/10/2026 a pedido do usuário. A conclusão exige todos os critérios abaixo; a conclusão de uma etapa não encerra a meta.

## Direção e ordem

Manter a identidade laranja/navy e Barlow. O usuário rejeitou o aspecto genérico da primeira entrega: reduzir cartões repetitivos, excesso de caixa alta e efeitos decorativos; priorizar hierarquia, leitura, organização e acabamento das interações. A landing apresenta o produto e a autoria acadêmica; o sistema serve jornadas reais de gestor/instrutor/aluno. Conteúdo científico deve mostrar fonte, população e limites.

1. **UX/UI:** auditar capturas atuais, definir regras de componentes e refinar landing, login, navegação, nutrição, treinos, registros e gestão. Verificar teclado, estados, 375/768/desktop e tema consistente.

   Pedido reafirmado em 12/10: concluir a validação financeira e do chat de IA, depois revisar a UX/UI de **todas** as telas com referências primárias de concorrentes e uma direção própria, preservando o tema. A revisão completa de design ainda não está concluída. [Brief e critérios por tela](REVISAO_VISUAL_SISTEMA.md).
2. **Banco/login:** manter a demonstração nativa e o Neon publicado funcionais, preservar históricos e migrations e validar contas admin/instrutor/aluno. O Aiven ficou inacessível; seus dados não foram recuperados.
3. **Segurança:** impedir criação pública de administradores; revogar acesso de usuários desativados; eliminar segredo JWT padrão e senha compartilhada; corrigir IDOR/check-in e XSS/pagamentos; testar autorização de todas as rotas.
4. **Fluxos de academia:** validar CRUD, plano/renovação, presença e cancelamento, relatórios e dashboards com banco. Corrigir decisões de datas e relações inconsistentes.
5. **Treino científico:** catálogo curado e identificável, planejamento compatível com objetivo/disponibilidade, registros reais de sessão/série/repetições/carga/RIR, progressão comparável e volume sem preencher dados ausentes. Sem prescrição universal automática.
6. **Nutrição:** manter equações determinísticas, referências e hipóteses; persistência optativa e por usuário, exclusão e sincronização. Diário alimentar somente com unidades e fontes rastreáveis.
7. **IA:** chat contínuo sobre treinamento, hipertrofia e exercícios, com proposta de divisão baseada na rotina informada. Pedir contexto faltante e enviar somente mensagens digitadas após consentimento; não anexar dados do perfil. Corpus curado, cálculos determinísticos, proposta estruturada validada e contagens calculadas no servidor. Validar formato/fontes, isolamento, erros e limites distribuídos; conferir amostras reais sem tratar JSON como certificação científica.
8. **Mobile:** interface completa e persistência de sessão; PWA, cache público e fila de registros com idempotência/isolamento por conta. Validar offline e reconexão; embalagem nativa apenas se necessária.
9. **Pagamentos:** Pix/cartão em sandbox, cobrança criada no backend, assinatura de webhook e idempotência. Validar cartão aprovado/rejeitado/pendente; Pix QR/pendente sem renovação, respeitando que sandbox não simula liquidação Pix. Conciliação Pix `approved` fica nos testes com doubles. Lançamento manual tem idempotência própria e não comprova Pix/cartão; retorno do navegador não confirma pagamento. [Roteiro e fontes](PAGAMENTOS_SANDBOX.md).
10. **Entrega:** testes de integração por papel, migração reproduzível, documentação acadêmica e demonstração. Publicação após validação; nenhuma transação real necessária.

## Critérios finais

- Login publicado funciona e banco/migrations/dados de demonstração estão confirmados.
- Fluxos pessoais e administrativos usam dados persistentes e autorização testada.
- Todas as recomendações de treino/nutrição são rastreáveis; hipóteses e dados faltantes aparecem na interface.
- UI coerente, legível e revisada visualmente, sem ações quebradas ou promessa de recurso ausente.
- Sessões/séries e sincronização mobile têm testes de duplicidade e isolamento por usuário.
- Sandbox de cartão confirma/rejeita/mantém pendente adequadamente; Pix gera QR/pendente sem renovar vigência, sem exigir liquidação indisponível nesse ambiente. Chaves não vão ao frontend.
- Limitações e pendências estão documentadas; testes obrigatórios passam.

## Estado e prioridade de execução

O objetivo permanece aberto; o goal automático atingiu o limite de uso da sessão em 13/10. [Estado da entrega](STATUS_ENTREGA.md) é a fonte única de implantação, revisão publicada, contagem da suíte, CI e capacidades atuais; [Auditoria de requisitos](REVISAO_FINAL.md) identifica cobertura e lacunas. Narrativas de marcos anteriores foram arquivadas integralmente em [Histórico do plano](HISTORICO_PLANO.md), sem alterar as reprovações ou conferir aprovação retroativa.

1. Validar e corrigir problemas concretos das jornadas de gestão/aluno, incluindo estados de presença e do chat, preservando identidade, rascunhos e resultados reais. Reproduzir o problema e verificar os casos relevantes antes de publicar.
2. Continuar a revisão de UX/UI do site inteiro pelo [brief visual](REVISAO_VISUAL_SISTEMA.md): comparar composição por tarefa com referências primárias; conferir carregamento, vazio, falha, formulário, resultado, foco/teclado/contraste e desktop/tablet/mobile. Preservar laranja/navy/Barlow, ciência, licenças e histórico.
3. Manter documentação corrente curta e consistente, execução reproduzível e relatos históricos separados. Conferir links, segredos conhecidos e critérios acadêmicos, sem usar documentação ou CI como substituto dos gates funcionais.
4. Retomar os gates externos quando o proprietário disponibilizar os acessos e aparelho. O pedido para guardar perguntas enquanto ele trabalha continua aplicável; avançar autonomamente no trabalho independente.
5. Publicar mudanças verificadas nas branches autorizadas, conferir o resultado efetivamente servido e atualizar a evidência. O aplicativo está integrado à main para apresentação; o PR da landing continua sujeito a revisão/integração.

A validação técnica do financeiro/chat e os avanços publicados permitem continuar o design, conforme autorizado. A configuração externa do Mercado Pago permanece pendente e não se torna aprovada por testes simulados ou recebimentos manuais.

## Gates obrigatórios ainda abertos

| Gate | Condição concreta para concluir | Referência |
|---|---|---|
| Pix/cartão sandbox externo | Proprietário configura conta, vendedor/comprador de teste, token e webhook. Verificar cartão aprovado/rejeitado/pendente, assinatura/replay e Pix QR/pendente sem renovação. Pix aprovado em double não comprova liquidação. | [Roteiro do provedor](PAGAMENTOS_SANDBOX.md) |
| Aparelho físico | Executar M01–M14, registrando dispositivo/OS/navegador, implantação, aba/PWA, teclado, rotação, UUIDs e reconexão publicados. Emulação não substitui a prova. | [Matriz mobile](VALIDACAO_MOBILE.md) |
| Chave Groq | Titular revoga a chave exposta, substitui privadamente e permite validar a configuração após publicação. Sem contratação de plano pago ou segredo no chat/Git. | [IA gratuita](IA_GRATUITA.md) |
| Revisão integral de UX/UI | Encerrar os critérios por tela/estado com evidência de implementação e correções necessárias. Uma captura ou um teste de contraste não certifica o sistema inteiro. | [Plano visual](REVISAO_VISUAL_SISTEMA.md) |
| Revisão/integração de PRs | Aplicativo integrado à main em 13/10, com revisão contínua das lacunas; revisar o PR draft da landing, resolver achados e conferir gates/resultados. | [Estado e PRs](STATUS_ENTREGA.md) |

## Invariantes do desenvolvimento

- Preservar migrations aplicadas, histórico real e filas ainda não sincronizadas. Testes integrados usam destino explícito e fixtures próprias; limpar somente os IDs criados. Não apagar registros antigos por semelhança.
- Catálogo descreve movimentos: sua licença/autoria não valida prescrição. O servidor captura a origem na ficha e na sessão; não reconstruir origem pelo nome. Progressão continua por ID do exercício da ficha.
- Carga externa × repetições, séries planejadas/executadas e estimativa de RIR mantêm seus conceitos distintos. Não preencher dados ausentes nem declarar estímulo/força individual por tonelagem.
- Equações nutricionais e contagens são determinísticas; referências científicas, população, hipóteses e limitações permanecem explícitas. Amostra reprovada continua reprovada no histórico mesmo após correção posterior.
- Chat exige consentimento para mensagens digitadas; não anexar automaticamente medidas/perfil/ficha. Proposta educativa não aplica ficha; formato JSON não certifica veracidade ou adequação individual. Quota/erro não aciona fallback pago.
- Lançamento manual e ajuste auditado não cobram nem reembolsam no provedor. Retorno do checkout no navegador não confirma pagamento. Resultado incerto mantém contexto/identificador aplicável, sem recompra automática.
- Desenvolvimento local nativo funciona sem Docker. Usar wrappers identificados para banco local/Neon de verificação; não herdar DATABASE_URL de outra aplicação.

## Referências e planos de origem

- [Arquitetura e contratos](ARQUITETURA.md), [desenvolvimento e gates](DESENVOLVIMENTO.md), [banco/Vercel](BANCO_REMOTO_VERCEL.md).
- [Ciência e fontes](CIENCIA.md), [auditoria científica](AUDITORIA_CIENTIFICA_FINAL.md), [IA gratuita](IA_GRATUITA.md).
- [Ajustes financeiros](AJUSTES_FINANCEIROS.md), [troca de senha](TROCA_SENHA.md), [datas e fuso](DATAS_E_FUSO.md).
- [Ferramentas, MCPs e repositórios pesquisados](FERRAMENTAS_E_INTEGRACOES.md), [direção e referências visuais](REVISAO_VISUAL_SISTEMA.md).
- Planos datados: [landing](superpowers/plans/2026-10-07-landing.md), [UX/arquitetura](superpowers/plans/2026-10-07-sistema-ux-arquitetura.md), [ciência/IA/mobile](superpowers/plans/2026-10-07-ciencia-ia-mobile.md). Registram decisões anteriores, não o estado vigente.

A conclusão exige o objetivo completo e todos os critérios finais acima, com evidência suficiente no ambiente exigido. Nenhuma etapa isolada, revisão visual ou suíte verde encerra a meta.
