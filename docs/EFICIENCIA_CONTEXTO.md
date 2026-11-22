# Eficiência de contexto no FitFlow

Configurado em 11/11/2026 a pedido do proprietário, adaptando o perfil local do projeto Casa Limpa. Reduzir desperdício não altera o escopo, os critérios científicos, a segurança, a acessibilidade ou os testes necessários à entrega.

## Ferramentas

- [Ponytail](https://github.com/DietrichGebert/ponytail): skill `full`, instalada no Codex do proprietário a partir do commit `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`. Prioriza a menor mudança completa, reaproveitando o código existente.
- [Caveman](https://github.com/JuliusBrussee/caveman): instalada a partir do commit `3dc497a7f858c774d6e15b25e8c6120ef3a0eda8`. Usar português claro e conciso; preservar explicações necessárias, números, negações, código e documentação.
- Alethe: plugin local versão 21.0.0, com perfil `savings` em [alethe-playbooks.yaml](../scripts/agents/alethe-playbooks.yaml). O wrapper [alethe.ps1](../scripts/agents/alethe.ps1) seleciona a versão instalada mais recente e limita a configuração ao FitFlow. Não instala o plugin em outra máquina.

As skills instaladas são descobertas pelo Codex no próximo turno. As instruções compatíveis também podem ser usadas após leitura direta. Não foram instalados proxy, hooks ou hub de outro projeto. Nenhuma credencial foi copiada.

## Roteamento

| Trabalho | Configuração do perfil |
|---|---|
| Leitura delimitada de caminhos e evidências | Luna low, com síntese pelo responsável |
| Implementação comum | Sol medium |
| Planejamento, integração e decisões complexas | Sol high ou superior quando necessário |
| Autenticação, pagamentos, migração, isolamento, offline e conteúdo científico | Sol high, seguido de revisão independente com Astra high |

O perfil configura workers; ele não troca o modelo ou o raciocínio desta conversa. Modelos constavam no cache local, o que não garante disponibilidade em uma chamada futura. Delegar somente quando a independência compensar o custo; atribuir arquivos exclusivos e isolar escritores concorrentes. Até dois workers simultâneos é uma regra de coordenação, sem reduzir a entrega total.

## Uso local

Requer PowerShell, Python 3.9 ou superior, plugin Alethe instalado e Codex autenticado. O runtime ignorado fica em `server/tmp/alethe`; não publicar seus arquivos.

```powershell
./scripts/agents/alethe.ps1 policy set --backend skill --provider-switch never --provider-order codex --max-workers 2 --max-concurrent 2
./scripts/agents/alethe.ps1 doctor
./scripts/agents/alethe.ps1 playbook --pick
```

Antes de uma delegação, conferir `usage`, o playbook escolhido, `validate` e `dry-run` de um plano com arquivos e aceite definidos. Não enviar segredos ou dados pessoais nos prompts. Não usar modelos menores para contornar quota. O modo local `save` foi ativado; o Alethe expira esse modo após 12 horas sem interação. O perfil permanece salvo.

## Verificação e limites

Em 11/11: `doctor` confirmou configuração e playbooks válidos, CLI instalada e autenticada. `validate` e `dry-run` aprovaram um plano de revisão somente leitura com Astra high, sem avisos e sem chamada ao modelo. Não foram definidos orçamentos máximos de tokens ou custo. Leituras de quota disponíveis estavam antigas; não comprovam saldo atual.

Não há percentual de economia medido no FitFlow. Comparar resultados úteis, contexto consumido, retrabalho e verificações antes de afirmar ganho. Bytes de terminal e estimativas de preço do runner não medem a franquia Codex. Preservar logs completos e exit codes; repetir verificações quando mudança, falha ou risco justificar.
