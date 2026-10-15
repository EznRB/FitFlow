/** Rótulos de apresentação; contagens e estimativas continuam vindo do servidor. */
const IARoutineLabels = {
  days: { monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo' },
  groups: { chest: 'Peito', back: 'Costas', shoulders: 'Ombros', quads: 'Quadríceps', hamstrings: 'Posteriores da coxa', glutes: 'Glúteos', calves: 'Panturrilhas', biceps: 'Bíceps', triceps: 'Tríceps', core: 'Abdômen' },
  equipment: { bodyweight: 'peso corporal', dumbbells: 'halteres', barbell: 'barra', machines: 'máquinas', cables: 'polias', bands: 'elásticos', kettlebell: 'kettlebell', bench: 'banco' },
  experience: { beginner: 'iniciante', intermediate: 'intermediário', advanced: 'avançado' },
  goals: { hypertrophy: 'hipertrofia', strength: 'força', general: 'condicionamento geral' },
};
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
        <footer class="ia-workspace-footnote">Para adultos saudáveis. O corpus cobre princípios de treinamento; dúvidas fora dessas fontes têm limites explícitos. A IA pode interpretar errado: confira o contexto. Propostas são rascunhos para revisar com seu instrutor e não alteram sua ficha.</footer>
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
  routinePresentation(program, message) {
    const labels = IARoutineLabels, integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
    const enums = (value, dictionary, max = Object.keys(dictionary).length) => Array.isArray(value) && value.length >= 1 && value.length <= max && new Set(value).size === value.length && value.every(item => Object.hasOwn(dictionary, item));
    const plain = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 100 && !/[<>]|https?:\/\/|javascript:|[\u0000-\u001f\u007f]/i.test(value);
    const context = program?.context;
    if (!context || !enums(context.availableDays, labels.days) || !integer(context.minutesPerSession, 15, 150)
      || !enums(context.equipment, labels.equipment) || !Object.hasOwn(labels.experience, context.experience)
      || !Object.hasOwn(labels.goals, context.goal) || context.adultHealthyConfirmed !== true
      || !Array.isArray(program.sessions) || !program.sessions.length || program.sessions.length > 6
      || !Array.isArray(program.weeklySummary) || !program.weeklySummary.length || program.weeklySummary.length > 10
      || !Array.isArray(program.sessionEstimates) || program.sessionEstimates.length !== program.sessions.length) return null;
    const days = new Set(), groups = new Set(), estimates = new Map();
    for (const estimate of program.sessionEstimates) {
      if (!estimate || !Object.hasOwn(labels.days, estimate.day) || estimates.has(estimate.day)
        || !integer(estimate.estimatedMinutes, 1, context.minutesPerSession)) return null;
      estimates.set(estimate.day, estimate.estimatedMinutes);
    }
    const lines = ['Rascunho interpretado da conversa — revise com seu instrutor. Nenhuma ficha foi salva ou aplicada.',
      `Interpretação: ${labels.experience[context.experience]}, objetivo de ${labels.goals[context.goal]}, ${context.minutesPerSession} min disponíveis por sessão. Equipamentos: ${context.equipment.map(item => labels.equipment[item]).join(', ')}. Se alguma interpretação estiver errada, corrija no chat.`];
    for (const session of program.sessions) {
      if (!session || !context.availableDays.includes(session.day) || days.has(session.day) || !estimates.has(session.day)
        || !Array.isArray(session.exercises) || !session.exercises.length || session.exercises.length > 6) return null;
      days.add(session.day);
      lines.push(`${labels.days[session.day]} — logística estimada: ${estimates.get(session.day)} min`);
      const names = new Set();
      for (const exercise of session.exercises) {
        if (!exercise || !plain(exercise.name) || names.has(exercise.name.trim().toLocaleLowerCase('pt-BR'))
          || !Object.hasOwn(labels.groups, exercise.primaryGroup) || !enums(exercise.equipment, labels.equipment)
          || exercise.equipment.some(item => !context.equipment.includes(item)) || !integer(exercise.sets, 1, 6)
          || !integer(exercise.repsMin, 1, 30) || !integer(exercise.repsMax, exercise.repsMin, 30)
          || !integer(exercise.rir, 0, 5) || !integer(exercise.restSeconds, 30, 300)) return null;
        names.add(exercise.name.trim().toLocaleLowerCase('pt-BR'));
        lines.push(`• ${exercise.name.trim()}: ${exercise.sets} séries × ${exercise.repsMin}–${exercise.repsMax} repetições; RIR ${exercise.rir}; descanso inicial ${exercise.restSeconds} s; grupo principal: ${labels.groups[exercise.primaryGroup]}.`);
      }
    }
    lines.push('Contagem direta planejada, por grupo principal indicado no rascunho (não treino executado):');
    for (const row of program.weeklySummary) {
      if (!row || !Object.hasOwn(labels.groups, row.group) || groups.has(row.group)
        || !integer(row.directPlannedSets, 1, 216) || !integer(row.sessionsPerWeek, 1, program.sessions.length)) return null;
      groups.add(row.group);
      lines.push(`• ${labels.groups[row.group]}: ${row.directPlannedSets} séries diretas em ${row.sessionsPerWeek} ${row.sessionsPerWeek === 1 ? 'sessão' : 'sessões'} por semana.`);
    }
    // Duas representações só coexistem se descrevem os mesmos dados. Divergência volta ao texto original.
    const prefix = lines.join('\n\n') + '\n\n';
    if (typeof message !== 'string' || !message.startsWith(prefix)) return null;
    const remaining = message.slice(prefix.length).split('\n\n');
    if (remaining.length < 4 || !remaining[0].startsWith('Participação indireta em outros músculos não foi quantificada.')
      || !remaining[1].startsWith('Tempo é uma hipótese logística:')
      || !remaining[2].startsWith('A razão individual de cada dose não foi documentada.')) return null;
    return { program, warnings: remaining.slice(0, 3), interpretation: remaining.slice(3).join('\n\n'), introduction: lines[0] };
  },
  renderRoutine(presentation) {
    const { program, warnings, interpretation, introduction } = presentation, labels = IARoutineLabels;
    const make = (tag, className, text, parent) => {
      const node = document.createElement(tag); node.className = className;
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    };
    const doc = make('section', 'ia-routine-document'); doc.setAttribute('aria-label', 'Rascunho educativo de treino');
    const header = make('header', 'ia-routine-heading', undefined, doc);
    make('span', 'ia-routine-kicker', 'Planejamento · para revisar', header);
    make('h3', '', 'Rascunho da sua semana', header);
    make('p', 'ia-routine-notice', introduction, header);
    const context = make('dl', 'ia-routine-context', undefined, doc);
    const datum = (parent, label, value) => { const entry = make('div', '', undefined, parent); make('dt', '', label, entry); make('dd', '', value, entry); };
    datum(context, 'Objetivo interpretado', labels.goals[program.context.goal]);
    datum(context, 'Experiência interpretada', labels.experience[program.context.experience]);
    datum(context, 'Tempo disponível', `${program.context.minutesPerSession} min / sessão`);
    datum(context, 'Dias disponíveis', program.context.availableDays.map(day => labels.days[day]).join(', '));
    datum(context, 'Equipamentos informados', program.context.equipment.map(item => labels.equipment[item]).join(', '));
    make('p', 'ia-routine-context-help', 'Se alguma interpretação estiver errada, corrija no chat.', doc);
    for (const session of program.sessions) {
      const section = make('section', 'ia-routine-session', undefined, doc), heading = make('div', 'ia-routine-session-heading', undefined, section);
      make('h4', '', labels.days[session.day], heading);
      make('span', '', `${program.sessionEstimates.find(item => item.day === session.day).estimatedMinutes} min · hipótese logística`, heading);
      const exercises = make('ol', 'ia-routine-exercises', undefined, section); exercises.setAttribute('role', 'list');
      for (const exercise of session.exercises) {
        const row = make('li', 'ia-routine-exercise', undefined, exercises), title = make('div', 'ia-routine-exercise-heading', undefined, row);
        make('h5', '', exercise.name.trim(), title); make('span', '', `Grupo principal interpretado: ${labels.groups[exercise.primaryGroup]}`, title);
        const dose = make('dl', 'ia-routine-dose', undefined, row);
        datum(dose, 'Proposta', `${exercise.sets} séries`); datum(dose, 'Faixa proposta', `${exercise.repsMin}–${exercise.repsMax} repetições`);
        datum(dose, 'Esforço estimado', `RIR ${exercise.rir}`); datum(dose, 'Pausa inicial', `${exercise.restSeconds} s`);
      }
    }
    const weekly = make('section', 'ia-routine-weekly', undefined, doc);
    make('h4', '', 'Contagem direta planejada', weekly);
    make('p', '', 'Por grupo principal indicado no rascunho · não treino executado.', weekly);
    const totals = make('dl', 'ia-routine-counts', undefined, weekly);
    for (const row of program.weeklySummary) datum(totals, labels.groups[row.group], `${row.directPlannedSets} séries diretas · ${row.sessionsPerWeek} ${row.sessionsPerWeek === 1 ? 'sessão' : 'sessões'} / semana`);
    const limits = make('div', 'ia-routine-limits', undefined, doc);
    for (const warning of warnings) make('p', '', warning, limits);
    const details = make('details', 'ia-routine-interpretation', undefined, doc);
    make('summary', '', 'Como interpretar este rascunho', details);
    make('div', 'ia-message-body ia-routine-guidance', interpretation, details);
    return doc;
  },
  drawChat(context, revealReply = false) {
    const thread = context.thread, nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 100;
    let addedMessage = null;
    let readerViewport = null;
    if (revealReply && nearBottom && document.visibilityState !== 'hidden' && thread.parentElement
      && Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
      const workspace = thread.parentElement.getBoundingClientRect();
      const stickyBottom = Math.max(0, document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0);
      readerViewport = { visible: workspace.bottom > stickyBottom && workspace.top < window.innerHeight,
        top: stickyBottom + 12, height: window.innerHeight };
    }
    context.rendered ||= [];
    for (const entry of context.rendered) if (!context.state.messages.includes(entry.message)) entry.node.remove();
    context.rendered = context.rendered.filter(entry => context.state.messages.includes(entry.message));
    if (!context.state.messages.length) {
      thread.replaceChildren();
      const intro = document.createElement('div'); intro.className = 'ia-welcome';
      const kicker = document.createElement('span'); kicker.className = 'ia-welcome-kicker'; kicker.textContent = 'Um bom treino começa com boas perguntas';
      const heading = document.createElement('h3'); heading.textContent = 'O que vamos entender hoje?';
      const copy = document.createElement('p'); copy.textContent = 'Comece com uma dúvida sobre hipertrofia ou com seus dias de treino. O assistente usa o contexto para organizar uma proposta e consultar as referências do FitFlow.';
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
      const body = document.createElement('div'); body.className = 'ia-message-body';
      const presentation = message.role === 'assistant' && message.kind === 'routine_draft' ? this.routinePresentation(message.program, message.content) : null;
      if (presentation) body.appendChild(this.renderRoutine(presentation)); else body.textContent = message.content;
      article.appendChild(label); article.appendChild(body);
      if (message.kind === 'routine_draft') {
        const note = document.createElement('p'); note.className = 'ia-draft-note'; note.textContent = 'Rascunho educativo — revise com seu instrutor. Sua ficha não foi alterada.'; article.appendChild(note);
      }
      if (message.scientificTextFromCorpus) {
        const note = document.createElement('p'); note.className = 'ia-draft-note'; note.textContent = 'A IA organiza a resposta. O conteúdo científico vem das referências do FitFlow; escolhas práticas exigem revisão com seu instrutor.'; article.appendChild(note);
      }
      if (message.sources?.length) {
        const sources = document.createElement('details'); sources.className = 'ia-message-sources';
        const summary = document.createElement('summary'); summary.textContent = 'Fontes associadas · confira o contexto'; sources.appendChild(summary);
        const links = document.createElement('div'); this.renderSources(links, message.sources); sources.appendChild(links); article.appendChild(sources);
      }
      thread.appendChild(article); context.rendered.push({ message, node: article });
      addedMessage = { message, node: article };
    }
    const note = context.container.querySelector('#ia-context-note'); note.hidden = !context.state.shortened;
    note.textContent = 'Esta conversa ficou longa. Os pares de mensagens mais antigos foram retirados; se necessário, informe novamente detalhes da rotina.';
    // Uma resposta longa começa pelo contexto e exercícios; não saltamos sobre eles para o rodapé.
    // Quem voltou ao histórico durante a geração mantém a posição e o foco de leitura.
    if (nearBottom && addedMessage) {
      if (addedMessage.message.role === 'assistant') {
        const delta = addedMessage.node.getBoundingClientRect().top - thread.getBoundingClientRect().top;
        thread.scrollTop = Math.max(0, thread.scrollTop + delta);
        // Acompanhar o fim da conversa não significa que seu painel esteja visível na página.
        // Só trazemos a leitura de volta se a pessoa ainda via o workspace antes da resposta.
        if (readerViewport?.visible) {
          const frame = thread.getBoundingClientRect();
          if (frame.top < readerViewport.top || frame.bottom > readerViewport.height) {
            thread.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          }
        }
      } else thread.scrollTop = thread.scrollHeight;
    }
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
      const presentation = data.kind === 'routine_draft' ? this.routinePresentation(data.program, data.message) : null;
      state.messages.push({ role: 'assistant', content: data.message, sources, kind: data.kind,
        ...(presentation ? { program: presentation.program } : {}),
        ...(data.scientificTextFromCorpus === true ? { scientificTextFromCorpus: true } : {}) });
      state.draft = ''; context.input.value = ''; state.pending = false;
      this.drawChat(context, true); context.status.textContent = data.scientificTextFromCorpus === true
        ? 'Resposta organizada pela IA com conteúdo das referências do FitFlow. Sua ficha não foi alterada.'
        : 'Resposta gerada por IA. Fontes associadas oferecem contexto; não verificam automaticamente cada frase.';
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
