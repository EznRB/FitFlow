# Paridade do catálogo publicada — 12/11/2026

A [PR 5](https://github.com/EznRB/FitFlow/pull/5) alinhou a FK de `exercises.catalog_exercise_id`: PostgreSQL agora usa `ON UPDATE RESTRICT`, como MySQL, preservando `ON DELETE RESTRICT`. Não foi identificado fluxo normal que alterasse IDs; trata-se de correção de paridade, sem alegar incidente.

## Código e gates anteriores

- Revisão `56da2acc50995043f26e6344752cd013adafd19f`; [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43151417812).
- Merge `f654cc0ed028614cf145b32be86fb475655dd647`; árvore idêntica à revisão: `ab3032f83217afbc13279885a3399bf0520233d5`. Não atribuir ao merge um run da revisão.
- Antes da correção, o gate real de PostgreSQL local e Neon isolado encontrou CASCADE. Depois da migration adicional, encontrou UPDATE/DELETE RESTRICT e FK validada. Prisma validate e revisão independente aprovados.
- Três arquivos: schema, migration adicional e gate read-only. Migrations anteriores não foram editadas. Nenhum ID, snapshot ou linha foi regravado.

## Produção

O wrapper administrativo validou projeto, branch, host, banco e usuário owner. A consulta anterior retornou `update_action=c`, `delete_action=r`, `validated=true`, `migrationApplied=0`. `prisma migrate deploy` aplicou somente `20261111_catalog_identity_restrict`, exit 0. A consulta posterior retornou `update_action=r`, `delete_action=r`, `validated=true`, `migrationApplied=1`. Há agora seis migrations PostgreSQL aplicadas; MySQL permanece com oito.

Logs sanitizados no checkout original, `server/tmp/`:

- `catalog-production-before-20261112.log`
- `catalog-production-migrate-20261112.log`
- `catalog-production-after-20261112.log`
- `catalog-production-inspect-20261112.json`
- `catalog-production-https-20261112.log`

A troca de FK ocorreu em transação e validou as referências existentes; ALTER TABLE adquire lock transitório em `exercises`. Não houve reset, seed, cobrança, alteração de conta ou operação destrutiva de dados.

O status GitHub vinculou o merge à publicação Vercel; inspect confirmou READY/production em `fit-flow-8oa63ukok-eznrbs-projects.vercel.app` e o alias público. O resumo do inspect não inclui SHA. Após a migration e publicação, o gate HTTPS público passou em banco, login/me dos três perfis, cookies, autorização, catálogo, painel, CSRF e logout.

Collations e tipos nativos continuam distintos entre providers. Esta evidência não certifica todos os comportamentos de igualdade, segurança, UI ou mobile. As demais pendências do objetivo permanecem abertas.
