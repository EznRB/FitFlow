/** Área educativa de nutrição: cálculos locais, sem IA e sem persistência corporal automática. */
const NutricaoView = {
  container: null,
  lastInputs: null,
  renderGeneration: 0,
  renderIdentity: null,
  editRevision: 0,
  recoveredVersion: null,
  accountBusyGeneration: null,
  accountOperations: new Map(),
  accountInspectionUserId: null,
  render(container = document.getElementById('page-content')) {
    this.container = container; this.lastInputs = null; this.recoveredVersion = null; this.editRevision = 0; this.accountBusyGeneration = null; this.accountInspectionUserId = null;
    ++this.renderGeneration;
    const accountUser = typeof Auth !== 'undefined' ? Auth.user : null;
    container.innerHTML = `
      <section class="science-page">
        <header class="science-heading"><span class="science-kicker">Seu acompanhamento / Nutrição</span><h2>Nutrição e macros<span class="science-heading-dot">.</span></h2>
          <p>Entenda sua estimativa de energia e como ela se distribui entre os macronutrientes.</p><span class="science-meta">Equações publicadas · Cálculo local · Sem envio de medidas à IA</span></header>
        <div class="science-layout">
          <form id="nutrition-form" class="science-card">
            <div class="science-section-header"><span class="science-section-index">01</span><div><h3>Comece pelos seus dados</h3><p>Usamos as unidades abaixo para calcular o gasto em repouso.</p></div></div>
            <div class="science-fields">
              <label class="science-wide">Equação<select name="formula"><option value="mifflin">Mifflin–St Jeor (1990)</option><option value="harris">Harris–Benedict revisada (1984)</option></select></label>
              <label class="science-wide">Coeficiente por sexo da equação<select name="sex" required><option value="">Selecione o coeficiente do estudo</option><option value="male">Masculino</option><option value="female">Feminino</option></select></label>
              <label>Peso (kg)<input name="weightKg" type="number" step="0.1" min="30" max="300" placeholder="80" required></label>
              <label>Altura (cm)<input name="heightCm" type="number" step="0.1" min="120" max="230" placeholder="180" required></label>
              <label>Idade (anos)<input name="age" type="number" min="19" max="78" step="1" placeholder="30" required></label>
            </div>
            <!-- Ajustes ficam próximos do cálculo e acessíveis sem dominar a primeira leitura. -->
            <details class="science-advanced"><summary>Ajustes de atividade e macronutrientes <span>Opcional</span></summary><p class="science-note">Valores iniciais: atividade 1,5 · ajuste 0% · proteína 1,6 g/kg · gordura 25%. São hipóteses editáveis, não recomendações individuais.</p><div class="science-fields">
              <label>Fator de atividade<input name="activityFactor" type="number" step="0.05" min="1.2" max="2.4" value="1.5" required></label>
              <label>Ajuste de energia (%)<input name="adjustmentPercent" type="number" step="1" min="-20" max="15" value="0" required></label>
              <label>Proteína (g/kg/dia)<input name="proteinPerKg" type="number" step="0.1" min="1.2" max="2.2" value="1.6" required></label>
              <label>Gordura (% da energia)<input name="fatPercent" type="number" step="1" min="20" max="35" value="25" required></label>
            </div><p class="science-note">Não inferimos atividade pelos dias de treino. Os coeficientes refletem as populações dos estudos; situações hormonais específicas requerem avaliação individual.</p></details>
            <label class="science-check"><input name="eligible" type="checkbox" required><span>Estou usando uma simulação para adulto saudável de 19–78 anos, fora de gestação/lactação ou condições clínicas e transtornos alimentares que exijam avaliação individual.</span></label>
            <p class="science-error" id="nutrition-error" role="alert"></p>
            <div class="science-actions"><button class="btn btn-primary" type="submit">Calcular estimativa</button><button class="btn btn-secondary" type="reset">Limpar dados</button></div>
          </form>
          <section class="science-card science-result" aria-live="polite" aria-atomic="true" id="nutrition-result"><span class="science-kicker">Seu resultado</span><h3>Uma estimativa.<br>Um ponto de partida.</h3><p>Preencha os dados ao lado para ver energia, macronutrientes e cada etapa do cálculo.</p><div class="science-empty-metrics"><span>Energia diária</span><strong>Aguardando cálculo</strong><span>Proteína · Carboidrato · Gordura</span></div><p class="science-note">Nenhum dado corporal é salvo automaticamente. Uma estimativa não substitui avaliação individual.</p></section>
        </div>
        ${accountUser ? `<section class="science-card" id="nutrition-account"><div class="science-section-header"><span class="science-section-index">02</span><div><h3>Sua simulação, na sua conta</h3><p>Opcional: recupere seus parâmetros em outro dispositivo.</p></div></div>
          <p class="science-note">Ao clicar em salvar, serão guardados peso, altura, idade, coeficiente por sexo, equação, fator de atividade, ajuste de energia, proteína em g/kg e percentual de gordura. Esses dados ficam na sua conta e não são enviados à IA. Salvar uma nova simulação substitui a anterior.</p>
          <p class="science-note" id="nutrition-save-summary">Calcule uma estimativa válida antes de salvar.</p>
          <div class="science-actions"><button class="btn btn-primary" type="button" id="nutrition-save" disabled>Salvar simulação na minha conta</button><button class="btn btn-secondary" type="button" id="nutrition-restore">Recuperar simulação salva</button><button class="btn btn-secondary" type="button" id="nutrition-delete">Excluir simulação salva</button></div>
          <p class="science-note" id="nutrition-account-status" role="status" aria-live="polite"></p>
          <div class="nutrition-review science-advanced" id="nutrition-review" hidden><h4>Confira antes de continuar</h4><p class="science-note" id="nutrition-review-summary"></p><label class="science-check"><input id="nutrition-review-ack" type="checkbox"><span>Conferi os dados salvos e quero continuar, ciente de que o envio anterior ainda pode terminar e alterar a simulação.</span></label><button class="btn btn-secondary" type="button" id="nutrition-review-confirm" disabled>Continuar após conferir</button></div>
        </section>` : ''}
        <section class="science-method"><div class="science-section-header"><span class="science-section-index">${accountUser ? '03' : '02'}</span><div><h3>Entenda o método</h3><p>O que essas contas mostram — e quais são seus limites.</p></div></div>
          <p>Gasto em repouso × fator de atividade aproxima o gasto total. A FAO descreve PAL em relação ao gasto basal; o uso com uma equação de repouso é uma aproximação. Acompanhe tendências e calibre com um profissional.</p>
          <p>Proteína: 1,6 g/kg/dia é uma referência de meta-análise em adultos saudáveis que fazem treino resistido, com incerteza e variação individual. Não é uma dose ideal universal. Gordura: a faixa populacional adulta de referência é 20–35% da energia. Carboidrato ocupa a energia restante.</p>
          <div id="nutrition-sources" class="science-sources"></div>
          <div id="nutrition-ai"></div>
        </section>
      </section>`;
    const form = container.querySelector('#nutrition-form');
    const renderOwner = accountUser ? this.captureOperation(accountUser.id) : null;
    this.renderIdentity = renderOwner;
    // Validação nativa pode impedir submit: qualquer alteração invalida o resultado anterior.
    const invalidate = () => {
      this.lastInputs = null; this.editRevision++;
      this.updateAccountPreview();
      container.querySelector('#nutrition-error').textContent = '';
      container.querySelector('#nutrition-result').innerHTML = '<h3>Parâmetros alterados</h3><p>Calcule novamente para ver uma estimativa correspondente aos dados atuais.</p>';
    };
    form.addEventListener('input', event => { if (event.target?.validity?.valid) event.target.removeAttribute('aria-invalid'); invalidate(); });
    form.addEventListener('change', invalidate);
    form.addEventListener('invalid', event => {
      // Campos de ajustes inválidos precisam ficar visíveis para correção e foco nativo.
      const advanced = event.target?.closest?.('.science-advanced'); if (advanced) advanced.open = true;
      event.target?.setAttribute?.('aria-invalid', 'true');
      invalidate();
      container.querySelector('#nutrition-error').textContent = 'Confira os campos obrigatórios e os limites indicados antes de calcular.';
    }, true);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      data.eligible = form.elements.eligible.checked;
      const error = container.querySelector('#nutrition-error');
      try {
        const result = FitFlowScience.calculateNutrition(data);
        this.lastInputs = structuredClone(data);
        error.textContent = '';
        this.renderResult(container.querySelector('#nutrition-result'), result, data);
        this.updateAccountPreview();
        if (this.recoveredVersion && this.recoveredVersion !== result.version) this.accountStatus(`Parâmetros recuperados recalculados pelo método atual v${result.version}. A versão salva era ${this.recoveredVersion}; o cálculo continua sendo uma estimativa.`);
      } catch (e) {
        error.textContent = e.message;
        // Evita que o usuário confunda resultado anterior com o input inválido atual.
        container.querySelector('#nutrition-result').innerHTML = '<h3>Revise os parâmetros</h3><p>O cálculo não foi concluído. Confira a mensagem no formulário.</p>';
      }
    });
    form.addEventListener('reset', () => {
      this.lastInputs = null; this.recoveredVersion = null; this.editRevision++; this.updateAccountPreview();
      container.querySelector('#nutrition-error').textContent = '';
      container.querySelector('#nutrition-result').innerHTML = `<h3>Dados desta tela limpos</h3><p>Preencha novamente para calcular.${accountUser ? ' Uma simulação salva na conta permanece lá até você clicar em Excluir simulação salva.' : ' Nenhuma informação corporal foi persistida.'}</p>`;
    });
    if (accountUser) {
      container.querySelector('#nutrition-save').onclick = () => { if (this.isCurrent(renderOwner)) return this.saveScenario(accountUser.id); };
      container.querySelector('#nutrition-restore').onclick = () => { if (this.isCurrent(renderOwner)) return this.restoreScenario(accountUser.id); };
      container.querySelector('#nutrition-delete').onclick = () => { if (this.isCurrent(renderOwner)) return this.deleteScenario(accountUser.id); };
      container.querySelector('#nutrition-review-ack').onchange = event => { if (this.isCurrent(renderOwner)) container.querySelector('#nutrition-review-confirm').disabled = !event.target.checked || this.accountBusyGeneration === this.renderGeneration; };
      container.querySelector('#nutrition-review-confirm').onclick = () => { if (this.isCurrent(renderOwner)) return this.reviewUncertainOperation(accountUser.id); };
      this.updateAccountPreview();
      const operation = this.accountOperations.get(String(accountUser.id));
      if (operation?.state === 'pending') { this.accountInspectionUserId = accountUser.id; this.accountStatus('Há uma solicitação em andamento nesta aba. Aguarde sua resposta antes de iniciar outra operação.'); }
      if (operation?.state === 'uncertain') this.accountStatus('A solicitação anterior não foi confirmada. Consulte a situação salva e revise o aviso antes de iniciar outra operação.');
    }
    EvidenciasView.renderSources(container.querySelector('#nutrition-sources'), ['mifflin-1990', 'harris-1984', 'protein-2018', 'dri']);
    EvidenciasView.mountAI(container.querySelector('#nutrition-ai'), 'nutricao');
  },

  captureOperation(userId) {
    return { generation: this.renderGeneration, userId, authGeneration: Auth.generation, sessionEpoch: Auth.sessionEpoch ?? null, epoch: Auth.getSessionEpoch?.() ?? Auth.sessionEpoch ?? null,
      container: this.container, form: this.container?.querySelector('#nutrition-form'), revision: this.editRevision,
      nodes: Object.fromEntries(['save','restore','delete','save-summary','account-status','result','review'].map(key => [key, this.container?.querySelector(`#nutrition-${key}`)])) };
  },
  isSameSession(operation) {
    return typeof Auth !== 'undefined' && Auth.user?.id === operation.userId && Auth.generation === operation.authGeneration
      && (typeof Auth.getSessionEpoch !== 'function' || Auth.sessionEpoch === Auth.getSessionEpoch())
      && (Auth.sessionEpoch ?? null) === operation.sessionEpoch
      && (Auth.getSessionEpoch?.() ?? Auth.sessionEpoch ?? null) === operation.epoch;
  },
  isCurrent(operation, userId) {
    if (typeof operation === 'number') return operation === this.renderGeneration && this.renderIdentity?.userId === userId && this.isCurrent(this.renderIdentity);
    if (!operation) return false;
    return operation.generation === this.renderGeneration && operation.container === this.container && operation.container?.isConnected
      && operation.form === operation.container.querySelector('#nutrition-form') && this.isSameSession(operation)
      && Object.entries(operation.nodes).every(([key, node]) => node === operation.container.querySelector(`#nutrition-${key}`));
  },
  async accountRequest(method, body) {
    const controller = new AbortController(); let timer;
    // O prazo da interface também cobre uma implementação de transporte que ignore abort.
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error('O prazo de 15 segundos terminou sem confirmação.'); error.name = 'TimeoutError'; reject(error); controller.abort(); }, 15000); });
    try {
      const options = { timeoutMs: 15000, signal: controller.signal };
      const request = method === 'put' ? API.put('/nutricao/scenario', body, options) : API[method]('/nutricao/scenario', options);
      return await Promise.race([request, deadline]);
    } finally { clearTimeout(timer); }
  },
  inputSummary(input) {
    const number = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${number(input.weightKg)} kg · ${number(input.heightCm)} cm · ${number(input.age)} anos · ${input.sex === 'male' ? 'coeficiente masculino' : 'coeficiente feminino'} · ${input.formula === 'mifflin' ? 'Mifflin–St Jeor' : 'Harris–Benedict revisada'} · atividade ${number(input.activityFactor)} · ajuste ${number(input.adjustmentPercent)}% · proteína ${number(input.proteinPerKg)} g/kg · gordura ${number(input.fatPercent)}%.`;
  },
  accountStatus(message) {
    const node = this.container?.querySelector('#nutrition-account-status'); if (node) node.textContent = message;
  },
  updateAccountPreview() {
    const button = this.container?.querySelector('#nutrition-save'), preview = this.container?.querySelector('#nutrition-save-summary');
    if (!button || !preview) return;
    const operation = typeof Auth !== 'undefined' && Auth.user ? this.accountOperations.get(String(Auth.user.id)) : null;
    button.disabled = !this.lastInputs || this.accountBusyGeneration === this.renderGeneration || ['pending', 'uncertain'].includes(operation?.state);
    const deleting = this.container?.querySelector('#nutrition-delete'), restoring = this.container?.querySelector('#nutrition-restore');
    const reviewConfirm = this.container?.querySelector('#nutrition-review-confirm');
    if (reviewConfirm) reviewConfirm.disabled = this.accountBusyGeneration === this.renderGeneration || !this.container.querySelector('#nutrition-review-ack')?.checked;
    if (deleting) deleting.disabled = this.accountBusyGeneration === this.renderGeneration || ['pending', 'uncertain'].includes(operation?.state);
    if (restoring) { restoring.disabled = this.accountBusyGeneration === this.renderGeneration; restoring.textContent = operation?.state === 'pending' ? 'Conferir solicitação em andamento' : operation?.state === 'uncertain' ? 'Consultar situação salva' : 'Recuperar simulação salva'; }
    const input = this.lastInputs;
    preview.textContent = input ? `Simulação a salvar: ${this.inputSummary(input)}` : 'Calcule uma estimativa válida antes de salvar.';
  },
  setAccountBusy(generation, busy) {
    if (!busy && this.accountBusyGeneration !== generation) return;
    this.accountBusyGeneration = busy ? generation : null;
    if (generation !== this.renderGeneration) return;
    for (const selector of ['#nutrition-restore', '#nutrition-delete']) {
      const button = this.container?.querySelector(selector); if (button) button.disabled = busy;
    }
    this.updateAccountPreview();
  },
  async saveScenario(userId) {
    const generation = this.renderGeneration;
    if (!this.isCurrent(generation, userId) || !this.lastInputs || this.accountBusyGeneration === generation || this.accountOperations.has(String(userId))) return;
    const operation = this.captureOperation(userId); operation.state = 'pending'; operation.kind = 'save';
    this.accountOperations.set(String(userId), operation); this.setAccountBusy(generation, true);
    const input = structuredClone(this.lastInputs), button = this.container.querySelector('#nutrition-save'); button.disabled = true;
    this.accountStatus('Salvando a simulação na sua conta…');
    try {
      const response = await this.accountRequest('put', { consent: true, inputs: input });
      if (typeof response?.data?.currentFormulaVersion !== 'string') throw new Error('A resposta não confirmou os parâmetros salvos.');
      if (!this.isSameSession(operation)) { operation.state = 'uncertain'; return; }
      if (this.accountOperations.get(String(userId)) === operation) this.accountOperations.delete(String(userId));
      if (!this.isCurrent(operation)) return;
      const currentVersion = response.data.currentFormulaVersion;
      const changed = operation.revision !== this.editRevision || JSON.stringify(input) !== JSON.stringify(this.lastInputs);
      this.accountStatus(`Simulação salva na sua conta: ${this.inputSummary(input)} ${changed ? `O cálculo atual${this.lastInputs ? ` de ${this.lastInputs.weightKg} kg` : ''} foi alterado e não está salvo.` : 'Você pode recuperá-la em outro dispositivo ou excluir os dados salvos.'}${currentVersion !== FitFlowScience.version ? ' O servidor usa outro método; reabra o aplicativo e recalcule para conferir a versão atual.' : ''}`);
    } catch (error) { this.finishWriteError(operation, error); }
    finally { if (this.isCurrent(operation)) this.setAccountBusy(generation, false); else if (this.accountBusyGeneration === generation) this.accountBusyGeneration = null; operation.container = null; operation.form = null; operation.nodes = null; }
  },
  async restoreScenario(userId) {
    const generation = this.renderGeneration, revision = this.editRevision;
    if (!this.isCurrent(generation, userId) || this.accountBusyGeneration === generation) return;
    if (this.accountOperations.get(String(userId))?.state === 'pending') { this.accountStatus('A solicitação ainda está em andamento. Aguarde o prazo de 15 segundos e clique novamente em conferir para consultar a situação.'); return; }
    this.updateAccountPreview();
    if (!this.accountOperations.has(String(userId)) && this.accountInspectionUserId === userId) {
      this.accountInspectionUserId = null;
      this.accountStatus('A solicitação recebeu confirmação enquanto você navegava. Seu cálculo local foi preservado. Para substituir os parâmetros desta tela pelos dados salvos, clique em Recuperar simulação salva.');
      return;
    }
    const operation = this.captureOperation(userId);
    this.setAccountBusy(generation, true);
    const button = this.container.querySelector('#nutrition-restore'); button.disabled = true;
    this.accountStatus('Consultando a simulação salva na sua conta…');
    try {
      const response = await this.accountRequest('get');
      if (!this.isCurrent(operation)) return;
      if (!response?.data || !Object.hasOwn(response.data, 'scenario')) throw new Error('Resposta de consulta inválida.');
      const pending = this.accountOperations.get(String(userId));
      if (pending?.state === 'uncertain') {
        const saved = response.data.scenario;
        if (saved) FitFlowScience.calculateNutrition({ ...saved.inputs, eligible: true });
        pending.reviewed = true;
        this.container.querySelector('#nutrition-review').hidden = false;
        this.container.querySelector('#nutrition-review-ack').checked = false;
        this.container.querySelector('#nutrition-review-confirm').disabled = true;
        this.container.querySelector('#nutrition-review-summary').textContent = `Consulta atual: ${saved ? this.inputSummary(saved.inputs) : 'nenhuma simulação salva.'} A consulta não comprova o término da solicitação anterior. Ela ainda pode terminar depois e alterar estes dados. Seu cálculo local foi preservado. Se optar por outra operação, confira novamente o resultado salvo depois.`;
        this.accountStatus('Situação consultada. Leia e confirme a revisão antes de liberar uma nova operação. O cálculo local foi preservado.');
        return;
      }
      if (revision !== this.editRevision) { this.accountStatus('Você alterou os parâmetros durante a consulta. Clique em recuperar novamente se quiser substituir os dados desta tela.'); return; }
      const saved = response.data.scenario;
      if (!saved) { this.accountStatus('Não há simulação salva na sua conta. Seu cálculo local permanece nesta tela.'); return; }
      // Validate the full response before changing any field; eligibility is still unchecked below.
      FitFlowScience.calculateNutrition({ ...saved.inputs, eligible: true });
      const form = this.container.querySelector('#nutrition-form');
      const restored = {};
      for (const key of ['formula', 'sex', 'age', 'weightKg', 'heightCm', 'activityFactor', 'adjustmentPercent', 'proteinPerKg', 'fatPercent']) {
        const value = saved.inputs[key];
        if (!['string', 'number'].includes(typeof value)) throw new Error('Parâmetros salvos inválidos. Exclua a simulação e salve um novo cálculo.');
        restored[key] = String(value);
      }
      for (const [key, value] of Object.entries(restored)) form.elements[key].value = value;
      form.elements.eligible.checked = false;
      this.lastInputs = null; this.recoveredVersion = saved.formulaVersion; this.editRevision++; this.updateAccountPreview();
      this.container.querySelector('#nutrition-error').textContent = '';
      this.container.querySelector('#nutrition-result').innerHTML = '<h3>Parâmetros recuperados</h3><p>Confira as medidas e hipóteses. Confirme novamente o escopo de adulto saudável e clique em Calcular estimativa.</p>';
      this.accountStatus(response.data.versionChanged || saved.formulaVersion !== FitFlowScience.version
        ? 'A simulação foi salva com outra versão do método. O próximo cálculo usará a versão atual, após sua nova confirmação de escopo.'
        : 'Parâmetros recuperados. Reconfirme o escopo e calcule novamente; idade, medidas e hipóteses podem precisar de atualização.');
      form.elements.eligible.focus();
    } catch (error) { if (this.isCurrent(operation)) this.accountStatus(`Não foi possível recuperar: ${error.message} Nenhum resultado local foi apagado.`); }
    finally { if (this.isCurrent(operation)) this.setAccountBusy(generation, false); }
  },
  async deleteScenario(userId) {
    const generation = this.renderGeneration;
    if (!this.isCurrent(generation, userId) || this.accountBusyGeneration === generation || this.accountOperations.has(String(userId))) return;
    const operation = this.captureOperation(userId); operation.state = 'pending'; operation.kind = 'delete';
    this.accountOperations.set(String(userId), operation); this.setAccountBusy(generation, true);
    const button = this.container.querySelector('#nutrition-delete'); button.disabled = true;
    this.accountStatus('Excluindo os parâmetros salvos na sua conta…');
    try {
      const response = await this.accountRequest('delete');
      if (typeof response?.data?.deleted !== 'boolean') throw new Error('A resposta não confirmou a exclusão.');
      if (!this.isSameSession(operation)) { operation.state = 'uncertain'; return; }
      if (this.accountOperations.get(String(userId)) === operation) this.accountOperations.delete(String(userId));
      if (!this.isCurrent(operation)) return;
      this.accountStatus(response.data.deleted ? 'Simulação salva excluída da sua conta. O resultado local permanece temporariamente nesta tela.' : 'Não havia simulação salva na sua conta. O resultado local permanece nesta tela.');
      this.recoveredVersion = null;
    } catch (error) { this.finishWriteError(operation, error); }
    finally { if (this.isCurrent(operation)) this.setAccountBusy(generation, false); else if (this.accountBusyGeneration === generation) this.accountBusyGeneration = null; operation.container = null; operation.form = null; operation.nodes = null; }
  },
  finishWriteError(operation, error) {
    const rejected = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && ![408, 409, 425, 429].includes(error.status);
    if (rejected) { if (this.accountOperations.get(String(operation.userId)) === operation) this.accountOperations.delete(String(operation.userId)); }
    else { operation.state = 'uncertain'; operation.reviewed = false; }
    if (this.isCurrent(operation)) this.accountStatus(rejected
      ? `A solicitação foi recusada: ${error.message} O cálculo nesta tela continua disponível.`
      : `O resultado da solicitação não foi confirmado: ${error.message} O cálculo nesta tela continua disponível. Consulte a situação salva e revise o aviso antes de iniciar outra operação.`);
  },
  reviewUncertainOperation(userId) {
    const pending = this.accountOperations.get(String(userId));
    if (!this.isCurrent(this.renderGeneration, userId) || this.accountBusyGeneration === this.renderGeneration || pending?.state !== 'uncertain' || !pending.reviewed || !this.container.querySelector('#nutrition-review-ack').checked) return;
    this.accountOperations.delete(String(userId));
    this.container.querySelector('#nutrition-review').hidden = true;
    this.accountStatus('Revisão concluída. Uma nova operação exige outro clique explícito. Confira os dados salvos depois; a conclusão da solicitação anterior permanece desconhecida.');
    this.updateAccountPreview();
  },
  clearPrivateState() {
    ++this.renderGeneration;
    this.renderIdentity = null;
    for (const operation of this.accountOperations.values()) { operation.state = 'uncertain'; operation.reviewed = false; operation.container = null; operation.form = null; operation.nodes = null; }
    this.lastInputs = null; this.recoveredVersion = null; this.accountInspectionUserId = null;
    if (this.container?.isConnected && this.container.querySelector('#nutrition-form')) this.container.querySelector('#nutrition-form').reset();
    this.accountStatus('Entre novamente para salvar ou recuperar uma simulação.');
  },

  // A precisão completa fica no cálculo. Arredondamento acontece somente na apresentação.
  renderResult(container, result, input) {
    const format = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    const formula = result.formula === 'mifflin'
      ? `10 × peso + 6,25 × altura − 5 × idade ${input.sex === 'male' ? '+ 5' : '− 161'}`
      : input.sex === 'male'
        ? '88,362 + 13,397 × peso + 4,799 × altura − 5,677 × idade'
        : '447,593 + 9,247 × peso + 3,098 × altura − 4,330 × idade';
    container.innerHTML = `<span class="science-kicker">Seu resultado · Estimativa</span><h3>Energia e macronutrientes</h3>
      <div class="science-total">${format(result.targetKcal)} <span>kcal/dia no cenário</span></div>
      <div class="science-macros"><div><strong>${format(result.proteinG)} g</strong><span>Proteína</span></div><div><strong>${format(result.carbsG)} g</strong><span>Carboidrato</span></div><div><strong>${format(result.fatG)} g</strong><span>Gordura</span></div></div>
      <ol class="science-steps"><li>Repouso: ${format(result.restingKcal)} kcal/dia.</li><li>Gasto total aproximado: ${format(result.estimatedTotalKcal)} kcal/dia.</li><li>Cenário após ajuste selecionado: ${format(result.targetKcal)} kcal/dia.</li><li>Proteína e carboidrato: 4 kcal/g. Gordura: 9 kcal/g.</li></ol>
      <details class="science-calculation"><summary>Ver fórmula e hipóteses</summary><p class="science-formula">${formula}</p><ul id="nutrition-assumptions"></ul></details>
      <p class="science-note">Método v${result.version}. A soma exibida pode variar ligeiramente devido ao arredondamento dos gramas.</p>`;
    // Hipóteses entram como texto, sem transformar valores ou mensagens em HTML.
    for (const assumption of result.assumptions) {
      const li = document.createElement('li');
      li.textContent = assumption;
      container.querySelector('#nutrition-assumptions').appendChild(li);
    }
  },
};
window.addEventListener('auth:logout', () => NutricaoView.clearPrivateState());
