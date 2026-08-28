import { logoutUser } from '../firebase/auth.js';

export function renderSidebar(container, currentUser, currentView, onViewChange, teamDisplayName = null) {
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isMember = currentUser?.role === 'member';

  const roleLabel = isAdmin ? 'Admin Global' : isCoordinator ? 'Coordenador' : 'Membro da Equipe';
  const teamLabel = teamDisplayName || currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : null);

  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div class="sidebar-brand-text">
          <h1>Painel Corporativo</h1>
          <span style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            Gestão Enterprise 
            <span class="pill-btn" style="font-size: 0.6rem; padding: 1px 5px; background: #EFF6FF; color: #1D4ED8; font-weight: 700;">${roleLabel}</span>
          </span>
          ${isMember && currentUser?.team_id ? `
            <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; color: #1E40AF; background: #DBEAFE; padding: 2px 8px; border-radius: 9999px; width: fit-content;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span id="sidebar-team-badge-name" class="current-user-team-name">${currentUser?.team_name || teamDisplayName || 'Equipe'}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <button id="sidebar-new-action-btn" class="btn-new-action">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        + Novo Disparo
      </button>

      <div class="sidebar-nav-section-title">
        ${isAdmin ? 'ADMINISTRAÇÃO' : isCoordinator ? 'COORDENAÇÃO' : 'MEU ESPAÇO'}
      </div>

      <nav class="sidebar-nav">
        ${isAdmin ? `
          <a class="nav-item ${currentView === 'admin' ? 'active' : ''}" data-view="admin">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Painel Global
          </a>
        ` : ''}

        ${isAdmin || isCoordinator ? `
          <a class="nav-item ${currentView === 'manager' ? 'active' : ''}" data-view="manager">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Gestão de Equipe
          </a>
        ` : ''}

        <a class="nav-item ${currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          ${isMember ? 'Meus Contatos' : isCoordinator ? 'Contatos da Equipe' : 'Base de Contatos'}
        </a>

        <a class="nav-item ${currentView === 'dispatch' ? 'active' : ''}" data-view="dispatch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          Disparo de Mensagens
        </a>

        <a class="nav-item ${currentView === 'history' ? 'active' : ''}" data-view="history">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Histórico de Envios
        </a>

        <a class="nav-item ${currentView === 'evolution' ? 'active' : ''}" data-view="evolution">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Conexão WhatsApp
        </a>

        <a class="nav-item ${currentView === 'templates' ? 'active' : ''}" data-view="templates">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Templates de Mensagem
        </a>

        ${!isMember ? `
          <a class="nav-item ${currentView === 'roles' ? 'active' : ''}" data-view="roles">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Gestão de Perfis
          </a>

          <a class="nav-item ${currentView === 'import' ? 'active' : ''}" data-view="import">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Importar CSV
          </a>
        ` : ''}

        <div class="sidebar-nav-section-title" style="margin-top: 1rem;">SISTEMA</div>

        <a class="nav-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Configurações
        </a>

        <a class="nav-item ${currentView === 'security' ? 'active' : ''}" data-view="security">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Segurança & Sessões
        </a>
      </nav>

        <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <a href="/" id="btn-goto-mobile-view" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.6rem 0.85rem; color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: var(--radius-md); font-weight: 700; font-size: 0.82rem; text-decoration: none; transition: all 0.15s ease;">
            📱 Versão Celular (Operador)
          </a>

          <button id="btn-logout" class="logout-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Sair do Sistema
          </button>
        </div>
      </aside>
    `;

    // Navigation listeners
    container.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        onViewChange(view);
      });
    });

    container.querySelector('#btn-goto-mobile-view')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    container.querySelector('#sidebar-new-action-btn')?.addEventListener('click', () => {
      onViewChange('dispatch');
    });

    container.querySelector('#btn-logout')?.addEventListener('click', async () => {
      await logoutUser();
    });
  }

