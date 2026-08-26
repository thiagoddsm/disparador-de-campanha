import { 
  getEvolutionConnectionState, 
  getEvolutionQrCode, 
  logoutEvolutionInstance, 
  sanitizeInstanceSlug,
  EVOLUTION_CONFIG 
} from '../firebase/evolutionApi.js';
import { db } from '../firebase/config.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function renderEvolutionManager(container, currentUser) {
  const hasAccess = currentUser?.role === 'admin' || currentUser?.role === 'coordinator';

  if (!hasAccess) {
    container.innerHTML = `
      <div class="page-content">
        <div class="main-panel-card" style="padding: 3rem 2rem; text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: var(--radius-full); background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Acesso Restrito ao Coordenador</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 480px; margin: 0.5rem auto 1.5rem auto;">
            A gestão de instâncias da Evolution API e conexão de chips de WhatsApp é exclusiva para Coordenadores e Gestores Gerais da campanha.
          </p>
          <span class="pill-btn" style="background: #F1F5F9; color: #475569;">Modo Atual: Disparo Assistido por Membro da Equipe (wa.me)</span>
        </div>
      </div>
    `;
    return () => {};
  }

  const defaultInstanceName = sanitizeInstanceSlug(`instancia_${currentUser.name || 'coordenador'}`);

  let instanceState = 'close';
  let qrBase64 = null;
  let pollingTimer = null;
  let activeInstanceName = localStorage.getItem('evolution_active_instance') || defaultInstanceName;

  container.innerHTML = `
    <div class="page-content">
      <div style="margin-bottom: 1.75rem;">
        <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">
          Conexão WhatsApp & Evolution API
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
          Gerencie instâncias conectadas e parametrize as proteções Anti-Ban para disparos da equipe.
        </p>
      </div>

      <!-- Main Instance Connection Card -->
      <div class="main-panel-card" style="padding: 1.5rem; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Instância do Coordenador</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);" id="instance-name-display">Instância: <strong>${activeInstanceName}</strong></span>
          </div>

          <div id="connection-status-badge">
            <span class="pill-btn" style="background: #FEF3C7; color: #B45309;">Verificando Status...</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; align-items: start;">
          <!-- Left: Instance Form & Actions -->
          <div>
            <div style="margin-bottom: 1.25rem;">
              <label for="input-instance-slug" style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">
                Identificador da Instância (Slug)
              </label>
              <input type="text" id="input-instance-slug" name="instance_slug" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; font-family: monospace;" value="${activeInstanceName}" placeholder="ex: instancia_thiago_moura">
              <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">Identificador da sua instância no servidor Evolution API.</p>
            </div>

            <!-- Global API Key Card (FestaPay Master Key) -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; background: #F8FAFC; margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label for="input-api-key" style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">
                  🔑 Token da Instância / Chave Global (apikey)
                </label>
              </div>
              <p style="font-size: 0.73rem; color: var(--text-muted); margin-bottom: 0.6rem; line-height: 1.3;">
                Copie o Token da sua instância no painel Evolution (ou a Global API Key) e cole aqui:
              </p>
              <input type="password" id="input-api-key" name="api_key" class="topbar-search-input" style="width: 100%; font-size: 0.8rem; background: #FFFFFF; font-family: monospace; margin-bottom: 0.5rem;" value="${localStorage.getItem('evolution_api_key') || EVOLUTION_CONFIG.apiKey}" placeholder="Cole o token da sua instância aqui">
              
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <input type="text" id="input-api-url" name="api_url" class="topbar-search-input" style="flex: 1; font-size: 0.75rem; background: #FFFFFF;" value="${localStorage.getItem('evolution_api_url') || EVOLUTION_CONFIG.baseUrl}" placeholder="URL da Evolution API">
                <button id="btn-save-api-config" class="btn-outline-white" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; font-weight: 700;">
                  Salvar Token
                </button>
              </div>
            </div>

            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button id="btn-generate-qr" class="btn-green-action" style="font-weight: 700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                Criar Instância & Gerar QR Code
              </button>

              <button id="btn-disconnect-instance" class="btn-outline-white" style="color: #DC2626; border-color: #FECACA;">
                Desconectar
              </button>
            </div>
          </div>

          <!-- Right: Live QR Code Viewer -->
          <div style="text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; background: #F8FAFC;" id="qr-container">
            <div id="qr-content-mount">
              <div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0;">
                Clique em <strong>Criar Instância & Gerar QR Code</strong> para parear seu WhatsApp.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Anti-Ban Rules Card (Padrão Oiko / FestaPay) -->
      <div class="main-panel-card" style="padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Regras Anti-Ban & Proteção de Chip</h3>
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
              Simula digitação real no WhatsApp Web durante 2.5s antes de despachar a mensagem.
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
    </div>
  `;

  const statusBadge = container.querySelector('#connection-status-badge');
  const qrMount = container.querySelector('#qr-content-mount');
  const genQrBtn = container.querySelector('#btn-generate-qr');
  const disBtn = container.querySelector('#btn-disconnect-instance');
  const slugInput = container.querySelector('#input-instance-slug');

  async function checkStatus() {
    activeInstanceName = sanitizeInstanceSlug(slugInput.value || activeInstanceName);
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

      // Persiste no Firestore (padrão FestaPay)
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

  checkStatus();

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
    alert('Token e URL da Evolution API salvos com sucesso!');
    checkStatus();
  });

  container.querySelector('#btn-use-ibm-instance')?.addEventListener('click', () => {
    activeInstanceName = 'IBM';
    slugInput.value = 'IBM';
    localStorage.setItem('evolution_active_instance', 'IBM');
    container.querySelector('#instance-name-display').innerHTML = 'Instância: <strong>IBM</strong>';
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
    disBtn.disabled = true;
    try {
      await logoutEvolutionInstance(activeInstanceName);
      checkStatus();
      qrMount.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0;">Instância desconectada com sucesso.</div>`;
    } finally {
      disBtn.disabled = false;
    }
  });

  return () => {
    if (pollingTimer) clearInterval(pollingTimer);
  };
}
