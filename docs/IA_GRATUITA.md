# IA educativa com GPT-OSS e Groq Free

Escolha revisada em 11/10/2026 após o pedido de um modelo aberto ou serviço gratuito. O adaptador está implementado e a geração real foi verificada localmente. O console da organização confirmou plano **Free, US$ 0**. Não habilitar plano pago para concluir a demonstração.

## Chat contextual publicado — 11/10/2026

Fundamentos oferece mensagens livres, rascunhos segundo dias, tempo e equipamentos informados e perguntas de continuação. O navegador publicado gerou uma rotina em `5e4ec38`; preservada essa conversa e a interface, a continuação foi atendida em `943d495`. As contagens de peito (6 séries em 2 dias) e costas (9 em 2 dias), as três referências e os limites científicos foram conferidos nesta amostra. Não é certificação de doses individuais ou respostas futuras. [Publicação, CI e capturas](STATUS_ENTREGA.md).

Uma continuação anterior foi recusada; sua causa exata não foi comprovada. A revisão atual alinha a resposta ao limite de 6.000 caracteres da interface: unidades completas, ressalvas preservadas e aviso explícito de tópicos omitidos. Os links representam somente fontes exibidas. Logs de validação contêm códigos fixos e etapa, sem conversa ou chave. A suíte integral passou em 401/401, sem migration ou dependência nova.

A IA organiza conteúdo científico curado e calcula contagens a partir das declarações do rascunho. Não faz pesquisa científica aberta em cada resposta. O histórico fica apenas em memória; recarga, logout ou troca de sessão removem a conversa. Nenhuma ficha é aplicada automaticamente.

## Contrato de contexto e esclarecimentos — 12/10/2026

Publicado em `0b8d5d8`; implantação/CI em [Estado da entrega](STATUS_ENTREGA.md). O classificador usa `message: {reason, fields}` internamente para `clarification`. O servidor monta perguntas em português a partir desses enums; fontes, prosa científica e campos adicionais do modelo não são apresentados nessa variante. A API externa continua retornando `message` string, `kind`, `generatedByAI` e `sources`, compatível com a interface. União de formatos `anyOf` segue o subconjunto do [JSON Schema documentado pela Groq](https://console.groq.com/docs/structured-outputs), conferido em 12/10/2026 e testado com o provedor real.

O rascunho confere objetivo e confirmação adulta saudável declarativa/positiva, negações explícitas, dias e equipamentos disponíveis. Uma declaração posterior do mesmo campo invalida citações anteriores; reconfirmação recente permite continuar. Pergunta ou incerteza sobre o próprio escopo, declaração explícita de lesão e contradição detectada produzem esclarecimento controlado, sem diagnóstico, geração adicional automática ou aplicação de ficha. Negar força e afirmar hipertrofia no mesmo turno não nega o objetivo afirmativo. Os padrões textuais são conservadores e limitados; não certificam interpretação universal de linguagem, ausência de condições clínicas ou adequação individual.

As falhas anteriores foram reproduzidas em memória com provedor simulado: escopo negado aceito, objetivo incompatível, correção posterior ignorada e prosa científica livre escapando por `clarification`. Dezesseis casos novos, incluindo as regressões encontradas na revisão independente, passaram por RED → GREEN. Subsuíte IA **109/109**; suíte completa nativa **603/603**, zero falhas/ignorados. Os totais focados estão incluídos no integral.

Duas amostras fictícias reais no serviço local usaram a chave privada já configurada, Groq Free e os mesmos modelos, sem plano pago: falta de rotina retornou perguntas de dias/tempo (217 caracteres, nenhuma fonte); contexto completo retornou rascunho de três dias (4.514 caracteres), fontes curadas e contagens/logística calculadas pelo servidor. Disponibilidade segunda/quarta/sexta, 50 minutos e equipamentos declarados foram respeitados na amostra; estimativas de 39/38/39 minutos têm hipóteses explícitas e não garantem duração real. Doses/grupos são interpretação revisável, não prescrição certificada. Esses testes diretos do serviço não são prova de HTTP/browser publicado; o gate de publicação é separado.

## Histórico de verificações anteriores

### Correção de capitalização — 13/10/2026

Após as duas mensagens aprovadas no browser publicado de `0b8d5d8`, uma correção fictícia para terça/35 minutos/halteres sem banco ou barra foi recusada. A mensagem ficou preservada; nenhuma ficha foi aplicada. [Captura da recusa](evidence/127-chat-correcao-recusada-vercel.jpg). O replay no serviço local com os mesmos textos reproduziu 502 na verificação de autoria: o modelo citou “Meu objetivo é hipertrofia”, enquanto o usuário havia escrito “meu objetivo é hipertrofia”. Os demais cinco trechos eram literais.

A canonicalização agora tolera somente caixa e conserva o trecho exato mais recente do usuário em uma cópia do contexto. Não remove acentos/palavras/pontuação, não aceita paráfrase ou citação do assistente e mantém as verificações de negação/contradição. Dois novos casos passaram por RED → GREEN; um terceiro protege autoria/negação. O replay puro do mesmo JSON antes recusado passou com terça/35 minutos e input original intacto. Suíte integral **606/606**, sem falhas/ignorados, após retomar o MariaDB nativo existente; uma tentativa anterior teve 605 aprovados e um gate nativo indisponível porque o processo do banco estava encerrado. Não houve reinicialização do banco. Publicação e verificação real posteriores serão registradas no estado da entrega.

- GPT-OSS 120B via Groq gerou uma explicação real do tema `divisoes` localmente em aproximadamente 1,2 segundo.
- O conteúdo foi conferido contra Ramos-Campo et al. (2024) e ACSM (2026), fontes primárias do corpus. Essa conferência valida a amostra examinada, não toda resposta futura.
- Chave privada e `GROQ_FREE_TIER_CONFIRMED=true` foram configuradas no backend da Vercel para Production e Preview. Não houve contratação de plano pago.
- A implantação `3adf5c1` está READY com alias canônico e CI aprovados. O navegador publicado restaurou a sessão, mostrou os botões habilitados e gerou uma explicação real de divisões, conferida contra as referências.
- Na revisão `9e1b5c5`, nutrição também teve geração real publicada e amostra inspecionada contra Mifflin, Harris–Benedict revisada, Morton e DRI; captura 30. A amostra usou “metabolismo basal” onde as equações empregadas estimam repouso. Essa limitação terminológica foi registrada e exige ajuste; não se declara certificação factual integral. Não houve cálculo ou prescrição individual pela IA.
- **Volume: duas reprovações factuais.** A amostra `3adf5c1` confundiu séries com tonelagem. O contexto foi reforçado em `9e1b5c5`, mas a nova resposta pública confundiu séries previstas com repetições. A revisão `f9ac83d` substitui esse tema por glossário revisado determinístico, sem chamada externa; READY/CI e navegador publicados confirmados, captura 32. Geração HTTP e testes de contrato aprovados não certificam conteúdo científico.
- A revisão atual ajusta o prompt nutricional para distinguir gasto em repouso e basal. A captura 30 preserva a amostra anterior com limitação registrada; o ajuste não é promessa de correção factual automática de toda resposta futura.

## Escolha e limites

O [GPT-OSS](https://github.com/openai/gpt-oss) tem pesos abertos sob Apache 2.0. A inferência ocorre na Groq: não exige Docker, virtualização ou GPU no computador. As explicações legadas usam `GROQ_MODEL`, configurado em `openai/gpt-oss-120b`. O chat usa `GROQ_CHAT_MODEL`, padrão `openai/gpt-oss-20b`, para classificar e esclarecer. Respostas gerais são organizadas por `openai/gpt-oss-120b` mediante seleção de conteúdo do corpus e ações controladas; o texto candidato da primeira etapa é descartado. Esses papéis são definidos antes da solicitação, sem troca de modelo após erro ou quota.

Os dois modelos suportam [JSON Schema estrito](https://console.groq.com/docs/structured-outputs). Formato e IDs válidos não comprovam a veracidade de cada frase. A interface identifica o conteúdo como IA e mantém as referências originais para conferência. Fórmulas e indicadores continuam determinísticos. O chat pode sugerir uma divisão educativa para revisão, mas não aplica fichas, não escolhe carga em kg e não prescreve dieta ou treino clínico.

Os [limites publicados do Free](https://console.groq.com/docs/rate-limits) consultados foram 30 requisições/minuto, 1.000/dia, 8.000 tokens/minuto e 200.000/dia para ambos os modelos. Confirmar os limites efetivos da organização no console; são compartilhados pela conta e podem mudar. O FitFlow limita solicitações por usuário, mas esse contador não determina o plano ou a quota do provedor.

## Preparação privada

1. Entrar em [GroqCloud](https://console.groq.com/keys) e concluir os termos na própria conta.
2. Confirmar o plano **Free** nas configurações da organização. Não adicionar pagamento nem contratar Developer para esta entrega.
3. Criar a chave e guardá-la em `server/.env.ia.local`, que está ignorado pelo Git. Nunca enviá-la por chat, screenshot ou commit.

```dotenv
GROQ_API_KEY=COLOQUE_A_CHAVE_SOMENTE_NO_ARQUIVO_LOCAL
```

Esse arquivo é um recipiente privado de configuração; não é carregado automaticamente pelo aplicativo. Não executar wrappers de banco com esse arquivo nem alterar `DATABASE_URL`. A ativação exige configurar explicitamente estas variáveis no backend local ou nas Functions da Vercel:

```dotenv
IA_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-120b
GROQ_CHAT_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=CHAVE_PRIVADA_DO_SERVIDOR
GROQ_FREE_TIER_CONFIRMED=true
```

A flag `GROQ_FREE_TIER_CONFIRMED` registra a conferência do operador: não consulta faturamento nem transforma uma conta paga em gratuita. Mantê-la `false` enquanto o plano não estiver confirmado. Não criar variáveis com prefixo público/Vite; a chave nunca pertence ao cliente. Variáveis Vercel novas exigem novo deploy para afetar a função.

## Verificação de ativação

Após configurar conta/chave e publicar:

1. Fazer login e consultar Fundamentos; `/api/ia/status` informa disponibilidade das explicações em `enabled` e do chat em `chatEnabled`, além de `provider: groq`, sem devolver chave ou modelo. Chat exige Groq Free configurada; outro adaptador de explicações não o ativa.
2. Gerar uma explicação de um tema disponível, conferir afirmações contra as referências e registrar o resultado sem segredos.
3. Conferir quota e plano no console. Não repetir solicitações para contornar 429; não trocar automaticamente para provedor ou modelo pago.

Na rota legada `/explicar`, somente o tema e os resumos do corpus são enviados. Peso, altura, idade, dieta, histórico de treino, identidade e texto livre não são anexados nessa rota. Endpoint fixo, redirects recusados, timeout de 15 segundos, saída limitada e validação backend protegem esse contrato. Erros não expõem resposta bruta do provedor, chave ou raciocínio interno.

## Chat de treinamento em Fundamentos

O fluxo principal é uma conversa: perguntas sobre hipertrofia e exercícios, esclarecimentos e proposta de divisão baseada na rotina informada. As referências e o glossário permanecem em conteúdo secundário revisado. Visitantes do laboratório público acessam as fontes e um link para entrar; não recebem um chat autenticado inativo.

1. Confirmar o envio das mensagens e da rotina digitada à Groq. Evitar nomes, contatos e informações de saúde. O servidor não busca nem envia dados do perfil, medidas, ficha ou histórico do aplicativo.
2. Perguntar livremente ou pedir uma proposta. O assistente deve esclarecer dias e distribuição semanal, duração, equipamentos, experiência, objetivo e escopo adulto saudável antes de montar o rascunho.
3. Continuar a discussão com o histórico da conversa. O frontend envia somente mensagens de usuário/assistente; papéis de sistema e campos adicionais são recusados. Fontes são resolvidas no servidor por IDs do corpus, e a interface usa texto simples.
4. Conferir a proposta com o instrutor. Ela não altera fichas ou registros. Parâmetros iniciais são escolhas práticas ajustáveis, não doses ótimas comprovadas para uma pessoa.

O histórico e o texto digitado ficam apenas na memória da página autenticada: permanecem ao visitar outra tela e voltar, mas são removidos na recarga, na saída e na troca de sessão/conta. Não há armazenamento de conversas no Neon nem sincronização de chat entre aparelhos. Essa limitação não altera a persistência separada dos registros de treino.

O contrato aceita até 16 mensagens, 2.000 caracteres por pergunta, 6.000 por resposta e 12.000 no contexto total. Quando o contexto ultrapassa esses limites, o frontend retira pares antigos e avisa; informações importantes podem precisar ser repetidas. Falhas preservam a pergunta, e reenvio não duplica o turno na interface. A primeira etapa compacta apenas rascunhos reconhecidos e recebe títulos/IDs, sem os resumos científicos que a segunda etapa já utiliza; a validação permanece contra as mensagens originais. Isso reduz contexto, mas não garante que toda conversa admissível caiba na quota de tokens do provedor. Uma chamada de homologação excedeu 8.000 TPM e recebeu 413; não se contornou a quota. O backend limita cada geração a 25 segundos, incluindo corpo da resposta; o cliente usa margem de 30 segundos. A quota do chat é dez solicitações por usuário a cada quinze minutos, compartilhada entre instâncias, além dos limites da Groq.

O corpus de treinamento inclui ACSM 2026, comparação split/full body e revisões de RIR, proximidade da falha e descanso. A indicação de fontes não certifica cada frase. A proposta estruturada tem contagens verificadas no backend; interpretações da rotina e escolhas de exercício ainda exigem revisão humana. Dias disponíveis não obrigam sessões em todos eles: o rascunho pode escolher um subconjunto, respeitando a preferência discutida. Não há migração de banco nem chamada paga automática.

Na homologação do novo chat, amostras iniciais foram reprovadas: contagens livres inconsistentes, equipamentos classificados incorretamente, extrapolações sobre dose e regras quantitativas de progressão sem suporte no corpus. Uma revisão inicial com 20B também repetiu erros de contagem e inventou justificativas. Esses resultados motivaram cálculo no servidor, grupos explícitos por exercício e revisão com 120B. Uma resposta aprovada não certifica gerações futuras; respostas livres continuam exigindo leitura crítica das fontes. O relatório de entrega registra somente as amostras efetivamente conferidas.

O fluxo publicado em `8dd7e66` produziu esclarecimento e rascunho reais, mas a pergunta de continuação encontrou erros do provedor. Em `363e23c`, uma nova tentativa chegou à validação de atribuições e foi recusada. A reprodução direta da segunda etapa respondeu corretamente ao mesmo contexto; isso não comprovava o fluxo HTTPS completo. O contrato seguinte substituiu a duplicação literal de afirmações por blocos com apoios e referências derivados no servidor. Uma amostra intermediária de blocos foi recusada por alterar palavras de uma citação; a revisão seguinte usa seleção de trechos originais por ID. Mesmo com IDs válidos, a primeira amostra desse protocolo acrescentou afirmações não sustentadas sobre suficiência/segurança de RIR para iniciantes e faixa de descanso; foi reprovada na leitura científica e motivou instruções específicas sobre esses limites. Resultados rejeitados não foram registrados como aprovação; consultar o estado da entrega para a revisão efetivamente homologada.

A segunda etapa seleciona e ordena blocos conforme a pergunta e o contexto: referências, contagens do rascunho, acompanhamento, progressão, limites e uma pergunta de continuação. A IA não escreve conclusões científicas livres nessa etapa. Para cada referência selecionada, o servidor apresenta o resumo curado completo, preservando incerteza, população e qualificadores; as fontes são resolvidas por IDs permitidos. Contagens e contribuições usam somente os grupos explicitamente declarados no rascunho, sem inferir anatomia por nome de exercício.

O schema usa seis variantes fechadas por `kind`, com `anyOf` compatível com a [documentação oficial da Groq](https://console.groq.com/docs/structured-outputs). Somente campos ativos pertencem a cada variante. Uma chamada real aceitou esse contrato, mas selecionou oito grupos e ultrapassou o limite agregado; a resposta foi recusada. O renderer passou a apresentar a ressalva comum das contagens uma única vez, mantendo a origem por exercício e todos os resumos completos. A reavaliação da seleção registrada validou a renderização; a homologação HTTPS da revisão atual está no estado da entrega.

As orientações de acompanhamento, progressão e limites são textos controlados do FitFlow, separados dos achados dos artigos. Perguntas de continuação são selecionadas conforme o assunto; pedidos de rotina recebem esclarecimentos e rascunhos conforme o contexto. O chat permanece uma conversa contextual, sem seleção obrigatória de dois temas. Questões que o corpus não cobre precisam permanecer como lacunas, sem transformar texto gerado em evidência.

A revisão científica de uma amostra identificou supino inclinado com halteres sem banco declarado: contagens corretas não bastavam para aprovar a rotina. O servidor agora exige banco para supino com pesos livres e Smith, salvo variação explicitamente no chão; máquina de supino com apoio próprio permanece distinta. O recurso também precisa constar no contexto disponível e em texto original do usuário. Mencionar genericamente uma academia não amplia a lista explícita de recursos; barra guiada é máquina, distinta da barra livre. Os testes cobrem a ausência do banco, declaração completa, supino no chão, máquina e esses aliases; não equivalem a uma validação anatômica de todos os exercícios.

Esse desenho substituiu síntese científica livre: mesmo com trechos válidos e maior nível de raciocínio, amostras acrescentaram conclusões não sustentadas sobre RIR, descanso, dose e tonelagem. Elas foram reprovadas. A interface informa que a IA organiza a resposta e que o conteúdo científico vem das referências do FitFlow. Isso não certifica a escolha do bloco, a classificação de cada exercício ou a adequação individual de uma rotina.

O histórico vem do cliente: reconhecer seu formato não comprova autoria, integridade ou execução. A segunda etapa não recebe uma resposta livre candidata da primeira. Raciocínio privado não é solicitado nem exibido. Esclarecimentos usam uma chamada; respostas gerais e rascunhos usam duas, na mesma conta gratuita. Erro, quota ou prazo recusa a resposta inteira, sem fallback ou retry automático. O servidor valida o plano contra o texto original e calcula suas contagens.

Na revisão `29fd5e2`, o primeiro pedido de rotina publicado foi recusado por formato. A reprodução controlada retornou `sessions` na raiz, fora de `program`. Uma tentativa de schema estrito completo com 20B também foi recusada pelo provedor: uma sessão veio como string JSON. O conteúdo rejeitado não foi recuperado. A arquitetura seguinte separou classificação/esclarecimento no 20B e geração da rotina no 120B. O classificador exige somente `kind`, `message` e `sourceIds`; o gerador exige o objeto não anulável context + sessions. A tentativa inicial de schema estrito no 120B também foi recusada (array na raiz); o gerador passou a JSON Object Mode, com validação completa no servidor. Uma amostra HTTP 200 foi recusada por nome de máquina e equipamento de polia inconsistentes; a orientação de variações foi explicitada. Nenhuma amostra rejeitada foi reaproveitada. Classificação e seleção geral exigem tipos, enums e objetos fechados no provedor. O gerador de rotina usa objeto JSON simples; estrutura, limites numéricos, tamanhos, unicidade e consistência com o texto original são obrigatórios no servidor. A indicação de schema estrito não é tratada como prova de que uma geração foi concluída.

## Indicadores: conteúdo revisado, sem inferência

O tema `volume` não é enviado ao modelo. O botão **Entender indicadores** consulta um glossário fixo revisado; a API retorna `generatedByAI: false`, e a interface informa que o texto não foi gerado por IA. Funciona mesmo sem chave de provedor, mas exige autenticação e papel permitido.

O glossário distingue séries previstas, repetições por série, séries de trabalho e tonelagem. Aquecimentos ficam separados; valores ausentes não são zero nem preenchidos pela ficha; finalizar não inventa execução. Tonelagem não mede hipertrofia, estímulo ou trabalho mecânico, e sua comparação exige condições compatíveis.

As definições dos campos pertencem ao FitFlow. A referência ACSM fornece contexto científico geral e é identificada separadamente; não é apresentada como autora dessas definições. Esse caminho é uma consulta de conteúdo fixo, não fallback automático de uma geração que falhou.

Na rota legada `/explicar`, divisões e nutrição mantêm inferência externa, com quota de dez solicitações por usuário a cada quinze minutos. O chat tem contador próprio `ia:chat`. O glossário dispensa a quota de inferência; autenticação, autorização, CSRF e proteção global da API continuam aplicados. A revisão focada de IA passou em 19/19 e a suíte integral em 309/309 na baseline `f9ac83d`.

A rota legada solicita `reasoning_effort: low`; a primeira etapa do chat usa `medium` e a seleção de resposta usa `medium`, com temperaturas 0,2 e 0,1. Todas solicitam `include_reasoning: false`, `stream: false` e `service_tier: on_demand`, conforme a [API](https://console.groq.com/docs/api-reference) e [parâmetros de raciocínio](https://console.groq.com/docs/reasoning). `on_demand` é o tier de execução padrão, não uma comprovação de gratuidade. A primeira etapa usa schema estrito plano de classificação. O gerador de rotina usa JSON Object Mode e referência com limites completos no prompt; o servidor exige context/sessions e valida integralmente o plano. A seleção de resposta usa um schema estrito separado de blocos tipados e IDs permitidos; não aceita prosa livre. O servidor valida ambas; formato não comprova interpretação ou veracidade. Campos indevidos ou planos inconsistentes são recusados. O classificador não aceita program; o gerador de rascunho exige o plano completo. Falhas do provedor são recusadas sem aproveitar o conteúdo rejeitado ou repetir a inferência automaticamente. Diagnósticos operacionais registram somente etapa, status HTTP, categoria fixa e código permitido; não registram pergunta, histórico, resposta bruta, chave ou identificadores do provedor. HTTP 413 tem mensagem própria sobre tamanho do contexto.

## Alternativas pesquisadas

Gemini permanece como adaptador alternativo explícito; não é ativado automaticamente. Vercel AI Gateway foi pesquisado, mas não foi integrado nem comprado. GitHub Models foi descartado porque a [documentação oficial](https://docs.github.com/en/github-models) informa a aposentadoria completa em 30/07/2026. Credenciais Git/GitHub não devem ser usadas para inferência.

Os testes automatizados e a revisão independente usam provedor simulado para contrato, privacidade, erros e validação. Amostras reais de divisões e nutrição acrescentam evidência de disponibilidade naquele momento e foram inspecionadas com os limites descritos; não garantem respostas futuras, quota contínua ou gratuidade se o operador mudar o plano.
