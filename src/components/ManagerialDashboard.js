import { 
  subscribeToTeamMembers, 
  subscribeToTeamContacts, 
  subscribeToTenantTeams,
  subscribeToAllUsers,
  subscribeToMessagesHistory,
  createTeamInFirestore,
  deleteTeamFromFirestore,
  updateTeamCoordinator,
  updateMemberGoal, 
  recordSystemAuditLog,
  DEFAULT_TENANT_ID
} from '../firebase/realtime.js';
import { createUserProfileDirectly } from '../firebase/auth.js';
import { showToast } from '../utils/feedback.js';
import { calculateNetworkCoverage, calculateLeadersPerformance, generateManagementAlerts } from '../utils/metricsEngine.js';

export function renderManagerialDashboard(container, currentUser, currentTeamId, onTeamChange) {
  let teamMembers = [];
  let teamContacts = [];
  let teamMessages = [];
  let allTeams = [];
  let allCoordinators = [];
  let activeTab = 'performance'; // 'performance' | 'teams_list'

  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';

  const teamName = isCoordinator 
    ? (currentUser.team_name || 'Minha Equipe') 
    : 'Gestão de Equipes & Coordenadores';

  container.innerHTML = `
    <div class="page-content">
      <!-- Top Title & Action Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.72rem;">
              ${isAdmin ? 'Governança Global' : 'Coordenação de Equipe'}
            </span>
            <h2 id="team-dashboard-title" style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">${teamName}</h2>
          </div>
          <p id="team-dashboard-subtitle" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            ${isCoordinator ? 'Acompanhe as metas individuais, o ritmo de cobertura e o histórico de abordagens dos seus líderes.' : 'Gerencie equipes, vincule coordenadores e acompanhe a performance dos líderes da rede.'}
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          ${isAdmin ? `
            <button class="btn-outline-white" id="btn-open-new-coord-modal" style="font-size: 0.82rem; padding: 0.45rem 0.85rem; font-weight: 600;">
              + Novo Coordenador
            </button>
          ` : ''}
          <button class="btn-primary-blue" id="btn-coord-add-member" style="font-size: 0.82rem; padding: 0.45rem 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Adicionar Líder / Membro
          </button>
        </div>
      </div>

      <!-- 5 Operational KPI Cards -->
      <div class="metrics-row" style="grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-bottom: 1.5rem;">
        <!-- KPI 1: Total de Líderes -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">LÍDERES DA EQUIPE</span>
            <span class="metric-big-num" id="coord-kpi-members">0</span>
            <span class="metric-subtext" style="color: var(--primary-blue); font-weight: 600;">Operadores ativos</span>
          </div>
          <div class="metric-icon-bubble">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          </div>
        </div>

        <!-- KPI 2: Total de Contatos -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">CARTEIRA DE CONTATOS</span>
            <span class="metric-big-num" id="coord-kpi-contacts">0</span>
            <span class="metric-subtext">Total da Equipe</span>
          </div>
          <div class="metric-icon-bubble gray">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>
          </div>
        </div>

        <!-- KPI 3: Contatos Abordados -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">CONTATOS ABORDADOS</span>
            <span class="metric-big-num" id="coord-kpi-opened" style="color: var(--whatsapp-green);">0</span>
            <span class="metric-subtext" style="color: var(--whatsapp-green); font-weight: 600;">Primeira abordagem</span>
          </div>
          <div class="metric-icon-bubble" style="background: #F0FDF4; color: var(--whatsapp-green);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>

        <!-- KPI 4: Contatos Pendentes -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">CONTATOS PENDENTES</span>
            <span class="metric-big-num" id="coord-kpi-pending" style="color: #D97706;">0</span>
            <span class="metric-subtext" style="color: #D97706; font-weight: 600;">Aguardando envio</span>
          </div>
          <div class="metric-icon-bubble" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
        </div>

        <!-- KPI 5: Cobertura da Equipe -->
        <div class="metric-box">
          <div class="metric-info" style="width: 100%;">
            <span class="metric-label">COBERTURA DA EQUIPE</span>
            <span class="metric-big-num" id="coord-kpi-rate" style="color: #1D4ED8;">0%</span>
            <div class="table-progress-track" style="margin-top: 0.5rem; height: 6px;">
              <div class="table-progress-bar" id="coord-kpi-rate-bar" style="width: 0%; background: #1D4ED8;"></div>
            </div>
          </div>
        </div>
      </div>

      ${isAdmin ? `
        <!-- Navigation Sub-Tabs (Exclusivo Administrador) -->
        <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
          <button class="nav-tab-btn" id="subtab-performance" style="padding: 0.65rem 1.25rem; font-size: 0.9rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid ${activeTab === 'performance' ? 'var(--primary-blue)' : 'transparent'}; color: ${activeTab === 'performance' ? 'var(--primary-blue)' : 'var(--text-muted)'};">
            Desempenho dos Líderes
          </button>
          <button class="nav-tab-btn" id="subtab-teams" style="padding: 0.65rem 1.25rem; font-size: 0.9rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid ${activeTab === 'teams_list' ? 'var(--primary-blue)' : 'transparent'}; color: ${activeTab === 'teams_list' ? 'var(--primary-blue)' : 'var(--text-muted)'};">
            Equipes & Coordenadores Cadastrados
          </button>
        </div>
      ` : ''}

      <!-- Tab Content Area -->
      <div id="manager-tab-content-area"></div>
    </div>

    <!-- Modal Perfil 360 do Líder & Histórico de Abordagens -->
    <div id="modal-leader-profile" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 820px; max-height: 90vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div id="leader-prof-avatar" style="width: 46px; height: 46px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; justify-content: center;">
              L
            </div>
            <div>
              <h3 id="leader-prof-name" style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Nome do Líder</h3>
              <p id="leader-prof-sub" style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0 0;">email@empresa.com · Equipe Delta</p>
            </div>
          </div>
          <button id="btn-close-leader-profile" style="background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>

        <!-- Body Scrollable -->
        <div style="padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- KPI Cards do Líder -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
            <div style="background: #F8FAFC; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid #E2E8F0;">
              <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Meta / Carteira</span>
              <div id="leader-prof-goal" style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">0</div>
            </div>
            <div style="background: #F0FDF4; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid #BBF7D0;">
              <span style="font-size: 0.7rem; font-weight: 700; color: #15803D; text-transform: uppercase;">Abordados</span>
              <div id="leader-prof-opened" style="font-size: 1.2rem; font-weight: 800; color: #15803D;">0</div>
            </div>
            <div style="background: #FFFBEB; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid #FDE68A;">
              <span style="font-size: 0.7rem; font-weight: 700; color: #B45309; text-transform: uppercase;">Pendentes</span>
              <div id="leader-prof-pending" style="font-size: 1.2rem; font-weight: 800; color: #B45309;">0</div>
            </div>
            <div style="background: #EFF6FF; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid #BFDBFE;">
              <span style="font-size: 0.7rem; font-weight: 700; color: #1D4ED8; text-transform: uppercase;">Cobertura</span>
              <div id="leader-prof-rate" style="font-size: 1.2rem; font-weight: 800; color: #1D4ED8;">0%</div>
            </div>
          </div>

          <!-- Status WhatsApp & Última Atividade -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid #E2E8F0; padding: 0.85rem 1rem; border-radius: var(--radius-md); flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">Instância WhatsApp:</span>
              <span id="leader-prof-whatsapp-badge"></span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ⏱️ Última abordagem: <strong id="leader-prof-last-active" style="color: var(--text-main);">—</strong>
            </div>
          </div>

          <!-- Tabela de Histórico de Abordagens do Líder -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
              <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Histórico de Abordagens Realizadas</h4>
              <span id="leader-prof-history-count" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">0 envios registrados</span>
            </div>

            <div class="table-container" style="max-height: 280px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: var(--radius-md);">
              <table class="panel-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>DATA / HORA</th>
                    <th>CONTATO</th>
                    <th>MENSAGEM ENVIADA</th>
                    <th>CANAL</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody id="leader-prof-history-tbody">
                  <!-- Linhas de histórico inseridas dinamicamente -->
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; background: #F8FAFC; border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
          <button type="button" id="btn-close-leader-profile-footer" class="btn-primary-blue" style="padding: 0.5rem 1.25rem;">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal Criar Nova Equipe com Coordenador -->
    <div id="modal-create-team" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 500px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Criar Nova Equipe</h3>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Vincule obrigatoriamente um coordenador para liderar a equipe.</p>
          </div>
          <button id="btn-close-team-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-create-team" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Nome da Equipe *</label>
            <input type="text" id="input-new-team-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem;" placeholder="Ex: Equipe Delta - Zona Sul" required>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Coordenador Líder Responsável *</label>
            <select id="select-team-coordinator" class="form-control" style="padding: 0.6rem 0.85rem;" required></select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            <button type="button" id="btn-cancel-team-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-submit-team" class="btn-primary-blue" style="font-weight: 600;">Criar Equipe & Vincular Líder</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Novo Coordenador -->
    <div id="modal-create-coordinator" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 480px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.1rem; font-weight: 700;">Cadastrar Coordenador</h3>
          <button id="btn-close-coord-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-create-coordinator" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Nome Completo</label>
            <input type="text" id="input-new-coord-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.55rem 0.75rem;" placeholder="Ex: Marcos Souza" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">E-mail Corporativo</label>
            <input type="email" id="input-new-coord-email" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.55rem 0.75rem;" placeholder="marcos@empresa.com" required>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Senha Inicial</label>
            <input type="password" id="input-new-coord-pass" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.55rem 0.75rem;" placeholder="••••••••" minlength="6" required>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-coord-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-submit-coord" class="btn-primary-blue">Cadastrar Coordenador</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Adicionar Membro à Equipe -->
    <div id="modal-add-member" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 460px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Adicionar Líder / Membro à Equipe</h3>
          <button id="btn-close-member-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-add-member" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Nome Completo</label>
            <input type="text" id="input-member-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: João da Silva" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">E-mail Corporativo</label>
            <input type="email" id="input-member-email" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="joao@empresa.com" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Senha Inicial</label>
            <input type="password" id="input-member-pass" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="••••••••" minlength="6" required>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Meta Individual de Contatos</label>
            <input type="number" id="input-member-goal" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" value="30" min="1" max="1000" required>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-member-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-member-submit" class="btn-green-action">Adicionar à Equipe</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar Meta -->
    <div id="modal-edit-goal" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 400px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Ajustar Meta Individual</h3>
          <button id="btn-close-goal-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-edit-goal" style="padding: 1.5rem;">
          <input type="hidden" id="edit-goal-member-uid">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;" id="edit-goal-member-name">Definir Meta para:</label>
            <input type="number" id="input-edit-goal-val" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" min="1" max="10000" required>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-goal-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-goal-submit" class="btn-primary-blue">Salvar Meta</button>
          </div>
        </form>
      </div>
    </div>
  `;

  function updateKpis() {
    const coverage = calculateNetworkCoverage(teamContacts, teamMessages);
    const totalMembers = teamMembers.length;

    const memEl = container.querySelector('#coord-kpi-members');
    const conEl = container.querySelector('#coord-kpi-contacts');
    const openEl = container.querySelector('#coord-kpi-opened');
    const penEl = container.querySelector('#coord-kpi-pending');
    const rateEl = container.querySelector('#coord-kpi-rate');
    const rateBar = container.querySelector('#coord-kpi-rate-bar');

    if (memEl) memEl.textContent = totalMembers;
    if (conEl) conEl.textContent = coverage.total;
    if (openEl) openEl.textContent = coverage.abordados;
    if (penEl) penEl.textContent = coverage.pendentes;
    if (rateEl) rateEl.textContent = coverage.rateFormatted;
    if (rateBar) rateBar.style.width = coverage.rateFormatted;
  }

  function renderTabContent() {
    const mount = container.querySelector('#manager-tab-content-area');
    if (!mount) return;

    if (activeTab === 'performance') {
      // Desempenho e Ranking dos Líderes da Equipe calculado via metricsEngine
      const sortedByAbordados = calculateLeadersPerformance(teamMembers, teamContacts, teamMessages);

      mount.innerHTML = `
        <div class="main-panel-card">
          <!-- Ranking Top Performers Summary -->
          ${teamMembers.length >= 2 ? `
            <div style="background: linear-gradient(135deg, #F0FDF4 0%, #EFF6FF 100%); border: 1px solid #BFDBFE; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;">
                <span style="font-size: 1.2rem;">🏆</span>
                <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">Destaques de Desempenho da Equipe</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                ${sortedByAbordados.slice(0, 3).map((item, idx) => `
                  <div style="background: #FFFFFF; border-radius: var(--radius-md); padding: 0.75rem 1rem; border: 1px solid #E2E8F0; display: flex; align-items: center; gap: 0.65rem;">
                    <span style="font-size: 1.2rem; font-weight: 800; color: ${idx === 0 ? '#EAB308' : idx === 1 ? '#94A3B8' : '#B45309'};">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                    <div style="min-width: 0;">
                      <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                      <div style="font-size: 0.75rem; color: ${item.pct >= 100 ? '#15803D' : 'var(--primary-blue)'}; font-weight: 600;">${item.abordados} abordagens (${item.pct}%)</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="panel-top-header">
            <div>
              <span class="panel-title-text">Desempenho dos Líderes da Equipe</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.1rem;">Metas individuais, carteiras de contatos e status de conectividade.</span>
            </div>

            <div class="panel-controls-group">
              <div style="position: relative; width: 240px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="coord-search-member" class="topbar-search-input" placeholder="Buscar líder..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.1rem; background: #FFFFFF; font-size: 0.82rem;">
              </div>
            </div>
          </div>

          <!-- Desktop Table View -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>LÍDER / OPERADOR</th>
                  <th>INSTÂNCIA WHATSAPP</th>
                  <th>PROGRESSO DA CARTEIRA</th>
                  <th style="text-align: center;">ABORDADOS</th>
                  <th style="text-align: center;">PENDENTES</th>
                  <th>ÚLTIMA ATIVIDADE</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody id="coord-table-body">
                ${teamMembers.length === 0 ? `
                  <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum líder na equipe ainda. Clique em <strong>+ Adicionar Líder / Membro</strong>.</td></tr>
                ` : sortedByAbordados.map(m => {
                  const initials = (m.name || 'L').substring(0, 2).toUpperCase();
                  const lastActiveStr = m.lastActiveIso ? new Date(m.lastActiveIso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem atividade';

                  return `
                    <tr class="member-row">
                      <td>
                        <div class="user-identity-cell">
                          <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8;">${initials}</div>
                          <div>
                            <span class="user-identity-name">${m.name}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        ${m.isConnected ? `
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                              <span style="width: 7px; height: 7px; border-radius: 50%; background: #22C55E; display: inline-block;"></span>
                              Conectada
                            </span>
                            ${m.instanceName ? `<span style="font-size: 0.72rem; color: #64748B; font-family: monospace;">${m.instanceName}</span>` : ''}
                            ${m.phone ? `<span style="font-size: 0.7rem; color: #059669; font-weight: 600;">📱 ${m.phone}</span>` : ''}
                          </div>
                        ` : m.instanceName ? `
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                              <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
                              Criada (Offline)
                            </span>
                            <span style="font-size: 0.72rem; color: #64748B; font-family: monospace;">${m.instanceName}</span>
                          </div>
                        ` : `
                          <span class="pill-btn" style="background: #F1F5F9; color: #94A3B8; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                            <span style="width: 7px; height: 7px; border-radius: 50%; background: #CBD5E1; display: inline-block;"></span>
                            Não configurada
                          </span>
                        `}
                      </td>
                      <td style="width: 22%;">
                        <div class="table-progress-wrap">
                          <div class="table-progress-track">
                            <div class="table-progress-bar" style="width: ${m.pct}%; background: ${m.pct >= 100 ? '#10B981' : m.pct >= 30 ? '#3B82F6' : '#EF4444'};"></div>
                          </div>
                          <span style="font-size: 0.82rem; font-weight: 700; min-width: 40px; color: var(--text-main);">${m.pctFormatted}</span>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                          ${m.abordados} de ${m.goal} contatos
                        </div>
                      </td>
                      <td style="text-align: center; font-weight: 700; color: #15803D;">${m.abordados}</td>
                      <td style="text-align: center; font-weight: 600; color: #B45309;">${m.pendentes}</td>
                      <td style="font-size: 0.78rem; color: var(--text-muted);">${lastActiveStr}</td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                          <button class="btn-open-leader-profile btn-primary-blue" data-uid="${m.uid}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                            👁️ Ver Abordagens
                          </button>
                          <button class="btn-open-edit-goal btn-outline-white" data-uid="${m.uid}" data-name="${m.name}" data-goal="${m.goal}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;" title="Ajustar Meta">
                            🎯 Meta
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Smartphone Mobile Card View -->
          <div class="team-mobile-card-list mobile-only" id="coord-mobile-cards" style="padding: 1rem;">
            ${teamMembers.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                Nenhum líder na equipe ainda.<br>Clique em <strong>+ Adicionar Líder</strong> acima.
              </div>
            ` : sortedByAbordados.map(m => {
              const initials = (m.name || 'L').substring(0, 2).toUpperCase();
              const lastActiveStr = m.lastActiveIso ? new Date(m.lastActiveIso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem atividade';

              return `
                <div class="team-mobile-card member-mobile-item" style="margin-bottom: 0.85rem;">
                  <div class="team-mobile-card-header">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8; width: 38px; height: 38px; font-size: 0.88rem;">${initials}</div>
                      <div>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${m.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${m.email}</div>
                      </div>
                    </div>
                    <span class="pill-btn" style="background: #F0FDF4; color: #15803D; font-weight: 800; font-size: 0.78rem;">${m.pctFormatted}</span>
                  </div>

                  <div style="margin: 0.75rem 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem;">
                      <span>${m.abordados} abordados</span>
                      <span>${m.pendentes} pendentes (${m.goal} meta)</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 99px; overflow: hidden;">
                      <div style="width: ${m.pct}%; height: 100%; background: #10B981;"></div>
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem;">
                      ⏱️ Última: ${lastActiveStr}
                    </div>
                  </div>

                  <div class="team-mobile-card-footer" style="display: flex; gap: 0.5rem;">
                    <button class="btn-open-leader-profile btn-primary-blue" data-uid="${m.uid}" style="flex: 1; font-size: 0.8rem; padding: 0.5rem; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                      👁️ Ver Abordagens
                    </button>
                    <button class="btn-open-edit-goal btn-outline-white" data-uid="${m.uid}" data-name="${m.name}" data-goal="${m.goal}" style="font-size: 0.8rem; padding: 0.5rem 0.85rem; font-weight: 600; border-radius: var(--radius-md);">
                      🎯 Meta
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Listener de busca de membros
      const searchInput = mount.querySelector('#coord-search-member');
      searchInput?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        mount.querySelectorAll('#coord-table-body .member-row').forEach(row => {
          const text = row.innerText.toLowerCase();
          row.style.display = text.includes(q) ? '' : 'none';
        });
        mount.querySelectorAll('#coord-mobile-cards .member-mobile-item').forEach(card => {
          const text = card.innerText.toLowerCase();
          card.style.display = text.includes(q) ? '' : 'none';
        });
      });

      // Listener de abertura do Modal 360 do Líder
      mount.querySelectorAll('.btn-open-leader-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const leader = sortedByAbordados.find(l => l.uid === uid);
          if (!leader) return;

          // Mensagens do líder
          const messages = leader.memberMessages || [];
          
          container.querySelector('#leader-prof-avatar').textContent = (leader.name || 'L').charAt(0).toUpperCase();
          container.querySelector('#leader-prof-name').textContent = leader.name;
          container.querySelector('#leader-prof-sub').textContent = `${leader.email} · Equipe ${leader.team_name || teamName}`;
          container.querySelector('#leader-prof-goal').textContent = leader.goal;
          container.querySelector('#leader-prof-opened').textContent = leader.abordados;
          container.querySelector('#leader-prof-pending').textContent = leader.pendentes;
          container.querySelector('#leader-prof-rate').textContent = leader.pctFormatted;
          container.querySelector('#leader-prof-history-count').textContent = `${messages.length} abordagens registradas`;

          const waBadge = container.querySelector('#leader-prof-whatsapp-badge');
          if (waBadge) {
            waBadge.innerHTML = leader.isConnected
              ? `<span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;">🟢 Conectada (${leader.instanceName || 'Ativa'})</span>`
              : leader.instanceName
              ? `<span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;">🟡 Criada (Offline)</span>`
              : `<span class="pill-btn" style="background: #F1F5F9; color: #94A3B8; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;">⚪ Não configurada</span>`;
          }

          const lastActiveEl = container.querySelector('#leader-prof-last-active');
          if (lastActiveEl) {
            lastActiveEl.textContent = leader.lastActiveIso 
              ? new Date(leader.lastActiveIso).toLocaleString('pt-BR') 
              : 'Nenhuma abordagem realizada';
          }

          const tbody = container.querySelector('#leader-prof-history-tbody');
          if (tbody) {
            if (messages.length === 0) {
              tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma mensagem disparada por este líder ainda.</td></tr>`;
            } else {
              tbody.innerHTML = messages.map(msg => {
                const dateStr = msg.created_at?.toDate ? msg.created_at.toDate().toLocaleString('pt-BR') : (msg.created_at ? new Date(msg.created_at).toLocaleString('pt-BR') : '—');
                const strategyLabel = msg.strategy === 'evolution_api' ? '🤖 Evolution API' : '📱 WhatsApp Web';
                const statusBadge = msg.status === 'confirmed' || msg.status === 'user_confirmed' 
                  ? '<span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.7rem;">✓ Confirmado</span>'
                  : '<span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.7rem;">Aberto</span>';

                return `
                  <tr>
                    <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">${dateStr}</td>
                    <td>
                      <div style="font-weight: 700; color: var(--text-main);">${msg.contact_name || 'Contato'}</div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${msg.phone || ''}</div>
                    </td>
                    <td style="max-width: 240px;">
                      <div style="font-size: 0.75rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${msg.message_body || ''}">
                        ${msg.message_body || '—'}
                      </div>
                    </td>
                    <td><span style="font-size: 0.75rem; font-weight: 600; color: #475569;">${strategyLabel}</span></td>
                    <td>${statusBadge}</td>
                  </tr>
                `;
              }).join('');
            }
          }

          container.querySelector('#modal-leader-profile').style.display = 'flex';
        });
      });

      // Listeners de ajuste de meta
      mount.querySelectorAll('.btn-open-edit-goal').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const name = btn.getAttribute('data-name');
          const goal = btn.getAttribute('data-goal');

          container.querySelector('#edit-goal-member-uid').value = uid;
          container.querySelector('#edit-goal-member-name').textContent = `Definir Meta para: ${name}`;
          container.querySelector('#input-edit-goal-val').value = goal;

          container.querySelector('#modal-edit-goal').style.display = 'flex';
        });
      });
    } else if (activeTab === 'teams_list') {
      mount.innerHTML = `
        <div class="main-panel-card">
          <div class="panel-top-header">
            <div>
              <span class="panel-title-text">Equipes Cadastradas & Coordenadores Vinculados</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.1rem;">Todas as equipes possuem um coordenador líder responsável.</span>
            </div>

            ${isAdmin ? `
              <button id="btn-inner-new-team" class="btn-primary-blue" style="font-size: 0.82rem; padding: 0.45rem 0.9rem;">
                + Criar Nova Equipe
              </button>
            ` : ''}
          </div>

          <div class="table-container">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>NOME DA EQUIPE</th>
                  <th>COORDENADOR LÍDER</th>
                  <th>MEMBROS VINCULADOS</th>
                  <th>STATUS</th>
                  ${isAdmin ? '<th style="text-align: right;">AÇÕES</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${allTeams.length === 0 ? `
                  <tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma equipe cadastrada. Clique no botão acima para criar a primeira equipe e vincular um coordenador!</td></tr>
                ` : allTeams.map(t => {
                  const memberCount = allCoordinators.filter(u => u.team_id === t.id).length;
                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <div style="width: 32px; height: 32px; border-radius: var(--radius-md); background: #EFF6FF; color: var(--primary-blue); display: flex; align-items: center; justify-content: center; font-weight: 800;">
                            ${t.name.charAt(0).toUpperCase()}
                          </div>
                          <span>${t.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem;">LÍDER</span>
                          <strong style="color: var(--text-main);">${t.coordinator_name || 'Coordenador Não Vinculado'}</strong>
                        </div>
                      </td>
                      <td style="color: var(--text-muted); font-size: 0.85rem;">
                        ${memberCount > 0 ? `${memberCount} membro(s)` : 'Equipe Ativa'}
                      </td>
                      <td><span class="status-pill ativo">OPERACIONAL</span></td>
                      ${isAdmin ? `
                        <td style="text-align: right;">
                          <button class="btn-delete-team-mgmt btn-outline-white" data-team-id="${t.id}" data-team-name="${t.name}" style="color: #DC2626; border-color: #FECACA; font-size: 0.75rem; padding: 0.35rem 0.65rem;" title="Excluir Equipe">
                            🗑️ Excluir
                          </button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      mount.querySelector('#btn-inner-new-team')?.addEventListener('click', () => {
        openTeamModal();
      });

      mount.querySelectorAll('.btn-delete-team-mgmt').forEach(btn => {
        btn.addEventListener('click', async () => {
          const teamId = btn.getAttribute('data-team-id');
          const teamName = btn.getAttribute('data-team-name');
          if (confirm(`Tem certeza que deseja excluir a equipe "${teamName}"?\n\nOs membros e contatos vinculados serão liberados para uso global.`)) {
            try {
              btn.disabled = true;
              btn.textContent = 'Excluindo...';
              await deleteTeamFromFirestore(teamId);
              await recordSystemAuditLog({
                actor_uid: currentUser.uid,
                actor_name: currentUser.name,
                action: 'team_deleted',
                metadata: { team_id: teamId, team_name: teamName }
              });
              showToast(`Equipe "${teamName}" excluída com sucesso!`, 'success');
            } catch (e) {
              showToast('Erro ao excluir equipe: ' + e.message, 'error');
            }
          }
        });
      });
    }
  }

  function updateCoordinatorsDropdown() {
    const sel = container.querySelector('#select-team-coordinator');
    if (!sel) return;

    if (allCoordinators.length === 0) {
      sel.innerHTML = `<option value="${currentUser.uid}" data-name="${currentUser.name}">${currentUser.name} (Coordenador Atual)</option>`;
      return;
    }

    sel.innerHTML = `
      <option value="" disabled selected>Selecione o coordenador que lidera a equipe...</option>
      ${allCoordinators.map(c => `
        <option value="${c.uid}" data-name="${c.name || c.email}">${c.name || c.email} (${c.role === 'admin' ? 'Admin' : 'Coordenador'})</option>
      `).join('')}
    `;
  }

  function openTeamModal() {
    updateCoordinatorsDropdown();
    container.querySelector('#modal-create-team').style.display = 'flex';
  }

  const targetTeamId = isCoordinator ? currentUser?.team_id : (currentTeamId || currentUser?.team_id || (allTeams.length > 0 ? allTeams[0].id : null));

  // Subscriptions
  const unsubMembers = subscribeToTeamMembers(
    targetTeamId, 
    null, 
    (members) => {
      teamMembers = members;
      updateKpis();
      renderTabContent();
    }
  );

  const unsubContacts = subscribeToTeamContacts(
    targetTeamId, 
    (contacts) => {
      teamContacts = contacts;
      updateKpis();
      renderTabContent();
    }
  );

  const unsubMessages = subscribeToMessagesHistory(
    isAdmin ? null : { role: currentUser.role, teamId: targetTeamId, userUid: currentUser.uid },
    (msgs) => {
      teamMessages = msgs;
      updateKpis();
      renderTabContent();
    }
  );

  const unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
    allTeams = teams;
    const currentTeam = allTeams.find(t => t.id === targetTeamId || t.name === currentUser.team_name || t.id === currentUser.team_id);
    if (currentTeam && currentTeam.name) {
      const headerTitle = container.querySelector('#team-dashboard-title');
      const headerSub = container.querySelector('#team-dashboard-subtitle');
      if (headerTitle) headerTitle.textContent = currentTeam.name;
      if (headerSub && currentTeam.coordinator_name) {
        headerSub.textContent = `Coordenador Líder: ${currentTeam.coordinator_name} · Acompanhe as metas e o desempenho dos membros da equipe.`;
      }
    }
    if (isAdmin) {
      renderTabContent();
    }
  });

  let unsubUsers = null;
  if (isAdmin) {
    unsubUsers = subscribeToAllUsers((users) => {
      allCoordinators = users.filter(u => u.role === 'coordinator' || u.role === 'admin');
      updateCoordinatorsDropdown();
    });
  }

  function switchSubTab(tabName) {
    if (!isAdmin) return;
    activeTab = tabName;
    const btnPerf = container.querySelector('#subtab-performance');
    const btnTeams = container.querySelector('#subtab-teams');
    if (btnPerf && btnTeams) {
      if (tabName === 'performance') {
        btnPerf.style.borderBottom = '2px solid var(--primary-blue)';
        btnPerf.style.color = 'var(--primary-blue)';
        btnTeams.style.borderBottom = '2px solid transparent';
        btnTeams.style.color = 'var(--text-muted)';
      } else {
        btnTeams.style.borderBottom = '2px solid var(--primary-blue)';
        btnTeams.style.color = 'var(--primary-blue)';
        btnPerf.style.borderBottom = '2px solid transparent';
        btnPerf.style.color = 'var(--text-muted)';
      }
    }
    renderTabContent();
  }

  // Tab switching
  container.querySelector('#subtab-performance')?.addEventListener('click', () => switchSubTab('performance'));
  container.querySelector('#subtab-teams')?.addEventListener('click', () => switchSubTab('teams_list'));

  // Modal Perfil do Líder Listeners
  const profileModal = container.querySelector('#modal-leader-profile');
  container.querySelector('#btn-close-leader-profile')?.addEventListener('click', () => { profileModal.style.display = 'none'; });
  container.querySelector('#btn-close-leader-profile-footer')?.addEventListener('click', () => { profileModal.style.display = 'none'; });

  // Modal Nova Equipe
  const teamModal = container.querySelector('#modal-create-team');
  container.querySelector('#btn-open-new-team-modal')?.addEventListener('click', () => openTeamModal());
  container.querySelector('#btn-close-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });

  container.querySelector('#form-create-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamNameInput = container.querySelector('#input-new-team-name').value.trim();
    const coordSelect = container.querySelector('#select-team-coordinator');
    const coordUid = coordSelect.value;
    const coordName = coordSelect.options[coordSelect.selectedIndex]?.getAttribute('data-name') || 'Coordenador';

    if (!coordUid) {
      showToast('Por favor, selecione o Coordenador Líder da equipe.', 'error');
      return;
    }

    const submitBtn = container.querySelector('#btn-submit-team');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando Equipe...';

    try {
      await createTeamInFirestore({
        name: teamNameInput,
        coordinatorUid: coordUid,
        coordinatorName: coordName
      });
      await recordSystemAuditLog({
        actor_uid: currentUser.uid,
        actor_name: currentUser.name,
        action: 'team_created',
        metadata: { team: teamNameInput, coordinator: coordName }
      });
      showToast(`Equipe "${teamNameInput}" criada com sucesso!`, 'success');
      teamModal.style.display = 'none';
      container.querySelector('#form-create-team').reset();
      activeTab = 'teams_list';
      renderTabContent();
    } catch (err) {
      console.warn('Erro ao criar equipe:', err);
      showToast('Erro ao criar equipe: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar Equipe & Vincular Líder';
    }
  });

  // Modal Novo Coordenador
  const coordModal = container.querySelector('#modal-create-coordinator');
  container.querySelector('#btn-open-new-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'flex'; });
  container.querySelector('#btn-close-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });

  container.querySelector('#form-create-coordinator')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-new-coord-name').value.trim();
    const email = container.querySelector('#input-new-coord-email').value.trim();

    const saveBtn = container.querySelector('#btn-submit-coord');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Cadastrando...';

    try {
      await createUserProfileDirectly({
        email,
        name,
        role: 'coordinator',
        teamId: null
      });
      showToast(`Coordenador "${name}" cadastrado com sucesso!`, 'success');
      coordModal.style.display = 'none';
      container.querySelector('#form-create-coordinator').reset();
    } catch (err) {
      console.warn('Erro ao cadastrar coordenador:', err);
      showToast('Erro ao cadastrar coordenador: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cadastrar Coordenador';
    }
  });

  // Modal Adicionar Membro
  const memberModal = container.querySelector('#modal-add-member');
  container.querySelector('#btn-coord-add-member')?.addEventListener('click', () => { memberModal.style.display = 'flex'; });
  container.querySelector('#btn-close-member-modal')?.addEventListener('click', () => { memberModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-member-modal')?.addEventListener('click', () => { memberModal.style.display = 'none'; });

  container.querySelector('#form-add-member')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-member-name').value.trim();
    const email = container.querySelector('#input-member-email').value.trim();
    const goal = parseInt(container.querySelector('#input-member-goal').value, 10) || 30;

    const submitBtn = container.querySelector('#btn-save-member-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adicionando...';

    try {
      const coordData = { uid: currentUser.uid, name: currentUser.name || 'Coordenador' };
      await createUserProfileDirectly({
        email,
        name,
        role: 'member',
        teamId: targetTeamId || currentUser.team_id || null,
        coordinatorData: coordData,
        dailyGoal: goal
      });
      showToast(`Líder "${name}" adicionado à equipe com sucesso!`, 'success');
      memberModal.style.display = 'none';
      container.querySelector('#form-add-member').reset();
    } catch (err) {
      console.error('Erro ao adicionar membro:', err);
      showToast(`Erro ao adicionar membro: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Adicionar à Equipe';
    }
  });

  // Modal Ajustar Meta
  const goalModal = container.querySelector('#modal-edit-goal');
  container.querySelector('#btn-close-goal-modal')?.addEventListener('click', () => { goalModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-goal-modal')?.addEventListener('click', () => { goalModal.style.display = 'none'; });

  container.querySelector('#form-edit-goal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = container.querySelector('#edit-goal-member-uid').value;
    const newGoal = parseInt(container.querySelector('#input-edit-goal-val').value, 10) || 30;

    try {
      await updateMemberGoal(uid, newGoal);
      showToast('Meta individual atualizada com sucesso!', 'success');
      goalModal.style.display = 'none';
    } catch (err) {
      console.error('Erro ao atualizar meta:', err);
      showToast('Erro ao atualizar meta no Firestore.', 'error');
    }
  });

  renderTabContent();

  return () => {
    unsubMembers();
    unsubContacts();
    if (unsubMessages) unsubMessages();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
  };
}
