export function renderBottomNav(container, currentView, onViewChange, currentUser) {
  container.innerHTML = `
    <nav class="bottom-nav">
      <!-- 1. Tela de Envios -->
      <button class="bottom-nav-btn ${currentView === 'dispatch' ? 'active' : ''}" data-view="dispatch">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </div>
        <span>Envios</span>
      </button>

      <!-- 2. Tela de WhatsApp Web (Chat) -->
      <button class="bottom-nav-btn ${currentView === 'whatsapp' ? 'active' : ''}" data-view="whatsapp" style="color: #008069;">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
        </div>
        <span>WhatsApp</span>
      </button>

      <!-- 3. Tela de Contatos -->
      <button class="bottom-nav-btn ${currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
        <div class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="12" cy="10" r="3"></circle>
            <path d="M7 21v-2a5 5 0 0 1 10 0v2"></path>
          </svg>
        </div>
        <span>Contatos</span>
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

