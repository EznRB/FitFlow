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

## Estado

Em desenvolvimento, com frentes paralelas e integração local/remota em 10/10/2026. MariaDB nativo funciona sem Docker; cinco migrations MySQL e contas demonstrativas isoladas. Neon PostgreSQL 17 Free em São Paulo tem duas migrations próprias: baseline preservada e migration aditiva de idempotência manual, aplicadas nas duas branches; onze CHECKs. Login público recuperado com credenciais novas, sem recuperação dos dados Aiven. Gestão, catálogo wger, sessões/séries, progressão e nutrição optativa implementados. Credenciais Mercado Pago continuam pendentes. Groq Free foi confirmado no console; chave e flag Free estão configuradas privadamente em Production/Preview.

Código publicado `143c228`: **316/316**, zero falhas e ignorados; revisão independente focada 12/12 e gate privado em 297 arquivos na entrega documental `7dee5e2`. Prazo de 15 segundos por requisição de treino/consulta inclui corpo e preserva UUID/fila diante de resultado incerto. Production pelo CLI READY, CI e histórico normal no navegador aprovados. O Preview Git falhou nessa revisão e voltou a funcionar em `7dee5e2`; a intermitência está registrada no status. A baseline `f9ac83d` teve 309/309, revisão IA 19/19 e audit de produção sem vulnerabilidades conhecidas. Gestão/login `3adf5c1`: 304/304, revisão focada 29/29 e backend 48/48. Subconjuntos não são somados à suíte. Comando validado: `node scripts/with-local-env.cjs node --test tests/*.test.cjs`. Gate nativo guardado de datas/presenças passou e limpou sua fixture.

Gates anteriores: PostgreSQL nativo/Neon isolado, runtime limitado, HTTPS de perfis e gestão, nutrição consentida, presença, renovação/replay e fixtures próprias limpas. No navegador publicado, treino persistiu com 20 kg × 8/RIR 2/160 kg·reps e nutrição foi salva/restaurada exigindo nova confirmação. Fila local sincronizou série uma vez e recarga offline retornou fallback público.

Revisão anterior `62ff0af`: guardas de sessões/IDB/epoch e limpeza aguardada entre abas, sem migration. Hashes publicados conferidos, sessão do aluno restaurada e histórico 20 kg × 8/RIR 2/160 kg·reps verificado em 375 × 812, captura 26. As corridas foram reproduzidas nos harnesses controlados; a captura comprova o fluxo normal. Gestão HTTPS anterior `4b89e3` e captura 24 permanecem evidências datadas. Landing `c6b43ba` READY. Papel `fitflow_runtime` removido com autorização e ausência reconfirmada pelo MCP.

Revisão de gestão/login `3adf5c1`: publicada em READY com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38054589595). HTML/login.css/WEBP/alunos.js coincidiram com o checkout; saúde HTTP 200 e banco ready. Gate HTTPS de gestão aprovado, com três logins e fixtures próprias removidas, sem reset de quotas. Login editorial conferido localmente em 1280 e 375 pixels com teclado e controles; quatorze testes novos protegem lista/formulário/modal de alunos e três backend cobrem edição parcial/cancelamento/presença inativa.

Groq Free a US$ 0 foi confirmado. A explicação real local de divisões levou aproximadamente 1,2 segundo e foi inspecionada contra Ramos-Campo (2024)/ACSM (2026); divisões reais em HTTPS também foram conferidas. Nutrição real publicada foi inspecionada com limitação terminológica basal/repouso, sem certificação factual integral. Captura 27 e geração desativada pertencem à revisão anterior `7b856e0`; capturas 28/29/31 registram o novo login e captura 30 registra nutrição. Não há fallback pago. [Receita e evidências](IA_GRATUITA.md).

A revisão anterior `9e1b5c5` acrescentou fatos operacionais ao contexto, mas a segunda amostra real de volume confundiu séries previstas com repetições e foi reprovada. As duas reprovações motivaram substituir inferência nesse tema por glossário revisado determinístico, sem provedor externo.

A baseline `f9ac83d`, preservada na revisão publicada, implementa essa decisão: glossário fixo, `generatedByAI: false`, botão **Entender indicadores**, sem chamada externa/quota de inferência e com autenticação/autorização/CSRF/proteção global mantidas. Prompt nutricional distingue repouso e basal. Naquela revisão, deployment `dpl_AhGq8iVB9UYq55ZjDmP51zpDPZGq` READY, alias e [CI aprovados](https://github.com/EznRB/FitFlow/actions/runs/38055351767). Saúde/banco e hashes conferidos; navegador confirmou o glossário, captura 32. Implantação atual e verificações posteriores em [Estado da entrega](STATUS_ENTREGA.md).

Mercado Pago real de teste, telefone físico/instalação, reconexão publicada e revisão/merge dos PRs continuam pendentes. A conta Mercado Pago ainda precisa ser criada/configurada. A meta permanece ativa. [Estado completo](STATUS_ENTREGA.md) e [revisão atual](REVISAO_FINAL.md).

Planos detalhados anteriores: `superpowers/plans/2026-10-07-landing.md`, `2026-10-07-sistema-ux-arquitetura.md` e `2026-10-07-ciencia-ia-mobile.md`. Estado atual em `STATUS_ENTREGA.md`; planos datados registram decisões anteriores.
