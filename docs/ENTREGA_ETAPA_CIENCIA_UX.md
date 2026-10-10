# Entrega da primeira etapa — 07/10/2026

Registro histórico da primeira etapa. As pendências e limites abaixo descrevem 07/10/2026; consulte [Estado atual da entrega](STATUS_ENTREGA.md) para o desenvolvimento posterior, banco local e verificações de 08/10.

## Planos e implementação

- [Especificação](superpowers/specs/2026-10-07-fitflow-evolucao.md).
- [Landing page](superpowers/plans/2026-10-07-landing.md).
- [UX/UI e arquitetura de todo o sistema](superpowers/plans/2026-10-07-sistema-ux-arquitetura.md).
- [Ciência, IA, mobile e exercícios](superpowers/plans/2026-10-07-ciencia-ia-mobile.md).
- [Ferramentas, MCPs e integração no desenvolvimento](FERRAMENTAS_E_INTEGRACOES.md).

Implementado nesta etapa: Nutrição e Fundamentos nos menus; equações e macros determinísticos; referências científicas visíveis; volume conhecido dos registros do histórico; endpoint de IA para explicação de temas curados; tratamento de HTTP 401/403/502; fechamento CSS e responsividade do construtor; calculadora pública educativa. Landing: CTA na capa, linguagem/metadados, status honesto, lazy loading, foco/movimento reduzido, identificação de demonstração e retirada do SDK/chave Gemini do frontend.

## Verificações

- `server/npm test`: 15 testes passaram, com RED/GREEN observado nos novos métodos e regressões.
- Node: sintaxe dos arquivos JS e import de app Express passaram.
- PostCSS: todas as folhas de estilo próprias passaram; o bloco aberto em pages.css foi corrigido.
- Landing: TypeScript e build passaram. JS inicial de aproximadamente 1.075 KB foi separado em chunks; entrada pública de aproximadamente 388 KB (122 KB gzip). O chunk de gráficos é carregado ao abrir demonstração.
- Browser: cálculo real 80kg/180cm/30anos/coefficient masculino/Mifflin/fator1,5 = repouso1780, cenário2670kcal; macros P128/C372,625/G74,166…g; reset e invalidação após edição conferidos.
- Viewport de 375px: largura do documento menor que viewport nos módulos de nutrição e capa da landing; nova área em uma coluna. Verificação desktop também realizada. Captura pode ter escala de apresentação do navegador; não equivale a teste em aparelho físico.
- IA: contrato, fonte inválida, tipos de input, timeout, falha upstream, 401/403 e limite429 testados sem chamada cobrada ao provedor. Não houve geração real com chave configurada.
- Revisão independente encontrou coerção de tipo no tema, resultado antigo com validação nativa e coerção de registro malformado. Os três foram corrigidos e verificados.
- wger pública: 2=en,7=pt; `exerciseinfo` retornou918 entradas no momento da consulta. MCP oficial2.7.0 instalado em cache isolado do uv e CLI conferida, sem conexão de conta.

## O que permanece pendente

O diagnóstico do login segue válido: host Aiven sem resolução e Prisma sem conexão. Não houve migração, seed ou alteração de ambiente/produção. Integração completa admin/aluno/histórico real requer banco operacional.

Não foram implementados: motor completo de prescrição científica, escolha automática validada de exercícios, modelos de sessões/séries/versionamento, nutrição sincronizada entre dispositivos, PWA/offline com escrita, gateway Pix/cartão real, reorganização integral da landing ou todas as correções de segurança anteriores. Essas etapas estão especificadas nos planos. A adição de referências educativas não torna automaticamente as fichas antigas cientificamente validadas.

Antes de publicar: recuperar banco e conciliar migrations; fechar os seis achados de segurança; validar fluxos com contas reais de teste; configurar/quota de IA se utilizada; confirmar interface em celular físico. O limitador de IA atual é em memória por instância, sem teto financeiro distribuído.

## Estado do trabalho

Branch aplicativo `codex/science-ux-foundation`; landing `codex/landing-improvements`. Alterações anteriores do usuário preservadas. Nenhum push, merge ou deploy foi feito.
