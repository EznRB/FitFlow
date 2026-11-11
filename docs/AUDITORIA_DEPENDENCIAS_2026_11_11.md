# Dependências — revisão de 11/11/2026

## Escopo e medição

O coletor da skill `supply-chain-risk-auditor` examinou `server/package.json` e `server/package-lock.json`: **15 dependências diretas**, sendo 14 de runtime, e **118 pacotes transitivos** verificados no registro. O coletor e o renderizador terminaram com saída 0 antes e depois da correção. Os artefatos completos foram preservados fora do repositório, no diretório local temporário `fitflow-supply-chain-20261111`.

## Correções

| Pacote transitivo | Antes | Depois | Aviso e condição |
|---|---|---|---|
| `body-parser` | 1.20.8 | 1.20.9 | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828): bytes inválidos após corpo comprimido podem produzir erro de descompressão não tratado. |
| `qs` | 6.16.0 | 6.16.1 | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): serialização com `arrayFormat: 'comma'` pode lançar exceção para elementos com `toString` não chamável. |

Os overrides do Express fixam as versões corrigidas. O lockfile alterou somente versão, URL e integridade desses dois pacotes; o Express permanece em 4.22.1. A instalação usou `--ignore-scripts`, sem migrations ou regeneração do banco. `npm ls body-parser qs --all` terminou com saída 0 e confirmou as versões resolvidas, inclusive `qs` usado pelo `body-parser`.

O aviso de `qs` foi reproduzido na biblioteca resolvida pelo Express; não foi demonstrado um caminho explorável do aplicativo até `qs.stringify` nessa configuração. O teste do parser usou servidor Express isolado em processo filho e porta efêmera de `127.0.0.1`, sem acessar aplicação, banco ou implantação publicada.

## Evidências de comportamento

- Antes da correção, `qs` lançou `TypeError` no caso de reprodução. O processo filho com `body-parser` encerrou com erro não tratado `Gunzip`/`Z_DATA_ERROR`.
- Após a correção, três testes específicos passaram: serialização problemática, compatibilidade de consultas comuns e JSON gzip válido antes/depois de bytes inválidos tardios. A fixture correlaciona o sinal IPC por requisição para evitar confundir eventos de requisições consecutivas.
- Suíte integral local: **882/882**, sem falhas ou ignorados, saída 0. Log completo ignorado: `server/tmp/full-dependency-security-20261111.log`. Após refinar a correlação da fixture, os três testes específicos passaram novamente em `dependency-patches-correlated-green-20261111.log`.
- Revisão independente do diff de dependências e testes não encontrou achado bloqueante.
- O ambiente local usa Node 25.7.0 e emitiu aviso de engine: o projeto declara Node 24.x. A CI configurada em Node 24 deve aprovar a revisão antes de atribuir essa validação ao runtime de entrega.

## Resultado e limites do coletor

A primeira medição encontrou os dois avisos transitivos da tabela. Após atualizar o lockfile, o coletor registrou **zero avisos conhecidos nas 15 diretas e 118 transitivas avaliadas**. A consulta posterior reutilizou 123 respostas de cache, com idade máxima de 0,5 h, e realizou uma nova consulta HTTP. Não se trata de garantia de ausência de vulnerabilidades.

| Critério nas dependências diretas | Avaliadas | Sinalizadas | Sem avaliação |
|---|---:|---:|---:|
| Avisos conhecidos | 15/15 | 0 | 0 |
| Depreciação | 15/15 | 0 | 0 |
| Repositório arquivado | 14/15 | 0 | 1 |
| Atividade de manutenção | 14/15 | 0 | 1 |
| Concentração de publicadores | 8/15 | 2 | 7 |
| Scripts de instalação | 15/15 | 0 | 0 |
| Workflows perigosos | 11/15 | 0 | 4 |

`bcryptjs` e `jsonwebtoken` foram sinalizados por concentração de publicadores, sem aviso conhecido aplicável às versões avaliadas. Esse dado pede acompanhamento das atualizações; isoladamente, não demonstra comprometimento nem justifica uma migração de autenticação antes da entrega.

O `gh` não está instalado/autenticado para o coletor. O relatório registra seis erros HTTP, limitações da API GitHub para Prisma e ausência de dados de Scorecard em alguns projetos. A propriedade do cache não pôde ser verificada por mecanismo POSIX no Windows. O relatório integral conserva todas as contagens e justificativas de critérios sem avaliação. Os transitivos foram examinados apenas quanto a avisos conhecidos.

## Persistência móvel

Uma revisão independente estática de `sw.js`, `pwa.js`, `training-store.js` e integrações de autenticação/sessões não encontrou defeito concreto no escopo examinado. Cache público, exclusão de respostas privadas e isolamento da fila por conta foram conferidos por código e cobertura existente, sem repetir testes inalterados. O roteiro M01–M14 em aparelho físico continua pendente.

## Publicação isolada da correção

A branch de desenvolvimento `103b5a8` teve [CI Node 24 aprovada](https://github.com/EznRB/FitFlow/actions/runs/43105305251). Para publicar a correção sem importar a IA/UX ainda em revisão, uma worktree nativa partiu da produção `daa9191` e recebeu somente os dois patches, três testes e documentação específica. Sua suíte própria aprovou **804/804 testes locais**, zero falhas ou ignorados. [PR 3](https://github.com/EznRB/FitFlow/pull/3) integrada após [CI Node 24](https://github.com/EznRB/FitFlow/actions/runs/43105679648) e preview com saúde/login/restauração de sessão HTTP 200.

O merge `67f1f34e3ca2a2828ba993f1602203421ee15184` foi publicado como Production READY e confirmado pelo endereço canônico. Saúde/banco, login de aluno demonstrativo e `/api/auth/me` retornaram 200. A árvore Git `ee23b4a577b1fd190f0815e5d4460ad8775b2180` é idêntica à da revisão `6336a77` testada em CI; não foi localizado um run próprio do merge até a última consulta. A documentação posterior `94bd5b4` não altera runtime. [Prova resumida da produção](PATCH_SEGURANCA_2026_11_11.md).

Payloads, cookies e respostas temporárias de autenticação criados pela verificação foram removidos; o arquivo original de credenciais demonstrativas foi preservado. O ambiente local copiado para a worktree também foi removido. A prova sanitizada está em `server/tmp/security-production-verification-20261111.json`, ignorada pelo Git. A PR 2 recebeu a main por merge normal, preservando alterações acadêmicas locais e sem force-push.
