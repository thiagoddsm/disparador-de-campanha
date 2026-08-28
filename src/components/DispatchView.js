import { executeDispatch, confirmUserDispatch } from '../firebase/dispatchEngine.js';
import { 
  subscribeToOperatorContacts, 
  subscribeToTeamContacts, 
  subscribeToAllContacts, 
  subscribeToTeamMembers,
  subscribeToMessagesHistory, 
  subscribeToTemplates,
  resetContactStatus, 
  resetTeamContactsStatus 
} from '../firebase/realtime.js';
import { 
  getEvolutionConnectionState, 
  resolveSpintax, 
  sanitizeInstanceSlug,
  generateHierarchicalInstanceName 
} from '../firebase/evolutionApi.js';
import { logoutUser } from '../firebase/auth.js';
import { showToast } from '../utils/feedback.js';

export function renderDispatchView(container, currentUser, onNavigate) {
  let rawContacts = [];
  let contacts = [];
  let teamMembers = [];
  let selectedLeaderFilter = 'all'; // 'all' | 'mine' | '<uid>'
  let historyMessages = [];
  let availableTemplates = [];
  let templateText = localStorage.getItem('dispatch_active_template') || 'Olá {nome}, temos uma novidade especial para {empresa}!';
  
  const isMember = currentUser?.role === 'member';
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : 'Minha Equipe');
  
  const hierarchicalInstance = (currentUser?.team_name)
    ? generateHierarchicalInstanceName(currentUser.team_name, currentUser.role, currentUser.name)
    : null;
  const activeInstance = currentUser?.whatsapp?.instanceName ||
    localStorage.getItem('evolution_active_instance') ||
    hierarchicalInstance ||
    'IBM';

  let isApiConnected = false;
  let connectedPhone = null;
  let selectedStrategy = 'wa.me';
  let selectedContactIds = new Set();
  let isFirstLoad = true;

  // Anti-Ban state (Padrão: 1 mensagem a cada 1 minuto com Jitter humano de 50s a 70s)
  let isBatchRunning = false;
  let batchMinDelay = 50; // segundos
  let batchMaxDelay = 70; // segundos
  let enableComposing = true;

  // Renderiza layout de conversa estilo WhatsApp
  container.innerHTML = `
    <div class="wa-chat-container">
      
      <!-- WhatsApp Authentic Top Bar -->
      <div class="wa-chat-header" style="background: #008069; color: #FFFFFF; padding: 0.65rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
          <!-- Seta Voltar / Menu Lateral -->
          <button id="btn-chat-back-arrow" style="background: none; border: none; color: #FFFFFF; font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Voltar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>

          <!-- Foto Avatar -->
          <div style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; max-width: 40px; max-height: 40px; border-radius: 50%; overflow: hidden; border: 1.5px solid rgba(255,255,255,0.7); flex-shrink: 0; background: #E2E8F0;">
            <img src="${currentUser?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face'}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: block;">
          </div>

          <div style="min-width: 0; display: flex; flex-direction: column;">
            <h3 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
              ${isMember ? `Olá, ${currentUser?.name || 'Membro'}` : `Fila: Equipe ${teamLabel}`}
            </h3>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 1px;">
              <span style="font-size: 0.75rem; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <span id="queue-header-count">0</span> contatos na fila
              </span>
              <span id="wa-connection-indicator" style="font-size: 0.65rem; padding: 1px 6px; border-radius: 99px; background: rgba(255,255,255,0.2); color: #FFFFFF; font-weight: 700; white-space: nowrap;">
                Verificando...
              </span>
            </div>
          </div>
        </div>

        <!-- Engrenagem de Configurações -->
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <button id="btn-chat-settings-gear" style="background: none; border: none; color: #FFFFFF; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; padding: 0;" title="Configurações & Conexão WhatsApp">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- WhatsApp Chat Body -->
      <div class="wa-chat-body" id="wa-chat-body">
        
        <!-- Leader / Manager Queue Selector (Visible to Admin & Coord) -->
        ${!isMember ? `
          <div style="background: #FFFFFF; border-radius: 10px; padding: 0.65rem 0.85rem; border: 1px solid #CBD5E1; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="font-size: 0.9rem;">👥</span>
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">Filtrar por Fila:</span>
            </div>
            <select id="select-manager-leader-filter" style="font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; background: #F8FAFC; max-width: 200px;">
              <option value="all">🌐 Todos os Contatos da Equipe</option>
              <option value="mine">⭐ Minha Fila Direta</option>
            </select>
          </div>
        ` : ''}

        <!-- Quick Controls Top Bar inside Chat -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.4rem; align-items: center; flex: 1; min-width: 0;">
            <select id="select-quick-template" class="pill-btn" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: var(--text-main); font-size: 0.78rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 9999px; outline: none; cursor: pointer; flex: 1; min-width: 140px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <option value="">📄 Modelo: Escolher template... ⌵</option>
            </select>
            <button id="btn-preview-spintax" class="pill-btn" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: var(--text-main); font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; cursor: pointer;">
              🎲 Variação
            </button>
          </div>

          <button id="btn-toggle-queue-list" class="pill-btn" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #008069; font-size: 0.75rem; font-weight: 800; padding: 0.35rem 0.75rem; cursor: pointer;">
            👥 Fila (<span id="queue-badge-count">0</span>) ⌵
          </button>
        </div>

        <!-- Collapsible Queue Drawer / Card -->
        <div id="drawer-contacts-queue" style="display: none; background: #FFFFFF; border-radius: 12px; border: 1px solid var(--border-color); padding: 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-height: 320px; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; padding-bottom: 0.45rem; border-bottom: 1px solid var(--border-light);">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.82rem; font-weight: 700; color: var(--text-main); user-select: none;">
              <input type="checkbox" id="chk-select-all-contacts" checked style="width: 16px; height: 16px; accent-color: #25D366; cursor: pointer;">
              <span>Selecionar Todos</span>
            </label>
            <span id="selected-contacts-count-badge" style="font-size: 0.72rem; font-weight: 700; color: #008069; background: #E8F5E9; padding: 2px 8px; border-radius: 99px;">
              0 selecionados
            </span>
          </div>
          <div id="wa-queue-list-items" style="display: flex; flex-direction: column; gap: 0.4rem;">
            <!-- Contacts items -->
          </div>
        </div>

        <!-- Strategy Options Drawer -->
        <div id="drawer-options-menu" style="display: none; background: #FFFFFF; border-radius: 12px; border: 1px solid var(--border-color); padding: 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="font-size: 0.82rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">Método de Envio:</div>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;" id="strategy-selector-mount">
            <button type="button" id="strategy-btn-wame" class="pill-btn" style="flex: 1; justify-content: center; cursor: pointer; padding: 0.4rem 0.75rem; font-size: 0.75rem; font-weight: 700; background: #EFF6FF; color: #1D4ED8; border: 1.5px solid #3B82F6;">
              📱 WhatsApp Web (wa.me)
            </button>
            <button type="button" id="strategy-btn-api" class="pill-btn" style="flex: 1; justify-content: center; cursor: not-allowed; padding: 0.4rem 0.75rem; font-size: 0.75rem; font-weight: 700; background: #F3F4F6; color: #9CA3AF; border: 1.5px solid var(--border-color);" disabled>
              ⚡ Evolution API
            </button>
          </div>
        </div>

        <!-- Batch Progress Card (Live sending state) -->
        <div id="batch-progress-container" style="display: none; background: #FFFFFF; border-radius: 12px; padding: 0.85rem 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #008069;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong id="batch-status-text" style="font-size: 0.82rem; color: #008069;">Enviando mensagens...</strong>
            <span id="batch-counter-text" style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">0 / 0</span>
          </div>
          <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 9999px; overflow: hidden;">
            <div id="batch-progress-bar" style="width: 0%; height: 100%; background: #00A884; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- WhatsApp Sent Speech Bubble Preview -->
        <div class="wa-speech-bubble-sent">
          <div class="wa-speech-bubble-label">
            Visualização do Template:
          </div>
          <div id="wa-live-message-preview" style="white-space: pre-wrap;">${templateText}</div>
          <div class="wa-speech-bubble-time">
            <span id="wa-bubble-clock">14:02</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#53BDEB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline><polyline points="20 12 14 18"></polyline></svg>
          </div>
        </div>

      </div>

      <!-- WhatsApp Bottom Message Input Bar -->
      <div class="wa-chat-input-bar">
        <div class="wa-input-capsule">
          <textarea id="dispatch-template-input" class="wa-input-textarea" rows="1" placeholder="Digite uma mensagem...">${templateText}</textarea>
        </div>

        <button type="button" class="wa-send-btn-round" id="btn-start-batch-dispatch" title="Disparar para Toda a Lista">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg); margin-left: -2px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  `;

  // Atualiza relógio do balão
  function updateBubbleClock() {
    const clockEl = container.querySelector('#wa-bubble-clock');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }
  updateBubbleClock();

  function applyFilterAndRender() {
    if (selectedLeaderFilter === 'all') {
      contacts = [...rawContacts];
    } else if (selectedLeaderFilter === 'mine') {
      contacts = rawContacts.filter(c => c.assigned_to === currentUser.uid);
    } else {
      contacts = rawContacts.filter(c => c.assigned_to === selectedLeaderFilter);
    }

    if (isFirstLoad) {
      selectedContactIds = new Set(contacts.map(c => c.id));
      isFirstLoad = false;
    } else {
      const currentIds = new Set(contacts.map(c => c.id));
      selectedContactIds = new Set([...selectedContactIds].filter(id => currentIds.has(id)));
      if (selectedContactIds.size === 0 && contacts.length > 0) {
        selectedContactIds = new Set(contacts.map(c => c.id));
      }
    }

    renderQueueList();
  }

  // Renderiza Lista na Gaveta de Contatos
  function renderQueueList() {
    const listMount = container.querySelector('#wa-queue-list-items');
    const headerCount = container.querySelector('#queue-header-count');
    const badgeCount = container.querySelector('#queue-badge-count');
    const selectAllChk = container.querySelector('#chk-select-all-contacts');
    const selectedBadge = container.querySelector('#selected-contacts-count-badge');

    if (headerCount) headerCount.textContent = contacts.length;
    if (badgeCount) badgeCount.textContent = `${selectedContactIds.size}/${contacts.length}`;
    if (selectedBadge) selectedBadge.textContent = `${selectedContactIds.size} de ${contacts.length} selecionados`;
    if (selectAllChk) {
      selectAllChk.checked = contacts.length > 0 && selectedContactIds.size === contacts.length;
      selectAllChk.indeterminate = selectedContactIds.size > 0 && selectedContactIds.size < contacts.length;
    }

    if (!listMount) return;

    if (contacts.length === 0) {
      listMount.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">
          Nenhum contato atribuído nesta seleção.
        </div>
      `;
      return;
    }

    listMount.innerHTML = contacts.map(c => {
      const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
      const isOpened = c.status === 'opened';
      const initial = (c.name || 'C').charAt(0).toUpperCase();
      const isChecked = selectedContactIds.has(c.id);

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; background: ${isChecked ? '#F0FDF4' : '#F8FAFC'}; border: 1px solid ${isChecked ? '#BBF7D0' : 'transparent'}; border-radius: 8px; font-size: 0.8rem; transition: all 0.15s ease;">
          <div style="display: flex; align-items: center; gap: 0.55rem; min-width: 0; flex: 1; cursor: pointer;" class="contact-row-toggle" data-id="${c.id}">
            <input type="checkbox" class="chk-contact-item" data-id="${c.id}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #25D366; cursor: pointer; flex-shrink: 0;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${initial}</div>
            <div style="min-width: 0;">
              <div style="font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                <span>${c.phone}</span>
                ${c.assigned_to_name ? `<span>· ${c.assigned_to_name}</span>` : ''}
                ${isConfirmed ? `<span style="color: #15803D; font-weight: 700;">✓ Enviado</span>` : isOpened ? `<span style="color: #2563EB; font-weight: 600;">● Aberto</span>` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; margin-left: 0.5rem;">
            <button class="btn-quick-send-one" data-id="${c.id}" data-name="${c.name || ''}" data-phone="${c.phone}" data-city="${c.city || ''}" style="background: #25D366; color: #FFFFFF; border: none; font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.65rem; border-radius: 6px; cursor: pointer;" title="Enviar diretamente para este contato">
              📱 Enviar
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Listener checkbox individual
    listMount.querySelectorAll('.chk-contact-item').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) {
          selectedContactIds.add(id);
        } else {
          selectedContactIds.delete(id);
        }
        renderQueueList();
      });
    });

    // Listener clique no nome da linha para alternar checkbox
    listMount.querySelectorAll('.contact-row-toggle').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const id = row.getAttribute('data-id');
        if (selectedContactIds.has(id)) {
          selectedContactIds.delete(id);
        } else {
          selectedContactIds.add(id);
        }
        renderQueueList();
      });
    });

    // Listener de envio rápido individual
    listMount.querySelectorAll('.btn-quick-send-one').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const contactId = btn.getAttribute('data-id');
        const contactName = btn.getAttribute('data-name');
        const contactPhone = btn.getAttribute('data-phone');
        const contactCity = btn.getAttribute('data-city');

        const rawTemplate = textarea?.value || templateText;
        if (!rawTemplate.trim()) {
          showToast('Selecione ou digite um template antes de enviar.', 'error');
          return;
        }

        const processedMessage = resolveSpintax(rawTemplate);
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const strategyToUse = isApiConnected ? 'evolution_api' : 'wa.me';

        try {
          const dispatchRes = await executeDispatch({
            contactId,
            contactName,
            contactCompany: contactCity,
            contactPhone,
            user: currentUser,
            strategy: strategyToUse,
            templateBody: processedMessage
          });

          const targetContact = rawContacts.find(c => c.id === contactId);
          if (targetContact) {
            targetContact.status = strategyToUse === 'evolution_api' ? 'user_confirmed' : 'opened';
          }
          applyFilterAndRender();
          
          if (strategyToUse === 'evolution_api') {
            showToast(`Mensagem enviada com sucesso via WhatsApp API para ${contactName}!`, 'success');
          } else {
            showToast(`Conversa aberta no WhatsApp para ${contactName}!`, 'success');
          }
        } catch (err) {
          console.warn('Erro ao enviar contato:', err);
          showToast('Erro no envio: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '📱 Enviar';
        }
      });
    });
  }

  // Listener Selecionar Todos
  container.querySelector('#chk-select-all-contacts')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      contacts.forEach(c => selectedContactIds.add(c.id));
    } else {
      selectedContactIds.clear();
    }
    renderQueueList();
  });

  // Sincronização em Tempo Real de Digitação e Expansão Automática (Auto-resize)
  const textarea = container.querySelector('#dispatch-template-input');
  const preview = container.querySelector('#wa-live-message-preview');

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 24), 160);
    el.style.height = `${newHeight}px`;
  }

  // Inicializa o tamanho correto na carga inicial
  if (textarea) {
    autoResizeTextarea(textarea);
  }

  textarea?.addEventListener('input', (e) => {
    templateText = e.target.value;
    localStorage.setItem('dispatch_active_template', templateText);
    autoResizeTextarea(textarea);
    if (preview) {
      preview.textContent = templateText || 'Digite uma mensagem...';
    }
  });

  // Testar Variação Spintax
  container.querySelector('#btn-preview-spintax')?.addEventListener('click', () => {
    const raw = textarea?.value || templateText;
    const sample = resolveSpintax(raw).replace(/\{nome\}/gi, 'Roberto').replace(/\{empresa\}/gi, 'Centro').replace(/\{cidade\}/gi, 'Centro');
    if (preview) preview.textContent = sample;
  });

  // Gavetas Interativas
  container.querySelector('#btn-toggle-queue-list')?.addEventListener('click', () => {
    const drawer = container.querySelector('#drawer-contacts-queue');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Seletor de Fila por Líder (Admin e Coordenador)
  container.querySelector('#select-manager-leader-filter')?.addEventListener('change', (e) => {
    selectedLeaderFilter = e.target.value;
    applyFilterAndRender();
  });

  // Botão Engrenagem (Abre Configurações & Conexão WhatsApp)
  container.querySelector('#btn-chat-settings-gear')?.addEventListener('click', () => {
    if (onNavigate) {
      onNavigate('settings');
    }
  });

  // Botão Seta Voltar (Alterna menu ou vai para contatos)
  container.querySelector('#btn-chat-back-arrow')?.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    } else if (onNavigate) {
      onNavigate('contacts');
    }
  });

  // Disparo em Lote para os Contatos Selecionados (Ao tocar no botão de envio verde ➤)
  async function triggerBatchDispatch() {
    if (isBatchRunning) return;

    const targetContacts = contacts.filter(c => selectedContactIds.has(c.id));
    if (targetContacts.length === 0) {
      showToast('Selecione pelo menos um contato na fila para disparar.', 'warning');
      return;
    }

    // Guard: verificar se há template preenchido
    const textarea = container.querySelector('#dispatch-template-input');
    const currentTemplate = textarea?.value?.trim() || templateText?.trim();
    if (!currentTemplate) {
      showToast('Digite ou selecione um template antes de disparar.', 'error');
      return;
    }

    const total = targetContacts.length;
    if (!confirm(`Iniciar o envio para os ${total} contato(s) selecionados?`)) return;

    isBatchRunning = true;
    const progressContainer = container.querySelector('#batch-progress-container');
    const progressBar = container.querySelector('#batch-progress-bar');
    const statusText = container.querySelector('#batch-status-text');
    const counterText = container.querySelector('#batch-counter-text');
    const sendBtn = container.querySelector('#btn-start-batch-dispatch');

    if (progressContainer) progressContainer.style.display = 'block';
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.6';
    }

    let sentCount = 0;
    for (let i = 0; i < targetContacts.length; i++) {
      const contact = targetContacts[i];
      if (statusText) statusText.textContent = `Enviando para ${contact.name}...`;

      try {
        const rawTemplate = textarea?.value || templateText;
        const processedMessage = resolveSpintax(rawTemplate);
        const strategyToUse = isApiConnected ? 'evolution_api' : 'wa.me';

        const dispatchRes = await executeDispatch({
          contactId: contact.id,
          contactName: contact.name,
          contactCompany: contact.city,
          contactPhone: contact.phone,
          user: currentUser,
          strategy: strategyToUse,
          templateBody: processedMessage
        });

        if (strategyToUse === 'evolution_api') {
          contact.status = 'user_confirmed';
        } else {
          contact.status = 'opened';
          contact.last_message_id = dispatchRes.messageId;
        }

        sentCount++;
        const pct = Math.round((sentCount / total) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (counterText) counterText.textContent = `${sentCount} / ${total}`;
        applyFilterAndRender();

        // Aplica Jitter Delay entre envios (1 min)
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
    if (statusText) statusText.textContent = '🎉 Envio concluído com sucesso!';
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
    }
    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
    }, 5000);
  }

  container.querySelector('#btn-start-batch-dispatch')?.addEventListener('click', triggerBatchDispatch);

  // Escuta Contatos no Firestore
  let unsubscribeContacts = null;
  if (currentUser?.role === 'admin') {
    unsubscribeContacts = subscribeToAllContacts((data) => {
      rawContacts = data;
      applyFilterAndRender();
    });
  } else if (currentUser?.role === 'coordinator') {
    unsubscribeContacts = subscribeToTeamContacts(currentUser.team_id, (data) => {
      rawContacts = data;
      applyFilterAndRender();
    });
  } else {
    unsubscribeContacts = subscribeToOperatorContacts(currentUser.uid, (data) => {
      rawContacts = data;
      applyFilterAndRender();
    });
  }

  // Escuta Membros da Equipe para o Seletor de Fila (Admin / Coordenador)
  let unsubscribeMembers = null;
  if (!isMember) {
    unsubscribeMembers = subscribeToTeamMembers(currentUser?.team_id || null, null, (members) => {
      teamMembers = members;
      const leaderSel = container.querySelector('#select-manager-leader-filter');
      if (leaderSel) {
        leaderSel.innerHTML = `
          <option value="all" ${selectedLeaderFilter === 'all' ? 'selected' : ''}>🌐 Todos os Contatos</option>
          <option value="mine" ${selectedLeaderFilter === 'mine' ? 'selected' : ''}>⭐ Minha Fila Direta</option>
          ${teamMembers.map(m => `
            <option value="${m.uid}" ${selectedLeaderFilter === m.uid ? 'selected' : ''}>👤 ${m.name || m.email}</option>
          `).join('')}
        `;
      }
    });
  }

  // Escuta Templates no Firestore
  const unsubscribeTemplates = subscribeToTemplates(currentUser, (templates) => {
    availableTemplates = templates || [];
    const select = container.querySelector('#select-quick-template');
    if (select) {
      if (availableTemplates.length === 0) {
        select.innerHTML = `<option value="">📄 Sem templates cadastrados</option>`;
      } else {
        select.innerHTML = `
          <option value="">📄 Modelo: Escolher template... ⌵</option>
          ${availableTemplates.map(t => `
            <option value="${encodeURIComponent(t.body || '')}" ${t.body === templateText ? 'selected' : ''}>
              ${t.title || 'Sem título'}
            </option>
          `).join('')}
        `;
      }
    }
  });

  container.querySelector('#select-quick-template')?.addEventListener('change', (e) => {
    if (e.target.value) {
      const decodedBody = decodeURIComponent(e.target.value);
      if (textarea) {
        textarea.value = decodedBody;
        autoResizeTextarea(textarea);
      }
      templateText = decodedBody;
      localStorage.setItem('dispatch_active_template', decodedBody);
      if (preview) preview.textContent = decodedBody;
    }
  });

  // Checagem de Conexão Evolution API
  async function checkApiConnection() {
    try {
      const slug = sanitizeInstanceSlug(activeInstance);
      const res = await getEvolutionConnectionState(slug);
      const indicator = container.querySelector('#wa-connection-indicator');
      const apiBtn = container.querySelector('#strategy-btn-api');

      if (res.state === 'open') {
        isApiConnected = true;
        connectedPhone = res.phoneNumber;
        selectedStrategy = 'evolution_api';

        if (indicator) {
          indicator.innerHTML = '⚡ Envio Automático (API Ativa)';
          indicator.style.background = '#22C55E';
          indicator.style.color = '#FFFFFF';
        }

        if (apiBtn) {
          apiBtn.disabled = false;
          apiBtn.style.cursor = 'pointer';
          apiBtn.style.opacity = '1';
          apiBtn.innerHTML = `⚡ Evolution API (${connectedPhone || 'Online'})`;
          apiBtn.style.background = '#DCFCE7';
          apiBtn.style.color = '#15803D';
          apiBtn.style.border = '1.5px solid #22C55E';
        }
      } else {
        isApiConnected = false;
        selectedStrategy = 'wa.me';
        if (indicator) {
          indicator.innerHTML = '📱 WhatsApp Web (wa.me)';
          indicator.style.background = 'rgba(255,255,255,0.18)';
        }
      }
    } catch (e) {
      console.warn('Evolution check err:', e);
      isApiConnected = false;
      selectedStrategy = 'wa.me';
    }
  }
  checkApiConnection();

  // Cleanup de listeners
  return () => {
    if (unsubscribeContacts) unsubscribeContacts();
    if (unsubscribeMembers) unsubscribeMembers();
    if (unsubscribeTemplates) unsubscribeTemplates();
  };
}
