/**
 * DispatchHistoryView.js
 * Histórico de Envios & Mensagens com respeito rigoroso à hierarquia:
 * - Admin: Vê todos os disparos da campanha com filtros por Equipe, Operador, Canal e Data.
 * - Coordenador: Vê todos os disparos da sua equipe e operadores.
 * - Operador / Membro: Vê estritamente as suas próprias mensagens enviadas.
 */

import { subscribeToMessagesHistory, subscribeToTenantTeams, subscribeToAllUsers, DEFAULT_TENANT_ID } from '../firebase/realtime.js';

export function renderDispatchHistoryView(container, currentUser, onNavigate) {
  let allMessages = [];
  let allTeams = [];
  let allUsers = [];
  
  let selectedTeamId = 'all';
  let selectedUserUid = 'all';
  let selectedChannel = 'all'; // 'all' | 'evolution_api' | 'wa.me'
  let selectedPeriod = 'all';  // 'all' | 'today' | 'week'
  let searchQuery = '';

  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isMember = currentUser?.role === 'member';

  container.innerHTML = `
    <div class="page-content" style="max-width: 1300px; padding: 1.25rem;">
      <!-- Top Title & Stats Banner -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px; margin: 0;">
              📜 Histórico de Envios
            </h2>
            <span class="pill-btn" style="background: #ECFDF5; color: #059669; font-weight: 700; font-size: 0.75rem; border: 1px solid #10B981;">
              ● Tempo Real
            </span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.3rem 0 0 0;">
            ${isAdmin ? 'Visão global de todos os disparos da campanha.' : isCoordinator ? `Disparos da equipe ${currentUser.team_name || ''}.` : 'Histórico de mensagens disparadas por você.'}
          </p>
        </div>

        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
          <button id="btn-goto-dispatch" class="btn-green-action" style="padding: 0.55rem 1.15rem; font-size: 0.85rem;">
            ⚡ Ir para Disparador
          </button>
        </div>
      </div>

      <!-- KPI Metric Cards (Executivo e Limpo) -->
      <div class="metrics-row" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="kpi-card" style="border-top: 3px solid #3B82F6;">
          <span class="kpi-card-title">TOTAL DE ENVIOS</span>
          <span class="kpi-card-value" id="kpi-hist-total" style="color: #1E293B;">0</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Disparos registrados</span>
        </div>

        <div class="kpi-card" style="border-top: 3px solid #10B981;">
          <span class="kpi-card-title">VIA EVOLUTION API</span>
          <span class="kpi-card-value" id="kpi-hist-api" style="color: #059669;">0</span>
          <span style="font-size: 0.75rem; color: #059669; margin-top: 0.2rem;">⚡ Automáticos</span>
        </div>

        <div class="kpi-card" style="border-top: 3px solid #F59E0B;">
          <span class="kpi-card-title">VIA WHATSAPP WEB</span>
          <span class="kpi-card-value" id="kpi-hist-manual" style="color: #D97706;">0</span>
          <span style="font-size: 0.75rem; color: #D97706; margin-top: 0.2rem;">📱 Manuais / wa.me</span>
        </div>

        <div class="kpi-card" style="border-top: 3px solid #8B5CF6;">
          <span class="kpi-card-title">HOJE</span>
          <span class="kpi-card-value" id="kpi-hist-today" style="color: #7C3AED;">0</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Envios nas últimas 24h</span>
        </div>
      </div>

      <!-- Clean Filter Card -->
      <div class="main-panel-card" style="padding: 1.25rem; margin-bottom: 1.5rem; background: #FFFFFF;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem; align-items: flex-end;">
          
          <!-- Search input -->
          <div style="grid-column: span 2; min-width: 260px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
              Buscar no Histórico
            </label>
            <div style="position: relative;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="hist-search-input" class="topbar-search-input" placeholder="Buscar por destinatário, telefone, mensagem, operador..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.3rem; background: #F8FAFC; font-size: 0.82rem;">
            </div>
          </div>

          <!-- Team Filter (Admin Only) -->
          ${isAdmin ? `
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                Equipe / Coordenador
              </label>
              <select id="hist-team-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
                <option value="all">🌐 Todas as Equipes</option>
              </select>
            </div>
          ` : ''}

          <!-- Operator / User Filter (Admin & Coordinator) -->
          ${!isMember ? `
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                Operador / Líder
              </label>
              <select id="hist-user-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
                <option value="all">👥 Todos os Operadores</option>
              </select>
            </div>
          ` : ''}

          <!-- Channel Filter -->
          <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
              Canal de Envio
            </label>
            <select id="hist-channel-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
              <option value="all">Todos os Canais</option>
              <option value="evolution_api">⚡ Evolution API</option>
              <option value="wa.me">📱 WhatsApp Web (wa.me)</option>
            </select>
          </div>

          <!-- Period Filter -->
          <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
              Período
            </label>
            <select id="hist-period-select" class="topbar-search-input" style="width: 100%; background: #F8FAFC; font-size: 0.82rem;">
              <option value="all">Todo o Histórico</option>
              <option value="today">Hoje</option>
              <option value="week">Últimos 7 dias</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Messages Table Card (Desktop) & List (Mobile) -->
      <div class="main-panel-card" style="background: #FFFFFF; overflow: hidden;">
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA;">
          <span id="hist-count-label" style="font-size: 0.83rem; font-weight: 700; color: var(--text-main);">
            Carregando histórico...
          </span>
        </div>

        <!-- Desktop Table -->
        <div class="table-container" style="display: block;">
          <table class="panel-table" style="font-size: 0.83rem;">
            <thead>
              <tr>
                <th style="width: 140px;">DATA / HORA</th>
                <th style="width: 180px;">REMETENTE</th>
                <th style="width: 220px;">DESTINATÁRIO</th>
                <th style="width: 160px;">LOCALIZAÇÃO</th>
                <th>MENSAGEM ENVIADA</th>
                <th style="width: 130px;">CANAL</th>
                <th style="width: 110px; text-align: center;">STATUS</th>
              </tr>
            </thead>
            <tbody id="hist-tbody">
              <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                  Carregando mensagens do histórico...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile List (Feed) -->
        <div id="hist-mobile-feed" style="display: none; padding: 0.5rem;"></div>
      </div>
    </div>

    <!-- Modal Visualizar Mensagem Completa -->
    <div id="modal-view-msg" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 520px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">
            💬 Detalhes da Mensagem
          </h3>
          <button id="btn-close-view-msg" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <div style="padding: 1.5rem;">
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; font-size: 0.85rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div><strong>Destinatário:</strong> <span id="modal-msg-contact">—</span></div>
              <div><strong>Telefone:</strong> <span id="modal-msg-phone">—</span></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <div><strong>Remetente:</strong> <span id="modal-msg-sender">—</span></div>
              <div><strong>Data/Hora:</strong> <span id="modal-msg-date">—</span></div>
            </div>
          </div>

          <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
            Texto Enviado:
          </label>
          <div id="modal-msg-body" style="background: #DCF8C6; color: #1E293B; padding: 1rem; border-radius: var(--radius-md); font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; border: 1px solid #C4E7A5;">
            —
          </div>
        </div>
      </div>
    </div>
  `;

  // Responsive switch between Table and Feed
  function checkResponsive() {
    const isMobile = window.innerWidth <= 768;
    const tableContainer = container.querySelector('.table-container');
    const mobileFeed = container.querySelector('#hist-mobile-feed');
    if (tableContainer && mobileFeed) {
      tableContainer.style.display = isMobile ? 'none' : 'block';
      mobileFeed.style.display = isMobile ? 'block' : 'none';
    }
  }
  checkResponsive();
  window.addEventListener('resize', checkResponsive);

  function formatDate(timestamp) {
    if (!timestamp) return '—';
    let date = null;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hoje às ${timeStr}`;
    
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${dateStr} às ${timeStr}`;
  }

  function applyFiltersAndRender() {
    let filtered = [...allMessages];

    // Filtro de Equipe (Admin)
    if (selectedTeamId !== 'all') {
      filtered = filtered.filter(m => m.team_id === selectedTeamId);
    }

    // Filtro de Usuário
    if (selectedUserUid !== 'all') {
      filtered = filtered.filter(m => m.user_uid === selectedUserUid);
    }

    // Filtro de Canal
    if (selectedChannel !== 'all') {
      filtered = filtered.filter(m => m.strategy === selectedChannel);
    }

    // Filtro de Período
    if (selectedPeriod !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(m => {
        let t = 0;
        if (m.sent_at?.toMillis) t = m.sent_at.toMillis();
        else if (m.confirmed_at?.toMillis) t = m.confirmed_at.toMillis();
        else if (m.created_at?.toMillis) t = m.created_at.toMillis();
        else if (m.created_at) t = new Date(m.created_at).getTime();

        if (selectedPeriod === 'today') return t >= startOfToday;
        if (selectedPeriod === 'week') return t >= sevenDaysAgo;
        return true;
      });
    }

    // Filtro de Busca de Texto
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m => 
        (m.contact_name && m.contact_name.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q)) ||
        (m.user_name && m.user_name.toLowerCase().includes(q)) ||
        (m.message_body && m.message_body.toLowerCase().includes(q)) ||
        (m.contact_city && m.contact_city.toLowerCase().includes(q)) ||
        (m.contact_neighborhood && m.contact_neighborhood.toLowerCase().includes(q))
      );
    }

    renderKPIs(allMessages);
    renderList(filtered);
  }

  function renderKPIs(list) {
    const totalEl = container.querySelector('#kpi-hist-total');
    const apiEl = container.querySelector('#kpi-hist-api');
    const manualEl = container.querySelector('#kpi-hist-manual');
    const todayEl = container.querySelector('#kpi-hist-today');

    const total = list.length;
    const apiCount = list.filter(m => m.strategy === 'evolution_api').length;
    const manualCount = list.filter(m => m.strategy === 'wa.me').length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = list.filter(m => {
      let t = 0;
      if (m.sent_at?.toMillis) t = m.sent_at.toMillis();
      else if (m.confirmed_at?.toMillis) t = m.confirmed_at.toMillis();
      else if (m.created_at?.toMillis) t = m.created_at.toMillis();
      return t >= startOfToday.getTime();
    }).length;

    if (totalEl) totalEl.textContent = total;
    if (apiEl) apiEl.textContent = apiCount;
    if (manualEl) manualEl.textContent = manualCount;
    if (todayEl) todayEl.textContent = todayCount;
  }

  function renderList(list) {
    const tbody = container.querySelector('#hist-tbody');
    const mobileFeed = container.querySelector('#hist-mobile-feed');
    const countLabel = container.querySelector('#hist-count-label');

    if (countLabel) {
      countLabel.textContent = `Mostrando ${list.length} mensagem(ns) enviada(s)`;
    }

    // Render Tabela Desktop
    if (tbody) {
      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
              Nenhum disparo encontrado com os filtros selecionados.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = list.map(m => {
          const dateFormatted = formatDate(m.sent_at || m.confirmed_at || m.created_at);
          const channelBadge = m.strategy === 'evolution_api'
            ? '<span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-size: 0.72rem; font-weight: 700;">⚡ Evolution API</span>'
            : '<span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.72rem; font-weight: 700;">📱 WhatsApp Web</span>';
          
          const statusBadge = (m.status === 'confirmed' || m.strategy === 'evolution_api')
            ? '<span class="status-pill ativo">CONFIRMADO</span>'
            : '<span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.72rem;">ABERTO</span>';

          const locText = [m.contact_city, m.contact_neighborhood].filter(Boolean).join(' · ') || '—';
          const msgSnippet = (m.message_body || '').length > 60
            ? `${(m.message_body || '').substring(0, 60)}...`
            : (m.message_body || '—');

          return `
            <tr>
              <td style="color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">
                ${dateFormatted}
              </td>
              <td>
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.84rem;">
                  👤 ${m.user_name || 'Operador'}
                </div>
                ${m.team_name ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${m.team_name}</div>` : ''}
              </td>
              <td>
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">
                  ${m.contact_name || 'Sem Nome'}
                </div>
                <div style="font-family: monospace; font-size: 0.78rem; color: var(--text-muted);">
                  ${m.phone || '—'}
                </div>
              </td>
              <td style="color: var(--text-muted); font-size: 0.82rem;">
                ${locText}
              </td>
              <td>
                <div class="btn-open-msg-modal" data-id="${m.id}" style="cursor: pointer; color: var(--text-main); background: #F8FAFC; padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.8rem; line-height: 1.3;" title="Clique para ver a mensagem completa">
                  ${msgSnippet}
                </div>
              </td>
              <td>${channelBadge}</td>
              <td style="text-align: center;">${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Feed Mobile
    if (mobileFeed) {
      if (list.length === 0) {
        mobileFeed.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
            Nenhum disparo registrado ainda.
          </div>
        `;
      } else {
        mobileFeed.innerHTML = list.map(m => {
          const dateFormatted = formatDate(m.sent_at || m.confirmed_at || m.created_at);
          const channelBadge = m.strategy === 'evolution_api'
            ? '<span style="font-size: 0.68rem; font-weight: 700; color: #15803D; background: #DCFCE7; padding: 2px 6px; border-radius: 4px;">⚡ API</span>'
            : '<span style="font-size: 0.68rem; font-weight: 700; color: #1D4ED8; background: #EFF6FF; padding: 2px 6px; border-radius: 4px;">📱 Web</span>';
          
          const locText = [m.contact_city, m.contact_neighborhood].filter(Boolean).join(' · ');

          return `
            <div class="btn-open-msg-modal" data-id="${m.id}" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 0.75rem; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">${dateFormatted}</span>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  ${channelBadge}
                  <span style="font-size: 0.72rem; color: #15803D; font-weight: 700;">✓</span>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
                <strong style="font-size: 0.95rem; color: var(--text-main);">${m.contact_name}</strong>
                <span style="font-size: 0.78rem; font-family: monospace; color: var(--text-muted);">${m.phone}</span>
              </div>

              ${locText ? `<div style="font-size: 0.75rem; color: #64748B; margin-bottom: 0.45rem;">📍 ${locText}</div>` : ''}

              <div style="background: #F0FDF4; border-left: 3px solid #22C55E; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; color: #166534; line-height: 1.35;">
                ${m.message_body || ''}
              </div>

              <div style="margin-top: 0.45rem; font-size: 0.72rem; color: var(--text-muted); text-align: right;">
                Disparado por: <strong>${m.user_name || 'Operador'}</strong>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Modal click listeners
    container.querySelectorAll('.btn-open-msg-modal').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const msg = allMessages.find(m => m.id === id);
        if (!msg) return;

        const modal = container.querySelector('#modal-view-msg');
        container.querySelector('#modal-msg-contact').textContent = msg.contact_name || 'Sem Nome';
        container.querySelector('#modal-msg-phone').textContent = msg.phone || '—';
        container.querySelector('#modal-msg-sender').textContent = `${msg.user_name || 'Operador'} (${msg.team_name || 'Equipe'})`;
        container.querySelector('#modal-msg-date').textContent = formatDate(msg.sent_at || msg.confirmed_at || msg.created_at);
        container.querySelector('#modal-msg-body').textContent = msg.message_body || 'Sem conteúdo de texto';

        if (modal) modal.style.display = 'flex';
      });
    });
  }

  // Modal close handlers
  const modalView = container.querySelector('#modal-view-msg');
  container.querySelector('#btn-close-view-msg')?.addEventListener('click', () => {
    if (modalView) modalView.style.display = 'none';
  });

  // Filter input event listeners
  container.querySelector('#hist-search-input')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#hist-team-select')?.addEventListener('change', (e) => {
    selectedTeamId = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#hist-user-select')?.addEventListener('change', (e) => {
    selectedUserUid = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#hist-channel-select')?.addEventListener('change', (e) => {
    selectedChannel = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#hist-period-select')?.addEventListener('change', (e) => {
    selectedPeriod = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#btn-goto-dispatch')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('dispatch');
  });

  // Subscriptions em tempo real
  const unsubMessages = subscribeToMessagesHistory(
    { role: currentUser.role, teamId: currentUser.team_id, userUid: currentUser.uid },
    (msgs) => {
      allMessages = msgs;
      applyFiltersAndRender();
    }
  );

  let unsubTeams = null;
  if (isAdmin) {
    unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
      allTeams = teams;
      const teamSel = container.querySelector('#hist-team-select');
      if (teamSel) {
        teamSel.innerHTML = `
          <option value="all">🌐 Todas as Equipes</option>
          ${teams.map(t => `<option value="${t.id}">👥 ${t.name}</option>`).join('')}
        `;
      }
    });
  }

  let unsubUsers = null;
  if (!isMember) {
    unsubUsers = subscribeToAllUsers((users) => {
      allUsers = users;
      const userSel = container.querySelector('#hist-user-select');
      if (userSel) {
        let filteredUsers = users;
        if (isCoordinator) {
          filteredUsers = users.filter(u => u.team_id === currentUser.team_id || u.uid === currentUser.uid);
        }
        userSel.innerHTML = `
          <option value="all">👥 Todos os Operadores</option>
          ${filteredUsers.map(u => `<option value="${u.uid}">👤 ${u.name || u.email}</option>`).join('')}
        `;
      }
    });
  }

  return () => {
    window.removeEventListener('resize', checkResponsive);
    if (unsubMessages) unsubMessages();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
  };
}
