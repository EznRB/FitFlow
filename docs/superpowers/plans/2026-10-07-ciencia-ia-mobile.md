# Ciência, IA e mobile — plano da primeira implementação

Plano histórico de 07/10/2026. Checklists e escolhas de ferramentas registram essa etapa; não são instruções obrigatórias atuais. Consulte [Estado atual](../../STATUS_ENTREGA.md) e [Plano mestre](../../PLANO_MESTRE_DESENVOLVIMENTO.md) para implementação e pendências posteriores.

> **Para execução:** `superpowers:executing-plans` na sessão, testes de comportamento com `superpowers:test-driven-development`.

**Objetivo:** calculadora de nutrição verificável e explicações educativas por IA, mantendo o tema e suporte a telas pequenas.
**Execução em 07/10/2026:** primeira etapa implementada e 15 testes passando. Chamada real de IA e fluxos que exigem banco permanecem pendentes; ver `docs/ENTREGA_ETAPA_CIENCIA_UX.md`.

**Arquitetura:** módulo matemático compartilhado Node/browser; views dedicadas; API de explicações sem entrada pessoal. Não depende de alterações no banco para os cálculos.
**Stack:** JavaScript, Node test runner, Express, REST Gemini.
**Especificação:** `../specs/2026-10-07-fitflow-evolucao.md`.

## Restrições

Fórmulas versionadas, unidades explícitas, resultados educativos. Nenhum segredo no frontend. Sem emissão automática de prescrição. Tema existente. Sem dados pessoais enviados ao modelo. Sem armazenamento de antropometria por padrão.

## Revisão prioritária

Campo vazio/null/NaN; usuário fora do escopo; macros sem energia suficiente; resposta de IA inválida/timeout; 403 sem logout. Todos têm teste ou validação de navegador na tarefa responsável.

## Tarefa 1 — funções científicas

**Criar:** `client/js/science.js`, `server/tests/science.test.cjs`.
**Interface:** `FitFlowScience.calculateNutrition(input)` retorna `{version,formula,restingKcal,estimatedTotalKcal,targetKcal,proteinG,fatG,carbsG,assumptions}`; `summarizeLogs(logs)` retorna volume conhecido e número de registros incompletos.

- [x] Testar Mifflin homem 80kg/180cm/30anos = 1780kcal e mulher =1614kcal; Harris–Benedict revisada 1853,632 e 1615,093kcal.
- [x] Testar conservação da energia 4P+9G+4C, fator/ajuste, inputs vazios, limites e carboidrato negativo.
- [x] Testar log sem reps não entra no volume; nenhum multiplicador de séries prescritas.
- [x] Executar `node --test server/tests/science.test.cjs`, ver falhas antes de implementar e todas passarem depois.

## Tarefa 2 — nutrição e fundamentos visíveis

**Criar:** `client/js/nutricao.js`, `client/js/evidencias.js`, `client/css/science.css`.
**Modificar:** index, app e sidebar.

- [x] Menu Nutrição para admin/aluno; fórmula, kg/cm/anos, coeficiente masculino/feminino do estudo, fator numérico explícito, proteína g/kg e gordura %.
- [x] Exibir fórmula e cada etapa do cálculo; valores em memória; checkbox para escopo e explicação sobre calibração com profissional.
- [x] Página Fundamentos com referências ACSM 2026/split/proteína e distinção entre volume previsto e executado.
- [x] Integrar volume conhecido ao histórico existente, identificar incompletos/legado e não declarar todas as sessões completas.
- [ ] Aceitação restante: navegação autenticada completa e 1440px. Já verificados preenchimento real, valores manuais, erro, reset e 375px e desktop no navegador público educativo; aceitar 1440px e navegação autenticada depois de recuperar o banco.

## Tarefa 3 — IA com contrato restrito

**Criar:** `server/src/services/ia.service.js`, `server/src/routes/ia.routes.js`, `server/tests/ia.test.cjs`.
**Modificar:** app e `.env.example`.
**Interface:** `POST /api/ia/explicar {topic}` com `topic` enum `divisoes|volume|nutricao`; resposta `{explanation, sources, generatedByAI:true}`. `GET /api/ia/status` autenticado retorna somente `enabled`.

- [x] Testar falta de chave 503 sem chamada externa; tema inválido 400; JSON inválido e fontes inventadas 502; timeout 504; falha upstream 502; resposta válida recebe URLs cadastradas no servidor.
- [x] REST com header de chave, timeout de 15s, no máximo 1200 tokens e limite 10/15min por usuário. Modelo configurável; padrão Gemini 2.5 Flash confirmado na documentação.
- [x] Testar HTTP sem token 401, papel desconhecido 403 e chamadas válidas via sessão de teste.
- [x] Mostrar explicação em texto simples, fonte clicável e indicação de IA. Falta de configuração não impede cálculo ou consulta às referências.
- [x] Executar testes; chamada real depende de chave de provedor. Não afirmar que resposta sintética de teste é geração real.

## Tarefa 4 — HTTP e mobile

**Criar:** teste de API cliente.
**Modificar:** `client/js/api.js`, `client/css/pages.css`, layout do construtor.

- [x] RED/GREEN: erro 502 HTML preserva status; 403 não encerra sessão; 401 encerra; erro de rede é distinguido.
- [x] Fechar bloco CSS de reduced-motion; inputs >=16px em mobile; controles >=44px; construtor em uma coluna e sem altura mínima de 500px na tela pequena.
- [x] Verificar sintaxe, CSS e navegador. Não afirmar offline/PWA pronto nesta etapa.

## Exercícios: conclusão da investigação e próxima implementação

Consulta pública atual retornou 918 entradas em `exerciseinfo` com `language=2`; não é um catálogo de “todos os exercícios”. Idiomas 2=en e 7=pt estão corretos. Dados atuais incluem `translations`, `muscles`, `muscles_secondary`, `equipment`, licenças e paginação `next`. Categorias não bastam: primeiro registro é swing com categoria Abs, mas músculos primários glúteos/isquiotibiais. Inferência por nome é insuficiente.

**Arquivos futuros:** `server/src/services/wger.service.js`, adaptador próprio e migrations de catálogo descritas no plano de arquitetura.

- [ ] Centralizar Prisma; buscar idiomas por código; percorrer páginas com limite de segurança e timeout; validar schema da resposta.
- [ ] Normalizar campos externos sem perder identidade, idioma, músculos/equipamentos e autoria/licença por imagem e descrição.
- [ ] Salvar por UNIQUE(source,externalId), com checkpoint e atualização seletiva; não sobrescrever curadoria local.
- [ ] Preferir wger como primeira fonte já integrada. Free Exercise DB é dataset complementar offline, não endpoint de prescrição. Verificar licença dos arquivos e procedência das imagens antes de importar.
- [ ] Aceite: sync repetido não duplica; texto vazio é rejeitado; PT ausente é marcado como EN; mídia só aparece com atribuição; falha da API não derruba catálogo local.
