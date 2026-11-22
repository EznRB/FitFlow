# IA: catálogo e continuação da conversa — 11/11/2026

Código funcional: `83cd863dc42c29ae4bcdcf0b5ac1979a73abd8a3`, na branch `codex/science-ux-foundation`. Esta rodada está em revisão; não é comprovação de publicação em produção ou de conclusão do projeto.

## Alteração

1. O classificador seleciona uma variante fechada: resposta, esclarecimento ou contexto do rascunho. As citações pertencem aos textos originais do usuário; campos sem prova, contradições reconhecidas e correções posteriores são conferidos antes do gerador.
2. O servidor restringe o gerador aos dias e IDs de exercícios elegíveis para aquele contexto. O modelo fornece somente `exerciseId` e doses. O servidor resolve nome, categoria principal e equipamentos, sem aceitar metadados livres, inventar IDs ou substituir uma seleção inválida.
3. O [catálogo descritivo](../server/src/services/ia-exercise-variants.js), versão `2026-11-11.1`, contém 26 variantes, fontes HTTPS e requisitos adicionais explícitos. Banco genérico não comprova inclinação; máquina genérica não comprova supino; polia não comprova corda ou puxador. A declaração original completa é considerada para recursos específicos, não apenas um recorte afirmativo.
4. A validação local mantém limites inteiros, unicidade, disponibilidade e hipóteses logísticas. Ausência de variante elegível pede detalhe do equipamento, sem enviar um enum vazio ao gerador.
5. A apresentação informa as categorias principais representadas por sessão e as não representadas. Não converte participação indireta em séries diretas, não certifica cobertura anatômica nem usa tempo disponível como justificativa de dose.

O catálogo é uma camada editorial da IA, distinta dos exercícios persistidos na ficha. Não migra IDs históricos, não substitui o catálogo geral nem aplica uma ficha. As fontes descrevem movimentos e recursos; não demonstram a adequação individual ou a dose proposta. Não foram copiadas imagens ou descrições integrais.

## Verificação

- Suíte integral nativa: **853 aprovados, zero falhas, zero ignorados**, com MariaDB local em `127.0.0.1:3308`. A primeira execução identificou banco desligado; o caso integrado foi refeito após iniciar a instância e a execução integral final passou.
- Revisão independente encontrou e reproduziu acesso incerto, negação invertida, intenção de compra, confusão de acessório e contradição de idade. Correções passaram por regressões RED → GREEN. A revisão focada final não encontrou pendências nos casos apontados; não equivale a auditoria universal de linguagem ou triagem clínica.
- Amostra real fictícia: duas chamadas Groq, rotina terça/quinta com halteres e banco plano; cada sessão incluiu supino, remada, agachamento goblet, terra romeno e rosca com halteres. Estimativa logística de 34 minutos para 40 disponíveis; 3.958 caracteres e nenhum diagnóstico de falha. Os nomes e equipamentos corresponderam ao catálogo.
- Continuação real: o classificador 20B pediu novamente contexto já presente. Uma comparação com o mesmo histórico e classificador 120B retornou rascunho para somente terça-feira, 35 minutos e halteres, preservando objetivo/experiência e citações originais. Foram duas chamadas com 120B, 3.482 caracteres e nenhum diagnóstico de falha. Uma amostra não demonstra superioridade universal nem garante respostas futuras.
- O padrão de `GROQ_CHAT_MODEL` passou a `openai/gpt-oss-120b`, escolhido antes da primeira chamada. O 20B continua aceito como configuração explícita do operador. Não há troca automática após erro/quota, nova tentativa automática ou fallback pago. O teste de padrão observou RED → GREEN.

Resultados fictícios, capturas do provedor e logs completos ficaram em `server/tmp`, ignorado pelo Git. Chaves, cookies e credenciais não foram publicados. Não houve aplicação de ficha, alteração de registro de treino ou cobrança.

## Gates desta rodada

- [PR #2 em rascunho](https://github.com/EznRB/FitFlow/pull/2), com revisão funcional `83cd863` e checkpoint `1354c72a8acbbe6881627e155ee42daea12b270e`. A [CI desse checkpoint](https://github.com/EznRB/FitFlow/actions/runs/43056659556/job/130647795429) aprovou instalação, geração Prisma MySQL, 853 casos (852 aprovados, zero falhas e um caso de MariaDB ignorado no runner sem banco) e validação/geração PostgreSQL. O caso ignorado passou localmente no banco nativo.
- [Preview do checkpoint](https://fit-flow-7ompdqzgp-eznrbs-projects.vercel.app) confirmado `READY` por metadata de SHA da Vercel. Saúde HTTP 200, banco `ready`, API `no-store` e login demonstrativo 200. Geração fictícia por HTTPS: duas sessões, 4.032 caracteres, estimativa de 37 minutos para 40 disponíveis e metadados correspondentes ao catálogo.
- A continuação imediata por HTTPS retornou **429 de quota gratuita**, com mensagem controlada, sem tentativa automática ou fallback. Após intervalo, uma única nova tentativa manual retornou 200: somente terça-feira, 35 minutos disponíveis, halteres/peso corporal, 3.180 caracteres; quatro movimentos de três séries e estimativa logística de 30 minutos. Citações pertenciam às mensagens do usuário; banco/polia não foram incluídos. O 429 permanece registrado, não foi apagado do histórico. Quota compartilhada limita conversas consecutivas; essas amostras não demonstram capacidade multiusuário irrestrita.
- Revisão visual desktop/mobile ainda pendente: Computer Use não conseguiu estabelecer a URL com confiança; uma tentativa posterior de abrir navegador automatizado foi rejeitada pela revisão automática, sem motivo detalhado. Nenhuma dessas tentativas conta como inspeção aprovada.
- Até concluir a revisão visual, a produção permanece na versão anterior documentada no [estado da entrega](STATUS_ENTREGA.md). CI e preview citados correspondem ao checkpoint indicado, não a commits futuros.
- Não houve teste novo de Pix/cartão externo, instalação em telefone físico ou rotação da chave Groq exposta. Esses gates continuam abertos.

Próximo passo: finalizar inspeção visual antes de integrar em `main`. A apresentação será preparada sobre a versão estabilizada, depois do desenvolvimento.
