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

- Revisão visual desktop/mobile ainda pendente: Computer Use não conseguiu estabelecer a URL com confiança; uma tentativa posterior de abrir navegador automatizado foi rejeitada pela revisão automática, sem motivo detalhado. Nenhuma dessas tentativas conta como inspeção aprovada.
- CI e implantação desta revisão precisam ser conferidas por SHA. Até concluir os gates, a produção permanece na versão anterior documentada no [estado da entrega](STATUS_ENTREGA.md).
- Não houve teste novo de Pix/cartão externo, instalação em telefone físico ou rotação da chave Groq exposta. Esses gates continuam abertos.

Próximo passo: conferir CI/preview, finalizar inspeção visual e testar a revisão por HTTPS antes de integrar em `main`. A apresentação será preparada sobre a versão estabilizada, depois do desenvolvimento.
