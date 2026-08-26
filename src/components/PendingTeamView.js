import { logoutUser } from '../firebase/auth.js';

/**
 * Renderiza a tela de bloqueio e espera para operadores não alocados a uma equipe.
 */
export function renderPendingTeamView(container, currentUser) {
  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Membro';
  const userEmail = currentUser?.email || '';

  container.innerHTML = `
    <div style="min-height: 100vh; background: #F8FAFC; display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);">
      <div style="background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); max-width: 520px; width: 100%; padding: 2.5rem 2rem; text-align: center;">
        
        <!-- Icon / Brand -->
        <div style="width: 68px; height: 68px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 0 0 8px #F0F7FF;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>

        <!-- Badges -->
        <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
          <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.85rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 5px;">
            <span>⏳</span> Aguardando Alocação em Equipe
          </span>
          <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.85rem; border-radius: 9999px;">
            🎯 Membro da Equipe
          </span>
        </div>

        <!-- User Greeting -->
        <h1 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; margin-bottom: 0.35rem; letter-spacing: -0.3px;">
          Olá, ${userName}!
        </h1>
        <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 1.5rem; font-weight: 500;">
          ${userEmail}
        </p>

        <!-- Informational Card -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; text-align: left; margin-bottom: 1.75rem;">
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <div style="font-size: 1.2rem; line-height: 1; margin-top: 2px;">🔒</div>
            <div style="font-size: 0.88rem; color: #334155; line-height: 1.55;">
              Sua conta está criada e ativa, mas <strong>o acesso ao sistema só é liberado após sua alocação em uma equipe</strong> por um Administrador ou Coordenador.
              <div style="margin-top: 0.75rem; font-size: 0.82rem; color: #64748B;">
                Assim que você for vinculado a uma equipe no painel, esta tela será <strong>desbloqueada automaticamente em tempo real</strong>.
              </div>
            </div>
          </div>
        </div>

        <!-- Real-time Pulse Indicator -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.82rem; color: #16A34A; font-weight: 600; margin-bottom: 1.75rem;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #16A34A; box-shadow: 0 0 0 4px #DCFCE7; animation: pulse 1.8s infinite;"></span>
          Sincronização ativa: aguardando liberação...
        </div>

        <!-- Logout Action -->
        <button id="btn-pending-logout" style="width: 100%; padding: 0.7rem 1.25rem; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair da Conta
        </button>

      </div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
      }
    </style>
  `;

  container.querySelector('#btn-pending-logout')?.addEventListener('click', async () => {
    await logoutUser();
  });
}
