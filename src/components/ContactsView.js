import { 
  subscribeToMemberContacts, 
  subscribeToTeamContacts, 
  subscribeToAllContacts, 
  addContactToFirestore, 
  reassignContactInTeam,
  subscribeToTeamMembers
} from '../firebase/realtime.js';

export function renderContactsView(container, currentUser, onNavigate) {
  let contacts = [];
  let teamMembers = [];
  const isMember = currentUser?.role === 'member';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isAdmin = currentUser?.role === 'admin';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : '');

  container.innerHTML = `
    <div class="page-content">
      <!-- Title & Actions Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">
              ${isMember ? 'Meus Contatos' : isCoordinator ? 'Contatos da Equipe' : 'Base Global de Contatos'}
            </h2>
            ${isMember && teamLabel ? `
              <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem;">
                👥 Equipe: ${teamLabel}
              </span>
            ` : ''}
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            ${isMember ? `Gerencie sua lista individual e acompanhe seus envios${teamLabel ? ` pela equipe <strong>${teamLabel}</strong>` : ''}.` : 'Gerencie e distribua contatos para sua equipe.'}
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
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
            Adicionar Contato
          </button>
        </div>
      </div>

      <!-- 3 Real KPI Cards -->
      <div class="metrics-row" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
        <div class="metric-box">
          <div class="metric-info">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--primary-blue); font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"></rect></svg>
              <span>Total de Contatos</span>
            </div>
            <span class="metric-big-num" id="kpi-contacts-total">0</span>
            <span style="font-size: 0.78rem; color: var(--whatsapp-green); font-weight: 600; margin-top: 0.4rem;">
              Base Conectada
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
              user_confirmed
            </span>
          </div>
          <div class="metric-icon-bubble" style="background: #F0FDF4; color: var(--whatsapp-green);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>

        <div class="metric-box">
          <div class="metric-info" style="width: 100%;">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: #B45309; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">
              <circle cx="12" cy="12" r="3"></circle>
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

          <div style="display: flex; gap: 0.6rem;">
            <button id="btn-filter-all" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">Todos</button>
            <button id="btn-filter-pending" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">Pendentes</button>
            <button id="btn-filter-opened" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">Abertos</button>
            <button id="btn-filter-confirmed" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">Confirmados</button>
          </div>
        </div>

        <div class="table-container">
          <table class="panel-table">
            <thead>
              <tr>
                <th>NOME</th>
                <th>TELEFONE</th>
                <th>EMPRESA / REGIÃO</th>
                ${!isMember ? '<th>ATRIBUÍDO A</th>' : ''}
                <th>STATUS</th>
                ${isCoordinator ? '<th style="text-align: right;">REATRIBUIR</th>' : ''}
              </tr>
            </thead>
            <tbody id="contacts-tbody">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando contatos...</td></tr>
            </tbody>
          </table>
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
            <input type="text" id="input-contact-phone" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="(11) 98765-4321" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Empresa / Região</label>
            <input type="text" id="input-contact-company" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: Bairro Centro">
          </div>
          ${!isMember ? `
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem;">Atribuir para Membro da Equipe</label>
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

    <!-- Modal Reatribuir Contato (Coordenador) -->
    <div id="modal-reassign" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 400px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Reatribuir Contato</h3>
          <button id="btn-close-reassign" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-reassign" style="padding: 1.5rem;">
          <input type="hidden" id="reassign-contact-id">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Transferir para o Operador:</label>
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

  function updateAssigneesSelect() {
    const assignSel = container.querySelector('#select-contact-assignee');
    const reassignSel = container.querySelector('#select-reassign-member');
    const options = [
      `<option value="${currentUser.uid}">${currentUser.name} (Eu)</option>`,
      ...teamMembers.map(m => `<option value="${m.uid}">${m.name} (${m.email})</option>`)
    ].join('');

    if (assignSel) assignSel.innerHTML = options;
    if (reassignSel) reassignSel.innerHTML = options;
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
    if (countLabel) countLabel.textContent = `Mostrando ${list.length} contato(s)`;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            Nenhum contato encontrado. Clique em <strong>Adicionar Contato</strong> para começar.
          </td>
        </tr>
      `;
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
          <td style="color: var(--text-muted); font-size: 0.85rem;">${c.company || '—'}</td>
          ${!isMember ? `
            <td style="font-size: 0.82rem; color: var(--text-main); font-weight: 500;">
              ${c.assigned_to_name || (c.assigned_to === currentUser.uid ? 'Você' : 'Atribuído')}
            </td>
          ` : ''}
          <td>${statusBadge}</td>
          ${isCoordinator ? `
            <td style="text-align: right;">
              <button class="btn-reassign-action btn-outline-white" data-id="${c.id}" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
                Reatribuir
              </button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    // Listeners de Reatribuição
    container.querySelectorAll('.btn-reassign-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        container.querySelector('#reassign-contact-id').value = id;
        container.querySelector('#modal-reassign').style.display = 'flex';
      });
    });
  }

  // Subscribe de acordo com o papel
  let unsubscribe = null;
  if (isAdmin) {
    unsubscribe = subscribeToAllContacts((realContacts) => {
      contacts = realContacts;
      renderTable(contacts);
    });
  } else if (isCoordinator) {
    unsubscribe = subscribeToTeamContacts(currentUser?.team_id || 'team_alpha', (realContacts) => {
      contacts = realContacts;
      renderTable(contacts);
    });
  } else {
    unsubscribe = subscribeToMemberContacts(currentUser?.uid, (realContacts) => {
      contacts = realContacts;
      renderTable(contacts);
    });
  }

  // Carrega membros da equipe para o dropdown de atribuição
  const unsubMembers = subscribeToTeamMembers(currentUser?.team_id, isCoordinator ? currentUser.uid : null, (members) => {
    teamMembers = members;
    updateAssigneesSelect();
  });

  // Busca e Filtros
  container.querySelector('#contacts-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(contacts.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)));
  });

  container.querySelector('#btn-filter-all')?.addEventListener('click', () => renderTable(contacts));
  container.querySelector('#btn-filter-pending')?.addEventListener('click', () => {
    renderTable(contacts.filter(c => c.status === 'pending'));
  });
  container.querySelector('#btn-filter-opened')?.addEventListener('click', () => {
    renderTable(contacts.filter(c => c.status === 'opened'));
  });
  container.querySelector('#btn-filter-confirmed')?.addEventListener('click', () => {
    renderTable(contacts.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed'));
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
    const assignedName = assignSel ? assignSel.options[assignSel.selectedIndex]?.text : currentUser.name;

    try {
      await addContactToFirestore({
        name,
        phone,
        company,
        tenant_id: currentUser.tenant_id || 'tenant_main',
        team_id: currentUser.team_id || 'team_alpha',
        assigned_to: assignedUid,
        assigned_to_name: assignedName
      });
      modal.style.display = 'none';
      container.querySelector('#add-contact-form').reset();
    } catch (err) {
      alert('Erro ao adicionar contato.');
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
    const newName = reassignSel.options[reassignSel.selectedIndex]?.text;

    try {
      await reassignContactInTeam(contactId, newUid, newName);
      reassignModal.style.display = 'none';
    } catch (err) {
      alert('Erro ao reatribuir contato.');
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
    unsubMembers();
  };
}
