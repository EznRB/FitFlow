# Patches de dependências — 11/11/2026

Revisão isolada a partir de `daa919178642d472f5bd22a18d16848b24424997`, versão publicada antes desta correção.

## Alteração

- `body-parser` 1.20.8 → 1.20.9: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).
- `qs` 6.16.0 → 6.16.1: [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).

Express permanece em 4.22.1. O lockfile altera somente versão, URL e integridade desses dois pacotes. Instalação com `npm ci --ignore-scripts`; cliente Prisma gerado sem migration, seed ou alteração de esquema. Código de interface e regras do sistema preservados.

## Verificação local

**804/804 testes**, nenhuma falha ou ignorado, saída 0, MariaDB nativo. Log local ignorado: `server/tmp/full-production-security-patches-20261111.log` nesta worktree. Os testes novos verificam as dependências resolvidas pelo Express e a compatibilidade básica; a reprodução de gzip malformado usa processo filho isolado e porta efêmera de localhost, sem atacar a implantação.

As falhas antigas foram reproduzidas antes da atualização na branch de desenvolvimento. A suíte dessa branch tem escopo diferente e não é atribuída a esta revisão da produção. O cenário de `qs.stringify` prova comportamento da biblioteca, sem demonstrar explorabilidade no aplicativo.

O runtime local é Node 25.7.0; a entrega exige aprovação da CI em Node 24 e conferência da implantação pelo SHA. Não houve cobrança, publicação de credenciais, escrita em banco remoto nem importação das mudanças de IA/UX da PR 2.
