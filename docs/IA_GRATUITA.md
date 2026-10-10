# IA educativa com GPT-OSS e Groq Free

Escolha revisada em 10/10/2026 após o pedido de um modelo aberto ou serviço gratuito. O adaptador está implementado e a geração real foi verificada localmente. O console da organização confirmou plano **Free, US$ 0**. Não habilitar plano pago para concluir a demonstração.

## Estado verificado

- GPT-OSS 120B via Groq gerou uma explicação real do tema `divisoes` localmente em aproximadamente 1,2 segundo.
- O conteúdo foi conferido contra Ramos-Campo et al. (2024) e ACSM (2026), fontes primárias do corpus. Essa conferência valida a amostra examinada, não toda resposta futura.
- Chave privada e `GROQ_FREE_TIER_CONFIRMED=true` foram configuradas no backend da Vercel para Production e Preview. Não houve contratação de plano pago.
- A implantação `3adf5c1` está READY com alias canônico e CI aprovados. O navegador publicado restaurou a sessão, mostrou os botões habilitados e gerou uma explicação real de divisões, conferida contra as referências.
- Na revisão `9e1b5c5`, nutrição também teve geração real publicada e amostra inspecionada contra Mifflin, Harris–Benedict revisada, Morton e DRI; captura 30. A amostra usou “metabolismo basal” onde as equações empregadas estimam repouso. Essa limitação terminológica foi registrada e exige ajuste; não se declara certificação factual integral. Não houve cálculo ou prescrição individual pela IA.
- **Volume: duas reprovações factuais.** A amostra `3adf5c1` confundiu séries com tonelagem. O contexto foi reforçado em `9e1b5c5`, mas a nova resposta pública confundiu séries previstas com repetições. A revisão `f9ac83d` substitui esse tema por glossário revisado determinístico, sem chamada externa; READY/CI e navegador publicados confirmados, captura 32. Geração HTTP e testes de contrato aprovados não certificam conteúdo científico.
- A revisão atual ajusta o prompt nutricional para distinguir gasto em repouso e basal. A captura 30 preserva a amostra anterior com limitação registrada; o ajuste não é promessa de correção factual automática de toda resposta futura.

## Escolha e limites

O [GPT-OSS](https://github.com/openai/gpt-oss) tem pesos abertos sob Apache 2.0. A inferência ocorre na Groq: não exige Docker, virtualização ou GPU no computador. O modelo configurado é `openai/gpt-oss-120b`; o adaptador também aceita `openai/gpt-oss-20b`, somente por configuração explícita, sem fallback automático.

Os dois modelos suportam [JSON Schema estrito](https://console.groq.com/docs/structured-outputs). Formato e IDs válidos não comprovam a veracidade de cada frase. A interface identifica o conteúdo como IA e mantém as referências originais para conferência. Fórmulas e indicadores continuam determinísticos; a IA não prescreve dieta, exercício ou carga.

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
GROQ_API_KEY=CHAVE_PRIVADA_DO_SERVIDOR
GROQ_FREE_TIER_CONFIRMED=true
```

A flag `GROQ_FREE_TIER_CONFIRMED` registra a conferência do operador: não consulta faturamento nem transforma uma conta paga em gratuita. Mantê-la `false` enquanto o plano não estiver confirmado. Não criar variáveis com prefixo público/Vite; a chave nunca pertence ao cliente. Variáveis Vercel novas exigem novo deploy para afetar a função.

## Verificação de ativação

Após configurar conta/chave e publicar:

1. Fazer login e consultar Fundamentos; `/api/ia/status` deve informar `enabled: true` e `provider: groq`, sem devolver chave ou modelo.
2. Gerar uma explicação de um tema disponível, conferir afirmações contra as referências e registrar o resultado sem segredos.
3. Conferir quota e plano no console. Não repetir solicitações para contornar 429; não trocar automaticamente para provedor ou modelo pago.

Somente o tema e resumos do corpus curado são enviados. Peso, altura, idade, dieta, histórico de treino, identidade e texto livre do aluno não entram na requisição. Endpoint fixo, redirects recusados, timeout de 15 segundos, saída limitada e validação backend protegem o contrato. Erros não expõem resposta bruta do provedor, chave ou raciocínio interno.

## Indicadores: conteúdo revisado, sem inferência

O tema `volume` não é enviado ao modelo. O botão **Entender indicadores** consulta um glossário fixo revisado; a API retorna `generatedByAI: false`, e a interface informa que o texto não foi gerado por IA. Funciona mesmo sem chave de provedor, mas exige autenticação e papel permitido.

O glossário distingue séries previstas, repetições por série, séries de trabalho e tonelagem. Aquecimentos ficam separados; valores ausentes não são zero nem preenchidos pela ficha; finalizar não inventa execução. Tonelagem não mede hipertrofia, estímulo ou trabalho mecânico, e sua comparação exige condições compatíveis.

As definições dos campos pertencem ao FitFlow. A referência ACSM fornece contexto científico geral e é identificada separadamente; não é apresentada como autora dessas definições. Esse caminho é uma consulta de conteúdo fixo, não fallback automático de uma geração que falhou.

Somente divisões e nutrição mantêm inferência externa, com quota de dez solicitações por usuário a cada quinze minutos. O glossário dispensa a quota de inferência; autenticação, autorização, CSRF e proteção global da API continuam aplicados. A revisão focada de IA passou em 19/19 e a suíte integral em 309/309 no código `f9ac83d`.

O código solicita `include_reasoning: false`, `reasoning_effort: low`, `stream: false` e `service_tier: on_demand`, conforme a [API](https://console.groq.com/docs/api-reference) e [parâmetros de raciocínio](https://console.groq.com/docs/reasoning). `on_demand` é o tier de execução padrão, não uma comprovação de gratuidade.

## Alternativas pesquisadas

Gemini permanece como adaptador alternativo explícito; não é ativado automaticamente. Vercel AI Gateway foi pesquisado, mas não foi integrado nem comprado. GitHub Models foi descartado porque a [documentação oficial](https://docs.github.com/en/github-models) informa a aposentadoria completa em 30/07/2026. Credenciais Git/GitHub não devem ser usadas para inferência.

Os testes automatizados e a revisão independente usam provedor simulado para contrato, privacidade, erros e validação. Amostras reais de divisões e nutrição acrescentam evidência de disponibilidade naquele momento e foram inspecionadas com os limites descritos; não garantem respostas futuras, quota contínua ou gratuidade se o operador mudar o plano.
