import { updateUserProfileSettings, resetUserPassword, uploadUserAvatarFile } from '../firebase/auth.js';
import { showToast } from '../utils/feedback.js';

export function renderSettingsGeneral(container, currentUser, onNavigate) {
  const nameParts = (currentUser.name || 'Usuário').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const email = currentUser.email || '';
  let currentAvatar = currentUser.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face';

  container.innerHTML = `
    <div class="page-content" style="max-width: 1200px;">
      <!-- Title -->
      <div style="margin-bottom: 1.5rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Configurações do Sistema</h1>
        <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem;">
          Gerencie a conexão do seu WhatsApp, perfil, preferências e segurança da conta.
        </p>
      </div>

      <!-- 1. PRIMEIRO DESTAQUE: Conexão WhatsApp (QR Code & Status do Chip) -->
      <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg); background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border: 2px solid #86EFAC; box-shadow: 0 4px 16px rgba(34, 197, 94, 0.12); margin-bottom: 1.75rem; cursor: pointer;" id="card-whatsapp-connection-hero">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 1rem; min-width: 260px;">
            <div style="width: 52px; height: 52px; border-radius: 14px; background: #22C55E; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35); flex-shrink: 0;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="font-size: 1.25rem; font-weight: 800; color: #14532D; margin: 0;">Conexão WhatsApp</h3>
                <span class="pill-btn" style="background: #BBF7D0; color: #15803D; font-weight: 800; font-size: 0.72rem; padding: 2px 8px;">QR CODE & STATUS</span>
              </div>
              <p style="font-size: 0.88rem; color: #166534; margin: 0.25rem 0 0; line-height: 1.4;">
                Conecte ou desconecte seu número de WhatsApp, leia o QR Code e acompanhe a saúde do chip em tempo real.
              </p>
            </div>
          </div>

          <button id="btn-goto-evolution" class="btn-wa-action" style="font-size: 0.95rem; font-weight: 800; padding: 0.75rem 1.4rem; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(37, 211, 102, 0.35); display: flex; align-items: center; gap: 0.5rem;">
            <span>📱 Conectar / Ler QR Code</span>
            <span style="font-size: 1.1rem;">→</span>
          </button>
        </div>
      </div>

      <!-- Settings Layout Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; align-items: start;">
        
        <!-- Left Column: Profile & Account Preferences -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Card 1: Profile Information -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Informações do Perfil</h3>
            </div>

            <div style="display: flex; gap: 1.75rem; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap;">
              <!-- Avatar Column com Upload via Storage -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; position: relative;">
                <input type="file" id="input-avatar-file" accept="image/png, image/jpeg, image/jpg, image/webp" style="display: none;">
                
                <div style="position: relative; cursor: pointer;" id="avatar-upload-trigger" title="Clique para enviar nova foto">
                  <img src="${currentAvatar}" 
                       style="width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid #FFFFFF; box-shadow: var(--shadow-md); transition: opacity 0.2s;" 
                       id="settings-avatar-preview" alt="Avatar">
                  
                  <div style="position: absolute; bottom: 2px; right: 2px; width: 28px; height: 28px; border-radius: 50%; background: #1D4ED8; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25); border: 2px solid #FFFFFF;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </div>
                </div>

                <button type="button" id="btn-change-avatar" style="background: none; border: none; font-size: 0.82rem; color: var(--primary-blue); font-weight: 700; cursor: pointer; padding: 0.2rem 0.5rem;">
                  📷 Alterar Foto
                </button>
                <span id="avatar-upload-status" style="font-size: 0.72rem; color: var(--text-muted); display: none;">Enviando...</span>
              </div>

              <!-- Name & Email Inputs -->
              <div style="flex: 1; display: flex; flex-direction: column; gap: 1.1rem; min-width: 260px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Primeiro Nome</label>
                    <input type="text" id="input-first-name" class="topbar-search-input" value="${firstName}" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem; font-size: 0.9rem;">
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Sobrenome</label>
                    <input type="text" id="input-last-name" class="topbar-search-input" value="${lastName}" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem; font-size: 0.9rem;">
                  </div>
                </div>

                <div>
                  <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">E-mail Corporativo</label>
                  <input type="email" id="input-email" class="topbar-search-input" value="${email}" disabled style="width: 100%; border-radius: var(--radius-md); background: #F8FAFC; color: var(--text-muted); padding: 0.6rem 0.85rem; font-size: 0.9rem; cursor: not-allowed;">
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button id="btn-save-profile" class="btn-primary-blue" style="padding: 0.65rem 1.4rem; font-size: 0.9rem; font-weight: 600;">
                Salvar Alterações
              </button>
            </div>
          </div>

          <!-- Card 2: Account Preferences -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Preferências Regionais</h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Idioma</label>
                <select id="select-language" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.88rem;">
                  <option value="pt-BR" ${currentUser.language === 'pt-BR' || !currentUser.language ? 'selected' : ''}>Português (Brasil)</option>
                  <option value="en-US" ${currentUser.language === 'en-US' ? 'selected' : ''}>English (US)</option>
                  <option value="es-ES" ${currentUser.language === 'es-ES' ? 'selected' : ''}>Español</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Fuso Horário</label>
                <select id="select-timezone" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.88rem;">
                  <option value="America/Sao_Paulo" ${currentUser.timezone === 'America/Sao_Paulo' || !currentUser.timezone ? 'selected' : ''}>Brasília (UTC-03:00)</option>
                  <option value="America/Manaus" ${currentUser.timezone === 'America/Manaus' ? 'selected' : ''}>Manaus (UTC-04:00)</option>
                  <option value="America/Rio_Branco" ${currentUser.timezone === 'America/Rio_Branco' ? 'selected' : ''}>Rio Branco (UTC-05:00)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Password & Account Security -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Segurança da Senha</h3>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">
              Redefina sua senha de acesso ao sistema com link seguro enviado para o seu e-mail.
            </p>

            <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
              <div style="font-size: 0.82rem; color: var(--text-main); font-weight: 600;">E-mail Cadastrado:</div>
              <div style="font-size: 0.85rem; color: var(--primary-blue); word-break: break-all; margin-top: 0.2rem;">${email}</div>
            </div>

            <button id="btn-reset-password" class="btn-outline-white" style="width: 100%; justify-content: center; padding: 0.65rem 1rem; font-weight: 600; font-size: 0.85rem;">
              🔑 Enviar Link de Redefinição
            </button>
          </div>

          ${(currentUser.role === 'admin' || currentUser.role === 'coordinator') ? `
            <!-- Card: Versão do Sistema (/ ou /admin) -->
            <div class="main-panel-card" style="padding: 1.5rem; border-radius: var(--radius-lg); background: #F8FAFC; border: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
                <div style="width: 32px; height: 32px; border-radius: var(--radius-md); background: #EFF6FF; color: var(--primary-blue); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                  🌐
                </div>
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">Painel de Gestão</h4>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; line-height: 1.4;">
                Acesse o painel gerencial desktop exclusivo da coordenação e administração:
              </p>
              
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <a href="/admin" id="link-goto-admin" style="display: flex; align-items: center; justify-content: space-between; text-decoration: none; font-size: 0.82rem; padding: 0.6rem 0.85rem; font-weight: 700; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-md); color: #1D4ED8;">
                  <span>🖥️ Painel Gestão (Rota /admin)</span>
                  <span>Acessar →</span>
                </a>
              </div>
            </div>
          ` : ''}

        </div>

      </div>
    </div>
  `;

  // Clique no Card Hero ou no Botão de WhatsApp leva para a tela Evolution
  container.querySelector('#card-whatsapp-connection-hero')?.addEventListener('click', (e) => {
    onNavigate('evolution');
  });

  // Upload de Foto de Perfil via Firebase Storage
  const fileInput = container.querySelector('#input-avatar-file');
  const avatarTrigger = container.querySelector('#avatar-upload-trigger');
  const changeBtn = container.querySelector('#btn-change-avatar');
  const avatarImg = container.querySelector('#settings-avatar-preview');
  const uploadStatus = container.querySelector('#avatar-upload-status');

  const openFilePicker = () => {
    fileInput?.click();
  };

  avatarTrigger?.addEventListener('click', openFilePicker);
  changeBtn?.addEventListener('click', openFilePicker);

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem (PNG, JPG, WEBP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('O arquivo selecionado é maior que 5MB. Escolha uma imagem menor.', 'error');
      return;
    }

    // Preview imediato
    const localUrl = URL.createObjectURL(file);
    if (avatarImg) {
      avatarImg.src = localUrl;
      avatarImg.style.opacity = '0.5';
    }

    if (uploadStatus) {
      uploadStatus.style.display = 'block';
      uploadStatus.textContent = 'Enviando imagem...';
    }
    if (changeBtn) {
      changeBtn.disabled = true;
      changeBtn.textContent = 'Enviando...';
    }

    try {
      const downloadUrl = await uploadUserAvatarFile(file, currentUser.uid);
      currentAvatar = downloadUrl;
      currentUser.avatar_url = downloadUrl;

      // Salva no perfil Firestore e Auth
      await updateUserProfileSettings({
        photoURL: downloadUrl
      });

      if (avatarImg) {
        avatarImg.src = downloadUrl;
        avatarImg.style.opacity = '1';
      }

      // Atualiza avatares visíveis no topbar/sidebar
      document.querySelectorAll('.topbar-avatar-img, .user-avatar-img, .sidebar-avatar-img').forEach(img => {
        img.src = downloadUrl;
      });

      showToast('Foto de perfil enviada e atualizada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro no upload de foto:', err);
      showToast(`Erro ao enviar foto: ${err.message}`, 'error');
      if (avatarImg) {
        avatarImg.src = currentUser.avatar_url || currentAvatar;
        avatarImg.style.opacity = '1';
      }
    } finally {
      if (uploadStatus) uploadStatus.style.display = 'none';
      if (changeBtn) {
        changeBtn.disabled = false;
        changeBtn.textContent = '📷 Alterar Foto';
      }
      fileInput.value = '';
    }
  });

  // Salvar Informações e Preferências
  container.querySelector('#btn-save-profile')?.addEventListener('click', async () => {
    const fName = container.querySelector('#input-first-name').value.trim();
    const lName = container.querySelector('#input-last-name').value.trim();
    const fullName = `${fName} ${lName}`.trim() || 'Usuário';
    const language = container.querySelector('#select-language').value;
    const timezone = container.querySelector('#select-timezone').value;

    const saveBtn = container.querySelector('#btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      await updateUserProfileSettings({
        name: fullName,
        photoURL: currentAvatar,
        language,
        timezone
      });

      currentUser.name = fullName;
      currentUser.avatar_url = currentAvatar;
      currentUser.language = language;
      currentUser.timezone = timezone;

      showToast('Perfil e preferências atualizados com sucesso!', 'success');
      saveBtn.textContent = 'Salvo com Sucesso!';
    } catch (err) {
      console.error('Erro ao atualizar perfil no Firestore:', err);
      showToast(`Erro ao salvar: ${err.message || 'Falha de conexão'}`, 'error');
      saveBtn.textContent = 'Erro ao Salvar';
    } finally {
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Alterações';
      }, 1500);
    }
  });

  // Enviar link de redefinição de senha
  container.querySelector('#btn-reset-password')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-reset-password');
    if (!email) return;

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      await resetUserPassword(email);
      showToast(`Link de recuperação enviado para ${email}!`, 'success');
    } catch (err) {
      console.error('Erro ao enviar e-mail de recuperação:', err);
      showToast(`Erro ao enviar link: ${err.message}`, 'error');
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '🔑 Enviar Link de Redefinição';
      }, 2500);
    }
  });

  container.querySelector('#btn-goto-evolution')?.addEventListener('click', () => {
    onNavigate('evolution');
  });

  container.querySelector('#link-goto-mobile')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  container.querySelector('#link-goto-admin')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.history.pushState(null, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  return () => {};
}

