# Estado da entrega — 12/10/2026

A meta completa permanece ativa. O login publicado funciona com banco Neon e contas demonstrativas novas; os dados do Aiven não foram recuperados. A demonstração local usa MariaDB nativo, sem Docker.

## Implantação atual

| Aplicação | Código publicado e evidência |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app/) | `024a7f0` (`024a7f071a16544045717c0957d2a0576e629c16`), Production READY `dpl_9uy2owcJHVbtk7vrCE7g7qYQkZqo`. [URL exata](https://fit-flow-csrfe5zva-eznrbs-projects.vercel.app). [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38309575269/job/115011729174) e Preview Git aprovado. Suíte integral local **564/564**, zero falhas/ignorados; saúde HTTP 200, banco ready, API no-store e **23 hashes** conferidos. |
| [Landing](https://fitflow-lp.vercel.app/) | `754b27f` (`754b27f60cb9eb3886410ddc89970b64a16cee7a`), Production READY `dpl_G157NAMK6HzXawYqQi1ZHBry48DS`. [URL exata](https://fitflow-2nzi5b3g2-eznrbs-projects.vercel.app). Build/typecheck e comparação SHA-256 de HTML/JS/CSS/hero/captura aprovados; inspeção pública desktop/mobile registrada. A revisão documental posterior não é uma nova versão visual. |

Código nos PRs **draft** [do aplicativo](https://github.com/EznRB/FitFlow/pull/1) e [da landing](https://github.com/EznRB/fitflow-LP/pull/1). Nenhum merge à branch principal realizado. A suíte, os hashes e as capturas demonstram os respectivos escopos, não a conclusão integral do projeto.

## Capacidades e gates

| Frente | Implementado/verificado | Limite ou gate aberto |
|---|---|---|
| Banco, login e conta | Neon PostgreSQL publicado; três perfis; oito migrations MySQL e cinco PostgreSQL; troca de senha própria com revogação validada nos bancos e HTTPS. | Sem recuperação do Aiven. Rotação da chave Groq pelo titular pendente. [Contrato de senha](TROCA_SENHA.md). |
| Gestão | Alunos, planos, fichas, presença/cancelamento, relatórios e datas brasileiras; gates reais de banco/HTTPS e testes de concorrência/identidade. | Revisão visual por estado e jornada continua. [Datas](DATAS_E_FUSO.md) e [auditoria](REVISAO_FINAL.md). |
| Treino e catálogo | Sessões/séries idempotentes, carga/reps/RIR, trabalho/aquecimento, progressão, fila por conta, catálogo com créditos persistidos; ficha, caderno e Evolução refinados. Formulário avulso corrigido e testado com fixture exclusiva. | Catálogo descritivo não valida prescrição; avulso legado não promete idempotência. Emulação não valida aparelho físico. [Ciência](CIENCIA.md), [revisão visual](REVISAO_VISUAL_SISTEMA.md). |
| Nutrição | Mifflin e Harris revisada, energia/macros determinísticos, hipóteses explícitas; persistência consentida por usuário e restauração. | Estimativa para adulto saudável, sem prescrição clínica. [Fórmulas e cenário verificável](CIENCIA.md#energia-e-macronutrientes). |
| Chat de IA | Conversa contextual e rascunho educativo, Groq Free/GPT-OSS, consentimento, referências curadas e cálculos estruturados no servidor; amostras reais inspecionadas. | Histórico em memória; amostras reprovadas preservadas; sem certificação de toda resposta futura. [Configuração e limites](IA_GRATUITA.md). |
| Financeiro | Recebimentos manuais idempotentes, ajustes auditados, recibo protegido e relatórios conciliáveis; checkout/webhook/conciliação testados com provedor simulado. | **Mercado Pago sandbox externo indisponível** sem conta/credenciais/webhook. Nenhuma cobrança ou devolução real executada. [Ajustes](AJUSTES_FINANCEIROS.md), [sandbox](PAGAMENTOS_SANDBOX.md). |
| Mobile/PWA | Layout emulado, cache público/fallback e fila privada por conta; offline/reconexão local e isolamento testados. | Instalação, teclado e reconexão publicada em telefone físico **não realizados**. [M01–M14](VALIDACAO_MOBILE.md). |
| UX/UI e landing | Identidade laranja/navy/Barlow; apresentações distintas para gestão, treino, nutrição e chat; landing com fotografia ilustrativa e captura real identificada como demonstração. | Revisão completa de telas/estados/teclado/contraste ainda aberta; capturas não certificam toda acessibilidade. [Critérios e provas](REVISAO_VISUAL_SISTEMA.md). |

## Próximas etapas obrigatórias

Rodada local preparada em 12/10: contrato de contexto/esclarecimentos do chat corrigido, presenças protegidas contra callbacks/consultas antigas e composição de livro diário; suíte integral **603/603**, zero falhas/ignorados. Amostras reais Groq no serviço local aprovadas; navegador local conferiu lista vazia, datas inválidas/recuperação, formulário vazio e retorno de foco em frequência, 375/768 sem overflow. Ainda não é a revisão publicada da tabela acima. Documentação consolidada sem apagar as narrativas históricas.

1. Continuar a revisão integral de jornadas e estados da interface; validar as próximas mudanças antes de publicar.
2. Quando o proprietário estiver disponível, configurar conta de teste, token e webhook Mercado Pago. Executar cartão aprovado/rejeitado/pendente, webhook assinado/replay e Pix QR/pendente **sem renovar plano**. Sandbox não comprova liquidação Pix.
3. Executar o roteiro M01–M14 em aparelho físico e registrar plataforma, implantação e evidências.
4. Rotacionar a chave Groq exposta anteriormente pelo titular e validar a substituição privada.
5. Revisar os PRs draft e decidir a integração; manter os gates das mudanças e a documentação da entrega acadêmica.

## Publicação automática pelo GitHub

CI e Preview Git da revisão atual estão aprovados. Falhas anteriores `git_info_fail` e recuperações sem mudança de permissões permanecem no [histórico documental](HISTORICO_ENTREGA.md#publicação-automática-pelo-github); sua causa não foi comprovada. Um deployment manual READY não substitui o status do Git automático.

## Documentação de referência

[Plano mestre](PLANO_MESTRE_DESENVOLVIMENTO.md) · [Auditoria por requisito](REVISAO_FINAL.md) · [Desenvolvimento e gates](DESENVOLVIMENTO.md) · [Banco/Vercel](BANCO_REMOTO_VERCEL.md) · [Revisão científica](AUDITORIA_CIENTIFICA_FINAL.md) · [Ferramentas pesquisadas](FERRAMENTAS_E_INTEGRACOES.md) · [Histórico preservado](HISTORICO_ENTREGA.md).

Relatos datados e screenshots registram a versão e o fluxo descritos; não comprovam automaticamente alterações posteriores. Credenciais ficam em arquivos privados ignorados, nunca nesta documentação.
