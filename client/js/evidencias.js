/** Referências visíveis e IA educativa: o texto gerado nunca altera cálculos ou dados. */
const EvidenciasView = {
  render(container = document.getElementById('page-content')) {
    container.innerHTML = `<section class="science-page">
      <header class="science-heading"><span class="science-kicker">Treinamento baseado em evidências</span><h2>Princípios, dados e decisões</h2><p>Uma boa ficha considera objetivo, disponibilidade e execução. A fonte e os limites precisam acompanhar cada orientação.</p></header>
      <div class="science-layout">
        <section class="science-card"><h3>Como organizar a divisão</h3><p>Full body e divisões podem produzir resultados semelhantes com volume igualado. Distribua o trabalho conforme disponibilidade, adesão e recuperação, com revisão do instrutor.</p><p>A ACSM atualizou suas diretrizes em 2026. Para adultos saudáveis, recomenda treinar os grandes grupos musculares ao menos duas vezes na semana e progredir gradualmente. A escolha de máquinas ou pesos livres depende do contexto.</p><div id="split-sources"></div><div id="split-ai"></div></section>
        <section class="science-card"><h3>Volume previsto ≠ executado</h3><p>A ficha registra séries e repetições planejadas. O histórico registra o que foi informado. Tonelagem é carga × repetições de cada registro completo; não é uma medida direta de hipertrofia.</p><p>Não preenchemos séries ausentes com os números da ficha. Nas sessões, cada série pode registrar carga, repetições e RIR estimado pelo aluno. Aquecimentos ficam separados das séries de trabalho. Finalizar a sessão não comprova que todas as séries planejadas foram executadas. Compare o mesmo exercício, equipamento, técnica e amplitude; repetições, descanso e esforço também influenciam a comparação.</p><div id="volume-sources"></div><div id="volume-ai"></div></section>
      </div>
      <section class="science-card"><h3>Escolha de exercícios e progressão</h3><p>O catálogo descreve movimentos, músculos e equipamentos; ele não oferece validação científica de cada prescrição. Disponibilidade, execução, amplitude tolerada e histórico orientam a seleção pelo instrutor.</p><p>Registre carga e repetições efetivamente realizadas. Aumentos de carga precisam considerar desempenho, técnica e recuperação; o sistema não aplica um percentual automático a todos os alunos.</p><p class="science-note">Essas referências tratam principalmente de adultos saudáveis. Aplicação a reabilitação, gestação e condições clínicas exige avaliação profissional e evidências específicas.</p></section>
    </section>`;
    this.renderSources(container.querySelector('#split-sources'), ['split-2024', 'acsm-2026']);
    this.renderSources(container.querySelector('#volume-sources'), ['acsm-2026']);
    this.mountAI(container.querySelector('#split-ai'), 'divisoes');
    this.mountAI(container.querySelector('#volume-ai'), 'volume');
  },

  renderSources(container, ids) {
    container.classList.add('science-sources');
    for (const id of ids) {
      const reference = FitFlowScience.references[id];
      const link = document.createElement('a');
      link.href = reference.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = reference.title;
      container.appendChild(link);
    }
  },

  async mountAI(container, topic) {
    container.className = 'science-ai';
    container.innerHTML = '<button type="button" class="btn btn-secondary" disabled>Explicar com IA</button><p class="science-note" role="status">Verificando disponibilidade da IA…</p><div class="science-ai-text" aria-live="polite"></div>';
    const button = container.querySelector('button');
    const status = container.querySelector('[role="status"]');
    try {
      const response = await API.get('/ia/status');
      if (!container.isConnected) return;
      if (!response.data.enabled) {
        status.textContent = 'IA ainda não configurada. As referências e os cálculos já podem ser usados.';
        return;
      }
      button.disabled = false;
      status.textContent = 'Envia apenas o tema e resumos das referências ao Gemini. Nenhum dado pessoal é enviado.';
    } catch {
      if (container.isConnected) status.textContent = 'IA exige sessão e serviço disponível. Você pode consultar as referências sem IA.';
      return;
    }
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Gerando explicação educativa…';
      const output = container.querySelector('.science-ai-text');
      output.replaceChildren();
      try {
        const response = await API.post('/ia/explicar', { topic });
        if (!container.isConnected) return;
        const p = document.createElement('p');
        p.textContent = response.data.explanation;
        output.appendChild(p);
        const sources = document.createElement('div');
        this.renderSources(sources, response.data.sources.map(source => source.id));
        output.appendChild(sources);
        status.textContent = 'Texto gerado por IA: pode conter erros. As fontes associadas não verificam automaticamente cada frase. Confira os artigos.';
      } catch (error) {
        if (container.isConnected) status.textContent = error.message;
      } finally { button.disabled = false; }
    });
  },
};
