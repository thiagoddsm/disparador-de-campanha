import { 
  subscribeToTemplates, 
  saveTemplateInFirestore, 
  deleteTemplateFromFirestore, 
  subscribeToTenantTeams 
} from '../firebase/realtime.js';
import { resolveSpintax } from '../firebase/evolutionApi.js';
import { showToast } from '../utils/feedback.js';

export function renderTemplatesManager(container, currentUser, onNavigate) {
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const canManage = isAdmin || isCoordinator;

  let allTemplates = [];
  let allTeams = [];
  let scopeFilter = 'all'; // 'all' | 'global' | 'team'
  let searchQuery = '';

  container.innerHTML = `
    <div class="page-content">
      <!-- Title -->
      <div style="margin-bottom: 1rem;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">
          Templates
        </h2>
      </div>

      <!-- Search Bar -->
      <div style="position: relative; width: 100%; margin-bottom: 1.25rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" style="position: absolute; left: 0.9rem; top: 50%; transform: translateY(-50%);">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="input-search-template" class="topbar-search-input" placeholder="Buscar templates..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.5rem; font-size: 0.88rem; background: #FFFFFF; height: 44px; border: 1px solid var(--border-color);">
      </div>

      <!-- Templates Grid -->
      <div id="templates-grid-mount" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
        <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
          Carregando templates...
        </div>
      </div>

      <!-- Floating Plus FAB -->
      ${canManage ? `
        <button class="fab-button" id="fab-add-template" title="Criar Novo Template">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
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
              <button type="button" id="btn-test-spintax-modal" class="pill-btn" style="background: #E7FFDB; color: #075E54; border: 1px solid #C4EDAF; font-size: 0.72rem; font-weight: 700; cursor: pointer; padding: 2px 8px;">
                🎲 Testar Variação Spintax
              </button>
            </div>
            
            <div class="note-box-blue" style="margin-bottom: 0.5rem; font-size: 0.75rem; padding: 0.6rem 0.8rem;">
              Use <strong>{nome}</strong> para o lead e <strong>{empresa}</strong> para a região/empresa.<br>
              Anti-Ban Spintax: <code>{Olá|Oi|Bom dia}</code> para gerar textos com variações aleatórias.
            </div>

            <textarea id="textarea-tpl-body" class="template-textarea" style="height: 140px; font-size: 0.88rem;" placeholder="Digite a mensagem do template..." required></textarea>
            
            <div id="spintax-test-preview" style="display: none; margin-top: 0.5rem; background: #E7FFDB; border: 1px solid #C4EDAF; border-radius: var(--radius-sm); padding: 0.6rem 0.8rem; font-size: 0.8rem; color: #075E54;">
              <strong>Prévia Sorteada:</strong> <span id="spintax-test-preview-text"></span>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button type="button" id="btn-cancel-template" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-submit-template" class="btn-wa-action" style="width: auto; padding: 0.65rem 1.25rem; font-size: 0.9rem;">
              Salvar Template
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Renderiza os Cards de Template
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

    grid.innerHTML = filtered.map(tpl => {
      const canEdit = isAdmin || (isCoordinator && tpl.created_by_uid === currentUser.uid);
      const categoryLabel = {
        marketing: 'Marketing',
        utilitario: 'Utilitário',
        abordagem: 'Abordagem',
        convite: 'Convite',
        lembrete: 'Lembrete',
        geral: 'Geral'
      }[tpl.category] || 'Marketing';

      return `
        <div class="main-panel-card" style="padding: 1.25rem; border-radius: var(--radius-lg); background: #FFFFFF; border: 1px solid var(--border-color); box-shadow: var(--shadow-xs);">
          <!-- Card Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.35rem;">
                ${tpl.title}
              </h3>
              <span class="pill-btn" style="background: #E0F2FE; color: #0284C7; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                ${categoryLabel}
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="display: inline-flex; align-items: center; gap: 4px; color: #15803D; font-weight: 700; font-size: 0.78rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="16 12 12 8 8 12"></polyline><line x1="12" y1="16" x2="12" y2="8"></line></svg>
                ✓ Aprovado
              </span>
            </div>
          </div>

          <!-- Message Body Preview Box -->
          <div style="background: #F1F5F9; border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.88rem; color: #334155; line-height: 1.5; margin-bottom: 1rem; word-break: break-word;">
            ${tpl.body}
          </div>

          <!-- Card Footer Actions -->
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1.25rem;">
            ${canEdit ? `
              <button class="btn-edit-tpl" data-id="${tpl.id}" style="background: none; border: none; color: #64748B; font-weight: 600; font-size: 0.85rem; cursor: pointer; padding: 0;">
                Editar
              </button>
            ` : ''}
            <button class="btn-use-tpl" data-body="${encodeURIComponent(tpl.body)}" style="background: none; border: none; color: #008069; font-weight: 800; font-size: 0.88rem; cursor: pointer; padding: 0;">
              Enviar Teste / Usar
            </button>
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
