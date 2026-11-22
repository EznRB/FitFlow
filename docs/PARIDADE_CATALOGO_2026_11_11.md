# Identidade do catálogo entre bancos — 11/11/2026

## Divergência e correção

O relacionamento `Exercise.catalogExercise` tinha `ON UPDATE RESTRICT` no MySQL e `ON UPDATE CASCADE` no PostgreSQL. A diferença apareceu tanto nos schemas quanto nas migrations de origem do catálogo. Não foi identificado fluxo normal do aplicativo que altere a chave primária do catálogo; esta correção alinha a integridade entre ambientes, sem atribuir um incidente inexistente.

O schema PostgreSQL agora explicita `onUpdate: Restrict`. A migration adicional `20261111_catalog_identity_restrict` substitui atomicamente a FK existente, preservando nome, `ON DELETE RESTRICT` e validação das referências. Não modifica IDs, snapshots, linhas ou migrations anteriores. A operação adquire lock na tabela `exercises`; a publicação em produção deve considerar bloqueio transitório de tráfego.

## Evidência

| Gate | Resultado | Log completo em `server/tmp/` |
|---|---|---|
| PostgreSQL local dedicado, antes | Exit 1: ação real `c` (CASCADE), esperada `r` (RESTRICT) | `catalog-identity-postgresql-red-20261111.log` |
| Migration local | Exit 0, sexta migration PostgreSQL aplicada | `catalog-identity-migrate-local-20261111.log` |
| PostgreSQL local, depois | Exit 0: UPDATE/DELETE RESTRICT e FK validada | `catalog-identity-postgresql-green-20261111.log` |
| Neon de verificação isolado, antes | Exit 1 pelo mesmo motivo | `catalog-identity-neon-red-20261111.log` |
| Migration Neon de verificação | Exit 0, sexta migration PostgreSQL aplicada | `catalog-identity-migrate-neon-20261111.log` |
| Neon de verificação, depois | Exit 0: UPDATE/DELETE RESTRICT e FK validada | `catalog-identity-neon-green-20261111.log` |
| Prisma validate PostgreSQL | Exit 0 | `catalog-identity-schema-validate-20261111.log` |

O gate `server/tests/catalog-identity-postgresql.integration.cjs` consulta a restrição efetiva em `pg_constraint`, sem alterar linhas. Usa o guard de destino gerenciado existente. A revisão independente não apontou bloqueantes. A migration foi posteriormente aplicada à produção pela PR 5 em 12/11. [Implantação e restrição efetiva verificadas](PATCH_CATALOGO_2026_11_12.md).

Reexecutar somente após alteração relevante:

```powershell
cd server
node scripts/with-postgresql-test-env.cjs node tests/catalog-identity-postgresql.integration.cjs
node scripts/with-neon-verification-env.cjs node tests/catalog-identity-postgresql.integration.cjs
```

## Limites preservados

Os 15 modelos mantêm paridade estrutural; JSONB e TIMESTAMPTZ são adaptações intencionais do PostgreSQL. A contagem anterior de 17 foi corrigida ao conferir ambos os schemas e a instalação limpa. Collations continuam diferentes: igualdade/uniqueness de strings pode variar entre MySQL e PostgreSQL. Esta rodada não altera collations, não comprova todos os casos de normalização nem substitui os gates de autorização e persistência.

A tela de nutrição também passou a oferecer links diretos às fontes FAO do PAL e dos fatores energéticos gerais. São referências já documentadas, consultadas novamente; equações e hipóteses não mudaram. Syntax check e 39 testes de interação da nutrição passaram, sem falhas ou ignorados (`nutrition-source-links-20261111.log`). Inspeção visual desta revisão continua pendente.
