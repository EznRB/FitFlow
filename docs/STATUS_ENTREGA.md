# Estado da entrega — 17/10/2026

O objetivo completo permanece em desenvolvimento. A rodada de 17/10 publicou melhorias de confirmação/recuperação na nutrição, no registro avulso e na presença do aluno, além da expansão do histórico. O login publicado funciona com banco Neon e contas demonstrativas novas; os dados do Aiven não foram recuperados. A demonstração local usa MariaDB nativo, sem Docker.

## Implantação atual

| Aplicação | Código publicado e evidência |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app/) | Código funcional `b84c5b520ba6267a656cccd21f682dbb46f8acb4` integrado à `main`. [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/39067716129/job/117498723137) e [publicação Git/Vercel aprovada](https://vercel.com/eznrbs-projects/fit-flow/7VroTHi66nJ9QPZzXK3iPaYzFXsc). Suíte nativa **790/790**, zero falhas/ignorados; saúde HTTP 200, banco ready, API no-store e **30 assets** iguais aos blobs Git por SHA-256. Login e leitura de presença confirmados no browser público, sem registrar entrada. [Provas e limites](REVISAO_VISUAL_SISTEMA.md#17102026--nutrição-e-área-do-aluno). |
| [Landing](https://fitflow-lp.vercel.app/) | Código funcional `7f0d1f62f7ff87d27ae0666c3d45ff29da859276`; documentação `cd4f069caa770fade8b3c16e5a2e4bab379485f5`, ambos na `main`. [CI aprovada](https://github.com/EznRB/fitflow-LP/actions/runs/38813031385/job/116690731098) e [publicação Git/Vercel aprovada](https://vercel.com/eznrbs-projects/fitflow-lp/4eZ7eoFSFfjx5pJwHBY6jDVJvaS4). Build/typecheck, cinco testes de destinos e SHA-256 de HTML/JS/CSS/hero/captura aprovados; [inspeção pública](evidence/153-landing-integrated-20261015.jpg). |

[PR do aplicativo](https://github.com/EznRB/FitFlow/pull/1) integrado e fechado em 13/10. O [PR da landing](https://github.com/EznRB/fitflow-LP/pull/1) foi revisado, marcado como pronto e integrado em 15/10: GitHub confirmou `merged=true`, `draft=false`. Avanços normais de `main`, sem force-push, autorizados pelo pedido de atualização para apresentação. A suíte, os hashes e as capturas demonstram os respectivos escopos, não a conclusão integral do projeto.

[Acesso e roteiro da apresentação](APRESENTACAO.md): cinco contas tiveram login e restauração de sessão 200 por HTTPS em 13/10. Senhas atuais estão em arquivo privado ignorado para compartilhar com o professor; não foram commitadas. README e roteiro na `main` foram comparados por SHA-256 com os arquivos locais.

## Capacidades e gates

| Frente | Implementado/verificado | Limite ou gate aberto |
|---|---|---|
| Banco, login e conta | Neon PostgreSQL publicado; três perfis; oito migrations MySQL e cinco PostgreSQL; troca de senha própria com revogação validada nos bancos e HTTPS. | Sem recuperação do Aiven. Rotação da chave Groq pelo titular pendente. [Contrato de senha](TROCA_SENHA.md). |
| Gestão | Alunos, planos, fichas, presença/cancelamento, relatórios e datas brasileiras; gates reais de banco/HTTPS e testes de concorrência/identidade. Livro de presenças tem ações imediatas, recuperação do resumo/lista e formulários protegidos contra callbacks antigos. | Revisão visual por estado e jornada continua. [Datas](DATAS_E_FUSO.md) e [auditoria](REVISAO_FINAL.md). |
| Treino e catálogo | Sessões/séries idempotentes, carga/reps/RIR, trabalho/aquecimento, progressão, fila por conta, catálogo com créditos persistidos; ficha, caderno e Evolução refinados. Avulso preserva rascunho e exige consulta/revisão após envio incerto; histórico permite expandir todos os registros consultados. Fixture exclusiva limpa após validação. | Catálogo descritivo não valida prescrição; avulso legado não promete idempotência. Emulação não valida aparelho físico. [Ciência](CIENCIA.md), [revisão visual](REVISAO_VISUAL_SISTEMA.md). |
| Nutrição | Mifflin e Harris revisada, energia/macros determinísticos, hipóteses explícitas; persistência consentida por usuário e restauração. Confirma snapshot salvo, prazo de 15 s e revisão de resultado incerto; callbacks pertencem ao render/sessão original. | Estimativa para adulto saudável, sem prescrição clínica. Bloqueio de repetição é em RAM, não uma garantia de idempotência entre recargas. [Fórmulas e cenário verificável](CIENCIA.md#energia-e-macronutrientes). |
| Chat de IA | Conversa contextual e rascunho educativo, Groq Free/GPT-OSS, consentimento, referências curadas e cálculos estruturados no servidor; amostras reais inspecionadas. Esclarecimento renderizado por enums, contexto positivo e contradições/correções explícitas conferidos. | **Nova amostra de dois dias em 17/10 reprovada por cobertura/distribuição insuficientemente explicada**; correção em andamento. Histórico em memória e interpretação conservadora, sem triagem clínica. [Amostra e limites](IA_GRATUITA.md#revisão-de-cobertura-do-rascunho--17102026). |
| Financeiro | Recebimentos manuais idempotentes, ajustes auditados, recibo protegido e relatórios conciliáveis; checkout/webhook/conciliação testados com provedor simulado. | **Mercado Pago sandbox externo indisponível** sem conta/credenciais/webhook. Nenhuma cobrança ou devolução real executada. [Ajustes](AJUSTES_FINANCEIROS.md), [sandbox](PAGAMENTOS_SANDBOX.md). |
| Mobile/PWA | Layout emulado, cache público/fallback e fila privada por conta; offline/reconexão local e isolamento testados. | Instalação, teclado e reconexão publicada em telefone físico **não realizados**. [M01–M14](VALIDACAO_MOBILE.md). |
| UX/UI e landing | Identidade laranja/navy/Barlow; apresentações distintas para gestão, treino, nutrição e chat; landing com fotografia ilustrativa e captura real identificada como demonstração. | Revisão completa de telas/estados/teclado/contraste ainda aberta; capturas não certificam toda acessibilidade. [Critérios e provas](REVISAO_VISUAL_SISTEMA.md). |

## Próximas etapas obrigatórias

[Rodada de 17/10](REVISAO_VISUAL_SISTEMA.md#17102026--nutrição-e-área-do-aluno): nutrição, avulso, histórico e presença revisados, **790/790** locais, CI/implantação/30 assets aprovados. Teste integrado financeiro repetido no MariaDB com provedor controlado, sem chamadas ao PSP ou estorno real. As cinco capturas locais documentam estados específicos; a revisão integral e os gates externos continuam abertos.

[Rodada publicada de 15/10](RODADA_UX_CHAT_PLANOS_2026_10_14.md): apresentação estruturada do rascunho, correção de falsa contradição de equipamento, leitura da nova resposta, recuperação sem descarte de rascunho nos planos e configuração estrita da origem do webhook. **741/741** locais; CI, assets e amostra real no browser publicado aprovados. A integração da landing também foi concluída, com seus gates próprios.

[Rodada publicada de 14/10](RODADA_2026_10_14.md): seleção estrita de citações originais e exclusão de provas obsoletas no rascunho da IA; prazo total da chamada externa de pagamentos; contrato de provedores; editor de ficha e relatório financeiro refinados. Suíte integral **664/664**, CI e publicação aprovadas; correção fictícia real conferida por HTTPS e nova conversa aprovada no browser. Checkout externo permanece desativado, confirmado por endpoint autenticado.

Rodada publicada em 12/10: contrato de contexto/esclarecimentos do chat corrigido, presenças protegidas contra callbacks/consultas antigas e composição de livro diário. Browser público confirmou restauração do aluno e conversa real: contexto incompleto gerou perguntas controladas, continuação fictícia completa gerou rascunho de segunda/quarta/sexta com 50 minutos disponíveis, fontes e contagens revisáveis. Gates locais e limites em [IA gratuita](IA_GRATUITA.md) e [revisão visual](REVISAO_VISUAL_SISTEMA.md). Documentação consolidada sem apagar as narrativas históricas.

1. Continuar a revisão integral de jornadas e estados da interface; validar as próximas mudanças antes de publicar.
   - Corrigir a cobertura/distribuição do rascunho de dois dias identificada na geração real de 17/10, com referências e gates próprios.
2. Quando o proprietário estiver disponível, configurar conta de teste, token e webhook Mercado Pago. Executar cartão aprovado/rejeitado/pendente, webhook assinado/replay e Pix QR/pendente **sem renovar plano**. Sandbox não comprova liquidação Pix.
3. Executar o roteiro M01–M14 em aparelho físico e registrar plataforma, implantação e evidências.
4. Rotacionar a chave Groq exposta anteriormente pelo titular e validar a substituição privada.
5. Manter os gates das próximas mudanças e a documentação da entrega acadêmica. A integração dos repositórios não encerra a revisão contínua de todas as jornadas e estados.

## Publicação automática pelo GitHub

CI e status Git/Vercel da revisão atual estão aprovados. A tentativa de CLI em 13/10 retornou `Not authorized`; o conector Vercel também pede reautenticação. A publicação foi feita pela integração Git existente, após atualizar main, sem ampliar permissões. A comparação com o arquivo Windows inicialmente divergiu por CRLF/LF; `git diff --no-index` confirmou equivalência textual e o gate passou a conferir os blobs comprometidos no Git, iguais ao checkout do deploy. Não se remove conteúdo para obter o hash esperado.

Falhas anteriores `git_info_fail` e recuperações sem mudança de permissões permanecem no [histórico documental](HISTORICO_ENTREGA.md#publicação-automática-pelo-github); sua causa não foi comprovada. Um deployment manual READY não substitui o status do Git automático.

## Documentação de referência

[Plano mestre](PLANO_MESTRE_DESENVOLVIMENTO.md) · [Auditoria por requisito](REVISAO_FINAL.md) · [Desenvolvimento e gates](DESENVOLVIMENTO.md) · [Banco/Vercel](BANCO_REMOTO_VERCEL.md) · [Revisão científica](AUDITORIA_CIENTIFICA_FINAL.md) · [Ferramentas pesquisadas](FERRAMENTAS_E_INTEGRACOES.md) · [Histórico preservado](HISTORICO_ENTREGA.md).

Relatos datados e screenshots registram a versão e o fluxo descritos; não comprovam automaticamente alterações posteriores. Credenciais ficam em arquivos privados ignorados, nunca nesta documentação.
