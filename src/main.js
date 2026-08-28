import './styles/main.css';
import { useAuth, logoutUser } from './firebase/auth.js';
import { renderLoginView } from './components/LoginView.js';
import { renderPendingTeamView } from './components/PendingTeamView.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderBottomNav } from './components/BottomNav.js';
import { renderAdminPanel } from './components/AdminPanel.js';
import { renderManagerialDashboard } from './components/ManagerialDashboard.js';
import { renderContactsView } from './components/ContactsView.js';
import { renderDispatchView } from './components/DispatchView.js';
import { renderCsvImportWizard } from './components/CsvImportWizard.js';
import { renderEvolutionManager } from './components/EvolutionManager.js';
import { renderTemplatesManager } from './components/TemplatesManager.js';
import { renderSettingsGeneral } from './components/SettingsGeneral.js';
import { renderRolesManagement } from './components/RolesManagement.js';
import { renderSecuritySettings } from './components/SecuritySettings.js';
import { subscribeToTenantTeams, DEFAULT_TENANT_ID } from './firebase/realtime.js';

import { db } from './firebase/config.js';
import { doc, getDoc } from 'firebase/firestore';

const appEl = document.querySelector('#app');

// Remove somente o cache legado de demonstração; a fonte de dados em produção é o Firestore.
['campaign_teams', 'campaign_members', 'campaign_templates', 'campaign_contacts', 'campaign_audit_logs', 'mgmt_active_template'].forEach(key => localStorage.removeItem(key));

let activeCleanup = null;
let currentView = null;
let currentTeamId = null;
let currentUserState = null;
let tenantTeams = [];

function updateAllTeamBadges(teamName) {
  if (!teamName) return;
  const topbarBadge = appEl?.querySelector('#topbar-team-badge-name');
  if (topbarBadge) topbarBadge.textContent = teamName;
  
  const sidebarBadge = appEl?.querySelector('#sidebar-team-badge-name');
  if (sidebarBadge) sidebarBadge.textContent = teamName;

  appEl?.querySelectorAll('.current-user-team-name').forEach(el => {
    el.textContent = teamName;
  });
}

// Subscreve às equipes para mapeamento de nome e seletor global
subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
  tenantTeams = teams;
  if (!currentTeamId && teams.length > 0) {
    currentTeamId = teams[0].id;
  }
  if (currentUserState && currentUserState.team_id) {
    const teamObj = tenantTeams.find(t => t.id === currentUserState.team_id || t.name === currentUserState.team_name);
    if (teamObj && teamObj.name) {
      currentUserState.team_name = teamObj.name;
      updateAllTeamBadges(teamObj.name);
    }
  }

  // Atualiza o dropdown da topbar em tempo real se estiver montado
  const topbarSel = appEl?.querySelector('#topbar-team-select');
  if (topbarSel) {
    topbarSel.innerHTML = tenantTeams.length === 0 
      ? `<option value="">Nenhuma equipe cadastrada</option>`
      : tenantTeams.map(t => `<option value="${t.id}" ${currentTeamId === t.id ? 'selected' : ''}>👥 ${t.name} ⌵</option>`).join('');
  }
});

function renderProtectedApp(currentUser) {
  currentUserState = currentUser;
  const role = currentUser.role || 'member';

  if (!currentTeamId && tenantTeams.length > 0) {
    currentTeamId = currentUser.team_id || tenantTeams[0].id;
  } else if (!currentTeamId && currentUser.team_id) {
    currentTeamId = currentUser.team_id;
  }

  // Localiza o nome real da equipe do operador ou coordenador
  const teamObj = tenantTeams.find(t => t.id === currentUser.team_id || t.name === currentUser.team_name);
  let teamDisplayName = currentUser.team_name || teamObj?.name || null;

  if (!teamDisplayName && currentUser.team_id) {
    getDoc(doc(db, 'teams', currentUser.team_id)).then((snap) => {
      if (snap.exists() && snap.data().name) {
        const resolvedName = snap.data().name;
        currentUser.team_name = resolvedName;
        if (currentUserState) currentUserState.team_name = resolvedName;
        updateAllTeamBadges(resolvedName);
      }
    }).catch(() => {});
  }

  // Define a view padrão com base no papel
  if (!currentView) {
    if (role === 'admin') currentView = 'admin';
    else if (role === 'coordinator') currentView = 'manager';
    else currentView = 'contacts';
  }

  // Guard de Rota no Frontend (Blindagem de Nível de Acesso)
  if (role === 'member' && ['admin', 'manager', 'import', 'roles'].includes(currentView)) {
    currentView = 'contacts';
  } else if (role === 'coordinator' && currentView === 'admin') {
    currentView = 'manager';
  }

  if (activeCleanup && typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }

  const isMember = role === 'member';
  const isManagerView = currentView === 'manager' || currentView === 'admin';
  const roleLabel = role === 'admin' ? 'Administrador Geral' : role === 'coordinator' ? 'Coordenador de Equipe' : 'Membro da Equipe';

  appEl.innerHTML = `
    <div class="app-container">
      <!-- Sidebar Desktop -->
      <div id="sidebar-mount"></div>

      <!-- Main Content Area -->
      <div class="main-wrapper">
        <!-- Topbar WhatsApp Business Style -->
        <header class="topbar">
          <div class="topbar-left" style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
            <button id="btn-mobile-sidebar-toggle" style="background: none; border: none; color: #FFFFFF; font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <div style="min-width: 0; display: flex; flex-direction: column;">
              <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; line-height: 1.2; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${currentUser.name || 'Alex Amarante'}
              </h2>
              ${teamDisplayName ? `
                <span style="font-size: 0.72rem; opacity: 0.9; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; margin-top: 1px;">
                  👥 Equipe: <strong>${teamDisplayName}</strong>
                </span>
              ` : ''}
            </div>
            
            ${role === 'admin' && isManagerView ? `
              <select id="topbar-team-select" class="team-selector-pill" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; font-weight: 700; border-radius: 9999px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: #FFFFFF; cursor: pointer; outline: none;">
                ${tenantTeams.length === 0 ? `
                  <option value="" style="color: black;">Nenhuma equipe</option>
                ` : tenantTeams.map(t => `
                  <option value="${t.id}" ${currentTeamId === t.id ? 'selected' : ''} style="color: black;">👥 ${t.name}</option>
                `).join('')}
              </select>
            ` : ''}
          </div>

          <div class="topbar-right" style="position: relative;">
            <!-- Notificações -->
            <button id="btn-topbar-notifications" class="topbar-icon-btn" title="Notificações" style="position: relative;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <div class="topbar-badge-dot"></div>
            </button>

            <!-- Configurações -->
            <button id="btn-topbar-settings" class="topbar-icon-btn" title="Configurações">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>

            <!-- Avatar -->
            <button id="btn-topbar-avatar" style="background: none; border: none; padding: 0; cursor: pointer;">
              <img src="${currentUser.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face'}" class="topbar-avatar" alt="Avatar Usuário">
            </button>

            <!-- Dropdown Notificações -->
            <div id="dropdown-notifications" class="topbar-dropdown" style="display: none;">
              <div style="padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.9rem; color: var(--text-main);">Notificações da Campanha</strong>
                <span class="pill-btn" style="font-size: 0.65rem; padding: 2px 6px; background: #EFF6FF; color: #1D4ED8;">2 Novas</span>
              </div>
              <div style="max-height: 260px; overflow-y: auto;">
                <div style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.82rem; background: #F8FAFC;">
                  <div style="font-weight: 600; color: var(--text-main);">🔥 Meta de Disparos Ativa</div>
                  <div style="color: var(--text-muted); margin-top: 0.15rem;">Meta individual configurada: ${currentUser.daily_goal || 30} contatos.</div>
                  <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 0.35rem;">Hoje</div>
                </div>
                <div style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
                  <div style="font-weight: 600; color: #15803D;">✓ Plataforma Multi-Tenant Conectada</div>
                  <div style="color: var(--text-muted); margin-top: 0.15rem;">Segurança RBAC e isolamento de tenancy ativos.</div>
                  <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 0.35rem;">Ativo</div>
                </div>
              </div>
            </div>

            <!-- Dropdown Perfil -->
            <div id="dropdown-profile" class="topbar-dropdown" style="display: none; width: 280px;">
              <div style="padding: 1.25rem 1rem; text-align: center; border-bottom: 1px solid var(--border-color); background: #F8FAFC;">
                <img src="${currentUser.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face'}" style="width: 52px; height: 52px; border-radius: 50%; margin-bottom: 0.5rem; object-fit: cover; border: 2px solid #FFFFFF; box-shadow: var(--shadow-sm);" alt="Avatar">
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${currentUser.name || 'Jane Doe'}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.1rem;">${currentUser.email}</div>
                <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 4px; align-items: center;">
                  <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.72rem;">${roleLabel}</span>
                  ${teamDisplayName ? `
                    <span class="pill-btn" style="background: #F0FDF4; color: #15803D; font-size: 0.72rem; font-weight: 600;">👥 Equipe: ${teamDisplayName}</span>
                  ` : ''}
                </div>
              </div>
              <div style="padding: 0.5rem 0;">
                <a href="#" id="menu-goto-settings" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem; color: var(--text-main); text-decoration: none; font-size: 0.85rem; font-weight: 500;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  General Settings
                </a>
                <a href="#" id="menu-goto-security" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem; color: var(--text-main); text-decoration: none; font-size: 0.85rem; font-weight: 500;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Security Settings
                </a>
                <a href="#" id="menu-topbar-logout" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem; color: #DC2626; text-decoration: none; font-size: 0.85rem; font-weight: 500; border-top: 1px solid var(--border-color);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Logout
                </a>
              </div>
            </div>
          </div>
        </header>

        <!-- Dynamic Main Content Screen -->
        <main id="main-view-mount"></main>
      </div>

      <!-- Mobile Bottom Navigation -->
      <div id="bottom-nav-mount"></div>
    </div>
  `;

  const sidebarMount = appEl.querySelector('#sidebar-mount');
  const mainMount = appEl.querySelector('#main-view-mount');
  const bottomNavMount = appEl.querySelector('#bottom-nav-mount');

  // Renderiza Sidebar
  renderSidebar(sidebarMount, currentUserState, currentView, (newView) => {
    currentView = newView;
    renderProtectedApp(currentUserState);
  }, teamDisplayName);

  // Renderiza Bottom Nav
  renderBottomNav(bottomNavMount, currentView, (newView) => {
    currentView = newView;
    renderProtectedApp(currentUserState);
  }, currentUserState);

  // Renderiza Tela Conforme View Ativa
  if (currentView === 'admin') {
    activeCleanup = renderAdminPanel(mainMount, currentUserState, (newView, selectedTeamId) => {
      currentView = newView;
      if (selectedTeamId) currentTeamId = selectedTeamId;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'manager') {
    activeCleanup = renderManagerialDashboard(mainMount, currentUserState, currentTeamId, (newTeam) => {
      currentTeamId = newTeam;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'contacts') {
    activeCleanup = renderContactsView(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'dispatch') {
    activeCleanup = renderDispatchView(mainMount, currentUserState);
  } else if (currentView === 'import') {
    activeCleanup = renderCsvImportWizard(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'evolution') {
    activeCleanup = renderEvolutionManager(mainMount, currentUserState);
  } else if (currentView === 'templates') {
    activeCleanup = renderTemplatesManager(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'settings') {
    activeCleanup = renderSettingsGeneral(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'roles') {
    activeCleanup = renderRolesManagement(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'security') {
    activeCleanup = renderSecuritySettings(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  }

  // Topbar Dropdown & Select Handlers
  const topbarTeamSelect = appEl.querySelector('#topbar-team-select');
  topbarTeamSelect?.addEventListener('change', (e) => {
    currentTeamId = e.target.value;
    if (currentView === 'manager' || currentView === 'admin') {
      renderProtectedApp(currentUserState);
    }
  });

  const notifBtn = appEl.querySelector('#btn-topbar-notifications');
  const settingsBtn = appEl.querySelector('#btn-topbar-settings');
  const avatarBtn = appEl.querySelector('#btn-topbar-avatar');
  const notifDropdown = appEl.querySelector('#dropdown-notifications');
  const profileDropdown = appEl.querySelector('#dropdown-profile');

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = notifDropdown.style.display === 'block';
    notifDropdown.style.display = isVisible ? 'none' : 'block';
    if (profileDropdown) profileDropdown.style.display = 'none';
  });

  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = profileDropdown.style.display === 'block';
    profileDropdown.style.display = isVisible ? 'none' : 'block';
    if (notifDropdown) notifDropdown.style.display = 'none';
  });

  settingsBtn?.addEventListener('click', () => {
    currentView = 'settings';
    renderProtectedApp(currentUserState);
  });

  appEl.querySelector('#menu-goto-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    currentView = 'settings';
    renderProtectedApp(currentUserState);
  });

  appEl.querySelector('#menu-goto-security')?.addEventListener('click', (e) => {
    e.preventDefault();
    currentView = 'security';
    renderProtectedApp(currentUserState);
  });

  appEl.querySelector('#menu-topbar-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await logoutUser();
  });

  document.addEventListener('click', (e) => {
    if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
      notifDropdown.style.display = 'none';
    }
    if (profileDropdown && !profileDropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
      profileDropdown.style.display = 'none';
    }
  });
}

function renderLoading() {
  appEl.innerHTML = `
    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #F8FAFC;">
      <div style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #1D4ED8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 1rem; font-size: 0.85rem; color: #64748B; font-weight: 500;">Autenticando no DispatchPro...</p>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;
}

useAuth(({ user, loading }) => {
  if (loading) {
    renderLoading();
    return;
  }

  if (!user) {
    currentView = null;
    renderLoginView(appEl, (loggedUser) => {
      if ((loggedUser.role || 'member') === 'member' && !loggedUser.team_id) {
        renderPendingTeamView(appEl, loggedUser);
      } else {
        renderProtectedApp(loggedUser);
      }
    });
    return;
  }

  const prevUser = currentUserState;
  currentUserState = user;

  // Se o usuário logado for operador (member) e não estiver alocado em uma equipe, bloqueia o acesso
  const role = user.role || 'member';
  if (role === 'member' && !user.team_id) {
    if (activeCleanup && typeof activeCleanup === 'function') {
      activeCleanup();
      activeCleanup = null;
    }
    renderPendingTeamView(appEl, user);
    return;
  }

  // Se já está autenticado e o papel/equipe não mudou, não destrói a tela ativa
  if (prevUser && prevUser.uid === user.uid && prevUser.role === user.role && prevUser.team_id === user.team_id && currentView) {
    return;
  }

  renderProtectedApp(user);
});
