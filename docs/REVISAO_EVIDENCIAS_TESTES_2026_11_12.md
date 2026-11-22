# Complemento da revisão estática — 12/11/2026

## Escopo e resultado

Referência examinada: `fe7a4509552a19e8657e0d1f399d7cd1f3664581`. Esta revisão complementa a rodada Codex Security `38767c67-ab80-40a7-9b66-e35d8b1ec5ee`, realizada em `6fa69ec`; não altera seu relatório original.

Dos 139 caminhos originalmente adiados, **138 receberam leitura integral**. O restante, `server/package-lock.json`, recebeu travessia completa por parser e inspeção dirigida das entradas relevantes. O suplemento inclui 155 caminhos integralmente lidos, com sobreposições e arquivos posteriores ao inventário original; esses números não devem ser somados aos 105 da rodada anterior para anunciar uma auditoria exaustiva do HEAD atual.

Não foi confirmada nova vulnerabilidade de runtime neste escopo. Foram identificadas limitações concretas da evidência de testes, listadas abaixo. Leitura estática não prova ausência de vulnerabilidades.

O [inventário por caminho e blob](evidence/security-static-inventory-20261112.json) preserva a referência examinada; o checkpoint operacional fica em `server/tmp/security-coverage-supplement-20261112.json` (ignorado pelo Git). A revisão foi somente de fontes rastreadas: sem execução de testes, SQL, requisições de rede ou leitura de credenciais reais. Relatos de testes anteriormente executados permanecem vinculados às respectivas revisões em [Estado da entrega](STATUS_ENTREGA.md).

## Lacunas específicas a corrigir e verificar

| Teste | Evidência insuficiente | Próxima verificação |
|---|---|---|
| `ia-chat.test.cjs` | O caso de tamanho agregado usava autores consecutivos inválidos e podia falhar antes de atingir o limite de 12.000 caracteres. | Caso alternado, mensagens individualmente válidas e pergunta final. Correção local preparada; apenas sintaxe e diff conferidos, execução comportamental pendente. |
| `ia-chat.test.cjs` | Duas verificações procuravam ausência de `private-candidate`, sem introduzir essa sentinela nos doubles. | Atualizar o contrato de não exposição para conteúdo efetivamente fornecido pelo provedor. A primeira etapa atual aceita variantes fechadas, sem candidata em prosa; não inserir conteúdo inválido e atribuir a rejeição a outro guard. |
| `checkout-local.integration.cjs` | Uma falha no cleanup pode impedir a chamada de desconexão. | Garantir desconexão em `finally`, preservando diagnóstico e restringindo exclusões às fixtures próprias. |
| `plans.test.cjs` | Array local de histórico nunca fornecido ao serviço; verificar que não mudou não prova preservação do histórico no banco. | Remover a alegação desse teste ou adicionar evidência observável no nível adequado. |
| `student-ui.test.cjs` | Um título menciona papel, mas a matriz específica altera geração, ID e epoch. | Incluir mudança de papel ou ajustar o título ao escopo real, considerando os outros testes existentes. |

Esses itens são problemas de evidência/robustez dos testes, sem demonstração de alteração indevida dos dados de usuários no produto publicado.

## Limites dos contratos simulados

- Doubles financeiros implementam parte de ownership, serialização, rollback e idempotência. Seus resultados devem ser lidos junto aos gates reais de banco; não comprovam locks SQL ou liquidação no provedor isoladamente.
- `providerRefundPerformed: false` valida o campo, mas essa asserção sozinha não observa ausência de chamada externa.
- Testes HTTP com autenticação injetada demonstram composição de rotas e ator simulado; os middlewares reais têm gates próprios.
- DOM, cookies, armazenamento e locks simulados não substituem navegador, IndexedDB real, telefone físico ou acessibilidade no aparelho.
- Fixtures de catálogo e IA não certificam adequação clínica, dose individual nem qualidade universal das gerações.

## Lockfile

Travessia de 132 entradas de pacote, 1.223 propriedades e 919 valores escalares. As 131 dependências resolvidas usam HTTPS em `registry.npmjs.org` e possuem integridade SHA-512 com formato válido. Não foram identificadas referências locais/git, URLs com credenciais ou novos segredos plausíveis. Três entradas Prisma 6.19.3 indicam scripts de instalação.

Não houve download nem verificação dos artefatos, autenticidade dos hashes, corpo dos scripts ou consulta nova a avisos de segurança. A [auditoria de dependências](AUDITORIA_DEPENDENCIAS_2026_11_11.md) mantém seus próprios resultados e limites; a travessia do lockfile não os amplia.

## Continuidade da entrega

A correção local do teste de chat ainda não foi publicada nem declarada aprovada comportamentalmente. Nesta revisão, executar código alvo exige o isolamento descrito pela skill `security-audit`; não foi substituído por execução comum sem essas proteções.

Continuam abertos: inspeção visual da PR 2, Mercado Pago sandbox externo, roteiro em telefone físico e rotação da chave Groq pelo titular. A apresentação individual será preparada após estabilizar o desenvolvimento. Este complemento não encerra a meta nem os requisitos de [Revisão final](REVISAO_FINAL.md).
