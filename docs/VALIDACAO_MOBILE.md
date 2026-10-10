# Validação em telefone físico

Revisão: 10 de outubro de 2026. **Roteiro preparado; execução em telefone físico ainda não realizada.** Os testes automatizados, a emulação de viewport e os testes locais de fila já registrados em [STATUS_ENTREGA.md](STATUS_ENTREGA.md) não substituem esta validação.

## Ambiente e preparação

Usar o endereço HTTPS canônico: [FitFlow publicado](https://fit-flow-indol.vercel.app/). Registrar o commit e a implantação efetivamente publicados no início de cada execução, consultando o status de entrega. Não usar a landing page, `localhost` ou uma implantação anterior como evidência do aplicativo atual.

1. Registrar modelo do telefone, versão do Android/iOS, navegador e versão, data/hora com fuso, idioma, orientação e rede utilizada. Usar perfil normal, sem navegação privada.
2. Preparar duas contas **fictícias** de aluno, A e B, com matrículas válidas e fichas identificáveis. Reservar uma sessão de teste de A; não assumir o controle de uma sessão pessoal já em andamento. Credenciais ficam no armazenamento privado.
3. Definir um identificador único, por exemplo `MOBILE-20261010-01`. Usar notas como `<identificador>-OFFLINE-A`, `-RELOAD`, `-STAY`, `-SYNC` e `-DISCARD`. Cada caso deve ter sua própria série. Os valores abaixo são dados sintéticos de teste, sem recomendação de treino.
4. Antes de começar, conferir que não há envios pendentes de uso real. Concluir sua sincronização antes de trocar de conta, instalar outra superfície ou iniciar o roteiro. Se houver fila com erro, preservar os registros e interromper a preparação.
5. Carregar o aplicativo online, permitir a preparação dos recursos públicos e reabrir online antes de criar pendências. Se houver aviso de falha na preparação offline, registrar e resolver antes de M06. Abrir **Sessões e séries**, confirmar a ficha e iniciar a sessão de teste online, aguardando sua confirmação. Registrar o estado inicial e o ID da sessão quando disponível.
6. Preparar uma observação somente de leitura dos IDs locais/remotos para M04. Sem esse acesso, executar os casos visuais e deixar a verificação exata de UUID como **NÃO FEITO**.

Testar a aba do navegador e o aplicativo instalado em execuções separadas. Não presumir que compartilham cookies ou a mesma fila. Sincronizar a execução anterior antes de trocar de superfície e registrar onde cada caso foi executado.

## Instalação

### Android / Chrome

Com conexão, abrir o endereço canônico no Chrome. No menu de três pontos, seguir **Instalar e criar atalho → Instalar** e concluir a confirmação. Abrir pelo ícone criado, conferir nome/ícone e registrar se abre como aplicativo independente ou como atalho em uma aba. Se aparecer uma opção diferente, registrar o texto e a versão do navegador. O botão de instalação do FitFlow pode abrir o prompt do navegador ou instruções; sua presença não comprova instalação. [Instruções oficiais do Google](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=pt-BR).

### iPhone / Safari

Abrir o endereço canônico no Safari. Usar o menu da página e compartilhar, ou o botão de compartilhamento conforme o layout. Selecionar **Adicionar à Tela de Início**, ativar **Abrir como App da Web** quando disponível e confirmar. Se a ação não estiver na lista, procurar em Editar Ações. Abrir pelo ícone e registrar o comportamento e a versão do iOS. Não atribuir ao FitFlow notificações ou recursos que não foram implementados. [Instruções oficiais da Apple](https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios).

## Contrato que o roteiro verifica

O service worker guarda uma lista restrita de recursos públicos e a página de indisponibilidade. Ele não guarda respostas de `/api`, `/auth` ou a página autenticada para permitir novo login offline. A fila de sessões/séries usa IndexedDB, separada por conta; não é o cache público do service worker.

Uma aba já carregada e autenticada pode registrar séries no dispositivo durante a desconexão. Uma recarga ou nova navegação offline deve mostrar o fallback público, sem nome, ficha ou histórico privados. A recuperação da fila exige conexão e validação da mesma conta no servidor. Instalar a PWA não transforma todo o sistema em um aplicativo offline.

Referências da implementação: [service worker](../client/sw.js), [fallback](../client/offline.html), [fila](../client/js/training-store.js), [tela de séries](../client/js/sessoes.js), [instalação e saída](../client/js/pwa.js) e [autenticação](../client/js/auth.js).

## Matriz de execução

Preencher a coluna de resultado com **PASS**, **FAIL** ou **NÃO FEITO**, incluindo o identificador da evidência. PASS exige observar o resultado esperado no aparelho indicado. Executar novamente para cada plataforma/superfície que se pretende declarar validada.

| Caso | Ação concreta | Resultado esperado / evidência necessária | Resultado inicial |
| --- | --- | --- | --- |
| M01 — acesso | Entrar como A pelo HTTPS canônico; abrir Sessões e séries. | Login validado online, ficha correta, controles utilizáveis por toque. Foto/captura com identificação fictícia e versão da implantação. | NÃO FEITO |
| M02 — instalação | Seguir o procedimento Android ou iPhone acima; abrir o ícone. | Ícone e nome corretos; registrar modo de abertura, eventual novo login e plataforma. Um atalho não deve ser registrado como instalação independente. | NÃO FEITO |
| M03 — série offline | Na aba/app já aberto, interromper apenas a conexão do telefone; salvar **uma vez** série de trabalho com 17 kg, 9 repetições, RIR 2 e nota `-OFFLINE-A`. | Mensagem de gravação local, valores visíveis, série marcada **Salva no dispositivo** e envio pendente. Ainda não chamar isso de persistência remota. | NÃO FEITO |
| M04 — UUID e reconexão | Registrar IDs locais antes de reconectar; restaurar a rede do telefone e usar Sincronizar. Após confirmação, usar Sincronizar mais uma vez. | Mesmo UUID da série enviado e retornado; exatamente uma série remota com a nota/valores; fila sem pendências. Registro de leitura descrito abaixo. | NÃO FEITO |
| M05 — conclusão e recarga | Com fila sincronizada, finalizar a sessão; recarregar online e reabrir o histórico. | Uma série `-OFFLINE-A`, valores preservados e 153 kg·reps de carga externa × repetições dessa série. Conclusão confirmada sem inventar séries não realizadas. | NÃO FEITO |
| M06 — recarga offline | Em nova sessão de teste, salvar uma série `-RELOAD` offline e confirmar gravação local; somente então recarregar sem conexão. | Fallback público acessível, sem nome/ficha/histórico privados. Não exibir acesso autenticado restaurado offline. Preservar IDs locais da série para a etapa seguinte. | NÃO FEITO |
| M07 — recuperação posterior | Restaurar conexão; usar Tentar reconectar e, se solicitado, entrar novamente como A. Sincronizar. | Mesma série `-RELOAD` recuperada do dispositivo e confirmada uma vez no servidor; identidade validada online. | NÃO FEITO |
| M08 — permanecer | Salvar série `-STAY` offline; tocar sair e escolher **Continuar no aplicativo**. | Diálogo informa pendências; conta continua aberta e série/fila permanecem. Reconectar e sincronizar antes de encerrar o caso. | NÃO FEITO |
| M09 — sincronizar e sair | Salvar série `-SYNC` offline; escolher **Sincronizar e sair**. Depois reconectar e repetir a ação quando necessário. | Sem confirmação de todos os envios, saída não prossegue. Online, sincronização precede saída; reentrada como A encontra a série uma vez. | NÃO FEITO |
| M10 — descarte explícito | Somente após M04–M09 confirmados, criar uma série descartável `-DISCARD` offline; conferir que a fila contém apenas os envios descartáveis e escolher **Sair e apagar N envio(s)**. | Aviso explícito de perda local; fila daquela conta apagada, sem apagar séries já confirmadas no servidor. Reentrada online não recria a série descartada. Se a saída do servidor ficar pendente, deve ser informada e concluída ao reconectar. | NÃO FEITO |
| M11 — isolamento | Com toda fila útil de A sincronizada, sair e entrar como B no mesmo contexto; depois voltar a A. | B vê apenas seus próprios dados, sem ficha/histórico de A ou sincronização em nome de A. A continua vendo seus registros remotos. Não usar descarte para preparar esse caso. | NÃO FEITO |
| M12 — teclado real | Preencher carga decimal, repetições, RIR e nota usando o teclado do telefone. Testar campo obrigatório vazio antes de enviar; fechar o teclado. | Teclado adequado, valores interpretados corretamente no idioma usado, erro legível e botão alcançável. Registrar como o separador decimal foi digitado e o valor efetivamente salvo. | NÃO FEITO |
| M13 — rotação e navegação | Com uma nota ainda em digitação, alternar retrato/paisagem e voltar. Navegar pelo menu e abrir/fechar modal sem enviar o formulário. | Conteúdo e ações acessíveis, sem perda do texto pela rotação, sobreposição ou rolagem horizontal da página inteira. Registrar orientação e área problemática se houver. | NÃO FEITO |
| M14 — tabelas e ampliação | Em conta administrativa fictícia autorizada, consultar alunos/relatórios sem editar dados. Rolar tabelas e ampliar o texto nas opções do aparelho. | Colunas/ações alcançáveis no contêiner, cabeçalhos legíveis, modal não encobre ações essenciais. Não substituir teste de aluno pelo papel administrativo. | NÃO FEITO |

Para M03/M06/M08/M09/M10, anotar as configurações de Wi-Fi e dados móveis e interromper **somente a rede do telefone**, mantendo a página aberta até confirmar o salvamento. Evitar conexão alternativa automática; registrar como a ausência de rede foi confirmada. Restaurar as configurações anteriores ao terminar. Não desligar o roteador nem a rede do computador. Não limpar dados do navegador, desinstalar o aplicativo ou apagar IndexedDB para resolver falhas.

## Como comprovar UUID e ausência de duplicação

O ID da operação de fila e o ID da série são diferentes. Para M04, comparar **`payload.id` da operação de série** com o ID da série devolvido pelo servidor; não comparar o ID da operação.

1. Antes de reconectar, inspecionar somente a conta fictícia A no banco IndexedDB `fitflow-training-v1`, store `accounts`, chave `userId`. Localizar a sessão de teste e a operação de série pela nota única. Registrar `sessionId`, `payload.id`, nota e valores. Não editar nem remover entradas.
2. Acompanhar a requisição de sincronização dessa série e a resposta, sem exportar cookies, cabeçalhos de autenticação ou HAR completo. Conferir que a identidade da série permanece a mesma.
3. Após sincronização e repetição do botão, conferir a sessão recente em **GET `/api/sessoes/mine`**, usando a autenticação normal da própria conta A. O responsável técnico pode realizar a consulta somente de leitura. Filtrar pela sessão e pela nota: deve haver exatamente uma série com o UUID registrado, 17 kg, 9 repetições e RIR 2.
4. Anexar um extrato mínimo contendo apenas IDs da fixture, contagem e valores. Se só houver capturas da interface, registrar aprovação visual separadamente e deixar M04 **NÃO FEITO** até comprovar o UUID.

No Android, uma opção é a inspeção remota oficial pelo Chrome do computador: depuração USB autorizada pelo proprietário do telefone, `chrome://inspect#devices`, descoberta USB e inspeção da aba correta. O guia inclui ajustes de drivers no Windows; não se deve concluir que o aparelho está indisponível pela ausência de uma ferramenta instalada. Usar a inspeção apenas para leitura dos dados da fixture. [Guia oficial de inspeção Android](https://developer.chrome.com/docs/devtools/remote-debugging?hl=pt-br).

No iPhone, se não houver inspeção compatível disponível, registrar a limitação e manter a comparação prévia do UUID pendente. A leitura remota após sincronização ajuda a contar registros, mas sozinha não comprova o UUID que existia no telefone antes do envio.

Não tocar novamente em **Salvar série** para tentar retransmitir: esse botão registra outra série legítima com outro UUID. Para reenviar o registro já salvo, usar **Sincronizar**.

## Registro da execução e falhas

Criar um registro por dispositivo e superfície. Estado inicial de todos os casos: NÃO FEITO.

```text
Execução / responsável:
Data, hora e fuso:
URL canônica / commit publicado / implantação:
Telefone / sistema / navegador e versões:
Superfície: aba normal | aplicativo instalado | atalho
Idioma / orientação / tamanho de texto:
Rede inicial / forma de desconexão / rede restaurada:
Conta fictícia A / B: IDs internos, sem credenciais
Sessão de teste / UUID da série / nota única:
Caso: M__
Resultado: PASS | FAIL | NÃO FEITO
Observado / tempo até resposta / contagem remota:
Evidência: arquivo ou extrato mínimo sem segredos
Pendência / revisão em que será repetido:
```

Em falha de sincronização, preservar a fila e sua evidência, registrar a mensagem/tempo observado, restaurar a rede e tentar autenticação da mesma conta. Não declarar sucesso por aparecer conexão disponível; esperar confirmação da série pelo servidor. Se a sessão expirar, a fila deve permanecer para recuperação pela mesma conta, sem autorizar acesso offline; um teste provocado de expiração deve ser planejado em ambiente controlado, sem manipular sessões de outros usuários na produção.

Não remover registros publicados como parte deste roteiro. Identificar os registros sintéticos e mantê-los auditáveis. Eventual limpeza exige um procedimento guardado por IDs exatos, ownership e escopo de teste; não usar reset global, reseed ou exclusão por uma nota genérica.

## Critério para encerrar a pendência mobile

Registrar instalação e os casos aplicáveis em telefone físico, com evidência da revisão publicada. A plataforma não disponível permanece **NÃO FEITO** e deve constar no escopo da entrega; aprovação em Android não comprova iPhone, nem a aba comprova o aplicativo instalado. A reconexão publicada exige M03–M07, incluindo o mesmo UUID e um único registro remoto. Os casos de saída, isolamento e uso real por toque/teclado devem ter seus resultados documentados.

Esta validação encerra apenas os gates mobile registrados; não declara concluídas as outras pendências do projeto. Consultar [revisão final](REVISAO_FINAL.md) e [status de entrega](STATUS_ENTREGA.md) para o conjunto da entrega.
