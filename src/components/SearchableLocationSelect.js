import { RJ_CIDADES, RJ_BAIRROS, ALL_RJ_BAIRROS } from '../data/rjLocations.js';

/**
 * Cria e acopla um Menu Suspenso Pesquisável (Combobox / Autocomplete)
 * para Cidades e Bairros do Rio de Janeiro em qualquer input do DOM.
 * 
 * @param {Object} options
 * @param {HTMLInputElement} options.inputEl - O elemento <input> a ser aprimorado
 * @param {'all' | 'cities' | 'neighborhoods'} options.type - Tipo de dados ('all', 'cities', 'neighborhoods')
 * @param {string} options.placeholder - Placeholder descritivo
 * @param {Function} [options.onSelect] - Callback disparado quando uma opção é selecionada
 */
export function setupSearchableLocationInput({ inputEl, type = 'all', placeholder, onSelect }) {
  if (!inputEl) return;

  if (placeholder) {
    inputEl.placeholder = placeholder;
  }

  // Envolve o input em um container relativo se ainda não estiver
  let wrapper = inputEl.parentElement;
  if (!wrapper.classList.contains('searchable-select-wrapper')) {
    const newWrapper = document.createElement('div');
    newWrapper.className = 'searchable-select-wrapper';
    newWrapper.style.position = 'relative';
    newWrapper.style.width = '100%';
    inputEl.parentNode.insertBefore(newWrapper, inputEl);
    newWrapper.appendChild(inputEl);
    wrapper = newWrapper;
  }

  // Cria o ícone chevron / indicador de menu suspenso
  let chevron = wrapper.querySelector('.searchable-select-chevron');
  if (!chevron) {
    chevron = document.createElement('div');
    chevron.className = 'searchable-select-chevron';
    chevron.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    chevron.style.position = 'absolute';
    chevron.style.right = '0.75rem';
    chevron.style.top = '50%';
    chevron.style.transform = 'translateY(-50%)';
    chevron.style.pointerEvents = 'none';
    chevron.style.transition = 'transform 0.2s ease';
    wrapper.appendChild(chevron);
  }

  // Cria o painel flutuante do menu suspenso
  let dropdown = wrapper.querySelector('.searchable-select-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      max-height: 260px;
      overflow-y: auto;
      z-index: 9999;
      display: none;
      padding: 0.35rem 0;
      font-size: 0.85rem;
      scrollbar-width: thin;
    `;
    wrapper.appendChild(dropdown);
  }

  // Prepara dataset de itens
  function getItems() {
    if (type === 'cities') {
      return RJ_CIDADES.map(c => ({
        label: c,
        category: 'Cidades do Rio de Janeiro',
        type: 'city'
      }));
    }
    if (type === 'neighborhoods') {
      return ALL_RJ_BAIRROS.map(b => ({
        label: b.name,
        category: b.regiao,
        type: 'neighborhood'
      }));
    }
    // 'all': Combina cidades e bairros
    const cities = RJ_CIDADES.map(c => ({
      label: c,
      category: 'Cidades do Rio de Janeiro',
      type: 'city'
    }));
    const neighborhoods = ALL_RJ_BAIRROS.map(b => ({
      label: b.name,
      category: b.regiao,
      type: 'neighborhood'
    }));
    return [...cities, ...neighborhoods];
  }

  const allItems = getItems();

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong style="color: #008069; background: #DCFCE7; padding: 0 2px; border-radius: 2px;">$1</strong>');
  }

  function renderDropdown(query = '') {
    const cleanQuery = query.toLowerCase().trim();
    let filtered = allItems;

    if (cleanQuery.length > 0) {
      filtered = allItems.filter(item => 
        item.label.toLowerCase().includes(cleanQuery) || 
        item.category.toLowerCase().includes(cleanQuery)
      );
    }

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 0.85rem 1rem; color: #94A3B8; text-align: center; font-size: 0.82rem;">
          Nenhum local encontrado para "<strong>${query}</strong>"
        </div>
      `;
      dropdown.style.display = 'block';
      chevron.style.transform = 'translateY(-50%) rotate(180deg)';
      return;
    }

    // Agrupa por categoria
    const groups = {};
    filtered.slice(0, 80).forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });

    let html = '';
    for (const [category, items] of Object.entries(groups)) {
      html += `
        <div style="padding: 0.4rem 0.85rem 0.2rem 0.85rem; font-size: 0.72rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; background: #F8FAFC; border-top: 1px solid #F1F5F9; border-bottom: 1px solid #F1F5F9;">
          ${category}
        </div>
      `;
      items.forEach(item => {
        const icon = item.type === 'city' ? '🏙️' : '📍';
        html += `
          <div class="searchable-option-item" data-value="${item.label}" data-type="${item.type}" data-category="${item.category}" style="padding: 0.55rem 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; transition: background 0.15s; border-bottom: 1px solid #F8FAFC;">
            <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
              <span style="font-size: 0.9rem;">${icon}</span>
              <span style="color: #1E293B; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${highlightMatch(item.label, query)}
              </span>
            </div>
            <span style="font-size: 0.7rem; color: #94A3B8; flex-shrink: 0;">
              ${item.type === 'city' ? 'Município' : 'Bairro'}
            </span>
          </div>
        `;
      });
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    chevron.style.transform = 'translateY(-50%) rotate(180deg)';

    // Listener para seleção de item
    dropdown.querySelectorAll('.searchable-option-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.background = '#F0FDF4';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = '#FFFFFF';
      });
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Previne blur antes da seleção
        const val = el.getAttribute('data-value');
        const itemType = el.getAttribute('data-type');
        const itemCategory = el.getAttribute('data-category');
        
        inputEl.value = val;
        hideDropdown();
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        if (onSelect) {
          onSelect({ value: val, type: itemType, category: itemCategory });
        }
      });
    });
  }

  function showDropdown() {
    renderDropdown(inputEl.value);
  }

  function hideDropdown() {
    dropdown.style.display = 'none';
    chevron.style.transform = 'translateY(-50%) rotate(0deg)';
  }

  // Event Listeners
  inputEl.addEventListener('focus', () => {
    showDropdown();
  });

  inputEl.addEventListener('input', (e) => {
    renderDropdown(e.target.value);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      hideDropdown();
    }
  });

  return {
    show: showDropdown,
    hide: hideDropdown,
    setValue: (val) => {
      inputEl.value = val;
    }
  };
}
