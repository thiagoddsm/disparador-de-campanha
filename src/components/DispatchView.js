import { executeDispatch, confirmUserDispatch } from '../firebase/dispatchEngine.js';
import { 
  subscribeToOperatorContacts, 
  subscribeToTeamContacts, 
  subscribeToAllContacts, 
  subscribeToMessagesHistory, 
  resetContactStatus, 
  resetTeamContactsStatus 
} from '../firebase/realtime.js';
import { getEvolutionConnectionState, resolveSpintax, sanitizeInstanceSlug } from '../firebase/evolutionApi.js';

export function renderDispatchView(container, currentUser) {
  let contacts = [];
  let historyMessages = [];
  let templateText = 'Olá {nome}, temos uma novidade especial para {empresa}!';
  let activeTab = 'queue'; // 'queue' | 'history'
  
  const isMember = currentUser?.role === 'member';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : '');
  let selectedStrategy = 'wa.me';

  const activeInstance = localStorage.getItem('evolution_active_instance') || 'alpha_coordenador_thiago';
  let isApiConnected = false;
  let connectedPhone = null;

  // Anti-Ban state (Padrão: 1 mensagem a cada 1 minuto com Jitter humano de 50s a 70s)
  let isBatchRunning = false;
  let batchMinDelay = 50; // segundos
  let batchMaxDelay = 70; // segundos
  let enableComposing = true;

  container.innerHTML = `
    <div class="page-content">
      <!-- Top Title & Navigation -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Envio & Histórico de Disparos</h2>
            <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.75rem;">
              👤 Minha Fila Individual: <span id="queue-header-count">0</span> contatos
            </span>
            ${currentUser?.team_id ? `
              <span class="pill-btn" style="background: #F8FAFC; color: var(--text-muted); font-weight: 600; font-size: 0.75rem; border: 1px solid var(--border-color);">
                👥 Equipe: <strong class="current-user-team-name">${currentUser?.team_name || 'Minha Equipe'}</strong>
              </span>
            ` : ''}
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            Cada líder visualiza e dispara exclusivamente a sua própria lista de contatos atribuídos.
          </p>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="tab-btn-queue" class="pill-btn" style="cursor: pointer; padding: 0.5rem 1rem; font-weight: 700; font-size: 0.82rem; background: #1D4ED8; color: #FFFFFF; border: none; transition: all 0.2s;">
            🎯 Minha Fila de Disparos
          </button>
          <button id="tab-btn-history" class="pill-btn" style="cursor: pointer; padding: 0.5rem 1rem; font-weight: 700; font-size: 0.82rem; background: #FFFFFF; color: var(--text-main); border: 1px solid var(--border-color); transition: all 0.2s;">
            📜 Histórico de Disparos (<span id="history-badge-count">0</span>)
          </button>
        </div>
      </div>

      <!-- Strategy Selector Card -->
      <div class="main-panel-card" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #FFFFFF;">
        <div>
          <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.2rem;">
            Método de Envio:
          </label>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;" id="strategy-explanation">
            Modo Assistido: O WhatsApp Web abrirá em nova aba para você revisar e enviar.
          </p>
        </div>

        <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;" id="strategy-selector-mount">
          <button type="button" id="strategy-btn-wame" class="pill-btn" style="cursor: pointer; padding: 0.45rem 0.9rem; font-size: 0.78rem; font-weight: 700; background: #EFF6FF; color: #1D4ED8; border: 1.5px solid #3B82F6; transition: all 0.2s;">
            📱 WhatsApp Web (wa.me)
          </button>
          <button type="button" id="strategy-btn-api" class="pill-btn" style="cursor: not-allowed; padding: 0.45rem 0.9rem; font-size: 0.78rem; font-weight: 700; background: #F3F4F6; color: #9CA3AF; border: 1.5px solid var(--border-color); opacity: 0.7; transition: all 0.2s;" disabled>
            ⚡ Evolution API Automático (Verificando...)
          </button>
        </div>
      </div>

      <!-- Content Container (Tabs) -->
      <div id="dispatch-view-main-content">
        <!-- Renders Queue or History below -->
      </div>
    </div>
  `;

  // Renderiza Aba Fila de Disparos
  function renderQueueTab() {
    const mainContent = container.querySelector('#dispatch-view-main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
      <div class="dispatch-split-grid">
        <!-- Left Column: Template Editor & Anti-Ban Controls -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Template Editor Card -->
          <div class="template-editor-card">
            <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Template Editor & Spintax
              </div>
              <button id="btn-preview-spintax" class="btn-outline-white" style="font-size: 0.72rem; padding: 0.25rem 0.55rem; font-weight: 600;">
                🎲 Gerar Variação
              </button>
            </div>

            <div class="note-box-blue" style="margin-bottom: 0.75rem;">
              <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem;">
                <div>🔹 Use <strong>{nome}</strong> para o nome e <strong>{empresa}</strong> para a empresa.</div>
                <div>🛡️ <strong>Anti-Ban Spintax:</strong> Use <code>{Olá|Oi|Bom dia}</code> para gerar textos únicos a cada disparo!</div>
              </div>
            </div>

            <div id="spintax-preview-box" style="display: none; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-sm); padding: 0.6rem; font-size: 0.78rem; color: #166534; margin-bottom: 0.75rem;">
              <strong>Prévia Sorteada:</strong> <span id="spintax-preview-text"></span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-main);">Mensagem da Abordagem</label>
              <span style="font-size: 0.72rem; color: var(--text-light);" id="char-counter">Máx 1024 char</span>
            </div>

            <textarea id="dispatch-template-input" class="template-textarea" placeholder="Digite a mensagem...">${templateText}</textarea>
          </div>

          <!-- Anti-Ban Controls Card -->
          <div class="main-panel-card" style="padding: 1.25rem; border-radius: var(--radius-lg); background: #FFFFFF;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <strong style="font-size: 0.9rem; color: var(--text-main);">Cadência Anti-Ban</strong>
              </div>
              <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-size: 0.7rem; font-weight: 700;">Seguro</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.82rem;">
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <span style="color: var(--text-main); font-weight: 600;">Intervalo entre Mensagens:</span>
                  <span id="delay-label" style="font-weight: 700; color: var(--primary-blue);">${batchMinDelay}s - ${batchMaxDelay}s (~1 min)</span>
                </div>
                
                <!-- Cadence Presets -->
                <div style="display: flex; gap: 0.4rem; margin-bottom: 0.6rem; flex-wrap: wrap;">
                  <button type="button" class="btn-cadence-preset pill-btn" data-sec="60" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; cursor: pointer;">
                    ☕ 1 min / msg (Padrão)
                  </button>
                  <button type="button" class="btn-cadence-preset pill-btn" data-sec="30" style="background: #F8FAFC; color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.72rem; font-weight: 600; padding: 3px 8px; cursor: pointer;">
                    ⏱️ 30s / msg
                  </button>
                  <button type="button" class="btn-cadence-preset pill-btn" data-sec="120" style="background: #F8FAFC; color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.72rem; font-weight: 600; padding: 3px 8px; cursor: pointer;">
                    🛡️ 2 min / msg
                  </button>
                </div>

                <input type="range" id="slider-jitter-delay" min="15" max="180" step="5" value="60" style="width: 100%; accent-color: var(--primary-blue); cursor: pointer;">
                <span style="font-size: 0.72rem; color: var(--text-muted);">Disparo suave e pausado para proteger o chip de qualquer restrição.</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 0.6rem;">
                <div>
                  <div style="font-weight: 600; color: var(--text-main);">Simular Digitação (Composing)</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">Mostra "digitando..." por 2.5s antes de cada envio</div>
                </div>
                <input type="checkbox" id="check-composing" ${enableComposing ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary-blue); cursor: pointer;">
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Fila de Leads & Ações de Disparo -->
        <div class="main-panel-card" style="margin-bottom: 0; display: flex; flex-direction: column;">
          
          <!-- Header Fila -->
          <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Fila de Leads (${isMember ? 'Meus Leads' : 'Leads da Equipe'})
              </div>
            </div>

            <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
              <div style="position: relative; width: 180px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="dispatch-search-input" class="topbar-search-input" placeholder="Buscar..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2rem; background: #FFFFFF; font-size: 0.8rem;">
              </div>

              <button id="btn-reset-all-contacts" class="btn-outline-white" style="font-size: 0.78rem; padding: 0.4rem 0.75rem; font-weight: 600;" title="Permite enviar novas mensagens para toda a lista">
                🔁 Resetar Fila
              </button>
            </div>
          </div>

          <!-- Batch Progress Bar (Visible during batch dispatch) -->
          <div id="batch-progress-container" style="display: none; padding: 1rem 1.5rem; background: #F8FAFC; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.4rem;">
              <span id="batch-status-text" style="color: var(--primary-blue);">Disparando lote...</span>
              <span id="batch-counter-text" style="color: var(--text-muted);">0 / 0</span>
            </div>
            <div style="width: 100%; height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden;">
              <div id="batch-progress-bar" style="width: 0%; height: 100%; background: #10B981; transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Tabela de Fila -->
          <div class="table-container" style="flex: 1;">
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

          <!-- Footer com Ação em Lote -->
          <div style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap; gap: 0.75rem;">
            <span id="dispatch-count-label">Mostrando 0 contato(s)</span>
            
            <button id="btn-start-batch-dispatch" class="btn-green-action" style="font-size: 0.82rem; padding: 0.5rem 1rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              🚀 Disparar Fila em Lote (Anti-Ban)
            </button>
          </div>

        </div>
      </div>
    `;

    bindQueueEvents();
    renderQueueTable();
  }

  // Renderiza Aba Histórico de Disparos
  function renderHistoryTab() {
    const mainContent = container.querySelector('#dispatch-view-main-content');
    if (!mainContent) return;

    const isMember = currentUser?.role === 'member';
    const isCoordinator = currentUser?.role === 'coordinator';
    const isAdmin = currentUser?.role === 'admin';

    const historyTitle = isAdmin 
      ? 'Histórico Geral de Mensagens Enviadas (Toda a Organização)'
      : isCoordinator
      ? `Histórico de Mensagens da Equipe (${currentUser?.team_name || 'Minha Equipe'})`
      : 'Meu Histórico Individual de Mensagens Enviadas';

    const historySubtitle = isAdmin
      ? 'Acompanhe todos os disparos executados por todos os coordenadores e líderes da campanha.'
      : isCoordinator
      ? 'Acompanhe todos os disparos executados por você e pelos líderes da sua equipe.'
      : 'Acompanhe o registro cronológico de todos os disparos efetuados pelo seu usuário.';

    mainContent.innerHTML = `
      <div class="main-panel-card" style="border-radius: var(--radius-lg); background: #FFFFFF;">
        <!-- Header Histórico -->
        <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${historyTitle}</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              ${historySubtitle}
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div style="position: relative; width: 220px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="history-search-input" class="topbar-search-input" placeholder="Filtrar histórico..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2rem; background: #FFFFFF; font-size: 0.8rem;">
            </div>
          </div>
        </div>

        <!-- Tabela do Histórico -->
        <div class="table-container">
          <table class="panel-table">
            <thead>
              <tr>
                <th style="width: 16%;">DATA / HORA</th>
                <th style="width: 18%;">DESTINATÁRIO</th>
                <th style="width: 14%;">MÉTODO</th>
                <th style="width: 14%;">STATUS</th>
                <th style="width: 26%;">PRÉVIA DO TEXTO</th>
                <th style="width: 12%; text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody id="history-tbody">
              ${historyMessages.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum disparo registrado no histórico ainda.</td></tr>
              ` : historyMessages.map(msg => {
                const dateStr = msg.created_at?.toDate ? msg.created_at.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
                const isEvolution = msg.strategy === 'evolution_api';
                return `
                  <tr>
                    <td style="font-size: 0.78rem; color: var(--text-muted);">${dateStr}</td>
                    <td>
                      <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${msg.contact_name || msg.phone || 'Destinatário'}</div>
                      <div style="font-family: monospace; font-size: 0.78rem; color: var(--text-muted);">${msg.phone || ''}</div>
                      ${msg.user_name ? `<div style="font-size: 0.7rem; color: var(--primary-blue);">👤 ${msg.user_name}</div>` : ''}
                    </td>
                    <td>
                      <span class="pill-btn" style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: ${isEvolution ? '#ECFDF5' : '#EFF6FF'}; color: ${isEvolution ? '#059669' : '#1D4ED8'}; font-weight: 600;">
                        ${isEvolution ? '⚡ Evolution API' : '📱 WhatsApp Web'}
                      </span>
                    </td>
                    <td>
                      <span class="pill-btn" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; background: #DCFCE7; color: #16A34A; font-weight: 700;">
                        ✓ Enviado
                      </span>
                    </td>
                    <td style="font-size: 0.8rem; color: #475569; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${msg.message_body || 'Mensagem enviada'}
                    </td>
                    <td style="text-align: right;">
                      <button class="btn-resend-single btn-outline-white" data-contact-id="${msg.contact_id || ''}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; font-weight: 600;" title="Permite enviar nova mensagem para este contato">
                        🔁 Novo Envio
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
          Total de ${historyMessages.length} registro(s) no histórico
        </div>
      </div>
    `;

    // Filtro no Histórico
    container.querySelector('#history-search-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = container.querySelectorAll('#history-tbody tr');
      rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? '' : 'none';
      });
    });

    // Reenviar a partir do Histórico
    container.querySelectorAll('.btn-resend-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cId = btn.getAttribute('data-contact-id');
        if (cId) {
          await resetContactStatus(cId);
          switchTab('queue');
        }
      });
    });
  }

  function renderQueueTable(filterQuery = '') {
    const tbody = container.querySelector('#dispatch-tbody');
    const countLabel = container.querySelector('#dispatch-count-label');
    if (!tbody) return;

    const filtered = contacts.filter(c => !filterQuery || (c.name && c.name.toLowerCase().includes(filterQuery.toLowerCase())) || (c.phone && c.phone.includes(filterQuery)));

    if (countLabel) countLabel.textContent = `Mostrando ${filtered.length} contato(s)`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            🎉 Todos os seus contatos foram disparados ou lista vazia! Clique em <strong>🔁 Resetar Fila</strong> para novo lote.
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
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <button class="btn-outline-white" disabled style="background: #F3F4F6; color: #6B7280; font-size: 0.78rem; padding: 0.35rem 0.65rem;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Enviado ✓
            </button>
            <button class="btn-resend-contact btn-outline-white" data-id="${c.id}" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;" title="Disparar nova mensagem para este contato">
              🔁 Reenviar
            </button>
          </div>
        `;
      } else if (isOpened && selectedStrategy === 'wa.me') {
        actionHtml = `
          <button class="btn-confirm-now" data-id="${c.id}" data-msg-id="${c.last_message_id || ''}" style="background: #1D4ED8; color: white; border: none; border-radius: var(--radius-md); font-size: 0.78rem; padding: 0.45rem 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Confirmar Envio
          </button>
        `;
      } else {
        const isApiMode = selectedStrategy === 'evolution_api';
        actionHtml = `
          <button class="btn-green-action btn-send-now" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone}" data-company="${c.company || ''}" style="${isApiMode ? 'background: #059669;' : ''}">
            ${isApiMode ? `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Disparo API
            ` : `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Enviar (wa.me)
            `}
          </button>
        `;
      }

      return `
        <tr>
          <td>
            <div class="user-identity-cell">
              <div class="user-identity-initials" style="background: ${isConfirmed ? '#DCFCE7' : isOpened ? '#FEF3C7' : '#EFF6FF'}; color: ${isConfirmed ? '#15803D' : isOpened ? '#B45309' : '#1D4ED8'};">${initial}</div>
              <div>
                <span class="user-identity-name">${c.name}</span>
                ${c.company ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${c.company}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="font-family: monospace; color: #374151; font-size: 0.85rem;">${c.phone}</td>
          <td style="text-align: right;">${actionHtml}</td>
        </tr>
      `;
    }).join('');

    // Listener de Disparo Individual
    container.querySelectorAll('.btn-send-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const phone = btn.getAttribute('data-phone');
        const company = btn.getAttribute('data-company');

        btn.disabled = true;
        btn.innerHTML = selectedStrategy === 'evolution_api' ? 'Enviando...' : 'Abrindo WhatsApp...';

        try {
          const rawTemplate = container.querySelector('#dispatch-template-input')?.value || templateText;
          const processedMessage = resolveSpintax(rawTemplate);

          const dispatchRes = await executeDispatch({
            contactId: id,
            contactName: name,
            contactCompany: company,
            contactPhone: phone,
            user: currentUser,
            strategy: selectedStrategy,
            templateBody: processedMessage
          });

          const target = contacts.find(c => c.id === id);

          if (selectedStrategy === 'evolution_api') {
            await confirmUserDispatch({
              contactId: id,
              messageId: dispatchRes.messageId,
              user: currentUser
            });
            if (target) target.status = 'user_confirmed';
          } else {
            if (target) {
              target.status = 'opened';
              target.last_message_id = dispatchRes.messageId;
            }
          }

          renderQueueTable();
        } catch (err) {
          alert(err.message || 'Erro ao processar disparo.');
          btn.disabled = false;
          btn.innerHTML = `Tentar Novamente`;
        }
      });
    });

    // Reenviar individual
    container.querySelectorAll('.btn-resend-contact').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await resetContactStatus(id);
        const target = contacts.find(c => c.id === id);
        if (target) target.status = 'pending';
        renderQueueTable();
      });
    });

    // Confirmar Envio (wa.me)
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
          renderQueueTable();
        } catch (err) {
          alert(err.message || 'Erro ao confirmar envio.');
          btn.disabled = false;
          btn.innerHTML = `Confirmar Envio`;
        }
      });
    });
  }

  function bindQueueEvents() {
    // Template Input & Char Counter
    const templateInput = container.querySelector('#dispatch-template-input');
    templateInput?.addEventListener('input', (e) => {
      templateText = e.target.value;
      const counter = container.querySelector('#char-counter');
      if (counter) counter.textContent = `${templateText.length}/1024 char`;
    });

    // Preview Spintax
    container.querySelector('#btn-preview-spintax')?.addEventListener('click', () => {
      const box = container.querySelector('#spintax-preview-box');
      const textSpan = container.querySelector('#spintax-preview-text');
      const raw = container.querySelector('#dispatch-template-input')?.value || '';
      const sample = resolveSpintax(raw).replace(/\{nome\}/gi, 'Marina').replace(/\{empresa\}/gi, 'Acme Corp');
      if (box && textSpan) {
        textSpan.textContent = sample;
        box.style.display = 'block';
      }
    });

    // Jitter Slider & Cadence Presets
    const jitterSlider = container.querySelector('#slider-jitter-delay');
    const delayLabel = container.querySelector('#delay-label');

    function applyCadence(targetSec) {
      batchMinDelay = Math.max(10, Math.floor(targetSec * 0.85));
      batchMaxDelay = Math.max(batchMinDelay + 5, Math.floor(targetSec * 1.15));
      const minText = targetSec >= 60 ? `~${Math.round(targetSec / 60)} min` : `${targetSec}s`;
      if (delayLabel) delayLabel.textContent = `${batchMinDelay}s - ${batchMaxDelay}s (${minText} / msg)`;
      if (jitterSlider) jitterSlider.value = targetSec;
    }

    jitterSlider?.addEventListener('input', (e) => {
      const targetSec = parseInt(e.target.value, 10);
      applyCadence(targetSec);
    });

    container.querySelectorAll('.btn-cadence-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.getAttribute('data-sec'), 10);
        applyCadence(sec);
        container.querySelectorAll('.btn-cadence-preset').forEach(b => {
          b.style.background = '#F8FAFC';
          b.style.color = 'var(--text-main)';
          b.style.borderColor = 'var(--border-color)';
        });
        btn.style.background = '#EFF6FF';
        btn.style.color = '#1D4ED8';
        btn.style.borderColor = '#BFDBFE';
      });
    });

    // Search Input
    container.querySelector('#dispatch-search-input')?.addEventListener('input', (e) => {
      renderQueueTable(e.target.value);
    });

    // Resetar Todos
    container.querySelector('#btn-reset-all-contacts')?.addEventListener('click', async () => {
      if (confirm('Deseja resetar o status de todos os contatos para permitir um novo disparo de mensagens?')) {
        await resetTeamContactsStatus(currentUser?.team_id);
        contacts.forEach(c => c.status = 'pending');
        renderQueueTable();
      }
    });

    // Disparo em Lote Automatizado (Anti-Ban)
    container.querySelector('#btn-start-batch-dispatch')?.addEventListener('click', async () => {
      if (isBatchRunning) return;

      const pendingContacts = contacts.filter(c => c.status === 'pending' || !c.status);
      if (pendingContacts.length === 0) {
        alert('Não há contatos pendentes para disparo.');
        return;
      }

      if (!confirm(`Iniciar disparo em lote para ${pendingContacts.length} contatos com proteção Anti-Ban?`)) {
        return;
      }

      isBatchRunning = true;
      const progressContainer = container.querySelector('#batch-progress-container');
      const progressBar = container.querySelector('#batch-progress-bar');
      const statusText = container.querySelector('#batch-status-text');
      const counterText = container.querySelector('#batch-counter-text');
      const batchBtn = container.querySelector('#btn-start-batch-dispatch');

      if (progressContainer) progressContainer.style.display = 'block';
      if (batchBtn) {
        batchBtn.disabled = true;
        batchBtn.innerHTML = 'Disparo em andamento...';
      }

      let sentCount = 0;
      const total = pendingContacts.length;

      for (let i = 0; i < total; i++) {
        const contact = pendingContacts[i];
        if (statusText) statusText.textContent = `Enviando para ${contact.name} (${contact.phone})...`;

        try {
          const rawTemplate = container.querySelector('#dispatch-template-input')?.value || templateText;
          const processedMessage = resolveSpintax(rawTemplate);

          const dispatchRes = await executeDispatch({
            contactId: contact.id,
            contactName: contact.name,
            contactCompany: contact.company,
            contactPhone: contact.phone,
            user: currentUser,
            strategy: selectedStrategy,
            templateBody: processedMessage
          });

          if (selectedStrategy === 'evolution_api') {
            await confirmUserDispatch({
              contactId: contact.id,
              messageId: dispatchRes.messageId,
              user: currentUser
            });
            contact.status = 'user_confirmed';
          } else {
            contact.status = 'opened';
          }

          sentCount++;
          const pct = Math.round((sentCount / total) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (counterText) counterText.textContent = `${sentCount} / ${total}`;
          renderQueueTable();

          // Aplica Jitter Delay entre envios
          if (i < total - 1) {
            const delaySec = Math.floor(Math.random() * (batchMaxDelay - batchMinDelay + 1)) + batchMinDelay;
            for (let s = delaySec; s > 0; s--) {
              if (statusText) statusText.textContent = `Pausa Anti-Ban de segurança... Próximo em ${s}s`;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        } catch (err) {
          console.warn(`Erro no disparo para ${contact.phone}:`, err);
        }
      }

      isBatchRunning = false;
      if (statusText) statusText.textContent = '🎉 Disparo em lote concluído com sucesso!';
      if (batchBtn) {
        batchBtn.disabled = false;
        batchBtn.innerHTML = '🚀 Disparar Fila em Lote (Anti-Ban)';
      }
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 5000);
    });
  }

  // Alternador de Abas
  function switchTab(tab) {
    activeTab = tab;
    const btnQueue = container.querySelector('#tab-btn-queue');
    const btnHist = container.querySelector('#tab-btn-history');

    if (tab === 'queue') {
      if (btnQueue) {
        btnQueue.style.background = '#1D4ED8';
        btnQueue.style.color = '#FFFFFF';
        btnQueue.style.border = 'none';
      }
      if (btnHist) {
        btnHist.style.background = '#FFFFFF';
        btnHist.style.color = 'var(--text-main)';
        btnHist.style.border = '1px solid var(--border-color)';
      }
      renderQueueTab();
    } else {
      if (btnHist) {
        btnHist.style.background = '#1D4ED8';
        btnHist.style.color = '#FFFFFF';
        btnHist.style.border = 'none';
      }
      if (btnQueue) {
        btnQueue.style.background = '#FFFFFF';
        btnQueue.style.color = 'var(--text-main)';
        btnQueue.style.border = '1px solid var(--border-color)';
      }
      renderHistoryTab();
    }
  }

  container.querySelector('#tab-btn-queue')?.addEventListener('click', () => switchTab('queue'));
  container.querySelector('#tab-btn-history')?.addEventListener('click', () => switchTab('history'));

  // Controle dos Botões de Estratégia
  const btnWame = container.querySelector('#strategy-btn-wame');
  const btnApi = container.querySelector('#strategy-btn-api');
  const expLabel = container.querySelector('#strategy-explanation');

  function updateStrategyUI() {
    if (selectedStrategy === 'wa.me') {
      btnWame.style.background = '#EFF6FF';
      btnWame.style.color = '#1D4ED8';
      btnWame.style.borderColor = '#3B82F6';

      if (isApiConnected) {
        btnApi.style.background = '#F8FAFC';
        btnApi.style.color = '#475569';
        btnApi.style.borderColor = 'var(--border-color)';
        btnApi.style.opacity = '1';
        btnApi.disabled = false;
        btnApi.style.cursor = 'pointer';
        btnApi.innerHTML = `⚡ Evolution API Automático (● Conectado)`;
      } else {
        btnApi.style.background = '#F3F4F6';
        btnApi.style.color = '#9CA3AF';
        btnApi.style.borderColor = 'var(--border-color)';
        btnApi.style.opacity = '0.7';
        btnApi.disabled = true;
        btnApi.style.cursor = 'not-allowed';
        btnApi.innerHTML = `⚡ Evolution API (Desconectado - usar wa.me)`;
      }
      expLabel.innerHTML = 'Modo Assistido: O WhatsApp Web abrirá em nova aba para você revisar e enviar.';
    } else {
      btnApi.style.background = '#ECFDF5';
      btnApi.style.color = '#059669';
      btnApi.style.borderColor = '#10B981';

      btnWame.style.background = '#F8FAFC';
      btnWame.style.color = '#475569';
      btnWame.style.borderColor = 'var(--border-color)';

      expLabel.innerHTML = `Modo Automático: As mensagens são enviadas diretamente pela Evolution API (Instância: <strong>${activeInstance}</strong>) com Anti-Ban e Jitter.`;
    }
    if (activeTab === 'queue') renderQueueTable();
  }

  btnWame?.addEventListener('click', () => {
    selectedStrategy = 'wa.me';
    updateStrategyUI();
  });

  btnApi?.addEventListener('click', () => {
    if (!isApiConnected) return;
    selectedStrategy = 'evolution_api';
    updateStrategyUI();
  });

  // Checa status da API em segundo plano
  async function checkApiConnection() {
    try {
      const stateRes = await getEvolutionConnectionState(activeInstance);
      if (stateRes.state === 'open') {
        isApiConnected = true;
        connectedPhone = stateRes.phoneNumber || 'Ativo';
        // Define Evolution API como primário padrão quando o chip estiver conectado
        selectedStrategy = 'evolution_api';
      } else {
        isApiConnected = false;
        selectedStrategy = 'wa.me';
      }
    } catch (e) {
      isApiConnected = false;
      selectedStrategy = 'wa.me';
    }
    updateStrategyUI();
  }
  checkApiConnection();

  // Subscriptions em tempo real: Cada líder vê estritamente apenas a sua lista atribuída
  const unsubContacts = subscribeToOperatorContacts(currentUser?.uid, (list) => {
    contacts = list;
    const headerCount = container.querySelector('#queue-header-count');
    if (headerCount) headerCount.textContent = contacts.length;
    if (activeTab === 'queue') renderQueueTable();
  });

  // Subscribe ao Histórico de Mensagens (/messages) respeitando a hierarquia
  const unsubHistory = subscribeToMessagesHistory({
    role: currentUser?.role,
    teamId: currentUser?.team_id,
    userUid: currentUser?.uid
  }, (msgs) => {
    historyMessages = msgs;
    const badge = container.querySelector('#history-badge-count');
    if (badge) badge.textContent = historyMessages.length;
    if (activeTab === 'history') renderHistoryTab();
  });

  // Render inicial
  renderQueueTab();

  return () => {
    if (unsubContacts) unsubContacts();
    if (unsubHistory) unsubHistory();
  };
}

