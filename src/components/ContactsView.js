import {
  subscribeToAllContacts,
  subscribeToTeamContacts,
  subscribeToOperatorContacts,
  subscribeToTenantTeams,
  subscribeToAllUsers,
  subscribeToTeamMembers,
  saveContactsBatch,
  reassignContactInFirestore,
  DEFAULT_TENANT_ID
} from '../firebase/realtime.js';
import { showToast } from '../utils/feedback.js';
import { setupSearchableLocationInput } from './SearchableLocationSelect.js';

export function renderContactsView(container, currentUser, onNavigate) {
  let allContacts = [];
  let allTeams = [];
  let allUsers = [];
  let teamMembers = [];
  
  let selectedTeamId = 'all'; // 'all' | 'mine' | '<team_id>'
  let selectedMemberUid = 'all'; // 'all' | '<uid>'
  let statusFilter = 'all'; // 'all' | 'confirmed' | 'opened' | 'pending'
  let locationFilter = '';
  let searchQuery = '';

  const isMember = currentUser?.role === 'member';
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';

  if (isMember) {
    // LAYOUT MOBILE E OPERADOR
    container.innerHTML = `
      <!-- Topbar Verde WhatsApp (Mobile) -->
      <div style="background: #008069; color: #FFFFFF; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.3px;">WhatsApp - ${currentUser.name || 'Operador'}</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <button id="btn-goto-history-mobile" style="background: none; border: none; color: #FFFFFF; font-size: 1.15rem; cursor: pointer; padding: 0;" title="Histórico de Envios">
            📜
          </button>
        </div>
      </div>

      <div style="background: #075E54; padding: 0.5rem 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="position: relative;">
          <input type="text" id="contacts-search-mobile" placeholder="Buscar por nome, telefone..." style="width: 100%; padding: 0.55rem 1rem 0.55rem 2.2rem; border-radius: 9999px; border: none; font-size: 0.85rem; background: #FFFFFF; color: #1E293B; outline: none; box-sizing: border-box;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%);">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div style="position: relative;">
          <input type="text" id="contacts-location-filter-mobile" placeholder="📍 Filtrar por Cidade ou Bairro (RJ)..." style="width: 100%; padding: 0.5rem 1rem 0.5rem 2.2rem; border-radius: 9999px; border: none; font-size: 0.82rem; background: #FFFFFF; color: #1E293B; outline: none; box-sizing: border-box;">
          <span style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); font-size: 0.85rem;">📍</span>
        </div>
      </div>

      <!-- Lista Simples de Contatos WhatsApp -->
      <div style="background: #FFFFFF; min-height: calc(100vh - 130px); padding-bottom: 5.5rem; max-width: 520px; margin: 0 auto; width: 100%; box-sizing: border-box;">
        <div id="contacts-mobile-list" style="display: flex; flex-direction: column;">
          <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
            Carregando contatos...
          </div>
        </div>

        <!-- Floating Green Plus FAB -->
        <button id="btn-fab-add-contact" class="fab-button" title="Adicionar Contato">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Adicionar Contato Mobile -->
      <div id="add-contact-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">Adicionar Novo Contato</h3>
            <button id="btn-close-contact-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>
          <form id="add-contact-form" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Nome Completo</label>
              <input type="text" id="input-contact-name" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: João da Silva" required>
            </div>
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">WhatsApp / Telefone (DDD + Número)</label>
              <input type="tel" inputmode="tel" id="input-contact-phone" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: 5521999998888" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Cidade (RJ)</label>
                <input type="text" id="input-contact-city" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar cidade..." autocomplete="off">
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Bairro (RJ)</label>
                <input type="text" id="input-contact-neighborhood" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar bairro..." autocomplete="off">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-contact-modal" class="btn-outline-white">Cancelar</button>
              <button type="submit" id="btn-save-contact-submit" class="btn-green-action">Salvar Contato</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } else {
    // LAYOUT GERENCIAL DESKTOP LIMPO & ESCALADO EM REDE
    container.innerHTML = `
      <div class="page-content" style="max-width: 1300px; padding: 1.25rem;">
        <!-- Header Row -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px; margin: 0;">
                ${isCoordinator ? 'Banco de Contatos da Equipe' : 'Banco Global de Contatos'}
              </h2>
              <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem; border: 1px solid #BFDBFE;">
                ● Gestão em Rede
              </span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.3rem 0 0 0;">
              Supervisão em rede: acompanhe o progresso da campanha por Equipe e por Líder.
            </p>
          </div>

          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <button id="btn-goto-history" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.55rem 1rem;">
              📜 Histórico de Envios
            </button>

            <button id="btn-goto-import" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.55rem 1rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
              </svg>
              Importar CSV
            </button>

            <button id="btn-open-add-contact" class="btn-green-action" style="font-size: 0.85rem; padding: 0.55rem 1.15rem;">
              + Adicionar Contato
            </button>
          </div>
        </div>

        <!-- 4 Clean Executive Metric Cards -->
        <div class="metrics-row" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="kpi-card" style="border-top: 3px solid #3B82F6;">
            <span class="kpi-card-title">TOTAL DE CONTATOS</span>
            <span class="kpi-card-value" id="kpi-contacts-total" style="color: #1E293B;">0</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Mapeados na seleção</span>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #10B981;">
            <span class="kpi-card-title">DISPAROS CONFIRMADOS</span>
            <span class="kpi-card-value" id="kpi-contacts-sent" style="color: #059669;">0</span>
            <span style="font-size: 0.75rem; color: #059669; margin-top: 0.2rem;">Envios concluídos</span>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #F59E0B;">
            <span class="kpi-card-title">DISPAROS PENDENTES</span>
            <span class="kpi-card-value" id="kpi-contacts-pending" style="color: #D97706;">0</span>
            <span style="font-size: 0.75rem; color: #D97706; margin-top: 0.2rem;">Aguardando envio</span>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #6366F1;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span class="kpi-card-title">COBERTURA DA REDE</span>
              <span id="kpi-contacts-rate" style="font-size: 1.25rem; font-weight: 800; color: #4F46E5;">0%</span>
            </div>
            <div style="width: 100%; height: 6px; background: #E0E7FF; border-radius: 9999px; margin-top: 0.75rem; overflow: hidden;">
              <div id="kpi-contacts-prog-bar" style="width: 0%; height: 100%; background: #4F46E5; transition: width 0.3s ease;"></div>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.4rem; display: block;">Taxa de conclusão real</span>
          </div>
        </div>

        <!-- Clean Hierarchy Network Filter Bar -->
        <div class="main-panel-card" style="padding: 1.25rem; margin-bottom: 1.5rem; background: #FFFFFF;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; align-items: flex-end;">
            
            <!-- Seletor de Equipe / Coordenação -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                🏢 Equipe / Coordenação
              </label>
              <select id="filter-team-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
                <option value="all">🌐 Todas as Equipes (Geral)</option>
                <option value="mine">⭐ Minha Base Pessoal</option>
              </select>
            </div>

            <!-- Seletor de Líder / Operador -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                👤 Líder / Operador
              </label>
              <select id="filter-member-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
                <option value="all">👥 Todos os Membros</option>
              </select>
            </div>

            <!-- Seletor de Status -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                📊 Status do Contato
              </label>
              <select id="filter-status-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
                <option value="all">Todos os Status</option>
                <option value="pending">⏳ Pendente</option>
                <option value="confirmed">✓ Confirmado / Enviado</option>
                <option value="opened">📱 Aberto no WhatsApp</option>
              </select>
            </div>

            <!-- Seletor de Cidade / Bairro do RJ (Menu Suspenso com Digitação) -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                📍 Cidade / Bairro (RJ)
              </label>
              <input type="text" id="filter-location-select" class="topbar-search-input" placeholder="Digite cidade ou bairro..." style="width: 100%; background: #F8FAFC; font-size: 0.82rem;" autocomplete="off">
            </div>

            <!-- Busca Rápida de Texto -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                🔍 Pesquisar Nome / Tel
              </label>
              <input type="text" id="contacts-search" class="topbar-search-input" placeholder="Buscar texto..." style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
            </div>

          </div>
        </div>

        <!-- Resumo em Rede por Equipe (Network Performance Breakdown) -->
        <div id="network-breakdown-card" class="main-panel-card" style="padding: 1.25rem; margin-bottom: 1.5rem; background: #FAFAFA; display: none;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <span>🌐 Desempenho da Rede por Equipe</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Clique em uma equipe para filtrar</span>
          </div>
          <div id="network-breakdown-mount" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;"></div>
        </div>

        <!-- Contacts Table Panel -->
        <div class="main-panel-card" style="background: #FFFFFF; overflow: hidden;">
          <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA;">
            <span id="contacts-count-label" style="font-size: 0.83rem; font-weight: 700; color: var(--text-main);">
              Carregando contatos...
            </span>
          </div>

          <!-- Tabela Desktop -->
          <div class="table-container">
            <table class="panel-table" style="font-size: 0.83rem;">
              <thead>
                <tr>
                  <th style="width: 240px;">NOME DO CONTATO</th>
                  <th style="width: 150px;">WHATSAPP</th>
                  <th style="width: 140px;">CIDADE</th>
                  <th style="width: 140px;">BAIRRO</th>
                  <th style="width: 180px;">RESPONSÁVEL</th>
                  <th style="width: 120px; text-align: center;">STATUS</th>
                  <th style="width: 100px; text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody id="contacts-tbody">
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando contatos...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Adicionar Contato Desktop -->
      <div id="add-contact-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">Adicionar Novo Contato</h3>
            <button id="btn-close-contact-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>
          <form id="add-contact-form" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Nome Completo</label>
              <input type="text" id="input-contact-name" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: João da Silva" required>
            </div>
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">WhatsApp / Telefone (DDD + Número)</label>
              <input type="tel" inputmode="tel" id="input-contact-phone" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: 5521999998888" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Cidade (RJ)</label>
                <input type="text" id="input-contact-city" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar cidade..." autocomplete="off">
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Bairro (RJ)</label>
                <input type="text" id="input-contact-neighborhood" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar bairro..." autocomplete="off">
              </div>
            </div>

            <!-- Atribuição a Membro (Admin / Coordenador) -->
            ${!isMember ? `
              <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Atribuir a Líder / Membro</label>
                <select id="select-contact-assignee" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;"></select>
              </div>
            ` : ''}

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-contact-modal" class="btn-outline-white">Cancelar</button>
              <button type="submit" id="btn-save-contact-submit" class="btn-green-action">Salvar Contato</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Modal Reatribuição
  const reassignModalHtml = `
    <div id="modal-reassign" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">Reatribuir Contato</h3>
          <button id="btn-close-reassign" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-reassign" style="padding: 1.5rem;">
          <input type="hidden" id="reassign-contact-id">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Selecione o Novo Membro / Líder</label>
            <select id="select-reassign-member" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" required></select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-reassign" class="btn-outline-white">Cancelar</button>
            <button type="submit" class="btn-primary-blue">Confirmar Reatribuição</button>
          </div>
        </form>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', reassignModalHtml);

  // Popula os Selects de Equipe e Membro
  function populateTeamDropdown() {
    const teamSel = container.querySelector('#filter-team-select');
    if (!teamSel) return;

    let options = '<option value="all">🌐 Todas as Equipes (Geral)</option>';
    options += `<option value="mine" ${selectedTeamId === 'mine' ? 'selected' : ''}>⭐ Minha Base Pessoal (${allContacts.filter(c => c.assigned_to === currentUser.uid).length})</option>`;

    if (isAdmin) {
            allTeams.forEach(t => {
        const teamContactsCount = allContacts.filter(c => c.team_id === t.id).length;
        options += `<option value="${t.id}" ${selectedTeamId === t.id ? 'selected' : ''}>👥 ${t.name} (${teamContactsCount})</option>`;
      });
    } else if (isCoordinator) {
      options += `<option value="${currentUser.team_id}" ${selectedTeamId === currentUser.team_id ? 'selected' : ''}>👥 ${currentUser.team_name || 'Minha Equipe'}</option>`;
    }

    teamSel.innerHTML = options;
  }

  function populateMemberDropdown() {
    const memberSel = container.querySelector('#filter-member-select');
    if (!memberSel) return;

    let targetUsers = allUsers;
    if (selectedTeamId !== 'all' && selectedTeamId !== 'mine') {
      targetUsers = allUsers.filter(u => u.team_id === selectedTeamId);
    } else if (isCoordinator) {
      targetUsers = teamMembers.length > 0 ? teamMembers : allUsers.filter(u => u.team_id === currentUser.team_id || u.coordinator_id === currentUser.uid);
    }

    let options = '<option value="all">👥 Todos os Membros</option>';
    const myCount = allContacts.filter(c => c.assigned_to === currentUser.uid || c.assigned_to === currentUser.email || (currentUser.name && c.assigned_to_name === currentUser.name)).length;
    options += `<option value="${currentUser.uid}" ${selectedMemberUid === currentUser.uid ? 'selected' : ''}>⭐ Atribuídos a Mim (${myCount})</option>`;

    targetUsers.filter(u => u.uid !== currentUser.uid).forEach(u => {
      const count = allContacts.filter(c => c.assigned_to === u.uid || c.assigned_to === u.email || (u.name && c.assigned_to_name === u.name)).length;
      options += `<option value="${u.uid}" ${selectedMemberUid === u.uid ? 'selected' : ''}>👤 ${u.name || u.email} (${count})</option>`;
    });

    memberSel.innerHTML = options;
  }

  function renderNetworkBreakdown() {
    const breakdownCard = container.querySelector('#network-breakdown-card');
    const breakdownMount = container.querySelector('#network-breakdown-mount');
    if (!breakdownCard || !breakdownMount) return;

    if (!isAdmin || allTeams.length === 0 || selectedTeamId !== 'all') {
      breakdownCard.style.display = 'none';
      return;
    }

    breakdownCard.style.display = 'block';
    breakdownMount.innerHTML = allTeams.map(t => {
      const teamContacts = allContacts.filter(c => c.team_id === t.id);
      const total = teamContacts.length;
      const sent = teamContacts.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed').length;
      const rate = total > 0 ? Math.round((sent / total) * 100) : 0;

      return `
        <div class="team-breakdown-pill" data-team-id="${t.id}" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; cursor: pointer; transition: all 0.15s ease;" title="Filtrar por esta equipe">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="font-size: 0.85rem; color: var(--text-main);">👥 ${t.name}</strong>
            <span class="pill-btn" style="font-size: 0.72rem; font-weight: 700; background: #ECFDF5; color: #059669;">${rate}%</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            ${sent} de ${total} concluídos
          </div>
        </div>
      `;
    }).join('');

    breakdownMount.querySelectorAll('.team-breakdown-pill').forEach(card => {
      card.addEventListener('click', () => {
        const teamId = card.getAttribute('data-team-id');
        selectedTeamId = teamId;
        selectedMemberUid = 'all';
        const teamSel = container.querySelector('#filter-team-select');
        if (teamSel) teamSel.value = teamId;
        populateMemberDropdown();
        applyFiltersAndRender();
      });
    });
  }

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

  function applyFiltersAndRender() {
    let filtered = [...allContacts];

    // Filtro por Equipe
    if (selectedTeamId === 'mine') {
      filtered = filtered.filter(c => c.assigned_to === currentUser.uid || c.assigned_to === currentUser.email || (currentUser.name && c.assigned_to_name === currentUser.name));
    } else if (selectedTeamId !== 'all') {
      filtered = filtered.filter(c => c.team_id === selectedTeamId);
    }

    // Filtro por Líder / Operador (Membro)
    if (selectedMemberUid !== 'all') {
      const targetUser = allUsers.find(u => u.uid === selectedMemberUid);
      filtered = filtered.filter(c => 
        c.assigned_to === selectedMemberUid || 
        (targetUser && (
          c.assigned_to === targetUser.email || 
          (targetUser.name && c.assigned_to_name === targetUser.name) || 
          (targetUser.email && c.assigned_to_name === targetUser.email)
        ))
      );
    }

    // Filtro de Busca por Localização (Cidade / Bairro do RJ)
    if (locationFilter.trim().length > 0) {
      const loc = locationFilter.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.city && c.city.toLowerCase().includes(loc)) ||
        ((c.neighborhood || c.bairro) && (c.neighborhood || c.bairro).toLowerCase().includes(loc))
      );
    }

    // Filtro de Busca por Texto (Nome / Tel)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        ((c.neighborhood || c.bairro) && (c.neighborhood || c.bairro).toLowerCase().includes(q)) ||
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

    renderKPIs(filtered);
    renderTable(filtered);
    renderNetworkBreakdown();
  }

  function renderKPIs(list) {
    const totalEl = container.querySelector('#kpi-contacts-total');
    const sentEl = container.querySelector('#kpi-contacts-sent');
    const pendingEl = container.querySelector('#kpi-contacts-pending');
    const rateEl = container.querySelector('#kpi-contacts-rate');
    const progBar = container.querySelector('#kpi-contacts-prog-bar');

    const total = list.length;
    const confirmedCount = list.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed').length;
    const pendingCount = total - confirmedCount;
    const rate = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

    if (totalEl) totalEl.textContent = total;
    if (sentEl) sentEl.textContent = confirmedCount;
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (rateEl) rateEl.textContent = `${rate}%`;
    if (progBar) progBar.style.width = `${rate}%`;
  }

  function renderTable(list) {
    const tbody = container.querySelector('#contacts-tbody');
    const countLabel = container.querySelector('#contacts-count-label');
    const mobileList = container.querySelector('#contacts-mobile-list');

    if (countLabel) {
      countLabel.textContent = `Mostrando ${list.length} contato(s) ${locationFilter ? `em "${locationFilter}"` : ''}`;
    }

    if (tbody) {
      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
              Nenhum contato encontrado nesta seleção ou filtro.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = list.map(c => {
          const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
          const isOpened = c.status === 'opened';
          const initials = (c.name || 'C').substring(0, 2).toUpperCase();

          const statusBadge = isConfirmed
            ? '<span class="status-pill ativo">CONFIRMADO</span>'
            : isOpened
            ? '<span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.72rem; font-weight: 700;">ABERTO (WA)</span>'
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
              <td style="color: var(--text-main); font-size: 0.85rem; font-weight: 500;">${c.city || '—'}</td>
              <td style="color: #64748B; font-size: 0.85rem;">${c.neighborhood || c.bairro || '—'}</td>
              <td style="font-size: 0.82rem; color: var(--text-main); font-weight: 600;">
                👤 ${c.assigned_to_name || (c.assigned_to === currentUser.uid ? 'Você' : 'Não Atribuído')}
              </td>
              <td style="text-align: center;">${statusBadge}</td>
              <td style="text-align: right;">
                <button class="btn-reassign-action btn-outline-white" data-id="${c.id}" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
                  Reatribuir
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (mobileList) {
      if (list.length === 0) {
        mobileList.innerHTML = `
          <div style="text-align: center; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 3rem 1.5rem; color: var(--text-muted); margin: 1rem;">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">👥</div>
            <strong style="font-size: 1rem; color: var(--text-main);">Nenhum contato encontrado</strong>
            <p style="font-size: 0.82rem; margin-top: 0.25rem;">Nenhum registro para este filtro de localização ou busca.</p>
          </div>
        `;
      } else {
        mobileList.innerHTML = `
          <!-- WhatsApp Sub-Tabs Bar -->
          <div style="background: #008069; color: #FFFFFF; display: flex; align-items: center; border-bottom: 2px solid rgba(0,0,0,0.1); margin: -0.5rem -1rem 0.5rem -1rem; padding: 0 0.5rem;">
            <div style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.7); display: flex; align-items: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div style="flex: 1; text-align: center; padding: 0.75rem 0.5rem; color: #FFFFFF; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; border-bottom: 3px solid #FFFFFF; letter-spacing: 0.5px;">
              CONVERSAS (${list.length})
            </div>
          </div>

          <div style="display: flex; flex-direction: column; background: #FFFFFF;">
            ${list.map(c => {
              const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
              const isOpened = c.status === 'opened';
              const locationInfo = [c.city, c.neighborhood || c.bairro].filter(Boolean).join(' · ');

              return `
                <div class="wa-contact-item-row" style="display: flex; align-items: center; gap: 0.95rem; padding: 0.85rem 0.75rem; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.15s ease;">
                  <!-- Gray Avatar Silhouette -->
                  <div style="width: 46px; height: 46px; border-radius: 50%; background: #E2E8F0; display: flex; align-items: center; justify-content: center; color: #94A3B8; flex-shrink: 0;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                  </div>

                  <!-- Info -->
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                      <span style="font-weight: 700; font-size: 0.98rem; color: #1E293B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${c.name}
                      </span>
                      ${isConfirmed ? `
                        <span style="font-size: 0.72rem; color: #15803D; font-weight: 700;">✓ Enviado</span>
                      ` : isOpened ? `
                        <span style="font-size: 0.72rem; color: #B45309; font-weight: 700;">Aberto</span>
                      ` : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace;">
                      ${c.phone}
                    </div>
                    ${locationInfo ? `
                      <div style="font-size: 0.75rem; color: #0284C7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;">
                        📍 ${locationInfo}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }
  }

  // Filter Listeners
  container.querySelector('#filter-team-select')?.addEventListener('change', (e) => {
    selectedTeamId = e.target.value;
    selectedMemberUid = 'all';
    populateMemberDropdown();
    applyFiltersAndRender();
  });

  container.querySelector('#filter-member-select')?.addEventListener('change', (e) => {
    selectedMemberUid = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#filter-status-select')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#contacts-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#contacts-search-mobile')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  // Filtros de Localização com Menu Suspenso Pesquisável
  const mobileLocInput = container.querySelector('#contacts-location-filter-mobile');
  if (mobileLocInput) {
    setupSearchableLocationInput({
      inputEl: mobileLocInput,
      type: 'all',
      placeholder: '📍 Filtrar por Cidade ou Bairro (RJ)...',
      onSelect: ({ value }) => {
        locationFilter = value;
        applyFiltersAndRender();
      }
    });
    mobileLocInput.addEventListener('input', (e) => {
      locationFilter = e.target.value;
      applyFiltersAndRender();
    });
  }

  const desktopLocInput = container.querySelector('#filter-location-select');
  if (desktopLocInput) {
    setupSearchableLocationInput({
      inputEl: desktopLocInput,
      type: 'all',
      placeholder: 'Digite cidade ou bairro do RJ...',
      onSelect: ({ value }) => {
        locationFilter = value;
        applyFiltersAndRender();
      }
    });
    desktopLocInput.addEventListener('input', (e) => {
      locationFilter = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Setup dos Campos de Cidade e Bairro no Modal de Adicionar Contato
  const modalCityInput = container.querySelector('#input-contact-city');
  const modalNeighInput = container.querySelector('#input-contact-neighborhood');

  if (modalCityInput) {
    setupSearchableLocationInput({
      inputEl: modalCityInput,
      type: 'cities',
      placeholder: 'Digite para buscar cidade...'
    });
  }

  if (modalNeighInput) {
    setupSearchableLocationInput({
      inputEl: modalNeighInput,
      type: 'neighborhoods',
      placeholder: 'Digite para buscar bairro...',
      onSelect: ({ value, category }) => {
        if (modalCityInput && (!modalCityInput.value || modalCityInput.value === 'Rio de Janeiro')) {
          if (category.includes('Niterói')) {
            modalCityInput.value = 'Niterói';
          } else if (category.includes('Baixada')) {
            if (value.includes('Caxias')) modalCityInput.value = 'Duque de Caxias';
            else if (value.includes('Nova Iguaçu')) modalCityInput.value = 'Nova Iguaçu';
            else if (value.includes('Meriti')) modalCityInput.value = 'São João de Meriti';
            else if (value.includes('Belford Roxo')) modalCityInput.value = 'Belford Roxo';
            else if (value.includes('Nilópolis')) modalCityInput.value = 'Nilópolis';
            else if (value.includes('Mesquita')) modalCityInput.value = 'Mesquita';
            else if (value.includes('Queimados')) modalCityInput.value = 'Queimados';
            else modalCityInput.value = 'Duque de Caxias';
          } else {
            modalCityInput.value = 'Rio de Janeiro';
          }
        }
      }
    });
  }

  container.querySelector('#btn-goto-import')?.addEventListener('click', () => onNavigate('import'));
  container.querySelector('#btn-goto-history')?.addEventListener('click', () => onNavigate('history'));
  container.querySelector('#btn-goto-history-mobile')?.addEventListener('click', () => onNavigate('history'));

  // Modais Handlers
  const modal = container.querySelector('#add-contact-modal');
  container.querySelector('#btn-open-add-contact')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  container.querySelector('#btn-fab-add-contact')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  container.querySelector('#btn-close-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#btn-cancel-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });

  container.querySelector('#add-contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-contact-name').value.trim();
    const phone = container.querySelector('#input-contact-phone').value.trim();
    const city = container.querySelector('#input-contact-city')?.value.trim() || '';
    const neighborhood = container.querySelector('#input-contact-neighborhood')?.value.trim() || '';
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
        city: city,
        neighborhood: neighborhood,
        bairro: neighborhood,
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
      populateTeamDropdown();
      populateMemberDropdown();
      applyFiltersAndRender();
    });

    unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
      allTeams = teams;
      populateTeamDropdown();
      renderNetworkBreakdown();
    });

    unsubUsers = subscribeToAllUsers((users) => {
      allUsers = users;
      populateMemberDropdown();
      updateAssigneesSelect();
    });
  } else if (isCoordinator) {
    unsubContacts = subscribeToTeamContacts(currentUser.team_id, (teamContacts) => {
      allContacts = teamContacts;
      populateTeamDropdown();
      populateMemberDropdown();
      applyFiltersAndRender();
    });

    unsubMembers = subscribeToTeamMembers(currentUser.team_id, currentUser.uid, (members) => {
      teamMembers = members;
      populateMemberDropdown();
      updateAssigneesSelect();
    });
  } else {
    unsubContacts = subscribeToOperatorContacts(currentUser.uid, (userContacts) => {
      allContacts = userContacts;
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
