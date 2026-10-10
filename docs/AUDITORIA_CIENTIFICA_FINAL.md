# Auditoria científica do FitFlow

Data: 08/10/2026; verificação complementar da correção de Morton em 09/10/2026. Revisão de implementação e fontes científicas; não constitui validação clínica do aplicativo.

## Escopo e conclusão

Foram inspecionados `science.js`, `planejamento-ciencia.js`, `nutricao.js`, `progressao.js`, `sessoes.js`, `evidencias.js`, os serviços de nutrição, sessões, IA e wger, o versionamento de fichas e `docs/CIENCIA.md`. A calculadora implementa equações publicadas e os gráficos descrevem registros reais. Os calendários auxiliam a revisão profissional. Isso permite demonstrar componentes baseados em evidências; não permite certificar toda ficha, exercício de catálogo ou frase gerada por IA.

## O que foi conferido

| Componente e localização | Resultado e limite |
| --- | --- |
| `client/js/science.js:51` — Mifflin–St Jeor | Coeficientes simplificados corretos, unidades kg/cm/anos. O estudo incluiu 498 adultos saudáveis de 19–78 anos, com e sem obesidade. Prediz gasto em repouso; não mede gasto individual. [Mifflin, 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/). |
| `client/js/science.js:54` — Harris–Benedict revisada | Ambos os coeficientes correspondem à tabela de equações reproduzida em pesquisa primária. O resumo original confirma a incerteza e a inadequação em desnutrição. [Roza e Shizgal, 1984](https://pubmed.ncbi.nlm.nih.gov/6741850/); [Cancello et al., 2018, tabela 1](https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2018.00367/full). |
| `client/js/science.js:56` — gasto diário | Repouso × fator escolhido, seguido de ajuste percentual explícito. `nutricao.js:47` informa que aplicar um fator à equação de repouso é aproximação: o PAL da FAO usa metabolismo basal. Não se deduz atividade pelos dias de academia. [FAO, necessidades energéticas](https://www.fao.org/4/y5686e/y5686e07.htm). |
| `client/js/science.js:58` — macros | Proteína por peso, gordura por percentual e carboidrato pela energia restante fecham a conta antes do arredondamento. Fatores gerais 4/4/9 são reconhecidos; alimentos, fibras e outros substratos podem exigir fatores diferentes. [FAO, fatores energéticos](https://www.fao.org/4/y5022e/y5022e04.htm). |
| `client/js/science.js:21`, `nutricao.js:48` — proteína | Cerca de 1,6 g/kg/dia aparece como referência populacional com incerteza, sem teto universal. O ponto estimado do estudo foi 1,62, com IC 95% de 1,03–2,20. Não valida qualquer meta individual, déficit energético ou população clínica. [Morton et al., 2018, resumo e figura 5](https://pubmed.ncbi.nlm.nih.gov/28698222/). |
| `client/js/science.js:46` — gordura | 20–35% corresponde à faixa populacional adulta. O cálculo não verifica todas as AMDR: carboidratos e proteína podem sair das suas faixas. A interface não promete conformidade nutricional completa. [National Academies, tabela AMDR](https://www.nationalacademies.org/index.php/cdn/materials/9fb9fae6-337c-4b7c-9821-2c81d1f65ad0). |
| `client/js/planejamento-ciencia.js:18` — divisões | Não escolhe divisão vencedora, dose ou exercícios automaticamente. A equivalência observada entre split e full body depende de volume igualado; a meta-análise incluiu 14 estudos/392 participantes. Os calendários próprios A/B, superiores/inferiores e PPL não foram validados por esse estudo. [Ramos-Campo et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38595233/). |
| `client/js/planejamento-ciencia.js:54` — séries | Soma volume planejado com frequência explicitamente informada; não presume execução ou músculos secundários. O ACSM 2026 revisa treinamento resistido em adultos saudáveis e diferencia variáveis por objetivo. Não sustenta uma dose ótima universal ou falha obrigatória. [ACSM, 2026](https://pubmed.ncbi.nlm.nih.gov/41843416/). |
| `client/js/progressao.js:46`, `sessoes.js:165` — progressão | Separa trabalho/aquecimento, oferece filtro por repetições e mostra carga externa × repetições. Kg·reps é descrição aritmética dos registros, não medição de hipertrofia, esforço ou ganho de força. A UI explica essa limitação e não estima 1RM. |
| `client/js/sessoes.js:98` — RIR | Campo opcional e explicitamente estimado pelo aluno. Uma estimativa de repetições restantes tem erro; não equivale a medição objetiva de esforço. [Halperin et al., 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/). |
| `server/src/services/nutricao.service.js:23` — persistência | Revalida a mesma equação, guarda parâmetros/versão com consentimento e exige nova confirmação de escopo ao recuperar. Persistir um cenário não transforma suas hipóteses em prescrição. |

## Correções realizadas e melhorias restantes

### 1. Categorias genéricas contadas como músculo direto — corrigido

**Problema reproduzido e corrigido.** O resumo executado aceitava qualquer categoria não vazia como músculo direto. O importador produz categorias genéricas em `server/src/services/wger.service.js:100`; `client/js/sessoes.js:165` exibe a contagem de séries diretas.

Antes da correção, uma ficha com duas séries em `Múltiplos` gerava duas séries sem classificação no planejador, mas uma execução gerava `Múltiplos: 1 série direta` e zero desconhecidas. Agora `server/src/services/sessoes.service.js:45` e `client/js/planejamento-ciencia.js:59` usam a mesma classificação: `Múltiplos`, `Outros`, `Não informado`, `Cardio` e `Funcional` ficam desconhecidos, também com espaços, caixa e acentos variados. Os totais e aquecimentos permanecem corretos; um grupo explicitamente nulo no registro não é substituído pelo snapshot. Não se inferem músculos secundários. Nenhum rótulo de catálogo comprova recrutamento, técnica ou estímulo individual.

### 2. Descrição pública dos registros — corrigido

`client/js/evidencias.js:8` agora descreve registros por série, RIR estimado e aquecimentos separados. Também informa que finalizar uma sessão não comprova executar toda a ficha; a comparação exige contexto.

### 3. Explicitar os limites da IA educativa

**Limite relevante; não foi observado um resultado real incorreto.** `server/src/services/ia.service.js:22` envia resumos curados, não artigos integrais. A validação em `:47` verifica formato e IDs permitidos, sem verificar se cada afirmação decorre da fonte. O tema volume tem apenas o resumo geral do ACSM (`:9`); é contexto insuficiente para certificar toda explicação sobre tonelagem e séries.

Manter a identificação de IA e os limites já documentados em `CIENCIA.md`. Para maior controle, ampliar a curadoria específica e revisar amostras reais por tema ou fornecer explicações determinísticas aprovadas. Os testes com provedor simulado não validam a ciência de respostas do modelo ao vivo.

### 4. Evoluir comparabilidade entre revisões de ficha

**Melhoria funcional.** `client/js/progressao.js:22` agrupa somente pelo mesmo `exerciseId`. `server/src/repositories/treinos.repository.js:41` cria uma nova ficha/exercícios após edição. O histórico é preservado, mas a curva fica separada mesmo quando o movimento continua equivalente; a UI informa a separação (`progressao.js:73`). Uma identidade estável de movimento/variante, com equipamento e contexto, permitiria comparar revisões mediante confirmação profissional. Unir somente pelo nome seria inadequado.

Técnica, amplitude, assistência e descanso real ainda dependem de notas/observação; não há controle estruturado completo desses fatores. Aumento de carga isolado não comprova evolução comparável.

## Limites de população e documentação

- O aceite “adulto saudável” é uma declaração do usuário, não triagem clínica. Gestação, lactação, transtornos alimentares e condições clínicas estão excluídos na UI de nutrição (`nutricao.js:34`).
- Limites de campos como peso 30–300 kg, altura 120–230 cm, proteína 1,2–2,2 g/kg, ajuste −20 a +15% e RIR 0–10 são restrições de implementação. Não demonstram validação científica em toda combinação ou recomendação universal. A fórmula pode rejeitar macros inviáveis e sinaliza obesidade/energia abaixo do repouso (`science.js:61`).
- Arredondamento só ocorre na apresentação (`nutricao.js:191`), podendo alterar a soma aparente dos gramas exibidos. A distribuição também não avalia micronutrientes, fibras, qualidade dos alimentos ou adequação clínica.
- Acesso às fontes: ACSM/Mifflin/Harris/Morton/RIR tiveram registros ou resumos científicos consultados; o resumo de split foi recuperado pelo índice PubMed, apesar de falhas intermitentes na abertura direta. O texto integral original de Harris 1984 não abriu; os coeficientes foram conferidos na tabela primária de 2018. O link NCBI das DRI exibiu verificação de navegador; a faixa foi conferida diretamente nas National Academies. A [correção de Morton publicada em 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7513243/) foi finalmente acessada na revisão complementar de 09/10: declara o vínculo de Brad Schoenfeld com o conselho consultivo da fabricante de suplementos Dymatize Nutrition. O aviso não apresenta alteração dos coeficientes ou resultados; as limitações populacionais e clínicas do estudo permanecem.

## Verificação executada

Na auditoria inicial, 26 testes direcionados passaram, sem banco nem provedor externo: `science.test.cjs`, `training-planner.test.cjs`, `progressao.test.cjs`, `nutricao.test.cjs` e `ia.test.cjs`. Incluem ambos os coeficientes por sexo, conservação de energia, recusa de coerções/escopos inválidos, separação de aquecimento, identidade dos exercícios e contratos da IA.

A correção de categorias recebeu duas regressões novas em `sessoes.test.cjs` e `training-planner.test.cjs`: ambas falharam antes da mudança e passaram depois. O conjunto desses dois arquivos passou integralmente (19 testes), cobrindo contagem/volume preservados, aquecimento, snapshot, nulo explícito e categorias genéricas com variações de grafia. Não foi alterado nenhum snapshot salvo, banco ou regra de prescrição.
