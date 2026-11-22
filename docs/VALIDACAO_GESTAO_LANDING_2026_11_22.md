# Validação técnica de gestão e landing — 22/11/2026

Registro de desenvolvimento e testes. O relatório acadêmico será produzido pelo usuário em outro chat; este documento não o substitui.

## Presenças

Na conta fictícia de apresentação, a entrada foi registrada pelo aluno e apareceu uma vez no histórico. A segunda tentativa no mesmo dia foi recusada, sem duplicação. O gestor cancelou somente essa presença sintética: motivo obrigatório, registro original preservado e resumo do dia voltou a zero. Nenhuma presença física foi alegada.

O motivo longo ampliava a tabela no desktop. A PR 14 corrige a quebra de texto, além do singular da contagem de exercícios. CI 45048561677 aprovada; merge `bbc005a`. No preview, a tabela mediu 899 px numa região de 935 px, com motivo legível. [Captura após correção](evidence/20261122-presenca-cancelamento-ajustado.jpg).

## Vigência e registros financeiros

A consulta de inadimplência omitira matrículas ativas vencidas sem pagamento lançado. A correção usa o calendário de São Paulo e carência estritamente superior a cinco dias. Acrescenta motivos sem mudar situação cadastral, inventar débito ou criar pagamento. Matrícula inativa, isoladamente, não representa dívida.

Backend: 17 testes aprovados; interface: 14; regressões financeiras de concorrência: 11. Uma primeira CI falhou porque um teste exigia inicial minúscula; a comparação foi ajustada para ignorar caixa, preservando as verificações de conteúdo e troca de contexto. Logs completos e códigos de saída estão em `server/tmp/inadimplencia-*.log`, `membership-ci-red-20261122.log` e `membership-view-race-green-20261122.log`. Revisão independente estática: nenhum achado acionável.

Preview `dpl_2xAKeJSQdYzPJ8VjbmZw1mXs9TN8`: três contas demonstrativas listadas, duas ativas com vigência vencida e uma bloqueada com ambos os motivos. Valor registrado vencido: R$ 0,00. A consulta de pagamentos manteve o único recebimento sandbox de R$ 129,90 e zero ajustes. Intervalo invertido removeu o resultado anterior e desativou impressão, com orientação explícita. Nenhuma gravação financeira foi realizada nesta rodada. [Captura da consulta](evidence/20261122-gestao-vigencias-vencidas.jpg).

PR 15 integrada em `3284bd4`, CI 45049333640 aprovada. Produção `dpl_Lyp3EiqY4epSkwrwKD1JqLvmAnfj` READY; saúde/banco e três assets públicos iguais aos blobs Git. A consulta pública confirmou três alunos e R$ 0,00. A contagem singular “1 exercício” também foi conferida no painel publicado da conta de apresentação.

## Leitura das tabelas e recuperação nutricional

PR 16 integrada em `d62d6e5`, CI 45079050871 aprovada. O `nowrap` global forçava uma tabela de 1.388 px numa região de 895 px. A regra restrita permite quebra de textos/cabeçalhos: no preview final, tabela de 895 px em região de 895 px. A primeira tentativa móvel comprimia excessivamente as palavras e foi rejeitada; a revisão final preserva 760 px de largura interna com rolagem no contêiner de 311 px. Documento de 369 px, sem transbordamento; região recebe foco visível e ArrowRight moveu a rolagem em 40 px. [Desktop](evidence/20261122-gestao-tabela-desktop-ajustada.jpg) · [Mobile final](evidence/20261122-gestao-tabela-mobile-final.jpg). A regra de impressão remove a largura mínima e fixa as colunas; a prévia de impressão não foi inspecionada neste navegador.

Na conta fictícia de apresentação, a consulta inicial confirmou ausência de simulação salva. Um cenário sintético de 80 kg, 180 cm, 30 anos e coeficiente masculino foi calculado e salvo pela interface. Depois da recarga e recuperação explícita, os parâmetros reapareceram, mas a confirmação de escopo estava desmarcada, o resultado exigia novo cálculo e Salvar estava desabilitado. O cenário ficou salvo para demonstração; nenhum dado corporal real foi usado. [Recuperação](evidence/20261122-nutricao-recuperada-conta.jpg).

## Landing publicada

A publicação final das tabelas foi conferida em `dpl_Akh4Z7iyfW9A8Wt13uD9iQ4h6JFY`: READY, banco pronto, CSS/painel/relatórios públicos iguais aos blobs de `d62d6e5`. Logs e hashes em `server/tmp/table-final-production-*` e `final-ui-production-proof-20261122.json`.

PR 3 integrada em `e09966d0155ba5fd96320ab3315f39db1bd098ee`; CI 45048252622 aprovada. Publicação `dpl_7L1ixhMT1apW9hKB3bBdggm2y5mH` READY. JavaScript e CSS públicos coincidiram byte a byte com o build local verificado; `/sobre` e `/contato` responderam HTTP 200.

- Login voltou a aparecer em Sobre/Contato a 375 px e permaneceu acessível por teclado. Sobre a 768 px sem transbordamento do documento.
- Formulário vazio apresentou três erros e foco no nome; e-mail inválido preservou o rascunho e recebeu foco. Nenhuma mensagem foi enviada.
- Hero e âncoras da página inicial conferidos; texto de pagamentos descreve sandbox, sem prometer liquidação Pix ou cobrança real.
- Vite atualizado de 6.4.4 para 6.4.5, correção oficial de GHSA-8g5g-mxqh-grgj. Oito testes, build/typecheck e audit sem avisos no lockfile revisado. Reprodução isolada usou somente conteúdo fictício; não encerra a auditoria global do projeto.

[Contato móvel](evidence/20261122-contato-mobile-login.jpg) · [Sobre móvel](evidence/20261122-sobre-mobile-login.jpg) · [Sobre tablet](evidence/20261122-sobre-tablet-login.jpg) · [Hero](evidence/20261122-landing-hero-desktop.jpg).

## Limites

Inspeção no navegador integrado e emulação não substituem telefone físico M01–M14. A confirmação da revogação da chave Groq pelo titular e os gates específicos da auditoria continuam abertos. Esta rodada não repetiu cobranças, não validou liquidação Pix e não comprova revisão exaustiva de todos os estados do sistema.
