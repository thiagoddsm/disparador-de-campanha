/**
 * Sistema Global de Feedback & Notificações (Toast)
 */

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'app-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 420px;
      width: calc(100vw - 3rem);
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = 'info', durationMs = 4500) {
  const container = ensureToastContainer();

  const toast = document.createElement('div');
  toast.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.9rem 1.25rem;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    line-height: 1.4;
    color: #FFFFFF;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: inherit;
  `;

  let icon = 'ℹ️';
  if (type === 'success') {
    toast.style.background = '#059669'; // Emerald-600
    toast.style.border = '1px solid #10B981';
    icon = '✅';
  } else if (type === 'error') {
    toast.style.background = '#DC2626'; // Red-600
    toast.style.border = '1px solid #EF4444';
    icon = '⚠️';
  } else if (type === 'warning') {
    toast.style.background = '#D97706'; // Amber-600
    toast.style.border = '1px solid #F59E0B';
    icon = '🔔';
  } else {
    toast.style.background = '#2563EB'; // Blue-600
    toast.style.border = '1px solid #3B82F6';
    icon = 'ℹ️';
  }

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1;">
      <span style="font-size: 1.1rem; flex-shrink: 0;">${icon}</span>
      <span style="flex: 1; word-break: break-word;">${message}</span>
    </div>
    <button style="background: none; border: none; color: #FFFFFF; opacity: 0.75; font-size: 1.1rem; cursor: pointer; padding: 0 0 0 0.5rem; line-height: 1; display: flex; align-items: center;" title="Fechar">✕</button>
  `;

  const closeBtn = toast.querySelector('button');
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.96)';
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 250);
  };

  closeBtn?.addEventListener('click', removeToast);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  if (durationMs > 0) {
    setTimeout(removeToast, durationMs);
  }
}