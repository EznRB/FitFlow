# Versão integrada e demonstração — 22/11/2026

## Publicação conferida

- [PR 2](https://github.com/EznRB/FitFlow/pull/2) integrada em `e9b7f12baca28365d6557ab0be3c26759b495654`, após [CI 44993843281](https://github.com/EznRB/FitFlow/actions/runs/44993843281) aprovada no HEAD `643e040` e [inspeção atual dos fluxos alterados](RODADA_VISUAL_2026_11_22.md).
- Árvores do HEAD revisado e do merge idênticas: `79419e4b557db2b8f7cc8b481a27c717d8d8b54d`.
- Git/Vercel: `dpl_CaXT7zXBzbpSUnrSPkiMezM787v3`, produção READY, [site canônico](https://fit-flow-indol.vercel.app/). Saúde respondeu `success`, banco `ready`.
- API, chat, painel do aluno e checkout públicos comparados byte a byte aos blobs da main: quatro correspondências. Checkout mantém SHA-256 `d8d20e61ed2beb4ede2ed19ab45de49dd605ed0ba8de73916208a5a8e3d50610`, preservando a versão financeira já verificada. A primeira consulta usou caminho incorreto de checkout e recebeu 404; corrigido conforme o `index.html` versionado, sem alterar código.

## Conta e dados exclusivamente demonstrativos

As contas antigas venceram com o tempo. Foi criada pela matrícula normal, no preview com o banco compartilhado, a conta **Apresentação 25/11 • demonstração**. Nenhum histórico antigo foi alterado e nenhum pagamento foi lançado. A vigência inicial calculada pelo sistema foi de 30 dias. A senha gerada permanece somente em arquivo privado ignorado pelo Git: `server/tmp/presentation-credentials.local.json`; não publicar seu conteúdo.

Pelo perfil instrutor foi criada a ficha **Registro de séries • demonstração 25/11**, com um exercício selecionado do catálogo wger e identificação explícita de cenário técnico fictício. Não representa treino completo ou prescrição individual. A ficha está disponível ao novo aluno no site canônico.

## Jornada executada no site público

1. Login da conta nova: painel com 30 dias de vigência e uma ficha ativa.
2. Abertura do caderno: ficha carregada do servidor e histórico inicialmente vazio.
3. Início de uma sessão, duas séries sintéticas: 20 kg × 10 e 20 kg × 12, RIR 2, ambas identificadas nas notas como dados sintéticos, sem execução física.
4. Interface confirmou cada série sincronizada e total de **2 séries de trabalho / 440 kg·reps**, com aquecimento separado em zero.
5. Finalização da sessão; reabertura da URL canônica, restauração do login e nova consulta ao caderno. Uma sessão finalizada, duas séries e 440 kg·reps permaneceram, sem duplicação observada.

[Entrada restaurada](evidence/20261122-sessao-producao-persistida.jpg) · [Resumo e histórico](evidence/20261122-sessao-producao-resumo.jpg).

6. Evolução consultou uma sessão, duas séries e 440 kg·reps. O exercício veio identificado por ID 11. Filtrar por 10 repetições manteve o resumo semanal em 440, mas apresentou corretamente uma série / 200 kg·reps no filtro e a tabela correspondente. [Evolução filtrada](evidence/20261122-evolucao-producao-filtro.jpg). Isso confirma consulta e filtro, não ganho de força.

## Limites e próximos gates

### Revisão de ficha e correção da tabela

Pelo instrutor foi salva uma segunda revisão da ficha fictícia, mantendo os parâmetros e alterando somente identificação/notas. A interface confirmou a versão nova ativa e a anterior arquivada. Após novo login do aluno, o caderno ofereceu a revisão 2 para iniciar, preservando a sessão original finalizada, suas duas séries e 440 kg·reps. Nenhum registro antigo de outras contas foi alterado.

A tabela revelou um defeito visual: a descrição não quebrava linha e empurrava status/ações para fora do desktop. Correção CSS `6ed384d`, restrita à primeira coluna de dados, exclui células de estado com colspan. Preview `dpl_6KMLGiyUZ86Tf32BwVBq8MhGddDe` READY:

- Desktop 1280 px: tabela 905,2 px em região de 941 px; status e ações visíveis sem rolagem horizontal.
- Em 375 px: documento 369 px, região 335 px e conteúdo rolável 709 px. Tab na região focou Ver ficha e rolou até a ação (scrollLeft 374), sem ampliar a página. Viewport restaurado.
- [Antes](evidence/20261122-ficha-revisao-producao.jpg) · [Desktop corrigido](evidence/20261122-fichas-wrap-desktop.jpg) · [Mobile](evidence/20261122-fichas-wrap-mobile.jpg) · [Ação acessível por teclado](evidence/20261122-fichas-wrap-mobile-acoes.jpg).

Essas capturas da correção são do preview identificado; sua integração será conferida pela PR 13. Não se repetiram testes funcionais sem mudança de comportamento JS/API/banco; a CI automática e a inspeção visual são os gates desta correção CSS.

O teste usa navegador desktop e consulta publicada, não telefone físico nem dispositivo independente sem cache. Não foi simulada indisponibilidade de rede nesta jornada. A primeira sessão é um artefato de demonstração; não comprova progressão biológica ou adequação da dose.

Continuam: demais estados da matriz visual, roteiro físico M01–M14, confirmação pelo titular da revogação da chave Groq exposta, lacunas específicas da auditoria de testes e revisão requisito por requisito. A apresentação individual de 20–30 minutos será elaborada após estabilizar esses fluxos; a integração da PR não conclui o objetivo.
