/**
 * ============================================================================
 * FitFlow Caraguá — Componente de Autocomplete
 * ============================================================================
 * Transforma um input text comum em uma barra de pesquisa que exibe
 * opções num dropdown suspenso em tempo real.
 */

const Autocomplete = {
  /**
   * Inicializa o autocomplete num input.
   * @param {string} inputId - ID do input text.
   * @param {Array} data - Array de objetos no formato { id: 1, label: 'Enzo' }
   * @param {Function} onSelect - Callback chamado quando uma opção é selecionada: onSelect(item)
   */
  init(inputId, data, onSelect) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Desliga autocompletar nativo do navegador
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    // Container de posicionamento relativo, se ainda não estiver num
    let wrapper = input.parentElement;
    if (!wrapper.classList.contains('autocomplete-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'autocomplete-wrapper';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    // Criar dropdown
    let dropdown = wrapper.querySelector('.autocomplete-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('ul');
      dropdown.className = 'autocomplete-dropdown';
      dropdown.style.display = 'none';
      wrapper.appendChild(dropdown);
    }
    dropdown.id = `${inputId}-options`;
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Alunos encontrados');
    input.setAttribute('aria-controls', dropdown.id);
    let matches = [], activeIndex = -1;
    const close = () => {
      dropdown.style.display = 'none';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      [...dropdown.children].forEach(node => node.setAttribute('aria-selected', 'false'));
    };
    const select = item => {
      input.value = item.label;
      close();
      onSelect(item);
    };
    const activate = index => {
      activeIndex = index;
      [...dropdown.children].forEach((node, i) => node.setAttribute('aria-selected', String(i === index)));
      input.setAttribute('aria-activedescendant', dropdown.children[index].id);
      dropdown.children[index].scrollIntoView?.({ block: 'nearest' });
    };
    input.addEventListener('keydown', event => {
      // Keep composition keys available to input methods.
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        if (input.getAttribute('aria-expanded') === 'true') { event.preventDefault(); event.stopPropagation(); close(); }
        return;
      }
      if (event.key === 'Tab') { close(); return; }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
        event.preventDefault();
        dropdown.style.display = 'block'; input.setAttribute('aria-expanded', 'true');
        activate(activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) :
          (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
      } else if (event.key === 'Enter' && activeIndex >= 0 && input.getAttribute('aria-expanded') === 'true') {
        event.preventDefault(); select(matches[activeIndex]);
      }
    });
    input.addEventListener('blur', close);

    // Lógica principal
    input.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      
      // Limpa dropdown
      dropdown.innerHTML = '';
      close(); matches = [];
      
      if (!val) {
        dropdown.style.display = 'none';
        // Quando limpar o input completamente, avisamos o onSelect com null
        // para recarregar a lista geral.
        onSelect(null);
        return;
      }

      matches = data.filter(item => item.label.toLowerCase().includes(val));

      if (matches.length === 0) {
        dropdown.innerHTML = '<li class="autocomplete-empty">Nenhum aluno encontrado</li>';
      } else {
        matches.forEach((item, index) => {
          const li = document.createElement('li');
          li.className = 'autocomplete-item';
          li.id = `${dropdown.id}-${index}`;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          li.textContent = item.label;
          // Retain input focus so mouse/touch selection does not close on blur.
          li.addEventListener('mousedown', event => event.preventDefault());
          li.addEventListener('click', () => select(item));
          dropdown.appendChild(li);
        });
      }

      dropdown.style.display = 'block';
      input.setAttribute('aria-expanded', 'true');
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        close();
      }
    });
  }
};
