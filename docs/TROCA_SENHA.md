# Troca de senha e invalidação de sessões

Contrato e validação local — 12/10/2026. A validação HTTPS da publicação será registrada após o deploy.

## Fluxo do titular

Administrador, instrutor e aluno podem alterar a própria senha no menu da conta. O formulário pede a senha atual, a nova senha e sua confirmação. A API aceita somente senha atual, nova senha e ID esperado do titular; não permite trocar a senha de outra conta por esse endpoint.

A senha segue a validação existente: pelo menos oito caracteres, até 72 bytes UTF-8 e conteúdo não vazio. A comparação e o hash bcrypt ocorrem no servidor. Senhas não são gravadas no armazenamento do navegador, em logs ou em respostas públicas.

## Revogação

`User.credentialVersion` começa em zero. O login inclui essa versão no JWT; cada requisição autenticada compara a versão assinada com a atual no banco. Após a troca, o servidor altera o hash e incrementa a versão na mesma atualização condicional. Todas as sessões da versão anterior ficam inválidas, inclusive em outros dispositivos.

Para compatibilidade inicial, um token antigo sem a claim representa versão zero apenas enquanto a conta ainda está na versão zero. Claims de tipo inválido são recusadas. A edição de perfil não altera a versão de credencial.

A atualização usa compare-and-swap de ID, conta ativa, hash anterior e versão anterior. Duas mudanças concorrentes não podem sobrescrever uma à outra. Uma tentativa de login que leu o hash anterior produz um token anterior, que será recusado após a troca.

## HTTP e navegador

- `POST /api/auth/password`: autenticação, proteção CSRF e quota compartilhada de cinco tentativas por titular a cada 15 minutos.
- Senha atual incorreta retorna 400, permitindo correção sem provocar logout automático por 401.
- Versão obsoleta ou alteração concorrente retorna 409.
- Sucesso retorna confirmação e necessidade de novo login, sem senha, hash, JWT ou versão interna.

A resposta do endpoint de senha não modifica o cookie. Assim, uma resposta tardia não pode apagar o cookie de um login mais recente. O navegador utiliza o protocolo existente de bloqueio entre abas e logout confirmado para limpar o cookie antes de permitir outro login.

O POST de troca tem prazo de 15 segundos. Em resultado incerto, não há retry automático: a mesma conta precisa entrar novamente e conferir se a nova senha passou a valer. A intenção de logout bloqueia restauração automática até confirmar a limpeza do cookie. Troca de conta durante a espera não permite enviar as senhas do formulário anterior para a conta nova.

Registros de treino pendentes permanecem no armazenamento da mesma conta durante essa reautenticação; ficam inacessíveis à conta diferente e não são sincronizados sem autenticação válida. O logout explícito conserva seu fluxo anterior de sincronização/descarte escolhido pelo usuário.

## Implementação e verificação

1. Migrações aditivas MySQL/PostgreSQL para versão não negativa; nenhuma troca de senha de conta demonstrativa durante a implantação.
2. Serviço, JWT/middleware, controller e quota com testes de senha atual, validação, concorrência, sessão antiga e isolamento de conta.
3. Formulário acessível, coordenação de cookie e recuperação de resposta incerta; proteção do histórico local de treino.
4. Bancos nativos e branch Neon de verificação com dados sintéticos, seguida da validação HTTPS publicada e limpeza restrita às fixtures.
5. Conferência visual local e publicada do formulário vazio, sem alterar credenciais pelo navegador automatizado.

Essa função não é recuperação de senha por e-mail. A rotação da chave Groq exposta anteriormente pertence a outra credencial e continua pendente do retorno do proprietário.

## Evidências em 12/10/2026

- Suíte local completa: 500/500 testes, zero falhas ou testes ignorados.
- Gate com dois clientes Prisma: aprovado em MariaDB nativo, PostgreSQL nativo e branch Neon de verificação. Cobriu concorrência, restrição de versão, revogação dos JWTs anteriores e preservação de outra conta; somente contas UUID desta execução foram removidas.
- Migração `20261012_credential_version` aplicada nos dois bancos nativos, na branch Neon de verificação e no Neon principal. São oito migrações MySQL e cinco PostgreSQL.
- Formulário vazio inspecionado localmente em desktop e em 375 × 812; inputs de 16 px, documento de 375 px sem transbordamento horizontal. Nenhuma senha foi alterada pelo navegador automatizado. Capturas locais ignoradas pelo Git: `server/tmp/44-seguranca-conta-local.png` e `45-seguranca-conta-mobile-local.png`.
- O gate `hosted-password-change.integration.cjs` prepara contas sintéticas e verifica o endpoint HTTPS; sua execução exige `--execute-hosted-fixtures`. O sucesso desse gate será registrado após a publicação.

A revogação descrita cobre a troca feita pelo endpoint. Uma alteração direta de hash por um administrador do banco deve incrementar a versão de credencial na mesma operação; não há trigger que faça isso automaticamente.
