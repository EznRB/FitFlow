# Direção visual FitFlow

Atualizado em 10/10/2026 após revisão da interface e do login. Preservar o tema; melhorar organização, legibilidade e acabamento.

## Tokens reais

| Uso | Valor |
| --- | --- |
| Ação principal | Laranja `#f97316`; hover `#fb923c` |
| Fundo | Navy `#0a0f1a` |
| Superfície | `#111827` |
| Texto | `#f9fafb`; secundário `#a8b2c3` |
| Texto auxiliar | `#8e9aaf`; manter contraste sobre a superfície real |
| Bordas | `#232d3d` |
| Corpo e interface | Barlow, com fallback do sistema |
| Marca | Barlow Condensed |

## Componentes e composição

- Títulos em caixa normal; caixa alta reservada à marca e pequenas legendas.
- Botões de ação laranja, texto escuro, 44px no mobile e foco visível. Verde indica estado de sucesso.
- Bordas discretas, raios 6–10px; evitar glow, efeitos flutuantes e cartões repetitivos para toda informação.
- Formulários com labels, unidades, exemplos e erros próximos ao campo. Inputs mobile em 16px.
- Gráficos e indicadores somente com dados existentes. Sem percentuais de crescimento decorativos.
- Estados vazio, carregando, erro, sem conexão e dados incompletos devem explicar a próxima ação.
- Cabeçalho, conteúdo principal, navegação e diálogos semanticamente identificáveis; teclado e contraste revisados.

## Landing

Hero alinhado à esquerda, fotografia ilustrativa à direita; produto, jornadas, ciência e contexto acadêmico em seções. Não duplicar um aplicativo simulado. Imagem gerada deve ser identificada como ilustração. CTA aponta ao aplicativo real configurado por `VITE_APP_URL`.

## Sistema

Gestor vê indicadores e gestão; instrutor vê suas fichas; aluno vê rotina, registros e acompanhamento. Dados financeiros não são acessíveis ao instrutor. Fichas e execução são conceitos separados; finalizar uma sessão não inventa séries.

### Acesso

Login em composição editorial: painel fotográfico e formulário alinhados em desktop; formulário prioritário no mobile. A fotografia da landing foi reutilizada em WEBP de aproximadamente 199 KB, identificada como imagem ilustrativa. Não adicionar cenários artificiais, métricas promocionais ou rotas de recuperação de senha sem backend correspondente.

Labels persistentes, autocomplete de credenciais, alternância mostrar/ocultar senha acessível, foco visível e ajuda sobre conta cadastrada pela academia. Durante verificação de sessão, campos e envio permanecem desabilitados com mensagem acessível. Estados de erro não apagam campos nem simulam autenticação.

## Verificação

Revisar desktop, 768px e 375px, navegação por teclado e estados com dados reais da demonstração. Capturas em `docs/evidence/` documentam verificações específicas; não substituem os testes de comportamento.

Na revisão `3adf5c1`, o navegador local confirmou login em larguras 1280 e 375 pixels, teclado, mostrar/ocultar senha, validação de campos obrigatórios e ajuda. Na publicação, capturas 28/29/31 documentam 1280 × 720, 375 × 812 e 768 × 1024 sem overflow horizontal; login real de aluno em 375 pixels e restauração após recarga foram aprovados. Texto secundário foi corrigido no CSS; essa revisão não equivale a certificação completa de acessibilidade. Publicação e capturas estão em `docs/STATUS_ENTREGA.md`.
