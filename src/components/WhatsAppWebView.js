import {
  fetchEvolutionChats,
  fetchEvolutionMessages,
  sendEvolutionDirectMessage,
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  getEvolutionPairingCode,
  getEvolutionQrCode
} from '../firebase/evolutionApi.js';
import { subscribeToTemplates, subscribeToAllContacts } from '../firebase/realtime.js';

export function renderWhatsAppWebView(container, currentUser, onViewChange) {
  let isDestroyed = false;
  let chatPollInterval = null;
  let msgPollInterval = null;
  let activeInstanceName = currentUser?.whatsapp_instance || currentUser?.whatsapp?.instanceName || 'jussara_operador_reginasouzasilv';
  let availableInstances = [];
  let chats = [];
  let filteredChats = [];
  let selectedChat = null;
  let currentMessages = [];
  let activeFilter = 'all'; // 'all' | 'unread' | 'groups'
  let searchQuery = '';
  let campaignContacts = [];
  let campaignTemplates = [];
  let isSending = false;
  let connectionState = 'unknown';

  // Subscrições do Firestore para autocompletar e templates rápidos
  const unsubContacts = subscribeToAllContacts((contacts) => {
    campaignContacts = contacts || [];
  });

  const unsubTemplates = subscribeToTemplates((templates) => {
    campaignTemplates = templates || [];
  });

  container.innerHTML = `
    <div class="wa-web-container">
      <!-- SIDEBAR ESQUERDA: LISTA DE CONVERSAS -->
      <aside class="wa-sidebar" id="wa-sidebar-pane">
        <!-- HEADER DA SIDEBAR -->
        <div class="wa-sidebar-header">
          <div class="wa-user-avatar-wrap">
            <div class="wa-user-avatar" id="wa-my-avatar">
              ${(currentUser?.name || 'R').charAt(0).toUpperCase()}
            </div>
            <div class="wa-user-info">
              <h3 class="wa-user-title">${currentUser?.name || 'Regina Souza'}</h3>
              <div class="wa-instance-badge" id="wa-status-badge">
                <span class="wa-status-dot dot-loading"></span>
                <span id="wa-status-text">Verificando...</span>
              </div>
            </div>
          </div>

          <div class="wa-header-actions">
            <!-- Botão Voltar ao App -->
            <button id="wa-btn-return-app" class="wa-icon-btn" title="Voltar ao Painel da Campanha" style="color: #008069;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </button>

            <!-- Seletor de Instância -->
            <select id="wa-instance-selector" class="wa-instance-select" title="Trocar Instância">
              <option value="${activeInstanceName}">Carregando instâncias...</option>
            </select>

            <!-- Botão Nova Conversa -->
            <button id="wa-btn-new-chat" class="wa-icon-btn" title="Iniciar Nova Conversa">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="8" x2="12" y2="14"></line>
                <line x1="9" y1="11" x2="15" y2="11"></line>
              </svg>
            </button>

            <!-- Botão Atualizar Chats -->
            <button id="wa-btn-refresh-chats" class="wa-icon-btn" title="Recarregar Conversas">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- BANNER DE RECONEXÃO (Caso esteja desconectado) -->
        <div id="wa-reconnect-banner" class="wa-reconnect-banner" style="display: none;">
          <div class="wa-banner-content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>WhatsApp Desconectado</span>
          </div>
          <button id="wa-btn-open-connect" class="wa-banner-btn">Reconectar (PIN / QR)</button>
        </div>

        <!-- BARRA DE BUSCA -->
        <div class="wa-search-box-wrap">
          <div class="wa-search-input-group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="wa-search-input" placeholder="Pesquisar ou começar uma nova conversa" autocomplete="off" />
            <button id="wa-btn-clear-search" class="wa-clear-search-btn" style="display: none;">&times;</button>
          </div>
        </div>

        <!-- FILTROS RÁPIDOS -->
        <div class="wa-filter-chips">
          <button class="wa-chip active" data-filter="all">Tudo</button>
          <button class="wa-chip" data-filter="unread">Não lidas</button>
          <button class="wa-chip" data-filter="groups">Grupos</button>
        </div>

        <!-- LISTA DE CHATS -->
        <div class="wa-chats-list" id="wa-chats-mount">
          <div class="wa-loading-state">
            <div class="wa-spinner"></div>
            <span>Carregando conversas do WhatsApp...</span>
          </div>
        </div>
      </aside>

      <!-- PAINEL DIREITO: CONVERSA ATIVA -->
      <main class="wa-chat-pane" id="wa-chat-pane">
        <!-- TELA INICIAL VAZIA (Sem conversa selecionada) -->
        <div class="wa-empty-chat-state" id="wa-empty-state">
          <div class="wa-empty-illustration">
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>
          <h2>WhatsApp Web da Campanha</h2>
          <p>Envie e receba mensagens diretamente pelo sistema com a sua conta do WhatsApp conectada.</p>
          <div class="wa-empty-security-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Protegido com Criptografia de ponta a ponta</span>
          </div>
        </div>

        <!-- ÁREA DA CONVERSA SELECIONADA -->
        <div class="wa-active-chat-container" id="wa-active-chat" style="display: none;">
          <!-- HEADER DO CHAT ATIVO -->
          <div class="wa-chat-header">
            <button id="wa-btn-mobile-back" class="wa-mobile-back-btn" title="Voltar para conversas">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>

            <div class="wa-chat-contact-info" id="wa-active-contact-info">
              <div class="wa-contact-avatar" id="wa-active-avatar">?</div>
              <div class="wa-contact-meta">
                <h3 class="wa-contact-name" id="wa-active-name">Carregando...</h3>
                <span class="wa-contact-sub" id="wa-active-phone">online</span>
              </div>
            </div>

            <div class="wa-chat-actions">
              <!-- Botão Inserir Template -->
              <button id="wa-btn-templates-menu" class="wa-action-pill" title="Modelos de Mensagem">
                ⚡ Templates
              </button>

              <!-- Botão Atualizar Mensagens -->
              <button id="wa-btn-refresh-active-msgs" class="wa-icon-btn" title="Atualizar esta conversa">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>
          </div>

          <!-- CORPO DAS MENSAGENS (COM WALLPAPER WHATSAPP) -->
          <div class="wa-messages-body" id="wa-messages-stream">
            <div class="wa-loading-state" style="padding-top: 4rem;">
              <div class="wa-spinner"></div>
              <span>Carregando mensagens...</span>
            </div>
          </div>

          <!-- FOOTER: BARRA DE DIGITAÇÃO -->
          <div class="wa-chat-footer">
            <!-- Dropdown rápido de Templates -->
            <div id="wa-templates-dropdown" class="wa-templates-dropdown" style="display: none;">
              <div class="wa-dropdown-header">
                <strong>Templates Cadastrados</strong>
                <button id="wa-btn-close-tpls" style="background: none; border: none; cursor: pointer; color: #8696A0; font-size: 1.1rem;">&times;</button>
              </div>
              <div class="wa-dropdown-list" id="wa-templates-mount"></div>
            </div>

            <div class="wa-input-row">
              <div class="wa-input-wrapper">
                <textarea 
                  id="wa-chat-input" 
                  rows="1" 
                  placeholder="Digite uma mensagem..."
                  autocomplete="off"
                ></textarea>
              </div>

              <button id="wa-btn-send" class="wa-send-btn" title="Enviar Mensagem (Enter)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- MODAL: NOVA CONVERSA -->
      <div id="wa-modal-new-chat" class="wa-modal" style="display: none;">
        <div class="wa-modal-card">
          <div class="wa-modal-header">
            <h3>Iniciar Nova Conversa</h3>
            <button id="wa-modal-btn-close" class="wa-modal-close-btn">&times;</button>
          </div>
          <div class="wa-modal-body">
            <label class="wa-modal-label">Número do WhatsApp (com DDD):</label>
            <div class="wa-phone-input-wrap">
              <span class="wa-flag-prefix">🇧🇷 +55</span>
              <input type="tel" id="wa-new-phone-input" placeholder="(21) 99999-8888" maxlength="16" />
            </div>

            <div style="margin-top: 1.25rem;">
              <label class="wa-modal-label">Ou escolha um contato da campanha:</label>
              <input type="text" id="wa-contact-picker-filter" placeholder="Buscar por nome na base..." class="wa-modal-text-input" />
              <div class="wa-contact-picker-list" id="wa-contact-picker-mount"></div>
            </div>
          </div>
          <div class="wa-modal-footer">
            <button id="wa-modal-btn-cancel" class="wa-btn-secondary">Cancelar</button>
            <button id="wa-modal-btn-start" class="wa-btn-primary">Abrir Conversa</button>
          </div>
        </div>
      </div>

      <!-- MODAL: RECONECTAR INSTÂNCIA (QR CODE / PIN) -->
      <div id="wa-modal-connect" class="wa-modal" style="display: none;">
        <div class="wa-modal-card">
          <div class="wa-modal-header">
            <h3>Conectar WhatsApp</h3>
            <button id="wa-modal-connect-close" class="wa-modal-close-btn">&times;</button>
          </div>
          <div class="wa-modal-body" style="text-align: center;">
            <p style="font-size: 0.9rem; color: #64748B; margin-bottom: 1.25rem;">
              Instância ativa: <strong id="wa-connect-instance-name">${activeInstanceName}</strong>
            </p>

            <div class="wa-connect-actions-row">
              <button id="wa-btn-gen-pin" class="wa-btn-primary" style="flex: 1;">
                Gerar PIN (8 Dígitos)
              </button>
              <button id="wa-btn-gen-qr" class="wa-btn-secondary" style="flex: 1;">
                Gerar QR Code
              </button>
            </div>

            <div id="wa-connect-result-mount" style="margin-top: 1.5rem;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Referências aos elementos do DOM
  const sidebarPane = container.querySelector('#wa-sidebar-pane');
  const chatPane = container.querySelector('#wa-chat-pane');
  const chatsMount = container.querySelector('#wa-chats-mount');
  const emptyState = container.querySelector('#wa-empty-state');
  const activeChatEl = container.querySelector('#wa-active-chat');
  const messagesStream = container.querySelector('#wa-messages-stream');
  const chatInput = container.querySelector('#wa-chat-input');
  const btnSend = container.querySelector('#wa-btn-send');
  const searchInput = container.querySelector('#wa-search-input');
  const btnClearSearch = container.querySelector('#wa-btn-clear-search');
  const instanceSelector = container.querySelector('#wa-instance-selector');
  const statusBadge = container.querySelector('#wa-status-badge');
  const statusText = container.querySelector('#wa-status-text');
  const reconnectBanner = container.querySelector('#wa-reconnect-banner');
  const modalNewChat = container.querySelector('#wa-modal-new-chat');
  const modalConnect = container.querySelector('#wa-modal-connect');
  const templatesDropdown = container.querySelector('#wa-templates-dropdown');
  const templatesMount = container.querySelector('#wa-templates-mount');

  // Ajusta altura do textarea dinamicamente
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Envio por tecla Enter (Shift+Enter pula linha)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  btnSend.addEventListener('click', handleSendMessage);

  // Carrega instâncias disponíveis
  async function loadAvailableInstances() {
    try {
      const res = await fetchEvolutionInstances();
      if (res.success && res.instances.length > 0) {
        availableInstances = res.instances;

        // Se houver a da Regina e o usuário não tiver uma personalizada, prioriza Regina
        const reginaInst = availableInstances.find(i => i.name.toLowerCase().includes('regina'));
        if (reginaInst && !currentUser?.whatsapp_instance) {
          activeInstanceName = reginaInst.name;
        }

        instanceSelector.innerHTML = availableInstances.map(inst => {
          const isSelected = inst.name === activeInstanceName;
          const label = inst.name.includes('regina') ? `👑 Regina (${inst.name})` : inst.name;
          return `<option value="${inst.name}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        }).join('');
      } else {
        instanceSelector.innerHTML = `<option value="${activeInstanceName}">${activeInstanceName}</option>`;
      }
    } catch (e) {
      console.warn('Erro ao carregar lista de instâncias:', e);
      instanceSelector.innerHTML = `<option value="${activeInstanceName}">${activeInstanceName}</option>`;
    }

    checkConnectionStatus();
    loadChats();
  }

  // Verifica status de conexão da instância
  async function checkConnectionStatus() {
    try {
      const check = await getEvolutionConnectionState(activeInstanceName);
      connectionState = check.state;

      const dot = statusBadge.querySelector('.wa-status-dot');
      dot.className = 'wa-status-dot';

      if (check.state === 'open') {
        dot.classList.add('dot-open');
        statusText.textContent = 'Conectado';
        statusBadge.title = `Conectado com o número ${check.phoneNumber || ''}`;
        reconnectBanner.style.display = 'none';
      } else if (check.state === 'connecting') {
        dot.classList.add('dot-connecting');
        statusText.textContent = 'Conectando...';
        reconnectBanner.style.display = 'none';
      } else {
        dot.classList.add('dot-close');
        statusText.textContent = 'Desconectado';
        reconnectBanner.style.display = 'flex';
      }
    } catch (e) {
      statusText.textContent = 'Status Indisponível';
    }
  }

  // Troca de instância ativa
  instanceSelector.addEventListener('change', (e) => {
    activeInstanceName = e.target.value;
    selectedChat = null;
    emptyState.style.display = 'flex';
    activeChatEl.style.display = 'none';
    checkConnectionStatus();
    loadChats();
  });

  // Carrega lista de conversas
  async function loadChats(silent = false) {
    if (!silent) {
      chatsMount.innerHTML = `
        <div class="wa-loading-state">
          <div class="wa-spinner"></div>
          <span>Carregando conversas do WhatsApp...</span>
        </div>
      `;
    }

    const res = await fetchEvolutionChats(activeInstanceName);

    if (isDestroyed) return;

    if (res.success) {
      chats = res.chats || [];
      // Ordena conversas pela mensagem mais recente
      chats.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.lastMessage?.messageTimestamp * 1000 || 0).getTime();
        const timeB = new Date(b.updatedAt || b.lastMessage?.messageTimestamp * 1000 || 0).getTime();
        return timeB - timeA;
      });
      applyFilterAndRenderChats();
    } else {
      if (!silent) {
        chatsMount.innerHTML = `
          <div class="wa-empty-list">
            <p>Nenhuma conversa encontrada ou instância sem histórico.</p>
            <button id="wa-retry-chats" class="wa-btn-secondary" style="margin-top: 0.75rem;">Tentar Novamente</button>
          </div>
        `;
        chatsMount.querySelector('#wa-retry-chats')?.addEventListener('click', () => loadChats());
      }
    }
  }

  // Filtra e renderiza os chats
  function applyFilterAndRenderChats() {
    filteredChats = chats.filter(chat => {
      // Filtro de busca
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (chat.pushName || '').toLowerCase();
        const jid = (chat.remoteJid || '').toLowerCase();
        const lastMsg = extractMessageText(chat.lastMessage).toLowerCase();
        if (!name.includes(q) && !jid.includes(q) && !lastMsg.includes(q)) {
          return false;
        }
      }

      // Filtro por Abas
      if (activeFilter === 'unread') {
        return (chat.unreadCount || 0) > 0;
      }
      if (activeFilter === 'groups') {
        return (chat.remoteJid || '').includes('@g.us');
      }

      return true;
    });

    if (filteredChats.length === 0) {
      chatsMount.innerHTML = `
        <div class="wa-empty-list">
          <p>${searchQuery ? 'Nenhuma conversa encontrada para a busca.' : 'Nenhuma conversa ativa no momento.'}</p>
        </div>
      `;
      return;
    }

    chatsMount.innerHTML = filteredChats.map(chat => {
      const isSelected = selectedChat && selectedChat.remoteJid === chat.remoteJid;
      const displayName = getChatDisplayName(chat);
      const avatarContent = getChatAvatar(chat, displayName);
      const lastMsgText = extractMessageText(chat.lastMessage);
      const timeStr = formatChatTimestamp(chat.updatedAt || chat.lastMessage?.messageTimestamp);
      const unreadBadge = chat.unreadCount > 0 ? `<span class="wa-unread-pill">${chat.unreadCount}</span>` : '';
      const isFromMe = chat.lastMessage?.key?.fromMe;
      const checkTicks = isFromMe ? `<span class="wa-ticks">✓✓</span> ` : '';

      return `
        <div class="wa-chat-item ${isSelected ? 'active' : ''}" data-jid="${chat.remoteJid}">
          <div class="wa-chat-avatar-wrap">
            ${avatarContent}
          </div>
          <div class="wa-chat-details">
            <div class="wa-chat-row-top">
              <span class="wa-chat-name" title="${displayName}">${displayName}</span>
              <span class="wa-chat-time">${timeStr}</span>
            </div>
            <div class="wa-chat-row-bottom">
              <span class="wa-chat-snippet" title="${lastMsgText}">
                ${checkTicks}${lastMsgText || 'Nenhuma mensagem'}
              </span>
              ${unreadBadge}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Adiciona listener de clique para selecionar o chat
    chatsMount.querySelectorAll('.wa-chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const jid = item.getAttribute('data-jid');
        const chat = chats.find(c => c.remoteJid === jid);
        if (chat) {
          selectConversation(chat);
        }
      });
    });
  }

  // Seleciona uma conversa e carrega as mensagens
  async function selectConversation(chat) {
    selectedChat = chat;
    applyFilterAndRenderChats();

    emptyState.style.display = 'none';
    activeChatEl.style.display = 'flex';

    // No mobile, esconde a lista de chats e exibe o painel de mensagens
    sidebarPane.classList.add('mobile-hide');
    chatPane.classList.add('mobile-show');

    // Atualiza cabeçalho do chat
    const displayName = getChatDisplayName(chat);
    container.querySelector('#wa-active-name').textContent = displayName;
    container.querySelector('#wa-active-phone').textContent = formatJidToPhone(chat.remoteJid);
    container.querySelector('#wa-active-avatar').innerHTML = getChatAvatar(chat, displayName);

    await loadMessagesForActiveChat();
    chatInput.focus();
  }

  // Carrega mensagens do chat ativo
  async function loadMessagesForActiveChat(silent = false) {
    if (!selectedChat) return;

    if (!silent) {
      messagesStream.innerHTML = `
        <div class="wa-loading-state" style="padding-top: 4rem;">
          <div class="wa-spinner"></div>
          <span>Carregando mensagens...</span>
        </div>
      `;
    }

    const res = await fetchEvolutionMessages(activeInstanceName, selectedChat.remoteJid, null, 80);

    if (isDestroyed || !selectedChat) return;

    if (res.success) {
      currentMessages = res.messages || [];
      renderMessagesStream(currentMessages);
      if (!silent) {
        scrollToBottom();
      }
    } else {
      if (!silent) {
        messagesStream.innerHTML = `
          <div class="wa-empty-list" style="padding-top: 3rem;">
            <p>Não foi possível carregar as mensagens.</p>
          </div>
        `;
      }
    }
  }

  // Renderiza a lista de mensagens na tela com separadores de data
  function renderMessagesStream(messages) {
    if (!messages || messages.length === 0) {
      messagesStream.innerHTML = `
        <div class="wa-empty-list" style="padding-top: 4rem;">
          <div class="wa-security-notice">
            🔒 As mensagens desta conversa são criptografadas. Digite abaixo para iniciar o diálogo.
          </div>
        </div>
      `;
      return;
    }

    let lastDateStr = '';
    let html = '';

    messages.forEach(msg => {
      const ts = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Number(msg.messageTimestamp) * 1000) : Date.now();
      const msgDate = new Date(ts);
      const dateStr = formatDateDivider(msgDate);

      // Separador de Data
      if (dateStr !== lastDateStr) {
        html += `<div class="wa-date-divider"><span>${dateStr}</span></div>`;
        lastDateStr = dateStr;
      }

      const isFromMe = msg.key?.fromMe;
      const text = extractMessageText(msg);
      const timeStr = formatMessageTime(msgDate);
      const checkTicks = isFromMe ? `<span class="wa-bubble-ticks">✓✓</span>` : '';
      const pushName = !isFromMe && msg.pushName ? `<div class="wa-bubble-sender">${msg.pushName}</div>` : '';

      html += `
        <div class="wa-message-row ${isFromMe ? 'msg-out' : 'msg-in'}">
          <div class="wa-message-bubble">
            ${pushName}
            <div class="wa-bubble-text">${escapeAndFormatHtml(text)}</div>
            <div class="wa-bubble-meta">
              <span class="wa-bubble-time">${timeStr}</span>
              ${checkTicks}
            </div>
          </div>
        </div>
      `;
    });

    messagesStream.innerHTML = html;
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesStream.scrollTop = messagesStream.scrollHeight;
    }, 50);
  }

  // Envia mensagem direta
  async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text || isSending || !selectedChat) return;

    isSending = true;
    btnSend.disabled = true;
    btnSend.style.opacity = '0.5';

    // Otimismo na interface: insere mensagem temporária imediatamente
    const optimisticMsg = {
      key: { fromMe: true, remoteJid: selectedChat.remoteJid, id: 'temp_' + Date.now() },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { conversation: text }
    };
    currentMessages.push(optimisticMsg);
    renderMessagesStream(currentMessages);
    scrollToBottom();

    chatInput.value = '';
    chatInput.style.height = 'auto';

    try {
      const res = await sendEvolutionDirectMessage({
        instanceName: activeInstanceName,
        to: selectedChat.remoteJid,
        text: text
      });

      if (res.success) {
        // Atualiza a conversa silenciosamente após o envio
        setTimeout(() => {
          loadMessagesForActiveChat(true);
          loadChats(true);
        }, 600);
      } else {
        alert('Erro ao enviar mensagem: ' + (res.error || 'Falha na Evolution API'));
      }
    } catch (err) {
      alert('Erro de conexão ao enviar: ' + err.message);
    } finally {
      isSending = false;
      btnSend.disabled = false;
      btnSend.style.opacity = '1';
      chatInput.focus();
    }
  }

  // ==========================================
  // HELPERS DE FORMATAÇÃO E PARSE
  // ==========================================
  function extractMessageText(msgObj) {
    if (!msgObj) return '';
    const m = msgObj.message || msgObj;
    if (!m) return '';

    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return `📷 ${m.imageMessage.caption}`;
    if (m.imageMessage) return '📷 Foto';
    if (m.audioMessage) return '🎵 Mensagem de voz';
    if (m.videoMessage?.caption) return `🎥 ${m.videoMessage.caption}`;
    if (m.videoMessage) return '🎥 Vídeo';
    if (m.documentMessage?.fileName) return `📄 ${m.documentMessage.fileName}`;
    if (m.documentMessage) return '📄 Documento';
    if (m.stickerMessage) return '🟣 Figurinha';
    if (m.contactMessage) return '👤 Contato';
    if (m.locationMessage) return '📍 Localização';
    if (m.reactionMessage) return `❤️ Reação ${m.reactionMessage.text || ''}`;
    if (m.secretEncryptedMessage) return '💬 Mensagem';
    return typeof m === 'string' ? m : '';
  }

  function getChatDisplayName(chat) {
    if (chat.pushName && !chat.pushName.includes('@')) return chat.pushName;
    const cleanPhone = formatJidToPhone(chat.remoteJid);
    // Verifica se existe na base de contatos da campanha
    const matchedContact = campaignContacts.find(c => {
      const p = (c.phone || c.whatsapp || '').replace(/\D/g, '');
      return p && cleanPhone.replace(/\D/g, '').includes(p);
    });
    if (matchedContact && matchedContact.name) {
      return matchedContact.name;
    }
    return cleanPhone;
  }

  function getChatAvatar(chat, name) {
    if (chat.profilePicUrl && !chat.profilePicUrl.includes('null')) {
      return `<img src="${chat.profilePicUrl}" alt="${name}" class="wa-avatar-img" />`;
    }
    const initial = (name || '?').charAt(0).toUpperCase();
    return `<div class="wa-avatar-initial">${initial}</div>`;
  }

  function formatJidToPhone(jid) {
    if (!jid) return '';
    const raw = jid.split('@')[0];
    if (raw.length >= 10 && raw.startsWith('55')) {
      const ddd = raw.slice(2, 4);
      const num = raw.slice(4);
      if (num.length === 9) {
        return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
      }
      return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    }
    return raw;
  }

  function formatChatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(typeof ts === 'number' && ts < 2000000000 ? ts * 1000 : ts);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function formatMessageTime(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateDivider(date) {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Hoje';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function escapeAndFormatHtml(text) {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Formatações estilo WhatsApp: *negrito*, _itálico_, ~tachado~
    return escaped
      .replace(/\*([^\*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~([^~]+)~/g, '<del>$1</del>')
      .replace(/\n/g, '<br/>');
  }

  // ==========================================
  // EVENT LISTENERS & FILTROS
  // ==========================================
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    btnClearSearch.style.display = searchQuery ? 'block' : 'none';
    applyFilterAndRenderChats();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    applyFilterAndRenderChats();
  });

  container.querySelectorAll('.wa-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.wa-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      applyFilterAndRenderChats();
    });
  });

  container.querySelector('#wa-btn-refresh-chats')?.addEventListener('click', () => {
    loadChats();
    checkConnectionStatus();
  });

  container.querySelector('#wa-btn-refresh-active-msgs')?.addEventListener('click', () => {
    loadMessagesForActiveChat();
  });

  container.querySelector('#wa-btn-mobile-back')?.addEventListener('click', () => {
    sidebarPane.classList.remove('mobile-hide');
    chatPane.classList.remove('mobile-show');
  });

  container.querySelector('#wa-btn-return-app')?.addEventListener('click', () => {
    if (onViewChange) {
      onViewChange(currentUser?.role === 'admin' ? 'admin' : 'dispatch');
    } else {
      window.location.href = '/';
    }
  });

  // Modal: Nova Conversa
  container.querySelector('#wa-btn-new-chat')?.addEventListener('click', () => {
    modalNewChat.style.display = 'flex';
    renderContactPicker();
  });

  container.querySelector('#wa-modal-btn-close')?.addEventListener('click', () => {
    modalNewChat.style.display = 'none';
  });
  container.querySelector('#wa-modal-btn-cancel')?.addEventListener('click', () => {
    modalNewChat.style.display = 'none';
  });

  function renderContactPicker() {
    const mount = container.querySelector('#wa-contact-picker-mount');
    const filterInput = container.querySelector('#wa-contact-picker-filter');

    function updatePickerList() {
      const q = (filterInput?.value || '').toLowerCase();
      const filtered = campaignContacts.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.phone || c.whatsapp || '').includes(q)
      ).slice(0, 15);

      if (filtered.length === 0) {
        mount.innerHTML = `<div style="padding: 0.75rem; font-size: 0.8rem; color: #8696A0; text-align: center;">Nenhum contato encontrado.</div>`;
        return;
      }

      mount.innerHTML = filtered.map(c => `
        <div class="wa-picker-item" data-phone="${c.phone || c.whatsapp}" data-name="${c.name}">
          <strong>${c.name}</strong>
          <span>${c.phone || c.whatsapp} • ${c.neighborhood || c.city || ''}</span>
        </div>
      `).join('');

      mount.querySelectorAll('.wa-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const phone = item.getAttribute('data-phone');
          const name = item.getAttribute('data-name');
          openNewChatByPhone(phone, name);
          modalNewChat.style.display = 'none';
        });
      });
    }

    filterInput?.addEventListener('input', updatePickerList);
    updatePickerList();
  }

  container.querySelector('#wa-modal-btn-start')?.addEventListener('click', () => {
    const raw = container.querySelector('#wa-new-phone-input').value.replace(/\D/g, '');
    if (raw.length < 10) {
      alert('Por favor, informe um número válido com DDD (Ex: 21999998888).');
      return;
    }
    openNewChatByPhone(raw);
    modalNewChat.style.display = 'none';
  });

  function openNewChatByPhone(phone, name = null) {
    const cleanDigits = phone.replace(/\D/g, '');
    const fullPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
    const jid = `${fullPhone}@s.whatsapp.net`;

    let existing = chats.find(c => c.remoteJid === jid);
    if (!existing) {
      existing = {
        remoteJid: jid,
        pushName: name || formatJidToPhone(jid),
        updatedAt: new Date().toISOString(),
        lastMessage: null,
        unreadCount: 0
      };
      chats.unshift(existing);
    }
    selectConversation(existing);
  }

  // Modal: Reconectar WhatsApp
  container.querySelector('#wa-btn-open-connect')?.addEventListener('click', () => {
    modalConnect.style.display = 'flex';
  });
  container.querySelector('#wa-modal-connect-close')?.addEventListener('click', () => {
    modalConnect.style.display = 'none';
  });

  const connectResultMount = container.querySelector('#wa-connect-result-mount');
  container.querySelector('#wa-btn-gen-pin')?.addEventListener('click', async () => {
    connectResultMount.innerHTML = `
      <div style="padding: 1.5rem; color: #1D4ED8; font-weight: 600;">
        <div class="wa-spinner" style="margin: 0 auto 0.5rem auto;"></div>
        Gerando PIN de 8 dígitos na Evolution API...
      </div>
    `;
    const res = await getEvolutionPairingCode(activeInstanceName, '5521988869796');
    if (res.success && res.pairingCode) {
      connectResultMount.innerHTML = `
        <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 1.25rem;">
          <h4 style="color: #166534; margin: 0 0 0.5rem 0;">Código PIN de Pareamento:</h4>
          <div style="font-size: 1.8rem; font-weight: 800; letter-spacing: 3px; color: #008069; margin: 0.5rem 0;">
            ${res.pairingCode}
          </div>
          <p style="font-size: 0.8rem; color: #15803D; margin: 0;">
            Abra o WhatsApp no celular > Aparelhos Conectados > Conectar com número de telefone e digite o código acima.
          </p>
        </div>
      `;
    } else {
      connectResultMount.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 1rem; color: #991B1B; font-size: 0.85rem;">
          ${res.error || 'Erro ao gerar PIN.'}
        </div>
      `;
    }
  });

  container.querySelector('#wa-btn-gen-qr')?.addEventListener('click', async () => {
    connectResultMount.innerHTML = `
      <div style="padding: 1.5rem; color: #1D4ED8; font-weight: 600;">
        <div class="wa-spinner" style="margin: 0 auto 0.5rem auto;"></div>
        Carregando QR Code...
      </div>
    `;
    const res = await getEvolutionQrCode(activeInstanceName);
    if (res.success && res.base64) {
      const src = res.base64.startsWith('data:') ? res.base64 : `data:image/png;base64,${res.base64}`;
      connectResultMount.innerHTML = `
        <div style="text-align: center;">
          <img src="${src}" alt="QR Code" style="width: 220px; height: 220px; border-radius: 8px; border: 1px solid #E2E8F0;" />
          <p style="font-size: 0.8rem; color: #64748B; margin-top: 0.5rem;">Escaneie com o WhatsApp</p>
        </div>
      `;
    } else {
      connectResultMount.innerHTML = `<p style="color: red;">${res.error || 'Falha ao carregar QR Code.'}</p>`;
    }
  });

  // Dropdown de Templates
  container.querySelector('#wa-btn-templates-menu')?.addEventListener('click', () => {
    const isVisible = templatesDropdown.style.display === 'block';
    if (isVisible) {
      templatesDropdown.style.display = 'none';
      return;
    }

    if (campaignTemplates.length === 0) {
      templatesMount.innerHTML = `<div style="padding: 0.75rem; font-size: 0.8rem; color: #8696A0;">Nenhum template cadastrado no sistema.</div>`;
    } else {
      templatesMount.innerHTML = campaignTemplates.map(tpl => `
        <div class="wa-template-item" data-text="${encodeURIComponent(tpl.text || tpl.content || '')}">
          <strong>${tpl.title || tpl.name || 'Template'}</strong>
          <p>${tpl.text || tpl.content || ''}</p>
        </div>
      `).join('');

      templatesMount.querySelectorAll('.wa-template-item').forEach(item => {
        item.addEventListener('click', () => {
          const rawText = decodeURIComponent(item.getAttribute('data-text'));
          chatInput.value = rawText;
          chatInput.dispatchEvent(new Event('input'));
          templatesDropdown.style.display = 'none';
          chatInput.focus();
        });
      });
    }

    templatesDropdown.style.display = 'block';
  });

  container.querySelector('#wa-btn-close-tpls')?.addEventListener('click', () => {
    templatesDropdown.style.display = 'none';
  });

  // ==========================================
  // POLLING PERIÓDICO EM SEGUNDO PLANO
  // ==========================================
  // 1. Atualiza lista de conversas a cada 8 segundos
  chatPollInterval = setInterval(() => {
    if (!isDestroyed) {
      loadChats(true);
      checkConnectionStatus();
    }
  }, 8000);

  // 2. Atualiza a conversa ativa a cada 3.5 segundos
  msgPollInterval = setInterval(() => {
    if (!isDestroyed && selectedChat) {
      loadMessagesForActiveChat(true);
    }
  }, 3500);

  // Inicializa dados
  loadAvailableInstances();

  // Cleanup na desmontagem da tela
  return () => {
    isDestroyed = true;
    if (chatPollInterval) clearInterval(chatPollInterval);
    if (msgPollInterval) clearInterval(msgPollInterval);
    if (unsubContacts) unsubContacts();
    if (unsubTemplates) unsubTemplates();
  };
}
