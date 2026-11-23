# Recuperação do painel e catálogo — 23/11/2026

PR [20](https://github.com/EznRB/FitFlow/pull/20) integrada em `e0a0fa658d6e883144fa32dd1839f15722862699`. Revisão funcional `c2f70bee5518b40aed202ddfa81e60327f89a5b6`.

## Problemas corrigidos

- Catálogo, grupos e detalhe tinham leituras sem prazo. Agora encerram após 15 segundos e permitem nova consulta manual. Filtros e identidade da sessão são preservados; operações de escrita não recebem repetição automática.
- Respostas inválidas, IDs duplicados e registros incompletos não se tornam listas vazias ou parciais. A edição exige descrição/imagem presentes, aceitando `null` legítimo, para evitar apagar conteúdo ausente na resposta.
- O painel não converte métricas ausentes em zero. Valida o contrato consumido antes de renderizar e apresenta erro recuperável quando ele estiver incompleto.
- Contagens diárias têm tabela com cabeçalhos e legenda, disponível por controle expansível. Se Chart.js faltar ou falhar, a tabela abre e explica a indisponibilidade. O canvas é ilustrativo para tecnologias assistivas; os valores estão no HTML.

## Evidência

- Catálogo: erro reproduzido antes da correção; 22 testes focados aprovados, zero falhas, Node 24. Inclui API real com transporte interrompido, relógio controlado, abort após 15 segundos, resposta tardia, nova consulta manual e proteção contra edição incompleta.
- Painel: cinco testes novos falharam antes da correção; 11 testes focados aprovados após ajuste, incluindo os de respostas obsoletas e sessão.
- CI [45204568965](https://github.com/EznRB/FitFlow/actions/runs/45204568965): **975 aprovados, zero falhas, um ignorado**, 976 no total. O caso MariaDB real depende de banco ausente nessa CI. Schema e geração do cliente PostgreSQL aprovados. Subsuítes focadas estão incluídas nesse total.
- Revisão estática independente encontrou a lacuna dos campos de edição; correção e casos adicionais foram revistos.
- Prévia `fit-flow-ce8fo708v-eznrbs-projects.vercel.app`: login gestor, dados reais do painel, tabela de sete dias, catálogo de 798 registros, filtro Costas com 102 e edição Abdominal com descrição/imagem preservadas, sem salvar. Em 375 px, após estabilização do redimensionamento, largura do documento e corpo 369 px; gráfico com 300 px e intervalo de 16 px antes do controle textual. Composição mobile inspecionada na imagem retornada pelo navegador. Uma captura posterior incompleta foi rejeitada e não serve como evidência.
- Produção `fit-flow-6h6dp3jpj-eznrbs-projects.vercel.app` READY, metadados `main/e0a0fa6`; no endereço canônico, os dois JavaScripts alterados são iguais aos blobs Git. Saúde `success`, banco `ready`.
- Logs completos locais: `server/tmp/catalog-record-recovery-{red,green}-20261123.log`, `server/tmp/dashboard-data-recovery-{red,green}-20261123.log`, `server/tmp/dashboard-catalog-ci-45204568965.log` e `server/tmp/dashboard-catalog-production-proof-20261123.json`. São artefatos temporários privados, não arquivos distribuídos no Git.

## Limites e próximos gates

Falhas e transporte interrompido foram exercitados nos testes; não se induziu indisponibilidade no servidor publicado. A imagem mobile e o DOM não certificam acessibilidade integral nem telefone físico. Permanecem a matriz M01–M14, confirmação da rotação Groq, gate específico de isolamento da auditoria e estados restantes da revisão geral. Não houve alteração de banco, cobranças, históricos ou trabalho acadêmico. Esta rodada não encerra a meta e não é o relatório acadêmico.
