export function renderBottomNav(container, currentView, onViewChange, currentUser) {
  container.innerHTML = `
    <nav class="bottom-nav">
      <!-- 1. Tela de Envios (Disparos) -->
      <button class="bottom-nav-btn ${currentView === 'dispatch' ? 'active' : ''}" data-view="dispatch">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </div>
        <span>Envios</span>
      </button>

      <!-- 2. Tela de Conexões (WhatsApp) -->
      <button class="bottom-nav-btn ${currentView === 'evolution' ? 'active' : ''}" data-view="evolution">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </div>
        <span>Conexões</span>
      </button>

      <!-- 3. Tela de Contatos -->
      <button class="bottom-nav-btn ${currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <span>Contatos</span>
      </button>

      <!-- 4. Tela de Templates -->
      <button class="bottom-nav-btn ${currentView === 'templates' ? 'active' : ''}" data-view="templates">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <span>Templates</span>
      </button>
    </nav>
  `;

  container.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      onViewChange(view);
    });
  });
}
