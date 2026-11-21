# Checkout interno do FitFlow

## Objetivo e decisão

O aluno já autenticado seleciona um plano e paga por cartão ou Pix dentro do FitFlow. O Mercado Pago processa o pagamento por Payment Brick (`payment`) e Payments API (`/v1/payments`). O usuário escolheu explicitamente essa migração após comparar com o redirecionamento do Checkout Pro.

Alternativas consideradas: manter Checkout Pro simplifica a integração, mas mantém a saída do sistema; criar todos os campos por Checkout API permite maior personalização, mas amplia implementação e manutenção. Payment Brick atende à experiência interna com captura segura dos dados de cartão pelo componente oficial.

## Experiência

O botão da mensalidade passa a abrir uma tela dedicada do checkout dentro da navegação do aplicativo. O aluno escolhe o plano e vê preço, duração, ambiente de teste e resumo antes de confirmar. O valor exibido e enviado ao provedor vem do servidor. A tela mantém o visual e a sessão do FitFlow e funciona em celular.

O Brick oferece somente os métodos efetivamente suportados: cartão e Pix. A interface apresenta inicialização, processamento, erro com ação de recuperação e resultado. Pix pendente apresenta QR Code/copia e cola; não renova o plano. O Status Screen oficial recebe o ID do pagamento, inclusive para autenticação adicional de cartão quando aplicável. A tela consulta o estado conciliado no FitFlow com limite de tentativas e oferece atualização manual. Sair ou trocar de sessão desmonta componentes e impede callbacks antigos de agir na nova sessão.

## Servidor e persistência

Separar preparação da intenção (plano, preço e duração confiáveis) do envio do pagamento. A rota de pagamento exige sessão de aluno, propriedade da intenção e um payload estritamente validado do Brick. O servidor controla referência externa, metadados, comprador de teste, notificação e valor; não aceita preço, vendedor ou confirmação financeira do navegador.

O adaptador cria pagamentos pela Payments API, mapeando explicitamente cartão e Pix. Usa chave de idempotência durável por tentativa lógica. Token de cartão é transitório: não persistir nem registrar em logs. Concorrência, repetição, resposta incerta e recusas exigem transições explícitas; uma resposta incerta nunca dispara outra cobrança automaticamente. Recusa terminal permite uma nova tentativa explicitamente confirmada com novo token e nova chave, sem reutilizar uma compra aprovada. Se necessário, acrescentar modelo/migração de tentativas para não sobrecarregar a intenção com idempotências diferentes.

Preservar conciliação por API/webhook, comparação de vendedor, valor, moeda e referência, e renovação transacional única. Intenções antigas do Checkout Pro continuam consultáveis e conciliáveis, mas a nova interface não cria preferências nem oferece dois fluxos de cobrança concorrentes. A preparação não pode gerar um checkout externo por efeito colateral.

Antes de criar uma cobrança interna, recuperar intenções/tentativas abertas do mesmo aluno para a compra, mesmo após recarregamento ou uma nova UUID do navegador. Uma preferência antiga pendente/incerta e ainda pagável bloqueia o novo pagamento até sua resolução ou expiração/inativação confirmada pelo provedor. Não inferir cancelamento por ausência em busca nem alterar apenas o banco local. Tentativas internas pendentes/incertas também são recuperadas; uma nova chave do frontend não pode contornar essa restrição. Aplicar a guarda atomicamente no servidor. A transição só será liberada após verificar o contrato oficial de expiração das preferências legadas; se a invalidação não puder ser confirmada, oferecer continuidade/consulta da compra existente com explicação ao aluno.

## Credenciais e segurança

Manter testes com conta brasileira e verificações de ambiente. Confirmar o par de Access Token/Public Key apropriado para Payment Brick antes de habilitá-lo. A Public Key será fornecida por endpoint autenticado de configuração sem cache; Access Token e segredo do webhook ficam no servidor. Não mudar para cobranças reais nesta migração. O login do aluno em produção fornece identidade do FitFlow; o teste usa os dados do comprador de teste configurado. Campos exigidos pelo provedor continuam sob responsabilidade do Brick.

Ajustar as políticas CSP do Express e da Vercel somente para origens oficiais necessárias ao SDK, iframes, conexões e imagens do Mercado Pago; manter as demais restrições. A chave pública ausente, SDK bloqueado ou componente que falha devem produzir orientação visível.

## Escopo e validação

Inclui tela dedicada, ligação do botão existente, configuração pública, adaptador Payments API, persistência de tentativas se necessária, lifecycle dos Bricks, webhook e documentação. Não inclui assinaturas recorrentes, armazenamento próprio de cartões ou migração para cobranças reais.

Verificar contratos de cartão/Pix, preço confiável, ownership, concorrência, idempotência, timeouts, recusa, pendência, duplicação de webhook e renovação única. Verificar também limpeza de componentes, troca de sessão, navegação, estados e CSP. Executar suíte existente e validador oficial `validate-bricks-integration.mjs . payment`. Teste visual responsivo e teste externo com credenciais/cartão de teste são gates distintos; não alegar homologação por testes simulados. Publicar somente as alterações do checkout, preservando modificações de outros trabalhos.

## Decisões de implementação delegadas

Nomes precisos de rotas, estratégia de migração de tentativas, configuração das parcelas (padrão de uma parcela), organização de arquivos e ferramenta de teste seguem convenções do repositório e os contratos oficiais atuais. A forma exata do par de credenciais e das origens CSP será confirmada durante a implementação, sem reduzir proteções para obter aprovação.
