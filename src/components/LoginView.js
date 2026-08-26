import { loginWithEmail, registerWithEmail, resetUserPassword } from '../firebase/auth.js';

export function renderLoginView(container, onLoginSuccess) {
  let isRegisterMode = false;

  function renderForm() {
    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <!-- Logo & Brand Header -->
          <div class="login-brand-header">
            <div class="sidebar-brand-icon" style="width: 44px; height: 44px; font-size: 1.1rem; margin: 0 auto 0.75rem auto;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h1 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">
              DispatchPro Enterprise
            </h1>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              ${isRegisterMode ? 'Crie sua conta corporativa para começar' : 'Acesse com suas credenciais corporativas'}
            </p>
          </div>

          <div id="auth-alert" style="display: none; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.82rem; margin-bottom: 1.25rem; font-weight: 500;"></div>

          <form id="auth-form">
            ${isRegisterMode ? `
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">
                  Nome Completo
                </label>
                <input type="text" id="auth-name" class="form-control" placeholder="Ex: Ana Silva" required>
              </div>

              <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; margin: 0 0 1rem;">
                Após o cadastro, um administrador validará seu acesso, papel e equipe.
              </p>
            ` : ''}

            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">
                E-mail Corporativo
              </label>
              <input type="email" id="auth-email" class="form-control" placeholder="seu.nome@empresa.com" required>
            </div>

            <div style="margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-main);">
                  Senha
                </label>
                ${!isRegisterMode ? `
                  <a href="#" id="btn-forgot-password" style="font-size: 0.75rem; color: var(--primary-blue); font-weight: 600; text-decoration: none;">
                    Esqueci a senha
                  </a>
                ` : ''}
              </div>
              <input type="password" id="auth-password" class="form-control" placeholder="••••••••" minlength="6" required>
            </div>

            <button type="submit" id="btn-submit-auth" class="btn-primary-blue" style="width: 100%; padding: 0.65rem; justify-content: center; font-size: 0.9rem; margin-bottom: 1rem;">
              ${isRegisterMode ? 'Criar Conta' : 'Entrar no Sistema'}
            </button>
          </form>

          <div style="text-align: center; font-size: 0.82rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            ${isRegisterMode ? 'Já possui uma conta corporativa?' : 'Ainda não tem acesso?'}
            <a href="#" id="btn-toggle-mode" style="color: var(--primary-blue); font-weight: 700; text-decoration: none; margin-left: 0.3rem;">
              ${isRegisterMode ? 'Fazer Login' : 'Cadastre-se'}
            </a>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector('#auth-form');
    const alertBox = container.querySelector('#auth-alert');
    const submitBtn = container.querySelector('#btn-submit-auth');
    const toggleBtn = container.querySelector('#btn-toggle-mode');
    const forgotBtn = container.querySelector('#btn-forgot-password');

    function showAlert(msg, isError = true) {
      alertBox.style.display = 'block';
      alertBox.style.background = isError ? '#FEF2F2' : '#F0FDF4';
      alertBox.style.color = isError ? '#B91C1C' : '#15803D';
      alertBox.style.border = isError ? '1px solid #FECACA' : '1px solid #BBF7D0';
      alertBox.textContent = msg;
    }

    toggleBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      isRegisterMode = !isRegisterMode;
      renderForm();
    });

    forgotBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#auth-email').value.trim();
      if (!email) {
        showAlert('Digite seu e-mail corporativo no campo acima.');
        return;
      }
      try {
        await resetUserPassword(email);
        showAlert(`Link de redefinição enviado para ${email}!`, false);
      } catch (err) {
        showAlert('Erro ao enviar e-mail de redefinição.');
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#auth-email').value.trim();
      const password = container.querySelector('#auth-password').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processando...';

      try {
        let userProfile;
        if (isRegisterMode) {
          const name = container.querySelector('#auth-name').value.trim();
          userProfile = await registerWithEmail(email, password, name);
        } else {
          userProfile = await loginWithEmail(email, password);
        }

        onLoginSuccess(userProfile);
      } catch (err) {
        console.error(err);
        let message = 'Ocorreu um erro ao processar. Tente novamente.';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          message = 'E-mail ou senha incorretos.';
        } else if (err.code === 'auth/email-already-in-use') {
          message = 'Este e-mail já está cadastrado no sistema.';
        } else if (err.code === 'auth/weak-password') {
          message = 'A senha deve conter no mínimo 6 caracteres.';
        }
        showAlert(message);
        submitBtn.disabled = false;
        submitBtn.textContent = isRegisterMode ? 'Criar Conta' : 'Entrar no Sistema';
      }
    });
  }

  renderForm();
}
