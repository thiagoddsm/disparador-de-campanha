import { 
  subscribeToAllContacts, 
  subscribeToTenantTeams, 
  subscribeToAllUsers, 
  DEFAULT_TENANT_ID 
} from '../firebase/realtime.js';
import { executeDispatch } from '../firebase/dispatchEngine.js';
import { resolveSpintax, sendEvolutionTextMessage } from '../firebase/evolutionApi.js';
import { showToast } from '../utils/feedback.js';

export function renderBulkDispatchView(container, currentUser, onNavigate) {
  let allContacts = [];
  let allTeams = [];
  let allUsers = [];

  let selectedTeamFilter = 'all';
  let selectedLeaderFilter = 'all';

  // Configurações Anti-Ban padrão
  let totalDailyLimit = 60;
  let batchSize = 20;
  let minDelaySec = 15;
  let maxDelaySec = 45;
  let typingSec = 3;
  let coolingMinutes = 90;

  // Estado da Fila de Disparo
  let isRunning = false;
  let isPaused = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  let queue = [];
  let currentContactIndex = 0;
  let currentBatchIndex = 1;
  let sentInCurrentBatch = 0;
  let totalSentToday = 0;
  let dispatchLogs = [];

  let activeTimer = null;
  let activeCountdownInterval = null;

  // Template Spintax padrão recomendado pelo usuário
  let defaultTemplate = `{Olá|Oi|Como vai}, {primeiro_nome}! {Tudo bem?|Espero que esteja tendo um bom dia.}\n\nEstamos acompanhando as novidades da nossa região e gostaríamos de saber sua opinião.\n\n{Qualquer dúvida me avise.|Fico à disposição!|Podemos nos falar por aqui?}`;

  container.innerHTML = `
    <div class="page-content" style="max-width: 1200px; padding: 1.5rem;">
      
      <!-- Header do Módulo Anti-Ban -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 0.75rem; padding: 2px 8px;">
              🛡️ MODO ANTI-BAN & WARMUP
            </span>
            <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.75rem; padding: 2px 8px;">
              ⚡ EVOLUTION API
            </span>
          </div>
          <h2 style="font-size: 1.6rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0.35rem 0 0 0;">
            Disparo em Massa Inteligente
          </h2>
          <p style="font-size: 0.85rem; color: #64748B; margin: 3px 0 0 0;">
            Simulação de comportamento orgânico humano com blocos, Spintax, digitação simulada e pausas de resfriamento.
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button id="btn-goto-history" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.55rem 1rem; font-weight: 600;">
            📜 Ver Histórico de Envios
          </button>
        </div>
      </div>

      <!-- Cronograma & Parâmetros Estratégicos -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- Bloco 1: Manhã -->
        <div class="kpi-card" style="border-top: 3px solid #3B82F6; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #2563EB;">BLOCO 1 · MANHÃ</span>
            <span style="font-size: 0.72rem; color: #64748B; font-weight: 600;">09:30 às 10:15</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">20 envios</div>
          <span style="font-size: 0.75rem; color: #64748B;">Delay randômico: 15–40s (~12 min)</span>
        </div>

        <!-- Intervalo e Atendimento -->
        <div class="kpi-card" style="border-top: 3px solid #F59E0B; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #D97706;">JANELA DE DESCANSO</span>
            <span style="font-size: 0.72rem; color: #64748B; font-weight: 600;">Pausa de 90 min</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">Atendimento</div>
          <span style="font-size: 0.75rem; color: #64748B;">Espaço para responder quem interagir</span>
        </div>

        <!-- Bloco 2: Tarde -->
        <div class="kpi-card" style="border-top: 3px solid #10B981; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #059669;">BLOCO 2 · TARDE</span>
            <span style="font-size: 0.72rem; color: #64748B; font-weight: 600;">14:00 às 14:45</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">20 envios</div>
          <span style="font-size: 0.75rem; color: #64748B;">Variação Spintax (novo payload)</span>
        </div>

        <!-- Bloco 3: Final da Tarde -->
        <div class="kpi-card" style="border-top: 3px solid #8B5CF6; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #7C3AED;">BLOCO 3 · FINAL DO DIA</span>
            <span style="font-size: 0.72rem; color: #64748B; font-weight: 600;">16:30 às 17:15</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">20 envios</div>
          <span style="font-size: 0.75rem; color: #64748B;">Meta diária: 60 envios concluídos</span>
        </div>
      </div>

      <!-- Configuração de Parâmetros & Editor Spintax -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        
        <!-- Coluna 1: Parâmetros de Disparo & Filtro da Fila -->
        <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.4rem;">
            ⚙️ Configurações da Fila Anti-Ban
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Total de Envios / Dia
              </label>
              <input type="number" id="input-daily-limit" class="topbar-search-input" style="width: 100%; background: #F8FAFC;" value="60" min="1" max="500">
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Tamanho do Bloco (Lote)
              </label>
              <input type="number" id="input-batch-size" class="topbar-search-input" style="width: 100%; background: #F8FAFC;" value="20" min="1" max="100">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Delay Randômico (Segundos)
              </label>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <input type="number" id="input-min-delay" class="topbar-search-input" style="width: 50%; background: #F8FAFC;" value="15" min="5" max="120">
                <span style="color: #94A3B8;">a</span>
                <input type="number" id="input-max-delay" class="topbar-search-input" style="width: 50%; background: #F8FAFC;" value="45" min="10" max="300">
              </div>
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Simular "Digitando..."
              </label>
              <select id="select-typing-sim" class="form-control" style="background: #F8FAFC; padding: 0.55rem 0.75rem; font-size: 0.82rem;">
                <option value="2">2 a 3 segundos (Rápido)</option>
                <option value="3" selected>3 a 5 segundos (Orgânico)</option>
                <option value="6">5 a 8 segundos (Mais Lento)</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
              Pausa entre Blocos de Envio
            </label>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <input type="number" id="input-cooling-minutes" class="topbar-search-input" style="width: 100px; background: #F8FAFC;" value="90" min="1" max="300">
              <span style="font-size: 0.8rem; color: #64748B;">minutos de descanso para atendimento</span>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 1.25rem 0;">

          <!-- Seleção da Base de Destinatários -->
          <h4 style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.75rem 0;">
            🎯 Seleção da Base de Contatos
          </h4>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748B; margin-bottom: 0.25rem;">
                Equipe / Coordenador
              </label>
              <select id="bulk-team-select" class="form-control" style="background: #F8FAFC; padding: 0.5rem 0.75rem; font-size: 0.82rem;">
                <option value="all">🌐 Todas as Equipes</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748B; margin-bottom: 0.25rem;">
                Líder / Carteira
              </label>
              <select id="bulk-leader-select" class="form-control" style="background: #F8FAFC; padding: 0.5rem 0.75rem; font-size: 0.82rem;">
                <option value="all">👥 Todos os Líderes</option>
              </select>
            </div>
          </div>

          <div id="bulk-queue-preview" style="background: #F1F5F9; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.82rem; color: #334155; display: flex; justify-content: space-between; align-items: center;">
            <span>Contatos pendentes prontos para a fila:</span>
            <strong id="bulk-queue-count" style="font-size: 1.1rem; color: #0F172A;">0</strong>
          </div>
        </div>

        <!-- Coluna 2: Editor Spintax & Variação Anti-Hash -->
        <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              💬 Mensagem com Spintax
            </h3>
            <button id="btn-preview-spintax" class="btn-outline-white" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; font-weight: 700;">
              🎲 Gerar 3 Prévias
            </button>
          </div>

          <p style="font-size: 0.78rem; color: #64748B; margin: 0 0 0.75rem 0;">
            Use chaves <code>{opção1|opção2}</code> para variar saudações e texto. Tags disponíveis: <code>{nome}</code>, <code>{primeiro_nome}</code>, <code>{cidade}</code>, <code>{bairro}</code>.
          </p>

          <textarea id="bulk-message-template" class="form-control" style="flex: 1; min-height: 140px; font-family: monospace; font-size: 0.85rem; line-height: 1.4; padding: 0.75rem; background: #FAFAFA; border: 1px solid #CBD5E1; resize: vertical;" placeholder="Digite o texto com Spintax...">${defaultTemplate}</textarea>

          <!-- Prévias Dinâmicas de Spintax -->
          <div id="spintax-previews-container" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">
              Exemplo de Variações que serão enviadas:
            </div>
            <div id="spintax-previews-list" style="display: flex; flex-direction: column; gap: 0.4rem;">
              <!-- 3 Prévias automáticas -->
            </div>
          </div>
        </div>

      </div>

      <!-- Console de Execução Ao Vivo -->
      <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">
              Console de Execução da Fila
            </h3>
            <div id="queue-live-status-text" style="font-size: 0.85rem; color: #64748B; margin-top: 3px; font-weight: 600;">
              Pronto para iniciar. Fila em repouso.
            </div>
          </div>

          <!-- Botões de Controle de Fila -->
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <button id="btn-start-bulk" class="btn-green-action" style="font-size: 0.9rem; padding: 0.65rem 1.35rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.45rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Iniciar Disparo em Massa
            </button>
            <button id="btn-pause-bulk" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.65rem 1rem; font-weight: 700; display: none;">
              ⏸ Pausar
            </button>
            <button id="btn-resume-bulk" class="btn-primary-blue" style="font-size: 0.85rem; padding: 0.65rem 1rem; font-weight: 700; display: none;">
              ▶ Retomar
            </button>
            <button id="btn-stop-bulk" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.65rem 1rem; font-weight: 700; color: #DC2626; border-color: #FECACA; display: none;">
              ⏹ Abortar Fila
            </button>
          </div>
        </div>

        <!-- Barras de Progresso e Métricas em Tempo Real -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem;">
          
          <!-- Progresso do Bloco Atual -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span id="batch-progress-label" style="font-size: 0.8rem; font-weight: 800; color: #334155;">
                PROGRESSO DO BLOCO 1
              </span>
              <strong id="batch-progress-num" style="font-size: 0.85rem; color: #0F172A;">0 / 20</strong>
            </div>
            <div style="width: 100%; height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden;">
              <div id="batch-progress-bar" style="width: 0%; height: 100%; background: #3B82F6; transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Progresso Diário Global -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="font-size: 0.8rem; font-weight: 800; color: #334155;">
                TOTAL DISPARADO HOJE
              </span>
              <strong id="daily-progress-num" style="font-size: 0.85rem; color: #0F172A;">0 / 60</strong>
            </div>
            <div style="width: 100%; height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden;">
              <div id="daily-progress-bar" style="width: 0%; height: 100%; background: #10B981; transition: width 0.3s ease;"></div>
            </div>
          </div>

        </div>

        <!-- Indicador de Status Visual do Anti-Ban (Countdown / Digitando) -->
        <div id="antiban-activity-banner" style="display: none; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 0.85rem 1.25rem; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span id="antiban-spinner" style="font-size: 1.2rem;">⏳</span>
            <div>
              <div id="antiban-status-title" style="font-weight: 800; font-size: 0.88rem; color: #1E40AF;">
                Aguardando Delay Anti-Ban...
              </div>
              <div id="antiban-status-sub" style="font-size: 0.78rem; color: #3B82F6; margin-top: 1px;">
                Intervalo aleatório para simular comportamento humano.
              </div>
            </div>
          </div>
          <div id="antiban-countdown-badge" style="background: #1D4ED8; color: #FFFFFF; font-size: 1.1rem; font-weight: 900; padding: 4px 14px; border-radius: 9999px; font-family: monospace;">
            00s
          </div>
        </div>

        <!-- Log Ao Vivo da Execução -->
        <div style="border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden;">
          <div style="padding: 0.75rem 1rem; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 0.8rem; font-weight: 800; color: #64748B;">
            LOG DE ATIVIDADE EM TEMPO REAL
          </div>
          <div id="bulk-live-logs" style="max-height: 220px; overflow-y: auto; padding: 0.5rem; font-family: monospace; font-size: 0.78rem; background: #FFFFFF; display: flex; flex-direction: column; gap: 4px;">
            <div style="color: #94A3B8; text-align: center; padding: 1.5rem;">Nenhum disparo iniciado ainda. Clique em "Iniciar Disparo em Massa".</div>
          </div>
        </div>

      </div>

    </div>
  `;

  function renderSpintaxPreviews() {
    const raw = container.querySelector('#bulk-message-template')?.value || defaultTemplate;
    const listEl = container.querySelector('#spintax-previews-list');
    if (!listEl) return;

    const sampleNames = ['Mariana Moura', 'Carlos Eduardo', 'Fernanda Lima'];
    const sampleCities = ['Niterói', 'São Gonçalo', 'Rio de Janeiro'];

    listEl.innerHTML = [1, 2, 3].map(i => {
      const name = sampleNames[i - 1];
      const firstName = name.split(' ')[0];
      const city = sampleCities[i - 1];

      let rendered = resolveSpintax(raw);
      rendered = rendered.replace(/\{primeiro_nome\}|\{primeironome\}|\{first_name\}/gi, firstName);
      rendered = rendered.replace(/\{nome\}/gi, firstName);
      rendered = rendered.replace(/\{cidade\}/gi, city);
      rendered = rendered.replace(/\{bairro\}/gi, 'Centro');

      return `
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.8rem; color: #166534; line-height: 1.35; white-space: pre-wrap;">
          <strong>Variação ${i} (para ${firstName}):</strong>\n${rendered}
        </div>
      `;
    }).join('');
  }
  renderSpintaxPreviews();

  function updateQueuePreview() {
    let pendingContacts = allContacts.filter(c => c.status === 'pending');

    // Filtro por Equipe
    if (selectedTeamFilter !== 'all') {
      const team = allTeams.find(t => t.id === selectedTeamFilter || t.name === selectedTeamFilter);
      pendingContacts = pendingContacts.filter(c => c.team_id === selectedTeamFilter || (team && (c.team_id === team.name || c.team_name === team.name)));
    }

    // Filtro por Líder
    if (selectedLeaderFilter !== 'all') {
      const leader = allUsers.find(u => u.uid === selectedLeaderFilter);
      pendingContacts = pendingContacts.filter(c => c.assigned_to === selectedLeaderFilter || (leader && (c.assigned_to_name === leader.name || c.assigned_to === leader.email)));
    }

    queue = pendingContacts;
    const countEl = container.querySelector('#bulk-queue-count');
    if (countEl) countEl.textContent = queue.length;
  }

  function populateDropdowns() {
    const teamSel = container.querySelector('#bulk-team-select');
    const leaderSel = container.querySelector('#bulk-leader-select');

    if (teamSel) {
      teamSel.innerHTML = `
        <option value="all">🌐 Todas as Equipes</option>
        ${allTeams.map(t => `<option value="${t.id}">👥 ${t.name}</option>`).join('')}
      `;
    }

    if (leaderSel) {
      const validLeaders = allUsers.filter(u => u && (u.name || u.email));
      leaderSel.innerHTML = `
        <option value="all">👥 Todos os Líderes</option>
        ${validLeaders.map(u => `<option value="${u.uid}">👤 ${u.name || u.email}</option>`).join('')}
      `;
    }
  }

  function appendLog(msg, type = 'info') {
    const logBox = container.querySelector('#bulk-live-logs');
    if (!logBox) return;

    if (logBox.children.length === 1 && logBox.children[0].textContent.includes('Nenhum disparo iniciado')) {
      logBox.innerHTML = '';
    }

    const time = new Date().toLocaleTimeString('pt-BR');
    const color = type === 'success' ? '#16A34A' : type === 'warning' ? '#D97706' : type === 'error' ? '#DC2626' : '#2563EB';
    const row = document.createElement('div');
    row.style.padding = '2px 0';
    row.style.borderBottom = '1px solid #F1F5F9';
    row.innerHTML = `<span style="color: #94A3B8;">[${time}]</span> <span style="color: ${color}; font-weight: 700;">${msg}</span>`;
    logBox.prepend(row);
  }

  function updateProgressUI() {
    const batchProgNum = container.querySelector('#batch-progress-num');
    const batchProgBar = container.querySelector('#batch-progress-bar');
    const batchProgLabel = container.querySelector('#batch-progress-label');
    const dailyProgNum = container.querySelector('#daily-progress-num');
    const dailyProgBar = container.querySelector('#daily-progress-bar');

    if (batchProgLabel) batchProgLabel.textContent = `PROGRESSO DO BLOCO ${currentBatchIndex}`;
    if (batchProgNum) batchProgNum.textContent = `${sentInCurrentBatch} / ${batchSize}`;
    if (batchProgBar) batchProgBar.style.width = `${Math.min(100, Math.round((sentInCurrentBatch / batchSize) * 100))}%`;

    if (dailyProgNum) dailyProgNum.textContent = `${totalSentToday} / ${totalDailyLimit}`;
    if (dailyProgBar) dailyProgBar.style.width = `${Math.min(100, Math.round((totalSentToday / totalDailyLimit) * 100))}%`;
  }

  function startCountdown(seconds, statusTitle, statusSub, callback) {
    const banner = container.querySelector('#antiban-activity-banner');
    const titleEl = container.querySelector('#antiban-status-title');
    const subEl = container.querySelector('#antiban-status-sub');
    const countdownBadge = container.querySelector('#antiban-countdown-badge');
    const spinner = container.querySelector('#antiban-spinner');

    if (banner) banner.style.display = 'flex';
    if (titleEl) titleEl.textContent = statusTitle;
    if (subEl) subEl.textContent = statusSub;
    if (spinner) spinner.textContent = '⏳';

    let remaining = seconds;
    if (countdownBadge) countdownBadge.textContent = `${remaining}s`;

    if (activeCountdownInterval) clearInterval(activeCountdownInterval);
    activeCountdownInterval = setInterval(() => {
      if (!isRunning || isPaused) {
        clearInterval(activeCountdownInterval);
        return;
      }
      remaining--;
      if (countdownBadge) {
        countdownBadge.textContent = remaining >= 60 
          ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
          : `${remaining}s`;
      }

      if (remaining <= 0) {
        clearInterval(activeCountdownInterval);
        if (banner) banner.style.display = 'none';
        callback();
      }
    }, 1000);
  }

  async function processNextInQueue() {
    if (!isRunning || isPaused) return;

    // Verifica limite diário atingido
    if (totalSentToday >= totalDailyLimit) {
      appendLog(`🎉 Meta diária de ${totalDailyLimit} envios concluída com sucesso! Fila finalizada.`, 'success');
      showToast('Meta diária de disparos em massa concluída!', 'success');
      stopQueue();
      return;
    }

    // Verifica fim de bloco (cooling period de descanso)
    if (sentInCurrentBatch >= batchSize) {
      appendLog(`☕ Bloco ${currentBatchIndex} finalizado (${batchSize} envios). Iniciando pausa de descanso de ${coolingMinutes} minutos para o chip e atendimento...`, 'warning');
      
      const coolingSec = coolingMinutes * 60;
      currentBatchIndex++;
      sentInCurrentBatch = 0;
      updateProgressUI();

      startCountdown(
        coolingSec,
        `☕ Pausa de Resfriamento do Chip (Bloco ${currentBatchIndex - 1} Concluído)`,
        `Pausa de ${coolingMinutes} minutos para responder contatos e manter o chip seguro.`,
        () => {
          appendLog(`▶ Retomando disparos: Iniciando Bloco ${currentBatchIndex}...`, 'info');
          processNextInQueue();
        }
      );
      return;
    }

    // Verifica se ainda há contatos na fila
    if (currentContactIndex >= queue.length) {
      appendLog('🏁 Todos os contatos pendentes da seleção foram processados!', 'success');
      showToast('Fila de contatos concluída!', 'success');
      stopQueue();
      return;
    }

    const contact = queue[currentContactIndex];
    currentContactIndex++;

    const templateRaw = container.querySelector('#bulk-message-template')?.value || defaultTemplate;
    const cleanFirstName = (contact.name || 'Prezado(a)').split(' ')[0];

    // 1. Simula digitando (Composing)
    const typingTime = typingSec * 1000;
    const banner = container.querySelector('#antiban-activity-banner');
    const titleEl = container.querySelector('#antiban-status-title');
    const subEl = container.querySelector('#antiban-status-sub');
    const spinner = container.querySelector('#antiban-spinner');
    
    if (banner) banner.style.display = 'flex';
    if (titleEl) titleEl.textContent = `✍️ Simulando Digitação para ${contact.name}...`;
    if (subEl) subEl.textContent = `Presença "composing" ativa na Evolution API (${typingSec}s)`;
    if (spinner) spinner.textContent = '✍️';

    setTimeout(async () => {
      if (!isRunning || isPaused) return;

      try {
        // 2. Executa disparo com transação atômica e Spintax
        await executeDispatch({
          contactId: contact.id,
          contactName: contact.name,
          contactCompany: contact.company,
          contactCity: contact.city,
          contactNeighborhood: contact.neighborhood || contact.bairro,
          contactPhone: contact.phone,
          user: currentUser,
          strategy: 'evolution_api',
          templateBody: templateRaw
        });

        consecutiveErrors = 0;
        sentInCurrentBatch++;
        totalSentToday++;
        updateProgressUI();

        appendLog(`✓ Mensagem enviada para ${contact.name} (${contact.phone}) via Evolution API. [Bloco ${currentBatchIndex}: ${sentInCurrentBatch}/${batchSize}]`, 'success');

        // 3. Delay Randômico Humano (15 a 45 segundos)
        const randomDelay = Math.floor(Math.random() * (maxDelaySec - minDelaySec + 1)) + minDelaySec;
        startCountdown(
          randomDelay,
          `⏳ Delay de Segurança Anti-Ban: ${randomDelay}s`,
          `Intervalo randômico humano antes do próximo envio.`,
          () => {
            processNextInQueue();
          }
        );

      } catch (err) {
        console.error('Erro ao disparar mensagem em massa:', err);
        consecutiveErrors++;
        appendLog(`✕ Falha ao enviar para ${contact.name}: ${err.message}`, 'error');

        // Circuit Breaker: 3 falhas consecutivas interrompem a fila
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          appendLog(`🛑 CIRCUIT BREAKER ACIONADO: ${MAX_CONSECUTIVE_ERRORS} erros consecutivos de rede. Fila pausada por segurança para evitar ban!`, 'error');
          showToast('Fila pausada: 3 falhas consecutivas de rede detectadas.', 'error');
          pauseQueue();
          return;
        }

        // Delay breve antes de tentar o próximo
        setTimeout(() => {
          processNextInQueue();
        }, 5000);
      }
    }, typingTime);
  }

  function startQueue() {
    updateQueuePreview();
    if (queue.length === 0) {
      showToast('Nenhum contato pendente encontrado com os filtros selecionados.', 'warning');
      return;
    }

    totalDailyLimit = parseInt(container.querySelector('#input-daily-limit')?.value, 10) || 60;
    batchSize = parseInt(container.querySelector('#input-batch-size')?.value, 10) || 20;
    minDelaySec = parseInt(container.querySelector('#input-min-delay')?.value, 10) || 15;
    maxDelaySec = parseInt(container.querySelector('#input-max-delay')?.value, 10) || 45;
    typingSec = parseInt(container.querySelector('#select-typing-sim')?.value, 10) || 3;
    coolingMinutes = parseInt(container.querySelector('#input-cooling-minutes')?.value, 10) || 90;

    isRunning = true;
    isPaused = false;
    currentContactIndex = 0;
    currentBatchIndex = 1;
    sentInCurrentBatch = 0;
    totalSentToday = 0;
    consecutiveErrors = 0;

    container.querySelector('#btn-start-bulk').style.display = 'none';
    container.querySelector('#btn-pause-bulk').style.display = 'inline-flex';
    container.querySelector('#btn-stop-bulk').style.display = 'inline-flex';
    container.querySelector('#queue-live-status-text').textContent = '🟢 Fila em execução com proteção Anti-Ban ativa.';

    appendLog(`🚀 Fila iniciada: Meta ${totalDailyLimit} envios em blocos de ${batchSize} com delay de ${minDelaySec}s a ${maxDelaySec}s.`, 'info');
    updateProgressUI();
    processNextInQueue();
  }

  function pauseQueue() {
    isPaused = true;
    container.querySelector('#btn-pause-bulk').style.display = 'none';
    container.querySelector('#btn-resume-bulk').style.display = 'inline-flex';
    container.querySelector('#queue-live-status-text').textContent = '⏸ Fila pausada pelo operador.';
    appendLog('⏸ Fila pausada.', 'warning');
  }

  function resumeQueue() {
    isPaused = false;
    container.querySelector('#btn-resume-bulk').style.display = 'none';
    container.querySelector('#btn-pause-bulk').style.display = 'inline-flex';
    container.querySelector('#queue-live-status-text').textContent = '🟢 Fila retomada.';
    appendLog('▶ Fila retomada pelo operador.', 'info');
    processNextInQueue();
  }

  function stopQueue() {
    isRunning = false;
    isPaused = false;
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);

    container.querySelector('#btn-start-bulk').style.display = 'inline-flex';
    container.querySelector('#btn-pause-bulk').style.display = 'none';
    container.querySelector('#btn-resume-bulk').style.display = 'none';
    container.querySelector('#btn-stop-bulk').style.display = 'none';
    container.querySelector('#antiban-activity-banner').style.display = 'none';
    container.querySelector('#queue-live-status-text').textContent = 'Pronto para iniciar. Fila em repouso.';
  }

  // Event Listeners
  container.querySelector('#btn-preview-spintax')?.addEventListener('click', renderSpintaxPreviews);
  container.querySelector('#bulk-message-template')?.addEventListener('input', renderSpintaxPreviews);

  container.querySelector('#bulk-team-select')?.addEventListener('change', (e) => {
    selectedTeamFilter = e.target.value;
    updateQueuePreview();
  });

  container.querySelector('#bulk-leader-select')?.addEventListener('change', (e) => {
    selectedLeaderFilter = e.target.value;
    updateQueuePreview();
  });

  container.querySelector('#btn-start-bulk')?.addEventListener('click', startQueue);
  container.querySelector('#btn-pause-bulk')?.addEventListener('click', pauseQueue);
  container.querySelector('#btn-resume-bulk')?.addEventListener('click', resumeQueue);
  container.querySelector('#btn-stop-bulk')?.addEventListener('click', () => {
    if (confirm('Deseja realmente abortar a fila de disparos em massa?')) {
      stopQueue();
      appendLog('⏹ Fila abortada pelo operador.', 'error');
    }
  });

  container.querySelector('#btn-goto-history')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('history');
  });

  // Subscriptions em tempo real
  const unsubContacts = subscribeToAllContacts((contacts) => {
    allContacts = contacts;
    updateQueuePreview();
  });

  const unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
    allTeams = teams;
    populateDropdowns();
  });

  const unsubUsers = subscribeToAllUsers((users) => {
    allUsers = users;
    populateDropdowns();
  });

  return () => {
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);
    if (unsubContacts) unsubContacts();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
  };
}
