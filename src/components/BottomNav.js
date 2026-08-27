export function renderBottomNav(container, currentView, onViewChange, currentUser) {
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';

  container.innerHTML = `
    <nav class="bottom-nav">
      ${isAdmin ? `
        <button class="bottom-nav-btn ${currentView === 'admin' ? 'active' : ''}" data-view="admin">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Painel</span>
        </button>
      ` : ''}

      ${(isAdmin || isCoordinator) ? `
        <button class="bottom-nav-btn ${currentView === 'manager' ? 'active' : ''}" data-view="manager">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          </svg>
          <span>Equipe</span>
        </button>
      ` : ''}

      <button class="bottom-nav-btn ${currentView === 'dispatch' ? 'active' : ''}" data-view="dispatch" style="${currentView === 'dispatch' ? 'background: #1D4ED8; color: #FFFFFF; border-radius: var(--radius-md);' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>Disparos</span>
      </button>

      <button class="bottom-nav-btn ${currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Contatos</span>
      </button>

      <button class="bottom-nav-btn ${currentView === 'evolution' ? 'active' : ''}" data-view="evolution">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1 .9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span>WhatsApp</span>
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
