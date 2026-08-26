import { db } from '../firebase/config.js';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { subscribeToAllUsers } from '../firebase/realtime.js';

export function renderRolesManagement(container, currentUser, onNavigate) {
  let rolesData = [];
  let allUsers = [];

  const initialRoles = [
    {
      id: 'admin',
      name: 'Administrador',
      description: 'Acesso total e irrestrito a todas as funções e dados do sistema',
      status: 'ATIVO',
      iconBg: '#EFF6FF',
      iconColor: '#1D4ED8',
      permissions: {
        dashboard: { view: true, edit: true, delete: true, export: true },
        teams: { view: true, edit: true, delete: true, export: true },
        dispatches: { view: true, edit: true, delete: true, export: true },
        contacts: { view: true, edit: true, delete: true, export: true }
      }
    },
    {
      id: 'coordinator',
      name: 'Coordenador / Gestor',
      description: 'Criação e gestão da equipe vinculada, disparos e metas',
      status: 'ATIVO',
      iconBg: '#FAF5FF',
      iconColor: '#9333EA',
      permissions: {
        dashboard: { view: true, edit: true, delete: false, export: true },
        teams: { view: true, edit: true, delete: false, export: true },
        dispatches: { view: true, edit: true, delete: true, export: true },
        contacts: { view: true, edit: true, delete: false, export: true }
      }
    },
    {
      id: 'member',
      name: 'Operador de Disparos',
      description: 'Disparos assistidos (wa.me) e acompanhamento dos próprios contatos',
      status: 'ATIVO',
      iconBg: '#F1F5F9',
      iconColor: '#64748B',
      permissions: {
        dashboard: { view: true, edit: false, delete: false, export: false },
        teams: { view: false, edit: false, delete: false, export: false },
        dispatches: { view: true, edit: true, delete: false, export: false },
        contacts: { view: true, edit: false, delete: false, export: false }
      }
    }
  ];

  function getMemberCount(roleId, roleName) {
    const rId = (roleId || '').toLowerCase();
    const rName = (roleName || '').toLowerCase();
    return allUsers.filter(u => {
      const uRole = (u.role || '').toLowerCase();
      return uRole === rId || (rId === 'coordinator' && uRole === 'coordenador') || (rId === 'member' && uRole === 'operador');
    }).length;
  }

  function renderList() {
    container.innerHTML = `
      <div class="page-content" style="max-width: 1200px;">
        <!-- Header Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Gestão de Perfis e Cargos</h1>
            <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem;">
              Gerencie os cargos de acesso, edite nomes e configure permissões detalhadas da equipe no Cloud Firestore.
            </p>
          </div>

          <button id="btn-create-new-role" class="btn-primary-blue" style="padding: 0.65rem 1.25rem; font-size: 0.9rem; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Criar Novo Cargo
          </button>
        </div>

        <!-- Main Card -->
        <div class="main-panel-card" style="border-radius: var(--radius-lg);">
          <!-- Search & Filter Header -->
          <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 1rem;">
            <div style="position: relative; width: 360px; max-width: 100%;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="input-search-roles" class="topbar-search-input" placeholder="Buscar cargo ou perfil..." style="width: 100%; border-radius: var(--radius-md); padding-left: 2.3rem; background: #FFFFFF; font-size: 0.85rem;">
            </div>

            <button id="btn-filter-roles" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.45rem 1rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              Filtros
            </button>
          </div>

          <!-- Roles Table -->
          <div class="table-container">
            <table class="panel-table">
              <thead>
                <tr>
                  <th style="width: 45%;">NOME DO CARGO</th>
                  <th style="width: 25%;">MEMBROS CADASTRADOS</th>
                  <th style="width: 15%;">STATUS</th>
                  <th style="width: 15%; text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody id="roles-tbody">
                ${rolesData.length === 0 ? `
                  <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando cargos do Firestore...</td></tr>
                ` : rolesData.map(role => {
                  const count = getMemberCount(role.id, role.name);
                  return `
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.85rem;">
                          <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: ${role.iconBg || '#EFF6FF'}; color: ${role.iconColor || '#1D4ED8'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                          </div>
                          <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 0.92rem;">${role.name}</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.1rem;">${role.description || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style="color: var(--text-main); font-weight: 500; font-size: 0.88rem;">
                        <strong style="color: var(--text-main); font-size: 0.95rem;">${count}</strong> <span style="color: var(--text-muted);">${count === 1 ? 'usuário ativo' : 'usuários ativos'}</span>
                      </td>
                      <td>
                        <span class="status-pill ${role.status === 'ATIVO' ? 'ativo' : 'inativo'}" style="font-weight: 700; font-size: 0.72rem; padding: 0.25rem 0.65rem;">
                          ${role.status || 'ATIVO'}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                          <button class="btn-edit-role" data-id="${role.id}" style="background: none; border: none; cursor: pointer; color: var(--primary-blue); padding: 5px;" title="Editar Cargo e Permissões">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button class="btn-delete-role" data-id="${role.id}" style="background: none; border: none; cursor: pointer; color: #EF4444; padding: 5px;" title="Excluir Cargo">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
            <span>Mostrando ${rolesData.length} de ${rolesData.length} cargos cadastrados</span>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button class="btn-outline-white" style="padding: 0.3rem 0.6rem;" disabled>&lt;</button>
              <button class="btn-primary-blue" style="padding: 0.3rem 0.75rem; font-size: 0.85rem; min-width: 32px;">1</button>
              <button class="btn-outline-white" style="padding: 0.3rem 0.6rem;" disabled>&gt;</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Listeners de edição
    container.querySelectorAll('.btn-edit-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.getAttribute('data-id');
        const role = rolesData.find(r => r.id === roleId);
        if (role) renderPermissionsMatrix(role);
      });
    });

    // Listener de exclusão no Firestore
    container.querySelectorAll('.btn-delete-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const roleId = btn.getAttribute('data-id');
        if (confirm('Deseja realmente excluir este cargo do Firestore?')) {
          try {
            await deleteDoc(doc(db, 'roles', roleId));
          } catch (e) {
            console.warn('Erro ao deletar cargo no Firestore:', e);
          }
          rolesData = rolesData.filter(r => r.id !== roleId);
          renderList();
        }
      });
    });

    // Listener de novo cargo
    container.querySelector('#btn-create-new-role')?.addEventListener('click', () => {
      const newRole = {
        id: `role_${Date.now()}`,
        name: 'Novo Cargo',
        description: 'Descrição das responsabilidades do novo cargo',
        status: 'ATIVO',
        iconBg: '#F0FDF4',
        iconColor: '#16A34A',
        permissions: {
          dashboard: { view: true, edit: false, delete: false, export: false },
          teams: { view: true, edit: false, delete: false, export: false },
          dispatches: { view: true, edit: true, delete: false, export: false },
          contacts: { view: true, edit: false, delete: false, export: false }
        }
      };
      renderPermissionsMatrix(newRole);
    });

    // Busca
    container.querySelector('#input-search-roles')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = container.querySelectorAll('#roles-tbody tr');
      rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  function renderPermissionsMatrix(role) {
    const permissions = role.permissions || {
      dashboard: { view: true, edit: false, delete: false, export: false },
      teams: { view: true, edit: false, delete: false, export: false },
      dispatches: { view: true, edit: true, delete: false, export: false },
      contacts: { view: true, edit: false, delete: false, export: false }
    };

    container.innerHTML = `
      <div class="page-content" style="max-width: 1200px;">
        <!-- Breadcrumb & Top Actions -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
              <a href="#" id="breadcrumb-roles" style="color: var(--text-muted); text-decoration: none;">Gestão de Perfis</a>
              <span>›</span>
              <span style="color: var(--primary-blue); font-weight: 600;">Edição do Cargo</span>
            </div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Cargo: ${role.name}</h1>
            <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem;">
              Altere o nome do cargo e configure os níveis de acesso para os usuários vinculados no Firestore.
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <button id="btn-cancel-permissions" class="btn-outline-white" style="padding: 0.65rem 1.25rem; font-size: 0.9rem; font-weight: 600;">
              Cancelar
            </button>
            <button id="btn-save-permissions" class="btn-primary-blue" style="padding: 0.65rem 1.4rem; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Salvar no Firestore
            </button>
          </div>
        </div>

        <!-- Role Name & Description Card -->
        <div class="main-panel-card" style="border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem; background: #FFFFFF;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 1rem;">Identificação do Cargo</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1.5fr 160px; gap: 1.25rem; align-items: flex-end;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Nome do Cargo *</label>
              <input type="text" id="input-edit-role-name" class="topbar-search-input" value="${role.name}" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem; font-size: 0.95rem; font-weight: 700; color: var(--text-main);" required>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Descrição das Atribuições</label>
              <input type="text" id="input-edit-role-desc" class="topbar-search-input" value="${role.description || ''}" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem; font-size: 0.88rem;">
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.4rem;">Status</label>
              <select id="select-edit-role-status" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.88rem;">
                <option value="ATIVO" ${role.status === 'ATIVO' ? 'selected' : ''}>ATIVO</option>
                <option value="INATIVO" ${role.status === 'INATIVO' ? 'selected' : ''}>INATIVO</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Permissions Card -->
        <div class="main-panel-card" style="border-radius: var(--radius-lg); padding: 1.75rem;">
          <!-- Card Header with Toggle All -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Matriz de Permissões Granulares</h3>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">HABILITAR TUDO</span>
              <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="toggle-all-perms" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #CBD5E1; transition: .3s; border-radius: 24px;"></span>
              </label>
            </div>
          </div>

          <!-- Modules List -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            
            <!-- Module 1: Dashboard -->
            <div style="padding: 1.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #FFFFFF;">
              <div style="display: flex; align-items: flex-start; gap: 0.85rem; max-width: 320px;">
                <div style="color: var(--primary-blue); margin-top: 2px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Dashboard</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Acesso a métricas e relatórios gerais.</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                ${renderPermissionCheckbox('dashboard_view', 'Visualizar', permissions.dashboard?.view)}
                ${renderPermissionCheckbox('dashboard_edit', 'Editar', permissions.dashboard?.edit)}
                ${renderPermissionCheckbox('dashboard_delete', 'Excluir', permissions.dashboard?.delete)}
                ${renderPermissionCheckbox('dashboard_export', 'Exportar', permissions.dashboard?.export)}
              </div>
            </div>

            <!-- Module 2: Equipes -->
            <div style="padding: 1.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #FFFFFF;">
              <div style="display: flex; align-items: flex-start; gap: 0.85rem; max-width: 320px;">
                <div style="color: var(--primary-blue); margin-top: 2px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Equipes</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Gerenciamento de membros e cargos.</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                ${renderPermissionCheckbox('teams_view', 'Visualizar', permissions.teams?.view)}
                ${renderPermissionCheckbox('teams_edit', 'Editar', permissions.teams?.edit)}
                ${renderPermissionCheckbox('teams_delete', 'Excluir', permissions.teams?.delete)}
                ${renderPermissionCheckbox('teams_export', 'Exportar', permissions.teams?.export)}
              </div>
            </div>

            <!-- Module 3: Disparos -->
            <div style="padding: 1.25rem; border: 1px solid #E0E7FF; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #F8FAFC;">
              <div style="display: flex; align-items: flex-start; gap: 0.85rem; max-width: 320px;">
                <div style="color: var(--primary-blue); margin-top: 2px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Disparos</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Controle de campanhas e envios em massa.</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                ${renderPermissionCheckbox('disp_view', 'Visualizar', permissions.dispatches?.view)}
                ${renderPermissionCheckbox('disp_edit', 'Editar', permissions.dispatches?.edit)}
                ${renderPermissionCheckbox('disp_delete', 'Excluir', permissions.dispatches?.delete)}
                ${renderPermissionCheckbox('disp_export', 'Exportar', permissions.dispatches?.export)}
              </div>
            </div>

            <!-- Module 4: Contatos -->
            <div style="padding: 1.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #FFFFFF;">
              <div style="display: flex; align-items: flex-start; gap: 0.85rem; max-width: 320px;">
                <div style="color: var(--primary-blue); margin-top: 2px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Contatos</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Base de clientes e leads.</div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                ${renderPermissionCheckbox('contacts_view', 'Visualizar', permissions.contacts?.view)}
                ${renderPermissionCheckbox('contacts_edit', 'Editar', permissions.contacts?.edit)}
                ${renderPermissionCheckbox('contacts_delete', 'Excluir', permissions.contacts?.delete)}
                ${renderPermissionCheckbox('contacts_export', 'Exportar', permissions.contacts?.export)}
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    container.querySelector('#breadcrumb-roles')?.addEventListener('click', (e) => {
      e.preventDefault();
      renderList();
    });

    container.querySelector('#btn-cancel-permissions')?.addEventListener('click', () => {
      renderList();
    });

    container.querySelector('#btn-save-permissions')?.addEventListener('click', async () => {
      const saveBtn = container.querySelector('#btn-save-permissions');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Salvando...';

      const newName = container.querySelector('#input-edit-role-name').value.trim();
      const newDesc = container.querySelector('#input-edit-role-desc').value.trim();
      const newStatus = container.querySelector('#select-edit-role-status').value;

      if (!newName) {
        alert('Por favor, informe o nome do cargo.');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Salvar no Firestore';
        return;
      }

      role.name = newName;
      role.description = newDesc;
      role.status = newStatus;

      role.permissions = {
        dashboard: {
          view: container.querySelector('#dashboard_view')?.checked || false,
          edit: container.querySelector('#dashboard_edit')?.checked || false,
          delete: container.querySelector('#dashboard_delete')?.checked || false,
          export: container.querySelector('#dashboard_export')?.checked || false
        },
        teams: {
          view: container.querySelector('#teams_view')?.checked || false,
          edit: container.querySelector('#teams_edit')?.checked || false,
          delete: container.querySelector('#teams_delete')?.checked || false,
          export: container.querySelector('#teams_export')?.checked || false
        },
        dispatches: {
          view: container.querySelector('#disp_view')?.checked || false,
          edit: container.querySelector('#disp_edit')?.checked || false,
          delete: container.querySelector('#disp_delete')?.checked || false,
          export: container.querySelector('#disp_export')?.checked || false
        },
        contacts: {
          view: container.querySelector('#contacts_view')?.checked || false,
          edit: container.querySelector('#contacts_edit')?.checked || false,
          delete: container.querySelector('#contacts_delete')?.checked || false,
          export: container.querySelector('#contacts_export')?.checked || false
        }
      };

      try {
        await setDoc(doc(db, 'roles', role.id), {
          ...role,
          updated_at: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('Erro ao salvar no Firestore:', err);
      }

      renderList();
    });

    container.querySelector('#toggle-all-perms')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      container.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const parentLabel = cb.closest('label');
        if (parentLabel) {
          parentLabel.style.background = isChecked ? '#EFF6FF' : '#FFFFFF';
          parentLabel.style.borderColor = isChecked ? '#1D4ED8' : 'var(--border-color)';
          const textSpan = parentLabel.querySelector('span');
          if (textSpan) textSpan.style.color = isChecked ? '#1D4ED8' : 'var(--text-main)';
        }
      });
    });
  }

  function renderPermissionCheckbox(id, label, isChecked = false) {
    return `
      <label style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.55rem 0.85rem; border: 1px solid ${isChecked ? '#1D4ED8' : 'var(--border-color)'}; border-radius: var(--radius-md); background: ${isChecked ? '#EFF6FF' : '#FFFFFF'}; min-width: 110px; cursor: pointer;">
        <span style="font-size: 0.82rem; font-weight: 600; color: ${isChecked ? '#1D4ED8' : 'var(--text-main)'};">${label}</span>
        <input type="checkbox" class="perm-checkbox" id="${id}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: #1D4ED8; cursor: pointer;">
      </label>
    `;
  }

  // Subscribe em tempo real à lista de usuários unificada
  const unsubUsers = subscribeToAllUsers((users) => {
    allUsers = users;
    renderList();
  });

  // Subscribe em tempo real à coleção /roles no Firestore
  const unsubRoles = onSnapshot(collection(db, 'roles'), (snap) => {
    if (!snap.empty) {
      rolesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      // Provisiona os cargos reais iniciais no Firestore
      rolesData = initialRoles;
      initialRoles.forEach(r => {
        setDoc(doc(db, 'roles', r.id), r).catch(() => {});
      });
    }
    renderList();
  }, (err) => {
    rolesData = initialRoles;
    renderList();
  });

  return () => {
    unsubUsers();
    unsubRoles();
  };
}
