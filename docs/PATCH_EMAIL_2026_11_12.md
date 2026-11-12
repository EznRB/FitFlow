# Correção de e-mail publicada — 12/11/2026

A [PR 4](https://github.com/EznRB/FitFlow/pull/4) publicou a validação/normalização de nome e e-mail na edição administrativa. Cadastro e edição usam o mesmo helper; o login continua procurando o endereço sem espaços externos e em minúsculas. Evita a gravação de endereços que não seriam encontrados no PostgreSQL. Campos omitidos ou `null` mantêm a edição parcial anterior.

## Código e revisão

- Revisão aprovada: `ef01ecd7306488692141455554419299b131a63a`.
- Merge: `8bb802c688110ac5aacf087ee2d3a176dee017d2`.
- Árvore Git idêntica nos dois: `badbb6253a0745d6142de442c42445559024a7dd`.
- [CI da revisão](https://github.com/EznRB/FitFlow/actions/runs/43150995736): concluída com sucesso. Não atribuir esse run ao merge.
- Quatro arquivos de backend/testes, sem UI, migrations, alterações de contas existentes ou mudanças da PR 2. Revisão independente sem bloqueantes.

## Evidência preservada

No checkout isolado de produção, `npm test` com conexão MySQL inerte explícita passou em **805 testes, zero falhas e um ignorado**. O teste ignorado exige MariaDB real; executado separadamente no banco gerenciado, passou **1/1, zero ignorados**. Logs completos: `server/tmp/full-student-email-production-isolated-20261112.log` no worktree de publicação e `server/tmp/student-email-production-mariadb-gate-20261112.log` no checkout original. A primeira tentativa herdou seleção PostgreSQL sem Client gerado e falhou na preparação; o log `full-student-email-production-20261111.log` foi preservado, sem classificar essa tentativa como aprovada.

A regressão falhou antes do fix e passou depois. Edição seguida de login real, colisão e recusa de dados inválidos também passaram no PostgreSQL local e no Neon isolado. As fixtures próprias foram removidas. Consulta agregada de produção retornou zero e-mails fora do padrão e zero colisões canônicas; nenhuma conta existente foi modificada.

O preview vinculado pelo GitHub à revisão passou em saúde/banco. O merge recebeu status Vercel success, e `vercel inspect` confirmou produção READY em `fit-flow-5nued89nk-eznrbs-projects.vercel.app`, com alias `fit-flow-indol.vercel.app`. O JSON resumido do inspect não expõe SHA; a correlação do commit vem do status GitHub, sem inventar esse campo.

O gate HTTPS no alias público passou: banco ready, login/me nos três perfis, cookies Secure/HttpOnly/SameSite, autorização, catálogo, painel do aluno, CSRF e logout. Log sanitizado: `server/tmp/email-production-https-20261112.log`; metadata do deploy em `email-production-inspect-20261112.json`. Não houve edição de contas nem transação financeira no teste público.

Isso não encerra o objetivo completo. IA/UX da PR 2, migration de paridade do catálogo em produção, inspeção visual, aparelho físico, pagamento externo e rotação da chave Groq continuam com gates próprios.
