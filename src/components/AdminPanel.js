import { 
  subscribeToAllUsers, 
  subscribeToTenantTeams, 
  subscribeToAllContacts, 
  subscribeToSystemAuditLogs,
  subscribeToMessagesHistory,
  createTeamInFirestore,
  toggleUserActiveStatus,
  updateUserRole,
  updateUserTeam,
  deleteUserFromFirestore,
  recordSystemAuditLog,
  DEFAULT_TENANT_ID 
} from '../firebase/realtime.js';
import { createUserProfileDirectly } from '../firebase/auth.js';
import { db } from '../firebase/config.js';
import { doc, updateDoc } from 'firebase/firestore';

export function renderAdminPanel(container, currentUser, onNavigate) {
  let allUsers = [];
  let allTeams = [];
  let allContacts = [];
  let allMessages = [];
  let auditLogs = [];
  let currentTab = 'teams'; // 'teams' | 'users' | 'audit'

  container.innerHTML = `
    <div class="page-content">
      <!-- Top Title & Action Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="pill-btn" style="background: #FEE2E2; color: #DC2626; font-weight: 700; font-size: 0.72rem;">Painel Global</span>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Administração Central</h2>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">Gestão de coordenadores, equipes e governança do sistema.</p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button id="btn-admin-new-team" class="btn-outline-white" style="font-weight: 600;">
            + Nova Equipe
          </button>
          <button id="btn-admin-new-coord" class="btn-primary-blue" style="font-weight: 600;">
            + Novo Coordenador
          </button>
        </div>
      </div>

      <!-- 4 Strategic Enterprise KPIs -->
      <div class="metrics-row">
        <!-- KPI 1: Coordenadores -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">COORDENADORES</span>
            <span class="metric-big-num" id="adm-kpi-coordinators">0</span>
            <span class="metric-subtext">Gestores de Equipe</span>
          </div>
          <div class="metric-icon-bubble">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
          </div>
        </div>

        <!-- KPI 2: Equipes Ativas -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">EQUIPES ATIVAS</span>
            <span class="metric-big-num" id="adm-kpi-teams">0</span>
            <span class="metric-subtext" style="color: var(--primary-blue); font-weight: 600;">Estrutura operacional</span>
          </div>
          <div class="metric-icon-bubble">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>

        <!-- KPI 3: Total de Contatos -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">TOTAL DE CONTATOS</span>
            <span class="metric-big-num" id="adm-kpi-contacts">0</span>
            <span class="metric-subtext">Base cadastrada</span>
          </div>
          <div class="metric-icon-bubble gray">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>
          </div>
        </div>

        <!-- KPI 4: Disparos Confirmados -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">DISPAROS CONFIRMADOS</span>
            <span class="metric-big-num" id="adm-kpi-dispatches">0</span>
            <span class="metric-subtext" style="color: var(--whatsapp-green);">Sucesso</span>
          </div>
          <div class="metric-icon-bubble" style="background: #F0FDF4; color: var(--whatsapp-green);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
        <button class="nav-tab-btn" id="tab-btn-teams" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid var(--primary-blue); color: var(--primary-blue);">
          Equipes Cadastradas
        </button>
        <button class="nav-tab-btn" id="tab-btn-users" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted);">
          Usuários & Coordenadores
        </button>
        <button class="nav-tab-btn" id="tab-btn-audit" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted);">
          Logs de Auditoria
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="admin-tab-content"></div>
    </div>

    <!-- Modal Nova Equipe -->
    <div id="modal-new-team" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 480px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Criar Nova Equipe</h3>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Cadastre a equipe e selecione o coordenador que a liderará.</p>
          </div>
          <button id="btn-close-team-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-new-team" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Nome da Equipe *</label>
            <input type="text" id="input-team-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem;" placeholder="Ex: Equipe Delta - Norte" required>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Coordenador Responsável *</label>
            <select id="select-team-coord" class="form-control" style="padding: 0.6rem 0.85rem;" required></select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            <button type="button" id="btn-cancel-team-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-team-submit" class="btn-primary-blue" style="font-weight: 600;">Criar Equipe</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Novo Coordenador -->
    <div id="modal-new-coord" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 460px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Cadastrar Coordenador</h3>
          <button id="btn-close-coord-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-new-coord" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Nome Completo</label>
            <input type="text" id="input-coord-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: Fernanda Lima" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">E-mail Corporativo</label>
            <input type="email" id="input-coord-email" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="fernanda@empresa.com" required>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-coord-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-coord-submit" class="btn-primary-blue">Cadastrar Coordenador</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Alterar Cargo do Usuário -->
    <div id="modal-change-role" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 440px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Alterar Cargo do Usuário</h3>
            <p id="modal-change-role-username" style="font-size: 0.82rem; color: var(--primary-blue); font-weight: 600; margin-top: 2px;">Usuário</p>
          </div>
          <button id="btn-close-role-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <input type="hidden" id="modal-target-user-uid">
          
          <button class="btn-select-role-option btn-outline-white" data-role="admin" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: var(--text-main); font-size: 0.95rem; display: block;">👑 Administrador</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Acesso total, governança e relatórios globais</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>

          <button class="btn-select-role-option btn-outline-white" data-role="coordinator" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: #1D4ED8; font-size: 0.95rem; display: block;">👔 Coordenador / Gestor</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Lidera equipes, contatos e membros</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>

          <button class="btn-select-role-option btn-outline-white" data-role="member" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: var(--text-main); font-size: 0.95rem; display: block;">🎯 Membro da Equipe</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Disparos assistidos (wa.me) e metas</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>
        </div>
      </div>
    </div>
  `;

  function updateKpis() {
    const validUsers = allUsers.filter(u => u.email || u.name);
    const coordsCount = validUsers.filter(u => u.role === 'coordinator' || u.role === 'admin').length;
    const teamsCount = allTeams.length;
    const contactsCount = allContacts.length;
    const confirmedFromContacts = allContacts.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed').length;
    const dispatchesCount = Math.max(confirmedFromContacts, allMessages.length);

    const kpiCoords = container.querySelector('#adm-kpi-coordinators');
    const kpiTeams = container.querySelector('#adm-kpi-teams');
    const kpiContacts = container.querySelector('#adm-kpi-contacts');
    const kpiDispatches = container.querySelector('#adm-kpi-dispatches');

    if (kpiCoords) kpiCoords.textContent = coordsCount;
    if (kpiTeams) kpiTeams.textContent = teamsCount;
    if (kpiContacts) kpiContacts.textContent = contactsCount;
    if (kpiDispatches) kpiDispatches.textContent = dispatchesCount;
  }

  function renderTabContent() {
    const contentEl = container.querySelector('#admin-tab-content');
    if (!contentEl) return;

    if (currentTab === 'teams') {
      contentEl.innerHTML = `
        <div class="main-panel-card">
          <!-- Desktop Table -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>NOME DA EQUIPE</th>
                  <th>COORDENADOR RESPONSÁVEL</th>
                  <th>MEMBROS</th>
                  <th>STATUS</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                ${allTeams.length === 0 ? `
                  <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma equipe cadastrada ainda. Clique em <strong>+ Nova Equipe</strong> acima.</td></tr>
                ` : allTeams.map(t => {
                  const initials = t.name ? t.name.substring(0, 2).toUpperCase() : 'EQ';
                  return `
                    <tr>
                      <td>
                        <div class="user-identity-cell">
                          <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8;">${initials}</div>
                          <div>
                            <span class="user-identity-name">${t.name}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">ID: ${t.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.72rem;">LÍDER</span>
                        <strong style="color: var(--text-main); margin-left: 0.35rem;">${t.coordinator_name || 'Coordenador Vinculado'}</strong>
                      </td>
                      <td style="color: var(--text-muted); font-size: 0.85rem;">Equipe Ativa</td>
                      <td><span class="status-pill ativo">OPERACIONAL</span></td>
                      <td style="text-align: right;">
                        <button class="btn-manage-team-view btn-primary-blue" data-team="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                          Ver Painel
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Smartphone Mobile Cards -->
          <div class="team-mobile-card-list mobile-only" style="padding: 1rem;">
            ${allTeams.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">Nenhuma equipe cadastrada ainda.</div>
            ` : allTeams.map(t => {
              const initials = t.name ? t.name.substring(0, 2).toUpperCase() : 'EQ';
              return `
                <div class="team-mobile-card">
                  <div class="team-mobile-card-header">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8; width: 38px; height: 38px; font-size: 0.88rem;">${initials}</div>
                      <div>
                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${t.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">👔 Líder: ${t.coordinator_name || 'Não vinculado'}</div>
                      </div>
                    </div>
                    <span class="status-pill ativo">ATIVO</span>
                  </div>
                  <div class="team-mobile-card-footer">
                    <button class="btn-manage-team-view btn-primary-blue" data-team="${t.id}" style="width: 100%; font-size: 0.82rem; padding: 0.5rem; font-weight: 600; justify-content: center; border-radius: var(--radius-md);">
                      📊 Ver Painel da Equipe
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      contentEl.querySelectorAll('.btn-manage-team-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const teamId = btn.getAttribute('data-team');
          onNavigate('manager', teamId);
        });
      });
    } else if (currentTab === 'users') {
      const validUsers = allUsers.filter(u => u.email || u.name);

      contentEl.innerHTML = `
        <div class="main-panel-card">
          <!-- Desktop Table -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>USUÁRIO</th>
                  <th>CARGO ATUAL</th>
                  <th>EQUIPE</th>
                  <th>STATUS</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                ${validUsers.length === 0 ? `
                  <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum usuário cadastrado.</td></tr>
                ` : validUsers.map(u => {
                  const initials = ((u.name || u.email || 'U')).substring(0, 2).toUpperCase();
                  const isActive = u.is_active !== false;
                  const isSuperAdmin = (u.email || '').toLowerCase() === 'thiagoddsm@gmail.com';
                  const currentRole = isSuperAdmin ? 'admin' : (u.role || 'member');

                  const roleLabel = currentRole === 'admin' 
                    ? '👑 Administrador' 
                    : currentRole === 'coordinator' 
                    ? '👔 Coordenador' 
                    : '🎯 Membro da Equipe';

                  const roleBadgeBg = currentRole === 'admin' 
                    ? '#FEE2E2' 
                    : currentRole === 'coordinator' 
                    ? '#EFF6FF' 
                    : '#F1F5F9';

                  const roleBadgeColor = currentRole === 'admin' 
                    ? '#DC2626' 
                    : currentRole === 'coordinator' 
                    ? '#1D4ED8' 
                    : '#64748B';

                  return `
                    <tr>
                      <td>
                        <div class="user-identity-cell">
                          <div class="user-identity-initials" style="background: ${roleBadgeBg}; color: ${roleBadgeColor};">${initials}</div>
                          <div>
                            <span class="user-identity-name">${u.name || u.email.split('@')[0]}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button class="btn-open-role-modal btn-outline-white" data-uid="${u.uid}" data-name="${u.name || u.email}" data-role="${currentRole}" style="font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.75rem; display: flex; align-items: center; gap: 6px; background: ${roleBadgeBg}; color: ${roleBadgeColor}; border-color: transparent; border-radius: var(--radius-md);">
                          <span>${roleLabel}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                      </td>
                      <td>
                        <select class="user-team-select form-control" data-uid="${u.uid}" style="padding: 0.3rem 0.55rem; font-size: 0.8rem; font-weight: 600; border-radius: var(--radius-sm); max-width: 170px; background: #FFFFFF;">
                          <option value="" ${!u.team_id ? 'selected' : ''}>🌐 Global / Sem Equipe</option>
                          ${allTeams.map(t => `
                            <option value="${t.id}" ${u.team_id === t.id ? 'selected' : ''}>👥 ${t.name}</option>
                          `).join('')}
                        </select>
                      </td>
                      <td>
                        <span class="status-pill ${isActive ? 'ativo' : 'inativo'}">
                          ${isActive ? 'ATIVO' : 'DESATIVADO'}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                          <button class="btn-toggle-active btn-outline-white" data-uid="${u.uid}" data-active="${isActive}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                            ${isActive ? 'Desativar' : 'Ativar'}
                          </button>
                          ${!isSuperAdmin ? `
                            <button class="btn-delete-user" data-uid="${u.uid}" data-name="${u.name || u.email}" style="background: none; border: none; cursor: pointer; color: #EF4444; padding: 4px;" title="Excluir Usuário">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Smartphone Mobile Cards for Users -->
          <div class="team-mobile-card-list mobile-only" style="padding: 1rem;">
            ${validUsers.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">Nenhum usuário cadastrado.</div>
            ` : validUsers.map(u => {
              const initials = ((u.name || u.email || 'U')).substring(0, 2).toUpperCase();
              const isActive = u.is_active !== false;
              const isSuperAdmin = (u.email || '').toLowerCase() === 'thiagoddsm@gmail.com';
              const currentRole = isSuperAdmin ? 'admin' : (u.role || 'member');

              const roleLabel = currentRole === 'admin' 
                ? '👑 Administrador' 
                : currentRole === 'coordinator' 
                ? '👔 Coordenador' 
                : '🎯 Membro';

              return `
                <div class="team-mobile-card">
                  <div class="team-mobile-card-header">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8; width: 38px; height: 38px; font-size: 0.88rem;">${initials}</div>
                      <div>
                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${u.name || u.email.split('@')[0]}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${u.email || ''}</div>
                      </div>
                    </div>
                    <span class="status-pill ${isActive ? 'ativo' : 'inativo'}">${isActive ? 'ATIVO' : 'DESATIVADO'}</span>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem;">
                    <div>
                      <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 2px;">Cargo:</label>
                      <button class="btn-open-role-modal btn-outline-white" data-uid="${u.uid}" data-name="${u.name || u.email}" data-role="${currentRole}" style="width: 100%; font-size: 0.78rem; font-weight: 700; padding: 0.35rem 0.5rem; justify-content: center;">
                        ${roleLabel} ▾
                      </button>
                    </div>
                    <div>
                      <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 2px;">Equipe:</label>
                      <select class="user-team-select form-control" data-uid="${u.uid}" style="padding: 0.35rem 0.5rem; font-size: 0.78rem; font-weight: 600;">
                        <option value="" ${!u.team_id ? 'selected' : ''}>Sem Equipe</option>
                        ${allTeams.map(t => `
                          <option value="${t.id}" ${u.team_id === t.id ? 'selected' : ''}>${t.name}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>

                  <div class="team-mobile-card-footer" style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="btn-toggle-active btn-outline-white" data-uid="${u.uid}" data-active="${isActive}" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
                      ${isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    ${!isSuperAdmin ? `
                      <button class="btn-delete-user" data-uid="${u.uid}" data-name="${u.name || u.email}" style="background: #FEE2E2; border: 1px solid #FECACA; border-radius: var(--radius-sm); cursor: pointer; color: #DC2626; padding: 0.35rem 0.65rem; font-size: 0.78rem;" title="Excluir Usuário">
                        Excluir
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Seletor de Equipe do Usuário
      contentEl.querySelectorAll('.user-team-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          const uid = sel.getAttribute('data-uid');
          const newTeamId = sel.value;
          const selectedOption = sel.options[sel.selectedIndex];
          const newTeamName = newTeamId ? (selectedOption.text || '').replace(/^👥\s*/, '').trim() : null;
          sel.disabled = true;
          try {
            await updateUserTeam(uid, newTeamId, newTeamName);
            await recordSystemAuditLog({
              actor_uid: currentUser.uid,
              actor_name: currentUser.name,
              action: newTeamId ? 'user_assigned_team' : 'user_removed_team',
              target_id: uid,
              metadata: { team_id: newTeamId, team_name: newTeamName }
            });
          } catch (e) {
            console.warn('Erro ao atualizar equipe:', e);
          } finally {
            sel.disabled = false;
          }
        });
      });

      // Modal de Alteração de Cargo
      contentEl.querySelectorAll('.btn-open-role-modal').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const name = btn.getAttribute('data-name');
          container.querySelector('#modal-target-user-uid').value = uid;
          container.querySelector('#modal-change-role-username').textContent = `Definir novo cargo para: ${name}`;
          container.querySelector('#modal-change-role').style.display = 'flex';
        });
      });

      contentEl.querySelectorAll('.btn-toggle-active').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-uid');
          const active = btn.getAttribute('data-active') === 'true';
          btn.disabled = true;
          await toggleUserActiveStatus(uid, !active);
        });
      });

      contentEl.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-uid');
          const name = btn.getAttribute('data-name');
          if (confirm(`Deseja realmente excluir o usuário "${name}"?`)) {
            await deleteUserFromFirestore(uid);
          }
        });
      });
    } else if (currentTab === 'audit') {
      contentEl.innerHTML = `
        <div class="main-panel-card">
          <div class="table-container">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>DATA / HORA</th>
                  <th>EXECUTADO POR</th>
                  <th>AÇÃO</th>
                  <th>DETALHES</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.length === 0 ? `
                  <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum registro de auditoria no momento.</td></tr>
                ` : auditLogs.map(l => {
                  const dateStr = l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
                  return `
                    <tr>
                      <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
                      <td style="font-weight: 600;">${l.actor_name || l.actor_uid}</td>
                      <td><span class="pill-btn" style="background: #F1F5F9; color: #1D4ED8; font-family: monospace; font-size: 0.75rem;">${l.action}</span></td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${JSON.stringify(l.metadata || {})}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // Modal Alterar Cargo Listeners
  const roleModal = container.querySelector('#modal-change-role');
  container.querySelector('#btn-close-role-modal')?.addEventListener('click', () => { roleModal.style.display = 'none'; });

  container.querySelectorAll('.btn-select-role-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const role = opt.getAttribute('data-role');
      const uid = container.querySelector('#modal-target-user-uid').value;
      if (!uid) return;

      roleModal.style.display = 'none';
      try {
        await updateUserRole(uid, role);
      } catch (err) {
        console.warn('Erro ao atualizar cargo:', err);
      }
    });
  });

  // Subscriptions
  let isPromotingThiago = false;
  const unsubUsers = subscribeToAllUsers((users) => {
    allUsers = users.filter(u => u && (u.email || u.name));
    
    // Auto-promove thiagoddsm@gmail.com para admin uma única vez se necessário
    const thiagoUser = allUsers.find(u => u.email && u.email.toLowerCase() === 'thiagoddsm@gmail.com');
    if (thiagoUser && thiagoUser.role !== 'admin' && !isPromotingThiago) {
      isPromotingThiago = true;
      thiagoUser.role = 'admin';
      updateDoc(doc(db, 'users', thiagoUser.uid), { role: 'admin' }).catch(() => {});
    }

    updateKpis();
    renderTabContent();
    updateCoordinatorSelect();
  });

  const unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
    allTeams = teams;
    updateKpis();
    renderTabContent();
  });

  const unsubContacts = subscribeToAllContacts((contacts) => {
    allContacts = contacts;
    updateKpis();
  });

  const unsubAudit = subscribeToSystemAuditLogs(DEFAULT_TENANT_ID, (logs) => {
    auditLogs = logs;
    if (currentTab === 'audit') renderTabContent();
  });

  const unsubMessages = subscribeToMessagesHistory(null, (msgs) => {
    allMessages = msgs;
    updateKpis();
  });

  function updateCoordinatorSelect() {
    const sel = container.querySelector('#select-team-coord');
    if (!sel) return;

    let coords = allUsers.filter(u => u.role === 'coordinator' || u.role === 'admin' || (u.email && u.email.toLowerCase() === 'thiagoddsm@gmail.com'));
    
    if (coords.length === 0) {
      coords = allUsers.length > 0 ? allUsers : [{ uid: currentUser.uid, name: currentUser.name || currentUser.email, role: 'admin' }];
    }

    sel.innerHTML = coords.map((c, i) => `
      <option value="${c.uid}" data-name="${c.name || c.email}" ${i === 0 ? 'selected' : ''}>
        ${c.name || c.email} (${c.role === 'admin' ? 'Administrador' : 'Coordenador'})
      </option>
    `).join('');
  }

  function switchTab(tabName) {
    currentTab = tabName;
    ['teams', 'users', 'audit'].forEach(t => {
      const btn = container.querySelector(`#tab-btn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.style.borderBottom = '2px solid var(--primary-blue)';
          btn.style.color = 'var(--primary-blue)';
        } else {
          btn.style.borderBottom = '2px solid transparent';
          btn.style.color = 'var(--text-muted)';
        }
      }
    });
    renderTabContent();
  }

  // Tabs Listeners
  container.querySelector('#tab-btn-teams')?.addEventListener('click', () => switchTab('teams'));
  container.querySelector('#tab-btn-users')?.addEventListener('click', () => switchTab('users'));
  container.querySelector('#tab-btn-audit')?.addEventListener('click', () => switchTab('audit'));

  // Modal Nova Equipe
  const teamModal = container.querySelector('#modal-new-team');
  container.querySelector('#btn-admin-new-team')?.addEventListener('click', () => {
    updateCoordinatorSelect();
    teamModal.style.display = 'flex';
  });
  container.querySelector('#btn-close-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });

  container.querySelector('#form-new-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-team-name').value.trim();
    const coordSel = container.querySelector('#select-team-coord');
    const coordUid = coordSel.value;
    const coordName = coordSel.options[coordSel.selectedIndex]?.getAttribute('data-name') || 'Coordenador';

    if (!coordUid) {
      alert('Por favor, selecione um Coordenador Líder.');
      return;
    }

    const saveBtn = container.querySelector('#btn-save-team-submit');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Criando...';

    try {
      await createTeamInFirestore({ name, coordinatorUid: coordUid, coordinatorName: coordName });
      await recordSystemAuditLog({
        actor_uid: currentUser.uid,
        actor_name: currentUser.name,
        action: 'team_created',
        metadata: { team_name: name, coordinator: coordName }
      });
      teamModal.style.display = 'none';
      container.querySelector('#form-new-team').reset();
      switchTab('teams');
    } catch (err) {
      console.warn('Erro ao criar equipe:', err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Criar Equipe';
    }
  });

  // Modal Novo Coordenador
  const coordModal = container.querySelector('#modal-new-coord');
  container.querySelector('#btn-admin-new-coord')?.addEventListener('click', () => { coordModal.style.display = 'flex'; });
  container.querySelector('#btn-close-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });

  container.querySelector('#form-new-coord')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-coord-name').value.trim();
    const email = container.querySelector('#input-coord-email').value.trim();

    const saveBtn = container.querySelector('#btn-save-coord-submit');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Cadastrando...';

    try {
      await createUserProfileDirectly({
        email,
        name,
        role: 'coordinator',
        teamId: 'team_alpha'
      });
      await recordSystemAuditLog({
        actor_uid: currentUser.uid,
        actor_name: currentUser.name,
        action: 'user_created',
        metadata: { role: 'coordinator', email }
      });
      coordModal.style.display = 'none';
      container.querySelector('#form-new-coord').reset();
    } catch (err) {
      console.warn('Erro ao registrar coordenador:', err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cadastrar Coordenador';
    }
  });

  return () => {
    unsubUsers();
    unsubTeams();
    unsubContacts();
    unsubAudit();
    if (unsubMessages) unsubMessages();
  };
}
