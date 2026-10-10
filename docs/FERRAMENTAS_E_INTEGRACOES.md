# Ferramentas, MCPs, skills e repositórios para o FitFlow

Pesquisa inicial em 07/10/2026, integração revisada em 09/10/2026. Ferramenta disponível não implica conta conectada nem validação científica de suas respostas. MCPs apoiam o desenvolvimento; não precisam executar no aplicativo dos alunos.

## Já usados nesta etapa

| Recurso | Estado verificado | Aplicação concreta |
|---|---|---|
| GitHub e Git local | Acesso aos dois repositórios | Leitura de código/docs e branches locais, preservando alterações existentes |
| Navegador Codex / Computer Use | Funciona nesta etapa | Captura da landing atual; teste real de formulário, reset, mobile e erro de validação |
| Vercel CLI | Autenticado na equipe `eznrbs-projects`; MCP não substitui os gates CLI | Diagnóstico, variáveis runtime privadas e publicação de app/landing; estado atual em STATUS_ENTREGA.md |
| Neon MCP | Conectado ao projeto FitFlow Free em São Paulo | Branches production/verification, migrations aditivas, papel SQL limitado e gates reais pelo pooler TLS; role de teste removida com autorização |
| Supabase MCP | Listagem de projetos disponível; nenhum FitFlow ativo confirmado | Avaliação de alternativa de infraestrutura; nenhuma migração ou tabela criada |
| UI UX Pro Max | Skill local consultada na etapa inicial; sem obrigatoriedade atual | Tokens atuais, Barlow, laranja/navy, foco, layout responsivo; geração consultada sem sobrescrever MASTER.md |
| Product Design | Skill aplicada, contexto salvo ausente | Leitura de jornadas e captura da landing; plano por telas, sem inventar um tema novo |
| Superpowers | Debug, planos, testes, verificação e revisão aplicados | Testes RED/GREEN, planos versionados e revisor independente |
| Codex Security | Auditoria anterior concluída | Seis achados registrados e ordem de correção no plano de arquitetura |
| wger REST pública | Idiomas/contrato consultados e importação local completa | 919 entradas avaliadas: 795 incorporadas, 124 ignoradas em dez páginas; autoria/licenças verificadas pelo importador |
| wger MCP oficial | Runtime preparado: `uvx --from wger-mcp wger-mcp --version` → 2.7.0 | Instalado em cache isolado do uv; CLI validada. Não conectado à sessão: acesso de conta requer configuração/chave wger |
| Gemini REST | Código backend implementado; testes com provedor controlado | Explicações com temas e IDs de referências limitados; chave real e geração real ainda não verificadas |
| Groq REST / GPT-OSS | Adaptador Free implementado e revisado; requisições simuladas nos testes | Modelo de pesos abertos escolhido pelo pedido de gratuidade; ativação exige plano Free confirmado e chave privada |

O guia antigo mencionava `api-patterns`, `database-design`, `auth-implementation` e `code-reviewer`; essas skills não foram encontradas nas pastas `.agent`, `.agents`, skills/plugins do Codex examinadas. O guia obsoleto foi removido. Foram usados padrões atuais do projeto e as skills disponíveis de autenticação, segurança, UX, testes e revisão. Não alegar que skills ausentes foram executadas.

## Integrações recomendadas e escolha

| Necessidade | Fonte/repositório | Decisão |
|---|---|---|
| Catálogo de exercícios | [wger](https://github.com/wger-project/wger), [MCP oficial](https://github.com/wger-project/mcp-server) | Adaptador REST implementado e catálogo importado no banco local; catálogo externo não substitui curadoria de prescrição. Conteúdo e mídia têm licenças próprias |
| Catálogo complementar offline | [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) | Avaliar JSON, músculos/equipamentos e licenças/procedência de imagem antes de importar; não substituir o sistema todo |
| Evidências científicas | PubMed/ACSM e fontes primárias citadas na especificação | Referências verificadas entram no app; revisar periodicamente população, data e qualidade da evidência |
| Revisões assistidas | Consensus, localizado no catálogo de plugins, não instalado | Pode ajudar a descobrir artigos; ainda exige verificar o estudo original. Não é necessário para a etapa já pesquisada |
| Login mantido | JWT/cookie existentes com autorização consultada no banco | Neon publicado recuperou o login com credenciais novas; autorização e sessão após recarga verificadas. Dados antigos Aiven não recuperados |
| Autenticação futura | [Better Auth](https://github.com/better-auth/better-auth), [Express](https://better-auth.com/docs/integrations/express) | Compatível com avaliação Express/Prisma; migrar sessões/contas em etapa própria. Supabase Auth exigiria arquitetura e migração explícitas |
| Pix/cartão | [Mercado Pago SDK Node](https://github.com/mercadopago/sdk-nodejs) | Adaptador REST Checkout Pro sandbox implementado, com HMAC e conciliação idempotente no servidor. SDK e MCP não são dependências; credenciais e webhook real ainda não configurados. Não houve cobrança |
| Pagamentos alternativos | Stripe localizado no catálogo, não instalado; [MCP Stripe](https://docs.stripe.com/mcp) | Avaliar somente se requisitos justificarem segundo gateway; conferir disponibilidade de Pix/recorrência por conta e país |
| Persistência mobile | [Dexie](https://github.com/dexie/Dexie.js) | Avaliado; fila implementada com IndexedDB nativo e UUIDs, sem adicionar biblioteca. Banco remoto continua necessário para sincronização entre dispositivos |
| APK/iOS | [Capacitor](https://github.com/ionic-team/capacitor) | Só quando embalagem nativa for exigida; mesma API, revisão de sessão e testes no aparelho |
| Testes de jornadas | [Playwright MCP oficial](https://github.com/microsoft/playwright-mcp) | Disponível como integração externa; navegador Codex já cobre os testes desta etapa; futura suíte de regressão deve usar fixtures e ambiente de teste |
| Design | Figma disponível e ImageGen usado | Nova fotografia ilustrativa da landing gerada; interface refinada em código preservando tema e conferida com screenshots reais. Não houve criação de arquivo Figma |
| Diário alimentar futuro | [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide/), [TBCA](https://www.tbca.net.br/) | USDA fornece API/datasets; TBCA fornece referência brasileira, API pública não confirmada. Preservar porção/100g, cru/cozido, unidades, fonte e versão. Dados ausentes não são zero |

Plugins Caliber, FitAI Pro e CalorieCam também apareceram no catálogo, sem conexão/instalação confirmadas. Não foram adotados: o projeto precisa de cálculos auditáveis, histórico próprio e referências primárias, e a descrição comercial desses plugins não comprova essas propriedades.

## Preparação opcional do MCP wger

Use conta de desenvolvimento própria; não compartilhe perfis de alunos. A CLI preparada suporta `--transport stdio`. Exemplo para Codex, após configurar a credencial local sem commitá-la:

```toml
[mcp_servers.wger]
command = "uvx"
args = ["--from", "wger-mcp==2.7.0", "wger-mcp", "--transport", "stdio"]
env_vars = ["WGER_API_KEY"]

[mcp_servers.wger.env]
WGER_BASE_URL = "https://wger.de"
```

O servidor oferece leitura e escrita em wger; habilite só as ferramentas de consulta de catálogo após listar seus nomes na versão instalada. O exemplo não foi registrado globalmente e não concede acesso a conta. A importação pública via REST já pode funcionar sem esse MCP.

## Como os recursos entram no desenvolvimento

1. Pesquisar artigo/API original → registrar contrato e população → escrever teste de comportamento.
2. Implementar cálculo determinístico e interface acessível → usar navegador para verificar fluxo real.
3. Usar IA apenas para explicar o conjunto curado → validar JSON/IDs e renderizar texto simples.
4. Recuperar banco → executar migrações em cópia → validar usuário/role/CRUD → só então publicar.
5. Integrar gateway/IndexedDB quando seus testes de confirmação/idempotência estiverem definidos.

Em produção, login e IA usam contadores HMAC compartilhados no banco, com falha controlada quando a quota não pode ser confirmada. A publicação atual usa PostgreSQL; a demonstração local usa MariaDB. Desenvolvimento usa memória. A quota do provedor e seu limite de gastos ainda devem ser configurados. O limite de solicitações do FitFlow não representa controle financeiro garantido.

O adaptador Gemini existente usa `gemini-3.5-flash-lite`, saída JSON via `generationConfig.responseFormat.text` e `thinkingLevel: MINIMAL` nesse modelo. O padrão anterior 2.5 tem acesso restrito para novos projetos, conforme [modelos Google](https://ai.google.dev/gemini-api/docs/models); contratos conferidos na [API oficial](https://ai.google.dev/api/generate-content). A configuração de exemplo agora seleciona Groq/GPT-OSS com ativação Free inicialmente falsa. Nenhuma geração real foi feita nesta etapa; veja [IA gratuita](IA_GRATUITA.md).

A fila mobile implementada usa IndexedDB nativo, com testes de isolamento e idempotência. Dexie e Capacitor foram avaliados e não adicionados sem necessidade. O checkout implementado usa REST Checkout Pro oficial, HMAC e conciliação no backend; MCPs não são dependências do aplicativo.

## Alternativa de IA pesquisada em 09/10/2026

Vercel AI Gateway pode autenticar Functions com OIDC, sem chave Gemini; processos Node persistentes devem obter o token no momento da requisição. OIDC local foi renovado para uma consulta somente de leitura: `GET /v1/credits` retornou HTTP 200, `balance: "0"` e `total_used: "0"`. Não houve geração, compra, criação de chave ou habilitação de recarga automática. Arquivo temporário de ambiente permanece ignorado e separado dos wrappers do aplicativo. [Autenticação oficial](https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc).

Saldo zero antes da primeira geração não comprova indisponibilidade: créditos gratuitos começam na primeira requisição de geração; exigem método de pagamento válido e abrangem parte do catálogo. Método de pagamento e recarga automática desta equipe não foram confirmados. A lista de budgets está vazia. Assim, acesso real e limite de gasto permanecem pendentes. [Primeiros passos](https://vercel.com/docs/ai-gateway/getting-started), [preços e recarga](https://vercel.com/docs/ai-gateway/pricing).

O catálogo e a página oficial apontavam `openai/gpt-5-nano` como candidato elegível a créditos Free e saída estruturada. Gemini 3.5 Flash Lite não aparecia como elegível nos provedores consultados. Essa pesquisa não resultou em ativação ou adaptador Gateway. Após a preferência do usuário por modelo aberto/gratuito, foi escolhido GPT-OSS 120B via Groq Free. Conta, plano e geração reais continuam pendentes; contrato, limites e receita estão em [IA gratuita](IA_GRATUITA.md). [Modelo Gateway pesquisado](https://vercel.com/ai-gateway/models/gpt-5-nano), [saída estruturada](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/structured-outputs).
