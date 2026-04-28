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

    // Lógica principal
    input.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      
      // Limpa dropdown
      dropdown.innerHTML = '';
      
      if (!val) {
        dropdown.style.display = 'none';
        // Quando limpar o input completamente, avisamos o onSelect com null
        // para recarregar a lista geral.
        onSelect(null);
        return;
      }

      const matches = data.filter(item => item.label.toLowerCase().includes(val));

      if (matches.length === 0) {
        dropdown.innerHTML = '<li class="autocomplete-empty">Nenhum aluno encontrado</li>';
      } else {
        matches.forEach(item => {
          const li = document.createElement('li');
          li.className = 'autocomplete-item';
          li.textContent = item.label;
          li.addEventListener('click', () => {
            input.value = item.label;
            dropdown.style.display = 'none';
            onSelect(item);
          });
          dropdown.appendChild(li);
        });
      }

      dropdown.style.display = 'block';
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }
};
