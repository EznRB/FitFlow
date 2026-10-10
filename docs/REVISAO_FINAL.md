# Revisão de entrega — 10/10/2026

Revisão publicada `143c228`, READY pelo CLI com [CI aprovada](https://github.com/EznRB/FitFlow/actions/runs/38057480596) e alias canônico. Gestão/login de `3adf5c1` e conteúdo revisado de `f9ac83d` preservados. A meta completa permanece ativa; esta revisão não declara conclusão do projeto.

## Alterações

- Prazo de 15 segundos por requisição idempotente de treino e consulta de atualização, incluindo corpo. Timeout preserva registros e UUID; resposta tardia não confirma fila nem encerra sessão. Não comprova rollback no servidor, nem limita a atualização inteira a 15 segundos.
- Roteiro de telefone físico com 14 casos, todos inicialmente NÃO FEITO. Emulação e testes controlados permanecem evidências separadas.

- Login com composição editorial, fotografia ilustrativa otimizada em WEBP, contraste corrigido, ajuda acessível e controles por teclado.
- Lista, formulário e modal de alunos protegidos contra respostas de conta/tela anteriores.
- Edição parcial preservando os campos omitidos; cancelamento de presença atômico e bloqueio de presença de aluno inativo.
- IA educativa GPT-OSS 120B via Groq Free: plano confirmado no console, chave privada no backend e sem troca automática para provedor pago.
- Indicadores no código `f9ac83d`: glossário revisado fixo, sem inferência, com rótulo explícito e fontes separando produto/contexto científico. Prompt nutricional distingue repouso e basal.

## Gates confirmados

| Gate | Evidência |
|---|---|
| Suíte integral local | 316/316 em `143c228`; zero falhas e zero ignorados. |
| Revisão do prazo de treino | 12/12 focados, sem novo defeito concreto. Transporte/corpo parados, respostas tardias, cancelamento, limpeza, UUID e reenvio verificados em ambiente controlado. |
| Revisão independente | IA 19/19 em `f9ac83d`; gestão/login 29/29 e backend 48/48 em `3adf5c1`. Subconjuntos não somados à suíte. |
| Gate privado/dependências | 297 arquivos no gate atual, sem segredo local conhecido. Auditoria de dependências de produção aprovada na baseline `f9ac83d`; nenhuma dependência nova neste patch. Não equivale a auditoria completa de segurança. |
| Banco nativo | Datas/presenças no destino guardado, aprovado e fixture própria removida. |
| Login local | 1280 e 375 pixels, teclado, mostrar/ocultar senha, campos obrigatórios e ajuda. |
| Publicação | `143c228` READY pelo CLI e alias canônico; CI aprovada. api.js/sessoes.js/app.js iguais ao checkout; saúde 200 com banco ready e API no-store. |
| Navegador na revisão atual | Login real de aluno, Sincronizar sem novos registros e histórico de 20 kg × 8, RIR 2 e 160 kg·reps; captura 33. Não reproduz rede parada nem reconexão física. |
| Gestão HTTPS | Em `3adf5c1`: três logins, fluxos aprovados, somente fixtures UUID próprias removidas; quotas preservadas. |
| Navegador publicado | Login real do aluno em 375 pixels e sessão restaurada após recarga; capturas 28/29/31 em 1280 × 720, 375 × 812 e 768 × 1024, sem overflow horizontal. |
| IA real local | Explicação de divisões em aproximadamente 1,2 segundo; amostra conferida contra Ramos-Campo (2024)/ACSM (2026). |
| IA real HTTPS/divisões | Amostra gerada no aplicativo e conferida contra fontes primárias. Não generaliza aprovação para outros temas. |
| IA real HTTPS/nutrição | Geração em `9e1b5c5`, captura 30; amostra inspecionada com limitação terminológica basal/repouso. Sem prescrição/cálculo individual ou certificação factual integral. |
| Indicadores sem inferência | Glossário publicado em `f9ac83d`, navegador autenticado e captura 32 confirmados; texto revisado sem IA, definições do produto separadas do contexto científico. |

## Gates em aberto

O commit documental `7cf0d2b` passou na [CI](https://github.com/EznRB/FitFlow/actions/runs/38056127829). Seu Preview Git falhou antes do build (`git_info_fail`); Preview CLI ficou READY. No commit seguinte `89ba731`, a publicação automática pelo GitHub voltou a funcionar: `dpl_8xdgivRXVBJ6TvXC3J688xX69QNP` READY, SHA e `source: git` conferidos, [CI](https://github.com/EznRB/FitFlow/actions/runs/38056482679) e status Vercel aprovados, banco pronto. Nenhuma permissão ou proteção alterada. A causa da falha anterior permanece desconhecida; não há bloqueio atual da integração. [Histórico e próximos passos](STATUS_ENTREGA.md#publicação-automática-pelo-github).

1. Criar/configurar conta e credenciais Mercado Pago sandbox, webhook HTTPS; cartão `APRO`/rejeitado/`CONT`, Pix QR/pendente sem renovar plano. Não exigir liquidação Pix em sandbox; `approved` de Pix fica nos testes com doubles. [Roteiro de configuração e fontes oficiais](PAGAMENTOS_SANDBOX.md).
2. Telefone físico: instalação PWA, teclado, interrupção de rede e retorno; reconexão na publicação. [Matriz M01–M14](VALIDACAO_MOBILE.md), execução pendente.
3. Revisão e merge dos PRs draft do aplicativo e da landing; nenhum merge realizado.

Fontes, limites, revisões anteriores e capturas em [Estado da entrega](STATUS_ENTREGA.md). Configuração privada da IA em [IA gratuita](IA_GRATUITA.md). As credenciais antigas Aiven não foram recuperadas; a demonstração publicada usa banco e contas novos.

Atualização da integração Git: o Preview automático de `143c228` voltou a falhar antes do build com `git_info_fail`, em `dpl_4UHk4jkPh6zFAEp9CxSvDYNvHNNL`. A recuperação de `89ba731` foi temporária; causa específica ainda desconhecida. A CI GitHub e a publicação Production pelo CLI estão aprovadas. Nenhuma permissão ou proteção foi alterada.
