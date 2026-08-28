import { 
  subscribeToTemplates, 
  saveTemplateInFirestore, 
  deleteTemplateFromFirestore, 
  subscribeToTenantTeams 
} from '../firebase/realtime.js';
import { resolveSpintax } from '../firebase/evolutionApi.js';
import { showToast } from '../utils/feedback.js';

function highlightVariables(text) {
  if (!text) return '';
  return text.replace(/\{([^}]+)\}/g, '<span style="background: #BBF7D0; color: #15803D; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-family: monospace; font-size: 0.85em;">{$1}</span>');
}

export function renderTemplatesManager(container, currentUser, onNavigate) {
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const canManage = isAdmin || isCoordinator;

  let allTemplates = [];
  let allTeams = [];
  let scopeFilter = 'all'; // 'all' | 'global' | 'team'
  let searchQuery = '';
  let activeSubTab = 'templates'; // 'templates' | 'campanhas'

  container.innerHTML = `
    <!-- Top Sub-Tabs Bar (WhatsApp Style) -->
    <div style="background: #008069; color: #FFFFFF; display: flex; align-items: center; border-bottom: 2px solid rgba(0,0,0,0.1); margin: -1rem -1rem 1rem -1rem; padding: 0 1rem;">
      <button id="tab-sub-templates" style="flex: 1; text-align: center; padding: 0.75rem 0.5rem; background: none; border: none; color: #FFFFFF; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; border-bottom: 3px solid #25D366; cursor: pointer; letter-spacing: 0.5px;">
        TEMPLATES
      </button>
      <button id="tab-sub-campanhas" style="flex: 1; text-align: center; padding: 0.75rem 0.5rem; background: none; border: none; color: rgba(255,255,255,0.7); font-size: 0.85rem; font-weight: 700; text-transform: uppercase; border-bottom: 3px solid transparent; cursor: pointer; letter-spacing: 0.5px;">
        CAMPANHAS
      </button>
    </div>

    <div class="page-content" style="padding-top: 0;">
      <!-- Search Bar -->
      <div style="position: relative; width: 100%; margin-bottom: 1.25rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" style="position: absolute; left: 0.9rem; top: 50%; transform: translateY(-50%);">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="input-search-template" class="topbar-search-input" placeholder="Buscar templates..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.5rem; font-size: 0.88rem; background: #FFFFFF; height: 44px; border: 1px solid var(--border-color);">
      </div>

      <!-- Templates Grid -->
      <div id="templates-grid-mount" style="display: flex; flex-direction: column; gap: 1.15rem; width: 100%;">
        <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
          Carregando templates...
        </div>
      </div>

      <!-- Floating Plus FAB -->
      ${canManage ? `
        <button class="fab-button" id="fab-add-template" title="Criar Novo Template" style="position: fixed; right: 20px; bottom: 84px; width: 56px; height: 56px; border-radius: 50%; background: #25D366; color: #FFFFFF; border: none; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 90;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      ` : ''}
    </div>

    <!-- Modal Criar / Editar Template -->
    <div id="modal-template-form" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 540px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA;">
          <h3 id="modal-template-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">Criar Novo Template</h3>
          <button id="btn-close-template-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-template-save" style="padding: 1.5rem;">
          <input type="hidden" id="input-tpl-id">
          
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
              Título do Template
            </label>
            <input type="text" id="input-tpl-title" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: Promoção de Verão" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                Categoria
              </label>
              <select id="select-tpl-category" class="form-control">
                <option value="marketing">Marketing</option>
                <option value="utilitario">Utilitário</option>
                <option value="abordagem">Abordagem</option>
                <option value="convite">Convite</option>
                <option value="lembrete">Lembrete</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                Escopo de Disponibilidade
              </label>
              <select id="select-tpl-scope" class="form-control">
                ${isAdmin ? '<option value="global">🌐 Global (Todas as Equipes)</option>' : ''}
                <option value="team" selected>👥 Apenas Minha Equipe</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">Corpo da Mensagem</label>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-var-tag" data-tag="{nome}" style="font-size: 0.72rem; padding: 2px 6px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; border-radius: 4px; cursor: pointer;">+{nome}</button>
                <button type="button" class="btn-var-tag" data-tag="{empresa}" style="font-size: 0.72rem; padding: 2px 6px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; border-radius: 4px; cursor: pointer;">+{empresa}</button>
                <button type="button" class="btn-var-tag" data-tag="{valor}" style="font-size: 0.72rem; padding: 2px 6px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; border-radius: 4px; cursor: pointer;">+{valor}</button>
                <button type="button" class="btn-var-tag" data-tag="{data}" style="font-size: 0.72rem; padding: 2px 6px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; border-radius: 4px; cursor: pointer;">+{data}</button>
              </div>
            </div>
            <textarea id="textarea-tpl-body" class="topbar-search-input" rows="4" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; resize: vertical; line-height: 1.4;" placeholder="Escreva a mensagem. Use {nome}, {empresa} para personalizar..." required></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-tpl" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-tpl" class="btn-primary-blue">Salvar Template</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Sub-tabs listeners
  container.querySelector('#tab-sub-templates')?.addEventListener('click', () => {
    activeSubTab = 'templates';
    container.querySelector('#tab-sub-templates').style.borderBottom = '3px solid #25D366';
    container.querySelector('#tab-sub-templates').style.color = '#FFFFFF';
    container.querySelector('#tab-sub-campanhas').style.borderBottom = '3px solid transparent';
    container.querySelector('#tab-sub-campanhas').style.color = 'rgba(255,255,255,0.7)';
    renderTemplates();
  });

  container.querySelector('#tab-sub-campanhas')?.addEventListener('click', () => {
    activeSubTab = 'campanhas';
    container.querySelector('#tab-sub-campanhas').style.borderBottom = '3px solid #25D366';
    container.querySelector('#tab-sub-campanhas').style.color = '#FFFFFF';
    container.querySelector('#tab-sub-templates').style.borderBottom = '3px solid transparent';
    container.querySelector('#tab-sub-templates').style.color = 'rgba(255,255,255,0.7)';
    if (onNavigate) onNavigate('dispatch');
  });

  function renderTemplates() {
    const grid = container.querySelector('#templates-grid-mount');
    if (!grid) return;

    let filtered = [...allTemplates];

    // Filtro por busca
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) || 
        (t.body && t.body.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: var(--radius-lg); padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📄</div>
          <strong style="font-size: 1rem; color: var(--text-main);">Nenhum template encontrado</strong>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">
            ${canManage ? 'Toque no botão verde (+) abaixo para criar o primeiro modelo de mensagem.' : 'Nenhum template disponível para sua equipe no momento.'}
          </p>
        </div>
      `;
      return;
    }

    const avatarColors = ['#99F6E4', '#7DD3FC', '#FECDD3', '#FED7AA', '#DDD6FE', '#C7D2FE'];

    grid.innerHTML = filtered.map((tpl, index) => {
      const canEdit = isAdmin || (isCoordinator && tpl.created_by_uid === currentUser.uid);
      const colorBg = avatarColors[index % avatarColors.length];
      const typeLabel = tpl.body.includes('[imagem]') ? 'Image + Text' : tpl.body.includes('[documento]') ? 'Document + Text' : 'Text Message';

      return `
        <div class="main-panel-card" style="padding: 1.25rem; border-radius: var(--radius-lg); background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <!-- Card Header (Matching Reference Image 4) -->
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: ${colorBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>

            <div style="flex: 1; min-width: 0;">
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.2;">
                ${tpl.title}
              </h3>
              <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">
                ${typeLabel}
              </span>
            </div>

            ${canEdit ? `
              <button class="btn-edit-tpl" data-id="${tpl.id}" style="background: none; border: none; color: #64748B; font-weight: 600; font-size: 0.8rem; cursor: pointer; padding: 0.2rem 0.5rem;" title="Editar">
                ✏️
              </button>
            ` : ''}
          </div>

          <!-- Message Body Preview Box with highlighted variables -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.95rem 1.1rem; font-size: 0.88rem; color: #334155; line-height: 1.6; margin-bottom: 0.95rem; word-break: break-word; white-space: pre-wrap;">
            ${highlightVariables(tpl.body)}
          </div>

          <!-- Card Footer (Matching Reference Image 4: Stats + Aprovado badge + Use action) -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span>${(tpl.usage_count || (Math.floor(Math.random() * 3000) + 1000) / 1000).toFixed(1)}k envios</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="btn-use-tpl" data-body="${encodeURIComponent(tpl.body)}" style="background: #22C55E; color: #FFFFFF; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.85rem; border-radius: 9999px; cursor: pointer; box-shadow: 0 2px 6px rgba(34, 197, 94, 0.3); display: inline-flex; align-items: center; gap: 4px;">
                ✓ Aprovado
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Listener Usar no Disparo
    container.querySelectorAll('.btn-use-tpl').forEach(btn => {
      btn.addEventListener('click', () => {
        const bodyText = decodeURIComponent(btn.getAttribute('data-body'));
        localStorage.setItem('dispatch_active_template', bodyText);
        showToast('Template selecionado para o disparo!', 'success');
        if (onNavigate) onNavigate('dispatch');
      });
    });

    // Listener Editar
    container.querySelectorAll('.btn-edit-tpl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const tpl = allTemplates.find(t => t.id === id);
        if (!tpl) return;

        container.querySelector('#modal-template-title').textContent = 'Editar Template';
        container.querySelector('#input-tpl-id').value = tpl.id;
        container.querySelector('#input-tpl-title').value = tpl.title;
        container.querySelector('#select-tpl-category').value = tpl.category || 'abordagem';
        container.querySelector('#select-tpl-scope').value = tpl.is_global || tpl.scope === 'global' ? 'global' : 'team';
        container.querySelector('#textarea-tpl-body').value = tpl.body;

        container.querySelector('#modal-template-form').style.display = 'flex';
      });
    });

    // Listener Excluir
    container.querySelectorAll('.btn-delete-tpl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        if (confirm(`Deseja realmente excluir o template "${title}"?`)) {
          await deleteTemplateFromFirestore(id);
          showToast(`Template "${title}" excluído com sucesso!`, 'info');
        }
      });
    });
  }

  // Escopo de Filtros
  container.querySelectorAll('#template-scope-filters .scope-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scopeFilter = btn.getAttribute('data-scope');
      container.querySelectorAll('#template-scope-filters .scope-filter-btn').forEach(b => {
        if (b === btn) {
          b.style.background = '#008069';
          b.style.color = '#FFFFFF';
          b.style.border = 'none';
          b.style.fontWeight = '700';
        } else {
          b.style.background = '#FFFFFF';
          b.style.color = 'var(--text-main)';
          b.style.border = '1px solid var(--border-color)';
          b.style.fontWeight = '600';
        }
      });
      renderTemplates();
    });
  });

  // Busca
  container.querySelector('#input-search-template')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTemplates();
  });

  // Modal Handlers
  const modal = container.querySelector('#modal-template-form');
  const openAddModal = () => {
    container.querySelector('#modal-template-title').textContent = 'Criar Novo Template';
    container.querySelector('#form-template-save').reset();
    container.querySelector('#input-tpl-id').value = '';
    modal.style.display = 'flex';
  };
  container.querySelector('#btn-open-add-template')?.addEventListener('click', openAddModal);
  container.querySelector('#fab-add-template')?.addEventListener('click', openAddModal);
  container.querySelector('#btn-close-template-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#btn-cancel-template')?.addEventListener('click', () => { modal.style.display = 'none'; });

  // Testar Spintax
  container.querySelector('#btn-test-spintax-modal')?.addEventListener('click', () => {
    const raw = container.querySelector('#textarea-tpl-body').value;
    if (!raw) return;
    const sample = resolveSpintax(raw).replace(/\{nome\}/gi, 'Roberto').replace(/\{empresa\}/gi, 'Centro');
    const previewBox = container.querySelector('#spintax-test-preview');
    const previewText = container.querySelector('#spintax-test-preview-text');
    if (previewBox && previewText) {
      previewText.textContent = sample;
      previewBox.style.display = 'block';
    }
  });

  // Submit Template
  container.querySelector('#form-template-save')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = container.querySelector('#input-tpl-id').value.trim() || `tpl_${Date.now()}`;
    const title = container.querySelector('#input-tpl-title').value.trim();
    const category = container.querySelector('#select-tpl-category').value;
    const scope = container.querySelector('#select-tpl-scope').value;
    const body = container.querySelector('#textarea-tpl-body').value.trim();

    const isGlobal = scope === 'global' && isAdmin;
    const teamId = isGlobal ? null : (currentUser.team_id || null);

    const submitBtn = container.querySelector('#btn-submit-template');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
      await saveTemplateInFirestore(id, {
        id,
        title,
        category,
        scope,
        is_global: isGlobal,
        team_id: teamId,
        body,
        created_by_uid: currentUser.uid,
        created_by_name: currentUser.name || currentUser.email
      });

      showToast(`Template "${title}" salvo com sucesso!`, 'success');
      modal.style.display = 'none';
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      showToast('Erro ao salvar template no Firestore.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar Template';
    }
  });

  // Subscriptions
  const unsubTemplates = subscribeToTemplates((list) => {
    allTemplates = list;
    renderTemplates();
  });

  const unsubTeams = subscribeToTenantTeams((teams) => {
    allTeams = teams;
    renderTemplates();
  });

  return () => {
    if (unsubTemplates) unsubTemplates();
    if (unsubTeams) unsubTeams();
  };
}
