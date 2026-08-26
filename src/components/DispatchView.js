import { executeDispatch, confirmUserDispatch } from '../firebase/dispatchEngine.js';
import { subscribeToMemberContacts, subscribeToTeamContacts, subscribeToAllContacts } from '../firebase/realtime.js';

export function renderDispatchView(container, currentUser) {
  let contacts = [];
  let templateText = '';
  
  const isMember = currentUser?.role === 'member';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : '');
  let selectedStrategy = 'wa.me';

  container.innerHTML = `
    <div class="page-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Envio de Mensagens</h2>
            ${isMember && teamLabel ? `
              <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem;">
                👥 Equipe: ${teamLabel}
              </span>
            ` : ''}
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            Dispare mensagens personalizadas e confirme o envio após abrir o WhatsApp${isMember && teamLabel ? ` (Equipe: ${teamLabel})` : ''}.
          </p>
        </div>

      </div>

      ${isMember ? `
        <div class="note-box-blue" style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.1rem;">🚀</span>
            <span style="font-size: 0.82rem; color: #1E40AF;"><strong>Disparo Automático via API:</strong> Disponível em breve para sua equipe.</span>
          </div>
          <span class="pill-btn" style="background: #DBEAFE; color: #1E40AF; font-size: 0.7rem;">Modo Atual: wa.me</span>
        </div>
      ` : ''}

      <!-- Two-Column Grid -->
      <div class="dispatch-split-grid">
        <!-- Left Column: Template Editor -->
        <div class="template-editor-card">
          <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Template Editor
          </div>

          <div class="note-box-blue">
            <div style="display: flex; gap: 0.4rem;">
              <span style="font-weight: bold;">ⓘ</span>
              <span>Use <strong>{nome}</strong> para personalizar o nome do destinatário.</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-main);">Mensagem da Abordagem</label>
            <span style="font-size: 0.72rem; color: var(--text-light);" id="char-counter">Máx 1024 char</span>
          </div>

          <textarea id="dispatch-template-input" class="template-textarea" placeholder="Digite a mensagem...">${templateText}</textarea>
        </div>

        <!-- Right Column: Lista de Contatos -->
        <div class="main-panel-card" style="margin-bottom: 0;">
          <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Fila de Disparos (${isMember ? 'Meus Leads' : 'Leads da Equipe'})
            </div>

            <div style="position: relative; width: 200px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="dispatch-search-input" class="topbar-search-input" placeholder="Buscar contato..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2rem; background: #FFFFFF; font-size: 0.8rem;">
            </div>
          </div>

          <div class="table-container">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>TELEFONE</th>
                  <th style="text-align: right;">AÇÃO / STATUS</th>
                </tr>
              </thead>
              <tbody id="dispatch-tbody">
                <tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando contatos...</td></tr>
              </tbody>
            </table>
          </div>

          <div style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-muted);">
            <span id="dispatch-count-label">Mostrando 0 contato(s)</span>
          </div>
        </div>
      </div>
    </div>
  `;

  function renderTable(filterQuery = '') {
    const tbody = container.querySelector('#dispatch-tbody');
    const countLabel = container.querySelector('#dispatch-count-label');
    if (!tbody) return;

    const filtered = contacts.filter(c => !filterQuery || (c.name && c.name.toLowerCase().includes(filterQuery.toLowerCase())) || (c.phone && c.phone.includes(filterQuery)));

    if (countLabel) countLabel.textContent = `Mostrando ${filtered.length} contato(s)`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            🎉 Todos os seus contatos foram disparados ou nenhum contato pendente!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
      const isOpened = c.status === 'opened';
      const initial = (c.name || 'C').charAt(0).toUpperCase();

      let actionHtml = '';
      if (isConfirmed) {
        actionHtml = `
          <button class="btn-outline-white" disabled style="background: #F3F4F6; color: #6B7280; font-size: 0.78rem; padding: 0.4rem 0.75rem;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Enviado ✓
          </button>
        `;
      } else if (isOpened) {
        actionHtml = `
          <button class="btn-confirm-now" data-id="${c.id}" data-msg-id="${c.last_message_id || ''}" style="background: #1D4ED8; color: white; border: none; border-radius: var(--radius-md); font-size: 0.78rem; padding: 0.45rem 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Confirmar Envio
          </button>
        `;
      } else {
        actionHtml = `
          <button class="btn-green-action btn-send-now" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Enviar
          </button>
        `;
      }

      return `
        <tr>
          <td>
            <div class="user-identity-cell">
              <div class="user-identity-initials" style="background: ${isConfirmed ? '#DCFCE7' : isOpened ? '#FEF3C7' : '#EFF6FF'}; color: ${isConfirmed ? '#15803D' : isOpened ? '#B45309' : '#1D4ED8'};">${initial}</div>
              <span class="user-identity-name">${c.name}</span>
            </div>
          </td>
          <td style="font-family: monospace; color: #374151; font-size: 0.85rem;">${c.phone}</td>
          <td style="text-align: right;">${actionHtml}</td>
        </tr>
      `;
    }).join('');

    // Listener Enviar
    container.querySelectorAll('.btn-send-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const phone = btn.getAttribute('data-phone');

        btn.disabled = true;
        btn.innerHTML = 'Processando...';

        try {
          await executeDispatch({
            contactId: id,
            contactName: name,
            contactPhone: phone,
            user: currentUser,
            strategy: selectedStrategy,
            templateBody: container.querySelector('#dispatch-template-input')?.value
          });

          const target = contacts.find(c => c.id === id);
          if (target) target.status = 'opened';
          renderTable();
        } catch (err) {
          alert(err.message || 'Erro ao processar disparo.');
          btn.disabled = false;
          btn.innerHTML = `Enviar`;
        }
      });
    });

    // Listener Confirmar Envio
    container.querySelectorAll('.btn-confirm-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const msgId = btn.getAttribute('data-msg-id');

        btn.disabled = true;
        btn.innerHTML = 'Confirmando...';

        try {
          await confirmUserDispatch({
            contactId: id,
            messageId: msgId,
            user: currentUser
          });

          const target = contacts.find(c => c.id === id);
          if (target) target.status = 'user_confirmed';
          renderTable();
        } catch (err) {
          alert(err.message || 'Erro ao confirmar envio.');
          btn.disabled = false;
          btn.innerHTML = `Confirmar Envio`;
        }
      });
    });
  }

  // Subscribe aos contatos conforme o papel
  let unsubscribe = null;
  if (currentUser?.role === 'admin') {
    unsubscribe = subscribeToAllContacts((list) => {
      contacts = list;
      renderTable();
    });
  } else if (currentUser?.role === 'coordinator') {
    unsubscribe = subscribeToTeamContacts(currentUser?.team_id || 'team_alpha', (list) => {
      contacts = list;
      renderTable();
    });
  } else {
    unsubscribe = subscribeToMemberContacts(currentUser?.uid, (list) => {
      contacts = list;
      renderTable();
    });
  }

  container.querySelector('#dispatch-search-input')?.addEventListener('input', (e) => {
    renderTable(e.target.value);
  });

  return unsubscribe;
}
