# Estado da entrega — 11/11/2026

O objetivo completo permanece em desenvolvimento. A rodada de 17/10 publicou melhorias de confirmação/recuperação na nutrição, no registro avulso e na presença do aluno, além da expansão do histórico. A atualização seguinte acrescentou recuperação da consulta de planos na matrícula, com bloqueio até selecionar um plano ativo confirmado. O login publicado funciona com banco Neon e contas demonstrativas novas; os dados do Aiven não foram recuperados. A demonstração local usa MariaDB nativo, sem Docker.

## Rodada em revisão

A [PR 2](https://github.com/EznRB/FitFlow/pull/2) continua em rascunho para a revisão visual de IA/UX. A revisão funcional `103b5a8` passou em **882/882 testes locais**, sem falhas ou ignorados, e na [CI em Node 24](https://github.com/EznRB/FitFlow/actions/runs/43105305251). Os patches de dependências também foram publicados separadamente na produção; a integração da main à branch de desenvolvimento não trouxe mudanças adicionais de runtime.

As rodadas desta revisão incluem catálogo de 26 variantes para a IA, contexto/correções de conversa, espera da quota, sugestões de alunos por teclado, avisos em modal, foco de menus/paginação, submissão por Enter e preservação do histórico do caderno. Presenças e painel receberam recuperação com contexto protegido. Os testes, amostras, versões e limites de cada rodada ficam em [continuidade funcional](VALIDACAO_CONTINUIDADE_2026_11_11.md) e [IA/catálogo](RODADA_IA_CATALOGO_2026_11_11.md). O preview `1ebc099` teve saúde e assets conferidos, mas não constitui prova visual das revisões seguintes.

A [auditoria de dependências](AUDITORIA_DEPENDENCIAS_2026_11_11.md) registra 15 diretas e 118 transitivas, com os dois avisos corrigidos e limites de avaliação explícitos. A revisão estática de persistência móvel não encontrou defeito concreto no escopo examinado. Inspeção visual integral, aparelho físico, provedor de pagamentos externo e rotação da chave Groq continuam abertos. A apresentação será preparada após a estabilização, conforme combinado.

## Revisão estática e limpeza de 11/11

Codex Security finalizou a rodada `38767c67-ab80-40a7-9b66-e35d8b1ec5ee` no código `6fa69ec`: 105/244 arquivos rastreados foram integralmente revisados, incluindo todos os 80 arquivos de `server/src` e os scripts operacionais. Nenhuma vulnerabilidade foi confirmada nesse escopo. A cobertura é **parcial**: 139 arquivos, principalmente testes, migrations e configuração, estão enumerados como pendentes no relatório local. Não houve execução ofensiva nem consulta a credenciais durante essa auditoria; isso não substitui validação de produção, visual ou mobile.

Removidos `server/database/schema.sql` e `seed.sql`, sem consumidores atuais: criavam tabelas antigas como `usuarios`, incompatíveis com a autenticação Prisma atual em `users`. O seed também sugeria credencial fixa obsoleta. Migrations, históricos, schemas Prisma e dados existentes foram preservados. A referência na análise de outubro permanece como registro histórico. Nenhuma alteração de runtime; a suíte aprovada não foi repetida.

## Implantação atual

**Atualização funcional de 12/11:** a [PR 4](https://github.com/EznRB/FitFlow/pull/4) publicou a normalização de e-mail na edição de alunos, merge `8bb802c688110ac5aacf087ee2d3a176dee017d2`. Revisão com CI aprovada e árvore idêntica à integrada; suíte isolada com 805 aprovados/zero falhas/um ignorado, e o gate MariaDB omitido passou separadamente (1/1). Produção READY e alias conferidos; HTTPS validou saúde e login/me nos três perfis, autorização, catálogo, painel, CSRF e logout. [Provas e limites](PATCH_EMAIL_2026_11_12.md). A tabela abaixo preserva o marco anterior de segurança; o código funcional atual é `8bb802c`.

Em revisão na PR 2: [paridade da identidade do catálogo](PARIDADE_CATALOGO_2026_11_11.md), com migration nova aprovada no PostgreSQL local e no Neon isolado de verificação. **Ainda não aplicada em produção.** A tela de nutrição recebeu fontes FAO diretas, com 39 testes de interação aprovados e inspeção visual pendente. Esses gates focados não alteram o total da suíte integral registrado acima.

Atualização de segurança de 11/11: os patches da PR 3 foram publicados separadamente das melhorias de IA/UX em revisão na PR 2. A árvore `ee23b4a577b1fd190f0815e5d4460ad8775b2180` é idêntica na revisão testada `6336a77` e no merge `67f1f34`; não foi localizado run de CI próprio do merge até a última consulta. O teste do pacote vulnerável ficou restrito a localhost.

| Aplicação | Código publicado e evidência |
|---|---|
| [FitFlow](https://fit-flow-indol.vercel.app/) | Código funcional `67f1f34e3ca2a2828ba993f1602203421ee15184`: patches de segurança em body-parser e qs integrados pela [PR 3](https://github.com/EznRB/FitFlow/pull/3), preservando interface e regras da versão anterior. **804/804 testes locais**, sem falhas ou ignorados; [CI Node 24 da revisão aprovada](https://github.com/EznRB/FitFlow/actions/runs/43105679648), árvore Git idêntica à integrada. Produção READY no SHA, alias público conferido, saúde/banco, login demonstrativo e restauração de sessão HTTP 200. [Escopo e provas](PATCH_SEGURANCA_2026_11_11.md). |
| [Landing](https://fitflow-lp.vercel.app/) | Código funcional `7f0d1f62f7ff87d27ae0666c3d45ff29da859276`; documentação `cd4f069caa770fade8b3c16e5a2e4bab379485f5`, ambos na `main`. [CI aprovada](https://github.com/EznRB/fitflow-LP/actions/runs/38813031385/job/116690731098) e [publicação Git/Vercel aprovada](https://vercel.com/eznrbs-projects/fitflow-lp/4eZ7eoFSFfjx5pJwHBY6jDVJvaS4). Build/typecheck, cinco testes de destinos e SHA-256 de HTML/JS/CSS/hero/captura aprovados; [inspeção pública](evidence/153-landing-integrated-20261015.jpg). |

[PR do aplicativo](https://github.com/EznRB/FitFlow/pull/1) integrado e fechado em 13/10. O [PR da landing](https://github.com/EznRB/fitflow-LP/pull/1) foi revisado, marcado como pronto e integrado em 15/10: GitHub confirmou `merged=true`, `draft=false`. Avanços normais de `main`, sem force-push, autorizados pelo pedido de atualização para apresentação. A suíte, os hashes e as capturas demonstram os respectivos escopos, não a conclusão integral do projeto.

[Acesso e roteiro da apresentação](APRESENTACAO.md): cinco contas tiveram login e restauração de sessão 200 por HTTPS em 13/10. Senhas atuais estão em arquivo privado ignorado para compartilhar com o professor; não foram commitadas. README e roteiro na `main` foram comparados por SHA-256 com os arquivos locais.

## Capacidades e gates

| Frente | Implementado/verificado | Limite ou gate aberto |
|---|---|---|
| Banco, login e conta | Neon PostgreSQL publicado; três perfis; oito migrations MySQL e cinco PostgreSQL; troca de senha própria com revogação validada nos bancos e HTTPS. | Sem recuperação do Aiven. Rotação da chave Groq pelo titular pendente. [Contrato de senha](TROCA_SENHA.md). |
| Gestão | Alunos, planos, fichas, presença/cancelamento, relatórios e datas brasileiras; gates reais de banco/HTTPS e testes de concorrência/identidade. Livro de presenças tem recuperação do resumo/lista. Matrícula distingue falha/vazio/seleção, preserva campos na nova consulta e exige plano ativo confirmado no handler. | Revisão visual por estado e jornada continua. [Datas](DATAS_E_FUSO.md) e [auditoria](REVISAO_FINAL.md). |
| Treino e catálogo | Sessões/séries idempotentes, carga/reps/RIR, trabalho/aquecimento, progressão, fila por conta, catálogo com créditos persistidos; ficha, caderno e Evolução refinados. Avulso preserva rascunho e exige consulta/revisão após envio incerto; histórico permite expandir todos os registros consultados. Fixture exclusiva limpa após validação. | Catálogo descritivo não valida prescrição; avulso legado não promete idempotência. Emulação não valida aparelho físico. [Ciência](CIENCIA.md), [revisão visual](REVISAO_VISUAL_SISTEMA.md). |
| Nutrição | Mifflin e Harris revisada, energia/macros determinísticos, hipóteses explícitas; persistência consentida por usuário e restauração. Confirma snapshot salvo, prazo de 15 s e revisão de resultado incerto; callbacks pertencem ao render/sessão original. | Estimativa para adulto saudável, sem prescrição clínica. Bloqueio de repetição é em RAM, não uma garantia de idempotência entre recargas. [Fórmulas e cenário verificável](CIENCIA.md#energia-e-macronutrientes). |
| Chat de IA | Conversa contextual e rascunho educativo, Groq Free/GPT-OSS, consentimento, referências curadas e cálculos estruturados no servidor; amostras reais inspecionadas. Esclarecimento renderizado por enums, contexto positivo e contradições/correções explícitas conferidos. | A reprovação histórica de 17/10 motivou o catálogo de IDs e a revisão de contagens por sessão, disponíveis na PR 2 e em preview; a integração em produção aguarda revisão visual. Histórico em memória e interpretação conservadora, sem triagem clínica. [Amostra e limites](IA_GRATUITA.md#revisão-de-cobertura-do-rascunho--17102026). |
| Financeiro | Recebimentos manuais idempotentes, ajustes auditados, recibo protegido e relatórios conciliáveis; checkout/webhook/conciliação testados com provedor simulado. | **Mercado Pago sandbox externo indisponível** sem conta/credenciais/webhook. Nenhuma cobrança ou devolução real executada. [Ajustes](AJUSTES_FINANCEIROS.md), [sandbox](PAGAMENTOS_SANDBOX.md). |
| Mobile/PWA | Layout emulado, cache público/fallback e fila privada por conta; offline/reconexão local e isolamento testados. | Instalação, teclado e reconexão publicada em telefone físico **não realizados**. [M01–M14](VALIDACAO_MOBILE.md). |
| UX/UI e landing | Identidade laranja/navy/Barlow; apresentações distintas para gestão, treino, nutrição e chat; landing com fotografia ilustrativa e captura real identificada como demonstração. | Revisão completa de telas/estados/teclado/contraste ainda aberta; capturas não certificam toda acessibilidade. [Critérios e provas](REVISAO_VISUAL_SISTEMA.md). |

## Próximas etapas obrigatórias

[Matrícula de 17/10](REVISAO_VISUAL_SISTEMA.md#17102026--matrícula-e-recuperação-da-consulta-de-planos): erro/vazio/recuperação verificados em instância local controlada; seleção e bloqueio confirmados por HTTPS. CI e implantação aprovadas. O experimento seguinte da IA permanece local: separar contexto e sessões melhorou a consistência estrutural, mas as amostras ainda revelaram variações com apoio não confirmado e falhas de geração. Nenhum novo protocolo de IA foi publicado nesta atualização.

[Rodada de 17/10](REVISAO_VISUAL_SISTEMA.md#17102026--nutrição-e-área-do-aluno): nutrição, avulso, histórico e presença revisados, **790/790** locais, CI/implantação/30 assets aprovados. Teste integrado financeiro repetido no MariaDB com provedor controlado, sem chamadas ao PSP ou estorno real. As cinco capturas locais documentam estados específicos; a revisão integral e os gates externos continuam abertos.

[Rodada publicada de 15/10](RODADA_UX_CHAT_PLANOS_2026_10_14.md): apresentação estruturada do rascunho, correção de falsa contradição de equipamento, leitura da nova resposta, recuperação sem descarte de rascunho nos planos e configuração estrita da origem do webhook. **741/741** locais; CI, assets e amostra real no browser publicado aprovados. A integração da landing também foi concluída, com seus gates próprios.

[Rodada publicada de 14/10](RODADA_2026_10_14.md): seleção estrita de citações originais e exclusão de provas obsoletas no rascunho da IA; prazo total da chamada externa de pagamentos; contrato de provedores; editor de ficha e relatório financeiro refinados. Suíte integral **664/664**, CI e publicação aprovadas; correção fictícia real conferida por HTTPS e nova conversa aprovada no browser. Checkout externo permanece desativado, confirmado por endpoint autenticado.

Rodada publicada em 12/10: contrato de contexto/esclarecimentos do chat corrigido, presenças protegidas contra callbacks/consultas antigas e composição de livro diário. Browser público confirmou restauração do aluno e conversa real: contexto incompleto gerou perguntas controladas, continuação fictícia completa gerou rascunho de segunda/quarta/sexta com 50 minutos disponíveis, fontes e contagens revisáveis. Gates locais e limites em [IA gratuita](IA_GRATUITA.md) e [revisão visual](REVISAO_VISUAL_SISTEMA.md). Documentação consolidada sem apagar as narrativas históricas.

1. Continuar a revisão integral de jornadas e estados da interface; validar as próximas mudanças antes de publicar.
   - Encerrar o gate visual da PR 2, que inclui a revisão de contagens/categorias do rascunho de dois dias e seleção de exercícios por catálogo; preservar as amostras históricas reprovadas.
2. Quando o proprietário estiver disponível, configurar conta de teste, token e webhook Mercado Pago. Executar cartão aprovado/rejeitado/pendente, webhook assinado/replay e Pix QR/pendente **sem renovar plano**. Sandbox não comprova liquidação Pix.
3. Executar o roteiro M01–M14 em aparelho físico e registrar plataforma, implantação e evidências.
4. Rotacionar a chave Groq exposta anteriormente pelo titular e validar a substituição privada.
5. Manter os gates das próximas mudanças e a documentação da entrega acadêmica. A integração dos repositórios não encerra a revisão contínua de todas as jornadas e estados.

## Publicação automática pelo GitHub

Os status da produção e do preview `39205bd` estão documentados acima por revisão. A tentativa de CLI em 13/10 retornou `Not authorized`; em 11/11, a CLI já está autenticada como proprietário e confirmou o preview, enquanto o conector Vercel continua pedindo reautenticação. A publicação foi feita pela integração Git existente, após atualizar main, sem ampliar permissões. A comparação com o arquivo Windows inicialmente divergiu por CRLF/LF; `git diff --no-index` confirmou equivalência textual e o gate passou a conferir os blobs comprometidos no Git, iguais ao checkout do deploy. Não se remove conteúdo para obter o hash esperado.

Falhas anteriores `git_info_fail` e recuperações sem mudança de permissões permanecem no [histórico documental](HISTORICO_ENTREGA.md#publicação-automática-pelo-github); sua causa não foi comprovada. Um deployment manual READY não substitui o status do Git automático.

## Documentação de referência

[Plano mestre](PLANO_MESTRE_DESENVOLVIMENTO.md) · [Auditoria por requisito](REVISAO_FINAL.md) · [Desenvolvimento e gates](DESENVOLVIMENTO.md) · [Banco/Vercel](BANCO_REMOTO_VERCEL.md) · [Revisão científica](AUDITORIA_CIENTIFICA_FINAL.md) · [Ferramentas pesquisadas](FERRAMENTAS_E_INTEGRACOES.md) · [Histórico preservado](HISTORICO_ENTREGA.md).

Relatos datados e screenshots registram a versão e o fluxo descritos; não comprovam automaticamente alterações posteriores. Credenciais ficam em arquivos privados ignorados, nunca nesta documentação.
