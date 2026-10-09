# Ciência: fontes, cálculos e limites

## Treinamento

O sistema não define uma divisão universal nem presume estímulo pela quantidade de dias. Disponibilidade, adesão, objetivos, equipamentos, resposta individual e volume precisam ser considerados pelo responsável pelo treino.

- [ACSM, atualização de treinamento resistido de 2026](https://pubmed.ncbi.nlm.nih.gov/41843416/): contexto de adultos saudáveis; adaptar variáveis ao objetivo e à pessoa. Falha muscular não é exigência universal.
- [Ramos-Campo et al., split e full body, 2024](https://pubmed.ncbi.nlm.nih.gov/38595233/): resultados semelhantes quando o volume foi igualado; não demonstra equivalência de qualquer ficha ou calendário.

Calendários da interface são exemplos de distribuição, não fichas prontas nem recomendação individual. Dados wger descrevem movimentos; autoria/licença de um exercício não comprovam segurança ou superioridade científica. Curadoria e supervisão permanecem necessárias.

Progressão deve comparar exercícios, técnica, amplitude, equipamento, assistência e esforço compatíveis. Carga isolada ou volume diferente com repetições diferentes não prova evolução de força. Registrar desconforto não gera diagnóstico automático.

## Energia e macronutrientes

As equações estão em `client/js/science.js`, módulo puro também usado em testes. Inputs: kg, cm e anos completos. Escopo de uso da interface: simulação para adulto saudável de 19–78 anos; não prescrição para gestação, lactação, condições clínicas ou transtornos alimentares.

**Mifflin–St Jeor:** `10 × peso + 6,25 × altura − 5 × idade + 5` (coeficiente masculino) ou `−161` (feminino). [Estudo de 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/).

**Harris–Benedict revisada:** masculino `88,362 + 13,397 × peso + 4,799 × altura − 5,677 × idade`; feminino `447,593 + 9,247 × peso + 3,098 × altura − 4,330 × idade`. [Roza e Shizgal, 1984](https://pubmed.ncbi.nlm.nih.gov/6741850/).

As equações estimam gasto em repouso, com erro individual. Coeficientes refletem as populações publicadas; não classificam identidade de gênero nem resolvem situações hormonais específicas.

Gasto total aproximado = repouso × fator de atividade. A [FAO descreve PAL em relação ao metabolismo basal](https://www.fao.org/4/y5686e/y5686e07.htm); aplicá-lo a uma equação de repouso é uma aproximação explicitada. Não se infere atividade por dias de academia.

Proteína = peso × parâmetro g/kg. [Morton et al., 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/) oferece referência populacional em adultos saudáveis com treino resistido, com ponto estimado próximo de 1,6 g/kg/dia e incerteza; não é dose ideal nem teto rígido universal. Com obesidade, peso atual para proteína exige avaliação individual.

Gordura = energia × proporção ÷ 9; carboidrato = energia restante após proteína/gordura ÷ 4. [DRI de macronutrientes](https://www.ncbi.nlm.nih.gov/books/NBK208874/) fornece faixa populacional adulta de gordura 20–35%. Parâmetros editáveis não são automaticamente recomendações clínicas.

## Caso verificável

Mifflin, coeficiente masculino, 80kg, 180cm, 30 anos: repouso **1780kcal**. Fator 1,5, ajuste 0%, proteína 1,6g/kg e gordura 25%: **2670kcal**, **128g proteína**, **372,625g carboidrato**, **74,166…g gordura**. Arredondamento somente na apresentação.

## IA

Explica temas curados; não calcula macros por texto, não escolhe carga e não prescreve dieta. Validação de JSON e IDs de fonte restringe referências, mas não certifica cientificamente cada frase. Sempre consultar as fontes e a população aplicável. Sem chave, calculadora e fontes continuam disponíveis.
