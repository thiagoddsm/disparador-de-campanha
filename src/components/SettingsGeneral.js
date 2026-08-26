import { db } from '../firebase/config.js';
import { doc, updateDoc } from 'firebase/firestore';

export function renderSettingsGeneral(container, currentUser, onNavigate) {
  const nameParts = (currentUser.name || 'Thiago Silva').split(' ');
  const firstName = nameParts[0] || 'Thiago';
  const lastName = nameParts.slice(1).join(' ') || 'Silva';
  const email = currentUser.email || 'thiagoddsm@gmail.com';

  container.innerHTML = `
    <div class="page-content" style="max-width: 1200px;">
      <!-- Title -->
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Configurações Gerais</h1>
        <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem;">
          Gerencie suas informações de perfil, preferências de conta e integrações corporativas.
        </p>
      </div>

      <!-- Settings Layout Grid -->
      <div style="display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; align-items: start;">
        
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

            <div style="display: flex; gap: 1.75rem; align-items: flex-start; margin-bottom: 1.5rem;">
              <!-- Avatar Column -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <img src="${currentUser.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=160&fit=crop&crop=face'}" 
                     style="width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid #FFFFFF; box-shadow: var(--shadow-sm);" 
                     id="settings-avatar-preview" alt="Avatar">
                <a href="#" id="btn-change-avatar" style="font-size: 0.8rem; color: var(--primary-blue); font-weight: 600; text-decoration: none;">Alterar Foto</a>
              </div>

              <!-- Name & Email Inputs -->
              <div style="flex: 1; display: flex; flex-direction: column; gap: 1.1rem;">
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
                  <input type="email" id="input-email" class="topbar-search-input" value="${email}" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem; font-size: 0.9rem;">
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
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Preferências da Conta</h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Idioma</label>
                <select id="select-language" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.88rem;">
                  <option value="pt-BR" selected>Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Fuso Horário</label>
                <select id="select-timezone" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.88rem;">
                  <option value="UTC-03:00" selected>UTC-03:00 (Brasília)</option>
                  <option value="UTC-04:00">UTC-04:00 (Manaus)</option>
                  <option value="UTC-05:00">UTC-05:00 (Acre)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: API Integrations -->
        <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg); height: fit-content;">
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Integrações de API</h3>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">
            Gerencie conexões externas para mensagens, webhooks e fluxo de dados.
          </p>

          <!-- WhatsApp Business Card -->
          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.1rem; margin-bottom: 1rem; background: #FFFFFF;">
            <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
              <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: #DCFCE7; color: #16A34A; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">API do WhatsApp Business</div>
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #16A34A; font-weight: 600; margin-top: 0.15rem;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: #16A34A;"></span> Conectado
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid var(--border-light); padding-top: 0.75rem;">
              <span style="font-size: 0.72rem; color: var(--text-muted);">Sincronizado há 2 min</span>
              <button id="btn-config-whatsapp" class="btn-outline-white" style="font-size: 0.78rem; padding: 0.35rem 0.85rem; font-weight: 600;">Configurar</button>
            </div>
          </div>

          <!-- Custom Webhooks Card -->
          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.1rem; background: #FFFFFF;">
            <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
              <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: #F1F5F9; color: #64748B; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                  <line x1="6" y1="9" x2="6" y2="21"></line>
                </svg>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">Webhooks Customizados</div>
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 0.15rem;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: #9CA3AF;"></span> Não configurado
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 1rem; border-top: 1px solid var(--border-light); padding-top: 0.75rem;">
              <button id="btn-setup-webhooks" class="btn-outline-white" style="font-size: 0.78rem; padding: 0.35rem 0.85rem; font-weight: 600;">Configurar</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  container.querySelector('#btn-save-profile')?.addEventListener('click', async () => {
    const fName = container.querySelector('#input-first-name').value.trim();
    const lName = container.querySelector('#input-last-name').value.trim();
    const fullName = `${fName} ${lName}`.trim();
    currentUser.name = fullName;

    const saveBtn = container.querySelector('#btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvo!';

    try {
      if (currentUser.uid) {
        await updateDoc(doc(db, 'users', currentUser.uid), { name: fullName });
      }
    } catch (e) {
      console.warn('Erro ao atualizar nome no Firestore:', e);
    }

    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar Alterações';
    }, 2000);
  });

  container.querySelector('#btn-config-whatsapp')?.addEventListener('click', () => {
    onNavigate('evolution');
  });

  container.querySelector('#btn-setup-webhooks')?.addEventListener('click', () => {
    onNavigate('evolution');
  });

  return () => {};
}
