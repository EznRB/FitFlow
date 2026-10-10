# IA educativa com GPT-OSS e Groq Free

Escolha revisada em 09/10/2026 após o pedido de um modelo aberto ou serviço gratuito. O adaptador está implementado; uma geração real ainda exige conta Free, chave e quota disponíveis. Não habilitar plano pago para concluir a demonstração.

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

O código solicita `include_reasoning: false`, `reasoning_effort: low`, `stream: false` e `service_tier: on_demand`, conforme a [API](https://console.groq.com/docs/api-reference) e [parâmetros de raciocínio](https://console.groq.com/docs/reasoning). `on_demand` é o tier de execução padrão, não uma comprovação de gratuidade.

## Alternativas pesquisadas

Gemini permanece como adaptador alternativo explícito; não é ativado automaticamente. Vercel AI Gateway foi pesquisado, mas não foi integrado nem comprado. GitHub Models foi descartado porque a [documentação oficial](https://docs.github.com/en/github-models) informa a aposentadoria completa em 30/07/2026. Credenciais Git/GitHub não devem ser usadas para inferência.

Os testes locais e a revisão independente usam provedor simulado. Até a execução real, eles comprovam contrato, privacidade, erros e validação, não disponibilidade nem qualidade factual da geração da conta.
