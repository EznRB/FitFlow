# Estados de interface conferidos — 23/11/2026

Verificação na prévia `fit-flow-ce8fo708v-eznrbs-projects.vercel.app`, revisão `c2f70bee5518b40aed202ddfa81e60327f89a5b6`, com gestor demonstrativo. As telas aqui verificadas não foram alteradas pela PR 20. Dados utilizados são fictícios; nenhuma senha foi alterada, simulação persistida, cobrança criada ou presença adicionada.

## Segurança da conta

- Desktop: foco inicial em fechar; Tab percorre senha atual, nova senha, confirmação, mostrar senhas, cancelar e enviar, retornando a fechar. Shift+Tab de fechar retorna ao envio.
- Escape fecha e devolve foco ao botão de origem. Os três campos têm tipo senha, label, obrigatoriedade e estado nativo de valor ausente.
- Em 375 px: diálogo de 311 px, formulário e ação principal de 263 px; documento/corpo com 375 px. Ciclo de foco e Escape conferidos nessa largura.
- Em 768 px: diálogo de 704 px e formulário de 646 px, sem ultrapassar o corpo de 768 px.
- Nenhuma credencial nova foi digitada nem houve submissão. Erros do servidor e revogação continuam cobertos pelos gates técnicos registrados em [troca de senha](TROCA_SENHA.md), sem nova execução aqui.

## Relatórios restantes

- Período de 25/10 a 23/11/2026: frequência por aluno confirmou vazio; check-ins confirmou zero registros e vazio. O intervalo aplicado permaneceu visível.
- Situação dos alunos: nove ativos, um bloqueado, zero inativos, dez linhas. Datas desabilitadas e indicação de situação atual, sem atribuir filtro de período a esse resultado.
- Inadimplência e financeiro já tinham evidência anterior; não foram repetidos como novos gates nesta rodada.
- Não houve indução de falha de transporte no servidor publicado. A prévia de impressão permanece sem inspeção; botão habilitado não comprova impressão legível.

## Nutrição: correção antes de calcular

- Formulário vazio: mensagem de revisão, foco no coeficiente por sexo e persistência desabilitada. Com medidas fictícias completas e escopo desmarcado, foco vai à confirmação de escopo e salvar continua bloqueado.
- Um valor inválido por parâmetro: peso 29 kg, altura 231 cm, idade 18, atividade 2,5, ajuste 16%, proteína 2,3 g/kg e gordura 36%. Cada caso manteve salvar desabilitado, exibiu aviso e identificou o campo inválido. São verificações dos limites implementados, não recomendações para uma pessoa.
- No caso do peso, o primeiro clique não produziu feedback observável. Após inspeção, Enter no campo confirmou a validação esperada; essa ocorrência isolada não foi atribuída a defeito do aplicativo.
- Os parâmetros fictícios foram limpos somente da tela; não houve pedido de IA nem operação sobre a simulação remota existente.

## Editor: recuperação de gravações incertas

PR [22](https://github.com/EznRB/FitFlow/pull/22), integrada em `8447d1517a4837433065043ac063d9dee26bac82`:

- Consultas do instrutor têm prazo de 15 segundos. Catálogo inválido permite preenchimento manual com aviso; detalhe incompleto não abre edição capaz de apagar campos ausentes.
- “Conferir fichas” consulta nomes/IDs sem fechar o editor, descartar o rascunho ou repetir a gravação. A lista não comprova aquele envio; o reenvio continua bloqueado. Campos de carga e observações exigem presença explícita, aceitando `null` legítimo.
- RED reproduzido; 38 testes focados aprovados. A primeira CI encontrou três fixtures incompletas de testes antigos; foram ajustadas ao DTO real sem remover asserts de race/XSS. Quatro arquivos focados: 52 aprovados. CI final [45207341033](https://github.com/EznRB/FitFlow/actions/runs/45207341033): 983 aprovados, zero falhas, um ignorado por MariaDB externo ausente; schema e geração PostgreSQL aprovados. Subsuítes estão incluídas no total, não devem ser somadas a ele.
- Revisão estática independente não encontrou regressão concreta. A leitura pendente de conferência usa os guards de identidade do editor; trocas de sessão/editor/aluno durante esse GET não ganharam um novo teste explícito nesta rodada.
- Prévia `fit-flow-qjd66v2zm-eznrbs-projects.vercel.app`, runtime `7dce1c9` idêntico ao head validado: instrutor consultou a fixture 24, original arquivada e revisão 2 ativa. Catálogo com 798 registros; campos da ficha e exercício preservados, incluindo notas, carga explicitamente vazia, duas séries, faixa 8–12 e pausa 120 segundos. Em 375 px, corpo 375, diálogo 311, formulário 263 e rodapé 309. Editor cancelado sem salvar.
- Produção `fit-flow-8ugq771s2-eznrbs-projects.vercel.app` READY, metadados `main/8447d15`; JavaScript alterado igual ao blob Git, saúde/banco aprovados. Não se provocou gravação incerta no banco publicado; essa recuperação foi exercitada nos testes.
- Logs privados completos: `server/tmp/editor-recovery-ci-{red-45206924344,green-45207341033}.log`, `server/tmp/editor-recovery-fixtures-green.log`, `server/tmp/editor-read-browser-20261123.json` e `server/tmp/editor-recovery-production-proof-20261123.json`.

## Evidência e limites

### Limpeza de implementação duplicada

A investigação do GET sem prazo em `MeuTreinoView` confirmou que `meu-treino` não pertence a nenhum dos três menus permitidos por `App.navigateTo`. Foram removidos somente essa view duplicada, seu template/título e inicializador, além de uma exposição não utilizada no harness de testes. A tela atual `aluno-treino`, seus registros avulsos, a API e os dados persistidos não foram alterados. Busca nas fontes e testes não encontrou referências restantes à implementação removida. Os 69 testes focados de treino, acesso do aluno e painel passaram com Node 24; log privado `server/tmp/unused-training-view-green-20261123.log`. Essa limpeza não encerra as pendências gerais e não justifica excluir documentação histórica ou migrations.

Registros locais em `server/tmp/account-keyboard-preview-20261123.json`, `server/tmp/reports-browser-20261123.json` e `server/tmp/nutrition-invalid-browser-20261123.json`. Não contêm senhas; ficam fora da distribuição Git. A revisão não cobre todos os limites, métodos, idiomas, erros ou tipos de dispositivo. Não equivale a certificação WCAG nem substitui M01–M14 em telefone físico.
