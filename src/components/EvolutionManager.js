import { 
  getEvolutionConnectionState, 
  getEvolutionQrCode, 
  logoutEvolutionInstance, 
  deleteEvolutionInstance,
  fetchEvolutionInstances,
  cleanupDisconnectedInstances,
  sanitizeInstanceSlug,
  generateHierarchicalInstanceName,
  EVOLUTION_CONFIG 
} from '../firebase/evolutionApi.js';
import { db } from '../firebase/config.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from '../utils/feedback.js';

export function renderEvolutionManager(container, currentUser) {
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isMember = !isAdmin && !isCoordinator;

  const teamLabel = currentUser?.team_name || currentUser?.team_id?.replace('team_', '') || 'alpha';
  const roleLabel = isAdmin ? 'admin' : (isCoordinator ? 'coordenador' : 'operador');
  const userFirst = (currentUser?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'operador').split(' ')[0];
  const defaultHierarchicalName = generateHierarchicalInstanceName(teamLabel, roleLabel, userFirst);

  let qrBase64 = null;
  let pollingTimer = null;
  let activeInstanceName = localStorage.getItem('evolution_active_instance') || defaultHierarchicalName;
  let serverInstances = [];

  const roleTitle = isAdmin 
    ? 'Instância do Administrador' 
    : isCoordinator 
    ? 'Instância da Coordenação' 
    : 'Minha Instância de WhatsApp (Operador)';

  container.innerHTML = `
    <div class="page-content">
      <!-- Title & Subtitle (Matching Image 2) -->
      <div style="margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: #1E293B; letter-spacing: -0.4px; margin-bottom: 0.25rem;">
          Conexão WhatsApp
        </h2>
        <p style="font-size: 0.9rem; color: #64748B;">
          Conecte o seu WhatsApp ao aplicativo
        </p>
      </div>

      <!-- Card 1: Instructions Box (Matching Image 2) -->
      <div class="main-panel-card" style="padding: 1.5rem; border-radius: var(--radius-lg); background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700; color: #1E293B; margin-bottom: 1.25rem; line-height: 1.4;">
          Para usar o WhatsApp no seu computador:
        </h3>

        <div style="display: flex; flex-direction: column; gap: 1.15rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #008069; color: #FFFFFF; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              1
            </div>
            <div style="font-size: 0.9rem; color: #334155; line-height: 1.4; font-weight: 500;">
              Abra o WhatsApp no seu celular
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #008069; color: #FFFFFF; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              2
            </div>
            <div style="font-size: 0.9rem; color: #334155; line-height: 1.4; font-weight: 500;">
              Toque em <strong>Menu ⋮</strong> no Android, ou <strong>Configurações ⚙️</strong> no iPhone
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #008069; color: #FFFFFF; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              3
            </div>
            <div style="font-size: 0.9rem; color: #334155; line-height: 1.4; font-weight: 500;">
              Toque em <strong>Aparelhos conectados</strong> e, em seguida, em <strong>Conectar um aparelho</strong>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #008069; color: #FFFFFF; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              4
            </div>
            <div style="font-size: 0.9rem; color: #334155; line-height: 1.4; font-weight: 500;">
              Aponte a câmera do seu celular para esta tela para capturar o código QR
            </div>
          </div>
        </div>

        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #F1F5F9;">
          <a href="#" id="btn-help-link" style="color: #008069; font-weight: 700; font-size: 0.88rem; text-decoration: none;">
            Precisa de ajuda para conectar?
          </a>
        </div>
      </div>

      <!-- Card 2: Instance & QR Code (Matching Image 2) -->
      <div class="main-panel-card" style="padding: 1.5rem; border-radius: var(--radius-lg); background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <span class="pill-btn" style="background: #F1F5F9; color: #475569; font-weight: 800; font-size: 0.75rem; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
              ${isAdmin ? 'ADMIN' : isCoordinator ? 'COORDENADOR' : 'OPERADOR'}
            </span>
            <div style="font-family: monospace; font-size: 0.85rem; color: #64748B; margin-top: 0.4rem;" id="instance-name-display">
              Instância: <strong style="color: #1E293B;">${activeInstanceName}</strong>
            </div>
          </div>

          <div id="connection-status-badge">
            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.82rem; font-weight: 700; padding: 0.35rem 0.85rem;">Verificando Status...</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- QR Code Viewer -->
          <div style="text-align: center; border: 2px dashed #CBD5E1; border-radius: var(--radius-lg); padding: 1.75rem; background: #F8FAFC;" id="qr-container">
            <div id="qr-content-mount">
              <div style="color: var(--text-muted); font-size: 0.9rem; padding: 2rem 0; line-height: 1.5;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📷</div>
                Toque no botão verde <strong>"Gerar QR Code de Conexão"</strong> abaixo para conectar seu WhatsApp.
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="btn-generate-qr" class="btn-wa-action" style="font-size: 1rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              Gerar QR Code de Conexão
            </button>

            <button id="btn-disconnect-instance" class="btn-outline-white" style="width: 100%; color: #DC2626; border-color: #FECACA; font-weight: 600; padding: 0.65rem; font-size: 0.85rem;">
              Desconectar meu WhatsApp
            </button>
          </div>

          ${isAdmin ? `
            <!-- Advanced Config (Collapsible) -->
            <details style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.65rem 0.85rem; background: #F8FAFC; font-size: 0.8rem;">
              <summary style="cursor: pointer; font-weight: 700; color: var(--text-muted);">
                ⚙️ Configurações Avançadas de Servidor
              </summary>
              <div style="margin-top: 0.85rem;">
                <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem;">Identificador da Instância (Slug)</label>
                <input type="text" id="input-instance-slug" class="topbar-search-input" style="width: 100%; margin-bottom: 0.65rem; background: white;" value="${activeInstanceName}">
                
                <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem;">Chave da Instância (Token)</label>
                <input type="password" id="input-api-key" class="topbar-search-input" style="width: 100%; margin-bottom: 0.65rem; background: white;" value="${localStorage.getItem('evolution_api_key') || EVOLUTION_CONFIG.apiKey}">
                
                <input type="text" id="input-api-url" class="topbar-search-input" style="width: 100%; margin-bottom: 0.65rem; background: white; font-size: 0.75rem;" value="${localStorage.getItem('evolution_api_url') || EVOLUTION_CONFIG.baseUrl}">
                <button id="btn-save-api-config" class="btn-outline-white" style="width: 100%; font-size: 0.75rem; padding: 0.4rem; font-weight: 700;">Salvar Configuração</button>
              </div>
            </details>
          ` : ''}
        </div>
      </div>

      ${isAdmin ? `
        <!-- Admin Section: Server Instances & Auto-Cleanup -->
        <div class="main-panel-card" style="padding: 1.5rem; margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="pill-btn" style="background: #FEE2E2; color: #DC2626; font-weight: 700; font-size: 0.72rem;">Admin Master</span>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Instâncias do Servidor & Limpeza Automática</h3>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                Monitore instâncias ativas no servidor Evolution API e remova automaticamente chips desconectados após X dias.
              </p>
            </div>

            <!-- Auto Cleanup Controls -->
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-main);">Retenção:</span>
                <select id="select-cleanup-days" class="form-control" style="width: auto; padding: 0.35rem 0.65rem; font-size: 0.8rem; font-weight: 600;">
                  <option value="3">3 dias desconectado</option>
                  <option value="7" selected>7 dias desconectado</option>
                  <option value="15">15 dias desconectado</option>
                  <option value="30">30 dias desconectado</option>
                </select>
              </div>
              <button id="btn-run-cleanup" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.85rem; color: #DC2626; border-color: #FECACA; font-weight: 700;">
                🧹 Limpar Instâncias Inativas
              </button>
              <button id="btn-refresh-server-instances" class="btn-outline-white" style="font-size: 0.8rem; padding: 0.45rem 0.75rem;">
                🔄 Atualizar Lista
              </button>
            </div>
          </div>

          <!-- Server Instances Table -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>NOME DA INSTÂNCIA</th>
                  <th>TELEFONE VINCULADO</th>
                  <th>STATUS NO SERVIDOR</th>
                  <th>ÚLTIMA ATIVIDADE</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody id="server-instances-tbody">
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Carregando instâncias do servidor...</td></tr>
              </tbody>
            </table>
          </div>

          <div class="team-mobile-card-list mobile-only" id="server-instances-mobile"></div>
        </div>

        <!-- Anti-Ban Rules Card (Padrão Oiko / FestaPay) -->
        <div class="main-panel-card" style="padding: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Regras Anti-Ban & Proteção de Chip (Padrão Oiko)</h3>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <strong style="font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 0.4rem;">
                ⏳ Human Jitter (Intervalo Randômico)
              </strong>
              <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Variação automática entre <strong>4s a 12s</strong> por disparo para evitar padrões repetitivos de bot.
              </p>
            </div>

            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <strong style="font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 0.4rem;">
                ✍️ Presença "Digitando..."
              </strong>
              <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Simula digitação real no WhatsApp durante 2.5s antes de despachar a mensagem.
              </p>
            </div>

            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <strong style="font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 0.4rem;">
                🔀 Spintax Dinâmico
              </strong>
              <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Suporte a variações como <code>{Olá|Oi|Bom dia}</code> gerando textos com hashes únicos.
              </p>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const statusBadge = container.querySelector('#connection-status-badge');
  const qrMount = container.querySelector('#qr-content-mount');
  const genQrBtn = container.querySelector('#btn-generate-qr');
  const disBtn = container.querySelector('#btn-disconnect-instance');
  const slugInput = container.querySelector('#input-instance-slug');

  let lastSavedState = null;

  async function checkStatus() {
    activeInstanceName = sanitizeInstanceSlug(slugInput?.value || activeInstanceName);
    const instanceNameDisplay = container.querySelector('#instance-name-display');
    if (instanceNameDisplay) {
      instanceNameDisplay.innerHTML = `Instância: <strong>${activeInstanceName}</strong>`;
    }

    const res = await getEvolutionConnectionState(activeInstanceName);
    if (res.state === 'open') {
      statusBadge.innerHTML = `<span class="pill-btn" style="background: #DCFCE7; color: #15803D;">● Conectado (${res.phoneNumber || 'Ativo'})</span>`;
      qrMount.innerHTML = `
        <div style="color: #15803D; padding: 1.5rem 0;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
          <strong>WhatsApp Conectado e Operacional!</strong>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Instância <strong>${activeInstanceName}</strong> vinculada e pronta para disparos.</p>
        </div>
      `;

      // Persiste no Firestore
      const stateKey = `${activeInstanceName}_open_${res.phoneNumber || ''}`;
      if (lastSavedState !== stateKey) {
        lastSavedState = stateKey;
        if (currentUser?.uid) {
          updateDoc(doc(db, 'users', currentUser.uid), {
            'whatsapp.enabled': true,
            'whatsapp.instanceName': activeInstanceName,
            'whatsapp.status': 'CONNECTED',
            'whatsapp.phoneNumber': res.phoneNumber || null,
            'whatsapp.updatedAt': serverTimestamp()
          }).catch(() => {});
        }
        if (currentUser?.team_id) {
          updateDoc(doc(db, 'teams', currentUser.team_id), {
            'whatsapp_instance': activeInstanceName,
            'whatsapp_connected': true,
            'whatsapp_phone': res.phoneNumber || null
          }).catch(() => {});
        }
      }
    } else if (res.state === 'connecting') {
      statusBadge.innerHTML = `<span class="pill-btn" style="background: #FEF3C7; color: #B45309;">Aguardando Leitura do QR Code...</span>`;
    } else if (res.state === 'error') {
      statusBadge.innerHTML = `<span class="pill-btn" style="background: #FEE2E2; color: #DC2626;">Chave Não Autorizada (401)</span>`;
      qrMount.innerHTML = `
        <div style="color: #DC2626; font-size: 0.83rem; padding: 1.5rem 0; line-height: 1.4;">
          <strong>Chave de Autenticação Inválida para ${activeInstanceName}.</strong>
          <p style="color: var(--text-muted); font-size: 0.78rem; margin-top: 0.35rem;">
            Copie o token da instância no painel Evolution (ou a chave global), cole no campo ao lado e clique em <strong>Salvar Token</strong>.
          </p>
        </div>
      `;
    } else if (res.state === 'not_found') {
      statusBadge.innerHTML = `<span class="pill-btn" style="background: #F1F5F9; color: #64748B;">Instância Não Criada</span>`;
    } else {
      statusBadge.innerHTML = `<span class="pill-btn" style="background: #F1F5F9; color: #64748B;">Desconectado</span>`;
    }
  }

  function startPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    let attempts = 0;
    pollingTimer = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(pollingTimer);
        return;
      }
      const st = await getEvolutionConnectionState(activeInstanceName);
      if (st.state === 'open') {
        clearInterval(pollingTimer);
        checkStatus();
        showToast('WhatsApp conectado com sucesso!', 'success');
      }
    }, 4000);
  }

  // Se for admin, carrega lista de instâncias do servidor
  async function loadServerInstances() {
    if (!isAdmin) return;
    const tbody = container.querySelector('#server-instances-tbody');
    const mobileContainer = container.querySelector('#server-instances-mobile');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Buscando instâncias no servidor...</td></tr>`;

    const res = await fetchEvolutionInstances();
    if (!res.success) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #DC2626; padding: 1.5rem;">${res.error || 'Erro ao consultar instâncias do servidor.'}</td></tr>`;
      return;
    }

    serverInstances = res.instances;
    if (serverInstances.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma instância encontrada no servidor.</td></tr>`;
      if (mobileContainer) mobileContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Nenhuma instância no servidor.</div>`;
      return;
    }

    tbody.innerHTML = serverInstances.map(inst => {
      const isOpen = inst.state === 'open';
      const formattedDate = inst.updatedAt ? new Date(inst.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recente';

      return `
        <tr>
          <td>
            <strong>${inst.name}</strong>
          </td>
          <td>${inst.owner || '<span style="color: var(--text-muted);">Não pareado</span>'}</td>
          <td>
            <span class="status-pill ${isOpen ? 'ativo' : 'inativo'}">
              ${isOpen ? '● CONECTADO' : 'DESCONECTADO'}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${formattedDate}</td>
          <td style="text-align: right;">
            <button class="btn-delete-server-inst btn-outline-white" data-name="${inst.name}" style="color: #DC2626; border-color: #FECACA; font-size: 0.75rem; padding: 0.3rem 0.6rem;">
              🗑️ Excluir
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (mobileContainer) {
      mobileContainer.innerHTML = serverInstances.map(inst => {
        const isOpen = inst.state === 'open';
        return `
          <div class="team-mobile-card">
            <div class="team-mobile-card-header">
              <div>
                <strong>${inst.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${inst.owner || 'Sem número'}</div>
              </div>
              <span class="status-pill ${isOpen ? 'ativo' : 'inativo'}">${isOpen ? 'CONECTADO' : 'OFFLINE'}</span>
            </div>
            <div class="team-mobile-card-footer">
              <button class="btn-delete-server-inst btn-outline-white" data-name="${inst.name}" style="width: 100%; color: #DC2626; border-color: #FECACA; font-size: 0.8rem; padding: 0.4rem; justify-content: center;">
                🗑️ Excluir do Servidor
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    container.querySelectorAll('.btn-delete-server-inst').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name');
        if (confirm(`Deseja excluir a instância "${name}" permanentemente do servidor Evolution API?`)) {
          btn.disabled = true;
          btn.textContent = 'Excluindo...';
          const delRes = await deleteEvolutionInstance(name);
          if (delRes.success) {
            showToast(`Instância ${name} excluída!`, 'success');
            loadServerInstances();
          } else {
            alert('Erro ao excluir: ' + delRes.error);
            btn.disabled = false;
          }
        }
      });
    });
  }

  checkStatus();
  if (isAdmin) loadServerInstances();

  slugInput?.addEventListener('change', () => {
    activeInstanceName = sanitizeInstanceSlug(slugInput.value);
    localStorage.setItem('evolution_active_instance', activeInstanceName);
    checkStatus();
  });

  const saveApiConfigBtn = container.querySelector('#btn-save-api-config');
  saveApiConfigBtn?.addEventListener('click', () => {
    const url = container.querySelector('#input-api-url')?.value.trim();
    const key = container.querySelector('#input-api-key')?.value.trim();
    if (url) localStorage.setItem('evolution_api_url', url);
    if (key) localStorage.setItem('evolution_api_key', key);
    showToast('Token e URL da Evolution API salvos com sucesso!', 'success');
    checkStatus();
    if (isAdmin) loadServerInstances();
  });

  container.querySelector('#btn-use-standard-slug')?.addEventListener('click', () => {
    activeInstanceName = defaultHierarchicalName;
    slugInput.value = defaultHierarchicalName;
    localStorage.setItem('evolution_active_instance', defaultHierarchicalName);
    const nameDisplay = container.querySelector('#instance-name-display');
    if (nameDisplay) nameDisplay.innerHTML = `Instância: <strong>${defaultHierarchicalName}</strong>`;
    checkStatus();
  });

  genQrBtn?.addEventListener('click', async () => {
    activeInstanceName = sanitizeInstanceSlug(slugInput.value);
    localStorage.setItem('evolution_active_instance', activeInstanceName);

    genQrBtn.disabled = true;
    genQrBtn.innerHTML = 'Gerando QR Code...';

    qrMount.innerHTML = `
      <div style="padding: 2rem 0; color: var(--text-muted); font-size: 0.85rem;">
        <div style="width: 32px; height: 32px; border: 3px solid #E2E8F0; border-top-color: #1D4ED8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem auto;"></div>
        Requisitando QR Code na Evolution API...
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    try {
      const res = await getEvolutionQrCode(activeInstanceName);
      if (res.success && res.base64) {
        const imgSrc = res.base64.startsWith('data:') ? res.base64 : `data:image/png;base64,${res.base64}`;
        qrMount.innerHTML = `
          <div>
            <img src="${imgSrc}" alt="QR Code" style="width: 200px; height: 200px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: white; padding: 6px;">
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.6rem;">
              Abra o WhatsApp &gt; <strong>Aparelhos Conectados</strong> e aponte a câmera.
            </p>
          </div>
        `;
        startPolling();
      } else if (res.state === 'open') {
        checkStatus();
      } else {
        const errMsg = res.error || 'Não foi possível obter o QR Code. Verifique o servidor e chave Evolution API.';
        qrMount.innerHTML = `<div style="color: #DC2626; font-size: 0.85rem; padding: 1.5rem 0; line-height: 1.4;">${errMsg}</div>`;
      }
    } catch (err) {
      qrMount.innerHTML = `<div style="color: #DC2626; font-size: 0.85rem; padding: 1.5rem 0;">${err.message || 'Erro de conexão com o servidor.'}</div>`;
    } finally {
      genQrBtn.disabled = false;
      genQrBtn.innerHTML = `Gerar QR Code de Conexão`;
    }
  });

  disBtn?.addEventListener('click', async () => {
    if (!confirm('Deseja realmente desconectar este WhatsApp? Você poderá conectar outro número gerando um novo QR Code.')) return;
    
    disBtn.disabled = true;
    disBtn.textContent = 'Desconectando...';

    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }

    try {
      // 1. Desconecta na Evolution API
      const res = await logoutEvolutionInstance(activeInstanceName);
      if (!res.success) {
        await deleteEvolutionInstance(activeInstanceName);
      }

      // 2. Atualiza estado no Firestore
      if (currentUser?.uid) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          'whatsapp.enabled': false,
          'whatsapp.status': 'DISCONNECTED',
          'whatsapp.phoneNumber': null,
          'whatsapp.updatedAt': serverTimestamp()
        }).catch(() => {});
      }
      if (currentUser?.team_id) {
        await updateDoc(doc(db, 'teams', currentUser.team_id), {
          'whatsapp_connected': false,
          'whatsapp_phone': null
        }).catch(() => {});
      }

      lastSavedState = null;
      await checkStatus();

      qrMount.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔌</div>
          <strong style="color: var(--text-main);">WhatsApp Desconectado com Sucesso!</strong>
          <p style="font-size: 0.8rem; margin-top: 0.35rem;">Toque em <strong>"Gerar QR Code de Conexão"</strong> para conectar um novo chip.</p>
        </div>
      `;
      showToast('WhatsApp desconectado com sucesso.', 'success');
    } catch (err) {
      showToast(`Erro ao desconectar: ${err.message || 'Falha de conexão'}`, 'error');
    } finally {
      disBtn.disabled = false;
      disBtn.textContent = 'Desconectar meu WhatsApp';
    }
  });

  // Admin Cleanup Handler
  container.querySelector('#btn-run-cleanup')?.addEventListener('click', async () => {
    const days = parseInt(container.querySelector('#select-cleanup-days').value, 10) || 7;
    if (confirm(`Executar varredura agora para excluir todas as instâncias desconectadas há mais de ${days} dias?`)) {
      const cleanBtn = container.querySelector('#btn-run-cleanup');
      cleanBtn.disabled = true;
      cleanBtn.textContent = 'Varrendo...';
      try {
        const result = await cleanupDisconnectedInstances({ maxDisconnectedDays: days });
        if (result.success) {
          showToast(`Limpeza concluída! ${result.deletedCount} instâncias inativas removidas de ${result.totalScanned} analisadas.`, 'success');
          loadServerInstances();
        } else {
          alert('Erro na limpeza: ' + result.error);
        }
      } finally {
        cleanBtn.disabled = false;
        cleanBtn.textContent = '🧹 Limpar Instâncias Inativas';
      }
    }
  });

  container.querySelector('#btn-refresh-server-instances')?.addEventListener('click', () => {
    loadServerInstances();
  });

  return () => {
    if (pollingTimer) clearInterval(pollingTimer);
  };
}
