# FitFlow — especificação de evolução

Especificação histórica de 07/10/2026. A primeira etapa descrita aqui foi seguida de implementação adicional; consulte [Estado atual](../../STATUS_ENTREGA.md) e [Plano mestre](../../PLANO_MESTRE_DESENVOLVIMENTO.md).

## Objetivo e contexto

Entrega acadêmica na próxima semana. Melhorar os dois repositórios preservando a identidade atual: laranja, azul escuro, cartões arredondados e tipografia existente. A landing é também uma apresentação acadêmica; manter autoria, curso e contexto do projeto. O aplicativo continua com Express, Prisma/MySQL e JavaScript; a landing continua React/Vite.

O diagnóstico anterior está em `docs/ANALISE_ENTREGA_2026-10-07.md`. O login de produção retorna 500 porque o hostname MySQL configurado não resolve. Nenhuma melhoria visual ou troca de senha corrige esse problema de infraestrutura.

## Requisito científico

Toda orientação de treinamento deve declarar fonte, população e limitações. Separar prescrição, execução e interpretação. Divisões full body, superior/inferior e outras são formas de distribuir treino: não declarar superioridade universal. A escolha depende de disponibilidade, volume, recuperação, equipamentos e revisão do instrutor. Catálogo de exercícios não comprova eficácia clínica.

Não chamar tonelagem de hipertrofia ou séries prescritas de séries executadas. Sem repetições registradas, o volume do registro é desconhecido. Não multiplicar pela quantidade de séries da ficha para preencher dados ausentes. Não comparar tonelagens de equipamentos diferentes como se fossem equivalentes. Registros antigos não permitem reconstruir sessões completas.

Nutrição deve usar funções determinísticas, fórmulas visíveis, unidades kg/cm/anos, referências e versão do método. Implementar Mifflin–St Jeor e Harris–Benedict revisada. Resultados são estimativas de gasto em repouso; fator de atividade e ajuste energético são hipóteses selecionadas, não medições. Proteína e gordura são parâmetros configuráveis; carboidrato é o restante da energia. Rejeitar valores inválidos e distribuições impossíveis. Primeira versão para adultos saudáveis de 19–78 anos; gestação, lactação, condições clínicas e transtornos alimentares exigem atendimento individual. Não gerar dieta clínica.

## IA nesta primeira etapa

Implementar explicações educativas de temas previamente definidos, com referências selecionadas pelo servidor. A IA não calcula macros, não define carga, não prescreve dieta/treino e não altera cadastro, matrícula ou pagamentos. Não enviar antropometria, nome, e-mail ou histórico do aluno ao provedor. Credencial somente no backend; ausência de chave retorna 503 claro. JSON validado, timeout, limite por usuário e texto renderizado com `textContent`. Identificar texto gerado e avisar que a associação de uma referência não verifica automaticamente cada frase.

## Mobile e persistência

Primeira etapa: formulários responsivos, foco visível, controles >=44px, calculadora utilizável em 375px e construtor de treino em uma coluna. Cookie continua sendo a sessão; cálculos novos ficam em memória e não armazenam dados corporais no dispositivo por padrão. Login e histórico continuam dependendo de API/banco. PWA, IndexedDB e sincronização entre dispositivos são uma etapa posterior, com identificação do usuário, descarte no logout e idempotência.

## Fontes verificadas em 07/10/2026

- [ACSM 2026 — overview de revisões](https://pubmed.ncbi.nlm.nih.gov/41843416/): população adulta saudável; diretrizes, não receita universal.
- [Ramos-Campo 2024 — split versus full body](https://pubmed.ncbi.nlm.nih.gov/38595233/): resultados semelhantes quando volume é igualado.
- [Mifflin 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/): regressão para gasto energético em repouso; equação simplificada descrita no artigo.
- [Roza e Shizgal 1984](https://pubmed.ncbi.nlm.nih.gov/6741850/): revisão de Harris–Benedict. [Artigo original, tabela 5](https://zakboekdietetiek.nl/wp-content/uploads/2015/06/roza-1984.pdf).
- [Morton 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/): meta-análise de proteína e treino resistido; ponto estimado ~1,6 g/kg/dia, com incerteza; não é teto rígido ou dose ideal para todas as pessoas.
- [Dietary Reference Intakes](https://www.ncbi.nlm.nih.gov/books/NBK208874/): faixas de macronutrientes; [energia 4/4/9](https://www.ncbi.nlm.nih.gov/books/n/nap10609/pdf/).
- [FAO — atividade e energia](https://www.fao.org/4/y5686e/y5686e07.htm): PAL se refere ao gasto basal; aplicar multiplicador ao gasto em repouso é aproximação que precisa de calibração.

## Critérios de conclusão da primeira etapa

Planos separados para landing, UX/sistema e ciência/IA/mobile; calculadora integrada aos menus; fundamentos científicos visíveis; IA implementada sem segredo no browser; correção de erros HTTP que derrubam sessão por 403; responsividade verificada no navegador; builds e testes dos cálculos/contrato de IA. Publicação e migração de dados de produção dependem da recuperação do banco e validação dos fluxos reais.
