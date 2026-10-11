/** Referências visíveis e IA educativa: o texto gerado nunca altera cálculos ou dados. */
const EvidenciasView = {
  chatState: null,
  chatRevision: 0,
  identity() {
    if (typeof Auth === 'undefined' || !Auth.user) return null;
    return { id: Auth.user.id, generation: Auth.generation, epoch: Auth.sessionEpoch ?? null };
  },
  sameIdentity(a, b) {
    return !!a && !!b && a.id === b.id && a.generation === b.generation && a.epoch === b.epoch &&
      (typeof Auth.getSessionEpoch !== 'function' || a.epoch === Auth.getSessionEpoch());
  },
  clearChat() { this.chatState = null; ++this.chatRevision; },
  render(container = document.getElementById('page-content')) {
    if (!this.identity()) { this.renderPublic(container); return; }
    container.innerHTML = `<section class="science-page ia-page">
      <header class="science-heading ia-heading"><span class="science-kicker">Fundamentos / Assistente de treinamento</span><h2>Entenda o treino.<br>Construa sua rotina<span class="science-heading-dot">.</span></h2><p>Converse sobre hipertrofia, exercícios e progressão. Conte como são seus dias e explore uma divisão que faça sentido para sua rotina.</p></header>
      <section class="ia-workspace" aria-label="Conversa sobre treinamento">
        <header class="ia-workspace-header"><div><span class="ia-wordmark" aria-hidden="true">F<span>F</span></span><div><h3>FitFlow Assistente</h3><p>IA educativa · treinamento com contexto</p></div></div><button class="ia-reset" type="button" id="ia-reset">Nova conversa</button></header>
        <div class="ia-thread" id="ia-thread" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions"></div>
        <div class="ia-compose">
          <p class="ia-context-note" id="ia-context-note" hidden></p>
          <form id="ia-chat-form"><label class="ia-input-label" for="ia-message">Sua mensagem</label><textarea id="ia-message" rows="3" maxlength="2000" placeholder="Ex.: consigo treinar segunda, quarta e sexta, por 50 minutos. Como posso organizar meu treino?" aria-describedby="ia-input-help ia-consent-copy ia-chat-status"></textarea><div class="ia-compose-footer"><span id="ia-input-help">Enter envia · Shift + Enter muda de linha</span><button type="submit" class="btn btn-primary" id="ia-send">Enviar mensagem <span aria-hidden="true">↗</span></button></div>
          <label class="ia-consent"><input type="checkbox" id="ia-consent"><span id="ia-consent-copy">Concordo em enviar minhas mensagens e a rotina que informar à Groq para esta conversa. Evitarei nomes e informações de saúde.</span></label></form>
          <div class="ia-status-row"><p class="ia-status" id="ia-chat-status" role="status" aria-live="polite">Verificando disponibilidade do assistente…</p><button class="ia-check-service" type="button" id="ia-check-service" hidden>Verificar disponibilidade</button></div>
        </div>
        <footer class="ia-workspace-footnote">Para adultos saudáveis. Respostas podem conter erros; confira as fontes. Propostas de rotina são rascunhos para discutir com seu instrutor e não alteram sua ficha.</footer>
      </section>
      <details class="ia-principles"><summary>Consultar os princípios e as fontes do FitFlow <span>Conteúdo revisado, disponível sem IA</span></summary><div class="ia-principles-body"><h3>Divisão, exercícios e progressão</h3><p>Full body e divisões podem produzir resultados semelhantes quando o volume é igualado. Disponibilidade, adesão, execução e recuperação orientam a escolha. Registre carga e repetições realmente realizadas; o sistema não aplica um percentual de progressão a todos os alunos.</p><div id="split-sources"></div><h3>Volume previsto ≠ executado</h3><p>A ficha registra o planejado. O histórico registra o informado. Tonelagem é carga × repetições dos registros completos; não é uma medida direta de hipertrofia. Aquecimentos ficam separados das séries de trabalho, e finalizar uma sessão não comprova que todas as séries foram executadas.</p><div id="volume-sources"></div><div id="volume-ai"></div><p class="science-note">Aplicação a reabilitação, gestação e condições clínicas exige avaliação profissional e evidências específicas. O catálogo descreve movimentos, músculos e equipamentos; não valida cada prescrição.</p></div></details>
    </section>`;
    this.renderSources(container.querySelector('#split-sources'), ['split-2024', 'acsm-2026']);
    this.renderSources(container.querySelector('#volume-sources'), ['acsm-2026']);
    this.mountAI(container.querySelector('#volume-ai'), 'volume');
    this.mountChat(container);
  },

  renderPublic(container) {
    this.clearChat();
    container.innerHTML = `<section class="science-page">
      <header class="science-heading"><span class="science-kicker">Fundamentos do treinamento</span><h2>Princípios, dados e decisões<span class="science-heading-dot">.</span></h2><p>Entenda o que sustenta uma boa rotina: disponibilidade, execução e progressão. Consulte as referências e os limites de aplicação.</p></header>
      <section class="science-card"><h3>Converse com o assistente FitFlow</h3><p>Na sua conta, você pode discutir hipertrofia, tirar dúvidas sobre exercícios e construir um rascunho de divisão a partir da sua rotina. As mensagens são enviadas à Groq somente após seu consentimento.</p><a class="btn btn-primary" href="/">Acessar minha conta ↗</a><p class="science-note">O conteúdo revisado abaixo continua disponível sem login e sem enviar informações a um provedor de IA.</p></section>
      <section class="science-method"><h3>Como organizar a divisão</h3><p>Full body e divisões podem produzir resultados semelhantes quando o volume é igualado. Distribua o trabalho conforme disponibilidade, adesão e recuperação. A recomendação geral da ACSM para adultos saudáveis é treinar os grandes grupos musculares ao menos duas vezes na semana e progredir gradualmente. Máquinas e pesos livres podem ser escolhas adequadas conforme o contexto.</p><div id="split-sources"></div></section>
      <section class="science-method"><h3>Volume previsto ≠ executado</h3><p>A ficha registra séries e repetições planejadas. O histórico registra o que foi informado. Séries de trabalho são a contagem dos registros de trabalho, com aquecimentos separados. Tonelagem é carga × repetições dos registros completos; não é uma medida direta de hipertrofia. Essas são definições dos indicadores do FitFlow.</p><p>Registros ausentes não são preenchidos pelos números da ficha. Finalizar uma sessão não comprova que todas as séries foram executadas. Compare o mesmo exercício, equipamento, técnica e amplitude; esforço, descanso e repetições também influenciam a comparação.</p><div id="volume-sources"></div></section>
      <section class="science-method"><h3>Exercícios e progressão</h3><p>O catálogo descreve movimentos, músculos e equipamentos; não valida cada prescrição. Disponibilidade, execução, amplitude tolerada e histórico orientam a seleção. Registre carga e repetições realmente realizadas, considerando desempenho, técnica e recuperação antes de aumentar a carga.</p><p class="science-note">Conteúdo educativo para adultos saudáveis. Reabilitação, gestação e condições clínicas exigem avaliação profissional e evidências específicas.</p></section>
    </section>`;
    this.renderSources(container.querySelector('#split-sources'), ['split-2024', 'acsm-2026']);
    this.renderSources(container.querySelector('#volume-sources'), ['acsm-2026']);
  },

  ownsChat(context) {
    return context.state === this.chatState && context.revision === this.chatRevision &&
      context.container.isConnected && context.container.querySelector('#ia-chat-form') === context.form &&
      this.sameIdentity(context.state.identity, this.identity());
  },
  mountChat(container) {
    const identity = this.identity();
    if (!this.sameIdentity(this.chatState?.identity, identity)) this.chatState = { identity, messages: [], draft: '', consent: false, pending: false, failed: false, shortened: false };
    const state = this.chatState;
    // Leaving the page invalidates the callback. A retained unanswered turn can be retried.
    if (state.pending) { state.pending = false; state.failed = true; }
    const context = { state, container, revision: ++this.chatRevision, form: container.querySelector('#ia-chat-form') };
    context.input = container.querySelector('#ia-message'); context.consent = container.querySelector('#ia-consent');
    context.send = container.querySelector('#ia-send'); context.status = container.querySelector('#ia-chat-status');
    context.thread = container.querySelector('#ia-thread'); context.reset = container.querySelector('#ia-reset');
    context.check = container.querySelector('#ia-check-service');
    context.input.value = state.draft; context.consent.checked = state.consent;
    context.available = false;
    this.drawChat(context);
    const update = () => {
      if (!this.ownsChat(context)) return;
      state.draft = context.input.value; state.consent = context.consent.checked;
      this.chatControls(context);
    };
    context.input.addEventListener('input', update); context.consent.addEventListener('change', update);
    context.check.addEventListener('click', () => { if (this.ownsChat(context)) this.checkChatAvailability(context); });
    context.form.addEventListener('submit', event => { event.preventDefault(); this.sendChat(context); });
    context.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); this.sendChat(context); }
    });
    context.reset.addEventListener('click', () => {
      if (!this.ownsChat(context) || state.pending) return;
      state.messages = []; state.draft = ''; state.failed = false; state.shortened = false;
      context.input.value = ''; this.drawChat(context); this.chatControls(context);
      context.status.textContent = 'Nova conversa. As mensagens anteriores foram removidas deste navegador.';
      context.input.focus();
    });
    this.checkChatAvailability(context);
  },
  async checkChatAvailability(context) {
    if (context.checking) return;
    context.checking = true; context.check.disabled = true;
    this.chatControls(context);
    try {
      const response = await API.get('/ia/status', { timeoutMs: 15000 });
      if (!this.ownsChat(context)) return;
      context.available = response.data?.chatEnabled === true;
      context.status.textContent = context.available
        ? context.state.failed ? 'A última resposta não foi confirmada. Sua mensagem está preservada; tente enviar novamente.' : 'Conversa mantida somente nesta sessão do navegador. Nenhuma ficha ou histórico é enviado automaticamente.'
        : 'Assistente indisponível no momento. Sua mensagem fica preservada; as fontes abaixo continuam disponíveis.';
    } catch {
      if (!this.ownsChat(context)) return;
      // A failed status lookup need not prevent the authenticated chat endpoint from recovering.
      context.available = true;
      context.status.textContent = 'Não foi possível verificar o serviço. Você pode tentar enviar; sua mensagem será preservada em caso de falha.';
    }
    if (this.ownsChat(context)) { context.checking = false; context.check.disabled = false; context.check.hidden = context.available; this.chatControls(context); }
  },
  chatControls(context) {
    const state = context.state;
    context.send.disabled = state.pending || !state.consent || !state.draft.trim() || !context.available;
    context.send.textContent = state.pending ? 'Preparando resposta…' : state.failed && state.messages.at(-1)?.content === state.draft.trim() ? 'Tentar novamente ↗' : 'Enviar mensagem ↗';
    context.send.setAttribute('aria-busy', String(state.pending));
    context.reset.disabled = state.pending; context.input.readOnly = state.pending; context.consent.disabled = state.pending;
  },
  drawChat(context) {
    const thread = context.thread, nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 100;
    context.rendered ||= [];
    for (const entry of context.rendered) if (!context.state.messages.includes(entry.message)) entry.node.remove();
    context.rendered = context.rendered.filter(entry => context.state.messages.includes(entry.message));
    if (!context.state.messages.length) {
      thread.replaceChildren();
      const intro = document.createElement('div'); intro.className = 'ia-welcome';
      const kicker = document.createElement('span'); kicker.className = 'ia-welcome-kicker'; kicker.textContent = 'Um bom treino começa com boas perguntas';
      const heading = document.createElement('h3'); heading.textContent = 'O que vamos entender hoje?';
      const copy = document.createElement('p'); copy.textContent = 'Você pode tirar uma dúvida, comparar exercícios ou construir uma proposta de rotina. O assistente conversa com você para entender o contexto.';
      intro.appendChild(kicker); intro.appendChild(heading); intro.appendChild(copy);
      const suggestions = document.createElement('div'); suggestions.className = 'ia-suggestions';
      for (const [title, text] of [['Organizar minha semana', 'Quero montar uma divisão de treino. Quais informações da minha rotina você precisa?'], ['Entender hipertrofia', 'Preciso ir até a falha em todas as séries para ganhar massa muscular?'], ['Comparar exercícios', 'Como escolher entre máquinas e pesos livres para hipertrofia?']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `${title} ↗`;
        button.addEventListener('click', () => {
          if (!this.ownsChat(context) || context.state.pending) return;
          context.state.draft = text; context.input.value = text; this.chatControls(context); context.input.focus();
        }); suggestions.appendChild(button);
      }
      intro.appendChild(suggestions); thread.appendChild(intro); context.intro = intro;
    }
    else if (context.intro) { context.intro.remove(); context.intro = null; }
    for (const message of context.state.messages) {
      if (context.rendered.some(entry => entry.message === message)) continue;
      const article = document.createElement('article'); article.className = `ia-message ia-message-${message.role}`;
      const label = document.createElement('p'); label.className = 'ia-message-author'; label.textContent = message.role === 'user' ? 'Você' : 'FitFlow Assistente · IA';
      const body = document.createElement('div'); body.className = 'ia-message-body'; body.textContent = message.content;
      article.appendChild(label); article.appendChild(body);
      if (message.kind === 'routine_draft') {
        const note = document.createElement('p'); note.className = 'ia-draft-note'; note.textContent = 'Rascunho educativo — revise com seu instrutor. Sua ficha não foi alterada.'; article.appendChild(note);
      }
      if (message.sources?.length) {
        const sources = document.createElement('details'); sources.className = 'ia-message-sources';
        const summary = document.createElement('summary'); summary.textContent = 'Fontes associadas · confira o contexto'; sources.appendChild(summary);
        const links = document.createElement('div'); this.renderSources(links, message.sources); sources.appendChild(links); article.appendChild(sources);
      }
      thread.appendChild(article); context.rendered.push({ message, node: article });
    }
    const note = context.container.querySelector('#ia-context-note'); note.hidden = !context.state.shortened;
    note.textContent = 'Esta conversa ficou longa. Os pares de mensagens mais antigos foram retirados; se necessário, informe novamente detalhes da rotina.';
    // Never take keyboard focus from someone reading a reply or browsing sources.
    if (nearBottom) thread.scrollTop = thread.scrollHeight;
  },
  async sendChat(context) {
    if (!this.ownsChat(context) || context.state.pending || !context.available) return;
    const state = context.state, text = context.input.value.trim();
    state.draft = context.input.value; state.consent = context.consent.checked;
    if (!state.consent || !text) { context.status.textContent = 'Escreva uma mensagem e confirme o envio à Groq antes de continuar.'; return; }
    if (text.length > 2000) { context.status.textContent = 'Use até 2.000 caracteres por mensagem.'; return; }
    if (state.failed && state.messages.at(-1)?.role === 'user') state.messages.pop();
    state.messages.push({ role: 'user', content: text });
    while (state.messages.length > 16 || state.messages.reduce((n, m) => n + m.content.length, 0) > 12000) { state.messages.splice(0, 2); state.shortened = true; }
    state.pending = true; state.failed = false; this.drawChat(context); this.chatControls(context);
    context.status.textContent = 'Preparando uma resposta com o contexto desta conversa…';
    try {
      const response = await API.post('/ia/chat', { consent: true, messages: state.messages.map(m => ({ role: m.role, content: m.content })) }, { timeoutMs: 30000 });
      if (!this.ownsChat(context)) return;
      const data = response.data;
      if (typeof data?.message !== 'string' || !data.message.trim() || data.message.length > 6000 || data.generatedByAI !== true) throw new Error('A resposta não pôde ser confirmada. Tente novamente.');
      const sources = [...new Set((Array.isArray(data.sources) ? data.sources : []).map(s => s.id))].filter(id => Object.hasOwn(FitFlowScience.references, id));
      state.messages.push({ role: 'assistant', content: data.message, sources, kind: data.kind });
      state.draft = ''; context.input.value = ''; state.pending = false;
      this.drawChat(context); context.status.textContent = 'Resposta gerada por IA. Fontes associadas oferecem contexto; não verificam automaticamente cada frase.';
    } catch (error) {
      if (!this.ownsChat(context)) return;
      state.pending = false; state.failed = true;
      context.status.textContent = `${error.status === 429 ? 'Limite temporário do assistente. Aguarde antes de tentar novamente.' : error.message || 'Não foi possível obter a resposta.'} Sua mensagem foi preservada.`;
    } finally { if (this.ownsChat(context)) this.chatControls(context); }
  },

  renderSources(container, ids) {
    container.classList.add('science-sources');
    for (const id of ids) {
      if (!Object.hasOwn(FitFlowScience.references, id)) continue;
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
    const identity = this.identity();
    const current = () => container.isConnected && (typeof Auth === 'undefined' || this.sameIdentity(identity, this.identity()));
    const curated = topic === 'volume';
    container.className = 'science-ai';
    container.innerHTML = `<button type="button" class="btn btn-secondary" disabled>${curated ? 'Entender indicadores' : 'Explicar com IA'}</button><p class="science-note" role="status">${curated ? 'Definições dos indicadores do FitFlow.' : 'Verificando disponibilidade da IA…'}</p><div class="science-ai-text" aria-live="polite"></div>`;
    const button = container.querySelector('button');
    const status = container.querySelector('[role="status"]');
    if (curated) {
      if (!current()) return;
      button.disabled = false;
      status.textContent = 'Definições revisadas do FitFlow. Nenhuma informação é enviada a um provedor de IA.';
    } else try {
      const response = await API.get('/ia/status');
      if (!current()) return;
      if (!response.data.enabled) {
        status.textContent = 'IA ainda não configurada. As referências e os cálculos já podem ser usados.';
        return;
      }
      button.disabled = false;
      const provider = response.data.provider === 'groq' ? 'Groq'
        : response.data.provider === 'gemini' ? 'Gemini' : 'serviço de IA configurado';
      status.textContent = `Envia apenas o tema e resumos das referências ao ${provider}. Nenhum dado pessoal é enviado.`;
    } catch {
      if (current()) status.textContent = 'IA exige sessão e serviço disponível. Você pode consultar as referências sem IA.';
      return;
    }
    button.addEventListener('click', async () => {
      if (!current()) return;
      button.disabled = true;
      status.textContent = curated ? 'Consultando definições dos indicadores…' : 'Gerando explicação educativa…';
      const output = container.querySelector('.science-ai-text');
      output.replaceChildren();
      try {
        const response = await API.post('/ia/explicar', { topic });
        if (!current()) return;
        const p = document.createElement('p');
        p.textContent = response.data.explanation;
        output.appendChild(p);
        const sources = document.createElement('div');
        this.renderSources(sources, response.data.sources.map(source => source.id));
        output.appendChild(sources);
        status.textContent = response.data.generatedByAI === false
          ? 'Texto revisado do FitFlow, não gerado por IA. A referência oferece contexto científico geral; as definições dos indicadores pertencem ao sistema.'
          : 'Texto gerado por IA: pode conter erros. As fontes associadas não verificam automaticamente cada frase. Confira os artigos.';
      } catch (error) {
        if (current()) status.textContent = error.message;
      } finally { if (current()) button.disabled = false; }
    });
  },
};

// Chat messages stay in memory only, and cannot survive a session change.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => EvidenciasView.clearChat());
  window.addEventListener('storage', event => {
    if (typeof Auth !== 'undefined' && event.key === Auth.sessionEpochKey) EvidenciasView.clearChat();
  });
}
