export function renderBottomNav(container, currentView, onViewChange) {
  container.innerHTML = `
    <nav class="bottom-nav">
      <button class="bottom-nav-btn ${currentView === 'manager' ? 'active' : ''}" data-view="manager">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        </svg>
        <span>Team</span>
      </button>

      <button class="bottom-nav-btn ${currentView === 'dispatch' ? 'active' : ''}" data-view="dispatch" style="${currentView === 'dispatch' ? 'background: #1D4ED8; color: #FFFFFF;' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>Dispatch</span>
      </button>

      <button class="bottom-nav-btn ${currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Contacts</span>
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
