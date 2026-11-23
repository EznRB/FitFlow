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

## Evidência e limites

Registros locais em `server/tmp/account-keyboard-preview-20261123.json`, `server/tmp/reports-browser-20261123.json` e `server/tmp/nutrition-invalid-browser-20261123.json`. Não contêm senhas; ficam fora da distribuição Git. A revisão não cobre todos os limites, métodos, idiomas, erros ou tipos de dispositivo. Não equivale a certificação WCAG nem substitui M01–M14 em telefone físico.
