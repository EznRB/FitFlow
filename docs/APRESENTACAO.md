# Apresentação do FitFlow — 13/10/2026

## Aplicações publicadas

- [FitFlow: sistema](https://fit-flow-indol.vercel.app/)
- [FitFlow: landing page](https://fitflow-lp.vercel.app/)

Login e restauração por HTTPS das cinco contas abaixo foram conferidos em 13/10/2026. São contas demonstrativas do Neon novo; as credenciais antigas do Aiven não correspondem a esta implantação.

## Contas da demonstração

| Perfil | E-mail de acesso |
|---|---|
| Administrador | gestor@demo.fitflow.local |
| Instrutor | instrutor@demo.fitflow.local |
| Aluno ativo | aluno@demo.fitflow.local |
| Segunda aluna | aluna@demo.fitflow.local |
| Aluno com plano vencido | vencido@demo.fitflow.local |

As senhas atuais estão no arquivo privado ignorado **server/tmp/ACESSO_APRESENTACAO_PRIVADO.md**, preparado para o proprietário compartilhar diretamente com o professor. O GitHub contém o código e estas instruções; o arquivo de acesso não faz parte do clone. O aluno com plano vencido consegue entrar e permite demonstrar as restrições de matrícula.

Para executar em outro computador, seguir [Desenvolvimento](DESENVOLVIMENTO.md). O seed local cria credenciais individuais no arquivo privado daquele ambiente; elas são distintas do acesso à Vercel. Docker não é necessário.

## Roteiro sugerido — 5 a 8 minutos

1. **Apresentação:** abrir a landing, explicar o objetivo acadêmico e entrar no aplicativo pelo CTA.
2. **Gestor:** apresentar alunos/planos, Livro de presenças, filtros e relatório. Mostrar que resumo de hoje e histórico têm escopos diferentes. Não excluir os registros anteriores para preparar a demonstração.
3. **Instrutor:** consultar ficha e biblioteca; mostrar origem/licença do exercício e a separação entre prescrição e execução.
4. **Aluno:** consultar ficha, Sessões e séries, Evolução e mensalidade. Explicar carga/repetições/RIR estimado, aquecimento separado, UUID/fila por conta e comparação por exercício.
5. **Nutrição:** calcular um cenário fictício sem salvar: 80 kg, 180 cm, 30 anos, Mifflin, atividade 1,5, ajuste 0%, proteína 1,6 g/kg, gordura 25%. Explicar coeficiente escolhido, estimativa de repouso, hipóteses e fontes; não apresentar como dieta prescrita.
6. **Chat:** aceitar envio de mensagens fictícias à Groq. Pedir organização da semana; informar dias, tempo, equipamentos, experiência, objetivo e cenário adulto saudável. Conferir a interpretação e referências; a proposta não altera a ficha automaticamente.
7. **Engenharia:** mostrar arquitetura, persistência Neon/Vercel, testes e gates descritos no [Estado da entrega](STATUS_ENTREGA.md). Diferenciar confirmação real, simulação e pendência.

## Limites que devem ficar claros

- Pix/cartão tem checkout, webhook e conciliação em sandbox implementados, mas a validação externa aguarda conta/credenciais do Mercado Pago. Recebimento manual é um registro informado, não uma cobrança Pix/cartão. Ajuste financeiro não transfere dinheiro ao cliente.
- Chat usa Groq Free, sujeito a quota/disponibilidade; referências e hipóteses são explícitas. Amostras aprovadas não certificam toda resposta ou dose individual.
- PWA/layout/fila têm testes locais e emulação; instalação e reconexão em telefone físico permanecem pendentes.
- O banco Aiven antigo não foi recuperado. Este projeto usa dados novos de demonstração, sem afirmar migração dos dados antigos.

[README](../README.md) · [Arquitetura](ARQUITETURA.md) · [Ciência](CIENCIA.md) · [Auditoria e limites](REVISAO_FINAL.md).
