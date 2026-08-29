import {
  subscribeToAllContacts,
  subscribeToTeamContacts,
  subscribeToOperatorContacts,
  subscribeToTenantTeams,
  subscribeToAllUsers,
  subscribeToTeamMembers,
  saveContactsBatch,
  reassignContactInFirestore,
  DEFAULT_TENANT_ID
} from '../firebase/realtime.js';
import { showToast } from '../utils/feedback.js';
import { setupSearchableLocationInput } from './SearchableLocationSelect.js';

export function renderContactsView(container, currentUser, onNavigate) {
  let allContacts = [];
  let allTeams = [];
  let allUsers = [];
  let teamMembers = [];
  
  let selectedTeamId = 'all'; // 'all' | 'mine' | '<team_id>'
  let selectedMemberUid = 'all'; // 'all' | '<uid>'
  let statusFilter = 'all'; // 'all' | 'confirmed' | 'opened' | 'pending'
  let locationFilter = '';
  let searchQuery = '';

  const isMember = currentUser?.role === 'member';
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';

  if (isMember) {
    // LAYOUT MOBILE E OPERADOR
    container.innerHTML = `
      <!-- Topbar Verde WhatsApp (Mobile) -->
      <div style="background: #008069; color: #FFFFFF; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.3px;">WhatsApp - ${currentUser.name || 'Operador'}</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <button id="btn-goto-history-mobile" style="background: none; border: none; color: #FFFFFF; font-size: 1.15rem; cursor: pointer; padding: 0;" title="Histórico de Envios">
            📜
          </button>
        </div>
      </div>

      <div style="background: #075E54; padding: 0.5rem 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="position: relative;">
          <input type="text" id="contacts-search-mobile" placeholder="Buscar por nome, telefone..." style="width: 100%; padding: 0.55rem 1rem 0.55rem 2.2rem; border-radius: 9999px; border: none; font-size: 0.85rem; background: #FFFFFF; color: #1E293B; outline: none; box-sizing: border-box;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%);">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div style="position: relative;">
          <input type="text" id="contacts-location-filter-mobile" placeholder="📍 Filtrar por Cidade ou Bairro (RJ)..." style="width: 100%; padding: 0.5rem 1rem 0.5rem 2.2rem; border-radius: 9999px; border: none; font-size: 0.82rem; background: #FFFFFF; color: #1E293B; outline: none; box-sizing: border-box;">
          <span style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); font-size: 0.85rem;">📍</span>
        </div>
      </div>

      <!-- Lista Simples de Contatos WhatsApp -->
      <div style="background: #FFFFFF; min-height: calc(100vh - 130px); padding-bottom: 5.5rem; max-width: 520px; margin: 0 auto; width: 100%; box-sizing: border-box;">
        <div id="contacts-mobile-list" style="display: flex; flex-direction: column;">
          <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
            Carregando contatos...
          </div>
        </div>

        <!-- Floating Green Plus FAB -->
        <button id="btn-fab-add-contact" class="fab-button" title="Adicionar Contato">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Adicionar Contato Mobile -->
      <div id="add-contact-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">Adicionar Novo Contato</h3>
            <button id="btn-close-contact-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>
          <form id="add-contact-form" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Nome Completo</label>
              <input type="text" id="input-contact-name" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: João da Silva" required>
            </div>
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">WhatsApp / Telefone (DDD + Número)</label>
              <input type="tel" inputmode="tel" id="input-contact-phone" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Ex: 5521999998888" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Cidade (RJ)</label>
                <input type="text" id="input-contact-city" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar cidade..." autocomplete="off">
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Bairro (RJ)</label>
                <input type="text" id="input-contact-neighborhood" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem;" placeholder="Digite para buscar bairro..." autocomplete="off">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-contact-modal" class="btn-outline-white">Cancelar</button>
              <button type="submit" id="btn-save-contact-submit" class="btn-green-action">Salvar Contato</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } else {
    // LAYOUT GERENCIAL DESKTOP CORRESPONDENTE À REFERÊNCIA VISUAL
    container.innerHTML = `
      <div class="page-content" style="max-width: 1300px; padding: 1.5rem;">
        
        <!-- Header Row com Título e Ações -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0;">
              Banco Global de Contatos
            </h2>
            <div style="margin-top: 0.5rem;">
              <span style="font-size: 1.05rem; font-weight: 800; color: #1E293B;">Supervisão hierárquica</span>
              <p style="font-size: 0.85rem; color: #64748B; margin: 2px 0 0 0;">
                Navegue entre Coordenadores e acompanhe a distribuição por Líder.
              </p>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button id="btn-goto-import" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.6rem 1.15rem; border-radius: var(--radius-md); font-weight: 600; display: inline-flex; align-items: center; gap: 0.45rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Importar CSV
            </button>
            <button id="btn-open-add-contact" class="btn-green-action" style="font-size: 0.85rem; padding: 0.6rem 1.25rem; border-radius: var(--radius-md); font-weight: 700; display: inline-flex; align-items: center; gap: 0.45rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
              Adicionar Contato
            </button>
          </div>
        </div>

        <!-- Breadcrumb Hierárquico -->
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 700; margin-bottom: 1.25rem; flex-wrap: wrap;">
          <span style="color: #16A34A; display: inline-flex; align-items: center; gap: 0.3rem;">🏢 Coordenadores</span>
          <span style="color: #94A3B8;">›</span>
          <span style="color: #475569; display: inline-flex; align-items: center; gap: 0.3rem;">👥 Líderes</span>
          <span style="color: #94A3B8;">›</span>
          <span style="color: #94A3B8; display: inline-flex; align-items: center; gap: 0.3rem;">👤 Membros</span>
        </div>

        <!-- Barra de Filtros com Pills em Destaque & Dropdown de Coordenadores -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            
            <!-- Pill Minha Base -->
            <div id="pill-filter-mine" style="border: 2px solid #CBD5E1; background: #FFFFFF; border-radius: 12px; padding: 0.65rem 1.15rem; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; min-width: 170px; transition: all 0.15s ease;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <span style="color: #16A34A; font-weight: 800; font-size: 0.9rem;">⭐ Minha Base</span>
                  <span id="pill-mine-count" style="background: #E2E8F0; color: #475569; font-size: 0.72rem; font-weight: 800; padding: 1px 7px; border-radius: 99px;">0</span>
                </div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 1px;">Contatos diretos</div>
              </div>
            </div>

            <!-- Pill Visão Geral -->
            <div id="pill-filter-all" style="border: 2px solid #16A34A; background: #F0FDF4; border-radius: 12px; padding: 0.65rem 1.15rem; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; min-width: 170px; transition: all 0.15s ease;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <span style="color: #1E293B; font-weight: 800; font-size: 0.9rem;">🌐 Visão Geral</span>
                  <span id="pill-all-count" style="background: #16A34A; color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 1px 7px; border-radius: 99px;">0</span>
                </div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 1px;">Todos os contatos</div>
              </div>
            </div>

          </div>

          <!-- Dropdown Filtrar por Coordenador/Líder -->
          <div style="min-width: 280px; flex: 1; max-width: 380px;">
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748B; margin-bottom: 0.25rem;">
              Filtrar por Coordenador/Líder
            </label>
            <select id="filter-team-select" class="form-control" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border: 1px solid #CBD5E1; font-weight: 600; outline: none;">
              <option value="all">Todos os Coordenadores</option>
              <option value="mine">Minha Base Pessoal</option>
            </select>
          </div>
        </div>

        <!-- 3 KPI Cards da Referência Visual -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
          
          <!-- Card 1: Total na Seleção -->
          <div class="kpi-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 0.45rem; color: #2563EB; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.65rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path></svg>
              <span>Total na Seleção</span>
            </div>
            <div id="kpi-contacts-total" style="font-size: 2.3rem; font-weight: 900; color: #0F172A; line-height: 1;">0</div>
            <div style="font-size: 0.78rem; color: #2563EB; margin-top: 0.65rem; font-weight: 600;">Contatos mapeados</div>
          </div>

          <!-- Card 2: Disparos Confirmados -->
          <div class="kpi-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 0.45rem; color: #16A34A; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.65rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Disparos Confirmados</span>
            </div>
            <div id="kpi-contacts-sent" style="font-size: 2.3rem; font-weight: 900; color: #0F172A; line-height: 1;">0</div>
            <div style="font-size: 0.78rem; color: #64748B; margin-top: 0.65rem;">Envios confirmados</div>
          </div>

          <!-- Card 3: Taxa de Conclusão -->
          <div class="kpi-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 0.45rem; color: #D97706; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.65rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Taxa de Conclusão</span>
            </div>
            <div id="kpi-contacts-rate" style="font-size: 2.3rem; font-weight: 900; color: #0F172A; line-height: 1;">0%</div>
            <div style="width: 100%; height: 7px; background: #FEF3C7; border-radius: 99px; overflow: hidden; margin-top: 0.75rem;">
              <div id="kpi-contacts-prog-bar" style="width: 0%; height: 100%; background: #F59E0B; transition: width 0.3s ease;"></div>
            </div>
          </div>

        </div>

        <!-- Campo de Busca Arredondado -->
        <div style="position: relative; margin-bottom: 1.25rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="position: absolute; left: 1.15rem; top: 50%; transform: translateY(-50%);">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="contacts-search" placeholder="Buscar por nome ou telefone..." style="width: 100%; padding: 0.8rem 1.25rem 0.8rem 3rem; border-radius: 9999px; border: 1.5px solid #E2E8F0; background: #FFFFFF; font-size: 0.88rem; outline: none; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.03); color: var(--text-main);">
        </div>

        <!-- Contacts Table Card -->
        <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
          <div class="table-container">
            <table class="panel-table" style="font-size: 0.85rem; width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #E2E8F0; background: #F8FAFC;">
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: left; font-size: 0.75rem; text-transform: uppercase;">NOME</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: left; font-size: 0.75rem; text-transform: uppercase;">TELEFONE</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: left; font-size: 0.75rem; text-transform: uppercase;">CIDADE</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: left; font-size: 0.75rem; text-transform: uppercase;">BAIRRO</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: left; font-size: 0.75rem; text-transform: uppercase;">LÍDER ATRIBUÍDO</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: center; font-size: 0.75rem; text-transform: uppercase;">STATUS</th>
                  <th style="padding: 0.85rem 1rem; color: #64748B; font-weight: 700; text-align: right; font-size: 0.75rem; text-transform: uppercase;">AÇÕES</th>
                </tr>
              </thead>
              <tbody id="contacts-tbody">
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">Carregando contatos...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Modal Adicionar Contato Desktop -->
      <div id="add-contact-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content" style="max-width: 500px;">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Adicionar Novo Contato</h3>
            <button id="btn-close-contact-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>
          <form id="add-contact-form" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Nome Completo *</label>
              <input type="text" id="input-contact-name" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);" placeholder="Ex: Thiago Lopes" required>
            </div>
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">WhatsApp / Telefone *</label>
              <input type="tel" inputmode="tel" id="input-contact-phone" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);" placeholder="Ex: 21991591272" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Cidade</label>
                <input type="text" id="input-contact-city" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);" placeholder="Digite cidade..." autocomplete="off">
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Bairro</label>
                <input type="text" id="input-contact-neighborhood" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);" placeholder="Digite bairro..." autocomplete="off">
              </div>
            </div>

            <!-- Atribuição a Líder / Membro -->
            ${!isMember ? `
              <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Atribuir ao Líder</label>
                <select id="select-contact-assignee" class="topbar-search-input" style="width: 100%; background: #FFFFFF; font-size: 0.85rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);"></select>
              </div>
            ` : ''}

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
              <button type="button" id="btn-cancel-contact-modal" class="btn-outline-white">Cancelar</button>
              <button type="submit" id="btn-save-contact-submit" class="btn-green-action">Salvar Contato</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Modal Reatribuição
  const reassignModalHtml = `
    <div id="modal-reassign" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 480px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Reatribuir Contato</h3>
          <button id="btn-close-reassign" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-reassign" style="padding: 1.5rem;">
          <input type="hidden" id="reassign-contact-id">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Selecione o Novo Líder Responsável</label>
            <select id="select-reassign-member" class="form-control" style="width: 100%; background: #FFFFFF; font-size: 0.88rem; padding: 0.6rem 0.85rem;" required></select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            <button type="button" id="btn-cancel-reassign" class="btn-outline-white">Cancelar</button>
            <button type="submit" class="btn-primary-blue" style="font-weight: 700;">Confirmar Reatribuição</button>
          </div>
        </form>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', reassignModalHtml);

  // Popula os Selects de Equipe e Coordenador
  function populateTeamDropdown() {
    const teamSel = container.querySelector('#filter-team-select');
    const pillMineCount = container.querySelector('#pill-mine-count');
    const pillAllCount = container.querySelector('#pill-all-count');

    const myTotalCount = allContacts.filter(c => c.assigned_to === currentUser.uid || c.assigned_to === currentUser.email || (currentUser.name && c.assigned_to_name === currentUser.name)).length;
    if (pillMineCount) pillMineCount.textContent = myTotalCount;
    if (pillAllCount) pillAllCount.textContent = allContacts.length;

    if (!teamSel) return;

    let options = '<option value="all">Todos os Coordenadores</option>';
    options += `<option value="mine" ${selectedTeamId === 'mine' ? 'selected' : ''}>⭐ Minha Base (${myTotalCount})</option>`;

    if (isAdmin) {
      allTeams.forEach(t => {
        const teamContactsCount = allContacts.filter(c => c.team_id === t.id || c.team_name === t.name).length;
        options += `<option value="${t.id}" ${selectedTeamId === t.id ? 'selected' : ''}>👥 ${t.name} (${t.coordinator_name || 'Coordenador'})</option>`;
      });
    } else if (isCoordinator) {
      options += `<option value="${currentUser.team_id}" ${selectedTeamId === currentUser.team_id ? 'selected' : ''}>👥 ${currentUser.team_name || 'Minha Equipe'}</option>`;
    }

    teamSel.innerHTML = options;
  }

  function updateAssigneesSelect() {
    const assignSel = container.querySelector('#select-contact-assignee');
    const reassignSel = container.querySelector('#select-reassign-member');
    const available = teamMembers.length > 0 ? teamMembers : allUsers.filter(u => u.role === 'member' || u.role === 'coordinator');

    const options = [
      `<option value="${currentUser.uid}" selected>⭐ Atribuir a Mim Mesmo (${currentUser.name || currentUser.email})</option>`,
      ...available.filter(m => m.uid !== currentUser.uid).map(m => `<option value="${m.uid}">👤 ${m.name || m.email} (${m.email || ''})</option>`)
    ].join('');

    if (assignSel) assignSel.innerHTML = options;
    if (reassignSel) reassignSel.innerHTML = options;
  }

  function applyFiltersAndRender() {
    let filtered = [...allContacts];

    // Filtro por Equipe / Seleção Pill
    if (selectedTeamId === 'mine') {
      filtered = filtered.filter(c => c.assigned_to === currentUser.uid || c.assigned_to === currentUser.email || (currentUser.name && c.assigned_to_name === currentUser.name));
    } else if (selectedTeamId !== 'all') {
      const team = allTeams.find(t => t.id === selectedTeamId);
      filtered = filtered.filter(c => c.team_id === selectedTeamId || (team && (c.team_id === team.name || c.team_name === team.name)));
    }

    // Filtro de Busca por Texto (Nome / Tel)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        ((c.neighborhood || c.bairro) && (c.neighborhood || c.bairro).toLowerCase().includes(q)) ||
        (c.assigned_to_name && c.assigned_to_name.toLowerCase().includes(q))
      );
    }

    // Atualiza Pills visuais
    const pillMine = container.querySelector('#pill-filter-mine');
    const pillAll = container.querySelector('#pill-filter-all');
    if (pillMine && pillAll) {
      if (selectedTeamId === 'mine') {
        pillMine.style.border = '2px solid #16A34A';
        pillMine.style.background = '#F0FDF4';
        pillAll.style.border = '2px solid #CBD5E1';
        pillAll.style.background = '#FFFFFF';
      } else {
        pillAll.style.border = '2px solid #16A34A';
        pillAll.style.background = '#F0FDF4';
        pillMine.style.border = '2px solid #CBD5E1';
        pillMine.style.background = '#FFFFFF';
      }
    }

    renderKPIs(filtered);
    renderTable(filtered);
  }

  function renderKPIs(list) {
    const totalEl = container.querySelector('#kpi-contacts-total');
    const sentEl = container.querySelector('#kpi-contacts-sent');
    const rateEl = container.querySelector('#kpi-contacts-rate');
    const progBar = container.querySelector('#kpi-contacts-prog-bar');

    const total = list.length;
    const confirmedCount = list.filter(c => c.status === 'user_confirmed' || c.status === 'confirmed' || c.status === 'opened').length;
    const rate = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

    if (totalEl) totalEl.textContent = total;
    if (sentEl) sentEl.textContent = confirmedCount;
    if (rateEl) rateEl.textContent = `${rate}%`;
    if (progBar) progBar.style.width = `${rate}%`;
  }

  function formatPhoneDisplay(phone) {
    if (!phone) return '—';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.substring(0, 2)} ${clean.substring(2, 7)}-${clean.substring(7)}`;
    }
    if (clean.length === 13 && clean.startsWith('55')) {
      return `${clean.substring(2, 4)} ${clean.substring(4, 9)}-${clean.substring(9)}`;
    }
    return phone;
  }

  function renderTable(list) {
    const tbody = container.querySelector('#contacts-tbody');
    const mobileList = container.querySelector('#contacts-mobile-list');

    if (tbody) {
      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3.5rem;">
              Nenhum contato encontrado nesta seleção.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = list.map(c => {
          const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
          const isOpened = c.status === 'opened';
          const initials = (c.name || 'C').substring(0, 2).toUpperCase();

          const statusBadge = isConfirmed
            ? '<span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 800; font-size: 0.72rem; padding: 3px 10px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #16A34A; display: inline-block;"></span> CONFIRMADO</span>'
            : isOpened
            ? '<span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 0.72rem; padding: 3px 10px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span> ABERTO (WA)</span>'
            : '<span class="pill-btn" style="background: #F1F5F9; color: #64748B; font-weight: 700; font-size: 0.72rem; padding: 3px 10px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; display: inline-block;"></span> PENDENTE</span>';

          const isMine = c.assigned_to === currentUser.uid || (currentUser.name && c.assigned_to_name === currentUser.name);
          const leaderLabel = isMine ? 'Você' : (c.assigned_to_name || 'Henrique Nelas');

          return `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 0.85rem 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="width: 34px; height: 34px; border-radius: 50%; background: #E2E8F0; color: #475569; font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${initials}
                  </div>
                  <strong style="color: #0F172A; font-size: 0.88rem;">${c.name}</strong>
                </div>
              </td>
              <td style="padding: 0.85rem 1rem; font-family: monospace; color: #334155; font-size: 0.85rem;">
                ${formatPhoneDisplay(c.phone)}
              </td>
              <td style="padding: 0.85rem 1rem; color: #64748B; font-size: 0.85rem;">${c.city || '—'}</td>
              <td style="padding: 0.85rem 1rem; color: #64748B; font-size: 0.85rem;">${c.neighborhood || c.bairro || '—'}</td>
              <td style="padding: 0.85rem 1rem; font-size: 0.83rem; color: #0F172A; font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span>${leaderLabel}</span>
                </div>
              </td>
              <td style="padding: 0.85rem 1rem; text-align: center;">${statusBadge}</td>
              <td style="padding: 0.85rem 1rem; text-align: right;">
                <button class="btn-reassign-action" data-id="${c.id}" style="border: 1px solid #CBD5E1; background: #FFFFFF; border-radius: 9999px; padding: 0.35rem 0.9rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; color: #334155; transition: all 0.15s ease;">
                  Reatribuir
                </button>
              </td>
            </tr>
          `;
        }).join('');

        // Reatribuir button listeners
        tbody.querySelectorAll('.btn-reassign-action').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            container.querySelector('#reassign-contact-id').value = id;
            container.querySelector('#modal-reassign').style.display = 'flex';
          });
        });
      }
    }

    if (mobileList) {
      if (list.length === 0) {
        mobileList.innerHTML = `
          <div style="text-align: center; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 3rem 1.5rem; color: var(--text-muted); margin: 1rem;">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">👥</div>
            <strong style="font-size: 1rem; color: var(--text-main);">Nenhum contato encontrado</strong>
            <p style="font-size: 0.82rem; margin-top: 0.25rem;">Nenhum registro para esta busca.</p>
          </div>
        `;
      } else {
        mobileList.innerHTML = `
          <div style="display: flex; flex-direction: column; background: #FFFFFF;">
            ${list.map(c => {
              const isConfirmed = c.status === 'user_confirmed' || c.status === 'confirmed';
              const isOpened = c.status === 'opened';
              const locationInfo = [c.city, c.neighborhood || c.bairro].filter(Boolean).join(' · ');

              return `
                <div class="wa-contact-item-row" style="display: flex; align-items: center; gap: 0.95rem; padding: 0.85rem 0.75rem; border-bottom: 1px solid #F1F5F9; cursor: pointer;">
                  <div style="width: 44px; height: 44px; border-radius: 50%; background: #E2E8F0; display: flex; align-items: center; justify-content: center; color: #64748B; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">
                    ${(c.name || 'C').substring(0, 2).toUpperCase()}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: #1E293B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${c.name}
                      </span>
                      ${isConfirmed ? `
                        <span style="font-size: 0.72rem; color: #15803D; font-weight: 700;">✓ Enviado</span>
                      ` : isOpened ? `
                        <span style="font-size: 0.72rem; color: #B45309; font-weight: 700;">Aberto</span>
                      ` : ''}
                    </div>
                    <div style="font-size: 0.82rem; color: #64748B; font-family: monospace;">
                      ${c.phone}
                    </div>
                    ${locationInfo ? `
                      <div style="font-size: 0.75rem; color: #0284C7; margin-top: 1px;">
                        📍 ${locationInfo}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }
  }

  // Pill filter clicks
  container.querySelector('#pill-filter-mine')?.addEventListener('click', () => {
    selectedTeamId = 'mine';
    const teamSel = container.querySelector('#filter-team-select');
    if (teamSel) teamSel.value = 'mine';
    applyFiltersAndRender();
  });

  container.querySelector('#pill-filter-all')?.addEventListener('click', () => {
    selectedTeamId = 'all';
    const teamSel = container.querySelector('#filter-team-select');
    if (teamSel) teamSel.value = 'all';
    applyFiltersAndRender();
  });

  // Filter Listeners
  container.querySelector('#filter-team-select')?.addEventListener('change', (e) => {
    selectedTeamId = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#contacts-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#contacts-search-mobile')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
  });

  container.querySelector('#btn-goto-import')?.addEventListener('click', () => onNavigate('import'));
  container.querySelector('#btn-goto-history')?.addEventListener('click', () => onNavigate('history'));
  container.querySelector('#btn-goto-history-mobile')?.addEventListener('click', () => onNavigate('history'));

  // Modais Handlers
  const modal = container.querySelector('#add-contact-modal');
  container.querySelector('#btn-open-add-contact')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  container.querySelector('#btn-fab-add-contact')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  container.querySelector('#btn-close-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#btn-cancel-contact-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });

  container.querySelector('#add-contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-contact-name').value.trim();
    const phone = container.querySelector('#input-contact-phone').value.trim();
    const city = container.querySelector('#input-contact-city')?.value.trim() || '';
    const neighborhood = container.querySelector('#input-contact-neighborhood')?.value.trim() || '';
    const assignSel = container.querySelector('#select-contact-assignee');
    const assignedUid = assignSel ? assignSel.value : currentUser.uid;
    const assignedName = assignSel ? assignSel.options[assignSel.selectedIndex]?.text.replace(/ \(.*\)/, '') : currentUser.name;

    const saveBtn = container.querySelector('#btn-save-contact-submit');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
    }

    try {
      await saveContactsBatch([{
        name,
        phone,
        city: city,
        neighborhood: neighborhood,
        bairro: neighborhood,
        tenant_id: currentUser.tenant_id || 'tenant_main',
        team_id: currentUser.team_id || null,
        assigned_to: assignedUid,
        assigned_to_name: assignedName,
        status: 'pending'
      }]);
      showToast(`Contato "${name}" adicionado com sucesso!`, 'success');
      modal.style.display = 'none';
      container.querySelector('#add-contact-form').reset();
    } catch (err) {
      console.error('Erro ao adicionar contato:', err);
      showToast(`Erro ao salvar contato: ${err.message}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Contato';
      }
    }
  });

  // Reatribuição Submit
  const reassignModal = container.querySelector('#modal-reassign');
  container.querySelector('#btn-close-reassign')?.addEventListener('click', () => { reassignModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-reassign')?.addEventListener('click', () => { reassignModal.style.display = 'none'; });

  container.querySelector('#form-reassign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contactId = container.querySelector('#reassign-contact-id').value;
    const reassignSel = container.querySelector('#select-reassign-member');
    const newUid = reassignSel.value;
    const newName = reassignSel.options[reassignSel.selectedIndex]?.text.replace(/ \(.*\)/, '');

    try {
      await reassignContactInFirestore(contactId, newUid, newName);
      showToast('Contato reatribuído com sucesso!', 'success');
      reassignModal.style.display = 'none';
    } catch (err) {
      console.error('Erro ao reatribuir contato:', err);
      showToast('Erro ao reatribuir contato no Firestore.', 'error');
    }
  });

  // Subscriptions em tempo real
  let unsubContacts = null;
  let unsubTeams = null;
  let unsubUsers = null;
  let unsubMembers = null;

  if (isAdmin) {
    unsubContacts = subscribeToAllContacts((realContacts) => {
      allContacts = realContacts;
      populateTeamDropdown();
      applyFiltersAndRender();
    });

    unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
      allTeams = teams;
      populateTeamDropdown();
    });

    unsubUsers = subscribeToAllUsers((users) => {
      allUsers = users;
      updateAssigneesSelect();
    });
  } else if (isCoordinator) {
    unsubContacts = subscribeToTeamContacts(currentUser.team_id, (teamContacts) => {
      allContacts = teamContacts;
      populateTeamDropdown();
      applyFiltersAndRender();
    });

    unsubMembers = subscribeToTeamMembers(currentUser.team_id, currentUser.uid, (members) => {
      teamMembers = members;
      updateAssigneesSelect();
    });
  } else {
    unsubContacts = subscribeToOperatorContacts(currentUser.uid, (userContacts) => {
      allContacts = userContacts;
      applyFiltersAndRender();
    });
  }

  return () => {
    if (unsubContacts) unsubContacts();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
    if (unsubMembers) unsubMembers();
  };
}
