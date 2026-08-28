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

// Verifica se a URL atual é do Painel de Gestão Desktop (/admin ou #admin)
export function isAdminUrl() {
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  return pathname.startsWith('/admin') || hash.startsWith('#admin') || hash.startsWith('#/admin');
}

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
  const isAdminOrCoord = role === 'admin' || role === 'coordinator';
  const onAdminRoute = isAdminUrl();

  // ROTEAMENTO BASEADO EM URL:
  // 1. Rota /admin: Painel de Gestão Desktop (Exclusivo Admin / Coordenador)
  // 2. Rota / (Padrão): Versão Celular Otimizada (Fluida e Responsiva)
  if (onAdminRoute) {
    if (!isAdminOrCoord) {
      window.history.replaceState(null, '', '/');
      document.body.classList.add('view-mode-mobile');
      document.body.classList.remove('view-mode-desktop');
      if (!currentView || ['admin', 'manager', 'import', 'roles'].includes(currentView)) {
        currentView = 'dispatch';
      }
    } else {
      document.body.classList.add('view-mode-desktop');
      document.body.classList.remove('view-mode-mobile');
      if (!currentView) {
        currentView = role === 'admin' ? 'admin' : 'manager';
      }
    }
  } else {
    document.body.classList.add('view-mode-mobile');
    document.body.classList.remove('view-mode-desktop');
    if (!currentView) {
      currentView = 'dispatch';
    }
  }

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

  // Guard de Rota no Frontend
  if (role === 'member' && ['admin', 'manager', 'import', 'roles'].includes(currentView)) {
    currentView = 'dispatch';
  } else if (role === 'coordinator' && currentView === 'admin') {
    currentView = 'manager';
  }

  if (activeCleanup && typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }

  const isManagerView = currentView === 'manager' || currentView === 'admin';
  const roleLabel = role === 'admin' ? 'Administrador Geral' : role === 'coordinator' ? 'Coordenador de Equipe' : 'Membro da Equipe';

  appEl.innerHTML = `
    <div class="app-container">
      <!-- Sidebar Desktop -->
      <div id="sidebar-mount"></div>

      <!-- Main Content Area -->
      <div class="main-wrapper">
        ${(currentView === 'dispatch' && !onAdminRoute) ? '' : `
          <!-- Topbar Header -->
          <header class="topbar">
            <div class="topbar-left" style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
              <button id="btn-mobile-sidebar-toggle" style="background: none; border: none; color: inherit; font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              <div style="min-width: 0; display: flex; flex-direction: column;">
                <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${currentUser.name || 'Alex Amarante'}
                </h2>
                ${teamDisplayName ? `
                  <span style="font-size: 0.72rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; margin-top: 1px;">
                    👥 Equipe: <strong>${teamDisplayName}</strong>
                  </span>
                ` : ''}
              </div>
              
              ${role === 'admin' && isManagerView ? `
                <select id="topbar-team-select" class="team-selector-pill" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; font-weight: 700; border-radius: 9999px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: inherit; cursor: pointer; outline: none;">
                  ${tenantTeams.length === 0 ? `
                    <option value="" style="color: black;">Nenhuma equipe</option>
                  ` : tenantTeams.map(t => `
                    <option value="${t.id}" ${currentTeamId === t.id ? 'selected' : ''} style="color: black;">👥 ${t.name}</option>
                  `).join('')}
                </select>
              ` : ''}
            </div>

            <div class="topbar-right" style="position: relative; display: flex; align-items: center; gap: 0.45rem;">
              <!-- Configurações (Engrenagem) -->
              <button id="btn-topbar-settings" class="topbar-icon-btn" title="Configurações & Conexão WhatsApp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>

              <!-- Botão Sair Direto (Logout) -->
              <button id="btn-topbar-direct-logout" class="topbar-icon-btn" title="Sair do Sistema (Logout)" style="color: #FFFFFF; background: rgba(239, 68, 68, 0.35); border: 1px solid rgba(255, 255, 255, 0.3);">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </header>
        `}

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
    activeCleanup = renderDispatchView(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'import') {
    activeCleanup = renderCsvImportWizard(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
  } else if (currentView === 'evolution') {
    activeCleanup = renderEvolutionManager(mainMount, currentUserState, (newView) => {
      currentView = newView;
      renderProtectedApp(currentUserState);
    });
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

  const settingsBtn = appEl.querySelector('#btn-topbar-settings');

  settingsBtn?.addEventListener('click', () => {
    currentView = 'settings';
    renderProtectedApp(currentUserState);
  });

  appEl.querySelector('#btn-topbar-direct-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Deseja realmente sair da sua conta?')) {
      await logoutUser();
    }
  });
}


// Escuta mudanças de URL pelo botão voltar/avançar do navegador ou hash
window.addEventListener('popstate', () => {
  if (currentUserState) renderProtectedApp(currentUserState);
});
window.addEventListener('hashchange', () => {
  if (currentUserState) renderProtectedApp(currentUserState);
});

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
