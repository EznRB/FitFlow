# Project UI/UX Guidelines

Sempre que houver uma nova funcionalidade ou alteração na interface do usuário (UI) ou na experiência do usuário (UX) deste projeto, **DEVE-SE** obrigatoriamente utilizar a skill `ui-ux-pro-max` instalada em `.agent/skills/ui-ux-pro-max`.

## Fluxo de Trabalho Obrigatório

1.  **Análise de Requisitos:** Antes de codificar qualquer UI, analise o tipo de produto, estilo, indústria e stack.
2.  **Geração de Design System:** Rode sempre o comando de busca inicial para obter recomendações e padrões de design:
    ```bash
    python .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "FitFlow"
    ```
3.  **Persistência (Opcional):** Para manter consistência entre sessões, utilize a flag `--persist` para criar o diretório `design-system/`.
4.  **Consultas Específicas:** Utilize os domínios (`style`, `typography`, `color`, `ux`, `chart`) para detalhes refinados.
5.  **Checklist de Pré-Entrega:** Antes de submeter código de UI, verifique se atende aos critérios de qualidade visual, interação, acessibilidade e responsividade definidos na skill.
6.  **Documentação Educativa (Faculdade):** Todo código novo ou alterado **DEVE** conter comentários descritivos em Português explicando a lógica de funcionamento de cada bloco (funções, classes, componentes). O objetivo é facilitar a explicação técnica durante a apresentação na faculdade.
    - Explicar o "porquê" de certas decisões de design e lógica.
    - Manter um estilo de comentário profissional e didático.

18. **Persistent Log of Tasks:** Toda vez que uma Task for concluída, ela **DEVE** ser obrigatoriamente documentada no arquivo `PROGRESS.md` na seção "Tarefas Concluídas", detalhando o que foi feito no Backend/Frontend. Isso é vital para o controle acadêmico e persistência de contexto entre sessões.

19. **Mandatory Skill Contextualization:** A IA é obrigada a consultar o `SKILLS_GUIDE.md` no início de cada sessão e aplicar as skills mapeadas no guia conforme o cenário detectado. O não uso de uma skill em seu domínio correspondente é considerado falha de governança.

---

*Estas diretrizes garantem um design premium, funcional, consistente e bem documentado em todo o projeto FitFlow.*
