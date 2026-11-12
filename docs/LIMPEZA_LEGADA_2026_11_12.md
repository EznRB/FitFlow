# Limpeza legada publicada — 12/11/2026

A [PR 8](https://github.com/EznRB/FitFlow/pull/8) removeu `middleware/validators.js` e `repositories/exercicios.repository.js`, sem consumidores no código, testes ou scripts e sem carregamento automático por diretório. As validações atuais continuam nos serviços/utils; as fichas continuam nos repositórios ativos.

O lockfile perdeu somente `express-validator`, `lodash` e `validator`, exclusivos da camada removida; nenhuma versão restante foi alterada. O middleware de erros mudou apenas um comentário. Revisão independente sem bloqueantes.

## Verificação e publicação

- Revisão final `2604ed0923d7d3fec0b30f5a16e5703cac2ee446`; [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43153903335).
- Merge `f1f1ef91a269e1b3d2a766f49e414aa65e2ddb7d`; árvore idêntica à revisão: `73df71e4d5baf1af6fc90c3cf0770cae1d716c54`. Não atribuir ao merge o run da revisão.
- Instalação limpa e Prisma generate no worktree isolado passaram. A suíte de preparação passou 807 testes, zero falhas, um gate MariaDB ignorado por conexão inerte. Antes de abrir o PR foi retirado um bloco Retry-After copiado da PR 2; portanto esse resultado local não é atribuído à árvore final. A CI final acima é a prova dessa árvore.
- Preview com saúde/banco aprovados. Produção READY em `fit-flow-3pgl5hn1i-eznrbs-projects.vercel.app`, alias público confirmado. Correlação do merge pelo status GitHub; o resumo de inspect não expõe SHA.
- Gate HTTPS público pós-publicação passou: banco ready, login/me nos três perfis, cookies, autorização, catálogo, painel do aluno, CSRF e logout.

Logs completos da preparação no worktree: `server/tmp/legacy-clean-install-20261112.log`, `legacy-prisma-generate-20261112.log`, `legacy-clean-full-20261112.log`. Provas de publicação no checkout original: `cleanup-preview-health-20261112.log`, `cleanup-production-inspect-20261112.json` e `cleanup-production-https-20261112.log`.

Sem alteração de históricos, migrations, contas, cobranças ou UI. `npm audit` sem avisos nessa execução não equivale a auditoria exaustiva. Os gates externos e a revisão visual da PR 2 continuam abertos.
