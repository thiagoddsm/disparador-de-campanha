import { 
  subscribeToOperatorContacts, 
  subscribeToTeamContacts, 
  subscribeToAllContacts, 
  subscribeToTenantTeams,
  subscribeToAllUsers,
  subscribeToTeamMembers,
  saveContactsBatch, 
  reassignContactInFirestore,
  DEFAULT_TENANT_ID
} from '../firebase/realtime.js';
import { showToast } from '../utils/feedback.js';

export function renderContactsView(container, currentUser, onNavigate) {
  let allContacts = [];
  let allTeams = [];
  let allUsers = [];
  let teamMembers = [];
  
  // Filtros ativos
  let selectedCoordUid = 'all'; // 'all' | coordinatorUid (para Admin)
  let selectedMemberUid = 'all'; // 'all' | memberUid (para Admin e Coordinator)
  let statusFilter = 'all'; // 'all' | 'pending' | 'opened' | 'confirmed'
  let searchQuery = '';

  const isMember = currentUser?.role === 'member';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isAdmin = currentUser?.role === 'admin';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : '');

  container.innerHTML = `
    <div class="page-content">
      <!-- Title & Actions Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">
              ${isMember ? 'Meus Contatos' : isCoordinator ? 'Banco de Contatos da Equipe' : 'Banco Global de Contatos'}
            </h2>
            ${currentUser?.team_id ? `
              <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem;">
                👥 Equipe: <strong class="current-user-team-name">${currentUser?.team_name || 'Minha Equipe'}</strong>
              </span>
            ` : ''}
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            ${isMember 
              ? 'Visualize sua lista individual de contatos para envio e acompanhe o status de cada um.' 
              : isCoordinator 
              ? 'Acompanhe a base de contatos dividida por cada Líder/Membro da sua equipe em abas dedicadas.' 
              : 'Supervisão hierárquica: navegue entre Coordenadores e acompanhe a distribuição por Líder.'}
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          ${!isMember ? `
            <button id="btn-goto-import" class="btn-outline-white">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
              </svg>
              Importar CSV
            </button>
          ` : ''}

          <button id="btn-open-add-contact" class="btn-green-action">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Adicionar Contato
          </button>
        </div>
      </div>

      <!-- Quick Switcher: Minha Base Pessoal vs Visão Geral -->
      ${!isMember ? `
        <div style="display: flex; gap: 0.6rem; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap;">
          <button id="btn-quick-my-contacts" class="pill-btn" style="cursor: pointer; padding: 0.55rem 1.15rem; font-size: 0.85rem; font-weight: 700; border-radius: var(--radius-md); transition: all 0.2s; background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.5rem;">
            <span>⭐ Minha Base Pessoal</span>
            <span id="quick-my-contacts-count" style="background: #E5E7EB; color: var(--text-main); padding: 2px 7px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700;">0</span>
          </button>
          
          <button id="btn-quick-all-contacts" class="pill-btn" style="cursor: pointer; padding: 0.55rem 1.15rem; font-size: 0.85rem; font-weight: 700; border-radius: var(--radius-md); transition: all 0.2s; background: #1D4ED8; color: #FFFFFF; border: 1.5px solid #1D4ED8; display: flex; align-items: center; gap: 0.5rem;">
            <span>🌐 ${isAdmin ? 'Visão Geral da Campanha' : 'Visão Geral da Equipe'}</span>
            <span id="quick-all-contacts-count" style="background: rgba(255,255,255,0.25); color: #FFFFFF; padding: 2px 7px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700;">0</span>
          </button>
        </div>
      ` : ''}

      <!-- Level 1 Tabs (Admin: Coordenadores) -->
      ${isAdmin ? `
        <div id="admin-coord-section" style="margin-bottom: 1rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px;">
            👔 Coordenadores / Equipes:
          </div>
          <div id="admin-coord-tabs" style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.4rem; scrollbar-width: thin;">
            <!-- Renderizado dinamicamente -->
          </div>
        </div>
      ` : ''}

      <!-- Level 2 Tabs (Admin & Coordinator: Líderes / Membros da Equipe) -->
      ${!isMember ? `
        <div id="admin-leader-section" style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px;">
            👤 Acompanhar por Líder / Membro:
          </div>
          <div id="leader-tabs-mount" style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.4rem; scrollbar-width: thin;">
            <!-- Renderizado dinamicamente -->
          </div>
        </div>
      ` : ''}

      <!-- 3 Dynamic KPI Cards -->
      <div class="metrics-row" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 1.5rem;">
        <div class="metric-box">
          <div class="metric-info">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--primary-blue); font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"></rect></svg>
              <span>Total na Seleção</span>
            </div>
            <span class="metric-big-num" id="kpi-contacts-total">0</span>
            <span style="font-size: 0.78rem; color: var(--whatsapp-green); font-weight: 600; margin-top: 0.4rem;" id="kpi-contacts-sublabel">
              Contatos mapeados
            </span>
          </div>
          <div class="metric-icon-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          </div>
        </div>

        <div class="metric-box">
          <div class="metric-info">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--whatsapp-green); font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Disparos Confirmados</span>
            </div>
            <span class="metric-big-num" id="kpi-contacts-sent">0</span>
            <span style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.4rem;">
              Envios confirmados
            </span>
          </div>
          <div class="metric-icon-bubble" style="background: #F0FDF4; color: var(--whatsapp-green);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>

        <div class="metric-box">
          <div class="metric-info" style="width: 100%;">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: #B45309; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Taxa de Conclusão</span>
            </div>
            <span class="metric-big-num" id="kpi-contacts-rate">0%</span>
            <div class="table-progress-track" style="margin-top: 0.75rem; height: 5px;">
              <div class="table-progress-bar" id="kpi-contacts-prog-bar" style="width: 0%; background: #1D4ED8;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contacts Table Panel -->
      <div class="main-panel-card">
        <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 1rem;">
          <div style="position: relative; width: 320px; max-width: 100%;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="contacts-search" class="topbar-search-input" placeholder="Buscar por nome ou telefone..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.3rem; background: #FFFFFF; font-size: 0.82rem;">
          </div>

          <div style="display: flex; gap: 0.5rem;" id="status-filter-buttons">
            <button class="status-btn pill-btn" data-status="all" style="cursor: pointer; padding: 0.45rem 0.85rem; font-size: 0.8rem; font-weight: 700; background: #1D4ED8; color: #FFFFFF; border: none;">Todos</button>
            <button class="status-btn pill-btn" data-status="pending" style="cursor: pointer; padding: 0.45rem 0.85rem; font-size: 0.8rem; font-weight: 600; background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);">Pendentes</button>
            <button class="status-btn pill-btn" data-status="opened" style="cursor: pointer; padding: 0.45rem 0.85rem; font-size: 0.8rem; font-weight: 600; background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);">Abertos</button>
            <button class="status-btn pill-btn" data-status="confirmed" style="cursor: pointer; padding: 0.45rem 0.85rem; font-size: 0.8rem; font-weight: 600; background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);">Confirmados</button>
          </div>
        </div>

        <!-- Tabela Desktop -->
        <div class="table-container desktop-only">
          <table class="panel-table">
            <thead>
              <tr>
                <th>NOME</th>
                <th>TELEFONE</th>
                <th>CIDADE / REGIÃO</th>
                ${!isMember ? '<th>LÍDER ATRIBUÍDO</th>' : ''}
                <th>STATUS</th>
                ${!isMember ? '<th style="text-align: right;">AÇÕES</th>' : ''}
              </tr>
            </thead>
            <tbody id="contacts-tbody">
              <tr><td colspan="${isMember ? 4 : 6}" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando contatos...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Lista Mobile Estilo WhatsApp -->
        <div class="mobile-only" id="contacts-mobile-list" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem;">
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">Carregando contatos...</div>
        </div>

        <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
          <span id="contacts-count-label">Mostrando 0 contatos</span>
        </div>
      </div>
    </div>

    <!-- Modal Adicionar Contato -->
    <div id="add-contact-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 480px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Adicionar Contato</h3>
          <button id="btn-close-contact-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="add-contact-form" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Nome Completo</label>
            <input type="text" id="input-contact-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: Roberto Carlos" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Telefone / WhatsApp</label>
            <input type="tel" inputmode="tel" id="input-contact-phone" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="(11) 98765-4321" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Cidade / Região</label>
            <input type="text" id="input-contact-company" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: Bairro Centro">
          </div>
          ${!isMember ? `
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Atribuir para Líder / Membro</label>
              <select id="select-contact-assignee" class="form-control"></select>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-contact-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-contact-submit" class="btn-green-action">Salvar Contato</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Reatribuir Contato -->
    <div id="modal-reassign" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 400px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Reatribuir Contato</h3>
          <button id="btn-close-reassign" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-reassign" style="padding: 1.5rem;">
          <input type="hidden" id="reassign-contact-id">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Transferir para o Líder / Membro:</label>
            <select id="select-reassign-member" class="form-control" required></select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-reassign" class="btn-outline-white">Cancelar</button>
            <button type="submit" class="btn-primary-blue">Confirmar Transferência</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Renderiza as abas de Coordenador (Nível 1 para Admin)
  function renderAdminCoordinatorTabs() {
    const mount = container.querySelector('#admin-coord-tabs');
    if (!mount) return;

    const coords = allUsers.filter(u => u.role === 'coordinator' || u.role === 'admin');
    
    // Contagem de contatos por coordenador
    const totalAll = allContacts.length;
    const myPersonalCount = allContacts.filter(c => c.assigned_to === currentUser.uid).length;

    let html = `
      <button class="pill-btn admin-coord-pill" data-coord-uid="mine" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${selectedMemberUid === currentUser.uid ? 'background: #059669; color: #FFFFFF; border: none;' : 'background: #ECFDF5; color: #059669; border: 1.5px solid #10B981;'}">
        ⭐ Minha Base Pessoal (${myPersonalCount})
      </button>
      <button class="pill-btn admin-coord-pill" data-coord-uid="all" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${(selectedCoordUid === 'all' && selectedMemberUid !== currentUser.uid) ? 'background: #1D4ED8; color: #FFFFFF; border: none;' : 'background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);'}">
        🌐 Todos os Coordenadores (${totalAll})
      </button>
    `;

    coords.forEach(coord => {
      const coordTeam = allTeams.find(t => t.id === coord.team_id || t.coordinator_uid === coord.uid);
      const coordTeamId = coordTeam ? coordTeam.id : coord.team_id;
      const count = allContacts.filter(c => c.team_id === coordTeamId || c.assigned_to === coord.uid).length;
      const isActive = selectedCoordUid === coord.uid && selectedMemberUid !== currentUser.uid;

      html += `
        <button class="pill-btn admin-coord-pill" data-coord-uid="${coord.uid}" data-team-id="${coordTeamId || ''}" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${isActive ? 'background: #1D4ED8; color: #FFFFFF; border: none;' : 'background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);'}">
          👔 ${coord.name || coord.email} ${coordTeam ? `(${coordTeam.name})` : ''} (${count})
        </button>
      `;
    });

    mount.innerHTML = html;

    mount.querySelectorAll('.admin-coord-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const uidVal = btn.getAttribute('data-coord-uid');
        if (uidVal === 'mine') {
          selectedCoordUid = 'all';
          selectedMemberUid = currentUser.uid;
        } else {
          selectedCoordUid = uidVal;
          selectedMemberUid = 'all'; // Reseta seleção de líder ao mudar coordenador
        }
        updateQuickSwitcherUI();
        renderAdminCoordinatorTabs();
        renderLeaderTabs();
        applyFiltersAndRender();
      });
    });
  }

  // Renderiza as abas de Líderes/Membros da Equipe
  function renderLeaderTabs() {
    const mount = container.querySelector('#leader-tabs-mount');
    if (!mount) return;

    let relevantContacts = allContacts;
    let relevantMembers = [];

    if (isAdmin) {
      if (selectedCoordUid !== 'all') {
        const coord = allUsers.find(u => u.uid === selectedCoordUid);
        const coordTeam = allTeams.find(t => t.id === coord?.team_id || t.coordinator_uid === selectedCoordUid);
        const coordTeamId = coordTeam ? coordTeam.id : coord?.team_id;
        
        relevantContacts = allContacts.filter(c => c.team_id === coordTeamId || c.assigned_to === selectedCoordUid);
        relevantMembers = allUsers.filter(u => (u.team_id && u.team_id === coordTeamId) || u.coordinator_id === selectedCoordUid || u.uid === selectedCoordUid);
      } else {
        relevantMembers = allUsers.filter(u => u.role === 'member');
      }
    } else if (isCoordinator) {
      relevantContacts = allContacts;
      relevantMembers = teamMembers.length > 0 ? teamMembers : allUsers.filter(u => u.team_id === currentUser.team_id || u.coordinator_id === currentUser.uid);
    }

    const totalCount = relevantContacts.length;
    const myCount = allContacts.filter(c => c.assigned_to === currentUser.uid).length;
    const isMyActive = selectedMemberUid === currentUser.uid;

    let html = `
      <button class="pill-btn leader-pill" data-member-uid="all" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${(selectedMemberUid === 'all') ? 'background: #059669; color: #FFFFFF; border: none;' : 'background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);'}">
        👥 Todos os Líderes (${totalCount})
      </button>
      <button class="pill-btn leader-pill" data-member-uid="${currentUser.uid}" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${isMyActive ? 'background: #059669; color: #FFFFFF; border: none;' : 'background: #ECFDF5; color: #059669; border: 1.5px solid #10B981;'}">
        ⭐ Atribuídos a Mim (${myCount})
      </button>
    `;

    relevantMembers.filter(m => m.uid !== currentUser.uid).forEach(m => {
      const memberContacts = relevantContacts.filter(c => c.assigned_to === m.uid);
      const isActive = selectedMemberUid === m.uid;

      html += `
        <button class="pill-btn leader-pill" data-member-uid="${m.uid}" style="cursor: pointer; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-full); transition: all 0.2s; white-space: nowrap; ${isActive ? 'background: #059669; color: #FFFFFF; border: none;' : 'background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color);'}">
          👤 ${m.name || m.email} (${memberContacts.length})
        </button>
      `;
    });

    mount.innerHTML = html;

    mount.querySelectorAll('.leader-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMemberUid = btn.getAttribute('data-member-uid');
        updateQuickSwitcherUI();
        renderLeaderTabs();
        if (isAdmin) renderAdminCoordinatorTabs();
        applyFiltersAndRender();
      });
    });
  }

  // Atualiza botões superiores Minha Base vs Base Geral
  function updateQuickSwitcherUI() {
    const btnMy = container.querySelector('#btn-quick-my-contacts');
    const btnAll = container.querySelector('#btn-quick-all-contacts');
    const myBadge = container.querySelector('#quick-my-contacts-count');
    const allBadge = container.querySelector('#quick-all-contacts-count');

    const myCount = allContacts.filter(c => c.assigned_to === currentUser.uid).length;
    const allCount = allContacts.length;

    if (myBadge) myBadge.textContent = myCount;
    if (allBadge) allBadge.textContent = allCount;

    if (selectedMemberUid === currentUser.uid) {
      if (btnMy) {
        btnMy.style.background = '#1D4ED8';
        btnMy.style.color = '#FFFFFF';
        btnMy.style.borderColor = '#1D4ED8';
        if (myBadge) { myBadge.style.background = 'rgba(255,255,255,0.3)'; myBadge.style.color = '#FFFFFF'; }
      }
      if (btnAll) {
        btnAll.style.background = '#FFFFFF';
        btnAll.style.color = 'var(--text-main)';
        btnAll.style.borderColor = 'var(--border-color)';
        if (allBadge) { allBadge.style.background = '#E5E7EB'; allBadge.style.color = 'var(--text-main)'; }
      }
    } else {
      if (btnAll) {
        btnAll.style.background = '#1D4ED8';
        btnAll.style.color = '#FFFFFF';
        btnAll.style.borderColor = '#1D4ED8';
        if (allBadge) { allBadge.style.background = 'rgba(255,255,255,0.3)'; allBadge.style.color = '#FFFFFF'; }
      }
      if (btnMy) {
        btnMy.style.background = '#FFFFFF';
        btnMy.style.color = 'var(--text-main)';
        btnMy.style.borderColor = 'var(--border-color)';
        if (myBadge) { myBadge.style.background = '#E5E7EB'; myBadge.style.color = 'var(--text-main)'; }
      }
    }
  }

  // Listeners dos botões superiores rápidos
  container.querySelector('#btn-quick-my-contacts')?.addEventListener('click', () => {
    selectedCoordUid = 'all';
    selectedMemberUid = currentUser.uid;
    updateQuickSwitcherUI();
    if (isAdmin) renderAdminCoordinatorTabs();
    renderLeaderTabs();
    applyFiltersAndRender();
  });

  container.querySelector('#btn-quick-all-contacts')?.addEventListener('click', () => {
    selectedCoordUid = 'all';
    selectedMemberUid = 'all';
    updateQuickSwitcherUI();
    if (isAdmin) renderAdminCoordinatorTabs();
    renderLeaderTabs();
    applyFiltersAndRender();
  });

  // Atualiza selects de atribuição nos modais
  function updateAssigneesSelect() {
    const assignSel = container.querySelector('#select-contact-assignee');
    const reassignSel = container.querySelector('#select-reassign-member');
    const available = teamMembers.length > 0 ? teamMembers : allUsers.filter(u => u.role === 'member' || u.role === 'coordinator');

    const options = [
      `<option value="${currentUser.uid}" selected>⭐ Atribuir a Mim Mesmo (${currentUser.name || currentUser.email})</option>`,
      ...available.filter(m => m.uid !== currentUser.uid).map(m => `<option value="${m.uid}">👤 ${m.name || m.email} (${m.email || ''})</option>`)
    ].join('');

    if (assignSel) assignSel.innerHTML = options;
    if (reassignSel) reassignSel.innerHTML = options;
  }

  // Aplica filtros e renderiza tabela e KPIs
  function applyFiltersAndRender() {
    updateQuickSwitcherUI();
    updateAssigneesSelect();
    let filtered = [...allContacts];

    // Filtro por Coordenador / Equipe (Admin)
    if (isAdmin && selectedCoordUid !== 'all') {
      const coord = allUsers.find(u => u.uid === selectedCoordUid);
      const coordTeam = allTeams.find(t => t.id === coord?.team_id || t.coordinator_uid === selectedCoordUid);
      const coordTeamId = coordTeam ? coordTeam.id : coord?.team_id;
      filtered = filtered.filter(c => c.team_id === coordTeamId || c.assigned_to === selectedCoordUid);
    }

    // Filtro por Líder / Membro
    if (selectedMemberUid !== 'all') {
      filtered = filtered.filter(c => c.assigned_to === selectedMemberUid);
    }

    // Filtro de Busca por texto
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.assigned_to_name && c.assigned_to_name.toLowerCase().includes(q))
      );
    }

    // Filtro por Status
    if (statusFilter !== 'all') {
      if (statusFilter === 'confirmed') {
        filtered = filtered.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed');
      } else {
        filtered = filtered.filter(c => c.status === statusFilter);
      }
    }

    renderTable(filtered);
  }

  function renderTable(list) {
    const tbody = container.querySelector('#contacts-tbody');
    const totalEl = container.querySelector('#kpi-contacts-total');
    const sentEl = container.querySelector('#kpi-contacts-sent');
    const rateEl = container.querySelector('#kpi-contacts-rate');
    const progBar = container.querySelector('#kpi-contacts-prog-bar');
    const countLabel = container.querySelector('#contacts-count-label');

    if (!tbody) return;

    const total = list.length;
    const confirmedCount = list.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed').length;
    const openedCount = list.filter(c => c.status === 'opened').length;
    const rate = total > 0 ? Math.min(100, Math.round(((confirmedCount + openedCount) / total) * 100)) : 0;

    if (totalEl) totalEl.textContent = total;
    if (sentEl) sentEl.textContent = confirmedCount;
    if (rateEl) rateEl.textContent = `${rate}%`;
    if (progBar) progBar.style.width = `${rate}%`;
    if (countLabel) countLabel.textContent = `Mostrando ${list.length} contato(s) nesta seleção`;

    const mobileList = container.querySelector('#contacts-mobile-list');

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${isMember ? 4 : 6}" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            Nenhum contato encontrado nesta aba ou filtro. Clique em <strong>Adicionar Contato</strong> ou selecione outra aba.
          </td>
        </tr>
      `;
      if (mobileList) {
        mobileList.innerHTML = `
          <div style="text-align: center; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 2rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.4rem;">👥</div>
            <strong>Nenhum contato encontrado.</strong>
            <p style="font-size: 0.8rem; margin-top: 0.25rem;">Toque no botão verde acima para adicionar uma pessoa.</p>
          </div>
        `;
      }
      return;
    }

    tbody.innerHTML = list.map(c => {
      const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
      const isOpened = c.status === 'opened';
      const initials = (c.name || 'C').substring(0, 2).toUpperCase();

      const statusBadge = isConfirmed
        ? '<span class="status-pill ativo">CONFIRMADO</span>'
        : isOpened
        ? '<span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.72rem;">ABERTO (WA)</span>'
        : '<span class="status-pill inativo">PENDENTE</span>';

      return `
        <tr>
          <td>
            <div class="user-identity-cell">
              <div class="user-identity-initials">${initials}</div>
              <span class="user-identity-name">${c.name}</span>
            </div>
          </td>
          <td style="font-family: monospace; color: var(--text-muted); font-size: 0.85rem;">${c.phone}</td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${c.city || c.company || '—'}</td>
          ${!isMember ? `
            <td style="font-size: 0.82rem; color: var(--text-main); font-weight: 600;">
              👤 ${c.assigned_to_name || (c.assigned_to === currentUser.uid ? 'Você' : 'Não Atribuído')}
            </td>
          ` : ''}
          <td>${statusBadge}</td>
          ${!isMember ? `
            <td style="text-align: right;">
              <button class="btn-reassign-action btn-outline-white" data-id="${c.id}" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
                Reatribuir
              </button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    if (mobileList) {
      mobileList.innerHTML = `
        <!-- WhatsApp Sub-Tabs Bar (Matching Image 3) -->
        <div style="background: #008069; color: #FFFFFF; display: flex; align-items: center; border-bottom: 2px solid rgba(0,0,0,0.1); margin: -1rem -1rem 1rem -1rem; padding: 0 0.5rem;">
          <div style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.7); display: flex; align-items: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div style="flex: 1; text-align: center; padding: 0.75rem 0.5rem; color: #FFFFFF; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; border-bottom: 3px solid #FFFFFF; letter-spacing: 0.5px;">
            CONVERSAS
          </div>
        </div>

        <div style="display: flex; flex-direction: column; background: #FFFFFF;">
          ${list.map(c => {
            const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
            const isOpened = c.status === 'opened';

            return `
              <div class="wa-contact-item-row" style="display: flex; align-items: center; gap: 0.95rem; padding: 0.85rem 0.5rem; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.15s ease;">
                <!-- Gray Avatar Silhouette (Matching Image 3) -->
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #E2E8F0; display: flex; align-items: center; justify-content: center; color: #94A3B8; flex-shrink: 0;">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                </div>

                <!-- Info -->
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                    <span style="font-weight: 700; font-size: 1rem; color: #1E293B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${c.name}
                    </span>
                    ${isConfirmed ? `
                      <span style="font-size: 0.72rem; color: #15803D; font-weight: 700;">✓ Enviado</span>
                    ` : isOpened ? `
                      <span style="font-size: 0.72rem; color: #B45309; font-weight: 700;">Aberto</span>
                    ` : ''}
                  </div>
                  <div style="font-size: 0.85rem; color: #64748B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${c.phone || c.city || '.'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Floating Green Plus FAB (Matching Image 3) -->
        <button id="btn-fab-add-contact" title="Adicionar Contato" style="position: fixed; right: 20px; bottom: 84px; width: 56px; height: 56px; border-radius: 50%; background: #25D366; color: #FFFFFF; border: none; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.45); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 90;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      `;

      mobileList.querySelector('#btn-fab-add-contact')?.addEventListener('click', () => {
        container.querySelector('#add-contact-modal').style.display = 'flex';
      });
    }

    // Listeners de Reatribuição
    container.querySelectorAll('.btn-reassign-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        container.querySelector('#reassign-contact-id').value = id;
        container.querySelector('#modal-reassign').style.display = 'flex';
      });
    });
  }

  // Listeners de filtro de status
  container.querySelectorAll('#status-filter-buttons .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.getAttribute('data-status');
      container.querySelectorAll('#status-filter-buttons .status-btn').forEach(b => {
        if (b === btn) {
          b.style.background = '#1D4ED8';
          b.style.color = '#FFFFFF';
          b.style.border = 'none';
          b.style.fontWeight = '700';
        } else {
          b.style.background = '#FFFFFF';
          b.style.color = 'var(--text-main)';
          b.style.border = '1px solid var(--border-color)';
          b.style.fontWeight = '600';
        }
      });
      applyFiltersAndRender();
    });
  });

  // Busca por texto
  container.querySelector('#contacts-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#btn-goto-import')?.addEventListener('click', () => onNavigate('import'));

  // Modais Handlers
  const modal = container.querySelector('#add-contact-modal');
  container.querySelector('#btn-open-add-contact')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  container.querySelector('#btn-close-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#btn-cancel-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });

  container.querySelector('#add-contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-contact-name').value.trim();
    const phone = container.querySelector('#input-contact-phone').value.trim();
    const company = container.querySelector('#input-contact-company').value.trim();
    const assignSel = container.querySelector('#select-contact-assignee');
    const assignedUid = assignSel ? assignSel.value : currentUser.uid;
    const assignedName = assignSel ? assignSel.options[assignSel.selectedIndex]?.text.replace(/ \(.*\)/, '') : currentUser.name;

    const saveBtn = container.querySelector('#btn-save-contact-submit');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
    }

    try {
      await saveContactsBatch([{
        name,
        phone,
        city: company,
        tenant_id: currentUser.tenant_id || 'tenant_main',
        team_id: currentUser.team_id || null,
        assigned_to: assignedUid,
        assigned_to_name: assignedName,
        status: 'pending'
      }]);
      showToast(`Contato "${name}" adicionado com sucesso!`, 'success');
      modal.style.display = 'none';
      container.querySelector('#add-contact-form').reset();
    } catch (err) {
      console.error('Erro ao adicionar contato:', err);
      showToast(`Erro ao salvar contato: ${err.message}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Contato';
      }
    }
  });

  // Reatribuição Submit
  const reassignModal = container.querySelector('#modal-reassign');
  container.querySelector('#btn-close-reassign')?.addEventListener('click', () => { reassignModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-reassign')?.addEventListener('click', () => { reassignModal.style.display = 'none'; });

  container.querySelector('#form-reassign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contactId = container.querySelector('#reassign-contact-id').value;
    const reassignSel = container.querySelector('#select-reassign-member');
    const newUid = reassignSel.value;
    const newName = reassignSel.options[reassignSel.selectedIndex]?.text.replace(/ \(.*\)/, '');

    try {
      await reassignContactInFirestore(contactId, newUid, newName);
      showToast('Contato reatribuído com sucesso!', 'success');
      reassignModal.style.display = 'none';
    } catch (err) {
      console.error('Erro ao reatribuir contato:', err);
      showToast('Erro ao reatribuir contato no Firestore.', 'error');
    }
  });

  // Subscriptions em tempo real
  let unsubContacts = null;
  let unsubTeams = null;
  let unsubUsers = null;
  let unsubMembers = null;

  if (isAdmin) {
    unsubContacts = subscribeToAllContacts((realContacts) => {
      allContacts = realContacts;
      renderAdminCoordinatorTabs();
      renderLeaderTabs();
      applyFiltersAndRender();
    });

    unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
      allTeams = teams;
      renderAdminCoordinatorTabs();
    });

    unsubUsers = subscribeToAllUsers((users) => {
      allUsers = users;
      renderAdminCoordinatorTabs();
      renderLeaderTabs();
      updateAssigneesSelect();
    });
  } else if (isCoordinator) {
    unsubContacts = subscribeToTeamContacts(currentUser?.team_id || null, (realContacts) => {
      allContacts = realContacts;
      renderLeaderTabs();
      applyFiltersAndRender();
    });

    unsubMembers = subscribeToTeamMembers(currentUser?.team_id, currentUser?.uid, (members) => {
      teamMembers = members;
      renderLeaderTabs();
      updateAssigneesSelect();
    });
  } else {
    unsubContacts = subscribeToOperatorContacts(currentUser?.uid, (realContacts) => {
      allContacts = realContacts;
      applyFiltersAndRender();
    });
  }

  return () => {
    if (unsubContacts) unsubContacts();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
    if (unsubMembers) unsubMembers();
  };
}

