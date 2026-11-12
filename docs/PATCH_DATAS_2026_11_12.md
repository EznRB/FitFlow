# Datas de sessões publicadas — 12/11/2026

A [PR 6](https://github.com/EznRB/FitFlow/pull/6) publicou a validação do dia civil informado em sessões/séries antes da conversão do fuso para UTC. O JavaScript normalizava datas impossíveis, como 30 de fevereiro, para outro dia; agora a API recusa essas entradas com 400.

- Revisão `08f34efa0af7be80c54b2a84635158adeea6cb01`, [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/43152218896).
- Merge `dbce1c919096fc3d696b9a30df6430853bf320a7`, árvore idêntica à revisão: `9db1e1c6ea3d8d77627e49c53aec8d66940f6c0a`. O run citado é da revisão.
- Regressão falhou antes do fix. Depois, 21 testes de sessões/HTTP/evolução passaram, zero falhas/ignorados, incluindo virada de dia por fuso e 29/02 bissexto. Revisão independente sem problemas acionáveis.
- Nenhuma migration, regravação de dados ou mudança nos limites temporais. Replays com datas canônicas armazenadas continuam compatíveis. Reenviar uma data impossível anteriormente normalizada recebe 400 agora.

Preview vinculado pelo status GitHub passou em saúde/banco. Produção READY confirmada em `fit-flow-7bmdl8ath-eznrbs-projects.vercel.app`, com alias público. O resumo do inspect não expõe SHA; a correlação vem do status GitHub do merge.

O gate público autenticado em `/api/sessoes/start` recebeu 400 e a mensagem específica do calendário para data impossível, antes de qualquer criação de sessão; logout executado ao final. Saúde pública retornou 200/database ready. Nenhuma conta, histórico ou cobrança foi alterada.

Logs no checkout original, `server/tmp/`: `session-calendar-red-20261112.log`, `session-calendar-green-leap-20261112.log`, `calendar-preview-health-20261112.log`, `calendar-production-inspect-20261112.json`, `calendar-production-http-correct-route-20261112.log` e `calendar-production-health-20261112.json`. A primeira tentativa do gate público usou `/api/sessoes` em vez de `/api/sessoes/start` e retornou 404; foi corrigido o teste, preservando `calendar-production-http-20261112.log` e seu exit 1.

Demais gates de UX/UI, mobile físico, pagamento externo e chave Groq continuam abertos. Esta correção não conclui o objetivo integral.
