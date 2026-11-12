# E-mail editado e login PostgreSQL — 11/11/2026

## Problema reproduzido

Cadastro e login usam e-mail com espaços externos removidos e letras minúsculas. A edição administrativa de alunos gravava o valor bruto, sem validação equivalente. No PostgreSQL, cuja comparação de e-mails é sensível à caixa, editar para `NOVO@Example.Invalid` podia impedir o login: a consulta usava `novo@example.invalid`, mas o endereço salvo era diferente. O comportamento do MySQL podia esconder o problema por sua collation.

## Correção

Os helpers compartilhados de nome/e-mail agora atendem cadastro e edição. A edição normaliza antes de procurar colisões e antes de gravar, rejeitando nome vazio/tipo/tamanho inválido e e-mail inválido com 400. Campos omitidos ou `null` mantêm o contrato anterior de edição parcial, sem apagar identidade. Senhas, papéis, planos e revisão de matrícula não foram alterados. Não houve migration nem alteração em contas existentes.

## Evidência e limites

- RED: os dois testes novos falharam no código anterior: persistência do valor bruto e ausência de rejeição. Log `server/tmp/student-email-edit-red-20261111.log`, exit 1.
- GREEN: oito testes de edição passaram, incluindo os dois novos, omissão, datas civis, CPF e revisão de matrícula. Log `student-email-edit-green-20261111.log`, exit 0.
- PostgreSQL local dedicado e Neon isolado de verificação: edição com espaços/maiúsculas seguida de login real pelo serviço, manutenção do próprio e-mail, colisão com outra conta e recusa de endereço inválido passaram. Logs `student-email-postgresql-20261111.log` e `student-email-neon-20261111.log`, exit 0. Fixtures próprias removidas em `finally`; nenhum token/senha registrado nos logs.
- 31 testes relacionados de segurança, senha e concorrência administrativa passaram, sem falhas ou ignorados. Log `student-email-related-20261111.log`, exit 0. Não somar aos oito como novo total da suíte integral.
- Consulta agregada somente leitura na branch de produção confirmou **zero e-mails fora do padrão e zero colisões após normalização** naquele momento. Log `student-email-production-counts-20261111.log`, exit 0; nenhum endereço retornado. Portanto não houve necessidade de reparar contas existentes.
- Revisão independente sem bloqueantes. Correção posteriormente publicada separadamente pela PR 4 em 12/11. [Revisão, CI, implantação e gate HTTPS](PATCH_EMAIL_2026_11_12.md). Não reclassifica os gates de UX/mobile/pagamentos como aprovados.

A regra de caixa é a política já utilizada pelo aplicativo. Esta correção não equivale a verificação da propriedade do e-mail, não muda caracteres internacionais nem resolve todas as diferenças de collation dos bancos.
