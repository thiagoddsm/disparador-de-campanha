import { 
  subscribeToAllUsers, 
  subscribeToTenantTeams, 
  subscribeToAllContacts, 
  subscribeToAuditLogs,
  subscribeToMessagesHistory,
  createTeamInFirestore,
  deleteTeamFromFirestore,
  toggleUserActiveStatus,
  updateUserRole,
  updateUserTeam,
  deleteUserFromFirestore,
  recordSystemAuditLog,
  DEFAULT_TENANT_ID 
} from '../firebase/realtime.js';
import { createUserProfileDirectly } from '../firebase/auth.js';
import { showToast } from '../utils/feedback.js';
import { db } from '../firebase/config.js';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  calculateNetworkCoverage, 
  calculateCoordinatorsRanking, 
  calculateLeadersPerformance, 
  generateManagementAlerts, 
  calculateTimelineEvolution 
} from '../utils/metricsEngine.js';
import {
  getEvolutionPairingCode,
  getEvolutionQrCode,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
  generateHierarchicalInstanceName,
  sendSystemInviteNotification,
  buildInviteNotificationText,
  applyNotificationPreservationSettings,
  applyNotificationPreservationToAllInstances
} from '../firebase/evolutionApi.js';

export function renderAdminPanel(container, currentUser, onNavigate) {
  let allUsers = [];
  let allTeams = [];
  let allContacts = [];
  let allMessages = [];
  let auditLogs = [];
  let currentTab = 'overview'; // 'overview' | 'teams' | 'users' | 'audit'

  container.innerHTML = `
    <div class="page-content">
      <!-- Top Title & Action Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="pill-btn" style="background: #FEE2E2; color: #DC2626; font-weight: 700; font-size: 0.72rem;">Painel Global</span>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Gestão Central da Rede</h2>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">Painel executivo de cobertura, coordenadores, equipes e governança.</p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button id="btn-admin-new-team" class="btn-outline-white" style="font-weight: 600;">
            + Nova Equipe
          </button>
          <button id="btn-admin-new-coord" class="btn-primary-blue" style="font-weight: 600;">
            + Novo Coordenador
          </button>
        </div>
      </div>

      <!-- 4 Strategic Mobilization KPIs -->
      <div class="metrics-row" style="margin-bottom: 1.5rem;">
        <!-- KPI 1: Estrutura da Rede -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">ESTRUTURA DA REDE</span>
            <span class="metric-big-num" id="adm-kpi-structure">0 / 0</span>
            <span class="metric-subtext" id="adm-kpi-structure-sub">0 Coordenadores · 0 Líderes</span>
          </div>
          <div class="metric-icon-bubble">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>

        <!-- KPI 2: Cobertura da Rede -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">COBERTURA DA REDE</span>
            <span class="metric-big-num" id="adm-kpi-coverage" style="color: var(--whatsapp-green);">0%</span>
            <span class="metric-subtext" id="adm-kpi-coverage-sub">0 abordados · 0 pendentes</span>
          </div>
          <div class="metric-icon-bubble" style="background: #F0FDF4; color: var(--whatsapp-green);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
        </div>

        <!-- KPI 3: Atividade Recente -->
        <div class="metric-box">
          <div class="metric-info">
            <span class="metric-label">ATIVIDADE (7 DIAS)</span>
            <span class="metric-big-num" id="adm-kpi-activity">0</span>
            <span class="metric-subtext" id="adm-kpi-activity-sub">0 abordagens hoje</span>
          </div>
          <div class="metric-icon-bubble" style="background: #EFF6FF; color: var(--primary-blue);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
        </div>

        <!-- KPI 4: Saúde do WhatsApp -->
        <div class="metric-box" id="card-kpi-whatsapp-trigger" style="cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;" title="Clique para gerenciar as instâncias WhatsApp da rede">
          <div class="metric-info">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="metric-label">INSTÂNCIAS WHATSAPP</span>
              <span style="font-size: 0.7rem; color: #059669; font-weight: 700;">Ver Todos ›</span>
            </div>
            <span class="metric-big-num" id="adm-kpi-whatsapp" style="font-size: 1.35rem;">0 / 0</span>
            <span class="metric-subtext" id="adm-kpi-whatsapp-sub">🟢 0 Conectadas · 🔴 0 Offline</span>
          </div>
          <div class="metric-icon-bubble" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path></svg>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem; overflow-x: auto;">
        <button class="nav-tab-btn" id="tab-btn-overview" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 700; border: none; background: none; cursor: pointer; border-bottom: 2px solid var(--primary-blue); color: var(--primary-blue); white-space: nowrap;">
          📊 Visão Geral & Cobertura
        </button>
        <button class="nav-tab-btn" id="tab-btn-teams" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted); white-space: nowrap;">
          👥 Equipes Cadastradas
        </button>
        <button class="nav-tab-btn" id="tab-btn-users" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted); white-space: nowrap;">
          👤 Usuários & Cargos
        </button>
        <button class="nav-tab-btn" id="tab-btn-whatsapp" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted); white-space: nowrap;">
          📡 Saúde do WhatsApp
        </button>
        <button class="nav-tab-btn" id="tab-btn-audit" style="padding: 0.65rem 1.25rem; font-size: 0.88rem; font-weight: 600; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted); white-space: nowrap;">
          📜 Logs de Auditoria
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="admin-tab-content"></div>
    </div>

    <!-- Modal Nova Equipe -->
    <div id="modal-new-team" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 480px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Criar Nova Equipe</h3>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Cadastre a equipe e selecione o coordenador que a liderará.</p>
          </div>
          <button id="btn-close-team-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-new-team" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Nome da Equipe *</label>
            <input type="text" id="input-team-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.6rem 0.85rem;" placeholder="Ex: Equipe Delta - Norte" required>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-main);">Coordenador Responsável *</label>
            <select id="select-team-coord" class="form-control" style="padding: 0.6rem 0.85rem;" required></select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            <button type="button" id="btn-cancel-team-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-team-submit" class="btn-primary-blue" style="font-weight: 600;">Criar Equipe</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Novo Coordenador -->
    <div id="modal-new-coord" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 460px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Cadastrar Coordenador</h3>
          <button id="btn-close-coord-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <form id="form-new-coord" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Nome Completo</label>
            <input type="text" id="input-coord-name" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="Ex: Fernanda Lima" required>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">E-mail Corporativo</label>
            <input type="email" id="input-coord-email" class="topbar-search-input" style="width: 100%; border-radius: var(--radius-md); background: #FFFFFF; padding: 0.5rem 0.75rem;" placeholder="fernanda@empresa.com" required>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="btn-cancel-coord-modal" class="btn-outline-white">Cancelar</button>
            <button type="submit" id="btn-save-coord-submit" class="btn-primary-blue">Cadastrar Coordenador</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Alterar Cargo do Usuário -->
    <div id="modal-change-role" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 440px;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Alterar Cargo do Usuário</h3>
            <p id="modal-change-role-username" style="font-size: 0.82rem; color: var(--primary-blue); font-weight: 600; margin-top: 2px;">Usuário</p>
          </div>
          <button id="btn-close-role-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <input type="hidden" id="modal-target-user-uid">
          
          <button class="btn-select-role-option btn-outline-white" data-role="admin" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: var(--text-main); font-size: 0.95rem; display: block;">👑 Administrador</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Acesso total, governança e relatórios globais</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>

          <button class="btn-select-role-option btn-outline-white" data-role="coordinator" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: #1D4ED8; font-size: 0.95rem; display: block;">👔 Coordenador / Gestor</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Lidera equipes, contatos e membros</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>

          <button class="btn-select-role-option btn-outline-white" data-role="member" style="padding: 0.85rem 1rem; text-align: left; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
            <div>
              <strong style="color: var(--text-main); font-size: 0.95rem; display: block;">🎯 Membro da Equipe</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Disparos assistidos (wa.me) e metas</span>
            </div>
            <span style="font-size: 1.1rem;">›</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Detalhes do Alerta Operacional -->
    <div id="modal-alert-details" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 680px; max-height: 85vh; display: flex; flex-direction: column;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span id="modal-alert-icon" style="font-size: 1.4rem;">🔔</span>
            <div>
              <h3 id="modal-alert-title" style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">Detalhes do Alerta</h3>
              <p id="modal-alert-sub" style="font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0 0;">Lista de líderes identificados neste alerta operacional.</p>
            </div>
          </div>
          <button id="btn-close-alert-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        
        <div style="padding: 1rem 1.5rem; overflow-y: auto; flex: 1;">
          <div id="modal-alert-list" style="display: flex; flex-direction: column; gap: 0.6rem;">
            <!-- Itens carregados dinamicamente -->
          </div>
        </div>

        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: #F8FAFC; display: flex; justify-content: space-between; align-items: center;">
          <span id="modal-alert-footer-count" style="font-size: 0.8rem; font-weight: 700; color: #64748B;">0 líderes listados</span>
          <button id="btn-alert-modal-close-action" class="btn-outline-white" style="font-size: 0.82rem; padding: 0.4rem 1rem;">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal Pareamento & Notificação WhatsApp do Usuário (PIN / Pairing Code & QR Code) -->
    <div id="modal-user-whatsapp-pairing" class="modal-overlay" style="display: none;">
      <div class="modal-content" style="max-width: 620px; max-height: 90vh; display: flex; flex-direction: column;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #DCFCE7; color: #15803D; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
              📱
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h3 id="modal-wa-user-name" style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">Conectar WhatsApp do Líder</h3>
                <span id="modal-wa-user-status-badge" class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.72rem;">
                  Verificando...
                </span>
              </div>
              <p id="modal-wa-user-sub" style="font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0 0;">
                Gere o código de 8 dígitos para conectar à distância ou envie as instruções da campanha.
              </p>
            </div>
          </div>
          <button id="btn-close-wa-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>

        <div style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.15rem;">
          <input type="hidden" id="modal-wa-target-uid">

          <!-- Card de Identificação da Instância -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">INSTÂNCIA EVOLUTION</span>
              <div id="modal-wa-instance-display" style="font-family: monospace; font-size: 0.85rem; font-weight: 700; color: #0F172A;">
                <code>carregando...</code>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">EQUIPE</span>
              <div id="modal-wa-team-display" style="font-size: 0.82rem; font-weight: 700; color: #2563EB;">
                👥 Geral
              </div>
            </div>
          </div>

          <!-- Campo: Número de Telefone com DDD -->
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">
              Número de WhatsApp do Líder (com DDD e DDI)
            </label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="modal-wa-phone-input" class="topbar-search-input" placeholder="Ex: 5521998901302" style="width: 100%; border-radius: 8px; font-weight: 700; font-size: 0.95rem; background: #FFFFFF; border: 1.5px solid #CBD5E1; padding: 0.6rem 0.85rem;">
            </div>
            <span style="font-size: 0.72rem; color: #64748B; margin-top: 3px; display: block;">
              Digite os números sem espaços ou traços (Ex: <strong>5521999998888</strong>).
            </span>
          </div>

          <!-- Botões de Conexão: Pairing Code & QR Code -->
          <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 0.75rem;">
            <button type="button" id="btn-modal-generate-pairing" class="btn-green-action" style="padding: 0.75rem; font-size: 0.88rem; font-weight: 800; justify-content: center;">
              🔢 Gerar PIN de 8 Dígitos
            </button>
            <button type="button" id="btn-modal-generate-qr" class="btn-outline-white" style="padding: 0.75rem; font-size: 0.85rem; font-weight: 700; justify-content: center;">
              📷 Gerar QR Code
            </button>
          </div>

          <!-- Área do Pairing Code Gerado -->
          <div id="modal-wa-pairing-box" style="display: none; background: #F0FDF4; border: 2px solid #86EFAC; border-radius: 12px; padding: 1.25rem; text-align: center;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #15803D; text-transform: uppercase; margin-bottom: 0.35rem;">
              🔑 Código de Emparelhamento (Pairing Code)
            </div>
            <div id="modal-wa-pin-display" style="font-size: 2.2rem; font-weight: 900; letter-spacing: 4px; color: #0F172A; font-family: monospace; background: #FFFFFF; border: 1px dashed #22C55E; border-radius: 8px; padding: 0.6rem 1rem; margin: 0.5rem 0; user-select: all;">
              ----
            </div>
            <div style="display: flex; justify-content: center; gap: 0.6rem; margin-top: 0.5rem;">
              <button type="button" id="btn-modal-copy-pin" class="btn-outline-white" style="font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.85rem; background: #FFFFFF;">
                📋 Copiar Apenas o PIN
              </button>
            </div>
            <div style="font-size: 0.75rem; color: #166534; margin-top: 0.65rem; line-height: 1.4;">
              ⏳ O líder deve abrir o WhatsApp > Aparelhos Conectados > <strong>Conectar com número de telefone</strong> e digitar o PIN acima.
            </div>
          </div>

          <!-- Área do QR Code -->
          <div id="modal-wa-qr-box" style="display: none; text-align: center; border: 2px dashed #CBD5E1; border-radius: 12px; padding: 1.25rem; background: #F8FAFC;">
            <div id="modal-wa-qr-img-mount">
              <!-- Imagem QR Code -->
            </div>
            <span style="font-size: 0.75rem; color: #64748B; margin-top: 0.5rem; display: block;">
              Aponte a câmera do WhatsApp para escanear o QR Code.
            </span>
          </div>

          <!-- Seção de Notificação do Sistema (Alex Amarante) -->
          <div id="modal-wa-invite-section" style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 12px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong style="font-size: 0.82rem; color: #1D4ED8; display: flex; align-items: center; gap: 0.35rem;">
                📨 Enviar Convite da Campanha para o Líder
              </strong>
              <span class="pill-btn" style="background: #DBEAFE; color: #1E40AF; font-size: 0.7rem; font-weight: 800;">
                Alex Amarante
              </span>
            </div>
            <textarea id="modal-wa-invite-text" style="width: 100%; height: 110px; border-radius: 8px; border: 1px solid #CBD5E1; padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #334155; box-sizing: border-box; resize: vertical; font-family: inherit; background: #FFFFFF;" readonly></textarea>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.65rem; flex-wrap: wrap;">
              <button type="button" id="btn-modal-send-invite-api" class="btn-primary-blue" style="font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.85rem; flex: 1; justify-content: center;">
                🚀 Enviar via WhatsApp (Sistema)
              </button>
              <button type="button" id="btn-modal-open-wame" class="btn-green-action" style="font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.85rem;">
                💬 Abrir no WhatsApp (wa.me)
              </button>
              <button type="button" id="btn-modal-copy-invite" class="btn-outline-white" style="font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.75rem;">
                📋 Copiar Mensagem
              </button>
            </div>
          </div>

          <!-- Card de Preservação de Notificações no Celular -->
          <div style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 10px; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
            <div>
              <div style="font-size: 0.82rem; font-weight: 800; color: #15803D; display: flex; align-items: center; gap: 4px;">
                🔔 Notificações no Celular Preservadas
              </div>
              <span style="font-size: 0.72rem; color: #166534; display: block; margin-top: 2px;">
                A API não marca mensagens recebidas como lidas, garantindo que o celular vibre e receba notificações push normalmente.
              </span>
            </div>
            <button type="button" id="btn-modal-reapply-notifications" class="btn-outline-white" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; background: #FFFFFF; color: #15803D; border-color: #86EFAC; font-weight: 700; white-space: nowrap;">
              🛡️ Reaplicar
            </button>
          </div>

          <!-- Botão Desconectar se Conectado -->
          <div id="modal-wa-disconnect-row" style="display: none; border-top: 1px solid #E2E8F0; padding-top: 0.85rem;">
            <button type="button" id="btn-modal-disconnect-user" class="btn-outline-white" style="width: 100%; color: #DC2626; border-color: #FECACA; font-weight: 700; font-size: 0.82rem; padding: 0.5rem;">
              🛑 Desconectar WhatsApp deste Usuário
            </button>
          </div>
        </div>

        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: #F8FAFC; display: flex; justify-content: flex-end;">
          <button type="button" id="btn-modal-close-wa" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.45rem 1.25rem;">Fechar</button>
        </div>
      </div>
    </div>
  `;

  function updateKpis() {
    const validUsers = allUsers.filter(u => u.email || u.name);
    const coordsCount = validUsers.filter(u => u.role === 'coordinator' || u.role === 'admin').length;
    const leadersCount = validUsers.filter(u => u.role === 'member' || !u.role).length;
    const teamsCount = allTeams.length;
    
    // Motor de métricas
    const coverage = calculateNetworkCoverage(allContacts, allMessages);
    const timeline = calculateTimelineEvolution(allMessages, 7);
    
    // Status do WhatsApp
    const connectedWhatsapp = validUsers.filter(u => u.whatsapp?.status === 'CONNECTED' || u.whatsapp_connected === true).length;
    const totalWithWhatsapp = validUsers.filter(u => u.whatsapp?.instanceName || u.whatsapp_instance).length;
    const offlineWhatsapp = Math.max(0, validUsers.length - connectedWhatsapp);

    // KPI 1: Estrutura da Rede
    const kpiStructure = container.querySelector('#adm-kpi-structure');
    const kpiStructureSub = container.querySelector('#adm-kpi-structure-sub');
    if (kpiStructure) kpiStructure.textContent = `${coordsCount} / ${leadersCount}`;
    if (kpiStructureSub) kpiStructureSub.textContent = `${coordsCount} Coords · ${leadersCount} Líderes · ${coverage.total} Contatos`;

    // KPI 2: Cobertura da Rede
    const kpiCoverage = container.querySelector('#adm-kpi-coverage');
    const kpiCoverageSub = container.querySelector('#adm-kpi-coverage-sub');
    if (kpiCoverage) kpiCoverage.textContent = coverage.rateFormatted;
    if (kpiCoverageSub) kpiCoverageSub.textContent = `${coverage.abordados} abordados · ${coverage.pendentes} pendentes`;

    // KPI 3: Atividade Recente (7 dias)
    const kpiActivity = container.querySelector('#adm-kpi-activity');
    const kpiActivitySub = container.querySelector('#adm-kpi-activity-sub');
    if (kpiActivity) kpiActivity.textContent = timeline.weekCount;
    if (kpiActivitySub) kpiActivitySub.textContent = `${timeline.todayCount} abordagens hoje (${timeline.totalCount} total)`;

    // KPI 4: Instâncias WhatsApp
    const kpiWhatsapp = container.querySelector('#adm-kpi-whatsapp');
    const kpiWhatsappSub = container.querySelector('#adm-kpi-whatsapp-sub');
    if (kpiWhatsapp) kpiWhatsapp.textContent = `${connectedWhatsapp} / ${validUsers.length}`;
    if (kpiWhatsappSub) kpiWhatsappSub.textContent = `🟢 ${connectedWhatsapp} Conectadas · 🔴 ${offlineWhatsapp} Offline`;
  }

  function renderTabContent() {
    const contentEl = container.querySelector('#admin-tab-content');
    if (!contentEl) return;

    if (currentTab === 'overview') {
      const coverage = calculateNetworkCoverage(allContacts, allMessages);
      const coordsRanking = calculateCoordinatorsRanking(allTeams, allUsers, allContacts, allMessages);
      const leadersPerf = calculateLeadersPerformance(allUsers.filter(u => u.role === 'member' || !u.role), allContacts, allMessages);
      const alerts = generateManagementAlerts(leadersPerf, coverage);
      const timeline = calculateTimelineEvolution(allMessages, 7);

      const maxTimelineCount = Math.max(...timeline.byDay.map(d => d.count), 1);

      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Central de Alertas Inteligentes de Gestão -->
          ${alerts.length > 0 ? `
            <div class="main-panel-card" style="padding: 1.25rem; border-left: 4px solid #F59E0B;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.2rem;">🔔</span>
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main);">Alertas Operacionais da Rede</h3>
                </div>
                <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.75rem;">
                  ${alerts.length} alerta(s) de atenção · Clique para ver lista
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem;">
                ${alerts.map(a => `
                  <div class="clickable-alert-card" data-alert-id="${a.id}" style="background: ${a.type === 'danger' ? '#FEF2F2' : a.type === 'warning' ? '#FFFBEB' : a.type === 'success' ? '#F0FDF4' : '#EFF6FF'}; border: 1px solid ${a.type === 'danger' ? '#FECACA' : a.type === 'warning' ? '#FDE68A' : a.type === 'success' ? '#BBF7D0' : '#BFDBFE'}; border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; transition: all 0.15s ease;" title="Clique para ver os líderes deste alerta">
                    <span style="font-size: 1.3rem; line-height: 1;">${a.icon}</span>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${a.title}</span>
                        <span style="font-size: 0.72rem; color: #2563EB; font-weight: 700;">Ver lista ›</span>
                      </div>
                      <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.3;">${a.message}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Grid: Cobertura da Rede & Evolução Temporal dos Últimos 7 Dias -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
            
            <!-- Card 1: Cobertura da Rede -->
            <div class="main-panel-card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px;">
                    📈 Cobertura da Rede
                  </span>
                  <span class="pill-btn" style="background: #F0FDF4; color: #15803D; font-weight: 800; font-size: 0.85rem;">
                    ${coverage.rateFormatted}
                  </span>
                </div>

                <div style="margin-bottom: 1.25rem;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.45rem; color: var(--text-muted);">
                    <span>${coverage.abordados} Abordados</span>
                    <span>${coverage.pendentes} Pendentes</span>
                  </div>
                  <div style="width: 100%; height: 12px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                    <div style="width: ${coverage.rateFormatted}; height: 100%; background: linear-gradient(90deg, #10B981 0%, #059669 100%); transition: width 0.4s ease;"></div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #F8FAFC; padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid #E2E8F0;">
                  <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">TOTAL DE CONTATOS</div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${coverage.total}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">TOTAL DE LÍDERES</div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${leadersPerf.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 2: Evolução Temporal (Últimos 7 Dias) -->
            <div class="main-panel-card" style="padding: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px;">
                  📅 Ritmo das Abordagens (7 Dias)
                </span>
                <span style="font-size: 0.78rem; font-weight: 700; color: var(--primary-blue);">
                  ${timeline.weekCount} envios
                </span>
              </div>

              <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem; height: 110px; padding-top: 1rem; border-bottom: 1px solid #E2E8F0; padding-bottom: 0.5rem;">
                ${timeline.byDay.map(d => {
                  const barHeightPct = Math.max(8, Math.round((d.count / maxTimelineCount) * 100));
                  return `
                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; gap: 4px;">
                      <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-main);">${d.count}</span>
                      <div style="width: 100%; max-width: 28px; height: ${barHeightPct}%; background: #3B82F6; border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>
                      <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; margin-top: 2px;">${d.label.split(' ')[0]}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- Tabela: Ranking Comparativo de Coordenadores & Equipes -->
          <div class="main-panel-card">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">Ranking Comparativo de Coordenadores</h3>
                <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Desempenho agregado das equipes e ritmo de cobertura dos contatos.</p>
              </div>
              <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.78rem;">
                ${coordsRanking.length} Coordenações Ativas
              </span>
            </div>

            <!-- Tabela Desktop -->
            <div class="table-container desktop-only">
              <table class="panel-table">
                <thead>
                  <tr>
                    <th style="width: 5%;">POS</th>
                    <th>COORDENADOR RESPONSÁVEL</th>
                    <th>EQUIPE</th>
                    <th style="text-align: center;">LÍDERES</th>
                    <th style="text-align: center;">CONTATOS</th>
                    <th style="text-align: center;">ABORDADOS</th>
                    <th style="text-align: center;">PENDENTES</th>
                    <th style="width: 22%;">COBERTURA DA EQUIPE</th>
                    <th style="text-align: right;">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  ${coordsRanking.length === 0 ? `
                    <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma equipe cadastrada no momento.</td></tr>
                  ` : coordsRanking.map((item, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    return `
                      <tr>
                        <td style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${medal}</td>
                        <td>
                          <div style="font-weight: 700; color: var(--text-main);">${item.coordinatorName}</div>
                          <div style="font-size: 0.72rem; color: var(--text-muted);">${item.coordinatorEmail || 'E-mail não informado'}</div>
                        </td>
                        <td>
                          <span class="pill-btn" style="background: #F1F5F9; color: #334155; font-weight: 700; font-size: 0.75rem;">
                            👥 ${item.teamName}
                          </span>
                        </td>
                        <td style="text-align: center; font-weight: 600;">${item.totalLeaders}</td>
                        <td style="text-align: center; font-weight: 700; color: var(--text-main);">${item.totalContacts}</td>
                        <td style="text-align: center; font-weight: 700; color: #15803D;">${item.abordados}</td>
                        <td style="text-align: center; font-weight: 600; color: #DC2626;">${item.pendentes}</td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="flex: 1; height: 8px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                              <div style="width: ${item.rateFormatted}; height: 100%; background: ${item.rate >= 70 ? '#10B981' : item.rate >= 30 ? '#F59E0B' : '#EF4444'};"></div>
                            </div>
                            <span style="font-weight: 800; font-size: 0.8rem; color: var(--text-main); min-width: 38px;">${item.rateFormatted}</span>
                          </div>
                        </td>
                        <td style="text-align: right;">
                          <button class="btn-drill-team btn-primary-blue" data-team-id="${item.teamId}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                            📊 Ver Equipe
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Cards Mobile -->
            <div class="team-mobile-card-list mobile-only" style="padding: 1rem;">
              ${coordsRanking.map((item, idx) => `
                <div class="team-mobile-card" style="margin-bottom: 0.85rem;">
                  <div class="team-mobile-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">
                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`} ${item.coordinatorName}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">👥 ${item.teamName} · ${item.totalLeaders} líderes</div>
                    </div>
                    <span class="pill-btn" style="background: #F0FDF4; color: #15803D; font-weight: 800; font-size: 0.78rem;">
                      ${item.rateFormatted}
                    </span>
                  </div>
                  <div style="margin: 0.75rem 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem;">
                      <span>${item.abordados} abordados</span>
                      <span>${item.pendentes} pendentes (${item.totalContacts} total)</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 99px; overflow: hidden;">
                      <div style="width: ${item.rateFormatted}; height: 100%; background: #10B981;"></div>
                    </div>
                  </div>
                  <button class="btn-drill-team btn-primary-blue" data-team-id="${item.teamId}" style="width: 100%; font-size: 0.8rem; padding: 0.5rem; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    📊 Ver Detalhes da Equipe
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      `;

      // Drill-down listener
      contentEl.querySelectorAll('.btn-drill-team').forEach(btn => {
        btn.addEventListener('click', () => {
          const teamId = btn.getAttribute('data-team-id');
          onNavigate('manager', teamId);
        });
      });

      // Clique nos Cards de Alerta para detalhamento
      contentEl.querySelectorAll('.clickable-alert-card').forEach(card => {
        card.addEventListener('click', () => {
          const alertId = card.getAttribute('data-alert-id');
          const targetAlert = alerts.find(a => a.id === alertId);
          if (targetAlert) openAlertDetailsModal(targetAlert);
        });
      });

    } else if (currentTab === 'teams') {
      contentEl.innerHTML = `
        <div class="main-panel-card">
          <!-- Desktop Table -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>NOME DA EQUIPE</th>
                  <th>COORDENADOR RESPONSÁVEL</th>
                  <th>MEMBROS</th>
                  <th>STATUS</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                ${allTeams.length === 0 ? `
                  <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma equipe cadastrada ainda. Clique em <strong>+ Nova Equipe</strong> acima.</td></tr>
                ` : allTeams.map(t => {
                  const initials = t.name ? t.name.substring(0, 2).toUpperCase() : 'EQ';
                  return `
                    <tr>
                      <td>
                        <div class="user-identity-cell">
                          <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8;">${initials}</div>
                          <div>
                            <span class="user-identity-name">${t.name}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">ID: ${t.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 0.72rem;">LÍDER</span>
                        <strong style="color: var(--text-main); margin-left: 0.35rem;">${t.coordinator_name || 'Coordenador Vinculado'}</strong>
                      </td>
                      <td style="color: var(--text-muted); font-size: 0.85rem;">
                        ${allUsers.filter(u => u.team_id === t.id).length > 0 ? `${allUsers.filter(u => u.team_id === t.id).length} membro(s)` : '0 membros'}
                      </td>
                      <td><span class="status-pill ativo">OPERACIONAL</span></td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                          <button class="btn-manage-team-view btn-primary-blue" data-team="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                            Ver Painel
                          </button>
                          <button class="btn-delete-team btn-outline-white" data-team-id="${t.id}" data-team-name="${t.name}" style="font-size: 0.75rem; padding: 0.35rem 0.6rem; color: #DC2626; border-color: #FECACA;" title="Excluir Equipe">
                            🗑️ Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Smartphone Mobile Cards -->
          <div class="team-mobile-card-list mobile-only" style="padding: 1rem;">
            ${allTeams.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">Nenhuma equipe cadastrada ainda.</div>
            ` : allTeams.map(t => {
              const initials = t.name ? t.name.substring(0, 2).toUpperCase() : 'EQ';
              const memberCount = allUsers.filter(u => u.team_id === t.id).length;
              return `
                <div class="team-mobile-card">
                  <div class="team-mobile-card-header">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8; width: 38px; height: 38px; font-size: 0.88rem;">${initials}</div>
                      <div>
                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${t.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">👔 Líder: ${t.coordinator_name || 'Não vinculado'} (${memberCount} membros)</div>
                      </div>
                    </div>
                    <span class="status-pill ativo">ATIVO</span>
                  </div>
                  <div class="team-mobile-card-footer" style="display: flex; gap: 0.5rem;">
                    <button class="btn-manage-team-view btn-primary-blue" data-team="${t.id}" style="flex: 1; font-size: 0.82rem; padding: 0.5rem; font-weight: 600; justify-content: center; border-radius: var(--radius-md);">
                      📊 Ver Painel
                    </button>
                    <button class="btn-delete-team btn-outline-white" data-team-id="${t.id}" data-team-name="${t.name}" style="color: #DC2626; border-color: #FECACA; font-size: 0.82rem; padding: 0.5rem 0.85rem; font-weight: 600; border-radius: var(--radius-md);" title="Excluir Equipe">
                      🗑️
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      contentEl.querySelectorAll('.btn-manage-team-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const teamId = btn.getAttribute('data-team');
          onNavigate('manager', teamId);
        });
      });

      contentEl.querySelectorAll('.btn-delete-team').forEach(btn => {
        btn.addEventListener('click', async () => {
          const teamId = btn.getAttribute('data-team-id');
          const teamName = btn.getAttribute('data-team-name');
          if (confirm(`Tem certeza que deseja excluir a equipe "${teamName}"?\n\nOs membros e contatos vinculados serão liberados para uso global.`)) {
            try {
              btn.disabled = true;
              btn.textContent = 'Excluindo...';
              await deleteTeamFromFirestore(teamId);
              await recordSystemAuditLog({
                actor_uid: currentUser.uid,
                actor_name: currentUser.name,
                action: 'team_deleted',
                metadata: { team_id: teamId, team_name: teamName }
              });
              showToast(`Equipe "${teamName}" excluída com sucesso!`, 'success');
            } catch (e) {
              showToast('Erro ao excluir equipe: ' + e.message, 'error');
            }
          }
        });
      });
    } else if (currentTab === 'users') {
      const validUsers = allUsers.filter(u => u.email || u.name);

      contentEl.innerHTML = `
        <div class="main-panel-card">
          <!-- Desktop Table -->
          <div class="table-container desktop-only">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>USUÁRIO</th>
                  <th>CARGO ATUAL</th>
                  <th>EQUIPE</th>
                  <th>INSTÂNCIA WHATSAPP</th>
                  <th>STATUS</th>
                  <th style="text-align: right;">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                ${validUsers.length === 0 ? `
                  <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum usuário cadastrado.</td></tr>
                ` : validUsers.map(u => {
                  const initials = ((u.name || u.email || 'U')).substring(0, 2).toUpperCase();
                  const isActive = u.is_active !== false;
                  const isSuperAdmin = (u.email || '').toLowerCase() === 'thiagoddsm@gmail.com';
                  const currentRole = isSuperAdmin ? 'admin' : (u.role || 'member');
                  const isConnected = u.whatsapp?.status === 'CONNECTED' || u.whatsapp_connected === true;
                  const instanceName = u.whatsapp?.instanceName || u.whatsapp_instance || null;
                  const phone = u.whatsapp?.phoneNumber || u.whatsapp_phone || null;

                  const roleLabel = currentRole === 'admin' 
                    ? '👑 Administrador' 
                    : currentRole === 'coordinator' 
                    ? '👔 Coordenador' 
                    : '🎯 Membro da Equipe';

                  const roleBadgeBg = currentRole === 'admin' 
                    ? '#FEE2E2' 
                    : currentRole === 'coordinator' 
                    ? '#EFF6FF' 
                    : '#F1F5F9';

                  const roleBadgeColor = currentRole === 'admin' 
                    ? '#DC2626' 
                    : currentRole === 'coordinator' 
                    ? '#1D4ED8' 
                    : '#64748B';

                  return `
                    <tr>
                      <td>
                        <div class="user-identity-cell">
                          <div class="user-identity-initials" style="background: ${roleBadgeBg}; color: ${roleBadgeColor};">${initials}</div>
                          <div>
                            <span class="user-identity-name">${u.name || u.email.split('@')[0]}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button class="btn-open-role-modal btn-outline-white" data-uid="${u.uid}" data-name="${u.name || u.email}" data-role="${currentRole}" style="font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.75rem; display: flex; align-items: center; gap: 6px; background: ${roleBadgeBg}; color: ${roleBadgeColor}; border-color: transparent; border-radius: var(--radius-md);">
                          <span>${roleLabel}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                      </td>
                      <td>
                        <select class="user-team-select form-control" data-uid="${u.uid}" style="padding: 0.3rem 0.55rem; font-size: 0.8rem; font-weight: 600; border-radius: var(--radius-sm); max-width: 170px; background: #FFFFFF;">
                          <option value="" ${!u.team_id ? 'selected' : ''}>🌐 Global / Sem Equipe</option>
                          ${allTeams.map(t => `
                            <option value="${t.id}" ${u.team_id === t.id ? 'selected' : ''}>👥 ${t.name}</option>
                          `).join('')}
                        </select>
                      </td>
                      <td>
                        ${isConnected ? `
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                              <span style="width: 7px; height: 7px; border-radius: 50%; background: #22C55E; display: inline-block;"></span>
                              Conectada
                            </span>
                            ${instanceName ? `<span style="font-size: 0.72rem; color: #64748B; font-family: monospace;">${instanceName}</span>` : ''}
                            ${phone ? `<span style="font-size: 0.7rem; color: #059669; font-weight: 600;">📱 ${phone}</span>` : ''}
                          </div>
                        ` : instanceName ? `
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                              <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
                              Criada (Desconectada)
                            </span>
                            <span style="font-size: 0.72rem; color: #64748B; font-family: monospace;">${instanceName}</span>
                          </div>
                        ` : `
                          <span class="pill-btn" style="background: #F1F5F9; color: #94A3B8; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                            <span style="width: 7px; height: 7px; border-radius: 50%; background: #CBD5E1; display: inline-block;"></span>
                            Não criada
                          </span>
                        `}
                      </td>
                      <td>
                        <span class="status-pill ${isActive ? 'ativo' : 'inativo'}">
                          ${isActive ? 'ATIVO' : 'BLOQUEADO'}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                          <button class="btn-toggle-active btn-outline-white" data-uid="${u.uid}" data-active="${isActive}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                            ${isActive ? 'Bloquear' : 'Ativar'}
                          </button>
                          ${!isSuperAdmin ? `
                            <button class="btn-delete-user btn-outline-white" data-uid="${u.uid}" data-name="${u.name || u.email}" style="font-size: 0.75rem; padding: 0.35rem 0.55rem; color: #DC2626; border-color: #FECACA;" title="Excluir Usuário">
                              🗑️
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Event listeners para Usuários
      contentEl.querySelectorAll('.btn-open-role-modal').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const name = btn.getAttribute('data-name');
          container.querySelector('#modal-target-user-uid').value = uid;
          container.querySelector('#modal-change-role-username').textContent = `Definir cargo para: ${name}`;
          roleModal.style.display = 'flex';
        });
      });

      contentEl.querySelectorAll('.user-team-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const uid = sel.getAttribute('data-uid');
          const teamId = e.target.value || null;
          const targetTeam = allTeams.find(t => t.id === teamId);
          const teamName = targetTeam ? targetTeam.name : null;

          try {
            await updateUserTeam(uid, teamId, teamName);
            showToast('Equipe do usuário atualizada!', 'success');
          } catch (err) {
            console.error('Erro ao atualizar equipe:', err);
            showToast('Erro ao atualizar equipe do usuário.', 'error');
          }
        });
      });

      contentEl.querySelectorAll('.btn-toggle-active').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-uid');
          const currentActive = btn.getAttribute('data-active') === 'true';
          try {
            await toggleUserActiveStatus(uid, !currentActive);
            showToast(`Usuário ${!currentActive ? 'ativado' : 'bloqueado'} com sucesso!`, 'success');
          } catch (err) {
            console.error('Erro ao alterar status:', err);
            showToast('Erro ao alterar status do usuário.', 'error');
          }
        });
      });

      contentEl.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-uid');
          const name = btn.getAttribute('data-name');
          if (confirm(`Tem certeza que deseja excluir o usuário "${name}" do sistema?`)) {
            try {
              await deleteUserFromFirestore(uid);
              await recordSystemAuditLog({
                actor_uid: currentUser.uid,
                actor_name: currentUser.name,
                action: 'user_deleted',
                metadata: { target_uid: uid, target_name: name }
              });
              showToast(`Usuário "${name}" excluído com sucesso!`, 'success');
            } catch (err) {
              console.error('Erro ao excluir usuário:', err);
              showToast('Erro ao excluir usuário do Firestore.', 'error');
            }
          }
        });
      });
    } else if (currentTab === 'audit') {
      contentEl.innerHTML = `
        <div class="main-panel-card">
          <div class="table-container">
            <table class="panel-table">
              <thead>
                <tr>
                  <th>DATA / HORA</th>
                  <th>EXECUTADO POR</th>
                  <th>AÇÃO</th>
                  <th>DETALHES</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.length === 0 ? `
                  <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum registro de auditoria no momento.</td></tr>
                ` : auditLogs.map(l => {
                  const dateStr = l.created_at?.toDate ? l.created_at.toDate().toLocaleString('pt-BR') : (l.created_at_iso ? new Date(l.created_at_iso).toLocaleString('pt-BR') : '—');
                  return `
                    <tr>
                      <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
                      <td style="font-weight: 600;">${l.actor_name || l.actor_uid}</td>
                      <td><span class="pill-btn" style="background: #F1F5F9; color: #1D4ED8; font-family: monospace; font-size: 0.75rem;">${l.action}</span></td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${JSON.stringify(l.metadata || {})}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (currentTab === 'whatsapp') {
      const validUsers = allUsers.filter(u => u.email || u.name);
      const connectedCount = validUsers.filter(u => u.whatsapp?.status === 'CONNECTED' || u.whatsapp_connected === true).length;
      const createdOfflineCount = validUsers.filter(u => (u.whatsapp?.instanceName || u.whatsapp_instance) && !(u.whatsapp?.status === 'CONNECTED' || u.whatsapp_connected === true)).length;
      const notConfiguredCount = validUsers.filter(u => !u.whatsapp?.instanceName && !u.whatsapp_instance).length;

      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- 3 WhatsApp Health Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
            <div class="kpi-card" style="border-top: 3px solid #10B981; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
              <span class="kpi-card-title" style="color: #059669; font-weight: 700; font-size: 0.75rem;">🟢 CONECTADAS (ONLINE)</span>
              <div style="font-size: 2rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">${connectedCount}</div>
              <span style="font-size: 0.75rem; color: #64748B;">Prontas para disparo via API</span>
            </div>

            <div class="kpi-card" style="border-top: 3px solid #F59E0B; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
              <span class="kpi-card-title" style="color: #D97706; font-weight: 700; font-size: 0.75rem;">🟡 DESCONECTADAS (OFFLINE)</span>
              <div style="font-size: 2rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">${createdOfflineCount}</div>
              <span style="font-size: 0.75rem; color: #64748B;">Aguardando leitura do QR Code</span>
            </div>

            <div class="kpi-card" style="border-top: 3px solid #94A3B8; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
              <span class="kpi-card-title" style="color: #64748B; font-weight: 700; font-size: 0.75rem;">⚪ NÃO CONFIGURADAS</span>
              <div style="font-size: 2rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">${notConfiguredCount}</div>
              <span style="font-size: 0.75rem; color: #64748B;">Utilizam envio via WhatsApp Web</span>
            </div>
          </div>

          <!-- Tabela de Instâncias da Rede -->
          <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">Central de Instâncias WhatsApp da Rede</h3>
                <p style="font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0 0;">Monitore e audite as conexões Evolution API de todos os líderes e coordenadores.</p>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button id="btn-admin-shield-notifications" class="btn-outline-white" style="font-size: 0.82rem; padding: 0.45rem 0.95rem; color: #15803D; border-color: #86EFAC; background: #F0FDF4; font-weight: 700;" title="Garante que a Evolution API não marque mensagens como lidas para que o celular receba notificações normalmente">
                  🛡️ Blindar Notificações na Rede
                </button>
                <button id="btn-goto-whatsapp-manager" class="btn-green-action" style="font-size: 0.82rem; padding: 0.45rem 0.95rem;">
                  📱 Minha Conexão WhatsApp
                </button>
              </div>
            </div>

            <div class="table-container">
              <table class="panel-table" style="font-size: 0.83rem;">
                <thead>
                  <tr>
                    <th>OPERADOR / LÍDER</th>
                    <th>EQUIPE</th>
                    <th>INSTÂNCIA EVOLUTION</th>
                    <th>NÚMERO CONECTADO</th>
                    <th style="text-align: center;">STATUS</th>
                    <th style="text-align: right;">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  ${validUsers.map(u => {
                    const initials = ((u.name || u.email || 'U')).substring(0, 2).toUpperCase();
                    const isConnected = u.whatsapp?.status === 'CONNECTED' || u.whatsapp_connected === true;
                    const instanceName = u.whatsapp?.instanceName || u.whatsapp_instance || null;
                    const phone = u.whatsapp?.phoneNumber || u.whatsapp_phone || null;
                    const team = allTeams.find(t => t.id === u.team_id || t.name === u.team_name);
                    const teamName = team ? team.name : (u.team_name || 'Global');

                    return `
                      <tr>
                        <td>
                          <div class="user-identity-cell">
                            <div class="user-identity-initials" style="background: #EFF6FF; color: #1D4ED8;">${initials}</div>
                            <div>
                              <span class="user-identity-name">${u.name || u.email.split('@')[0]}</span>
                              <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="pill-btn" style="background: #F1F5F9; color: #334155; font-weight: 700; font-size: 0.75rem;">
                            👥 ${teamName}
                          </span>
                        </td>
                        <td style="font-family: monospace; font-size: 0.8rem; color: #475569;">
                          ${instanceName ? `<code>${instanceName}</code>` : '<span style="color: var(--text-muted);">—</span>'}
                        </td>
                        <td style="font-size: 0.82rem; font-weight: 600; color: #059669;">
                          ${phone ? `📱 ${phone}` : '<span style="color: var(--text-muted); font-weight: normal;">—</span>'}
                        </td>
                        <td style="text-align: center;">
                          ${isConnected ? `
                            <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 800; font-size: 0.72rem; padding: 2px 10px; border-radius: 9999px;">
                              🟢 Aberta (Open)
                            </span>
                          ` : instanceName ? `
                            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 0.72rem; padding: 2px 10px; border-radius: 9999px;">
                              🟡 Offline (Close)
                            </span>
                          ` : `
                            <span class="pill-btn" style="background: #F1F5F9; color: #94A3B8; font-weight: 700; font-size: 0.72rem; padding: 2px 10px; border-radius: 9999px;">
                              ⚪ Não criada
                            </span>
                          `}
                        </td>
                        <td style="text-align: right;">
                          <button class="btn-direct-whatsapp-setup btn-outline-white" data-uid="${u.uid}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                            ⚙️ Gerenciar
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      contentEl.querySelector('#btn-goto-whatsapp-manager')?.addEventListener('click', () => onNavigate('whatsapp'));
      contentEl.querySelector('#btn-admin-shield-notifications')?.addEventListener('click', async () => {
        const btn = contentEl.querySelector('#btn-admin-shield-notifications');
        btn.disabled = true;
        btn.textContent = '🛡️ Blindando...';
        
        try {
          const allInstances = validUsers.map(u => u.whatsapp?.instanceName || u.whatsapp_instance).filter(Boolean);
          if (allInstances.length === 0) {
            showToast('Nenhuma instância cadastrada na rede para blindar.', 'info');
            return;
          }
          await applyNotificationPreservationToAllInstances(allInstances);
          showToast(`🛡️ ${allInstances.length} instâncias blindadas! Nenhuma mensagem recebida será marcada como lida.`, 'success');
        } catch (e) {
          showToast(`Erro ao blindar instâncias: ${e.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '🛡️ Blindar Notificações na Rede';
        }
      });

      contentEl.querySelectorAll('.btn-direct-whatsapp-setup').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const targetUser = allUsers.find(u => u.uid === uid);
          if (targetUser) openUserWhatsappPairingModal(targetUser);
        });
      });
    }
  }

  // Modal Alterar Cargo Listeners
  const roleModal = container.querySelector('#modal-change-role');
  container.querySelector('#btn-close-role-modal')?.addEventListener('click', () => { roleModal.style.display = 'none'; });

  container.querySelectorAll('.btn-select-role-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const role = opt.getAttribute('data-role');
      const uid = container.querySelector('#modal-target-user-uid').value;
      if (!uid) return;

      roleModal.style.display = 'none';
      try {
        await updateUserRole(uid, role);
        showToast('Cargo atualizado com sucesso!', 'success');
      } catch (err) {
        console.error('Erro ao atualizar cargo:', err);
        showToast('Erro ao atualizar cargo do usuário.', 'error');
      }
    });
  });

  // Modal Pareamento & Notificação WhatsApp do Usuário (PIN / Pairing Code & QR Code)
  const waModal = container.querySelector('#modal-user-whatsapp-pairing');
  let waPollingInterval = null;
  let currentActivePin = null;

  function stopWaPolling() {
    if (waPollingInterval) {
      clearInterval(waPollingInterval);
      waPollingInterval = null;
    }
  }

  container.querySelector('#btn-close-wa-modal')?.addEventListener('click', () => {
    stopWaPolling();
    waModal.style.display = 'none';
  });
  container.querySelector('#btn-modal-close-wa')?.addEventListener('click', () => {
    stopWaPolling();
    waModal.style.display = 'none';
  });

  async function openUserWhatsappPairingModal(targetUser) {
    stopWaPolling();
    currentActivePin = null;

    const team = allTeams.find(t => t.id === targetUser.team_id || t.name === targetUser.team_name);
    const teamName = team ? team.name : (targetUser.team_name || 'Geral');
    const role = targetUser.role || 'member';
    const cleanRole = role === 'admin' ? 'admin' : (role === 'coordinator' ? 'coordenador' : 'membro');
    const instanceName = targetUser.whatsapp?.instanceName || targetUser.whatsapp_instance || generateHierarchicalInstanceName(teamName, cleanRole, targetUser.name || targetUser.email);
    const phone = targetUser.whatsapp?.phoneNumber || targetUser.phone || '';

    container.querySelector('#modal-wa-target-uid').value = targetUser.uid;
    container.querySelector('#modal-wa-user-name').textContent = targetUser.name || targetUser.email.split('@')[0];
    container.querySelector('#modal-wa-instance-display').innerHTML = `<code>${instanceName}</code>`;
    container.querySelector('#modal-wa-team-display').textContent = `👥 ${teamName}`;
    container.querySelector('#modal-wa-phone-input').value = phone;

    const pairingBox = container.querySelector('#modal-wa-pairing-box');
    const qrBox = container.querySelector('#modal-wa-qr-box');
    const disconnectRow = container.querySelector('#modal-wa-disconnect-row');
    const statusBadge = container.querySelector('#modal-wa-user-status-badge');
    const inviteTextArea = container.querySelector('#modal-wa-invite-text');

    pairingBox.style.display = 'none';
    qrBox.style.display = 'none';

    // Texto inicial do convite sem código
    inviteTextArea.value = buildInviteNotificationText(targetUser.name, '');

    // Consulta status em tempo real
    statusBadge.textContent = 'Verificando...';
    statusBadge.style.background = '#FEF3C7';
    statusBadge.style.color = '#B45309';

    try {
      const stateResult = await getEvolutionConnectionState(instanceName);
      const isConnected = stateResult.state === 'open' || targetUser.whatsapp?.status === 'CONNECTED' || targetUser.whatsapp_connected === true;
      
      if (isConnected) {
        statusBadge.textContent = '🟢 Aberta (Conectada)';
        statusBadge.style.background = '#DCFCE7';
        statusBadge.style.color = '#15803D';
        disconnectRow.style.display = 'block';
      } else {
        statusBadge.textContent = '🟡 Desconectada (Offline)';
        statusBadge.style.background = '#FEF3C7';
        statusBadge.style.color = '#B45309';
        disconnectRow.style.display = 'none';
      }
    } catch (e) {
      statusBadge.textContent = '⚪ Não configurada';
      statusBadge.style.background = '#F1F5F9';
      statusBadge.style.color = '#64748B';
      disconnectRow.style.display = 'none';
    }

    // Botão: Gerar PIN de 8 Dígitos
    const btnGenPairing = container.querySelector('#btn-modal-generate-pairing');
    btnGenPairing.onclick = async () => {
      const inputPhone = container.querySelector('#modal-wa-phone-input').value.trim();
      if (!inputPhone) {
        showToast('Digite o número de telefone com DDD do líder para gerar o código.', 'warning');
        container.querySelector('#modal-wa-phone-input').focus();
        return;
      }

      // Se a instância já estiver aberta/conectada, pergunta se deseja reconectar
      const currentState = await getEvolutionConnectionState(instanceName);
      if (currentState.state === 'open') {
        const confirmReconnect = confirm(`Esta instância já está conectada (${currentState.phoneNumber || 'online'}).\n\nDeseja desconectar agora para gerar um novo PIN de 8 dígitos para o número ${inputPhone}?`);
        if (!confirmReconnect) return;

        btnGenPairing.disabled = true;
        btnGenPairing.textContent = 'Desconectando...';
        await logoutEvolutionInstance(instanceName);
        try {
          const userRef = doc(db, 'users', targetUser.uid);
          await updateDoc(userRef, { 'whatsapp.status': 'DISCONNECTED', whatsapp_connected: false });
        } catch (e) {}
      }

      btnGenPairing.disabled = true;
      btnGenPairing.textContent = 'Gerando PIN...';

      try {
        const res = await getEvolutionPairingCode(instanceName, inputPhone);
        if (res.success && res.pairingCode) {
          currentActivePin = res.pairingCode;
          container.querySelector('#modal-wa-pin-display').textContent = res.pairingCode;
          pairingBox.style.display = 'block';
          qrBox.style.display = 'none';

          // Atualiza o texto do convite com o PIN gerado
          inviteTextArea.value = buildInviteNotificationText(targetUser.name, res.pairingCode);

          showToast(`PIN ${res.pairingCode} gerado com sucesso!`, 'success');

          // Atualiza dados no Firestore
          try {
            const userRef = doc(db, 'users', targetUser.uid);
            await updateDoc(userRef, {
              'whatsapp.instanceName': instanceName,
              'whatsapp.phoneNumber': res.phoneNumber,
              'whatsapp_instance': instanceName,
              'whatsapp_phone': res.phoneNumber,
              'whatsapp.pairingCode': res.pairingCode,
              'phone': res.phoneNumber
            });
          } catch (e) {}

          // Inicia polling para detectar conexão assim que o líder digitar no celular
          stopWaPolling();
          waPollingInterval = setInterval(async () => {
            const check = await getEvolutionConnectionState(instanceName);
            if (check.state === 'open') {
              stopWaPolling();
              statusBadge.textContent = '🟢 Aberta (Conectada)';
              statusBadge.style.background = '#DCFCE7';
              statusBadge.style.color = '#15803D';
              disconnectRow.style.display = 'block';
              pairingBox.style.display = 'none';

              try {
                const userRef = doc(db, 'users', targetUser.uid);
                await updateDoc(userRef, {
                  'whatsapp.status': 'CONNECTED',
                  'whatsapp_connected': true,
                  'whatsapp.connectedAt': new Date().toISOString()
                });
              } catch (e) {}

              showToast(`🎉 WhatsApp de ${targetUser.name || 'Líder'} conectado com sucesso!`, 'success');
            }
          }, 3000);

        } else {
          showToast(`Erro ao gerar código: ${res.error || 'Falha na Evolution API'}`, 'error');
        }
      } catch (err) {
        console.error('Erro ao gerar pairing code:', err);
        showToast(`Erro: ${err.message}`, 'error');
      } finally {
        btnGenPairing.disabled = false;
        btnGenPairing.textContent = '🔢 Gerar PIN de 8 Dígitos';
      }
    };

    // Botão: Copiar PIN
    container.querySelector('#btn-modal-copy-pin').onclick = () => {
      if (currentActivePin) {
        navigator.clipboard.writeText(currentActivePin);
        showToast(`Código ${currentActivePin} copiado para a área de transferência!`, 'success');
      }
    };

    // Botão: Gerar QR Code Alternativo
    const btnGenQr = container.querySelector('#btn-modal-generate-qr');
    btnGenQr.onclick = async () => {
      btnGenQr.disabled = true;
      btnGenQr.textContent = 'Gerando QR...';
      try {
        const res = await getEvolutionQrCode(instanceName);
        if (res.success && res.base64) {
          const qrMount = container.querySelector('#modal-wa-qr-img-mount');
          qrMount.innerHTML = `<img src="${res.base64}" style="max-width: 220px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
          qrBox.style.display = 'block';
          pairingBox.style.display = 'none';
          showToast('QR Code gerado! Aponte a câmera do WhatsApp.', 'success');

          // Polling para QR
          stopWaPolling();
          waPollingInterval = setInterval(async () => {
            const check = await getEvolutionConnectionState(instanceName);
            if (check.state === 'open') {
              stopWaPolling();
              statusBadge.textContent = '🟢 Aberta (Conectada)';
              statusBadge.style.background = '#DCFCE7';
              statusBadge.style.color = '#15803D';
              disconnectRow.style.display = 'block';
              qrBox.style.display = 'none';
              showToast(`🎉 WhatsApp de ${targetUser.name || 'Líder'} conectado com sucesso!`, 'success');
            }
          }, 3000);
        } else {
          showToast(`Erro ao obter QR Code: ${res.error || 'Tente novamente'}`, 'error');
        }
      } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
      } finally {
        btnGenQr.disabled = false;
        btnGenQr.textContent = '📷 Gerar QR Code';
      }
    };

    // Botão: Enviar Notificação via WhatsApp API (Sistema)
    const btnSendInviteApi = container.querySelector('#btn-modal-send-invite-api');
    btnSendInviteApi.onclick = async () => {
      const inputPhone = container.querySelector('#modal-wa-phone-input').value.trim();
      if (!inputPhone) {
        showToast('Informe o telefone do líder para enviar a notificação.', 'warning');
        return;
      }

      const masterInst = currentUser.whatsapp?.instanceName || currentUser.whatsapp_instance || localStorage.getItem('evolution_active_instance') || 'IBM';

      btnSendInviteApi.disabled = true;
      btnSendInviteApi.textContent = 'Enviando...';

      try {
        const notifyRes = await sendSystemInviteNotification({
          targetPhone: inputPhone,
          leaderName: targetUser.name,
          pairingCode: currentActivePin,
          senderInstanceName: masterInst
        });

        if (notifyRes.success) {
          showToast('Convite da campanha enviado para o WhatsApp do líder!', 'success');
        } else {
          showToast('Não foi possível disparar pela API. Use o botão "Abrir no WhatsApp".', 'warning');
        }
      } catch (err) {
        console.error('Erro ao enviar notificação:', err);
        showToast(`Falha no envio: ${err.message}`, 'error');
      } finally {
        btnSendInviteApi.disabled = false;
        btnSendInviteApi.textContent = '🚀 Enviar via WhatsApp (Sistema)';
      }
    };

    // Botão: Abrir no WhatsApp Web / App (wa.me)
    container.querySelector('#btn-modal-open-wame').onclick = () => {
      const inputPhone = container.querySelector('#modal-wa-phone-input').value.trim();
      const cleanDigits = inputPhone.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
      const msg = inviteTextArea.value;
      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    };

    // Botão: Copiar Mensagem Completa
    container.querySelector('#btn-modal-copy-invite').onclick = () => {
      navigator.clipboard.writeText(inviteTextArea.value);
      showToast('Mensagem completa copiada para a área de transferência!', 'success');
    };

    // Botão: Reaplicar Preservação de Notificações
    const btnReapplyNotif = container.querySelector('#btn-modal-reapply-notifications');
    if (btnReapplyNotif) {
      btnReapplyNotif.onclick = async () => {
        btnReapplyNotif.disabled = true;
        btnReapplyNotif.textContent = 'Aplicando...';
        try {
          const res = await applyNotificationPreservationSettings(instanceName);
          if (res.success) {
            showToast('🛡️ Preservação de notificações aplicada! Mensagens recebidas não serão marcadas como lidas.', 'success');
          } else {
            showToast(`Aviso: ${res.error || 'Configuração enviada ao servidor.'}`, 'info');
          }
        } catch (err) {
          showToast(`Erro: ${err.message}`, 'error');
        } finally {
          btnReapplyNotif.disabled = false;
          btnReapplyNotif.textContent = '🛡️ Reaplicar';
        }
      };
    }

    // Botão: Desconectar
    const btnDisconnect = container.querySelector('#btn-modal-disconnect-user');
    btnDisconnect.onclick = async () => {
      if (confirm(`Deseja realmente desconectar a instância WhatsApp de "${targetUser.name}"?`)) {
        btnDisconnect.disabled = true;
        btnDisconnect.textContent = 'Desconectando...';
        try {
          await logoutEvolutionInstance(instanceName);
          const userRef = doc(db, 'users', targetUser.uid);
          await updateDoc(userRef, {
            'whatsapp.status': 'DISCONNECTED',
            'whatsapp_connected': false
          });
          statusBadge.textContent = '🟡 Desconectada (Offline)';
          statusBadge.style.background = '#FEF3C7';
          statusBadge.style.color = '#B45309';
          disconnectRow.style.display = 'none';
          showToast('Instância desconectada com sucesso.', 'info');
        } catch (err) {
          showToast(`Erro ao desconectar: ${err.message}`, 'error');
        } finally {
          btnDisconnect.disabled = false;
          btnDisconnect.textContent = '🛑 Desconectar WhatsApp deste Usuário';
        }
      }
    };

    waModal.style.display = 'flex';
  }

  // Modal Detalhes do Alerta Operacional
  const alertModal = container.querySelector('#modal-alert-details');
  container.querySelector('#btn-close-alert-modal')?.addEventListener('click', () => { alertModal.style.display = 'none'; });
  container.querySelector('#btn-alert-modal-close-action')?.addEventListener('click', () => { alertModal.style.display = 'none'; });

  function openAlertDetailsModal(alertObj) {
    const iconEl = container.querySelector('#modal-alert-icon');
    const titleEl = container.querySelector('#modal-alert-title');
    const subEl = container.querySelector('#modal-alert-sub');
    const listEl = container.querySelector('#modal-alert-list');
    const footerCount = container.querySelector('#modal-alert-footer-count');

    if (!alertModal) return;

    if (iconEl) iconEl.textContent = alertObj.icon || '🔔';
    if (titleEl) titleEl.textContent = alertObj.title || 'Alerta Operacional';
    if (subEl) subEl.textContent = alertObj.message || '';

    const items = alertObj.items || [];
    if (footerCount) footerCount.textContent = `${items.length} líder(es) nesta condição`;

    if (items.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; color: #94A3B8; padding: 2rem;">Nenhum líder específico detalhado neste alerta.</div>';
    } else {
      listEl.innerHTML = items.map(l => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <div style="min-width: 180px;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <strong style="color: #0F172A; font-size: 0.9rem;">${l.name || 'Sem nome'}</strong>
              <span class="pill-btn" style="background: #F1F5F9; color: #475569; font-size: 0.7rem; font-weight: 700;">
                👥 ${l.team_name || 'Sem Equipe'}
              </span>
            </div>
            <div style="font-size: 0.75rem; color: #64748B; margin-top: 2px;">${l.email || 'Sem e-mail'}</div>
          </div>

          <div style="display: flex; align-items: center; gap: 1.25rem;">
            <div style="text-align: center;">
              <div style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase;">CARTEIRA</div>
              <div style="font-size: 0.88rem; font-weight: 800; color: #0F172A;">${l.totalContacts} contatos</div>
            </div>

            <div style="text-align: center;">
              <div style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase;">ENVIADOS</div>
              <div style="font-size: 0.88rem; font-weight: 800; color: ${l.abordados > 0 ? '#15803D' : '#DC2626'};">${l.abordados} (${l.pctFormatted || (l.pct + '%')})</div>
            </div>

            <div style="text-align: center;">
              <div style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase;">WHATSAPP</div>
              <span class="pill-btn" style="background: ${l.isConnected ? '#DCFCE7' : '#FEE2E2'}; color: ${l.isConnected ? '#15803D' : '#DC2626'}; font-size: 0.72rem; font-weight: 700;">
                ${l.isConnected ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>

            <button class="btn-goto-leader-contacts btn-outline-white" data-uid="${l.uid}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; font-weight: 700;" title="Ver contatos deste líder">
              🎯 Ver Contatos
            </button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-goto-leader-contacts').forEach(btn => {
        btn.addEventListener('click', () => {
          alertModal.style.display = 'none';
          if (onNavigate) onNavigate('contacts');
        });
      });
    }

    alertModal.style.display = 'flex';
  }

  // Subscriptions
  const unsubUsers = subscribeToAllUsers((users) => {
    allUsers = users.filter(u => u && (u.email || u.name));
    updateKpis();
    renderTabContent();
    updateCoordinatorSelect();
  });

  const unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
    allTeams = teams;
    updateKpis();
    renderTabContent();
  });

  const unsubContacts = subscribeToAllContacts((contacts) => {
    allContacts = contacts;
    updateKpis();
    if (currentTab === 'overview') renderTabContent();
  });

  const unsubAudit = subscribeToAuditLogs((logs) => {
    auditLogs = logs;
    if (currentTab === 'audit') renderTabContent();
  });

  const unsubMessages = subscribeToMessagesHistory(null, (msgs) => {
    allMessages = msgs;
    updateKpis();
    if (currentTab === 'overview') renderTabContent();
  });

  function updateCoordinatorSelect() {
    const sel = container.querySelector('#select-team-coord');
    if (!sel) return;

    let coords = allUsers.filter(u => u.role === 'coordinator' || u.role === 'admin');
    if (coords.length === 0) {
      coords = [{ uid: currentUser.uid, name: currentUser.name || currentUser.email, role: 'admin' }];
    }

    sel.innerHTML = coords.map((c, i) => `
      <option value="${c.uid}" data-name="${c.name || c.email}" ${i === 0 ? 'selected' : ''}>
        ${c.name || c.email} (${c.role === 'admin' ? 'Administrador' : 'Coordenador'})
      </option>
    `).join('');
  }

  function switchTab(tabName) {
    currentTab = tabName;
    ['overview', 'teams', 'users', 'whatsapp', 'audit'].forEach(t => {
      const btn = container.querySelector(`#tab-btn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.style.borderBottom = '2px solid var(--primary-blue)';
          btn.style.color = 'var(--primary-blue)';
          btn.style.fontWeight = '700';
        } else {
          btn.style.borderBottom = '2px solid transparent';
          btn.style.color = 'var(--text-muted)';
          btn.style.fontWeight = '600';
        }
      }
    });
    renderTabContent();
  }

  // Tabs Listeners
  container.querySelector('#tab-btn-overview')?.addEventListener('click', () => switchTab('overview'));
  container.querySelector('#tab-btn-teams')?.addEventListener('click', () => switchTab('teams'));
  container.querySelector('#tab-btn-users')?.addEventListener('click', () => switchTab('users'));
  container.querySelector('#tab-btn-whatsapp')?.addEventListener('click', () => switchTab('whatsapp'));
  container.querySelector('#tab-btn-audit')?.addEventListener('click', () => switchTab('audit'));
  container.querySelector('#card-kpi-whatsapp-trigger')?.addEventListener('click', () => switchTab('whatsapp'));

  // Modal Nova Equipe
  const teamModal = container.querySelector('#modal-new-team');
  container.querySelector('#btn-admin-new-team')?.addEventListener('click', () => {
    updateCoordinatorSelect();
    teamModal.style.display = 'flex';
  });
  container.querySelector('#btn-close-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-team-modal')?.addEventListener('click', () => { teamModal.style.display = 'none'; });

  container.querySelector('#form-new-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-team-name').value.trim();
    const coordSel = container.querySelector('#select-team-coord');
    const coordUid = coordSel.value;
    const coordName = coordSel.options[coordSel.selectedIndex]?.getAttribute('data-name') || 'Coordenador';

    if (!coordUid) {
      showToast('Por favor, selecione um Coordenador Líder.', 'warning');
      return;
    }

    const saveBtn = container.querySelector('#btn-save-team-submit');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Criando...';

    try {
      await createTeamInFirestore({ name, coordinatorUid: coordUid, coordinatorName: coordName });
      await recordSystemAuditLog({
        actor_uid: currentUser.uid,
        actor_name: currentUser.name,
        action: 'team_created',
        metadata: { team_name: name, coordinator: coordName }
      });
      showToast(`Equipe "${name}" criada com sucesso!`, 'success');
      teamModal.style.display = 'none';
      container.querySelector('#form-new-team').reset();
      switchTab('teams');
    } catch (err) {
      console.error('Erro ao criar equipe:', err);
      showToast(`Erro ao criar equipe: ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Criar Equipe';
    }
  });

  // Modal Novo Coordenador
  const coordModal = container.querySelector('#modal-new-coord');
  container.querySelector('#btn-admin-new-coord')?.addEventListener('click', () => { coordModal.style.display = 'flex'; });
  container.querySelector('#btn-close-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });
  container.querySelector('#btn-cancel-coord-modal')?.addEventListener('click', () => { coordModal.style.display = 'none'; });

  container.querySelector('#form-new-coord')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#input-coord-name').value.trim();
    const email = container.querySelector('#input-coord-email').value.trim();

    const saveBtn = container.querySelector('#btn-save-coord-submit');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Cadastrando...';

    try {
      await createUserProfileDirectly({
        email,
        name,
        role: 'coordinator',
        teamId: null
      });
      await recordSystemAuditLog({
        actor_uid: currentUser.uid,
        actor_name: currentUser.name,
        action: 'user_created',
        metadata: { role: 'coordinator', email }
      });
      showToast(`Coordenador "${name}" cadastrado com sucesso!`, 'success');
      coordModal.style.display = 'none';
      container.querySelector('#form-new-coord').reset();
    } catch (err) {
      console.error('Erro ao registrar coordenador:', err);
      showToast(`Erro ao registrar coordenador: ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cadastrar Coordenador';
    }
  });

  return () => {
    unsubUsers();
    unsubTeams();
    unsubContacts();
    unsubAudit();
    if (unsubMessages) unsubMessages();
  };
}
