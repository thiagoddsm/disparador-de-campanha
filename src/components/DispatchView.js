import { executeDispatch, confirmUserDispatch } from '../firebase/dispatchEngine.js';
import { 
  subscribeToOperatorContacts, 
  subscribeToTeamContacts, 
  subscribeToAllContacts, 
  subscribeToMessagesHistory, 
  subscribeToTemplates,
  resetContactStatus, 
  resetTeamContactsStatus 
} from '../firebase/realtime.js';
import { getEvolutionConnectionState, resolveSpintax, sanitizeInstanceSlug } from '../firebase/evolutionApi.js';
import { logoutUser } from '../firebase/auth.js';

export function renderDispatchView(container, currentUser, onNavigate) {
  let contacts = [];
  let historyMessages = [];
  let availableTemplates = [];
  let templateText = localStorage.getItem('dispatch_active_template') || 'Olá {nome}, temos uma novidade especial para {empresa}!';
  
  const isMember = currentUser?.role === 'member';
  const teamLabel = currentUser?.team_name || (currentUser?.team_id ? 'Equipe Vinculada' : 'Jussara');
  let selectedStrategy = 'wa.me';

  const activeInstance = localStorage.getItem('evolution_active_instance') || 'alpha_coordenador_thiago';
  let isApiConnected = false;
  let connectedPhone = null;

  // Anti-Ban state (Padrão: 1 mensagem a cada 1 minuto com Jitter humano de 50s a 70s)
  let isBatchRunning = false;
  let batchMinDelay = 50; // segundos
  let batchMaxDelay = 70; // segundos
  let enableComposing = true;

  // Renderiza layout de conversa estilo WhatsApp (Fiel à imagem de referência)
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

          <!-- Foto Avatar com dimensões estritas 40x40 (Fixa o Bug de Tamanho) -->
          <div style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; max-width: 40px; max-height: 40px; border-radius: 50%; overflow: hidden; border: 1.5px solid rgba(255,255,255,0.7); flex-shrink: 0; background: #E2E8F0;">
            <img src="${currentUser?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face'}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: block;">
          </div>

          <div style="min-width: 0; display: flex; flex-direction: column;">
            <h3 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
              Lista: Equipe ${teamLabel}
            </h3>
            <span style="font-size: 0.75rem; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
              <span id="queue-header-count">0</span> contatos
            </span>
          </div>
        </div>

        <!-- Engrenagem de Configurações (Conexão WhatsApp & Ajustes) -->
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
        
        <!-- Yellow Security Notice Pill -->
        <div class="wa-security-notice">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>As mensagens enviadas aqui serão disparadas para toda a sua lista de contatos.</span>
        </div>

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
        <div id="drawer-contacts-queue" style="display: none; background: #FFFFFF; border-radius: 12px; border: 1px solid var(--border-color); padding: 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-height: 240px; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border-light);">
            <strong style="font-size: 0.85rem; color: var(--text-main);">Fila de Contatos da Equipe</strong>
            <button id="btn-reset-all-contacts" style="background: none; border: none; color: #DC2626; font-size: 0.75rem; font-weight: 700; cursor: pointer;">🔁 Resetar Status</button>
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
          <button type="button" id="btn-chat-emoji" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #8696A0; padding: 0; display: flex; align-items: center;">
            😊
          </button>
          
          <textarea id="dispatch-template-input" class="wa-input-textarea" rows="1" placeholder="Digite uma mensagem...">${templateText}</textarea>
          
          <button type="button" id="btn-chat-attach" style="background: none; border: none; color: #8696A0; cursor: pointer; padding: 0; display: flex; align-items: center;" title="Anexo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          <button type="button" style="background: none; border: none; color: #8696A0; cursor: pointer; padding: 0; display: flex; align-items: center;" title="Câmera">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </button>
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

  // Renderiza Lista na Gaveta de Contatos
  function renderQueueList() {
    const listMount = container.querySelector('#wa-queue-list-items');
    const headerCount = container.querySelector('#queue-header-count');
    const badgeCount = container.querySelector('#queue-badge-count');

    if (headerCount) headerCount.textContent = contacts.length;
    if (badgeCount) badgeCount.textContent = contacts.length;

    if (!listMount) return;

    if (contacts.length === 0) {
      listMount.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">
          Nenhum contato atribuído nesta equipe.
        </div>
      `;
      return;
    }

    listMount.innerHTML = contacts.map(c => {
      const isConfirmed = c.status === 'user_confirmed' || c.status === 'sent' || c.status === 'delivered';
      const initial = (c.name || 'C').charAt(0).toUpperCase();

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: #F8FAFC; border-radius: 8px; font-size: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; min-width: 0; flex: 1;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${initial}</div>
            <div style="min-width: 0;">
              <div style="font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${c.phone}</div>
            </div>
          </div>

          <div>
            ${isConfirmed ? `
              <span style="color: #15803D; font-weight: 700; font-size: 0.72rem;">✓ Enviado</span>
            ` : `
              <span style="color: #D97706; font-weight: 700; font-size: 0.72rem;">Pendente</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  // Sincronização em Tempo Real de Digitação
  const textarea = container.querySelector('#dispatch-template-input');
  const preview = container.querySelector('#wa-live-message-preview');

  textarea?.addEventListener('input', (e) => {
    templateText = e.target.value;
    localStorage.setItem('dispatch_active_template', templateText);
    if (preview) {
      preview.textContent = templateText || 'Digite uma mensagem...';
    }
  });

  // Testar Variação Spintax
  container.querySelector('#btn-preview-spintax')?.addEventListener('click', () => {
    const raw = textarea?.value || templateText;
    const sample = resolveSpintax(raw).replace(/\{nome\}/gi, 'Roberto').replace(/\{empresa\}/gi, 'Centro');
    if (preview) preview.textContent = sample;
  });

  // Gavetas Interativas
  container.querySelector('#btn-toggle-queue-list')?.addEventListener('click', () => {
    const drawer = container.querySelector('#drawer-contacts-queue');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    }
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

  // Resetar Status de Contatos
  container.querySelector('#btn-reset-all-contacts')?.addEventListener('click', async () => {
    if (confirm('Deseja resetar o status de todos os contatos para permitir um novo envio?')) {
      await resetTeamContactsStatus(currentUser?.team_id);
      contacts.forEach(c => c.status = 'pending');
      renderQueueList();
    }
  });

  // Disparo em Lote (Ao tocar no botão de envio verde ➤)
  async function triggerBatchDispatch() {
    if (isBatchRunning) return;

    const pendingContacts = contacts.filter(c => c.status === 'pending' || !c.status);
    if (pendingContacts.length === 0) {
      alert('Não há contatos pendentes para envio na sua fila.');
      return;
    }

    const total = pendingContacts.length;
    if (!confirm(`Iniciar o envio automático para ${total} contato(s) da lista?`)) return;

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
    for (let i = 0; i < pendingContacts.length; i++) {
      const contact = pendingContacts[i];
      if (statusText) statusText.textContent = `Enviando para ${contact.name}...`;

      try {
        const rawTemplate = textarea?.value || templateText;
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
          contact.last_message_id = dispatchRes.messageId;
        }

        sentCount++;
        const pct = Math.round((sentCount / total) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (counterText) counterText.textContent = `${sentCount} / ${total}`;
        renderQueueList();

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
      contacts = data;
      renderQueueList();
    });
  } else if (currentUser?.role === 'coordinator') {
    unsubscribeContacts = subscribeToTeamContacts(currentUser.team_id, (data) => {
      contacts = data;
      renderQueueList();
    });
  } else {
    unsubscribeContacts = subscribeToOperatorContacts(currentUser.uid, (data) => {
      contacts = data;
      renderQueueList();
    });
  }

  // Escuta Templates no Firestore
  const unsubscribeTemplates = subscribeToTemplates(currentUser, (templates) => {
    availableTemplates = templates;
    const select = container.querySelector('#select-quick-template');
    if (select) {
      if (templates.length === 0) {
        select.innerHTML = `<option value="">📄 Sem templates cadastrados</option>`;
      } else {
        select.innerHTML = `
          <option value="">📄 Escolher Modelo de Mensagem... ⌵</option>
          ${templates.map(t => `
            <option value="${encodeURIComponent(t.body)}">
              ${t.title} (${t.category || 'Geral'})
            </option>
          `).join('')}
        `;
      }
    }
  });

  container.querySelector('#select-quick-template')?.addEventListener('change', (e) => {
    if (e.target.value) {
      const decodedBody = decodeURIComponent(e.target.value);
      if (textarea) textarea.value = decodedBody;
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
      const apiBtn = container.querySelector('#strategy-btn-api');

      if (res.connected) {
        isApiConnected = true;
        connectedPhone = res.phone;
        if (apiBtn) {
          apiBtn.disabled = false;
          apiBtn.style.cursor = 'pointer';
          apiBtn.style.opacity = '1';
          apiBtn.innerHTML = `⚡ Evolution API (${connectedPhone || 'Online'})`;
        }
      }
    } catch (e) {
      console.warn('Evolution check err:', e);
    }
  }
  checkApiConnection();

  // Cleanup de listeners
  return () => {
    if (unsubscribeContacts) unsubscribeContacts();
    if (unsubscribeTemplates) unsubscribeTemplates();
  };
}

