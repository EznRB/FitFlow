# FitFlow Caraguá

Projeto acadêmico de gestão de academia com áreas de administrador, instrutor e aluno. Interface em português, identidade laranja/navy e Barlow; planejamento, execução e histórico de treino têm apresentações próprias.

[Abrir o aplicativo](https://fit-flow-indol.vercel.app/) · [Landing](https://fitflow-lp.vercel.app/) · [Estado da entrega](docs/STATUS_ENTREGA.md) · [Auditoria de requisitos](docs/REVISAO_FINAL.md)

![Painel demonstrativo do FitFlow publicado em 12/10/2026](docs/evidence/66-dashboard-workspace-vercel.png)

Captura demonstrativa datada; não representa resultados comerciais nem comprova alterações posteriores. Outras telas, referências e limites estão na [revisão visual](docs/REVISAO_VISUAL_SISTEMA.md).

## O que o sistema oferece

| Área | Capacidades |
|---|---|
| Administrador | Alunos, planos, presença/cancelamento auditável, recebimentos manuais, ajustes financeiros e relatórios por período. |
| Instrutor | Criação e revisão de fichas, catálogo de movimentos com autoria/licenças e prescrição separada da execução. |
| Aluno | Ficha, caderno de sessões/séries, carga/repetições/RIR, trabalho/aquecimento, sincronização, Evolução e consulta da mensalidade. |
| Nutrição | Mifflin–St Jeor e Harris–Benedict revisada, energia/macros determinísticos, hipóteses explícitas e persistência optativa por usuário. |
| Fundamentos e IA | Referências curadas, glossário determinístico e chat educativo sobre treinamento/hipertrofia, com rascunho de divisão segundo a rotina informada. |
| Mobile/PWA | Layout responsivo, manifesto, fallback público offline e fila de treino em IndexedDB por conta. |

Cálculos de treino/nutrição têm [fontes, unidades e limites](docs/CIENCIA.md). Catálogo descritivo não certifica prescrição. Volume em kg·reps não mede estímulo ou evolução de força automaticamente; repetições ausentes não são inventadas.

## Arquitetura

| Camada | Implementação |
|---|---|
| Interface | SPA JavaScript/CSS em `client/`, servida pelo Express; Chart.js, Lucide e SortableJS empacotados como recursos locais. |
| API | Node.js **24.x**, Express, controllers/services/repositories e Prisma. JWT em cookie httpOnly; autorização consulta o usuário ativo e papel atual no banco. |
| Banco | MariaDB nativo na demonstração local; Neon PostgreSQL na Vercel, com schema/migrations próprios, conexão pooled no runtime e credenciais administrativas separadas. |
| Persistência | Dados no servidor e fila de treino por conta no IndexedDB. UUIDs e intenção validada protegem sessões/séries e recebimentos manuais contra replay. |
| IA | GPT-OSS via Groq Free, chave somente no backend. Consentimento para mensagens digitadas; perfil e ficha não são anexados automaticamente. |
| Pagamentos | Checkout Mercado Pago exclusivamente sandbox, criação/assinatura/conciliação no servidor; validação externa ainda pendente. |
| Landing | React/Vite em repositório separado: [fitflow-LP](https://github.com/EznRB/fitflow-LP). Apresentação do produto, autoria acadêmica e CTA para o aplicativo. |

[Arquitetura e contratos completos](docs/ARQUITETURA.md). Escritas com cookie têm proteção de origem; API sem cache; quotas de login/IA são compartilhadas no banco em produção. Troca de senha própria revoga sessões anteriores por versão da credencial.

## Executar localmente

Para a apresentação desta semana, veja [Acesso à demonstração e roteiro](docs/APRESENTACAO.md). As cinco contas publicadas tiveram login/restauração conferidos em 13/10/2026. As senhas atuais foram reunidas em um arquivo privado para compartilhar com o professor; as credenciais antigas do Aiven não se aplicam ao Neon atual.

Docker, WSL e virtualização não são necessários. O ambiente preparado usa MariaDB nativo em `127.0.0.1:3308`, com dados em `.local-db/` e configuração privada identificada. Para **outro computador**, preparar primeiro o runtime/banco conforme [Desenvolvimento](docs/DESENVOLVIMENTO.md); os comandos abaixo retomam o ambiente já configurado.

```powershell
cd server
npm ci
npm run db:local:start
npm run db:local:migrate
npm run db:local:seed
npm run browser:vendor
npm run dev:local
```

Aplicativo: `http://127.0.0.1:3107/`. Credenciais individuais em `server/.demo-credentials.local.json`, ignorado pelo Git. O seed demonstrativo é restrito ao banco local identificado e preserva registros; não há senha universal no repositório.

Na landing, em outro terminal e no repositório correspondente:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 3108
```

[Guia de banco local/PostgreSQL/Neon e bootstrap](docs/DESENVOLVIMENTO.md). Use os wrappers específicos; o ambiente do computador pode conter DATABASE_URL de outro projeto. Migrations MySQL e PostgreSQL mantêm históricos separados.

## Verificação

No ambiente MariaDB local preparado, dentro de `server/`:

```powershell
node scripts/with-local-env.cjs node --test tests/*.test.cjs
node scripts/with-local-env.cjs node scripts/smoke-local.cjs
node scripts/check-private-files.cjs
npm audit
```

A suíte inclui casos controlados e testes nativos previstos; gates PostgreSQL/Neon/HTTPS e de provedores são separados e têm destinos explícitos/fixtures próprias. No Windows, passe `node` ao wrapper. Na landing, `npm run build` valida o build e os tipos; não equivale a uma auditoria completa de acessibilidade.

Consulte [Estado da entrega](docs/STATUS_ENTREGA.md) para contagem da suíte, revisão exata, CI, implantação e hashes conferidos; [Desenvolvimento](docs/DESENVOLVIMENTO.md) para os comandos e restrições dos gates. Não somar subsuítes focadas ao total nem usar doubles como prova de integração externa.

## Implantação e limites da entrega

O login no [domínio público](https://fit-flow-indol.vercel.app/) foi recuperado com banco Neon e contas novas. O Aiven antigo ficou inacessível; seus dados e credenciais não foram restaurados. As contas demonstrativas remotas ficam em arquivo privado ignorado. A implantação vigente e os PRs draft estão em [Estado da entrega](docs/STATUS_ENTREGA.md), fonte única dos metadados atuais.

A meta completa permanece ativa. Os gates obrigatórios ainda incluem:

- **Pix/cartão externo:** conta, credenciais e webhook Mercado Pago de teste; cartão aprovado/rejeitado/pendente e Pix QR/pendente sem renovar plano. Sandbox não comprova liquidação Pix. Recebimento manual não cobra nem confirma Pix/cartão; ajuste administrativo não executa reembolso no provedor.
- **Telefone físico:** instalação PWA, teclado, rotação e reconexão publicada conforme M01–M14. Emulação e testes locais de fila não substituem aparelho físico; nova abertura offline exige reconexão para validar identidade.
- **IA:** rotação da chave anteriormente exposta pelo titular. Amostras reais conferidas não certificam toda resposta futura; reprovações permanecem documentadas. Histórico do chat fica em memória, não há aplicação automática da ficha nem fallback pago.
- **UX/UI e integração:** encerramento da revisão de todas as jornadas/estados e revisão dos PRs draft antes da decisão de integração. Deployment público não significa merge.

[Auditoria de requisitos e evidências](docs/REVISAO_FINAL.md) · [Plano completo](docs/PLANO_MESTRE_DESENVOLVIMENTO.md).

## Documentação

| Assunto | Fonte |
|---|---|
| Estado atual, evidências e gates | [Estado da entrega](docs/STATUS_ENTREGA.md), [auditoria](docs/REVISAO_FINAL.md) |
| Desenvolvimento e implantação | [Guia](docs/DESENVOLVIMENTO.md), [banco/Vercel](docs/BANCO_REMOTO_VERCEL.md), [arquitetura](docs/ARQUITETURA.md) |
| Ciência e IA | [Fontes/fórmulas](docs/CIENCIA.md), [auditoria científica](docs/AUDITORIA_CIENTIFICA_FINAL.md), [IA gratuita](docs/IA_GRATUITA.md) |
| Contratos de gestão | [Ajustes financeiros](docs/AJUSTES_FINANCEIROS.md), [troca de senha](docs/TROCA_SENHA.md), [datas](docs/DATAS_E_FUSO.md) |
| Gates externos | [Pagamento sandbox](docs/PAGAMENTOS_SANDBOX.md), [telefone físico](docs/VALIDACAO_MOBILE.md) |
| Planejamento e referências | [Plano mestre](docs/PLANO_MESTRE_DESENVOLVIMENTO.md), [revisão visual](docs/REVISAO_VISUAL_SISTEMA.md), [direção visual](design-system/fitflow/MASTER.md), [ferramentas/MCPs](docs/FERRAMENTAS_E_INTEGRACOES.md) |
| Histórico preservado | [Status/revisão anteriores](docs/HISTORICO_ENTREGA.md), [README/plano anteriores](docs/HISTORICO_PLANO.md) |

Documentos datados registram decisões e resultados daquele momento, sem substituir a fonte atual ou transformar reprovações em aprovações.

Autoria: Enzo Marcelo Ribeiro Fermiano — Análise e Desenvolvimento de Sistemas, 2026.
