# Estado da entrega — 14/10/2026

O objetivo completo ainda não foi concluído; o goal voltou ao estado ativo em 14/10 após o limite de uso de 13/10. A atualização solicitada para apresentação foi executada. O login publicado funciona com banco Neon e contas demonstrativas novas; os dados do Aiven não foram recuperados. A demonstração local usa MariaDB nativo, sem Docker.

## Implantação atual

| Aplicação | Código publicado e evidência |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app/) | Código `c829c8b` (`c829c8bbfa09c5d9270ed13c6df3ffc08b2c9db9`) integrado na `main`. [CI da main aprovada](https://github.com/EznRB/FitFlow/actions/runs/38341304992/job/115112671707), [CI do PR](https://github.com/EznRB/FitFlow/actions/runs/38341143641/job/115112169012) e [publicação Git/Vercel concluída](https://vercel.com/eznrbs-projects/fit-flow/A8YXpEtQ21BZRvvsH6JA5sB1q2Zm). Suíte integral local **606/606**, zero falhas/ignorados; saúde HTTP 200, banco ready, API no-store e **24 assets** com SHA-256 igual aos blobs Git do commit. |
| [Landing](https://fitflow-lp.vercel.app/) | `754b27f` (`754b27f60cb9eb3886410ddc89970b64a16cee7a`), Production READY `dpl_G157NAMK6HzXawYqQi1ZHBry48DS`. [URL exata](https://fitflow-2nzi5b3g2-eznrbs-projects.vercel.app). Build/typecheck e comparação SHA-256 de HTML/JS/CSS/hero/captura aprovados; inspeção pública desktop/mobile registrada. A revisão documental posterior não é uma nova versão visual. |

[PR do aplicativo](https://github.com/EznRB/FitFlow/pull/1) integrado e fechado: GitHub confirmou `merged=true`, após avanço normal de `main` sem force-push em 13/10, autorizado pelo pedido de atualização para apresentação. O [PR da landing](https://github.com/EznRB/fitflow-LP/pull/1) continua draft. A suíte, os hashes e as capturas demonstram os respectivos escopos, não a conclusão integral do projeto.

[Acesso e roteiro da apresentação](APRESENTACAO.md): cinco contas tiveram login e restauração de sessão 200 por HTTPS em 13/10. Senhas atuais estão em arquivo privado ignorado para compartilhar com o professor; não foram commitadas. README e roteiro na `main` foram comparados por SHA-256 com os arquivos locais.

## Capacidades e gates

| Frente | Implementado/verificado | Limite ou gate aberto |
|---|---|---|
| Banco, login e conta | Neon PostgreSQL publicado; três perfis; oito migrations MySQL e cinco PostgreSQL; troca de senha própria com revogação validada nos bancos e HTTPS. | Sem recuperação do Aiven. Rotação da chave Groq pelo titular pendente. [Contrato de senha](TROCA_SENHA.md). |
| Gestão | Alunos, planos, fichas, presença/cancelamento, relatórios e datas brasileiras; gates reais de banco/HTTPS e testes de concorrência/identidade. Livro de presenças tem ações imediatas, recuperação do resumo/lista e formulários protegidos contra callbacks antigos. | Revisão visual por estado e jornada continua. [Datas](DATAS_E_FUSO.md) e [auditoria](REVISAO_FINAL.md). |
| Treino e catálogo | Sessões/séries idempotentes, carga/reps/RIR, trabalho/aquecimento, progressão, fila por conta, catálogo com créditos persistidos; ficha, caderno e Evolução refinados. Formulário avulso corrigido e testado com fixture exclusiva. | Catálogo descritivo não valida prescrição; avulso legado não promete idempotência. Emulação não valida aparelho físico. [Ciência](CIENCIA.md), [revisão visual](REVISAO_VISUAL_SISTEMA.md). |
| Nutrição | Mifflin e Harris revisada, energia/macros determinísticos, hipóteses explícitas; persistência consentida por usuário e restauração. | Estimativa para adulto saudável, sem prescrição clínica. [Fórmulas e cenário verificável](CIENCIA.md#energia-e-macronutrientes). |
| Chat de IA | Conversa contextual e rascunho educativo, Groq Free/GPT-OSS, consentimento, referências curadas e cálculos estruturados no servidor; amostras reais inspecionadas. Esclarecimento renderizado por enums, contexto positivo e contradições/correções explícitas conferidos. | Histórico em memória; reconhecimento textual conservador, sem interpretação universal/triagem clínica; amostras reprovadas preservadas. [Configuração e limites](IA_GRATUITA.md). |
| Financeiro | Recebimentos manuais idempotentes, ajustes auditados, recibo protegido e relatórios conciliáveis; checkout/webhook/conciliação testados com provedor simulado. | **Mercado Pago sandbox externo indisponível** sem conta/credenciais/webhook. Nenhuma cobrança ou devolução real executada. [Ajustes](AJUSTES_FINANCEIROS.md), [sandbox](PAGAMENTOS_SANDBOX.md). |
| Mobile/PWA | Layout emulado, cache público/fallback e fila privada por conta; offline/reconexão local e isolamento testados. | Instalação, teclado e reconexão publicada em telefone físico **não realizados**. [M01–M14](VALIDACAO_MOBILE.md). |
| UX/UI e landing | Identidade laranja/navy/Barlow; apresentações distintas para gestão, treino, nutrição e chat; landing com fotografia ilustrativa e captura real identificada como demonstração. | Revisão completa de telas/estados/teclado/contraste ainda aberta; capturas não certificam toda acessibilidade. [Critérios e provas](REVISAO_VISUAL_SISTEMA.md). |

## Próximas etapas obrigatórias

[Rodada de 14/10](RODADA_2026_10_14.md): seleção estrita de citações originais no rascunho da IA; prazo total da chamada externa de pagamentos; contrato de provedores; editor de ficha e relatório financeiro refinados. Suíte local integral **663/663**, zero falhas/ignorados, e correção fictícia real aprovada no serviço Groq Free. A publicação desta rodada está em verificação; a tabela acima registra o último código cuja publicação já foi comprovada.

Rodada publicada em 12/10: contrato de contexto/esclarecimentos do chat corrigido, presenças protegidas contra callbacks/consultas antigas e composição de livro diário. Browser público confirmou restauração do aluno e conversa real: contexto incompleto gerou perguntas controladas, continuação fictícia completa gerou rascunho de segunda/quarta/sexta com 50 minutos disponíveis, fontes e contagens revisáveis. Gates locais e limites em [IA gratuita](IA_GRATUITA.md) e [revisão visual](REVISAO_VISUAL_SISTEMA.md). Documentação consolidada sem apagar as narrativas históricas.

1. Continuar a revisão integral de jornadas e estados da interface; validar as próximas mudanças antes de publicar.
2. Quando o proprietário estiver disponível, configurar conta de teste, token e webhook Mercado Pago. Executar cartão aprovado/rejeitado/pendente, webhook assinado/replay e Pix QR/pendente **sem renovar plano**. Sandbox não comprova liquidação Pix.
3. Executar o roteiro M01–M14 em aparelho físico e registrar plataforma, implantação e evidências.
4. Rotacionar a chave Groq exposta anteriormente pelo titular e validar a substituição privada.
5. Revisar e decidir a integração do PR draft da landing; manter os gates das próximas mudanças e a documentação da entrega acadêmica. A revisão contínua do aplicativo não termina com sua integração à main.

## Publicação automática pelo GitHub

CI e status Git/Vercel da revisão atual estão aprovados. A tentativa de CLI em 13/10 retornou `Not authorized`; o conector Vercel também pede reautenticação. A publicação foi feita pela integração Git existente, após atualizar main, sem ampliar permissões. A comparação com o arquivo Windows inicialmente divergiu por CRLF/LF; `git diff --no-index` confirmou equivalência textual e o gate passou a conferir os blobs comprometidos no Git, iguais ao checkout do deploy. Não se remove conteúdo para obter o hash esperado.

Falhas anteriores `git_info_fail` e recuperações sem mudança de permissões permanecem no [histórico documental](HISTORICO_ENTREGA.md#publicação-automática-pelo-github); sua causa não foi comprovada. Um deployment manual READY não substitui o status do Git automático.

## Documentação de referência

[Plano mestre](PLANO_MESTRE_DESENVOLVIMENTO.md) · [Auditoria por requisito](REVISAO_FINAL.md) · [Desenvolvimento e gates](DESENVOLVIMENTO.md) · [Banco/Vercel](BANCO_REMOTO_VERCEL.md) · [Revisão científica](AUDITORIA_CIENTIFICA_FINAL.md) · [Ferramentas pesquisadas](FERRAMENTAS_E_INTEGRACOES.md) · [Histórico preservado](HISTORICO_ENTREGA.md).

Relatos datados e screenshots registram a versão e o fluxo descritos; não comprovam automaticamente alterações posteriores. Credenciais ficam em arquivos privados ignorados, nunca nesta documentação.
