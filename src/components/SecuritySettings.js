import { auth, db } from '../firebase/config.js';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

export function renderSecuritySettings(container, currentUser, onNavigate) {
  const ua = navigator.userAgent;
  const isWindows = ua.includes('Windows');
  const isMac = ua.includes('Macintosh');
  const isLinux = ua.includes('Linux');
  const isAndroid = ua.includes('Android');
  const isIOS = ua.includes('iPhone') || ua.includes('iPad');

  const osName = isWindows ? 'Windows PC' : isMac ? 'macOS' : isLinux ? 'Linux' : isAndroid ? 'Android' : isIOS ? 'iOS Device' : 'Computador';
  const browserName = ua.includes('Chrome') ? 'Google Chrome' : ua.includes('Firefox') ? 'Mozilla Firefox' : ua.includes('Safari') ? 'Apple Safari' : ua.includes('Edge') ? 'Microsoft Edge' : 'Navegador Web';

  let sessions = [
    {
      id: 'sess_current',
      device: `${osName} - ${browserName}`,
      isCurrent: true,
      location: 'Sessão Ativa Autenticada',
      ip: 'Localhost / Cloud Run',
      lastActive: 'Agora mesmo',
      icon: 'laptop'
    }
  ];

  container.innerHTML = `
    <div class="page-content" style="max-width: 1200px;">
      <!-- Title -->
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Configurações de Segurança</h1>
        <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem;">
          Gerencie seus métodos de autenticação, sessões ativas e histórico de segurança.
        </p>
      </div>

      <!-- Security Layout Grid -->
      <div style="display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; align-items: start;">
        
        <!-- Left Column: MFA & Active Sessions -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Card 1: Multi-Factor Authentication -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Autenticação Multifator (MFA)</h3>
              </div>

              <!-- Toggle Switch -->
              <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="toggle-mfa" checked style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #22C55E; transition: .3s; border-radius: 24px;"></span>
              </label>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
              Adicione uma camada extra de proteção à sua conta exigindo confirmação por aplicativo autenticador ao fazer login.
            </p>

            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; background: #F8FAFC;">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">Aplicativo Autenticador</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.1rem;">Configurado no dispositivo cadastrado</div>
                </div>
              </div>

              <button id="btn-manage-mfa" class="btn-outline-white" disabled title="Em breve" style="font-size: 0.82rem; padding: 0.4rem 0.9rem; font-weight: 600; opacity: 0.5; cursor: not-allowed;">Gerenciar (Em breve)</button>
            </div>
          </div>

          <!-- Card 2: Active Sessions -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.25rem;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Sessões Ativas</h3>
            </div>

            <div id="sessions-list" style="display: flex; flex-direction: column; gap: 1rem;">
              ${sessions.map(sess => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 0; border-bottom: 1px solid var(--border-light);">
                  <div style="display: flex; align-items: center; gap: 0.9rem;">
                    <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: #EFF6FF; color: var(--primary-blue); display: flex; align-items: center; justify-content: center;">
                      ${sess.icon === 'laptop' ? `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                      ` : `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                      `}
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${sess.device}</span>
                        ${sess.isCurrent ? '<span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.65rem; padding: 2px 6px; font-weight: 700;">ATUAL</span>' : ''}
                      </div>
                      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                        ${sess.location} • IP: ${sess.ip}
                      </div>
                      <div style="font-size: 0.72rem; color: #9CA3AF; margin-top: 0.1rem;">
                        Última atividade: ${sess.lastActive}
                      </div>
                    </div>
                  </div>

                  ${!sess.isCurrent ? `
                    <button class="btn-delete-session" data-id="${sess.id}" style="background: none; border: none; cursor: pointer; color: #EF4444; padding: 6px;" title="Encerrar Sessão">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  ` : ''}
                </div>
              `).join('')}
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem;">
              <button id="btn-revoke-all" disabled title="Em breve" style="background: none; border: none; font-size: 0.85rem; color: #9CA3AF; font-weight: 600; cursor: not-allowed;">
                Desconectar Todas as Outras Sessões (Em breve)
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Audit Log & Password -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Card 3: Audit Log -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg); position: relative; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Log de Auditoria</h3>
              <a href="#" id="link-view-all-audit" style="font-size: 0.82rem; color: var(--primary-blue); font-weight: 600; text-decoration: none;">Ver Todos</a>
            </div>

            <!-- Timeline -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #1D4ED8; margin-top: 5px; flex-shrink: 0;"></span>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Login Bem-sucedido</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">IP: 192.168.1.42 (MacBook Pro)</div>
                  <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 2px;">Hoje, 09:42</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #9CA3AF; margin-top: 5px; flex-shrink: 0;"></span>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Configurações de MFA Atualizadas</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Aplicativo autenticador verificado.</div>
                  <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 2px;">24 de Outubro, 14:15</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; margin-top: 5px; flex-shrink: 0;"></span>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem; color: #DC2626;">Tentativa Falha de Login</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Senha incorreta de IP desconhecido.</div>
                  <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 2px;">22 de Outubro, 02:30</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 4: Password -->
          <div class="main-panel-card" style="padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M10.5 13.5L4 20v2h2l6.5-6.5"></path>
                <circle cx="16" cy="8" r="5"></circle>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Senha de Acesso</h3>
            </div>

            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.4;">
              Última alteração há 45 dias. Recomendamos atualizar sua senha a cada 90 dias.
            </p>

            <button id="btn-change-password-modal" class="btn-outline-white" style="width: 100%; padding: 0.6rem; font-weight: 600; font-size: 0.88rem; justify-content: center;">
              Alterar Senha
            </button>
          </div>

        </div>

      </div>
    </div>
  `;

  container.querySelector('#btn-change-password-modal')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-change-password-modal');
    btn.disabled = true;
    btn.textContent = 'Enviando link...';

    try {
      if (currentUser.email) {
        await sendPasswordResetEmail(auth, currentUser.email);
        btn.textContent = 'Link Enviado para seu E-mail!';
      }
    } catch (err) {
      console.warn('Erro ao enviar reset de senha:', err);
      btn.textContent = 'Erro ao enviar e-mail.';
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Alterar Senha';
    }, 4000);
  });

  // Toggle MFA
  container.querySelector('#toggle-mfa')?.addEventListener('change', async (e) => {
    const isMfaActive = e.target.checked;
    currentUser.mfa_enabled = isMfaActive;
    try {
      if (currentUser.uid) {
        await updateDoc(doc(db, 'users', currentUser.uid), { mfa_enabled: isMfaActive });
      }
    } catch (err) {
      console.warn('Erro ao atualizar MFA no Firestore:', err);
    }
  });

  return () => {};
}
