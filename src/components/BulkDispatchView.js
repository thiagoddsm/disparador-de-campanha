import { 
  subscribeToAllContacts, 
  subscribeToTeamContacts,
  subscribeToTenantTeams, 
  subscribeToAllUsers, 
  DEFAULT_TENANT_ID 
} from '../firebase/realtime.js';
import { executeDispatch } from '../firebase/dispatchEngine.js';
import { resolveSpintax } from '../firebase/evolutionApi.js';
import { showToast } from '../utils/feedback.js';

/**
 * Dicionário inteligente para enriquecer textos normais em Spintax rico em português.
 */
function autoTransformTextToSpintax(text) {
  if (!text) return '';
  let res = text;

  const replacements = [
    // Saudações
    { regex: /\b(olá|ola)\b/gi, spintax: '{Olá|Oi|Como vai|Tudo bem|Olá, tudo bom}' },
    { regex: /\b(bom dia)\b/gi, spintax: '{Bom dia|Ótimo dia|Um excelente dia}' },
    { regex: /\b(boa tarde)\b/gi, spintax: '{Boa tarde|Ótima tarde|Uma excelente tarde}' },
    { regex: /\b(boa noite)\b/gi, spintax: '{Boa noite|Ótima noite}' },
    { regex: /\b(tudo bem\??|tudo bem com você\??)/gi, spintax: '{Tudo bem?|Tudo certo por aí?|Espero que esteja tendo um ótimo dia!|Como vão as coisas?}' },
    
    // Verbos e intenções comuns
    { regex: /\b(gostaria de saber|gostaríamos de saber)\b/gi, spintax: '{gostaria de saber|queria entender|gostaríamos de consultar|temos interesse em saber}' },
    { regex: /\b(gostaria de contar|gostaríamos de contar)\b/gi, spintax: '{gostaríamos de contar|queremos muito contar|seria uma honra contar|esperamos contar}' },
    { regex: /\b(estamos acompanhando)\b/gi, spintax: '{estamos acompanhando|estamos de olho|estamos atentos|estamos monitorando}' },
    { regex: /\b(estamos realizando|estamos fazendo)\b/gi, spintax: '{estamos realizando|estamos desenvolvendo|estamos conduzindo|estamos promovendo}' },
    { regex: /\b(sua opinião|sua visão)\b/gi, spintax: '{sua opinião|sua visão|seu ponto de vista|sua avaliação}' },

    // Despedidas e Call-To-Actions
    { regex: /\b(qualquer dúvida me avise\.?|qualquer dúvida estou à disposição\.?)/gi, spintax: '{Qualquer dúvida me avise!|Fico à sua disposição!|Podemos conversar por aqui?|Me avise se tiver alguma dúvida!|Estou por aqui para o que precisar!}' },
    { regex: /\b(um abraço\.?|abraço\.?|abraços\.?)/gi, spintax: '{Um grande abraço!|Abraços!|Até logo!|Seguimos em contato!}' },
    { regex: /\b(muito obrigado\.?|obrigado\.?|obrigada\.?)/gi, spintax: '{Muito obrigado!|Agradeço desde já!|Obrigado pela atenção!|Gratidão!}' }
  ];

  replacements.forEach(r => {
    if (r.regex.test(res)) {
      res = res.replace(r.regex, r.spintax);
    }
  });

  return res;
}

export function renderBulkDispatchView(container, currentUser, onNavigate) {
  let allContacts = [];
  let allTeams = [];
  let allUsers = [];

  let selectedTeamFilter = 'all';
  let selectedLeaderFilter = 'all';

  // Configurações Anti-Ban 100% Personalizáveis
  let totalDailyLimit = 60;
  let batchSize = 20;
  let minDelaySec = 15;
  let maxDelaySec = 45;
  let typingSec = 3;
  let coolingMinutes = 20;
  let numPreviewVariations = 3;

  // Lista de Versões de Mensagens para Alternância
  let messageVersions = [];

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

  let activeCountdownInterval = null;

  // Template Spintax padrão inicial
  let defaultTemplate = `{Olá|Oi|Como vai}, {primeiro_nome}! {Tudo bem?|Espero que esteja tendo um bom dia.}\n\nEstamos acompanhando as novidades da nossa região e gostaríamos de saber sua opinião.\n\n{Qualquer dúvida me avise.|Fico à disposição!|Podemos nos falar por aqui?}`;

  container.innerHTML = `
    <div class="page-content" style="max-width: 1240px; padding: 1.5rem;">
      
      <!-- Header do Módulo Anti-Ban -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 0.75rem; padding: 2px 8px;">
              🛡️ DISPARO EM MASSA ANTI-BAN
            </span>
            <span class="pill-btn" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.75rem; padding: 2px 8px;">
              ⚡ MULTI-VARIAÇÕES & SPINTAX
            </span>
          </div>
          <h2 style="font-size: 1.6rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0.35rem 0 0 0;">
            Disparo em Massa & Prevenção a Ban
          </h2>
          <p style="font-size: 0.85rem; color: #64748B; margin: 3px 0 0 0;">
            Escreva sua mensagem, gere versões similares para alternar automaticamente e configure os blocos de disparo com total liberdade.
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button id="btn-goto-history" class="btn-outline-white" style="font-size: 0.85rem; padding: 0.55rem 1rem; font-weight: 600;">
            📜 Ver Histórico de Envios
          </button>
        </div>
      </div>

      <!-- Simulador de Cronograma Dinâmico Calculado em Tempo Real -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- KPI 1: Divisão em Blocos -->
        <div class="kpi-card" style="border-top: 3px solid #3B82F6; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #2563EB;">DIVISÃO DA CAMPANHA</span>
            <span id="sim-blocks-badge" class="pill-btn" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.7rem; font-weight: 800;">3 Blocos</span>
          </div>
          <div id="sim-blocks-calc" style="font-size: 1.45rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">3 lotes de 20</div>
          <span id="sim-blocks-desc" style="font-size: 0.75rem; color: #64748B;">Total configurado: 60 envios</span>
        </div>

        <!-- KPI 2: Tempo por Bloco -->
        <div class="kpi-card" style="border-top: 3px solid #10B981; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #059669;">TEMPO POR BLOCO</span>
            <span class="pill-btn" style="background: #ECFDF5; color: #059669; font-size: 0.7rem; font-weight: 800;">Em Execução</span>
          </div>
          <div id="sim-block-duration" style="font-size: 1.45rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">~10 a 15 min</div>
          <span id="sim-block-delay-desc" style="font-size: 0.75rem; color: #64748B;">Delay randômico: 15s a 45s</span>
        </div>

        <!-- KPI 3: Pausa de Descanso -->
        <div class="kpi-card" style="border-top: 3px solid #F59E0B; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #D97706;">INTERVALO DE DESCANSO</span>
            <span class="pill-btn" style="background: #FEF3C7; color: #B45309; font-size: 0.7rem; font-weight: 800;">Atendimento</span>
          </div>
          <div id="sim-cooling-calc" style="font-size: 1.45rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">20 min de pausa</div>
          <span style="font-size: 0.75rem; color: #64748B;">Espaço para dialogar com quem responder</span>
        </div>

        <!-- KPI 4: Estimativa Total & Índice de Segurança -->
        <div class="kpi-card" style="border-top: 3px solid #8B5CF6; background: #FFFFFF; padding: 1.25rem; border-radius: 12px; border: 1px solid #E2E8F0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #7C3AED;">TEMPO TOTAL ESTIMADO</span>
            <span id="sim-safety-badge" class="pill-btn" style="background: #DCFCE7; color: #15803D; font-size: 0.7rem; font-weight: 800;">🟢 Seguro</span>
          </div>
          <div id="sim-total-time" style="font-size: 1.45rem; font-weight: 900; color: #0F172A; margin: 0.35rem 0;">~1h 20min</div>
          <span style="font-size: 0.75rem; color: #64748B;">Diluição orgânica do tráfego</span>
        </div>

      </div>

      <!-- Configuração de Parâmetros & Editor com Gerador de Variações -->
      <div style="display: grid; grid-template-columns: 1fr 1.15fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        
        <!-- Coluna 1: Parâmetros de Disparo & Filtro da Fila -->
        <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.4rem;">
            ⚙️ Parâmetros 100% Customizáveis
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Total de Envios Desejados
              </label>
              <input type="number" id="input-daily-limit" class="topbar-search-input" style="width: 100%; background: #F8FAFC;" value="60" min="1" max="5000">
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Mensagens por Bloco (Lote)
              </label>
              <input type="number" id="input-batch-size" class="topbar-search-input" style="width: 100%; background: #F8FAFC;" value="20" min="1" max="500">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Delay Randômico (Segundos)
              </label>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <input type="number" id="input-min-delay" class="topbar-search-input" style="width: 50%; background: #F8FAFC;" value="15" min="3" max="300">
                <span style="color: #94A3B8;">a</span>
                <input type="number" id="input-max-delay" class="topbar-search-input" style="width: 50%; background: #F8FAFC;" value="45" min="5" max="600">
              </div>
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
                Simular "Digitando..."
              </label>
              <select id="select-typing-sim" class="form-control" style="background: #F8FAFC; padding: 0.55rem 0.75rem; font-size: 0.82rem;">
                <option value="0">Desativado</option>
                <option value="2">2 a 3 segundos (Rápido)</option>
                <option value="3" selected>3 a 5 segundos (Orgânico)</option>
                <option value="6">5 a 8 segundos (Mais Lento)</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">
              Duração da Pausa entre Blocos
            </label>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <input type="number" id="input-cooling-minutes" class="topbar-search-input" style="width: 110px; background: #F8FAFC;" value="20" min="0" max="360">
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

          <div style="margin-bottom: 0.75rem;">
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748B; margin-bottom: 0.25rem;">
              Filtro de Status dos Contatos
            </label>
            <select id="bulk-status-select" class="form-control" style="background: #F8FAFC; padding: 0.5rem 0.75rem; font-size: 0.82rem;">
              <option value="all" selected>🌐 Todos os Contatos da Seleção</option>
              <option value="pending">⏳ Apenas Pendentes (Não abordados)</option>
              <option value="opened">📱 Abertos / Aguardando</option>
              <option value="confirmed">✓ Confirmados</option>
            </select>
          </div>

          <div id="bulk-queue-preview" style="background: #F1F5F9; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.82rem; color: #334155; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; color: #1E293B;">Contatos na fila de envio: <strong style="font-size: 1.15rem; color: #15803D;">0</strong></div>
              <div style="font-size: 0.73rem; color: #64748B; margin-top: 2px;">Carregando contatos da base...</div>
            </div>
          </div>
        </div>

        <!-- Coluna 2: Editor de Mensagem com Gerador de Versões -->
        <div class="main-panel-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                💬 Mensagem Principal & Variações
              </h3>
              <p style="font-size: 0.78rem; color: #64748B; margin: 2px 0 0 0;">
                Escreva o texto original e clique no botão mágico para gerar versões similares automáticas.
              </p>
            </div>
          </div>

          <textarea id="bulk-message-template" class="form-control" style="width: 100%; min-height: 120px; font-family: monospace; font-size: 0.85rem; line-height: 1.4; padding: 0.75rem; background: #FAFAFA; border: 1px solid #CBD5E1; resize: vertical; margin-bottom: 0.75rem;" placeholder="Escreva sua mensagem aqui... Use {primeiro_nome}, {nome}, {cidade}, {bairro} ou Spintax {Olá|Oi}...">${defaultTemplate}</textarea>

          <!-- Barra de Ações para Gerar Variações -->
          <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; background: #F8FAFC; padding: 0.75rem; border-radius: 8px; border: 1px solid #E2E8F0;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #334155;">🪄 Gerar:</span>
            <select id="select-num-variations" style="padding: 0.35rem 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.8rem; font-weight: 700; background: #FFFFFF;">
              <option value="3" selected>3 Versões Similares</option>
              <option value="5">5 Versões Similares</option>
              <option value="8">8 Versões Similares</option>
              <option value="10">10 Versões Similares</option>
            </select>

            <button id="btn-generate-variations" class="btn-primary-blue" style="font-size: 0.8rem; padding: 0.4rem 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
              ✨ Gerar Versões Alternativas
            </button>

            <button id="btn-auto-spintax" class="btn-outline-white" style="font-size: 0.78rem; padding: 0.4rem 0.75rem; font-weight: 700;" title="Adiciona automaticamente chaves Spintax no texto acima">
              ⚡ Inserir Spintax no Texto
            </button>
          </div>

          <!-- Lista de Versões Geradas para Alternância -->
          <div id="spintax-previews-container" style="display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
              <span id="variations-header-title" style="font-size: 0.78rem; font-weight: 800; color: #1E293B; text-transform: uppercase;">
                VERSÕES DE MENSAGEM CONFIGURADAS PARA O DISPARO (3)
              </span>
              <span style="font-size: 0.72rem; color: #059669; font-weight: 700;">
                ✓ Alternância Ativa por Contato
              </span>
            </div>
            
            <div id="spintax-previews-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
              <!-- Versões geradas dinamicamente -->
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
                TOTAL DISPARADO DA CAMPANHA
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

  // Gera X versões completas a partir do texto base (com Spintax resolvido)
  function generateAndRenderVersions() {
    let raw = container.querySelector('#bulk-message-template')?.value.trim() || defaultTemplate;
    
    // Se o texto não tem Spintax, aplica auto-transformação
    if (!raw.includes('{') || !raw.includes('|')) {
      raw = autoTransformTextToSpintax(raw);
    }

    numPreviewVariations = parseInt(container.querySelector('#select-num-variations')?.value, 10) || 3;
    const listEl = container.querySelector('#spintax-previews-list');
    const headerTitle = container.querySelector('#variations-header-title');

    if (headerTitle) {
      headerTitle.textContent = `VERSÕES DE MENSAGEM CONFIGURADAS PARA O DISPARO (${numPreviewVariations})`;
    }

    const sampleNames = ['Mariana Moura', 'Carlos Eduardo', 'Fernanda Lima', 'Rodrigo Silva', 'Juliana Costa', 'Paulo Cezar', 'Renata Souza', 'Felipe Santos', 'Beatriz Alves', 'Lucas Rocha'];
    const sampleCities = ['Niterói', 'São Gonçalo', 'Rio de Janeiro', 'Maricá', 'Itaboraí', 'Nova Iguaçu', 'Duque de Caxias', 'Petrópolis', 'Campos', 'Belford Roxo'];

    messageVersions = Array.from({ length: numPreviewVariations }, (_, index) => {
      return resolveSpintax(raw);
    });

    if (listEl) {
      listEl.innerHTML = messageVersions.map((textVersion, index) => {
        const i = index + 1;
        const name = sampleNames[index % sampleNames.length];
        const firstName = name.split(' ')[0];
        const city = sampleCities[index % sampleCities.length];

        let sampleRendered = textVersion.replace(/\{primeiro_nome\}|\{primeironome\}|\{first_name\}/gi, firstName);
        sampleRendered = sampleRendered.replace(/\{nome\}/gi, firstName);
        sampleRendered = sampleRendered.replace(/\{cidade\}/gi, city);
        sampleRendered = sampleRendered.replace(/\{bairro\}/gi, 'Centro');

        return `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 0.75rem 0.85rem; font-size: 0.82rem; color: #166534; line-height: 1.4; display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #DCFCE7; padding-bottom: 4px;">
              <strong style="color: #15803D;">Versão #${i} (Exemplo com ${firstName} · ${city})</strong>
              <span style="font-size: 0.7rem; background: #DCFCE7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 4px;">Payload Único</span>
            </div>
            <div style="white-space: pre-wrap; word-break: break-word;">${sampleRendered}</div>
          </div>
        `;
      }).join('');
    }
  }

  // Atualiza em tempo real as estimativas matemáticas da campanha conforme o usuário digita
  function updateRealtimeSimulations() {
    totalDailyLimit = parseInt(container.querySelector('#input-daily-limit')?.value, 10) || 60;
    batchSize = parseInt(container.querySelector('#input-batch-size')?.value, 10) || 20;
    minDelaySec = parseInt(container.querySelector('#input-min-delay')?.value, 10) || 15;
    maxDelaySec = parseInt(container.querySelector('#input-max-delay')?.value, 10) || 45;
    coolingMinutes = parseInt(container.querySelector('#input-cooling-minutes')?.value, 10) || 20;
    typingSec = parseInt(container.querySelector('#select-typing-sim')?.value, 10) || 3;

    const totalBlocks = Math.max(1, Math.ceil(totalDailyLimit / batchSize));
    const avgDelay = (minDelaySec + maxDelaySec) / 2;
    const blockDurationMinutes = Math.round((batchSize * (avgDelay + typingSec)) / 60);
    const totalWorkingMinutes = (totalBlocks * blockDurationMinutes) + ((totalBlocks - 1) * coolingMinutes);

    const hours = Math.floor(totalWorkingMinutes / 60);
    const minutes = totalWorkingMinutes % 60;
    const totalFormatted = hours > 0 ? `~${hours}h ${minutes}min` : `~${minutes}min`;

    // Atualiza cards superiores
    const simBlocksBadge = container.querySelector('#sim-blocks-badge');
    const simBlocksCalc = container.querySelector('#sim-blocks-calc');
    const simBlocksDesc = container.querySelector('#sim-blocks-desc');
    const simBlockDuration = container.querySelector('#sim-block-duration');
    const simBlockDelayDesc = container.querySelector('#sim-block-delay-desc');
    const simCoolingCalc = container.querySelector('#sim-cooling-calc');
    const simTotalTime = container.querySelector('#sim-total-time');
    const simSafetyBadge = container.querySelector('#sim-safety-badge');

    if (simBlocksBadge) simBlocksBadge.textContent = `${totalBlocks} Bloco(s)`;
    if (simBlocksCalc) simBlocksCalc.textContent = `${totalBlocks} lote(s) de ${batchSize}`;
    if (simBlocksDesc) simBlocksDesc.textContent = `Total configurado: ${totalDailyLimit} envios`;

    if (simBlockDuration) simBlockDuration.textContent = `~${blockDurationMinutes} min / bloco`;
    if (simBlockDelayDesc) simBlockDelayDesc.textContent = `Delay: ${minDelaySec}s a ${maxDelaySec}s (+${typingSec}s digitação)`;

    if (simCoolingCalc) simCoolingCalc.textContent = `${coolingMinutes} min de pausa`;

    if (simTotalTime) simTotalTime.textContent = totalFormatted;

    // Índice de Risco Anti-Ban
    if (simSafetyBadge) {
      if (minDelaySec < 8 || totalDailyLimit > 300) {
        simSafetyBadge.textContent = '🔴 Alto Risco';
        simSafetyBadge.style.background = '#FEE2E2';
        simSafetyBadge.style.color = '#DC2626';
      } else if (minDelaySec < 15 || coolingMinutes < 10) {
        simSafetyBadge.textContent = '🟡 Moderado';
        simSafetyBadge.style.background = '#FEF3C7';
        simSafetyBadge.style.color = '#B45309';
      } else {
        simSafetyBadge.textContent = '🟢 Seguro';
        simSafetyBadge.style.background = '#DCFCE7';
        simSafetyBadge.style.color = '#15803D';
      }
    }
  }

  let selectedStatusFilter = 'all';

  function updateQueuePreview() {
    let filteredContacts = [...allContacts];

    // 1. Filtro por Equipe / Coordenador
    if (selectedTeamFilter !== 'all') {
      const team = allTeams.find(t => t.id === selectedTeamFilter || t.coordinator_uid === selectedTeamFilter || t.name === selectedTeamFilter);
      const coordUser = allUsers.find(u => u.uid === selectedTeamFilter || (team && u.uid === team.coordinator_uid));
      
      const teamUsers = allUsers.filter(u => 
        u.team_id === selectedTeamFilter || 
        (team && (u.team_id === team.id || u.team_name === team.name || u.coordinator_id === team.coordinator_uid)) ||
        (coordUser && (u.coordinator_id === coordUser.uid || u.coordinator_name === coordUser.name))
      );
      const teamUserUids = new Set(teamUsers.map(u => u.uid));
      const teamUserEmails = new Set(teamUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
      const teamUserNames = new Set(teamUsers.map(u => u.name?.trim().toLowerCase()).filter(Boolean));

      filteredContacts = filteredContacts.filter(c => {
        if (c.team_id === selectedTeamFilter) return true;
        if (team && (c.team_id === team.name || c.team_name === team.name || c.team_id === team.id)) return true;
        if (coordUser && (c.assigned_to === coordUser.uid || c.assigned_to === coordUser.email || (c.assigned_to_name && coordUser.name && c.assigned_to_name.trim().toLowerCase() === coordUser.name.trim().toLowerCase()))) return true;
        if (c.assigned_to && (teamUserUids.has(c.assigned_to) || teamUserEmails.has(c.assigned_to.toLowerCase()))) return true;
        if (c.assigned_to_name && teamUserNames.has(c.assigned_to_name.trim().toLowerCase())) return true;
        return false;
      });
    }

    // 2. Filtro por Líder / Operador
    if (selectedLeaderFilter !== 'all') {
      const leader = allUsers.find(u => u.uid === selectedLeaderFilter);
      filteredContacts = filteredContacts.filter(c => {
        if (c.assigned_to === selectedLeaderFilter) return true;
        if (leader) {
          if (c.assigned_to && (c.assigned_to === leader.email || c.assigned_to === leader.uid)) return true;
          if (c.assigned_to_name && leader.name && c.assigned_to_name.trim().toLowerCase() === leader.name.trim().toLowerCase()) return true;
          if (c.assigned_to_name && leader.email && c.assigned_to_name.trim().toLowerCase() === leader.email.trim().toLowerCase()) return true;
          if (c.assigned_to && leader.name && c.assigned_to.trim().toLowerCase() === leader.name.trim().toLowerCase()) return true;
        }
        return false;
      });
    }

    // 3. Contadores para o resumo visual
    const totalInFilter = filteredContacts.length;
    const pendingInFilter = filteredContacts.filter(c => !c.status || c.status === 'pending').length;
    const confirmedInFilter = filteredContacts.filter(c => c.status === 'confirmed' || c.status === 'user_confirmed').length;
    const openedInFilter = filteredContacts.filter(c => c.status === 'opened').length;

    // 4. Aplica filtro de status selecionado
    if (selectedStatusFilter === 'pending') {
      filteredContacts = filteredContacts.filter(c => !c.status || c.status === 'pending');
    } else if (selectedStatusFilter === 'opened') {
      filteredContacts = filteredContacts.filter(c => c.status === 'opened');
    } else if (selectedStatusFilter === 'confirmed') {
      filteredContacts = filteredContacts.filter(c => c.status === 'confirmed' || c.status === 'user_confirmed');
    }

    queue = filteredContacts;
    const previewBox = container.querySelector('#bulk-queue-preview');
    if (previewBox) {
      previewBox.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #1E293B;">Contatos na fila de envio: <strong style="font-size: 1.15rem; color: #15803D;">${queue.length}</strong></div>
          <div style="font-size: 0.73rem; color: #64748B; margin-top: 2px;">
            ${pendingInFilter} pendentes · ${openedInFilter} abertos · ${confirmedInFilter} confirmados (Total na seleção: ${totalInFilter})
          </div>
        </div>
      `;
    }
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

  let activeExecutionQueue = [];

  async function processNextInQueue() {
    if (!isRunning || isPaused) return;

    // Verifica limite total atingido
    if (totalSentToday >= totalDailyLimit) {
      appendLog(`🎉 Meta de ${totalDailyLimit} envios concluída com sucesso! Fila finalizada.`, 'success');
      showToast('Disparos em massa concluídos com sucesso!', 'success');
      stopQueue();
      return;
    }

    // Verifica fim de bloco (cooling period de descanso)
    if (sentInCurrentBatch >= batchSize) {
      appendLog(`☕ Bloco ${currentBatchIndex} finalizado (${batchSize} envios). Pausa de ${coolingMinutes} minutos para o chip e atendimento...`, 'warning');
      
      const coolingSec = coolingMinutes * 60;
      currentBatchIndex++;
      sentInCurrentBatch = 0;
      updateProgressUI();

      if (coolingSec <= 0) {
        processNextInQueue();
        return;
      }

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
    if (currentContactIndex >= activeExecutionQueue.length) {
      appendLog('🏁 Todos os contatos da fila foram processados!', 'success');
      showToast('Fila de disparos concluída!', 'success');
      stopQueue();
      return;
    }

    const contact = activeExecutionQueue[currentContactIndex];
    currentContactIndex++;

    if (!contact || (!contact.id && !contact.uid)) {
      processNextInQueue();
      return;
    }

    const contactId = contact.id || contact.uid || contact.docId;
    const contactName = contact.name || 'Prezado(a)';
    const contactPhone = contact.phone || '';

    // Alternância de Versões: seleciona uma das versões geradas ou o template ativo
    const selectedVersion = messageVersions.length > 0 
      ? messageVersions[currentContactIndex % messageVersions.length]
      : (container.querySelector('#bulk-message-template')?.value || defaultTemplate);

    // 1. Simula digitando (Composing)
    const typingTime = typingSec * 1000;
    const banner = container.querySelector('#antiban-activity-banner');
    const titleEl = container.querySelector('#antiban-status-title');
    const subEl = container.querySelector('#antiban-status-sub');
    const spinner = container.querySelector('#antiban-spinner');
    
    if (typingSec > 0) {
      if (banner) banner.style.display = 'flex';
      if (titleEl) titleEl.textContent = `✍️ Simulando Digitação para ${contactName}...`;
      if (subEl) subEl.textContent = `Presença "composing" ativa na Evolution API (${typingSec}s)`;
      if (spinner) spinner.textContent = '✍️';
    }

    setTimeout(async () => {
      if (!isRunning || isPaused) return;

      try {
        // 2. Executa disparo com transação atômica e Spintax
        await executeDispatch({
          contactId: contactId,
          contactName: contactName,
          contactCompany: contact.company || contact.city,
          contactCity: contact.city,
          contactNeighborhood: contact.neighborhood || contact.bairro,
          contactPhone: contactPhone,
          user: currentUser,
          strategy: 'evolution_api',
          templateBody: selectedVersion
        });

        consecutiveErrors = 0;
        sentInCurrentBatch++;
        totalSentToday++;
        updateProgressUI();

        appendLog(`✓ Mensagem enviada para ${contactName} (${contactPhone}) via Evolution API. [Bloco ${currentBatchIndex}: ${sentInCurrentBatch}/${batchSize}]`, 'success');

        // 3. Delay Randômico Humano
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
        appendLog(`✕ Falha ao enviar para ${contactName}: ${err.message}`, 'error');

        // Circuit Breaker: 3 falhas consecutivas interrompem a fila
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          appendLog(`🛑 CIRCUIT BREAKER ACIONADO: ${MAX_CONSECUTIVE_ERRORS} erros consecutivos de rede. Fila pausada por segurança para evitar ban!`, 'error');
          showToast('Fila pausada: 3 falhas consecutivas de rede detectadas.', 'error');
          pauseQueue();
          return;
        }

        setTimeout(() => {
          processNextInQueue();
        }, 5000);
      }
    }, typingTime);
  }

  function startQueue() {
    updateQueuePreview();
    if (queue.length === 0) {
      showToast('Nenhum contato encontrado com os filtros selecionados.', 'warning');
      return;
    }

    activeExecutionQueue = [...queue];

    totalDailyLimit = parseInt(container.querySelector('#input-daily-limit')?.value, 10) || 60;
    batchSize = parseInt(container.querySelector('#input-batch-size')?.value, 10) || 20;
    minDelaySec = parseInt(container.querySelector('#input-min-delay')?.value, 10) || 15;
    maxDelaySec = parseInt(container.querySelector('#input-max-delay')?.value, 10) || 45;
    typingSec = parseInt(container.querySelector('#select-typing-sim')?.value, 10) || 3;
    coolingMinutes = parseInt(container.querySelector('#input-cooling-minutes')?.value, 10) || 20;

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

    appendLog(`🚀 Fila iniciada com ${activeExecutionQueue.length} contatos: Meta ${totalDailyLimit} envios em blocos de ${batchSize} com delay de ${minDelaySec}s a ${maxDelaySec}s.`, 'info');
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

  // Event Listeners de Atualização Dinâmica em Tempo Real
  ['#input-daily-limit', '#input-batch-size', '#input-min-delay', '#input-max-delay', '#input-cooling-minutes', '#select-typing-sim'].forEach(id => {
    container.querySelector(id)?.addEventListener('input', updateRealtimeSimulations);
    container.querySelector(id)?.addEventListener('change', updateRealtimeSimulations);
  });

  container.querySelector('#btn-generate-variations')?.addEventListener('click', () => {
    generateAndRenderVersions();
    showToast(`${numPreviewVariations} versões alternativas geradas com sucesso!`, 'success');
  });

  container.querySelector('#btn-auto-spintax')?.addEventListener('click', () => {
    const textEl = container.querySelector('#bulk-message-template');
    if (textEl) {
      textEl.value = autoTransformTextToSpintax(textEl.value);
      generateAndRenderVersions();
      showToast('Spintax automático inserido no texto!', 'success');
    }
  });

  container.querySelector('#select-num-variations')?.addEventListener('change', generateAndRenderVersions);
  container.querySelector('#bulk-message-template')?.addEventListener('input', generateAndRenderVersions);

  container.querySelector('#bulk-team-select')?.addEventListener('change', (e) => {
    selectedTeamFilter = e.target.value;
    updateQueuePreview();
  });

  container.querySelector('#bulk-leader-select')?.addEventListener('change', (e) => {
    selectedLeaderFilter = e.target.value;
    updateQueuePreview();
  });

  container.querySelector('#bulk-status-select')?.addEventListener('change', (e) => {
    selectedStatusFilter = e.target.value;
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
  let unsubContacts = null;
  if (currentUser?.role === 'coordinator' && currentUser?.team_id) {
    unsubContacts = subscribeToTeamContacts(currentUser.team_id, (contacts) => {
      allContacts = contacts;
      updateQueuePreview();
    });
  } else {
    unsubContacts = subscribeToAllContacts((contacts) => {
      allContacts = contacts;
      updateQueuePreview();
    });
  }

  const unsubTeams = subscribeToTenantTeams(DEFAULT_TENANT_ID, (teams) => {
    allTeams = teams;
    populateDropdowns();
    updateQueuePreview();
  });

  const unsubUsers = subscribeToAllUsers((users) => {
    allUsers = users;
    populateDropdowns();
    updateQueuePreview();
  });

  // Inicializa cálculo e versões geradas
  updateRealtimeSimulations();
  generateAndRenderVersions();

  return () => {
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);
    if (unsubContacts) unsubContacts();
    if (unsubTeams) unsubTeams();
    if (unsubUsers) unsubUsers();
  };
}
